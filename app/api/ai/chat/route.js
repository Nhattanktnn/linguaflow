import { GoogleGenAI } from "@google/genai";
import { friendlyGeminiError, runWithModelFallback } from "../../../../lib/gemini";
import { LANGUAGE_PACKS } from "../../../../lib/languages";

export const runtime = "nodejs";
export const maxDuration = 90;

const TASKS = {
  tutor: "Act as a patient language tutor. Answer clearly in Vietnamese, but use the target language for examples. Keep explanations practical and not too long.",
  explain: "Explain the supplied target-language text to a Vietnamese learner: meaning, pronunciation if useful, grammar, and one natural example.",
  translate: "Translate faithfully between Vietnamese and the target language. Give the natural translation first, then a very short note only if useful.",
  correct: "Correct the learner's sentence. Return: corrected sentence, what was wrong, and one more natural alternative. Explain in Vietnamese.",
  simplify: "Rewrite the target-language text at the learner's level while preserving meaning. Explain the key simplifications in Vietnamese.",
  examples: "Give 5 useful natural example sentences for the supplied word or structure, with Vietnamese meanings.",
  quiz: "Create a short 5-question practice quiz from the supplied content. Do not reveal answers until the end."
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { apiKey, model = "auto", languageCode = "zh", level = "Beginner", task = "tutor", messages = [], text = "" } = body || {};
    if (!apiKey) return Response.json({ error: "Chưa có Gemini API Key." }, { status: 400 });
    const pack = LANGUAGE_PACKS[languageCode] || LANGUAGE_PACKS.zh;
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const system = `${TASKS[task] || TASKS.tutor}\nTarget language: ${pack.label} (${pack.locale}). Learner level: ${level}. Never invent facts about official exams. If uncertain, say so.`;
    const contents = messages.length
      ? messages.slice(-16).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "") }] }))
      : [{ role: "user", parts: [{ text: String(text || "") }] }];
    const { response, modelUsed } = await runWithModelFallback({
      ai, apiKey, requestedModel: model,
      call: (candidate) => ai.models.generateContent({ model: candidate, contents, config: { systemInstruction: system } })
    });
    return Response.json({ text: response.text || "", modelUsed });
  } catch (error) {
    const friendly = friendlyGeminiError(error);
    return Response.json({ error: friendly.message }, { status: friendly.status });
  }
}
