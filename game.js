window.AV_DIMENSION = localStorage.getItem("advanced_voxel_dimension") || "main";
if (window.AV_DIMENSION !== "main" && window.AV_DIMENSION !== "war") window.AV_DIMENSION = "main";

const GAME = {
    dimension: window.AV_DIMENSION,

    scene: null,
    camera: null,
    renderer: null,

    clock: new THREE.Clock(),

    inventory: {

        quy_tinh_sword: 1,
        titan_drill_1: 1,
        titan_drill_2: 0,
        titan_drill_3: 0,
        titan_drill_4: 0,

        black_titan_tools: 0,

        titan_guardian_crystal: 0,
        dark_matter: 0,
        oxygen_tank: 3,
        components: 6,
        titanite_blood: 6,
        titanite_blood_block: 6,
        space_stone: 0,

        revive_charm: 0,
        revive_decoy: 1,
        titan_training_dummy: 1,

        crafting_machine: 0,
        space_gate: 0,

        titanite_blood_block: 6
    },

    selectedSlot: 0,
    inventoryStacks: [],
    inventorySelectedStack: -1,

    hotbarItems: [
        "quy_tinh_sword",
        "titan_drill_1",
        "titan_drill_2",
        "titan_drill_3",
        "titan_drill_4",
        "oxygen_tank",
        "revive_charm",
        "revive_decoy",
        "titan_training_dummy",
        "titanite_blood",
        "dark_matter",
        "components"
    ],

    reviveBuffTime: 0,
    invulnerable: false,
    damageFlash: 0,
    visionDebuff: 0,

    triggerDamageEffect(amount = 0) {
        // Original, non-copyrighted hit feedback: brief screen flash + HUD pulse.
        this.damageFlash = Math.max(this.damageFlash, 0.22);
        const health = document.getElementById("health");
        if (health) {
            health.style.transform = "scale(1.08)";
            setTimeout(() => { health.style.transform = "scale(1)"; }, 100);
        }
    },

    triggerVisionDebuff(seconds = 1.8) {
        this.visionDebuff = Math.max(this.visionDebuff, seconds);
    },

    sky: null,

    previewScene: null,
    previewCamera: null,
    previewRenderer: null,

    time: 0,

    // Mobile interaction state
    mining: false,
    miningTarget: null,
    miningProgress: 0,
    placing: false,
    crackOverlay: null,
    crackTextures: null,
    lastChunkX: null,
    lastChunkZ: null,

    mobs: [],
    mobsReady: false,
    worldReady: false,
    uiMenuOpen: false,
    playerMode: localStorage.getItem("advanced_voxel_player_mode") || localStorage.getItem("advanced_voxel_game_mode") || "survival",
    permissions: {break:true,place:true,combat:true,pickup:true,use:true,chat:true},
    isHost: false
};

function AV_NORMALIZE_MODE(mode){const m=String(mode||"survival").toLowerCase();return ["survival","free","explore","observer"].includes(m)?m:"survival";}
function AV_IS_FREE(){return GAME.playerMode==="free";}
function AV_IS_OBSERVER(){return GAME.playerMode==="observer";}
function AV_CAN(permission){if(AV_IS_OBSERVER())return false;return GAME.permissions?.[permission]!==false;}
window.addEventListener("advancedvoxel:worldcreated",e=>{const c=e.detail||{};GAME.playerMode=AV_NORMALIZE_MODE(c.gameMode);GAME.permissions={break:true,place:true,combat:true,pickup:true,use:true,chat:true};GAME.isHost=c.type==="multi";window.GAME_MODE=GAME.playerMode;});
window.addEventListener("advancedvoxel:modechanged",e=>{const m=AV_NORMALIZE_MODE(e.detail?.mode);GAME.playerMode=m;window.GAME_MODE=m;});

async function initGame() {

    const loading = {
        screen: document.getElementById("loadingScreen"),
        stage: document.getElementById("loadingStage"),
        percent: document.getElementById("loadingPercent"),
        bar: document.getElementById("loadingBar"),
        subtitle: document.getElementById("loadingSubtitle")
    };

    function setLoading(percent, stage, subtitle) {
        const p = Math.max(0, Math.min(100, Math.round(percent)));
        if (loading.bar) loading.bar.style.width = p + "%";
        if (loading.percent) loading.percent.textContent = p + "%";
        if (loading.stage) loading.stage.textContent = stage || "Đang tải...";
        if (loading.subtitle && subtitle) loading.subtitle.textContent = subtitle;
    }

    try {
        setLoading(3, "Khởi tạo bộ máy", "Đang chuẩn bị đồ họa...");

        GAME.scene = new THREE.Scene();
        GAME.scene.fog = new THREE.FogExp2(0x8ea7b8, 0.00055);
        GAME.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 600);
        GAME.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        GAME.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
        GAME.renderer.setClearColor(0x7f9fb3, 1);
        GAME.renderer.setSize(innerWidth, innerHeight);
        GAME.renderer.shadowMap.enabled = true;
        GAME.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById("game").appendChild(GAME.renderer.domElement);

        createSky();
        createLights();

        setLoading(15, "Tải người chơi", "Đang tải mô hình nhân vật...");
        const playerResult = await PLAYER.create(GAME.scene);

        // Khôi phục save + dimension TRƯỚC khi tạo chunk.
        // Bản trước khôi phục save sau khi load chunk, nên nếu save đổi chiều
        // WORLD.resetWorld() sẽ xóa toàn bộ chunk vừa dựng -> màn hình đen.
        // Khởi tạo lớp nâng cấp ở đây để vị trí/dimension cuối cùng được biết
        // trước khi load 1/4/8/16 chunk.
        if (window.AV_UPGRADE && typeof window.AV_UPGRADE.init === "function") {
            window.AV_UPGRADE.init();
        }

        // Bảo đảm vị trí xuất hiện không nằm trong khoảng trống do save cũ.
        if (!Number.isFinite(PLAYER.player.position.x) || !Number.isFinite(PLAYER.player.position.y) || !Number.isFinite(PLAYER.player.position.z)) {
            const spawn = WORLD.getSpawnPoint();
            PLAYER.player.position.set(spawn.x, spawn.y, spawn.z);
            PLAYER.player.velocity.set(0, 0, 0);
        }

        setLoading(38, playerResult && playerResult.fallbackUsed ? "Dùng mô hình dự phòng" : "Người chơi đã sẵn sàng", playerResult && playerResult.fallbackUsed ? "Không tải được player.glb, tiếp tục bằng mô hình dự phòng." : "Đang chuẩn bị khu vực xuất hiện...");

        setupInput();
        if (!window.AV_SINGLE_PLAYER_ONLY && window.MULTIPLAYER && window.MULTIPLAYER.enable) {
            const mpUrl = window.AV_MULTIPLAYER_URL || ((location.protocol === "https:") ? "wss://" + location.host : "ws://" + location.hostname + ":8080");
            const mpRoom = window.AV_MULTIPLAYER_ROOM || "default";
            window.MULTIPLAYER.enable(mpUrl, mpRoom);
        }
        setupCraftingUI();
        setupInventoryUI();
        setupMenuInteraction();
        setupSwordSkillUI();
        setupExtraSwordSkillUI();
        setupNewSwordSkills();
        setupMobUI();
        updateHotbar();

        // MENU CHÍNH LÀ CỔNG VÀO: chưa tạo thế giới thì chưa tải chunk và chưa bắt đầu gameplay.
        setLoading(43, "Đang chờ tạo thế giới", "Hãy tạo một thế giới từ menu chính để bắt đầu.");
        await new Promise(resolve => { window.__AV_START_GAME = resolve; });
        const loadingScreen = document.getElementById("loadingScreen");
        if (loadingScreen) loadingScreen.classList.remove("hidden");
        setLoading(43, "Tạo khu vực ban đầu", "Đang dựng địa hình quanh người chơi...");
        await WORLD.loadInitialChunks(
            GAME.scene,
            PLAYER.player.position.x,
            PLAYER.player.position.z,
            2,
            (done, total, item, phase) => {
                if (phase === "center") {
                    setLoading(44, "Tải 1 chunk dưới chân người chơi", "Đang dựng khu vực xuất hiện...");
                } else if (phase === "cardinal") {
                    setLoading(44 + (done / 5) * 16, `Tải 4 chunk xung quanh ${Math.max(0, done - 1)}/4`, "Đang mở rộng khu vực chơi...");
                } else if (phase === "near8") {
                    setLoading(60 + ((done - 5) / 8) * 24, `Tải 8 chunk xung quanh ${Math.max(0, done - 5)}/8`, "Đang chuẩn bị khu vực lân cận...");
                } else if (phase === "prepare16") {
                    setLoading(84 + ((done - 13) / 16) * 12, `Chuẩn bị 16 chunk ${Math.max(0, done - 13)}/16`, "Đang chuẩn bị chunk để di chuyển mượt hơn...");
                }
            }
        );

        GAME.lastChunkX = Math.floor(PLAYER.player.position.x / WORLD.CHUNK_SIZE);
        GAME.lastChunkZ = Math.floor(PLAYER.player.position.z / WORLD.CHUNK_SIZE);
        GAME.worldReady = true;
        GAME.mobsReady = false;

        setLoading(94, "Hoàn tất", "Đang đưa bạn vào thế giới...");
        // Chỉ khởi tạo preview sau khi đã vào game để không chặn màn hình chờ.
        animate();

        // Đợi một frame để renderer/hệ thống input ổn định rồi mới mở khóa.
        await new Promise(resolve => requestAnimationFrame(resolve));
        setLoading(100, "Sẵn sàng!", "Chúc bạn khám phá vui vẻ.");
        await new Promise(resolve => setTimeout(resolve, 180));
        GAME.mobsReady = true;
        if (loading.screen) {
            loading.screen.classList.add("hidden");
            setTimeout(() => loading.screen.remove(), 400);
        }

        requestAnimationFrame(() => {
            try { setupPreview(); } catch (e) { console.warn("Preview init failed", e); }
        });
    } catch (error) {
        console.error("Không thể khởi tạo game:", error);
        setLoading(100, "Không thể tải game", "Đã xảy ra lỗi khi khởi tạo. Hãy tải lại trang.");
    }
}

function createSky() {

    // Gradient sky dome: không còn một màu xám phẳng.
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "#18344f");
    gradient.addColorStop(0.42, "#527995");
    gradient.addColorStop(0.78, "#8ea7b8");
    gradient.addColorStop(1, "#c2cbd1");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);

    const skyTexture = new THREE.CanvasTexture(canvas);
    skyTexture.magFilter = THREE.LinearFilter;
    skyTexture.minFilter = THREE.LinearFilter;
    skyTexture.generateMipmaps = false;

    const geometry = new THREE.SphereGeometry(500, 32, 16);
    const material = new THREE.MeshBasicMaterial({
        map: skyTexture,
        side: THREE.BackSide,
        depthWrite: false
    });

    GAME.sky = new THREE.Mesh(geometry, material);
    GAME.sky.renderOrder = -10;
    GAME.sky.frustumCulled = false;
    GAME.scene.add(GAME.sky);
}

function createLights() {

    const ambient =
        new THREE.AmbientLight(
            0xc7d3dc,
            0.72
        );

    GAME.scene.add(
        ambient
    );

    const sun =
        new THREE.DirectionalLight(
            0xffffff,
            1.35
        );

    sun.position.set(
        100,
        180,
        80
    );

    sun.castShadow = true;

    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;

    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 500;

    GAME.scene.add(
        sun
    );
}

function setupInput() {

    window.addEventListener("keydown", e => {
        if (e.code === "KeyW") PLAYER.player.input.forward = 1;
        if (e.code === "KeyS") PLAYER.player.input.forward = -1;
        if (e.code === "KeyA") PLAYER.player.input.right = -1;
        if (e.code === "KeyD") PLAYER.player.input.right = 1;
        if (e.code === "Space") PLAYER.player.input.jump = true;
        if (e.code === "KeyO") PLAYER.useOxygenTank();
        if (e.code === "KeyE") toggleCraftMenu();
        if (e.code === "Escape" || e.code === "KeyP") document.getElementById("gameSettingsButton")?.click();

        if (e.key >= "1" && e.key <= "9") {
            selectHotbar(Number(e.key) - 1);
        } else if (e.key === "0") {
            selectHotbar(9);
        }
    });

    window.addEventListener("keyup", e => {
        if (e.code === "KeyW" || e.code === "KeyS") {
            PLAYER.player.input.forward = 0;
        }
        if (e.code === "KeyA" || e.code === "KeyD") {
            PLAYER.player.input.right = 0;
        }
    });

    setupJoystick();
    setupWorldInteraction();

    const jump = document.getElementById("jump");
    jump.addEventListener("pointerdown", e => {
        e.preventDefault();
        PLAYER.player.input.jump = true;
    }, { passive: false });
}

function setupJoystick() {
    const joystick = document.getElementById("joystick");
    const stick = document.getElementById("stick");
    let activePointer = null;
    let touchActive = false;

    function reset() {
        activePointer = null;
        touchActive = false;
        stick.style.transform = "translate(0,0)";
        PLAYER.player.input.right = 0;
        PLAYER.player.input.forward = 0;
    }

    function move(clientX, clientY) {
        const rect = joystick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const max = 38;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const length = Math.hypot(dx, dy);
        if (length > max) {
            dx = dx / length * max;
            dy = dy / length * max;
        }
        stick.style.transform = `translate(${dx}px,${dy}px)`;
        PLAYER.player.input.right = dx / max;
        PLAYER.player.input.forward = -dy / max;
    }

    joystick.addEventListener("pointerdown", e => {
        e.preventDefault();
        activePointer = e.pointerId;
        joystick.setPointerCapture?.(e.pointerId);
        move(e.clientX, e.clientY);
    }, { passive: false });

    joystick.addEventListener("pointermove", e => {
        if (e.pointerId !== activePointer) return;
        e.preventDefault();
        move(e.clientX, e.clientY);
    }, { passive: false });

    joystick.addEventListener("pointerup", reset, { passive: true });
    joystick.addEventListener("pointercancel", reset, { passive: true });
    joystick.addEventListener("lostpointercapture", reset, { passive: true });

    // Android/WebView fallback. Some editor previews occasionally fail to deliver
    // PointerEvents consistently, so native touch events are supported as well.
    joystick.addEventListener("touchstart", e => {
        e.preventDefault();
        if (!e.touches.length) return;
        touchActive = true;
        const t = e.touches[0];
        move(t.clientX, t.clientY);
    }, { passive: false });

    joystick.addEventListener("touchmove", e => {
        if (!touchActive || !e.touches.length) return;
        e.preventDefault();
        const t = e.touches[0];
        move(t.clientX, t.clientY);
    }, { passive: false });

    joystick.addEventListener("touchend", e => {
        e.preventDefault();
        reset();
    }, { passive: false });
    joystick.addEventListener("touchcancel", e => {
        e.preventDefault();
        reset();
    }, { passive: false });
}

function setupWorldInteraction() {
    // Advanced Touch Controller v2
    // - Tap: tự chọn ATTACK / PLACE / SKILL
    // - Hold: MINE
    // - Swipe: LOOK
    // - Pointer Events + Touch fallback
    // - Hỗ trợ nhiều ngón: joystick không cướp ngón đang nhìn
    // - Không dùng nút Đập/Đặt riêng
    const canvas = GAME.renderer.domElement;
    canvas.style.touchAction = 'none';
    const LOOK_ZONE = 0.32;
    const TAP_SLOP = 14;
    const HOLD_MS = 280;
    const CAMERA_SENS_X = 0.0062;
    const CAMERA_SENS_Y = 0.0038;
    let active = null;
    let touchFallbackId = null;

    const haptic = (ms = 8) => {
        try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {}
    };

    function isUiTarget(target) {
        return !!(target && target.closest && target.closest(
            '#joystick, #jump, #hotbar, #swordSkillBar, #swordSkillHint, #craftButton, #craftMenu, #inventoryButton, #inventoryMenu, #preview, #touchControls, button, input, select, textarea, a'
        ));
    }

    function inLookZone(x) { return x >= innerWidth * LOOK_ZONE; }

    function stopMining() {
        GAME.mining = false;
        GAME.miningTarget = null;
        GAME.miningProgress = 0;
        clearCrackOverlay();
        PLAYER.setMiningAnimation(false, 0.06);
    }

    function clearHold(state) {
        if (state?.holdTimer) {
            clearTimeout(state.holdTimer);
            state.holdTimer = null;
        }
    }

    function beginMining(state) {
        if (!state || state.mode !== 'PENDING') return;
        const aim = getAimBlock();
        if (!aim || aim.distance > 12) return;
        state.mode = 'MINING';
        GAME.mining = true;
        haptic(10);
    }

    function beginLook(state, x, y) {
        if (!state) return;
        clearHold(state);
        if (state.mode === 'MINING') stopMining();
        state.mode = 'LOOK';
        state.lastX = x;
        state.lastY = y;
    }

    function lookMove(state, x, y) {
        if (!state || state.mode !== 'LOOK') return;
        const dx = x - state.lastX;
        const dy = y - state.lastY;
        state.lastX = x;
        state.lastY = y;
        PLAYER.player.yaw -= dx * CAMERA_SENS_X;
        PLAYER.player.pitch = THREE.MathUtils.clamp(
            PLAYER.player.pitch - dy * CAMERA_SENS_Y,
            -0.95, 0.62
        );
    }

    function finish(state) {
        if (!state) return;
        clearHold(state);
        const mode = state.mode;
        const travel = Math.hypot(state.lastX - state.startX, state.lastY - state.startY);
        active = null;

        if (mode === 'MINING') {
            stopMining();
            return;
        }
        if (mode === 'LOOK' || travel > TAP_SLOP) return;

        // Tap action: mob/skill/block are resolved from the crosshair.
        if (performUnifiedTapAction()) haptic(8);
    }

    function cancel(state) {
        if (!state) return;
        clearHold(state);
        stopMining();
        active = null;
    }

    function pointerStart(e) {
        if (isUiTarget(e.target)) return;
        if (e.pointerType !== 'mouse' && !inLookZone(e.clientX)) return;
        if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
        if (active) return;
        e.preventDefault();

        // Right-click on desktop = immediate action.
        if (e.pointerType === 'mouse' && e.button === 2) {
            performUnifiedTapAction();
            haptic(8);
            return;
        }

        active = {
            id: e.pointerId,
            mode: 'PENDING',
            startX: e.clientX,
            startY: e.clientY,
            lastX: e.clientX,
            lastY: e.clientY,
            holdTimer: null
        };
        canvas.setPointerCapture?.(e.pointerId);
        active.holdTimer = setTimeout(() => {
            if (active?.id === e.pointerId && active.mode === 'PENDING') beginMining(active);
        }, HOLD_MS);
    }

    function pointerMove(e) {
        if (!active || e.pointerId !== active.id) return;
        e.preventDefault();
        const dx = e.clientX - active.startX;
        const dy = e.clientY - active.startY;
        if (active.mode === 'PENDING' && Math.hypot(dx, dy) > TAP_SLOP) {
            beginLook(active, e.clientX, e.clientY);
        }
        if (active.mode === 'LOOK' || active.mode === 'MINING') {
            lookMove(active, e.clientX, e.clientY);
        }
    }

    function pointerEnd(e) {
        if (!active || e.pointerId !== active.id) return;
        finish(active);
    }

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', pointerStart, { passive:false });
    canvas.addEventListener('pointermove', pointerMove, { passive:false });
    canvas.addEventListener('pointerup', pointerEnd, { passive:false });
    canvas.addEventListener('pointercancel', e => cancel(active), { passive:true });

    // Touch fallback for older Android/WebView/Spck previews.
    canvas.addEventListener('touchstart', e => {
        if (touchFallbackId !== null || active) return;
        const t = Array.from(e.changedTouches).find(x => !isUiTarget(document.elementFromPoint(x.clientX, x.clientY)) && inLookZone(x.clientX));
        if (!t) return;
        e.preventDefault();
        touchFallbackId = t.identifier;
        active = {
            id: t.identifier, mode:'PENDING',
            startX:t.clientX, startY:t.clientY,
            lastX:t.clientX, lastY:t.clientY, holdTimer:null
        };
        active.holdTimer = setTimeout(() => {
            if (active?.id === t.identifier && active.mode === 'PENDING') beginMining(active);
        }, HOLD_MS);
    }, { passive:false });

    canvas.addEventListener('touchmove', e => {
        if (touchFallbackId === null || !active) return;
        const t = Array.from(e.changedTouches).find(x => x.identifier === touchFallbackId);
        if (!t) return;
        e.preventDefault();
        const dx = t.clientX - active.startX;
        const dy = t.clientY - active.startY;
        if (active.mode === 'PENDING' && Math.hypot(dx,dy) > TAP_SLOP) beginLook(active,t.clientX,t.clientY);
        if (active.mode === 'LOOK' || active.mode === 'MINING') lookMove(active,t.clientX,t.clientY);
    }, { passive:false });

    canvas.addEventListener('touchend', e => {
        const t = Array.from(e.changedTouches).find(x => x.identifier === touchFallbackId);
        if (!t) return;
        e.preventDefault();
        touchFallbackId = null;
        finish(active);
    }, { passive:false });

    canvas.addEventListener('touchcancel', e => {
        touchFallbackId = null;
        cancel(active);
    }, { passive:false });

    // Prevent browser gestures such as pull-to-refresh/selection over the game.
    document.addEventListener('gesturestart', e => e.preventDefault(), { passive:false });
    document.addEventListener('gesturechange', e => e.preventDefault(), { passive:false });
    document.addEventListener('gestureend', e => e.preventDefault(), { passive:false });

    // Legacy buttons are intentionally removed; the world itself is the action surface.
    document.getElementById('mineButton')?.remove();
    document.getElementById('placeButton')?.remove();
}


function getAimBlock() {
    // Tương tác block được tính từ VỊ TRÍ NGƯỜI CHƠI, không phải từ camera.
    // Camera chỉ xác định hướng nhìn; điểm bắt đầu của ray luôn ở vùng mắt/ngực
    // của player. Điều này tránh lỗi third-person: camera đứng cách player vài
    // block khiến tia đập/đặt xuất phát từ camera thay vì nhân vật.
    if (!GAME.camera || !WORLD || !WORLD.getBlock || !PLAYER?.player) return null;

    const player = PLAYER.player;
    const origin = player.position.clone();
    origin.y += 1.35; // gần vị trí mắt của nhân vật cao ~2 block

    // Lấy hướng từ player tới điểm mà tâm crosshair đang nhìn tới.
    // Nếu không có điểm giao xa, dùng hướng yaw/pitch của player.
    const cameraOrigin = GAME.camera.getWorldPosition(new THREE.Vector3());
    const cameraDir = GAME.camera.getWorldDirection(new THREE.Vector3()).normalize();
    const lookPoint = cameraOrigin.clone().add(cameraDir.clone().multiplyScalar(24));
    const direction = lookPoint.sub(origin).normalize();

    const MAX_DIST = 12;

    let x = Math.floor(origin.x + 0.5);
    let y = Math.floor(origin.y + 0.5);
    let z = Math.floor(origin.z + 0.5);

    // Không cho ray bắt chính block đang chứa thân người chơi.
    // Bắt đầu DDA từ voxel kế tiếp theo hướng ray.
    const stepX = direction.x >= 0 ? 1 : -1;
    const stepY = direction.y >= 0 ? 1 : -1;
    const stepZ = direction.z >= 0 ? 1 : -1;

    const inf = Infinity;
    const tDeltaX = Math.abs(direction.x) > 1e-8 ? 1 / Math.abs(direction.x) : inf;
    const tDeltaY = Math.abs(direction.y) > 1e-8 ? 1 / Math.abs(direction.y) : inf;
    const tDeltaZ = Math.abs(direction.z) > 1e-8 ? 1 / Math.abs(direction.z) : inf;

    const nextBoundaryX = stepX > 0 ? (x + 0.5) : (x - 0.5);
    const nextBoundaryY = stepY > 0 ? (y + 0.5) : (y - 0.5);
    const nextBoundaryZ = stepZ > 0 ? (z + 0.5) : (z - 0.5);

    let tMaxX = Math.abs(direction.x) > 1e-8 ? (nextBoundaryX - origin.x) / direction.x : inf;
    let tMaxY = Math.abs(direction.y) > 1e-8 ? (nextBoundaryY - origin.y) / direction.y : inf;
    let tMaxZ = Math.abs(direction.z) > 1e-8 ? (nextBoundaryZ - origin.z) / direction.z : inf;

    let previous = new THREE.Vector3(x, y, z);
    let distance = 0;

    for (let i = 0; i < 128; i++) {
        let normal;
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
            x += stepX;
            distance = tMaxX;
            tMaxX += tDeltaX;
            normal = new THREE.Vector3(-stepX, 0, 0);
        } else if (tMaxY < tMaxZ) {
            y += stepY;
            distance = tMaxY;
            tMaxY += tDeltaY;
            normal = new THREE.Vector3(0, -stepY, 0);
        } else {
            z += stepZ;
            distance = tMaxZ;
            tMaxZ += tDeltaZ;
            normal = new THREE.Vector3(0, 0, -stepZ);
        }

        if (distance > MAX_DIST) break;

        const block = WORLD.getBlock(x, y, z);
        if (block !== 0) {
            return {
                breakPos: new THREE.Vector3(x, y, z),
                placePos: previous.clone(),
                normal,
                distance
            };
        }

        previous.set(x, y, z);
    }

    return null;
}

