import wixLocation from "wix-location";
import wixData from "wix-data";
import wixWindowFrontend from "wix-window-frontend";

import {
  local
} from "wix-storage-frontend";

import {
  buscarEntregaProjetoPronto
} from "backend/entregaProjetosProntos.jsw";

import {
  gerarLinkDownloadImagem
} from "backend/downloadProjetosProntos.web";

// ======================================================
// PÁGINA: ENTREGA PROJETOS PRONTOS
// SLUG: /entregaprojetosprontos
//
// R16 — VALIDAPAY PIX TRANSPARENTE
//
// - Abre automaticamente após aprovação do PIX.
// - Aguarda o registro da compra pelo webhook.
// - Mantém downloads, galeria e vídeo.
// - Próximas etapas abrem /checkout-projeto-pronto.
// - Não cria checkout Mercado Pago.
// ======================================================

const IDS = {
  titulo:
    "#txtTitulo",

  descricao:
    "#txtDescricao",

  galeria:
    "#proGallery1",

  processando:
    "#htmlProcessandoEntrega",

  avisosEtapas:
    "#textodobotaobaixaranalisegrafica",

  avisoImportante:
    "#action2",

  video:
    "#buttonVideoPaginaEntrega",

  medidas:
    "#btnMedidas",

  boxMedidas:
    "#box1",

  valorMedidas:
    "#txtValor4",

  graficos:
    "#btnGraficos",

  boxGraficos:
    "#box2",

  valorGraficos:
    "#txtValor5",

  projeto:
    "#btnProjeto",

  boxProjeto:
    "#box3",

  valorProjeto:
    "#txtValor6"
};

const CORES = {
  compradoFundo:
    "#159447",

  compradoTexto:
    "#FFFFFF",

  compradoBorda:
    "#159447",

  normalFundo:
    "#FFFFFF",

  normalTexto:
    "#9A6048",

  normalBorda:
    "#A66F55",

  bloqueadoFundo:
    "#D9D9D9",

  bloqueadoTexto:
    "#8A8A8A",

  bloqueadoBorda:
    "#A66F55"
};

/*
  Após a aprovação do PIX, o checkout transparente
  redireciona para esta página imediatamente.

  O webhook pode precisar de alguns segundos para
  terminar o registro da compra.

  Por isso esta página consulta novamente até que
  a entrega esteja liberada.
*/

const MAX_TENTATIVAS =
  150;

const INTERVALO =
  2000;

/*
  Mesmo quando a imagem já existe (por exemplo, acesso pelo botão do e-mail),
  a impressora fica alguns segundos visível para comunicar processamento.
*/
const MIN_PROCESSAMENTO_VISIVEL =
  3000;

let processamentoVisivelDesde =
  0;

let entrega =
  null;

let eventosLigados =
  false;

let downloadEmAndamento =
  false;

let checkoutEmAndamento =
  false;

let indiceGraficoDownload =
  0;

let videoUrl =
  "";

let videoCarregando =
  false;


// ======================================================
// HELPERS
// ======================================================

function safe(valor) {
  return String(
    valor ?? ""
  ).trim();
}


function firstValue(
  ...valores
) {
  for (
    const valor of
    valores
  ) {
    const texto =
      safe(valor);

    if (texto) {
      return texto;
    }
  }

  return "";
}


function normalizarEmail(
  valor
) {
  return safe(valor)
    .toLowerCase();
}


function digits(
  valor
) {
  return safe(valor)
    .replace(
      /\D/g,
      ""
    );
}


function esperar(
  milliseconds
) {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}


function dinheiro(
  valor
) {
  const numero =
    Number(
      valor || 0
    );

  if (
    !Number.isFinite(
      numero
    )
  ) {
    return "R$ 0,00";
  }

  return numero.toLocaleString(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL"
    }
  );
}


function alterarDescricao(
  texto
) {
  $w(
    IDS.descricao
  ).text =
    safe(texto);
}


/*
  Enquanto os dados reais ainda não chegaram, não mostramos os textos
  padrão do Editor (TITULO DO PROJETO, Small Title etc.) nem os
  botões das etapas. Usamos somente os IDs dos elementos, sem depender
  do nome de seção. O espaço é preservado para evitar pulos no layout.
*/
const IDS_DADOS_REAIS_ENTREGA = [
  IDS.titulo,
  IDS.medidas,
  IDS.valorMedidas,
  IDS.graficos,
  IDS.valorGraficos,
  IDS.projeto,
  IDS.valorProjeto
];

async function ocultarDadosAteCarregamento() {
  try {
    $w(IDS.titulo).text = "";
    $w(IDS.valorMedidas).text = "";
    $w(IDS.valorGraficos).text = "";
    $w(IDS.valorProjeto).text = "";
  } catch (_) {}

  await Promise.allSettled(
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
  );
}

async function mostrarDadosCarregados() {
  await Promise.allSettled(
    IDS_DADOS_REAIS_ENTREGA.map((id) => {
      try {
        const elemento = $w(id);
        return typeof elemento.show === "function"
          ? elemento.show()
          : Promise.resolve();
      } catch (_) {
        return Promise.resolve();
      }
    })
  );
}


// ======================================================
// PROCESSAMENTO VISUAL DA ENTREGA
// ======================================================

