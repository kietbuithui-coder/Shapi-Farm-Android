# Kiểm kê và chỉnh skill — kết quả từng phần

**Trạng thái:** đã kiểm kê 54/54 skill rank 1 và xử lý các lỗi được nêu dưới đây. Đây **không phải** bản hoàn thành toàn bộ rework: animation thân mèo riêng cho từng skill, đánh giá toàn bộ rank/tổ hợp, cân bằng endgame và playtest người thật vẫn chưa hoàn thành. Không xóa skill.

## Phương pháp và giới hạn

- Trước chỉnh: mã commit `71fdd3a`; sau chỉnh: mã trong nhánh hiện tại. Chạy `node tools/skill-audit.mjs <đường-dẫn.json>`. Hai tệp [before.json](before.json) và [after.json](after.json) ghi cả 54 skill, params, rank, mô tả, cost, cooldown, range, damage, lần chạm đầu, sát thương trong 1 giây và cả 12 giây, số đích bị gây sát thương, cùng kịch bản đơn/nhóm/elite giả/boss giả/di chuyển.
- Tabby, rank 1, seed 73, crit = 0, bước 1/60 giây; một lần bấm, 12 giây; bia bất tử cách 70px. Nhóm gồm 5 bia quanh người chơi (có bia ở phía sau); chọn mục tiêu và va chạm thật trong engine, có đẩy/kéo. Con số bao gồm DoT và summon phát sinh trong 12 giây nhưng không bao gồm giá trị thủ/khiên/hồi máu/di chuyển. Cùng một seed không thay thế phân bố nhiều seed.
- Cột nhóm = **tổng của các bia**, không phải sát thương trên mỗi bia; số mục tiêu chỉ đếm bia mất máu, không đếm khống chế. Số 0 của skill utility không có nghĩa là vô dụng. Bia có cờ elite/boss không chạy AI boss; thử boss thật trong ma trận riêng, không dùng số bia để kết luận cân bằng boss. Di chuyển là input trái sau khi cast; engine chuẩn hóa input thành chạy hết tốc độ.
- `damage/cd` là tỷ số lý thuyết một cast trên cooldown ghi trong data, không phải DPS vòng đánh, không tính hồi năng lượng, tốc đánh, hit/miss hoặc uptime. Lần chạm đầu là thời gian đo ở bố trí đó; dấu — là không gây damage, không phải thời gian animation. Windup/độ trễ trong bảng là giá trị định nghĩa, không phải clip animation được đo. Chưa có hợp đồng startup/active/recovery riêng cho từng thân mèo.

## Cách dùng ngân sách

Không ép mọi skill bằng DPS. So sánh damage/cast, damage/cd, AoE, khả năng trúng thực tế, chi phí, rủi ro ở gần, và utility. Ví dụ cùng bố trí, đòn cơ bản Vuốt Sắc 9.53/0.34 ≈ 28.03 mỗi giây *lý thuyết* nhưng phải liên tục bấm và đứng gần; Cầu Lửa 34.32/3.2 ≈ 10.73 bao gồm cháy; Bầy Mèo sau chỉnh 136.68/12 ≈ 11.39 trên bia và 75.17/12 ≈ 6.26 trên bia boss. Đây là tham chiếu để phát hiện ngoại lệ chứ không chứng minh công bằng trong run. Thiên Thạch là burst trễ AoE và Tia Trăng là đường thẳng, nên sau sửa lỗi lặp frame chọn 36 và 28.8 damage trên bia, chứ không giữ 54 và 198 do lỗi. Cần kiểm định thời gian trúng, mật độ quái, đầu/cuối game, tốc đánh và cấp skill trước khi coi các tỷ số là ngưỡng cân bằng cuối cùng.

## 54 skill: số liệu và quyết định tạm thời