function isInsidePlayer(x, y, z) {
    const p = PLAYER.player.position;
    // World voxels are centered on integer coordinates. Keep the placement
    // collision test in the same coordinate system as the mesher and DDA.
    return Math.abs(x - p.x) < 0.85 &&
           Math.abs(z - p.z) < 0.85 &&
           y + 0.5 > p.y - 0.05 &&
           y - 0.5 < p.y + 2.0;
}

function getCrosshairMob(maxDistance = 5) {
    if (typeof MOB_SYSTEM === "undefined") return null;

    const camera = GAME.camera;
    if (!camera) return null;

    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir).normalize();
    const origin = camera.getWorldPosition(new THREE.Vector3());

    let best = null;
    const hitPoint = new THREE.Vector3();

    for (const mob of GAME.mobs || []) {
        if (mob.dead || !mob.object) continue;

        // The range is measured from the player for gameplay consistency,
        // while the aim itself is measured from the camera/crosshair.
        const playerDistance = PLAYER.player.position.distanceTo(mob.position);
        const allowedPlayerDistance = maxDistance + 1.15;
        if (playerDistance > allowedPlayerDistance) continue;

        let hitDistance = Infinity;

        // 1) Exact mesh hit when possible.
        const hits = ray.intersectObject(mob.object, true);
        if (hits.length) hitDistance = hits[0].distance;

        // 2) Robust gameplay aim volume. This works even when the GLB has
        // thin parts, unusual pivots, or the crosshair does not hit a mesh.
        const aimCenter = mob.position.clone();
        aimCenter.y += mob.type === "warden" ? 0.95 : (mob.type === "training_dummy" ? 1.15 : 1.0);
        const toTarget = aimCenter.clone().sub(origin);
        const forwardDistance = toTarget.dot(viewDir);
        if (forwardDistance > 0 && forwardDistance <= maxDistance + 1.5) {
            const perp = Math.sqrt(Math.max(0, toTarget.lengthSq() - forwardDistance * forwardDistance));
            const aimRadius = mob.type === "warden" ? 0.92 : (mob.type === "training_dummy" ? 0.95 : 1.05);
            if (perp <= aimRadius) {
                const point = origin.clone().addScaledVector(viewDir, forwardDistance);
                hitPoint.copy(point);
                hitDistance = Math.min(hitDistance, forwardDistance);
            }
        }

        // 3) Sphere fallback around the gameplay hitbox.
        const sphereCenter = mob.position.clone();
        sphereCenter.y += mob.collisionBox?.height ? mob.collisionBox.height * 0.55 : 0.95;
        const sphereRadius = mob.type === "warden" ? 0.9 : (mob.type === "training_dummy" ? 0.95 : 1.05);
        const sphere = new THREE.Sphere(sphereCenter, sphereRadius);
        if (ray.ray.intersectSphere(sphere, hitPoint)) {
            const d = origin.distanceTo(hitPoint);
            if (d <= maxDistance + 1.5) hitDistance = Math.min(hitDistance, d);
        }

        if (Number.isFinite(hitDistance) && hitDistance <= maxDistance + 1.5) {
            // Prefer the mob closest to the crosshair, then the nearest one.
            const score = hitDistance + playerDistance * 0.002;
            if (!best || score < best.score) best = { mob, distance: playerDistance, score };
        }
    }

    return best;
}

// Original hit feedback for this game: a short crimson energy flash on the
// creature that was hit. It is intentionally implemented with our own visual
// treatment rather than copying another game's damage effect.
function flashMobDamage(mob) {
    if (!mob || !mob.object) return;
    if (mob.__damageFlashTimer) clearTimeout(mob.__damageFlashTimer);

    const saved = [];
    mob.object.traverse(node => {
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        if (!node.isMesh) return;
        mats.forEach(mat => {
            if (!mat || !mat.color) return;
            saved.push({
                mat,
                color: mat.color.clone(),
                emissive: mat.emissive ? mat.emissive.clone() : null,
                emissiveIntensity: mat.emissiveIntensity
            });
            mat.color.setHex(0xff4a4a);
            if (mat.emissive) mat.emissive.setHex(0x7a1111);
            if ("emissiveIntensity" in mat) mat.emissiveIntensity = Math.max(0.8, Number(mat.emissiveIntensity || 0));
        });
    });

    mob.__damageFlashTimer = setTimeout(() => {
        for (const item of saved) {
            if (!item.mat) continue;
            item.mat.color.copy(item.color);
            if (item.mat.emissive && item.emissive) item.mat.emissive.copy(item.emissive);
            if ("emissiveIntensity" in item.mat) item.mat.emissiveIntensity = item.emissiveIntensity;
        }
        mob.__damageFlashTimer = null;
    }, 105);
}

const SWORD_COMBAT = {
    attackCooldown: 0,
    skillCooldown: 0,
    skillActive: false,
    skillElapsed: 0,
    skillBusy: false,
    skillSwords: [],
    skillVisual: null,
    SWORD_COUNT: 144,
    SKILL_DURATION: 20,
    SKILL_COOLDOWN: 60,
    SKILL_DAMAGE: 24,
    SKILL_TARGET_RANGE: 40,
    SWORD_COLLISION_RADIUS: 0.52,

    update(delta) {
        this.attackCooldown = Math.max(0, this.attackCooldown - delta);
        this.skillCooldown = Math.max(0, this.skillCooldown - delta);
        if (this.skillActive) {
            this.skillElapsed += delta;
            if (this.skillElapsed >= this.SKILL_DURATION) {
                this.endSkill();
            } else {
                this.updateSkillVisual(delta);
            }
        }
    },

    isSwordSelected() { return GAME.hotbarItems[GAME.selectedSlot] === "quy_tinh_sword"; },

    normalAttack() {
        if (!this.isSwordSelected() || this.attackCooldown > 0 || this.skillActive) return false;
        const target = getCrosshairMob(2.5);
        if (!target) return false;
        this.attackCooldown = 0.55;
        if (window.MULTIPLAYER?.enabled && target.mob.networkId && NETWORK.mobSync) { NETWORK.mobSync.attack(target.mob.networkId,"quy_tinh_sword"); return true; }
        MOB_SYSTEM.damage(target.mob, 8, "sword");
        flashMobDamage(target.mob);
        PLAYER.setMiningAnimation(true, 0.08);
        setTimeout(() => PLAYER.setMiningAnimation(false, 0.08), 110);
        return true;
    },

    activateSkill() {
        if (!this.isSwordSelected() || this.skillCooldown > 0 || this.skillActive) return false;
        this.skillCooldown = this.SKILL_COOLDOWN;
        this.skillActive = true;
        this.skillElapsed = 0;
        this.skillBusy = false;
        this.createSkillVisual();
        updateSwordSkillButton();
        return true;
    },

    launchAtCrosshair() {
        if (!this.skillActive) return false;
        const target = getCrosshairMob(this.SKILL_TARGET_RANGE);
        if (!target) return false;
        this.launchAllAt(target.mob);
        return true;
    },

    launchAllAt(targetMob) {
        if (!this.skillActive || !targetMob || targetMob.dead) return false;
        let launched = 0;
        const target = targetMob.position.clone();
        target.y += Math.max(0.55, (targetMob.collisionBox?.height || 1.4) * 0.55);
        this.triggerLaunchLight(target);
        for (const sword of this.skillSwords) {
            if (sword.dead || sword.mode === "flying") continue;
            sword.mode = "flying";
            sword.start = sword.position.clone();
            sword.target = target.clone();
            sword.elapsed = 0;
            sword.duration = Math.max(0.22, sword.start.distanceTo(target) / 18);
            sword.offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.35,
                (Math.random() - 0.5) * 0.55,
                (Math.random() - 0.5) * 0.35
            );
            launched++;
        }
        return launched > 0;
    },

    damageMob(mob, amount) {
        if (!mob || mob.dead) return;
        MOB_SYSTEM.damage(mob, amount, "skill");
        flashMobDamage(mob);
    },

    createSkillVisual() {
        this.disposeSkillVisual();
        const visual = {
            root: new THREE.Group(),
            parts: [],
            lightRig: new THREE.Group(),
            glowRing: null,
            pulseRing: null,
            targetLight: null,
            targetGlow: null,
            targetLightTimer: 0,
            pulseTime: 0,
            helper: new THREE.Object3D(),
            fade: 0,
            count: this.SWORD_COUNT
        };
        visual.root.name = "VanKiemQuyTong_144_Swords";
        GAME.scene.add(visual.root);

        // Dùng CHÍNH mô hình Kiếm Quy Tinh đang cầm làm mẫu cho kiếm bay.
        // Nhờ vậy kiếm bay và kiếm trên tay luôn giống nhau về hình học/chi tiết,
        // thay vì có hai model khác nhau.
        const prototype = PLAYER.makeHeldModel("quy_tinh_sword");
        prototype.updateMatrixWorld(true);
        const invRoot = new THREE.Matrix4().copy(visual.root.matrixWorld).invert();
        prototype.traverse(mesh => {
            if (!mesh.isMesh || !mesh.geometry || !mesh.material) return;
            mesh.updateMatrixWorld(true);
            const localMatrix = new THREE.Matrix4().multiplyMatrices(invRoot, mesh.matrixWorld);
            const geometry = mesh.geometry.clone();
            const material = Array.isArray(mesh.material)
                ? mesh.material.map(m => m.clone())
                : mesh.material.clone();
            const inst = new THREE.InstancedMesh(geometry, material, visual.count);
            inst.frustumCulled = false;
            inst.castShadow = false;
            inst.receiveShadow = false;
            const mats = Array.isArray(material) ? material : [material];
            mats.forEach(m => {
                m.transparent = true;
                m.opacity = 0;
                m.depthWrite = false;
            });
            visual.root.add(inst);
            visual.parts.push({ mesh: inst, localMatrix });
        });
        // prototype chỉ là nguồn hình học; các bản sao InstancedMesh đã giữ dữ liệu riêng.
        prototype.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => m?.dispose?.());
            }
        });

        // Mobile-friendly lighting: dùng một rig nhỏ thay vì một light cho mỗi kiếm.
        const lightColors = [0x5f8dff, 0x8b5cff, 0x6fd7ff, 0x6b4cff];
        for (let i = 0; i < 4; i++) {
            const light = new THREE.PointLight(lightColors[i], 0.72, 6.5, 2);
            light.position.set(Math.cos(i * Math.PI / 2) * 4.8, 1.25, Math.sin(i * Math.PI / 2) * 4.8);
            visual.lightRig.add(light);
        }
        const coreLight = new THREE.PointLight(0x7b63ff, 1.0, 7.5, 2);
        coreLight.position.set(0, 1.0, 0);
        visual.lightRig.add(coreLight);
        visual.root.add(visual.lightRig);

        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x6f8dff, transparent: true, opacity: 0.18,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        visual.glowRing = new THREE.Mesh(new THREE.TorusGeometry(4.85, 0.025, 6, 64), ringMat);
        visual.glowRing.rotation.x = Math.PI / 2;
        visual.root.add(visual.glowRing);

        const pulseMat = new THREE.MeshBasicMaterial({
            color: 0x9d7cff, transparent: true, opacity: 0.28,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        visual.pulseRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.018, 5, 48), pulseMat);
        visual.pulseRing.rotation.x = Math.PI / 2;
        visual.root.add(visual.pulseRing);

        const playerPos = PLAYER.player.position.clone();
        this.skillSwords = [];
        for (let i=0;i<visual.count;i++) {
            const angle = (i/visual.count)*Math.PI*2;
            const radius = 4.15 + ((i*37)%19)/19*1.15;
            const y = 0.62 + ((i*17)%11)/10*1.45;
            const p = new THREE.Vector3(
                playerPos.x + Math.cos(angle)*radius,
                playerPos.y + y,
                playerPos.z + Math.sin(angle)*radius
            );
            this.skillSwords.push({
                index:i, angle, radius, y, position:p.clone(),
                mode:"orbit", dead:false, phase:(i%17)*0.19,
                scale:0.82 + ((i*13)%9)/20,
                alpha:0
            });
        }
        this.skillVisual = visual;
        this.updateSkillVisual(0);
    },

    triggerLaunchLight(target) {
        const visual = this.skillVisual;
        if (!visual) return;

        // Xóa sạch hiệu ứng cũ trước khi tạo hiệu ứng mới.
        this.clearLaunchLight();

        const glowMat = new THREE.MeshBasicMaterial({
            color: 0x9b7cff, transparent: true, opacity: 0.72,
            blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        visual.targetGlow = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), glowMat);
        visual.targetGlow.position.copy(target);
        GAME.scene.add(visual.targetGlow);

        visual.targetLight = new THREE.PointLight(0x8f6cff, 3.2, 5.5, 2);
        visual.targetLight.position.copy(target);
        GAME.scene.add(visual.targetLight);
        visual.targetPulse = 0.28;
        visual.targetLightTimer = 0.28;
    },

    clearLaunchLight() {
        const visual = this.skillVisual;
        if (!visual) return;
        if (visual.targetLight && GAME.scene) GAME.scene.remove(visual.targetLight);
        if (visual.targetGlow && GAME.scene) GAME.scene.remove(visual.targetGlow);
        if (visual.targetGlow) {
            visual.targetGlow.geometry?.dispose?.();
            visual.targetGlow.material?.dispose?.();
        }
        visual.targetLight = null;
        visual.targetGlow = null;
        visual.targetPulse = 0;
        visual.targetLightTimer = 0;
    },

    updateSkillVisual(delta) {
        const visual = this.skillVisual;
        if (!visual) return;
        visual.fade = Math.min(1, visual.fade + delta / 1.15);
        const fade = 1 - Math.pow(1 - visual.fade, 3);
        const playerPos = PLAYER.player.position;
        const now = performance.now() * 0.001;
        const up = new THREE.Vector3(0,1,0);

        visual.lightRig.position.copy(playerPos);
        const lightPulse = 0.88 + Math.sin(now * 4.2) * 0.14;
        visual.lightRig.children.forEach((light, i) => {
            light.intensity = (i === 4 ? 1.0 : 0.72) * fade * lightPulse;
        });
        visual.glowRing.position.copy(playerPos);
        visual.glowRing.material.opacity = 0.13 + fade * 0.10 + Math.sin(now * 3.2) * 0.025;
        visual.glowRing.scale.setScalar(1 + Math.sin(now * 2.0) * 0.025);
        visual.pulseTime += delta;
        if (visual.pulseTime > 1.15) visual.pulseTime = 0;
        const pulse = visual.pulseTime / 1.15;
        visual.pulseRing.position.copy(playerPos);
        visual.pulseRing.scale.setScalar(0.9 + pulse * 2.2);
        visual.pulseRing.material.opacity = Math.max(0, (1 - pulse) * 0.30 * fade);

        if (visual.targetLightTimer > 0) {
            visual.targetLightTimer = Math.max(0, visual.targetLightTimer - delta);
            const t = visual.targetLightTimer / 0.28;
            if (visual.targetLight) visual.targetLight.intensity = 3.2 * t;
            if (visual.targetGlow) {
                visual.targetGlow.material.opacity = 0.72 * t;
                visual.targetGlow.scale.setScalar(1 + (1 - t) * 2.6);
            }
            if (visual.targetLightTimer <= 0) this.clearLaunchLight();
        }

        for (const sword of this.skillSwords) {
            if (sword.dead) {
                const zero = new THREE.Matrix4().makeScale(0,0,0);
                for (const part of visual.parts) part.mesh.setMatrixAt(sword.index, zero);
                continue;
            }

            if (sword.mode === "orbit") {
                sword.angle += delta * 0.72;
                const bob = Math.sin(now * 2.2 + sword.phase) * 0.055;
                sword.position.set(
                    playerPos.x + Math.cos(sword.angle) * sword.radius,
                    playerPos.y + sword.y + bob,
                    playerPos.z + Math.sin(sword.angle) * sword.radius
                );
                // Bảo vệ dạng vòng: lưỡi nghiêng nhẹ theo hướng xuyên tâm.
                sword.quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(.32, -sword.angle, 0));
            } else if (sword.mode === "flying") {
                sword.elapsed += delta;
                const p = Math.min(1, sword.elapsed / sword.duration);
                const e = 1 - Math.pow(1-p, 3);
                const target = sword.target.clone().add(sword.offset);
                sword.position.lerpVectors(sword.start, target, e);
                const dir = target.clone().sub(sword.position);
                if (dir.lengthSq() > 0.0001) {
                    sword.quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
                }

                const hit = this.findSwordHit(sword);
                if (hit) {
                    this.damageMob(hit, this.SKILL_DAMAGE);
                    sword.dead = true;
                } else if (p >= 1) {
                    sword.dead = true;
                }
            }

            const q = sword.quat || new THREE.Quaternion();
            const scale = sword.scale * fade;
            this.skillVisual.helper.position.copy(sword.position);
            this.skillVisual.helper.quaternion.copy(q);
            this.skillVisual.helper.scale.setScalar(scale);
            this.skillVisual.helper.updateMatrix();
            for (const part of visual.parts) {
                const worldMatrix = new THREE.Matrix4().multiplyMatrices(this.skillVisual.helper.matrix, part.localMatrix);
                part.mesh.setMatrixAt(sword.index, worldMatrix);
            }
        }
        for (const part of visual.parts) {
            const mats = Array.isArray(part.mesh.material) ? part.mesh.material : [part.mesh.material];
            mats.forEach(m => { m.opacity = fade; });
            part.mesh.instanceMatrix.needsUpdate = true;
        }

    },

    findSwordHit(sword) {
        const r = this.SWORD_COLLISION_RADIUS;
        for (const mob of GAME.mobs || []) {
            if (mob.dead || !mob.object) continue;
            if (mob.dimension && mob.dimension !== GAME.dimension) continue;
            const center = mob.position.clone();
            center.y += Math.max(.45, (mob.collisionBox?.height || 1.4) * .5);
            const rr = r + Math.max(.25, (mob.collisionBox?.width || .55) * .45);
            if (sword.position.distanceToSquared(center) <= rr*rr) return mob;
        }
        return null;
    },

    endSkill() {
        this.skillActive = false;
        this.skillBusy = false;
        this.skillElapsed = this.SKILL_DURATION;
        this.disposeSkillVisual();
        updateSwordSkillButton();
    },

    disposeSkillVisual() {
        if (!this.skillVisual) { this.skillSwords = []; return; }
        const root = this.skillVisual.root;
        this.clearLaunchLight();
        if (root && GAME.scene) GAME.scene.remove(root);
        root?.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => m?.dispose?.());
            }
        });
        this.skillVisual = null;
        this.skillSwords = [];
    }
};


const EXTRA_SWORD_SKILLS = {
    ngu: {
        cooldown: 0,
        elapsed: 0,
        active: false,
        duration: Infinity,
        cooldownMax: 0,
        speed: 9,
        rideHeight: 0,
        baseRideHeight: 0,
        flyVelocity: 0,
        flyOffset: 0,
        root: null,
        sword: null,
        light: null,
        baseSpeed: 5,
        activate() {
            if (!SWORD_COMBAT.isSwordSelected() || this.cooldown > 0) return false;
            if (this.active) {
                this.end();
                return true;
            }
            this.active = true;
            this.elapsed = 0;
            this.cooldown = this.cooldownMax;
            this.baseSpeed = Number(PLAYER.player.speed || 5);
            this.baseRideHeight = PLAYER.player.position.y + 0.78;
            this.rideHeight = this.baseRideHeight;
            this.flyVelocity = 0;
            this.flyOffset = 0;
            this.createVisual();
            updateExtraSwordSkillUI();
            return true;
        },
        disposeVisual() {
            if (this.root?.parent) this.root.parent.remove(this.root);
            if (this.root) {
                this.root.traverse(o => {
                    if (o.geometry) o.geometry.dispose();
                    if (o.material) {
                        const mats = Array.isArray(o.material) ? o.material : [o.material];
                        mats.forEach(m => m?.dispose?.());
                    }
                });
            }
            this.root = null;
            this.sword = null;
            this.light = null;
        },
        createVisual() {
            this.disposeVisual();
            const root = new THREE.Group();
            root.name = "NguKiem_RideSword";
            const sword = PLAYER.makeHeldModel("quy_tinh_sword");
            sword.scale.setScalar(1.18);
            sword.rotation.x = -Math.PI / 2;
            sword.rotation.y = Math.PI;
            sword.position.set(0, -0.58, 0.18);
            root.add(sword);
            const ringMat = new THREE.MeshBasicMaterial({
                color: 0x6f8dff, transparent: true, opacity: 0.42,
                blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 32), ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -0.20;
            root.add(ring);
            this.light = new THREE.PointLight(0x6d7dff, 1.4, 5.5, 2);
            this.light.position.set(0, -0.25, 0);
            root.add(this.light);
            GAME.scene.add(root);
            this.root = root;
            this.sword = sword;
        },
        beforePlayerUpdate() {
            if (!this.active) return;
            PLAYER.player.speed = this.speed;
            PLAYER.player.velocity.y = 0;

            // Nút Nhảy khi đang Ngự Kiếm trở thành một cú nâng kiếm ngắn,
            // thay vì phụ thuộc vào grounded của hệ thống đi bộ.
            if (PLAYER.player.input.jump) {
                this.flyVelocity = 4.8;
                PLAYER.player.input.jump = false;
            }
        },
        afterPlayerUpdate(delta) {
            if (!this.active) return;
            this.elapsed += delta;

            // Độ cao cơ bản tự thích nghi với địa hình: nếu đi tới nền cao hơn,
            // kiếm nâng người chơi lên để không xuyên qua block; khi đi xuống,
            // nó có thể trở về độ cao ban đầu.
            const px = PLAYER.player.position.x;
            const pz = PLAYER.player.position.z;
            const half = 0.34;
            let groundTop = -Infinity;
            const minX = Math.floor(px - half + 0.5);
            const maxX = Math.floor(px + half + 0.5);
            const minZ = Math.floor(pz - half + 0.5);
            const maxZ = Math.floor(pz + half + 0.5);
            const scanTop = Math.floor(Math.max(PLAYER.player.position.y, this.rideHeight) + 1);
            const scanBottom = Math.max(-1, scanTop - 18);
            for (let bx = minX; bx <= maxX; bx++) {
                for (let bz = minZ; bz <= maxZ; bz++) {
                    for (let by = scanTop; by >= scanBottom; by--) {
                        if (WORLD.isSolid(bx, by, bz)) {
                            groundTop = Math.max(groundTop, by + 0.5);
                            break;
                        }
                    }
                }
            }
            const terrainHeight = groundTop > -Infinity ? groundTop + 0.82 : -Infinity;
            this.rideHeight = Math.max(this.baseRideHeight, terrainHeight);

            // Cú nâng từ nút Nhảy tạo một cung bay ngắn khoảng ~1 block.
            this.flyOffset += this.flyVelocity * delta;
            this.flyVelocity = Math.max(0, this.flyVelocity - 12 * delta);
            if (this.flyOffset < 0) this.flyOffset = 0;

            const bob = Math.sin(this.elapsed * 3.4) * 0.045;
            PLAYER.player.position.y = this.rideHeight + this.flyOffset + bob;
            PLAYER.player.velocity.y = 0;
            PLAYER.player.grounded = false;
            if (this.root) {
                this.root.position.copy(PLAYER.player.position);
                this.root.position.y += -0.04;
                this.root.rotation.y = PLAYER.player.yaw;
                const pulse = 0.92 + Math.sin(this.elapsed * 5.5) * 0.08;
                this.root.scale.setScalar(pulse);
                const ring = this.root.children.find(o => o.isMesh && o.geometry?.type === "TorusGeometry");
                if (ring) ring.material.opacity = 0.32 + Math.sin(this.elapsed * 5) * 0.08;
                if (this.light) this.light.intensity = 1.25 + Math.sin(this.elapsed * 5) * 0.25;
            }
            // Ngự Kiếm không tự kết thúc; người chơi nhấn lại nút để tắt.
        },
        end() {
            if (!this.active) return;
            this.active = false;
            PLAYER.player.speed = this.baseSpeed;
            PLAYER.player.velocity.y = 0;
            this.flyVelocity = 0;
            this.flyOffset = 0;
            this.disposeVisual();
            updateExtraSwordSkillUI();
        },
        disposeVisual() {
            if (!this.root) return;
            GAME.scene.remove(this.root);
            this.root.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(m => m?.dispose?.());
                }
            });
            this.root = null;
            this.sword = null;
            this.light = null;
        },
        update(delta) {
            this.cooldown = Math.max(0, this.cooldown - delta);
        }
    },
    vu: {
        cooldown: 0,
        active: false,
        elapsed: 0,
        duration: 6,
        cooldownMax: 25,
        target: null,
        swords: [],
        root: null,
        parts: [],
        helper: null,
        COUNT: 36,
        DAMAGE: 12,
        activate() {
            if (!SWORD_COMBAT.isSwordSelected() || this.active || this.cooldown > 0) return false;
            const aimed = getCrosshairMob(40);
            if (!aimed) return false;
            this.active = true;
            this.elapsed = 0;
            this.cooldown = this.cooldownMax;
            this.target = aimed.mob;
            this.createVisual();
            updateExtraSwordSkillUI();
            return true;
        },
        createVisual() {
            this.disposeVisual();
            const root = new THREE.Group();
            root.name = "KiemVu_36_Swords";
            const prototype = PLAYER.makeHeldModel("quy_tinh_sword");
            prototype.updateMatrixWorld(true);
            const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
            prototype.traverse(mesh => {
                if (!mesh.isMesh || !mesh.geometry || !mesh.material) return;
                mesh.updateMatrixWorld(true);
                const localMatrix = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
                const geometry = mesh.geometry.clone();
                const material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
                const inst = new THREE.InstancedMesh(geometry, material, this.COUNT);
                inst.frustumCulled = false;
                inst.castShadow = false;
                inst.receiveShadow = false;
                const mats = Array.isArray(material) ? material : [material];
                mats.forEach(m => { m.transparent = true; m.opacity = 0.96; m.depthWrite = false; });
                root.add(inst);
                this.parts.push({ mesh: inst, localMatrix });
            });
            prototype.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(m => m?.dispose?.());
                }
            });
            this.root = root;
            this.helper = new THREE.Object3D();
            GAME.scene.add(root);
            this.swords = [];
            const target = this.target.position.clone();
            target.y += Math.max(0.7, (this.target.collisionBox?.height || 1.5) * 0.55);
            for (let i = 0; i < this.COUNT; i++) {
                const a = (i / this.COUNT) * Math.PI * 2;
                const r = 1.4 + ((i * 17) % 29) / 29 * 3.2;
                const start = new THREE.Vector3(
                    target.x + Math.cos(a) * r,
                    target.y + 3.8 + ((i * 11) % 13) / 13 * 2.0,
                    target.z + Math.sin(a) * r
                );
                this.swords.push({
                    index: i, start, target: target.clone(), position: start.clone(),
                    delay: (i % 12) * 0.075, elapsed: 0, dead: false,
                    duration: 0.58 + ((i * 7) % 7) / 20,
                    scale: 0.72 + ((i * 5) % 7) / 16,
                    quat: new THREE.Quaternion()
                });
            }
        },
        update(delta) {
            this.cooldown = Math.max(0, this.cooldown - delta);
            if (!this.active) return;
            this.elapsed += delta;
            if (!this.target || this.target.dead || this.elapsed >= this.duration) {
                this.end();
                return;
            }
            const up = new THREE.Vector3(0, 1, 0);
            for (const sword of this.swords) {
                if (sword.dead) {
                    const zero = new THREE.Matrix4().makeScale(0,0,0);
                    for (const part of this.parts) part.mesh.setMatrixAt(sword.index, zero);
                    continue;
                }
                const localTime = this.elapsed - sword.delay;
                if (localTime <= 0) {
                    sword.position.copy(sword.start);
                } else {
                    const p = Math.min(1, localTime / sword.duration);
                    const e = 1 - Math.pow(1 - p, 3);
                    sword.position.lerpVectors(sword.start, sword.target, e);
                    const dir = sword.target.clone().sub(sword.position);
                    if (dir.lengthSq() > 0.0001) sword.quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize());
                    const hit = this.findHit(sword);
                    if (hit) {
                        if (hit.type === "warden") MOB_SYSTEM.hitWarden(hit, this.DAMAGE);
                        else MOB_SYSTEM.hitRavage(hit, this.DAMAGE);
                        flashMobDamage(hit);
                        sword.dead = true;
                    } else if (p >= 1) sword.dead = true;
                }
                this.helper.position.copy(sword.position);
                this.helper.quaternion.copy(sword.quat);
                this.helper.scale.setScalar(sword.scale);
                this.helper.updateMatrix();
                for (const part of this.parts) {
                    const matrix = new THREE.Matrix4().multiplyMatrices(this.helper.matrix, part.localMatrix);
                    part.mesh.setMatrixAt(sword.index, matrix);
                }
            }
            for (const part of this.parts) part.mesh.instanceMatrix.needsUpdate = true;
        },
        findHit(sword) {
            if (!sword || sword.dead) return null;
            let best = null;
            let bestD = Infinity;
            for (const mob of GAME.mobs || []) {
                if (mob.dead || !mob.object) continue;
                if (mob.dimension && mob.dimension !== GAME.dimension) continue;
                const c = mob.position.clone();
                c.y += Math.max(.45, (mob.collisionBox?.height || 1.4) * .5);
                const r = .62 + Math.max(.25, (mob.collisionBox?.width || .55) * .45);
                const d2 = sword.position.distanceToSquared(c);
                if (d2 <= r*r && d2 < bestD) { best = mob; bestD = d2; }
            }
            return best;
        },
        end() {
            if (!this.active) return;
            this.active = false;
            this.disposeVisual();
            updateExtraSwordSkillUI();
        },
        disposeVisual() {
            if (!this.root) { this.swords = []; this.parts = []; return; }
            GAME.scene.remove(this.root);
            this.root.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(m => m?.dispose?.());
                }
            });
            this.root = null;
            this.swords = [];
            this.parts = [];
            this.helper = null;
            this.target = null;
        }
    }
};


