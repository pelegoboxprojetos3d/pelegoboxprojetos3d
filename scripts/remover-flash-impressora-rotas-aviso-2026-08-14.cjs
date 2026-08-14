const fs = require("fs");

const FILE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
let code = fs.readFileSync(FILE, "utf8");

const marker = "// ROTA_SEM_FLASH_V1";
if (code.includes(marker)) {
  console.log("Rota sem flash já aplicada.");
  process.exit(0);
}

const onReadyRegex = /\$w\.onReady\(async function \(\) \{[\s\S]*?\n\}\);\s*$/;
if (!onReadyRegex.test(code)) {
  throw new Error("Bloco final $w.onReady não encontrado.");
}

const novoOnReady = `// ROTA_SEM_FLASH_V1
$w.onReady(async function () {
  checkoutEmAndamento = false;
  redirecionarHomeAoDeslogar();

  const checkoutIdInicial = safe(
    wixLocation.query.checkout_id ||
    wixLocation.query.checkoutId
  );
  const tokenInicial = safe(wixLocation.query.token);
  const acessoDireto = Boolean(checkoutIdInicial || tokenInicial);

  /*
    Primeiro escondemos tudo que pertence à entrega antiga. A impressora NÃO
    abre automaticamente quando o visitante chega pelo avatar ou quando ainda
    nem sabemos se ele tem autorização para um link de e-mail.
  */
  try {
    const repetidor = $w(IDS.repetidor);
    repetidor.data = [];
    if (typeof repetidor.hide === "function") repetidor.hide();
  } catch (_) {}

  try {
    const processando = $w(IDS.processando);
    if (typeof processando.hide === "function") processando.hide();
    if (typeof processando.collapse === "function") processando.collapse();
  } catch (_) {}

  for (const id of [SECOES_ENTREGA.banners, SECOES_ENTREGA.final]) {
    try {
      const secao = $w(id);
      if (typeof secao.hide === "function") secao.hide();
      if (typeof secao.collapse === "function") secao.collapse();
    } catch (_) {}
  }

  await prepararSecoesEntrega();
  await ocultarDadosAteCarregamento();
  blindarGaleriaPadrao();
  await prepararRepeaterParaCarregamento();

  try {
    configurarRepeater();
  } catch (erro) {
    console.error(
      "Não foi possível configurar #repetidopaginadeentrega:",
      erro?.message || erro
    );
    return;
  }

  void ligarEventos;

  if (acessoDireto) {
    /*
      Faz uma consulta de autorização ANTES de abrir a impressora. Assim um
      link encaminhado por e-mail não pisca a tela de entrega para quem está
      deslogado ou em outra conta.
    */
    try {
      const preflight = await buscarEntregaProjetoPronto({
        checkoutId: checkoutIdInicial,
        token: tokenInicial
      });

      if (preflight?.error === "LOGIN_NECESSARIO") {
        abrirPaginaAvisoProjetosProntos(
          "login",
          {
            checkoutId: checkoutIdInicial,
            token: tokenInicial,
            via: firstValue(wixLocation.query.via, "email")
          }
        );
        return;
      }

      if (preflight?.error === "COMPRA_DE_OUTRA_CONTA") {
        abrirPaginaAvisoProjetosProntos(
          "conta_errada",
          {
            checkoutId: checkoutIdInicial,
            token: tokenInicial,
            via: firstValue(wixLocation.query.via, "email")
          }
        );
        return;
      }
    } catch (erro) {
      console.warn(
        "Pré-validação da entrega falhou; mantendo fluxo normal:",
        erro?.message || erro
      );
    }

    blindarAberturaEntrega();
    await mostrarProcessamento().catch((erro) => {
      console.warn(
        "Falha ao abrir processamento inicial:",
        erro?.message || erro
      );
    });
  } else {
    /*
      Entrada pelo avatar: não existe produto específico sendo entregue.
      Portanto não existe motivo para mostrar a impressora enquanto a central
      consulta se o membro possui projetos.
    */
    processamentoVisualEncerrado = true;
  }

  carregarEntrega().catch((erro) => {
    console.error(
      "Falha assíncrona ao carregar a entrega:",
      erro?.message || erro
    );

    if (!acessoDireto) {
      abrirPaginaAvisoProjetosProntos(
        "sem_produtos",
        { via: "avatar" }
      );
      return;
    }

    mostrarDadosRepeater([
      itemRepeaterMensagem(
        "SEUS PROJETOS PRONTOS",
        "Não foi possível carregar seus projetos agora. Atualize a página em instantes."
      )
    ]).catch(() => {});
  });
});
`;

code = code.replace(onReadyRegex, novoOnReady);
fs.writeFileSync(FILE, code, "utf8");
console.log("Flash da impressora removido das rotas de avatar e acesso não autorizado.");