async function mostrarProcessamento() {
  /*
    PRIORIDADE ABSOLUTA DA ENTREGA:
    a impressora precisa ser o primeiro elemento dinâmico a aparecer.

    Antes o código esperava a galeria terminar de ocultar para só depois
    expandir/mostrar o HTML. Em carregamentos lentos isso criava uma tela
    branca desnecessária. Agora disparo a impressora primeiro e oculto a
    galeria em paralelo. A galeria continua sem collapse para preservar o
    espaço do layout enquanto o Make trabalha.
  */
  const tarefas = [];

  try {
    const processando = $w(IDS.processando);

    if (typeof processando.expand === "function") {
      tarefas.push(processando.expand());
    }

    if (typeof processando.show === "function") {
      tarefas.push(processando.show());
    }
  } catch (erro) {
    console.warn(
      "Falha ao iniciar o HTML de processamento:",
      erro?.message || erro
    );
  }

  try {
    const galeria = $w(IDS.galeria);

    if (typeof galeria.hide === "function") {
      tarefas.push(galeria.hide());
    }
  } catch (erro) {
    console.warn(
      "Falha ao ocultar a galeria durante o processamento:",
      erro?.message || erro
    );
  }

  await Promise.allSettled(tarefas);

  /*
    O relógio começa somente depois que o HTML terminou de expandir/aparecer.
    Assim, quando a entrega já está pronta (ex.: link aberto pelo e-mail),
    a impressora permanece realmente visível por pelo menos 3 segundos.
  */
  if (!processamentoVisivelDesde) {
    processamentoVisivelDesde = Date.now();
  }
}

async function esconderProcessamento() {
  try {
    if (processamentoVisivelDesde) {
      const tempoVisivel =
        Date.now() - processamentoVisivelDesde;

      const restante =
        MIN_PROCESSAMENTO_VISIVEL - tempoVisivel;

      if (restante > 0) {
        await esperar(restante);
      }
    }

    await $w(IDS.processando).hide();
    await $w(IDS.processando).collapse();
    processamentoVisivelDesde = 0;
  } catch (erro) {
    console.warn(
      "Falha ao esconder o HTML de processamento:",
      erro?.message || erro
    );
  }
}

function entregaProcessada(resultado) {
  const projeto = resultado?.project || {};
  const tipo = safe(resultado?.session?.tipoProduto).toUpperCase();

  const statusProcessamento =
    safe(projeto.statusProcessamento)
      .toUpperCase();

  /*
    Quando o Make já iniciou o processamento, a galeria
    só é liberada depois de PROCESSADO. Isso impede que
    o primeiro gráfico apareça enquanto os demais ainda
    estão sendo importados. Registros antigos sem status
    continuam compatíveis pela existência do arquivo.
  */
  if (
    statusProcessamento &&
    statusProcessamento !== "PROCESSADO"
  ) {
    return false;
  }

  if (tipo === "PROJETO_COMPLETO") {
    return Boolean(safe(projeto.pdfProjeto));
  }

  if (tipo === "GRAFICOS") {
    return Array.isArray(projeto.imagensGraficos) &&
      projeto.imagensGraficos.filter(Boolean).length > 0;
  }

  return Boolean(safe(projeto.imagemMedidas));
}

// ======================================================
// ACESSOS LOCAIS
// ======================================================

function salvarAcessosLocais(
  codigoProjeto,
  acessos = {}
) {
  const codigo =
    digits(
      codigoProjeto
    );

  if (!codigo) {
    return;
  }

  try {
    local.setItem(
      `pp_acessos_${codigo}`,

      JSON.stringify({
        medidas:
          acessos.medidas ===
          true,

        graficos:
          acessos.graficos ===
          true,

        projeto:
          acessos.projeto ===
          true,

        atualizadoEm:
          new Date()
            .toISOString()
      })
    );

  } catch (erro) {
    console.warn(
      "Falha ao salvar acessos locais:",
      erro?.message ||
      erro
    );
  }
}


async function forcarElementoVisivel(id) {
  try {
    const elemento = $w(id);

    if (typeof elemento.expand === "function") {
      await elemento.expand();
    }

    if (typeof elemento.show === "function") {
      await elemento.show();
    }
  } catch (erro) {
    console.warn(
      `Elemento de aviso não encontrado ${id}:`,
      erro?.message || erro
    );
  }
}

async function esconderElementoAviso(id) {
  try {
    const elemento = $w(id);

    if (typeof elemento.hide === "function") {
      await elemento.hide();
    }

    if (typeof elemento.collapse === "function") {
      await elemento.collapse();
    }
  } catch (erro) {
    console.warn(
      `Não foi possível esconder o aviso ${id}:`,
      erro?.message || erro
    );
  }
}

function pintarBoxEtapa(id, pago) {
  try {
    const box = $w(id);

    /*
      Na entrega desktop todos os banners continuam brancos.
      Etapa paga recebe borda verde e mantém a sombra configurada no Editor.
    */
    box.style.backgroundColor = "#FFFFFF";
    box.style.borderColor = pago ? CORES.compradoBorda : "#E0E0E0";
    box.style.borderWidth = pago ? "2px" : "1px";
  } catch (_) {}
}

