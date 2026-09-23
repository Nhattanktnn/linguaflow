"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import MediaTranscript from "./components/MediaTranscript";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const NAV = [
  ["home", "⌂", "Học hôm nay"],
  ["content", "▶", "Học từ nội dung"],
  ["practice", "◎", "Luyện tập"],
  ["courses", "▤", "Khóa học"],
  ["library", "▣", "Thư viện"],
];

const practiceItems = [
  ["🧠", "Ôn từ vựng", "12 từ cần ôn", "5 phút"],
  ["🎧", "Luyện nghe", "Câu ngắn theo trình độ", "7 phút"],
  ["🎤", "Luyện nói", "Shadowing & phát âm", "5 phút"],
  ["✍️", "Luyện viết", "Đặt câu & sửa lỗi", "8 phút"],
  ["🧩", "Xếp câu", "Trật tự từ & ngữ pháp", "5 phút"],
  ["⚡", "Quiz nhanh", "Ôn hỗn hợp", "3 phút"],
];

const courseData = {
  zh: [
    ["HSK / Beginner", "Nền tảng tiếng Trung", "12 bài"],
    ["Giao tiếp hằng ngày", "Tình huống thực tế", "10 bài"],
    ["Tiếng Trung công xưởng", "Sản xuất · QA/QC · máy móc", "8 bài"],
    ["Logistics & Xuất nhập khẩu", "Từ vựng nghề nghiệp", "6 bài"],
  ],
  en: [
    ["English Beginner", "Nền tảng A1–A2", "12 bài"],
    ["Daily English", "Giao tiếp hằng ngày", "10 bài"],
    ["English for Manufacturing", "Sản xuất · QA/QC", "8 bài"],
    ["Business & Logistics", "Công việc thực tế", "6 bài"],
  ],
};

const demoWords = {
  zh: [
    { term: "你", pronunciation: "nǐ", meaning: "bạn" },
    { term: "今天", pronunciation: "jīntiān", meaning: "hôm nay" },
    { term: "去", pronunciation: "qù", meaning: "đi" },
    { term: "哪里", pronunciation: "nǎlǐ", meaning: "ở đâu" },
  ],
  en: [
    { term: "Where", pronunciation: "/wɛr/", meaning: "ở đâu" },
    { term: "are", pronunciation: "/ɑːr/", meaning: "là / đang" },
    { term: "you", pronunciation: "/juː/", meaning: "bạn" },
    { term: "going", pronunciation: "/ˈɡoʊɪŋ/", meaning: "đang đi" },
  ],
};

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function cleanFileName(name = "file") {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  return `${base.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "media"}${ext}`;
}

