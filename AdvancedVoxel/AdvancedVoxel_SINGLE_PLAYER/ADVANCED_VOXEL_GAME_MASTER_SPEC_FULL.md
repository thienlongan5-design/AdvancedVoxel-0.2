# ADVANCED VOXEL WEB GAME — BẢN TỔNG HỢP ĐẦY ĐỦ / PROJECT MASTER SPEC
Ngày tổng hợp: 2026-09-26

## 1. Mục tiêu
Game voxel web/mobile tự phát triển bằng HTML5, CSS3, JavaScript ES6+, Three.js r128 và GLTFLoader; chạy trên Samsung Galaxy A20 bằng Spck Editor/mobile browser.
- Thế giới là một hành tinh khác.
- Code, texture, model, UI, âm thanh và asset phải nguyên bản.
- Không sao chép mã nguồn/tài sản Minecraft hoặc game khác.
- Có thể học nguyên lý kỹ thuật công khai rồi tự thiết kế code/thuật toán.
- Không dùng Web Worker.
- Ưu tiên hiệu năng mobile.

## 2. File lõi
index.html, game.js, mod.js, player.js, world.js, texture.js, loader.js, upgrade.js, features.js, collision.js, player.glb, Titanium Warden.glb, Titan Ravage.glb.

Build/source được ghi nhận: AdvancedVoxel_TITANITE_TRAINING_DUMMY(1).zip.

## 3. Kiến trúc module
16 module dữ liệu/hệ thống:
data/items.js, data/weapons.js, data/armor.js, data/shields.js, data/bows.js, data/tools.js, data/war_items.js, data/trees.js,
systems/damage.js, systems/stats.js, systems/combat.js, systems/effects.js, systems/projectiles.js, systems/ai.js, systems/physics.js, systems/performance.js.

20 module tách tải:
systems/chunkScheduler.js, systems/chunkCulling.js, systems/chunkMesh.js, systems/chunkCache.js, systems/entityManager.js, systems/entityCulling.js, systems/entityUpdate.js, systems/mobTarget.js, systems/mobMovement.js, systems/mobCombat.js, systems/collisionGrid.js, systems/raycast.js, systems/itemStats.js, systems/inventoryData.js, systems/craftingData.js, systems/projectilePool.js, systems/particlePool.js, systems/lightManager.js, systems/effectScheduler.js, systems/frameBudget.js.

10 core manager:
core/gameManager.js, core/systemManager.js, core/updateManager.js, core/taskManager.js, core/eventManager.js, core/stateManager.js, core/resourceManager.js, core/memoryManager.js, core/worldManager.js, core/performanceManager.js.

Thêm:
systems/fallDamage.js
systems/speedCalculator.js

## 4. Multiplayer — 52 module
Không dùng Web Worker.

16 file chính:
network/networkClient.js
network/networkProtocol.js
network/connectionManager.js
network/serverAuthority.js
network/snapshotManager.js
network/playerSync.js
network/entitySync.js
network/chunkSync.js
network/blockSync.js
network/inventorySync.js
network/combatSync.js
network/projectileSync.js
network/skillSync.js
network/stateSync.js
network/interpolation.js
network/reconciliation.js

16 file dự phòng:
network/fallback/packetQueue.js
network/fallback/packetBuffer.js
network/fallback/packetPriority.js
network/fallback/packetCompression.js
network/fallback/packetValidator.js
network/fallback/networkRetry.js
network/fallback/latencyManager.js
network/fallback/pingManager.js
network/fallback/bandwidthManager.js
network/fallback/syncScheduler.js
network/fallback/deltaSync.js
network/fallback/entityDelta.js
network/fallback/chunkDelta.js
network/fallback/blockDelta.js
network/fallback/stateDelta.js
network/fallback/networkRecovery.js

20 file hỗ trợ:
multiplayer/sessionManager.js
multiplayer/roomManager.js
multiplayer/playerRegistry.js
multiplayer/playerIdentity.js
multiplayer/spawnManager.js
multiplayer/dimensionSync.js
multiplayer/worldState.js
multiplayer/worldSave.js
multiplayer/tickManager.js
multiplayer/serverTick.js
multiplayer/clientTick.js
multiplayer/timeSync.js
multiplayer/eventSync.js
multiplayer/chatSync.js
multiplayer/interactionSync.js
multiplayer/containerSync.js
multiplayer/itemDropSync.js
multiplayer/mobSync.js
multiplayer/weatherSync.js
multiplayer/multiplayerPerformance.js

