const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const MARCADOR_NOVO = "PREFLIGHT_CENTRAL_SEM_FLASH_V3";
const MARCADOR_ANTIGO = "IMPRESSORA_CENTRAL_IMEDIATA_V2";

if (!code.includes(MARCADOR_NOVO)) {
  const linhas = code.split(/\r?\n/);
  const indiceMarcador = linhas.findIndex((linha) => linha.includes(MARCADOR_ANTIGO));

  if (indiceMarcador < 0) {
    throw new Error("Marcador da impressora imediata não encontrado.");
  }

  let inicio = -1;
  for (let i = indiceMarcador; i >= 0; i -= 1) {
    if (linhas[i].trim() === "if (acessoDireto) {") {
      inicio = i;
      break;
    }
  }

  if (inicio < 0) {
    throw new Error("Início do bloco de impressora imediata não encontrado.");
  }

  let fim = -1;
  for (let i = indiceMarcador + 1; i < linhas.length; i += 1) {
    if (linhas[i].includes("for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final])")) {
      fim = i;
      break;
    }
  }

  if (fim < 0) {
    throw new Error("Fim do bloco de impressora imediata não encontrado.");
  }

  const substituto = [
    "  // PREFLIGHT_CENTRAL_SEM_FLASH_V3",
    "  // Pelo avatar, primeiro consulta silenciosamente se a conta possui projetos.",
    "  // Só depois de confirmar projetos a impressora é exibida.",
    "  try {",
    "    const processando = $w(IDS.processando);",
    "    if (typeof processando.hide === \"function\") processando.hide();",
    "    if (typeof processando.collapse === \"function\") processando.collapse();",
    "  } catch (_) {}",
    ""
  ];

  linhas.splice(inicio, fim - inicio, ...substituto);
  code = linhas.join("\n");
}

if (code.includes(MARCADOR_ANTIGO)) {
  throw new Error("Lógica antiga de impressora imediata ainda presente.");
}

for (const marcador of [
  MARCADOR_NOVO,
  "IMPRESSORA_CENTRAL_COM_PROJETOS_V1",
  'motivo: "sem_produtos"'
]) {
  if (!code.includes(marcador)) {
    throw new Error(`Marcador obrigatório ausente: ${marcador}`);
  }
}

fs.writeFileSync(FILE, code, "utf8");
console.log("OK: conta sem projetos não mostra a impressora; conta com projetos mostra a impressora somente depois da confirmação.");
