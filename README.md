# LinguaFlow V0.4.1

Bản vá lỗi Gemini 503 / high demand.

## Thay đổi
- Chuyển model chính sang `gemini-3.8-flash`.
- Tự retry khi Gemini trả 408/429/5xx.
- Nếu model chính quá tải, tự chuyển sang `gemini-3.5-flash-lite`.
- Không còn hiện nguyên JSON lỗi 503 cho người dùng; thay bằng thông báo dễ hiểu.
- Hiển thị model đã tạo transcript khi thành công.

## Cập nhật
Chỉ cần ghi đè các file trong gói update lên GitHub rồi commit. Không cần chạy SQL mới và không cần thêm biến môi trường.
