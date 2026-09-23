import { GoogleGenAI } from "@google/genai";
import { discoverGeminiModels, friendlyGeminiError, runWithModelFallback } from "../../../../lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { apiKey, model = "auto" } = await request.json();
    if (!apiKey) return Response.json({ error: "Thiếu Gemini API Key." }, { status: 400 });
    const available = await discoverGeminiModels(apiKey);
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const { response, modelUsed } = await runWithModelFallback({
      ai, apiKey, requestedModel: model,
      call: (candidate) => ai.models.generateContent({ model: candidate, contents: "Reply with exactly: OK" })
    });
    return Response.json({ ok: true, modelUsed, modelCount: available.length, text: response.text || "OK" });
  } catch (error) {
    const friendly = friendlyGeminiError(error);
    return Response.json({ error: friendly.message }, { status: friendly.status });
  }
}
