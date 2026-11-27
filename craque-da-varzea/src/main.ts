import * as C from "./career";
import { Save, club, overall, ATTRS, ATTR_LABEL, BOOTS } from "./career";
import * as S from "./story";
import { playMatch, MatchResult, Gesture, Choice } from "./match";
import { walkCity } from "./city";
import { startCutscene, Shot } from "./cutscene";
import { VOICE } from "./voice";
import { getStyle, setStyle, Style } from "./pixel";
import "@fontsource/press-start-2p/latin-400.css";

const $ = (id: string) => document.getElementById(id)!;
const qPref = (() => {
  try {
    return localStorage.getItem("craque.q");
  } catch {
    return null;
  }
})();
let quality: "alta" | "baixa" = qPref ? (qPref as "alta" | "baixa") : /Android|iPhone|iPad/i.test(navigator.userAgent) ? "baixa" : "alta";
let s: Save = C.load() ?? C.newSave();
let style: Style = getStyle();
document.body.classList.toggle("pixel", style === "pixel");
const persist = () => C.save(s);
const money = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const hex = (c: number) => "#" + c.toString(16).padStart(6, "0");

function show(id: string) {
  document.querySelectorAll<HTMLElement>(".screen").forEach((el) => el.classList.toggle("on", el.id === id));
}

// ---------------------------------------------------------------- controls (joystick + buttons + keyboard)
const ctl = { x: 0, y: 0, held: new Set<string>(), pressed: new Set<string>() };
const keys = new Set<string>();
addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).tagName === "INPUT") return;
  keys.add(e.code);
  const map: Record<string, string> = { KeyK: "pass", KeyL: "tackle", KeyC: "call", KeyE: "ask" };
  const n = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
  if (n >= 0) document.querySelectorAll<HTMLButtonElement>("#mChoices .choice")[n]?.dispatchEvent(new PointerEvent("pointerdown"));
  if (map[e.code]) ctl.pressed.add(map[e.code]);
});
addEventListener("keyup", (e) => keys.delete(e.code));
{

  document.querySelectorAll<HTMLElement>("[data-hold],[data-tap]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      b.classList.add("down");
      if (b.dataset.hold) ctl.held.add(b.dataset.hold);
      if (b.dataset.tap) ctl.pressed.add(b.dataset.tap);
    });
    const off = () => {
      b.classList.remove("down");
      if (b.dataset.hold) ctl.held.delete(b.dataset.hold);
    };
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("pointerleave", off);
  });
}
// Floating joystick (left side) and drag-to-shoot gestures (right side), like modern mobile football games.
const gest = { active: false, id: -1, sx: 0, sy: 0, t0: 0, pts: [] as [number, number][], done: null as (Gesture & { tap: boolean; long: boolean }) | null };
function gestureOf(pts: [number, number][], t0: number): Gesture {
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const cx = ex - sx,
    cy = ey - sy;
  const cl = Math.hypot(cx, cy) || 1;
  let curl = 0;
  for (const [x, y] of pts) {
    const perp = (cx * (y - sy) - cy * (x - sx)) / cl; // screen-space signed distance from the chord
    if (Math.abs(perp) > Math.abs(curl)) curl = perp;
  }
  return { dx: cx, dy: -cy, curl: -curl, held: (performance.now() - t0) / 1000, ex, ey };
}
{
  const zone = document.body;
  const stick = $("stick"),
    knob = $("knob");
  let jid: number | null = null,
    jx = 0,
    jy = 0;
  const inPlay = () => $("match").classList.contains("on") || $("city").classList.contains("on");
  zone.addEventListener("pointerdown", (e) => {
    if (!inPlay() || (e.target as HTMLElement).closest("button")) return;
    if (e.clientX < innerWidth * 0.45 && jid === null && !$("match").classList.contains("on")) {
      jid = e.pointerId;
      jx = e.clientX;
      jy = e.clientY;
      stick.style.left = `${jx - 65}px`;
      stick.style.top = `${jy - 65}px`;
      stick.classList.add("float");
    } else if (!gest.active && $("match").classList.contains("on")) {
      gest.active = true;
      gest.id = e.pointerId;
      gest.t0 = performance.now();
      gest.pts = [[e.clientX, e.clientY]];
    }
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId === jid) {
      let dx = e.clientX - jx,
        dy = e.clientY - jy;
      const l = Math.hypot(dx, dy),
        R = 55;
      if (l > R) {
        dx = (dx / l) * R;
        dy = (dy / l) * R;
      }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      ctl.x = dx / R;
      ctl.y = -dy / R;
    } else if (gest.active && e.pointerId === gest.id) gest.pts.push([e.clientX, e.clientY]);
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId === jid) {
      jid = null;
      ctl.x = ctl.y = 0;
      knob.style.transform = "";
      stick.classList.remove("float");
    } else if (gest.active && e.pointerId === gest.id) {
      gest.active = false;
      const g = gestureOf(gest.pts, gest.t0);
      const d = Math.hypot(g.dx, g.dy);
      gest.done = { ...g, tap: d < 16 && g.held < 0.35, long: d < 16 && g.held >= 0.35 };
    }
  };
  zone.addEventListener("pointerup", up);
  zone.addEventListener("pointercancel", up);
}
const kx = () => ctl.x || (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
const ky = () => ctl.y || (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
const take = (k: string) => {
  const v = ctl.pressed.has(k);
  ctl.pressed.delete(k);
  return v;
};

// ---------------------------------------------------------------- dialogue scenes
function fill(t: string) {
  return t.replace(/\{nome\}/g, s.name || "garoto").replace(/\{numero\}/g, String(s.number));
}
// Crowd murmur under the cutscenes (filtered noise, no audio files needed).
let crowdAmb: { stop: () => void } | null = null;
function crowdAmbience(on: boolean) {
  if (!on) {
    crowdAmb?.stop();
    crowdAmb = null;
    return;
  }
  if (crowdAmb) return;
  try {
    const ac = new AudioContext();
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = b * 3.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700;
    f.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.16, ac.currentTime + 1.5);
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
    crowdAmb = { stop: () => { g.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5); setTimeout(() => ac.close(), 700); } };
  } catch {
    /* no audio */
  }
}

