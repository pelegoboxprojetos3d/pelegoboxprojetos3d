/**
 * BUSCADOR PELEGO BOX V5 • DASHBOARDS PROTEGIDOS
 * - Mostra campos úteis da linha, incluindo preço/valor quando existir.
 * - Seleciona a LINHA inteira ao abrir um resultado.
 * - Pesquisa tolerante a acentos/caixa.
 * - Não altera dados, fórmulas ou formatação da planilha.
 *
 * SUBSTITUA o conteúdo do arquivo BUSCADOR_PELEGO_BOX.gs por este.
 */

const PBX_BUSCADOR_MENU = '🔎 BUSCADOR';

function pbxEhDashboardProtegido_(sh) {
  const nome = sh && sh.getName ? sh.getName() : '';
  return nome === 'Dashboard_Mensal' || nome === 'Dashboard_Anual';
}


function pbxInstalarBuscador() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'pbxAoAbrirBuscador')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('pbxAoAbrirBuscador')
    .forSpreadsheet(ss)
    .onOpen()
    .create();

  pbxAoAbrirBuscador();

  SpreadsheetApp.getUi().alert(
    'Buscador PELEGO BOX V2 instalado.\n\nUse 🔎 BUSCADOR > Abrir buscador.'
  );
}

function pbxAoAbrirBuscador() {
  SpreadsheetApp.getUi()
    .createMenu(PBX_BUSCADOR_MENU)
    .addItem('Abrir buscador', 'pbxAbrirBuscador')
    .addItem('Ir para célula...', 'pbxIrParaCelulaPrompt')
    .addItem('Mostrar todas as linhas', 'pbxMostrarTodasLinhas')
    .addToUi();

  // Nos dashboards o buscador fica desativado para não ocultar linhas auxiliares.
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (pbxEhDashboardProtegido_(sh)) return;

  pbxMostrarTodasLinhasSilencioso_();
  pbxAbrirBuscador();
}

function pbxAbrirBuscador() {
  const html = HtmlService
    .createHtmlOutputFromFile('BuscadorPeleGoBox')
    .setTitle('BUSCADOR • PELEGO BOX');

  SpreadsheetApp.getUi().showSidebar(html);
}

function pbxInfoBuscador() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  return {
    planilha: ss.getName(),
    aba: sh.getName(),
    linhas: Math.max(0, sh.getLastRow() - 1),
    colunas: sh.getLastColumn(),
    desativado: pbxEhDashboardProtegido_(sh)
  };
}

