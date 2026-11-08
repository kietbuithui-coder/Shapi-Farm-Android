# Báo cáo phát triển và giới hạn

## Phạm vi

Đây là một đợt nâng chất lượng có kiểm chứng, **không phải xác nhận game đã hoàn chỉnh hay là “siêu phẩm”**. Không có chuyên gia bên ngoài hoặc người chơi được mời. Các vai trò thiết kế, kỹ thuật, QA được áp dụng như phương pháp rà soát. Cổng nghiệm thu còn mở ở `GIAI-DOAN.md`.

## Đã thực hiện

- Ghi nguyên tắc và kế hoạch theo giai đoạn; giữ đúng 4 skill, nút né riêng, recovery ngắn và FIFO. Không đổi `main` hay GitHub Pages.
- **Phép Gai:** trước đó nâng cấp không có tác dụng. Một đòn kỹ năng trực tiếp gây thêm 20% mỗi lần chọn trong 2 giây; chỉ giữ hiệu ứng mạnh nhất và làm mới thời gian. Sát thương được chốt sau khuếch đại, không nhân ấn lần hai, không gây hiệu ứng on-hit/hút máu đệ quy. Có pip trạng thái. Các nguồn phụ (triệu hồi, nổ lan, tick, phản đòn) không tự gây hiệu ứng này.
- **Phạm vi:** các đòn cung, combo, nova và dịch chuyển dùng bán kính đã scale đúng một lần, khớp hiệu ứng; vụ nổ hạ gục và đòn triệu hồi không vô tình nhận thêm phạm vi kỹ năng. DoT độc dừng đúng phần thời gian còn lại.
- **Hồi phục:** hút máu thụ động tính sau khuếch đại theo lượng máu địch thực mất, không hút trên phần overkill. Phần thưởng máu tối đa không đẩy HP vượt trần. Hào Quang Hút chỉ hồi nếu địch chết trong phạm vi 180 như mô tả cập nhật.
- **Nâng cấp trong trận:** Lưỡi Sắc và Nanh Thủy Tinh nay tăng chỉ số sát thương thực; Nhịp Rỉ Máu hoạt động trên mỗi 4 đòn kỹ năng trực tiếp và tăng sức mạnh thay vì tăng sai khoảng cách; Lớp Da Thứ Hai giữ chu kỳ 20 giây qua nhiều lần chọn; Bật Nảy và Đâm Sau Lưng có tác dụng trên đòn trực tiếp, không nảy vô hạn. Sửa mô tả để nêu đúng phạm vi áp dụng. Đây là quyết định cơ chế mới, **chưa được xác nhận cân bằng**.
- **Thẻ nâng cấp:** thay phép chọn làm độ hiếm bị đảo bằng chọn có trọng số không trùng: common 100, rare 46, epic 17, mythic 5; cùng thẻ hợp build ×1,25. Test thống kê và seed/cap. **Thay đổi này ảnh hưởng đáng kể độ sâu bot; cần cân bằng/playtest trước phát hành rộng** (xem bảng).
- **Điều khiển:** Esc/P và nút Start/Select gamepad có thể vừa tạm dừng vừa tiếp tục, không nhận đòn khi đang pause; không chặn màn thưởng. Bot dùng năng lượng thật và lệnh né bình thường thay vì kiểm nhầm năng lượng trên player; sửa nhánh tìm máu, xử lý loadout rỗng.
- Sửa README mô tả đòn đánh thủ công, 54 kỹ năng và vị trí AUTO. Tài liệu audit cũ được đánh dấu ở phần đã sửa.

## Dữ liệu đo có thể lặp

Công cụ `node tools/production-sweep.mjs --output ketqua.json`: 10 mèo × seed 3, 11, 29 × 2 độ khó, bot dùng bộ khởi đầu, không perk, bước 1/60 giây, giới hạn 1.200 giây mô phỏng/run; tự chọn thẻ và thưởng. Depth = `(đêm − 1) × 5 + wave`. Một run còn `fight` ở giới hạn là **bị cắt thời gian**, không phải thắng hay thua; trung bình depth vì thế không phản ánh tỷ lệ thắng thật. Không dùng số này thay cho người chơi.

| Bộ đo | Độ khó | Trung bình depth | Trung vị depth | Thua / còn chạy / thắng | Đêm xa nhất |
|---|---|---:|---:|---:|---:|
| Trước, commit `57a6293` | Thường | 10,80 | 4 | 25 / 5 / 0 | 7 |
| Trước, commit `57a6293` | Khó | 9,27 | 4 | 25 / 5 / 0 | 7 |
| Sau, mã đợt này | Thường | 5,30 | 4 | 29 / 1 / 0 | 7 |
| Sau, mã đợt này | Khó | 4,73 | 4 | 30 / 0 / 0 | 7 |

Không có lỗi invariant được công cụ ghi nhận trong 120 run này. Kết quả sau **xấu hơn đáng kể ở trung bình depth**, không thể kết luận game dễ hay khó đối với người thật vì cả AI, nâng cấp và phân phối thẻ đều đổi, mẫu nhỏ và bị cắt thời gian. Thử nghiệm tách biến: giữ mã sau nhưng khôi phục cách chọn thẻ cũ cho depth trung bình 8,57/8,20; thử trọng số 100/80/45/20 cho 5,97/5,17 (thường/khó). Đây là dữ liệu quan sát, không chứng minh nguyên nhân duy nhất. Bản hiện tại giữ trọng số 100/46/17/5 để độ hiếm không bị đảo; **đây là rủi ro cân bằng cần đánh giá trước phát hành rộng**, không coi là tối ưu.

