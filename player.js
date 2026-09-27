"use strict";

const PLAYER = (() => {

    const player = {
        object: null,
        position: new THREE.Vector3(120, 48.5, 180),
        velocity: new THREE.Vector3(),
        yaw: 0,
        pitch: -0.22,
        speed: 5,
        jumpPower: 7,
        health: 60,
        maxHealth: 60,
        oxygen: 100,
        maxOxygen: 100,
        grounded: false,
        drillLevel: 1,
        input: { forward: 0, right: 0, jump: false },
        modelBottomOffset: 0,
        modelReady: false,
        mixer: null,
        actions: {},
        currentAction: null,
        miningArm: null,
        miningArmBase: null,
        miningTime: 0,
        heldItemRoot: null,
        heldItemId: null,
        collisionBox: null
    };

    // Hitbox người chơi: rộng ~0.72 block, cao 2 block.
    if (typeof COLLISION_SYSTEM !== "undefined") {
        COLLISION_SYSTEM.createBox(player, 0.36, 1.0, 0.36, 1.0);
    }

    // Căn chân của mọi model về cùng một mốc player.position.y.
    // Nhờ vậy fallback và player.glb không bị lệch/lún khi đổi model.
    function fitModelToPlayer(object, targetHeight = 2) {
        if (!object) return;

        const before = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        before.getSize(size);

        if (size.y > 0.001) {
            const scale = targetHeight / size.y;
            object.scale.multiplyScalar(scale);
        }

        object.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(object);
        player.modelBottomOffset = box.min.y - object.position.y;
    }

    function setupObject(object, scene, isFallback = false, animations = []) {
        player.object = object;

        // AnimationMixer phải được tạo trên chính scene/object đã clone từ GLB.
        // Player.glb hiện có 2 clip: idle và walk.
        player.mixer = null;
        player.actions = {};
        player.currentAction = null;

        if (!isFallback && animations && animations.length) {
            player.mixer = new THREE.AnimationMixer(object);

            for (const clip of animations) {
                const name = String(clip.name || "").toLowerCase();
                if (name === "idle" || name === "walk") {
                    const action = player.mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat, Infinity);
                    action.enabled = true;
                    player.actions[name] = action;
                }
            }

            // Start in idle immediately; movement will cross-fade to walk.
            if (player.actions.idle) {
                player.actions.idle.play();
                player.currentAction = player.actions.idle;
            }
        }

        // Cả fallback và GLB đều được chuẩn hóa về cùng chiều cao 2 block.
        fitModelToPlayer(object, 2.0);

        object.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = true;
            }
        });

        scene.add(object);

        // player.glb dùng group7 làm tay phải; lưu góc gốc để đập block
        // bằng một chuyển động lên/xuống nhanh mà không phá animation đi bộ.
        player.miningArm = object.getObjectByName("group7") || null;
        if (player.miningArm) {
            player.miningArmBase = player.miningArm.rotation.clone();
            if (typeof GAME !== "undefined" && GAME.hotbarItems) updateHeldItem(GAME.hotbarItems[GAME.selectedSlot] || null);
        }

        player.modelReady = true;
    }

    function disposeObject3D(root) {
        if (!root) return;
        root.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => { if (m && m.map && m.userData && m.userData.disposeOnHeldItem) m.map.dispose(); if (m && m.dispose) m.dispose(); });
            }
        });
    }

    function mat(color, roughness = 0.7, metalness = 0.1) {
        return new THREE.MeshStandardMaterial({ color, roughness, metalness });
    }

    function makeHeldModel(id) {
        const root = new THREE.Group();
        root.name = "HeldItem_" + id;
        const v = TextureSystem.getVisual(id);
        const material = (c, roughness=0.5, metalness=0.3) => new THREE.MeshStandardMaterial({
            color: TextureSystem.hex(c), roughness, metalness
        });
        const body=material(v.body,.48,.55), edge=material(v.edge,.32,.72), accent=material(v.accent,.38,.62), dark=material(v.dark,.62,.42), tip=material(v.tip,.28,.78);
        const glow=material(v.tip,.22,.45); glow.emissive.setHex(TextureSystem.hex(v.tip)); glow.emissiveIntensity=.18;
        const add=(o)=>{ root.add(o); return o; };
        const box=(sx,sy,sz,m,x=0,y=0,z=0)=>{const o=add(new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m));o.position.set(x,y,z);return o;};
        const cyl=(r1,r2,h,m,rad=10,x=0,y=0,z=0)=>{const o=add(new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,rad),m));o.position.set(x,y,z);return o;};

        if(v.kind === "sword") {
            // Kiếm Quy Tinh dùng CHÍNH hình học của thanh kiếm bay trong Vạn Kiếm Quy Tông.
            // Không có lớp hộp xám/đen lớn đè lên lưỡi kiếm.
            const makeFX = (color, emissive, intensity, roughness=.22, metalness=.62) => {
                return new THREE.MeshStandardMaterial({
                    color, emissive, emissiveIntensity:intensity,
                    metalness, roughness, side:THREE.DoubleSide
                });
            };
            const bladeMat = makeFX(0xd8e8ff, 0x4f7dff, 1.25, .18, .72);
            const coreMat = makeFX(0x5b7dff, 0x6f55ff, 1.45, .16, .68);
            const goldMat = makeFX(0xd59a57, 0x5d3718, .40, .24, .82);
            const gemMat = makeFX(0xd7b6ff, 0x9a62ff, 1.55, .12, .52);
            const violetMat = makeFX(0xe2baff, 0x9a62ff, 1.20, .13, .56);
            const darkGold = makeFX(0x6f421f, 0x2c1308, .28, .30, .80);
            const add = o => { root.add(o); o.castShadow=true; o.receiveShadow=true; return o; };
            const box = (sx,sy,sz,m,x=0,y=0,z=0) => { const o=add(new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m)); o.position.set(x,y,z); return o; };

            const shape = new THREE.Shape();
            shape.moveTo(-.13,.02); shape.lineTo(-.18,.18); shape.lineTo(-.165,.68); shape.lineTo(-.12,1.02);
            shape.lineTo(-.06,1.30); shape.lineTo(0,1.48); shape.lineTo(.06,1.30); shape.lineTo(.12,1.02);
            shape.lineTo(.165,.68); shape.lineTo(.18,.18); shape.lineTo(.13,.02); shape.closePath();
            const bladeGeo = new THREE.ExtrudeGeometry(shape,{depth:.10,bevelEnabled:true,bevelSegments:2,bevelSize:.018,bevelThickness:.018,curveSegments:1});
            bladeGeo.translate(0,0,-.05);
            add(new THREE.Mesh(bladeGeo,bladeMat));

            // Lõi/rãnh năng lượng bám sát hai mặt của lưỡi, không tạo mảng đen lớn.
            box(.028,1.14,.038,coreMat,0,.57,-.075);
            box(.028,1.14,.038,coreMat,0,.57,.075);
            box(.018,.98,.045,violetMat,0,.67,-.103);
            box(.018,.98,.045,violetMat,0,.67,.103);
            box(.016,.72,.045,coreMat,0,.72,-.12);
            box(.016,.72,.045,coreMat,0,.72,.12);

            const wingShape = new THREE.Shape();
            wingShape.moveTo(-.48,-.03); wingShape.lineTo(-.34,.10); wingShape.lineTo(-.18,.13); wingShape.lineTo(-.08,.07);
            wingShape.lineTo(.08,.07); wingShape.lineTo(.18,.13); wingShape.lineTo(.34,.10); wingShape.lineTo(.48,-.03);
            wingShape.lineTo(.37,-.14); wingShape.lineTo(.20,-.08); wingShape.lineTo(0,-.035); wingShape.lineTo(-.20,-.08); wingShape.lineTo(-.37,-.14); wingShape.closePath();
            const wingGeo = new THREE.ExtrudeGeometry(wingShape,{depth:.09,bevelEnabled:true,bevelSegments:1,bevelSize:.012,bevelThickness:.012,curveSegments:1});
            wingGeo.translate(0,0,-.045);
            add(new THREE.Mesh(wingGeo,goldMat));

            // Hộ thủ mảnh, ôm sát chuôi; không che phần lưỡi.
            box(.52,.055,.075,goldMat,0,-.035,-.005);
            box(.44,.025,.095,darkGold,0,.005,-.058);
            box(.44,.025,.095,darkGold,0,.005,.058);
            for (const side of [-1,1]) {
                const ornament = add(new THREE.Mesh(new THREE.OctahedronGeometry(.055,0), goldMat));
                ornament.position.set(side*.37,.075,-.055);
                const ornamentBack = add(new THREE.Mesh(new THREE.OctahedronGeometry(.055,0), goldMat));
                ornamentBack.position.set(side*.37,.075,.055);
            }

            // Tinh thể giữa hộ thủ ở cả hai mặt.
            const gemFront=add(new THREE.Mesh(new THREE.OctahedronGeometry(.13,1),gemMat));
            gemFront.position.set(0,-.035,-.13); gemFront.scale.set(1.18,.92,.62);
            const gemBack=add(new THREE.Mesh(new THREE.OctahedronGeometry(.13,1),gemMat));
            gemBack.position.set(0,-.035,.13); gemBack.scale.set(1.18,.92,.62);

            // Chuôi đúng cùng tỷ lệ với kiếm bay.
            box(.12,.38,.12,goldMat,0,-.31,0);
            box(.075,.30,.078,darkGold,0,-.31,0);
            for(let i=0;i<3;i++) box(.145,.028,.145, i%2 ? goldMat : darkGold, 0, -.17-i*.075, 0);
            const pommel=add(new THREE.Mesh(new THREE.OctahedronGeometry(.115,1),goldMat)); pommel.position.set(0,-.57,0);
            const pommelGem=add(new THREE.Mesh(new THREE.OctahedronGeometry(.07,0),gemMat)); pommelGem.position.set(0,-.57,-.072);
            const pommelGemBack=add(new THREE.Mesh(new THREE.OctahedronGeometry(.07,0),gemMat)); pommelGemBack.position.set(0,-.57,.072);

            const tip=add(new THREE.Mesh(new THREE.ConeGeometry(.07,.20,4),violetMat)); tip.position.set(0,1.48,0);
            const tipCore=add(new THREE.Mesh(new THREE.ConeGeometry(.036,.16,4),bladeMat)); tipCore.position.set(0,1.56,0);
        } else if(v.kind === "drill"){
            // Titan Drill: thiết kế low-poly nguyên bản, nhiều lớp chi tiết và bảng màu riêng từng cấp.
            const level = Math.max(1, Math.min(4, Number((String(id).match(/(\d+)$/)||[1])[1])));
            const accent2 = level===1 ? edge : level===2 ? accent : level===3 ? glow : tip;
            const side = level===1 ? dark : level===2 ? accent : level===3 ? tip : accent;

            const motor = cyl(.14,.16,.36,body,12); motor.rotation.z=Math.PI/2; motor.position.set(-.08,.10,0);
            const rearCap = cyl(.105,.135,.10,dark,10); rearCap.rotation.z=Math.PI/2; rearCap.position.set(-.31,.10,0);
            const rearRing = cyl(.145,.145,.035,edge,12); rearRing.rotation.z=Math.PI/2; rearRing.position.set(-.265,.10,0);
            const housing = box(.28,.23,.27,body,.17,.10,0);
            const upperArmor = box(.30,.065,.22,accent,.10,.255,0);
            const lowerRail = box(.22,.055,.20,dark,.08,-.035,0);
            const railInset = box(.16,.025,.11,accent2,.09,.292,0);

            // Motor grooves / bolts add mechanical detail without adding heavy geometry.
            for(let i=0;i<3;i++){
                const ring=cyl(.153,.153,.018,edge,12,-.20+i*.07,.10,0); ring.rotation.z=Math.PI/2;
            }
            for(const z of [-.105,.105]) for(const x of [.06,.24]) cyl(.018,.018,.012,edge,8,x,.235,z);

            const collar = cyl(.115,.115,.105,edge,12,.345,.10,0); collar.rotation.z=Math.PI/2;
            const collarAccent = cyl(.125,.125,.028,accent2,12,.395,.10,0); collarAccent.rotation.z=Math.PI/2;
            const grip = box(.115,.40,.15,dark,-.05,-.14,0); grip.rotation.z=-.08;
            const gripCore = box(.075,.30,.10,side,-.05,-.14,-.01); gripCore.rotation.z=-.08;
            const trigger = box(.075,.12,.10,accent,.06,-.075,-.015); trigger.rotation.z=-.18;
            box(.045,.045,.14,edge,.06,-.14,-.075);
            const topRail = box(.30,.055,.19,accent,.02,.27,0);
            box(.18,.025,.11,accent2,.02,.302,0);

            const shaftLen=[.18,.24,.31,.37][level-1];
            const shaft=cyl(.035,.045,shaftLen,edge,8,.395+shaftLen/2,.10,0); shaft.rotation.z=Math.PI/2;
            const shaftRing=cyl(.058,.058,.035,dark,10,.43,.10,0); shaftRing.rotation.z=Math.PI/2;
            root.add(motor,rearCap,rearRing,housing,upperArmor,lowerRail,railInset,collar,collarAccent,grip,gripCore,trigger,topRail,shaft,shaftRing);

            const tipX=.395+shaftLen;
            if(level===1){
                const bit=cyl(.065,.045,.16,tip,8,tipX+.08,.10,0); bit.rotation.z=Math.PI/2;
                const nose=cyl(.078,.078,.035,accent2,8,tipX+.018,.10,0); nose.rotation.z=Math.PI/2;
                root.add(bit,nose);
            } else if(level===2){
                const base=cyl(.078,.078,.07,accent2,10,tipX+.035,.10,0); base.rotation.z=Math.PI/2;
                const bit=cyl(.078,.055,.22,tip,8,tipX+.17,.10,0); bit.rotation.z=Math.PI/2;
                const ring=cyl(.09,.09,.025,edge,10,tipX+.075,.10,0); ring.rotation.z=Math.PI/2;
                root.add(base,bit,ring);
            } else if(level===3){
                const hub=cyl(.10,.10,.09,accent2,10,tipX+.045,.10,0); hub.rotation.z=Math.PI/2;
                const core=cyl(.09,.055,.22,tip,8,tipX+.18,.10,0); core.rotation.z=Math.PI/2;
                for(let a=0;a<3;a++){
                    const tooth=box(.15,.045,.055,side,tipX+.17,.10,0); tooth.rotation.x=a*2.094; tooth.rotation.z=-.18; root.add(tooth);
                }
                root.add(hub,core);
            } else {
                const hub=cyl(.115,.115,.10,accent2,12,tipX+.045,.10,0); hub.rotation.z=Math.PI/2;
                const cutter=cyl(.13,.15,.17,tip,10,tipX+.16,.10,0); cutter.rotation.z=Math.PI/2;
                const ring=cyl(.16,.16,.035,edge,10,tipX+.23,.10,0); ring.rotation.z=Math.PI/2;
                for(let a=0;a<6;a++){
                    const ang=a*Math.PI/3;
                    const tooth=box(.12,.055,.07,side,tipX+.27,.10,0);
                    tooth.position.x += Math.cos(ang)*.075; tooth.position.z += Math.sin(ang)*.075; tooth.rotation.y=ang;
                    root.add(tooth);
                }
                const center=cyl(.055,.055,.07,glow,10,tipX+.30,.10,0); center.rotation.z=Math.PI/2;
                root.add(hub,cutter,ring,center);
            }
        } else if(v.kind === "tool"){
            const handle=box(.14,.60,.15,dark,-.12,0,0); handle.rotation.z=-.18;
            const grip=box(.10,.44,.11,body,-.12,-.01,-.01); grip.rotation.z=-.18;
            const pommel=cyl(.085,.085,.09,edge,8,-.18,-.28,0); pommel.rotation.z=Math.PI/2;
            const head=box(.42,.15,.18,accent,.09,.22,0);
            box(.26,.055,.20,edge,.09,.30,0);
            box(.11,.23,.20,body,.31,.15,0);
            box(.07,.13,.22,tip,.37,.15,0);
            for(let x of [.00,.10,.20]) cyl(.018,.018,.012,edge,8,x,.29,.10);
            root.add(handle,grip,pommel,head);
        } else if(v.kind === "tank"){
            const bodyMesh=cyl(.145,.155,.54,body,12,0,0,0);
            const lower=cyl(.16,.16,.045,dark,12,0,-.27,0);
            const cap=cyl(.075,.075,.11,edge,10,0,.325,0);
            const valve=cyl(.045,.045,.07,dark,8,0,.405,0);
            const stripe=box(.23,.12,.035,accent,0,.06,-.14);
            const band=box(.30,.045,.30,edge,0,-.02,0); band.scale.y=.55;
            const gauge=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.025,10),tip); gauge.rotation.x=Math.PI/2; gauge.position.set(.13,.12,-.11);
            root.add(bodyMesh,lower,cap,valve,stripe,band,gauge);
        } else if(v.kind === "charm"){
            const ring=new THREE.Mesh(new THREE.TorusGeometry(.19,.035,8,14),body);
            const ring2=new THREE.Mesh(new THREE.TorusGeometry(.14,.018,6,12),edge); ring2.position.z=-.015;
            const cross=box(.065,.30,.055,accent,0,0,-.015); box(.30,.065,.055,accent,0,0,-.015);
            const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.10,0),tip); gem.position.z=-.07;
            const gem2=new THREE.Mesh(new THREE.OctahedronGeometry(.055,0),glow); gem2.position.z=-.11;
            root.add(ring,ring2,cross,gem,gem2);
        } else if(v.kind === "decoy"){
            const head=box(.15,.15,.15,body,0,.20,0);
            const visor=box(.09,.045,.025,accent,0,.215,-.078);
            const torso=box(.20,.27,.12,accent,0,.01,0);
            const core=box(.08,.11,.025,tip,0,.03,-.07);
            const armL=box(.065,.21,.065,body,-.145,.02,0); armL.rotation.z=-.15;
            const armR=armL.clone(); armR.position.x=.145; armR.rotation.z=.15;
            const legL=box(.075,.22,.075,dark,-.055,-.22,0); const legR=legL.clone(); legR.position.x=.055;
            root.add(head,visor,torso,core,armL,armR,legL,legR);
        } else if(v.kind === "orb"){
            const core=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,1),body);
            const facet=new THREE.Mesh(new THREE.IcosahedronGeometry(.125,0),accent);
            const ring=new THREE.Mesh(new THREE.TorusGeometry(.20,.018,6,16),edge); ring.rotation.x=.8;
            const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.045,0),tip); spark.position.set(.09,.08,.10);
            root.add(core,facet,ring,spark);
        } else if(v.kind === "crystal"){
            const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(.20,1),body);
            const core=new THREE.Mesh(new THREE.OctahedronGeometry(.115,0),tip); core.position.z=-.04;
            const band=new THREE.Mesh(new THREE.TorusGeometry(.17,.012,5,12),edge); band.rotation.x=.7;
            root.add(crystal,core,band);
        } else if(v.kind === "component"){
            const board=box(.36,.25,.08,body);
            box(.15,.11,.10,accent,.05,.02,-.06);
            box(.08,.07,.04,tip,.05,.02,-.12);
            for(const x of [-.13,.13]){ box(.04,.17,.04,edge,x,.04,-.06); box(.035,.035,.035,dark,x,.13,-.08); }
            box(.22,.035,.035,edge,0,-.10,-.045);
            root.add(board);
        } else if(v.kind === "stone"){
            const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(.21,1),body);
            const face=new THREE.Mesh(new THREE.OctahedronGeometry(.085,0),accent); face.position.set(.05,.03,-.19);
            const vein=box(.04,.13,.025,tip,-.07,.05,-.18); vein.rotation.z=.4;
            root.add(stone,face,vein);
        } else if(v.kind === "block"){
            const item=GAME_DATA.items[id], blockId=item?.blockId || id;
            const bv=TextureSystem.getBlockVisual(blockId);
            const tex=TextureSystem.createTexture("held_"+blockId,bv.base,bv.accent);
            const m=new THREE.MeshStandardMaterial({map:tex,roughness:.84,metalness:.08});
            const cube=new THREE.Mesh(new THREE.BoxGeometry(.40,.40,.40),m);
            const edgeMesh=new THREE.LineSegments(new THREE.EdgesGeometry(cube.geometry),new THREE.LineBasicMaterial({color:TextureSystem.hex(v.edge)}));
            root.add(cube,edgeMesh);
        } else {
            const shape=new THREE.Mesh(new THREE.OctahedronGeometry(.19,0),accent); root.add(shape);
        }
        root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
        return root;
    }

    function updateHeldItem(id) {
        player.heldItemId = id || null;
        if (!player.miningArm) return;
        if (player.heldItemRoot) {
            player.miningArm.remove(player.heldItemRoot);
            disposeObject3D(player.heldItemRoot);
            player.heldItemRoot = null;
        }
        if (!id) return;
        const root = makeHeldModel(id);
        // Anchor vào CUỐI cánh tay phải (group7), không phải vai.
        // group7 trong player.glb đặt cánh tay theo trục Y âm; điểm cầm nằm gần
        // đầu dưới của cube16. Vì vậy vật phẩm phải nằm thấp và hơi ra trước cơ thể.
        // Điểm cầm mới bám sát bàn tay phải thay vì nằm lệch sang phải của cơ thể.
        // Các Drill được dựng dọc theo trục X, vì vậy xoay Y +90° để mũi khoan
        // hướng về phía trước của nhân vật. Một góc roll -45° giúp thân máy
        // không còn bị nghiêng sang phải như bản trước.
        root.position.set(0.08, -1.06, -0.34);
        root.rotation.set(-0.08, 0.5 * Math.PI, -0.785398);
        root.scale.setScalar(1.08);

        const handRot = {
            quy_tinh_sword: -0.18,
            titan_drill_1: -0.785398, titan_drill_2: -0.785398,
            titan_drill_3: -0.785398, titan_drill_4: -0.785398,
            black_titanite_tool: -0.10
        };
        if (handRot[id] !== undefined) root.rotation.z = handRot[id];
        player.miningArm.add(root);
        player.heldItemRoot = root;
    }

    function create(scene) {
        // Fallback được đặt phía dưới loading screen để game không hiện ra khi đang tải.
        const fallback = ModelLoader.fallbackCube(
            new THREE.MeshStandardMaterial({
                color: 0xeeeeee,
                roughness: 0.8,
                metalness: 0.05
            })
        );
        setupObject(fallback, scene, true);

        return new Promise(resolve => {
            let settled = false;
            const finish = (ok, fallbackUsed = false) => {
                if (settled) return;
                settled = true;
                resolve({ ok, fallbackUsed });
            };

            // Spck Preview có thể phục vụ file nhị phân ở thư mục con ổn định hơn
            // file ở root tùy cấu trúc project. Thử nhiều đường dẫn, vẫn giữ fallback.
            const candidates = [
                "./player.glb",
                "./assets/models/player.glb",
                "assets/models/player.glb"
            ];
            let index = 0;
            const tryNext = () => {
                const path = candidates[index++];
                if (!path) {
                    console.warn("Không tải được player.glb từ các đường dẫn dự phòng.");
                    finish(false, true);
                    return;
                }
                ModelLoader.load(
                    path,
                    (object, animations) => {
                        if (!object) { tryNext(); return; }
                        if (player.object) scene.remove(player.object);
                        setupObject(object, scene, false, animations || []);
                        console.info("Player model loaded:", path);
                        finish(true, false);
                    },
                    error => {
                        console.warn("Không tải được model player:", path, error);
                        tryNext();
                    }
                );
            };
            tryNext();
        });
    }

    function setAnimation(name, fade = 0.12) {
        if (!player.mixer) return;

        const action = player.actions[name] || player.actions.idle;
        if (!action || action === player.currentAction) return;

        action.enabled = true;
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
        action.reset();

        if (player.currentAction) {
            player.currentAction.crossFadeTo(action, fade, true);
        } else {
            action.fadeIn(fade);
        }

        action.play();
        player.currentAction = action;
    }

    function update(delta) {
        const inputForward = THREE.MathUtils.clamp(player.input.forward, -1, 1);
        const inputRight = THREE.MathUtils.clamp(player.input.right, -1, 1);
        const moving = Math.hypot(inputForward, inputRight) > 0.05;

        // Camera/player coordinate system:
        // yaw=0 -> forward is -Z, right is +X.
        const forwardX = -Math.sin(player.yaw);
        const forwardZ = -Math.cos(player.yaw);
        const rightX = Math.cos(player.yaw);
        const rightZ = -Math.sin(player.yaw);

        let dx = forwardX * inputForward + rightX * inputRight;
        let dz = forwardZ * inputForward + rightZ * inputRight;

        const moveLen = Math.hypot(dx, dz);
        if (moveLen > 1) { dx /= moveLen; dz /= moveLen; }
        const mode = typeof GAME !== "undefined" ? String(GAME.playerMode || "survival") : "survival";
        const freeMove = mode === "free" || mode === "observer";
        player.velocity.x = dx * (freeMove ? 7 : player.speed);
        player.velocity.z = dz * (freeMove ? 7 : player.speed);
        if (freeMove) {
            player.velocity.y = 0;
            if (player.input.jump) player.position.y += (mode === "observer" ? 1.0 : 0.65);
            player.grounded = false;
        } else {
            player.velocity.y -= 18 * delta;
            if (player.input.jump && player.grounded) { player.velocity.y = player.jumpPower; player.grounded = false; }
        }

        const HALF = 0.30;
        const HEIGHT = 2.0;
        const EPS = 0.015;
        const STEP_HEIGHT = 1.05;

        function overlapsXZ(bx, bz, px, pz) {
            return Math.abs(px - bx) < 0.5 + HALF - EPS &&
                   Math.abs(pz - bz) < 0.5 + HALF - EPS;
        }

        // Only blocks whose top is ABOVE the player's feet can block the body.
        // This prevents the floor block under the player from acting like a wall
        // when moving sideways.
        function collidesBody(px, py, pz) {
            const minX = Math.floor(px - HALF + 0.5);
            const maxX = Math.floor(px + HALF + 0.5);
            const minZ = Math.floor(pz - HALF + 0.5);
            const maxZ = Math.floor(pz + HALF + 0.5);

            const minY = Math.floor(py + EPS + 0.5);
            const maxY = Math.floor(py + HEIGHT - EPS + 0.5);

            for (let bx = minX; bx <= maxX; bx++) {
                for (let bz = minZ; bz <= maxZ; bz++) {
                    if (!overlapsXZ(bx, bz, px, pz)) continue;

                    for (let by = minY; by <= maxY; by++) {
                        if (!WORLD.isSolid(bx, by, bz)) continue;

                        const blockBottom = by - 0.5;
                        const blockTop = by + 0.5;
                        const bodyBottom = py + EPS;
                        const bodyTop = py + HEIGHT - EPS;

                        if (blockTop > bodyBottom && blockBottom < bodyTop) {
                            return true;
                        }
                    }
                }
            }
            // Va chạm với sinh vật/vật thể động ngoài voxel.
            if (typeof COLLISION_SYSTEM !== "undefined") {
                for (const other of COLLISION_SYSTEM.entities) {
                    if (!other || other === player || other.dead || !other.collisionBox) continue;
                    if (COLLISION_SYSTEM.intersectsHorizontal(player, other)) return true;
                }
            }
            return false;
        }

        function groundTopAt(px, pz, feetY) {
            const minX = Math.floor(px - HALF + 0.5);
            const maxX = Math.floor(px + HALF + 0.5);
            const minZ = Math.floor(pz - HALF + 0.5);
            const maxZ = Math.floor(pz + HALF + 0.5);
            let bestTop = -Infinity;

            for (let bx = minX; bx <= maxX; bx++) {
                for (let bz = minZ; bz <= maxZ; bz++) {
                    if (!overlapsXZ(bx, bz, px, pz)) continue;

                    // Search the terrain around the player's feet.  A small
                    // tolerance allows normal walking over uneven voxel terrain.
                    const by = Math.floor(feetY + 0.5);
                    for (let yy = by - 2; yy <= by + 1; yy++) {
                        if (!WORLD.isSolid(bx, yy, bz)) continue;
                        const top = yy + 0.5;
                        if (top <= feetY + 0.18 && top > bestTop) {
                            bestTop = top;
                        }
                    }
                }
            }
            return bestTop;
        }

        function tryHorizontalAxis(axis, amount) {
            if (Math.abs(amount) < 0.00001) return;

            const oldX = player.position.x;
            const oldZ = player.position.z;

            if (axis === "x") player.position.x += amount;
            else player.position.z += amount;

            if (!collidesBody(player.position.x, player.position.y, player.position.z)) {
                return;
            }

            // Step up small terrain ledges instead of treating them as a wall.
            const stepY = player.position.y + STEP_HEIGHT;
            if (!collidesBody(player.position.x, stepY, player.position.z)) {
                const top = groundTopAt(player.position.x, player.position.z, stepY);
                if (top > -Infinity && top <= player.position.y + STEP_HEIGHT + 0.08) {
                    player.position.y = top;
                    player.velocity.y = 0;
                    player.grounded = true;
                    return;
                }
            }

            player.position.x = oldX;
            player.position.z = oldZ;
        }

        // X and Z are resolved separately. This removes the old behavior where
        // a collision on one side cancelled the other side of the movement.
        if (freeMove) {
            player.position.x += player.velocity.x * delta;
            player.position.z += player.velocity.z * delta;
        } else {
            tryHorizontalAxis("x", player.velocity.x * delta);
            tryHorizontalAxis("z", player.velocity.z * delta);
        }

        // Vertical movement / floor collision.
        const oldY = player.position.y;
        if (!freeMove) player.position.y += player.velocity.y * delta;

        if (!freeMove && player.velocity.y <= 0) {
            const top = groundTopAt(player.position.x, player.position.z, player.position.y + 0.08);
            if (top > -Infinity && player.position.y <= top + 0.10 && oldY >= top - 0.18) {
                player.position.y = top;
                player.velocity.y = 0;
                player.grounded = true;
            } else {
                player.grounded = false;
            }
        } else if (!freeMove) {
            player.grounded = false;
        }

        if (player.object) {
            player.object.position.x = player.position.x;
            player.object.position.y = player.position.y - player.modelBottomOffset;
            player.object.position.z = player.position.z;

            // Face movement direction. When standing still, keep the last camera-facing
            // direction instead of snapping the model every frame.
            if (moving && moveLen > 0.01) {
                const facingYaw = Math.atan2(dx, dz);
                player.object.rotation.y = facingYaw + Math.PI;
                player.object.userData.facingYaw = facingYaw;
            }
        }

        // Player GLB contains idle + walk. Blend them smoothly and keep the walk
        // animation at a speed that follows the actual movement speed.
        if (player.mixer) {
            player.mixer.update(delta);

            if (moving && !player.grounded) {
                // No jump clip exists, so keep the walk pose while airborne rather
                // than inventing an animation that the model does not contain.
                setAnimation("walk");
            } else {
                setAnimation(moving ? "walk" : "idle");
            }

            if (player.actions.walk) {
                player.actions.walk.timeScale = moving ? 1.15 : 1.0;
            }
        }

        player.input.jump = false;
    }

    function setMiningAnimation(active, delta = 0.016) {
        if (!player.miningArm) return;

        if (active) {
            player.miningTime += delta * 22;
            const base = player.miningArmBase || new THREE.Euler();
            player.miningArm.rotation.x = base.x + Math.sin(player.miningTime) * 0.95;
            player.miningArm.rotation.z = base.z + Math.cos(player.miningTime) * 0.12;
        } else {
            player.miningTime = 0;
            const base = player.miningArmBase || new THREE.Euler();
            player.miningArm.rotation.x = THREE.MathUtils.lerp(player.miningArm.rotation.x, base.x, 0.25);
            player.miningArm.rotation.z = THREE.MathUtils.lerp(player.miningArm.rotation.z, base.z, 0.25);
        }
    }

    function damage(amount) {
        if (GAME.invulnerable || GAME.playerMode === "free" || GAME.playerMode === "observer") return;

        // Hình nhân thế mạng cùng thế giới hấp thụ toàn bộ sát thương;
        // không có giới hạn khoảng cách.
        if (typeof DECOY_SYSTEM !== "undefined") {
            const decoy = DECOY_SYSTEM.getForPlayer(player.position);
            if (decoy) {
                DECOY_SYSTEM.damage(decoy, amount);
                if (GAME && typeof GAME.triggerDamageEffect === "function") {
                    GAME.triggerDamageEffect(amount);
                }
                return;
            }
        }

        player.health -= amount;
        if (GAME && typeof GAME.triggerDamageEffect === "function") {
            GAME.triggerDamageEffect(amount);
        }

        if (player.health <= 0) {
            if (GAME.inventory && GAME.inventory.revive_charm > 0) {
                GAME.inventory.revive_charm--;
                player.health = player.maxHealth;
                GAME.invulnerable = true;
                setTimeout(() => GAME.invulnerable = false, 1000);
                return;
            }

            player.health = player.maxHealth;
            const spawn = (WORLD.getSpawnPoint && WORLD.getSpawnPoint()) || {x:120,y:48.5,z:180};
            player.position.set(spawn.x, spawn.y, spawn.z);
            player.velocity.set(0, 0, 0);
        }
    }

    function useOxygenTank() {
        if (!GAME.inventory || GAME.inventory.oxygen_tank <= 0) return;

        GAME.inventory.oxygen_tank--;
        player.oxygen = Math.min(
            player.maxOxygen,
            player.oxygen + player.maxOxygen * 0.30
        );
    }

    return {
        player,
        create,
        update,
        damage,
        useOxygenTank,
        setMiningAnimation,
        updateHeldItem,
        makeHeldModel
    };
})();
