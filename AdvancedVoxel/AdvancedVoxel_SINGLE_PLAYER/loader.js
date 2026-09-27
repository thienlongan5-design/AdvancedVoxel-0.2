const ModelLoader = (() => {

    const loader = new THREE.GLTFLoader();
    const cache = {};

    function load(path, onSuccess, onError) {

        if (cache[path]) {
            onSuccess(cache[path].scene.clone(true), cache[path].animations || []);
            return;
        }

        loader.load(
            path,

            gltf => {

                // Chuẩn hóa asset 3D khi tải: texture dùng sRGB, mesh có shadow
                // và frustum culling để model nhìn ổn định nhưng vẫn nhẹ trên mobile.
                gltf.scene.traverse(child => {
                    if (!child.isMesh) return;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.frustumCulled = true;
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(material => {
                        if (!material) return;
                        if (material.map && THREE.sRGBEncoding !== undefined) {
                            material.map.encoding = THREE.sRGBEncoding;
                            material.map.needsUpdate = true;
                        }
                        material.needsUpdate = true;
                    });
                });

                cache[path] = {
                    scene: gltf.scene,
                    animations: gltf.animations || []
                };

                const object = gltf.scene.clone(true);
                object.userData.sourceModel = path;
                object.userData.animationCount = (gltf.animations || []).length;

                onSuccess(object, gltf.animations || []);
            },

            undefined,

            error => {

                console.warn("Không tải được model:", path, "Kiểm tra file asset và đường dẫn trong Spck Preview.");

                if (onError) {
                    onError(error);
                }
            }
        );
    }

    function fallbackCube(material = null) {

        const geometry = new THREE.BoxGeometry(1, 1, 1);

        const mat = material ||
            new THREE.MeshStandardMaterial({
                color: 0x777777
            });

        return new THREE.Mesh(geometry, mat);
    }

    return {
        load,
        fallbackCube
    };

})();