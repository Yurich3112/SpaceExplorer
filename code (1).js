import * as THREE from 'three';
// OrbitControls are great for debugging, PointerLockControls for FPS-style flight
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls;
let spaceship;
let terrainMesh;
const moveState = { forward: 0, right: 0, up: 0 }; // -1, 0, or 1
const moveSpeed = 20.0;
const lookSpeed = 0.002;

const clock = new THREE.Clock();

// --- Initialization ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x408080); // Tealish background base
    scene.fog = new THREE.Fog(0x408080, 50, 250); // Fog matching background start

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 15); // Initial position slightly elevated

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xaaaaee, 0.8); // Bluish ambient
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffee, 1.5); // Warm directional light
    directionalLight.position.set(100, 150, 100);
    directionalLight.castShadow = true;
    // Configure shadow properties for better performance/quality
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;

    scene.add(directionalLight);
    scene.add(directionalLight.target); // Needed if you move the light target

    // --- Create Scene Elements ---
    createTerrain();
    createTrees(80);
    createRocks(150);
    createFloatingRocks(20);
    createMountains();
    createSkyRing();
    createSpaceship();

    // --- Controls ---
    // Option 1: OrbitControls (for debugging view)
    // controls = new OrbitControls(camera, renderer.domElement);
    // controls.target.set(0, 2, 0);
    // controls.update();

    // Option 2: PointerLockControls (for FPS flight)
    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject()); // Add camera holder to scene

    // Pointer lock activation
    document.body.addEventListener('click', () => {
        controls.lock();
    });

    controls.addEventListener('lock', () => {
        document.getElementById('info').style.display = 'none';
    });

    controls.addEventListener('unlock', () => {
        document.getElementById('info').style.display = 'block';
    });

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Start animation loop
    animate();
}

// --- Geometry Creation Functions ---

function createTerrain() {
    const terrainSize = 500;
    const segments = 100;
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    geometry.rotateX(-Math.PI / 2); // Lay flat

    const positions = geometry.attributes.position;
    const colors = [];
    const terrainColor = new THREE.Color(0xccaa66); // Ochre/Yellow base
    const riverColor = new THREE.Color(0x339999); // Teal river
    const greenPatchColor = new THREE.Color(0x55aa55); // Green patches

    const riverWidth = 15;
    const riverDepth = 1.5;
    const hillHeight = 8;
    const greenPatchThreshold = 0.6; // How much noise is needed for green

    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);

        // Basic random height variation (replace with noise for better results)
        let y = (Math.random() - 0.5) * hillHeight;

        // Simulate a winding river near z = 0
        const riverInfluence = Math.max(0, 1 - Math.abs(x + Math.sin(z * 0.05) * 30) / riverWidth);
        y -= riverInfluence * riverDepth; // Make river lower

        positions.setY(i, y);

        // Color based on position/height
        let vertexColor = terrainColor.clone();
        if (riverInfluence > 0.1) {
            vertexColor.lerp(riverColor, riverInfluence * 1.5); // Blend towards river color
        } else {
            // Add green patches randomly based on "noise" (simple random here)
             if (Math.random() < greenPatchThreshold * (Math.random() * 0.5 + 0.5)) {
                 vertexColor.lerp(greenPatchColor, Math.random() * 0.4 + 0.1); // Blend slightly green
             }
        }

        colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); // Recalculate normals after displacement

    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true, // Key for low-poly look
        roughness: 0.9,
        metalness: 0.1,
    });

    terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true; // Allow terrain to receive shadows
    scene.add(terrainMesh);
}

function getTerrainHeight(x, z) {
    // Simple raycasting down to find terrain height - can be slow!
    // A faster method involves querying the geometry directly if it's static
    const raycaster = new THREE.Raycaster(
        new THREE.Vector3(x, 50, z), // Start high above
        new THREE.Vector3(0, -1, 0) // Cast downwards
    );
    const intersects = raycaster.intersectObject(terrainMesh);
    if (intersects.length > 0) {
        return intersects[0].point.y;
    }
    return 0; // Default height if terrain not found
}

function createTree() {
    const trunkHeight = Math.random() * 2 + 2; // Random height between 2 and 4
    const canopyRadius = Math.random() * 1.5 + 1; // Random radius

    const tree = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, trunkHeight, 6); // Hexagonal trunk
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x5a3a2a, // Brownish
        flatShading: true,
        roughness: 1.0
    });
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.position.y = trunkHeight / 2;
    trunkMesh.castShadow = true;
    tree.add(trunkMesh);

    // Canopy (using Icosahedron for faceted look)
    const canopyGeo = new THREE.IcosahedronGeometry(canopyRadius, 0); // Detail level 0 for sharp edges
    const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x44aa44, // Green
        flatShading: true,
        roughness: 0.8
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.y = trunkHeight + canopyRadius * 0.7; // Position above trunk
    canopyMesh.scale.set(1, Math.random() * 0.5 + 0.8, 1); // Slightly squash/stretch
    canopyMesh.rotation.y = Math.random() * Math.PI * 2;
    canopyMesh.castShadow = true;
    tree.add(canopyMesh);

    return tree;
}

