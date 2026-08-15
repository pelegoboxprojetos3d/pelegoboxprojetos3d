const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const MARCADOR = "// PREFLIGHT_CENTRAL_SEM_FLASH_V3";

if (!code.includes(MARCADOR)) {
  const inicioTexto = `  if (acessoDireto) {
    // Link de e-mail/checkout:`;

  const fimTexto = `

  for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final]) {`;

  const inicio = code.indexOf(inicioTexto);
  if (inicio < 0) {
    throw new Error("Início do bloco de impressora imediata não encontrado.");
  }

  const fim = code.indexOf(fimTexto, inicio);
  if (fim < 0) {
    throw new Error("Fim do bloco de impressora imediata não encontrado.");
  }

  const blocoPreflight = `  // PREFLIGHT_CENTRAL_SEM_FLASH_V3
  // A impressora começa fechada em TODAS as rotas. Pelo avatar, primeiro
  // consultamos silenciosamente se a conta possui projetos. Só contas com
  // projetos abrem a impressora; contas vazias seguem direto para o aviso.
  try {
    const processando = $w(IDS.processando);
    if (typeof processando.hide === "function") processando.hide();
    if (typeof processando.collapse === "function") processando.collapse();
  } catch (_) {}`;

  code = code.slice(0, inicio) + blocoPreflight + code.slice(fim);
}

if (code.includes("IMPRESSORA_CENTRAL_IMEDIATA_V2")) {
  throw new Error("Marcador antigo de impressora imediata ainda presente.");
}

for (const marcador of [
  MARCADOR,
  "// IMPRESSORA_CENTRAL_COM_PROJETOS_V1",
  'motivo: "sem_produtos"'
]) {
  if (!code.includes(marcador)) {
    throw new Error(`Marcador obrigatório ausente: ${marcador}`);
  }
}

fs.writeFileSync(FILE, code, "utf8");
console.log("OK: conta sem projetos não mostra a impressora; conta com projetos abre a impressora só depois da confirmação silenciosa.");
