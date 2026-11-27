// Story beats and the pools for interviews and random events.

export interface Line {
  who: string;
  text: string;
  face?: string; // emoji portrait
  color?: string;
  shot?: string; // cutscene camera shot for this line
  voice?: string; // narration clip id (src/voice.ts)
}

export const CAST: Record<string, { face: string; color: string; role: string }> = {
  "Seu Nonato": { face: "🧢", color: "#1e4fa3", role: "Técnico do Unidos da Vila" },
  Tião: { face: "🤕", color: "#e76f51", role: "Centroavante do Unidos" },
  Narrador: { face: "📻", color: "#6c757d", role: "Rádio Comunitária Esperança" },
  "Wagner Lima": { face: "🕶️", color: "#111111", role: "Olheiro do Ceari Sporting Clube" },
  "Mãe": { face: "👩🏾", color: "#d4a5a5", role: "Sua mãe" },
  "Prof. Ademir": { face: "📋", color: "#2a9d8f", role: "Técnico do Ceari" },
  Marcão: { face: "😎", color: "#f4a261", role: "Empresário" },
  "Repórter": { face: "🎤", color: "#6a4c93", role: "TV Esporte Total" },
  "Torcedor": { face: "📣", color: "#e63946", role: "Torcida" },
};

export const PROLOGUE: Line[] = [
  { voice: "pro0", shot: "wide", who: "Narrador", text: "Domingo de sol no Campinho do Jardim Esperança. É a final da Copa da Várzea: Unidos da Vila contra o Ferroviário do Morro!" },
  { voice: "pro1", shot: "bench", who: "Narrador", text: "O Ferroviário abriu o placar no primeiro tempo. O Unidos precisa reagir… e você está lá, sentado no banco de madeira, esperando uma chance." },
  { voice: "pro2", shot: "coach", who: "Seu Nonato", text: "Calma, moleque. Teu dia vai chegar. Fica atento que o jogo tá pegado." },
  { voice: "pro3", shot: "injury", who: "Narrador", text: "Aos 59 minutos, Tião sobe para cabecear e cai mal… o centroavante está no chão!" },
  { voice: "pro4", shot: "tiao", who: "Tião", text: "Aaai! Não dá, professor… o tornozelo virou." },
  { voice: "pro5", shot: "callup", who: "Seu Nonato", text: "Ô moleque! Aquece aí que você vai entrar! Como é teu nome mesmo?" },
];

export const PRE_MATCH: Line[] = [
  { voice: "pre0", shot: "sub", who: "Seu Nonato", text: "{nome}, é contigo agora. Faltam 30 minutos e a gente tá perdendo de 1 a 0. Joga solto, faz o que você sabe!" },
  { voice: "pre1", shot: "enter", who: "Narrador", text: "Entra em campo o camisa {numero}… quem é esse garoto? A torcida da Vila quer saber!" },
];

export const SCOUT_GOOD: Line[] = [
  { voice: "sg0", shot: "final", who: "Narrador", text: "Fim de jogo no Jardim Esperança! E que estreia do garoto {nome}!" },
  { voice: "sg1", shot: "scout", who: "Wagner Lima", text: "Ei, garoto! Posso falar contigo um minuto? Meu nome é Wagner Lima, sou olheiro do Ceari Sporting Clube." },
  { voice: "sg2", shot: "scout2", who: "Wagner Lima", text: "Vinte anos rodando várzea e eu nunca vi um moleque entrar no segundo tempo e mudar um jogo desse jeito." },
  { voice: "sg3", shot: "scout3", who: "Wagner Lima", text: "O Ceari tá montando o time pra Série B. Quero você lá na peneira segunda-feira. Se for bem, assina contrato." },
  { voice: "sg4", shot: "mae", who: "Mãe", text: "Filho… é o Ceari! Vai, meu filho. Eu sempre soube." },
  { voice: "sg5", shot: "sunset", who: "Narrador", text: "Na segunda-feira, você brilhou na peneira. O Ceari ofereceu o seu primeiro contrato profissional!" },
];
export const SCOUT_OK: Line[] = [
  { voice: "so0", shot: "final", who: "Narrador", text: "Fim de jogo. O resultado não veio, mas alguém na beira do campo prestou atenção em {nome}." },
  { voice: "so1", shot: "scout", who: "Wagner Lima", text: "Garoto, sou Wagner Lima, olheiro do Ceari. O placar não ajudou, mas eu vi coisa boa em você." },
  { voice: "so2", shot: "scout2", who: "Wagner Lima", text: "Tem talento cru aí. O Ceari tá precisando de molecada com fome. Aparece na peneira segunda." },
  { voice: "so3", shot: "mae", who: "Mãe", text: "Vai, filho. Uma chance dessa não aparece duas vezes." },
  { voice: "so4", shot: "sunset", who: "Narrador", text: "Na peneira, você deu tudo e convenceu a comissão técnica. O Ceari ofereceu o seu primeiro contrato!" },
];

