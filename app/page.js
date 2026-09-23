"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { LANGUAGE_PACKS } from "../lib/languages";
import ContentLab from "./components/ContentLab";
import PracticeHub from "./components/PracticeHub";
import Courses from "./components/Courses";
import Library from "./components/Library";
import AITutor from "./components/AITutor";
import Settings from "./components/Settings";

const NAV = [
  ["home","⌂","Học hôm nay"], ["content","▶","Học từ nội dung"], ["practice","◎","Luyện tập"],
  ["courses","▤","Khóa học"], ["tutor","✦","AI Tutor"], ["library","▣","Thư viện"]
];

function AuthScreen(){
  const [mode,setMode]=useState("login"); const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState("");
  async function submit(e){e.preventDefault();if(!supabase)return;setBusy(true);setMessage("");setError("");try{if(mode==="signup"){const{data,error:er}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{display_name:name.trim()||email.split("@")[0]}}});if(er)throw er;if(!data.session)setMessage("Đã tạo tài khoản. Hãy kiểm tra email xác nhận rồi đăng nhập.");}else{const{error:er}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(er)throw er;}}catch(e2){setError(e2?.message||"Có lỗi xảy ra.");}finally{setBusy(false);}}
  async function reset(){if(!email.trim()){setError("Nhập email trước.");return;}setBusy(true);const{error:er}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});if(er)setError(er.message);else setMessage("Đã gửi email đặt lại mật khẩu.");setBusy(false);}
  return <div className="auth-shell"><section className="auth-brand-panel"><div className="auth-brand"><div className="brand-mark">L</div><div><b>LinguaFlow</b><small>learn with AI</small></div></div><div className="auth-copy"><span className="pill dark-pill">LANGUAGE LEARNING OS</span><h1>Học từ nội dung thật.<br/>Luyện bằng AI.</h1><p>Chinese, English và các ngôn ngữ phổ biến trong cùng một nền tảng.</p><div className="auth-feature-row"><span>中</span><span>EN</span><span>日</span><b>＋ nhiều ngôn ngữ</b></div></div></section><section className="auth-form-panel"><form className="auth-card" onSubmit={submit}><div><span className="eyebrow">LINGUAFLOW 1.0</span><h2>{mode==="login"?"Đăng nhập":"Tạo tài khoản"}</h2><p>{mode==="login"?"Tiếp tục quá trình học của bạn.":"Bắt đầu miễn phí."}</p></div>{!supabaseConfigured&&<div className="auth-error">Chưa cấu hình Supabase.</div>}{message&&<div className="auth-success">{message}</div>}{error&&<div className="auth-error">{error}</div>}{mode==="signup"&&<label className="auth-label">Tên hiển thị<input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Tên của bạn"/></label>}<label className="auth-label">Email<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} /></label><label className="auth-label">Mật khẩu<input type="password" required minLength={6} value={password} onChange={(e)=>setPassword(e.target.value)} /></label><button className="primary-btn auth-submit" disabled={busy||!supabaseConfigured}>{busy?"Đang xử lý...":mode==="login"?"Đăng nhập":"Đăng ký"}</button>{mode==="login"&&<button type="button" className="auth-link" onClick={reset}>Quên mật khẩu?</button>}<div className="auth-switch">{mode==="login"?"Chưa có tài khoản?":"Đã có tài khoản?"}<button type="button" onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setMessage("");}}>{mode==="login"?"Đăng ký":"Đăng nhập"}</button></div></form></section></div>;
}