/* =========================================================
   7 KỸ NĂNG KIẾM QUY TINH BỔ SUNG — nguyên bản
   ========================================================= */
const NEW_SWORD_SKILLS = {
    kiemKhi: {
        label:"Kiếm Khí", icon:"➤", cooldown:0, maxCooldown:8, damage:20,
        activate(){
            if(!SWORD_COMBAT.isSwordSelected()||this.cooldown>0)return false;
            const t=getCrosshairMob(40); if(!t)return false;
            this.cooldown=this.maxCooldown;
            const start=PLAYER.player.position.clone(); start.y+=1.25;
            const target=t.mob.position.clone(); target.y+=Math.max(.7,(t.mob.collisionBox?.height||1.4)*.5);
            this.projectile={start,target,elapsed:0,duration:Math.max(.18,start.distanceTo(target)/26),mob:t.mob,dead:false};
            return true;
        },
        update(dt){
            this.cooldown=Math.max(0,this.cooldown-dt); const q=this.projectile; if(!q||q.dead)return;
            q.elapsed+=dt; const p=Math.min(1,q.elapsed/q.duration); const e=1-Math.pow(1-p,3); q.pos=q.start.clone().lerp(q.target,e);
            if(!q.hit && q.mob && !q.mob.dead && q.pos.distanceTo(q.mob.position.clone().setY(q.mob.position.y+.8))<1.0){ NEW_SWORD_SKILLS.damage(q.mob,this.damage); q.hit=true; q.dead=true; }
            if(p>=1)q.dead=true;
            if(q.dead)this.projectile=null;
        }
    },
    kiemTran: {
        label:"Kiếm Trận", icon:"◈", cooldown:0, maxCooldown:30, active:false, elapsed:0, duration:15, swords:[],
        activate(){
            if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0)return false;
            this.active=true; this.elapsed=0; this.cooldown=this.maxCooldown; this.swords=[];
            for(let i=0;i<18;i++)this.swords.push({a:i/18*Math.PI*2,r:3.0+(i%3)*.22,dead:false,hit:new Set()});
            return true;
        },
        update(dt){
            this.cooldown=Math.max(0,this.cooldown-dt); if(!this.active)return;
            this.elapsed+=dt;
            const p=PLAYER.player.position;
            for(const s of this.swords){if(s.dead)continue;s.a+=dt*(1.0+(s.r-3)*.15);const pos=new THREE.Vector3(p.x+Math.cos(s.a)*s.r,p.y+1.05+Math.sin(this.elapsed*2+s.a)*.35,p.z+Math.sin(s.a)*s.r);for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension||s.hit.has(m))continue;if(pos.distanceTo(m.position.clone().setY(m.position.y+.8))<.85){NEW_SWORD_SKILLS.damage(m,10);s.hit.add(m);s.dead=true;break;}}}
            if(this.elapsed>=this.duration)this.end();
        }, end(){this.active=false;this.swords=[];updateNewSwordSkillUI();}
    },
    phiKiem: {
        label:"Phi Kiếm", icon:"➹", cooldown:0, maxCooldown:20, active:false, elapsed:0, count:12, target:null, hit:0,
        activate(){const t=getCrosshairMob(40);if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0||!t)return false;this.active=true;this.elapsed=0;this.cooldown=this.maxCooldown;this.target=t.mob;this.hit=0;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;if(!this.target||this.target.dead||this.hit>=this.count){this.end();return;}const interval=.16;const n=Math.floor(this.elapsed/interval);if(n>this.hit){this.hit=n;NEW_SWORD_SKILLS.damage(this.target,10);this.target.__damageFlashTimer=Date.now();}if(this.elapsed>this.count*interval+.25)this.end();},end(){this.active=false;this.target=null;this.hit=0;updateNewSwordSkillUI();}
    },
    thienKiem: {
        label:"Thiên Kiếm", icon:"↡", cooldown:0, maxCooldown:35, active:false, elapsed:0, target:null, count:24, hit:0,
        activate(){const t=getCrosshairMob(40);if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0||!t)return false;this.active=true;this.elapsed=0;this.cooldown=this.maxCooldown;this.target=t.mob;this.hit=0;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;if(!this.target||this.target.dead){this.end();return;}const n=Math.min(this.count,Math.floor(this.elapsed/.11));while(this.hit<n){NEW_SWORD_SKILLS.damage(this.target,14);this.hit++;}if(this.elapsed>=3.0)this.end();},end(){this.active=false;this.target=null;this.hit=0;updateNewSwordSkillUI();}
    },
    kiemAnh: {
        label:"Kiếm Ảnh", icon:"✧", cooldown:0, maxCooldown:24, active:false, elapsed:0, duration:10, hitTimer:0,
        activate(){if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0)return false;this.active=true;this.elapsed=0;this.hitTimer=0;this.cooldown=this.maxCooldown;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;this.hitTimer-=dt;const p=PLAYER.player.position;if(this.hitTimer<=0){this.hitTimer=.45;for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension)continue;if(m.position.distanceTo(p)<4.5)NEW_SWORD_SKILLS.damage(m,6);}}if(this.elapsed>=this.duration)this.end();},end(){this.active=false;updateNewSwordSkillUI();}
    },
    lienTram: {
        label:"Liên Trảm", icon:"≋", cooldown:0, maxCooldown:15, active:false, elapsed:0, target:null, wave:0,
        activate(){const t=getCrosshairMob(40);if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0||!t)return false;this.active=true;this.elapsed=0;this.cooldown=this.maxCooldown;this.target=t.mob;this.wave=0;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;if(!this.target||this.target.dead){this.end();return;}const w=Math.floor(this.elapsed/.32);while(this.wave<Math.min(5,w)){NEW_SWORD_SKILLS.damage(this.target,9);this.wave++;}if(this.wave>=5)this.end();},end(){this.active=false;this.target=null;this.wave=0;updateNewSwordSkillUI();}
    },
    kiemGioi: {
        label:"Kiếm Giới", icon:"◎", cooldown:0, maxCooldown:40, active:false, elapsed:0, duration:10, hitTimer:0,
        activate(){if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0)return false;this.active=true;this.elapsed=0;this.hitTimer=0;this.cooldown=this.maxCooldown;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;this.hitTimer-=dt;const p=PLAYER.player.position;if(this.hitTimer<=0){this.hitTimer=.35;for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension)continue;const d=m.position.distanceTo(p);if(d<5.2&&d>1.2)NEW_SWORD_SKILLS.damage(m,10);}}if(this.elapsed>=this.duration)this.end();},end(){this.active=false;updateNewSwordSkillUI();}
    },
    kiemLuuQuang: {
        label:"Kiếm Lưu Quang", icon:"✦", cooldown:0, maxCooldown:10, projectile:null,
        activate(){
            if(!SWORD_COMBAT.isSwordSelected()||this.cooldown>0)return false;
            const t=getCrosshairMob(40); if(!t)return false;
            this.cooldown=this.maxCooldown;
            const start=PLAYER.player.position.clone(); start.y+=1.25;
            const target=t.mob.position.clone(); target.y+=.8;
            this.projectile={start,target,elapsed:0,duration:Math.max(.16,start.distanceTo(target)/32),mob:t.mob,hit:false};
            return true;
        },
        update(dt){
            this.cooldown=Math.max(0,this.cooldown-dt); const q=this.projectile; if(!q)return;
            q.elapsed+=dt; const p=Math.min(1,q.elapsed/q.duration);
            if(!q.hit&&q.mob&&!q.mob.dead&&p>=.82){NEW_SWORD_SKILLS.damage(q.mob,18);q.hit=true;}
            if(p>=1)this.projectile=null;
        }
    },
    baoKiem: {
        label:"Bạo Kiếm", icon:"✹", cooldown:0, maxCooldown:18, activate(){
            if(!SWORD_COMBAT.isSwordSelected()||this.cooldown>0)return false;
            this.cooldown=this.maxCooldown; const p=PLAYER.player.position;
            for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension)continue;if(m.position.distanceTo(p)<=4.8)NEW_SWORD_SKILLS.damage(m,25);}
            return true;
        }, update(dt){this.cooldown=Math.max(0,this.cooldown-dt);}
    },
    thienLaKiem: {
        label:"Thiên La Kiếm", icon:"✥", cooldown:0, maxCooldown:28, active:false, elapsed:0, duration:12, hit:new Set(), angles:[],
        activate(){
            if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0)return false;
            this.active=true;this.elapsed=0;this.cooldown=this.maxCooldown;this.hit=new Set();this.angles=[];
            for(let i=0;i<20;i++)this.angles.push(i/20*Math.PI*2); return true;
        },
        update(dt){
            this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;
            const p=PLAYER.player.position;
            for(let i=0;i<this.angles.length;i++){
                const a=this.angles[i]+this.elapsed*.9, r=4.2+(i%2)*.45;
                const pos=new THREE.Vector3(p.x+Math.cos(a)*r,p.y+1.1+Math.sin(this.elapsed*2+i)*.25,p.z+Math.sin(a)*r);
                for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension||this.hit.has(m))continue;if(pos.distanceTo(m.position.clone().setY(m.position.y+.8))<1.0){NEW_SWORD_SKILLS.damage(m,12);this.hit.add(m);}}
            }
            if(this.elapsed>=this.duration)this.end();
        },end(){this.active=false;this.hit=new Set();this.angles=[];updateNewSwordSkillUI();}
    },
    kiemToa: {
        label:"Kiếm Tỏa", icon:"⊛", cooldown:0, maxCooldown:22, active:false, elapsed:0, duration:8, hitTimer:0,
        activate(){if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0)return false;this.active=true;this.elapsed=0;this.hitTimer=0;this.cooldown=this.maxCooldown;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;this.hitTimer-=dt;if(this.hitTimer<=0){this.hitTimer=.5;const p=PLAYER.player.position;for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension)continue;if(m.position.distanceTo(p)<4.2)NEW_SWORD_SKILLS.damage(m,8);}}if(this.elapsed>=this.duration)this.end();},end(){this.active=false;updateNewSwordSkillUI();}
    },
    kiemBao: {
        label:"Kiếm Bão", icon:"✺", cooldown:0, maxCooldown:24, active:false, elapsed:0, target:null, hit:0, count:8,
        activate(){const t=getCrosshairMob(40);if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0||!t)return false;this.active=true;this.elapsed=0;this.cooldown=this.maxCooldown;this.target=t.mob;this.hit=0;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;if(!this.target||this.target.dead){this.end();return;}const n=Math.min(this.count,Math.floor(this.elapsed/.18));while(this.hit<n){NEW_SWORD_SKILLS.damage(this.target,9);this.hit++;}if(this.hit>=this.count)this.end();},end(){this.active=false;this.target=null;this.hit=0;updateNewSwordSkillUI();}
    },
    xuyenTamKiem: {
        label:"Xuyên Tâm Kiếm", icon:"➶", cooldown:0, maxCooldown:14,
        activate(){if(!SWORD_COMBAT.isSwordSelected()||this.cooldown>0)return false;const t=getCrosshairMob(40);if(!t)return false;this.cooldown=this.maxCooldown;NEW_SWORD_SKILLS.damage(t.mob,30);return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);}
    },
    kiemPhong: {
        label:"Kiếm Phong", icon:"〰", cooldown:0, maxCooldown:16, active:false, elapsed:0, duration:6, hitTimer:0,
        activate(){if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0)return false;this.active=true;this.elapsed=0;this.hitTimer=0;this.cooldown=this.maxCooldown;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;this.hitTimer-=dt;if(this.hitTimer<=0){this.hitTimer=.4;const p=PLAYER.player.position;for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension)continue;if(m.position.distanceTo(p)<5.5)NEW_SWORD_SKILLS.damage(m,8);}}if(this.elapsed>=this.duration)this.end();},end(){this.active=false;updateNewSwordSkillUI();}
    },
    hoiKiem: {
        label:"Hồi Kiếm", icon:"↺", cooldown:0, maxCooldown:20, active:false, elapsed:0, target:null, hit:0,
        activate(){const t=getCrosshairMob(40);if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0||!t)return false;this.active=true;this.elapsed=0;this.cooldown=this.maxCooldown;this.target=t.mob;this.hit=0;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;if(!this.target||this.target.dead){this.end();return;}const n=Math.min(6,Math.floor(this.elapsed/.22));while(this.hit<n){NEW_SWORD_SKILLS.damage(this.target,11);this.hit++;}if(this.hit>=6)this.end();},end(){this.active=false;this.target=null;this.hit=0;updateNewSwordSkillUI();}
    },
    cuuLienKiem: {
        label:"Cửu Liên Kiếm", icon:"❖", cooldown:0, maxCooldown:26, active:false, elapsed:0, target:null, hit:0,
        activate(){const t=getCrosshairMob(40);if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0||!t)return false;this.active=true;this.elapsed=0;this.cooldown=this.maxCooldown;this.target=t.mob;this.hit=0;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;if(!this.target||this.target.dead){this.end();return;}const n=Math.min(9,Math.floor(this.elapsed/.2));while(this.hit<n){NEW_SWORD_SKILLS.damage(this.target,7);this.hit++;}if(this.hit>=9)this.end();},end(){this.active=false;this.target=null;this.hit=0;updateNewSwordSkillUI();}
    },
    vanAnhKiem: {
        label:"Vạn Ảnh Kiếm", icon:"✧", cooldown:0, maxCooldown:32, active:false, elapsed:0, duration:10, hitTimer:0,
        activate(){if(!SWORD_COMBAT.isSwordSelected()||this.active||this.cooldown>0)return false;this.active=true;this.elapsed=0;this.hitTimer=0;this.cooldown=this.maxCooldown;return true;},
        update(dt){this.cooldown=Math.max(0,this.cooldown-dt);if(!this.active)return;this.elapsed+=dt;this.hitTimer-=dt;if(this.hitTimer<=0){this.hitTimer=.5;const p=PLAYER.player.position;for(const m of GAME.mobs||[]){if(m.dead||m.dimension&&m.dimension!==GAME.dimension)continue;if(m.position.distanceTo(p)<6.5)NEW_SWORD_SKILLS.damage(m,6);}}if(this.elapsed>=this.duration)this.end();},end(){this.active=false;updateNewSwordSkillUI();}
    }
};
NEW_SWORD_SKILLS.damage=function(mob,amount){if(!mob||mob.dead)return;MOB_SYSTEM.damage(mob,amount,"sword_skill");flashMobDamage(mob);};


/* =========================================================
   ORIGINAL MOBILE EFFECT RENDERER — pooled / instanced
   - Chỉ thay đổi phần trình diễn; damage, cooldown và công dụng
     của skill không bị thay đổi.
   - Không sao chép asset/texture/animation của game khác.
   - Một pool InstancedMesh + một Points system dùng chung cho skill,
     tránh tạo/xóa hàng chục Mesh/Particle mỗi frame.
   ========================================================= */