function createTrees(count) {
    for (let i = 0; i < count; i++) {
        const tree = createTree();
        const x = (Math.random() - 0.5) * 450; // Spread across terrain width
        const z = (Math.random() - 0.5) * 450; // Spread across terrain depth

        // Avoid placing trees directly in the "river" center
        if (Math.abs(x + Math.sin(z * 0.05) * 30) < 8) continue;

        const y = getTerrainHeight(x, z);

        if (y > -0.5) { // Don't place trees too deep in the river
            tree.position.set(x, y, z);
            tree.rotation.y = Math.random() * Math.PI * 2; // Random rotation
            scene.add(tree);
        }
    }
}

function createRock() {
    const size = Math.random() * 0.8 + 0.3;
    const detail = 0; // Low poly
    const rockGeo = new THREE.IcosahedronGeometry(size, detail);
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x778877, // Grey-green
        flatShading: true,
        roughness: 1.0
    });
    const rockMesh = new THREE.Mesh(rockGeo, rockMat);
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    return rockMesh;
}

function createRocks(count) {
     for (let i = 0; i < count; i++) {
        const rock = createRock();
        const x = (Math.random() - 0.5) * 480;
        const z = (Math.random() - 0.5) * 480;
        const y = getTerrainHeight(x, z);

        if (y > -1) { // Avoid placing too deep
             rock.position.set(x, y + rock.geometry.parameters.radius * 0.5, z); // Sit on ground
             rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
             scene.add(rock);
        }
    }
}

function createFloatingRocks(count) {
    for (let i = 0; i < count; i++) {
        const rock = createRock();
        rock.material.color.setHex(0xaaaaaa); // Lighter color for sky rocks
        const x = (Math.random() - 0.5) * 400;
        const z = (Math.random() - 0.5) * 400;
        const y = Math.random() * 50 + 40; // Higher up

        rock.position.set(x, y, z);
        rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        scene.add(rock);
    }
}

function createMountains() {
    const mountainMat = new THREE.MeshStandardMaterial({
        color: 0xaa8866, // Brownish mountain color
        flatShading: true,
        roughness: 0.95
    });

    const numMountains = 15;
    for (let i = 0; i < numMountains; i++) {
        const height = Math.random() * 80 + 40; // 40 to 120 units high
        const radius = Math.random() * 30 + 20; // 20 to 50 units wide
        const mountainGeo = new THREE.ConeGeometry(radius, height, Math.floor(Math.random() * 3) + 4, 1); // 4-6 sides, 1 height segment

        const mountain = new THREE.Mesh(mountainGeo, mountainMat);

        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 100 + 150; // Place further away (150-250 units)

        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = getTerrainHeight(x, z) + height / 2 - 5; // Base slightly below peak height

        mountain.position.set(x, y, z);
        mountain.rotation.y = Math.random() * Math.PI * 2;
        mountain.castShadow = true;
        mountain.receiveShadow = true;
        scene.add(mountain);
    }
}