// Story dialogue. Lines that name a shot play as a little clip: the 3D pixel scene
// behind the text box, the narration voice, and auto-advance when the line is spoken.
function dialogue(lines: S.Line[], bg = "varzea") {
  return new Promise<void>((resolve) => {
    show("dialog");
    $("dialog").dataset.bg = bg;
    const cine = lines.some((l) => l.shot);
    $("dialog").classList.toggle("cine", cine);
    const me = lines === S.PROLOGUE ? null : { look: s.look, number: s.number };
    const cs = cine ? startCutscene($("dStage"), style, quality, me, bg !== "ceari") : null;
    if (cine) crowdAmbience(true);
    const voice = new Audio();
    let i = 0;
    let auto = 0;
    const render = () => {
      const l = lines[i];
      const who = S.CAST[l.who];
      $("dFace").textContent = who?.face ?? "💬";
      ($("dFace") as HTMLElement).style.background = who?.color ?? "#333";
      $("dWho").innerHTML = `${l.who}<small>${who?.role ?? ""}</small>`;
      $("dText").textContent = fill(l.text);
      $("dText").classList.remove("type");
      void $("dText").offsetWidth;
      $("dText").classList.add("type");
      if (cs && l.shot) cs.setShot(l.shot as Shot);
      clearTimeout(auto);
      voice.pause();
      if (l.voice && VOICE[l.voice]) {
        const at = i;
        voice.src = VOICE[l.voice];
        voice.onended = () => {
          auto = window.setTimeout(() => at === i && next(), 1300);
        };
        voice.play().catch(() => {
          /* autoplay blocked: the player taps Continuar */
        });
      }
    };
    const finish = () => {
      clearTimeout(auto);
      voice.pause();
      voice.src = "";
      cs?.dispose();
      if (cine) crowdAmbience(false);
      $("dialog").classList.remove("cine");
      resolve();
    };
    const next = () => {
      i++;
      if (i >= lines.length) finish();
      else render();
    };
    render();
    $("dNext").onclick = next;
    $("dSkip").onclick = finish;
  });
}

// ---------------------------------------------------------------- generic modal
function modal(title: string, body: HTMLElement | string, buttons: { t: string; cls?: string; fn: () => void | boolean }[] = [{ t: "Fechar", fn: () => {} }]) {
  const m = $("modal");
  $("mTitle").textContent = title;
  const b = $("mBody");
  b.innerHTML = "";
  if (typeof body === "string") b.innerHTML = body;
  else b.appendChild(body);
  const bar = $("mBtns");
  bar.innerHTML = "";
  for (const btn of buttons) {
    const el = document.createElement("button");
    el.className = "btn " + (btn.cls ?? "");
    el.textContent = btn.t;
    el.onclick = () => {
      if (btn.fn() !== false) m.classList.remove("on");
    };
    bar.appendChild(el);
  }
  m.classList.add("on");
}
const closeModal = () => $("modal").classList.remove("on");

// signature pad: resolves once the player has drawn a real autograph
function signaturePad(title: string, sub: string) {
  return new Promise<boolean>((resolve) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p class="muted">${sub}</p><canvas id="pad" width="600" height="260"></canvas>`;
    let ink = 0;
    modal(title, wrap, [
      { t: "Limpar", cls: "alt", fn: () => { const c = $("pad") as HTMLCanvasElement; c.getContext("2d")!.clearRect(0, 0, 600, 260); ink = 0; drawShirt(); return false; } },
      { t: "✍️ Assinar", fn: () => { if (ink < 120) { (document.querySelector("#mBody .muted") as HTMLElement).textContent = "Faça a sua assinatura completa!"; return false; } resolve(true); } },
      { t: "Agora não", cls: "alt", fn: () => resolve(false) },
    ]);
    const c = $("pad") as HTMLCanvasElement;
    const g = c.getContext("2d")!;
    const drawShirt = () => {
      g.fillStyle = "#f8f8f8";
      g.fillRect(0, 0, 600, 260);
      g.fillStyle = hex(club(s.contract.clubId).c1);
      g.globalAlpha = 0.15;
      g.font = "900 160px sans-serif";
      g.textAlign = "center";
      g.fillText(String(s.number), 300, 200);
      g.globalAlpha = 1;
    };
    drawShirt();
    let lastP: [number, number] | null = null;
    const pt = (e: PointerEvent): [number, number] => {
      const r = c.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 600, ((e.clientY - r.top) / r.height) * 260];
    };
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      lastP = pt(e);
    });
    c.addEventListener("pointermove", (e) => {
      if (!lastP) return;
      const p = pt(e);
      g.strokeStyle = "#0b1d51";
      g.lineWidth = 5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(...lastP);
      g.lineTo(...p);
      g.stroke();
      ink += Math.hypot(p[0] - lastP[0], p[1] - lastP[1]);
      lastP = p;
    });
    c.addEventListener("pointerup", () => (lastP = null));
  });
}

// ---------------------------------------------------------------- matches
let picked: string | null = null;
let feedFast = false;
function matchHud() {
  return {
    choices: (opts: Choice[] | null, title = "") => {
      const box = $("mChoices");
      box.innerHTML = "";
      $("mChoiceTitle").textContent = title;
      $("mMoment").classList.toggle("on", !!opts || !!title);
      $("mMoment").classList.toggle("aim", !opts && !!title);
      (opts ?? []).forEach((o, i) => {
        const b = document.createElement("button");
        b.className = "choice";
        b.innerHTML = `<b>${o.icon}</b>${o.label}<small>${i + 1}</small>`;
        b.onpointerdown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          picked = o.id;
        };
        box.appendChild(b);
      });
    },
    ticker: (t: string) => ($("mTicker").textContent = t),
    feed: (on: boolean) => {
      $("mFeed").classList.toggle("on", on);
      $("fClock").textContent = $("mClock").textContent;
      $("fScore").innerHTML = $("mScore").innerHTML;
    },
    feedLine: (m: number, txt: string, goal = false) => {
      const li = document.createElement("li");
      li.className = goal ? "goal" : "";
      li.innerHTML = `<b>${Math.floor(m)}'</b> ${txt}`;
      $("fFeed").prepend(li);
    },
    feedFast: () => feedFast,
    score: $("mScore"),
    clock: $("mClock"),
    power: $("powerFill"),
    banner: (t: string, sub = "") => {
      const b = $("mBanner");
      b.innerHTML = `${t}${sub ? `<small>${sub}</small>` : ""}`;
      b.classList.remove("on");
      void b.offsetWidth;
      b.classList.add("on");
    },
  };
}
const matchControls = {
  moveX: kx,
  moveY: ky,
  sprint: () => ctl.held.has("sprint") || keys.has("ShiftLeft"),
  shootHeld: () => ctl.held.has("shoot") || keys.has("Space"),
  passPressed: () => take("pass"),
  tacklePressed: () => take("tackle"),
  callPressed: () => take("call"),
  choice: () => {
    const c = picked;
    picked = null;
    return c;
  },
  aiming: () => (gest.active && gest.pts.length ? gestureOf(gest.pts, gest.t0) : null),
  released: () => {
    const g = gest.done;
    gest.done = null;
    return g;
  },
};

