import { GoogleGenAI, Type } from "@google/genai";
import { friendlyGeminiError, runWithModelFallback } from "../../../../lib/gemini";
import { LANGUAGE_PACKS } from "../../../../lib/languages";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    summary_vi: { type: Type.STRING },
    vocabulary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      term: { type: Type.STRING }, pronunciation: { type: Type.STRING }, meaning_vi: { type: Type.STRING }, example: { type: Type.STRING }, example_vi: { type: Type.STRING }
    }, required: ["term", "pronunciation", "meaning_vi", "example", "example_vi"] } },
    grammar: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      point: { type: Type.STRING }, explanation_vi: { type: Type.STRING }, example: { type: Type.STRING }
    }, required: ["point", "explanation_vi", "example"] } },
    dialogue: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      speaker: { type: Type.STRING }, text: { type: Type.STRING }, pronunciation: { type: Type.STRING }, meaning_vi: { type: Type.STRING }
    }, required: ["speaker", "text", "pronunciation", "meaning_vi"] } },
    quiz: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
      question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }
    }, required: ["question", "options", "answer"] } }
  },
  required: ["title", "summary_vi", "vocabulary", "grammar", "dialogue", "quiz"]
};

export async function POST(request) {
  try {
    const { apiKey, model = "auto", languageCode = "zh", level = "Beginner", topic = "Giao tiếp hằng ngày", customTopic = "" } = await request.json();
    if (!apiKey) return Response.json({ error: "Chưa có Gemini API Key." }, { status: 400 });
    const pack = LANGUAGE_PACKS[languageCode] || LANGUAGE_PACKS.zh;
    const subject = String(customTopic || topic || "Daily communication").slice(0, 300);
    const prompt = `Create one practical ${pack.label} lesson for a Vietnamese learner. Level: ${level}. Topic/industry: ${subject}.\nRequirements: 8-12 vocabulary items, 1-3 useful grammar points, a realistic 6-10 turn dialogue, and 5 multiple-choice questions. Pronunciation must use ${pack.annotation}. Vietnamese explanations must be concise and practical. For industry topics, prefer real workplace phrases and avoid unsafe technical operating instructions.`;
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const { response, modelUsed } = await runWithModelFallback({
      ai, apiKey, requestedModel: model,
      call: (candidate) => ai.models.generateContent({ model: candidate, contents: prompt, config: { responseMimeType: "application/json", responseSchema: schema } })
    });
    return Response.json({ lesson: JSON.parse(response.text || "{}"), modelUsed });
  } catch (error) {
    const friendly = friendlyGeminiError(error);
    return Response.json({ error: friendly.message }, { status: friendly.status });
  }
}