function Topbar({language,setLanguage,user,onSettings,onLogout}){
  const name=user?.user_metadata?.display_name||user?.email?.split("@")[0]||"bạn"; const [open,setOpen]=useState(false);
  return <header className="topbar"><div><div className="eyebrow">LEARNING SPACE</div><h1>Chào {name} 👋</h1></div><div className="top-actions"><select className="language-select" value={language} onChange={(e)=>setLanguage(e.target.value)}>{Object.values(LANGUAGE_PACKS).map(p=><option value={p.code} key={p.code}>{p.flag} {p.label}</option>)}</select><button className="icon-btn" onClick={onSettings}>⚙</button><div className="account-wrap"><button className="avatar avatar-button" onClick={()=>setOpen(!open)}>{name.slice(0,1).toUpperCase()}</button>{open&&<div className="account-menu"><b>{name}</b><small>{user?.email}</small><button onClick={onLogout}>Đăng xuất</button></div>}</div></div></header>;
}

function Home({language,user,go}){
  const pack=LANGUAGE_PACKS[language]||LANGUAGE_PACKS.zh; const [stats,setStats]=useState({words:0,content:0,due:0,reviews:0});
  useEffect(()=>{let stop=false;async function load(){if(!supabase||!user?.id)return;const now=new Date().toISOString();const [w,c,d,r]=await Promise.all([supabase.from("user_vocabulary").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("language_code",language),supabase.from("media_items").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("language_code",language),supabase.from("user_vocabulary").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("language_code",language).lte("next_review_at",now),supabase.from("vocabulary_reviews").select("id",{count:"exact",head:true}).eq("user_id",user.id).gte("reviewed_at",new Date(Date.now()-7*86400000).toISOString())]);if(!stop)setStats({words:w.count||0,content:c.count||0,due:d.count||0,reviews:r.count||0});}load();return()=>{stop=true};},[user?.id,language]);
  return <><section className="hero-card"><div><span className="pill">{pack.flag} {pack.framework}</span><h2>Tiếp tục {pack.label}</h2><p>Học từ nội dung thật, lưu từ và luyện đúng phần bạn còn yếu.</p><div className="hero-actions"><button className="primary-btn" onClick={()=>go("content")}>＋ Học từ nội dung</button><button className="secondary-btn" onClick={()=>go("practice")}>Ôn ngay</button></div></div><div className="hero-progress"><div className="progress-ring"><strong>{stats.words}</strong><span>từ đã lưu</span></div></div></section><div className="stats-grid"><div className="stat"><span>🧠</span><b>{stats.words}</b><small>Từ vựng</small></div><div className="stat"><span>⏰</span><b>{stats.due}</b><small>Cần ôn</small></div><div className="stat"><span>▣</span><b>{stats.content}</b><small>Nội dung</small></div><div className="stat"><span>✓</span><b>{stats.reviews}</b><small>Ôn 7 ngày</small></div></div><section className="section-block"><div className="section-head"><div><span className="eyebrow">HỌC HÔM NAY</span><h3>Một vòng học hoàn chỉnh</h3></div></div><div className="task-list">{[["01","Ôn từ đến hạn",`${stats.due} từ · SRS`,"practice"],["02","Học từ video / audio / PDF","AI transcript & bài học","content"],["03","Luyện nói & đặt câu","AI feedback","practice"],["04","Học theo ngành nghề","Factory · Logistics · QA/QC","courses"],["05","Hỏi AI Tutor","Ngữ pháp · sửa câu · ví dụ","tutor"]].map(x=><button className="task" key={x[0]} onClick={()=>go(x[3])}><span className="task-num">{x[0]}</span><span><b>{x[1]}</b><small>{x[2]}</small></span><i>→</i></button>)}</div></section></>;
}

function Loading(){return <div className="loading-screen"><div className="brand-mark">L</div><b>LinguaFlow</b><span>Đang kết nối...</span></div>}