Sát thương ghi **trước → sau**. `CĐ` là cooldown giây; `NL` là năng lượng; `T` là range khai báo px; `Trễ` là windup/độ trễ khai báo giây; `Trúng đầu` là đo sau chỉnh; `Đích` là số bia nhóm bị damage sau chỉnh. Mô tả/vai trò trong bảng là thiết kế hoặc mô tả khai báo, không khẳng định mọi rank đã chạy đúng. `Giữ tạm` nghĩa là chưa thay riêng, không có nghĩa đã hoàn tất đánh giá. Các skill còn chịu sửa CC và/hoặc tương tác ấn chung.

| Skill / id | Loại; vai trò | CĐ / NL / T | Trễ / trúng đầu | Đơn trước → sau | Nhóm trước → sau / đích | Mô tả, CC khai báo | Quyết định |
|---|---|---:|---:|---:|---:|---|---|
| Vuốt Sắc `claw_slash` | physical; single / frontal | 0.34 / 0 / 86 | 0 / 0 | 9.53 → 9.53 | 26.78 → 26.78 / 3 | Vuốt một đường phía trước. | Giữ tạm; cần đánh giá tiếp. |
| Liên Vuốt `triple_scratch` | physical; AoE sustained | 4.1 / 12 / 140 | 0 / 0.02 | 27.61 → 27.61 | 133.07 → 133.07 / 5 | Ba nhát quét diện rộng quanh mèo, áp dụng hiệu ứng đòn đánh. | Giữ tạm; cần đánh giá tiếp. |
| Vồ Mồi `pounce` | mobility; mobility / hybrid | 4.5 / 20 / 170 | 0 / 0.02 | 10.96 → 10.96 | 10.01 → 10.01 / 1 | Lao tới, húc văng kẻ địch trên đường. (knock:180) | Giữ tạm; cần đánh giá tiếp. |
| Vuốt Xoáy `whirling_claws` | aoe; AoE / control | 5 / 28 / 118 | 0 / 0.02 | 12.39 → 12.39 | 57.43 → 57.43 / 5 | Xoay người, chém mọi thứ quanh mình. (knock:150) | Giữ tạm; cần đánh giá tiếp. |
| Cắn Tàn Bạo `brutal_bite` | physical; single / frontal | 3.4 / 22 / 84 | 0 / 0 | 37.32 → 37.32 | 108.88 → 108.88 / 3 | Cú cắn nặng khiến mục tiêu chảy máu. | Giữ tạm; cần đánh giá tiếp. |
| Đâm Bóng `shadow_strike` | physical; reposition / single | 6 / 26 / 260 | 0 / 0 | 18 → 18 | 18 → 18 / 1 | Lướt sau lưng mục tiêu và đâm hiểm. | Giữ tạm; cần đánh giá tiếp. |
| Sóng Vuốt `rending_wave` | physical; line projectile | 6.5 / 30 / 300 | 0.25 / 0.33 | 15.25 → 15.25 | 13.93 → 13.93 / 1 | Một nhát chém phóng ra thành sóng xung kích. | Giữ tạm; cần đánh giá tiếp. |
| Đao Phủ `executioner` | physical; single / execute | 9 / 34 / 92 | 0.25 / 0.27 | 21.6 → 21.6 | 21.6 → 21.6 / 1 | Xử tử mục tiêu máu thấp, nếu không thì chém mạnh. | Giữ tạm; cần đánh giá tiếp. |
| Bước Ma `phantom_step` | mobility; mobility | 5.5 / 18 / 200 | 1 / — | 0 → 0 | 0 → 0 / 0 | Tạo bóng ma tại điểm đến, dịch chuyển sau 1 giây. | Giữ tạm; cần đánh giá tiếp. |
| Vuốt Ảo Ảnh `arcane_paw` | magic; single / projectile | 0.52 / 0 / 420 | 0 / 0.1 | 9.53 → 9.53 | 0 → 0 / 0 | Bắn một dấu chân phép hướng về mục tiêu. | Giữ tạm; cần đánh giá tiếp. |
| Cầu Lửa `fireball` | magic; single / projectile | 3.2 / 26 / 400 | 0 / 0.13 | 34.32 → 34.32 | 67.18 → 67.18 / 3 | Cầu lửa phát nổ và gây cháy nhẹ trong 3 giây. | Giữ tạm; cần đánh giá tiếp. |
| Băng Tân `frost_nova` | control; AoE / control | 7 / 30 / 150 | 0 / 0.02 | 7.39 → 7.39 | 34.26 → 34.26 / 5 | Sóng băng làm chậm và đóng băng kẻ địch. (slow:0.45, slowTime:2.6, freeze:0.6) | Rank 3 dùng thời lượng đóng băng mới; CC theo loại địch. |
| Sấm Gừ Gừ `thunder_purr` | magic; chain / multi | 5.5 / 28 / 300 | 0 / 0 | 10.35 → 10.35 | 19.46 → 19.46 / 2 | Tia sét nhảy giữa các mục tiêu gần nhau. | Giữ tạm; cần đánh giá tiếp. |
| Thiên Thạch Mèo `meteor_paw` | aoe; delayed burst / AoE | 10 / 40 / 340 | 0.7 / 0.7 | 54 → 36 | 54 → 36 / 1 | Gọi một thiên thạch rơi xuống điểm chỉ định. | Sửa sát thương lặp theo frame; multiplier 3→4 để bù sau khi chỉ nổ một lần. |
| Tia Trăng `lunar_beam` | magic; line burst | 9 / 38 / 420 | 0.18 / 0.18 | 198 → 28.8 | 198 → 28.8 / 1 | Chùm sáng trăng xuyên thẳng hàng địch. | Sửa sát thương lặp theo frame; multiplier 2.2→3.2; rank 4 làm chậm. |
| Miệng Hố Đen `void_maw` | magic; AoE / pull | 14 / 52 / 320 | 0.25 / 1.27 | 32.76 → 32.76 | 163.8 → 163.8 / 5 | Mở hố đen hút kẻ địch vào rồi nuốt chửng. (pullTime:1) | Boss và miniboss miễn kéo; vẫn chịu vụ nổ nếu ở trong vùng. |
| Ấn Nguyền `hex_brand` | utility; utility / synergy | 8 / 20 / 360 | 0 / — | 0 → 0 | 0 → 0 / 0 | Đóng ấn lên mục tiêu: nó nhận thêm sát thương. | Không còn nhân sát thương đòn cận chiến/đạn hai lần. |
| Giếng Trọng Lực `gravity_well` | control; sustained / control | 9 / 32 / 320 | 0.25 / — | 0 → 0 | 0 → 0 / 0 | Vùng không gian níu chân mọi kẻ địch bên trong. (slow:0.6) | Giữ tạm; cần đánh giá tiếp. |
| Đại Bác Búi Lông `hairball_cannon` | projectile; single / projectile | 2.2 / 16 / 340 | 0 / 0.12 | 11.91 → 11.91 | 10.88 → 10.88 / 1 | Phun loạt búi lông nặng. (knock:120) | Đạn áp dụng lực đẩy đã khai báo. |
| Cuộn Len Phép `magic_yarn` | projectile; projectile / hybrid | 4.4 / 22 / 300 | 0 / 0.12 | 12.39 → 23.65 | 11.32 → 22.48 / 1 | Cuộn len bay đi rồi quay lại, trói kẻ địch. | Trúng một lần mỗi lượt đi/về; dùng quãng bay khai báo. |
| Vuốt Hồi Lực `paw_boomerang` | projectile; projectile / hybrid | 4.8 / 24 / 330 | 0 / 0.12 | 13.82 → 26.38 | 12.62 → 25.08 / 1 | Chiếc vuốt phép xoay về phía bạn, cắt cả đường về. | Trúng một lần mỗi lượt đi/về; dùng quãng bay khai báo. |
| Cầu Hồn `spirit_orbs` | projectile; sustained / summon | 8 / 30 / 120 | 0.25 / 0.28 | 70.2 → 70.2 | 222.3 → 222.3 / 4 | Ba linh cầu xoay quanh bạn, tự đâm kẻ lại gần. | Giữ tạm; cần đánh giá tiếp. |
| Mưa Kim `needle_barrage` | projectile; sustained / projectile | 4.6 / 26 / 380 | 0 / 0.1 | 25.26 → 25.26 | 24.73 → 24.73 / 1 | Xả một loạt kim nhỏ về phía mục tiêu. | Giữ tạm; cần đánh giá tiếp. |
| Mưa Sao `starfall_volley` | projectile; delayed AoE | 9.5 / 36 / 360 | 0.9 / — | 0 → 0 | 27 → 27 / 3 | Gọi một chùm sao rơi xuống quanh khu vực. | Mỗi sao chỉ nổ một lần thay vì phụ thuộc frame. |
| Bầy Mèo Con `kitten_army` | summon; summon | 12 / 34 / 260 | 0.25 / 0.28 | 207.09 → 136.68 | 207.09 → 136.68 / 2 | Triệu hồi ba mèo con lao vào kẻ địch. | Giảm hệ số mỗi mèo 0.50→0.33; giữ ba mèo và thời gian tồn tại. |
| Linh Miêu `spirit_cat` | summon; summon | 16 / 42 / 260 | 0.25 / 0.28 | 58.41 → 58.41 | 58.41 → 58.41 / 1 | Một linh miêu lớn chiến đấu bên bạn. | Giữ tạm; cần đánh giá tiếp. |
| Sư Tử Hộ Mệnh `guardian_lion` | summon; summon | 18 / 44 / 220 | 0.25 / 0.28 | 51.37 → 52.04 | 260.59 → 260.19 / 5 | Sư tử đá đứng chắn và đè bẹp kẻ địch. | Đòn diện rộng dùng nguồn triệu hồi và kháng summon của boss. |
| Vuốt Ma `ghost_paw` | summon; sustained / summon | 9 / 26 / 110 | 0 / 0.02 | 26.55 → 26.55 | 53.1 → 53.1 / 2 | Những bàn chân ma xoay quanh bạn và tự chém. | Giữ tạm; cần đánh giá tiếp. |
| Đất Rách `rending_ground` | aoe; sustained / control | 8 / 28 / 260 | 0 / 0.02 | 29.86 → 29.86 | 29.86 → 29.86 / 1 | Xé mặt đất thành vùng gai nhọn. (slow:0) | Giữ tạm; cần đánh giá tiếp. |
| Bạc Hà Điên `catnip_frenzy` | utility; utility / defensive | 14 / 18 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Tăng tốc đánh và tốc chạy, nhưng nhận thêm sát thương. | Giữ tạm; cần đánh giá tiếp. |
| Bẫy Trăng `moonlit_trap` | utility; control / trap | 7 / 24 / 220 | 0 / — | 0 → 0 | 0 → 0 / 0 | Đặt bẫy sáng: kẻ chạm vào bị trói và lộ vị trí. (root:1.2) | Giữ tạm; cần đánh giá tiếp. |
| Chín Mạng `nine_lives` | defense; defensive | 22 / 30 / 0 | 0.25 / — | 0 → 0 | 0 → 0 / 0 | Lá chắn giữ lại mạng bạn trong một đòn chí tử. | Giữ tạm; cần đánh giá tiếp. |
| Lông Sắt `iron_fur` | defense; utility / defensive | 12 / 20 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Lông cứng như thép trong thời gian ngắn. | Giữ tạm; cần đánh giá tiếp. |
| Khiên Gừ `purr_shield` | defense; defensive | 10 / 24 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Tiếng gừ tạo khiên hấp thụ sát thương. | Giữ tạm; cần đánh giá tiếp. |
| Vuốt Phản Chiến `reflective_claws` | defense; utility / defensive | 13 / 26 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Mỗi đòn nhận vào bị đáp trả gấp đôi. | Giữ tạm; cần đánh giá tiếp. |
| Hào Quang Hộ Vệ `guardian_aura` | defense; defensive / sustain | 16 / 32 / 110 | 0.25 / — | 0 → 0 | 0 → 0 / 0 | Vùng ấm áp quanh bạn giảm sát thương và hồi máu. | Giữ tạm; cần đánh giá tiếp. |
| Thế Đá `stone_stance` | defense; utility / defensive | 14 / 22 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Đứng vững như tượng: miễn đẩy lùi, giảm sát thương. (root:True) | Giữ tạm; cần đánh giá tiếp. |
| Gừ Chữa Lành `healing_purr` | heal; healing / utility | 9 / 26 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Tiếng gừ hồi máu tức thời và thêm theo thời gian. | Giữ tạm; cần đánh giá tiếp. |
| Hút Sinh Lực `life_drain` | heal; single / healing | 8 / 24 / 220 | 0 / 0 | 16.99 → 16.99 | 16.99 → 16.99 / 1 | Rút máu mục tiêu chuyển thành của bạn. | Giữ tạm; cần đánh giá tiếp. |
| Nanh Máu `blood_fang` | physical; single / frontal | 5 / 20 / 80 | 0 / 0 | 14.29 → 14.29 | 13.06 → 13.06 / 1 | Nhát cắn hút máu và cộng dồn chảy máu. | Giữ tạm; cần đánh giá tiếp. |
| Chân May Mắn `lucky_paw` | utility; utility / defensive | 15 / 18 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Vận may tăng chí mạng và may mắn rơi đồ. | Giữ tạm; cần đánh giá tiếp. |
| Bánh Năng Lượng `mana_snack` | utility; healing / utility | 16 / 0 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Ăn một miếng, hồi ngay năng lượng. | Giữ tạm; cần đánh giá tiếp. |
| Lông Thời Gian `time_fur` | control; crowd control | 20 / 48 / 220 | 0.25 / — | 0 → 0 | 0 → 0 / 0 | Bẻ cong thời gian: kẻ địch gần như đứng hình. (slow:0.5) | Giữ tạm; cần đánh giá tiếp. |
| Màn Đêm `night_veil` | utility; utility / defensive | 13 / 22 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Kẻ địch mất dấu bạn; đòn kế tiếp chí mạng. | Giữ tạm; cần đánh giá tiếp. |
| Vuốt Gương `mirror_paw` | defense; defensive | 12 / 28 / 0 | 0.25 / — | 0 → 0 | 0 → 0 / 0 | Lá chắn gương phản lại đòn tấn công tầm xa. | Giữ tạm; cần đánh giá tiếp. |
| Chạy Gió `wind_sprint` | mobility; utility / defensive | 7 / 14 / 0 | 0 / — | 0 → 0 | 0 → 0 / 0 | Bứt tốc và lướt qua đòn đánh. | Giữ tạm; cần đánh giá tiếp. |
| Vuốt Dịch Chuyển `blink_paw` | mobility; mobility | 6 / 16 / 230 | 0 / — | 0 → 0 | 0 → 0 / 0 | Búng tay, đổi chỗ với ảo ảnh ban nãy. | Giữ tạm; cần đánh giá tiếp. |
| Nhảy Đôi `double_leap` | mobility; mobility / hybrid | 6 / 18 / 150 | 0 / 0 | 8.58 → 8.58 | 24.11 → 24.11 / 3 | Hai cú nhảy dài, cắt ngang đội hình địch. (knock:90) | Giữ tạm; cần đánh giá tiếp. |
| Bước Sấm `thunder_step` | mobility; mobility / hybrid | 8 / 30 / 210 | 0.25 / 0.27 | 14.29 → 14.29 | 40.18 → 40.18 / 3 | Lao đi trong tia điện, đốt cháy kẻ trên đường. (knock:60) | Giữ tạm; cần đánh giá tiếp. |
| Trăng Máu `blood_moon` | aoe; AoE / control | 18 / 46 / 200 | 0.25 / 0.28 | 18.11 → 18.11 | 83.93 → 83.93 / 5 | Mặt trăng máu mọc lên: kẻ địch xung quanh mất máu. (knock:120) | Giữ tạm; cần đánh giá tiếp. |
| Hút Linh Hồn `soul_siphon` | summon; execute / sustain | 11 / 28 / 260 | 0 / 0 | 23.36 → 23.36 | 23.36 → 23.36 / 1 | Diệt một mục tiêu yếu để hồi máu và cộng dồn sức mạnh. | Giữ tạm; cần đánh giá tiếp. |
| Lửa Quỹ Đạo `blaze_orbit` | aoe; sustained / summon | 10 / 34 / 100 | 0.25 / 0.28 | 57.6 → 57.6 | 158.4 → 158.4 / 3 | Ba quả cầu lửa quay quanh, đốt mọi thứ. | Giữ tạm; cần đánh giá tiếp. |
| Vỏ Chuối Phản Chủ `banana_peel` | control; control / trap | 5 / 12 / 130 | 0 / 0.02 | 11.97 → 11.97 | 11.97 → 11.97 / 1 | Thả vỏ chuối làm địch trượt chân và choáng. (root:1.2) | Giữ tạm; cần đánh giá tiếp. |
| Cá Bay Tới Công Chuyện `flying_fish` | projectile; single / knockback | 3 / 14 / 360 | 0 / 0.13 | 14.29 → 14.29 | 13.06 → 13.06 / 1 | Ném cá vào mặt địch, gây sát thương và đẩy lùi. | Giữ tạm; cần đánh giá tiếp. |