Luồng:
INPUT -> Client Prediction -> Speed/Physics -> Network Client -> Server Authority -> World/Entity/Combat -> Snapshot/Delta -> Interpolation/Reconciliation -> Client.

Server xác nhận trạng thái quan trọng: vị trí, damage, block, inventory, item, mob, skill.

## 5. World
Chunk 32×32.
Tối ưu: hidden-face culling, frustum culling, greedy meshing khi phù hợp, chỉ cập nhật chunk bị ảnh hưởng.
Staged loading: chunk dưới chân -> 4 xung quanh -> 8 -> 16.
Không spawn mob trong chunk chưa tải.

Các lớp:
1. Titanite: nền/bề mặt, ít Vật Chất Tối.
2. Titanite Đen: tối hơn, cứng hơn, không khoáng sản.
3. Titanite Huyết: hơi đỏ, cứng hơn, độ sáng thấp, bắt đầu có khoáng sản.
4. Titanite Nham: kiểu dung nham/igneous, độ cứng bằng Titanite Huyết, có khoáng sản riêng.
5. Titanite Vĩnh Hằng: không thể phá; dưới là Void.

Dimension cũ: main và serpent_void, localStorage key advanced_voxel_dimension.
Thiết kế mới: Thế giới Sâu/Serpent Void đang được định hướng thay bằng Thế giới Chiến Tranh, không coi là hai dimension độc lập nếu chưa có yêu cầu mới. Space Gate dùng để chuyển dimension.

## 6. Thế giới Chiến Tranh — 5 cây
1. Cây Chiến Địa — thân tối cao, vỏ nứt, lá xám-xanh; đồng bằng/chiến trường.
2. Cây Hắc Thiết — thân gần đen, dày/cứng, lá xanh tím đậm; gần khoáng.
3. Cây Huyết Diệp — thân nâu đỏ, lá đỏ sẫm, hơi phát sáng ban đêm; vùng nóng.
4. Cây Tinh Thạch — thân xanh-xám, tinh thể phát sáng trên cành.
5. Cây Tro Tàn — thân cháy cong, cành trơ, lá xám bạc thưa.

Gỗ: Gỗ Chiến Địa, Gỗ Hắc Thiết, Gỗ Huyết Diệp, Gỗ Tinh Thạch, Gỗ Tro Tàn.

## 7. Titan Vault
Block 1×1×1, thiết kế Titanite/kim loại tối, khe khóa dọc và panel trượt.
SpawnChance 0.0015.
Loot: Drill I 10%, Drill II 6%, Drill III 5%, Drill IV 4%, Công cụ Titanite Đen 7%, Tinh thể Hộ vệ Titan 2%, Vật Chất Tối 25%, Bình oxy 30%, Linh kiện 10%, Viên đá không gian 0.5%, Bùa thế mạng 0.5%.

## 8. Crafting/item cơ bản
6 Linh kiện -> Máy chế tạo.
4 Vật Chất Tối + 1 Viên đá không gian + 6 Khối Titanite Huyết -> Cổng không gian.
Stack mặc định 256.
Ngoại lệ: Bùa thế mạng 16, Bình oxy 16, Hình nhân thế mạng 16, Máy chế tạo 256, Cổng không gian 256, Titan Vault 256, drill/tool 1, Kiếm Quy Tinh 1.
Bình oxy hồi 30% oxygen.
Bùa thế mạng stack 16, không cần cầm; khi đáng lẽ mất mạng thì tiêu thụ, hồi đầy máu, chống lửa, phòng thủ, hồi phục và chặn một đòn.

## 9. Player
HP 60/60; tay không damage 2; model cao khoảng 2 block; hitbox khoảng 0.36 × 1.0 × 0.36.

Movement:
forwardX = sin(yaw)
forwardZ = -cos(yaw)
rightX = cos(yaw)
rightZ = sin(yaw)

Joystick:
PLAYER.player.input.right = -dx / max
PLAYER.player.input.forward = dy / max

Camera yaw:
PLAYER.player.yaw += dx * 0.007