export default function Page(){
  const [active,setActive]=useState("home"); const [language,setLanguageState]=useState("zh"); const [settings,setSettings]=useState(false); const [session,setSession]=useState(null); const [authLoading,setAuthLoading]=useState(true); const [refreshKey,setRefreshKey]=useState(0);
  const [aiConfig,setAiConfigState]=useState({provider:"gemini",apiKey:"",model:"auto",models:[],recommended:""});

  useEffect(()=>{if(!supabase){setAuthLoading(false);return;}supabase.auth.getSession().then(({data})=>{setSession(data.session??null);setAuthLoading(false)});const{data:l}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);setAuthLoading(false)});return()=>l.subscription.unsubscribe();},[]);
  useEffect(()=>{try{const fresh=sessionStorage.getItem("linguaflow_ai_session_v1");const legacy=sessionStorage.getItem("linguaflow_ai_session");const raw=fresh||legacy;if(raw){const parsed=JSON.parse(raw);if(parsed?.apiKey){setAiConfigState({...aiConfig,...parsed,model:fresh?(parsed.model||"auto"):"auto"});}}}catch{}},[]);
  function setAiConfig(next){setAiConfigState(next);try{sessionStorage.setItem("linguaflow_ai_session_v1",JSON.stringify(next));}catch{}}
  useEffect(()=>{if(!session?.user?.id||!supabase)return;let cancel=false;supabase.from("user_language_preferences").select("language_code").eq("user_id",session.user.id).eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle().then(({data})=>{if(!cancel&&data?.language_code&&LANGUAGE_PACKS[data.language_code])setLanguageState(data.language_code)});return()=>{cancel=true};},[session?.user?.id]);
  async function setLanguage(code){setLanguageState(code);if(!session?.user?.id||!supabase)return;await supabase.from("user_language_preferences").update({is_active:false}).eq("user_id",session.user.id);await supabase.from("user_language_preferences").upsert({user_id:session.user.id,language_code:code,is_active:true},{onConflict:"user_id,language_code"});}
  async function logout(){if(supabase)await supabase.auth.signOut();setActive("home");try{sessionStorage.removeItem("linguaflow_ai_session_v1");sessionStorage.removeItem("linguaflow_ai_session")}catch{}}

  const content=useMemo(()=>{
    const common={language,user:session?.user,aiConfig,onNeedApiKey:()=>setSettings(true)};
    if(active==="content")return <ContentLab language={language} user={session?.user} onUploaded={()=>setRefreshKey(x=>x+1)} goLibrary={()=>setActive("library")}/>;
    if(active==="practice")return <PracticeHub {...common}/>;
    if(active==="courses")return <Courses {...common}/>;
    if(active==="tutor")return <AITutor language={language} aiConfig={aiConfig} onNeedApiKey={()=>setSettings(true)}/>;
    if(active==="library")return <Library {...common} refreshKey={refreshKey}/>;
    return <Home language={language} user={session?.user} go={setActive}/>;
  },[active,language,session?.user,refreshKey,aiConfig]);

  if(authLoading)return <Loading/>; if(!session)return <AuthScreen/>;
  const modelLabel=aiConfig.apiKey?(aiConfig.model==="auto"?`Auto${aiConfig.recommended?` · ${aiConfig.recommended}`:""}`:aiConfig.model):"Chưa kết nối";
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">L</div><div><b>LinguaFlow</b><small>learn with AI</small></div></div><nav>{NAV.map(([id,icon,label])=><button key={id} className={active===id?"active":""} onClick={()=>setActive(id)}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><button onClick={()=>setSettings(true)}><span>⚙</span>Cài đặt AI</button><div className="free-plan"><small>BYOK</small><b>{aiConfig.apiKey?"Gemini connected":"Gemini ready"}</b><span>{modelLabel}</span></div></div></aside><main className="main"><Topbar language={language} setLanguage={setLanguage} user={session.user} onSettings={()=>setSettings(true)} onLogout={logout}/><div className="content-wrap">{content}</div></main><nav className="mobile-nav">{NAV.slice(0,5).map(([id,icon,label])=><button key={id} className={active===id?"active":""} onClick={()=>setActive(id)}><span>{icon}</span><small>{label.replace("Học ","")}</small></button>)}</nav>{settings&&<Settings onClose={()=>setSettings(false)} aiConfig={aiConfig} setAiConfig={setAiConfig}/>}</div>;
}