function destacarBoxEtapa(id) {
  try {
    const box = $w(id);
    box.style.backgroundColor = "#FFFFFF";
    box.style.borderColor = CORES.compradoBorda;
    box.style.borderWidth = "2px";
  } catch (_) {}
}

function etapaDisponivelParaCompra(tipo) {
  const acessos = entrega?.access || {};

  if (tipo === "GRAFICOS") {
    return acessos.medidas === true && acessos.graficos !== true;
  }

  if (tipo === "PROJETO_COMPLETO") {
    return acessos.graficos === true && acessos.projeto !== true;
  }

  return false;
}

function ligarHoverEtapa(
  botaoId,
  boxId,
  tipo,
  chaveAcesso
) {
  if (wixWindowFrontend.formFactor !== "Desktop") {
    return;
  }

  try {
    const botao = $w(botaoId);

    botao.onMouseIn(() => {
      if (etapaDisponivelParaCompra(tipo)) {
        destacarBoxEtapa(boxId);
      }
    });

    botao.onMouseOut(() => {
      pintarBoxEtapa(
        boxId,
        entrega?.access?.[chaveAcesso] === true
      );
    });
  } catch (erro) {
    console.warn(
      `Não foi possível ligar o hover do banner ${boxId}:`,
      erro?.message || erro
    );
  }
}

async function mostrarAvisosEntrega() {
  const acessos = entrega?.access || {};
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  const etapas = [
    { id: IDS.boxMedidas, pago: acessos.medidas === true },
    { id: IDS.boxGraficos, pago: acessos.graficos === true },
    { id: IDS.boxProjeto, pago: acessos.projeto === true }
  ];

  await forcarElementoVisivel(IDS.avisosEtapas);

  for (const etapa of etapas) {
    pintarBoxEtapa(etapa.id, etapa.pago);

    /*
      REGRA DA ENTREGA:
      - Desktop: todos os banners aparecem; pago fica com borda verde.
      - Mobile: o banner referente à etapa paga some e recolhe espaço.
      - Visibilidade é aplicada diretamente pelos IDs dos boxes.
    */
    if (mobile && etapa.pago) {
      await esconderElementoAviso(etapa.id);
    } else {
      await forcarElementoVisivel(etapa.id);
    }
  }

  /* IMPORTANTE aparece sempre, em qualquer dispositivo. */
  await forcarElementoVisivel(IDS.avisoImportante);
  await forcarElementoVisivel("#box4");
}


// ======================================================
// VISUAL DOS BOTÕES
// ======================================================

function pintarBotao(
  botao,
  fundo,
  texto,
  borda
) {
  try {
    botao.style
      .backgroundColor =
        fundo;

    botao.style.color =
      texto;

    botao.style
      .borderColor =
        borda;

    botao.style
      .borderRadius =
        "999px";

    botao.style
      .borderWidth =
        "1px";

  } catch (erro) {
    console.warn(
      "O modelo do botão não aceitou todas as cores:",
      erro?.message ||
      erro
    );
  }
}


function marcarBoxComprado(id) {
  try {
    const box = $w(id);
    box.style.backgroundColor = "#E8F5ED";
    box.style.borderColor = CORES.compradoBorda;
    box.style.borderWidth = "2px";
  } catch (erro) {
    console.warn(
      "Não foi possível marcar a caixa da etapa como comprada:",
      erro?.message || erro
    );
  }
}

async function definirComprado(
  botao,
  label
) {
  botao.label =
    label;

  pintarBotao(
    botao,
    CORES.compradoFundo,
    CORES.compradoTexto,
    CORES.compradoBorda
  );

  await botao.enable();
}


async function definirDisponivel(
  botao,
  label
) {
  botao.label =
    label;

  pintarBotao(
    botao,
    CORES.normalFundo,
    CORES.normalTexto,
    CORES.normalBorda
  );

  await botao.enable();
}


async function definirBloqueado(
  botao,
  label
) {
  botao.label =
    label;

  pintarBotao(
    botao,
    CORES.bloqueadoFundo,
    CORES.bloqueadoTexto,
    CORES.bloqueadoBorda
  );

  await botao.disable();
}


// ======================================================
// TEXTO E GALERIA
// ======================================================

function textoEntrega(
  acessos = {}
) {
  if (
    acessos.projeto ===
    true
  ) {
    return (
      "Pagamento confirmado. " +
      "Projeto completo liberado."
    );
  }

  if (
    acessos.graficos ===
    true
  ) {
    return (
      "Pagamento confirmado. " +
      "Medidas e análises gráficas liberadas."
    );
  }

  if (
    acessos.medidas ===
    true
  ) {
    return (
      "Pagamento confirmado. " +
      "Medidas liberadas."
    );
  }

  return (
    "Confirmando os produtos liberados..."
  );
}


function imagensLiberadas(
  projeto,
  acessos = {}
) {
  const imagens =
    [];

  if (
    acessos.medidas &&
    safe(
      projeto?.imagemMedidas
    )
  ) {
    imagens.push({
      src:
        safe(
          projeto.imagemMedidas
        ),

      title:
        `Medidas do projeto #${projeto.codigoProjeto}`
    });
  }

  if (
    acessos.graficos
  ) {
    const graficos =
      Array.isArray(
        projeto?.imagensGraficos
      )
        ? projeto.imagensGraficos
        : [];

    graficos
      .filter(Boolean)
      .forEach(
        (
          url,
          indice
        ) => {
          imagens.push({
            src:
              safe(url),

            title:
              `Análise gráfica ${indice + 1} ` +
              `do projeto #${projeto.codigoProjeto}`
          });
        }
      );
  }

  return imagens;
}


