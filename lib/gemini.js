const FALLBACK_MODELS = [
  // Alias chính thức luôn trỏ tới Flash mới nhất mà Gemini công bố.
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];

const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);

function versionScore(id) {
  const m = id.match(/gemini-(\d+)(?:\.(\d+))?/i);
  const major = Number(m?.[1] || 0);
  const minor = Number(m?.[2] || 0);
  let score = major * 1000 + minor * 10;
  if (/flash/i.test(id)) score += 5;
  if (/pro/i.test(id)) score += 3;
  if (/lite/i.test(id)) score -= 2;
  if (/preview|exp|experimental/i.test(id)) score -= 1;
  return score;
}

export function modelDisplayName(id) {
  return id.replace(/^models\//, "").replace(/^gemini-/, "Gemini ").replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function discoverGeminiModels(apiKey) {
  if (!apiKey) throw new Error("Thiếu Gemini API Key.");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
    headers: { "x-goog-api-key": apiKey.trim() }, cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Không lấy được danh sách model Gemini.");
  const items = Array.isArray(data.models) ? data.models : [];
  return items
    .map((m) => ({
      id: String(m.name || "").replace(/^models\//, ""),
      displayName: m.displayName || modelDisplayName(String(m.name || "")),
      methods: m.supportedGenerationMethods || [],
      inputTokenLimit: m.inputTokenLimit || null,
      outputTokenLimit: m.outputTokenLimit || null
    }))
    .filter((m) => m.id.startsWith("gemini-") && m.methods.includes("generateContent"))
    .filter((m) => !/(live|tts|image|embedding|aqa|transcribe)/i.test(m.id))
    .sort((a, b) => versionScore(b.id) - versionScore(a.id));
}

export async function resolveModelChain(apiKey, requested = "auto") {
  let discovered = [];
  try { discovered = await discoverGeminiModels(apiKey); } catch {}
  const ids = discovered.map((m) => m.id);
  const chain = [];

  // Auto luôn thử alias "gemini-flash-latest" trước, sau đó các model
  // thực tế mà API key nhìn thấy, rồi mới tới danh sách fallback.
  if (requested && requested !== "auto") chain.push(requested);
  if (!requested || requested === "auto") chain.push("gemini-flash-latest");
  for (const id of ids) if (!chain.includes(id)) chain.push(id);
  for (const id of FALLBACK_MODELS) if (!chain.includes(id)) chain.push(id);
  return chain.slice(0, 10);
}

export function getErrorStatus(error) {
  for (const value of [error?.status, error?.code, error?.response?.status, error?.error?.code]) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 100 && n <= 599) return n;
  }
  const match = String(error?.message || "").match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
  return match ? Number(match[1]) : null;
}

export function isTransient(error) { return TRANSIENT.has(getErrorStatus(error)); }
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function friendlyGeminiError(error) {
  const status = getErrorStatus(error);
  const message = String(error?.message || "");
  if (status === 429) return { status: 429, message: "Gemini đã chạm giới hạn quota/rate limit của API key. Hãy thử lại sau hoặc chọn model khác." };
  if (status === 503) return { status: 503, message: "Gemini đang quá tải. LinguaFlow đã tự thử model khác nhưng chưa thành công; hãy thử lại sau ít phút." };
  if (status && status >= 500) return { status: 502, message: "Dịch vụ Gemini đang lỗi tạm thời. Hãy thử lại sau." };
  if (/api key|unauth|permission|forbidden/i.test(message)) return { status: 401, message: "API key không hợp lệ hoặc chưa được cấp quyền cho model này." };
  return { status: status && status >= 400 ? status : 500, message: message || "Không thể gọi Gemini." };
}

export async function runWithModelFallback({ ai, apiKey, requestedModel = "auto", call }) {
  const models = await resolveModelChain(apiKey, requestedModel);
  let lastError = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await call(model);
        return { response, modelUsed: model };
      } catch (error) {
        lastError = error;
        const status = getErrorStatus(error);
        if (!isTransient(error) || attempt === 2) break;
        await sleep(attempt === 0 ? 1200 : 3000);
        if (status === 429) break;
      }
    }
  }
  throw lastError || new Error("Gemini không phản hồi.");
}