const SWORD_SKILL_EFFECT_RENDERER = {
    active: null,
    swordParts: [],
    swordReady: false,
    swordCount: 24,
    particleCount: 28,
    sharedGeometries: null,
    defs: {
        kiemKhi:{mode:"pierce",count:2,duration:.62,color:0x66d9ff},
        kiemTran:{mode:"orbit",count:18,duration:15,color:0x9b72ff},
        phiKiem:{mode:"barrage",count:8,duration:2.35,color:0x4f9dff},
        thienKiem:{mode:"barrage",count:16,duration:3.25,color:0xd9e8ff},
        kiemAnh:{mode:"aura",count:10,duration:10,color:0x9b72ff},
        lienTram:{mode:"barrage",count:7,duration:1.9,color:0x6fd7ff},
        kiemGioi:{mode:"orbit",count:16,duration:10,color:0x52e0d0},
        kiemLuuQuang:{mode:"pierce",count:3,duration:.65,color:0xffe6a0},
        baoKiem:{mode:"burst",count:12,duration:.72,color:0xff6b3d},
        thienLaKiem:{mode:"orbit",count:20,duration:12,color:0x5bbcff},
        kiemToa:{mode:"orbit",count:12,duration:8,color:0xa66cff},
        kiemBao:{mode:"barrage",count:8,duration:1.8,color:0x6fa8ff},
        xuyenTamKiem:{mode:"pierce",count:2,duration:.70,color:0xff527a},
        kiemPhong:{mode:"orbit",count:12,duration:6,color:0x63e7ff},
        hoiKiem:{mode:"barrage",count:6,duration:1.55,color:0x7de8c4},
        cuuLienKiem:{mode:"barrage",count:9,duration:1.95,color:0xd58cff},
        vanAnhKiem:{mode:"orbit",count:18,duration:10,color:0x7e70ff}
    },

    _ensureSwordPool(){
        if(this.swordReady || !GAME.scene || !PLAYER?.makeHeldModel) return;
        const root=new THREE.Group();
        root.visible=false;
        const prototype=PLAYER.makeHeldModel("quy_tinh_sword");
        prototype.updateMatrixWorld(true);
        const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();
        prototype.traverse(mesh=>{
            if(!mesh.isMesh||!mesh.geometry||!mesh.material)return;
            mesh.updateMatrixWorld(true);
            const localMatrix=new THREE.Matrix4().multiplyMatrices(inv,mesh.matrixWorld);
            const geometry=mesh.geometry.clone();
            const material=Array.isArray(mesh.material)?mesh.material.map(m=>m.clone()):mesh.material.clone();
            const inst=new THREE.InstancedMesh(geometry,material,this.swordCount);
            inst.frustumCulled=false;
            inst.castShadow=false;
            inst.receiveShadow=false;
            const mats=Array.isArray(material)?material:[material];
            mats.forEach(m=>{m.transparent=true;m.depthWrite=false;m.opacity=.94;});
            root.add(inst);
            this.swordParts.push({mesh:inst,localMatrix});
        });
        prototype.traverse(o=>{
            if(o.geometry)o.geometry.dispose();
            if(o.material){const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m?.dispose?.());}
        });
        GAME.scene.add(root);
        this.poolRoot=root;
        this.swordReady=true;
    },

    _ensureSharedGeometry(){
        if(this.sharedGeometries)return;
        this.sharedGeometries={
            ring:new THREE.TorusGeometry(1,0.026,6,40),
            flash:new THREE.SphereGeometry(.16,8,8)
        };
    },

    _targetFrom(skill){
        const t=skill?.target;
        if(t&&!t.dead)return t.position.clone().add(new THREE.Vector3(0,Math.max(.7,(t.collisionBox?.height||1.4)*.55),0));
        const q=skill?.projectile;
        if(q?.target)return q.target.clone();
        const aimed=getCrosshairMob(40);
        if(aimed?.mob&&!aimed.mob.dead)return aimed.mob.position.clone().add(new THREE.Vector3(0,.8,0));
        return PLAYER.player.position.clone().add(new THREE.Vector3(0,1,0));
    },

    start(key,skill){
        const d=this.defs[key];
        if(!d)return;
        this.stop();
        this._ensureSwordPool();
        this._ensureSharedGeometry();
        const start=PLAYER.player.position.clone().add(new THREE.Vector3(0,1.05,0));
        const target=this._targetFrom(skill);
        const state={key,skill,def:d,elapsed:0,start,target,particles:[],dead:false,seed:(key.length*37)%997};
        const color=new THREE.Color(d.color);
        state.root=new THREE.Group();
        state.root.name="OriginalSkillFX_"+key;
        const ringMat=new THREE.MeshBasicMaterial({color:d.color,transparent:true,opacity:.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
        state.ring=new THREE.Mesh(this.sharedGeometries.ring,ringMat);
        state.ring.rotation.x=Math.PI/2;
        state.root.add(state.ring);
        const flashMat=new THREE.MeshBasicMaterial({color:d.color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false});
        state.flash=new THREE.Mesh(this.sharedGeometries.flash,flashMat);
        state.root.add(state.flash);

        const positions=new Float32Array(this.particleCount*3);
        state.base=[];
        for(let i=0;i<this.particleCount;i++){
            const a=(i/this.particleCount)*Math.PI*2;
            const r=.5+((i*17)%13)/13*2.8;
            const y=((i*23)%17)/17*1.8-.9;
            state.base.push({a,r,y,phase:(i*11)%19/19});
            positions[i*3]=0;positions[i*3+1]=0;positions[i*3+2]=0;
        }
        const pg=new THREE.BufferGeometry();
        pg.setAttribute('position',new THREE.BufferAttribute(positions,3));
        const pm=new THREE.PointsMaterial({color, size:.075, transparent:true,opacity:.72,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
        state.particlesObj=new THREE.Points(pg,pm);
        state.root.add(state.particlesObj);
        GAME.scene.add(state.root);
        this.active=state;
    },

    update(dt){
        const s=this.active;if(!s)return;
        const zero=new THREE.Matrix4().makeScale(0,0,0);
        const previousUsed=this._usedCount||0;
        if(previousUsed){for(let i=0;i<previousUsed;i++)for(const part of this.swordParts)part.mesh.setMatrixAt(i,zero);}
        this._usedCount=0;
        s.elapsed+=Math.max(0,Math.min(.1,dt));
        const d=s.def,t=Math.min(1,s.elapsed/d.duration),p=s.elapsed;
        const player=PLAYER.player.position;
        if(s.skill?.target&&!s.skill.target.dead)s.target=this._targetFrom(s.skill);
        const root=s.root;
        const target=s.target;
        const dir=target.clone().sub(s.start);if(dir.lengthSq()<.0001)dir.set(0,0,1);dir.normalize();
        root.position.set(0,0,0);

        // Không phụ thuộc FPS: mọi chuyển động dùng elapsed/duration.
        if(d.mode==='pierce'){
            for(let i=0;i<d.count;i++){
                const u=Math.min(1,Math.max(0,(p-i*.055)/Math.max(.05,d.duration-.08)));
                const e=1-Math.pow(1-u,3);
                const pos=s.start.clone().lerp(target,e);
                this._setSword(i,pos,dir,1.0*(.92+.08*Math.sin(p*14+i)));
            }
        }else if(d.mode==='barrage'){
            for(let i=0;i<d.count;i++){
                const a=(i/d.count)*Math.PI*2 + p*1.8;
                const rad=1.4+.55*Math.sin(p*3+i*.7);
                const pos=target.clone().add(new THREE.Vector3(Math.cos(a)*rad,Math.sin(i*1.7+p*2)*.8,Math.sin(a)*rad));
                const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),target.clone().sub(pos).normalize());
                this._setSword(i,pos,q,0.78);
            }
        }else if(d.mode==='orbit'){
            const center=(s.key==='kiemGioi'||s.key==='kiemPhong'||s.key==='vanAnhKiem'||s.key==='kiemAnh')?player:target;
            const count=d.count;
            for(let i=0;i<count;i++){
                const a=i/count*Math.PI*2+p*(.65+(i%3)*.08);
                const r=3.0+(i%4)*.34;
                const pos=center.clone().add(new THREE.Vector3(Math.cos(a)*r,.45+Math.sin(p*2+i)*.45,Math.sin(a)*r));
                const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),center.clone().sub(pos).normalize());
                this._setSword(i,pos,q,.68+.08*Math.sin(i));
            }
        }else if(d.mode==='aura'){
            for(let i=0;i<d.count;i++){
                const a=i/d.count*Math.PI*2+p*.9;
                const r=2.2+.25*Math.sin(p*3+i);
                const pos=player.clone().add(new THREE.Vector3(Math.cos(a)*r,.8+Math.sin(a*2+p*2)*.7,Math.sin(a)*r));
                const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),player.clone().sub(pos).normalize());
                this._setSword(i,pos,q,.62);
            }
        }else if(d.mode==='burst'){
            for(let i=0;i<d.count;i++){
                const a=i/d.count*Math.PI*2;
                const r=Math.min(4.0,p*7.0);
                const pos=player.clone().add(new THREE.Vector3(Math.cos(a)*r,.7+Math.sin(i*2)*.3,Math.sin(a)*r));
                const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),.15,Math.sin(a)).normalize());
                this._setSword(i,pos,q,.72*(1-t*.2));
            }
        }

        const ringCenter=(d.mode==='barrage'||d.mode==='pierce')?target:player;
        s.ring.position.copy(ringCenter);
        const ringScale=(d.mode==='burst')?Math.min(3.5,p*8):(.85+.18*Math.sin(p*5));
        s.ring.scale.set(ringScale,ringScale,ringScale);
        s.ring.material.opacity=.10+.16*(1-Math.min(1,p/d.duration));
        s.flash.position.copy(target);
        const impactWindow=Math.max(0,1-Math.min(1,Math.abs((p/d.duration)-.78)*8));
        s.flash.scale.setScalar(.7+impactWindow*2.4);
        s.flash.material.opacity=impactWindow*.48;

        const arr=s.particlesObj.geometry.attributes.position.array;
        for(let i=0;i<this.particleCount;i++){
            const b=s.base[i];
            let c;
            if(d.mode==='pierce') c=s.start.clone().lerp(target,Math.min(1,(p+b.phase*.12)/d.duration));
            else if(d.mode==='barrage') c=target.clone();
            else c=player.clone();
            const rr=(d.mode==='burst'?Math.min(3.5,p*6):1.0+.65*Math.sin(p*4+b.phase*6));
            arr[i*3]=c.x+Math.cos(b.a+p*2.2)*rr;
            arr[i*3+1]=c.y+b.y+Math.sin(p*4+b.phase*8)*.18;
            arr[i*3+2]=c.z+Math.sin(b.a+p*2.2)*rr;
        }
        s.particlesObj.geometry.attributes.position.needsUpdate=true;
        s.particlesObj.material.opacity=.25+.45*(1-Math.min(1,p/d.duration));

        if(p>=d.duration){this.stop();}
    },

    _setSword(index,pos,quat,scale){
        if(index>=this.swordCount)return;
        const helper=this._helper||(this._helper=new THREE.Object3D());
        helper.position.copy(pos);helper.quaternion.copy(quat);helper.scale.setScalar(scale);helper.updateMatrix();
        for(const part of this.swordParts){
            const matrix=new THREE.Matrix4().multiplyMatrices(helper.matrix,part.localMatrix);
            part.mesh.setMatrixAt(index,matrix);
        }
        this._usedCount=Math.max(this._usedCount||0,index+1);
    },

    _hideUnused(){
        const zero=new THREE.Matrix4().makeScale(0,0,0);
        for(let i=0;i<this.swordCount;i++)for(const part of this.swordParts)part.mesh.setMatrixAt(i,zero);
        for(const part of this.swordParts){
            part.mesh.instanceMatrix.needsUpdate=true;
            const mats=Array.isArray(part.mesh.material)?part.mesh.material:[part.mesh.material];
            mats.forEach(m=>m.opacity=.94);
        }
        this._usedCount=0;
    },

    stop(){
        if(this.active){
            if(this.active.root?.parent)GAME.scene.remove(this.active.root);
            const g=this.active.particlesObj?.geometry;
            const m=this.active.particlesObj?.material;
            if(g)g.dispose();if(m)m.dispose?.();
        }
        this.active=null;
        this._hideUnused();
    }
};

// Gắn effect renderer vào vòng đời skill. Damage/cooldown giữ nguyên.
(function installOriginalSkillFX(){
    for(const key of Object.keys(SWORD_SKILL_EFFECT_RENDERER.defs)){
        const obj=NEW_SWORD_SKILLS[key];
        if(!obj||obj.__originalSkillFX)return;
        const act=obj.activate, end=obj.end, update=obj.update;
        obj.activate=function(...args){
            const ok=act.apply(this,args);
            if(ok)SWORD_SKILL_EFFECT_RENDERER.start(key,this);
            return ok;
        };
        if(typeof end==='function'){
            obj.end=function(...args){
                const out=end.apply(this,args);
                if(SWORD_SKILL_EFFECT_RENDERER.active?.key===key)SWORD_SKILL_EFFECT_RENDERER.stop();
                return out;
            };
        }
        obj.update=function(dt,...args){
            const out=update.call(this,dt,...args);
            if(SWORD_SKILL_EFFECT_RENDERER.active?.key===key)SWORD_SKILL_EFFECT_RENDERER.update(dt);
            return out;
        };
        obj.__originalSkillFX=true;
    }
})();

/* =========================================================
   KIẾM QUY TINH — HỆ THỐNG ÁNH SÁNG 20 KỸ NĂNG
   - Mỗi chiêu có màu ánh sáng riêng.
   - Dùng emissive/additive + tối đa 2 PointLight/hiệu ứng để nhẹ trên mobile.
   - Hiệu ứng tự dọn khi chiêu kết thúc, không để đèn treo trong scene.
   ========================================================= */
const SWORD_SKILL_LIGHTING = {
    defs: {
        kiemKhi:{c:0x66d9ff, r:1.6, power:2.0, mode:"target"},
        kiemTran:{c:0x8f6cff, r:3.5, power:1.7, mode:"area"},
        phiKiem:{c:0x4f9dff, r:1.5, power:2.2, mode:"target"},
        thienKiem:{c:0xd9e8ff, r:2.2, power:2.6, mode:"target"},
        kiemAnh:{c:0x9b72ff, r:4.4, power:1.6, mode:"area"},
        lienTram:{c:0x6fd7ff, r:2.0, power:2.0, mode:"target"},
        kiemGioi:{c:0x52e0d0, r:5.2, power:1.8, mode:"area"},
        kiemLuuQuang:{c:0xffe6a0, r:1.4, power:2.6, mode:"target"},
        baoKiem:{c:0xff6b3d, r:4.8, power:2.5, mode:"burst"},
        thienLaKiem:{c:0x5bbcff, r:4.7, power:1.8, mode:"area"},
        kiemToa:{c:0xa66cff, r:4.3, power:1.7, mode:"area"},
        kiemBao:{c:0x6fa8ff, r:2.4, power:2.2, mode:"target"},
        xuyenTamKiem:{c:0xff527a, r:2.0, power:3.0, mode:"target"},
        kiemPhong:{c:0x63e7ff, r:5.4, power:1.7, mode:"area"},
        hoiKiem:{c:0x7de8c4, r:2.0, power:2.0, mode:"target"},
        cuuLienKiem:{c:0xd58cff, r:2.0, power:2.4, mode:"target"},
        vanAnhKiem:{c:0x7e70ff, r:6.4, power:1.8, mode:"area"},
        vanKiem:{c:0x8d7cff, r:5.0, power:2.0, mode:"target"},
        nguKiem:{c:0x6d9dff, r:2.5, power:2.0, mode:"ride"},
        kiemVu:{c:0xc18cff, r:4.5, power:2.2, mode:"target"}
    },
    active:new Map(),
    _make(key, instant=false){
        const d=this.defs[key]; if(!d||!GAME.scene)return null;
        this.stop(key);
        const root=new THREE.Group(); root.name="SkillLight_"+key;
        const mat=new THREE.MeshBasicMaterial({color:d.c,transparent:true,opacity:0.22,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
        const ring=new THREE.Mesh(new THREE.TorusGeometry(Math.max(.55,d.r*.72),0.025,6,48),mat);
        ring.rotation.x=Math.PI/2; root.add(ring);
        const coreMat=new THREE.MeshBasicMaterial({color:d.c,transparent:true,opacity:0.42,blending:THREE.AdditiveBlending,depthWrite:false});
        const core=new THREE.Mesh(new THREE.SphereGeometry(0.10,8,8),coreMat); root.add(core);
        const lightA=new THREE.PointLight(d.c,d.power,Math.max(3.5,d.r+2.5),2);
        const lightB=new THREE.PointLight(d.c,d.power*.55,Math.max(2.5,d.r+1.5),2);
        root.add(lightA,lightB);
        GAME.scene.add(root);
        const fx={key,def:d,root,ring,core,lightA,lightB,age:0,instant,target:null,origin:new THREE.Vector3(),dead:false};
        this.active.set(key,fx);
        return fx;
    },
    start(key, instant=false){
        const fx=this._make(key,instant); if(!fx)return;
        const p=PLAYER.player?.position;
        if(p)fx.origin.copy(p).y+=1.0;
        const s=(key==="vanKiem")?SWORD_COMBAT:null;
        if(s?.skillVisual) fx.origin.copy(p);
        const t=getCrosshairMob(40);
        if(t?.mob&&!t.mob.dead) fx.target=t.mob;
        if(instant){
            fx.age=0;
            fx.instant=true;
        }
        this.update(key,0);
        if(instant) this.stop(key,0.34);
    },
    update(key,dt){
        const fx=this.active.get(key); if(!fx)return;
        fx.age+=dt;
        const d=fx.def, now=performance.now()*0.001;
        const p=PLAYER.player?.position;
        if(p && (d.mode==="area"||d.mode==="ride"||!fx.target)) fx.origin.copy(p).y+=1.0;
        let pos=fx.origin;
        if(fx.target && !fx.target.dead && (d.mode==="target")){
            pos=fx.target.position.clone(); pos.y+=Math.max(.65,(fx.target.collisionBox?.height||1.4)*.55);
        }
        fx.root.position.copy(pos);
        const pulse=0.82+Math.sin(now*7.0+fx.age*2.0)*0.18;
        const fade=fx.instant?Math.max(0,1-fx.age/.34):1;
        fx.ring.material.opacity=(0.14+0.12*pulse)*fade;
        fx.core.material.opacity=(0.25+0.25*pulse)*fade;
        const scale=fx.instant ? 1+fx.age*4.0 : 0.94+Math.sin(now*3.4)*0.05;
        fx.ring.scale.setScalar(scale);
        fx.core.scale.setScalar(1.0+0.45*pulse);
        fx.lightA.intensity=d.power*pulse*fade;
        fx.lightB.intensity=d.power*.55*(0.9+0.1*Math.sin(now*5))*fade;
        if(d.mode==="target" && fx.target && !fx.target.dead){
            fx.root.lookAt(fx.origin.x,fx.origin.y,fx.origin.z);
        } else {
            fx.root.rotation.y=now*.35;
        }
    },
    stop(key, fade=0){
        const fx=this.active.get(key); if(!fx)return;
        if(fade>0){
            // Chỉ cần một ngắn burst; không tạo timer dài.
            const start=performance.now();
            const tick=()=>{
                if(!this.active.has(key))return;
                const t=(performance.now()-start)/1000;
                if(t>=fade){this._dispose(key);return;}
                this.update(key,Math.min(0.033,fade-t));
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            return;
        }
        this._dispose(key);
    },
    _dispose(key){
        const fx=this.active.get(key); if(!fx)return;
        if(fx.root?.parent)fx.root.parent.remove(fx.root);
        fx.root?.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose?.();});
        this.active.delete(key);
    },
    stopAll(){for(const k of [...this.active.keys()])this.stop(k);}
};

// Gắn ánh sáng vào vòng đời của cả 20 chiêu mà không thay đổi sát thương/cooldown.
function installSwordSkillLighting(){
    const entries=[
        ["vanKiem",SWORD_COMBAT,"activateSkill","endSkill"],
        ["nguKiem",EXTRA_SWORD_SKILLS.ngu,"activate","end"],
        ["kiemVu",EXTRA_SWORD_SKILLS.vu,"activate","end"],
        ...Object.keys(NEW_SWORD_SKILLS).map(k=>[k,NEW_SWORD_SKILLS[k],"activate","end"])
    ];
    for(const [key,obj,actName,endName] of entries){
        if(!obj||obj["__lightWrapped_"+actName])continue;
        const originalAct=obj[actName];
        if(typeof originalAct==="function"){
            obj[actName]=function(...args){
                const before=obj.active===true;
                const ok=originalAct.apply(this,args);
                if(ok){
                    // Ngự Kiếm là nút bật/tắt: khi đang bật và nhấn lại, end() đã dọn ánh sáng.
                    if(!(key==="nguKiem" && before)) SWORD_SKILL_LIGHTING.start(key,!this.active);
                }
                return ok;
            };
            obj["__lightWrapped_"+actName]=true;
        }
        const originalEnd=obj[endName];
        if(typeof originalEnd==="function"){
            obj[endName]=function(...args){
                const out=originalEnd.apply(this,args);
                SWORD_SKILL_LIGHTING.stop(key);
                return out;
            };
            obj["__lightWrapped_"+endName]=true;
        }
        if(typeof obj.update==="function" && !obj.__lightWrappedUpdate){
            const originalUpdate=obj.update;
            obj.update=function(dt,...args){
                const out=originalUpdate.call(this,dt,...args);
                const fx=SWORD_SKILL_LIGHTING.active.get(key);
                if(fx)SWORD_SKILL_LIGHTING.update(key,dt);
                return out;
            };
            obj.__lightWrappedUpdate=true;
        }
    }
}
installSwordSkillLighting();
let SELECTED_SWORD_SKILL = null;

function getSwordSkillEntry(key){
    if(key === "vanKiem") return {label:"Vạn Kiếm", icon:"⚔", cooldown:SWORD_COMBAT.skillCooldown, active:SWORD_COMBAT.skillActive, ready:SWORD_COMBAT.skillCooldown<=0, activate(){
        if(SWORD_COMBAT.skillActive) return SWORD_COMBAT.launchAtCrosshair();
        if(!SWORD_COMBAT.activateSkill()) return false;
        const launched=SWORD_COMBAT.launchAtCrosshair();
        return launched;
    }};
    if(key === "nguKiem") return {label:"Ngự Kiếm", icon:"🗡", cooldown:EXTRA_SWORD_SKILLS.ngu.cooldown, active:EXTRA_SWORD_SKILLS.ngu.active, ready:true, activate(){return EXTRA_SWORD_SKILLS.ngu.activate();}};
    if(key === "kiemVu") return {label:"Kiếm Vũ", icon:"✦", cooldown:EXTRA_SWORD_SKILLS.vu.cooldown, active:EXTRA_SWORD_SKILLS.vu.active, ready:EXTRA_SWORD_SKILLS.vu.cooldown<=0, activate(){return EXTRA_SWORD_SKILLS.vu.activate();}};
    const s=NEW_SWORD_SKILLS[key];
    if(!s) return null;
    return {label:s.label,icon:s.icon,cooldown:s.cooldown,active:s.active,ready:s.cooldown<=0,activate(){return s.activate();}};
}

function setupNewSwordSkills(){
    const bar=document.getElementById("swordSkillBar");
    if(!bar) return;
    bar.querySelectorAll(".skillSlot").forEach(btn=>{
        btn.addEventListener("pointerup",e=>{
            e.preventDefault(); e.stopPropagation();
            const key=btn.dataset.skill;
            if(!getSwordSkillEntry(key)) return;
            SELECTED_SWORD_SKILL = key;
            updateNewSwordSkillUI();
        },{passive:false});
    });
    updateNewSwordSkillUI();
}

function updateNewSwordSkillUI(){
    const bar=document.getElementById("swordSkillBar");
    const hint=document.getElementById("swordSkillHint");
    const activeSword=SWORD_COMBAT.isSwordSelected();
    if(bar) bar.style.display=activeSword?"flex":"none";
    if(hint) hint.style.display=activeSword&&SELECTED_SWORD_SKILL?"block":"none";
    if(!activeSword) SELECTED_SWORD_SKILL=null;
    if(!bar) return;
    bar.querySelectorAll(".skillSlot").forEach(btn=>{
        const key=btn.dataset.skill, e=getSwordSkillEntry(key);
        if(!e) return;
        btn.classList.toggle("selected",key===SELECTED_SWORD_SKILL);
        btn.classList.toggle("cooldown",!e.ready&&!e.active);
        const cd=btn.querySelector("em");
        if(cd) cd.textContent=e.active?(key==="nguKiem"?"Bật":"Dùng"):(e.cooldown>0?Math.ceil(e.cooldown)+"s":"");
    });
}

function activateSelectedSwordSkill(){
    if(!SWORD_COMBAT.isSwordSelected() || !SELECTED_SWORD_SKILL) return false;
    const key=SELECTED_SWORD_SKILL;
    const entry=getSwordSkillEntry(key);
    if(!entry) return false;
    const target=getCrosshairMob(key==="vanKiem"?40:20);
    if(window.MULTIPLAYER?.enabled && NETWORK.skillSync) NETWORK.skillSync.cast(key, target?.mob?.networkId||null);
    const ok=entry.activate();
    if(ok && key!=="nguKiem") SELECTED_SWORD_SKILL=null;
    updateNewSwordSkillUI();
    return ok;
}

function resolveUnifiedWorldAction() {
    // Một lần chạm = một hành động. Hệ thống tự xác định đối tượng dưới tâm ngắm:
    // MOB -> ATTACK, BLOCK -> PLACE, không có mục tiêu -> NO_ACTION.
    // Không sao chép mã nguồn/UI của game khác; đây là bộ điều khiển riêng của game.
    if (SWORD_COMBAT.isSwordSelected()) {
        if (SELECTED_SWORD_SKILL) return { type: "skill" };
        if (SWORD_COMBAT.skillActive) return { type: "skill_launch" };
    }

    const remoteTarget = window.MULTIPLAYER?.getCrosshairRemoteTarget?.(5) || null;
    const mobTarget = getCrosshairMob(5);
    const blockTarget = getAimBlock();
    const remoteDistance = remoteTarget ? Number(remoteTarget.distance || Infinity) : Infinity;
    const mobDistance = mobTarget ? Number(mobTarget.distance || Infinity) : Infinity;
    const blockDistance = blockTarget ? Number(blockTarget.distance || Infinity) : Infinity;

    // Nếu cả mob và block nằm trên hướng nhìn, ưu tiên vật thể nằm gần người chơi.
    // Sai số nhỏ giúp thao tác chạm mobile ổn định hơn.
    if (remoteTarget && remoteDistance <= mobDistance + 0.5 && remoteDistance <= blockDistance + 0.9) return { type: "remote_attack", target: remoteTarget };
    if (mobTarget && (!blockTarget || mobDistance <= blockDistance + 0.9)) {
        return { type: "attack", target: mobTarget };
    }
    if (blockTarget) return { type: "place", target: blockTarget };
    return { type: "none" };
}

function showUnifiedActionFeedback(type) {
    const canvas = GAME.renderer?.domElement;
    if (!canvas) return;
    canvas.classList.remove("actionAttack", "actionPlace", "actionMine");
    if (type === "attack") canvas.classList.add("actionAttack");
    else if (type === "place") canvas.classList.add("actionPlace");
    setTimeout(() => canvas.classList.remove("actionAttack", "actionPlace"), 90);
}

function performUnifiedTapAction() {
    const action = resolveUnifiedWorldAction();

    if (action.type === "skill") {
        const ok = activateSelectedSwordSkill();
        if (ok) showUnifiedActionFeedback("attack");
        return ok;
    }
    if (action.type === "skill_launch") {
        const ok = SWORD_COMBAT.launchAtCrosshair();
        if (ok) showUnifiedActionFeedback("attack");
        return ok;
    }
    if (action.type === "remote_attack") {
        if (!AV_CAN("combat")) return false;
        const selectedId = GAME.hotbarItems[GAME.selectedSlot] || GAME.serverEquipment?.weapon || "";
        if (!window.MULTIPLAYER?.enabled || !window.NETWORK?.combatSync) return false;
        const ok = NETWORK.combatSync.attack(action.target.id, selectedId);
        if (ok) { PLAYER.setMiningAnimation(true, 0.06); showUnifiedActionFeedback("attack"); }
        return ok;
    }
    if (action.type === "attack") {
        if (!AV_CAN("combat")) return false;
        const target = action.target;
        if (window.MULTIPLAYER?.enabled && target?.mob?.networkId && NETWORK.mobSync) { const selectedId=GAME.hotbarItems[GAME.selectedSlot]||GAME.serverEquipment?.weapon||""; const ok=NETWORK.mobSync.attack(target.mob.networkId,selectedId); if(ok)showUnifiedActionFeedback("attack"); return ok; }
        if (SWORD_COMBAT.isSwordSelected()) {
            const ok = SWORD_COMBAT.normalAttack();
            if (ok) showUnifiedActionFeedback("attack");
            return ok;
        }
        const selectedId = GAME.hotbarItems[GAME.selectedSlot];
        const selectedItem = GAME_DATA.items[selectedId] || null;
        const attackDamage = Math.max(1, Number(selectedItem?.attackDamage ?? selectedItem?.damage ?? 2));
        MOB_SYSTEM.damage(target.mob, attackDamage, selectedId || "hand");
        flashMobDamage(target.mob);
        PLAYER.setMiningAnimation(true, 0.06);
        showUnifiedActionFeedback("attack");
        return true;
    }
    if (action.type === "place") {
        const ok = placeSelectedBlock();
        if (ok) showUnifiedActionFeedback("place");
        return ok;
    }
    return false;
}

// Backward-compatible entry point used by older parts of the combat/UI code.
function attackTargetAtCrosshair() {
    return performUnifiedTapAction();
}

function getSelectedBlockItem() {
    const id = GAME.hotbarItems[GAME.selectedSlot];
    const item = GAME_DATA.items[id];
    if (!item || item.type !== "block" || !item.blockId) return null;
    // Compatibility with older saves that stored the bloodstone block under
    // titanite_blood_block instead of the actual item id.
    const count = Number(GAME.inventory[id] || 0) +
        (id === "titanite_blood" ? Number(GAME.inventory.titanite_blood_block || 0) : 0);
    if (count <= 0) return null;
    return item;
}

function getPlacementTarget() {
    const aim = getAimBlock();
    if (!aim || aim.distance > 12) return null;
    const p = aim.placePos;
    if (p.y < 0 || p.y >= WORLD.WORLD_HEIGHT) return null;
    if (WORLD.isSolid(p.x, p.y, p.z)) return null;
    if (isInsidePlayer(p.x, p.y, p.z)) return null;
    return { aim, p };
}

function placeSelectedBlock() {
    if (!AV_CAN("place")) return false;
    const selectedId = GAME.hotbarItems[GAME.selectedSlot];
    const item = GAME_DATA.items[selectedId];
    if (!item) return false;

    const count = Number(GAME.inventory[selectedId] || 0);
    if (count <= 0) return false;

    // Tất cả vật thể có type "placeable_entity" đều dùng chung hệ thống đặt.
    // Vì vậy Hình nhân và các vật thể đặt mới không bị khóa bởi logic block voxel.
    if (item.type === "placeable_entity") {
        if (selectedId === "revive_decoy") {
            if (!DECOY_SYSTEM) return false;
            return DECOY_SYSTEM.place();
        }
        if (selectedId === "titan_training_dummy") {
            if (typeof TRAINING_DUMMY_SYSTEM === "undefined") return false;
            return TRAINING_DUMMY_SYSTEM.place();
        }
        if (typeof PLACEABLE_SYSTEM !== "undefined" && PLACEABLE_SYSTEM.place) {
            return PLACEABLE_SYSTEM.place(selectedId);
        }
        return false;
    }

    // Các vật phẩm voxel/block đặt được.
    if (item.type !== "block" || !item.blockId) return false;

    const target = getPlacementTarget();
    if (!target) return false;

    const worldId = blockIdToWorldId(item.blockId);
    if (!worldId) return false;
    const placeX = target.p.x, placeY = target.p.y, placeZ = target.p.z;
    const previousBlock = WORLD.getBlock(placeX, placeY, placeZ);
    if (!WORLD.setBlock(placeX, placeY, placeZ, worldId)) return false;
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.blockSync) {
        const ok = NETWORK.blockSync.request(placeX, placeY, placeZ, previousBlock, worldId, GAME.dimension || "main", selectedId);
        if (!ok) { WORLD.setBlock(placeX, placeY, placeZ, previousBlock); return false; }
    }

    // Tương thích save cũ: Khối Titanite Huyết có thể nằm trong
    // titanite_blood_block thay vì titanite_blood.
    if (!(window.MULTIPLAYER?.enabled && window.NETWORK?.blockSync) && !AV_IS_FREE()) {
        if (item.id === "titanite_blood" && count <= 0) {
            GAME.inventory.titanite_blood_block = Math.max(0, Number(GAME.inventory.titanite_blood_block || 0) - 1);
        } else {
            GAME.inventory[selectedId] = Math.max(0, count - 1);
        }
        ensureInventoryStacks();
        updateHotbar();
    }
    return true;
}