function pbxBuscarNaAbaAtiva(texto, modo) {
  const termoOriginal = String(texto || '').trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();

  if (pbxEhDashboardProtegido_(sh)) {
    return {
      ok: true,
      desativado: true,
      aba: sh.getName(),
      resultados: [],
      total: 0,
      mensagem: 'Buscador desativado nesta aba para proteger o dashboard.'
    };
  }

  if (!termoOriginal) {
    pbxMostrarTodasLinhasSilencioso_();
    return {
      ok: true,
      aba: sh.getName(),
      resultados: [],
      total: 0,
      mensagem: 'Digite algo para pesquisar.'
    };
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();

  if (lastRow < 1 || lastCol < 1) {
    return {
      ok: true,
      aba: sh.getName(),
      resultados: [],
      total: 0,
      mensagem: 'A aba está vazia.'
    };
  }

  const valores = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = valores[0].map(v => String(v || '').trim());
  const termo = pbxNormalizarBusca_(termoOriginal);
  const exato = String(modo || 'contem') === 'exato';

  const resultados = [];
  const LIMITE = 250;

  // Começa na linha 2: cabeçalho nunca entra nos resultados.
  for (let r = 1; r < valores.length; r++) {
    const linha = valores[r];

    let primeiraColuna = -1;
    let primeiraCelula = '';
    let ocorrencias = 0;

    for (let c = 0; c < linha.length; c++) {
      const bruto = String(linha[c] == null ? '' : linha[c]);
      if (!bruto) continue;

      const celula = pbxNormalizarBusca_(bruto);
      const achou = exato ? celula === termo : celula.indexOf(termo) !== -1;

      if (achou) {
        ocorrencias++;
        if (primeiraColuna === -1) {
          primeiraColuna = c;
          primeiraCelula = bruto;
        }
      }
    }

    if (primeiraColuna !== -1) {
      const numeroLinha = r + 1;
      const numeroColuna = primeiraColuna + 1;
      const a1 = pbxColunaParaLetra_(numeroColuna) + numeroLinha;

      resultados.push({
        linha: numeroLinha,
        coluna: numeroColuna,
        a1: a1,
        valorEncontrado: pbxResumirTexto_(primeiraCelula, 90),
        ocorrencias: ocorrencias,
        destaque: pbxMontarDestaqueLinha_(headers, linha),
        campos: pbxMontarCamposLinha_(headers, linha)
      });

      if (resultados.length >= LIMITE) break;
    }
  }

  // A própria planilha vira a lista de resultados:
  // mostra apenas as linhas encontradas, sem apagar nem alterar dados.
  pbxAplicarFiltroVisual_(sh, resultados.map(r => r.linha), lastRow);

  return {
    ok: true,
    planilha: ss.getName(),
    aba: sh.getName(),
    total: resultados.length,
    limite: LIMITE,
    resultados: resultados,
    mensagem: resultados.length
      ? resultados.length + (resultados.length >= LIMITE ? '+ resultados' : ' resultado(s)')
      : 'Nenhum resultado encontrado.'
  };
}


/**
 * Faz a planilha funcionar como resultado da busca.
 * As linhas que NÃO combinam ficam apenas ocultas.
 * Nada é apagado, movido ou reordenado.
 */
function pbxAplicarFiltroVisual_(sh, linhasEncontradas, lastRow) {
  if (pbxEhDashboardProtegido_(sh)) return;

  const maxRows = sh.getMaxRows();
  if (maxRows <= 1) return;

  // Primeiro restaura tudo para evitar filtros acumulados.
  sh.showRows(2, maxRows - 1);

  const encontradas = new Set(
    (linhasEncontradas || [])
      .map(Number)
      .filter(r => r >= 2 && r <= lastRow)
  );

  // Sem resultado: deixa só o cabeçalho visível.
  if (!encontradas.size) {
    sh.hideRows(2, maxRows - 1);
    return;
  }

  // Oculta trechos contínuos que não pertencem ao resultado.
  let inicioOcultar = null;

  for (let r = 2; r <= lastRow; r++) {
    const manter = encontradas.has(r);

    if (!manter && inicioOcultar === null) {
      inicioOcultar = r;
    }

    if (manter && inicioOcultar !== null) {
      sh.hideRows(inicioOcultar, r - inicioOcultar);
      inicioOcultar = null;
    }
  }

  if (inicioOcultar !== null) {
    sh.hideRows(inicioOcultar, lastRow - inicioOcultar + 1);
  }

  // Também esconde linhas vazias depois do fim real dos dados.
  if (lastRow < maxRows) {
    sh.hideRows(lastRow + 1, maxRows - lastRow);
  }
}

function pbxMostrarTodasLinhas() {
  pbxMostrarTodasLinhasSilencioso_();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Todas as linhas foram restauradas.',
    'BUSCADOR PELEGO BOX',
    2
  );
}

function pbxMostrarTodasLinhasSilencioso_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (pbxEhDashboardProtegido_(sh)) {
    return {
      ok: true,
      aba: sh.getName(),
      desativado: true
    };
  }

  const maxRows = sh.getMaxRows();
  if (maxRows > 1) {
    sh.showRows(2, maxRows - 1);
  }
  return {
    ok: true,
    aba: sh.getName()
  };
}

/**
 * Seleciona a linha inteira no intervalo usado.
 * Isso dá o efeito "Ctrl+F": a linha encontrada fica marcada pela seleção,
 * SEM modificar cor, valor ou formatação da planilha.
 */
function pbxIrParaResultado(aba, linha, coluna) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(String(aba || ''));

  if (!sh) throw new Error('Aba não encontrada: ' + aba);
  if (pbxEhDashboardProtegido_(sh)) {
    return { ok: false, desativado: true, aba: sh.getName() };
  }

  const r = Math.max(1, Number(linha) || 1);
  const c = Math.max(1, Number(coluna) || 1);
  const lastCol = Math.max(1, sh.getLastColumn());

  ss.setActiveSheet(sh);

  const linhaInteira = sh.getRange(r, 1, 1, lastCol);
  linhaInteira.activate();

  return {
    ok: true,
    aba: sh.getName(),
    linha: r,
    a1: pbxColunaParaLetra_(c) + r
  };
}

