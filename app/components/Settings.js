"use client";

import { useEffect, useState } from "react";

export default function Settings({ onClose, aiConfig, setAiConfig }) {
  const [key, setKey] = useState(aiConfig?.apiKey || "");
  const [model, setModel] = useState(aiConfig?.model || "auto");
  const [models, setModels] = useState(aiConfig?.models || []);
  const [recommended, setRecommended] = useState(aiConfig?.recommended || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setKey(aiConfig?.apiKey || ""); setModel(aiConfig?.model || "auto"); setModels(aiConfig?.models || []); }, [aiConfig]);

  async function loadModels(testToo = false) {
    if (!key.trim()) { setError("Nhập Gemini API Key trước."); return; }
    setBusy(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/ai/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: key.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Không lấy được danh sách model.");
      const list = data.models || [];
      setModels(list); setRecommended(data.recommended || "");
      let usedModel = model;
      if (usedModel !== "auto" && !list.some((m) => m.id === usedModel)) usedModel = "auto";
      if (testToo) {
        const test = await fetch("/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: key.trim(), model: usedModel }) });
        const tested = await test.json();
        if (!test.ok) throw new Error(tested?.error || "Không kết nối được Gemini.");
        setMessage(`✓ Kết nối thành công. Đang dùng ${usedModel === "auto" ? `Auto → ${tested.modelUsed}` : tested.modelUsed}. Tìm thấy ${list.length} model khả dụng.`);
      } else setMessage(`Đã tải ${list.length} model từ Gemini API.`);
      setAiConfig({ provider: "gemini", apiKey: key.trim(), model: usedModel, models: list, recommended: data.recommended || "" });
    } catch (err) { setError(err?.message || "Không kết nối được Gemini."); }
    finally { setBusy(false); }
  }

  function chooseModel(next) {
    setModel(next);
    setAiConfig({ ...aiConfig, apiKey: key.trim() || aiConfig.apiKey, model: next, models, recommended });
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal settings-modal" onMouseDown={(e)=>e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">AI SETTINGS</span><h2>Gemini BYOK</h2></div><button onClick={onClose}>×</button></div>
    <p className="modal-copy">LinguaFlow lấy danh sách model trực tiếp từ Gemini API. Chọn <b>Auto</b> để mỗi lần gọi AI đều ưu tiên alias Flash mới nhất, sau đó tự thử các model mới mà API key của bạn truy cập được nếu model đầu quá tải hoặc không có quota.</p>
    <div className="form-stack">
      <label>Gemini API Key<input type="password" value={key} onChange={(e)=>setKey(e.target.value)} placeholder="AIza..." /></label>
      <div className="inline-actions"><button className="secondary-btn" onClick={()=>loadModels(false)} disabled={busy || !key.trim()}>↻ Lấy model mới nhất</button><button className="primary-btn" onClick={()=>loadModels(true)} disabled={busy || !key.trim()}>{busy ? "Đang kiểm tra..." : "Kiểm tra & sử dụng"}</button></div>
      <label>Model<select value={model} onChange={(e)=>chooseModel(e.target.value)}><option value="auto">✨ Auto — luôn theo Flash mới nhất{recommended ? ` (${recommended})` : ""}</option>{models.map((m)=><option key={m.id} value={m.id}>{m.label || m.displayName || m.id}</option>)}</select></label>
      {models.length > 0 && <small className="helper">Danh sách này lấy trực tiếp từ Gemini API theo API key của bạn, không khóa cứng ở Gemini 3.5 Flash-Lite.</small>}
      {message && <div className="auth-success">{message}</div>}{error && <div className="auth-error">{error}</div>}
      <div className="notice"><b>Key được giữ theo phiên trình duyệt</b><span>Không lưu vào Supabase/GitHub. Đóng toàn bộ tab trình duyệt sẽ xóa key khỏi sessionStorage.</span></div>
    </div>
  </div></div>;
}
