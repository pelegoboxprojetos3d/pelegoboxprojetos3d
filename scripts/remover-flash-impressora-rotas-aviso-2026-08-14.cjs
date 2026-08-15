const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const MARCADOR = "// PREFLIGHT_CENTRAL_SEM_FLASH_V3";

if (!code.includes(MARCADOR)) {
  const regexImpressoraImediata = /  if \(acessoDireto\) \{\n    \/\/ Link de e-mail\/checkout:[\s\S]*?\n    blindarAberturaEntrega\(\);\n  \}\n\n  for \(const id of \[SECOES_ENTREGA\.banners, SECOES_ENTREGA\.final\]\) \{/;

  const blocoPreflight = `  // PREFLIGHT_CENTRAL_SEM_FLASH_V3
  // A impressora começa fechada em TODAS as rotas. Pelo avatar, primeiro
  // consultamos silenciosamente se a conta possui projetos. Só contas com
  // projetos abrem a impressora; contas vazias seguem direto para o aviso.
  try {
    const processando = $w(IDS.processando);
    if (typeof processando.hide === "function") processando.hide();
    if (typeof processando.collapse === "function") processando.collapse();
  } catch (_) {}

  for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final]) {`;

  if (!regexImpressoraImediata.test(code)) {
    throw new Error("Bloco inicial da impressora imediata pelo avatar não encontrado.");
  }

  code = code.replace(regexImpressoraImediata, blocoPreflight);
}

const regexElseCentral = /  \} else \{\n    \/\*\n      A central já abriu a impressora imediatamente no começo do onReady\.\n      Ela permanece visível enquanto os projetos são consultados e renderizados\.\n    \*\/\n    processamentoVisualEncerrado = false;\n  \}/;

if (regexElseCentral.test(code)) {
  code = code.replace(
    regexElseCentral,
    `  } else {
    /*
      Entrada pelo avatar: a consulta de projetos acontece silenciosamente.
      carregarCentralSegundasVias() só abre a impressora DEPOIS de confirmar
      que existem projetos nesta conta. Se não houver nenhum, redireciona para
      a página de aviso sem mostrar a impressora nem por um instante.
    */
    processamentoVisualEncerrado = false;
  }`
  );
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
console.log("OK: conta sem projetos não mostra a impressora; conta com projetos continua mostrando a impressora depois da confirmação silenciosa.");