// Bench: the clock runs and the play-by-play scrolls until the coach calls you on.
function bench(opp: C.Club, mine: C.Club, upTo: number, score: [number, number], story: boolean) {
  return new Promise<void>((resolve) => {
    show("bench");
    $("bScore").innerHTML = `<b>${mine.short}</b> 0 × 0 <b>${opp.short}</b>`;
    const feed = $("bFeed");
    feed.innerHTML = "";
    $("bGo").style.display = "none";
    // goal minutes that produce the score at the moment you come on
    const goals: { m: number; mine: boolean }[] = [];
    for (let i = 0; i < score[0]; i++) goals.push({ m: 5 + Math.random() * (upTo - 8), mine: true });
    for (let i = 0; i < score[1]; i++) goals.push({ m: 5 + Math.random() * (upTo - 8), mine: false });
    const filler = [
      (t: C.Club) => `Escanteio para o ${t.name}.`,
      (t: C.Club) => `Chute de fora da área do ${t.short}… pra fora!`,
      (t: C.Club) => `Grande defesa do goleiro do ${t.short}!`,
      (t: C.Club) => `Cartão amarelo para um jogador do ${t.short}.`,
      (t: C.Club) => `Falta perigosa a favor do ${t.short}.`,
      (t: C.Club) => `Contra-ataque do ${t.short}, mas a zaga corta.`,
      (t: C.Club) => `Bola na trave do ${t.short}!! Uhhh!`,
    ];
    const events: { m: number; txt: string; goal?: boolean; mine?: boolean }[] = goals.map((g) => ({ m: g.m, txt: g.mine ? `⚽ GOL do ${mine.name}!` : `⚽ Gol do ${opp.name}.`, goal: true, mine: g.mine }));
    for (let i = 0; i < Math.round(upTo / 9); i++) {
      const t = Math.random() < 0.5 ? mine : opp;
      events.push({ m: 2 + Math.random() * (upTo - 4), txt: filler[Math.floor(Math.random() * filler.length)](t) });
    }
    if (story) events.push({ m: upTo - 1, txt: "🚑 Tião cai no chão segurando o tornozelo… vai ter que sair!" });
    events.push({ m: upTo, txt: story ? "📣 Seu Nonato: “Ô moleque, aquece aí!”" : `📣 O técnico te chama: “${s.name}, vai pro jogo!”` });
    events.sort((a, b) => a.m - b.m);
    const sc = [0, 0];
    let minute = 0,
      last = performance.now(),
      k = 0,
      raf = 0;
    const speed = upTo / 12; // the bench lasts ~12 seconds
    let fast = false;
    $("bSkip").onclick = () => (fast = true);
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      minute = Math.min(upTo, minute + dt * speed * (fast ? 8 : 1));
      $("bClock").textContent = `${Math.floor(minute)}'`;
      while (k < events.length && events[k].m <= minute) {
        const e = events[k++];
        if (e.goal) sc[e.mine ? 0 : 1]++;
        const li = document.createElement("li");
        li.className = e.goal ? "goal" : "";
        li.innerHTML = `<b>${Math.floor(e.m)}'</b> ${e.txt}`;
        feed.prepend(li);
        $("bScore").innerHTML = `<b>${mine.short}</b> ${sc[0]} × ${sc[1]} <b>${opp.short}</b>`;
      }
      if (minute >= upTo) {
        $("bGo").style.display = "";
        $("bGo").onclick = () => resolve();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    void raf;
  });
}

async function runMatch(opp: C.Club, mine: C.Club, start: number, score: [number, number], realSec: number, stadium: "varzea" | "estadio", banner?: string, story = false): Promise<MatchResult> {
  if (start > 0) await bench(opp, mine, start, score, story);
  show("match");
  feedFast = false;
  $("fFeed").innerHTML = "";
  $("fSkip").classList.remove("on");
  $("fSkip").onclick = () => {
    feedFast = !feedFast;
    $("fSkip").classList.toggle("on", feedFast);
  };
  const home = Math.random() < 0.5 || stadium === "varzea";
  const eff = C.effAttrs(s);
  const tc = (c: C.Club) => ({ name: c.name, short: c.short, c1: c.c1, c2: c.c2, strength: c.strength });
  return playMatch($("stage"), {
    home: home ? tc(mine) : tc(opp),
    away: home ? tc(opp) : tc(mine),
    userHome: home,
    user: { name: s.name, number: s.number, pos: s.pos, attrs: eff, look: s.look, boots: BOOTS[s.bootsOn].color },
    startMinute: start,
    startScore: home ? score : [score[1], score[0]],
    realSeconds: realSec,
    stadium,
    quality,
    style,
    banner,
    moments: 10,
  }, matchHud(), matchControls).then((r) => {
    // normalise the score so index 0 is always "my team"
    if (!home) r.score = [r.score[1], r.score[0]];
    return r;
  });
}

function xpFromMatch(r: MatchResult) {
  const gains: Record<string, number> = {};
  const add = (k: C.Attr, v: number) => {
    const g = C.addXp(s, k, v);
    if (g) gains[k] = (gains[k] ?? 0) + g;
  };
  add("chute", 6 + r.shots * 3 + r.goals * 10);
  add("passe", 6 + r.passes * 2 + r.assists * 8);
  add("drible", 8 + r.rating * 2);
  add("velocidade", 6 + r.minutes / 10);
  add("defesa", 4 + r.tackles * 6);
  add("fisico", 5 + r.minutes / 8);
  return gains;
}

function postMatch(r: MatchResult, title: string, extra = "") {
  return new Promise<void>((resolve) => {
    const gains = xpFromMatch(r);
    const stars = "★".repeat(Math.round(r.rating / 2)) + "☆".repeat(5 - Math.round(r.rating / 2));
    const gainTxt = Object.entries(gains).map(([k, v]) => `<span class="chip">+${v} ${ATTR_LABEL[k as C.Attr]}</span>`).join(" ") || '<span class="muted">Continue treinando para evoluir</span>';
    modal(title, `
      <div class="score big">${r.score[0]} × ${r.score[1]}</div>
      <div class="rating">Nota <b>${r.rating.toFixed(1)}</b> <span class="stars">${stars}</span></div>
      <div class="grid4"><div><b>${r.goals}</b>gols</div><div><b>${r.assists}</b>assist.</div><div><b>${r.passes}</b>passes</div><div><b>${r.tackles}</b>desarmes</div></div>
      <div class="gains">${gainTxt}</div>${extra}`, [{ t: "Continuar", fn: () => resolve() }]);
  });
}

// ---------------------------------------------------------------- story flow
async function prologue() {
  s = C.newSave();
  await dialogue(S.PROLOGUE, "varzea");
  await createPlayer();
  await dialogue(S.PRE_MATCH, "varzea");
  const r = await runMatch(club("ferro"), club("unidos"), 60, [0, 1], 110, "varzea", "Você entra aos 60'!", true);
  s.career.jogos++;
  s.career.gols += r.goals;
  s.career.assist += r.assists;
  s.career.somaNotas += r.rating;
  s.fans += 20 + r.goals * 40;
  await postMatch(r, r.score[0] > r.score[1] ? "Campeões da Várzea!" : "Fim da final");
  await dialogue(r.rating >= 6.8 ? S.SCOUT_GOOD : S.SCOUT_OK, "varzea");
  // first professional contract
  s.contract = { clubId: "ceari", salary: 400, weeksLeft: C.SEASON_WEEKS * 2, role: "reserva" };
  s.coachTrust = 35;
  s.story = 1;
  s.log.unshift("Assinou o primeiro contrato profissional com o Ceari Sporting Clube.");
  C.startSeason(s);
  await new Promise<void>((res) =>
    modal("Contrato assinado! ✍️", `<div class="badge" style="--c1:${hex(club("ceari").c1)};--c2:${hex(club("ceari").c2)}">CEA</div><p><b>Ceari Sporting Clube</b> • Série B Nacional</p><p>Salário: <b>${money(400)}/semana</b> • ${C.SEASON_WEEKS * 2} semanas • Função: reserva</p>`, [{ t: "Bora!", fn: () => res() }])
  );
  await dialogue(S.CEARI_WELCOME, "ceari");
  persist();
  hub();
}

function createPlayer() {
  return new Promise<void>((resolve) => {
    show("create");
    const skins = [0x5c3a21, 0x7a4a2b, 0x8d5524, 0xa0673a, 0xc68642, 0xe0ac69, 0xf1c27d];
    const hairs = [["short", "Curto"], ["buzz", "Raspado"], ["afro", "Black"], ["bald", "Careca"], ["long", "Longo"]];
    const hairCols = [0x120c08, 0x3b2314, 0x6b4423, 0xc8a165, 0xffd23f];
    const row = (id: string, items: string[], cur: number, pick: (i: number) => void) => {
      const el = $(id);
      el.innerHTML = "";
      items.forEach((h, i) => {
        const b = document.createElement("button");
        b.className = "swatch" + (i === cur ? " sel" : "");
        if (h.startsWith("#")) b.style.background = h;
        else b.textContent = h;
        b.onclick = () => {
          pick(i);
          el.querySelectorAll(".swatch").forEach((x, k) => x.classList.toggle("sel", k === i));
        };
        el.appendChild(b);
      });
    };
    row("cSkin", skins.map(hex), 2, (i) => (s.look.skin = skins[i]));
    row("cHair", hairs.map((h) => h[1]), 0, (i) => (s.look.hair = hairs[i][0]));
    row("cHairCol", hairCols.map(hex), 0, (i) => (s.look.hairColor = hairCols[i]));
    row("cPos", ["Atacante", "Meia", "Zagueiro"], 0, (i) => {
      s.pos = (["ATA", "MEI", "ZAG"] as C.Pos[])[i];
      s.attrs = i === 0 ? { chute: 52, passe: 46, velocidade: 58, drible: 55, defesa: 34, fisico: 50 } : i === 1 ? { chute: 46, passe: 56, velocidade: 52, drible: 54, defesa: 42, fisico: 48 } : { chute: 36, passe: 48, velocidade: 50, drible: 40, defesa: 58, fisico: 58 };
    });
    ($("cName") as HTMLInputElement).value = "";
    ($("cName") as HTMLInputElement).focus();
    $("cGo").onclick = () => {
      const n = ($("cName") as HTMLInputElement).value.trim();
      if (n.length < 2) {
        $("cErr").textContent = "Digite o seu nome (ou apelido) para entrar em campo.";
        return;
      }
      s.name = n.slice(0, 16);
      s.number = Math.max(1, Math.min(99, Number(($("cNum") as HTMLInputElement).value) || 9));
      resolve();
    };
  });
}

// ---------------------------------------------------------------- career hub
function fameFromFans() {
  s.fame = Math.min(100, Math.round(Math.max(0, Math.log10(Math.max(1, s.fans)) - 1) * 25));
}

function hub() {
  fameFromFans();
  show("hub");
  const c = club(s.contract.clubId);
  const opp = s.fixtures[s.week - 1] ? club(s.fixtures[s.week - 1]) : null;
  const pos = C.sortedTable(s).findIndex((r) => r.clubId === c.id) + 1;
  $("hName").textContent = s.name;
  $("hSub").textContent = `${s.age} anos • ${s.pos === "ATA" ? "Atacante" : s.pos === "MEI" ? "Meia" : "Zagueiro"} • nº ${s.number}`;
  $("hOvr").textContent = String(overall(s));
  const badge = $("hBadge");
  badge.textContent = c.short;
  badge.style.setProperty("--c1", hex(c.c1));
  badge.style.setProperty("--c2", hex(c.c2));
  $("hClub").innerHTML = `${c.name}${s.contract.loanFrom ? ` <span class="chip">emprestado</span>` : ""}<small>${C.LEAGUE_NAME[c.tier]} • ${pos}º lugar • ${s.contract.role === "titular" ? "Titular" : s.contract.role === "rotacao" ? "Rotação" : "Reserva"}</small>`;
  $("hMoney").textContent = money(s.money);
  $("hFans").textContent = `${s.fans.toLocaleString("pt-BR")} fãs`;
  $("hEnergy").style.width = `${s.energy}%`;
  $("hTrust").style.width = `${s.coachTrust}%`;
  $("hWeek").textContent = `Temporada ${s.season} • Semana ${s.week}/${C.SEASON_WEEKS} • ${s.actions} ações livres`;
  $("hNext").innerHTML = opp ? `Próximo jogo: <b>${c.short}</b> × <b>${opp.short}</b> <small>${opp.name}</small>` : "Fim de temporada";
  $("hLog").innerHTML = s.log.slice(0, 4).map((l) => `<li>${l}</li>`).join("");
  document.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) => {
    const needs = b.dataset.act !== "play" && b.dataset.act !== "table" && b.dataset.act !== "profile" && b.dataset.act !== "agent" && b.dataset.act !== "shop";
    b.disabled = needs && s.actions <= 0;
  });
  ($("aCity") as HTMLButtonElement).classList.toggle("locked", s.story < 4);
  persist();
}