function createSkyRing() {
    const ringGeo = new THREE.TorusGeometry(180, 8, 6, 40); // Radius, tubeRadius, radialSegments, tubularSegments
    const ringMat = new THREE.MeshBasicMaterial({ // Basic material - not affected by light
        color: 0xffffee,
        opacity: 0.4,
        transparent: true,
        side: THREE.DoubleSide
     });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3; // Tilt the ring
    ringMesh.rotation.y = Math.PI / 6;
    ringMesh.position.y = 30; // Elevate slightly
    scene.add(ringMesh);

     // Add some purple haze/clouds in the upper sky
    const topColor = new THREE.Color(0x604080); // Purpleish
    const bottomColor = new THREE.Color(0x408080); // Tealish (matches fog/background base)
    const skyGeo = new THREE.SphereGeometry(500, 16, 8); // Large sphere
    const skyMat = new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: topColor },
            bottomColor: { value: bottomColor },
            offset: { value: 50 }, // How high the gradient starts
            exponent: { value: 0.8 } // Gradient steepness
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 bottomColor;
            uniform float offset;
            uniform float exponent;
            varying vec3 vWorldPosition;
            void main() {
                float h = normalize( vWorldPosition + offset ).y;
                gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
            }
        `,
        side: THREE.BackSide // Render inside of the sphere
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);
}

function createSpaceship() {
    spaceship = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, flatShading: true, roughness: 0.6 });
    const cockpitMat = new THREE.MeshStandardMaterial({ color: 0x444466, flatShading: true, roughness: 0.1, metalness: 0.2 });
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x666666, flatShading: true, roughness: 0.8 });

    // Main Body (elongated box)
    const bodyGeo = new THREE.BoxGeometry(2, 0.8, 4);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    spaceship.add(bodyMesh);

    // Cockpit (slightly forward)
    const cockpitGeo = new THREE.BoxGeometry(1.2, 0.6, 1.5); // Tapered slightly? Could use BufferGeometry
    const cockpitMesh = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpitMesh.position.set(0, 0.5, -0.5);
    cockpitMesh.castShadow = true;
    spaceship.add(cockpitMesh);

    // Wings (flattened boxes)
    const wingGeo = new THREE.BoxGeometry(5, 0.2, 2);
    const leftWing = new THREE.Mesh(wingGeo, bodyMat);
    leftWing.position.set(-2.5, 0, -0.5);
    leftWing.rotation.z = Math.PI / 16; // Slight upward angle
    leftWing.castShadow = true;
    spaceship.add(leftWing);

    const rightWing = leftWing.clone();
    rightWing.position.x = 2.5;
    rightWing.rotation.z = -Math.PI / 16;
    spaceship.add(rightWing);

    // Engines (cylinders at the back)
    const engineGeo = new THREE.CylinderGeometry(0.4, 0.5, 1, 8);
    const leftEngine = new THREE.Mesh(engineGeo, engineMat);
    leftEngine.position.set(-0.7, 0, 2.2);
    leftEngine.rotation.x = Math.PI / 2; // Point backwards
    leftEngine.castShadow = true;
    spaceship.add(leftEngine);

    const rightEngine = leftEngine.clone();
    rightEngine.position.x = 0.7;
    spaceship.add(rightEngine);


    // Position the whole ship
    spaceship.position.set(0, 5, 0); // Start above origin
    spaceship.add(camera); // Attach camera to the spaceship group
    camera.position.set(0, 2, 6); // Position camera behind and slightly above ship center
    camera.lookAt(spaceship.position); // Initial lookAt

    scene.add(spaceship); // Add ship AFTER adding camera to it if camera is child
}

// --- Event Handlers ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
    switch (event.code) {
        case 'KeyW': moveState.forward = 1; break;
        case 'KeyS': moveState.forward = -1; break;
        case 'KeyA': moveState.right = -1; break;
        case 'KeyD': moveState.right = 1; break;
        // Optional: Add up/down or roll if desired
        // case 'KeyQ': moveState.up = -1; break;
        // case 'KeyE': moveState.up = 1; break;
    }
}

function onKeyUp(event) {
     switch (event.code) {
        case 'KeyW': case 'KeyS': moveState.forward = 0; break;
        case 'KeyA': case 'KeyD': moveState.right = 0; break;
        // case 'KeyQ': case 'KeyE': moveState.up = 0; break;
    }
}


// --- Animation Loop ---

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    // Update spaceship movement based on controls
    if (controls && controls.isLocked === true && spaceship) {
        const moveDistance = moveSpeed * delta;

        // Get camera direction (which is the ship's forward direction)
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // Keep movement horizontal for now
        cameraDirection.normalize();

        const rightDirection = new THREE.Vector3();
        rightDirection.crossVectors(camera.up, cameraDirection).normalize(); // Get right vector


        if (moveState.forward !== 0) {
             spaceship.position.addScaledVector(cameraDirection, moveState.forward * moveDistance);
        }
        if (moveState.right !== 0) {
            spaceship.position.addScaledVector(rightDirection, moveState.right * moveDistance);
        }
        // Optional up/down movement
         if (moveState.up !== 0) {
             spaceship.position.y += moveState.up * moveDistance * 0.5; // Slower vertical
         }

        // Keep ship roughly above terrain
        const targetY = getTerrainHeight(spaceship.position.x, spaceship.position.z) + 3; // Target 3 units above ground
        spaceship.position.y += (targetY - spaceship.position.y) * 0.05; // Smoothly move towards target height

        // Update spaceship rotation to match camera (controlled by PointerLockControls)
        // We attached the camera to the spaceship group, but the PointerLockControls
        // rotate the camera directly. We need the ship group to ignore the camera's pitch
        // but match its yaw.
        const cameraQuaternion = camera.quaternion.clone();
         // Extract yaw (rotation around Y) - more complex methods exist, this is approximate
        const cameraEuler = new THREE.Euler().setFromQuaternion(cameraQuaternion, 'YXZ');
        spaceship.rotation.y = cameraEuler.y;


    } else if (spaceship && controls && typeof controls.update === 'function') {
         // Update OrbitControls if used
         controls.update();
    }

    // Render the scene
    renderer.render(scene, camera);
}

// --- Start ---
init();