export const CEARI_WELCOME: Line[] = [
  { voice: "ce0", shot: "ceari", who: "Prof. Ademir", text: "Seja bem-vindo ao Ceari, {nome}. Aqui ninguém tem lugar garantido. Você começa no banco e vai ter que ganhar a vaga no treino." },
  { voice: "ce1", shot: "ceari2", who: "Prof. Ademir", text: "Treina, descansa e quando eu te chamar, entra e resolve. Entendido?" },
];

export const AGENT_INTRO: Line[] = [
  { who: "Marcão", text: "Fala, craque! Marcão, empresário. Tô de olho em você desde a várzea, tá ligado?" },
  { who: "Marcão", text: "Comigo do teu lado, as propostas aparecem: Série A, empréstimo pra ganhar minuto, aumento de salário… Fico com 10%." },
  { who: "Marcão", text: "Pensa aí e me chama na aba Agente quando quiser fechar." },
];

export const FIRST_FANS: Line[] = [
  { who: "Torcedor", text: "Ô {nome}! Você é o cara do Ceari, né?! Meu filho tem teu pôster no quarto!" },
  { who: "Narrador", text: "Sua fama está crescendo. Agora os torcedores te reconhecem na rua: vá passear na cidade e dê autógrafos!" },
];

export interface Question {
  q: string;
  a: { t: string; fame: number; trust: number; fans: number }[];
}
export const INTERVIEWS: Question[] = [
  { q: "Você marcou e foi o destaque. Já pode ser chamado de craque?", a: [
    { t: "Ainda tenho muito pra aprender. O mérito é do grupo.", fame: 1, trust: 5, fans: 30 },
    { t: "Eu sei do meu potencial. Vim pra fazer história.", fame: 3, trust: 0, fans: 60 },
    { t: "Craque? Os outros que corram atrás de mim.", fame: 5, trust: -6, fans: 90 },
  ] },
  { q: "Os torcedores pedem você como titular. O professor está errado?", a: [
    { t: "O professor sabe o que faz. Vou continuar trabalhando.", fame: 0, trust: 8, fans: 15 },
    { t: "Eu me sinto pronto, mas respeito a decisão.", fame: 2, trust: 2, fans: 35 },
    { t: "Se eu jogar, o time ganha. Simples assim.", fame: 4, trust: -10, fans: 70 },
  ] },
  { q: "Tem clube grande de olho em você. Pensa em sair?", a: [
    { t: "Meu foco é aqui. Tenho contrato e gratidão.", fame: 1, trust: 6, fans: 40 },
    { t: "Todo jogador sonha alto. Meu empresário cuida disso.", fame: 2, trust: 0, fans: 30 },
    { t: "Quero jogar na Europa o quanto antes.", fame: 4, trust: -5, fans: 50 },
  ] },
  { q: "Qual recado você manda pra torcida depois da derrota?", a: [
    { t: "Desculpa, galera. Semana que vem a gente dá a resposta.", fame: 1, trust: 4, fans: 40 },
    { t: "Faltou atitude de todo mundo, inclusive minha.", fame: 1, trust: 2, fans: 25 },
    { t: "Comigo em campo isso não acontece de novo.", fame: 3, trust: -4, fans: 45 },
  ] },
  { q: "De onde vem esse futebol? Da várzea?", a: [
    { t: "Do Campinho do Jardim Esperança! Valeu, Seu Nonato!", fame: 2, trust: 2, fans: 80 },
    { t: "Da rua, do sol quente e de muito treino.", fame: 2, trust: 2, fans: 50 },
    { t: "Talento a gente nasce com ele.", fame: 3, trust: -1, fans: 40 },
  ] },
];