function useAction(energy: number) {
  if (s.actions <= 0) {
    modal("Sem tempo esta semana", "Você já usou as 3 ações da semana. Jogue a próxima partida para avançar.");
    return false;
  }
  if (s.energy < energy) {
    modal("Cansado demais", "Sua energia está baixa. Descanse antes de fazer isso.");
    return false;
  }
  s.actions--;
  s.energy = Math.max(0, s.energy - energy);
  return true;
}

async function playWeek() {
  const c = club(s.contract.clubId);
  const opp = club(s.fixtures[s.week - 1]);
  // coach decides: starter plays 90', otherwise come off the bench
  const role = s.contract.role;
  const starts = role === "titular" || (role === "rotacao" && Math.random() < 0.55) || (role === "reserva" && Math.random() < 0.2);
  const start = starts ? 0 : role === "rotacao" ? 55 : 68;
  const [pg, og] = C.simGame(c, opp);
  const preScore: [number, number] = starts ? [0, 0] : [Math.min(pg, Math.floor(Math.random() * 2)), Math.min(og, Math.floor(Math.random() * 2))];
  const tired = s.energy < 30;
  const r = await runMatch(opp, c, start, preScore, starts ? 210 : 95 + (68 - start) * 1.5, c.tier >= 1 ? "estadio" : "varzea", starts ? (tired ? "Você começa cansado…" : "Você é titular hoje!") : `Você entra aos ${start}'`);
  // career bookkeeping
  s.career.jogos++;
  s.seasonStats.jogos++;
  s.career.gols += r.goals;
  s.seasonStats.gols += r.goals;
  s.career.assist += r.assists;
  s.seasonStats.assist += r.assists;
  s.career.somaNotas += r.rating;
  s.seasonStats.somaNotas += r.rating;
  C.finishRound(s, r.score[0], r.score[1]);
  const fansGain = Math.round((r.rating - 5) * 25 * (1 + c.tier) + r.goals * 60 * (1 + c.tier));
  s.fans = Math.max(0, s.fans + fansGain);
  s.coachTrust = Math.max(0, Math.min(100, s.coachTrust + (r.rating >= 7.5 ? 9 : r.rating >= 6.5 ? 3 : r.rating < 5.5 ? -6 : 0)));
  const prevRole = s.contract.role;
  s.contract.role = s.coachTrust >= 72 ? "titular" : s.coachTrust >= 50 ? "rotacao" : "reserva";
  const wage = s.contract.salary * (1 - (s.agent?.cut ?? 0));
  s.money += wage;
  s.energy = Math.max(10, s.energy - 25);
  s.energy = Math.min(100, s.energy + 35);
  s.actions = 3;
  s.contract.weeksLeft--;
  s.log.unshift(`S${s.season}S${s.week}: ${c.short} ${r.score[0]}×${r.score[1]} ${opp.short} • nota ${r.rating.toFixed(1)}${r.goals ? ` • ${r.goals} gol(s)` : ""}`);
  let extra = `<p class="muted">Salário recebido: ${money(wage)}${s.agent ? ` (já descontado ${Math.round(s.agent.cut * 100)}% do agente)` : ""} • ${fansGain >= 0 ? "+" : ""}${fansGain} fãs</p>`;
  if (s.contract.role !== prevRole) extra += `<p class="chip big">${s.contract.role === "titular" ? "⭐ O professor te promoveu a TITULAR!" : s.contract.role === "rotacao" ? "Você entrou na rotação do time" : "Você perdeu espaço e voltou para o banco"}</p>`;
  await postMatch(r, `${c.short} ${r.score[0]} × ${r.score[1]} ${opp.short}`, extra);
  s.week++;
  await storyEvents(r);
  if (s.week > C.SEASON_WEEKS) await seasonEnd();
  persist();
  hub();
}

