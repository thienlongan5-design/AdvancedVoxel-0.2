"use strict";

/* =========================================================
   COLLISION SYSTEM
   - Lightweight AABB hitboxes for player, creatures and objects.
   - Voxel blocks keep using WORLD.isSolid(); this system handles
     dynamic entities so they do not overlap each other.
   - Designed for mobile: no per-frame Box3 allocations for entities.
   ========================================================= */
const COLLISION_SYSTEM = (() => {
    const entities = new Set();
    const tmp = { a: {}, b: {} };

    function createBox(entity, halfX, halfY, halfZ, offsetY = 0) {
        entity.collisionBox = {
            halfX: Math.max(0.01, halfX),
            halfY: Math.max(0.01, halfY),
            halfZ: Math.max(0.01, halfZ),
            offsetY: Number(offsetY) || 0
        };
        register(entity);
        return entity.collisionBox;
    }

    function register(entity) {
        if (entity) entities.add(entity);
        return entity;
    }

    function unregister(entity) {
        if (entity) entities.delete(entity);
    }

    function isActive(e) {
        return !!e && !e.dead && e.position && e.collisionBox;
    }

    function bounds(e, out = {}) {
        const p = e.position;
        const c = e.collisionBox;
        out.minX = p.x - c.halfX;
        out.maxX = p.x + c.halfX;
        out.minY = p.y + c.offsetY - c.halfY;
        out.maxY = p.y + c.offsetY + c.halfY;
        out.minZ = p.z - c.halfZ;
        out.maxZ = p.z + c.halfZ;
        return out;
    }

    function intersects(a, b) {
        if (!isActive(a) || !isActive(b) || a === b) return false;
        const A = bounds(a, tmp.a), B = bounds(b, tmp.b);
        return A.minX < B.maxX && A.maxX > B.minX &&
               A.minY < B.maxY && A.maxY > B.minY &&
               A.minZ < B.maxZ && A.maxZ > B.minZ;
    }

    function intersectsHorizontal(a, b, padding = 0) {
        if (!isActive(a) || !isActive(b) || a === b) return false;
        const A = bounds(a, tmp.a), B = bounds(b, tmp.b);
        return A.minX < B.maxX + padding && A.maxX > B.minX - padding &&
               A.minZ < B.maxZ + padding && A.maxZ > B.minZ - padding;
    }

    function horizontalGap(a, b) {
        if (!isActive(a) || !isActive(b)) return Infinity;
        const A = bounds(a, tmp.a), B = bounds(b, tmp.b);
        const dx = Math.max(0, Math.max(B.minX - A.maxX, A.minX - B.maxX));
        const dz = Math.max(0, Math.max(B.minZ - A.maxZ, A.minZ - B.maxZ));
        return Math.hypot(dx, dz);
    }

    function canMoveTo(entity, x, z, extra = 0, filter = null) {
        if (!isActive(entity)) return true;
        const oldX = entity.position.x, oldZ = entity.position.z;
        entity.position.x = x;
        entity.position.z = z;
        let blocked = false;
        for (const other of entities) {
            if (!isActive(other) || other === entity) continue;
            if (filter && !filter(other)) continue;
            if (intersectsHorizontal(entity, other, extra)) {
                blocked = true;
                break;
            }
        }
        entity.position.x = oldX;
        entity.position.z = oldZ;
        return !blocked;
    }

    function query(position, radius, filter = null) {
        const result = [];
        for (const e of entities) {
            if (!isActive(e)) continue;
            if (filter && !filter(e)) continue;
            const dx = e.position.x - position.x;
            const dz = e.position.z - position.z;
            if (dx * dx + dz * dz <= radius * radius) result.push(e);
        }
        return result;
    }

    function getEntityRadius(e) {
        if (!e?.collisionBox) return 0;
        return Math.max(e.collisionBox.halfX, e.collisionBox.halfZ);
    }

    function getEntityHeight(e) {
        if (!e?.collisionBox) return 0;
        return e.collisionBox.halfY * 2;
    }

    return {
        entities,
        createBox,
        register,
        unregister,
        bounds,
        intersects,
        intersectsHorizontal,
        horizontalGap,
        canMoveTo,
        query,
        getEntityRadius,
        getEntityHeight
    };
})();

window.COLLISION_SYSTEM = COLLISION_SYSTEM;
