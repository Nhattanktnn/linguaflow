"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { LANGUAGE_PACKS } from "../../lib/languages";

const TABS = [
  ["flash", "🧠", "Flashcard"], ["listen", "🎧", "Nghe"], ["speak", "🎤", "Nói"],
  ["write", "✍️", "Đặt câu"], ["sentence", "🧩", "Xếp câu"], ["quiz", "⚡", "Quiz"], ["hand", "🖌️", "Luyện viết"]
];

function normalize(value) { return String(value || "").trim().toLocaleLowerCase().replace(/[.,!?;:'"“”‘’]/g, "").replace(/\s+/g, " "); }
function shuffle(list) { return [...list].sort(() => Math.random() - 0.5); }

function HandwritingCanvas({ target, language, aiConfig, onNeedApiKey }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle = "#173d2a"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.lineJoin = "round";
  }, [target]);

  function pos(e) { const r = ref.current.getBoundingClientRect(); const p = e.touches?.[0] || e; return { x: (p.clientX-r.left)*(ref.current.width/r.width), y:(p.clientY-r.top)*(ref.current.height/r.height) }; }
  function start(e) { e.preventDefault(); drawing.current = true; const p=pos(e); const ctx=ref.current.getContext("2d"); ctx.beginPath(); ctx.moveTo(p.x,p.y); }
  function move(e) { if(!drawing.current)return; e.preventDefault(); const p=pos(e); const ctx=ref.current.getContext("2d"); ctx.lineTo(p.x,p.y); ctx.stroke(); }
  function stop(){ drawing.current=false; }
  function clear(){ const c=ref.current; const ctx=c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,c.width,c.height); setResult(null); }
  async function check(){
    if(!aiConfig?.apiKey){onNeedApiKey?.();return;} setBusy(true);setError("");setResult(null);
    try{const res=await fetch("/api/ai/handwriting",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:aiConfig.apiKey,model:aiConfig.model||"auto",languageCode:language,target,imageData:ref.current.toDataURL("image/png")})});const data=await res.json();if(!res.ok)throw new Error(data?.error||"Không kiểm tra được nét viết.");setResult(data.result);}catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="handwriting-wrap"><div className="writing-reference"><span>Viết:</span><b>{target}</b></div><canvas ref={ref} width={420} height={300} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerLeave={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop}/><div className="inline-actions"><button className="secondary-btn" onClick={clear}>Xóa bảng</button><button className="primary-btn" onClick={check} disabled={busy}>{busy?"AI đang xem...":"AI kiểm tra hình dáng"}</button></div>{error&&<div className="page-error">{error}</div>}{result&&<div className="feedback-card"><b>{result.score}/100 · {result.recognizable?"Nhận ra được":"Khó nhận ra"}</b><p>{result.feedback_vi}</p><small>Tiếp theo: {result.next_focus_vi}</small></div>}<small className="helper">AI đánh giá hình dáng cuối cùng, không khẳng định thứ tự nét.</small></div>;
}