async function storyEvents(r: MatchResult) {
  fameFromFans();
  if (s.story === 1 && s.career.jogos >= 2) {
    s.story = 2;
    await interview(true);
  }
  if (s.story === 2 && s.week >= 4 && !s.agent) {
    s.story = 3;
    await dialogue(S.AGENT_INTRO, "ceari");
  }
  if (s.story >= 2 && s.story < 4 && s.fans >= 300) {
    s.story = 4;
    await dialogue(S.FIRST_FANS, "cidade");
  }
  if (!s.nationalTeam && overall(s) >= 74 && s.fame >= 60) {
    s.nationalTeam = true;
    s.trophies.push("Convocado para a Seleção");
    s.fans += 5000;
    modal("🇧🇷 CONVOCADO!", `<p>O técnico da Seleção anunciou a lista… e o seu nome está lá!</p><p><b>${s.name}</b>, da várzea do Jardim Esperança para a Seleção Brasileira.</p>`);
  } else if (r.rating >= 8 && Math.random() < 0.5) {
    await interview(false);
  }
  // clubs notice a player who keeps shining
  if (s.week === 5 && overall(s) >= club(s.contract.clubId).strength + 3) {
    const offers = C.makeOffers(s, false, s.agent?.skill ?? 1);
    if (offers.length) {
      s.offers = offers;
      s.log.unshift("📨 Janela de transferências: chegaram propostas! Veja na aba Agente.");
    }
  }
}