function AuthScreen({ configured }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setMessage(""); setError("");
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim() || email.split("@")[0] } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage("Đã tạo tài khoản. Hãy kiểm tra email để xác nhận rồi đăng nhập.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (err) { setError(err?.message || "Có lỗi xảy ra. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    if (!email.trim()) { setError("Nhập email trước để nhận liên kết đặt lại mật khẩu."); return; }
    setBusy(true); setMessage(""); setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (resetError) setError(resetError.message); else setMessage("Đã gửi email đặt lại mật khẩu nếu địa chỉ này tồn tại.");
    setBusy(false);
  }

  return (
    <div className="auth-shell">
      <section className="auth-brand-panel">
        <div className="auth-brand"><div className="brand-mark">L</div><div><b>LinguaFlow</b><small>learn with AI</small></div></div>
        <div className="auth-copy">
          <span className="pill dark-pill">LANGUAGE LEARNING OS</span>
          <h1>Học từ nội dung thật.<br />Luyện đúng phần bạn còn yếu.</h1>
          <p>Tiếng Trung và tiếng Anh trước tiên. Video, audio, từ vựng, flashcard và AI trong một nơi.</p>
          <div className="auth-feature-row"><span>中</span><span>EN</span><b>＋ nhiều ngôn ngữ sau</b></div>
        </div>
      </section>
      <section className="auth-form-panel">
        <form className="auth-card" onSubmit={submit}>
          <div><span className="eyebrow">LINGUAFLOW V0.4</span><h2>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h2><p>{mode === "login" ? "Tiếp tục quá trình học của bạn." : "Tạo tài khoản miễn phí để bắt đầu."}</p></div>
          {!configured && <div className="auth-error">Chưa tìm thấy cấu hình Supabase trên Vercel.</div>}
          {message && <div className="auth-success">{message}</div>}
          {error && <div className="auth-error">{error}</div>}
          {mode === "signup" && <label className="auth-label">Tên hiển thị<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Lilly" autoComplete="name" /></label>}
          <label className="auth-label">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
          <label className="auth-label">Mật khẩu<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          <button className="primary-btn auth-submit" disabled={busy || !configured}>{busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký miễn phí"}</button>
          {mode === "login" && <button type="button" className="auth-link" onClick={resetPassword} disabled={busy}>Quên mật khẩu?</button>}
          <div className="auth-switch">{mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}<button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Đăng ký" : "Đăng nhập"}</button></div>
        </form>
      </section>
    </div>
  );
}

function Topbar({ language, setLanguage, onSettings, user, onLogout }) {
  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "bạn";
  const initial = displayName.slice(0, 1).toUpperCase();
  const [accountOpen, setAccountOpen] = useState(false);
  return (
    <header className="topbar">
      <div><div className="eyebrow">LEARNING SPACE</div><h1>Chào {displayName} 👋</h1></div>
      <div className="top-actions">
        <select className="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Chọn ngôn ngữ"><option value="zh">🇨🇳 Chinese</option><option value="en">🇬🇧 English</option></select>
        <button className="icon-btn" onClick={onSettings} title="Cài đặt">⚙</button>
        <div className="account-wrap"><button className="avatar avatar-button" onClick={() => setAccountOpen(!accountOpen)}>{initial}</button>{accountOpen && <div className="account-menu"><b>{displayName}</b><small>{user?.email}</small><button onClick={onLogout}>Đăng xuất</button></div>}</div>
      </div>
    </header>
  );
}

function Home({ language, go }) {
  const chinese = language === "zh";
  return <>
    <section className="hero-card"><div><span className="pill">Hôm nay · 25 phút</span><h2>{chinese ? "Tiếp tục tiếng Trung" : "Continue English"}</h2><p>{chinese ? "Ôn từ, nghe một đoạn ngắn và luyện nói." : "Review vocabulary, listen and practice speaking."}</p><button className="primary-btn" onClick={() => go("content")}>Học từ nội dung →</button></div><div className="hero-progress"><div className="progress-ring"><strong>68%</strong><span>tuần này</span></div></div></section>
    <div className="stats-grid"><div className="stat"><span>🔥</span><b>7 ngày</b><small>Streak</small></div><div className="stat"><span>🧠</span><b>128</b><small>Từ đã lưu</small></div><div className="stat"><span>🎧</span><b>42 phút</b><small>Listening</small></div><div className="stat"><span>🎤</span><b>18 phút</b><small>Speaking</small></div></div>
    <section className="section-block"><div className="section-head"><div><span className="eyebrow">KẾ HOẠCH HÔM NAY</span><h3>Học ít, nhưng đều</h3></div><button className="text-btn" onClick={() => go("practice")}>Xem tất cả</button></div><div className="task-list">{[["01","Ôn 12 từ sắp quên","Flashcard · 5 phút"],["02",chinese ? "Nghe: 在工厂的一天" : "Listen: A day at work","Immersion · 8 phút"],["03","Shadowing 5 câu","Speaking · 7 phút"],["04","Quiz cuối buổi","Review · 5 phút"]].map((x) => <button className="task" key={x[0]} onClick={() => go(x[0] === "02" ? "content" : "practice")}><span className="task-num">{x[0]}</span><span><b>{x[1]}</b><small>{x[2]}</small></span><i>→</i></button>)}</div></section>
  </>;
}

function WordPopup({ word, onClose, onSave, saved, saving }) {
  if (!word) return null;
  return <div className="word-popover">
    <button className="word-close" onClick={onClose}>×</button>
    <span className="eyebrow">QUICK WORD</span><h3>{word.term}</h3><b>{word.pronunciation}</b><p>{word.meaning}</p>
    <button className="primary-btn" onClick={() => onSave(word)} disabled={saved || saving}>{saved ? "✓ Đã lưu" : saving ? "Đang lưu..." : "＋ Lưu vào từ vựng"}</button>
  </div>;
}

function ContentLab({ language, user, onUploaded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedWord, setSelectedWord] = useState(null);
  const [savedTerms, setSavedTerms] = useState(new Set());
  const [savingWord, setSavingWord] = useState(false);

  function chooseFile(nextFile) {
    setMessage(""); setError("");
    if (!nextFile) { setFile(null); return; }
    if (!(nextFile.type?.startsWith("audio/") || nextFile.type?.startsWith("video/"))) { setError("Chỉ hỗ trợ file audio hoặc video ở bước này."); return; }
    if (nextFile.size > MAX_UPLOAD_BYTES) { setError("File đang quá lớn cho bản thử nghiệm. Hãy dùng file nhỏ hơn 50 MB."); return; }
    setFile(nextFile);
  }

  async function uploadFile() {
    if (!file || !supabase || !user?.id) return;
    setUploading(true); setError(""); setMessage("");
    const safeName = cleanFileName(file.name);
    const storagePath = `${user.id}/${Date.now()}-${safeName}`;
    const mediaType = file.type.startsWith("video/") ? "video" : "audio";
    try {
      const { error: storageError } = await supabase.storage.from("media").upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from("media_items").insert({
        user_id: user.id, language_code: language, title: file.name.replace(/\.[^.]+$/, ""), file_name: file.name,
        storage_path: storagePath, mime_type: file.type || null, size_bytes: file.size, media_type: mediaType, status: "uploaded",
      });
      if (dbError) {
        await supabase.storage.from("media").remove([storagePath]);
        throw dbError;
      }
      setMessage("Upload thành công. File đã nằm trong Thư viện.");
      setFile(null);
      onUploaded?.();
    } catch (err) { setError(err?.message || "Upload thất bại. Hãy thử lại."); }
    finally { setUploading(false); }
  }

  async function saveWord(word) {
    if (!supabase || !user?.id) return;
    setSavingWord(true);
    const { error: saveError } = await supabase.from("user_vocabulary").upsert({
      user_id: user.id, language_code: language, term: word.term, pronunciation: word.pronunciation, meaning_vi: word.meaning, source_type: "demo_transcript",
    }, { onConflict: "user_id,language_code,term" });
    if (!saveError) setSavedTerms((prev) => new Set([...prev, word.term])); else setError(saveError.message);
    setSavingWord(false);
  }

  const words = demoWords[language];
  return <>
    <div className="page-title"><span className="eyebrow">LEARN FROM ANYTHING</span><h2>Học từ video & âm thanh</h2><p>Upload media của bạn. Upload media của bạn, sau đó vào Thư viện để Gemini tạo transcript đồng bộ.</p></div>
    {message && <div className="page-success">{message}</div>}{error && <div className="page-error">{error}</div>}
    <label className={`upload-zone ${file ? "has-file" : ""}`}>
      <input type="file" accept="audio/*,video/*" onChange={(e) => chooseFile(e.target.files?.[0])} />
      <div className="upload-icon">＋</div><h3>{file?.name || "Thả file vào đây hoặc bấm để chọn"}</h3><p>{file ? `${formatBytes(file.size)} · ${file.type || "media"}` : "MP3 · WAV · M4A · MP4 · MOV · WEBM"}</p><span className="secondary-btn">{file ? "Đổi file" : "Chọn file"}</span>
    </label>
    {file && <div className="upload-action-row"><div><b>Sẵn sàng upload</b><small>Ngôn ngữ: {language === "zh" ? "Chinese" : "English"}</small></div><button className="primary-btn" onClick={uploadFile} disabled={uploading}>{uploading ? "Đang upload..." : "Upload vào Thư viện →"}</button></div>}
    <div className="feature-grid">{[["01","Lưu media thật","Supabase Storage + thư viện riêng"],["02","Click để học","Tra nghĩa và lưu từ"],["03","Player","Phát lại audio/video đã upload"],["04","AI Transcript","Gemini tạo text · thời gian · phát âm"]].map((x) => <div className="feature-card" key={x[0]}><span>{x[0]}</span><h4>{x[1]}</h4><p>{x[2]}</p></div>)}</div>
    <section className="demo-player word-demo-wrap">
      <div className="video-placeholder"><div className="play">▶</div><span>Demo transcript tương tác</span></div>
      <div className="transcript-panel">
        <div className="transcript-tools"><button>{language === "zh" ? "中文" : "EN"}</button><button>{language === "zh" ? "Pinyin ✓" : "IPA ✓"}</button><button>Dịch ✓</button></div>
        <div className="sentence active"><div className="ruby-row">{words.map((w) => <span key={w.term}>{w.pronunciation}</span>)}</div><div className="hanzi">{words.map((w) => <button key={w.term} onClick={() => setSelectedWord(w)}>{w.term}</button>)}<i>00:03</i></div><p>{language === "zh" ? "Hôm nay bạn đi đâu?" : "Bạn đang đi đâu?"}</p></div>
        <div className="sentence muted"><b>{language === "zh" ? "我今天去工厂。" : "I'm going to the factory today."}</b><p>Hôm nay tôi đi nhà máy.</p></div>
        <WordPopup word={selectedWord} onClose={() => setSelectedWord(null)} onSave={saveWord} saved={selectedWord ? savedTerms.has(selectedWord.term) : false} saving={savingWord} />
      </div>
    </section>
  </>;
}

function Practice() {
  return <><div className="page-title"><span className="eyebrow">PRACTICE</span><h2>Luyện tập</h2><p>Hệ thống sẽ dần ưu tiên những kỹ năng và từ bạn còn yếu.</p></div><div className="practice-grid">{practiceItems.map((x) => <button className="practice-card" key={x[1]}><span className="practice-icon">{x[0]}</span><div><h3>{x[1]}</h3><p>{x[2]}</p><small>{x[3]}</small></div><i>→</i></button>)}</div></>;
}

function Courses({ language }) {
  return <><div className="page-title"><span className="eyebrow">COURSES</span><h2>Khóa học</h2><p>Học theo trình độ, mục tiêu hoặc ngành nghề.</p></div><div className="course-list">{courseData[language].map((x, index) => <button className="course-card" key={x[0]}><div className="course-cover"><span>{String(index + 1).padStart(2, "0")}</span></div><div><h3>{x[0]}</h3><p>{x[1]}</p><small>{x[2]}</small></div><i>→</i></button>)}</div></>;
}

function Library({ user, refreshKey, apiKey, onNeedApiKey }) {
  const [tab, setTab] = useState("media");
  const [media, setMedia] = useState([]);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  async function loadLibrary() {
    if (!supabase || !user?.id) return;
    setLoading(true); setError("");
    const [{ data: mediaRows, error: mediaError }, { data: vocabRows, error: vocabError }] = await Promise.all([
      supabase.from("media_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("user_vocabulary").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (mediaError || vocabError) setError(mediaError?.message || vocabError?.message);
    const rows = mediaRows || [];
    const enriched = await Promise.all(rows.map(async (item) => {
      const { data } = await supabase.storage.from("media").createSignedUrl(item.storage_path, 3600);
      return { ...item, signedUrl: data?.signedUrl || null };
    }));
    setMedia(enriched); setWords(vocabRows || []); setLoading(false);
  }

  useEffect(() => { loadLibrary(); }, [user?.id, refreshKey]);

  async function deleteMedia(item) {
    if (!window.confirm(`Xóa “${item.title}”?`)) return;
    const { error: storageError } = await supabase.storage.from("media").remove([item.storage_path]);
    if (storageError) { setError(storageError.message); return; }
    const { error: dbError } = await supabase.from("media_items").delete().eq("id", item.id).eq("user_id", user.id);
    if (dbError) setError(dbError.message); else { if (selected?.id === item.id) setSelected(null); loadLibrary(); }
  }

  return <>
    <div className="page-title"><span className="eyebrow">YOUR LIBRARY</span><h2>Thư viện</h2><p>Media và từ vựng của riêng tài khoản này.</p></div>
    <div className="library-tabs"><button className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}>Media <span>{media.length}</span></button><button className={tab === "words" ? "active" : ""} onClick={() => setTab("words")}>Từ đã lưu <span>{words.length}</span></button><button className="library-refresh" onClick={loadLibrary}>↻ Làm mới</button></div>
    {error && <div className="page-error">{error}</div>}
    {loading ? <div className="empty-state"><div>◌</div><h3>Đang tải thư viện...</h3></div> : tab === "media" ? <>
      {selected && <section className="media-viewer"><div className="media-viewer-head"><div><span className="eyebrow">NOW LEARNING</span><h3>{selected.title}</h3></div><button className="text-btn" onClick={() => setSelected(null)}>Đóng</button></div><MediaTranscript item={selected} user={user} apiKey={apiKey} onNeedApiKey={onNeedApiKey} /></section>}
      {media.length === 0 ? <div className="empty-state"><div>▣</div><h3>Chưa có media</h3><p>Upload file ở mục “Học từ nội dung”.</p></div> : <div className="media-grid">{media.map((item) => <article className="media-card" key={item.id}><div className="media-thumb">{item.media_type === "video" ? "▶" : "♫"}</div><div className="media-card-body"><span className="eyebrow">{item.language_code === "zh" ? "CHINESE" : "ENGLISH"}</span><h3>{item.title}</h3><p>{item.file_name}</p><small>{formatBytes(item.size_bytes)} · {new Date(item.created_at).toLocaleDateString("vi-VN")}</small><div className="media-actions"><button className="primary-btn compact" disabled={!item.signedUrl} onClick={() => setSelected(item)}>Mở</button><button className="danger-btn" onClick={() => deleteMedia(item)}>Xóa</button></div></div></article>)}</div>}
    </> : words.length === 0 ? <div className="empty-state"><div>🧠</div><h3>Chưa lưu từ nào</h3><p>Hãy click một từ trong transcript demo rồi bấm Lưu.</p></div> : <div className="vocab-list">{words.map((word) => <div className="vocab-row" key={word.id}><div><b>{word.term}</b><span>{word.pronunciation || "—"}</span></div><p>{word.meaning_vi || "Chưa có nghĩa"}</p><small>{word.language_code === "zh" ? "Chinese" : "English"}</small></div>)}</div>}
  </>;
}

function Settings({ onClose, aiConfig, setAiConfig }) {
  const [mode, setMode] = useState("byok");
  const [provider, setProvider] = useState("gemini");
  const [key, setKey] = useState(aiConfig?.apiKey || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function testAndUse() {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: key.trim() }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "Không kết nối được AI.");
      setAiConfig({ provider: "gemini", apiKey: key.trim(), model: "gemini-3.5-flash" });
      setMessage("✓ Gemini đã kết nối. Key chỉ được giữ trong phiên hiện tại.");
    } catch (err) { setError(err?.message || "Không kết nối được Gemini."); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">SETTINGS</span><h2>AI Provider</h2></div><button onClick={onClose}>×</button></div><p className="modal-copy">V0.4 chạy Gemini BYOK. API key không lưu vào Supabase hay GitHub; khi refresh trang bạn sẽ nhập lại.</p><div className="segmented"><button className={mode === "app" ? "selected" : ""} onClick={() => setMode("app")}>App AI</button><button className={mode === "byok" ? "selected" : ""} onClick={() => setMode("byok")}>My API Key</button></div>{mode === "byok" ? <div className="form-stack"><label>Provider<select value={provider} onChange={(e) => setProvider(e.target.value)}><option value="gemini">Gemini</option><option disabled>OpenAI · sắp có</option><option disabled>Custom · sắp có</option></select></label><label>Gemini API Key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza..." /></label><label>Model<select value="gemini-3.5-flash" disabled><option>gemini-3.5-flash</option></select></label>{message && <div className="auth-success">{message}</div>}{error && <div className="auth-error">{error}</div>}<button className="primary-btn" onClick={testAndUse} disabled={busy || !key.trim()}>{busy ? "Đang kiểm tra..." : aiConfig?.apiKey ? "Kiểm tra lại & sử dụng" : "Kiểm tra & sử dụng"}</button></div> : <div className="notice">AI tích hợp sẵn sẽ bật khi có quota/subscription.</div>}</div></div>;
}

function LoadingScreen() { return <div className="loading-screen"><div className="brand-mark">L</div><b>LinguaFlow</b><span>Đang kết nối...</span></div>; }

export default function Page() {
  const [active, setActive] = useState("home");
  const [language, setLanguageState] = useState("zh");
  const [settings, setSettings] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [aiConfig, setAiConfig] = useState({ provider: "gemini", apiKey: "", model: "gemini-3.5-flash" });

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session ?? null); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setAuthLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    let cancelled = false;
    async function loadLanguage() {
      const { data } = await supabase.from("user_language_preferences").select("language_code").eq("user_id", session.user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!cancelled && data?.language_code) setLanguageState(data.language_code);
    }
    loadLanguage();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function setLanguage(code) {
    setLanguageState(code);
    if (!session?.user?.id || !supabase) return;
    await supabase.from("user_language_preferences").update({ is_active: false }).eq("user_id", session.user.id);
    await supabase.from("user_language_preferences").upsert({ user_id: session.user.id, language_code: code, is_active: true }, { onConflict: "user_id,language_code" });
  }

  async function logout() { if (supabase) await supabase.auth.signOut(); setActive("home"); }

  const content = useMemo(() => {
    if (active === "content") return <ContentLab language={language} user={session?.user} onUploaded={() => setLibraryRefreshKey((x) => x + 1)} />;
    if (active === "practice") return <Practice />;
    if (active === "courses") return <Courses language={language} />;
    if (active === "library") return <Library user={session?.user} refreshKey={libraryRefreshKey} apiKey={aiConfig.apiKey} onNeedApiKey={() => setSettings(true)} />;
    return <Home language={language} go={setActive} />;
  }, [active, language, session?.user, libraryRefreshKey, aiConfig.apiKey]);

  if (authLoading) return <LoadingScreen />;
  if (!session) return <AuthScreen configured={Boolean(supabase)} />;

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">L</div><div><b>LinguaFlow</b><small>learn with AI</small></div></div><nav>{NAV.map(([id, icon, label]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><span>{icon}</span>{label}</button>)}</nav><div className="sidebar-bottom"><button onClick={() => setSettings(true)}><span>⚙</span>Cài đặt AI</button><div className="free-plan"><small>FREE PLAN</small><b>{aiConfig.apiKey ? "Gemini BYOK connected" : "Gemini BYOK ready"}</b><span>{aiConfig.apiKey ? "AI transcript đã sẵn sàng" : "Nhập key để tạo transcript"}</span></div></div></aside>
    <main className="main"><Topbar language={language} setLanguage={setLanguage} onSettings={() => setSettings(true)} user={session.user} onLogout={logout} /><div className="content-wrap">{content}</div></main>
    <nav className="mobile-nav">{NAV.slice(0, 4).map(([id, icon, label]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><span>{icon}</span><small>{label.replace("Học ", "")}</small></button>)}</nav>{settings && <Settings onClose={() => setSettings(false)} aiConfig={aiConfig} setAiConfig={setAiConfig} />}
  </div>;
}