function pbxIrParaCelulaPrompt() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.prompt(
    'Ir para célula',
    'Digite uma referência. Exemplos: A222 ou Videos_projetos!A222',
    ui.ButtonSet.OK_CANCEL
  );

  if (resposta.getSelectedButton() !== ui.Button.OK) return;

  const texto = String(resposta.getResponseText() || '').trim();
  if (!texto) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getActiveSheet();
  let a1 = texto;

  if (texto.indexOf('!') !== -1) {
    const partes = texto.split('!');
    const nomeAba = partes.slice(0, -1).join('!').replace(/^'|'$/g, '');
    a1 = partes[partes.length - 1];

    const encontrada = ss.getSheetByName(nomeAba);
    if (!encontrada) {
      ui.alert('Aba não encontrada: ' + nomeAba);
      return;
    }
    sh = encontrada;
    ss.setActiveSheet(sh);
  }

  try {
    sh.getRange(a1).activate();
  } catch (e) {
    ui.alert('Referência inválida: ' + texto);
  }
}

function pbxMontarDestaqueLinha_(headers, linha) {
  const itens = pbxExtrairCampos_(headers, linha);

  const codigo = pbxPrimeiroCampo_(itens, [
    'ordem_video','codigo','codigo_projeto','código','id'
  ]);

  const titulo = pbxPrimeiroCampo_(itens, [
    'titulo_video','titulo','produto','nome','nome_na_compra'
  ]);

  const preco = pbxPrimeiroCampo_(itens, [
    'preco_total','preço_total','preco','preço','valor_da_compra',
    'valor_compra','valor','valor_etapa_3'
  ]);

  return {
    codigo: codigo ? codigo.valor : '',
    titulo: titulo ? pbxResumirTexto_(titulo.valor, 120) : '',
    preco: preco ? preco.valor : '',
    precoLabel: preco ? preco.label : ''
  };
}

function pbxMontarCamposLinha_(headers, linha) {
  const itens = pbxExtrairCampos_(headers, linha);

  const prioridades = [
    'ordem_video',
    'codigo',
    'codigo_projeto',
    'código',
    'titulo_video',
    'titulo',
    'produto',
    'preco_total',
    'preço_total',
    'valor_da_compra',
    'valor_etapa_3',
    'valor_etapa_2',
    'valor_etapa_1',
    'nome',
    'nome_na_compra',
    'email',
    'e_mail',
    'whatsapp',
    'status',
    'marca_1',
    'ativo_check'
  ];

  const saida = [];
  const usados = new Set();

  prioridades.forEach(p => {
    const encontrado = itens.find(x => x.key === pbxNormalizarCabecalho_(p));
    if (encontrado && encontrado.valor && !usados.has(encontrado.index)) {
      saida.push({
        label: encontrado.label,
        valor: pbxResumirTexto_(encontrado.valor, 120)
      });
      usados.add(encontrado.index);
    }
  });

  // Completa com outros campos preenchidos, sem transformar o card num cartório.
  for (let i = 0; i < itens.length && saida.length < 7; i++) {
    const item = itens[i];
    if (!item.valor || usados.has(item.index)) continue;

    saida.push({
      label: item.label,
      valor: pbxResumirTexto_(item.valor, 120)
    });
    usados.add(item.index);
  }

  return saida.slice(0, 7);
}

function pbxExtrairCampos_(headers, linha) {
  const itens = [];

  for (let i = 0; i < headers.length; i++) {
    const label = String(headers[i] || '').trim();
    const valor = String(linha[i] == null ? '' : linha[i]).trim();

    if (!label) continue;

    itens.push({
      index: i,
      label: label,
      key: pbxNormalizarCabecalho_(label),
      valor: valor
    });
  }

  return itens;
}

function pbxPrimeiroCampo_(itens, candidatos) {
  for (let i = 0; i < candidatos.length; i++) {
    const key = pbxNormalizarCabecalho_(candidatos[i]);
    const achou = itens.find(x => x.key === key && x.valor);
    if (achou) return achou;
  }
  return null;
}

function pbxNormalizarCabecalho_(valor) {
  return pbxNormalizarBusca_(valor)
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pbxNormalizarBusca_(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function pbxResumirTexto_(valor, max) {
  const texto = String(valor == null ? '' : valor).replace(/\s+/g, ' ').trim();
  const limite = Number(max) || 100;
  return texto.length > limite ? texto.slice(0, limite - 1) + '…' : texto;
}

function pbxColunaParaLetra_(coluna) {
  let n = Number(coluna);
  let s = '';

  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }

  return s;
}
