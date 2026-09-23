# LinguaFlow 1.0 — Full Core

Bản cập nhật lớn để hạn chế phải thay file nhiều lần. Kiến trúc đa ngôn ngữ từ đầu, hiện bật Chinese, English, Japanese, Korean, Spanish, French và German.

## AI model
- Gemini BYOK.
- Không khóa model ở `gemini-3.5-flash-lite`.
- Chế độ `Auto` ưu tiên alias `gemini-flash-latest`, sau đó tự lấy danh sách model mà API key hiện có quyền dùng và fallback khi 429/503/lỗi tạm thời.
- Trong Cài đặt AI có nút lấy lại danh sách model mới nhất và có thể chọn thủ công model cụ thể.
- API key chỉ giữ trong `sessionStorage`, không ghi vào Supabase/GitHub.

## Chức năng đã gom vào bản này
- Đăng ký / đăng nhập / quên mật khẩu / đăng xuất bằng Supabase.
- 7 language packs: Chinese, English, Japanese, Korean, Spanish, French, German.
- Dashboard theo ngôn ngữ và dữ liệu người dùng.
- Upload audio / video / PDF tối đa 50 MB; import văn bản.
- AI tạo bài học từ nội dung: transcript, timestamp cho audio/video, pronunciation/Pinyin, nghĩa Việt, token có thể click.
- Player đồng bộ transcript, tốc độ phát, bật/tắt pronunciation/dịch, nhảy đến timestamp, xuất SRT.
- Lưu từ và lưu câu vào thư viện.
- Flashcard SRS với Again / Hard / Good / Easy.
- Luyện nghe bằng TTS trình duyệt.
- Luyện nói bằng microphone + AI feedback.
- Luyện đặt câu + AI sửa.
- Sentence Builder và Quiz.
- Luyện viết bằng canvas + AI đánh giá hình dáng (không giả vờ chấm thứ tự nét).
- AI Tutor.
- Khóa học AI theo level và ngành nghề; có thể lưu từ từ lesson.
- Thư viện nội dung / từ / câu và thống kê cơ bản.
- Database/RLS/Storage private trong một file SQL nâng cấp.

## Cập nhật một lần
1. Supabase -> SQL Editor -> New query.
2. Copy toàn bộ `supabase/setup-v1.0.sql` và Run.
3. Upload toàn bộ nội dung của project này lên GitHub repo `linguaflow`, ghi đè file cũ.
4. Commit lên `main`. Vercel tự deploy.
5. Không cần thêm Environment Variables nếu đã có:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
6. Mở web -> Cài đặt AI -> nhập Gemini API Key -> `Kiểm tra & sử dụng`.
7. Giữ Model = `Auto — luôn theo Flash mới nhất`.

## Kiểm thử nhanh
- Đổi Chinese / English / Japanese rồi refresh.
- Upload MP3/MP4 nhỏ -> Thư viện -> Mở -> Tạo bài học AI.
- Click một từ -> lưu -> Luyện tập -> Flashcard.
- Cài đặt AI -> Lấy model mới nhất -> Auto.
- AI Tutor -> hỏi một câu.
- Khóa học -> chọn ngành -> Tạo bài học.