async function mostrarGaleria() {
  if (!entrega) {
    return;
  }

  const projeto =
    entrega.project;

  const acessos =
    entrega.access || {};

  alterarDescricao(
    textoEntrega(
      acessos
    )
  );

  const imagens =
    imagensLiberadas(
      projeto,
      acessos
    );

  if (
    !imagens.length
  ) {
    await $w(
      IDS.galeria
    ).hide();

    await $w(
      IDS.galeria
    ).collapse();

    return;
  }

  $w(
    IDS.galeria
  ).items =
    imagens.map(
      (
        imagem
      ) => ({
        type:
          "image",

        src:
          imagem.src,

        title:
          imagem.title,

        description:
          ""
      })
    );

  await $w(
    IDS.galeria
  ).expand();

  await $w(
    IDS.galeria
  ).show();
}


// ======================================================
// NOMES DOS DOWNLOADS
// ======================================================

function nomeSeguro(
  valor
) {
  return safe(valor)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      "-"
    )
    .replace(
      /-+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );
}


function nomeClienteEntrega() {
  return firstValue(
    entrega?.client?.nome,
    entrega?.project?.nomeCliente,
    entrega?.session?.nomeCliente,
    "CLIENTE"
  );
}


function extensaoArquivo(
  url,
  extensaoPadrao
) {
  const limpa =
    safe(url)
      .split("#")[0]
      .split("?")[0];

  const resultado =
    limpa.match(
      /\.(pdf|webp|png|jpe?g|gif|bmp|tiff?)$/i
    );

  if (
    !resultado?.[1]
  ) {
    return (
      safe(
        extensaoPadrao
      ) ||
      "webp"
    );
  }

  return resultado[1]
    .toLowerCase()
    .replace(
      "jpeg",
      "jpg"
    );
}


function nomeArquivoDownload(
  url,
  etapa,
  extensaoPadrao
) {
  const codigo =
    digits(
      entrega
        ?.project
        ?.codigoProjeto
    ) ||
    "PROJETO";

  const cliente =
    nomeSeguro(
      nomeClienteEntrega()
    ) ||
    "CLIENTE";

  const produto =
    nomeSeguro(
      etapa
    ) ||
    "ARQUIVO";

  const extensao =
    extensaoArquivo(
      url,
      extensaoPadrao
    );

  return (
    `PP-${codigo}-${cliente}-` +
    `${produto}.${extensao}`
  );
}


// ======================================================
// DOWNLOADS
// ======================================================

async function baixarArquivo(
  url,
  etapa,
  extensaoPadrao,
  permitirFallback = false
) {
  const arquivo =
    safe(url);

  if (
    !arquivo ||
    downloadEmAndamento
  ) {
    return;
  }

  downloadEmAndamento =
    true;

  try {
    const link =
      await gerarLinkDownloadImagem(
        arquivo,

        nomeArquivoDownload(
          arquivo,
          etapa,
          extensaoPadrao
        )
      );

    if (
      !safe(link)
    ) {
      throw new Error(
        "O Wix não devolveu o link de download."
      );
    }

    downloadEmAndamento =
      false;

    wixLocation.to(
      link
    );

  } catch (erro) {
    downloadEmAndamento =
      false;

    console.error(
      "Erro ao preparar download:",
      erro?.message ||
      erro,
      erro
    );

    if (
      permitirFallback &&
      arquivo
    ) {
      wixLocation.to(
        arquivo
      );

      return;
    }

    alterarDescricao(
      "Não foi possível preparar o download agora. Tente novamente."
    );
  }
}


async function baixarMedidas() {
  const projeto =
    entrega?.project;

  if (
    !entrega
      ?.access
      ?.medidas ||
    !safe(
      projeto?.imagemMedidas
    )
  ) {
    return;
  }

  await baixarArquivo(
    projeto.imagemMedidas,
    "MEDIDAS",
    "webp"
  );
}


async function baixarProximoGrafico() {
  const projeto =
    entrega?.project;

  const graficos =
    Array.isArray(
      projeto?.imagensGraficos
    )
      ? projeto
          .imagensGraficos
          .filter(Boolean)
      : [];

  if (
    !entrega
      ?.access
      ?.graficos ||
    !graficos.length
  ) {
    alterarDescricao(
      "Nenhuma imagem gráfica foi encontrada para download."
    );

    return;
  }

  if (
    indiceGraficoDownload >=
    graficos.length
  ) {
    indiceGraficoDownload =
      0;
  }

  const indiceAtual =
    indiceGraficoDownload;

  indiceGraficoDownload +=
    1;

  if (
    graficos.length >
    1
  ) {
    alterarDescricao(
      `Baixando gráfico ${indiceAtual + 1} de ${graficos.length}. ` +
      "Clique novamente para baixar o próximo."
    );
  }

  await baixarArquivo(
    graficos[
      indiceAtual
    ],

    `GRAFICO-${indiceAtual + 1}`,

    "webp"
  );
}


