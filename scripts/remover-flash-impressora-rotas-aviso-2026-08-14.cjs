const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const MARCADOR = "// PREFLIGHT_CENTRAL_SEM_FLASH_V3";

if (code.includes(MARCADOR)) {
  console.log("Pré-validação da central sem flash já aplicada.");
  process.exit(0);
}

const blocoImpressoraImediata = `  if (acessoDireto) {
    // Link de e-mail/checkout: mantém a impressora fechada até validar a conta.
    try {
      const processando = $w(IDS.processando);
      if (typeof processando.hide === "function") processando.hide();
      if (typeof processando.collapse === "function") processando.collapse();
    } catch (_) {}
  } else {
    // IMPRESSORA_CENTRAL_IMEDIATA_V2
    // Central pelo avatar: abre a impressora antes de qualquer consulta remota,
    // eliminando o quadro intermediário em que aparecia somente o rodapé.
    processamentoVisualEncerrado = false;
    blindarAberturaEntrega();
  }`;

const blocoPreflight = `  // PREFLIGHT_CENTRAL_SEM_FLASH_V3
  // A impressora começa fechada em TODAS as rotas. Pelo avatar, primeiro
  // consultamos silenciosamente se a conta possui projetos. Só contas com
  // projetos abrem a impressora; contas vazias seguem direto para o aviso.
  try {
    const processando = $w(IDS.processando);
    if (typeof processando.hide === "function") processando.hide();
    if (typeof processando.collapse === "function") processando.collapse();
  } catch (_) {}`;

if (!code.includes(blocoImpressoraImediata)) {
  throw new Error("Bloco de impressora imediata pelo avatar não encontrado. Nada foi alterado.");
}

code = code.replace(blocoImpressoraImediata, blocoPreflight);

const blocoElseAtual = `  } else {
    /*
      A central já abriu a impressora imediatamente no começo do onReady.
      Ela permanece visível enquanto os projetos são consultados e renderizados.
    */
    processamentoVisualEncerrado = false;
  }`;

const blocoElseNovo = `  } else {
    /*
      Entrada pelo avatar: a consulta de projetos acontece silenciosamente.
      carregarCentralSegundasVias() só abre a impressora DEPOIS de confirmar
      que existem projetos nesta conta. Se não houver nenhum, redireciona para
      a página de aviso sem mostrar a impressora nem por um instante.
    */
    processamentoVisualEncerrado = false;
  }`;

if (!code.includes(blocoElseAtual)) {
  throw new Error("Bloco final da central pelo avatar não encontrado. Nada foi alterado.");
}

code = code.replace(blocoElseAtual, blocoElseNovo);

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
console.log("OK: avatar sem compras não mostra mais a impressora; avatar com compras continua mostrando durante o carregamento dos projetos.");
