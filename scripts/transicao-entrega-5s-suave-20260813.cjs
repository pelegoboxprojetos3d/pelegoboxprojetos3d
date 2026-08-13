const fs = require('fs');

const file = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let s = fs.readFileSync(file, 'utf8');

function trocar(inicio, fim, novo, nome) {
  const a = s.indexOf(inicio);
  const b = s.indexOf(fim, a + inicio.length);
  if (a < 0 || b < 0) {
    throw new Error(`${nome}: trecho não encontrado`);
  }
  s = s.slice(0, a) + novo.trimEnd() + '\n\n' + s.slice(b);
}

// Um único padrão: 5 s para compra, e-mail, desktop e mobile.
s = s.replace(
  /const\s+EMAIL_PROCESSAMENTO_MS\s*=\s*7000\s*;/,
  'const EMAIL_PROCESSAMENTO_MS =\n  5000;'
);

// Primeiro esconde as áreas seguintes; a seção principal permanece intacta.
trocar(
  'async function prepararSecoesEntrega() {',
  'async function liberarSecoesPosRepeater() {',
  `async function prepararSecoesEntrega() {
  await esconderSecao(SECOES_ENTREGA.banners);
  await esconderSecao(SECOES_ENTREGA.final);

  try {
    const principal = $w(SECOES_ENTREGA.principal);
    if (typeof principal.expand === "function") await principal.expand();
    if (typeof principal.show === "function") await principal.show();
  } catch (_) {}
}`,
  'prepararSecoesEntrega'
);

// Mesma regra visual existente, apenas com entrada suave das áreas seguintes.
trocar(
  'async function liberarSecoesPosRepeater() {',
  'function dinheiro(',
  `async function liberarSecoesPosRepeater() {
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  try {
    const banners = $w(SECOES_ENTREGA.banners);
    if (typeof banners.expand === "function") await banners.expand();
    if (typeof banners.show === "function") await banners.show("fade");
  } catch (_) {
    await mostrarSecao(SECOES_ENTREGA.banners);
  }

  if (
    mobile &&
    !centralSegundasViasAtiva &&
    entrega?.access
  ) {
    await mostrarAvisosEntrega();
  }

  await esperar(mobile ? 180 : 100);

  try {
    const final = $w(SECOES_ENTREGA.final);
    if (typeof final.expand === "function") await final.expand();
    if (typeof final.show === "function") await final.show("fade");
  } catch (_) {
    await mostrarSecao(SECOES_ENTREGA.final);
  }
}`,
  'liberarSecoesPosRepeater'
);

// A impressora entra primeiro. O relógio começa somente depois do fade-in.
trocar(
  'async function mostrarProcessamento() {',
  'async function esconderProcessamento() {',
  `async function mostrarProcessamento() {
  if (processamentoVisualEncerrado || processamentoVisivelDesde) {
    return;
  }

  try {
    const processando = $w(IDS.processando);

    if (typeof processando.expand === "function") {
      await processando.expand();
    }

    if (typeof processando.show === "function") {
      await processando.show("fade");
    }

    processamentoVisivelDesde = Date.now();
  } catch (erro) {
    console.warn(
      "Falha ao iniciar o HTML de processamento:",
      erro?.message || erro
    );
  }

  try {
    const galeria = $w(IDS.galeria);
    if (typeof galeria.hide === "function") await galeria.hide();
  } catch (_) {}
}`,
  'mostrarProcessamento'
);

// A impressora nunca sai antes de completar 5 s e desaparece em fade.
trocar(
  'async function esconderProcessamento() {',
  'async function aguardarMinimoProcessamentoInicial() {',
  `async function esconderProcessamento() {
  try {
    if (processamentoVisivelDesde) {
      const restante =
        MIN_PROCESSAMENTO_VISIVEL -
        (Date.now() - processamentoVisivelDesde);

      if (restante > 0) {
        await esperar(restante);
      }
    }

    const processando = $w(IDS.processando);

    if (typeof processando.hide === "function") {
      await processando.hide("fade");
    }

    if (typeof processando.collapse === "function") {
      await processando.collapse();
    }

    processamentoVisivelDesde = 0;
    processamentoEmailPendente = false;
  } catch (erro) {
    console.warn(
      "Falha ao esconder o HTML de processamento:",
      erro?.message || erro
    );
  }
}`,
  'esconderProcessamento'
);

