# ADVANCED VOXEL WEB GAME — HỒ SƠ CHUYỂN TIẾP

## 1. Mục tiêu
Game voxel web/mobile tự phát triển bằng HTML5, CSS3, JavaScript ES6+, Three.js r128 và GLTFLoader; chạy trên Spck Editor/mobile browser. Thế giới là một hành tinh khác, không phải Trái Đất. Mọi code, texture, model, UI và asset phải nguyên bản, không sao chép Minecraft hay game khác.

## 2. File lõi
- index.html
- game.js
- mod.js
- player.js
- world.js
- texture.js
- loader.js
- upgrade.js
- features.js
- collision.js
- player.glb
- Titanium Warden.glb
- Titan Ravage.glb

## 3. World
Chunk 32×32. Tối ưu bằng hidden-face culling, frustum culling, greedy meshing khi phù hợp, chỉ cập nhật chunk bị ảnh hưởng. Tải theo giai đoạn: chunk dưới chân → 4 xung quanh → 8 → 16. Không spawn mob trong chunk chưa tải.

### Các lớp đá
1. Titanite: nền/bề mặt, có ít Vật Chất Tối.
2. Titanite Đen: tối hơn, cứng hơn, không khoáng sản.
3. Titanite Huyết: hơi đỏ, cứng hơn, độ sáng thấp, bắt đầu có khoáng sản.
4. Titanite Nham: đá kiểu dung nham/igneous, độ cứng bằng Titanite Huyết, có khoáng sản riêng.
5. Titanite Vĩnh Hằng: không thể phá, không khoáng sản; dưới là Void.

### Dimension
`main` và `serpent_void`, lưu qua `localStorage` bằng `advanced_voxel_dimension`. Serpent Void gần như toàn Void, chỉ có các cột đá lớn nối nhau, uốn lượn như rắn. Space Gate chuyển main ↔ serpent_void.

## 4. Titan Vault
Block 1×1×1, thiết kế Titanite/kim loại tối, khe khóa dọc và panel trượt. SpawnChance 0.0015, thưa và có khoảng cách tối thiểu.
Loot một lần roll:
- Drill I 10%
- Drill II 6%
- Drill III 5%
- Drill IV 4%
- Công cụ Titanite Đen 7%
- Tinh thể Hộ vệ Titan 2%
- Vật Chất Tối 25%
- Bình oxy 30%
- Linh kiện 10%
- Viên đá không gian 0.5%
- Bùa thế mạng 0.5%

## 5. Crafting / item
6 Linh kiện → Máy chế tạo.
4 Vật Chất Tối + 1 Viên đá không gian + 6 Khối Titanite Huyết → Cổng không gian.
Stack mặc định 256. Ngoại lệ: Bùa thế mạng 16, Bình oxy 16, Hình nhân thế mạng 16, Máy chế tạo 256, Cổng không gian 256, Titan Vault 256, drill/tool 1, Kiếm Quy Tinh 1.
Bình oxy hồi 30% oxygen. Bùa thế mạng stack 16, không cần cầm; khi đáng lẽ mất mạng thì tiêu thụ, hồi đầy máu, chống lửa, phòng thủ, hồi phục và chặn một đòn.

## 6. Player
HP 60/60. Tay không gây 2 damage. Model cao khoảng 2 block. Movement:
```js
const forwardX = Math.sin(player.yaw);
const forwardZ = -Math.cos(player.yaw);
const rightX = Math.cos(player.yaw);
const rightZ = Math.sin(player.yaw);
```
Joystick:
```js
PLAYER.player.input.right = -dx / max;
PLAYER.player.input.forward = dy / max;
```
Camera yaw:
```js
PLAYER.player.yaw += dx * 0.007;
```
Hitbox khoảng 0.36 × 1.0 × 0.36.

## 7. Mob
### Titan Guardian
Model `Titanium Warden.glb`. HP 100, melee 6, blue projectile 4. Trung lập mặc định; nếu bị player đánh thì phản công và Guardian trong 20 block cũng hostile. Chủ động truy đuổi Titan Ravage, detection khoảng 14 block.

