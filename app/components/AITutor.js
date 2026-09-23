"use client";

import { useMemo, useState } from "react";
import { LANGUAGE_PACKS } from "../../lib/languages";

export default function AITutor({ language, aiConfig, onNeedApiKey }) {
  const pack = LANGUAGE_PACKS[language] || LANGUAGE_PACKS.zh;
  const [messages, setMessages] = useState([{ role: "assistant", content: `Chào bạn! Mình là AI Tutor cho ${pack.label}. Bạn có thể hỏi từ vựng, ngữ pháp, sửa câu hoặc luyện hội thoại.` }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [level, setLevel] = useState(pack.levels[0]);

  const quick = useMemo(() => [
    ["Giải thích", "explain", `Giải thích câu này: ${pack.sampleSentence}`],
    ["Sửa câu", "correct", `Hãy sửa câu của tôi bằng ${pack.label}: `],
    ["Ví dụ", "examples", `Cho ví dụ với một từ thông dụng về công việc bằng ${pack.label}.`],
    ["Quiz", "quiz", `Tạo quiz ngắn trình độ ${level}.`]
  ], [language, level]);

  async function send(text = input, task = "tutor") {
    const prompt = String(text || "").trim();
    if (!prompt) return;
    if (!aiConfig?.apiKey) { onNeedApiKey?.(); return; }
    const next = [...messages, { role: "user", content: prompt }];
    setMessages(next); setInput(""); setBusy(true); setError("");
    try {
      const response = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: aiConfig.apiKey, model: aiConfig.model || "auto", languageCode: language, level, task, messages: next.filter((m)=>m.role !== "assistant" || m !== next[0]) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "AI Tutor không phản hồi.");
      setMessages((old) => [...old, { role: "assistant", content: result.text || "" }]);
    } catch (err) { setError(err?.message || "AI Tutor không phản hồi."); }
    finally { setBusy(false); }
  }

  return <>
    <div className="page-title"><span className="eyebrow">AI TUTOR</span><h2>Giáo viên AI</h2><p>Hỏi, sửa câu, giải thích ngữ pháp và luyện theo đúng ngôn ngữ bạn đang học.</p></div>
    <div className="tutor-layout">
      <aside className="tutor-tools"><label>Trình độ<select value={level} onChange={(e)=>setLevel(e.target.value)}>{pack.levels.map((x)=><option key={x}>{x}</option>)}</select></label><div className="quick-prompts">{quick.map(([label,task,text])=><button key={label} onClick={()=>send(text,task)}>{label}<span>→</span></button>)}</div><div className="notice"><b>{aiConfig?.apiKey ? "AI đã kết nối" : "Chưa có API key"}</b><span>{aiConfig?.apiKey ? `Model: ${aiConfig.model || "auto"}` : "Mở Cài đặt AI để nhập key."}</span></div></aside>
      <section className="chat-card"><div className="chat-messages">{messages.map((m,i)=><div className={`chat-bubble ${m.role}`} key={i}><span>{m.role === "assistant" ? "AI" : "Bạn"}</span><p>{m.content}</p></div>)}{busy && <div className="chat-bubble assistant"><span>AI</span><p>Đang suy nghĩ...</p></div>}</div>{error && <div className="page-error">{error}</div>}<div className="chat-input"><textarea value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={`Hỏi gì đó về ${pack.label}...`} rows={2}/><button className="primary-btn" onClick={()=>send()} disabled={busy || !input.trim()}>Gửi</button></div></section>
    </div>
  </>;
}