Dữ liệu từng run: `bot-truoc.json`, `bot-sau.json`, `bot-doi-chieu-tile-cu.json`, `bot-thu-tile-moi.json`. Hai tệp đối chiếu được chạy trên bản sao tạm, chỉ thay thuật toán/chỉ số chọn thẻ; không có trong game phát hành. Bot có thể yếu hoặc bỏ sót chiến thuật, đặc biệt ở wave miniboss.

`node tools/production-sweep.mjs --assisted`: Tabby seed 3 đạt victory đêm 9 wave 5, hạ 9 boss, 704 kills sau 570,2 giây mô phỏng (`chin-dem-ho-tro.json`). Kịch bản **tự đặt bất tử, hồi tài nguyên và tăng tấn công lên ít nhất 4.000 mỗi bước** để kiểm luồng wave/boss/thưởng tới kết thúc. Không có run bot thường nào ở trên thắng; kết quả hỗ trợ không chứng minh có thể thắng với nhân vật bình thường hay cân bằng.

## Kiểm thử bản giao

- `npm test`: **518/518** đạt, bao gồm source, 54 skill smoke, input, save, mobile, chọn thẻ, các sửa cơ chế mới, bundle HTML và đường đi 9 đêm có hỗ trợ.
- `npm run build:web`, `npm run verify`, `node tools/verify-fonts.mjs`, `git diff --check`: đạt. Bundle test so JavaScript nhúng với source. `index.html` 639 KB, self-contained; SHA-256: `f251cffa27b8cd7977b5139ed79e7089809ba9a63752655678a096de3f27df69`.
- Chromium headless thật, truy cập `file://` và bật offline, không nhận request HTTP(S): mô phỏng 840×380 và 390×844, DPR 2; vào game bằng chạm, 4 nút skill, đa chạm di chuyển + skill + né, pause/resume, chọn level-up, lưu và reload trong cùng context. Chromium desktop: Esc pause/resume. Không có exception trang được ghi nhận. Môi trường browser giả lập **không phải điện thoại thật**, không chứng minh lưu qua lần mở sau trên mọi trình duyệt file://.

### Công cụ Chromium tùy chọn (Linux)

Không cần cho người chơi; binary không đưa vào Git. Trong môi trường đã dùng Node 22 và các gói được tải từ npm. Lệnh tái tạo, nếu chưa có các thư viện hệ thống NSS:

```sh
npm ci
npm install --no-save --package-lock=false @napi-rs/canvas@0.1.80 playwright-core@1.57.0 @sparticuz/chromium@143.0.4
mkdir -p /tmp/chromium-deps
node -e "const z=require('zlib'),f=require('fs');f.writeFileSync('/tmp/al2023.tar',z.brotliDecompressSync(f.readFileSync('node_modules/@sparticuz/chromium/bin/al2023.tar.br')))"
tar -xf /tmp/al2023.tar -C /tmp/chromium-deps
LD_LIBRARY_PATH=/tmp/chromium-deps/lib node tools/browser-qa.mjs
```

Công cụ không tắt bảo vệ same-origin. `npm ci` khôi phục chính xác package-lock của dự án. Tùy nền tảng có thể cần thêm thư viện hệ thống hoặc dùng trình duyệt cài sẵn.

## Việc còn chặn kết luận hoàn thành

1. Kiểm thử có người chơi, nhiều cấp kỹ năng/cat/build, các boss, độ khó và nhánh nâng cấp; đặc biệt kiểm chứng tụt depth sau sửa tỉ lệ thẻ, chỉnh cân bằng dựa trên trải nghiệm và kết quả đủ mẫu.
2. Đo FPS, nhiệt độ, pin, âm thanh, đa chạm, fullscreen, safe area, lưu và khôi phục file trên thiết bị Android/iOS thật và các trình duyệt mục tiêu.
3. Audit mô tả và hiệu ứng của toàn bộ nâng cấp/skill rank 2–5, tương tác chéo, khả năng đọc giao tranh và khả năng tiếp cận; `piercing_mind` chẳng hạn chưa được chứng minh tác động lên mọi loại đạn kỹ năng. Kiểm chất lượng art/animation bằng người, không chỉ test silhouette.
4. Đánh giá tích lũy phần thưởng, hệ kinh tế, nhịp 9 đêm, và khả năng hoàn thành không dùng trợ giúp trên nhiều seed/build; cải tiến bot chỉ để hỗ trợ đo, không dùng bot làm thước đo duy nhất.
5. **Nội dung boss chưa đến được:** chiến dịch luôn kết thúc sau đêm 9; Void Predator và Crystal Queen chỉ nằm trong bảng xoay từ đêm 13–14 nên không thể gặp qua luồng chơi hiện tại. Hai boss có test AI riêng nhưng chưa có chế độ chơi tiếp/đấu thử; cần quyết định thiết kế và giao diện trước khi công bố là đã hoàn tất nội dung.
