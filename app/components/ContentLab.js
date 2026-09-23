"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { LANGUAGE_PACKS } from "../../lib/languages";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function cleanFileName(name = "file") {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  return `${base.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80) || "content"}${ext}`;
}
function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function ContentLab({ language, user, onUploaded, goLibrary }) {
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [textTitle, setTextTitle] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pack = LANGUAGE_PACKS[language] || LANGUAGE_PACKS.zh;

  function chooseFile(nextFile) {
    setMessage(""); setError("");
    if (!nextFile) { setFile(null); return; }
    const ok = nextFile.type?.startsWith("audio/") || nextFile.type?.startsWith("video/") || nextFile.type === "application/pdf";
    if (!ok) { setError("Hỗ trợ audio, video hoặc PDF. Với văn bản, dùng tab Dán văn bản."); return; }
    if (nextFile.size > MAX_UPLOAD_BYTES) { setError("File tối đa 50 MB ở bản hiện tại."); return; }
    setFile(nextFile);
  }

  async function uploadFile() {
    if (!file || !supabase || !user?.id) return;
    setUploading(true); setError(""); setMessage("");
    const safeName = cleanFileName(file.name);
    const storagePath = `${user.id}/${Date.now()}-${safeName}`;
    const mediaType = file.type === "application/pdf" ? "pdf" : file.type.startsWith("video/") ? "video" : "audio";
    try {
      const { error: storageError } = await supabase.storage.from("media").upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from("media_items").insert({
        user_id: user.id, language_code: language, title: file.name.replace(/\.[^.]+$/, ""), file_name: file.name,
        storage_path: storagePath, mime_type: file.type || null, size_bytes: file.size, media_type: mediaType, status: "uploaded"
      });
      if (dbError) { await supabase.storage.from("media").remove([storagePath]); throw dbError; }
      setFile(null); setMessage("Đã thêm vào Thư viện. Bạn có thể mở và tạo bài học AI ngay."); onUploaded?.();
    } catch (err) { setError(err?.message || "Upload thất bại."); }
    finally { setUploading(false); }
  }

  async function saveText() {
    if (!text.trim() || !supabase || !user?.id) return;
    setUploading(true); setError(""); setMessage("");
    try {
      const title = textTitle.trim() || text.trim().slice(0, 45) || "Văn bản";
      const storagePath = `text/${user.id}/${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
      const { error: dbError } = await supabase.from("media_items").insert({
        user_id: user.id, language_code: language, title, file_name: `${title}.txt`, storage_path: storagePath,
        mime_type: "text/plain", size_bytes: new Blob([text]).size, media_type: "text", source_text: text.trim(), status: "uploaded"
      });
      if (dbError) throw dbError;
      setText(""); setTextTitle(""); setMessage("Đã lưu văn bản vào Thư viện."); onUploaded?.();
    } catch (err) { setError(err?.message || "Không lưu được văn bản."); }
    finally { setUploading(false); }
  }

  return <>
    <div className="page-title"><span className="eyebrow">LEARN FROM ANYTHING</span><h2>Học từ nội dung thật</h2><p>Đưa audio, video, PDF hoặc văn bản vào LinguaFlow rồi biến thành bài học {pack.label} có phát âm, nghĩa và từ vựng.</p></div>
    <div className="segmented wide-segment"><button className={mode === "file" ? "selected" : ""} onClick={() => setMode("file")}>🎧 Video / Audio / PDF</button><button className={mode === "text" ? "selected" : ""} onClick={() => setMode("text")}>📝 Dán văn bản</button></div>
    {message && <div className="page-success">{message} <button className="link-inline" onClick={goLibrary}>Mở Thư viện →</button></div>}{error && <div className="page-error">{error}</div>}
    {mode === "file" ? <>
      <label className={`upload-zone ${file ? "has-file" : ""}`}><input type="file" accept="audio/*,video/*,application/pdf" onChange={(e) => chooseFile(e.target.files?.[0])} /><div className="upload-icon">＋</div><h3>{file?.name || "Thả file vào đây hoặc bấm để chọn"}</h3><p>{file ? `${formatBytes(file.size)} · ${file.type || "file"}` : "MP3 · WAV · M4A · MP4 · MOV · WEBM · PDF · tối đa 50 MB"}</p><span className="secondary-btn">{file ? "Đổi file" : "Chọn file"}</span></label>
      {file && <div className="upload-action-row"><div><b>Sẵn sàng upload</b><small>{pack.flag} {pack.label} · {formatBytes(file.size)}</small></div><button className="primary-btn" onClick={uploadFile} disabled={uploading}>{uploading ? "Đang upload..." : "Upload vào Thư viện →"}</button></div>}
    </> : <div className="text-import-card"><label>Tiêu đề<input value={textTitle} onChange={(e)=>setTextTitle(e.target.value)} placeholder="Ví dụ: Email nhà cung cấp" /></label><label>Nội dung<textarea value={text} onChange={(e)=>setText(e.target.value)} rows={12} placeholder={`Dán ${pack.label} vào đây...`} /></label><div className="form-footer"><small>{text.length.toLocaleString("vi-VN")} ký tự</small><button className="primary-btn" onClick={saveText} disabled={uploading || !text.trim()}>{uploading ? "Đang lưu..." : "Lưu và tạo bài học →"}</button></div></div>}
    <div className="feature-grid">{[["01","AI transcript","Đồng bộ lời với audio/video"],["02",pack.annotation,"Phát âm nằm trên từ"],["03","Từ vựng","Click từ để lưu và ôn SRS"],["04","Tài liệu","PDF và text thành bài học"]].map(x=><div className="feature-card" key={x[0]}><span>{x[0]}</span><h4>{x[1]}</h4><p>{x[2]}</p></div>)}</div>
  </>;
}
