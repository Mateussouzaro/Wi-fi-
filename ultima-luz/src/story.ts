// A Última Luz — script. Each line has a speaker, the subtitle text and its voice clip id.

export interface Line {
  who: string;
  text: string;
  voice: string;
  diary?: boolean; // shown on a diary page
}

export const CAST: Record<string, { color: string; role: string }> = {
  Narrador: { color: "#c9b37e", role: "" },
  Helena: { color: "#e07a5f", role: "engenheira, neta do faroleiro" },
  Bento: { color: "#81b29a", role: "pescador" },
  Joaquim: { color: "#f2cc8f", role: "faroleiro, avô de Helena" },
  Caio: { color: "#7fb3d5", role: "no rádio • irmão de Helena" },
};

const L = (voice: string, who: string, text: string, diary = false): Line => ({ voice, who, text, diary });

export const PROLOGUE = [
  L("p1", "Narrador", "Ilha da Bruma, litoral sul do Brasil. 1994. Há três noites, o farol da ilha está apagado."),
  L("p2", "Narrador", "Helena Duarte, engenheira, volta para a ilha onde cresceu, depois de um telefonema que ninguém quer receber."),
  L("p3", "Bento", "Teu avô sumiu, menina. Saiu de madrugada pro farol e não voltou. E o Caio tá no mar, com a Estrela do Mar."),
  L("p4", "Helena", "Com essa tempestade chegando? Se o farol não acender, o Caio não acha o caminho de volta."),
  L("p5", "Bento", "A chave do farol fica na casa do teu avô. Vai lá primeiro. Eu vou procurar ele pela praia."),
];
export const HOUSE = [
  L("c1a", "Helena", "A casa tá do mesmo jeito… o cachimbo dele ainda tá na mesa."),
  L("d1", "Joaquim", "Diário, 12 de março. O gerador da gruta voltou a falhar. Se o farol apagar numa noite de tempestade, alguém vai se perder no mar.", true),
  L("c1b", "Helena", "A chave do farol! E o rádio dele… Caio, tá me ouvindo? Câmbio."),
  L("r1", "Caio", "Helena?! Graças a Deus! O motor morreu, tô à deriva. Não vejo nada, só escuridão. Acende o farol, maninha!"),
  L("c1c", "Helena", "Aguenta firme. O gerador precisa de diesel e de um fusível. O galpão do porto deve ter os dois."),
];
export const FUEL = [
  L("c2a", "Helena", "Diesel. Isso deve dar pra algumas horas de gerador."),
  L("d2", "Joaquim", "Diário, 15 de março. Tem uma rachadura na escada da gruta. Preciso consertar antes que alguém se machuque. Talvez eu mesmo.", true),
];
export const FUSE = [L("c2b", "Helena", "Um fusível novo. O vô sempre guardava um sobressalente aqui.")];
export const STORM = [L("c3a", "Narrador", "A tempestade chega à ilha. O vento uiva, e a chuva apaga as trilhas. A gruta fica embaixo do farol.")];
export const CAVE = [
  L("c3b", "Joaquim", "Helena?… Minha menina… escorreguei na escada. A perna não me obedece."),
  L("c3c", "Helena", "Vô! Fica quieto, eu vou te tirar daqui. Mas primeiro o farol: o Caio tá no mar."),
  L("c3d", "Joaquim", "Então anda. Diesel no tanque, fusível no painel, e puxa a alavanca com força. Ele é teimoso que nem eu."),
];
export const GEN_TRY = [L("c3e", "Helena", "Vamos lá… pega, pega!")];
export const GEN_OK = [L("c3f", "Helena", "Funcionou! Agora, lá pra cima, acender a lanterna.")];
export const LAMP = [
  L("c4a", "Helena", "Acende… por favor, acende!"),
];
export const LAMP_ON = [
  L("c4b", "Narrador", "Depois de três noites, a última luz da Ilha da Bruma voltou a brilhar."),
  L("r2", "Caio", "Helena! Eu tô vendo a luz! Tô vendo o farol! Tô voltando pra casa!"),
];
export const EPILOGUE = [
  L("e1", "Narrador", "Ao amanhecer, a Estrela do Mar atracou no porto. Joaquim foi levado ao continente, com a perna engessada e um sorriso teimoso."),
  L("e2", "Joaquim", "Agora o farol tem uma nova guardiã. Cuida bem dele, Helena."),
  L("e3", "Helena", "Pode deixar, vô. Enquanto eu estiver aqui, essa luz não apaga."),
];
export const HINT_GEN = [L("h_gen", "Helena", "O farol não tem energia. Primeiro o gerador, na gruta.")];
export const HINT_ITEMS = [L("h_items", "Helena", "Ainda falta o diesel ou o fusível.")];

export const OBJECTIVES = [
  "",
  "Vá até a casa do seu avô, na vila",
  "Pegue o diesel no galpão do porto e o fusível no barco velho da praia",
  "Vá até a gruta embaixo do farol",
  "Ligue o gerador da gruta",
  "Suba até o topo do farol",
  "Acenda a lanterna do farol",
  "",
];
export const CHAPTERS = ["Prólogo — A travessia", "Capítulo 1 — A casa do faroleiro", "Capítulo 2 — O porto", "Capítulo 3 — A tempestade", "Capítulo 3 — A gruta", "Capítulo 4 — O farol", "Capítulo 4 — A última luz", "Epílogo"];
