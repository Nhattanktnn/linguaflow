import { GoogleGenAI, Type, createPartFromUri, createUserContent } from "@google/genai";
import { friendlyGeminiError, runWithModelFallback, sleep } from "../../../lib/gemini";
import { languageInstruction } from "../../../lib/languages";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 45 * 1024 * 1024;

function isAllowedMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".supabase.in"));
  } catch { return false; }
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    segments: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      start_seconds: { type: Type.NUMBER }, end_seconds: { type: Type.NUMBER }, text: { type: Type.STRING },
      pronunciation: { type: Type.STRING }, translation_vi: { type: Type.STRING },
      tokens: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
        term: { type: Type.STRING }, pronunciation: { type: Type.STRING }, meaning_vi: { type: Type.STRING }
      }, required: ["term", "pronunciation", "meaning_vi"] } }
    }, required: ["start_seconds", "end_seconds", "text", "pronunciation", "translation_vi", "tokens"] } }
  }, required: ["segments"]
};

async function waitForFile(ai, file) {
  let current = file;
  for (let i = 0; i < 45; i += 1) {
    if (!current?.state || current.state === "ACTIVE" || current.state === "SUCCEEDED") return current;
    if (current.state === "FAILED") throw new Error("Gemini không xử lý được file này.");
    await sleep(2000);
    current = await ai.files.get({ name: file.name });
  }
  throw new Error("Gemini xử lý file quá lâu. Hãy thử file ngắn hơn.");
}

export async function POST(request) {
  let ai = null;
  let uploadedFile = null;
  try {
    const body = await request.json();
    const { apiKey, model = "auto", mediaUrl, mimeType, sourceType = "audio", languageCode = "zh", title, sizeBytes, sourceText = "" } = body || {};
    if (!apiKey) return Response.json({ error: "Thiếu Gemini API Key." }, { status: 400 });
    if (!["audio", "video", "pdf", "text"].includes(sourceType)) return Response.json({ error: "Loại nội dung chưa được hỗ trợ." }, { status: 400 });
    if (Number(sizeBytes || 0) > MAX_BYTES) return Response.json({ error: "AI xử lý file tối đa 45 MB trong bản này." }, { status: 413 });

    ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    let contents;
    if (sourceType === "text") {
      if (!String(sourceText || "").trim()) return Response.json({ error: "Nội dung text đang trống." }, { status: 400 });
    } else {
      if (!isAllowedMediaUrl(mediaUrl)) return Response.json({ error: "Media URL không hợp lệ." }, { status: 400 });
      const mediaResponse = await fetch(mediaUrl, { cache: "no-store" });
      if (!mediaResponse.ok) throw new Error("Không tải được file từ Supabase.");
      const buffer = await mediaResponse.arrayBuffer();
      if (buffer.byteLength > MAX_BYTES) return Response.json({ error: "File vượt quá 45 MB." }, { status: 413 });
      const blob = new Blob([buffer], { type: mimeType || (sourceType === "pdf" ? "application/pdf" : "application/octet-stream") });
      uploadedFile = await ai.files.upload({ file: blob, config: { displayName: String(title || "LinguaFlow content").slice(0, 100) } });
      uploadedFile = await waitForFile(ai, uploadedFile);
    }

    const timed = sourceType === "audio" || sourceType === "video";
    const prompt = `Create a language-learning lesson from this ${sourceType}. Target language: ${languageInstruction(languageCode)}\nReturn ONLY the requested JSON.\nRules:\n- Use only content actually present. Never invent spoken dialogue or document text.\n- ${timed ? "Create natural subtitle segments normally 1-8 seconds and provide accurate ascending timestamps." : "Break the material into short natural learning segments; use start_seconds=0 and end_seconds=0."}\n- text: exact or faithful target-language text.\n- pronunciation: complete learner pronunciation for the segment.\n- translation_vi: natural Vietnamese.\n- tokens: useful words/short phrases in spoken/written order, each with contextual Vietnamese meaning.\n- Skip unintelligible or meaningless content.\n- Prefer useful phrase segmentation over very long paragraphs.`;

    if (sourceType === "text") {
      contents = `${prompt}\n\nSOURCE TEXT:\n${String(sourceText).slice(0, 80000)}`;
    } else {
      contents = createUserContent([createPartFromUri(uploadedFile.uri, uploadedFile.mimeType || mimeType), prompt]);
    }

    const { response, modelUsed } = await runWithModelFallback({
      ai, apiKey, requestedModel: model,
      call: (candidate) => ai.models.generateContent({ model: candidate, contents, config: { responseMimeType: "application/json", responseSchema } })
    });
    const parsed = JSON.parse(response.text || "{}");
    return Response.json({ segments: Array.isArray(parsed.segments) ? parsed.segments : [], modelUsed });
  } catch (error) {
    const friendly = friendlyGeminiError(error);
    return Response.json({ error: friendly.message }, { status: friendly.status });
  } finally {
    if (ai && uploadedFile?.name) { try { await ai.files.delete({ name: uploadedFile.name }); } catch {} }
  }
}
