"use client";

import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { INDUSTRIES, LANGUAGE_PACKS } from "../../lib/languages";

export default function Courses({ language, user, aiConfig, onNeedApiKey }) {
  const pack = LANGUAGE_PACKS[language] || LANGUAGE_PACKS.zh;
  const [level, setLevel] = useState(pack.levels[0]);
  const [topic, setTopic] = useState(INDUSTRIES[0]);
  const [customTopic, setCustomTopic] = useState("");
  const [lesson, setLesson] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

  const cards = useMemo(() => [
    [pack.framework, "Lộ trình theo trình độ", pack.levels.slice(0,4).join(" · ")],
    ["Giao tiếp hằng ngày", "Tình huống đời sống", "Ăn uống · đi lại · mua sắm"],
    ["Nhà máy / Sản xuất", "Công xưởng và sản xuất", "Máy móc · sản lượng · lỗi"],
    ["QA/QC", "Chất lượng", "Kiểm tra · tiêu chuẩn · báo lỗi"],
    ["Logistics", "Kho vận", "Giao nhận · lịch tàu · chứng từ"],
    ["Mua hàng", "Purchasing", "Báo giá · PO · nhà cung cấp"]
  ], [language]);

  async function generate(nextTopic = topic) {
    if(!aiConfig?.apiKey){onNeedApiKey?.();return;}
    setBusy(true);setError("");setMessage("");setLesson(null);setShowAnswers(false);
    try{
      const r=await fetch("/api/ai/lesson",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:aiConfig.apiKey,model:aiConfig.model||"auto",languageCode:language,level,topic:nextTopic,customTopic})});
      const d=await r.json();if(!r.ok)throw new Error(d?.error||"Không tạo được bài học.");setLesson(d.lesson);setMessage(`Bài học được tạo bằng ${d.modelUsed}.`);
      await supabase.from("course_progress").upsert({user_id:user.id,language_code:language,course_key:`${level}:${nextTopic}`,progress_percent:10,last_opened_at:new Date().toISOString()},{onConflict:"user_id,language_code,course_key"});
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }

  async function saveVocabulary(){
    if(!lesson?.vocabulary?.length)return;
    const rows=lesson.vocabulary.map(v=>({user_id:user.id,language_code:language,term:v.term,pronunciation:v.pronunciation||null,meaning_vi:v.meaning_vi||null,source_type:"ai_course",next_review_at:new Date().toISOString()}));
    const {error:e}=await supabase.from("user_vocabulary").upsert(rows,{onConflict:"user_id,language_code,term"});
    if(e)setError(e.message);else setMessage(`Đã lưu ${rows.length} từ vào Flashcard.`);
  }

  return <>
    <div className="page-title"><span className="eyebrow">COURSES & WORK</span><h2>Khóa học {pack.label}</h2><p>Chọn trình độ hoặc ngành nghề. AI tạo bài học thực tế theo cấu hình của bạn.</p></div>
    <div className="course-toolbar"><label>Trình độ<select value={level} onChange={(e)=>setLevel(e.target.value)}>{pack.levels.map(x=><option key={x}>{x}</option>)}</select></label><label>Chủ đề / ngành<select value={topic} onChange={(e)=>setTopic(e.target.value)}>{INDUSTRIES.map(x=><option key={x}>{x}</option>)}</select></label><label>Chủ đề riêng<input value={customTopic} onChange={(e)=>setCustomTopic(e.target.value)} placeholder="Ví dụ: kiểm tra máy ép nhựa"/></label><button className="primary-btn" onClick={()=>generate(topic)} disabled={busy}>{busy?"AI đang soạn...":"✨ Tạo bài học"}</button></div>
    {message&&<div className="page-success">{message}</div>}{error&&<div className="page-error">{error}</div>}
    {!lesson&&<div className="course-grid">{cards.map((x,i)=><button className="course-card-new" key={x[0]} onClick={()=>{setTopic(x[0]);generate(x[0]);}}><div className="course-cover"><span>{String(i+1).padStart(2,"0")}</span></div><div><h3>{x[0]}</h3><p>{x[1]}</p><small>{x[2]}</small></div><i>→</i></button>)}</div>}
    {lesson&&<section className="generated-lesson"><div className="lesson-head"><div><span className="eyebrow">AI LESSON</span><h2>{lesson.title}</h2><p>{lesson.summary_vi}</p></div><button className="secondary-btn" onClick={()=>setLesson(null)}>Đóng bài</button></div>
      <div className="lesson-columns"><div><h3>Từ vựng</h3><div className="lesson-vocab">{lesson.vocabulary?.map((v,i)=><article key={`${v.term}-${i}`}><div><b>{v.term}</b><span>{v.pronunciation}</span></div><p>{v.meaning_vi}</p><small>{v.example}<br/>{v.example_vi}</small></article>)}</div><button className="primary-btn" onClick={saveVocabulary}>＋ Lưu toàn bộ từ</button></div><div><h3>Ngữ pháp / cấu trúc</h3>{lesson.grammar?.map((g,i)=><div className="grammar-card" key={i}><b>{g.point}</b><p>{g.explanation_vi}</p><small>{g.example}</small></div>)}</div></div>
      <h3>Hội thoại</h3><div className="dialogue-list">{lesson.dialogue?.map((d,i)=><div key={i}><b>{d.speaker}</b><p>{d.text}</p><span>{d.pronunciation}</span><small>{d.meaning_vi}</small></div>)}</div>
      <h3>Quiz</h3><div className="course-quiz">{lesson.quiz?.map((q,i)=><article key={i}><b>{i+1}. {q.question}</b>{q.options?.map((o,j)=><span key={j}>{String.fromCharCode(65+j)}. {o}</span>)}{showAnswers&&<em>Đáp án: {q.answer}</em>}</article>)}</div><button className="secondary-btn" onClick={()=>setShowAnswers(!showAnswers)}>{showAnswers?"Ẩn đáp án":"Xem đáp án"}</button>
    </section>}
  </>;
}
