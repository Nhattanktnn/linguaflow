import { discoverGeminiModels, modelDisplayName } from "../../../../lib/gemini";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey) return Response.json({ error: "Thiếu Gemini API Key." }, { status: 400 });
    const models = await discoverGeminiModels(apiKey);
    if (!models.length) return Response.json({ error: "API key hợp lệ nhưng chưa tìm thấy model generateContent khả dụng." }, { status: 404 });
    const recommended = models.find((m) => /flash/i.test(m.id) && !/lite/i.test(m.id))?.id || models[0].id;
    return Response.json({
      models: models.map((m) => ({ ...m, label: m.displayName || modelDisplayName(m.id) })),
      recommended
    });
  } catch (error) {
    return Response.json({ error: error?.message || "Không lấy được danh sách model." }, { status: 500 });
  }
}
