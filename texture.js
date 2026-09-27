"use strict";

const TEXTURE_SIZE = 32;

// Một bảng màu duy nhất được dùng cho icon 32x32 và mô hình 3D trên tay.
// Nhờ vậy cùng một item luôn có màu/đặc điểm nhận diện giống nhau ở mọi nơi.
const ITEM_VISUALS = {
    quy_tinh_sword: {kind:"sword", body:"#18233f", edge:"#d8e8ff", accent:"#4f7dff", dark:"#0a1022", tip:"#e8c7ff", gold:"#d59a57", goldLight:"#f2c77a", violet:"#9a62ff"},
    titan_drill_1: {kind:"drill", body:"#65727d", edge:"#d9e5ec", accent:"#8c9aa2", dark:"#252b31", tip:"#b8c8d0"},
    titan_drill_2: {kind:"drill", body:"#65727d", edge:"#d9e5ec", accent:"#8f6fae", dark:"#252b31", tip:"#c7a9e6"},
    titan_drill_3: {kind:"drill", body:"#65727d", edge:"#d9e5ec", accent:"#66b9d7", dark:"#252b31", tip:"#b8efff"},
    titan_drill_4: {kind:"drill", body:"#65727d", edge:"#d9e5ec", accent:"#d0a34a", dark:"#252b31", tip:"#ffe0a0"},
    // Aliases dùng đúng ID trong GAME.inventory / mod.js.
    black_titan_tools: {kind:"tool", body:"#20262c", edge:"#5c6972", accent:"#8d969d", dark:"#12171b", tip:"#c9d2d7"},
    titan_guardian_crystal: {kind:"crystal", body:"#087d9a", edge:"#63d9ef", accent:"#b7f7ff", dark:"#064456", tip:"#ffffff"},
    black_titanite_tool: {kind:"tool", body:"#20262c", edge:"#5c6972", accent:"#8d969d", dark:"#12171b", tip:"#c9d2d7"},
    oxygen_tank: {kind:"tank", body:"#597481", edge:"#d6edf5", accent:"#8ed8ed", dark:"#263a43", tip:"#effcff"},
    revive_charm: {kind:"charm", body:"#6b3bb1", edge:"#b97cff", accent:"#f0d8ff", dark:"#35165d", tip:"#ffffff"},
    revive_decoy: {kind:"decoy", body:"#6b6f78", edge:"#d9e0e7", accent:"#9ea8b3", dark:"#343840", tip:"#f4f7fa"},
    titan_training_dummy: {kind:"training_dummy", body:"#49343a", edge:"#b87868", accent:"#ff8a64", dark:"#24191d", tip:"#ffd0a8"},
    dark_matter: {kind:"orb", body:"#090c14", edge:"#33265e", accent:"#9c7cf0", dark:"#04060a", tip:"#d9cfff"},
    titan_guard_crystal: {kind:"crystal", body:"#087d9a", edge:"#63d9ef", accent:"#b7f7ff", dark:"#064456", tip:"#ffffff"},
    component: {kind:"component", body:"#58646d", edge:"#bfcbd1", accent:"#7ed1df", dark:"#20272c", tip:"#e9fbff"},
    components: {kind:"component", body:"#58646d", edge:"#bfcbd1", accent:"#7ed1df", dark:"#20272c", tip:"#e9fbff"},
    space_stone: {kind:"stone", body:"#465564", edge:"#9ab3c6", accent:"#6c9cc2", dark:"#222b35", tip:"#d4e8f6"},
    titanite: {kind:"block", body:"#65727d", edge:"#d9e5ec", accent:"#a9c1cf", dark:"#39434b", tip:"#eef8ff"},
    titanite_black: {kind:"block", body:"#252b31", edge:"#65717b", accent:"#8798a4", dark:"#11161b", tip:"#c7d4dc"},
    titanite_igneous: {kind:"block", body:"#49343a", edge:"#8f5c56", accent:"#c97968", dark:"#2d2024", tip:"#efaa92"},
    titanite_blood: {kind:"block", body:"#6f2d38", edge:"#b85b66", accent:"#dc7a83", dark:"#451820", tip:"#f2a0a8"},
    titanite_blood_block: {kind:"block", body:"#6f2d38", edge:"#b85b66", accent:"#dc7a83", dark:"#451820", tip:"#f2a0a8"},
    titan_vault: {kind:"block", body:"#252d35", edge:"#667783", accent:"#a9c4d1", dark:"#11161b", tip:"#d8edf5"},
    crafting_machine: {kind:"block", body:"#34434b", edge:"#78939f", accent:"#69d4df", dark:"#172126", tip:"#d9fbff"},
    space_gate: {kind:"block", body:"#27224a", edge:"#6654a8", accent:"#b28cff", dark:"#100d20", tip:"#e8ddff"}
};

