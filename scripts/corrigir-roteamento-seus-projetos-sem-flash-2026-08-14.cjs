const fs = require('fs');

const FILE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
const MARKER = 'PB_ROTEAMENTO_AVATAR_PREFLIGHT_V4';
let code = fs.readFileSync(FILE, 'utf8');

if (code.includes(MARKER)) {
  console.log('Roteamento sem flash já aplicado.');
  process.exit(0);
}

// 1) Durante o processamento, principal + seção vazia precisam voltar juntos.
const oldPreparar = `async function prepararSecoesEntrega() {
  await esconderSecao(SECOES_ENTREGA.banners);
  await esconderSecao(SECOES_ENTREGA.final);

  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") await principal.expand();
    if (typeof principal.show === "function") await principal.show();
  } catch (_) {}
}`;

const newPreparar = `async function prepararSecoesEntrega() {
  await esconderSecao(SECOES_ENTREGA.banners);
  await esconderSecao(SECOES_ENTREGA.final);

  // A área de processamento só é liberada DEPOIS que a rota foi validada.
  // Isso vale tanto para acesso pelo avatar quanto para link de compra/e-mail.
  for (const id of [SECOES_ENTREGA.principal, SECOES_ENTREGA.vazia]) {
    try {
      const secao = $w(id);
      if (typeof secao.expand === "function") await secao.expand();
      if (typeof secao.show === "function") await secao.show();
    } catch (_) {}
  }
}`;

if (!code.includes(oldPreparar)) {
  throw new Error('Bloco prepararSecoesEntrega esperado não encontrado.');
}
code = code.replace(oldPreparar, newPreparar);

// 2) Blindagem absoluta: antes de consultar coleção/autorização, nada da entrega aparece.
const anchorBlindagem = `function blindarAberturaEntrega() {`;
if (!code.includes(anchorBlindagem)) {
  throw new Error('Função blindarAberturaEntrega não encontrada.');
}

const preflightFn = `// ${MARKER}
function blindarPreflightEntrega() {
  /*
    REGRA DE ROTEAMENTO:
    - Avatar sem parâmetros: consulta primeiro a coleção do membro.
    - Link de compra/e-mail: valida primeiro login e titularidade.
    Enquanto essa decisão não terminou, a página de entrega fica 100% fechada.
  */
  processamentoVisivelDesde = 0;
  processamentoVisualEncerrado = false;

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

  for (const id of [
    SECOES_ENTREGA.principal,
    SECOES_ENTREGA.banners,
    SECOES_ENTREGA.final,
    SECOES_ENTREGA.vazia
  ]) {
    try {
      const secao = $w(id);
      if (typeof secao.hide === "function") secao.hide();
      if (typeof secao.collapse === "function") secao.collapse();
    } catch (_) {}
  }

  blindarGaleriaPadrao();
}

`;
code = code.replace(anchorBlindagem, preflightFn + anchorBlindagem);

// 3) Avatar COM projetos: só agora liberamos a área e a impressora.
const oldCentralOk = `    processamentoVisualEncerrado = false;
    await mostrarProcessamento();

    const detalhes = await carregarDetalhesDaCentral(projetosSegundaVia);`;
const newCentralOk = `    await prepararSecoesEntrega();
    processamentoVisualEncerrado = false;
    await mostrarProcessamento();

    const detalhes = await carregarDetalhesDaCentral(projetosSegundaVia);`;
if (!code.includes(oldCentralOk)) {
  throw new Error('Ponto de abertura da impressora na central não encontrado.');
}
code = code.replace(oldCentralOk, newCentralOk);

// 4) Em erro real de consulta, mostramos mensagem sem deixar a página eternamente fechada.
const oldCentralErro = `      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          "Não foi possível consultar seus projetos agora."
        )
      ]);`;
const newCentralErro = `      await prepararSecoesEntrega();
      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          "Não foi possível consultar seus projetos agora."
        )
      ]);`;
if (code.includes(oldCentralErro)) {
  code = code.replace(oldCentralErro, newCentralErro);
}

const oldCentralCatch = `    await mostrarDadosRepeater([
      itemRepeaterMensagem(
        "SEUS PROJETOS PRONTOS",
        "Não foi possível consultar seus projetos agora. Tente novamente em instantes."
      )
    ]);`;
const newCentralCatch = `    await prepararSecoesEntrega();
    await mostrarDadosRepeater([
      itemRepeaterMensagem(
        "SEUS PROJETOS PRONTOS",
        "Não foi possível consultar seus projetos agora. Tente novamente em instantes."
      )
    ]);`;
if (code.includes(oldCentralCatch)) {
  code = code.replace(oldCentralCatch, newCentralCatch);
}

// 5) Substitui o onReady inteiro. Ele é o último bloco do arquivo.
const onReadyStart = code.indexOf('// ROTA_SEM_FLASH_V1');
if (onReadyStart < 0) {
  throw new Error('Bloco onReady ROTA_SEM_FLASH_V1 não encontrado.');
}

const novoOnReady = `// ROTA_INTELIGENTE_SEUS_PROJETOS_V4
$w.onReady(async function () {
  checkoutEmAndamento = false;
  redirecionarHomeAoDeslogar();

  // PRIMEIRO PASSO, sem exceção: nada da entrega pode aparecer antes da decisão.
  blindarPreflightEntrega();

  const checkoutIdInicial = safe(
    wixLocation.query.checkout_id ||
    wixLocation.query.checkoutId
  );
  const tokenInicial = safe(wixLocation.query.token);
  const acessoDireto = Boolean(checkoutIdInicial || tokenInicial);

  await ocultarDadosAteCarregamento();
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
      FLUXO E-MAIL / COMPRA:
      valida login e titularidade ANTES de abrir qualquer coisa da entrega.
      Um link encaminhado para outra pessoa nunca deve piscar a impressora.
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

    // Só depois da autorização a página de entrega e a impressora entram em cena.
    await prepararSecoesEntrega();
    blindarAberturaEntrega();
    await mostrarProcessamento().catch((erro) => {
      console.warn(
        "Falha ao abrir processamento inicial:",
        erro?.message || erro
      );
    });
  } else {
    /*
      FLUXO AVATAR / SEUS PROJETOS PRONTOS:
      NÃO abre impressora aqui.
      carregarCentralSegundasVias() consulta a coleção primeiro:
      - zero projetos -> /semprodutonaologao?motivo=sem_produtos
      - tem projetos  -> libera a área e abre a impressora
    */
    processamentoVisualEncerrado = false;
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

    prepararSecoesEntrega()
      .then(() => mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          "Não foi possível carregar seus projetos agora. Atualize a página em instantes."
        )
      ]))
      .catch(() => {});
  });
});
`;

code = code.slice(0, onReadyStart) + novoOnReady;

for (const obrigatorio of [
  MARKER,
  'ROTA_INTELIGENTE_SEUS_PROJETOS_V4',
  'await prepararSecoesEntrega();\n    processamentoVisualEncerrado = false;',
  'abrirPaginaAvisoProjetosProntos(\n        "sem_produtos"',
  'abrirPaginaAvisoProjetosProntos(\n          "login"'
]) {
  if (!code.includes(obrigatorio)) {
    throw new Error(`Validação falhou: ${obrigatorio}`);
  }
}

fs.writeFileSync(FILE, code, 'utf8');
console.log('OK: roteamento inteligente aplicado sem abrir impressora antes da decisão.');
