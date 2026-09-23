import { GoogleGenAI, Type, createPartFromUri, createUserContent } from "@google/genai";
import { friendlyGeminiError, runWithModelFallback } from "../../../../lib/gemini";
import { LANGUAGE_PACKS } from "../../../../lib/languages";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = {
  type: Type.OBJECT,
  properties: {
    heard_text: { type: Type.STRING },
    score: { type: Type.INTEGER },
    pronunciation_feedback_vi: { type: Type.STRING },
    grammar_feedback_vi: { type: Type.STRING },
    better_version: { type: Type.STRING }
  },
  required: ["heard_text", "score", "pronunciation_feedback_vi", "grammar_feedback_vi", "better_version"]
};

export async function POST(request) {
  let ai = null;
  let uploaded = null;
  try {
    const form = await request.formData();
    const apiKey = String(form.get("apiKey") || "");
    const model = String(form.get("model") || "auto");
    const languageCode = String(form.get("languageCode") || "zh");
    const targetText = String(form.get("targetText") || "").slice(0, 1000);
    const audio = form.get("audio");
    if (!apiKey) return Response.json({ error: "Chưa có Gemini API Key." }, { status: 400 });
    if (!audio || typeof audio.arrayBuffer !== "function") return Response.json({ error: "Không nhận được bản ghi âm." }, { status: 400 });
    if (Number(audio.size || 0) > 5 * 1024 * 1024) return Response.json({ error: "Bản ghi quá lớn. Hãy ghi tối đa khoảng 30 giây." }, { status: 413 });

    const pack = LANGUAGE_PACKS[languageCode] || LANGUAGE_PACKS.zh;
    ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    uploaded = await ai.files.upload({ file: audio, config: { displayName: "LinguaFlow speaking attempt" } });
    const prompt = `Evaluate this learner speaking ${pack.label}. Target/reference: ${targetText || "free speaking"}. Return a fair 0-100 score. First transcribe what you actually hear. Give concise Vietnamese pronunciation feedback and grammar feedback. Do not claim phoneme-level certainty when audio quality is insufficient.`;
    const contents = createUserContent([createPartFromUri(uploaded.uri, uploaded.mimeType || audio.type || "audio/webm"), prompt]);
    const { response, modelUsed } = await runWithModelFallback({
      ai, apiKey, requestedModel: model,
      call: (candidate) => ai.models.generateContent({ model: candidate, contents, config: { responseMimeType: "application/json", responseSchema: schema } })
    });
    return Response.json({ result: JSON.parse(response.text || "{}"), modelUsed });
  } catch (error) {
    const friendly = friendlyGeminiError(error);
    return Response.json({ error: friendly.message }, { status: friendly.status });
  } finally {
    if (ai && uploaded?.name) { try { await ai.files.delete({ name: uploaded.name }); } catch {} }
  }
}