## 10. Speed Calculator
File: systems/speedCalculator.js.
Tính tốc độ đi bộ/chạy/lùi/ngang, acceleration/deceleration, air, nước, bề mặt, gravity, jump, knockback, Ngự Kiếm, modifiers và max velocity.
Đơn vị: block/second.
velocity X/Y/Z.
horizontalSpeed = sqrt(vx²+vz²).
totalSpeed = sqrt(vx²+vy²+vz²).
Velocity(t+dt)=Velocity(t)+Acceleration×dt.
Position(t+dt)=Position(t)+Velocity×dt.
Normalize input để đi chéo không nhanh hơn.
States: GROUND, AIR, FALLING, JUMPING, SWIMMING, SLIDING, KNOCKBACK, FLYING_SWORD, CLIMBING, SPECIAL_SKILL.
finalSpeed = baseSpeed × armorMultiplier × effectMultiplier × itemMultiplier × surfaceMultiplier × skillMultiplier.
Clamp tốc độ.
Speed Calculator là nguồn velocity trung tâm cho physics, fall damage, knockback, projectile và multiplayer.

## 11. Fall Damage
File: systems/fallDamage.js.
Tính quãng rơi thực tế từ Fall Session và điểm va chạm thật.
Theo dõi active, startY, maxY, previousY, velocityY, airTime, landingY, landingBlock, landingNormalY, damageApplied.
Khi bắt đầu: startY = feetY.
Trong rơi: maxY = max(maxY, feetY).
Khi đáp: landingY = contactPoint.y hoặc mặt trên thật của collision.
H = maxY - landingY.
Không dùng currentHeight hoặc spawnHeight.
V = sqrt(V0² + 2gH), nhưng ưu tiên velocity thực tế nếu physics có.
Veff = max(0, V - Vsafe).
E = 0.5 × M × Veff².
Dbase = E × K.
Dfinal = Dbase × ArmorMultiplier × EffectMultiplier × SurfaceMultiplier × DimensionMultiplier.
Clamp 0..MaxFallDamage.
Một cú rơi chỉ damage một lần.
Đáp bệ giữa đường thì kết thúc session; rời bệ và rơi tiếp tạo session mới.
Ví dụ Y=100 -> bệ Y=98: H=2, không tính 100 block.
Nếu maxY=105 -> landingY=98: H=7.
Nước có multiplier 0; bề mặt mềm/special có multiplier riêng.

API: startFall(), update(), resolveLanding(), calculate(), apply(), reset().

## 12. Mob
Titan Guardian / Titanium Warden: model Titanium Warden.glb; HP 100; melee 6; blue projectile 4; neutral mặc định; bị player đánh thì phản công; Guardian trong 20 block hostile; chủ động truy đuổi Titan Ravage; detection khoảng 14 block.
Titan Ravage: model Titan Ravage.glb; HP 80; melee 8; black projectile 4; giảm vision nhẹ; hostile player; tấn công Guardian; detection Guardian khoảng 12 block; hạ Guardian -> Guardian biến thành Ravage.

## 13. Unified Tap Action
Tap mob -> đánh.
Tap block hợp lệ khi cầm block -> đặt.
Quy Tinh + tap mob -> đánh kiếm.
Skill + tap mục tiêu -> cast.
Drill + tap/hold -> mine.
Hold -> tiếp tục mining.
Swipe -> xoay camera.
Mining vẫn swipe; đổi target hủy progress cũ.
Mob ưu tiên hơn đặt block ở tâm ngắm.
UI không kích hoạt world action.
Multi-touch/Pointer Events.

## 14. Mining
Tay không và drill cấp thấp vẫn phá block; cấp tool ảnh hưởng tốc độ.
Titanite Vĩnh Hằng không thể phá.
Tay không phá nhưng không drop; tool/drill phá thì drop.
Crack overlay riêng, 4 stage, texture 32×32.
Thông số cũ: tay 0.16; tool = 0.85 + drillLevel*0.30; cấp thấp giảm tốc; cấp cao bonus tối đa khoảng 45%; duration = max(0.25, hardness*0.38/speed).

## 15. Hình nhân thế mạng
Item placeable, stack 16. Đặt -> bản sao model player. Nhận damage thay player trong cùng dimension ở mọi khoảng cách. Mob chỉ đổi mục tiêu nếu dummy trong detection range. Không phải training dummy.

