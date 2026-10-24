# 🌙 Shapi Farm Android — build APK tự động

Đây là repository **chỉ để build APK**, không chỉnh sửa hay publish website/game server.

## Làm 1 lần, không cần giải nén ZIP

1. Tải file **Hen-Nhau-Duoi-Anh-Trang-3.6-Android-Assets-San-APK(1).zip** trên ChatGPT về máy.
2. Mở **Releases** của repository này → **Draft a new release**.
3. Tag ghi **apk-source-3.6**; tiêu đề ghi **Game 3.6 Android**.
4. Kéo thả **nguyên file .zip** vào mục **Attach binaries by dropping them here or selecting them**. Đợi upload xong.
5. Bấm **Publish release**. GitHub Actions tự build, **không cần bấm Run workflow**.
6. Vào **Actions** → **Build Android APK from Game ZIP** → chọn lượt chạy mới nhất. Khi có dấu ✓ xanh, kéo xuống **Artifacts**, tải **Shapi-Farm-3.6-Android-debug-APK**. Giải nén *gói artifact tải từ GitHub* một lần để lấy **app-debug.apk** cài trên Android. (Không phải giải nén mã nguồn game.)

Nếu không thấy workflow chạy: vào **Actions**, cho phép workflows nếu GitHub hỏi. Có thể kích hoạt lại thủ công với **Run workflow** và release tag **apk-source-3.6**.

### Lưu ý

- APK dùng Android WebView toàn màn hình ngang, lưu sẵn assets từ ZIP; tài khoản/save/multiplayer vẫn dùng server game online.
- **Để assets trong APK thực sự được dùng**, website phải có cùng file `/android-assets-version.txt` với ZIP. Nếu chưa khớp, APK an toàn quay về tải ảnh từ website, nên chưa chắc tăng tốc tải.
- APK debug để thử nghiệm, chưa phải bản phát hành Play Store. Chưa kiểm thử trên điện thoại thật.
- Repository private. Không đưa .env, token hay mật khẩu vào file ZIP.