## Sửa cơ chế đã kiểm chứng

- Thiên Thạch, mỗi sao và các loại telegraph chỉ xử lý một lần ngay khi hết delay, không lệ thuộc frame; tia địch đánh người chơi, không gây friendly fire lên quái. Test cả timestep 1/60 và 0.08 giây.
- Ấn được tính một lần trên hit cận chiến và đạn. Sư tử gây damage như summon, không kích hoạt sai nâng cấp on-hit; đám mèo giảm riêng, không giảm đồng loạt summon.
- Đường đi/về của Cuộn Len và Vuốt Hồi Lực có thể trúng mỗi mục tiêu một lần mỗi lượt, dùng quãng bay khai báo. Đại Bác Búi Lông đẩy lùi; Băng Tân rank 3 kéo dài đóng băng; Tia Trăng rank 4 làm chậm. Đây là sửa đúng hành vi mô tả, chưa phải animation độc lập.
- Thường giữ thời lượng CC; elite: stun/trói 65% và slow tối đa 60%; miniboss: hard CC tối đa 0.45s, lockout chung 1.5s, slow tối đa 45%; boss: hard CC tối đa 0.30s, lockout chung 2s, slow tối đa 35%. Slow còn giảm thời lượng trên elite/miniboss/boss. Root ngăn di chuyển boss nhưng không ngắt tấn công; stun ngắt ngắn. Boss/miniboss miễn hất/kéo Miệng Hố Đen. Boss tiếp tục xử lý trạng thái và có thể tấn công sau khi bị spam CC. Chưa có giao diện báo miễn nhiễm chuyên biệt.