## 16. Training Dummy Titanite Nham
Item: training_dummy_titanite_igneous.
Type: placeable_entity.
Stack có thể 16.
Entity thật, không phải block; voxel nguyên bản giống hình nhân thử chiêu nhưng bằng Titanite Nham.
Có icon 32×32, HP, hitbox, mesh/raycast target, takeDamage(), nhận melee/ranged/projectile/AoE/skill/tool/weapon/mod damage, đứng yên, đặt nhiều, DPS testing, reset HP, floating damage, HP bar, HP hiện tại/tối đa.
Damage interface:
entity.takeDamage(amount, source)
entity.getHealth()
entity.getMaxHealth()
entity.isAlive()
entity.getHitPosition()
entity.getHitbox()
entity.getDamageTarget()
Combat kiểm tra typeof target.takeDamage === "function" hoặc target.isDamageable, không hard-code mob type.

## 17. Inventory
30 slot; hotbar 10; tabs All/Block/Tool/Material; search; quick move; split half; take one; merge; assign hotbar; assign first empty; clear hotbar; touch/drag.
Chọn item inventory -> chạm trực tiếp ô hotbar -> gán item.

## 18. Quy Tinh
Item quy_tinh_sword; damage 8; reach 2.5; attack cooldown 0.55s; stack 1; icon 32×32.
Model: blade, core, guard, grip, pommel, tip, fuller, gem, glow.
Held/flying cùng thiết kế.
Yêu cầu: blade dài/mảnh; tip nhọn thuôn nhiều mặt; core dọc giữa; glow không biến tip thành khối; năng lượng tím/hồng; chi tiết vàng/đồng; guard nhiều lớp có điểm bên; gem xanh gần guard; grip/pommel chi tiết; nhìn tốt từ nhiều góc.

## 19. 20 Quy Tinh skills
1 Vạn Kiếm Quy Tông — 144 kiếm, 24 damage/kiếm, target 40, 20s, cooldown 60s.
2 Ngự Kiếm — cưỡi kiếm, không giới hạn, bật/tắt.
3 Kiếm Vũ — 36 kiếm, 12 damage/kiếm, 6s, cooldown 25s.
4 Kiếm Khí — 20 damage, cooldown 8s.
5 Kiếm Trận — 18 kiếm xoay, 10 damage/hit, 15s, cooldown 30s.
6 Phi Kiếm — 12 hits, 10 damage/hit, target 40, cooldown 20s.
7 Thiên Kiếm — 24 hits, 14 damage/hit, target 40, cooldown 35s.
8 Kiếm Ảnh — 10s, 6 damage/pulse, cooldown 24s.
9 Liên Trảm — 5 waves, 9 damage/wave, target 40, cooldown 15s.
10 Kiếm Giới — 10s, 10 damage trong radius, cooldown 40s.
11 Kiếm Thiên Ngoại — kiếm khổng lồ từ trên cao.
12 Kiếm Phản Chấn — vòng kiếm phòng thủ phản kích.
13 Kiếm Không Gian — phóng kiếm rồi dịch chuyển.
14 Kiếm Tù Ngục — kiếm quanh mục tiêu tạo lồng.
15 Kiếm Thời Không — đánh dấu, tích lũy damage rồi giải phóng.
16 Thiên Kiếm Lưu Tinh — kiếm rơi nhiều đợt.
17 Kiếm Hoán Vị — đổi vị trí player với kiếm.
18 Kiếm Hư Ảnh — phân thân/ảnh kiếm.
19 Kiếm Long Quyển — cột xoáy kiếm.
20 Chung Cực · Quy Tinh — kiếm đang tồn tại hội tụ và đồng loạt tấn công.

Skill bar: 20 skill, cuộn ngang, phía trên hotbar, compact, không che joystick/jump/hotbar, icon + tên + cooldown, tên nhỏ nhưng đọc được, skill chọn có viền sáng.
Effects: emissive/glow, ring, impact flash, target flash; PointLight chỉ điểm quan trọng; cleanup hoàn toàn; timeline theo deltaTime; gameplay damage tách effect rendering; pooling; giới hạn lights/particles.

## 20. Particle
Dùng ảnh PNG 32×32 riêng, không code texture: nhiệt/năng lượng, nước, cánh hoa ngoài hành tinh, bụi đá, tinh thể, Titanite energy, impact, sword, Space Gate, Void...
Pooling và giới hạn số particle.

