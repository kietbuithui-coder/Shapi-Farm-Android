# Nguyên tắc phát triển CAT LEGENDS

Tài liệu làm việc cho dự án một file HTML chạy offline. Đây là tiêu chuẩn đội ngũ đề xuất, không phải chứng nhận của chuyên gia bên ngoài.

1. **Người chơi trước tiên:** điều khiển dễ hiểu, phản hồi rõ, thao tác không mất; ưu tiên cảm ứng và khả năng chơi trên màn hình nhỏ. Bốn ô kỹ năng là cố định; né là hành động riêng.
2. **Chiến đấu công bằng:** sát thương phải khớp mô tả và hiệu ứng; kẻ địch có tín hiệu và thời gian phản ứng. Khống chế boss có giới hạn. Các đòn mạnh có recovery ngắn, vẫn cho di chuyển/né; thao tác skill kế tiếp được xếp hàng có giới hạn và hoàn tài nguyên nếu hủy.
3. **Chiều sâu, không lạm phát:** lựa chọn, nhánh nâng cấp và nhân vật cần có vai trò khác nhau. Tỉ lệ, thời gian và điều kiện kích hoạt phải được ghi rõ; không tuyên bố cân bằng khi chưa đo và chơi thử.
4. **Đáng tin cậy:** không làm hỏng hoặc xóa save hiện có. Một file `index.html` tự chứa, dùng offline sau khi tải, không cần tài nguyên mạng. Bộ nhớ file:// phụ thuộc trình duyệt; cảnh báo khi phát hiện không thể lưu.
5. **Có thể tiếp cận:** hỗ trợ điều khiển chạm, bàn phím và gamepad, hai tay, giảm chuyển động, bố cục theo kích thước và vùng an toàn, tiếng Việt có dấu. Không dựa vào màu sắc một mình để truyền đạt thông tin quan trọng.
6. **Đo được và có thể tái lập:** seed, phiên bản, kịch bản, kết quả và giới hạn phải ghi lại; test mã nguồn và test bundle giao đến người chơi. Test mô phỏng không thay cho người chơi hoặc thiết bị thật.
7. **Thay đổi an toàn:** sửa lỗi có regression test, build lại HTML từ source, chạy test/verify/font; giữ `main` và GitHub Pages nguyên vẹn cho đến khi chủ dự án xác nhận. Không đưa công cụ hoặc file sinh nặng vào Git nếu không cần.
8. **Trung thực:** phân biệt lỗi đã sửa, giả thuyết thiết kế, dữ liệu mô phỏng và việc còn cần kiểm chứng. “Siêu phẩm” là mục tiêu chất lượng, không phải trạng thái có thể xác nhận chỉ bằng test.
