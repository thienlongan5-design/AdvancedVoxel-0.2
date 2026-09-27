/* =========================================================
   features.js — 10 nâng cấp mới, nguyên bản
   ========================================================= */
(function () {
  "use strict";

  const F = window.AV_FEATURES = {
    version: 1,
    weather: "clear",
    weatherTimer: 0,
    temperatureTimer: 0,
    energy: 100,
    maxEnergy: 100,
    ancientStructures: new Set(),
    drillModules: { speed: 0, durability: 0, efficiency: 0 },
    decoyModules: { armor: 0, lure: 0, beacon: 0 },
    boss: null,
    enabled: true
  };

  /* =====================================================
     BƯỚC 1 — Nhiệt độ hành tinh
     ===================================================== */
  function updateTemperature(dt) {
    const p = window.PLAYER?.player;
    if (!p) return;
    const x = p.position.x, z = p.position.z, y = p.position.y;
    const base = 18 + Math.sin(x * 0.008) * 10 + Math.cos(z * 0.011) * 8;
    const altitude = Math.max(0, y - 20) * 0.08;
    const weather = F.weather === "dust" ? 7 : (F.weather === "storm" ? -5 : 0);
    p.temperature = base - altitude + weather;
    if (p.temperature > 42) p.temperatureState = "hot";
    else if (p.temperature < -10) p.temperatureState = "cold";
    else p.temperatureState = "normal";
  }

  /* =====================================================
     BƯỚC 2 — Năng lượng Titan
     ===================================================== */
  function consumeEnergy(amount) {
    if (F.energy < amount) return false;
    F.energy -= amount;
    return true;
  }
  function rechargeEnergy(amount) {
    F.energy = Math.min(F.maxEnergy, F.energy + amount);
  }

  /* =====================================================
     BƯỚC 3 — Hang động sâu
     World hiện đã có cave noise. Bổ sung trạng thái khám phá
     để các hệ thống khác nhận biết vùng sâu.
     ===================================================== */
  function isDeepCave() {
    const p = window.PLAYER?.player;
    return !!p && p.position.y < 12;
  }

  /* =====================================================
     BƯỚC 4 — Sinh thái sinh vật
     Ghi nhận vùng hoạt động để mob có thể mở rộng hành vi sau.
     Không thay đổi HP/damage đã thống nhất.
     ===================================================== */
  function getBiome(x, z) {
    const v = Math.sin(x * 0.012) + Math.cos(z * 0.009);
    return v > 0.8 ? "crystal_plains" : (v < -0.8 ? "dark_ridge" : "titanite_field");
  }

  /* =====================================================
     BƯỚC 5 — Thời tiết
     ===================================================== */
  function updateWeather(dt) {
    F.weatherTimer -= dt;
    if (F.weatherTimer > 0) return;
    F.weatherTimer = 45 + Math.random() * 75;
    const r = Math.random();
    F.weather = r < 0.68 ? "clear" : (r < 0.9 ? "dust" : "storm");
    const scene = window.GAME?.scene;
    if (scene) {
      scene.fog.density = F.weather === "storm" ? 0.0012 : (F.weather === "dust" ? 0.00085 : 0.00055);
    }
  }

  /* =====================================================
     BƯỚC 6 — Module Titan Drill
     ===================================================== */
  function getDrillStats(itemId) {
    const base = window.GAME_DATA?.items?.[itemId];
    if (!base) return null;
    return {
      miningLevel: base.miningLevel || 0,
      durabilityMultiplier: 1 + F.drillModules.durability * 0.15,
      speedMultiplier: 1 + F.drillModules.speed * 0.12,
      efficiency: F.drillModules.efficiency
    };
  }

  /* =====================================================
     BƯỚC 7 — Công trình cổ đại
     Dùng block nguyên bản hiện có, không sao chép structure.
     ===================================================== */
  function structureSeed(cx, cz) {
    let n = Math.abs((cx * 374761393 + cz * 668265263) | 0);
    n = (n ^ (n >>> 13)) * 1274126177;
    return (n >>> 0) / 4294967296;
  }

  function registerStructure(cx, cz) {
    if (window.AV_DIMENSION !== "main") return;
    const key = cx + "," + cz;
    if (F.ancientStructures.has(key)) return;
    if (structureSeed(cx, cz) > 0.035) return;
    F.ancientStructures.add(key);
  }

  /* =====================================================
     BƯỚC 8 — Hình nhân thế mạng nâng cấp
     ===================================================== */
  function getDecoyProtection(decoy) {
    return {
      damageMultiplier: Math.max(0.25, 1 - F.decoyModules.armor * 0.2),
      lureStrength: F.decoyModules.lure,
      beacon: F.decoyModules.beacon > 0
    };
  }

  /* =====================================================
     BƯỚC 9 — Boss động: Titan Colossus
     Một thực thể hình học nguyên bản, không dùng model/game asset bên thứ ba.
     ===================================================== */
  function createBoss(x, z) {
    if (F.boss || window.AV_DIMENSION !== "main") return null;
    const y = window.WORLD.getTerrainHeight(x, z) + 0.02;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.25 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 1.8), mat);
    body.position.y = 1.6;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), new THREE.MeshStandardMaterial({ emissive: 0x2b5060, emissiveIntensity: 1.4 }));
    core.position.y = 2.1;
    group.add(body, core);
    group.position.set(x, y, z);
    window.GAME.scene.add(group);
    F.boss = { object: group, position: group.position, hp: 500, maxHp: 500, cooldown: 0, dead: false };
    return F.boss;
  }

  function updateBoss(dt) {
    const b = F.boss;
    const p = window.PLAYER?.player;
    if (!b || b.dead || !p) return;
    b.cooldown -= dt;
    const d = b.position.distanceTo(p.position);
    if (d < 18) {
      const dir = p.position.clone().sub(b.position); dir.y = 0;
      if (d > 3 && dir.lengthSq() > 0.01) {
        dir.normalize();
        b.position.x += dir.x * dt * 1.1;
        b.position.z += dir.z * dt * 1.1;
        b.position.y = window.WORLD.getTerrainHeight(b.position.x, b.position.z) + 0.02;
      }
      if (d <= 3 && b.cooldown <= 0) {
        b.cooldown = 1.8;
        p.damage(10);
      }
    }
  }

  /* =====================================================
     BƯỚC 10 — Chiều không gian
     Serpent Void hiện là chiều riêng. API chung để mở rộng thêm chiều.
     ===================================================== */
  function switchDimension(name) {
    if (name !== "main" && name !== "war") return false;
    window.AV_DIMENSION = name;
    if (window.GAME) window.GAME.dimension = name;
    localStorage.setItem("advanced_voxel_dimension", name);
    window.WORLD?.resetWorld?.();
    return true;
  }

  function update(dt) {
    if (!F.enabled) return;
    F.temperatureTimer -= dt;
    if (F.temperatureTimer <= 0) {
      F.temperatureTimer = 0.5;
      updateTemperature(0.5);
    }
    updateWeather(dt);
    updateBoss(dt);
  }

  function updateHUD() {
    const hud = document.getElementById("featureHud");
    if (!hud) return;
    const p = window.PLAYER?.player;
    const t = p?.temperature;
    const ts = p?.temperatureState || "normal";
    const weatherName = F.weather === "dust" ? "Bão bụi" : F.weather === "storm" ? "Bão năng lượng" : "Quang đãng";
    hud.textContent = `🌡 ${t == null ? "--" : Math.round(t) + "°C"} · ${ts}  |  ⚡ ${Math.round(F.energy)}/${F.maxEnergy}  |  ☁ ${weatherName}`;
  }

  window.AV_FEATURES = Object.assign(F, {
    update, updateHUD, consumeEnergy, rechargeEnergy, isDeepCave, getBiome,
    registerStructure, getDrillStats, getDecoyProtection, createBoss, switchDimension
  });

  /* Add original items/modules without changing existing item IDs. */
  const items = window.GAME_DATA?.items;
  if (items) {
    items.energy_cell = { id: "energy_cell", name: "Lõi năng lượng Titan", type: "material", maxStack: 256 };
    items.drill_speed_module = { id: "drill_speed_module", name: "Module tăng tốc Drill", type: "module", maxStack: 256 };
    items.drill_durability_module = { id: "drill_durability_module", name: "Module bền Drill", type: "module", maxStack: 256 };
    items.drill_efficiency_module = { id: "drill_efficiency_module", name: "Module tiết kiệm Drill", type: "module", maxStack: 256 };
    items.decoy_armor_module = { id: "decoy_armor_module", name: "Module giáp Hình nhân", type: "module", maxStack: 256 };
    items.decoy_lure_module = { id: "decoy_lure_module", name: "Module thu hút Hình nhân", type: "module", maxStack: 256 };
  }

  const recipes = window.GAME_DATA?.recipes;
  if (recipes) {
    recipes.energy_cell = { id: "energy_cell", ingredients: [{ id: "component", count: 2 }, { id: "dark_matter", count: 1 }], output: { id: "energy_cell", count: 1 } };
    recipes.drill_speed_module = { id: "drill_speed_module", ingredients: [{ id: "component", count: 3 }, { id: "energy_cell", count: 1 }], output: { id: "drill_speed_module", count: 1 } };
    recipes.drill_durability_module = { id: "drill_durability_module", ingredients: [{ id: "component", count: 3 }, { id: "titanite_black", count: 2 }], output: { id: "drill_durability_module", count: 1 } };
    recipes.drill_efficiency_module = { id: "drill_efficiency_module", ingredients: [{ id: "component", count: 2 }, { id: "energy_cell", count: 1 }], output: { id: "drill_efficiency_module", count: 1 } };
    recipes.decoy_armor_module = { id: "decoy_armor_module", ingredients: [{ id: "component", count: 3 }, { id: "titan_guard_crystal", count: 1 }], output: { id: "decoy_armor_module", count: 1 } };
    recipes.decoy_lure_module = { id: "decoy_lure_module", ingredients: [{ id: "component", count: 2 }, { id: "titan_guard_crystal", count: 1 }], output: { id: "decoy_lure_module", count: 1 } };
  }

  window.addEventListener("load", () => {
    const hud = document.createElement("div");
    hud.id = "featureHud";
    hud.style.cssText = "position:fixed;left:10px;top:62px;color:white;background:rgba(0,0,0,.35);padding:5px 8px;border-radius:7px;font:12px sans-serif;z-index:30;pointer-events:none";
    document.body.appendChild(hud);
    setInterval(() => updateHUD(), 500);
  });

  // Fixed-rate gameplay update: render remains frame-rate driven, while
  // temperature/weather/boss logic runs at 10 Hz to reduce mobile CPU use.
  let last = performance.now();
  let accumulator = 0;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    accumulator += dt;
    if (accumulator >= 0.1) {
      const step = Math.min(accumulator, 0.2);
      accumulator = 0;
      update(step);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