function blockIdToWorldId(id) {
    const map = {
        titanite: 1,
        titanite_black: 2,
        titanite_blood: 3,
        titanite_igneous: 4,
        titanite_eternal: 5,
        titan_vault: 6,
        crafting_machine: 7,
        space_gate: 8
    };
    return map[id] || 0;
}

function createCrackTextures() {
    if (GAME.crackTextures) return GAME.crackTextures;

    // IMPORTANT: These are separate transparent overlay textures.
    // The original block texture/material is NEVER modified.
    const textures = [null];
    const stages = [
        [
            [[3,2],[5,5],[4,8],[7,10],[6,14]],
            [[5,5],[9,4],[11,6]],
            [[4,8],[2,11],[3,14]]
        ],
        [
            [[3,1],[5,5],[4,8],[7,10],[6,14],[9,17]],
            [[5,5],[9,4],[12,6],[14,9]],
            [[4,8],[2,11],[3,14],[1,16]],
            [[7,10],[10,11],[12,14]],
            [[8,2],[10,1]]
        ],
        [
            [[3,1],[5,5],[4,8],[7,10],[6,14],[9,17],[12,20]],
            [[5,5],[9,4],[12,6],[14,9],[16,10]],
            [[4,8],[2,11],[3,14],[1,16],[0,20]],
            [[7,10],[10,11],[12,14],[15,16]],
            [[8,2],[10,1],[13,2]],
            [[10,17],[13,18],[15,21]],
            [[5,15],[4,19]]
        ],
        [
            [[3,1],[5,5],[4,8],[7,10],[6,14],[9,17],[12,20],[15,22],[18,25]],
            [[5,5],[9,4],[12,6],[14,9],[16,10],[20,9],[23,7]],
            [[4,8],[2,11],[3,14],[1,16],[0,20],[2,24]],
            [[7,10],[10,11],[12,14],[15,16],[18,15],[21,17]],
            [[8,2],[10,1],[13,2],[15,4],[18,3]],
            [[10,17],[13,18],[15,21],[19,22],[22,25]],
            [[5,15],[4,19],[6,22],[9,24]],
            [[14,13],[17,12],[19,13]],
            [[20,20],[24,20],[27,23]]
        ]
    ];

    stages.forEach((lines, stage) => {
        const c = document.createElement('canvas');
        c.width = 32;
        c.height = 32;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 32, 32);
        ctx.imageSmoothingEnabled = false;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';

        // Dark outer crack + tiny light edge. Both are transparent overlays,
        // so the block's own texture remains completely unchanged underneath.
        ctx.strokeStyle = 'rgba(0,0,0,0.96)';
        ctx.lineWidth = stage >= 3 ? 2.6 : 2.1;
        for (const pts of lines) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0] + 0.5, pts[0][1] + 0.5);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i][0] + 0.5, pts[i][1] + 0.5);
            }
            ctx.stroke();
        }

        if (stage >= 1) {
            ctx.fillStyle = 'rgba(235,240,245,0.42)';
            const chips = stage === 1
                ? [[4,8],[7,10]]
                : stage === 2
                    ? [[4,8],[7,10],[12,6],[3,14]]
                    : [[4,8],[7,10],[12,6],[3,14],[15,16],[10,17],[18,15]];
            for (const [x,y] of chips) ctx.fillRect(x, y, 1, 1);
        }

        const tex = new THREE.CanvasTexture(c);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        textures.push(tex);
    });

    GAME.crackTextures = textures;
    return textures;
}

function clearCrackOverlay() {
    if (!GAME.crackOverlay) return;
    GAME.scene.remove(GAME.crackOverlay);
    GAME.crackOverlay.geometry.dispose();
    if (GAME.crackOverlay.material) GAME.crackOverlay.material.dispose();
    GAME.crackOverlay = null;
}

function updateCrackOverlay(aim, progress) {
    if (!aim || progress <= 0 || progress >= 1) {
        clearCrackOverlay();
        return;
    }

    const n = (aim.normal || new THREE.Vector3(0,0,1)).clone().normalize();
    const center = aim.breakPos.clone().addScaledVector(n, 0.507);
    const textures = createCrackTextures();
    const stage = Math.max(1, Math.min(4, Math.ceil(progress * 4)));

    if (!GAME.crackOverlay) {
        // Slightly larger than one voxel face so the overlay stays visible
        // above the original texture without replacing or editing it.
        const geometry = new THREE.PlaneGeometry(1.018, 1.018);
        const material = new THREE.MeshBasicMaterial({
            map: textures[stage],
            transparent: true,
            opacity: 1,
            alphaTest: 0.001,
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide
        });
        GAME.crackOverlay = new THREE.Mesh(geometry, material);
        GAME.crackOverlay.renderOrder = 100;
        GAME.crackOverlay.frustumCulled = false;
        GAME.scene.add(GAME.crackOverlay);
    }

    const overlay = GAME.crackOverlay;
    overlay.position.copy(center);
    overlay.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), n);
    overlay.material.map = textures[stage];
    overlay.material.needsUpdate = true;
}


/* =========================================================
   DROPPED ITEM SYSTEM
   Vật phẩm xuất hiện trong thế giới sau khi phá block.
   - Có hình hiển thị riêng theo item.
   - Nhấp nhô + xoay nhẹ.
   - Có cú nảy nhỏ khi rơi.
   - Tự hút vào người chơi ở khoảng cách gần.
   - Chỉ nhặt nếu còn chỗ trong stack của item.
   ========================================================= */
const DROP_SYSTEM = (() => {
    const drops = [];
    const visualPools = new Map();
    const visualCache = new Map();
    const MAX_DROPS = 48;
    const PICKUP_RADIUS = 1.65;
    const PICKUP_DELAY = 0.28;

    function createBlockDropMaterial(itemId) {
        const item = GAME_DATA.items[itemId];
        const blockId = item?.blockId || itemId;
        const bv = TextureSystem.getBlockVisual(blockId);
        const tex = TextureSystem.createTexture("drop_" + blockId, bv.base, bv.accent);
        return new THREE.MeshStandardMaterial({map: tex, roughness: 0.9, metalness: 0.02});
    }

    function createVisual(itemId) {
        if (visualCache.has(itemId)) return visualCache.get(itemId);
        const item = GAME_DATA.items[itemId];
        const root = new THREE.Group();
        root.name = "DroppedItem_" + itemId;
        root.userData.dropItemId = itemId;
        if (item?.type === "block") {
            const cube = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), createBlockDropMaterial(itemId));
            cube.castShadow = false;
            cube.receiveShadow = false;
            root.add(cube);
        } else {
            const canvas = createItemIcon(itemId);
            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            tex.needsUpdate = true;
            const material = new THREE.SpriteMaterial({map: tex, transparent: true, alphaTest: 0.05, depthWrite: true});
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(0.48, 0.48, 1);
            root.add(sprite);
            root.userData.sprite = sprite;
        }
        visualCache.set(itemId, root);
        return root;
    }

    function acquireVisual(itemId) {
        const pool = visualPools.get(itemId);
        if (pool && pool.length) return pool.pop();
        // Reuse the cached visual for the first instance, then clone it for extra simultaneous drops.
        const cached = createVisual(itemId);
        if (!cached.userData.inUse) {
            cached.userData.inUse = true;
            return cached;
        }
        const clone = cached.clone(true);
        clone.userData = {...cached.userData, inUse:true};
        return clone;
    }

    function releaseVisual(root) {
        if (!root) return;
        root.visible = false;
        root.userData.inUse = false;
        const itemId = root.userData.dropItemId;
        if (!itemId) return;
        let pool = visualPools.get(itemId);
        if (!pool) visualPools.set(itemId, pool = []);
        if (pool.length < 12) pool.push(root);
        else if (root !== visualCache.get(itemId)) {
            // Clone shares geometry/material with cached visual; no disposal here.
        }
    }

    function spawn(itemId, position, amount = 1) {
        if (!GAME_DATA.items[itemId] || drops.length >= MAX_DROPS) return;
        const root = acquireVisual(itemId);
        const jitterX = (Math.random() - 0.5) * 0.22;
        const jitterZ = (Math.random() - 0.5) * 0.22;
        const terrain = WORLD.getTerrainHeight(position.x, position.z);
        root.position.set(position.x + jitterX, Math.max(position.y + 0.18, terrain + 0.35), position.z + jitterZ);
        root.rotation.y = Math.random() * Math.PI * 2;
        root.visible = true;
        GAME.scene.add(root);
        const sprite = root.userData.sprite;
        if (sprite) sprite.material.rotation = 0;
        const drop = {
            itemId, amount:Math.max(1, amount|0), object:root, age:0, life:300,
            velY:2.4, phase:Math.random()*Math.PI*2, dead:false, collisionBox:null
        };
        // Vật phẩm rơi có hitbox nhỏ để hệ thống AI/đối tượng có thể truy vấn;
        // không dùng hitbox này để chặn người chơi.
        if (typeof COLLISION_SYSTEM !== "undefined") {
            COLLISION_SYSTEM.createBox(drop, 0.18, 0.18, 0.18, 0);
        }
        drops.push(drop);
    }

    function tryPickup(drop) {
        const data = GAME_DATA.items[drop.itemId];
        if (!data) return false;
        const maxStack = Number(data.maxStack || 256);
        const current = Number(GAME.inventory[drop.itemId] || 0);
        if (current >= maxStack) return false;
        const add = Math.min(drop.amount, maxStack - current);
        GAME.inventory[drop.itemId] = current + add;
        ensureInventoryStacks();
        drop.amount -= add;
        updateHotbar();
        if (PLAYER?.updateHeldItem) PLAYER.updateHeldItem(GAME.hotbarItems[GAME.selectedSlot]);
        return drop.amount <= 0;
    }

    function removeDrop(drop) {
        if (!drop?.object) return;
        drop.dead = true;
        if (typeof COLLISION_SYSTEM !== "undefined") COLLISION_SYSTEM.unregister(drop);
        GAME.scene.remove(drop.object);
        releaseVisual(drop.object);
        drop.object = null;
        const i = drops.indexOf(drop);
        if (i >= 0) drops.splice(i, 1);
    }

    function update(delta) {
        const playerPos = PLAYER.player.position;
        for (let i = drops.length - 1; i >= 0; i--) {
            const drop = drops[i];
            if (!drop.object) { drops.splice(i,1); continue; }
            drop.age += delta;
            drop.life -= delta;
            const dx = playerPos.x - drop.object.position.x;
            const dz = playerPos.z - drop.object.position.z;
            const horizontal = Math.hypot(dx,dz);
            const dy = Math.abs(playerPos.y - drop.object.position.y);
            if (drop.age >= PICKUP_DELAY && horizontal <= PICKUP_RADIUS && dy <= 2.2) {
                if (tryPickup(drop)) { removeDrop(drop); continue; }
            }
            if (drop.age < 1.0) {
                drop.velY -= 7.5 * delta;
                drop.object.position.y += drop.velY * delta;
                const floor = WORLD.getTerrainHeight(drop.object.position.x, drop.object.position.z) + 0.28;
                if (drop.object.position.y <= floor) { drop.object.position.y=floor; drop.velY=0; }
            }
            const floor = WORLD.getTerrainHeight(drop.object.position.x, drop.object.position.z) + 0.28;
            if (drop.velY === 0) drop.object.position.y = floor + Math.sin(drop.age*3.2+drop.phase)*0.035;
            drop.object.rotation.y += delta*1.8;
            const sprite = drop.object.userData.sprite;
            if (sprite) sprite.material.rotation += delta*0.8;
            if (drop.life <= 0 || drop.object.position.distanceTo(playerPos) > 170) removeDrop(drop);
        }
    }
    return {spawn, update};
})();

/* =========================================================
   PROJECTILE POOL
   - Không tạo/hủy SphereGeometry + Material cho từng quả cầu.
   - Tối đa 24 projectile đồng thời; slot được tái sử dụng.
   ========================================================= */
const PROJECTILE_POOL = (() => {
    const MAX = 24;
    const items = [];
    const geometry = new THREE.SphereGeometry(0.14, 8, 8);
    const materials = new Map();
    function getMaterial(color) {
        if (!materials.has(color)) materials.set(color, new THREE.MeshBasicMaterial({color}));
        return materials.get(color);
    }
    function acquire(color) {
        let p = items.find(x => !x.active);
        if (!p) {
            if (items.length >= MAX) return null;
            p = {object:new THREE.Mesh(geometry, getMaterial(color)), active:false, velocity:new THREE.Vector3(), target:new THREE.Vector3(), from:null, damage:0, vision:0, elapsed:0};
            items.push(p);
            GAME.scene.add(p.object);
        } else if (p.object.material !== getMaterial(color)) p.object.material = getMaterial(color);
        p.active = true;
        p.elapsed = 0;
        p.object.visible = true;
        return p;
    }
    function release(p) { p.active=false; p.object.visible=false; }
    function pointHitsEntity(point, entity, padding = 0.12) {
        if (typeof COLLISION_SYSTEM === "undefined" || !entity?.collisionBox) {
            return point.distanceTo(entity?.position || point) < 0.55;
        }
        const b = COLLISION_SYSTEM.bounds(entity);
        return point.x >= b.minX - padding && point.x <= b.maxX + padding &&
               point.y >= b.minY - padding && point.y <= b.maxY + padding &&
               point.z >= b.minZ - padding && point.z <= b.maxZ + padding;
    }

    function update(delta) {
        for (const p of items) {
            if (!p.active) continue;
            p.elapsed += delta;
            p.object.position.addScaledVector(p.velocity, delta);

            let collided = false;
            if (p.targetMob?.__decoy) {
                collided = pointHitsEntity(p.object.position, p.targetMob.decoyRef);
            } else if (p.targetMob && !p.targetMob.dead) {
                collided = pointHitsEntity(p.object.position, p.targetMob);
            } else {
                collided = pointHitsEntity(p.object.position, PLAYER.player);
            }

            if (collided || p.object.position.distanceTo(p.target) < 0.35 || p.elapsed > 2.5) {
                if (collided || p.object.position.distanceTo(p.target) < 0.35) {
                    if (p.targetMob?.__decoy) DECOY_SYSTEM.damage(p.targetMob.decoyRef,p.damage);
                    else if (p.targetMob && !p.targetMob.dead) {
                        MOB_SYSTEM.damage(p.targetMob, p.damage, "projectile");
                    } else {
                        PLAYER.damage(p.damage);
                        if (p.vision > 0) GAME.triggerVisionDebuff(p.vision);
                    }
                }
                release(p);
            }
        }
    }
    return {acquire,release,update};
})();

function stopMiningActionState(){GAME.mining=false;GAME.miningTarget=null;GAME.miningProgress=0;clearCrackOverlay();PLAYER.setMiningAnimation(false,0.06);}

function updateMining(delta) {
    if (!AV_CAN("break")) { stopMiningActionState(); return; }
    if (!GAME.mining) {
        GAME.miningTarget = null;
        GAME.miningProgress = 0;
        clearCrackOverlay();
        PLAYER.setMiningAnimation(false, delta);
        return;
    }

    // The mining target is always the center crosshair/camera ray, never the
    // finger's screen position. The mining finger can rotate the camera, while
    // the left joystick independently controls player movement.
    const aim = getAimBlock();
    const toolId = GAME.hotbarItems[GAME.selectedSlot];
    const blockId = aim ? WORLD.getBlock(aim.breakPos.x, aim.breakPos.y, aim.breakPos.z) : 0;
    const blockName = WORLD_BLOCK_NAME[blockId];

    if (!aim || aim.distance > 12 || !blockName || !canMineBlock(toolId, blockName)) {
        GAME.miningTarget = null;
        GAME.miningProgress = 0;
        clearCrackOverlay();
        PLAYER.setMiningAnimation(true, delta);
        return;
    }

    const key = `${aim.breakPos.x},${aim.breakPos.y},${aim.breakPos.z}`;
    if (GAME.miningTarget !== key) {
        GAME.miningTarget = key;
        GAME.miningProgress = 0;
    }

    const data = GAME_DATA.blocks[blockName];

    // Mọi block (trừ Titanite Vĩnh Hằng) đều có thể bị phá bằng tay hoặc
    // bằng Drill cấp thấp. Công cụ tốt hơn chỉ làm tăng tốc độ phá.
    const selectedItem = GAME_DATA.items[toolId];
    const isTool = !!selectedItem && (selectedItem.type === "tool" || selectedItem.toolType === "drill");
    const drillLevel = isTool ? Math.max(1, Number(selectedItem.miningLevel || 1)) : 0;
    const requiredLevel = Math.max(1, Number(data?.mineLevel || 1));

    // Tay không: rất chậm. Drill cấp thấp vẫn phá được block cấp cao nhưng
    // sẽ chậm hơn đáng kể. Drill đúng cấp trở lên nhanh hơn.
    let speed = isTool ? 0.85 + drillLevel * 0.30 : 0.16;
    if (isTool && drillLevel < requiredLevel) {
        speed *= Math.max(0.12, 1 / (1 + (requiredLevel - drillLevel) * 1.35));
    } else if (isTool) {
        speed *= 1 + Math.min(0.45, (drillLevel - requiredLevel) * 0.12);
    }

    const duration = AV_IS_FREE() ? 0.08 : Math.max(0.25, Number(data?.hardness || 1) * 0.38 / speed);
    GAME.miningProgress += delta / duration;
    PLAYER.setMiningAnimation(true, delta);
    updateCrackOverlay(aim, GAME.miningProgress);

    if (GAME.miningProgress >= 1) {
        const breakX = aim.breakPos.x, breakY = aim.breakPos.y, breakZ = aim.breakPos.z;
        const previousBlock = WORLD.getBlock(breakX, breakY, breakZ);
        WORLD.setBlock(breakX, breakY, breakZ, 0);
        if (window.MULTIPLAYER?.enabled && window.NETWORK?.blockSync) {
            const ok = NETWORK.blockSync.request(breakX, breakY, breakZ, previousBlock, 0, GAME.dimension || "main");
            if (!ok) WORLD.setBlock(breakX, breakY, breakZ, previousBlock);
        }
        GAME.miningProgress = 0;
        GAME.miningTarget = null;
        clearCrackOverlay();
        // Chỉ công cụ mới tạo drop. Tay không phá được block nhưng không
        // làm rơi vật phẩm theo yêu cầu.
        const selectedItem = GAME_DATA.items[toolId];
        const usedTool = !!selectedItem && (selectedItem.type === "tool" || selectedItem.toolType === "drill");
        const itemId = blockName;
        if (usedTool && GAME_DATA.items[itemId]) {
            DROP_SYSTEM.spawn(
                itemId,
                new THREE.Vector3(aim.breakPos.x, aim.breakPos.y + 0.62, aim.breakPos.z),
                1
            );
        }
    }
}

const WORLD_BLOCK_NAME = {
    1: "titanite",
    2: "titanite_black",
    3: "titanite_blood",
    4: "titanite_igneous",
    5: "titanite_eternal",
    6: "titan_vault",
    7: "crafting_machine",
    8: "space_gate",
    9: "dark_matter_ore"
};

/* =========================================================
   SIMPLE MOB SYSTEM
   Warden: neutral until attacked; nearby wardens join the fight.
   Ravage: actively attacks player and Warden.
   ========================================================= */
