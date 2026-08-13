from pathlib import Path
import re

PAGE = Path("src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js")
text = PAGE.read_text(encoding="utf-8")

old = 'const IDS = {\n  titulo:'
new = 'const IDS = {\n  repetidor:\n    "#repetidopaginadeentrega",\n\n  titulo:'
assert old in text, "âncora IDS não encontrada"
text = text.replace(old, new, 1)

old = 'let codigoSegundaViaAtual =\n  "";\n'
new = 'let codigoSegundaViaAtual =\n  "";\n\nconst indiceGraficoPorProjeto =\n  new Map();\n'
assert old in text, "âncora estado não encontrada"
text = text.replace(old, new, 1)

inicio = text.index('// ======================================================\n// CENTRAL DE SEGUNDAS VIAS')
fim = text.index('// ======================================================\n// RENDERIZAR ENTREGA', inicio)

bloco = r'''// ======================================================
// REPEATER — 1 ITEM = 1 PROJETO
// ======================================================

function itemIdProjeto(dados, indice = 0) {
  const codigo = digits(dados?.project?.codigoProjeto);
  return codigo ? `projeto-${codigo}` : `projeto-${indice + 1}`;
}

function itemRepeaterProjeto(dados, indice = 0) {
  return {
    _id: itemIdProjeto(dados, indice),
    tipo: "PROJETO",
    dados
  };
}

function itemRepeaterMensagem(titulo, descricao) {
  return {
    _id: "estado-central",
    tipo: "MENSAGEM",
    titulo: safe(titulo),
    descricao: safe(descricao)
  };
}

async function esconderItem($item, id, recolher = false) {
  try {
    const elemento = $item(id);
    if (typeof elemento.hide === "function") {
      await elemento.hide();
    }
    if (recolher && typeof elemento.collapse === "function") {
      await elemento.collapse();
    }
  } catch (_) {}
}

async function mostrarItem($item, id) {
  try {
    const elemento = $item(id);
    if (typeof elemento.expand === "function") {
      await elemento.expand();
    }
    if (typeof elemento.show === "function") {
      await elemento.show();
    }
  } catch (_) {}
}

function textoItem($item, id, valor) {
  try {
    $item(id).text = safe(valor);
  } catch (_) {}
}

function pintarBoxItem($item, id, pago) {
  try {
    const box = $item(id);
    box.style.backgroundColor = "#FFFFFF";
    box.style.borderColor = pago ? CORES.compradoBorda : "#E0E0E0";
    box.style.borderWidth = pago ? "2px" : "1px";
  } catch (_) {}
}

async function renderizarMensagemRepeater($item, itemData) {
  textoItem($item, IDS.titulo, itemData.titulo || "SEUS PROJETOS PRONTOS");
  textoItem($item, IDS.descricao, itemData.descricao);

  await mostrarItem($item, IDS.titulo);
  await mostrarItem($item, IDS.descricao);

  try {
    $item(IDS.galeria).items = [];
  } catch (_) {}

  const esconder = [
    IDS.galeria,
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
  ];

  await Promise.allSettled(
    esconder.map((id) => esconderItem($item, id, false))
  );
}

async function renderizarGaleriaItem($item, dados) {
  const projeto = dados?.project || {};
  const acessos = dados?.access || {};
  const imagens = imagensLiberadas(projeto, acessos);
  const galeria = $item(IDS.galeria);

  if (!imagens.length) {
    galeria.items = [];
    await esconderItem($item, IDS.galeria, false);
    return;
  }

  galeria.items = imagens.map((imagem) => ({
    type: "image",
    src: imagem.src,
    title: imagem.title,
    description: ""
  }));

  await mostrarItem($item, IDS.galeria);
}

async function renderizarBotoesItem($item, dados) {
  const acessos = dados?.access || {};
  const etapas = dados?.stages || {};
  const projeto = dados?.project || {};

  const medidasPaga = acessos.medidas === true;
  const graficosPaga = acessos.graficos === true;
  const projetoPago = acessos.projeto === true;

  const valorMedidas = valorEtapa(etapas.medidas, projeto.valorMedidas);
  const valorGraficos = valorEtapa(etapas.graficos, projeto.valorGraficos);
  const valorProjeto = valorEtapa(etapas.projeto, projeto.valorProjeto);

  textoItem(
    $item,
    IDS.valorMedidas,
    medidasPaga ? `PAGO — ${dinheiro(valorMedidas)}` : dinheiro(valorMedidas)
  );
  textoItem(
    $item,
    IDS.valorGraficos,
    graficosPaga ? `PAGO — ${dinheiro(valorGraficos)}` : dinheiro(valorGraficos)
  );
  textoItem(
    $item,
    IDS.valorProjeto,
    projetoPago ? `PAGO — ${dinheiro(valorProjeto)}` : dinheiro(valorProjeto)
  );

  pintarBoxItem($item, IDS.boxMedidas, medidasPaga);
  pintarBoxItem($item, IDS.boxGraficos, graficosPaga);
  pintarBoxItem($item, IDS.boxProjeto, projetoPago);

  await Promise.allSettled([
    mostrarItem($item, IDS.medidas),
    mostrarItem($item, IDS.valorMedidas),
    mostrarItem($item, IDS.graficos),
    mostrarItem($item, IDS.valorGraficos),
    mostrarItem($item, IDS.projeto),
    mostrarItem($item, IDS.valorProjeto),
    mostrarItem($item, IDS.boxMedidas),
    mostrarItem($item, IDS.boxGraficos),
    mostrarItem($item, IDS.boxProjeto),
    mostrarItem($item, IDS.avisosEtapas),
    mostrarItem($item, IDS.avisoImportante),
    mostrarItem($item, "#box4")
  ]);

  if (medidasPaga) {
    await definirComprado($item(IDS.medidas), "BAIXAR MEDIDAS");
  } else {
    await definirBloqueado($item(IDS.medidas), "BAIXAR MEDIDAS");
  }

  if (graficosPaga) {
    await definirComprado($item(IDS.graficos), "BAIXAR GRÁFICOS");
  } else if (medidasPaga) {
    await definirDisponivel($item(IDS.graficos), "COMPRAR GRÁFICOS");
  } else {
    await definirBloqueado($item(IDS.graficos), "COMPRAR GRÁFICOS");
  }

  if (projetoPago) {
    await definirComprado($item(IDS.projeto), "BAIXAR PROJETO COMPLETO");
  } else if (graficosPaga) {
    await definirDisponivel($item(IDS.projeto), "COMPRAR PROJETO COMPLETO");
  } else {
    await definirBloqueado($item(IDS.projeto), "COMPRAR PROJETO COMPLETO");
  }
}

function nomeClienteDados(dados) {
  return firstValue(
    dados?.client?.nome,
    dados?.project?.nomeCliente,
    dados?.session?.nomeCliente,
    "CLIENTE"
  );
}

function nomeArquivoDownloadDados(dados, url, etapa, extensaoPadrao) {
  const codigo = digits(dados?.project?.codigoProjeto) || "PROJETO";
  const cliente = nomeSeguro(nomeClienteDados(dados)) || "CLIENTE";
  const produto = nomeSeguro(etapa) || "ARQUIVO";
  const extensao = extensaoArquivo(url, extensaoPadrao);
  return `PP-${codigo}-${cliente}-${produto}.${extensao}`;
}

async function baixarArquivoItem($item, dados, url, etapa, extensaoPadrao) {
  const arquivo = safe(url);
  if (!arquivo || downloadEmAndamento) {
    return;
  }

  downloadEmAndamento = true;

  try {
    const link = await gerarLinkDownloadImagem(
      arquivo,
      nomeArquivoDownloadDados(dados, arquivo, etapa, extensaoPadrao)
    );

    downloadEmAndamento = false;

    if (!safe(link)) {
      throw new Error("O Wix não devolveu o link de download.");
    }

    wixLocation.to(link);
  } catch (erro) {
    downloadEmAndamento = false;
    console.error(
      "Erro ao preparar download do item do repeater:",
      erro?.message || erro
    );
    textoItem(
      $item,
      IDS.descricao,
      "Não foi possível preparar o download agora. Tente novamente."
    );
  }
}

async function baixarMedidasItem($item, dados) {
  if (dados?.access?.medidas !== true) {
    return;
  }

  const arquivo = safe(dados?.project?.imagemMedidas);
  if (!arquivo) {
    textoItem($item, IDS.descricao, "A imagem de medidas ainda não está disponível.");
    return;
  }

  await baixarArquivoItem($item, dados, arquivo, "MEDIDAS", "webp");
}

async function baixarGraficoItem($item, dados) {
  if (dados?.access?.graficos !== true) {
    return;
  }

  const graficos = Array.isArray(dados?.project?.imagensGraficos)
    ? dados.project.imagensGraficos.filter(Boolean)
    : [];

  if (!graficos.length) {
    textoItem($item, IDS.descricao, "Nenhuma imagem gráfica foi encontrada para download.");
    return;
  }

  const codigo = digits(dados?.project?.codigoProjeto) || "PROJETO";
  let indice = Number(indiceGraficoPorProjeto.get(codigo) || 0);
  if (indice >= graficos.length) {
    indice = 0;
  }

  indiceGraficoPorProjeto.set(codigo, (indice + 1) % graficos.length);

  if (graficos.length > 1) {
    textoItem(
      $item,
      IDS.descricao,
      `Baixando gráfico ${indice + 1} de ${graficos.length}. Clique novamente para baixar o próximo.`
    );
  }

  await baixarArquivoItem(
    $item,
    dados,
    graficos[indice],
    `GRAFICO-${indice + 1}`,
    "webp"
  );
}

async function atualizarPdfItem(dados) {
  const codigoProjeto = digits(dados?.project?.codigoProjeto);
  if (!codigoProjeto) {
    return dados;
  }

  const checkoutId = safe(
    wixLocation.query.checkout_id || wixLocation.query.checkoutId
  );
  const token = safe(wixLocation.query.token);

  try {
    if (dados?.segundaVia === true || centralSegundasViasAtiva) {
      return await buscarSegundaViaProjetoPronto({ codigoProjeto });
    }

    if (checkoutId || token) {
      return await buscarEntregaProjetoPronto({ checkoutId, token });
    }
  } catch (erro) {
    console.warn(
      "Falha ao atualizar PDF do projeto no repeater:",
      erro?.message || erro
    );
  }

  return dados;
}

async function baixarProjetoItem($item, dados) {
  if (dados?.access?.projeto !== true) {
    return;
  }

  let atual = dados;
  let arquivo = safe(atual?.project?.pdfProjeto);

  for (let tentativa = 1; tentativa <= 5 && !arquivo; tentativa += 1) {
    textoItem($item, IDS.descricao, "Projeto completo pago. Localizando o PDF...");
    atual = await atualizarPdfItem(atual);
    arquivo = safe(atual?.project?.pdfProjeto);

    if (!arquivo && tentativa < 5) {
      await esperar(800);
    }
  }

  if (!arquivo) {
    textoItem(
      $item,
      IDS.descricao,
      "O PDF do projeto completo ainda está sendo finalizado. Tente novamente em alguns segundos."
    );
    return;
  }

  wixLocation.to(linkDownloadDiretoOneDrive(arquivo));
}

async function abrirCheckoutItem($item, dados, tipo) {
  if (checkoutEmAndamento || !dados?.project) {
    return;
  }

  const projeto = dados.project;
  const valor = tipo === "GRAFICOS"
    ? Number(projeto.valorGraficos || 0)
    : Number(projeto.valorProjeto || 0);

  if (!(valor > 0)) {
    textoItem(
      $item,
      IDS.descricao,
      tipo === "GRAFICOS"
        ? "O valor das análises gráficas ainda não foi cadastrado."
        : "O valor do projeto completo ainda não foi cadastrado."
    );
    return;
  }

  const destino = montarUrlCheckout(tipo, projeto, valor);
  if (!destino) {
    textoItem($item, IDS.descricao, "Não foi possível preparar a próxima etapa.");
    return;
  }

  checkoutEmAndamento = true;
  textoItem($item, IDS.descricao, "Abrindo o pagamento...");
  wixLocation.to(destino);
}

async function prepararVideoItem($item, dados) {
  if (dados?.access?.medidas !== true) {
    await esconderItem($item, IDS.video, true);
    return;
  }

  let url = normalizarVideoUrl(dados?.project?.videoUrl);

  if (!url) {
    const itemProjeto = await buscarItemProjetoVideo(
      dados?.project?.codigoProjeto
    );
    url = linkVideoDoItem(itemProjeto);
  }

  if (!url) {
    await esconderItem($item, IDS.video, true);
    return;
  }

  const botao = $item(IDS.video);
  botao.label = "VÍDEO";
  botao.link = url;
  botao.target = "_blank";
  await botao.enable();
  await mostrarItem($item, IDS.video);
}

function ligarEventosItem($item, dados) {
  try {
    $item(IDS.medidas).onClick(async () => {
      if (dados?.access?.medidas === true) {
        await baixarMedidasItem($item, dados);
      }
    });
  } catch (_) {}

  try {
    $item(IDS.graficos).onClick(async () => {
      if (dados?.access?.graficos === true) {
        await baixarGraficoItem($item, dados);
        return;
      }

      if (dados?.access?.medidas === true) {
        await abrirCheckoutItem($item, dados, "GRAFICOS");
      }
    });
  } catch (_) {}

  try {
    $item(IDS.projeto).onClick(async () => {
      if (dados?.access?.projeto === true) {
        await baixarProjetoItem($item, dados);
        return;
      }

      if (dados?.access?.graficos === true) {
        await abrirCheckoutItem($item, dados, "PROJETO_COMPLETO");
      }
    });
  } catch (_) {}
}

async function renderizarProjetoRepeater($item, dados) {
  const projeto = dados?.project || {};
  const acessos = dados?.access || {};

  textoItem($item, IDS.titulo, montarTituloPagina(projeto));
  textoItem($item, IDS.descricao, textoEntrega(acessos));

  await mostrarItem($item, IDS.titulo);
  await mostrarItem($item, IDS.descricao);

  await renderizarGaleriaItem($item, dados);
  await renderizarBotoesItem($item, dados);
  ligarEventosItem($item, dados);

  prepararVideoItem($item, dados).catch((erro) => {
    console.warn(
      "Falha ao preparar vídeo do item do repeater:",
      erro?.message || erro
    );
  });
}

async function renderizarItemRepeater($item, itemData) {
  if (itemData?.tipo === "MENSAGEM") {
    await renderizarMensagemRepeater($item, itemData);
    return;
  }

  if (itemData?.tipo !== "PROJETO" || !itemData?.dados) {
    await renderizarMensagemRepeater(
      $item,
      itemRepeaterMensagem(
        "SEUS PROJETOS PRONTOS",
        "Nenhum Projeto Pronto comprado foi encontrado nesta conta."
      )
    );
    return;
  }

  await renderizarProjetoRepeater($item, itemData.dados);
}

function configurarRepeater() {
  const repetidor = $w(IDS.repetidor);

  repetidor.onItemReady(($item, itemData) => {
    renderizarItemRepeater($item, itemData).catch((erro) => {
      console.error(
        "Falha ao renderizar projeto no repeater:",
        erro?.message || erro
      );
    });
  });
}

async function mostrarDadosRepeater(itens) {
  const repetidor = $w(IDS.repetidor);
  repetidor.data = itens;

  if (typeof repetidor.expand === "function") {
    await repetidor.expand();
  }
  if (typeof repetidor.show === "function") {
    await repetidor.show();
  }
}

async function carregarDetalhesDaCentral(resumos) {
  const completos = [];
  const tamanhoLote = 5;

  for (let inicioLote = 0; inicioLote < resumos.length; inicioLote += tamanhoLote) {
    const lote = resumos.slice(inicioLote, inicioLote + tamanhoLote);

    const resultados = await Promise.all(
      lote.map(async (item) => {
        try {
          const codigoProjeto = digits(item?.codigoProjeto);
          if (!codigoProjeto) {
            return null;
          }

          const detalhe = await buscarSegundaViaProjetoPronto({ codigoProjeto });
          return detalhe?.ok && detalhe?.approved ? detalhe : null;
        } catch (erro) {
          console.warn(
            "Falha ao carregar um projeto da central:",
            erro?.message || erro
          );
          return null;
        }
      })
    );

    completos.push(...resultados.filter(Boolean));
  }

  return completos;
}

// ======================================================
// CENTRAL DE SEGUNDAS VIAS
// ======================================================

async function carregarCentralSegundasVias() {
  centralSegundasViasAtiva = true;
  codigoSegundaViaAtual = "";
  entrega = null;
  projetosSegundaVia = [];

  try {
    const resultado = await listarProjetosProntosDoMembroAtual();
    await esconderProcessamento();

    if (!resultado?.ok) {
      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          resultado?.error === "LOGIN_NECESSARIO"
            ? "Entre na sua conta para consultar seus Projetos Prontos."
            : "Não foi possível consultar seus projetos agora."
        )
      ]);
      return;
    }

    projetosSegundaVia = Array.isArray(resultado.items)
      ? resultado.items
      : [];

    if (!projetosSegundaVia.length) {
      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          "Nenhum Projeto Pronto comprado foi encontrado nesta conta."
        )
      ]);
      return;
    }

    const detalhes = await carregarDetalhesDaCentral(projetosSegundaVia);

    if (!detalhes.length) {
      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          "As compras foram encontradas, mas os projetos ainda não puderam ser carregados. Atualize a página em instantes."
        )
      ]);
      return;
    }

    await mostrarDadosRepeater(
      detalhes.map((dados, indice) => itemRepeaterProjeto(dados, indice))
    );
  } catch (erro) {
    console.error(
      "Erro ao carregar central de Projetos Prontos:",
      erro?.message || erro
    );

    await esconderProcessamento();
    await mostrarDadosRepeater([
      itemRepeaterMensagem(
        "SEUS PROJETOS PRONTOS",
        "Não foi possível consultar seus projetos agora. Tente novamente em instantes."
      )
    ]);
  }
}

'''

