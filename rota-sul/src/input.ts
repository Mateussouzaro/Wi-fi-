// Unified input: keyboard on desktop, virtual joystick + buttons on touch screens.

export interface InputState {
  moveX: number; // -1 left … +1 right
  moveY: number; // -1 back … +1 forward
  sprint: boolean;
  fire: boolean;
  handbrake: boolean;
  horn: boolean;
  camDX: number;
  camDY: number;
  pressed: Set<string>; // one-shot actions consumed by the game: "enter", "jump", "map"
}

export function createInput(root: HTMLElement) {
  const st: InputState = { moveX: 0, moveY: 0, sprint: false, fire: false, handbrake: false, horn: false, camDX: 0, camDY: 0, pressed: new Set() };
  const keys = new Set<string>();

  addEventListener("keydown", (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "KeyE" || e.code === "KeyF") st.pressed.add("enter");
    if (e.code === "KeyM") st.pressed.add("map");
    if (e.code === "KeyR") st.pressed.add("radio");
    if (e.code === "KeyQ" || e.code === "Tab") {
      e.preventDefault();
      st.pressed.add("wheel");
    }
    const n = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].indexOf(e.code);
    if (n >= 0) st.pressed.add("slot" + n);
  });
  addEventListener("keyup", (e) => keys.delete(e.code));

  // mouse look (drag) on desktop
  let mouseDown = false;
  let mouseFire = false;
  root.addEventListener("mousedown", (e) => {
    mouseDown = true;
    if (e.button === 0) mouseFire = true;
  });
  addEventListener("mouseup", () => (mouseDown = mouseFire = false));
  addEventListener("mousemove", (e) => {
    if (mouseDown) {
      st.camDX += e.movementX * 0.005;
      st.camDY += e.movementY * 0.004;
    }
  });

  // ---------------------------------------------------------------- touch UI
  const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const ui = document.createElement("div");
  ui.id = "touch";
  if (touch) root.appendChild(ui);
  ui.innerHTML = `
    <div id="stick"><div id="knob"></div></div>
    <div class="btns">
      <button data-a="enter" class="b big">🚗<span>Carro</span></button>
      <button data-h="handbrake" class="b">🛑<span>Freio</span></button>
      <button data-h="sprint" class="b">🏃<span>Correr</span></button>
      <button data-h="horn" class="b">📢<span>Buzina</span></button>
      <button data-a="radio" class="b">📻<span>Rádio</span></button>
      <button data-a="wheel" class="b">🎯<span>Armas</span></button>
      <button data-h="fire" class="b fire">🔫<span>Atirar</span></button>
    </div>`;
  const stick = ui.querySelector("#stick") as HTMLElement;
  const knob = ui.querySelector("#knob") as HTMLElement;
  let stickId: number | null = null;
  let sx = 0,
    sy = 0;
  let lookId: number | null = null;
  let lx = 0,
    ly = 0;
  const R = 55;

  root.addEventListener(
    "touchstart",
    (e) => {
      for (const t of Array.from(e.changedTouches)) {
        const el = t.target as HTMLElement;
        if (el.closest(".b")) continue;
        if (t.clientX < innerWidth * 0.45 && stickId === null) {
          stickId = t.identifier;
          sx = t.clientX;
          sy = t.clientY;
          stick.style.left = `${sx - 70}px`;
          stick.style.top = `${sy - 70}px`;
          stick.classList.add("on");
        } else if (lookId === null) {
          lookId = t.identifier;
          lx = t.clientX;
          ly = t.clientY;
        }
      }
    },
    { passive: true }
  );
  root.addEventListener(
    "touchmove",
    (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stickId) {
          let dx = t.clientX - sx,
            dy = t.clientY - sy;
          const l = Math.hypot(dx, dy);
          if (l > R) {
            dx = (dx / l) * R;
            dy = (dy / l) * R;
          }
          knob.style.transform = `translate(${dx}px, ${dy}px)`;
          st.moveX = dx / R;
          st.moveY = -dy / R;
        } else if (t.identifier === lookId) {
          st.camDX += (t.clientX - lx) * 0.008;
          st.camDY += (t.clientY - ly) * 0.006;
          lx = t.clientX;
          ly = t.clientY;
        }
      }
    },
    { passive: true }
  );
  const end = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickId) {
        stickId = null;
        st.moveX = st.moveY = 0;
        knob.style.transform = "";
        stick.classList.remove("on");
      }
      if (t.identifier === lookId) lookId = null;
    }
  };
  root.addEventListener("touchend", end);
  root.addEventListener("touchcancel", end);

  const held = new Set<string>();
  ui.querySelectorAll<HTMLButtonElement>(".b").forEach((b) => {
    const a = b.dataset.a,
      h = b.dataset.h;
    b.addEventListener("touchstart", (e) => {
      e.preventDefault();
      b.classList.add("down");
      if (a) st.pressed.add(a);
      if (h) held.add(h);
    });
    const up = (e: Event) => {
      e.preventDefault();
      b.classList.remove("down");
      if (h) held.delete(h);
    };
    b.addEventListener("touchend", up);
    b.addEventListener("touchcancel", up);
  });

  return {
    state: st,
    touch,
    setCarMode(car: boolean) {
      ui.classList.toggle("car", car);
    },
    poll() {
      if (!touch || stickId === null) {
        const k = (c: string) => keys.has(c);
        st.moveX = (k("KeyD") || k("ArrowRight") ? 1 : 0) - (k("KeyA") || k("ArrowLeft") ? 1 : 0);
        st.moveY = (k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 1 : 0);
      }
      st.sprint = keys.has("ShiftLeft") || keys.has("ShiftRight") || held.has("sprint");
      st.handbrake = keys.has("Space") || held.has("handbrake");
      st.horn = keys.has("KeyH") || held.has("horn");
      st.fire = keys.has("KeyJ") || held.has("fire") || (mouseFire && !touch);
    },
  };
}
