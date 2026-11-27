// Career data model: player, clubs, leagues, contracts, agent, transfers. All clubs are fictional.

export type Pos = "ATA" | "MEI" | "ZAG";
export const ATTRS = ["chute", "passe", "velocidade", "drible", "defesa", "fisico"] as const;
export type Attr = (typeof ATTRS)[number];
export const ATTR_LABEL: Record<Attr, string> = { chute: "Chute", passe: "Passe", velocidade: "Velocidade", drible: "Drible", defesa: "Defesa", fisico: "Físico" };

export interface Club {
  id: string;
  name: string;
  short: string;
  tier: number; // 0 várzea, 1 Série B, 2 Série A, 3 Europa
  strength: number; // 40..90
  c1: number;
  c2: number;
  city: string;
}

export const CLUBS: Club[] = [
  { id: "unidos", name: "Unidos da Vila", short: "UNI", tier: 0, strength: 38, c1: 0x1e4fa3, c2: 0xffffff, city: "Jardim Esperança" },
  { id: "ferro", name: "Ferroviário do Morro", short: "FER", tier: 0, strength: 42, c1: 0xd62828, c2: 0x111111, city: "Morro Alto" },
  // Série B
  { id: "ceari", name: "Ceari Sporting Clube", short: "CEA", tier: 1, strength: 58, c1: 0x111111, c2: 0xffffff, city: "Fortaleza do Sol" },
  { id: "tubaroes", name: "Tubarões do Norte", short: "TUB", tier: 1, strength: 60, c1: 0x0077b6, c2: 0xffffff, city: "Porto Norte" },
  { id: "sertanejo", name: "Atlético Sertanejo", short: "SER", tier: 1, strength: 55, c1: 0xb5651d, c2: 0xffffff, city: "Sertãozinho" },
  { id: "cerrado", name: "Grêmio Cerrado", short: "GCE", tier: 1, strength: 57, c1: 0x2a9d8f, c2: 0xffd23f, city: "Planaltina" },
  { id: "portuarios", name: "Portuários FC", short: "POR", tier: 1, strength: 59, c1: 0x1d3557, c2: 0xe63946, city: "Cais Velho" },
  { id: "serrana", name: "Vila Serrana", short: "VSE", tier: 1, strength: 54, c1: 0x6a994e, c2: 0xffffff, city: "Serra Azul" },
  { id: "mangue", name: "Mangue FC", short: "MAN", tier: 1, strength: 56, c1: 0x9d4edd, c2: 0xffd23f, city: "Recanto" },
  { id: "operario", name: "Operário do Sul", short: "OPE", tier: 1, strength: 61, c1: 0x222222, c2: 0xf77f00, city: "Vale Industrial" },
  { id: "planalto", name: "Real Planalto", short: "RPL", tier: 1, strength: 58, c1: 0xffffff, c2: 0x6a040f, city: "Altiplano" },
  { id: "caicara", name: "União Caiçara", short: "UCA", tier: 1, strength: 53, c1: 0x00b4d8, c2: 0xffd23f, city: "Ilha Grande do Sul" },
  // Série A
  { id: "capital", name: "Capital FC", short: "CAP", tier: 2, strength: 74, c1: 0x003049, c2: 0xffffff, city: "Capital" },
  { id: "litoral", name: "Litoral Atlético", short: "LIT", tier: 2, strength: 71, c1: 0xe63946, c2: 0xffffff, city: "Baía Dourada" },
  { id: "serragaucha", name: "Serra Gaúcha EC", short: "SGA", tier: 2, strength: 70, c1: 0x1e4fa3, c2: 0x111111, city: "Campos da Serra" },
  { id: "imperial", name: "Imperial Carioca", short: "IMP", tier: 2, strength: 77, c1: 0x111111, c2: 0xd62828, city: "Cidade Imperial" },
  { id: "bandeirantes", name: "Bandeirantes FC", short: "BAN", tier: 2, strength: 76, c1: 0xffffff, c2: 0x111111, city: "Nova Paulista" },
  { id: "pantanal", name: "Pantanal FC", short: "PAN", tier: 2, strength: 66, c1: 0x6a994e, c2: 0xffd23f, city: "Campo Alagado" },
  { id: "amazonia", name: "Amazônia SC", short: "AMZ", tier: 2, strength: 65, c1: 0x2d6a4f, c2: 0xffffff, city: "Rio Verde" },
  { id: "sertaoreal", name: "Sertão Real", short: "STR", tier: 2, strength: 68, c1: 0xf4a261, c2: 0x264653, city: "Cariri" },
  { id: "minasgerais", name: "Montanhês EC", short: "MON", tier: 2, strength: 73, c1: 0x5c677d, c2: 0xffffff, city: "Ouro Alto" },
  { id: "litoralnorte", name: "Esporte Praiano", short: "PRA", tier: 2, strength: 67, c1: 0xffd23f, c2: 0x0077b6, city: "Costa Norte" },
  // Europa
  { id: "lusitania", name: "Lusitânia CF", short: "LUS", tier: 3, strength: 82, c1: 0x2a9d8f, c2: 0xffffff, city: "Lisboa" },
  { id: "iberia", name: "Real Ibéria", short: "IBE", tier: 3, strength: 88, c1: 0xffffff, c2: 0x6a4c93, city: "Madri" },
  { id: "crown", name: "Crown Athletic", short: "CRO", tier: 3, strength: 86, c1: 0xd62828, c2: 0xffffff, city: "Londres" },
  { id: "rheinland", name: "Rheinland 04", short: "RHE", tier: 3, strength: 83, c1: 0x111111, c2: 0xffd23f, city: "Dortmund" },
  { id: "riviera", name: "Olympique Riviera", short: "RIV", tier: 3, strength: 81, c1: 0x0077b6, c2: 0xd62828, city: "Marselha" },
  { id: "milanello", name: "Calcio Milanello", short: "MIL", tier: 3, strength: 85, c1: 0x0b3d91, c2: 0x111111, city: "Milão" },
  { id: "amsterdam", name: "Amstel United", short: "AMS", tier: 3, strength: 80, c1: 0xffffff, c2: 0xd62828, city: "Amsterdã" },
  { id: "bosforo", name: "Bósforo SK", short: "BOS", tier: 3, strength: 78, c1: 0xffd23f, c2: 0x0b3d91, city: "Istambul" },
  { id: "parisis", name: "Paris Lumière", short: "PAR", tier: 3, strength: 87, c1: 0x0b3d91, c2: 0xd62828, city: "Paris" },
  { id: "celtic", name: "Highland Celtic", short: "HIG", tier: 3, strength: 76, c1: 0x2d6a4f, c2: 0xffffff, city: "Glasgow" },
];
export const LEAGUE_NAME = ["Várzea", "Série B Nacional", "Série A Nacional", "Liga Europeia"];
export const club = (id: string) => CLUBS.find((c) => c.id === id)!;