## Trùng lặp và tồn đọng cần rework

- Vuốt Xoáy/Băng Tân/Trăng Máu cùng dùng nova tròn; phân biệt bằng CC/damage hiện có nhưng hình thể động tác và nhịp chưa riêng. Trăng Máu khai báo hai vòng/chảy máu ở rank đầu nhưng nhánh nova chưa thực hiện đủ các mô tả đó.
- Cuộn Len/Vuốt Hồi Lực đều là đạn hồi; sửa đúng hai lượt nhưng vẫn cần quyết định bản sắc khác biệt hơn, nhất là ở rank 1. Nhóm đạn phép, búi lông, cầu lửa và cá dùng chung cơ sở bắn; có công dụng đẩy/cháy nhưng animation thân mèo vẫn dùng chung.
- Hai nhánh lướt Nhảy Đôi/Bước Sấm chưa có swept hitbox như Vồ Mồi: damage đang xảy ra tại điểm đầu, chưa thực sự đánh dọc đường đi. Các dòng mô tả đường lướt cần rework và test trước khi coi là hoàn tất.
- Vuốt Gương khai báo phản đạn nhưng cờ `reflectProjectiles` chưa được xử lý; Giếng Trọng Lực rank 3 lưu lực kéo mà zone thường chưa áp dụng; Linh Miêu rank 4 lưu `ranged` và Sư Tử rank 3 lưu `taunt` nhưng AI summon chưa dùng. Phải triển khai và test riêng, không đánh dấu đã xong.
- Một số mô tả nâng cấp còn chưa có đường thực thi rõ: ví dụ Băng Tân rank 5 mảnh băng, Búi Lông rank 4 nảy tường, Cuộn Len rank 5 vệt nổ, Thiết Giáp rank 5 hồi khi trúng đòn, Hồi Máu rank 5 giải hiệu ứng. Đây là ví dụ đã rà mã, không phải danh sách đầy đủ hay xác nhận mọi rank còn lại hoạt động.
- Cần audit và kiểm thử tất cả rank 2–5, nhánh nâng cấp, charge/echo, build/full run, mục tiêu di chuyển, mọi boss và elite, utility/khả năng sống sót và tất cả combo. Các skill được ghi giữ tạm không phải kết luận cân bằng; chưa có test tương tác hai skill theo mọi cặp. Không có playtest tay/đo cảm giác, không có animation riêng khi tắt VFX; cần thiết kế silhouette/startup/active/recovery và đánh giá trên thiết bị trước khi tuyên bố hoàn thành.