export default function PracticeHub({ language, user, aiConfig, onNeedApiKey }) {
  const pack = LANGUAGE_PACKS[language] || LANGUAGE_PACKS.zh;
  const [tab, setTab] = useState("flash");
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [writing, setWriting] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [targetSentence, setTargetSentence] = useState(pack.sampleSentence);
  const [scrambled, setScrambled] = useState(() => shuffle(pack.sampleWords));
  const [built, setBuilt] = useState([]);
  const [quizChoice, setQuizChoice] = useState("");
  const [recording, setRecording] = useState(false);
  const [speechResult, setSpeechResult] = useState(null);
  const recorderRef = useRef(null); const chunksRef = useRef([]);
  const [handTarget, setHandTarget] = useState(pack.writingTarget);

  async function loadWords() {
    if (!supabase || !user?.id) return;
    setLoading(true);
    const { data } = await supabase.from("user_vocabulary").select("*").eq("user_id", user.id).eq("language_code", language).order("next_review_at", { ascending: true, nullsFirst: true }).limit(200);
    setWords(data || []); setIndex(0); setRevealed(false); setLoading(false);
  }
  useEffect(()=>{loadWords(); setTargetSentence(pack.sampleSentence); setScrambled(shuffle(pack.sampleWords)); setBuilt([]); setHandTarget(pack.writingTarget); setFeedback("");},[language,user?.id]);
  const word = words[index % Math.max(words.length,1)];

  async function review(grade) {
    if (!word) return;
    const now = Date.now(); let nextMs, delta, intervalDays;
    if (grade === "again") { nextMs = now + 10*60*1000; delta=-8; intervalDays=0; }
    else if (grade === "hard") { nextMs=now+24*3600*1000; delta=2; intervalDays=1; }
    else if (grade === "good") { intervalDays=Math.max(3, Number(word.interval_days||0)*2 || 3); nextMs=now+intervalDays*86400000; delta=7; }
    else { intervalDays=Math.max(7, Number(word.interval_days||0)*3 || 7); nextMs=now+intervalDays*86400000; delta=12; }
    const mastery=Math.max(0,Math.min(100,Number(word.mastery||0)+delta));
    await Promise.all([
      supabase.from("user_vocabulary").update({mastery,next_review_at:new Date(nextMs).toISOString(),last_reviewed_at:new Date().toISOString(),interval_days:intervalDays,review_count:Number(word.review_count||0)+1,correct_count:Number(word.correct_count||0)+(grade==="again"?0:1)}).eq("id",word.id),
      supabase.from("vocabulary_reviews").insert({user_id:user.id,vocabulary_id:word.id,grade,mastery_after:mastery})
    ]);
    setWords((old)=>old.map((x)=>x.id===word.id?{...x,mastery,next_review_at:new Date(nextMs).toISOString(),interval_days:intervalDays}:x)); setIndex((i)=>i+1); setRevealed(false);
  }

  function speak(text) { if(!text)return; window.speechSynthesis?.cancel(); const u=new SpeechSynthesisUtterance(text);u.lang=pack.locale;u.rate=.85;window.speechSynthesis?.speak(u); }
  function checkListening(){ if(!word)return; const ok=normalize(answer)===normalize(word.term);setFeedback(ok?"✓ Chính xác":"Chưa đúng. Đáp án: "+word.term); }

  async function checkWriting(){
    if(!writing.trim())return;if(!aiConfig?.apiKey){onNeedApiKey?.();return;}setBusy(true);setAiFeedback("");
    try{const r=await fetch("/api/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:aiConfig.apiKey,model:aiConfig.model||"auto",languageCode:language,task:"correct",level:"Beginner",text:writing})});const d=await r.json();if(!r.ok)throw new Error(d?.error||"AI không phản hồi");setAiFeedback(d.text);}catch(e){setAiFeedback(e.message);}finally{setBusy(false);}
  }

  function pickToken(token, idx){ setBuilt((b)=>[...b,token]); setScrambled((s)=>s.filter((_,i)=>i!==idx)); }
  function resetSentence(){setScrambled(shuffle(pack.sampleWords));setBuilt([]);setFeedback("");}
  function checkSentence(){setFeedback(normalize(built.join(" "))===normalize(pack.sampleWords.join(" "))?"✓ Đúng trật tự":"Chưa đúng, thử lại nhé.");}

  const quizOptions = useMemo(()=>{
    if(!word)return[];const others=shuffle(words.filter((x)=>x.id!==word.id&&x.meaning_vi).map((x)=>x.meaning_vi)).slice(0,3);return shuffle([word.meaning_vi||"—",...others]);
  },[word?.id,words]);
  function chooseQuiz(opt){setQuizChoice(opt);setFeedback(opt===(word?.meaning_vi||"—")?"✓ Chính xác":`Chưa đúng. ${word?.term} = ${word?.meaning_vi||"—"}`);}

  async function startRecording(){
    if(!aiConfig?.apiKey){onNeedApiKey?.();return;}setSpeechResult(null);setFeedback("");
    try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const rec=new MediaRecorder(stream);chunksRef.current=[];rec.ondataavailable=(e)=>{if(e.data.size)chunksRef.current.push(e.data)};rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());analyzeSpeech(new Blob(chunksRef.current,{type:rec.mimeType||"audio/webm"}));};recorderRef.current=rec;rec.start();setRecording(true);}catch(e){setFeedback("Không mở được microphone: "+e.message);}
  }
  function stopRecording(){recorderRef.current?.stop();setRecording(false);}
  async function analyzeSpeech(blob){setBusy(true);try{const f=new FormData();f.append("apiKey",aiConfig.apiKey);f.append("model",aiConfig.model||"auto");f.append("languageCode",language);f.append("targetText",targetSentence);f.append("audio",blob,"speaking.webm");const r=await fetch("/api/ai/speech",{method:"POST",body:f});const d=await r.json();if(!r.ok)throw new Error(d?.error||"Không chấm được phát âm");setSpeechResult(d.result);}catch(e){setFeedback(e.message);}finally{setBusy(false);}}

  return <>
    <div className="page-title"><span className="eyebrow">PRACTICE</span><h2>Luyện tập</h2><p>Ôn từ thật của bạn, nghe, nói, đặt câu, xếp câu và luyện viết.</p></div>
    <div className="practice-tabs">{TABS.map(([id,icon,label])=><button key={id} className={tab===id?"active":""} onClick={()=>{setTab(id);setFeedback("");}}><span>{icon}</span>{label}</button>)}</div>
    <section className="practice-stage">
      {loading?<div className="empty-mini">Đang tải từ vựng...</div>:tab!=="sentence"&&tab!=="speak"&&tab!=="write"&&tab!=="hand"&&!word?<div className="empty-state"><div>🧠</div><h3>Chưa có từ để luyện</h3><p>Lưu vài từ trong bài học AI trước.</p></div>:null}

      {tab==="flash"&&word&&<div className="flashcard-area"><div className={`flashcard ${revealed?"revealed":""}`} onClick={()=>setRevealed(!revealed)}><span className="eyebrow">{pack.label.toUpperCase()}</span><h2>{word.term}</h2>{revealed?<><b>{word.pronunciation||"—"}</b><p>{word.meaning_vi||"Chưa có nghĩa"}</p><small>Mastery {word.mastery||0}%</small></>:<p>Bấm để lật thẻ</p>}</div>{revealed&&<div className="review-buttons"><button onClick={()=>review("again")}>Again<small>10 phút</small></button><button onClick={()=>review("hard")}>Hard<small>1 ngày</small></button><button onClick={()=>review("good")}>Good<small>3+ ngày</small></button><button onClick={()=>review("easy")}>Easy<small>7+ ngày</small></button></div>}</div>}

      {tab==="listen"&&word&&<div className="center-practice"><button className="listen-button" onClick={()=>speak(word.term)}>🔊 Nghe từ</button><label>Gõ từ bạn nghe được<input value={answer} onChange={(e)=>setAnswer(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&checkListening()} placeholder="Nhập đáp án..." /></label><button className="primary-btn" onClick={checkListening}>Kiểm tra</button>{feedback&&<div className="feedback-line">{feedback}</div>}</div>}

      {tab==="speak"&&<div className="center-practice speaking"><span className="eyebrow">SHADOWING</span><h2>{targetSentence}</h2><button className="text-btn" onClick={()=>speak(targetSentence)}>🔊 Nghe mẫu</button><textarea value={targetSentence} onChange={(e)=>setTargetSentence(e.target.value)} rows={2}/><button className={`record-btn ${recording?"recording":""}`} onClick={recording?stopRecording:startRecording}>{recording?"■ Dừng & chấm":"● Ghi âm câu này"}</button>{busy&&<div className="feedback-line">AI đang nghe...</div>}{feedback&&<div className="page-error">{feedback}</div>}{speechResult&&<div className="feedback-card"><b>{speechResult.score}/100</b><p><strong>AI nghe:</strong> {speechResult.heard_text}</p><p>{speechResult.pronunciation_feedback_vi}</p><p>{speechResult.grammar_feedback_vi}</p>{speechResult.better_version&&<small>Gợi ý: {speechResult.better_version}</small>}</div>}</div>}

      {tab==="write"&&<div className="center-practice wide"><span className="eyebrow">SENTENCE COACH</span><h3>Viết một câu bằng {pack.label}</h3>{word&&<p>Gợi ý dùng từ: <b>{word.term}</b> — {word.meaning_vi}</p>}<textarea value={writing} onChange={(e)=>setWriting(e.target.value)} rows={5} placeholder="Viết câu của bạn..."/><button className="primary-btn" onClick={checkWriting} disabled={busy||!writing.trim()}>{busy?"AI đang sửa...":"AI sửa câu"}</button>{aiFeedback&&<div className="ai-answer">{aiFeedback}</div>}</div>}

      {tab==="sentence"&&<div className="sentence-builder"><span className="eyebrow">SENTENCE BUILDER</span><h3>Xếp thành câu đúng</h3><div className="built-zone">{built.length?built.map((x,i)=><span key={i}>{x}</span>):<small>Bấm các mảnh từ bên dưới</small>}</div><div className="token-bank">{scrambled.map((x,i)=><button key={`${x}-${i}`} onClick={()=>pickToken(x,i)}>{x}</button>)}</div><div className="inline-actions"><button className="secondary-btn" onClick={resetSentence}>Làm lại</button><button className="primary-btn" onClick={checkSentence}>Kiểm tra</button></div>{feedback&&<div className="feedback-line">{feedback}</div>}</div>}

      {tab==="quiz"&&word&&<div className="quiz-card"><span className="eyebrow">QUICK QUIZ</span><h2>{word.term}</h2><p>{word.pronunciation}</p><div className="quiz-options">{quizOptions.map((x,i)=><button className={quizChoice===x?"chosen":""} key={`${x}-${i}`} onClick={()=>chooseQuiz(x)}>{x}</button>)}</div>{feedback&&<div className="feedback-line">{feedback}</div>}<button className="text-btn" onClick={()=>{setIndex((i)=>i+1);setQuizChoice("");setFeedback("");}}>Câu tiếp →</button></div>}

      {tab==="hand"&&<div><div className="hand-target-row"><label>Ký tự / chữ cần viết<input value={handTarget} onChange={(e)=>setHandTarget(e.target.value.slice(0,8))}/></label></div><HandwritingCanvas target={handTarget||pack.writingTarget} language={language} aiConfig={aiConfig} onNeedApiKey={onNeedApiKey}/></div>}
    </section>
  </>;
}
