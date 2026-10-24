# 🌙 Shapi Farm Android — tự động tạo APK từ ZIP

✅ GitHub Actions đã được cài trong repo. **Không cần giải nén ZIP game, không cần Android Studio, không cần cài Gradle.**

## Bro chỉ cần làm một lần

1. **Tải ZIP nguồn Android 3.6 từ ChatGPT** về máy, để nguyên `.zip`.
2. Bấm **Releases** trong repo này, rồi chọn **Draft a new release**.
3. Ô **Choose a tag** → nhập `apk-source-3.6` → chọn **Create new tag**.
4. Ô **Release title** ghi `Hẹn Nhau Dưới Ánh Trăng 3.6 Android`.
5. Trong vùng **Attach binaries**, bấm chọn file ZIP vừa tải, **không giải nén**, đợi file upload xong.
6. Bấm **Publish release**. Workflow **Build Android APK from Game ZIP** tự chạy.
7. Khi GitHub Actions chạy xong, mở lại **Releases → apk-source-3.6 → Assets** và tải **`app-debug.apk`** để cài trên Android.

Chưa thấy file APK? Mở tab **Actions** để xem trạng thái build. Nếu build thành công nhưng không gắn được APK vào Release, tải từ **Artifacts** trong lượt chạy tương ứng (artifact mới cần giải nén một lần). Có thể bấm **Run workflow** để chạy lại bằng tag `apk-source-3.6`.

## Cách hoạt động & lưu ý

- Workflow tự tải ZIP Release, kiểm tra SHA-256 đúng bản game 3.6 đã cung cấp, giải nén trong GitHub runner, kiểm tra đủ **375 assets runtime**, và build **APK debug** bằng Android SDK 35 / Gradle 8.9.
- APK chạy WebView ngang toàn màn hình, giữ server online cho đăng nhập, save, chat và multiplayer.
- APK chứa sẵn ảnh/nhạc, **nhưng chỉ sử dụng assets cục bộ khi website đang chạy có dấu phiên bản `/android-assets-version.txt` trùng với APK**. Nếu không khớp, nó tải qua mạng như web. Việc build APK **không tự cập nhật website**.
- Giảm thời gian tải ảnh không đồng nghĩa với việc FPS tăng; render Canvas vẫn cần được tối ưu nếu Android yếu.
- Đây là **APK debug thử nghiệm**, không phải bản ký phát hành Play Store. **Chưa có kết quả kiểm thử trên thiết bị thật.**
- Repository là **private**. Không upload .env, mật khẩu, secret hoặc keystore.

Các tệp workflow chính: `.github/workflows/build-apk-from-zip.yml`.