async function seasonEnd() {
  const c = club(s.contract.clubId);
  const tbl = C.sortedTable(s);
  const pos = tbl.findIndex((r) => r.clubId === c.id) + 1;
  const avg = s.seasonStats.jogos ? s.seasonStats.somaNotas / s.seasonStats.jogos : 0;
  const awards: string[] = [];
  if (pos === 1) awards.push(`🏆 Campeão da ${C.LEAGUE_NAME[c.tier]} (${c.name})`);
  if (s.seasonStats.gols >= 7) awards.push(`👟 Artilheiro da ${C.LEAGUE_NAME[c.tier]} (${s.seasonStats.gols} gols)`);
  if (avg >= 7.4 && s.seasonStats.jogos >= 5) awards.push(`🥈 Bola de Prata — melhor jogador da temporada (média ${avg.toFixed(2)})`);
  if (s.age <= 20 && avg >= 7) awards.push("🌟 Revelação do Ano");
  s.trophies.push(...awards.map((a) => `T${s.season}: ${a}`));
  s.fans += awards.length * 1500;
  modal(`Fim da temporada ${s.season}`, `<p>${c.name} terminou em <b>${pos}º lugar</b>.</p><p>Você: ${s.seasonStats.jogos} jogos, ${s.seasonStats.gols} gols, ${s.seasonStats.assist} assistências, média ${avg.toFixed(2)}.</p>${awards.length ? `<ul class="awards">${awards.map((a) => `<li>${a}</li>`).join("")}</ul>` : '<p class="muted">Sem prêmios desta vez. Bora pra próxima!</p>'}`);
  // loan ends, contract checks, a year older
  if (s.contract.loanFrom) {
    const back = s.contract.loanFrom;
    s.log.unshift(`Empréstimo terminou. Voltou para o ${club(back).name}.`);
    s.contract = { clubId: back, salary: s.contract.salary, weeksLeft: C.SEASON_WEEKS, role: "rotacao" };
  } else if (s.contract.weeksLeft <= 0) {
    s.contract.weeksLeft = C.SEASON_WEEKS * 2;
    s.contract.salary = Math.round(s.contract.salary * 1.15);
    s.log.unshift("Contrato renovado automaticamente (+15% de salário).");
  }
  s.age++;
  s.season++;
  s.offers = C.makeOffers(s, false, s.agent?.skill ?? 1);
  if (s.offers.length) s.log.unshift("📨 Propostas de outros clubes chegaram. Abra a aba Agente.");
  C.startSeason(s);
}

// ---------------------------------------------------------------- weekly activities
async function training() {
  const body = document.createElement("div");
  body.innerHTML = `<p class="muted">Escolha o treino. Toque em PARAR quando o marcador estiver na faixa verde: 5 tentativas.</p><div class="train"></div>`;
  const list = body.querySelector(".train")!;
  for (const k of ATTRS) {
    const b = document.createElement("button");
    b.className = "btn alt";
    b.innerHTML = `${ATTR_LABEL[k]} <b>${s.attrs[k]}</b>`;
    b.onclick = () => {
      if (!useAction(15)) return;
      closeModal();
      timingGame(k);
    };
    list.appendChild(b);
  }
  modal("Centro de Treinamento", body, [{ t: "Voltar", cls: "alt", fn: () => {} }]);
}