export interface Contract {
  clubId: string;
  salary: number; // R$ per week
  weeksLeft: number;
  role: "reserva" | "rotacao" | "titular";
  loanFrom?: string;
}

export interface Agent {
  name: string;
  cut: number;
  skill: number;
}
export const AGENTS: (Agent & { minFame: number; bio: string })[] = [
  { name: "Marcão", cut: 0.1, skill: 2, minFame: 0, bio: "Conhece todo mundo do futebol do Nordeste. Fala alto e fecha negócio." },
  { name: "Dra. Helena Prado", cut: 0.15, skill: 4, minFame: 40, bio: "Advogada esportiva, leva jogadores para a Série A e Europa." },
  { name: "Giorgio Bellini", cut: 0.2, skill: 5, minFame: 70, bio: "Agente internacional com contatos nos maiores clubes da Europa." },
];

export interface Offer {
  clubId: string;
  salary: number;
  weeks: number;
  loan: boolean;
  role: Contract["role"];
}

export interface Row {
  clubId: string;
  p: number;
  j: number;
  v: number;
  e: number;
  d: number;
  gp: number;
  gc: number;
}

export interface Save {
  name: string;
  number: number;
  pos: Pos;
  look: { skin: number; hair: string; hairColor: number };
  attrs: Record<Attr, number>;
  xp: Record<Attr, number>;
  age: number;
  money: number;
  fans: number;
  fame: number; // 0..100
  coachTrust: number; // 0..100
  energy: number; // 0..100
  actions: number; // free actions this week
  week: number;
  season: number;
  contract: Contract;
  agent: Agent | null;
  offers: Offer[];
  boots: string[];
  bootsOn: string;
  career: { jogos: number; gols: number; assist: number; somaNotas: number };
  seasonStats: { jogos: number; gols: number; assist: number; somaNotas: number };
  table: Row[];
  fixtures: string[]; // opponent ids for this season
  trophies: string[];
  story: number;
  shirtsSigned: number;
  log: string[];
  nationalTeam: boolean;
}

