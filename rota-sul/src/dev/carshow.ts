import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeCarMesh, CarKind } from "../car";
import { makeHuman, animateHuman } from "../humans";

// Dev-only turntable used to review car and character models.
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(innerWidth, innerHeight);
r.toneMapping = THREE.ACESFilmicToneMapping;
r.shadowMap.enabled = true;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8cc);
scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xfff0dd, 2.5);
sun.position.set(5, 8, 4);
sun.castShadow = true;
scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x777766, 0.6));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x55575a }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const kinds: CarKind[] = ["sedan", "hatch", "suv", "sport", "taxi", "police"];
kinds.forEach((k, i) => {
  const m = makeCarMesh(k, [0xb3001b, 0x1d3557, 0x2a9d8f, 0xc1121f, 0, 0][i]);
  m.group.position.set((i % 3) * 3.2 - 3.2, 0, Math.floor(i / 3) * -6);
  m.group.rotation.y = 0.6;
  scene.add(m.group);
});
const view = new URLSearchParams(location.search).get("v") ?? "cars";
const cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);
if (view === "people") {
  for (let i = 0; i < 6; i++) {
    const h = makeHuman(i + 3, { female: i % 2 === 1 });
    h.group.position.set(i * 0.9 - 2.2, 0, 4);
    h.group.rotation.y = 0.35;
    animateHuman(h, i * 0.9, i % 3 === 0 ? 0 : 1, 0);
    scene.add(h.group);
  }
  cam.position.set(0, 1.4, 8.6);
  cam.lookAt(0, 0.95, 4);
} else if (view === "front") {
  cam.position.set(2, 1.6, 7);
  cam.lookAt(0, 0.6, 0);
} else {
  cam.position.set(9, 6, 9);
  cam.lookAt(0, 0.4, -3);
}
r.render(scene, cam);
(window as unknown as Record<string, boolean>).__done = true;
