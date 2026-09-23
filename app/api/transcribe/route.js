import { GoogleGenAI, Type, createPartFromUri, createUserContent } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;
const MODEL_CHAIN = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const RETRY_DELAYS_MS = [1500, 3500];
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error) {
  const candidates = [
    error?.status,
    error?.code,
    error?.response?.status,
    error?.error?.code,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num >= 100 && num <= 599) return num;
  }
  const match = String(error?.message || "").match(/\b(408|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

function isTransientError(error) {
  return TRANSIENT_STATUS.has(getErrorStatus(error));
}

function friendlyGeminiError(error) {
  const status = getErrorStatus(error);
  const message = String(error?.message || "");
  if (status === 503) {
    return { status: 503, message: "Gemini đang quá tải tạm thời. LinguaFlow đã tự thử lại và đổi model nhưng vẫn chưa nhận được phản hồi. Hãy thử lại sau 1–2 phút." };
  }
  if (status === 429) {
    return { status: 429, message: "Gemini đang giới hạn lượt gọi hoặc API key đã chạm quota. Hãy chờ một lúc rồi thử lại; nếu vẫn lặp lại, kiểm tra quota của key trong Google AI Studio." };
  }
  if (status && status >= 500) {
    return { status: 502, message: "Dịch vụ Gemini đang gặp lỗi tạm thời. Hãy thử lại sau ít phút." };
  }
  if (/api key|permission|unauth|forbidden/i.test(message)) {
    return { status: 401, message: "Gemini API Key không hợp lệ hoặc chưa có quyền dùng model này. Hãy kiểm tra lại key trong Cài đặt AI." };
  }
  return { status: 500, message: message || "Không thể tạo transcript bằng Gemini." };
}

function isAllowedMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in"));
  } catch {
    return false;
  }
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start_seconds: { type: Type.NUMBER },
          end_seconds: { type: Type.NUMBER },
          text: { type: Type.STRING },
          pronunciation: { type: Type.STRING },
          translation_vi: { type: Type.STRING },
          tokens: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                pronunciation: { type: Type.STRING },
                meaning_vi: { type: Type.STRING },
              },
              required: ["term", "pronunciation", "meaning_vi"],
            },
          },
        },
        required: ["start_seconds", "end_seconds", "text", "pronunciation", "translation_vi", "tokens"],
      },
    },
  },
  required: ["segments"],
};

async function generateWithFallback(ai, contents) {
  let lastError = null;

  for (const model of MODEL_CHAIN) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: "application/json",
            responseSchema,
          },
        });
        return { response, modelUsed: model };
      } catch (error) {
        lastError = error;
        if (!isTransientError(error) || attempt === RETRY_DELAYS_MS.length) break;
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  throw lastError || new Error("Gemini không phản hồi.");
}

export async function POST(request) {
  let uploadedFile = null;
  let ai = null;
  try {
    const body = await request.json();
    const { apiKey, mediaUrl, mimeType, mediaType, languageCode, title, sizeBytes } = body || {};

    if (!apiKey || typeof apiKey !== "string") return Response.json({ error: "Thiếu Gemini API Key." }, { status: 400 });
    if (!isAllowedMediaUrl(mediaUrl)) return Response.json({ error: "Media URL không hợp lệ." }, { status: 400 });
    if (Number(sizeBytes || 0) > MAX_BYTES) return Response.json({ error: "V0.4.1 chỉ xử lý AI file tối đa 20 MB." }, { status: 413 });
    if (!mimeType || !/^(audio|video)\//.test(mimeType)) return Response.json({ error: "Chỉ hỗ trợ audio/video." }, { status: 400 });

    const mediaResponse = await fetch(mediaUrl, { cache: "no-store" });
    if (!mediaResponse.ok) throw new Error("Không tải được media từ Supabase.");
    const mediaBuffer = await mediaResponse.arrayBuffer();
    if (mediaBuffer.byteLength > MAX_BYTES) return Response.json({ error: "File vượt quá 20 MB." }, { status: 413 });

    const blob = new Blob([mediaBuffer], { type: mimeType });
    ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    uploadedFile = await ai.files.upload({
      file: blob,
      config: { displayName: String(title || "LinguaFlow media").slice(0, 100) },
    });

    let currentFile = uploadedFile;
    for (let i = 0; i < 30; i += 1) {
      if (!currentFile?.state || currentFile.state === "ACTIVE" || currentFile.state === "SUCCEEDED") break;
      if (currentFile.state === "FAILED") throw new Error("Gemini không xử lý được file media này.");
      await sleep(2000);
      currentFile = await ai.files.get({ name: uploadedFile.name });
    }
    if (currentFile?.state === "PROCESSING") throw new Error("Gemini xử lý file quá lâu. Hãy thử file ngắn hơn.");

    const languageInstruction = languageCode === "zh"
      ? "The target language is Mandarin Chinese. Use Simplified Chinese for text. pronunciation must be standard Hanyu Pinyin with tone marks. For tokens, split into useful Chinese words/phrases, not single characters unless the character is genuinely a standalone word."
      : "The target language is English. pronunciation should be a concise learner-friendly IPA transcription. For tokens, split into useful English words or short fixed phrases.";

    const prompt = `You are creating synchronized language-learning subtitles from this ${mediaType === "video" ? "video" : "audio"}.
${languageInstruction}
Return ONLY the requested structured JSON.
Rules:
- Transcribe only actual spoken content. Do not invent dialogue during silence or music.
- Create natural subtitle segments, normally 1 to 8 seconds each.
- start_seconds and end_seconds are seconds from the beginning of the media. Keep them ascending and as accurate as possible.
- text must preserve what was spoken naturally.
- translation_vi must be natural Vietnamese.
- pronunciation must cover the complete segment.
- tokens must follow the spoken order. Each token needs term, pronunciation, and Vietnamese meaning in this context.
- Skip segments that contain no intelligible speech.
- Prefer learning-useful segmentation over extremely long paragraphs.`;

    const contents = createUserContent([
      createPartFromUri(currentFile.uri, currentFile.mimeType || mimeType),
      prompt,
    ]);

    const { response, modelUsed } = await generateWithFallback(ai, contents);
    const parsed = JSON.parse(response.text || "{}");
    const segments = Array.isArray(parsed.segments) ? parsed.segments : [];
    return Response.json({ segments, modelUsed });
  } catch (error) {
    const friendly = friendlyGeminiError(error);
    return Response.json({ error: friendly.message }, { status: friendly.status });
  } finally {
    if (ai && uploadedFile?.name) {
      try { await ai.files.delete({ name: uploadedFile.name }); } catch {}
    }
  }
}
