// Guardião das Lendas — script. Each line has a speaker, subtitle and voice clip id.
export interface Line {
  who: string;
  text: string;
  voice: string;
}
export const CAST: Record<string, { color: string; role: string; face: string }> = {
  Narrador: { color: "#e9c46a", role: "", face: "📜" },
  "Kauã": { color: "#8ecae6", role: "guardião", face: "🗡️" },
  "Vovó": { color: "#f4a261", role: "Vovó Benedita", face: "👵🏾" },
  Saci: { color: "#e63946", role: "encantado travesso", face: "🌪️" },
  Curupira: { color: "#ff7b00", role: "guardião da mata", face: "🔥" },
  Iara: { color: "#48cae4", role: "mãe d'água", face: "🧜🏽‍♀️" },
  "Boitatá": { color: "#ff9e00", role: "cobra de fogo", face: "🐍" },
  Coronel: { color: "#adb5bd", role: "Coronel Ferrabrás", face: "🎩" },
};
const L = (voice: string, who: string, text: string): Line => ({ voice, who, text });
export const INTRO = [
  L("n1", "Narrador", "No coração do Brasil existe a Ilha das Lendas, onde os encantados protegem a mata, os rios e o fogo."),
  L("n2", "Narrador", "Cada encantado guarda um muiraquitã, um amuleto de pedra verde que mantém a natureza viva."),
  L("n3", "Narrador", "Mas o Coronel Ferrabrás roubou os amuletos para derrubar a floresta e secar os rios. Sem eles, os encantados enlouqueceram."),
  L("v1", "Vovó", "Kauã, meu neto, acorda! A mata tá gritando. Os bichos fugiram e o rio ficou escuro."),
  L("k1", "Kauã", "Eu ouvi, vó. Parece que a ilha inteira tá doente."),
  L("v2", "Vovó", "Pega a espada do teu avô. E procura o Saci, lá no pé da gameleira. Ele sabe o caminho dos encantados."),
];
export const SACI1 = [
  L("s1", "Saci", "Opa! Até que enfim um humano corajoso! Eu sou o Saci, prazer. E não, não vou devolver teu chinelo."),
  L("s2", "Saci", "O Curupira tá enfeitiçado lá na mata do norte. Acende as três tochas sagradas pra chamar ele, e depois… bom, depois corre!"),
];
export const TORCH_HINT = [L("s3", "Saci", "As tochas! Bate nelas com a espada pra acender.")];
export const CURUPIRA_IN = [L("c1", "Curupira", "Quem invade a minha mata?! Ninguém sai daqui com os pés pra frente!")];
export const CURUPIRA_OUT = [
  L("c2", "Curupira", "Ufa… minha cabeça… o feitiço do Coronel sumiu. Obrigado, menino."),
  L("c3", "Curupira", "Leva o meu muiraquitã e este arco. Com ele, você acerta o que a espada não alcança."),
  L("s4", "Saci", "Agora, a Lagoa da Iara, a leste. Mas cuidado: não olha nos olhos dela. Ou olha, sei lá, eu não sou teu pai."),
];
export const LAKE_IN = [L("k2", "Kauã", "A ilha da Iara fica no meio da lagoa… essas pedras devem abrir um caminho.")];
export const BRIDGE = [L("n4", "Narrador", "Das águas escuras, uma ponte de pedra se ergue.")];
export const IARA_IN = [L("i1", "Iara", "Vem, menino… vem pro fundo do rio… ninguém tira o que é meu!")];
export const IARA_OUT = [
  L("i2", "Iara", "As águas clareiam… eu me lembro agora. Leva o meu amuleto, guardião."),
  L("s5", "Saci", "Falta o Boitatá, nas ruínas do oeste. Cobra de fogo, gigante, brava. Vai lá, eu espero aqui. Bem aqui."),
];
export const RUINS_IN = [L("k3", "Kauã", "As portas estão trancadas. As chaves devem estar com os capangas.")];
export const KEY = [L("h2", "Kauã", "Achei uma chave!")];
export const BOITATA_IN = [L("b1", "Boitatá", "Fogo… fogo pra quem queimou a minha mata!"), L("k4", "Kauã", "Quando ele bater nos pilares, ele fica tonto!")];
export const BOITATA_OUT = [
  L("b2", "Boitatá", "O fogo que queima também protege. Leva a última pedra, pequeno guardião."),
  L("s6", "Saci", "Três muiraquitãs! Agora é a fazenda do Coronel, no sul. Hora de acabar com essa história."),
];
export const FARM_LOCKED = [L("h1", "Saci", "Sem os três amuletos, a porteira não abre, guardião!")];
export const CORONEL_IN = [L("f1", "Coronel", "Um moleque com um arco de brinquedo? Essa ilha é minha! Capangas, peguem ele!")];
export const CORONEL_2 = [L("f2", "Coronel", "Inúteis! Eu mesmo resolvo!")];
export const CORONEL_OUT = [L("f3", "Coronel", "Não… o poder… tá voltando pra mata…")];
export const ENDING = [
  L("n5", "Narrador", "Com os três muiraquitãs de volta, os encantados acordaram. A mata cresceu sobre a fazenda, e o rio voltou a cantar."),
  L("v3", "Vovó", "Teu avô ia ter orgulho, Kauã. Agora você é o guardião das lendas."),
  L("s7", "Saci", "E eu? Eu ajudei muito! Tá, ajudei um pouquinho. Até a próxima aventura!"),
];
export const DIED = [L("k5", "Kauã", "Ai… ainda não acabou.")];

export const OBJ: Record<number, string> = {
  1: "Fale com o Saci, na grande gameleira",
  2: "Vá até a Mata do Curupira, ao norte",
  3: "Acenda as três tochas sagradas com a espada",
  4: "Derrote o Curupira enfeitiçado",
  5: "Vá até a Lagoa da Iara, a leste",
  6: "Empurre as pedras até os símbolos da margem",
  7: "Atravesse a ponte e enfrente a Iara (use o arco)",
  8: "Vá até as Ruínas do Boitatá, a oeste",
  9: "Pegue as duas chaves nos baús dos capangas",
  10: "Derrote o Boitatá (faça ele bater nos pilares)",
  11: "Vá até a Fazenda do Coronel, ao sul",
  12: "Derrote os capangas do Coronel",
  13: "Derrote o Coronel Ferrabrás",
};