function timingGame(k: C.Attr) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p>Treino de <b>${ATTR_LABEL[k]}</b></p><div class="tbar"><div class="zone"></div><div class="mark"></div></div><p class="tres">Tentativa 1/5</p>`;
  let tries = 0,
    hits = 0,
    x = 0,
    v = 1.3,
    raf = 0;
  const zone = wrap.querySelector(".zone") as HTMLElement;
  const mark = wrap.querySelector(".mark") as HTMLElement;
  let z0 = 0.4;
  const zw = 0.22 - Math.min(0.12, s.attrs[k] / 900);
  const place = () => {
    z0 = 0.1 + Math.random() * (0.8 - zw);
    zone.style.left = `${z0 * 100}%`;
    zone.style.width = `${zw * 100}%`;
  };
  place();
  let last = performance.now();
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    x += v * dt;
    if (x > 1 || x < 0) {
      v = -v;
      x = Math.max(0, Math.min(1, x));
    }
    mark.style.left = `${x * 100}%`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  modal("Treino", wrap, [
    {
      t: "PARAR!",
      fn: () => {
        tries++;
        const ok = x >= z0 && x <= z0 + zw;
        if (ok) hits++;
        (wrap.querySelector(".tres") as HTMLElement).textContent = `${ok ? "✅ Boa!" : "❌ Errou"} • ${hits}/${tries}`;
        v *= 1.12;
        place();
        if (tries >= 5) {
          cancelAnimationFrame(raf);
          const g = C.addXp(s, k, 10 + hits * 14);
          s.coachTrust = Math.min(100, s.coachTrust + hits);
          setTimeout(() => {
            modal("Treino concluído", `<p>${hits}/5 acertos.</p><p>${g ? `<span class="chip big">+${g} ${ATTR_LABEL[k]}</span>` : "Você ganhou experiência. Continue assim!"}</p><p class="muted">O professor gostou da dedicação.</p>`);
            hub();
          }, 300);
          return false;
        }
        return false;
      },
    },
  ]);
}

async function interview(first: boolean) {
  const q = S.INTERVIEWS[Math.floor(Math.random() * S.INTERVIEWS.length)];
  return new Promise<void>((resolve) => {
    const body = document.createElement("div");
    body.innerHTML = `<div class="reporter">🎤 <b>TV Esporte Total</b>${first ? " — sua primeira entrevista!" : ""}</div><p class="q">“${q.q}”</p>`;
    const opts = document.createElement("div");
    opts.className = "answers";
    q.a.forEach((a) => {
      const b = document.createElement("button");
      b.className = "btn alt";
      b.textContent = a.t;
      b.onclick = () => {
        s.fans += a.fans * (1 + club(s.contract.clubId).tier);
        s.coachTrust = Math.max(0, Math.min(100, s.coachTrust + a.trust));
        s.log.unshift(`🎤 Entrevista: “${a.t}”`);
        closeModal();
        modal("Repercussão", `<p>${a.fans >= 60 ? "📈 Sua fala viralizou nas redes!" : "A entrevista foi bem recebida."}</p><p>+${a.fans * (1 + club(s.contract.clubId).tier)} fãs ${a.trust < 0 ? "• 😠 o professor não gostou" : a.trust > 3 ? "• 👍 o professor aprovou" : ""}</p>`, [{ t: "Ok", fn: () => resolve() }]);
      };
      opts.appendChild(b);
    });
    body.appendChild(opts);
    modal("Entrevista", body, []);
  });
}

async function signShirts() {
  if (!useAction(5)) return;
  let signed = 0;
  for (let i = 0; i < 3; i++) {
    const ok = await signaturePad(`Camisa ${i + 1}/3`, "Assine a camisa para o leilão beneficente do clube.");
    if (!ok) break;
    signed++;
  }
  const gain = signed * (40 + s.fame * 3);
  const cash = signed * (80 + s.fame * 6);
  s.fans += gain;
  s.money += cash;
  s.shirtsSigned += signed;
  if (signed) s.log.unshift(`✍️ Assinou ${signed} camisas para o leilão (+${gain} fãs).`);
  modal("Camisas assinadas", `<p>${signed} camisas autografadas.</p><p>+${gain} fãs • +${money(cash)} (sua parte do leilão)</p>`);
  hub();
}

async function city() {
  if (s.story < 4) {
    modal("Ainda ninguém te conhece", "Quando você ficar mais famoso (300+ fãs), os torcedores vão te reconhecer na rua.");
    return;
  }
  if (!useAction(10)) return;
  show("city");
  let done = false;
  $("cityBack").onclick = () => (done = true);
  $("cityAsk").onclick = () => (walkCity as unknown as { ask: () => void }).ask();
  const res = await walkCity(
    $("cityStage"),
    { look: s.look, shirt: club(s.contract.clubId).c1, fame: s.fame, quality, style },
    { moveX: kx, moveY: ky, prompt: (v) => $("cityAsk").classList.toggle("on", v), done: () => done, status: (t) => ($("cityStatus").textContent = t) },
    async () => {
      const choice = await new Promise<"sign" | "selfie" | "skip">((resolve) => {
        modal("Um torcedor te parou!", `<p>“${["Me dá um autógrafo, craque?!", "Tira uma foto comigo? Minha mãe não vai acreditar!", "Assina minha camisa, por favor!"][Math.floor(Math.random() * 3)]}”</p>`, [
          { t: "✍️ Autógrafo", fn: () => resolve("sign") },
          { t: "📸 Selfie", cls: "alt", fn: () => resolve("selfie") },
          { t: "Agora não", cls: "alt", fn: () => resolve("skip") },
        ]);
      });
      if (choice === "sign") {
        const ok = await signaturePad("Autógrafo", "Assine para o torcedor:");
        return ok ? "sign" : "skip";
      }
      return choice;
    }
  );
  const gain = res.autographs * (25 + s.fame) + res.selfies * (15 + s.fame);
  s.fans += gain;
  s.log.unshift(`🚶 Passeio na cidade: ${res.autographs} autógrafos, ${res.selfies} selfies (+${gain} fãs).`);
  modal("De volta pra casa", `<p>${res.autographs} autógrafos e ${res.selfies} selfies.</p><p>+${gain} fãs</p>`);
  hub();
}

function rest() {
  if (s.actions <= 0) return useAction(0);
  s.actions--;
  s.energy = Math.min(100, s.energy + 45);
  modal("Descanso", "Dia de folga com a família. +45 de energia.");
  hub();
}

function agent() {
  const body = document.createElement("div");
  if (!s.agent) {
    body.innerHTML = `<p class="muted">Sem agente você só recebe propostas no fim da temporada. Um agente busca clubes, empréstimos e aumentos.</p>`;
    for (const a of C.AGENTS) {
      const row = document.createElement("div");
      row.className = "card";
      const ok = s.fame >= a.minFame && (s.story >= 3 || a.name !== "Marcão" ? s.story >= 3 : false);
      row.innerHTML = `<b>${a.name}</b> <span class="chip">${Math.round(a.cut * 100)}% do salário</span><p class="muted">${a.bio}</p>`;
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = ok ? "Contratar" : s.story < 3 ? "Ainda não te procurou" : `Precisa de fama ${a.minFame}`;
      b.disabled = !ok;
      b.onclick = () => {
        s.agent = { name: a.name, cut: a.cut, skill: a.skill };
        s.log.unshift(`🤝 Contratou ${a.name} como agente.`);
        closeModal();
        hub();
        agent();
      };
      row.appendChild(b);
      body.appendChild(row);
    }
  } else {
    body.innerHTML = `<div class="card"><b>${s.agent.name}</b> <span class="chip">${Math.round(s.agent.cut * 100)}%</span><p class="muted">Valor de mercado estimado: <b>${money(C.marketValue(s))}</b> • Contrato: ${money(s.contract.salary)}/sem • ${s.contract.weeksLeft} semanas restantes</p></div>`;
    const acts = document.createElement("div");
    acts.className = "train";
    const mk = (t: string, fn: () => void) => {
      const b = document.createElement("button");
      b.className = "btn alt";
      b.textContent = t;
      b.onclick = fn;
      acts.appendChild(b);
    };
    mk("🔄 Pedir transferência", () => {
      if (!useAction(0)) return;
      s.offers = C.makeOffers(s, false, s.agent!.skill);
      s.coachTrust = Math.max(0, s.coachTrust - 8);
      closeModal();
      agent();
    });
    mk("⏳ Buscar empréstimo", () => {
      if (!useAction(0)) return;
      s.offers = C.makeOffers(s, true, s.agent!.skill);
      closeModal();
      agent();
    });
    mk("💰 Pedir aumento", () => {
      if (!useAction(0)) return;
      const avg = s.seasonStats.jogos ? s.seasonStats.somaNotas / s.seasonStats.jogos : 6;
      const ok = avg >= 6.8 && s.coachTrust >= 45 && Math.random() < 0.4 + s.agent!.skill * 0.1;
      if (ok) {
        const inc = Math.round(s.contract.salary * (0.12 + s.agent!.skill * 0.04));
        s.contract.salary += inc;
        s.contract.weeksLeft += C.SEASON_WEEKS;
        s.log.unshift(`💰 Aumento aprovado: +${money(inc)}/semana.`);
        modal("Aumento aprovado!", `<p>O clube aceitou: +${money(inc)}/semana e contrato estendido.</p>`);
      } else modal("Pedido recusado", "<p>A diretoria disse que precisa ver mais resultado em campo.</p>");
      hub();
    });
    body.appendChild(acts);
  }
  if (s.offers.length) {
    const h = document.createElement("h3");
    h.textContent = "📨 Propostas na mesa";
    body.appendChild(h);
    for (const of of s.offers) {
      const c = club(of.clubId);
      const row = document.createElement("div");
      row.className = "card offer";
      row.innerHTML = `<div class="badge sm" style="--c1:${hex(c.c1)};--c2:${hex(c.c2)}">${c.short}</div><div><b>${c.name}</b><small>${C.LEAGUE_NAME[c.tier]} • ${c.city}</small><p>${of.loan ? "Empréstimo (1 temporada)" : "Transferência"} • ${money(of.salary)}/sem • ${of.role === "titular" ? "Titular" : of.role === "rotacao" ? "Rotação" : "Reserva"}</p></div>`;
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = "Aceitar";
      b.onclick = () => {
        const from = club(s.contract.clubId).name;
        C.signOffer(s, of);
        s.fans += 200 * (1 + c.tier);
        s.log.unshift(`${of.loan ? "⏳ Emprestado" : "✈️ Transferido"} de ${from} para ${c.name}.`);
        closeModal();
        modal(of.loan ? "Empréstimo fechado!" : "Negócio fechado!", `<div class="badge" style="--c1:${hex(c.c1)};--c2:${hex(c.c2)}">${c.short}</div><p>Bem-vindo ao <b>${c.name}</b>!</p><p>${money(of.salary)}/semana • ${C.LEAGUE_NAME[c.tier]}</p>`);
        hub();
      };
      row.appendChild(b);
      body.appendChild(row);
    }
  }
  modal("Agente e carreira", body, [{ t: "Fechar", cls: "alt", fn: () => {} }]);
}

function shop() {
  const body = document.createElement("div");
  for (const [id, b] of Object.entries(BOOTS)) {
    const owned = s.boots.includes(id);
    const row = document.createElement("div");
    row.className = "card offer";
    const bonus = Object.entries(b.bonus).map(([k, v]) => `+${v} ${ATTR_LABEL[k as C.Attr]}`).join(", ") || "sem bônus";
    row.innerHTML = `<div class="boot" style="background:${hex(b.color)}">👟</div><div><b>${b.name}</b><small>${bonus}</small></div>`;
    const btn = document.createElement("button");
    btn.className = "btn" + (owned ? " alt" : "");
    btn.textContent = s.bootsOn === id ? "Calçada" : owned ? "Calçar" : money(b.price);
    btn.onclick = () => {
      if (!owned) {
        if (s.money < b.price) {
          btn.textContent = "Sem dinheiro";
          return;
        }
        s.money -= b.price;
        s.boots.push(id);
      }
      s.bootsOn = id;
      closeModal();
      shop();
      hub();
    };
    row.appendChild(btn);
    body.appendChild(row);
  }
  modal("Loja de chuteiras", body, [{ t: "Fechar", cls: "alt", fn: () => {} }]);
}

function table() {
  const rows = C.sortedTable(s)
    .map((r, i) => `<tr class="${r.clubId === s.contract.clubId ? "me" : ""}"><td>${i + 1}</td><td>${club(r.clubId).name}</td><td>${r.p}</td><td>${r.j}</td><td>${r.v}</td><td>${r.gp - r.gc}</td></tr>`)
    .join("");
  modal(C.LEAGUE_NAME[club(s.contract.clubId).tier], `<div class="tablewrap"><table><tr><th>#</th><th>Clube</th><th>P</th><th>J</th><th>V</th><th>SG</th></tr>${rows}</table></div>`);
}

