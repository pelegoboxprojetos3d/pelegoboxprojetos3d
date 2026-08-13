const fs = require('fs');

const FILE = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let code = fs.readFileSync(FILE, 'utf8');

function replaceOnce(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado`);
  code = code.replace(from, to);
}

replaceOnce(
`const IDS_DADOS_REAIS_ENTREGA = [
  IDS.titulo,
  IDS.medidas,
  IDS.valorMedidas,
  IDS.graficos,
  IDS.valorGraficos,
  IDS.projeto,
  IDS.valorProjeto
];`,
`const IDS_DADOS_REAIS_ENTREGA = [
  IDS.titulo,
  IDS.descricao,
  IDS.imagemEntrega,
  IDS.setaImagemAnterior,
  IDS.setaImagemProxima,
  IDS.video,
  IDS.medidas,
  IDS.valorMedidas,
  IDS.graficos,
  IDS.valorGraficos,
  IDS.projeto,
  IDS.valorProjeto,
  IDS.boxMedidas,
  IDS.boxGraficos,
  IDS.boxProjeto,
  IDS.avisosEtapas,
  IDS.avisoImportante,
  "#box4"
];`,
'lista de elementos finais'
);

replaceOnce(
`  await Promise.allSettled(
    IDS_DADOS_REAIS_ENTREGA.map((id) => {
      try {
        const elemento = $w(id);
        return typeof elemento.hide === "function"
          ? elemento.hide()
          : Promise.resolve();
      } catch (_) {
        return Promise.resolve();
      }
    })
  );`,
`  await Promise.allSettled(
    IDS_DADOS_REAIS_ENTREGA.map(async (id) => {
      try {
        const elemento = $w(id);

        if (typeof elemento.hide === "function") {
          await elemento.hide();
        }

        if (typeof elemento.collapse === "function") {
          await elemento.collapse();
        }
      } catch (_) {}
    })
  );`,
'ocultação inicial sem espaço fantasma'
);

replaceOnce(
`async function mostrarDadosRepeater(itens) {
  const repetidor = $w(IDS.repetidor);
  repetidor.data = itens;

  if (typeof repetidor.expand === "function") {
    await repetidor.expand();
  }
  if (typeof repetidor.show === "function") {
    await repetidor.show();
  }
}`,
`async function mostrarDadosRepeater(itens) {
  const repetidor = $w(IDS.repetidor);

  /*
    ORQUESTRAÇÃO DA ENTREGA:
    1. os dados entram no Repeater ainda escondido;
    2. onItemReady tem um instante para montar imagem, título e botões;
    3. a impressora cumpre o tempo mínimo real;
    4. só então o conteúdo pronto aparece de uma vez.
  */
  repetidor.data = itens;
  await esperar(120);
  await esconderProcessamento();

  if (typeof repetidor.expand === "function") {
    await repetidor.expand();
  }
  if (typeof repetidor.show === "function") {
    await repetidor.show();
  }
}`,
'revelação sincronizada do repeater'
);

// A central não deve matar a impressora antes de carregar os detalhes.
code = code.replace(
`    await esconderProcessamento();

    if (!resultado?.ok) {`,
`    if (!resultado?.ok) {`
);

code = code.replace(
`    await esconderProcessamento();
    await mostrarDadosRepeater([`,
`    await mostrarDadosRepeater([`
);

// A entrega normal também usa a mesma revelação sincronizada.
code = code.replace(
`  await esconderProcessamento();

  await mostrarDadosRepeater([
    itemRepeaterProjeto(dados, 0)
  ]);`,
`  await mostrarDadosRepeater([
    itemRepeaterProjeto(dados, 0)
  ]);`
);

replaceOnce(
`$w.onReady(async function () {
  checkoutEmAndamento = false;
  redirecionarHomeAoDeslogar();

  await prepararRepeaterParaCarregamento();`,
`$w.onReady(async function () {
  checkoutEmAndamento = false;
  redirecionarHomeAoDeslogar();

  /*
    Primeiro frame controlado: nada de título, botão, box ou imagem padrão
    vazando antes da hora. A impressora é o único conteúdo dinâmico inicial.
  */
  await ocultarDadosAteCarregamento();
  blindarGaleriaPadrao();
  await prepararRepeaterParaCarregamento();`,
'onReady controlado'
);

replaceOnce(
`  const checkoutId = safe(
    wixLocation.query.checkout_id || wixLocation.query.checkoutId
  );
  const token = safe(wixLocation.query.token);

  const inicio = (!checkoutId && !token)
    ? Promise.resolve()
    : mostrarProcessamento().catch((erro) => {
      console.warn(
        "Falha ao abrir processamento inicial:",
        erro?.message || erro
      );
    });`,
`  const inicio = mostrarProcessamento().catch((erro) => {
    console.warn(
      "Falha ao abrir processamento inicial:",
      erro?.message || erro
    );
  });`,
'impressora em toda abertura'
);

fs.writeFileSync(FILE, code, 'utf8');
console.log('Entrega sincronizada: impressora primeiro, conteúdo final depois.');
