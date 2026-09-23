import { GoogleGenAI, Type } from "@google/genai";
import { friendlyGeminiError, runWithModelFallback } from "../../../../lib/gemini";
import { LANGUAGE_PACKS } from "../../../../lib/languages";

export const runtime = "nodejs";
export const maxDuration = 90;

const schema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    recognizable: { type: Type.BOOLEAN },
    feedback_vi: { type: Type.STRING },
    next_focus_vi: { type: Type.STRING }
  },
  required: ["score", "recognizable", "feedback_vi", "next_focus_vi"]
};

export async function POST(request) {
  try {
    const { apiKey, model = "auto", languageCode = "zh", target = "好", imageData } = await request.json();
    if (!apiKey) return Response.json({ error: "Chưa có Gemini API Key." }, { status: 400 });
    const match = String(imageData || "").match(/^data:image\/(png|jpeg);base64,(.+)$/);
    if (!match) return Response.json({ error: "Ảnh nét viết không hợp lệ." }, { status: 400 });
    const pack = LANGUAGE_PACKS[languageCode] || LANGUAGE_PACKS.zh;
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const prompt = `The learner is practicing writing the ${pack.label} character/text: ${target}. Evaluate only the visible final shape, legibility, balance, and whether it resembles the target. Do NOT claim to verify stroke order because a final image cannot prove stroke order. Give concise Vietnamese feedback.`;
    const contents = [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: `image/${match[1]}`, data: match[2] } }] }];
    const { response, modelUsed } = await runWithModelFallback({
      ai, apiKey, requestedModel: model,
      call: (candidate) => ai.models.generateContent({ model: candidate, contents, config: { responseMimeType: "application/json", responseSchema: schema } })
    });
    return Response.json({ result: JSON.parse(response.text || "{}"), modelUsed });
  } catch (error) {
    const friendly = friendlyGeminiError(error);
    return Response.json({ error: friendly.message }, { status: friendly.status });
  }
}
