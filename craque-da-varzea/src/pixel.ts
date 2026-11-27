import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Retro pixel-art look: render at a fraction of the screen resolution, then
// quantise colours with an ordered (Bayer) dither and upscale with nearest-neighbour.

export type Style = "pixel" | "3d";
export function getStyle(): Style {
  try {
    return (localStorage.getItem("craque.style") as Style) || "pixel";
  } catch {
    return "pixel";
  }
}
export function setStyle(s: Style) {
  try {
    localStorage.setItem("craque.style", s);
  } catch {
    /* ignore */
  }
}

const RETRO = {
  uniforms: { tDiffuse: { value: null }, levels: { value: 24 }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float levels; uniform vec2 res; varying vec2 vUv;
    float bayer(vec2 p){
      int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
      int i = x + y * 4;
      float m[16];
      m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0; m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
      m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0; m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
      for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0 - 0.5;
      return 0.0;
    }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // punchier, slightly saturated retro palette
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(vec3(l), c, 1.15);
      c = (c - 0.5) * 1.06 + 0.5;
      vec3 d = c + bayer(vUv * res) * 0.0;
      c = floor(d * levels + 0.5) / levels;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

export function makeView(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, style: Style, quality: "alta" | "baixa") {
  const canvas = renderer.domElement;
  const px = style === "pixel" ? (quality === "alta" ? 2.5 : 3.2) : 1;
  let composer: EffectComposer | null = null;
  let retro: ShaderPass | null = null;
  if (style === "pixel") {
    renderer.setPixelRatio(1);
    canvas.style.imageRendering = "pixelated";
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new OutputPass());
    retro = new ShaderPass(RETRO);
    composer.addPass(retro);
  }
  const resize = () => {
    const w = Math.max(1, Math.floor(innerWidth / px)),
      h = Math.max(1, Math.floor(innerHeight / px));
    if (style === "pixel") {
      renderer.setSize(w, h, false);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      composer!.setSize(w, h);
      retro!.uniforms.res.value.set(w, h);
    } else renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  return {
    render: () => (composer ? composer.render() : renderer.render(scene, camera)),
    resize,
  };
}
