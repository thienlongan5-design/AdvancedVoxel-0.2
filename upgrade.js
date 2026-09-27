/* Advanced Voxel - 10-step original gameplay upgrade layer */
"use strict";

const AV_UPGRADE = (() => {
    const SAVE_KEY = "advanced_voxel_save_v11";
    const LEGACY_SAVE_KEY = "advanced_voxel_save_v10";
    let preview = null;
    let inventoryPanel = null;
    let statusEl = null;
    let initialized = false;
    let lastAutoSave = 0;

    function init() {
        if (initialized) return;
        initialized = true;
        normalizeInventoryAliases();
        setupUI();
        setupBuildingPreview();
        setupDurability();
        enhanceHotbarDurability();
        setupSaveLoad();
        setupPortal();
        setupRareVaults();
        setupWorldPolish();
        setupMobBars();
        restore();
        updateInventoryUI();
        window.addEventListener("beforeunload", save);
        console.info("Advanced Voxel: 10-step upgrade layer initialized");
    }

    function normalizeInventoryAliases() {
        if (GAME.inventory.components != null && GAME.inventory.component == null) GAME.inventory.component = GAME.inventory.components;
        if (GAME.inventory.component != null && GAME.inventory.components == null) GAME.inventory.components = GAME.inventory.component;
        GAME.hotbarItems = GAME.hotbarItems.map(id => id === "components" ? "component" : id);
        GAME.durability = GAME.durability || {};
    }

    function setupUI() {
        // Inventory UI cũ đã được thay bằng hệ thống #inventoryMenu trong game.js.
        // Không tạo thêm nút/túi đồ thứ hai. Chỉ giữ status/toast dùng chung cho hệ thống nâng cấp.
        const style = document.createElement("style");
        style.textContent = `
        #avStatus{position:fixed;left:50%;top:12%;transform:translateX(-50%);z-index:140;color:#fff;background:rgba(0,0,0,.78);padding:7px 11px;border-radius:8px;opacity:0;pointer-events:none;transition:opacity .15s}
        .av-mobbar{position:absolute;width:42px;height:5px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35);border-radius:4px;transform:translate(-50%,-50%);overflow:hidden;pointer-events:none}.av-mobfill{height:100%;background:#5fe36b;width:100%}
        `;
        document.head.appendChild(style);
        statusEl = document.createElement("div");
        statusEl.id = "avStatus";
        document.body.appendChild(statusEl);
        window.addEventListener("keydown", e => {
            if (e.code === "KeyI" && typeof window.toggleInventoryMenu === "function") window.toggleInventoryMenu();
        });
    }

    function updateInventoryUI() {
        if (!inventoryPanel) return;
        const grid = inventoryPanel.querySelector("#avGrid");
        if (!grid) return;
        grid.innerHTML = "";
        Object.entries(GAME.inventory).forEach(([id, count]) => {
            if (!count) return;
            const item = GAME_DATA.items[id] || GAME_DATA.blocks[id];
            const d = document.createElement("div"); d.className = "av-item";
            d.innerHTML = `<strong>${item?.name || id}</strong><br>×${count}`;
            grid.appendChild(d);
        });
        const durability = GAME.durability || {};
        const info = inventoryPanel.querySelector("#avInvInfo");
        info.textContent = Object.entries(durability).map(([id,v]) => `${GAME_DATA.items[id]?.name || id}: ${v}`).join(" • ");
    }

    function toast(msg) { if (!statusEl) return; statusEl.textContent = msg; statusEl.style.opacity = "1"; clearTimeout(toast.t); toast.t = setTimeout(() => statusEl.style.opacity = "0", 1300); }

    function setupDurability() {
        GAME.durability = GAME.durability || {};
        for (const id of GAME.hotbarItems || []) if (GAME_DATA.items[id]?.durability && GAME.durability[id] == null) GAME.durability[id] = GAME_DATA.items[id].durability;
        const oldSet = WORLD.setBlock;
        WORLD.setBlock = function(x,y,z,blockId) {
            const wasBreak = blockId === 0 && GAME.mining;
            const result = oldSet.apply(WORLD, arguments);
            if (wasBreak && result) {
                const toolId = GAME.hotbarItems[GAME.selectedSlot];
                const item = GAME_DATA.items[toolId];
                if (item?.durability) {
                    GAME.durability[toolId] = Math.max(0, (GAME.durability[toolId] ?? item.durability) - 1);
                    if (GAME.durability[toolId] <= 0) {
                        GAME.inventory[toolId] = 0;
                        toast(`${item.name} đã hết độ bền`);
                    }
                    updateHotbar(); updateInventoryUI();
                }
            }
            return result;
        };
    }

    function enhanceHotbarDurability() {
        if (typeof window.updateHotbar !== "function" || window.updateHotbar.__avWrapped) return;
        const original = window.updateHotbar;
        const wrapped = function() {
            original.apply(this, arguments);
            const slots = document.querySelectorAll("#hotbar .slot");
            slots.forEach((slot, i) => {
                slot.querySelector(".av-dur")?.remove();
                const id = GAME.hotbarItems[i]; const item = GAME_DATA.items[id];
                if (!item?.durability) return;
                const value = GAME.durability[id] ?? item.durability;
                const bar = document.createElement("div"); bar.className="av-dur"; bar.style.cssText="position:absolute;left:4px;right:4px;bottom:3px;height:3px;background:rgba(0,0,0,.5);border-radius:2px;overflow:hidden";
                const fill=document.createElement("div"); fill.style.cssText=`height:100%;width:${Math.max(0,Math.min(1,value/item.durability))*100}%;background:#dcecff`; bar.appendChild(fill); slot.appendChild(bar);
            });
        };
        wrapped.__avWrapped = true; window.updateHotbar = wrapped; wrapped();
    }

    function setupBuildingPreview() {
        preview = new THREE.Mesh(new THREE.BoxGeometry(.985,.985,.985), new THREE.MeshBasicMaterial({color:0x7de3ff,transparent:true,opacity:.22,wireframe:true}));
        preview.visible = false; preview.renderOrder = 20; GAME.scene.add(preview);
        setInterval(() => {
            if (!preview || !GAME.camera || typeof getAimBlock !== "function") return;
            const item = typeof getSelectedBlockItem === "function" ? getSelectedBlockItem() : null;
            if (!item) { preview.visible = false; return; }
            const aim = getAimBlock();
            if (!aim || aim.distance > 6 || WORLD.isSolid(aim.placePos.x,aim.placePos.y,aim.placePos.z) || isInsidePlayer(aim.placePos.x,aim.placePos.y,aim.placePos.z)) { preview.visible=false; return; }
            preview.visible=true; preview.position.copy(aim.placePos); preview.material.color.set(TextureSystem.hex(TextureSystem.getBlockVisual(item.blockId).base));
        }, 70);
    }

    function setupSaveLoad() {
        if (!GAME.saveVersion) GAME.saveVersion = 10;
        window.AVSave = save; window.AVLoad = restore;
        setInterval(() => { if (performance.now() - lastAutoSave > 30000) save(true); }, 30000);
    }

    function save(silent=false) {
        try {
            if (GAME.inventory.component != null) GAME.inventory.components = GAME.inventory.component;
            const data = {version:12, dimension:GAME.dimension, inventoryStacks:GAME.inventoryStacks || [], player:{x:PLAYER.player.position.x,y:PLAYER.player.position.y,z:PLAYER.player.position.z,yaw:PLAYER.player.yaw,pitch:PLAYER.player.pitch,health:PLAYER.player.health,oxygen:PLAYER.player.oxygen},inventory:GAME.inventory,selectedSlot:GAME.selectedSlot,durability:GAME.durability || {},worldEdits:WORLD.exportEdits ? WORLD.exportEdits() : {}};
            localStorage.setItem(SAVE_KEY, JSON.stringify(data)); lastAutoSave = performance.now(); if (!silent) toast("Đã lưu thế giới");
        } catch(e) { console.warn("Save failed",e); if (!silent) toast("Không thể lưu"); }
    }

    function restore() {
        try {
            const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
            if (!raw) { if (inventoryPanel) updateInventoryUI(); return false; }
            const d = JSON.parse(raw); if (!d || (d.version !== 10 && d.version !== 11 && d.version !== 12)) return false;
            const savedDimension = d.dimension === "war" ? "war" : "main";
            if (savedDimension !== GAME.dimension) { GAME.dimension = savedDimension; window.AV_DIMENSION = savedDimension; localStorage.setItem("advanced_voxel_dimension", savedDimension); if (WORLD.resetWorld) WORLD.resetWorld(); }
            Object.assign(GAME.inventory,d.inventory||{}); Object.assign(GAME.durability,d.durability||{}); if (Array.isArray(d.inventoryStacks)) GAME.inventoryStacks = d.inventoryStacks; if (typeof ensureInventoryStacks === "function") ensureInventoryStacks();
            // Save migration: an older/corrupt save can leave every drill at 0,
            // which makes mining impossible. Restore one starter Drill I only when
            // the save contains no drill at all.
            const hasAnyDrill = ["titan_drill_1","titan_drill_2","titan_drill_3","titan_drill_4"].some(id => Number(GAME.inventory[id] || 0) > 0);
            if (!hasAnyDrill) GAME.inventory.titan_drill_1 = 1;
            GAME.selectedSlot = Math.max(0,Math.min(GAME.hotbarItems.length-1,Number(d.selectedSlot||0)));
            if (d.player) Object.assign(PLAYER.player.position,{x:d.player.x,y:d.player.y,z:d.player.z});
            if (d.player) { PLAYER.player.yaw=Number(d.player.yaw||0); PLAYER.player.pitch=Number(d.player.pitch||-0.22); PLAYER.player.health=Number(d.player.health||60); PLAYER.player.oxygen=Number(d.player.oxygen||100); }
            if (WORLD.importEdits && d.worldEdits) WORLD.importEdits(d.worldEdits);
            // Never leave the player embedded in solid terrain after a dimension/save migration.
            const px = PLAYER.player.position.x, pz = PLAYER.player.position.z;
            const py = PLAYER.player.position.y;
            const embedded = WORLD.isSolid(Math.floor(px + .5), Math.floor(py + .5), Math.floor(pz + .5));
            if (embedded || !Number.isFinite(py)) {
                const spawn = WORLD.getSpawnPoint();
                PLAYER.player.position.set(spawn.x, spawn.y, spawn.z);
                PLAYER.player.velocity.set(0,0,0);
            }
            updateHotbar(); updateInventoryUI(); if (PLAYER.updateHeldItem) PLAYER.updateHeldItem(GAME.hotbarItems[GAME.selectedSlot]); toast("Đã tải thế giới"); return true;
        } catch(e) { console.warn("Load failed",e); return false; }
    }

    function setupPortal() {
        let cooldown = 0;
        setInterval(() => {
            if (!PLAYER?.player) return;
            cooldown = Math.max(0, cooldown - 0.2);
            if (cooldown > 0) return;
            const p = PLAYER.player.position;
            const bx = Math.floor(p.x + .5), by = Math.floor(p.y + .5), bz = Math.floor(p.z + .5);
            const onGate = WORLD.getBlock(bx, by, bz) === 8 || WORLD.getBlock(bx, by - 1, bz) === 8;
            if (!onGate) return;

            if (GAME.dimension === "main") {
                GAME.dimension = "war";
                window.AV_DIMENSION = "war";
                localStorage.setItem("advanced_voxel_dimension", "war");
                if (WORLD.resetWorld) WORLD.resetWorld();
                const dest = WORLD.getSpawnPoint();
                p.set(dest.x, dest.y, dest.z);
                PLAYER.player.velocity?.set?.(0, 0, 0);
                cooldown = 4;
                toast("Cổng không gian: Thế giới Cột Rắn");
            } else {
                GAME.dimension = "main";
                window.AV_DIMENSION = "main";
                localStorage.setItem("advanced_voxel_dimension", "main");
                if (WORLD.resetWorld) WORLD.resetWorld();
                const dest = {x:16, y:WORLD.getTerrainHeight(16,16)+0.5, z:16};
                p.set(dest.x, dest.y, dest.z);
                PLAYER.player.velocity?.set?.(0, 0, 0);
                cooldown = 4;
                toast("Cổng không gian: Thế giới chính");
            }
        }, 200);
    }

    function setupRareVaults() {
        const spawned = new Set();
        function hash(cx,cz){ let n=(cx*374761393 + cz*668265263)|0; n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295; }
        setInterval(() => {
            if (!WORLD || !WORLD.CHUNK_SIZE || !GAME.scene) return;
            const pcx=Math.floor(PLAYER.player.position.x/WORLD.CHUNK_SIZE), pcz=Math.floor(PLAYER.player.position.z/WORLD.CHUNK_SIZE);
            for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++){
                const cx=pcx+dx, cz=pcz+dz, key=`${cx},${cz}`; if(spawned.has(key) || hash(cx,cz)>0.0015) continue;
                if (WORLD.isChunkVisibleLoaded && !WORLD.isChunkVisibleLoaded(cx, cz)) continue;
                spawned.add(key);
                const x=cx*WORLD.CHUNK_SIZE+8+Math.floor(hash(cx+11,cz-7)*16); const z=cz*WORLD.CHUNK_SIZE+8+Math.floor(hash(cx-3,cz+13)*16); const y=WORLD.getTerrainHeight(x,z)+1;
                if (WORLD.getBlock(x, y, z)===0) WORLD.setBlock(x,y,z,6);
            }
        }, 2500);
    }

    function setupWorldPolish() {
        // Original atmospheric cycle: adjusts ambient and sky tint without copying any game asset.
        setInterval(() => {
            if (!GAME.scene) return;
            const t=(GAME.time%(Math.PI*2))/(Math.PI*2); const daylight=Math.max(.12,Math.sin(t*Math.PI*2)*.5+.5);
            const amb=GAME.scene.children.find(o=>o.isAmbientLight); if (amb) amb.intensity=.32+daylight*.48;
            const sun=GAME.scene.children.find(o=>o.isDirectionalLight); if (sun) sun.intensity=.45+daylight*.95;
        },500);
    }

    function setupMobBars() {
        const root=document.createElement("div"); root.style.cssText="position:fixed;inset:0;pointer-events:none;z-index:80"; document.body.appendChild(root);
        const map=new Map();
        setInterval(() => {
            if (!GAME.camera || !GAME.mobs) return;
            for (const [mob,el] of map) if (!GAME.mobs.includes(mob)||mob.dead) {el.remove();map.delete(mob);}
            for (const mob of GAME.mobs) {
                if (mob.dead||!mob.object) continue;
                let el=map.get(mob); if(!el){el=document.createElement("div");el.className="av-mobbar";el.innerHTML='<div class="av-mobfill"></div>';root.appendChild(el);map.set(mob,el);}
                const pos=mob.object.position.clone(); pos.y+=2.15; pos.project(GAME.camera);
                if(pos.z>1 || pos.z<-1 || Math.abs(pos.x)>1.2 || Math.abs(pos.y)>1.2){el.style.display="none";continue;}
                el.style.display="block"; el.style.left=((pos.x*.5+.5)*innerWidth)+"px"; el.style.top=((-.5*pos.y+.5)*innerHeight)+"px"; el.firstChild.style.width=Math.max(0,Math.min(1,mob.hp/mob.maxHp))*100+"%";
            }
        },80);
    }

    return {init,save,restore,toast};
})();

window.AV_UPGRADE = AV_UPGRADE;

// Initialized by game.js before the initial chunk loading sequence so restored
// dimension/player state is known before any world mesh is generated.
