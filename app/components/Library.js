"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { LANGUAGE_PACKS } from "../../lib/languages";
import ContentLesson from "./ContentLesson";

function formatBytes(bytes=0){if(!bytes)return"0 B";const u=["B","KB","MB","GB"];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),u.length-1);return`${(bytes/1024**i).toFixed(i===0?0:1)} ${u[i]}`;}

export default function Library({ user, language, refreshKey, aiConfig, onNeedApiKey }) {
  const [tab,setTab]=useState("content");
  const [items,setItems]=useState([]); const [words,setWords]=useState([]); const [sentences,setSentences]=useState([]);
  const [selected,setSelected]=useState(null); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [q,setQ]=useState("");

  async function load(){
    if(!supabase||!user?.id)return;setLoading(true);setError("");
    const [a,b,c]=await Promise.all([
      supabase.from("media_items").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      supabase.from("user_vocabulary").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      supabase.from("saved_sentences").select("*").eq("user_id",user.id).order("created_at",{ascending:false})
    ]);
    if(a.error||b.error||c.error)setError(a.error?.message||b.error?.message||c.error?.message);
    const rows=a.data||[];
    const enriched=await Promise.all(rows.map(async item=>{
      if(item.media_type==="text")return{...item,signedUrl:null};
      const {data}=await supabase.storage.from("media").createSignedUrl(item.storage_path,3600);return{...item,signedUrl:data?.signedUrl||null};
    }));
    setItems(enriched);setWords(b.data||[]);setSentences(c.data||[]);setLoading(false);
    if(selected){const fresh=enriched.find(x=>x.id===selected.id);if(fresh)setSelected(fresh);}
  }
  useEffect(()=>{load();},[user?.id,refreshKey]);

  async function deleteItem(item){
    if(!window.confirm(`Xóa “${item.title}”?`))return;
    if(item.media_type!=="text"){const {error:e}=await supabase.storage.from("media").remove([item.storage_path]);if(e){setError(e.message);return;}}
    const {error:e}=await supabase.from("media_items").delete().eq("id",item.id).eq("user_id",user.id);if(e)setError(e.message);else{if(selected?.id===item.id)setSelected(null);load();}
  }
  async function deleteWord(id){await supabase.from("user_vocabulary").delete().eq("id",id).eq("user_id",user.id);load();}
  async function deleteSentence(id){await supabase.from("saved_sentences").delete().eq("id",id).eq("user_id",user.id);load();}

  const filteredItems=useMemo(()=>items.filter(x=>(!language||x.language_code===language)&&(`${x.title} ${x.file_name}`.toLowerCase().includes(q.toLowerCase()))),[items,q,language]);
  const filteredWords=useMemo(()=>words.filter(x=>(!language||x.language_code===language)&&(`${x.term} ${x.meaning_vi||""}`.toLowerCase().includes(q.toLowerCase()))),[words,q,language]);
  const filteredSentences=useMemo(()=>sentences.filter(x=>(!language||x.language_code===language)&&(`${x.text} ${x.meaning_vi||""}`.toLowerCase().includes(q.toLowerCase()))),[sentences,q,language]);

  const icon={audio:"♫",video:"▶",pdf:"PDF",text:"TXT"};
  return <>
    <div className="page-title"><span className="eyebrow">YOUR LIBRARY</span><h2>Thư viện</h2><p>Nội dung, từ vựng và câu đã lưu của tài khoản này.</p></div>
    <div className="library-toolbar"><div className="library-tabs"><button className={tab==="content"?"active":""} onClick={()=>setTab("content")}>Nội dung <span>{items.length}</span></button><button className={tab==="words"?"active":""} onClick={()=>setTab("words")}>Từ <span>{words.length}</span></button><button className={tab==="sentences"?"active":""} onClick={()=>setTab("sentences")}>Câu <span>{sentences.length}</span></button></div><div className="library-search"><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Tìm trong thư viện..."/><button onClick={load}>↻</button></div></div>
    {error&&<div className="page-error">{error}</div>}
    {selected&&tab==="content"&&<section className="media-viewer"><div className="media-viewer-head"><div><span className="eyebrow">NOW LEARNING</span><h3>{selected.title}</h3></div><button className="text-btn" onClick={()=>setSelected(null)}>Đóng</button></div><ContentLesson item={selected} user={user} aiConfig={aiConfig} onNeedApiKey={onNeedApiKey} onChanged={load}/></section>}
    {loading?<div className="empty-state"><div>◌</div><h3>Đang tải...</h3></div>:tab==="content"?<>{filteredItems.length===0?<div className="empty-state"><div>▣</div><h3>Chưa có nội dung</h3><p>Upload hoặc dán văn bản ở “Học từ nội dung”.</p></div>:<div className="media-grid">{filteredItems.map(item=>{const pack=LANGUAGE_PACKS[item.language_code]||{};return<article className="media-card" key={item.id}><div className="media-thumb">{icon[item.media_type]||"▣"}</div><div className="media-card-body"><span className="eyebrow">{pack.flag} {pack.label||item.language_code}</span><h3>{item.title}</h3><p>{item.file_name}</p><small>{formatBytes(item.size_bytes)} · {item.status}{item.ai_model?` · ${item.ai_model}`:""}</small><div className="media-actions"><button className="primary-btn compact" onClick={()=>setSelected(item)} disabled={item.media_type!=="text"&&!item.signedUrl}>Mở</button><button className="danger-btn" onClick={()=>deleteItem(item)}>Xóa</button></div></div></article>})}</div>}</>:tab==="words"?<>{filteredWords.length===0?<div className="empty-state"><div>🧠</div><h3>Chưa có từ</h3></div>:<div className="vocab-list">{filteredWords.map(w=><div className="vocab-row" key={w.id}><div><b>{w.term}</b><span>{w.pronunciation||"—"}</span></div><p>{w.meaning_vi||"Chưa có nghĩa"}</p><small>Mastery {w.mastery||0}%</small><button className="row-delete" onClick={()=>deleteWord(w.id)}>×</button></div>)}</div>}</>:<>{filteredSentences.length===0?<div className="empty-state"><div>☆</div><h3>Chưa lưu câu nào</h3></div>:<div className="sentence-library">{filteredSentences.map(s=><article key={s.id}><div><b>{s.text}</b><span>{s.pronunciation}</span><p>{s.meaning_vi}</p></div><button onClick={()=>deleteSentence(s.id)}>×</button></article>)}</div>}</>}
  </>;
}