export const SEASON_WEEKS = 9;

export function newSave(): Save {
  return {
    name: "",
    number: 9,
    pos: "ATA",
    look: { skin: 0x8d5524, hair: "short", hairColor: 0x120c08 },
    attrs: { chute: 52, passe: 48, velocidade: 58, drible: 55, defesa: 35, fisico: 50 },
    xp: { chute: 0, passe: 0, velocidade: 0, drible: 0, defesa: 0, fisico: 0 },
    age: 17,
    money: 150,
    fans: 12,
    fame: 0,
    coachTrust: 40,
    energy: 100,
    actions: 3,
    week: 1,
    season: 1,
    contract: { clubId: "unidos", salary: 0, weeksLeft: 0, role: "reserva" },
    agent: null,
    offers: [],
    boots: ["basica"],
    bootsOn: "basica",
    career: { jogos: 0, gols: 0, assist: 0, somaNotas: 0 },
    seasonStats: { jogos: 0, gols: 0, assist: 0, somaNotas: 0 },
    table: [],
    fixtures: [],
    trophies: [],
    story: 0,
    shirtsSigned: 0,
    log: [],
    nationalTeam: false,
  };
}

export function overall(s: Save) {
  const a = s.attrs;
  const w: Record<Pos, Record<Attr, number>> = {
    ATA: { chute: 0.3, passe: 0.1, velocidade: 0.2, drible: 0.25, defesa: 0.02, fisico: 0.13 },
    MEI: { chute: 0.15, passe: 0.3, velocidade: 0.15, drible: 0.22, defesa: 0.08, fisico: 0.1 },
    ZAG: { chute: 0.03, passe: 0.15, velocidade: 0.15, drible: 0.05, defesa: 0.4, fisico: 0.22 },
  };
  let o = 0;
  for (const k of ATTRS) o += a[k] * w[s.pos][k];
  return Math.round(o);
}

export const BOOTS: Record<string, { name: string; price: number; bonus: Partial<Record<Attr, number>>; color: number }> = {
  basica: { name: "Chuteira de Várzea", price: 0, bonus: {}, color: 0x222222 },
  raio: { name: "Raio Veloz", price: 1800, bonus: { velocidade: 3 }, color: 0xffd23f },
  canhao: { name: "Canhão Pro", price: 2500, bonus: { chute: 3 }, color: 0xd62828 },
  maestro: { name: "Maestro", price: 2500, bonus: { passe: 3, drible: 1 }, color: 0x2ec4b6 },
  muralha: { name: "Muralha", price: 2200, bonus: { defesa: 3, fisico: 1 }, color: 0x6a4c93 },
  lenda: { name: "Lenda Dourada", price: 12000, bonus: { chute: 2, passe: 2, velocidade: 2, drible: 2 }, color: 0xe9c46a },
};

export function effAttrs(s: Save) {
  const b = BOOTS[s.bootsOn]?.bonus ?? {};
  const out = { ...s.attrs };
  for (const k of ATTRS) out[k] = Math.min(99, out[k] + (b[k] ?? 0));
  return out;
}

export function addXp(s: Save, k: Attr, amount: number) {
  s.xp[k] += amount;
  // higher attributes need more xp per point
  let gained = 0;
  while (s.attrs[k] < 99) {
    const need = 20 + s.attrs[k] * 0.8;
    if (s.xp[k] < need) break;
    s.xp[k] -= need;
    s.attrs[k]++;
    gained++;
  }
  return gained;
}

// ---------------------------------------------------------------- season

export function leagueClubs(tier: number) {
  return CLUBS.filter((c) => c.tier === tier);
}

export function startSeason(s: Save) {
  const c = club(s.contract.clubId);
  const clubs = leagueClubs(c.tier);
  s.table = clubs.map((x) => ({ clubId: x.id, p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }));
  s.fixtures = clubs.filter((x) => x.id !== c.id).map((x) => x.id).sort(() => Math.random() - 0.5);
  s.week = 1;
  s.seasonStats = { jogos: 0, gols: 0, assist: 0, somaNotas: 0 };
}