## Tham khảo thiết kế, không sao chép

- LoL: ưu tiên đòn có tín hiệu và cơ hội phản ứng [1](https://www.polygon.com/2013/4/1/4162866/riot-games-designer-counterplay-teamplay-essential-to-multiplayer/). Lost Ark: phân biệt khả năng khống chế đối với boss/khả năng chống đẩy [2](https://upcomer.com/lost-arks-combat-system-explained/). Diablo IV: sức mạnh, cost và cooldown cần gắn với độ rõ của hiệu ứng [3](https://gamingtrend.com/news/new-blog-detailing-diablo-iv-game-systems-and-itemization-has-been-posted-to-blizzards-website/).
- PoE2: các hiệu ứng có thể tạo kết hợp chứ không chỉ cộng damage [4](https://www.destructoid.com/interview-path-of-exile-2-game-director-details-end-game-and-more/). Warframe: thay đổi Banshee nêu rõ vấn đề ragdoll gây khó nhắm weak point và cách cải thiện synergy [5](https://wiki.warframe.com/w/Update_44:_Iceblade_of_Narin). Monster Hunter dùng cam kết theo động tác và các bộ vũ khí có nhịp khác nhau [6](https://en.wikipedia.org/wiki/Monster_Hunter). Đây là hướng tham khảo cho công việc còn lại, không có nghĩa các animation/tương tác tương ứng đã được làm.

## Kiểm thử

- Ma trận tự động 54 skill × 7 kịch bản: một bia, 5 bia, elite dùng enemy thật, boss Moon Devourer thật, di chuyển, cast lại sau hồi tự nhiên, và ghép một skill khác. Đây là smoke/invariant (cast được, state và tọa độ hữu hạn), không khẳng định từng hiệu ứng/độ hiệu quả đúng.
- Test tập trung cho sát thương frame-independent, ấn, kháng summon, đạn hai lượt, knockback, rank frost/lunar, CC thường/elite/boss, boss thật bị spam CC và tia boss. Test hồi quy boss/skill hiện có tiếp tục chạy.
- `npm run build:web`: thành công, tạo index.html self-contained 597 KB. `npm run verify`: đạt. `npm test`: 245/245 đạt. `git diff --check`: đạt. Không có playtest thủ công.
