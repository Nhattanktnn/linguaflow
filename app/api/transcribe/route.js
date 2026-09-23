import { GoogleGenAI, Type, createPartFromUri, createUserContent } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;

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

export async function POST(request) {
  let uploadedFile = null;
  let ai = null;
  try {
    const body = await request.json();
    const { apiKey, mediaUrl, mimeType, mediaType, languageCode, title, sizeBytes } = body || {};

    if (!apiKey || typeof apiKey !== "string") return Response.json({ error: "Thiếu Gemini API Key." }, { status: 400 });
    if (!isAllowedMediaUrl(mediaUrl)) return Response.json({ error: "Media URL không hợp lệ." }, { status: 400 });
    if (Number(sizeBytes || 0) > MAX_BYTES) return Response.json({ error: "V0.4 chỉ xử lý AI file tối đa 20 MB." }, { status: 413 });
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
      await new Promise((resolve) => setTimeout(resolve, 2000));
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

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: createUserContent([
        createPartFromUri(currentFile.uri, currentFile.mimeType || mimeType),
        prompt,
      ]),
      config: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    const segments = Array.isArray(parsed.segments) ? parsed.segments : [];
    return Response.json({ segments });
  } catch (error) {
    return Response.json({ error: error?.message || "Không thể tạo transcript bằng Gemini." }, { status: 500 });
  } finally {
    if (ai && uploadedFile?.name) {
      try { await ai.files.delete({ name: uploadedFile.name }); } catch {}
    }
  }
}