function record(s: Save, home: string, away: string, gh: number, ga: number) {
  const h = s.table.find((r) => r.clubId === home),
    a = s.table.find((r) => r.clubId === away);
  if (!h || !a) return;
  h.j++;
  a.j++;
  h.gp += gh;
  h.gc += ga;
  a.gp += ga;
  a.gc += gh;
  if (gh > ga) {
    h.v++;
    h.p += 3;
    a.d++;
  } else if (gh < ga) {
    a.v++;
    a.p += 3;
    h.d++;
  } else {
    h.e++;
    a.e++;
    h.p++;
    a.p++;
  }
}

function poisson(l: number) {
  let k = 0,
    p = 1;
  const L = Math.exp(-l);
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

export function simGame(a: Club, b: Club): [number, number] {
  const d = (a.strength - b.strength) / 20;
  return [poisson(Math.max(0.3, 1.35 + d * 0.6)), poisson(Math.max(0.3, 1.15 - d * 0.6))];
}

// Record the player's match and simulate the rest of the round.
export function finishRound(s: Save, myGoals: number, oppGoals: number) {
  const me = s.contract.clubId,
    opp = s.fixtures[s.week - 1];
  record(s, me, opp, myGoals, oppGoals);
  const others = s.table.map((r) => r.clubId).filter((id) => id !== me && id !== opp).sort(() => Math.random() - 0.5);
  for (let i = 0; i + 1 < others.length; i += 2) {
    const [x, y] = simGame(club(others[i]), club(others[i + 1]));
    record(s, others[i], others[i + 1], x, y);
  }
}

export function sortedTable(s: Save) {
  return [...s.table].sort((a, b) => b.p - a.p || b.gp - b.gc - (a.gp - a.gc) || b.gp - a.gp);
}

// ---------------------------------------------------------------- transfers

export function marketValue(s: Save) {
  const o = overall(s);
  return Math.round(Math.pow(Math.max(1, o - 40), 2.2) * 120 * (1 + s.fame / 100) * (s.age < 23 ? 1.3 : 1));
}

export function makeOffers(s: Save, wantLoan: boolean, quality: number) {
  const o = overall(s);
  const cur = club(s.contract.clubId);
  const pool = CLUBS.filter((c) => c.tier > 0 && c.id !== cur.id && c.id !== s.contract.loanFrom);
  // clubs whose level is close to the player's (agent skill lets you reach higher)
  const reach = o + quality * 3 + s.fame / 10;
  const fits = pool.filter((c) => c.strength <= reach + 4 && c.strength >= (wantLoan ? reach - 25 : reach - 18));
  const picks = fits.sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(quality / 2));
  return picks.map((c) => {
    const gap = reach - c.strength;
    const role: Contract["role"] = gap > 6 ? "titular" : gap > -2 ? "rotacao" : "reserva";
    const base = Math.round((c.strength * c.strength * (c.tier === 3 ? 9 : c.tier === 2 ? 4 : 1.6)) / 100) * 10;
    return { clubId: c.id, salary: Math.round(base * (1 + quality * 0.06) * (wantLoan ? 0.8 : 1)), weeks: wantLoan ? SEASON_WEEKS : SEASON_WEEKS * (2 + Math.floor(Math.random() * 2)), loan: wantLoan, role } as Offer;
  });
}

export function signOffer(s: Save, of: Offer) {
  const prev = s.contract;
  s.contract = {
    clubId: of.clubId,
    salary: of.salary,
    weeksLeft: of.weeks,
    role: of.role,
    loanFrom: of.loan ? prev.loanFrom ?? prev.clubId : undefined,
  };
  s.coachTrust = of.role === "titular" ? 60 : of.role === "rotacao" ? 45 : 30;
  s.offers = [];
  startSeason(s);
}

export function save(s: Save) {
  try {
    localStorage.setItem("craque.save", JSON.stringify(s));
  } catch {
    /* private mode */
  }
}
export function load(): Save | null {
  try {
    const v = localStorage.getItem("craque.save");
    return v ? (JSON.parse(v) as Save) : null;
  } catch {
    return null;
  }
}
