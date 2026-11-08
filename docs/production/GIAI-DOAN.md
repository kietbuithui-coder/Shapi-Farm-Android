# Kế hoạch sản xuất và cổng nghiệm thu

Mục tiêu: nâng chất lượng game hiện có mà không phá tiến trình hoặc thay thế bốn ô kỹ năng. Mỗi giai đoạn có bằng chứng và hạn chế; không giả vờ đã mời chuyên gia hay đã có người chơi thử.

## 0 — Kiểm kê và nền tảng
- [x] Kiểm tra source, bản HTML, hướng dẫn, danh sách tồn đọng và bộ test hiện có.
- [x] Đặt nguyên tắc, phạm vi và cổng nghiệm thu bằng tài liệu này.
- [ ] Đo đường cơ sở trên thiết bị Android/iOS thật (thiết bị chưa có trong môi trường).

## 1 — Độ tin cậy trận đấu
- [x] Sửa và kiểm thử các tồn đọng đã phát hiện: Phép Gai, tính phạm vi hình cung, hút máu và thời gian DoT.
- [x] Kiểm thử tương tác dấu ấn, tiêu diệt, nguồn sát thương và độ dài bước mô phỏng; các bài boss thuộc bộ hồi quy hiện có.
- [x] Giữ FIFO kỹ năng, chuyển động và tiến trình cũ; kiểm bundle giao người chơi.

## 2 — Có thể chơi và tiến triển
- [x] Mô phỏng có seed qua 10 mèo, 3 seed, 2 độ khó; lưu kết quả, không xem bot là người chơi. Chiến thuật do bot hiện tại quyết định; chưa bao phủ mọi build.
- [x] Kiểm đường đi 9 đêm bằng kịch bản có hỗ trợ; có đo các run không hỗ trợ riêng. Không dùng run bất tử để kết luận cân bằng.
- [x] Thêm trận thử riêng cho cả năm boss, không thay chiến dịch hay thưởng tiến trình; kiểm truy cập, thắng/thua và nút thử lại.
- [x] Kiểm vòng lặp nâng cấp/lưu/mở khóa bằng test hiện có và test bundle; vẫn cần playtest để phát hiện lỗi ngoài kịch bản.

## 3 — Trải nghiệm và phát hành
- [x] Kiểm UI dọc/ngang, pause, level-up, thưởng, nút, file offline và lưu qua test tự động; Chromium thật chỉ kiểm một tập con như báo cáo.
- [x] Build HTML tự chứa, so bundle với source, kiểm phông, chạy toàn bộ test và ghi hash.
- [ ] Chơi thử và đo FPS, nhiệt độ, pin, âm thanh, lưu file trên máy thật; kiểm độ dễ hiểu và cân bằng với nhiều người chơi (cần thiết bị/người chơi).

## Hoàn thành thực tế

Mỗi đợt phải có báo cáo ở `BAO-CAO.md`: thay đổi, lệnh và kết quả, những gì chưa thể đo. Chỉ đánh dấu cổng đã kiểm đúng như bằng chứng. Không dùng kết quả tự động hay bot để tuyên bố game đã là “siêu phẩm”.
