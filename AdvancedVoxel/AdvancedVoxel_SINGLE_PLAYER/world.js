const WORLD = (() => {

    const CHUNK_SIZE = 32;
    const WORLD_HEIGHT = 64;

    const chunks = new Map();
    const edits = new Map();
    let sharedAtlas = null;
    let activeScene = null;
    let loadQueue = [];
    let loadQueueSet = new Set();
    let loadQueueToken = 0;
    let loadQueueRunning = false;

    const blockTypes = {
        0: null,
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

    const blockIDs = {
        air: 0,
        titanite: 1,
        titanite_black: 2,
        titanite_blood: 3,
        titanite_igneous: 4,
        titanite_eternal: 5,
        titan_vault: 6,
        crafting_machine: 7,
        space_gate: 8,
        dark_matter_ore: 9
    };

    function chunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    function worldToChunk(x, z) {

        return {
            cx: Math.floor(x / CHUNK_SIZE),
            cz: Math.floor(z / CHUNK_SIZE)
        };
    }

    function localCoord(value) {

        let result = value % CHUNK_SIZE;

        if (result < 0) {
            result += CHUNK_SIZE;
        }

        return result;
    }

    // Điểm xuất hiện an toàn của Serpent Void World.
    // Người chơi bắt đầu ngay trên cột đá đầu tiên thay vì ở tọa độ trống 16,16.
    function getSpawnPoint() {
        if (window.AV_DIMENSION === "war") {
            const x = 120;
            const z = 180;
        const centerT = 0;
        const columnHeight = 12 + Math.floor(10 + (Math.sin(centerT * 19.0) * 0.5 + 0.5) * 16);
        const topY = 18 + columnHeight;
            return { x, y: topY + 0.02, z };
        }
        const x = 16, z = 16;
        return { x, y: getTerrainHeight(x, z) + 0.02, z };
    }

    function getTerrainHeight(x, z) {
        if (window.AV_DIMENSION === "war") return 0;

        const h =
            20 +
            Math.sin(x * 0.045) * 4 +
            Math.cos(z * 0.035) * 4 +
            Math.sin((x + z) * 0.018) * 5;

        return Math.max(8, Math.floor(h));
    }

    function getBlockByY(y) {

        if (y >= 64) {
            return 0;
        }

        /*
            Layer 1:
            Titanite

            Layer 2:
            Titanite Đen

            Layer 3:
            Titanite Huyết

            Layer 4:
            Titanite Nham

            Layer 5:
            Titanite Vĩnh Hằng
        */

        if (y <= 1) {
            return blockIDs.titanite_eternal;
        }

        if (y <= 7) {
            return blockIDs.titanite_igneous;
        }

        if (y <= 15) {
            return blockIDs.titanite_blood;
        }

        if (y <= 23) {
            return blockIDs.titanite_black;
        }

        return blockIDs.titanite;
    }


    // Giant Serpent Pillar region: an original landmark made from existing Titanite stone types.
    // It forms a long winding chain of rising stone columns on a distant part of the planet.
    function serpentCenter(t) {
        const x = 120 + t * 300;
        const z = 180 + Math.sin(t * Math.PI * 4.2) * 46;
        return { x, z };
    }

    function serpentNearest(wx, wz) {
        // Coarse nearest-point search is deterministic and cheap because the landmark
        // only exists inside its bounded region.
        let best = null;
        let bestD2 = Infinity;
        for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            const p = serpentCenter(t);
            const dx = wx - p.x;
            const dz = wz - p.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD2) {
                bestD2 = d2;
                best = { t, x: p.x, z: p.z };
            }
        }
        return best;
    }

    function serpentStructure(wx, wz, surface, y) {
        if (wx < 108 || wx > 432 || wz < 125 || wz > 235) return 0;

        const near = serpentNearest(wx, wz);
        if (!near) return 0;

        // Columns occur along the winding spine every ~18 blocks.
        const spacing = 0.058;
        const centerIndex = Math.round(near.t / spacing);
        const centerT = Math.max(0, Math.min(1, centerIndex * spacing));
        const center = serpentCenter(centerT);
        const dx = wx - center.x;
        const dz = wz - center.z;
        const radial = Math.sqrt(dx * dx + dz * dz);

        if (radial > 4.2) return 0;

        // Varying height makes the silhouette resemble a huge raised stone serpent.
        const phase = centerT * Math.PI * 4.2;
        const columnHeight = 12 + Math.floor(10 + (Math.sin(centerT * 19.0) * 0.5 + 0.5) * 16);
        const baseY = 18;
        const topY = baseY + columnHeight;

        // Rounded voxel column.
        if (y >= baseY && y <= topY && radial <= 3.5) {
            return radial < 2.0 ? blockIDs.titanite_blood : blockIDs.titanite_igneous;
        }

        // Connect neighbouring columns with a thick, elevated stone spine.
        const next = serpentCenter(Math.min(1, centerT + spacing));
        const prev = serpentCenter(Math.max(0, centerT - spacing));
        const localTop = topY - 1;
        const connRadius = 2.15;
        const checkSegment = (a, b) => {
            const vx = b.x - a.x;
            const vz = b.z - a.z;
            const len2 = vx * vx + vz * vz || 1;
            let u = ((wx - a.x) * vx + (wz - a.z) * vz) / len2;
            u = Math.max(0, Math.min(1, u));
            const px = a.x + vx * u;
            const pz = a.z + vz * u;
            const ddx = wx - px, ddz = wz - pz;
            return Math.sqrt(ddx * ddx + ddz * ddz);
        };

        const topHere = localTop;
        const topPrev = Math.max(surface + 1, 10) + Math.floor(12 + (Math.sin(Math.max(0, centerT - spacing) * 19.0) * 0.5 + 0.5) * 16) - 1;
        const topNext = Math.max(surface + 1, 10) + Math.floor(12 + (Math.sin(Math.min(1, centerT + spacing) * 19.0) * 0.5 + 0.5) * 16) - 1;

        if (Math.abs(y - topHere) <= 2) {
            const dPrev = checkSegment(prev, center);
            const dNext = checkSegment(center, next);
            if (dPrev <= connRadius || dNext <= connRadius) {
                return y <= topHere ? blockIDs.titanite_igneous : 0;
            }
        }

        // Small stepped ramps between columns keep the structure visibly connected.
        if (Math.abs(y - topPrev) <= 1 && checkSegment(prev, center) <= 2.6) return blockIDs.titanite_blood;
        if (Math.abs(y - topNext) <= 1 && checkSegment(center, next) <= 2.6) return blockIDs.titanite_blood;

        return 0;
    }

    // Deterministic smooth value-noise helpers.
    // The previous cave field averaged three unrelated sine waves, which could
    // produce long planar cuts and disconnected floating layers. Smooth 3D
    // value noise keeps caves volumetric and coherent while remaining cheap.
    function hash3i(x, y, z) {
        let n = Math.imul(x | 0, 374761393);
        n = Math.imul(n ^ (n >>> 13), 668265263);
        n ^= Math.imul(y | 0, 1442695041);
        n = Math.imul(n ^ (n >>> 16), 2246822519);
        n ^= Math.imul(z | 0, 3266489917);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    }

    function fade(t) {
        return t * t * (3 - 2 * t);
    }

    function valueNoise3(x, y, z, scale) {
        const sx = x / scale, sy = y / scale, sz = z / scale;
        const x0 = Math.floor(sx), y0 = Math.floor(sy), z0 = Math.floor(sz);
        const tx = fade(sx - x0), ty = fade(sy - y0), tz = fade(sz - z0);
        const c000 = hash3i(x0, y0, z0), c100 = hash3i(x0 + 1, y0, z0);
        const c010 = hash3i(x0, y0 + 1, z0), c110 = hash3i(x0 + 1, y0 + 1, z0);
        const c001 = hash3i(x0, y0, z0 + 1), c101 = hash3i(x0 + 1, y0, z0 + 1);
        const c011 = hash3i(x0, y0 + 1, z0 + 1), c111 = hash3i(x0 + 1, y0 + 1, z0 + 1);
        const x00 = c000 + (c100 - c000) * tx;
        const x10 = c010 + (c110 - c010) * tx;
        const x01 = c001 + (c101 - c001) * tx;
        const x11 = c011 + (c111 - c011) * tx;
        const y0v = x00 + (x10 - x00) * ty;
        const y1v = x01 + (x11 - x01) * ty;
        return y0v + (y1v - y0v) * tz;
    }

    function caveNoise(wx, y, wz) {
        // Volumetric cave density. Keep the vertical frequency deliberately
        // lower than the horizontal frequency and combine two independent
        // fields. This avoids the long horizontal "sheets" that appeared
        // when a single threshold was applied to a strongly y-correlated field.
        const broad = valueNoise3(wx, y * 0.62, wz, 22);
        const detail = valueNoise3(wx * 1.35, y * 0.82, wz * 1.35, 11);
        const tunnel = valueNoise3(wx * 0.72 + 37, y * 1.15 - 19, wz * 0.72 - 11, 15);
        return { broad, detail, tunnel };
    }

    function generateChunk(cx, cz) {

        const key = chunkKey(cx, cz);

        if (chunks.has(key)) {
            return chunks.get(key);
        }

        const data =
            new Uint8Array(
                CHUNK_SIZE *
                WORLD_HEIGHT *
                CHUNK_SIZE
            );

        function index(x, y, z) {

            return (
                x +
                CHUNK_SIZE *
                (z + CHUNK_SIZE * y)
            );
        }

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const wx = cx * CHUNK_SIZE + x;
                const wz = cz * CHUNK_SIZE + z;

                if (window.AV_DIMENSION === "war") {
                    // Only fill the narrow vertical range occupied by the serpent.
                    // The old version tested all 64 Y levels for every column.
                    const near = serpentNearest(wx, wz);
                    if (near) {
                        const spacing = 0.058;
                        const centerIndex = Math.round(near.t / spacing);
                        const centerT = Math.max(0, Math.min(1, centerIndex * spacing));
                        const center = serpentCenter(centerT);
                        const dx = wx - center.x, dz = wz - center.z;
                        const radial = Math.sqrt(dx * dx + dz * dz);
                        if (radial <= 4.2) {
                            const columnHeight = 12 + Math.floor(10 + (Math.sin(centerT * 19.0) * 0.5 + 0.5) * 16);
                            const baseY = 18;
                            const topY = baseY + columnHeight;
                            const startY = Math.max(0, baseY - 3);
                            const endY = Math.min(WORLD_HEIGHT - 1, topY + 3);
                            for (let y = startY; y <= endY; y++) {
                                const serpentBlock = serpentStructure(wx, wz, 18, y);
                                if (serpentBlock) data[index(x, y, z)] = serpentBlock;
                            }
                        }
                    }
                } else {
                    const surface = getTerrainHeight(wx, wz);
                    const spawnPad = (Math.abs(wx - 16) <= 2 && Math.abs(wz - 16) <= 2);
                    // Uint8Array starts at zero, so there is no need to write air above the surface.
                    for (let y = 0; y <= surface; y++) {
                        let block = getBlockByY(y);
                        if (y >= surface - 1) block = blockIDs.titanite;
                        // Keep a solid surface shell so terrain does not turn into
                        // floating sheets. Caves begin several blocks below the surface.
                        if (!spawnPad && y > 4 && y < surface - 7) {
                            const cave = caveNoise(wx, y, wz);
                            // Require agreement between broad and detail fields.
                            // This produces connected pockets/tunnels instead of
                            // large planar cuts through an entire chunk.
                            const depth = Math.max(0, Math.min(1, (surface - y - 7) / 16));
                            const broadThreshold = 0.82 - depth * 0.06;
                            const detailThreshold = 0.58 - depth * 0.04;
                            const tunnelThreshold = 0.50;
                            if (cave.broad > broadThreshold &&
                                cave.detail > detailThreshold &&
                                cave.tunnel > tunnelThreshold) {
                                block = 0;
                            }
                        }
                        if (block !== 0 && y >= 8 && y <= surface - 4 && valueNoise3(wx, y, wz, 11) > 0.995) {
                            block = blockIDs.dark_matter_ore;
                        }
                        data[index(x, y, z)] = block;
                    }
                }
            }
        }

        // Re-apply player edits so saved worlds keep modifications after reload.
        for (const [editKey, value] of edits) {
            const parts = editKey.split(',').map(Number);
            const ex = parts[0], ey = parts[1], ez = parts[2];
            if (Math.floor(ex / CHUNK_SIZE) === cx && Math.floor(ez / CHUNK_SIZE) === cz && ey >= 0 && ey < WORLD_HEIGHT) {
                const lx = localCoord(ex), lz = localCoord(ez);
                data[lx + CHUNK_SIZE * (lz + CHUNK_SIZE * ey)] = value;
            }
        }

        const chunk = {
            cx,
            cz,
            data,
            mesh: null
        };

        chunks.set(key, chunk);

        return chunk;
    }

    function getBlock(x, y, z) {

        if (
            y < 0 ||
            y >= WORLD_HEIGHT
        ) {
            return 0;
        }

        const c = worldToChunk(x, z);

        const chunk =
            generateChunk(c.cx, c.cz);

        const lx = localCoord(x);
        const lz = localCoord(z);

        const index =
            lx +
            CHUNK_SIZE *
            (lz + CHUNK_SIZE * y);

        return chunk.data[index];
    }

    function setBlock(x, y, z, blockId) {
        if (y < 0 || y >= WORLD_HEIGHT) return false;

        const c = worldToChunk(x, z);
        const chunk = generateChunk(c.cx, c.cz);
        const lx = localCoord(x);
        const lz = localCoord(z);
        const index = lx + CHUNK_SIZE * (lz + CHUNK_SIZE * y);

        chunk.data[index] = blockId;
        edits.set(`${x},${y},${z}`, blockId);
        rebuildChunk(c.cx, c.cz);

        // Mặt của chunk hàng xóm cũng có thể thay đổi khi phá/đặt ở biên.
        if (lx === 0) rebuildChunk(c.cx - 1, c.cz);
        if (lx === CHUNK_SIZE - 1) rebuildChunk(c.cx + 1, c.cz);
        if (lz === 0) rebuildChunk(c.cx, c.cz - 1);
        if (lz === CHUNK_SIZE - 1) rebuildChunk(c.cx, c.cz + 1);
        return true;
    }

    function rebuildChunk(cx, cz) {
        const chunk = generateChunk(cx, cz);
        let wasVisible = false;
        if (chunk.mesh) {
            const old = chunk.mesh;
            wasVisible = !!old.parent;
            if (old.parent) old.parent.remove(old);
            old.geometry.dispose();
            chunk.mesh = null;
        }
        if (wasVisible && activeScene) {
            const mesh = createChunkMesh(cx, cz);
            activeScene.add(mesh);
        }
        return chunk;
    }

    function isSolid(x, y, z) {

        return getBlock(x, y, z) !== 0;
    }

    /*
        Chỉ tạo mặt nếu mặt đó không bị
        block khác che.
    */

    const FACE_DIRS = [
        { x: 1,  y: 0,  z: 0 },
        { x: -1, y: 0,  z: 0 },
        { x: 0,  y: 1,  z: 0 },
        { x: 0,  y: -1, z: 0 },
        { x: 0,  y: 0,  z: 1 },
        { x: 0,  y: 0, z: -1 }
    ];

    const FACE_VERTICES = [

        [
            [0.5,-0.5,-0.5],
            [0.5, 0.5,-0.5],
            [0.5, 0.5, 0.5],
            [0.5,-0.5, 0.5]
        ],

        [
            [-0.5,-0.5, 0.5],
            [-0.5, 0.5, 0.5],
            [-0.5, 0.5,-0.5],
            [-0.5,-0.5,-0.5]
        ],

        [
            [-0.5,0.5, 0.5],
            [0.5,0.5, 0.5],
            [0.5,0.5,-0.5],
            [-0.5,0.5,-0.5]
        ],

        [
            [-0.5,-0.5,-0.5],
            [0.5,-0.5,-0.5],
            [0.5,-0.5,0.5],
            [-0.5,-0.5,0.5]
        ],

        [
            [0.5,-0.5,0.5],
            [0.5,0.5,0.5],
            [-0.5,0.5,0.5],
            [-0.5,-0.5,0.5]
        ],

        [
            [-0.5,-0.5,-0.5],
            [-0.5,0.5,-0.5],
            [0.5,0.5,-0.5],
            [0.5,-0.5,-0.5]
        ]
    ];

    function createChunkMesh(cx, cz) {
        const chunk = generateChunk(cx, cz);
        if (chunk.mesh) return chunk.mesh;

        // Robust voxel mesher:
        // - emits ONLY faces whose neighbouring voxel is air
        // - keeps every face exactly on the 1x1x1 voxel boundary
        // - uses a standard greedy merge per face direction
        // - never relies on a custom atlas shader
        // This fixes the previous symptom where a face could appear from the
        // wrong side, disappear from above, or be offset from the real block.
        const positions = [];
        const uvs = [];
        const indicesByBlock = new Map();

        const textureIDs = [
            [1, "titanite", "#6f7b86", "#a6b2bd"],
            [2, "titanite_black", "#39414a", "#68727c"],
            [3, "titanite_blood", "#6a3e43", "#b85a60"],
            [4, "titanite_igneous", "#5a3930", "#d66a3f"],
            [5, "titanite_eternal", "#252d36", "#657382"],
            [6, "titan_vault", "#252d35", "#a9c4d1"],
            [7, "crafting_machine", "#34434b", "#69d4df"],
            [8, "space_gate", "#27224a", "#b28cff"],
            [9, "dark_matter_ore", "#242238", "#9c7cf0"]
        ];

        const dims = [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE];
        const blockAt = (x, y, z) => {
            if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
                return getBlock(cx * CHUNK_SIZE + x, y, cz * CHUNK_SIZE + z);
            }
            return chunk.data[x + CHUNK_SIZE * (z + CHUNK_SIZE * y)];
        };

        function emitQuad(axis, dir, slice, u0, v0, w, h, block) {
            // Face plane is exactly halfway between two voxel centres.
            // u and v are chosen so u x v = +axis. This makes the winding
            // mathematically correct for FrontSide on all six directions.
            const u = (axis + 1) % 3;
            const v = (axis + 2) % 3;
            const p = [0, 0, 0];
            p[axis] = slice + 0.5;
            p[u] = u0 - 0.5;
            p[v] = v0 - 0.5;

            const a = p.slice();
            const b = p.slice(); b[u] += w;
            const c = p.slice(); c[u] += w; c[v] += h;
            const d = p.slice(); d[v] += h;

            const verts = dir > 0 ? [a, b, c, d] : [a, d, c, b];
            const baseVertex = positions.length / 3;
            for (const q of verts) {
                positions.push(
                    q[0] + cx * CHUNK_SIZE,
                    q[1],
                    q[2] + cz * CHUNK_SIZE
                );
            }

            // Repeat the source 32x32 texture once per voxel merged into the quad.
            // This preserves the voxel scale instead of stretching one pixel pattern
            // across a large greedy rectangle.
            if (dir > 0) {
                uvs.push(0, 0, w, 0, w, h, 0, h);
            } else {
                uvs.push(0, 0, 0, h, w, h, w, 0);
            }

            const arr = indicesByBlock.get(block) || [];
            arr.push(
                baseVertex, baseVertex + 1, baseVertex + 2,
                baseVertex, baseVertex + 2, baseVertex + 3
            );
            indicesByBlock.set(block, arr);
        }

        // Standard greedy face extraction. q is the voxel coordinate immediately
        // before the face plane; the plane itself is q + 0.5.
        for (let axis = 0; axis < 3; axis++) {
            const u = (axis + 1) % 3;
            const v = (axis + 2) % 3;
            const du = dims[u];
            const dv = dims[v];
            const dd = dims[axis];
            const mask = new Int16Array(du * dv);

            for (let q = -1; q < dd; q++) {
                mask.fill(0);

                for (let j = 0; j < dv; j++) {
                    for (let i = 0; i < du; i++) {
                        const a = [0, 0, 0];
                        const b = [0, 0, 0];
                        a[axis] = q;
                        b[axis] = q + 1;
                        a[u] = b[u] = i;
                        a[v] = b[v] = j;

                        const ba = blockAt(a[0], a[1], a[2]);
                        const bb = blockAt(b[0], b[1], b[2]);

                        // Positive: solid voxel is on the low side of the face.
                        // Negative: solid voxel is on the high side.
                        mask[i + du * j] = ba !== 0 && bb === 0 ? ba :
                                           (ba === 0 && bb !== 0 ? -bb : 0);
                    }
                }

                for (let j = 0; j < dv; j++) {
                    for (let i = 0; i < du;) {
                        const idx = i + du * j;
                        const value = mask[idx];
                        if (value === 0) {
                            i++;
                            continue;
                        }

                        let w = 1;
                        while (i + w < du && mask[i + w + du * j] === value) w++;

                        let h = 1;
                        outer:
                        while (j + h < dv) {
                            for (let k = 0; k < w; k++) {
                                if (mask[i + k + du * (j + h)] !== value) break outer;
                            }
                            h++;
                        }

                        for (let yy = 0; yy < h; yy++) {
                            for (let xx = 0; xx < w; xx++) {
                                mask[i + xx + du * (j + yy)] = 0;
                            }
                        }

                        const block = Math.abs(value);
                        const dir = value > 0 ? 1 : -1;
                        emitQuad(axis, dir, q, i, j, w, h, block);
                        i += w;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indicesByBlock.size ? (() => {
            const all = [];
            for (const arr of indicesByBlock.values()) all.push(...arr);
            return all;
        })() : []);
        geometry.computeVertexNormals();

        const materials = [];
        const materialIndexByBlock = new Map();
        for (const [block, id, base, accent] of textureIDs) {
            const tex = TextureSystem.createTexture("world_" + id, base, accent);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false;
            tex.anisotropy = 1;
            if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
            else if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
            tex.needsUpdate = true;

            materialIndexByBlock.set(block, materials.length);
            materials.push(new THREE.MeshStandardMaterial({
                map: tex,
                color: 0xffffff,
                roughness: 0.88,
                metalness: 0,
                flatShading: true,
                side: THREE.FrontSide,
                depthWrite: true,
                depthTest: true
            }));
        }

        let groupStart = 0;
        for (const [block, arr] of indicesByBlock.entries()) {
            geometry.addGroup(groupStart, arr.length, materialIndexByBlock.get(block));
            groupStart += arr.length;
        }

        geometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.userData.isWorldChunk = true;
        mesh.userData.greedyMeshed = true;
        mesh.userData.faceCulling = "voxel-neighbor";
        mesh.frustumCulled = true;
        chunk.mesh = mesh;
        return mesh;
    }

    function unloadChunk(cx, cz) {

        const key = chunkKey(cx, cz);

        const chunk = chunks.get(key);

        if (!chunk) {
            return;
        }

        if (chunk.mesh) {

            chunk.mesh.geometry.dispose();

            if (Array.isArray(chunk.mesh.material)) {
                chunk.mesh.material.forEach(m => m.dispose());
            } else {
                chunk.mesh.material.dispose();
            }
        }

        chunks.delete(key);
    }

    function updateVisibleChunks(
        scene,
        playerX,
        playerZ,
        renderDistance = 2
    ) {

        activeScene = scene;

        const center =
            worldToChunk(
                Math.floor(playerX),
                Math.floor(playerZ)
            );

        const wanted = new Set();

        for (
            let dx = -renderDistance;
            dx <= renderDistance;
            dx++
        ) {

            for (
                let dz = -renderDistance;
                dz <= renderDistance;
                dz++
            ) {

                /*
                    Hình tròn chunk thay vì
                    tải một hình vuông quá lớn.
                */

                if (
                    dx * dx +
                    dz * dz >
                    renderDistance * renderDistance
                ) {
                    continue;
                }

                const cx =
                    center.cx + dx;

                const cz =
                    center.cz + dz;

                const key =
                    chunkKey(cx, cz);

                wanted.add(key);

                const chunk =
                    generateChunk(cx, cz);

                if (!chunk.mesh) {

                    const mesh =
                        createChunkMesh(
                            cx,
                            cz
                        );

                    scene.add(mesh);
                }
            }
        }

        for (const [key, chunk] of chunks) {

            if (!wanted.has(key)) {

                if (chunk.mesh) {
                    scene.remove(chunk.mesh);
                }

                unloadChunk(
                    chunk.cx,
                    chunk.cz
                );
            }
        }
    }

    function queueVisibleChunks(scene, playerX, playerZ, renderDistance = 2) {
        activeScene = scene;
        const center = worldToChunk(Math.floor(playerX), Math.floor(playerZ));
        const wanted = [];
        const wantedSet = new Set();

        for (let dx = -renderDistance; dx <= renderDistance; dx++) {
            for (let dz = -renderDistance; dz <= renderDistance; dz++) {
                if (dx * dx + dz * dz > renderDistance * renderDistance) continue;
                const cx = center.cx + dx, cz = center.cz + dz;
                const key = chunkKey(cx, cz);
                wantedSet.add(key);
                const dist2 = dx * dx + dz * dz;
                wanted.push({cx, cz, key, dist2});
            }
        }

        // Unload first so moving between areas does not keep old geometry around.
        for (const [key, chunk] of chunks) {
            if (!wantedSet.has(key)) {
                if (chunk.mesh && chunk.mesh.parent) scene.remove(chunk.mesh);
                unloadChunk(chunk.cx, chunk.cz);
            }
        }

        wanted.sort((a,b) => a.dist2 - b.dist2);
        const token = ++loadQueueToken;
        loadQueue = [];
        loadQueueSet.clear();
        for (const item of wanted) {
            const chunk = chunks.get(item.key);
            if (!chunk || !chunk.mesh) {
                loadQueue.push(item);
                loadQueueSet.add(item.key);
            }
        }

        if (!loadQueueRunning) {
            loadQueueRunning = true;
            const step = () => {
                if (token !== loadQueueToken) { loadQueueRunning = false; return; }
                const item = loadQueue.shift();
                if (item) {
                    loadQueueSet.delete(item.key);
                    const chunk = generateChunk(item.cx, item.cz);
                    if (!chunk.mesh) scene.add(createChunkMesh(item.cx, item.cz));
                    requestAnimationFrame(step);
                } else {
                    loadQueueRunning = false;
                }
            };
            requestAnimationFrame(step);
        }
    }

    // Startup strategy for mobile:
    // 1 center chunk, then 4 cardinal chunks, then 8 diagonal/near chunks.
    // The next 16 chunks are only PREPARED (data generated, no mesh), so moving
    // into them later is much smoother.
    function getStartupBatches(playerX, playerZ) {
        const center = worldToChunk(Math.floor(playerX), Math.floor(playerZ));
        const make = (dx, dz) => ({
            cx: center.cx + dx,
            cz: center.cz + dz,
            key: chunkKey(center.cx + dx, center.cz + dz),
            dx, dz
        });
        const centerBatch = [make(0, 0)];
        const cardinal = [make(1,0), make(-1,0), make(0,1), make(0,-1)];
        const diagonalAndNear = [
            make(1,1), make(1,-1), make(-1,1), make(-1,-1),
            make(2,0), make(-2,0), make(0,2), make(0,-2)
        ];
        const outer = [
            make(2,1), make(2,-1), make(-2,1), make(-2,-1),
            make(1,2), make(-1,2), make(1,-2), make(-1,-2),
            make(2,2), make(2,-2), make(-2,2), make(-2,-2),
            make(3,0), make(-3,0), make(0,3), make(0,-3)
        ];
        return { center: centerBatch, cardinal, near8: diagonalAndNear, outer16: outer };
    }

    function processChunkList(scene, list, makeMesh, onProgress, doneLabel) {
        return new Promise(resolve => {
            let index = 0;
            const total = list.length;
            const step = () => {
                const started = performance.now();
                while (index < total && (performance.now() - started) < 5) {
                    const item = list[index++];
                    const chunk = generateChunk(item.cx, item.cz);
                    if (makeMesh && !chunk.mesh) {
                        scene.add(createChunkMesh(item.cx, item.cz));
                    }
                    if (onProgress) onProgress(index, total, item, doneLabel);
                }
                if (index < total) requestAnimationFrame(step);
                else resolve(total);
            };
            requestAnimationFrame(step);
        });
    }

    function loadInitialChunks(scene, playerX, playerZ, renderDistance = 2, onProgress) {
        activeScene = scene;
        const batches = getStartupBatches(playerX, playerZ);
        return (async () => {
            let done = 0;
            await processChunkList(scene, batches.center, true, (i,t,item) => {
                done = i;
                onProgress?.(done, 13, item, "center");
            });
            await processChunkList(scene, batches.cardinal, true, (i,t,item) => {
                done = 1 + i;
                onProgress?.(done, 13, item, "cardinal");
            });
            await processChunkList(scene, batches.near8, true, (i,t,item) => {
                done = 5 + i;
                onProgress?.(done, 13, item, "near8");
            });
            // Outer 16 are prepared without meshes. They are not considered loaded/visible
            // for mob spawning until their mesh is actually added to the scene.
            let prepIndex = 0;
            await new Promise(resolve => {
                const step = () => {
                    if (prepIndex >= batches.outer16.length) return resolve();
                    const item = batches.outer16[prepIndex++];
                    generateChunk(item.cx, item.cz);
                    onProgress?.(13 + prepIndex, 29, item, "prepare16");
                    requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
            });
            return 29;
        })();
    }

    function isChunkVisibleLoaded(cx, cz) {
        const chunk = chunks.get(chunkKey(cx, cz));
        return !!(chunk && chunk.mesh && chunk.mesh.parent === activeScene);
    }

    function isWorldPositionLoaded(x, z) {
        const c = worldToChunk(Math.floor(x), Math.floor(z));
        return isChunkVisibleLoaded(c.cx, c.cz);
    }

    function getSpawnHeight(x, z) {
        // Player position is the center of a 2-block-tall character.
        return getTerrainHeight(x, z) + 0.5;
    }

    function resetWorld() {
        loadQueueToken++;
        loadQueue = [];
        loadQueueSet.clear();
        loadQueueRunning = false;
        for (const [, chunk] of chunks) {
            if (chunk.mesh && chunk.mesh.parent) chunk.mesh.parent.remove(chunk.mesh);
            if (chunk.mesh && chunk.mesh.geometry) chunk.mesh.geometry.dispose();
        }
        chunks.clear();
    }

    return {
        CHUNK_SIZE,
        WORLD_HEIGHT,
        getTerrainHeight,
        getSpawnPoint,
        getSpawnHeight,
        loadInitialChunks,
        isChunkVisibleLoaded,
        isWorldPositionLoaded,
        getStartupBatches,
        resetWorld,
        getBlock,
        setBlock,
        rebuildChunk,
        exportEdits() {
            const out = {};
            for (const [k,v] of edits) out[k] = v;
            return out;
        },
        importEdits(saved) {
            edits.clear();
            for (const [k,v] of Object.entries(saved || {})) edits.set(k, Number(v));
            for (const chunk of chunks.values()) {
                if (chunk.mesh && activeScene) activeScene.remove(chunk.mesh);
                chunk.mesh?.geometry?.dispose?.();
                chunk.mesh = null;
                const rebuilt = generateChunk(chunk.cx, chunk.cz);
                if (activeScene) activeScene.add(createChunkMesh(rebuilt.cx, rebuilt.cz));
            }
        },
        WORLD_HEIGHT,
        blockIDs,
        isSolid,
        generateChunk,
        createChunkMesh,
        updateVisibleChunks,
        queueVisibleChunks,
        unloadChunk
    };

})();