const MOB_SYSTEM = (() => {
    const mobs = GAME.mobs;
    let loaded = false;
    let lastSpawnAttempt = 0;

    function makeMob(type, x, z) {
        const spec = type === "warden"
            ? { path: "./assets/models/Titanium_Warden.glb", hp: 100, speed: 1.5, scale: 1.0 }
            : type === "ravage"
                ? { path: "./assets/models/Titan_Ravage.glb", hp: 80, speed: 1.8, scale: 1.0 }
                : { path: null, hp: 1000, speed: 0, scale: 1.0 };

        const mob = {
            type,
            object: null,
            position: new THREE.Vector3(x, WORLD.getTerrainHeight(x, z) + 0.02, z),
            hp: spec.hp,
            maxHp: spec.hp,
            speed: spec.speed,
            hostile: type === "ravage",
            attackCooldown: 0,
            trainingDummy: type === "training_dummy",
            damageTexts: [],
            resetTimer: 0,
            rangedCooldown: 0,
            target: null,
            dead: false,
            mixer: null,
            actions: {},
            currentAction: null,
            attackAnim: 0,
            collisionBox: null,
            aiState: "idle",
            stuckTime: 0,
            lastTargetPosition: new THREE.Vector3(x, 0, z)
        };

        // Hitbox riêng theo loại sinh vật, không phụ thuộc mesh GLB.
        // Nhờ vậy AI vẫn va chạm ổn định dù model có phần nhô ra/lệch tâm.
        if (typeof COLLISION_SYSTEM !== "undefined") {
            if (type === "warden") COLLISION_SYSTEM.createBox(mob, 0.46, 1.05, 0.46, 1.05);
            else if (type === "training_dummy") COLLISION_SYSTEM.createBox(mob, 0.48, 1.35, 0.48, 1.35);
            else COLLISION_SYSTEM.createBox(mob, 0.58, 1.02, 0.58, 1.02);
        }

        if (type === "training_dummy") {
            const object = TRAINING_DUMMY_SYSTEM.makeModel();
            object.position.set(mob.position.x, mob.position.y, mob.position.z);
            object.userData.mob = mob;
            object.traverse(node => { node.userData.mob = mob; });
            GAME.scene.add(object);
            mob.object = object;
            mob.modelBottomOffset = 0;
            TRAINING_DUMMY_SYSTEM.addLabel(mob);
            TRAINING_DUMMY_SYSTEM.updateLabel(mob);
            mobs.push(mob);
            return mob;
        }

        ModelLoader.load(spec.path, (object, animations) => {
            if (mob.dead) return;
            mob.object = object;
            const box = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3();
            box.getSize(size);
            if (size.y > 0.001) object.scale.multiplyScalar(2.0 / size.y);
            object.updateMatrixWorld(true);
            const fitted = new THREE.Box3().setFromObject(object);
            mob.modelBottomOffset = fitted.min.y - object.position.y;
            object.position.y = mob.position.y - mob.modelBottomOffset;
            object.position.x = mob.position.x;
            object.position.z = mob.position.z;
            object.userData.mob = mob;
            object.traverse(node => { node.userData.mob = mob; });
            object.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
            GAME.scene.add(object);

            if (animations && animations.length) {
                mob.mixer = new THREE.AnimationMixer(object);
                for (const clip of animations) {
                    const n = String(clip.name || "").toLowerCase();
                    let key = n === "idle" ? "idle" : (n === "attack" ? "attack" : "walk");
                    mob.actions[key] = mob.mixer.clipAction(clip);
                    mob.actions[key].setLoop(THREE.LoopRepeat, Infinity);
                }
                playMobAnimation(mob, "idle");
            }
        }, () => {
            // If the model fails, create a tiny colored marker so the mob still exists.
            const color = type === "warden" ? 0x3fa7ad : 0x17121c;
            const o = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({color}));
            o.position.set(mob.position.x, mob.position.y + 1, mob.position.z);
            o.userData.mob = mob;
            mob.object = o;
            GAME.scene.add(o);
        });
        mobs.push(mob);
        return mob;
    }

    function playMobAnimation(mob, name) {
        if (!mob.mixer) return;
        const action = mob.actions[name] || mob.actions.idle;
        if (!action || action === mob.currentAction) return;
        action.reset();
        if (mob.currentAction) mob.currentAction.crossFadeTo(action, 0.12, true);
        action.play();
        mob.currentAction = action;
    }

    // Mobs spawn only OUTSIDE the player's 2-chunk radius.
    // Chunk size is 32 blocks, so the inner safe radius is 64 blocks.
    // Keep the population small for mobile performance.
    const MOB_CHUNK_SIZE = 32;
    const MOB_MIN_DISTANCE = MOB_CHUNK_SIZE * 2 + 8;   // 72 blocks
    const MOB_MAX_DISTANCE = MOB_CHUNK_SIZE * 3.5;     // 112 blocks
    const MOB_DESPAWN_DISTANCE = MOB_CHUNK_SIZE * 5;   // 160 blocks
    const MOB_MAX_COUNT = 4;
    const MOB_SPAWN_INTERVAL = 9000; // one spawn attempt every 9 seconds

    function ensureSpawned() {
        if (window.MULTIPLAYER?.enabled) return;
        if (!GAME.worldReady || !GAME.mobsReady) return;
        const now = performance.now();
        if (now - lastSpawnAttempt < MOB_SPAWN_INTERVAL) return;
        lastSpawnAttempt = now;

        const px = PLAYER.player.position.x;
        const pz = PLAYER.player.position.z;

        // Remove very distant mobs so the list does not grow forever.
        for (let i = mobs.length - 1; i >= 0; i--) {
            const mob = mobs[i];
            if (mob.type === "training_dummy") continue;
            if (mob.dead) {
                mobs.splice(i, 1);
                continue;
            }
            const dx = mob.position.x - px;
            const dz = mob.position.z - pz;
            if (Math.hypot(dx, dz) > MOB_DESPAWN_DISTANCE) {
                if (typeof COLLISION_SYSTEM !== "undefined") COLLISION_SYSTEM.unregister(mob);
                if (mob.object) {
                    GAME.scene.remove(mob.object);
                    mob.object.traverse(c => {
                        if (c.isMesh) {
                            c.geometry?.dispose?.();
                            if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
                            else c.material?.dispose?.();
                        }
                    });
                }
                mobs.splice(i, 1);
            }
        }

        const activeCombatMobCount = mobs.reduce((n, mob) => n + (!mob.dead && mob.type !== "training_dummy" ? 1 : 0), 0);
        if (activeCombatMobCount >= MOB_MAX_COUNT) return;

        // Pick a random point between 72 and 112 blocks from the player.
        // This prevents mobs from spawning beside the player.
        const angle = Math.random() * Math.PI * 2;
        const distance = MOB_MIN_DISTANCE +
            Math.random() * (MOB_MAX_DISTANCE - MOB_MIN_DISTANCE);
        const x = px + Math.cos(angle) * distance;
        const z = pz + Math.sin(angle) * distance;

        // Never spawn a mob on a chunk that has only been prepared or has not been
        // rendered yet. This keeps unloaded chunks completely empty of mobs.
        if (!WORLD.isWorldPositionLoaded(x, z)) return;
        const terrainY = WORLD.getTerrainHeight(x, z);
        if (!Number.isFinite(terrainY)) return;

        // Slightly favor Wardens; Ravage remains uncommon.
        const type = Math.random() < 0.75 ? "warden" : "ravage";
        makeMob(type, x, z);
    }

    function hitTrainingDummy(mob, amount, source = "unknown") {
        if (!mob || mob.dead || mob.type !== "training_dummy") return;
        const dmg = Math.max(0, Number(amount) || 0);
        if (dmg <= 0) return;
        mob.hp = Math.max(0, mob.hp - dmg);
        mob.lastDamage = dmg;
        mob.lastDamageSource = source;
        mob.resetTimer = mob.hp <= 0 ? 0.75 : 0;
        TRAINING_DUMMY_SYSTEM.spawnDamageText(mob, dmg);
        TRAINING_DUMMY_SYSTEM.updateLabel(mob);
    }

    function damage(mob, amount, source = "unknown") {
        if (!mob || mob.dead) return;
        if (mob.type === "training_dummy") { hitTrainingDummy(mob, amount, source); return; }
        if (mob.type === "warden") { hitWarden(mob, amount); return; }
        if (mob.type === "ravage") { hitRavage(mob, amount); return; }
        mob.hp -= Math.max(0, Number(amount) || 0);
        if (mob.hp <= 0) kill(mob, "player");
    }

    function hitWarden(mob, amount) {
        if (!mob || mob.dead) return;
        mob.hp -= amount;
        mob.hostile = true;
        for (const other of mobs) {
            if (other.dead || other.type !== "warden") continue;
            if (other.position.distanceTo(mob.position) <= 20) other.hostile = true;
        }
        if (mob.hp <= 0) kill(mob, "player");
    }

    function hitRavage(mob, amount) {
        if (!mob || mob.dead) return;
        mob.hp -= amount;
        if (mob.hp <= 0) kill(mob, "player");
    }

    function kill(mob, killer) {
        if (mob.dead) return;
        mob.dead = true;
        if (typeof COLLISION_SYSTEM !== "undefined") COLLISION_SYSTEM.unregister(mob);
        if (mob.object) {
            GAME.scene.remove(mob.object);
            mob.object.traverse(c => {
                if (c.isMesh && c.geometry) c.geometry.dispose();
            });
        }
        // A Ravage killing a Warden causes the Warden to transform.
        if (killer === "ravage" && mob.type === "warden") {
            const x = mob.position.x, z = mob.position.z;
            makeMob("ravage", x, z);
        }
    }

    function fireOrb(from, target, color, damage, visionSeconds = 0, targetMob = null) {
        const startPos = from.clone().add(new THREE.Vector3(0, 1.45, 0));
        const end = target.clone().add(new THREE.Vector3(0, 1.0, 0));
        const orb = PROJECTILE_POOL.acquire(color);
        if (!orb) return;
        orb.object.position.copy(startPos);
        orb.target.copy(end);
        orb.velocity.copy(end).sub(startPos).normalize().multiplyScalar(9);
        orb.damage = damage;
        orb.vision = visionSeconds;
        orb.targetMob = targetMob;
    }

    function hasLineOfSight(from, to) {
        const start = from.clone(); start.y += 1.0;
        const end = to.clone(); end.y += 1.0;
        const dir = end.clone().sub(start);
        const dist = dir.length();
        if (dist <= 0.01) return true;
        dir.normalize();
        const ray = new THREE.Raycaster(start, dir, 0, dist);
        const meshes = [];
        for (const child of GAME.scene.children) if (child?.userData?.isWorldChunk) meshes.push(child);
        return ray.intersectObjects(meshes, false).length === 0;
    }

    function moveMobToward(mob, target, delta) {
        const dir = target.clone().sub(mob.position);
        dir.y = 0;
        if (dir.lengthSq() < 0.01) return false;
        dir.normalize();
        const amount = mob.speed * delta;

        const candidates = [
            dir.clone(),
            new THREE.Vector3(-dir.z, 0, dir.x),
            new THREE.Vector3(dir.z, 0, -dir.x),
            new THREE.Vector3(-dir.x, 0, -dir.z)
        ];

        for (const d of candidates) {
            const nx = mob.position.x + d.x * amount;
            const nz = mob.position.z + d.z * amount;
            const foot = WORLD.getTerrainHeight(nx, nz) + 0.02;
            if (!Number.isFinite(foot)) continue;

            const bx = Math.floor(nx + 0.5), bz = Math.floor(nz + 0.5);
            const blockedByWorld =
                WORLD.isSolid(bx, Math.floor(mob.position.y + 0.9), bz) ||
                WORLD.isSolid(bx, Math.floor(mob.position.y + 1.7), bz);
            if (blockedByWorld) continue;

            let blockedByEntity = false;
            if (typeof COLLISION_SYSTEM !== "undefined") {
                blockedByEntity = !COLLISION_SYSTEM.canMoveTo(
                    mob, nx, nz, 0.015,
                    other => other !== mob && !other.dead
                );
            }
            if (blockedByEntity) continue;

            mob.position.x = nx;
            mob.position.z = nz;
            mob.position.y = foot;
            mob.stuckTime = 0;
            return true;
        }

        mob.stuckTime += delta;
        return false;
    }

    function getTargetGap(mob, targetEntity) {
        if (!targetEntity) return Infinity;
        if (typeof COLLISION_SYSTEM !== "undefined" && mob.collisionBox && targetEntity.collisionBox) {
            return COLLISION_SYSTEM.horizontalGap(mob, targetEntity);
        }
        return mob.position.distanceTo(targetEntity.position || targetEntity);
    }

    function update(delta) {
        ensureSpawned();
        for (const mob of mobs) {
            if (mob.dead || !mob.object) continue;

            if (mob.type === "training_dummy") {
                if (mob.resetTimer > 0) {
                    mob.resetTimer -= delta;
                    if (mob.resetTimer <= 0) {
                        mob.hp = mob.maxHp;
                        TRAINING_DUMMY_SYSTEM.updateLabel(mob);
                    }
                }
                for (let i = mob.damageTexts.length - 1; i >= 0; i--) {
                    const d = mob.damageTexts[i];
                    d.life -= delta;
                    d.sprite.position.y += delta * 0.7;
                    d.sprite.material.opacity = Math.max(0, Math.min(1, d.life / 0.8));
                    if (d.life <= 0) {
                        mob.object.remove(d.sprite);
                        d.sprite.material.map?.dispose?.();
                        d.sprite.material.dispose?.();
                        mob.damageTexts.splice(i,1);
                    }
                }
                continue;
            }
            mob.attackCooldown -= delta;
            mob.rangedCooldown -= delta;
            if (mob.mixer) mob.mixer.update(delta);

            const playerPos = PLAYER.player.position;
            let target = null;
            let targetMob = null;
            let dist = Infinity;

            if (mob.type === "ravage" || mob.hostile) {
                target = playerPos;
                dist = getTargetGap(mob, PLAYER.player);

                // Nếu Hình nhân thế mạng nằm trong bán kính phát hiện của mob, mob chuyển
                // mục tiêu từ người chơi sang Hình nhân. Bảo vệ sát thương vẫn không giới hạn khoảng cách.
                const decoy = DECOY_SYSTEM.findForTarget(playerPos, mob.position, mob.type === "warden" ? 14 : 12);
                if (decoy) {
                    target = decoy.position;
                    targetMob = {
                        __decoy: true,
                        decoyRef: decoy,
                        position: decoy.position,
                        hp: decoy.hp,
                        dead: decoy.dead
                    };
                    dist = getTargetGap(mob, decoy);
                }
            }

            // Wardens actively detect and fight nearby Titan Ravage.
            // This is separate from their player hostility state.
            if (mob.type === "warden") {
                for (const other of mobs) {
                    if (other.dead || other === mob || other.type !== "ravage") continue;
                    const d = getTargetGap(mob, other);
                    if (d < dist && d <= 14 && hasLineOfSight(mob.position, other.position)) {
                        target = other.position;
                        targetMob = other;
                        dist = d;
                    }
                }
            }

            if (mob.type === "ravage") {
                for (const other of mobs) {
                    if (other.dead || other === mob || other.type !== "warden") continue;
                    const d = getTargetGap(mob, other);
                    if (d < dist && d < 12 && hasLineOfSight(mob.position, other.position)) {
                        target = other.position;
                        targetMob = other;
                        dist = d;
                    }
                }
            }

            if (target) {
                mob.aiState = dist > (mob.type === "warden" ? 6 : 5) ? "ranged" : (dist > 0.08 ? "chase" : "attack");
                mob.lastTargetPosition.copy(target);
                const canRanged = mob.rangedCooldown <= 0 && dist > (mob.type === "warden" ? 6 : 5);

                if (canRanged) {
                    mob.rangedCooldown = mob.type === "warden" ? 2.2 : 2.0;
                    playMobAnimation(mob, "attack");
                    if (mob.type === "warden") {
                        // Blue energy orb fired from the top of the Warden's head.
                        fireOrb(mob.position, target, 0x39a9ff, 4, 0, targetMob);
                    } else {
                        // Black orb: 4 damage + short, slight vision reduction.
                        fireOrb(mob.position, target, 0x090909, 4, 1.8, targetMob);
                    }
                } else if (dist > 0.08) {
                    moveMobToward(mob, target, delta);
                    playMobAnimation(mob, "walk");
                } else if (mob.attackCooldown <= 0) {
                    mob.attackCooldown = mob.type === "warden" ? 1.2 : 1.0;
                    playMobAnimation(mob, "attack");
                    if (targetMob?.__decoy) {
                        DECOY_SYSTEM.damage(targetMob.decoyRef, mob.type === "warden" ? 6 : 8);
                    } else if (target === playerPos) {
                        PLAYER.damage(mob.type === "warden" ? 6 : 8);
                    } else if (targetMob) {
                        targetMob.hp -= (mob.type === "warden" ? 6 : 8);
                        if (targetMob.hp <= 0) kill(targetMob, mob.type);
                    }
                }
            } else {
                mob.aiState = "idle";
                playMobAnimation(mob, "idle");
            }

            if (mob.object) {
                mob.object.position.x = mob.position.x;
                mob.object.position.z = mob.position.z;
                // Keep the entire model, including Ravage's circular base, above terrain.
                if (mob.modelBottomOffset !== undefined) {
                    mob.object.position.y = mob.position.y - mob.modelBottomOffset;
                }

                if (target) {
                    const a = Math.atan2(target.x - mob.position.x, target.z - mob.position.z);
                    // Ravage's GLB faces the opposite local direction, so rotate it 180°.
                    mob.object.rotation.y = mob.type === "ravage" ? a + Math.PI : a;
                }
            }
        }
    }

    function spawnTrainingDummy(x, y, z) {
        const mob = makeMob("training_dummy", x, z);
        if (mob) { mob.position.y = y; if (mob.object) mob.object.position.y = y; }
        return mob;
    }

    return { ensureSpawned, update, hitWarden, hitRavage, hitTrainingDummy, damage, spawnTrainingDummy, killMob: kill };
})();

/* =========================================================
   HÌNH NHÂN THẾ MẠNG
   - Đặt xuống thế giới bằng thao tác tap/place.
   - Sao chép nguyên trạng model người chơi tại thời điểm đặt.
   - Có 60 HP mặc định.
   - Không giới hạn khoảng cách chịu sát thương: hình nhân cùng thế giới
     sẽ nhận toàn bộ sát thương thay cho người chơi.
   - Mob đang nhắm người chơi sẽ chuyển mục tiêu sang hình nhân cùng thế giới.
   - Hình nhân ở thế giới/chiều không gian khác không có tác dụng.
   ========================================================= */
const TRAINING_DUMMY_SYSTEM = (() => {
    const RESET_DELAY = 0.75;

    function makeStoneMaterial(color, emissive = 0x000000, intensity = 0) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.88,
            metalness: 0.05,
            emissive,
            emissiveIntensity: intensity
        });
    }

    function makeModel() {
        const root = new THREE.Group();
        root.name = "TitaniteIgneousTrainingDummy";

        const stone = makeStoneMaterial(0x49343a);
        const dark = makeStoneMaterial(0x24191d);
        const hot = makeStoneMaterial(0x9f4638, 0xff5b36, 0.85);
        const hot2 = makeStoneMaterial(0xd9774f, 0xff8b58, 1.15);

        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.02, 0.42), stone);
        torso.position.y = 1.42;
        root.add(torso);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.48), stone);
        head.position.y = 2.22;
        root.add(head);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.18, 6), dark);
        neck.position.y = 1.98;
        root.add(neck);

        const armGeo = new THREE.BoxGeometry(0.22, 0.86, 0.22);
        const leftArm = new THREE.Mesh(armGeo, stone); leftArm.position.set(-0.52,1.42,0); root.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, stone); rightArm.position.set(0.52,1.42,0); root.add(rightArm);

        const legGeo = new THREE.BoxGeometry(0.25, 0.88, 0.25);
        const leftLeg = new THREE.Mesh(legGeo, dark); leftLeg.position.set(-0.20,0.52,0); root.add(leftLeg);
        const rightLeg = new THREE.Mesh(legGeo, dark); rightLeg.position.set(0.20,0.52,0); root.add(rightLeg);

        // Titanite Nham's characteristic hot seams.
        const seamGeo = new THREE.BoxGeometry(0.055, 0.62, 0.018);
        const seam = new THREE.Mesh(seamGeo, hot); seam.position.set(0.04,1.48,0.222); seam.rotation.z=-0.18; root.add(seam);
        const seam2 = new THREE.Mesh(new THREE.BoxGeometry(0.035,0.30,0.018), hot2); seam2.position.set(-0.19,2.23,0.245); seam2.rotation.z=0.22; root.add(seam2);
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.025), hot2); core.position.set(0,1.52,0.235); root.add(core);

        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.48,0.58,0.16,8), dark);
        pedestal.position.y = 0.08;
        root.add(pedestal);

        root.traverse(c => { if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; c.userData.trainingDummyPart=true; }});
        return root;
    }

    function addLabel(mob) {
        const canvas = document.createElement('canvas'); canvas.width=256; canvas.height=64;
        const ctx = canvas.getContext('2d'); ctx.clearRect(0,0,256,64);
        ctx.font='bold 24px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='rgba(10,12,16,.72)'; ctx.fillRect(18,8,220,48);
        ctx.strokeStyle='rgba(255,160,110,.85)'; ctx.strokeRect(18,8,220,48);
        ctx.fillStyle='#fff0e8'; ctx.fillText('Hình nhân luyện chiêu',128,23);
        ctx.fillStyle='#ffb38d'; ctx.font='bold 20px Arial'; ctx.fillText('HP 1000 / 1000',128,45);
        const tex=new THREE.CanvasTexture(canvas); tex.minFilter=THREE.LinearFilter; tex.magFilter=THREE.LinearFilter; tex.needsUpdate=true;
        const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});
        const sprite=new THREE.Sprite(mat); sprite.scale.set(2.7,0.68,1); sprite.position.y=3.05;
        mob.object.add(sprite); mob.label=sprite; mob.labelCanvas=canvas; mob.labelTexture=tex;
    }

    function updateLabel(mob) {
        if(!mob.labelCanvas || !mob.labelTexture) return;
        const ctx=mob.labelCanvas.getContext('2d'); ctx.clearRect(0,0,256,64);
        ctx.font='bold 24px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillStyle='rgba(10,12,16,.72)'; ctx.fillRect(18,8,220,48);
        ctx.strokeStyle='rgba(255,160,110,.85)'; ctx.strokeRect(18,8,220,48);
        ctx.fillStyle='#fff0e8'; ctx.fillText('Hình nhân luyện chiêu',128,23);
        ctx.fillStyle=mob.hp>0?'#ffb38d':'#ff7070'; ctx.font='bold 20px Arial'; ctx.fillText(`HP ${Math.ceil(mob.hp)} / ${mob.maxHp}`,128,45);
        mob.labelTexture.needsUpdate=true;
    }

    function spawnDamageText(mob, amount) {
        if(!mob.object) return;
        const canvas=document.createElement('canvas'); canvas.width=128; canvas.height=48;
        const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,128,48);
        ctx.font='bold 34px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.strokeStyle='rgba(20,8,8,.9)'; ctx.lineWidth=6; ctx.strokeText(String(Math.round(amount)),64,25);
        ctx.fillStyle='#fff1df'; ctx.fillText(String(Math.round(amount)),64,25);
        const tex=new THREE.CanvasTexture(canvas); tex.needsUpdate=true;
        const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false});
        const sp=new THREE.Sprite(mat); sp.scale.set(0.85,0.32,1); sp.position.set((Math.random()-.5)*.35,2.45,0); mob.object.add(sp);
        mob.damageTexts.push({sprite:sp,tex,life:0.8,baseY:sp.position.y});
    }

    function place() {
        const count=Number(GAME.inventory.titan_training_dummy||0);
        if(count<=0) return false;
        const target=getPlacementTarget();
        if(!target) return false;
        const p=target.p;
        if(Math.abs(p.x-PLAYER.player.position.x)<1 && Math.abs(p.z-PLAYER.player.position.z)<1) return false;
        const mob=MOB_SYSTEM.spawnTrainingDummy(p.x,p.y+0.5,p.z);
        if(!mob) return false;
        GAME.inventory.titan_training_dummy=count-1;
        ensureInventoryStacks(); updateHotbar();
        if(typeof toast==='function') toast('Đã đặt Hình nhân luyện chiêu Titanite Nham.');
        return true;
    }

    return {makeModel,addLabel,updateLabel,spawnDamageText,RESET_DELAY,place};
})();

const DECOY_SYSTEM = (() => {
    const decoys = [];
    const MAX_DECOYS = 8;

    function clonePlayerModel() {
        if (!PLAYER.player.object) return null;
        const clone = PLAYER.player.object.clone(true);
        clone.name = "ReviveDecoy";
        clone.traverse(c => {
            if (c.isMesh) {
                c.castShadow = true;
                c.receiveShadow = true;
                c.frustumCulled = true;
            }
        });
        return clone;
    }

    function place() {
        if ((GAME.inventory.revive_decoy || 0) <= 0) return false;
        if (decoys.length >= MAX_DECOYS) {
            if (typeof toast === "function") toast("Đã đạt giới hạn 8 Hình nhân thế mạng.");
            return false;
        }

        const aim = getAimBlock();
        if (!aim || aim.distance > 12) return false;
        const p = aim.placePos;
        if (p.y < 0 || p.y >= WORLD.WORLD_HEIGHT) return false;
        if (WORLD.isSolid(p.x, p.y, p.z)) return false;
        if (isInsidePlayer(p.x, p.y, p.z)) return false;

        const object = clonePlayerModel();
        if (!object) return false;

        // placePos là tâm ô voxel; chân thực thể nằm trên mặt trên của block bên dưới.
        const position = new THREE.Vector3(p.x, p.y + 0.5, p.z);
        object.position.copy(position);
        object.rotation.y = PLAYER.player.object.rotation.y;
        object.userData.reviveDecoy = true;

        const decoy = {
            object,
            position,
            hp: Math.max(1, Number(PLAYER.player.maxHealth || 60)),
            maxHp: Math.max(1, Number(PLAYER.player.maxHealth || 60)),
            dead: false,
            // Hình nhân chỉ có hiệu lực trong đúng thế giới/chiều không gian
            // nơi nó được đặt.
            dimension: GAME.dimension,
            collisionBox: null
        };
        if (typeof COLLISION_SYSTEM !== "undefined") {
            COLLISION_SYSTEM.createBox(decoy, 0.40, 1.0, 0.40, 1.0);
        }
        object.userData.decoy = decoy;
        GAME.scene.add(object);
        decoys.push(decoy);
        GAME.inventory.revive_decoy--;
        updateHotbar();
        if (typeof toast === "function") toast("Đã đặt Hình nhân thế mạng.");
        return true;
    }

    function getForPlayer(playerPosition) {
        let best = null;
        let bestDistance = Infinity;
        for (const d of decoys) {
            if (d.dead || !d.object) continue;
            // Không giới hạn khoảng cách. Chỉ kiểm tra cùng thế giới.
            if (d.dimension !== GAME.dimension) continue;
            const dist = d.position.distanceTo(playerPosition);
            if (dist < bestDistance) {
                best = d;
                bestDistance = dist;
            }
        }
        return best;
    }

    function damage(decoy, amount) {
        if (!decoy || decoy.dead) return false;
        decoy.hp -= Math.max(0, Number(amount) || 0);
        if (decoy.hp <= 0) remove(decoy);
        return true;
    }

    function remove(decoy) {
        if (!decoy || decoy.dead) return;
        decoy.dead = true;
        if (typeof COLLISION_SYSTEM !== "undefined") COLLISION_SYSTEM.unregister(decoy);
        if (decoy.object) {
            GAME.scene.remove(decoy.object);
            decoy.object.traverse(c => {
                if (c.isMesh) {
                    c.geometry?.dispose?.();
                    // Không dispose material dùng chung với player model.
                }
            });
        }
        const i = decoys.indexOf(decoy);
        if (i >= 0) decoys.splice(i, 1);
        if (typeof toast === "function") toast("Hình nhân thế mạng đã bị phá hủy.");
    }

    function findForTarget(playerPosition, mobPosition, detectionRadius = 0) {
        // Mob chỉ đổi mục tiêu nếu hình nhân nằm trong vùng phát hiện của mob.
        // Cơ chế nhận sát thương thay cho người chơi vẫn không giới hạn khoảng cách.
        let best = null;
        let bestDistance = Infinity;
        for (const d of decoys) {
            if (d.dead || !d.object) continue;
            if (d.dimension !== GAME.dimension) continue;
            const playerDist = d.position.distanceTo(playerPosition);
            if (!Number.isFinite(playerDist)) continue;
            const mobDist = d.position.distanceTo(mobPosition);
            if (detectionRadius > 0 && mobDist > detectionRadius) continue;
            if (mobDist < bestDistance) { best = d; bestDistance = mobDist; }
        }
        return best;
    }

    function getAll() { return decoys; }

    return { place, getForPlayer, findForTarget, damage, remove, getAll };
})();