## 21. Texture — QUYẾT ĐỊNH MỚI NHẤT
Không dùng code để tạo texture 2D.
Tất cả texture 2D là PNG thật và được đưa vào game.
Cấu trúc:
assets/textures/blocks/
assets/textures/items/
assets/textures/tools/
assets/textures/weapons/
assets/textures/mobs/
assets/textures/particles/
assets/textures/ui/

Tất cả nguồn 2D 32×32; không upscale 16→32.
Dùng NearestFilter, pixelated, generateMipmaps=false.
texture.js trở thành texture loader/manager.
Ví dụ:
const texture = textureLoader.load("assets/textures/blocks/titanite.png");
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;

Ưu tiên tạo: Titanite, Titanite Đen, Titanite Huyết, Titanite Nham, Titanite Vĩnh Hằng; sau đó item/tool/weapon/mob/particle/UI.

## 22. World War — 128 weapons
128 vũ khí = 64 kiếm + 64 rìu.

64 kiếm và damage:
Kiếm Chiến Địa 8; Hắc Thiết 10; Huyết Diệp 11; Tinh Thạch 12; Tro Tàn 13; Thiết Vệ 14; Trọng Chiến 16; Liệt Phong 13; Địa Chấn 18; Bạo Kích 15; Hắc Vũ 16; Huyết Chiến 17; Lam Tinh 18; Thiên Thạch 20; Cuồng Phong 17; Phá Giáp 21; Đoạt Hồn 19; Băng Tinh 18; Hỏa Tinh 20; Lôi Tinh 21; Độc Vụ 19; Sa Mạc 20; Thiên Quân 22; Hộ Quốc 20; Vực Sâu 23; Tử Diễm 24; Quang Minh 22; Hư Không 25; Không Gian 23; Thiên Lôi 26; Huyết Nguyệt 25; Bạch Ngân 24; Tinh Vân 27; Chiến Thần 28; Phá Thành 30; Long Cốt 29; Hắc Long 31; Bạch Long 30; Lưu Tinh 32; Huyết Long 34; Thời Không 33; Phản Chấn 30; Ảnh Sát 28; Vạn Ảnh 35; Tốc Không 31; Thiên Ngoại 38; Tinh Hải 36; Hủy Diệt 40; Sinh Mệnh 32; Linh Hồn 37; Ma Tinh 39; Thiên Cực 42; Vô Cực 44; Thần Tinh 46; Hư Vô 48; Diệt Thế 50; Tối Cao 52; Chiến Vương 55; Tinh Vương 58; Hắc Nhật 60; Thiên Đế 63; Không Vương 66; Quy Tinh Phụ 70; Chiến Tranh Tối Thượng 75, skill Chiến Vực.

64 rìu damage theo thứ tự:
10,13,14,15,16,17,20,18,22,21,20,23,22,25,23,27,25,24,27,28,26,27,29,27,31,32,30,34,32,35,34,33,37,39,43,42,45,44,47,50,48,44,42,52,46,56,53,60,49,55,58,64,68,72,76,80,84,88,92,96,100,105,110,120.
Rìu cuối có skill Chiến Phá.

## 23. Armor — 64 pieces / 16 sets
Bộ: Chiến Địa, Hắc Thiết, Huyết Diệp, Tinh Thạch, Tro Tàn, Thiết Vệ, Cuồng Chiến, Liệt Phong, Địa Chấn, Băng Tinh, Hỏa Tinh, Lôi Tinh, Hư Không, Long Cốt, Chiến Thần, Chiến Tranh Tối Thượng.
Defense: 8,12,13,14,15,17,18,16,20,19,21,22,25,28,32,40.
Mỗi set có set effect theo thiết kế đã chốt.

## 24. Shields — 32
Chiến Địa, Hắc Thiết, Huyết Diệp, Tinh Thạch, Tro Tàn, Thiết Vệ, Cuồng Chiến, Liệt Phong, Địa Chấn, Băng Tinh, Hỏa Tinh, Lôi Tinh, Vực Sâu, Hư Không, Long Cốt, Thiên Thạch, Tinh Vân, Hắc Long, Bạch Long, Huyết Long, Thời Không, Phản Chấn, Không Gian, Thiên Lôi, Sinh Mệnh, Linh Hồn, Ma Tinh, Vô Cực, Thần Tinh, Hư Vô, Chiến Vương, Chiến Tranh Tối Thượng.
Defense: 10,15,16,18,19,22,20,18,25,23,24,26,28,30,34,35,37,40,40,42,44,46,42,48,45,50,52,55,58,62,68,75.
Cuối có skill Pháo Khiên.

