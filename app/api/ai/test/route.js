import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 30;

const TEST_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];

function getStatus(error) {
  const num = Number(error?.status ?? error?.code ?? error?.response?.status);
  if (Number.isFinite(num)) return num;
  const match = String(error?.message || "").match(/\b(429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

export async function POST(request) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string") {
      return Response.json({ error: "Chưa nhập Gemini API Key." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    let lastError = null;

    for (const model of TEST_MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: "Reply with exactly: OK",
        });
        if (response?.text) return Response.json({ ok: true, modelUsed: model });
      } catch (error) {
        lastError = error;
        const status = getStatus(error);
        if (![429, 500, 502, 503, 504].includes(status)) break;
      }
    }

    const status = getStatus(lastError);
    if (status === 503) throw new Error("Gemini đang quá tải tạm thời. Key có thể vẫn hợp lệ; hãy thử lại sau một lúc.");
    if (status === 429) throw new Error("Gemini đang giới hạn lượt gọi hoặc key đã chạm quota.");
    throw lastError || new Error("Gemini không trả về dữ liệu.");
  } catch (error) {
    return Response.json({ error: error?.message || "Không kết nối được Gemini." }, { status: 400 });
  }
}