### Titan Ravage
Model `Titan Ravage.glb`. HP 80, melee 8, black projectile 4 và giảm vision nhẹ. Hostile với player, chủ động tấn công Guardian, detection Guardian khoảng 12 block. Hạ Guardian thì Guardian biến thành Ravage.

## 8. Unified Tap Action
- Tap mob → đánh mob, kể cả khi đang cầm block hoặc không có vũ khí.
- Tap block/vị trí hợp lệ khi cầm block → đặt.
- Cầm Kiếm Quy Tinh + tap mob → đánh kiếm.
- Chọn skill + tap mục tiêu → thi triển.
- Cầm drill + tap/hold block → mine.
- Hold → tiếp tục mining.
- Swipe → xoay camera.
- Trong khi mining vẫn có thể swipe; đổi target thì progress cũ bị hủy.
- Mob được ưu tiên hơn đặt block khi nằm ngay trước tâm ngắm.
- UI không được kích hoạt world action.
- Đã có hướng tối ưu multi-touch, Pointer Events, chống browser gesture và rung nhẹ nếu thiết bị hỗ trợ.

## 9. Mining
Tay không và drill cấp thấp vẫn phá được block; cấp tool chủ yếu ảnh hưởng tốc độ. Titanite Vĩnh Hằng không thể phá. Tay không phá nhưng không drop; tool/drill phá thì drop.
Tốc độ từng dùng: tay 0.16; tool `0.85 + drillLevel*0.30`; cấp thấp bị giảm tốc; cấp cao được bonus tối đa khoảng 45%; duration `max(0.25, hardness*0.38/speed)`.
Crack overlay riêng, 4 stage, texture 32×32.

## 10. Hình nhân thế mạng
Item placeable, stack 16. Khi đặt tạo bản sao model player. Nhận damage thay player trong cùng dimension ở mọi khoảng cách; mob chỉ đổi mục tiêu nếu dummy nằm trong detection range. Không phải training dummy.

## 11. Inventory
30 slot, hotbar 10 slot. Tabs All/Block/Tool/Material. Có search, quick move, split half, take one, merge, assign hotbar, assign first empty, clear hotbar, touch/drag.
Hành vi đã chốt: chọn item trong inventory → chạm trực tiếp ô hotbar → item được gán vào ô đó, không cần nút trung gian. Kéo-thả vẫn có thể giữ.
UI phải compact, dễ chạm trên mobile.

## 12. Kiếm Quy Tinh
Item `quy_tinh_sword`, weapon/sword, damage 8, reach 2.5, attack cooldown 0.55s, stack 1. Model 3D procedural có blade, core, guard, grip, pommel, tip, fuller, gem, glow. Kiếm cầm tay và kiếm bay dùng cùng thiết kế. Icon 32×32.

### 20 kỹ năng
1. Vạn Kiếm Quy Tông — 144 kiếm, 24 damage/kiếm, target 40, 20s, cooldown 60s.
2. Ngự Kiếm — cưỡi kiếm, không giới hạn thời gian, bật/tắt.
3. Kiếm Vũ — 36 kiếm, 12 damage/kiếm, 6s, cooldown 25s.
4. Kiếm Khí — 20 damage, cooldown 8s.
5. Kiếm Trận — 18 kiếm xoay, 10 damage/hit, 15s, cooldown 30s.
6. Phi Kiếm — 12 hits, 10 damage/hit, target 40, cooldown 20s.
7. Thiên Kiếm — 24 hits, 14 damage/hit, target 40, cooldown 35s.
8. Kiếm Ảnh — 10s, 6 damage/pulse, cooldown 24s.
9. Liên Trảm — 5 waves, 9 damage/wave, target 40, cooldown 15s.
10. Kiếm Giới — 10s, 10 damage trong radius, cooldown 40s.
11. Kiếm Thiên Ngoại — kiếm khổng lồ từ trên cao giáng xuống.
12. Kiếm Phản Chấn — vòng kiếm phòng thủ phản kích khi bị đánh.
13. Kiếm Không Gian — phóng kiếm rồi dịch chuyển tới kiếm.
14. Kiếm Tù Ngục — kiếm cắm quanh mục tiêu tạo lồng.
15. Kiếm Thời Không — đánh dấu, tích lũy damage rồi giải phóng.
16. Thiên Kiếm Lưu Tinh — kiếm rơi nhiều đợt quanh mục tiêu.
17. Kiếm Hoán Vị — đổi vị trí player với kiếm.
18. Kiếm Hư Ảnh — phân thân/ảnh kiếm tấn công.
19. Kiếm Long Quyển — cột xoáy kiếm di chuyển gây damage.
20. Chung Cực · Quy Tinh — kiếm đang tồn tại hội tụ và đồng loạt tấn công.