trocar(
  'async function aguardarMinimoProcessamentoInicial() {',
  'function entregaProcessada(resultado) {',
  `async function aguardarMinimoProcessamentoInicial() {
  if (!processamentoVisivelDesde) return;

  const restante =
    MIN_PROCESSAMENTO_VISIVEL -
    (Date.now() - processamentoVisivelDesde);

  if (restante > 0) {
    await esperar(restante);
  }
}`,
  'aguardarMinimoProcessamentoInicial'
);

// Mantém o Repeater no layout que já funciona, mas invisível durante a impressora.
trocar(
  'async function prepararRepeaterParaCarregamento() {',
  'function configurarRepeater() {',
  `async function prepararRepeaterParaCarregamento() {
  try {
    const repetidor = $w(IDS.repetidor);
    repetidor.data = [];

    if (typeof repetidor.hide === "function") {
      await repetidor.hide();
    }
  } catch (erro) {
    console.warn("Falha ao preparar repeater:", erro?.message || erro);
  }
}`,
  'prepararRepeaterParaCarregamento'
);

// Renderiza tudo escondido. Só troca de cena após dados prontos + 5 s completos.
trocar(
  'async function mostrarDadosRepeater(itens) {',
  'async function encerrarProcessamentoPendente(',
  `async function mostrarDadosRepeater(itens) {
  const repetidor = $w(IDS.repetidor);
  const dados = Array.isArray(itens) ? itens : [];
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  iniciarCicloRepeater(dados.length);
  repetidor.data = dados;
  await aguardarRepeaterPronto(5000);

  await aguardarMinimoProcessamentoInicial();
  await esconderProcessamento();

  try {
    if (typeof repetidor.expand === "function") await repetidor.expand();
    if (typeof repetidor.show === "function") await repetidor.show("fade");
  } catch (_) {
    try { await repetidor.show(); } catch (_) {}
  }

  await esperar(mobile ? 220 : 100);
  await liberarSecoesPosRepeater();
}`,
  'mostrarDadosRepeater'
);

// Se houver falha terminal, a mensagem também entra no Repeater oculto e depois aparece suavemente.
trocar(
  'async function encerrarProcessamentoPendente(',
  'async function carregarDetalhesDaCentral(resumos) {',
  `async function encerrarProcessamentoPendente(titulo, mensagem) {
  try {
    const repetidor = $w(IDS.repetidor);
    const dados = [itemRepeaterMensagem(titulo, mensagem)];
    iniciarCicloRepeater(dados.length);
    repetidor.data = dados;
    await aguardarRepeaterPronto(3000);

    await esconderProcessamento();

    if (typeof repetidor.expand === "function") await repetidor.expand();
    if (typeof repetidor.show === "function") await repetidor.show("fade");
  } catch (erro) {
    console.warn(
      "Falha ao mostrar mensagem de processamento pendente:",
      erro?.message || erro
    );

    await esconderProcessamento();
  }

  processamentoVisualEncerrado = true;
}`,
  'encerrarProcessamentoPendente'
);

// Primeiro frame: repeater e áreas seguintes somem antes da consulta.
const novoOnReady = `$w.onReady(async function () {
  checkoutEmAndamento = false;
  redirecionarHomeAoDeslogar();

  try { $w(IDS.repetidor).hide(); } catch (_) {}
  try { $w(SECOES_ENTREGA.banners).hide(); } catch (_) {}
  try { $w(SECOES_ENTREGA.final).hide(); } catch (_) {}

  const inicioProcessamento = mostrarProcessamento().catch((erro) => {
    console.warn(
      "Falha ao abrir processamento inicial:",
      erro?.message || erro
    );
  });

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
  await inicioProcessamento;

  carregarEntrega().catch((erro) => {
    console.error(
      "Falha assíncrona ao carregar a entrega:",
      erro?.message || erro
    );

    mostrarDadosRepeater([
      itemRepeaterMensagem(
        "SEUS PROJETOS PRONTOS",
        "Não foi possível carregar seus projetos agora. Atualize a página em instantes."
      )
    ]).catch(() => {});
  });
});`;

const onReadyRegex = /\$w\.onReady\(async function \(\) \{[\s\S]*?\n\}\);\s*$/;
if (!onReadyRegex.test(s)) {
  throw new Error('onReady final não encontrado');
}
s = s.replace(onReadyRegex, novoOnReady + '\n');

fs.writeFileSync(file, s.trimEnd() + '\n', 'utf8');
console.log('Transição da entrega ajustada: 5 s, espera do Make e fades, sem alterar layout.');
