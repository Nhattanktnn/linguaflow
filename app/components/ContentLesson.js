"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { LANGUAGE_PACKS } from "../../lib/languages";

const AI_MAX_BYTES = 45 * 1024 * 1024;

function formatTime(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rest = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function srtTime(seconds = 0) {
  const total = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.floor((total % 1) * 1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
}

function normalizeTokens(segment) {
  if (Array.isArray(segment.tokens) && segment.tokens.length) return segment.tokens;
  return [{ term: segment.text, pronunciation: segment.pronunciation || "", meaning_vi: segment.translation_vi || "" }];
}

export default function ContentLesson({ item, user, aiConfig, onNeedApiKey, onChanged }) {
  const playerRef = useRef(null);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedWord, setSelectedWord] = useState(null);
  const [savingWord, setSavingWord] = useState(false);
  const [savedTerm, setSavedTerm] = useState("");
  const [showPronunciation, setShowPronunciation] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);
  const [showText, setShowText] = useState(true);
  const [speed, setSpeed] = useState(1);
  const pack = LANGUAGE_PACKS[item.language_code] || LANGUAGE_PACKS.zh;
  const timed = item.media_type === "audio" || item.media_type === "video";

  async function loadSegments() {
    if (!supabase || !item?.id) return;
    setLoading(true);
    const { data, error: loadError } = await supabase.from("transcript_segments").select("*").eq("media_id", item.id).order("segment_index", { ascending: true });
    if (loadError) setError(loadError.message);
    setSegments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    setCurrentTime(0); setSelectedWord(null); setMessage(""); setError("");
    loadSegments();
  }, [item?.id]);

  useEffect(() => {
    if (playerRef.current) playerRef.current.playbackRate = speed;
  }, [speed]);

  const activeIndex = useMemo(() => {
    if (!timed || !segments.length) return -1;
    let index = segments.findIndex((s) => currentTime >= Number(s.start_seconds) && currentTime < Number(s.end_seconds));
    if (index < 0) {
      for (let i = segments.length - 1; i >= 0; i -= 1) if (currentTime >= Number(segments[i].start_seconds)) return i;
    }
    return index;
  }, [segments, currentTime, timed]);

  function seekTo(seconds) {
    if (!timed || !playerRef.current) return;
    playerRef.current.currentTime = Number(seconds) || 0;
    playerRef.current.play?.().catch(() => {});
  }

  async function generateLesson() {
    setError(""); setMessage("");
    if (!aiConfig?.apiKey) { onNeedApiKey?.(); return; }
    if (Number(item.size_bytes || 0) > AI_MAX_BYTES) { setError("AI xử lý file tối đa 45 MB trong bản này."); return; }
    if (item.media_type !== "text" && !item.signedUrl) { setError("Không lấy được liên kết file. Hãy đóng và mở lại nội dung."); return; }
    setGenerating(true);
    try {
      await supabase.from("media_items").update({ status: "processing" }).eq("id", item.id).eq("user_id", user.id);
      const response = await fetch("/api/transcribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: aiConfig.apiKey, model: aiConfig.model || "auto", mediaUrl: item.signedUrl,
          mimeType: item.mime_type, sourceType: item.media_type, languageCode: item.language_code,
          title: item.title, sizeBytes: item.size_bytes, sourceText: item.source_text || ""
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "AI xử lý thất bại.");
      const aiSegments = Array.isArray(result?.segments) ? result.segments : [];
      if (!aiSegments.length) throw new Error("AI không tìm thấy nội dung có thể học trong file này.");
      const { error: deleteError } = await supabase.from("transcript_segments").delete().eq("media_id", item.id);
      if (deleteError) throw deleteError;
      const rows = aiSegments.slice(0, 500).map((segment, index) => ({
        media_id: item.id, segment_index: index,
        start_seconds: timed ? Number(segment.start_seconds) || 0 : 0,
        end_seconds: timed ? Math.max(Number(segment.end_seconds) || 0, Number(segment.start_seconds) || 0) : 0,
        text: String(segment.text || "").trim(), pronunciation: String(segment.pronunciation || "").trim() || null,
        translation_vi: String(segment.translation_vi || "").trim() || null,
        tokens: Array.isArray(segment.tokens) ? segment.tokens : []
      })).filter((row) => row.text);
      const { error: insertError } = await supabase.from("transcript_segments").insert(rows);
      if (insertError) throw insertError;
      await supabase.from("media_items").update({ status: "ready", ai_provider: "gemini", ai_model: result.modelUsed || null, transcribed_at: new Date().toISOString() }).eq("id", item.id).eq("user_id", user.id);
      setMessage(`Đã tạo ${rows.length} đoạn bài học${result?.modelUsed ? ` bằng ${result.modelUsed}` : ""}.`);
      await loadSegments(); onChanged?.();
    } catch (err) {
      await supabase.from("media_items").update({ status: "uploaded" }).eq("id", item.id).eq("user_id", user.id);
      setError(err?.message || "Không thể tạo bài học.");
    } finally { setGenerating(false); }
  }

  async function saveWord(word) {
    if (!supabase || !user?.id || !word?.term) return;
    setSavingWord(true); setError("");
    const { error: saveError } = await supabase.from("user_vocabulary").upsert({
      user_id: user.id, language_code: item.language_code, term: word.term,
      pronunciation: word.pronunciation || null, meaning_vi: word.meaning_vi || null,
      source_type: "ai_lesson", next_review_at: new Date().toISOString()
    }, { onConflict: "user_id,language_code,term" });
    if (saveError) setError(saveError.message); else setSavedTerm(word.term);
    setSavingWord(false);
  }

  async function saveSentence(segment) {
    const { error: e } = await supabase.from("saved_sentences").upsert({
      user_id: user.id, language_code: item.language_code, text: segment.text,
      pronunciation: segment.pronunciation || null, meaning_vi: segment.translation_vi || null,
      source_media_id: item.id
    }, { onConflict: "user_id,language_code,text" });
    if (e) setError(e.message); else setMessage("Đã lưu câu vào Thư viện.");
  }

  function exportSrt() {
    if (!timed || !segments.length) return;
    const srt = segments.map((s, i) => `${i + 1}\n${srtTime(s.start_seconds)} --> ${srtTime(s.end_seconds)}\n${s.text}${s.translation_vi ? `\n${s.translation_vi}` : ""}\n`).join("\n");
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${item.title || "transcript"}.srt`; a.click(); URL.revokeObjectURL(url);
  }

  return <div className="lesson-shell">
    <div className="lesson-source">
      {item.media_type === "video" && <video ref={playerRef} controls src={item.signedUrl} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />}
      {item.media_type === "audio" && <audio ref={playerRef} controls src={item.signedUrl} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />}
      {item.media_type === "pdf" && <iframe className="pdf-viewer" src={item.signedUrl} title={item.title} />}
      {item.media_type === "text" && <div className="source-text"><b>Nội dung gốc</b><p>{item.source_text}</p></div>}
      {timed && <div className="player-controls"><label>Tốc độ<select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>{[0.5,0.75,1,1.25,1.5,2].map((x)=><option key={x} value={x}>{x}×</option>)}</select></label><button onClick={() => setShowText(!showText)}>{showText ? "Ẩn lời" : "Hiện lời"}</button>{segments.length > 0 && <button onClick={exportSrt}>Xuất SRT</button>}</div>}
      <div className="lesson-toolbar">
        <div><b>{segments.length ? `${segments.length} đoạn bài học` : "Chưa có bài học AI"}</b><small>{pack.annotation} · nghĩa Việt · click để lưu từ</small></div>
        <button className="primary-btn compact" onClick={generateLesson} disabled={generating}>{generating ? "AI đang xử lý..." : segments.length ? "Tạo lại bài học" : "✨ Tạo bài học AI"}</button>
      </div>
      <div className="toggle-row"><button className={showPronunciation ? "active" : ""} onClick={() => setShowPronunciation(!showPronunciation)}>{pack.annotation}</button><button className={showTranslation ? "active" : ""} onClick={() => setShowTranslation(!showTranslation)}>Dịch Việt</button></div>
      {message && <div className="page-success">{message}</div>}{error && <div className="page-error">{error}</div>}
      {!aiConfig?.apiKey && <div className="notice"><b>Chưa kết nối Gemini</b><span>Vào Cài đặt AI để nhập API key.</span></div>}
    </div>
    <div className="lesson-transcript">
      {loading ? <div className="empty-mini">Đang tải...</div> : !segments.length ? <div className="empty-mini"><b>Sẵn sàng học</b><span>Bấm “Tạo bài học AI”.</span></div> : <div className="segment-list">
        {segments.map((segment, index) => {
          const tokens = normalizeTokens(segment);
          return <article key={segment.id || index} className={`sync-segment ${activeIndex === index ? "active" : ""}`} onClick={() => seekTo(segment.start_seconds)}>
            <div className="segment-meta">{timed ? <button onClick={(e)=>{e.stopPropagation();seekTo(segment.start_seconds)}}>{formatTime(segment.start_seconds)}</button> : <span>{String(index+1).padStart(2,"0")}</span>}<button title="Lưu câu" onClick={(e)=>{e.stopPropagation();saveSentence(segment)}}>☆</button></div>
            <div className="segment-body">
              {showText && <div className="token-line">{tokens.map((token, tokenIndex) => <button key={`${token.term}-${tokenIndex}`} className="learn-token" onClick={(e)=>{e.stopPropagation();setSelectedWord(token);setSavedTerm("")}}>{showPronunciation && <span>{token.pronunciation || " "}</span>}<b>{token.term}</b></button>)}</div>}
              {showTranslation && segment.translation_vi && <p>{segment.translation_vi}</p>}
            </div>
          </article>
        })}
      </div>}
      {selectedWord && <div className="word-popover inline-popover"><button className="word-close" onClick={() => setSelectedWord(null)}>×</button><span className="eyebrow">TỪ / CỤM TỪ</span><h3>{selectedWord.term}</h3><b>{selectedWord.pronunciation || "—"}</b><p>{selectedWord.meaning_vi || "Chưa có nghĩa"}</p><button className="primary-btn" onClick={() => saveWord(selectedWord)} disabled={savingWord || savedTerm === selectedWord.term}>{savedTerm === selectedWord.term ? "✓ Đã lưu" : savingWord ? "Đang lưu..." : "＋ Lưu từ"}</button></div>}
    </div>
  </div>;
}
