export const kickSphere = {
    mesh: null,
    init(scene, THREE) {
        this.mesh = new THREE.Mesh(
            new THREE.IcosahedronGeometry(1.5, 1),
            new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true })
        );
        scene.add(this.mesh);
    },
    update(data) {
        const s = 1 + (data.lowFreq * 2);
        this.mesh.scale.set(s, s, s);
    }
};