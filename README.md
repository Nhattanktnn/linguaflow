# LinguaFlow V0.4

Bản V0.4 bổ sung AI transcript chạy thật bằng Gemini BYOK.

## Có gì mới
- Gemini API Key được nhập trong Cài đặt AI và chỉ giữ trong bộ nhớ của phiên hiện tại.
- Audio/video tối đa 20 MB có thể tạo transcript AI trên Vercel Free.
- Transcript có timestamp, text, Pinyin/IPA, nghĩa tiếng Việt và token có thể click.
- Player tự highlight đoạn đang phát; click transcript để seek media.
- Click từ trong transcript để lưu vào Vocabulary.

## Cập nhật
1. Upload/ghi đè các file của V0.4 lên GitHub.
2. Chạy `supabase/setup-v0.4.sql` trong Supabase SQL Editor.
3. Chờ Vercel deploy lại.
4. Mở Cài đặt AI -> nhập Gemini API Key -> Kiểm tra & sử dụng.
5. Vào Thư viện -> mở media -> Tạo transcript AI.

Không cần thêm biến môi trường mới cho V0.4.