function setupPreview() {

    const element =
        document.getElementById(
            "preview"
        );

    GAME.previewScene =
        new THREE.Scene();

    GAME.previewCamera =
        new THREE.PerspectiveCamera(
            45,
            1,
            0.1,
            100
        );

    GAME.previewCamera.position.set(
        2.5,
        2,
        3
    );

    GAME.previewCamera.lookAt(
        0,
        0,
        0
    );

    GAME.previewRenderer =
        new THREE.WebGLRenderer({
            alpha: true,
            antialias: false
        });

    GAME.previewRenderer.setSize(
        110,
        110
    );

    GAME.previewRenderer.setPixelRatio(1);

    element.appendChild(
        GAME.previewRenderer.domElement
    );

    GAME.previewScene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const previewKey = new THREE.DirectionalLight(0xffffff, 1.5);
    previewKey.position.set(2, 4, 3);
    GAME.previewScene.add(previewKey);
    const previewFill = new THREE.DirectionalLight(0x8fc7ff, 0.45);
    previewFill.position.set(-3, 1, -2);
    GAME.previewScene.add(previewFill);

    updatePreview();
}

function updatePreview() {
    if (!GAME.previewScene) return;

    while (GAME.previewScene.children.length > 1) {
        const child = GAME.previewScene.children[1];
        GAME.previewScene.remove(child);
        child.traverse(o => {
            if (o.isMesh && o.geometry) o.geometry.dispose();
            // Materials are generated specifically for this preview, so they can be disposed.
            if (o.isMesh && o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach(m => m?.dispose?.());
            }
        });
    }

    const id = GAME.hotbarItems[GAME.selectedSlot];
    const item = GAME_DATA.items[id];
    if (!item) return;

    // Dùng chính model 3D cầm tay để preview luôn đồng bộ hình dạng/màu với item thực tế.
    let model = null;
    try {
        if (PLAYER && typeof PLAYER.makeHeldModel === "function") {
            model = PLAYER.makeHeldModel(id);
        }
    } catch (e) {
        console.warn("Không tạo được preview model:", e);
    }

    if (!model) {
        const v = TextureSystem.getVisual(id);
        const material = new THREE.MeshStandardMaterial({
            color: TextureSystem.hex(v.body), roughness: 0.58, metalness: 0.22
        });
        model = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), material);
    }

    model.position.set(0, -0.05, 0);
    model.rotation.set(-0.12, -0.55, 0.08);
    model.scale.setScalar(1.65);
    model.userData.previewModel = true;
    GAME.previewScene.add(model);

    // Camera tự căn theo kích thước model để Drill/Crystal/Decoy không bị quá nhỏ/lớn.
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 0.25);
    const distance = Math.max(1.7, maxDim * 2.8);
    GAME.previewCamera.position.set(distance * 0.72, distance * 0.52, distance);
    GAME.previewCamera.lookAt(0, 0, 0);
}
function updateHotbar() {

    const hotbar =
        document.getElementById(
            "hotbar"
        );

    hotbar.innerHTML = "";

    GAME.hotbarItems.forEach(
        (id, index) => {

            const slot =
                document.createElement(
                    "div"
                );

            slot.className =
                "slot";

            if (
                index === GAME.selectedSlot
            ) {
                slot.classList.add(
                    "selected"
                );
            }

            if (id) {
                const icon = createItemIcon(id);
                slot.appendChild(icon);
            }

            const count =
                document.createElement(
                    "span"
                );

            count.className =
                "count";

            count.textContent = id ? (GAME.inventory[id] || 0) : "";

            slot.appendChild(
                count
            );

            slot.addEventListener(
                "click",
                () => {
                    selectHotbar(index);
                }
            );

            hotbar.appendChild(
                slot
            );
        }
    );
}

function createItemIcon(id) {
    const visualId = String(id || "").replace(/^(icon_|inv_|recipe_)/, "");
    return TextureSystem.createItemIcon("icon_" + visualId, ctx => {
        ctx.clearRect(0,0,32,32); ctx.imageSmoothingEnabled=false;
        ctx.save();
        ctx.scale(2,2);
        const v=TextureSystem.getVisual(visualId);
        const fill=(c,x,y,w,h)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
        const shadow=(x,y,w,h)=>fill("#000000",x+1,y+1,w,h);

        if(v.kind==="sword"){
            // Icon 32x32 thật: không upscale từ 16x16. Silhouette chéo và chi tiết
            // xanh/tím + vàng đồng bám sát ảnh tham chiếu.
            ctx.restore(); ctx.save(); ctx.imageSmoothingEnabled=false;
            const g=v.gold||"#d59a57", gl=v.goldLight||"#f2c77a";
            const bd=v.dark||"#0a1022", b=v.accent||"#4f7dff", w=v.edge||"#d8e8ff", vi=v.violet||"#9a62ff";
            const px=(x,y,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,1,1);};
            const rect=(x,y,w0,h0,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w0,h0);};
            // nền sâu để ánh sáng của lưỡi nổi rõ.
            rect(0,0,32,32,"#070b18");
            rect(1,1,30,1,"#17294c"); rect(1,30,30,1,"#111a30");
            // glow xanh/tím pixel từng lớp.
            const glow=[ [8,25],[9,24],[10,23],[11,22],[12,21],[13,20],[14,19],[15,18],[16,17],[17,16],[18,15],[19,14],[20,13],[21,12],[22,11],[23,10],[24,9],[25,8],[26,7],[27,6] ];
            glow.forEach(([x,y],i)=>{px(x,y,i%3===0?"#7e6dff":"#315dff"); if(i%2===0) px(x-1,y+1,"#2448c8");});
            // lưỡi bản rộng.
            rect(10,22,2,2,bd); rect(11,21,3,2,b); rect(12,20,3,2,w);
            rect(13,19,3,2,b); rect(14,18,3,2,w); rect(15,17,3,2,b);
            rect(16,16,3,2,w); rect(17,15,3,2,b); rect(18,14,3,2,w);
            rect(19,13,3,2,b); rect(20,12,3,2,w); rect(21,11,3,2,b);
            rect(22,10,3,2,w); rect(23,9,3,2,b); rect(24,8,2,2,w); rect(25,7,2,2,b); rect(26,6,1,2,w);
            // sống giữa và rãnh tím.
            [[12,21],[14,19],[16,17],[18,15],[20,13],[22,11],[24,9]].forEach(([x,y])=>rect(x,y,1,1,vi));
            [[13,20],[15,18],[17,16],[19,14],[21,12],[23,10],[25,8]].forEach(([x,y])=>rect(x,y,1,1,"#bfe7ff"));
            // đầu kiếm.
            rect(26,5,1,1,w); rect(27,5,1,1,"#8fc7ff"); rect(27,4,1,1,vi); rect(28,4,1,1,w);
            // hộ thủ vàng đồng nhiều tầng.
            rect(9,21,6,2,g); rect(10,20,4,1,gl); rect(8,22,3,2,g); rect(7,23,3,1,gl);
            rect(14,21,4,2,g); rect(17,22,3,1,g); rect(19,23,3,1,gl);
            rect(10,23,7,2,"#7b4522"); rect(11,23,5,1,g);
            // tinh thể ở tâm hộ thủ.
            rect(12,21,3,2,"#1e63e8"); rect(13,20,1,3,"#78dfff"); rect(14,21,1,1,vi);
            // chuôi và các vòng.
            rect(9,24,5,5,bd); rect(10,24,3,5,"#253e6c"); rect(11,24,1,5,b);
            rect(8,25,2,1,g); rect(9,27,5,1,g); rect(10,29,4,1,gl); rect(9,30,2,1,g); rect(13,30,2,1,g);
            rect(10,28,3,1,vi); rect(12,29,2,1,"#d8a65e");
            // điểm sáng kim loại.
            px(8,22,"#ffe1a0"); px(19,23,"#ffe1a0"); px(11,20,"#ffe9b5"); px(15,21,"#e8c8ff");
            ctx.restore(); return;
        }
        if(v.kind==="drill"){
            const level = Math.max(1, Math.min(4, Number((String(visualId).match(/(\d+)$/)||[1])[1])));
            shadow(3,4,7,10); fill(v.dark,3,4,6,9); fill(v.body,4,5,5,5); fill(v.edge,4,5,5,1);
            fill(v.accent,5,6,3,2); fill(v.dark,4,11,8,2);
            if(level===1){ fill(v.edge,9,7,3,2); fill(v.tip,12,7,3,1); }
            else if(level===2){ fill(v.edge,9,7,4,2); fill(v.accent,12,6,2,4); fill(v.tip,14,7,2,2); }
            else if(level===3){ fill(v.edge,9,7,3,2); fill(v.tip,12,6,3,1); fill(v.tip,12,9,3,1); fill(v.accent,14,7,2,2); }
            else { fill(v.edge,9,6,4,4); fill(v.accent,12,5,2,1); fill(v.accent,12,10,2,1); fill(v.tip,14,6,2,2); fill(v.tip,14,9,2,2); }
            ctx.restore(); return;
        }
        if(v.kind==="tool"){
            fill(v.dark,3,4,3,10); fill(v.body,4,4,3,8); fill(v.edge,5,4,2,1); fill(v.accent,6,8,7,2); fill(v.body,9,6,4,2); fill(v.tip,12,5,2,1); fill(v.tip,12,10,2,1); ctx.restore(); return;
        }
        if(v.kind==="tank"){
            fill(v.dark,5,3,6,12); fill(v.body,6,4,4,10); fill(v.edge,6,4,4,1); fill(v.accent,7,6,2,4); fill(v.tip,7,5,1,1); fill(v.dark,7,2,2,1); ctx.restore(); return;
        }
        if(v.kind==="crystal"){
            fill(v.dark,7,4,4,10); fill(v.body,6,6,6,6); fill(v.edge,8,3,2,2); fill(v.accent,7,5,4,6); fill(v.tip,8,5,1,1); ctx.restore(); return;
        }
        if(v.kind==="charm"){
            fill(v.dark,5,5,7,7); fill(v.body,6,5,5,7); fill(v.edge,6,5,5,1); fill(v.accent,8,7,2,3); fill(v.tip,8,6,1,1); ctx.restore(); return;
        }
        if(v.kind==="decoy"){
            fill(v.dark,6,3,5,3); fill(v.body,5,6,7,6); fill(v.edge,6,4,4,2); fill(v.accent,7,7,3,2); fill(v.tip,8,6,1,1); fill(v.dark,5,12,3,2); fill(v.dark,9,12,3,2); ctx.restore(); return;
        }
        if(v.kind==="training_dummy"){
            // 32x32 icon: hình nhân đá Titanite Nham, có lõi nhiệt ở ngực.
            fill(v.dark,7,3,6,3); fill(v.body,6,6,8,7); fill(v.edge,7,4,5,2);
            fill(v.accent,8,7,2,3); fill(v.tip,9,8,1,2);
            fill(v.body,3,7,3,7); fill(v.body,14,7,3,7); fill(v.edge,3,7,3,1); fill(v.edge,14,7,3,1);
            fill(v.dark,6,13,3,7); fill(v.dark,11,13,3,7); fill(v.body,5,19,5,2); fill(v.body,10,19,5,2);
            fill(v.accent,9,11,2,1); fill(v.tip,10,11,1,1); ctx.restore(); return;
        }
        if(v.kind==="orb"){
            fill(v.dark,6,5,7,7); fill(v.body,7,6,5,5); fill(v.edge,8,6,2,1); fill(v.accent,8,7,2,2); fill(v.tip,9,7,1,1); ctx.restore(); return;
        }
        if(v.kind==="component"){
            fill(v.dark,4,5,9,7); fill(v.body,5,5,7,6); fill(v.edge,5,5,6,1); fill(v.accent,7,7,3,2); fill(v.tip,8,7,1,1); ctx.restore(); return;
        }
        if(v.kind==="stone"){
            fill(v.dark,3,4,10,10); fill(v.body,4,4,8,8); fill(v.edge,4,4,6,1); fill(v.accent,6,6,4,3); fill(v.tip,7,6,1,1); ctx.restore(); return;
        }
        if(v.kind==="block"){
            fill(v.dark,3,3,10,10); fill(v.body,4,4,8,8); fill(v.edge,4,4,7,1); fill(v.accent,6,6,3,3); fill(v.tip,7,6,1,1);
            // Điểm nhấn riêng cho các block/khối đặc biệt.
            if(visualId==="titanite_blood" || visualId==="titanite_blood_block"){ fill(v.tip,10,10,2,2); }
            if(visualId==="space_gate"){ fill(v.accent,5,5,1,6); fill(v.accent,10,5,1,6); fill(v.tip,7,7,2,2); }
            if(visualId==="titan_vault"){ fill(v.accent,7,7,2,2); fill(v.tip,8,7,1,1); }
            if(visualId==="crafting_machine"){ fill(v.accent,6,6,4,1); fill(v.tip,7,7,2,2); }
            ctx.restore(); return;
        }
        fill(v.dark,3,3,10,10); fill(v.body,4,4,8,8); fill(v.edge,4,4,7,1); fill(v.accent,6,6,3,3); fill(v.tip,7,6,1,1);
    });
}

GAME.equipment = GAME.equipment || {head:null,chest:null,legs:null,feet:null,shield:null,weapon:null};
GAME.equipItem = function(id, slot) {
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.equip) return NETWORK.inventorySync.equip(id, slot);
    this.equipment[slot] = id; updateInventoryUI(); return true;
};
GAME.unequipItem = function(slot) {
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.unequip) return NETWORK.inventorySync.unequip(slot);
    this.equipment[slot] = null; updateInventoryUI(); return true;
};

function selectHotbar(index) {

    index = Math.max(0, Math.min(GAME.hotbarItems.length - 1, index));
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.selectHotbar) { NETWORK.inventorySync.selectHotbar(index); return; }

    GAME.selectedSlot =
        Math.max(
            0,
            Math.min(
                GAME.hotbarItems.length - 1,
                index
            )
        );

    updateHotbar();

    if (PLAYER && PLAYER.updateHeldItem) PLAYER.updateHeldItem(GAME.hotbarItems[GAME.selectedSlot]);
    updatePreview();
}


function setupMobUI() {
    // A simple hit interaction for the center crosshair: tapping the mine button
    // damages a creature instead of breaking a block when one is directly aimed at.
    const mine = document.getElementById("mineButton");
    if (!mine) return;
    mine.addEventListener("pointerdown", () => {
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(0, 0), GAME.camera);
        for (const mob of GAME.mobs) {
            if (mob.dead || !mob.object) continue;
            const hits = ray.intersectObject(mob.object, true);
            if (hits.length && hits[0].distance <= 5) {
                MOB_SYSTEM.damage(mob, 2, "hand");
                flashMobDamage(mob);
                break;
            }
        }
    });
}


const INVENTORY_MAX_STACK = 256;

function getMaxStackForItem(id) {
    const d = GAME_DATA.items[id] || GAME_DATA.blocks[id] || {};
    return Math.max(1, Number(d.maxStack || INVENTORY_MAX_STACK));
}

function ensureInventoryStacks() {
    if (!Array.isArray(GAME.inventoryStacks)) GAME.inventoryStacks = [];
    if (GAME.inventoryStacks.length !== 30) GAME.inventoryStacks.length = 30;
    for (let i = 0; i < 30; i++) if (!GAME.inventoryStacks[i]) GAME.inventoryStacks[i] = { id: null, count: 0 };

    const ids = new Set(Object.keys(GAME.inventory || {}));
    for (const st of GAME.inventoryStacks) if (st && st.id) ids.add(st.id);

    for (const id of ids) {
        let total = Math.max(0, Number(GAME.inventory[id] || 0));
        let sum = 0;
        for (const st of GAME.inventoryStacks) if (st.id === id) sum += Math.max(0, Number(st.count || 0));
        if (sum < total) {
            let left = total - sum;
            for (const st of GAME.inventoryStacks) {
                if (left <= 0) break;
                if (st.id === id) {
                    const add = Math.min(left, getMaxStackForItem(id) - st.count);
                    st.count += add; left -= add;
                }
            }
            for (const st of GAME.inventoryStacks) {
                if (left <= 0) break;
                if (!st.id || st.count <= 0) {
                    const add = Math.min(left, getMaxStackForItem(id));
                    st.id = id; st.count = add; left -= add;
                }
            }
        } else if (sum > total) {
            let remove = sum - total;
            for (let i = GAME.inventoryStacks.length - 1; i >= 0 && remove > 0; i--) {
                const st = GAME.inventoryStacks[i];
                if (st.id !== id) continue;
                const sub = Math.min(remove, st.count);
                st.count -= sub; remove -= sub;
                if (st.count <= 0) { st.id = null; st.count = 0; }
            }
        }
    }
}

function syncInventoryTotalFromStacks() {
    const totals = {};
    for (const st of GAME.inventoryStacks || []) {
        if (!st || !st.id || st.count <= 0) continue;
        totals[st.id] = (totals[st.id] || 0) + Number(st.count || 0);
    }
    for (const id of Object.keys(GAME.inventory || {})) GAME.inventory[id] = Number(totals[id] || 0);
    for (const id of Object.keys(totals)) GAME.inventory[id] = totals[id];
}

function moveInventoryStack(from, to) {
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.move) return NETWORK.inventorySync.move(from, to);
    ensureInventoryStacks();
    const a = GAME.inventoryStacks[from], b = GAME.inventoryStacks[to];
    if (!a || !a.id || a.count <= 0 || from === to) return;
    if (!b || !b.id || b.count <= 0) {
        GAME.inventoryStacks[to] = { id: a.id, count: a.count };
        GAME.inventoryStacks[from] = { id: null, count: 0 };
    } else if (b.id === a.id) {
        const cap = getMaxStackForItem(a.id) - b.count;
        const add = Math.min(cap, a.count);
        b.count += add; a.count -= add;
        if (a.count <= 0) GAME.inventoryStacks[from] = { id: null, count: 0 };
    } else {
        const tmp = GAME.inventoryStacks[from];
        GAME.inventoryStacks[from] = GAME.inventoryStacks[to];
        GAME.inventoryStacks[to] = tmp;
    }
    syncInventoryTotalFromStacks();
    updateInventoryUI(); updateHotbar();
}

function splitInventoryStack(index, amount) {
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.split) return NETWORK.inventorySync.split(index, -1, amount);
    ensureInventoryStacks();
    const st = GAME.inventoryStacks[index];
    if (!st?.id || st.count < 2) return false;
    const free = GAME.inventoryStacks.findIndex((x, i) => i !== index && (!x.id || x.count <= 0));
    if (free < 0) return false;
    const take = Math.max(1, Math.min(st.count - 1, Number(amount) || Math.ceil(st.count / 2)));
    GAME.inventoryStacks[free] = { id: st.id, count: take };
    st.count -= take;
    syncInventoryTotalFromStacks();
    GAME.inventorySelectedStack = free;
    updateInventoryUI();
    return true;
}

function quickMoveInventoryStack(index) {
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.assignHotbar) {
        ensureInventoryStacks(); const st = GAME.inventoryStacks[index]; if (!st?.id || st.count <= 0) return false;
        const hotIndex = GAME.hotbarItems.findIndex(id => id === st.id); const target = hotIndex >= 0 ? hotIndex : GAME.hotbarItems.findIndex(id => !id);
        if (target < 0) return false; return NETWORK.inventorySync.assignHotbar(st.id, target);
    }
    ensureInventoryStacks();
    const st = GAME.inventoryStacks[index];
    if (!st?.id || st.count <= 0) return false;
    const hotIndex = GAME.hotbarItems.findIndex(id => id === st.id);
    const target = hotIndex >= 0 ? hotIndex : GAME.hotbarItems.findIndex(id => !id || Number(GAME.inventory[id] || 0) <= 0);
    if (target < 0) return false;
    GAME.hotbarItems[target] = st.id;
    GAME.selectedSlot = target;
    updateHotbar(); updateInventoryUI();
    if (PLAYER?.updateHeldItem) PLAYER.updateHeldItem(st.id);
    return true;
}

// Compatibility hooks: the legacy extra-skill panel was replaced by the compact
// 20-skill bar. Keep these hooks harmless so older initialization calls do not
// throw ReferenceError on mobile/WebView.
function setupExtraSwordSkillUI() {
    return;
}

function updateExtraSwordSkillUI() {
    return;
}

function setupSwordSkillUI() {
    const btn = document.getElementById("swordSkillButton");
    if (!btn) return;
    const run = (e) => { e.preventDefault(); e.stopPropagation(); if (SWORD_COMBAT.activateSkill()) updateSwordSkillButton(); };
    btn.addEventListener("pointerup", run, { passive: false });
    btn.addEventListener("click", run);
    updateSwordSkillButton();
}

function updateSwordSkillButton() {
    const btn = document.getElementById("swordSkillButton");
    if (!btn) return;
    const active = GAME.hotbarItems[GAME.selectedSlot] === "quy_tinh_sword";
    btn.style.display = active ? "flex" : "none";
    if (active) {
        const cd = Math.ceil(SWORD_COMBAT.skillCooldown);
        const activeRemain = Math.max(0, Math.ceil(SWORD_COMBAT.SKILL_DURATION - SWORD_COMBAT.skillElapsed));
        if (SWORD_COMBAT.skillActive) {
            btn.querySelector(".skillName").textContent = "Đang niệm";
            btn.querySelector(".skillCd").textContent = activeRemain + "s";
            btn.disabled = true;
        } else {
            btn.querySelector(".skillName").textContent = "Vạn Kiếm";
            btn.querySelector(".skillCd").textContent = cd > 0 ? cd + "s" : "";
            btn.disabled = cd > 0;
        }
    }
}

function setupInventoryUI() {
    const open = document.getElementById("inventoryButton");
    const close = document.getElementById("closeInventory");
    const menu = document.getElementById("inventoryMenu");
    if (!open || !close || !menu) return;

    open.onclick = () => toggleInventoryMenu();
    close.onclick = () => toggleInventoryMenu();

    const take = document.getElementById("takeToHotbar");
    const empty = document.getElementById("putToEmptyHotbar");
    const clear = document.getElementById("clearSelectedHotbar");
    const quickMove = document.getElementById("quickMoveInventory");
    const splitHalf = document.getElementById("splitHalfInventory");
    const takeOne = document.getElementById("takeOneInventory");
    const mergeStacks = document.getElementById("mergeInventoryStacks");
    if (take) take.onclick = () => assignInventoryToHotbar(GAME.selectedSlot);
    if (empty) empty.onclick = () => {
        const id = GAME.inventorySelectedId;
        if (!id || Number(GAME.inventory[id] || 0) <= 0) return;
        let index = GAME.hotbarItems.findIndex(x => !x || Number(GAME.inventory[x] || 0) <= 0);
        if (index < 0) index = GAME.hotbarItems.length - 1;
        assignInventoryToHotbar(index);
    };
    if (quickMove) quickMove.onclick = () => { if (GAME.inventorySelectedStack >= 0) quickMoveInventoryStack(GAME.inventorySelectedStack); };
    if (splitHalf) splitHalf.onclick = () => { if (GAME.inventorySelectedStack >= 0) splitInventoryStack(GAME.inventorySelectedStack, null); };
    if (takeOne) takeOne.onclick = () => { if (GAME.inventorySelectedStack >= 0) splitInventoryStack(GAME.inventorySelectedStack, 1); };
    if (mergeStacks) mergeStacks.onclick = () => {
        ensureInventoryStacks();
        const a = GAME.inventorySelectedStack;
        if (a < 0 || !GAME.inventoryStacks[a]?.id) return;
        const id = GAME.inventoryStacks[a].id;
        for (let i = 0; i < GAME.inventoryStacks.length; i++) if (i !== a && GAME.inventoryStacks[i]?.id === id) { moveInventoryStack(i, a); break; }
    };
    if (clear) clear.onclick = () => {
        if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.clearHotbar) { NETWORK.inventorySync.clearHotbar(GAME.selectedSlot); return; }
        GAME.hotbarItems[GAME.selectedSlot] = null;
        updateHotbar(); updateInventoryUI();
        if (PLAYER?.updateHeldItem) PLAYER.updateHeldItem(null);
        updatePreview();
    };

    GAME.inventorySelectedId = null;
    GAME.inventorySelectedStack = -1;
    GAME.inventoryFilter = "all";
    GAME.inventorySearch = "";
    ensureInventoryStacks();
    document.querySelectorAll(".invTab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".invTab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            GAME.inventoryFilter = tab.dataset.filter || "all";
            updateInventoryUI();
        });
    });
}