## 25. Tools — 16
Cuốc Chiến Địa, Cuốc Hắc Thiết, Cuốc Huyết Diệp, Cuốc Tinh Thạch, Xẻng Chiến Địa, Xẻng Hắc Thiết, Rìu Chặt Cây, Rìu Hắc Thiết, Khoan Titanite, Khoan Lôi, Búa Phá Thành, Búa Địa Chấn, Kìm Tinh Thạch, Máy Quét Khoáng, Máy Khoan Hư Không, Công Cụ Chiến Tranh Tối Thượng.

## 26. Bows — 16
Cung Chiến Địa, Hắc Thiết, Huyết Diệp, Tinh Thạch, Tro Tàn, Liệt Phong, Băng Tinh, Hỏa Tinh, Lôi Tinh, Độc Vụ, Hư Không, Thiên Thạch, Long Cốt, Tinh Vân, Hủy Diệt, Chiến Tranh Tối Thượng.
Damage: 8,11,12,13,14,15,16,18,20,18,22,25,28,30,35,42.
Skill cuối: Mưa Chiến Tranh.
Arrow types: thường, xuyên giáp, lửa, băng, điện, độc, hư không, năng lượng.

## 27. Items/blocks World War — 16
Gỗ Chiến Địa, Gỗ Hắc Thiết, Gỗ Huyết Diệp, Gỗ Tinh Thạch, Gỗ Tro Tàn, Lõi Chiến Tranh, Mảnh Hắc Thiết, Tinh Thể Huyết, Tinh Thể Chiến Địa, Lõi Tinh Thạch, Tro Linh Hồn, Mảnh Không Gian, Lõi Thời Không, Khối Chiến Tranh, Khối Năng Lượng Chiến Tranh, Lõi Chiến Tranh Tối Thượng.

## 28. Multiplayer/security
Dùng server authority, snapshot, interpolation, client prediction, reconciliation, delta sync, packet validation, priority queue, bandwidth management, latency/ping tracking, recovery/retry.
Client không tự quyết định damage/inventory/block/world state quan trọng.

## 29. Originality/copyright
Được học nguyên lý kỹ thuật công khai từ Minecraft/game voxel khác để cải tiến, nhưng không sao chép source code, texture, model, âm thanh hoặc asset. Tự viết code, tự tạo texture PNG, tự thiết kế model/UI/effect; giữ file gốc và lịch sử phát triển.

## 30. Checklist build
1. Đọc đúng source/build hiện tại.
2. Không tự ý đổi thông số đã chốt.
3. Sửa UI phải kiểm tra DOM reference cũ.
4. Entity dùng damage interface chung.
5. Kiểm tra syntax JS bằng Node.
6. Kiểm tra ZIP bằng unzip -t.
7. Đảm bảo asset cần thiết nằm trong ZIP.
8. Không tuyên bố hoàn thành nếu chưa kiểm tra source/build.
9. Texture mới phải PNG thật 32×32.
10. Không để texture procedural cũ ghi đè texture PNG.
11. Đường dẫn asset phải chạy được trong Spck Editor.
12. Kiểm tra NearestFilter và không upscale 16→32.

## 31. Thứ tự triển khai
1. Chuyển texture procedural -> PNG 32×32.
2. Hoàn thiện texture loader/manager.
3. Hoàn thiện speedCalculator.
4. Hoàn thiện fallDamage.
5. Chuẩn hóa physics/collision.
6. Chuẩn hóa combat/damage.
7. Hoàn thiện Training Dummy.
8. Hoàn thiện World War data.
9. Tách network modules.
10. Xây server authority.
11. Đồng bộ player/entity/chunk/block.
12. Đồng bộ combat/inventory/skill.
13. Tối ưu bandwidth/mobile.
14. Kiểm thử multiplayer.
15. Đóng gói build cuối.

## 32. Mục tiêu cuối
Game voxel mobile nguyên bản, tối ưu Galaxy A20, có procedural world, chunk optimization, combat, Quy Tinh + 20 skills, World War, mobs, training dummy, inventory/crafting, physics/speed/fall damage, multiplayer, texture PNG 32×32 và kiến trúc module lớn không Web Worker.
