import { getFloorTexture, getWallTexture, getTableTexture, getCharacterTexture } from './textures.js';

export class Engine3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#000000'); // Fondo negro (vacío)
        
        // Cámara perspectiva con ángulo fijo (Estilo Pokemon 3D)
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // antialias false para look pixel art
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        this.players = {}; // Guardar los sprites de los jugadores
        this.localPlayerId = null;
        
        this.setupLighting();
        
        this.clock = new THREE.Clock();
        this.keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
        
        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        this.isBlackout = false;
        
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }
    
    setupLighting() {
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(this.ambientLight);
        
        // Luz direccional para sombras
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        this.dirLight.position.set(10, 20, 10);
        this.dirLight.castShadow = true;
        this.scene.add(this.dirLight);
    }
    
    buildMap(mapGrid) {
        const tileSize = 2;
        const wallHeight = 2;
        
        const floorTex = getFloorTexture();
        floorTex.wrapS = THREE.RepeatWrapping;
        floorTex.wrapT = THREE.RepeatWrapping;
        
        const wallTex = getWallTexture();
        const tableTex = getTableTexture();
        
        // Crear suelo base
        const width = mapGrid[0].length * tileSize;
        const height = mapGrid.length * tileSize;
        
        floorTex.repeat.set(width/2, height/2);
        const floorGeo = new THREE.PlaneGeometry(width, height);
        const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(width/2 - tileSize/2, 0, height/2 - tileSize/2);
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        const wallGeo = new THREE.BoxGeometry(tileSize, wallHeight, tileSize);
        const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
        
        const tableGeo = new THREE.BoxGeometry(tileSize * 1.5, 1, tileSize);
        const tableMat = new THREE.MeshLambertMaterial({ map: tableTex });
        
        this.colliders = [];
        
        for (let z = 0; z < mapGrid.length; z++) {
            for (let x = 0; x < mapGrid[z].length; x++) {
                const cell = mapGrid[z][x];
                const px = x * tileSize;
                const pz = z * tileSize;
                
                if (cell === 1) {
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(px, wallHeight/2, pz);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    this.scene.add(wall);
                    this.colliders.push(new THREE.Box3().setFromObject(wall));
                } else if (cell === 2) { // Mesa / Tarea
                    const table = new THREE.Mesh(tableGeo, tableMat);
                    table.position.set(px, 0.5, pz);
                    table.castShadow = true;
                    table.receiveShadow = true;
                    this.scene.add(table);
                    this.colliders.push(new THREE.Box3().setFromObject(table));
                }
            }
        }
    }
    
    addPlayer(id, x, z, gender, maskIndex, isLocal = false) {
        const tex = getCharacterTexture(gender, maskIndex);
        const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff });
        const sprite = new THREE.Sprite(mat);
        
        sprite.position.set(x, 0.8, z); // Altura del sprite
        sprite.scale.set(1.5, 1.5, 1);
        
        this.scene.add(sprite);
        
        // Añadir luz propia para el blackout
        const pLight = new THREE.PointLight(0xffaa55, 0, 5);
        pLight.position.set(0, 1, 0);
        sprite.add(pLight);
        
        this.players[id] = {
            mesh: sprite,
            light: pLight,
            isLocal: isLocal
        };
        
        if (isLocal) {
            this.localPlayerId = id;
        }
    }
    
    removePlayer(id) {
        if (this.players[id]) {
            this.scene.remove(this.players[id].mesh);
            delete this.players[id];
        }
    }
    
    updatePlayerPosition(id, x, z) {
        if (this.players[id] && id !== this.localPlayerId) {
            // Animación suave podría ir aquí, por ahora teletransporte directo o lerp
            this.players[id].targetPos = new THREE.Vector3(x, this.players[id].mesh.position.y, z);
        }
    }
    
    setBlackout(isBlackout, isKiller) {
        this.isBlackout = isBlackout;
        if (isBlackout) {
            this.ambientLight.intensity = 0.05; // Muy oscuro
            this.dirLight.intensity = 0;
            
            // Encender luces locales
            for (let id in this.players) {
                const p = this.players[id];
                if (p.isLocal) {
                    p.light.intensity = 1;
                    p.light.distance = isKiller ? 12 : 4; // Asesino ve más
                } else {
                    p.light.intensity = 0; // No ver las luces de otros
                }
            }
        } else {
            this.ambientLight.intensity = 0.8;
            this.dirLight.intensity = 0.5;
            for (let id in this.players) {
                this.players[id].light.intensity = 0;
            }
        }
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    checkCollision(newPos) {
        // Player collider hitbox
        const playerBox = new THREE.Box3(
            new THREE.Vector3(newPos.x - 0.4, 0, newPos.z - 0.4),
            new THREE.Vector3(newPos.x + 0.4, 2, newPos.z + 0.4)
        );
        
        for (let box of this.colliders) {
            if (playerBox.intersectsBox(box)) {
                return true;
            }
        }
        return false;
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        
        const dt = this.clock.getDelta();
        
        // Update local player
        if (this.localPlayerId && this.players[this.localPlayerId]) {
            const player = this.players[this.localPlayerId];
            const speed = 4;
            const dir = new THREE.Vector3();
            
            if (this.keys.w || this.keys.arrowup) dir.z -= 1;
            if (this.keys.s || this.keys.arrowdown) dir.z += 1;
            if (this.keys.a || this.keys.arrowleft) dir.x -= 1;
            if (this.keys.d || this.keys.arrowright) dir.x += 1;
            
            if (dir.lengthSq() > 0) {
                dir.normalize();
                
                const nextX = player.mesh.position.x + dir.x * speed * dt;
                const nextZ = player.mesh.position.z + dir.z * speed * dt;
                
                // Colisiones eje X
                if (!this.checkCollision(new THREE.Vector3(nextX, player.mesh.position.y, player.mesh.position.z))) {
                    player.mesh.position.x = nextX;
                }
                // Colisiones eje Z
                if (!this.checkCollision(new THREE.Vector3(player.mesh.position.x, player.mesh.position.y, nextZ))) {
                    player.mesh.position.z = nextZ;
                }
            }
            
            // Actualizar cámara (estilo Pokemon)
            // La cámara sigue al jugador pero con offset fijo y ángulo
            this.camera.position.set(
                player.mesh.position.x,
                player.mesh.position.y + 8,
                player.mesh.position.z + 10
            );
            this.camera.lookAt(player.mesh.position.x, player.mesh.position.y, player.mesh.position.z);
        }
        
        // Interpolar otros jugadores
        for (let id in this.players) {
            if (id !== this.localPlayerId && this.players[id].targetPos) {
                this.players[id].mesh.position.lerp(this.players[id].targetPos, 0.2);
            }
        }
        
        this.renderer.render(this.scene, this.camera);
    }
}