function closeAllMenus() {
    const inv = document.getElementById("inventoryMenu");
    const craft = document.getElementById("craftMenu");
    if (inv) inv.style.display = "none";
    if (craft) craft.style.display = "none";
    GAME.uiMenuOpen = false;
}

function setupMenuInteraction() {
    const inv = document.getElementById("inventoryMenu");
    const craft = document.getElementById("craftMenu");
    const closeInv = document.getElementById("closeInventory");
    const closeCraft = document.getElementById("closeCraft");

    // Nút đóng dùng pointerup + click để hoạt động ổn định trên Android/WebView.
    const bindClose = (button, menu) => {
        if (!button || !menu) return;
        const close = (e) => {
            e.preventDefault();
            e.stopPropagation();
            menu.style.display = "none";
            GAME.uiMenuOpen = false;
        };
        button.addEventListener("pointerup", close, { passive: false });
        button.addEventListener("click", close);
    };
    bindClose(closeInv, inv);
    bindClose(closeCraft, craft);

    // Chạm vùng nền để đóng, nhưng không đóng khi chạm panel bên trong.
    [inv, craft].forEach(menu => {
        if (!menu) return;
        menu.addEventListener("pointerdown", e => {
            if (e.target === menu) {
                e.preventDefault();
                e.stopPropagation();
                menu.style.display = "none";
                GAME.uiMenuOpen = false;
            }
        }, { passive: false });
    });

    window.addEventListener("keydown", e => {
        if (e.key === "Escape") closeAllMenus();
    });
}

function toggleInventoryMenu() {
    const menu = document.getElementById("inventoryMenu");
    if (!menu) return;
    const opening = menu.style.display !== "flex";
    if (opening) {
        const craft = document.getElementById("craftMenu");
        if (craft) craft.style.display = "none";
        menu.style.display = "flex";
        GAME.uiMenuOpen = true;
        updateInventoryUI();
    } else {
        menu.style.display = "none";
        GAME.uiMenuOpen = false;
    }
}

function getInventoryDisplayIds() {
    const ids = new Set();
    Object.keys(GAME_DATA.items || {}).forEach(id => ids.add(id));
    Object.keys(GAME_DATA.blocks || {}).forEach(id => ids.add(id));
    // Compatibility ID used by older saves.
    ids.add("titanite_blood_block");
    return [...ids].filter(id => GAME_DATA.items[id] || GAME_DATA.blocks[id]);
}

function getDisplayName(id) {
    return GAME_DATA.items[id]?.name || GAME_DATA.blocks[id]?.name || id;
}

function assignInventoryToHotbar(index) {
    const id = GAME.inventorySelectedId;
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.assignHotbar) return NETWORK.inventorySync.assignHotbar(id, index);
    if (!id || Number(GAME.inventory[id] || 0) <= 0) return;
    index = Math.max(0, Math.min(GAME.hotbarItems.length - 1, Number(index) || 0));
    GAME.hotbarItems[index] = id;
    GAME.selectedSlot = index;
    updateHotbar();
    updateInventoryUI();
    if (PLAYER?.updateHeldItem) PLAYER.updateHeldItem(id);
    updatePreview();
}

function renderInventoryHotbar() {
    const root = document.getElementById("inventoryHotbar");
    if (!root) return;
    root.innerHTML = "";
    GAME.hotbarItems.forEach((id, index) => {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "manageHotSlot" + (index === GAME.selectedSlot ? " active" : "");
        slot.title = id ? getDisplayName(id) : `Ô ${index + 1} trống`;
        const no = document.createElement("span"); no.className = "slotNo"; no.textContent = String(index + 1); slot.appendChild(no);
        if (id && GAME_DATA.items[id]) {
            slot.appendChild(createItemIcon(id));
            const count = document.createElement("span"); count.className = "slotCount"; count.textContent = Number(GAME.inventory[id] || 0); slot.appendChild(count);
        }
        slot.addEventListener("click", e => {
            e.preventDefault();
            // Nếu đang chọn một vật phẩm trong kho, chạm trực tiếp vào ô hotbar
            // sẽ gán vật phẩm đó vào đúng ô. Nếu chưa chọn vật phẩm thì chỉ chọn ô.
            const selectedId = GAME.inventorySelectedId || (GAME.inventorySelectedStack >= 0 ? GAME.inventoryStacks[GAME.inventorySelectedStack]?.id : null);
            if (selectedId && Number(GAME.inventory[selectedId] || 0) > 0) {
                assignIdToHotbar(selectedId, index);
                GAME.inventorySelectedId = selectedId;
                GAME.inventorySelectedStack = GAME.inventoryStacks.findIndex(st => st?.id === selectedId && st.count > 0);
                updateInventoryUI();
                return;
            }
            if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.selectHotbar) { NETWORK.inventorySync.selectHotbar(index); return; }
            GAME.selectedSlot = index;
            updateHotbar(); renderInventoryHotbar(); updateInventoryUI();
            if (PLAYER?.updateHeldItem) PLAYER.updateHeldItem(GAME.hotbarItems[index] || null);
            updatePreview();
        });
        slot.addEventListener("pointerup", e => {
            if (GAME._inventoryDragId) {
                e.preventDefault(); e.stopPropagation(); assignIdToHotbar(GAME._inventoryDragId, index); GAME._inventoryDragId = null;
                root.querySelectorAll(".manageHotSlot").forEach(x => x.classList.remove("dragOver"));
            }
        }, {passive:false});
        slot.addEventListener("pointerenter", () => { if (GAME._inventoryDragId) slot.classList.add("dragOver"); });
        slot.addEventListener("pointerleave", () => slot.classList.remove("dragOver"));
        root.appendChild(slot);
    });
}

function assignIdToHotbar(id, index) {
    if (!id || Number(GAME.inventory[id] || 0) <= 0) return false;
    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.assignHotbar) return NETWORK.inventorySync.assignHotbar(id, index);
    index = Math.max(0, Math.min(GAME.hotbarItems.length - 1, Number(index) || 0));
    GAME.hotbarItems[index] = id;
    GAME.selectedSlot = index;
    GAME.inventorySelectedId = id;
    updateHotbar();
    if (PLAYER?.updateHeldItem) PLAYER.updateHeldItem(id);
    updatePreview();
    return true;
}

function updateInventoryUI() {
    const grid = document.getElementById("inventoryGrid"); if (!grid) return;
    ensureInventoryStacks();
    grid.innerHTML = "";
    const filter = GAME.inventoryFilter || "all";
    for (let index = 0; index < 30; index++) {
        const st = GAME.inventoryStacks[index] || {id:null,count:0};
        const id = st.id, count = Number(st.count || 0);
        const d = id ? (GAME_DATA.items[id] || GAME_DATA.blocks[id] || {}) : {};
        const filterMatch = !id || filter === "all" ||
            (filter === "tool" && (d.type === "tool" || d.toolType === "drill" || d.type === "weapon")) ||
            (filter === "block" && d.type === "block") ||
            (filter === "material" && (d.type === "material" || d.type === "module"));
        const search = GAME.inventorySearch || "";
        const searchMatch = !search || (id && (getDisplayName(id).toLowerCase().includes(search) || String(id).toLowerCase().includes(search)));
        const visible = filterMatch && searchMatch;
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "invSlot" + (count > 0 && visible ? " hasItem" : "") + (GAME.inventorySelectedStack === index ? " selected" : "");
        slot.style.visibility = visible ? "visible" : "hidden";
        if (id && count > 0 && visible) {
            slot.title = `${getDisplayName(id)} ×${count}`;
            slot.appendChild(createItemIcon(id));
            const countEl = document.createElement("span"); countEl.className = "invCount"; countEl.textContent = count; slot.appendChild(countEl);
        }
        if (id && count > 0 && visible) {
            slot.addEventListener("click", e => {
                e.preventDefault();
                GAME.inventorySelectedStack = index;
                GAME.inventorySelectedId = id;
                updateInventoryUI();
            });
            slot.addEventListener("dblclick", e => {
                e.preventDefault(); quickMoveInventoryStack(index);
            });
            slot.addEventListener("pointerdown", e => {
                GAME._inventoryDragStack = index;
                GAME._inventoryDragStart = performance.now();
                if (slot.setPointerCapture) slot.setPointerCapture(e.pointerId);
            }, {passive:true});
            slot.addEventListener("pointerup", e => {
                if (GAME._inventoryDragStack === index) {
                    const held = performance.now() - Number(GAME._inventoryDragStart || performance.now());
                    GAME._inventoryDragStack = -1;
                    if (held >= 550 && count >= 2) splitInventoryStack(index, Math.ceil(count / 2));
                }
            }, {passive:true});
        } else if (visible) {
            slot.addEventListener("click", () => { GAME.inventorySelectedStack = index; GAME.inventorySelectedId = null; updateInventoryUI(); });
        }
        grid.appendChild(slot);
    }
    const si = GAME.inventorySelectedStack;
    const st = si >= 0 ? GAME.inventoryStacks[si] : null;
    const id = st?.id || GAME.inventorySelectedId;
    const count = st?.count || 0;
    const name = document.getElementById("inventoryInfoName"), countEl = document.getElementById("inventoryInfoCount");
    if (id) { if(name)name.textContent=getDisplayName(id); if(countEl)countEl.textContent=`Số lượng: ${count || Number(GAME.inventory[id]||0)}`; }
    else { if(name)name.textContent="Chưa chọn vật phẩm"; if(countEl)countEl.textContent=""; }
    const preview=document.getElementById("inventoryItemPreview"); if(preview)preview.textContent=id?"◆":"+";
    const meta=document.getElementById("inventoryInfoType"); if(meta){const d=id?(GAME_DATA.items[id]||GAME_DATA.blocks[id]):null;meta.textContent=d?`Loại: ${d.type||"vật phẩm"}`:"";}
    const hot=document.getElementById("selectedHotbarLabel"); if(hot)hot.textContent=String((GAME.selectedSlot||0)+1);
    const hint=document.getElementById("inventoryHint");
    if (hint) {
        if (id) {
            hint.textContent = `Đã chọn ${getDisplayName(id)}. Chạm một ô trên thanh công cụ để đặt vật phẩm vào ô đó.`;
            hint.style.color = "#9fe5ff";
        } else {
            hint.textContent = "Chạm vật phẩm để chọn, rồi chạm trực tiếp ô trên thanh công cụ. Có thể giữ và kéo để sắp xếp.";
            hint.style.color = "";
        }
    }
    renderInventoryHotbar();
}

function setupCraftingUI() {
    const craftQuickTab = document.getElementById("craftQuickTab");
    if (craftQuickTab) craftQuickTab.onclick = toggleCraftMenu;
    const closeCraft = document.getElementById("closeCraft");
    if (closeCraft) closeCraft.onclick = toggleCraftMenu;
    const all = document.getElementById("craftAllButton");
    if (all) all.onclick = craftAllAvailable;
    buildRecipeList();
}

function toggleCraftMenu() {
    const menu = document.getElementById("craftMenu");
    if (!menu) return;
    const opening = menu.style.display !== "flex";
    if (opening) {
        const inv = document.getElementById("inventoryMenu");
        if (inv) inv.style.display = "none";
        menu.style.display = "flex";
        GAME.uiMenuOpen = true;
        buildRecipeList();
    } else {
        menu.style.display = "none";
        GAME.uiMenuOpen = false;
    }
}

function normalizeRecipe(rawRecipe) {
    if (!rawRecipe) return null;

    // mod.js dùng ingredients[]/machine, còn UI/craft dùng input/station.
    const input = {};
    (rawRecipe.ingredients || []).forEach(item => {
        if (item && item.id) input[item.id] = Number(item.count || 0);
    });

    return {
        ...rawRecipe,
        input: rawRecipe.input || input,
        station: rawRecipe.station || rawRecipe.machine || null,
        output: rawRecipe.output || { id: rawRecipe.id, count: 1 },
        name: rawRecipe.name || rawRecipe.output?.id || rawRecipe.id || "Công thức"
    };
}

function buildRecipeList() {
    const container = document.getElementById("recipes");
    if (!container) return;
    container.innerHTML = "";

    Object.values(GAME_DATA.recipes || {}).forEach(rawRecipe => {
        const recipe = normalizeRecipe(rawRecipe);
        if (!recipe) return;
        const div = document.createElement("div");
        div.className = "recipe";
        const outputId = recipe.output?.id;
        const outputCount = Number(recipe.output?.count || 1);
        const can = canCraft(recipe);
        const stationText = recipe.station ? ` • Máy: ${getDisplayName(recipe.station)}` : " • Bàn chế tạo cơ bản";

        const top = document.createElement("div");
        top.className = "recipeTop";
        const icon = createItemIcon(outputId);
        icon.className = "recipeOutputIcon";
        top.appendChild(icon);
        const title = document.createElement("div");
        title.innerHTML = `<strong>${getDisplayName(outputId)}</strong><div style="opacity:.7;font-size:12px">×${outputCount}${stationText}</div>`;
        top.appendChild(title);
        div.appendChild(top);

        const ingredients = document.createElement("div");
        ingredients.className = "recipeIngredients";
        for (const id in recipe.input) {
            const need = Number(recipe.input[id]);
            const have = Number(GAME.inventory[id] || 0);
            const pill = document.createElement("span");
            pill.className = "ingredientPill" + (have < need ? " missing" : "");
            pill.textContent = `${getDisplayName(id)} ${have}/${need}`;
            ingredients.appendChild(pill);
        }
        div.appendChild(ingredients);

        const button = document.createElement("button");
        button.textContent = can ? "Chế tạo" : "Thiếu nguyên liệu";
        button.className = can ? "canCraft" : "";
        button.disabled = !can;
        button.onclick = () => craft(recipe);
        div.appendChild(button);
        container.appendChild(div);
    });
}

function craftAllAvailable() {
    let made = 0;
    let safety = 0;
    while (safety++ < 100) {
        const recipe = Object.values(GAME_DATA.recipes || {}).map(normalizeRecipe).find(canCraft);
        if (!recipe) break;
        craft(recipe, true);
        made++;
    }
    buildRecipeList();
    updateHotbar();
    updateInventoryUI();
    if (!made) alert("Chưa đủ nguyên liệu để chế tạo.");
}

function canCraft(recipe) {

    for (
        const id in recipe.input
    ) {

        const required =
            recipe.input[id];

        const owned =
            GAME.inventory[id] || 0;

        if (owned < required) {
            return false;
        }
    }

    return true;
}

function craft(recipe, silent = false) {

    if (window.MULTIPLAYER?.enabled && window.NETWORK?.inventorySync?.craft) {
        const recipeId = recipe?.id || recipe?.output?.id;
        if (recipeId) return NETWORK.inventorySync.craft(recipeId);
    }

    /*
        Cổng không gian chỉ chế tạo
        tại Máy chế tạo.
    */

    if (
        recipe.station ===
        "crafting_machine"
    ) {

        if (GAME.inventory.crafting_machine <= 0) {
            alert("Cần có Máy chế tạo.");
            return;
        }
        // Máy chế tạo phải thực sự được đặt gần người chơi.
        const pp = PLAYER.player.position;
        let nearMachine = false;
        for (let dx=-3; dx<=3 && !nearMachine; dx++) for (let dy=-2; dy<=2 && !nearMachine; dy++) for (let dz=-3; dz<=3 && !nearMachine; dz++) {
            if (WORLD.getBlock(Math.floor(pp.x)+dx, Math.floor(pp.y)+dy, Math.floor(pp.z)+dz) === 7) nearMachine = true;
        }
        if (!nearMachine) { alert("Hãy đứng gần Máy chế tạo."); return; }
    }

    if (!canCraft(recipe)) {

        alert(
            "Không đủ nguyên liệu."
        );

        return;
    }

    for (
        const id in recipe.input
    ) {

        GAME.inventory[id] -=
            recipe.input[id];
    }

    const output =
        recipe.output;

    GAME.inventory[
        output.id
    ] =
        (GAME.inventory[
            output.id
        ] || 0) +
        output.count;

    ensureInventoryStacks();
    updateHotbar();
    updateInventoryUI();
    buildRecipeList();

    if (!silent) {
        alert("Đã chế tạo: " + getDisplayName(output.id));
    }
}

function updateHUD() {

    document.getElementById(
        "health"
    ).textContent =
        `❤️ ${Math.ceil(
            PLAYER.player.health
        )} / ${PLAYER.player.maxHealth}`;

    document.getElementById(
        "oxygen"
    ).textContent =
        `🫁 O₂ ${Math.ceil(
            PLAYER.player.oxygen
        )}%`;
}

function updateOxygen(delta) {

    /*
        Có thể dùng hệ thống khu vực
        thiếu oxy sau này.
        Bản nền hiện giữ oxy ổn định
        trên bề mặt.
    */

    const p = PLAYER.player.position;
    // O2 is consumed only in the deep/closed zone, not on the normal surface.
    // This also prevents a broken/empty startup state from draining oxygen immediately.
    const terrain = (GAME.dimension === "main" && WORLD?.getTerrainHeight)
        ? WORLD.getTerrainHeight(p.x, p.z)
        : 999;
    const oxygenZone = GAME.dimension === "war"
        ? false
        : (p.y < Math.min(12, terrain - 8));

    if (oxygenZone) {
        PLAYER.player.oxygen = Math.max(0, (PLAYER.player.oxygen ?? 100) - delta * 1.5);
        if (PLAYER.player.oxygen <= 0) PLAYER.damage(delta * 3);
    } else if ((PLAYER.player.oxygen ?? 0) < 100 && p.y >= terrain - 2) {
        // Surface air slowly restores oxygen; tanks remain useful for deep exploration.
        PLAYER.player.oxygen = Math.min(100, PLAYER.player.oxygen + delta * 2.0);
    }
}

function updateSun() {


    const sun =
        GAME.scene.children.find(
            object =>
                object instanceof
                THREE.DirectionalLight
        );

    if (!sun) return;

    sun.position.x =
        Math.cos(GAME.time) * 180;

    sun.position.z =
        Math.sin(GAME.time) * 180;

    sun.position.y =
        130 +
        Math.sin(GAME.time) * 50;
}

function updateCamera() {
    const p = PLAYER.player.position;
    const yaw = PLAYER.player.yaw;
    const pitch = PLAYER.player.pitch;

    const wantedDistance = 6.0;
    const horizontal = Math.cos(pitch) * wantedDistance;
    const targetY = p.y + 1.0;

    // Camera is behind the player according to the same yaw used by movement.
    const wanted = new THREE.Vector3(
        p.x + Math.sin(yaw) * horizontal,
        targetY - Math.sin(pitch) * wantedDistance,
        p.z + Math.cos(yaw) * horizontal
    );

    // Camera collision: never place the camera inside a solid voxel.
    // This was the main reason the previous build could show internal layers.
    const target = new THREE.Vector3(p.x, targetY, p.z);
    const delta = wanted.clone().sub(target);
    const distance = delta.length();
    const steps = Math.max(1, Math.ceil(distance / 0.12));
    const dir = delta.clone().normalize();
    let safeDistance = distance;

    for (let i = 1; i <= steps; i++) {
        const d = Math.min(distance, i * 0.12);
        const sample = target.clone().addScaledVector(dir, d);
        const bx = Math.floor(sample.x + 0.5);
        const by = Math.floor(sample.y + 0.5);
        const bz = Math.floor(sample.z + 0.5);

        if (WORLD.isSolid(bx, by, bz)) {
            safeDistance = Math.max(0.55, d - 0.18);
            break;
        }
    }

    GAME.camera.position.copy(target).addScaledVector(dir, safeDistance);
    GAME.camera.lookAt(target);
}

let AV_MOB_ACCUM = 0;
let AV_DROP_ACCUM = 0;
let AV_OXYGEN_ACCUM = 0;
let AV_HUD_ACCUM = 0;
let AV_SUN_ACCUM = 0;

function animate() {

    requestAnimationFrame(
        animate
    );

    // Hit / vision effects are lightweight DOM overlays for mobile.
    const damageOverlay = document.getElementById("damageOverlay");
    const visionOverlay = document.getElementById("visionOverlay");
    if (GAME.damageFlash > 0) {
        GAME.damageFlash = Math.max(0, GAME.damageFlash - 0.016);
        if (damageOverlay) damageOverlay.style.opacity = String(Math.min(0.38, GAME.damageFlash * 1.8));
    } else if (damageOverlay) {
        damageOverlay.style.opacity = "0";
    }
    if (GAME.visionDebuff > 0) {
        GAME.visionDebuff = Math.max(0, GAME.visionDebuff - 0.016);
        if (visionOverlay) visionOverlay.style.opacity = String(Math.min(0.28, GAME.visionDebuff * 0.16));
    } else if (visionOverlay) {
        visionOverlay.style.opacity = "0";
    }

    const delta =
        Math.min(
            GAME.clock.getDelta(),
            0.05
        );

    EXTRA_SWORD_SKILLS.ngu.beforePlayerUpdate();
    PLAYER.update(
        delta
    );
    EXTRA_SWORD_SKILLS.ngu.afterPlayerUpdate(delta);

    if (window.MULTIPLAYER && window.MULTIPLAYER.update) window.MULTIPLAYER.update(delta);

    updateCamera();

    const chunkX = Math.floor(PLAYER.player.position.x / WORLD.CHUNK_SIZE);
    const chunkZ = Math.floor(PLAYER.player.position.z / WORLD.CHUNK_SIZE);
    if (chunkX !== GAME.lastChunkX || chunkZ !== GAME.lastChunkZ) {
        GAME.lastChunkX = chunkX;
        GAME.lastChunkZ = chunkZ;
        if (WORLD.queueVisibleChunks) {
            WORLD.queueVisibleChunks(
                GAME.scene,
                PLAYER.player.position.x,
                PLAYER.player.position.z,
                2
            );
        } else {
            WORLD.updateVisibleChunks(
                GAME.scene,
                PLAYER.player.position.x,
                PLAYER.player.position.z,
                2
            );
        }
    }

    updateMining(delta);

    // Tách logic khỏi render loop: render vẫn chạy mỗi frame, còn hệ thống nặng
    // được cập nhật theo tần số cố định để giảm CPU trên mobile.
    AV_DROP_ACCUM += delta;
    if (AV_DROP_ACCUM >= 1 / 30) {
        const step = Math.min(AV_DROP_ACCUM, 0.1);
        AV_DROP_ACCUM = 0;
        DROP_SYSTEM.update(step);
    }

    PROJECTILE_POOL.update(delta);

    AV_MOB_ACCUM += delta;
    if (AV_MOB_ACCUM >= 1 / 12) {
        const step = Math.min(AV_MOB_ACCUM, 0.16);
        AV_MOB_ACCUM = 0;
        MOB_SYSTEM.update(step);
    }
    SWORD_COMBAT.update(delta);
    EXTRA_SWORD_SKILLS.ngu.update(delta);
    EXTRA_SWORD_SKILLS.vu.update(delta);
    Object.values(NEW_SWORD_SKILLS).forEach(s => { if (s && typeof s.update === "function") s.update(delta); });
    updateSwordSkillButton();
    updateNewSwordSkillUI();
    updateExtraSwordSkillUI();

    AV_OXYGEN_ACCUM += delta;
    if (AV_OXYGEN_ACCUM >= 1 / 10) {
        const step = Math.min(AV_OXYGEN_ACCUM, 0.2);
        AV_OXYGEN_ACCUM = 0;
        updateOxygen(step);
    }

    GAME.time += delta * 0.12;
    AV_SUN_ACCUM += delta;
    if (AV_SUN_ACCUM >= 1 / 20) {
        AV_SUN_ACCUM = 0;
        updateSun();
    }

    AV_HUD_ACCUM += delta;
    if (AV_HUD_ACCUM >= 1 / 10) {
        AV_HUD_ACCUM = 0;
        updateHUD();
    }

    if (
        GAME.previewRenderer
    ) {

        const previewObject =
            GAME.previewScene.children[1];

        if (previewObject) {

            previewObject.rotation.y += delta * 0.75;
        }

        GAME.previewRenderer.render(
            GAME.previewScene,
            GAME.previewCamera
        );
    }

    GAME.renderer.render(
        GAME.scene,
        GAME.camera
    );
}

window.addEventListener(
    "resize",
    () => {

        GAME.camera.aspect =
            innerWidth / innerHeight;

        GAME.camera.updateProjectionMatrix();

        GAME.renderer.setSize(
            innerWidth,
            innerHeight
        );
    }
);

initGame();