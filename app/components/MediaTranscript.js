"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const AI_MAX_BYTES = 20 * 1024 * 1024;

function formatTime(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rest = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function normalizeTokens(segment) {
  if (Array.isArray(segment.tokens) && segment.tokens.length) return segment.tokens;
  return [{ term: segment.text, pronunciation: segment.pronunciation || "", meaning_vi: segment.translation_vi || "" }];
}

export default function MediaTranscript({ item, user, apiKey, onNeedApiKey }) {
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

  async function loadSegments() {
    if (!supabase || !item?.id) return;
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("transcript_segments")
      .select("*")
      .eq("media_id", item.id)
      .order("segment_index", { ascending: true });
    if (loadError) setError(loadError.message);
    setSegments(data || []);
    setLoading(false);
  }

  useEffect(() => {
    setCurrentTime(0);
    setSelectedWord(null);
    setMessage("");
    setError("");
    loadSegments();
  }, [item?.id]);

  const activeIndex = useMemo(() => {
    if (!segments.length) return -1;
    let index = segments.findIndex((s) => currentTime >= Number(s.start_seconds) && currentTime < Number(s.end_seconds));
    if (index < 0) index = segments.findLastIndex?.((s) => currentTime >= Number(s.start_seconds)) ?? -1;
    return index;
  }, [segments, currentTime]);

  function seekTo(seconds) {
    if (!playerRef.current) return;
    playerRef.current.currentTime = Number(seconds) || 0;
    playerRef.current.play?.().catch(() => {});
  }

  async function generateTranscript() {
    setError("");
    setMessage("");
    if (!apiKey) {
      onNeedApiKey?.();
      return;
    }
    if (Number(item.size_bytes || 0) > AI_MAX_BYTES) {
      setError("V0.4 giới hạn xử lý AI ở 20 MB để tránh timeout trên Vercel Free. Hãy thử file nhỏ hơn.");
      return;
    }
    if (!item.signedUrl) {
      setError("Không lấy được liên kết media. Hãy đóng và mở lại file rồi thử lại.");
      return;
    }

    setGenerating(true);
    try {
      await supabase.from("media_items").update({ status: "processing" }).eq("id", item.id).eq("user_id", user.id);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          mediaUrl: item.signedUrl,
          mimeType: item.mime_type,
          mediaType: item.media_type,
          languageCode: item.language_code,
          title: item.title,
          sizeBytes: item.size_bytes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || "AI transcription failed");
      const aiSegments = Array.isArray(result?.segments) ? result.segments : [];
      if (!aiSegments.length) throw new Error("AI không tìm thấy lời thoại trong file này.");

      const { error: deleteError } = await supabase.from("transcript_segments").delete().eq("media_id", item.id);
      if (deleteError) throw deleteError;

      const rows = aiSegments.slice(0, 250).map((segment, index) => ({
        media_id: item.id,
        segment_index: index,
        start_seconds: Number(segment.start_seconds) || 0,
        end_seconds: Math.max(Number(segment.end_seconds) || 0, Number(segment.start_seconds) || 0),
        text: String(segment.text || "").trim(),
        pronunciation: String(segment.pronunciation || "").trim() || null,
        translation_vi: String(segment.translation_vi || "").trim() || null,
        tokens: Array.isArray(segment.tokens) ? segment.tokens : [],
      })).filter((row) => row.text);

      const { error: insertError } = await supabase.from("transcript_segments").insert(rows);
      if (insertError) throw insertError;

      await supabase.from("media_items").update({
        status: "ready",
        ai_provider: "gemini",
        transcribed_at: new Date().toISOString(),
      }).eq("id", item.id).eq("user_id", user.id);

      setMessage(`Đã tạo ${rows.length} đoạn transcript.`);
      await loadSegments();
    } catch (err) {
      await supabase.from("media_items").update({ status: "uploaded" }).eq("id", item.id).eq("user_id", user.id);
      setError(err?.message || "Không thể tạo transcript.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveWord(word) {
    if (!supabase || !user?.id || !word?.term) return;
    setSavingWord(true);
    setError("");
    const { error: saveError } = await supabase.from("user_vocabulary").upsert({
      user_id: user.id,
      language_code: item.language_code,
      term: word.term,
      pronunciation: word.pronunciation || null,
      meaning_vi: word.meaning_vi || null,
      source_type: "ai_transcript",
    }, { onConflict: "user_id,language_code,term" });
    if (saveError) setError(saveError.message);
    else setSavedTerm(word.term);
    setSavingWord(false);
  }

  return (
    <div className="ai-media-shell">
      <div className="ai-player-column">
        {item.media_type === "video" ? (
          <video ref={playerRef} controls src={item.signedUrl} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />
        ) : (
          <audio ref={playerRef} controls src={item.signedUrl} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} />
        )}
        <div className="ai-transcript-toolbar">
          <div>
            <b>{segments.length ? `${segments.length} đoạn transcript` : "Chưa có transcript AI"}</b>
            <small>{item.language_code === "zh" ? "Hanzi · Pinyin · nghĩa Việt" : "English · pronunciation · nghĩa Việt"}</small>
          </div>
          <button className="primary-btn compact" onClick={generateTranscript} disabled={generating}>
            {generating ? "AI đang xử lý..." : segments.length ? "Tạo lại transcript" : "✨ Tạo transcript AI"}
          </button>
        </div>
        {message && <div className="page-success">{message}</div>}
        {error && <div className="page-error">{error}</div>}
        {!apiKey && <div className="ai-key-note"><b>Chưa có Gemini API Key</b><span>Bấm “Cài đặt AI”, nhập key rồi quay lại tạo transcript.</span></div>}
        {Number(item.size_bytes || 0) > AI_MAX_BYTES && <div className="ai-key-note"><b>File lớn hơn 20 MB</b><span>V0.4 chỉ xử lý AI file tối đa 20 MB; upload và phát media vẫn bình thường.</span></div>}
      </div>

      <div className="synced-transcript">
        {loading ? (
          <div className="transcript-empty"><b>Đang tải transcript...</b></div>
        ) : !segments.length ? (
          <div className="transcript-empty"><b>Sẵn sàng tạo bài học từ media này</b><p>Gemini sẽ tạo transcript, thời gian, phát âm/Pinyin và bản dịch tiếng Việt.</p></div>
        ) : (
          <div className="segment-list">
            {segments.map((segment, index) => {
              const tokens = normalizeTokens(segment);
              return (
                <article key={segment.id || index} className={`sync-segment ${activeIndex === index ? "active" : ""}`} onClick={() => seekTo(segment.start_seconds)}>
                  <button className="segment-time" onClick={(e) => { e.stopPropagation(); seekTo(segment.start_seconds); }}>{formatTime(segment.start_seconds)}</button>
                  <div className="segment-body">
                    <div className="token-line">
                      {tokens.map((token, tokenIndex) => (
                        <button key={`${token.term}-${tokenIndex}`} className="learn-token" onClick={(e) => { e.stopPropagation(); setSelectedWord(token); setSavedTerm(""); }}>
                          <span>{token.pronunciation || "\u00a0"}</span>
                          <b>{token.term}</b>
                        </button>
                      ))}
                    </div>
                    {segment.translation_vi && <p>{segment.translation_vi}</p>}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {selectedWord && (
          <div className="word-popover synced-word-popover">
            <button className="word-close" onClick={() => setSelectedWord(null)}>×</button>
            <span className="eyebrow">TỪ TRONG TRANSCRIPT</span>
            <h3>{selectedWord.term}</h3>
            <b>{selectedWord.pronunciation || "—"}</b>
            <p>{selectedWord.meaning_vi || "Chưa có nghĩa"}</p>
            <button className="primary-btn" onClick={() => saveWord(selectedWord)} disabled={savingWord || savedTerm === selectedWord.term}>
              {savedTerm === selectedWord.term ? "✓ Đã lưu" : savingWord ? "Đang lưu..." : "＋ Lưu vào từ vựng"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