## 13. Skill bar
Một thanh 20 kỹ năng cuộn ngang, đặt phía trên hotbar. Phải compact, không đè joystick/jump/hotbar. Người dùng muốn **vẫn hiển thị tên chiêu** để nhận biết, nhưng tên phải nhỏ/gọn. Icon + tên + cooldown; skill đang chọn có viền sáng.

## 14. Skill lighting
Mỗi skill có hiệu ứng ánh sáng riêng: emissive/glow, vòng sáng, impact flash, target flash, PointLight chỉ ở điểm quan trọng để tránh lag mobile. Phải cleanup hoàn toàn khi skill kết thúc. Ngự Kiếm không để lại light; Vạn Kiếm không để lại target light sau khi kết thúc.

## 15. UI / touch
Đã từng có lỗi UI chồng nhau và ReferenceError do code UI cũ vẫn được gọi sau khi DOM đổi. Khi sửa UI phải kiểm tra toàn bộ query/update cũ.
Joystick khoảng 35% trái, world/camera khoảng 65% phải. Jump riêng. Skill bar không được che hotbar.

## 16. Texture
Tất cả nguồn 2D phải 32×32: block, item, drill, dummy, special blocks, crack. Dùng NearestFilter/pixelated. Không upscale đơn giản 16→32.

## 17. Training Dummy mới — YÊU CẦU MỚI NHẤT
Người dùng muốn thêm một vật phẩm **giống người gỗ/training dummy nhưng làm từ đá Titanite lớp 4 (Titanite Nham)**.

Tên tạm: `Hình nhân thử chiêu Titanite Nham` / `Titanite Nham Training Dummy`.

Điều quan trọng: **nó phải được tính là một sinh vật/entity thực sự**, không chỉ là block. Mục đích là dùng để thử chiêu và damage của **mọi loại công cụ, vũ khí và mod**, không chỉ Kiếm Quy Tinh.

### Yêu cầu entity
- Item có icon 32×32.
- Thiết kế voxel nguyên bản, hình người gỗ nhưng bằng Titanite Nham.
- Placeable entity.
- Có HP.
- Có hitbox.
- Có mesh/raycast target.
- Có `takeDamage()`.
- Nhận melee.
- Nhận ranged/projectile.
- Nhận AoE.
- Nhận skill.
- Nhận damage từ Kiếm Quy Tinh.
- Nhận damage từ tool/weapon/mod tương lai.
- Không chủ động tấn công.
- Đứng yên.
- Có thể tồn tại lâu.
- Có thể đặt nhiều dummy.
- Có thể đánh liên tục để test DPS.
- Có reset HP.
- Có floating damage number.
- Có HP bar.
- Có thể hiển thị HP hiện tại/tối đa.
- Có thể hiển thị tổng damage hoặc DPS nếu hệ thống được mở rộng.
- Không hard-code chỉ cho kiếm.

### Architecture đề xuất
Dùng damage interface chung:
```js
entity.takeDamage(amount, source)
entity.getHealth()
entity.getMaxHealth()
entity.isAlive()
entity.getHitPosition()
entity.getHitbox()
entity.getDamageTarget()
```

Combat nên kiểm tra:
```js
if (target && typeof target.takeDamage === "function") {
    target.takeDamage(damage, {
        type: "sword_skill",
        source: PLAYER.player
    });
}
```