async function baixarProjetoCompleto() {
  const projeto =
    entrega?.project;

  if (
    !entrega
      ?.access
      ?.projeto ||
    !safe(
      projeto?.pdfProjeto
    )
  ) {
    return;
  }

  await baixarArquivo(
    projeto.pdfProjeto,
    "PROJETO-COMPLETO",
    "pdf",
    true
  );
}


// ======================================================
// CHECKOUT DAS PRÓXIMAS ETAPAS
// ======================================================

function tituloBaseProjeto(
  titulo
) {
  return safe(titulo)
    /*
      Remove o código do projeto no início.
      Exemplos: "#123", "# 123 -", "#123:".
    */
    .replace(
      /^\s*#\s*\d+\s*[-–—|:]?\s*/i,
      ""
    )

    /*
      Remove prefixos já existentes para impedir títulos
      duplicados, como:
      "PROJETO COMPLETO PARA PROJETO PRONTO PARA..."
    */
    .replace(
      /^\s*(?:PROJETO\s+PRONTO|PROJETO\s+COMPLETO)\s*(?:PARA|DE)?\s*[-–—|:]?\s*/i,
      ""
    )
    .replace(
      /^\s*AN[ÁA]LISES?\s+GR[ÁA]FICAS(?:\s+DO\s+PROJETO\s+PRONTO)?\s*(?:PARA|DE)?\s*[-–—|:]?\s*/i,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function montarTituloPagina(projeto) {
  /*
    O título da página de entrega vem diretamente da coluna titulo.
    Não acrescenta código, não remove prefixo e não altera maiúsculas/minúsculas.
  */
  return safe(projeto?.titulo);
}

function montarTituloCheckout(
  tipo,
  projeto
) {
  const codigo =
    digits(
      projeto?.codigoProjeto
    );

  const tituloBase =
    tituloBaseProjeto(
      projeto?.titulo
    ) ||
    "PROJETO PRONTO";

  const prefixo =
    codigo
      ? `#${codigo} `
      : "";

  if (
    tipo ===
    "GRAFICOS"
  ) {
    return (
      prefixo +
      "ANÁLISES GRÁFICAS: " +
      tituloBase
    );
  }

  return (
    prefixo +
    "PROJETO COMPLETO: " +
    tituloBase
  );
}


function identidadeEntrega() {
  const cliente =
    entrega?.client || {};

  const sessao =
    entrega?.session || {};

  const projeto =
    entrega?.project || {};

  const telefoneBruto =
    firstValue(
      cliente.whatsapp,
      sessao.whatsapp
    );

  const telefoneDigitos =
    digits(
      telefoneBruto
    );

  const temDdiBrasil =
    telefoneDigitos
      .startsWith("55") &&
    telefoneDigitos
      .length >= 12;

  const whatsapp =
    temDdiBrasil
      ? telefoneDigitos
          .slice(2)
      : telefoneDigitos;

  const whatsappE164 =
    telefoneDigitos
      ? (
        temDdiBrasil
          ? `+${telefoneDigitos}`
          : `+55${telefoneDigitos}`
      )
      : "";

  return {
    clienteId:
      firstValue(
        cliente.clienteId,
        cliente._id,
        projeto.clienteId,
        sessao.clienteId
      ),

    nome:
      firstValue(
        cliente.nome,
        cliente.title,
        projeto.nomeCliente,
        sessao.nomeCliente
      ),

    email:
      normalizarEmail(
        firstValue(
          cliente.email,
          sessao.email
        )
      ),

    whatsapp,

    whatsappE164,

    ddi:
      "55",

    country:
      "br"
  };
}


function dadosCheckout(tipo, projeto, valor) {
  const codigoProjeto=digits(projeto?.codigoProjeto);
  const numero=Number(valor||0);
  if(!codigoProjeto||!(numero>0))return null;
  return {tipoProduto:safe(tipo).toUpperCase(),codigoProjeto,productId:safe(projeto?.productId),titulo:safe(projeto?.titulo),imagem:safe(projeto?.thumbnail),valor:numero};
}

function montarUrlCheckout(tipo, projeto, valor) {
  const dados=dadosCheckout(tipo,projeto,valor);if(!dados)return "";
  const parametros={codigoProjeto:dados.codigoProjeto,codigo:dados.codigoProjeto,titulo:dados.titulo,produto:dados.titulo,name:dados.titulo,tituloOriginal:dados.titulo,productId:dados.productId,imagem:dados.imagem,img:dados.imagem,valor:dados.valor,price:dados.valor,tipoProduto:dados.tipoProduto,returnUrl:`/checkoutprojetosprontos?codigo=${dados.codigoProjeto}`};
  const query=Object.entries(parametros).filter(([,v])=>v!==undefined&&v!==null&&String(v).trim()!=="").map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `/checkout-projeto-pronto?${query}`;
}

async function abrirCheckout(
  tipo
) {
  if (
    checkoutEmAndamento ||
    !entrega?.project
  ) {
    return;
  }

  const projeto =
    entrega.project;

  const valor =
    tipo === "GRAFICOS"
      ? Number(
        projeto.valorGraficos ||
        0
      )
      : Number(
        projeto.valorProjeto ||
        0
      );

  if (
    !(valor > 0)
  ) {
    alterarDescricao(
      tipo === "GRAFICOS"
        ? "O valor das análises gráficas ainda não foi cadastrado."
        : "O valor do projeto completo ainda não foi cadastrado."
    );

    return;
  }

  const destino =
    montarUrlCheckout(
      tipo,
      projeto,
      valor
    );

  if (!destino) {
    alterarDescricao(
      "Não foi possível preparar a próxima etapa."
    );

    return;
  }

  /*
    Todas as próximas compras seguem agora para
    o checkout transparente da ValidaPay.

    Não existe mais chamada direta ao Mercado Pago
    nesta página.
  */

  checkoutEmAndamento =
    true;

  alterarDescricao(
    "Abrindo o pagamento..."
  );

  wixLocation.to(
    destino
  );
}


// ======================================================
// VÍDEO DO PROJETO
// ======================================================

function normalizarVideoUrl(
  valor
) {
  const url =
    safe(valor);

  if (!url) {
    return "";
  }

  if (
    /^https?:\/\//i.test(
      url
    )
  ) {
    return url;
  }

  if (
    /^(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(
      url
    )
  ) {
    return `https://${url}`;
  }

  return "";
}


function linkVideoDoItem(
  item
) {
  return normalizarVideoUrl(
    firstValue(
      item?.link_video,
      item?.linkVideo,
      item?.url_video,
      item?.urlVideo,
      item?.youtube,
      item?.youtubeUrl
    )
  );
}


async function buscarItemProjetoVideo(
  codigoProjeto
) {
  const codigo =
    digits(
      codigoProjeto
    );

  if (!codigo) {
    return null;
  }

  const codigoNumerico =
    Number(
      codigo
    );

  if (
    Number.isSafeInteger(
      codigoNumerico
    )
  ) {
    try {
      const resultado =
        await wixData
          .query(
            "Videosprojetos"
          )
          .eq(
            "ordem_video",
            codigoNumerico
          )
          .limit(1)
          .find();

      if (
        resultado.items.length
      ) {
        return resultado
          .items[0];
      }

    } catch (erro) {
      console.warn(
        "Busca numérica do vídeo falhou:",
        erro?.message ||
        erro
      );
    }
  }

  try {
    const resultado =
      await wixData
        .query(
          "Videosprojetos"
        )
        .eq(
          "ordem_video",
          codigo
        )
        .limit(1)
        .find();

    if (
      resultado.items.length
    ) {
      return resultado
        .items[0];
    }

  } catch (erro) {
    console.warn(
      "Busca textual do vídeo falhou:",
      erro?.message ||
      erro
    );
  }

  try {
    const resultado =
      await wixData
        .query(
          "Videosprojetos"
        )
        .startsWith(
          "titulo_video",
          `#${codigo}`
        )
        .limit(1)
        .find();

    return resultado
      .items
      .length
      ? resultado.items[0]
      : null;

  } catch (erro) {
    console.warn(
      "Busca do vídeo pelo título falhou:",
      erro?.message ||
      erro
    );

    return null;
  }
}


async function esconderBotaoVideo() {
  videoUrl =
    "";

  try {
    const botao =
      $w(
        IDS.video
      );

    await botao.disable();
    await botao.hide();

  } catch (erro) {
    /*
      O botão do vídeo é complementar.

      Qualquer erro nele não pode interromper
      título, galeria, botões ou entrega.
    */

    console.warn(
      "Não foi possível esconder o botão do vídeo:",
      erro?.message ||
      erro
    );
  }
}


async function prepararBotaoVideo() {
  if (
    videoCarregando ||
    !entrega?.project
  ) {
    return;
  }

  if (
    entrega
      ?.access
      ?.medidas !==
      true
  ) {
    await esconderBotaoVideo();

    return;
  }

  videoCarregando =
    true;

  try {
    const codigoProjeto =
      digits(
        entrega
          ?.project
          ?.codigoProjeto
      );

    const item =
      await buscarItemProjetoVideo(
        codigoProjeto
      );

    const url =
      linkVideoDoItem(
        item
      );

    if (!url) {
      await esconderBotaoVideo();

      return;
    }

    videoUrl =
      url;

    const botao =
      $w(
        IDS.video
      );

    botao.label =
      "VÍDEO";

    /*
      O endereço é configurado diretamente
      como link do botão.

      _blank mantém a página da entrega aberta
      e abre o YouTube em uma nova aba.
    */

    botao.link =
      videoUrl;

    botao.target =
      "_blank";

    await botao.enable();
    await botao.show();

  } catch (erro) {
    console.error(
      "Erro ao preparar o vídeo:",
      erro?.message ||
      erro,
      erro
    );

    await esconderBotaoVideo();

  } finally {
    videoCarregando =
      false;
  }
}


// ======================================================
// VALORES E ESTADOS DAS ETAPAS
// ======================================================

function valorEtapa(
  etapa,
  valorPadrao
) {
  const valor =
    Number(
      etapa?.valorPago ||
      valorPadrao ||
      0
    );

  return Number.isFinite(
    valor
  )
    ? valor
    : 0;
}


async function renderizarBotoes() {
  const acessos =
    entrega.access || {};

  const etapas =
    entrega.stages || {};

  const projeto =
    entrega.project || {};

  const medidasPaga =
    acessos.medidas === true;

  const graficosPaga =
    acessos.graficos === true;

  const projetoPago =
    acessos.projeto === true;

  pintarBoxEtapa(IDS.boxMedidas, medidasPaga);
  pintarBoxEtapa(IDS.boxGraficos, graficosPaga);
  pintarBoxEtapa(IDS.boxProjeto, projetoPago);

  const valorMedidas =
    valorEtapa(
      etapas.medidas,
      projeto.valorMedidas
    );

  const valorGraficos =
    valorEtapa(
      etapas.graficos,
      projeto.valorGraficos
    );

  const valorProjeto =
    valorEtapa(
      etapas.projeto,
      projeto.valorProjeto
    );

  $w(
    IDS.valorMedidas
  ).text =
    medidasPaga
      ? (
        "PAGO — " +
        dinheiro(
          valorMedidas
        )
      )
      : dinheiro(
        valorMedidas
      );

  $w(
    IDS.valorGraficos
  ).text =
    graficosPaga
      ? (
        "PAGO — " +
        dinheiro(
          valorGraficos
        )
      )
      : dinheiro(
        valorGraficos
      );

  $w(
    IDS.valorProjeto
  ).text =
    projetoPago
      ? (
        "PAGO — " +
        dinheiro(
          valorProjeto
        )
      )
      : dinheiro(
        valorProjeto
      );


  // ETAPA 1

  if (
    medidasPaga
  ) {
    await definirComprado(
      $w(
        IDS.medidas
      ),

      "BAIXAR MEDIDAS"
    );

  } else {
    await definirBloqueado(
      $w(
        IDS.medidas
      ),

      "BAIXAR MEDIDAS"
    );
  }


  // ETAPA 2

  if (
    graficosPaga
  ) {
    await definirComprado(
      $w(
        IDS.graficos
      ),

      "BAIXAR GRÁFICOS"
    );

  } else if (
    medidasPaga
  ) {
    await definirDisponivel(
      $w(
        IDS.graficos
      ),

      "COMPRAR GRÁFICOS"
    );

  } else {
    await definirBloqueado(
      $w(
        IDS.graficos
      ),

      "COMPRAR GRÁFICOS"
    );
  }


  // ETAPA 3

  if (
    projetoPago
  ) {
    await definirComprado(
      $w(
        IDS.projeto
      ),

      "BAIXAR PROJETO COMPLETO"
    );

  } else if (
    graficosPaga
  ) {
    await definirDisponivel(
      $w(
        IDS.projeto
      ),

      "COMPRAR PROJETO COMPLETO"
    );

  } else {
    await definirBloqueado(
      $w(
        IDS.projeto
      ),

      "COMPRAR PROJETO COMPLETO"
    );
  }
}


// ======================================================
// EVENTOS
// ======================================================

function ligarEventos() {
  if (
    eventosLigados
  ) {
    return;
  }

  eventosLigados =
    true;

  $w(
    IDS.medidas
  ).onClick(
    async () => {
      if (
        entrega
          ?.access
          ?.medidas
      ) {
        await baixarMedidas();
      }
    }
  );

  $w(
    IDS.graficos
  ).onClick(
    async () => {
      if (
        entrega
          ?.access
          ?.graficos
      ) {
        await baixarProximoGrafico();

        return;
      }

      if (
        entrega
          ?.access
          ?.medidas
      ) {
        await abrirCheckout(
          "GRAFICOS"
        );
      }
    }
  );

  $w(
    IDS.projeto
  ).onClick(
    async () => {
      if (
        entrega
          ?.access
          ?.projeto
      ) {
        await baixarProjetoCompleto();

        return;
      }

      if (
        entrega
          ?.access
          ?.graficos
      ) {
        await abrirCheckout(
          "PROJETO_COMPLETO"
        );
      }
    }
  );

  /*
    No desktop, o banner da próxima etapa disponível para compra
    acompanha o hover do respectivo botão com borda verde.
    Etapas bloqueadas não recebem destaque e etapas já pagas
    continuam verdes normalmente.
  */
  ligarHoverEtapa(
    IDS.graficos,
    IDS.boxGraficos,
    "GRAFICOS",
    "graficos"
  );

  ligarHoverEtapa(
    IDS.projeto,
    IDS.boxProjeto,
    "PROJETO_COMPLETO",
    "projeto"
  );

  /*
    O botão do vídeo não usa onClick.

    O próprio link do botão, configurado em
    prepararBotaoVideo(), abre a nova aba.
  */
}


// ======================================================
// RENDERIZAR ENTREGA
// ======================================================

async function renderizarEntrega(
  dados
) {
  entrega =
    dados;

  checkoutEmAndamento =
    false;

  indiceGraficoDownload =
    0;

  const projeto =
    dados.project;

  $w(
    IDS.titulo
  ).text =
    montarTituloPagina(
      projeto
    );

  salvarAcessosLocais(
    projeto?.codigoProjeto,
    dados.access
  );

  /*
    Primeiro carrega tudo que já funcionava.
  */

  await renderizarBotoes();

  /*
    A impressora está sobre a galeria. Primeiro retiramos a impressora
    (respeitando o tempo mínimo de 3 s) e só depois revelamos a imagem.
  */
  await esconderProcessamento();

  await mostrarGaleria();

  /*
    Só agora os textos e botões recebem conteúdo real e podem aparecer.
    Assim os placeholders do Editor nunca ficam expostos durante a espera.
  */
  await mostrarDadosCarregados();

  await mostrarAvisosEntrega();

  /*
    Somente depois procura o vídeo.

    Nenhum erro de vídeo consegue impedir
    o carregamento da entrega.
  */

  prepararBotaoVideo()
    .catch(
      (
        erro
      ) => {
        console.error(
          "Falha ao carregar o vídeo:",
          erro?.message ||
          erro
        );
      }
    );
}


// ======================================================
// CARREGAR ENTREGA
// ======================================================

async function carregarEntrega() {
  const checkoutId =
    safe(
      wixLocation
        .query
        .checkout_id ||
      wixLocation
        .query
        .checkoutId
    );

  const token =
    safe(
      wixLocation
        .query
        .token
    );

  if (
    !checkoutId &&
    !token
  ) {
    alterarDescricao(
      "Link de entrega inválido: identificação da compra não encontrada."
    );

    await $w(
      IDS.galeria
    ).hide();

    await esconderBotaoVideo();

    return;
  }

  alterarDescricao(
    "Pagamento recebido. Preparando sua entrega..."
  );

  for (
    let tentativa = 1;
    tentativa <= MAX_TENTATIVAS;
    tentativa += 1
  ) {
    try {
      const resultado =
        await buscarEntregaProjetoPronto({
          checkoutId,
          token
        });

      if (
        !resultado?.ok
      ) {
        /*
          Logo após o pagamento, o webhook ainda pode
          estar terminando o registro.

          Durante as primeiras tentativas, continua
          aguardando em vez de encerrar a página.
        */

        if (
          tentativa <
          MAX_TENTATIVAS
        ) {
          alterarDescricao(
            "Pagamento aprovado. Finalizando a liberação do produto..."
          );

          await esperar(
            INTERVALO
          );

          continue;
        }

        alterarDescricao(
          resultado?.error ===
            "PROJETO_NAO_ENCONTRADO"
            ? "O projeto comprado não foi encontrado na coleção."
            : "Não foi possível localizar esta entrega."
        );

        await esconderBotaoVideo();

        return;
      }

      if (
        resultado.approved
      ) {
        if (
          entregaProcessada(
            resultado
          )
        ) {
          await renderizarEntrega(
            resultado
          );

          return;
        }

        await mostrarProcessamento();

        alterarDescricao(
          "Pagamento aprovado. Estamos preparando seus arquivos..."
        );

        await esperar(
          INTERVALO
        );

        continue;
      }

      alterarDescricao(
        resultado.status ===
          "processing"
          ? "Pagamento aprovado. Finalizando o registro da compra..."
          : "Confirmando o pagamento..."
      );

      await esperar(
        INTERVALO
      );

    } catch (erro) {
      console.error(
        "Erro ao carregar entrega:",
        erro?.message ||
        erro,
        erro
      );

      if (
        tentativa ===
        MAX_TENTATIVAS
      ) {
        alterarDescricao(
          "Não foi possível consultar a compra agora. Atualize a página em alguns instantes."
        );

        await esconderBotaoVideo();

        return;
      }

      alterarDescricao(
        "Pagamento aprovado. Aguardando a liberação do produto..."
      );

      await esperar(
        INTERVALO
      );
    }
  }

  alterarDescricao(
    "O pagamento foi recebido, mas a liberação ainda está sendo finalizada. Atualize a página em alguns instantes."
  );

  await esconderBotaoVideo();
}


// ======================================================
// ON READY
// ======================================================

$w.onReady(
  function () {
    checkoutEmAndamento =
      false;

    /*
      PRIMEIRO A IMPRESSORA.
      Nenhuma limpeza de placeholder, vídeo, botão ou consulta de coleção
      entra na frente dela. O navegador recebe o comando de exibição logo
      no começo do onReady; todo o restante continua assíncrono.
    */
    const impressoraPronta =
      mostrarProcessamento()
        .catch(
          (erro) => {
            console.error(
              "Falha ao abrir a impressora da entrega:",
              erro?.message || erro
            );
          }
        );

    ocultarDadosAteCarregamento()
      .catch(
        (erro) => {
          console.warn(
            "Falha ao ocultar placeholders da entrega:",
            erro?.message || erro
          );
        }
      );

    esconderBotaoVideo()
      .catch(
        (erro) => {
          console.warn(
            "Falha ao esconder botão de vídeo no início:",
            erro?.message || erro
          );
        }
      );

    ligarEventos();

    Promise.allSettled([
      $w(IDS.medidas).disable(),
      $w(IDS.graficos).disable(),
      $w(IDS.projeto).disable()
    ]).catch(() => {});

    /*
      A consulta da compra só começa depois que a tentativa de exibir a
      impressora terminou. Assim o primeiro trabalho pesado da página não
      compete com o primeiro paint do processamento.
    */
    impressoraPronta.finally(
      () => {
        carregarEntrega()
          .catch(
            (erro) => {
              console.error(
                "Falha assíncrona ao carregar a entrega:",
                erro?.message || erro
              );

              alterarDescricao(
                "Pagamento recebido. A entrega ainda está sendo preparada. Atualize a página em alguns instantes."
              );
            }
          );
      }
    );
  }
);
