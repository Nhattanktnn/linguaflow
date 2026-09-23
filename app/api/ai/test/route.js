import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string") {
      return Response.json({ error: "Chưa nhập Gemini API Key." }, { status: 400 });
    }
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: "Reply with exactly: OK",
    });
    if (!response?.text) throw new Error("Gemini không trả về dữ liệu.");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error?.message || "Không kết nối được Gemini." }, { status: 400 });
  }
}