Không nên hard-code:
```js
if (target.type === "warden")
```

Nên dùng:
```js
target.isDamageable
```
hoặc `typeof target.takeDamage === "function"`.

Tên item có thể là:
`training_dummy_titanite_igneous`

Type:
`placeable_entity`

Stack có thể 16, nếu phù hợp với hệ thống placeable entity hiện tại.

Mục tiêu cuối cùng:
> Đặt hình nhân → dùng bất kỳ tool/weapon/skill/mod nào đánh → dummy nhận damage như mob → hiển thị damage/HP để người chơi test.

## 18. Các bug lịch sử cần tránh
- Black screen/texture black.
- Oxygen giảm liên tục.
- Player chìm/đi ngược.
- Camera không xoay.
- Warden không nhận damage.
- Warden không phản ứng.
- Projectile không hiện.
- Mob chìm.
- Ravage quay ngược.
- Target light không cleanup.
- Sword detail chỉ thấy một phía.
- Flying swords che màn hình.
- Skill buttons cũ chồng lên skill bar.
- Inventory duplicate.
- Item icons giống nhau.
- ReferenceError do UI cũ.

## 19. Các build gần đây
- AdvancedVoxel_HAND_LOW_DRILL_MINING.zip
- AdvancedVoxel_serpent_portal_dimension.zip
- AdvancedVoxel_COMBAT_SYSTEM.zip
- AdvancedVoxel_QUY_TINH_SAME_FLYING_MODEL.zip
- AdvancedVoxel_QUY_TINH_WARDEN_ATTACK_FIXED.zip
- AdvancedVoxel_QUY_TINH_WARDEN_DAMAGE_FIXED.zip
- AdvancedVoxel_QUY_TINH_9_SKILLS.zip
- AdvancedVoxel_QUY_TINH_SKILL_BAR.zip
- AdvancedVoxel_QUY_TINH_20_SKILLS.zip
- AdvancedVoxel_QUY_TINH_20_SKILLS_LIGHTING.zip
- AdvancedVoxel_TOUCH_UPGRADE_FULL.zip
- AdvancedVoxel_TOUCH_NGU_UI_FIXED.zip
- AdvancedVoxel_TOUCH_NGU_UI_FIXED_V2.zip
- AdvancedVoxel_INVENTORY_CRAFT_COMPACT.zip
- AdvancedVoxel_INVENTORY_CRAFT_COMPACT_HOTBAR_DIRECT.zip
- AdvancedVoxel_SKILL_BAR_COMPACT.zip
- AdvancedVoxel_SKILL_BAR_COMPACT_NAME.zip

Bản cuối được nhắc tới trước yêu cầu training dummy:
`AdvancedVoxel_SKILL_BAR_COMPACT_NAME.zip`

Không được giả định build cũ chứa mọi thay đổi; phải đọc source thực tế trước khi sửa.

## 20. Checklist khi tạo build mới
1. Đọc đúng source/build hiện tại.
2. Không tự ý đổi thông số đã chốt.
3. Nếu sửa UI, kiểm tra toàn bộ JS gọi DOM cũ.
4. Nếu thêm entity, tích hợp damage interface chung.
5. Kiểm tra syntax tất cả JS bằng Node.
6. Kiểm tra ZIP bằng `unzip -t`.
7. Đảm bảo mọi file/asset cần thiết nằm trong ZIP.
8. Trả link sandbox của file đã tạo.
9. Không tuyên bố tính năng đã hoàn thành nếu chưa thực sự kiểm tra source/build.

## 21. Tóm tắt để tiếp tục ngay
Việc quan trọng nhất hiện tại là triển khai **Training Dummy Titanite Nham** như một **damageable entity/mob thật**, có HP/hitbox/raycast/takeDamage/floating damage/HP bar/reset và tương thích với toàn bộ combat/skill/tool/weapon/mod system. Sau đó tiếp tục tinh chỉnh skill bar compact có tên và inventory direct-hotbar.
