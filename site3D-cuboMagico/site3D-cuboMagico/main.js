import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';

const stage = document.querySelector('#cube-stage');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(6.4, 5.1, 7.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const cubeRoot = new THREE.Group();
cubeRoot.rotation.set(-0.16, 0.48, 0.04);
scene.add(cubeRoot);

scene.add(new THREE.HemisphereLight(0xffffff, 0x29231f, 2.2));
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(4, 7, 5); key.castShadow = true; scene.add(key);
const fill = new THREE.PointLight(0x9ab9ff, 14, 12, 2);
fill.position.set(-5, 1, 3); scene.add(fill);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x75675c, opacity: .17 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -2.12; floor.receiveShadow = true; scene.add(floor);

const size = 1.26, spacing = 1.36, stickerSize = .95, stickerOffset = size / 2 + .012;
const black = new THREE.MeshStandardMaterial({ color: 0x101017, roughness: .24, metalness: .08 });
const colors = { px: 0xf5f4ed, nx: 0x2374eb, py: 0xe62b28, ny: 0xf2c631, pz: 0x16a765, nz: 0xf17a25 };
const stickerMaterials = Object.fromEntries(Object.entries(colors).map(([k, color]) => [k, new THREE.MeshPhysicalMaterial({ color, roughness: .38, metalness: .02, clearcoat: .22, clearcoatRoughness: .25 })]));
const cubies = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const faceData = [
  ['px', new THREE.Vector3(1, 0, 0), [0, Math.PI / 2, 0]], ['nx', new THREE.Vector3(-1, 0, 0), [0, -Math.PI / 2, 0]],
  ['py', new THREE.Vector3(0, 1, 0), [-Math.PI / 2, 0, 0]], ['ny', new THREE.Vector3(0, -1, 0), [Math.PI / 2, 0, 0]],
  ['pz', new THREE.Vector3(0, 0, 1), [0, 0, 0]], ['nz', new THREE.Vector3(0, 0, -1), [0, Math.PI, 0]],
];

function roundedSticker() {
  const shape = new THREE.Shape(); const r = .13, d = stickerSize / 2;
  shape.moveTo(-d + r, -d); shape.lineTo(d - r, -d); shape.quadraticCurveTo(d, -d, d, -d + r);
  shape.lineTo(d, d - r); shape.quadraticCurveTo(d, d, d - r, d); shape.lineTo(-d + r, d);
  shape.quadraticCurveTo(-d, d, -d, d - r); shape.lineTo(-d, -d + r); shape.quadraticCurveTo(-d, -d, -d + r, -d);
  return new THREE.ShapeGeometry(shape);
}
const stickerGeometry = roundedSticker();

for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  const cubie = new THREE.Group(); cubie.position.set(x * spacing, y * spacing, z * spacing); cubie.userData.coord = new THREE.Vector3(x, y, z);
  const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size, 3, 3, 3), black); body.castShadow = body.receiveShadow = true; cubie.add(body);
  for (const [id, normal, rotation] of faceData) {
    if ((normal.x && normal.x !== x) || (normal.y && normal.y !== y) || (normal.z && normal.z !== z)) continue;
    const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials[id]);
    sticker.position.copy(normal).multiplyScalar(stickerOffset); sticker.rotation.set(...rotation); sticker.userData = { cubie, normal: normal.clone() };
    cubie.add(sticker);
  }
  cubeRoot.add(cubie); cubies.push(cubie);
}

function resize() {
  const { width, height } = stage.getBoundingClientRect(); camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize); resize();

let dragging = null, orbit = { azimuth: .48, polar: 1.06 }, cameraDistance = 10.5, moving = false;
const target = new THREE.Vector3();
function updateCamera() {
  camera.position.setFromSphericalCoords(cameraDistance, orbit.polar, orbit.azimuth).add(target); camera.lookAt(target);
}
updateCamera();

function pickSticker(event) {
  const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera); return raycaster.intersectObjects(cubeRoot.children, true).find(hit => hit.object.userData.cubie);
}
function rotateLayer(normal, layer, direction) {
  if (moving) return; moving = true;
  const axisName = Math.abs(normal.x) ? 'x' : Math.abs(normal.y) ? 'y' : 'z';
  const axis = normal.clone().normalize();
  const selected = cubies.filter(c => Math.round(c.userData.coord[axisName]) === layer);
  const turn = new THREE.Group(); cubeRoot.add(turn); selected.forEach(c => turn.attach(c));
  const from = 0, to = direction * Math.PI / 2, start = performance.now(), duration = 240;
  function animateTurn(now) {
    const p = Math.min(1, (now - start) / duration); const eased = 1 - Math.pow(1 - p, 3);
    turn.setRotationFromAxisAngle(axis, THREE.MathUtils.lerp(from, to, eased));
    if (p < 1) requestAnimationFrame(animateTurn);
    else {
      selected.forEach(c => { cubeRoot.attach(c); c.userData.coord.applyAxisAngle(axis, to).round(); c.position.copy(c.userData.coord).multiplyScalar(spacing); });
      cubeRoot.remove(turn); moving = false;
    }
  }
  requestAnimationFrame(animateTurn);
}

stage.addEventListener('pointerdown', event => {
  if (moving) return; stage.setPointerCapture(event.pointerId);
  const hit = pickSticker(event);
  dragging = { x: event.clientX, y: event.clientY, hit, orbit: { ...orbit } };
});
stage.addEventListener('pointermove', event => {
  if (!dragging || moving) return; const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
  if (dragging.hit && Math.hypot(dx, dy) > 16) {
    const { normal, cubie } = dragging.hit.object.userData;
    // The sticker's original normal rotates with its cubie after every move.
    const currentNormal = normal.clone().applyQuaternion(cubie.quaternion).round();
    const normalAxis = Math.abs(currentNormal.x) ? 'x' : Math.abs(currentNormal.y) ? 'y' : 'z';
    const horizontal = Math.abs(dx) > Math.abs(dy);
    // A horizontal or vertical pull chooses one of the two axes lying in the
    // touched face. This exposes every row, column and middle slice.
    const axisByFace = {
      x: horizontal ? 'y' : 'z',
      y: horizontal ? 'z' : 'x',
      z: horizontal ? 'y' : 'x',
    };
    const axisName = axisByFace[normalAxis];
    const layer = Math.round(cubie.userData.coord[axisName]);
    const axis = new THREE.Vector3(axisName === 'x' ? 1 : 0, axisName === 'y' ? 1 : 0, axisName === 'z' ? 1 : 0);
    // Direction follows the dominant pull and is deliberately identical for
    // pointer and touch input, so reversing a drag reverses the slice move.
    const direction = (horizontal ? dx : -dy) > 0 ? 1 : -1;
    rotateLayer(axis, layer, direction); dragging = null; return;
  }
  if (!dragging.hit && Math.hypot(dx, dy) > 2) {
    orbit.azimuth = dragging.orbit.azimuth + dx * .012;
    orbit.polar = THREE.MathUtils.clamp(dragging.orbit.polar - dy * .012, .35, Math.PI - .35);
    updateCamera();
  }
});
stage.addEventListener('pointerup', () => { dragging = null; });
stage.addEventListener('pointercancel', () => { dragging = null; });
stage.addEventListener('wheel', event => { event.preventDefault(); cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * .008, 7.5, 15); updateCamera(); }, { passive: false });

function render() { renderer.render(scene, camera); requestAnimationFrame(render); }
render();