text = text[:inicio] + bloco + text[fim:]

inicio = text.index('// ======================================================\n// RENDERIZAR ENTREGA')
fim = text.index('// ======================================================\n// CARREGAR ENTREGA', inicio)

render = r'''// ======================================================
// RENDERIZAR ENTREGA
// ======================================================

async function renderizarEntrega(dados) {
  entrega = dados;
  checkoutEmAndamento = false;
  indiceGraficoDownload = 0;

  const projeto = dados?.project || {};

  salvarAcessosLocais(
    projeto?.codigoProjeto,
    dados?.access || {}
  );

  await esconderProcessamento();

  await mostrarDadosRepeater([
    itemRepeaterProjeto(dados, 0)
  ]);
}


'''
text = text[:inicio] + render + text[fim:]

padrao = re.compile(
    r'\n\s*/\* Mostra titulo, valores e botoes assim que o pagamento aprova\. \*/.*?\n\s*if \(\n\s*entregaProcessada\(',
    re.S,
)
match = padrao.search(text)
assert match, "bloco de aprovação não encontrado"
sub = '\n        entrega = resultado;\n\n        if (\n          entregaProcessada('
text = text[:match.start()] + sub + text[match.end():]

inicio = text.index('// ======================================================\n// ON READY')
onready = r'''// ======================================================
// ON READY
// ======================================================

$w.onReady(function () {
  checkoutEmAndamento = false;

  try {
    configurarRepeater();
  } catch (erro) {
    console.error(
      "Não foi possível configurar #repetidopaginadeentrega:",
      erro?.message || erro
    );
    return;
  }

  /* Eventos antigos ficam no arquivo por compatibilidade, mas não são ligados. */
  void ligarEventos;

  const checkoutId = safe(
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
    });

  inicio.finally(() => {
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
  });
});
'''
text = text[:inicio] + onready

PAGE.write_text(text, encoding="utf-8")
print("Página refatorada para repeater por projeto.")