const BLOCK_VISUALS = {
    titanite: {base:"#65727d", accent:"#d9e5ec"},
    titanite_black: {base:"#252b31", accent:"#65717b"},
    titanite_blood: {base:"#6f2d38", accent:"#dc7a83"},
    titanite_igneous: {base:"#49343a", accent:"#c97968"},
    titanite_eternal: {base:"#1c2025", accent:"#5c6872"},
    dark_matter_ore: {base:"#242238", accent:"#9c7cf0"},
    titan_vault: {base:"#252d35", accent:"#a9c4d1"},
    crafting_machine: {base:"#34434b", accent:"#69d4df"},
    space_gate: {base:"#27224a", accent:"#b28cff"}
};

const TextureSystem = (() => {
    const cache = {};

    function hash(x, y, seed = 0) {
        let n = Math.imul(x + seed * 31, 374761393);
        n = Math.imul(n ^ (n >>> 13), 668265263);
        n ^= Math.imul(y + seed * 17, 1442695041);
        n = Math.imul(n ^ (n >>> 16), 1274126177);
        return ((n ^ (n >>> 15)) >>> 0) / 4294967295;
    }
    function hexToRgb(hex) { const v=parseInt(String(hex).replace('#',''),16); return {r:(v>>16)&255,g:(v>>8)&255,b:v&255}; }
    function rgb(r,g,b,a=1){return `rgba(${Math.max(0,Math.min(255,r))},${Math.max(0,Math.min(255,g))},${Math.max(0,Math.min(255,b))},${a})`;}
    function mix(a,b,t){return {r:a.r+(b.r-a.r)*t,g:a.g+(b.g-a.g)*t,b:a.b+(b.b-a.b)*t};}

    function createTexture(id, base, accent) {
        if (cache[id]) return cache[id];
        const canvas=document.createElement('canvas'); canvas.width=TEXTURE_SIZE; canvas.height=TEXTURE_SIZE;
        const ctx=canvas.getContext('2d',{alpha:false});
        const baseRGB=hexToRgb(base), accentRGB=hexToRgb(accent);
        const darkRGB=mix(baseRGB,{r:0,g:0,b:0},.28), lightRGB=mix(baseRGB,{r:255,g:255,b:255},.12), seed=id.length*97;
        for(let y=0;y<32;y++) for(let x=0;x<32;x++){
            const n=hash(x,y,seed), shade=(n-.5)*.10;
            const c=shade>=0?mix(baseRGB,lightRGB,shade/.08):mix(darkRGB,baseRGB,(shade+.08)/.08);
            ctx.fillStyle=rgb(c.r,c.g,c.b); ctx.fillRect(x,y,1,1);
        }
        for(let i=0;i<55;i++){
            const x=Math.floor(hash(i,7,seed)*32), y=Math.floor(hash(i,19,seed+3)*32), n=hash(i,29,seed+9);
            if(n>.38){const s=n>.88?2:1; ctx.fillStyle=rgb(accentRGB.r,accentRGB.g,accentRGB.b,n>.72?.75:.45);ctx.fillRect(x,y,s,s);}
        }
        ctx.fillStyle=rgb(0,0,0,.12);ctx.fillRect(0,0,32,1);ctx.fillRect(0,31,32,1);ctx.fillRect(0,0,1,32);ctx.fillRect(31,0,1,32);
        const texture=new THREE.CanvasTexture(canvas); texture.magFilter=THREE.NearestFilter; texture.minFilter=THREE.NearestFilter; texture.generateMipmaps=false; texture.anisotropy=1; texture.needsUpdate=true;
        cache[id]=texture; return texture;
    }

    function createItemIcon(id, drawFunction) {
        // Mỗi lần gọi trả về một canvas riêng để cùng một icon có thể xuất hiện
        // đồng thời ở hotbar, kho đồ và công thức mà không bị DOM chuyển node.
        if (cache[id]) {
            const copy = document.createElement('canvas');
            copy.width = 32; copy.height = 32;
            const c = copy.getContext('2d');
            c.imageSmoothingEnabled = false;
            c.drawImage(cache[id], 0, 0);
            return copy;
        }
        const canvas=document.createElement('canvas');
        // Texture nguồn thật sự là 32x32; icon UI có thể hiển thị nhỏ hơn bằng CSS.
        canvas.width=32; canvas.height=32;
        const ctx=canvas.getContext('2d'); ctx.imageSmoothingEnabled=false; drawFunction(ctx);
        cache[id]=canvas;
        return canvas;
    }

    function getVisual(id){ return ITEM_VISUALS[id] || {kind:'generic',body:'#59636b',edge:'#c4cdd2',accent:'#83b7c9',dark:'#20262b',tip:'#f0f7fa'}; }
    function getBlockVisual(id){ return BLOCK_VISUALS[id] || {base:'#59636b',accent:'#c4cdd2'}; }
    function hex(v){ return parseInt(v.replace('#',''),16); }

    return {createTexture,createItemIcon,getVisual,getBlockVisual,hex,ITEM_VISUALS,BLOCK_VISUALS};
})();
