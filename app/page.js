"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
    setBusy(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() || email.split("@")[0] } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage("Đã tạo tài khoản. Hãy kiểm tra email để xác nhận rồi đăng nhập.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err?.message || "Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email.trim()) {
      setError("Nhập email trước để nhận liên kết đặt lại mật khẩu.");
      return;
    }
    setBusy(true);
    setMessage("");
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (resetError) setError(resetError.message);
    else setMessage("Đã gửi email đặt lại mật khẩu nếu địa chỉ này tồn tại.");
    setBusy(false);
  }

  return (
    <div className="auth-shell">
      <section className="auth-brand-panel">
        <div className="auth-brand"><div className="brand-mark">L</div><div><b>LinguaFlow</b><small>learn with AI</small></div></div>
        <div className="auth-copy">
          <span className="pill dark-pill">LANGUAGE LEARNING OS</span>
          <h1>Học từ nội dung thật.<br />Luyện đúng phần bạn còn yếu.</h1>
          <p>Tiếng Trung và tiếng Anh trước tiên. Video, audio, từ vựng, flashcard và AI sẽ được gom trong một nơi.</p>
          <div className="auth-feature-row"><span>中</span><span>EN</span><b>＋ nhiều ngôn ngữ sau</b></div>
        </div>
      </section>

      <section className="auth-form-panel">
        <form className="auth-card" onSubmit={submit}>
          <div>
            <span className="eyebrow">LINGUAFLOW V0.2</span>
            <h2>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h2>
            <p>{mode === "login" ? "Tiếp tục quá trình học của bạn." : "Tạo tài khoản miễn phí để bắt đầu."}</p>
          </div>

          {!configured && <div className="auth-error">Chưa tìm thấy cấu hình Supabase trên Vercel.</div>}
          {message && <div className="auth-success">{message}</div>}
          {error && <div className="auth-error">{error}</div>}

          {mode === "signup" && (
            <label className="auth-label">Tên hiển thị
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Lilly" autoComplete="name" />
            </label>
          )}
          <label className="auth-label">Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </label>
          <label className="auth-label">Mật khẩu
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </label>

          <button className="primary-btn auth-submit" disabled={busy || !configured}>
            {busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký miễn phí"}
          </button>

          {mode === "login" && <button type="button" className="auth-link" onClick={resetPassword} disabled={busy}>Quên mật khẩu?</button>}

          <div className="auth-switch">
            {mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
            <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setMessage(""); }}>
              {mode === "login" ? "Đăng ký" : "Đăng nhập"}
            </button>
          </div>
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
      <div>
        <div className="eyebrow">LEARNING SPACE</div>
        <h1>Chào {displayName} 👋</h1>
      </div>
      <div className="top-actions">
        <select className="language-select" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Chọn ngôn ngữ">
          <option value="zh">🇨🇳 Chinese</option>
          <option value="en">🇬🇧 English</option>
        </select>
        <button className="icon-btn" onClick={onSettings} title="Cài đặt">⚙</button>
        <div className="account-wrap">
          <button className="avatar avatar-button" onClick={() => setAccountOpen(!accountOpen)}>{initial}</button>
          {accountOpen && (
            <div className="account-menu">
              <b>{displayName}</b>
              <small>{user?.email}</small>
              <button onClick={onLogout}>Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Home({ language, go }) {
  const chinese = language === "zh";
  return (
    <>
      <section className="hero-card">
        <div>
          <span className="pill">Hôm nay · 25 phút</span>
          <h2>{chinese ? "Tiếp tục tiếng Trung" : "Continue English"}</h2>
          <p>{chinese ? "Ôn từ, nghe một đoạn ngắn và luyện nói." : "Review vocabulary, listen and practice speaking."}</p>
          <button className="primary-btn" onClick={() => go("practice")}>Bắt đầu học →</button>
        </div>
        <div className="hero-progress"><div className="progress-ring"><strong>68%</strong><span>tuần này</span></div></div>
      </section>

      <div className="stats-grid">
        <div className="stat"><span>🔥</span><b>7 ngày</b><small>Streak</small></div>
        <div className="stat"><span>🧠</span><b>128</b><small>Từ đã lưu</small></div>
        <div className="stat"><span>🎧</span><b>42 phút</b><small>Listening</small></div>
        <div className="stat"><span>🎤</span><b>18 phút</b><small>Speaking</small></div>
      </div>

      <section className="section-block">
        <div className="section-head"><div><span className="eyebrow">KẾ HOẠCH HÔM NAY</span><h3>Học ít, nhưng đều</h3></div><button className="text-btn" onClick={() => go("practice")}>Xem tất cả</button></div>
        <div className="task-list">
          {[
            ["01", "Ôn 12 từ sắp quên", "Flashcard · 5 phút"],
            ["02", chinese ? "Nghe: 在工厂的一天" : "Listen: A day at work", "Immersion · 8 phút"],
            ["03", "Shadowing 5 câu", "Speaking · 7 phút"],
            ["04", "Quiz cuối buổi", "Review · 5 phút"],
          ].map((x) => (
            <button className="task" key={x[0]} onClick={() => go(x[0] === "02" ? "content" : "practice")}>
              <span className="task-num">{x[0]}</span><span><b>{x[1]}</b><small>{x[2]}</small></span><i>→</i>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function ContentLab({ language }) {
  const [fileName, setFileName] = useState("");
  return (
    <>
      <div className="page-title"><span className="eyebrow">LEARN FROM ANYTHING</span><h2>Học từ video & âm thanh</h2><p>Upload nội dung của bạn. AI sẽ tạo transcript, phát âm, nghĩa và bài luyện.</p></div>
      <label className="upload-zone">
        <input type="file" accept="audio/*,video/*" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
        <div className="upload-icon">＋</div><h3>{fileName || "Thả file vào đây hoặc bấm để chọn"}</h3><p>MP3 · WAV · M4A · MP4 · MOV</p><span className="secondary-btn">Chọn file</span>
      </label>
      <div className="feature-grid">
        {[
          ["01", "Transcript thông minh", language === "zh" ? "Hanzi + Pinyin + nghĩa" : "Text + pronunciation + nghĩa"],
          ["02", "Click để học", "Tra nghĩa, lưu từ, hỏi AI"], ["03", "Lặp câu", "A–B repeat và giảm tốc"], ["04", "Tạo bài tập", "Flashcard, nghe, nói, quiz"],
        ].map((x) => <div className="feature-card" key={x[0]}><span>{x[0]}</span><h4>{x[1]}</h4><p>{x[2]}</p></div>)}
      </div>
      <section className="demo-player">
        <div className="video-placeholder"><div className="play">▶</div><span>Demo transcript player</span></div>
        <div className="transcript-panel">
          <div className="transcript-tools"><button>中 / EN</button><button>Pinyin ✓</button><button>Dịch ✓</button></div>
          {language === "zh" ? (
            <div className="sentence active"><div className="ruby-row"><span>nǐ</span><span>jīn tiān</span><span>qù</span><span>nǎ lǐ</span></div><div className="hanzi"><button>你</button><button>今天</button><button>去</button><button>哪里</button><i>00:03</i></div><p>Hôm nay bạn đi đâu?</p></div>
          ) : (
            <div className="sentence active"><div className="ruby-row"><span>/wɛr/</span><span>/ɑːr/</span><span>/juː/</span><span>/ˈɡoʊɪŋ/</span></div><div className="hanzi"><button>Where</button><button>are</button><button>you</button><button>going?</button><i>00:03</i></div><p>Bạn đang đi đâu?</p></div>
          )}
          <div className="sentence muted"><b>{language === "zh" ? "我今天去工厂。" : "I'm going to the factory today."}</b><p>Hôm nay tôi đi nhà máy.</p></div>
        </div>
      </section>
    </>
  );
}

function Practice() {
  return <><div className="page-title"><span className="eyebrow">PRACTICE</span><h2>Luyện tập</h2><p>Hệ thống sẽ dần ưu tiên những kỹ năng và từ bạn còn yếu.</p></div><div className="practice-grid">{practiceItems.map((x) => <button className="practice-card" key={x[1]}><span className="practice-icon">{x[0]}</span><div><h3>{x[1]}</h3><p>{x[2]}</p><small>{x[3]}</small></div><i>→</i></button>)}</div></>;
}

function Courses({ language }) {
  return <><div className="page-title"><span className="eyebrow">COURSES</span><h2>Khóa học</h2><p>Học theo trình độ, mục tiêu hoặc ngành nghề.</p></div><div className="course-list">{courseData[language].map((x, index) => <button className="course-card" key={x[0]}><div className="course-cover"><span>{String(index + 1).padStart(2, "0")}</span></div><div><h3>{x[0]}</h3><p>{x[1]}</p><small>{x[2]}</small></div><i>→</i></button>)}</div></>;
}

function Library() {
  return <><div className="page-title"><span className="eyebrow">YOUR LIBRARY</span><h2>Thư viện</h2><p>Từ, câu, media và bài học bạn đã lưu.</p></div><div className="empty-state"><div>▣</div><h3>Thư viện đang trống</h3><p>Hãy upload một video hoặc lưu từ đầu tiên của bạn.</p></div></>;
}

function Settings({ onClose }) {
  const [mode, setMode] = useState("byok");
  return (
    <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal-head"><div><span className="eyebrow">SETTINGS</span><h2>AI Provider</h2></div><button onClick={onClose}>×</button></div>
      <p className="modal-copy">Bản đầu ưu tiên BYOK để giảm chi phí. Chúng ta sẽ nối lưu key an toàn ở bước AI.</p>
      <div className="segmented"><button className={mode === "app" ? "selected" : ""} onClick={() => setMode("app")}>App AI</button><button className={mode === "byok" ? "selected" : ""} onClick={() => setMode("byok")}>My API Key</button></div>
      {mode === "byok" ? <div className="form-stack"><label>Provider<select><option>Gemini</option><option>OpenAI</option><option>Custom OpenAI-compatible</option></select></label><label>API Key<input type="password" placeholder="••••••••••••••••" /></label><label>Model<select><option>Auto</option></select></label><button className="primary-btn">Test connection</button></div> : <div className="notice">AI tích hợp sẵn sẽ bật khi chúng ta xây hệ thống quota/subscription.</div>}
    </div></div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="brand-mark">L</div><b>LinguaFlow</b><span>Đang kết nối...</span></div>;
}

export default function Page() {
  const [active, setActive] = useState("home");
  const [language, setLanguageState] = useState("zh");
  const [settings, setSettings] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    let cancelled = false;

    async function loadLanguage() {
      const { data } = await supabase
        .from("user_language_preferences")
        .select("language_code")
        .eq("user_id", session.user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.language_code) setLanguageState(data.language_code);
    }

    loadLanguage();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function setLanguage(code) {
    setLanguageState(code);
    if (!session?.user?.id || !supabase) return;

    await supabase.from("user_language_preferences").update({ is_active: false }).eq("user_id", session.user.id);
    await supabase.from("user_language_preferences").upsert({
      user_id: session.user.id,
      language_code: code,
      is_active: true,
    }, { onConflict: "user_id,language_code" });
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setActive("home");
  }

  const content = useMemo(() => {
    if (active === "content") return <ContentLab language={language} />;
    if (active === "practice") return <Practice />;
    if (active === "courses") return <Courses language={language} />;
    if (active === "library") return <Library />;
    return <Home language={language} go={setActive} />;
  }, [active, language]);

  if (authLoading) return <LoadingScreen />;
  if (!session) return <AuthScreen configured={Boolean(supabase)} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">L</div><div><b>LinguaFlow</b><small>learn with AI</small></div></div>
        <nav>{NAV.map(([id, icon, label]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><span>{icon}</span>{label}</button>)}</nav>
        <div className="sidebar-bottom"><button onClick={() => setSettings(true)}><span>⚙</span>Cài đặt AI</button><div className="free-plan"><small>FREE PLAN</small><b>Supabase connected</b><span>Tài khoản và ngôn ngữ đã được lưu</span></div></div>
      </aside>

      <main className="main">
        <Topbar language={language} setLanguage={setLanguage} onSettings={() => setSettings(true)} user={session.user} onLogout={logout} />
        <div className="content-wrap">{content}</div>
      </main>

      <nav className="mobile-nav">{NAV.slice(0, 4).map(([id, icon, label]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><span>{icon}</span><small>{label.replace("Học ", "")}</small></button>)}</nav>
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  );
}