function profile() {
  const eff = C.effAttrs(s);
  const bars = ATTRS.map((k) => `<div class="attr"><span>${ATTR_LABEL[k]}</span><div class="bar"><i style="width:${eff[k]}%"></i></div><b>${eff[k]}</b></div>`).join("");
  const avg = s.career.jogos ? (s.career.somaNotas / s.career.jogos).toFixed(2) : "-";
  modal(`${s.name} • ${overall(s)}`, `${bars}<p class="muted">Carreira: ${s.career.jogos} jogos • ${s.career.gols} gols • ${s.career.assist} assistências • média ${avg}</p><p class="muted">Camisas assinadas: ${s.shirtsSigned} • Fama ${s.fame}/100 • Valor ${money(C.marketValue(s))}</p><h3>Troféus</h3>${s.trophies.length ? `<ul class="awards">${s.trophies.map((t) => `<li>${t}</li>`).join("")}</ul>` : '<p class="muted">Ainda nenhum. A história está só começando.</p>'}`);
}

// ---------------------------------------------------------------- wiring
document.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) =>
  b.addEventListener("click", () => {
    const a = b.dataset.act;
    if (a === "play") playWeek();
    if (a === "train") training();
    if (a === "interview") {
      if (useAction(5)) interview(false).then(hub);
    }
    if (a === "shirts") signShirts();
    if (a === "city") city();
    if (a === "rest") rest();
    if (a === "agent") agent();
    if (a === "shop") shop();
    if (a === "table") table();
    if (a === "profile") profile();
  })
);
$("tNew").addEventListener("click", () => prologue());
$("tCont").addEventListener("click", () => (s.story > 0 ? hub() : prologue()));
($("tCont") as HTMLButtonElement).style.display = C.load()?.story ? "" : "none";
$("tQ").textContent = `Gráficos: ${quality.toUpperCase()}`;
$("tQ").addEventListener("click", () => {
  quality = quality === "alta" ? "baixa" : "alta";
  try {
    localStorage.setItem("craque.q", quality);
  } catch {
    /* ignore */
  }
  $("tQ").textContent = `Gráficos: ${quality.toUpperCase()}`;
});
$("hMenu").addEventListener("click", () => show("title"));
type Orient = "auto" | "vertical" | "horizontal";
let orient: Orient = (() => {
  try {
    return (localStorage.getItem("craque.orient") as Orient) || "auto";
  } catch {
    return "auto";
  }
})();
const ORIENT_LABEL: Record<Orient, string> = { auto: "AUTOMÁTICA", vertical: "VERTICAL", horizontal: "HORIZONTAL" };
function applyOrientation() {
  $("tOrient").textContent = `Tela: ${ORIENT_LABEL[orient]}`;
  const bridge = (window as unknown as { Android?: { setOrientation: (o: string) => void } }).Android;
  if (bridge) bridge.setOrientation(orient);
  else if (orient !== "auto") {
    const so = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
    document.documentElement.requestFullscreen?.().then(() => so.lock?.(orient === "vertical" ? "portrait" : "landscape")).catch(() => {});
  }
}
$("tOrient").addEventListener("click", () => {
  orient = orient === "auto" ? "vertical" : orient === "vertical" ? "horizontal" : "auto";
  try {
    localStorage.setItem("craque.orient", orient);
  } catch {
    /* ignore */
  }
  applyOrientation();
});
applyOrientation();
$("tStyle").textContent = `Estilo: ${style === "pixel" ? "PIXEL" : "3D"}`;
$("tStyle").addEventListener("click", () => {
  style = style === "pixel" ? "3d" : "pixel";
  setStyle(style);
  document.body.classList.toggle("pixel", style === "pixel");
  $("tStyle").textContent = `Estilo: ${style === "pixel" ? "PIXEL" : "3D"}`;
});
show("title");
(window as unknown as Record<string, unknown>).__craque = { get s() { return s; }, hub, prologue, dialogue, S };
