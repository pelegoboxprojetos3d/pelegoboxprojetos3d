/**
 * PELEGO BOX - PLANILHA MESTRA -> MAKE -> WIX
 * Atualização: PREÇO TOTAL + AJUSTE PERCENTUAL DO PROJETO COMPLETO
 * Data: 2026-08-14
 *
 * REGRAS:
 * - A aba deve continuar se chamando "Videos_projetos".
 * - NÃO renomeie os cabeçalhos existentes.
 * - NÃO altere o campo ID.
 * - A coluna "preco_total" pode ficar em qualquer posição.
 * - O fluxo 029 novo grava por NOME DE CABEÇALHO, não por posição.
 * - Novas linhas criadas automaticamente pelo Make são detectadas por um
 *   gatilho periódico e têm as 3 etapas calculadas pela planilha/Apps Script.
 *
 * CÁLCULO AUTOMÁTICO:
 * - Etapa 1 = 2% do preço total, arredondada para múltiplo de R$ 5, mínimo R$ 5.
 * - Etapa 2 = 5% do preço total, arredondada para múltiplo de R$ 5, mínimo R$ 5.
 * - Etapa 3 = preço total - etapa 1 - etapa 2.
 *
 * AJUSTES MANUAIS:
 * - Se editar preco_total: recalcula as 3 etapas.
 * - Se editar valor_etapa_1 ou valor_etapa_2: mantém preco_total e recalcula etapa 3.
 * - Se editar valor_etapa_3: atualiza preco_total para a soma das 3 etapas.
 * - Alterações em titulo_video e ativo_checkout continuam sincronizando normalmente.
 *
 * AJUSTE PERCENTUAL:
 * - ajuste_percentual = 0% mantém o preço normal.
 * - valor negativo aplica desconto; valor positivo aplica acréscimo.
 * - valor_etapa_1 e valor_etapa_2 NÃO mudam por causa do ajuste.
 * - somente preco_total e valor_etapa_3 são recalculados.
 * - após o percentual, preco_total é arredondado para o múltiplo de R$ 5 mais próximo.
 * - preco_total_base fica em uma coluna técnica oculta (AA), fora do A:Z usado pelo Make.
 * - novas linhas do Make são processadas e depois ordenadas com o maior ordem_video no topo.
 * - aba Clientes: nome, e-mail, WhatsApp, CPF/CNPJ, status, observações e ativo sincronizam direto com Wix.
 * - demais abas administrativas continuam somente leitura/local e não escrevem no Wix.
 */

const WEBHOOK_URL = 'https://hook.us2.make.com/7rlql45vmft37vhucow7wb3jei5rrqid';
const NOME_ABA = 'Videos_projetos';
const NOME_ABA_CLIENTES = 'Clientes';

// Sincronização direta com Wix, sem passar pelo Make.
const WIX_SITE_ID = 'd1022df4-d4fd-4561-8909-a59d876691b3';
const WIX_COLLECTION_ID = 'Videosprojetos';
// ID real da coleção Clientes no Wix. No backend do site ela é chamada de "Campo".
const WIX_COLLECTION_CLIENTES_ID = 'Campo';
const WIX_API_KEY_PROP = 'WIX_API_KEY_PELEGO';
const WIX_BULK_PATCH_URL = 'https://www.wixapis.com/wix-data/v2/bulk/items/patch';
const WIX_LOTE_MAXIMO = 100;

const CAB_PRECO_TOTAL = 'preco_total';
const CAB_ETAPA_1 = 'valor_etapa_1';
const CAB_ETAPA_2 = 'valor_etapa_2';
const CAB_ETAPA_3 = 'valor_etapa_3';
const CAB_AJUSTE_PERCENTUAL = 'ajuste_percentual';
const CAB_PRECO_TOTAL_BASE = 'preco_total_base';
const COLUNA_TECNICA_BASE = 27; // AA: fora do A:Z usado pelo Make.

const PERCENTUAL_ETAPA_1 = 0.02;
const PERCENTUAL_ETAPA_2 = 0.05;
const MULTIPLO_PRECO = 5;
const MIN_ETAPA_1 = 5;
const MIN_ETAPA_2 = 5;

const CAMPOS_EDITAVEIS = new Set([
  'titulo_video',
  CAB_ETAPA_1,
  CAB_ETAPA_2,
  CAB_ETAPA_3,
  'ativo_checkout',
  CAB_PRECO_TOTAL,
  CAB_AJUSTE_PERCENTUAL
]);

// Somente estes campos da aba Clientes podem escrever na coleção Wix.
// IDs, datas técnicas, origem e demais campos continuam protegidos contra sincronização acidental.
const CAMPOS_CLIENTES_WIX = new Set([
  'nome',
  'email',
  'whatsapp',
  'CPF/CNPJ',
  'status',
  'observacoes',
  'ativo'
]);

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PELEGO BOX')
    .addItem('Configurar API Wix', 'configurarApiWix')
    .addItem('Testar Wix na linha ativa', 'testarWixLinhaAtiva')
    .addItem('Testar Clientes na linha ativa', 'testarClientesLinhaAtiva')
    .addSeparator()
    .addItem('Aplicar % em todos + sincronizar Wix', 'aplicarPercentualGeral')
    .addSeparator()
    .addItem('Instalar / atualizar automação', 'instalarAtualizacao')
    .addItem('Recalcular linha ativa', 'recalcularLinhaAtiva')
    .addItem('Testar envio Make da linha ativa', 'testarLinhaAtiva')
    .addToUi();
}

/**
 * EXECUTE ESTA FUNÇÃO UMA ÚNICA VEZ DEPOIS DE COLAR O CÓDIGO.
 *
 * Ela:
 * 1) cria a coluna preco_total no fim, caso ainda não exista;
 * 2) preenche preco_total nas linhas antigas com a soma das 3 etapas;
 * 3) formata as quatro colunas de preço;
 * 4) recria o gatilho de edição sem duplicidade;
 * 5) cria um gatilho a cada 1 minuto para processar novas linhas vindas do Make e colocá-las no topo.
 */

/**
 * PROMOÇÃO / AJUSTE GERAL
 *
 * Abre uma caixa para digitar:
 *   10   -> +10%
 *   -20  -> -20%
 *   0    -> volta ao preço-base
 *
 * Atualiza em lote:
 * - ajuste_percentual
 * - preco_total
 * - valor_etapa_3
 *
 * Mantém valor_etapa_1 e valor_etapa_2 intactos.
 *
 * IMPORTANTE:
 * Como a alteração é feita pelo próprio Apps Script com setValues(),
 * ela NÃO dispara o gatilho onEdit linha por linha.
 */
function aplicarPercentualGeral() {
  const ui = SpreadsheetApp.getUi();

  const apiKey = obterWixApiKey_();
  if (!apiKey) {
    ui.alert('API Wix ainda não configurada. Use PELEGO BOX > Configurar API Wix e depois rode a promoção.');
    return;
  }
  const resposta = ui.prompt(
    'Aplicar percentual em todos os projetos',
    'Digite apenas o número. Exemplos: 10 para +10%, -20 para -20%, 0 para voltar ao normal.',
    ui.ButtonSet.OK_CANCEL
  );

  if (resposta.getSelectedButton() !== ui.Button.OK) return;

  const texto = String(resposta.getResponseText() || '')
    .trim()
    .replace('%', '')
    .replace(',', '.');

  if (!texto) {
    ui.alert('Informe um percentual.');
    return;
  }

  const percentualNumero = Number(texto);

  if (!Number.isFinite(percentualNumero)) {
    ui.alert('Percentual inválido. Use, por exemplo: 10, -20 ou 0.');
    return;
  }

  // Evita desconto que zeraria/inverteria o preço.
  if (percentualNumero <= -100) {
    ui.alert('O desconto deve ser maior que -100%.');
    return;
  }

  const ajusteNovo = percentualNumero / 100;

  const sheet = obterAba();
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);

  const colOrdem = mapa.ordem_video;
  const colId = mapa.ID;
  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];
  const colAjuste = mapa[CAB_AJUSTE_PERCENTUAL];
  const colBase = mapa[CAB_PRECO_TOTAL_BASE];

  if (!colId || !colTotal || !col1 || !col2 || !col3 || !colAjuste || !colBase) {
    throw new Error(
      'Não encontrei ID, preco_total, ajuste_percentual, preco_total_base ou uma das colunas valor_etapa_1/2/3.'
    );
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const qtd = ultimaLinha - 1;
  const ultimaColuna = sheet.getLastColumn();
  const dados = sheet.getRange(2, 1, qtd, ultimaColuna).getValues();

  const saidaAjuste = [];
  const saidaTotal = [];
  const saidaEtapa3 = [];
  const saidaBase = [];
  const patchesWix = [];

  let alteradas = 0;

  for (let i = 0; i < dados.length; i++) {
    const row = dados[i];

    // Só mexe em linhas que representam projeto.
    const ordem = colOrdem ? row[colOrdem - 1] : null;
    const totalAtual = normalizarNumero(row[colTotal - 1]);
    const etapa1 = normalizarNumero(row[col1 - 1]);
    const etapa2 = normalizarNumero(row[col2 - 1]);
    const etapa3Atual = normalizarNumero(row[col3 - 1]);
    const ajusteAtual = normalizarNumero(row[colAjuste - 1]);
    let precoBase = normalizarNumero(row[colBase - 1]);

    const linhaValida = ordem !== '' && ordem !== null && (
      totalAtual > 0 || etapa1 > 0 || etapa2 > 0 || etapa3Atual > 0
    );

    if (!linhaValida) {
      saidaAjuste.push([row[colAjuste - 1]]);
      saidaTotal.push([row[colTotal - 1]]);
      saidaEtapa3.push([row[col3 - 1]]);
      saidaBase.push([row[colBase - 1]]);
      continue;
    }

    if (!(precoBase > 0)) {
      // Se já havia ajuste aplicado, reconstrói a base.
      if (totalAtual > 0 && (1 + ajusteAtual) > 0) {
        precoBase = arredondarCentavos(totalAtual / (1 + ajusteAtual));
      } else {
        precoBase = arredondarCentavos(etapa1 + etapa2 + etapa3Atual);
      }
    }

    if (!(precoBase > 0)) {
      saidaAjuste.push([row[colAjuste - 1]]);
      saidaTotal.push([row[colTotal - 1]]);
      saidaEtapa3.push([row[col3 - 1]]);
      saidaBase.push([row[colBase - 1]]);
      continue;
    }

    // Regra comercial: total SEMPRE termina em 0 ou 5.
    const totalAjustado = arredondarParaMultiplo(
      precoBase * (1 + ajusteNovo),
      MULTIPLO_PRECO
    );

    const novaEtapa3 = arredondarCentavos(
      totalAjustado - etapa1 - etapa2
    );

    if (novaEtapa3 < 0) {
      throw new Error(
        `Linha ${i + 2}: o percentual deixa o total abaixo da soma das etapas 1 e 2.`
      );
    }

    saidaAjuste.push([ajusteNovo]);
    saidaTotal.push([totalAjustado]);
    saidaEtapa3.push([novaEtapa3]);
    saidaBase.push([precoBase]);

    const dataItemId = String(row[colId - 1] ?? '').trim();
    if (dataItemId) {
      patchesWix.push({
        dataItemId: dataItemId,
        fieldModifications: [{
          fieldPath: CAB_ETAPA_3,
          action: 'SET_FIELD',
          setFieldOptions: { value: novaEtapa3 }
        }]
      });
    }

    alteradas++;
  }

  // Escrita em lote: rápida e sem 1.800 eventos onEdit.
  sheet.getRange(2, colAjuste, qtd, 1).setValues(saidaAjuste);
  sheet.getRange(2, colTotal, qtd, 1).setValues(saidaTotal);
  sheet.getRange(2, col3, qtd, 1).setValues(saidaEtapa3);
  sheet.getRange(2, colBase, qtd, 1).setValues(saidaBase);

  formatarColunaAjuste(sheet);
  formatarColunasPreco(sheet);

  SpreadsheetApp.flush();

  const resultadoWix = sincronizarPatchesWix_(patchesWix, apiKey);

  if (resultadoWix.erros.length > 0) {
    ui.alert(
      `Planilha atualizada: ${alteradas} projeto(s).\n` +
      `Wix atualizado: ${resultadoWix.sucessos}.\n` +
      `Falhas Wix: ${resultadoWix.erros.length}.\n\n` +
      'Pode rodar o mesmo percentual novamente; ele tentará sincronizar tudo de novo.'
    );
    return;
  }

  ui.alert(
    `Concluído. ${alteradas} projeto(s) receberam ${percentualNumero > 0 ? '+' : ''}${percentualNumero}%.\n` +
    `Wix sincronizado diretamente: ${resultadoWix.sucessos} item(ns).\n` +
    'Make não foi utilizado nesta promoção.'
  );
}


/**
 * CONFIGURAÇÃO WIX
 * A chave fica em Script Properties, não aparece nas células.
 */
function configurarApiWix() {
  const ui = SpreadsheetApp.getUi();
  const resposta = ui.prompt(
    'Configurar API Wix',
    'Cole a API Key do Wix com permissão Write Data Items.',
    ui.ButtonSet.OK_CANCEL
  );
  if (resposta.getSelectedButton() !== ui.Button.OK) return;
  const apiKey = String(resposta.getResponseText() || '').trim();
  if (!apiKey) {
    ui.alert('Nenhuma API Key foi informada.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty(WIX_API_KEY_PROP, apiKey);
  ui.alert('API Wix salva. Agora teste uma linha antes da primeira promoção geral.');
}

function obterWixApiKey_() {
  return String(PropertiesService.getScriptProperties().getProperty(WIX_API_KEY_PROP) || '').trim();
}

function testarWixLinhaAtiva() {
  const ui = SpreadsheetApp.getUi();
  const apiKey = obterWixApiKey_();
  if (!apiKey) {
    ui.alert('Configure a API Wix primeiro.');
    return;
  }

  const sheet = obterAba();
  const linha = sheet.getActiveRange().getRow();
  if (linha < 2) {
    ui.alert('Selecione uma linha de projeto.');
    return;
  }

  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);
  const colId = mapa.ID;
  const col3 = mapa[CAB_ETAPA_3];
  if (!colId || !col3) throw new Error('Não encontrei ID ou valor_etapa_3.');

  const id = String(sheet.getRange(linha, colId).getValue() || '').trim();
  const etapa3 = normalizarNumero(sheet.getRange(linha, col3).getValue());
  if (!id || !(etapa3 >= 0)) {
    ui.alert('A linha ativa não tem ID/valor_etapa_3 válido.');
    return;
  }

  const patches = [{
    dataItemId: id,
    fieldModifications: [{
      fieldPath: CAB_ETAPA_3,
      action: 'SET_FIELD',
      setFieldOptions: { value: etapa3 }
    }]
  }];

  const r = sincronizarPatchesWix_(patches, apiKey);
  if (r.erros.length) {
    ui.alert('Teste Wix falhou: ' + r.erros[0]);
    return;
  }
  ui.alert(`Teste Wix OK. Linha ${linha} sincronizada sem Make.`);
}

function sincronizarPatchesWix_(patches, apiKey) {
  return sincronizarPatchesWixColecao_(WIX_COLLECTION_ID, patches, apiKey);
}

function sincronizarPatchesWixColecao_(collectionId, patches, apiKey) {
  const resultado = { sucessos: 0, erros: [] };
  if (!patches || patches.length === 0) return resultado;

  for (let inicio = 0; inicio < patches.length; inicio += WIX_LOTE_MAXIMO) {
    const lote = patches.slice(inicio, inicio + WIX_LOTE_MAXIMO);
    const payload = { dataCollectionId: collectionId, patches: lote };
    let response;

    try {
      response = UrlFetchApp.fetch(WIX_BULK_PATCH_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: apiKey,
          'wix-site-id': WIX_SITE_ID,
          Accept: 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
    } catch (err) {
      resultado.erros.push(`Lote ${Math.floor(inicio / WIX_LOTE_MAXIMO) + 1}: ${err.message || err}`);
      continue;
    }

    const status = response.getResponseCode();
    const texto = response.getContentText();
    if (status < 200 || status >= 300) {
      resultado.erros.push(`Lote ${Math.floor(inicio / WIX_LOTE_MAXIMO) + 1}: HTTP ${status} - ${texto.slice(0, 500)}`);
      continue;
    }

    let body = {};
    try { body = texto ? JSON.parse(texto) : {}; } catch (_) {}
    const resultados = Array.isArray(body.results) ? body.results : [];
    if (resultados.length === 0) {
      resultado.sucessos += lote.length;
      continue;
    }

    for (let i = 0; i < resultados.length; i++) {
      const item = resultados[i] || {};
      const erro = item.itemMetadata && item.itemMetadata.error;
      if (erro) {
        const id = lote[i] ? lote[i].dataItemId : '?';
        resultado.erros.push(`ID ${id}: ${JSON.stringify(erro).slice(0, 400)}`);
      } else {
        resultado.sucessos++;
      }
    }
  }

  return resultado;
}

/**
 * TESTE SEGURO DA ABA CLIENTES
 * Regrava o valor atual do nome (e Title) do cliente selecionado.
 * Não muda os dados visíveis; apenas comprova a conexão Sheets -> Wix.
 */
function testarClientesLinhaAtiva() {
  const ui = SpreadsheetApp.getUi();
  const apiKey = obterWixApiKey_();
  if (!apiKey) {
    ui.alert('Configure a API Wix primeiro.');
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== NOME_ABA_CLIENTES) {
    ui.alert('Abra a aba Clientes e selecione uma linha de cliente.');
    return;
  }

  const linha = sheet.getActiveRange().getRow();
  if (linha < 2) {
    ui.alert('Selecione uma linha de cliente.');
    return;
  }

  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);
  const colId = mapa.ID;
  const colNome = mapa.nome;
  if (!colId || !colNome) {
    ui.alert('Não encontrei as colunas ID e nome na aba Clientes.');
    return;
  }

  const id = String(sheet.getRange(linha, colId).getValue() || '').trim();
  const nome = String(sheet.getRange(linha, colNome).getValue() || '').trim();
  if (!id || !nome) {
    ui.alert('A linha selecionada precisa ter ID e nome preenchidos.');
    return;
  }

  const patches = [{
    dataItemId: id,
    fieldModifications: [
      { fieldPath: 'nome', action: 'SET_FIELD', setFieldOptions: { value: nome } },
      { fieldPath: 'title', action: 'SET_FIELD', setFieldOptions: { value: nome } }
    ]
  }];

  const r = sincronizarPatchesWixColecao_(WIX_COLLECTION_CLIENTES_ID, patches, apiKey);
  if (r.erros.length) {
    ui.alert('Teste Clientes -> Wix falhou: ' + r.erros[0]);
    return;
  }

  ui.alert(`Teste Clientes -> Wix OK. Linha ${linha} sincronizada direto, sem Make.`);
}

function instalarAtualizacao() {
  const sheet = obterAba();
  garantirColunaPrecoTotal(sheet);
  garantirColunaAjustePercentual(sheet);
  garantirColunaPrecoBase(sheet);
  preencherPrecosTotaisExistentes(sheet);
  inicializarPrecosBase(sheet);
  formatarColunasPreco(sheet);
  formatarColunaAjuste(sheet);
  aplicarAjustesPercentuaisExistentes(sheet);
  // A instalacao nova remove gatilhos velhos e recria os handlers corretos.
  if (typeof instalarSyncDiretoVideos === 'function') {
    instalarSyncDiretoVideos();
  } else {
    criarGatilhoEdicao();
    criarGatilhoNovasLinhas();
  }
  processarNovasLinhasPendentes();

  SpreadsheetApp.getActive().toast(
    'Automação instalada. Sincronização SITE <-> Wix ativada e gatilhos reparados.',
    'PELEGO BOX',
    6
  );
}

function criarGatilhoEdicao() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sincronizarEdicao')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('sincronizarEdicao')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}


/**
 * O Make/Google Sheets API não dispara o gatilho onEdit.
 * Por isso, este gatilho procura periodicamente novas linhas com:
 * - ID preenchido;
 * - preco_total preenchido;
 * - as 3 etapas ainda vazias.
 *
 * O cálculo continua fora do Make. O Make entrega apenas preco_total.
 */
function criarGatilhoNovasLinhas() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processarNovasLinhasPendentes')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('processarNovasLinhasPendentes')
    .timeBased()
    .everyMinutes(1)
    .create();
}

function processarNovasLinhasPendentes() {
  // COMPATIBILIDADE: este handler antigo ainda pode estar instalado como gatilho.
  // Usa o proprio relogio antigo para executar o sincronizador geral novo.
  if (typeof pbxSincronizacaoGeralUmCiclo_ === 'function') {
    try {
      pbxSincronizacaoGeralUmCiclo_();
    } catch (err) {
      console.error('PBX sync geral pelo gatilho legado: ' + (err && err.message ? err.message : err));
    }
  }

  const sheet = obterAba();
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);

  const colId = mapa.ID;
  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];
  const colAjuste = mapa[CAB_AJUSTE_PERCENTUAL];
  const colBase = mapa[CAB_PRECO_TOTAL_BASE];

  if (!colId || !colTotal || !col1 || !col2 || !col3 || !colAjuste || !colBase) {
    throw new Error(
      'Não encontrei ID, preco_total, ajuste_percentual, preco_total_base ou uma das colunas valor_etapa_1/2/3.'
    );
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const ultimaColuna = sheet.getLastColumn();

  // O Make sempre acrescenta a nova linha no fim.
  // Para não varrer quase 1.800 registros a cada minuto,
  // inspeciona apenas as últimas 100 linhas, mais que suficiente
  // para o volume normal do fluxo.
  const limiteBuscaNovasLinhas = 100;
  const primeiraLinhaBusca = Math.max(
    2,
    ultimaLinha - limiteBuscaNovasLinhas + 1
  );
  const quantidadeLinhasBusca =
    ultimaLinha - primeiraLinhaBusca + 1;

  const dados = sheet
    .getRange(
      primeiraLinhaBusca,
      1,
      quantidadeLinhasBusca,
      ultimaColuna
    )
    .getValues();

  const linhasParaEnviar = [];

  for (let i = 0; i < dados.length; i++) {
    const linha = primeiraLinhaBusca + i;
    const valores = dados[i];

    const id = String(valores[colId - 1] ?? '').trim();
    const total = normalizarNumero(valores[colTotal - 1]);

    const bruto1 = valores[col1 - 1];
    const bruto2 = valores[col2 - 1];
    const bruto3 = valores[col3 - 1];

    const vazio1 = bruto1 === '' || bruto1 === null;
    const vazio2 = bruto2 === '' || bruto2 === null;
    const vazio3 = bruto3 === '' || bruto3 === null;

    if (!id || !(total > 0)) continue;

    // Só trata linhas NOVAS: as três etapas precisam estar vazias.
    // Assim não encosta em ajustes manuais antigos.
    if (!(vazio1 && vazio2 && vazio3)) continue;

    // O preço recebido do Make nasce como preço-base e o ajuste começa em 0%.
    if (!normalizarNumero(valores[colBase - 1])) {
      sheet.getRange(linha, colBase).setValue(total);
    }
    if (valores[colAjuste - 1] === '' || valores[colAjuste - 1] === null) {
      sheet.getRange(linha, colAjuste).setValue(0);
    }

    aplicarRegrasDaLinha(
      sheet,
      cabecalhos,
      linha,
      new Set([CAB_PRECO_TOTAL])
    );

    linhasParaEnviar.push(linha);
  }

  if (linhasParaEnviar.length === 0) return;

  SpreadsheetApp.flush();

  for (const linha of linhasParaEnviar) {
    enviarLinha(sheet, cabecalhos, linha);
  }

  // Depois que as novas linhas já foram calculadas e sincronizadas,
  // reorganiza a planilha inteira pelo código do projeto.
  // A ordenação inclui até a coluna técnica AA para manter
  // preco_total_base sempre alinhado ao projeto correto.
  ordenarProjetosMaisNovosPrimeiro(sheet);
}

function ordenarProjetosMaisNovosPrimeiro(sheet) {
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);
  const colOrdem = mapa.ordem_video;

  if (!colOrdem) {
    throw new Error('Não encontrei a coluna ordem_video para ordenar a planilha.');
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 3) return;

  const ultimaColuna = sheet.getLastColumn();

  sheet
    .getRange(2, 1, ultimaLinha - 1, ultimaColuna)
    .sort({
      column: colOrdem,
      ascending: false
    });

  SpreadsheetApp.flush();
}

function sincronizarEdicao(e) {
  // COMPATIBILIDADE: se o gatilho onEdit antigo ainda existir, encaminha para
  // o sincronizador direto novo. Isso cobre Videos_projetos, Clientes e as
  // demais abas mapeadas sem depender de reinstalar o trigger primeiro.
  if (typeof sincronizarEdicaoVideosDiretoWix === 'function') {
    sincronizarEdicaoVideosDiretoWix(e);
    return;
  }

  if (!e || !e.range) return;

  const sheet = e.range.getSheet();

  // Aba Clientes: sincronização direta com Wix, sem Make.
  if (sheet.getName() === NOME_ABA_CLIENTES) {
    sincronizarEdicaoClientes_(e);
    return;
  }

  // Demais abas não escrevem em lugar nenhum.
  if (sheet.getName() !== NOME_ABA) return;
  if (e.range.getRow() < 2) return;

  const cabecalhos = obterCabecalhos(sheet);

  const primeiraColuna = e.range.getColumn();
  const ultimaColunaEditada =
    primeiraColuna + e.range.getNumColumns() - 1;

  const camposEditados = new Set();

  for (let col = primeiraColuna; col <= ultimaColunaEditada; col++) {
    const nome = cabecalhos[col - 1];
    if (CAMPOS_EDITAVEIS.has(nome)) {
      camposEditados.add(nome);
    }
  }

  if (camposEditados.size === 0) return;

  if (!WEBHOOK_URL || WEBHOOK_URL.includes('COLE_AQUI')) {
    throw new Error(
      'Configure WEBHOOK_URL com a URL do webhook criado no Make.'
    );
  }

  const primeiraLinha = e.range.getRow();
  const ultimaLinha =
    primeiraLinha + e.range.getNumRows() - 1;

  for (let linha = primeiraLinha; linha <= ultimaLinha; linha++) {
    aplicarRegrasDaLinha(
      sheet,
      cabecalhos,
      linha,
      camposEditados
    );
  }

  // Garante que os valores calculados já estejam gravados antes do envio.
  SpreadsheetApp.flush();

  for (let linha = primeiraLinha; linha <= ultimaLinha; linha++) {
    enviarLinha(sheet, cabecalhos, linha);
  }
}

/**
 * Sincroniza somente campos administrativos autorizados da aba Clientes.
 * Nunca envia a linha inteira: usa PATCH parcial para preservar todo o resto da coleção.
 */
function sincronizarEdicaoClientes_(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== NOME_ABA_CLIENTES) return;
  if (e.range.getRow() < 2) return;

  const apiKey = obterWixApiKey_();
  if (!apiKey) {
    SpreadsheetApp.getActive().toast(
      'API Wix não configurada. Alteração ficou apenas na planilha.',
      'CLIENTES -> WIX: ERRO',
      8
    );
    throw new Error('Configure a API Wix antes de editar campos sincronizados de Clientes.');
  }

  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);
  const colId = mapa.ID;
  if (!colId) {
    throw new Error('A aba Clientes precisa manter a coluna ID.');
  }

  const primeiraColuna = e.range.getColumn();
  const ultimaColuna = primeiraColuna + e.range.getNumColumns() - 1;
  const camposEditados = [];

  for (let col = primeiraColuna; col <= ultimaColuna; col++) {
    const cabecalho = cabecalhos[col - 1];
    if (CAMPOS_CLIENTES_WIX.has(cabecalho)) {
      camposEditados.push(cabecalho);
    }
  }

  if (camposEditados.length === 0) return;

  const primeiraLinha = e.range.getRow();
  const ultimaLinha = primeiraLinha + e.range.getNumRows() - 1;
  const patches = [];

  for (let linha = primeiraLinha; linha <= ultimaLinha; linha++) {
    const id = String(sheet.getRange(linha, colId).getValue() || '').trim();
    if (!id) {
      throw new Error(`Linha ${linha}: ID do cliente está vazio. Nada foi enviado ao Wix.`);
    }

    const fieldModifications = [];

    camposEditados.forEach(cabecalho => {
      const col = mapa[cabecalho];
      if (!col) return;

      const valorBruto = sheet.getRange(linha, col).getValue();
      const modificacoes = criarModificacoesClienteWix_(cabecalho, valorBruto, linha);
      fieldModifications.push(...modificacoes);
    });

    if (fieldModifications.length) {
      patches.push({ dataItemId: id, fieldModifications });
    }
  }

  if (!patches.length) return;

  const r = sincronizarPatchesWixColecao_(WIX_COLLECTION_CLIENTES_ID, patches, apiKey);
  if (r.erros.length) {
    SpreadsheetApp.getActive().toast(
      'Falha ao enviar para o Wix. A planilha foi alterada, mas o Wix não.',
      'CLIENTES -> WIX: ERRO',
      10
    );
    throw new Error('Clientes -> Wix: ' + r.erros.join(' | '));
  }

  SpreadsheetApp.getActive().toast(
    `${r.sucessos} cliente(s) sincronizado(s) direto com Wix.`,
    'CLIENTES -> WIX',
    4
  );
}

function criarModificacoesClienteWix_(cabecalho, valorBruto, linha) {
  let fieldPath = '';
  let value = valorBruto;

  switch (cabecalho) {
    case 'nome': {
      const nome = String(valorBruto ?? '').trim();
      return [
        { fieldPath: 'nome', action: 'SET_FIELD', setFieldOptions: { value: nome } },
        { fieldPath: 'title', action: 'SET_FIELD', setFieldOptions: { value: nome } }
      ];
    }

    case 'email':
      fieldPath = 'email';
      value = String(valorBruto ?? '').trim().toLowerCase();
      break;

    case 'whatsapp':
      fieldPath = 'whatsapp';
      value = normalizarWhatsappClienteWix_(valorBruto);
      if (!value) {
        throw new Error(`Linha ${linha}: WhatsApp inválido. Use DDD + número ou +DDI completo.`);
      }
      break;

    case 'CPF/CNPJ': {
      fieldPath = 'cpfCnpj';
      const cpf = String(valorBruto ?? '').replace(/\D/g, '');
      if (cpf && cpf.length !== 11 && cpf.length !== 14) {
        throw new Error(`Linha ${linha}: CPF/CNPJ precisa ter 11 ou 14 dígitos.`);
      }
      value = cpf;
      break;
    }

    case 'status':
      fieldPath = 'status';
      value = String(valorBruto ?? '').trim();
      break;

    case 'observacoes':
      fieldPath = 'observacoes';
      value = String(valorBruto ?? '').trim();
      break;

    case 'ativo':
      fieldPath = 'ativo';
      value = normalizarBooleanoClienteWix_(valorBruto, linha);
      break;

    default:
      return [];
  }

  return [{
    fieldPath,
    action: 'SET_FIELD',
    setFieldOptions: { value }
  }];
}

function normalizarWhatsappClienteWix_(valor) {
  const original = String(valor ?? '').trim();
  let numeros = original.replace(/\D/g, '');
  if (!numeros) return '';

  // Mesma regra usada pelo backend oficial do site.
  if (original.startsWith('+') && numeros.length >= 7 && numeros.length <= 15) {
    return `+${numeros}`;
  }
  if (numeros.startsWith('55') && (numeros.length === 12 || numeros.length === 13)) {
    return `+${numeros}`;
  }
  if (numeros.length === 10 || numeros.length === 11) {
    return `+55${numeros}`;
  }
  if (numeros.length >= 7 && numeros.length <= 15) {
    return `+${numeros}`;
  }
  return '';
}

function normalizarBooleanoClienteWix_(valor, linha) {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor !== 0;

  const t = String(valor ?? '').trim().toLowerCase();
  if (['true', 'sim', '1', 'ativo', 'yes'].includes(t)) return true;
  if (['false', 'nao', 'não', '0', 'inativo', 'no', ''].includes(t)) return false;

  throw new Error(`Linha ${linha}: campo ativo deve ser TRUE/FALSE, sim/não ou 1/0.`);
}

function aplicarRegrasDaLinha(
  sheet,
  cabecalhos,
  linha,
  camposEditados
) {
  const mapa = mapaCabecalhos(cabecalhos);

  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];
  const colAjuste = mapa[CAB_AJUSTE_PERCENTUAL];
  const colBase = mapa[CAB_PRECO_TOTAL_BASE];

  if (!colTotal || !col1 || !col2 || !col3 || !colAjuste || !colBase) {
    throw new Error(
      'Não encontrei preco_total, ajuste_percentual, preco_total_base ou uma das colunas valor_etapa_1/2/3.'
    );
  }

  let total = numeroDaCelula(sheet.getRange(linha, colTotal));
  let etapa1 = numeroDaCelula(sheet.getRange(linha, col1));
  let etapa2 = numeroDaCelula(sheet.getRange(linha, col2));
  let etapa3 = numeroDaCelula(sheet.getRange(linha, col3));
  let ajuste = normalizarNumero(sheet.getRange(linha, colAjuste).getValue());
  let precoBase = numeroDaCelula(sheet.getRange(linha, colBase));

  // REGRA 0:
  // Ajuste percentual altera SOMENTE o preço total e a etapa 3.
  // Etapas 1 e 2 permanecem exatamente como estão.
  if (camposEditados.has(CAB_AJUSTE_PERCENTUAL)) {
    if (!(precoBase > 0)) {
      precoBase = total > 0
        ? total
        : arredondarCentavos(etapa1 + etapa2 + etapa3);
      if (precoBase > 0) {
        sheet.getRange(linha, colBase).setValue(precoBase);
      }
    }

    if (!(precoBase > 0)) return;

    const totalAjustado = arredondarParaMultiplo(
      precoBase * (1 + ajuste),
      MULTIPLO_PRECO
    );

    const novaEtapa3 = arredondarCentavos(
      totalAjustado - etapa1 - etapa2
    );

    if (totalAjustado < 0 || novaEtapa3 < 0) {
      throw new Error(
        `Linha ${linha}: o ajuste deixa o Projeto Completo abaixo do valor das etapas 1 e 2.`
      );
    }

    sheet.getRange(linha, colTotal).setValue(totalAjustado);
    sheet.getRange(linha, col3).setValue(novaEtapa3);
    return;
  }

  // REGRA 1:
  // Digitou o preço total -> recalcula tudo.
  if (camposEditados.has(CAB_PRECO_TOTAL)) {
    if (!(total > 0)) return;

    // Se existe ajuste ativo, o valor digitado é o total ajustado.
    // Reconstitui o preço-base para que 0% sempre volte ao valor normal correto.
    if (1 + ajuste > 0) {
      precoBase = arredondarCentavos(total / (1 + ajuste));
      sheet.getRange(linha, colBase).setValue(precoBase);
    } else {
      precoBase = total;
      sheet.getRange(linha, colBase).setValue(precoBase);
    }

    etapa1 = Math.max(
      MIN_ETAPA_1,
      arredondarParaMultiplo(
        total * PERCENTUAL_ETAPA_1,
        MULTIPLO_PRECO
      )
    );

    etapa2 = Math.max(
      MIN_ETAPA_2,
      arredondarParaMultiplo(
        total * PERCENTUAL_ETAPA_2,
        MULTIPLO_PRECO
      )
    );

    etapa3 = arredondarCentavos(
      total - etapa1 - etapa2
    );

    if (etapa3 < 0) {
      throw new Error(
        `Linha ${linha}: preço total muito baixo para as etapas 1 e 2.`
      );
    }

    sheet.getRange(linha, col1).setValue(etapa1);
    sheet.getRange(linha, col2).setValue(etapa2);
    sheet.getRange(linha, col3).setValue(etapa3);
    return;
  }

  // REGRA 2:
  // Ajustou manualmente etapa 1 ou 2 -> preserva o total e corrige etapa 3.
  if (
    camposEditados.has(CAB_ETAPA_1) ||
    camposEditados.has(CAB_ETAPA_2)
  ) {
    if (!(total > 0)) {
      total = arredondarCentavos(
        etapa1 + etapa2 + etapa3
      );
      sheet.getRange(linha, colTotal).setValue(total);
      return;
    }

    etapa3 = arredondarCentavos(
      total - etapa1 - etapa2
    );

    if (etapa3 < 0) {
      throw new Error(
        `Linha ${linha}: etapa 1 + etapa 2 ultrapassam o preço total.`
      );
    }

    sheet.getRange(linha, col3).setValue(etapa3);
    return;
  }

  // REGRA 3:
  // Ajustou manualmente etapa 3 -> recalcula o preço total para manter a soma coerente.
  if (camposEditados.has(CAB_ETAPA_3)) {
    total = arredondarCentavos(
      etapa1 + etapa2 + etapa3
    );
    sheet.getRange(linha, colTotal).setValue(total);

    if (1 + ajuste > 0) {
      sheet
        .getRange(linha, colBase)
        .setValue(arredondarCentavos(total / (1 + ajuste)));
    }
  }
}

function enviarLinha(sheet, cabecalhos, linha) {
  const valores =
    sheet
      .getRange(linha, 1, 1, cabecalhos.length)
      .getValues()[0];

  const payload = {};

  cabecalhos.forEach((nome, i) => {
    if (nome) payload[nome] = valores[i];
  });

  if (!payload.ID) {
    throw new Error(
      `Linha ${linha}: ID do Wix está vazio. Sincronização cancelada.`
    );
  }

  const resposta = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = resposta.getResponseCode();

  if (status < 200 || status >= 300) {
    throw new Error(
      `Linha ${linha}: webhook respondeu HTTP ${status}. ` +
      resposta.getContentText().slice(0, 500)
    );
  }
}

function garantirColunaPrecoTotal(sheet) {
  const cabecalhos = obterCabecalhos(sheet);

  if (cabecalhos.includes(CAB_PRECO_TOTAL)) {
    return;
  }

  // IMPORTANTE:
  // cria NO FIM para não deslocar as 13 colunas que o fluxo 029 já grava por posição.
  const novaColuna = sheet.getLastColumn() + 1;
  sheet
    .getRange(1, novaColuna)
    .setValue(CAB_PRECO_TOTAL)
    .setFontWeight('bold');
}


function garantirColunaAjustePercentual(sheet) {
  let cabecalhos = obterCabecalhos(sheet);

  if (cabecalhos.includes(CAB_AJUSTE_PERCENTUAL)) {
    return;
  }

  const mapa = mapaCabecalhos(cabecalhos);
  const colTotal = mapa[CAB_PRECO_TOTAL];

  if (!colTotal) {
    throw new Error('Não encontrei preco_total para criar ajuste_percentual.');
  }

  sheet.insertColumnAfter(colTotal);
  sheet
    .getRange(1, colTotal + 1)
    .setValue(CAB_AJUSTE_PERCENTUAL)
    .setFontWeight('bold');
}

function garantirColunaPrecoBase(sheet) {
  // Mantém a coluna técnica fora do A:Z do módulo Add Row do Make.
  const maxCols = sheet.getMaxColumns();
  if (maxCols < COLUNA_TECNICA_BASE) {
    sheet.insertColumnsAfter(maxCols, COLUNA_TECNICA_BASE - maxCols);
  }

  const cabecalhos = obterCabecalhos(sheet);
  if (!cabecalhos.includes(CAB_PRECO_TOTAL_BASE)) {
    sheet
      .getRange(1, COLUNA_TECNICA_BASE)
      .setValue(CAB_PRECO_TOTAL_BASE);
  }

  sheet.hideColumns(COLUNA_TECNICA_BASE);
}

function inicializarPrecosBase(sheet) {
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);

  const colTotal = mapa[CAB_PRECO_TOTAL];
  const colBase = mapa[CAB_PRECO_TOTAL_BASE];
  const colAjuste = mapa[CAB_AJUSTE_PERCENTUAL];

  if (!colTotal || !colBase || !colAjuste) {
    throw new Error(
      'Não encontrei preco_total, ajuste_percentual ou preco_total_base.'
    );
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const qtd = ultimaLinha - 1;
  const totais = sheet.getRange(2, colTotal, qtd, 1).getValues();
  const bases = sheet.getRange(2, colBase, qtd, 1).getValues();
  const ajustes = sheet.getRange(2, colAjuste, qtd, 1).getValues();

  const novasBases = [];
  const novosAjustes = [];

  for (let i = 0; i < qtd; i++) {
    const baseAtual = normalizarNumero(bases[i][0]);
    const totalAtual = normalizarNumero(totais[i][0]);

    novasBases.push([
      baseAtual > 0 ? baseAtual : (totalAtual > 0 ? totalAtual : '')
    ]);

    novosAjustes.push([
      ajustes[i][0] === '' || ajustes[i][0] === null
        ? 0
        : ajustes[i][0]
    ]);
  }

  sheet.getRange(2, colBase, qtd, 1).setValues(novasBases);
  sheet.getRange(2, colAjuste, qtd, 1).setValues(novosAjustes);
}


function aplicarAjustesPercentuaisExistentes(sheet) {
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);
  const colAjuste = mapa[CAB_AJUSTE_PERCENTUAL];

  if (!colAjuste) return;

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const ajustes =
    sheet
      .getRange(2, colAjuste, ultimaLinha - 1, 1)
      .getValues();

  for (let i = 0; i < ajustes.length; i++) {
    const ajuste = normalizarNumero(ajustes[i][0]);
    if (ajuste === 0) continue;

    aplicarRegrasDaLinha(
      sheet,
      cabecalhos,
      i + 2,
      new Set([CAB_AJUSTE_PERCENTUAL])
    );
  }
}

function preencherPrecosTotaisExistentes(sheet) {
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);

  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];

  if (!colTotal || !col1 || !col2 || !col3) {
    throw new Error(
      'Não encontrei as colunas de preço necessárias.'
    );
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const qtd = ultimaLinha - 1;

  const totaisAtuais =
    sheet.getRange(2, colTotal, qtd, 1).getValues();

  const v1 =
    sheet.getRange(2, col1, qtd, 1).getValues();

  const v2 =
    sheet.getRange(2, col2, qtd, 1).getValues();

  const v3 =
    sheet.getRange(2, col3, qtd, 1).getValues();

  const novosTotais = [];

  for (let i = 0; i < qtd; i++) {
    const jaExiste = normalizarNumero(totaisAtuais[i][0]);

    if (jaExiste > 0) {
      novosTotais.push([jaExiste]);
      continue;
    }

    const total = arredondarCentavos(
      normalizarNumero(v1[i][0]) +
      normalizarNumero(v2[i][0]) +
      normalizarNumero(v3[i][0])
    );

    novosTotais.push([
      total > 0 ? total : ''
    ]);
  }

  sheet
    .getRange(2, colTotal, qtd, 1)
    .setValues(novosTotais);
}

function formatarColunasPreco(sheet) {
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);
  const ultimaLinha = Math.max(sheet.getLastRow(), 2);

  [
    CAB_ETAPA_1,
    CAB_ETAPA_2,
    CAB_ETAPA_3,
    CAB_PRECO_TOTAL
  ].forEach(nome => {
    const col = mapa[nome];
    if (!col) return;

    sheet
      .getRange(2, col, ultimaLinha - 1, 1)
      .setNumberFormat('R$ #,##0.00');
  });
}


function formatarColunaAjuste(sheet) {
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);
  const colAjuste = mapa[CAB_AJUSTE_PERCENTUAL];
  const ultimaLinha = Math.max(sheet.getLastRow(), 2);

  if (!colAjuste) return;

  sheet
    .getRange(2, colAjuste, ultimaLinha - 1, 1)
    .setNumberFormat('+0%;-0%;0%');
}

function recalcularLinhaAtiva() {
  const sheet = obterAba();

  const linha =
    sheet.getActiveRange().getRow();

  if (linha < 2) {
    throw new Error(
      'Selecione uma linha de projeto, não o cabeçalho.'
    );
  }

  const cabecalhos = obterCabecalhos(sheet);

  const mapa = mapaCabecalhos(cabecalhos);
  const ajuste = mapa[CAB_AJUSTE_PERCENTUAL]
    ? normalizarNumero(
        sheet.getRange(linha, mapa[CAB_AJUSTE_PERCENTUAL]).getValue()
      )
    : 0;

  aplicarRegrasDaLinha(
    sheet,
    cabecalhos,
    linha,
    new Set([
      ajuste !== 0
        ? CAB_AJUSTE_PERCENTUAL
        : CAB_PRECO_TOTAL
    ])
  );

  SpreadsheetApp.flush();
  enviarLinha(sheet, cabecalhos, linha);
}

function testarLinhaAtiva() {
  const sheet = obterAba();

  const linha =
    sheet.getActiveRange().getRow();

  if (linha < 2) {
    throw new Error(
      'Selecione uma linha de projeto, não o cabeçalho.'
    );
  }

  const cabecalhos =
    obterCabecalhos(sheet);

  enviarLinha(sheet, cabecalhos, linha);
}

function obterAba() {
  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(NOME_ABA);

  if (!sheet) {
    throw new Error(
      `Não encontrei a aba "${NOME_ABA}".`
    );
  }

  return sheet;
}

function obterCabecalhos(sheet) {
  const ultimaColuna =
    sheet.getLastColumn();

  return sheet
    .getRange(1, 1, 1, ultimaColuna)
    .getValues()[0]
    .map(v => String(v || '').trim());
}

function mapaCabecalhos(cabecalhos) {
  const mapa = {};

  cabecalhos.forEach((nome, i) => {
    if (nome) mapa[nome] = i + 1;
  });

  return mapa;
}

function numeroDaCelula(range) {
  return normalizarNumero(
    range.getValue()
  );
}

function normalizarNumero(valor) {
  if (
    typeof valor === 'number' &&
    Number.isFinite(valor)
  ) {
    return valor;
  }

  let texto =
    String(valor ?? '')
      .trim()
      .replace(/\s/g, '')
      .replace(/^R\$/i, '');

  if (!texto) return 0;

  // Formato brasileiro: 1.234,56
  if (
    texto.includes(',') &&
    texto.includes('.')
  ) {
    texto =
      texto
        .replace(/\./g, '')
        .replace(',', '.');
  } else if (texto.includes(',')) {
    texto =
      texto.replace(',', '.');
  }

  const numero =
    Number(texto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function arredondarParaMultiplo(valor, multiplo) {
  return (
    Math.round(valor / multiplo) *
    multiplo
  );
}

function arredondarCentavos(valor) {
  return (
    Math.round((valor + Number.EPSILON) * 100) /
    100
  );
}


/* =========================================================
   WIX -> GOOGLE SHEETS
   Mantido no MESMO projeto Apps Script do SITE.
   ========================================================= */

/**
 * PELEGO BOX - WIX -> GOOGLE SHEETS
 * Arquivo ADICIONAL. Não substitui o Code.gs atual.
 *
 * Objetivo:
 * - trazer automaticamente as coleções administrativas do Wix para as abas da planilha SITE;
 * - atualizar registros existentes pelo ID;
 * - adicionar registros novos;
 * - não disparar o fluxo reverso de edição, pois escritas feitas por Apps Script
 *   não disparam gatilhos de edição instaláveis do Google Sheets.
 *
 * IMPORTANTE:
 * - usa a MESMA API Key já salva em Script Properties pela automação atual:
 *   WIX_API_KEY_PELEGO
 * - não mexe na aba Videos_projetos;
 * - não apaga linhas;
 * - não remove duplicados antigos;
 * - não altera gatilhos existentes; remove/recria somente o gatilho desta rotina.
 */

const PBX_SYNC_WIX_SITE_ID = 'd1022df4-d4fd-4561-8909-a59d876691b3';
const PBX_SYNC_WIX_API_KEY_PROP = 'WIX_API_KEY_PELEGO';
const PBX_SYNC_WIX_QUERY_URL = 'https://www.wixapis.com/wix-data/v2/items/query';

const PBX_SYNC_RECENTES_POR_COLECAO = 150;
const PBX_SYNC_PAGINA_COMPLETA = 500;
const PBX_SYNC_MAX_ITENS_COMPLETO = 10000;

const PBX_SYNC_CONFIG = [
  {
    sheet: 'Clientes',
    collection: 'Campo',
    sortHeader: 'ultimoAcesso'
  },
  {
    sheet: 'ComprasProjetos',
    collection: 'ComprasProjetos',
    sortHeader: 'dataCompra'
  },
  {
    sheet: 'HistoricoComprasProjetosProntos',
    collection: 'HistoricoComprasProjetosProntos',
    sortHeader: 'Data da compra'
  },
  {
    sheet: 'SessoesProjetosProntos2',
    collection: 'SessoesProjetosProntos2',
    sortHeader: 'Updated At Date'
  },
  {
    sheet: 'MpSessions',
    collection: 'MpSessions',
    sortHeader: 'Updated Date'
  },
  {
    sheet: 'MetodosPagamentoProjetosProntos',
    collection: 'MetodosPagamentoProjetosProntos',
    sortHeader: 'Atualizado em'
  },
  {
    sheet: 'Entregas',
    collection: 'Entregas',
    sortHeader: 'Updated Date'
  }
];

/**
 * Mapeia o nome VISÍVEL da coluna da planilha para o field key REAL do Wix.
 * Campos que já usam o mesmo nome não precisam aparecer aqui.
 */
const PBX_SYNC_FIELD_MAP = {
  Clientes: {
    'CPF/CNPJ': 'cpfCnpj',
    'Title': 'title',
    'ID': '_id',
    'Created Date': '_createdDate',
    'Updated Date': '_updatedDate',
    'Owner': '_owner'
  },

  ComprasProjetos: {
    'E-mail': 'email',
    'Whatsapp': 'whatsapp',
    'Cpfcnpj': 'cpfCnpj',
    'Token de entrega': 'tokenDeEntrega',
    'Checkout ID': 'checkoutId',
    'Cliente ID': 'clienteId',
    'Title': 'title',
    'ID': '_id',
    'Created Date': '_createdDate',
    'Updated Date': '_updatedDate',
    'Owner': '_owner'
  },

  HistoricoComprasProjetosProntos: {
    'Data da compra': 'dataCompra',
    'Nome na compra': 'nomeCompra',
    'E-mail da compra': 'emailCompra',
    'WhatsApp na compra': 'whatsappCompra',
    'CPF na compra': 'cpfCompra',
    'Código do projeto': 'codigoProjeto',
    'Tipo do produto': 'tipoProduto',
    'Produto': 'produto',
    'Valor da compra': 'valorCompra',
    'Forma de pagamento': 'formaPagamento',
    'Status da compra': 'statusCompra',
    'Código da compra': 'codigoCompra',
    'Title': 'title',
    'ID do pagamento': 'idPagamento',
    'ID do checkout': 'checkoutId',
    'ID do cliente': 'clienteId',
    'ID': '_id',
    'Created Date': '_createdDate',
    'Updated Date': '_updatedDate',
    'Owner': '_owner'
  },

  SessoesProjetosProntos2: {
    'Status': 'status',
    'Compra Registrada': 'compraRegistrada',
    'Nomecliente': 'nomeCliente',
    'Email': 'email',
    'Whatsapp': 'whatsapp',
    'Cpfcnpj': 'cpfCnpj',
    'Código Projeto': 'codigoProjeto',
    'Tipo Produto': 'tipoProduto',
    'Produto': 'produto',
    'Valor': 'valor',
    'Payment ID': 'paymentId',
    'Token Entrega': 'tokenEntrega',
    'Emailenviadoem': 'emailEnviadoEm',
    'Chatbotvendaenviado': 'chatbotVendaEnviado',
    'Created At Date': 'createdAtDate',
    'Updated At Date': 'updatedAtDate',
    'Checkout ID': 'checkoutId',
    'Código Checkout': 'codigoCheckout',
    'SKU': 'sku',
    'Return URL': 'returnUrl',
    'Imagem': 'imagem',
    'Cliente ID': 'clienteId',
    'Preference ID': 'preferenceId',
    'ValidaPay Product ID': 'validaPayProductId',
    'ValidaPay Price ID': 'validaPayPriceId',
    'ValidaPay Charge ID': 'validaPayChargeId',
    'Abandonsent': 'abandonSent',
    'Abandonsentat': 'abandonSentAt',
    'ID': '_id',
    'Created Date': '_createdDate',
    'Updated Date': '_updatedDate',
    'Owner': '_owner'
  },

  MpSessions: {
    'Created Date': '_createdDate',
    'Updated Date': '_updatedDate',
    'ID': '_id',
    'Owner': '_owner',
    'Title': 'title'
  },

  MetodosPagamentoProjetosProntos: {
    'E-mail do login': 'email',
    'Nome no cartão': 'cardHolderName',
    'Bandeira': 'cardBrand',
    'Últimos 4': 'cardLastFour',
    'Mês validade': 'cardExpirationMonth',
    'Ano validade': 'cardExpirationYear',
    'CPF/CNPJ do portador': 'cardDocument',
    'Ativo': 'ativo',
    'Criado em': 'criadoEm',
    'Atualizado em': 'atualizadoEm',
    'Último ID de pagamento': 'ultimoPagamentoId',
    'Wix Member ID': 'memberId',
    'ID do cliente': 'clienteId',
    'ValidaPay Payment Method ID': 'paymentMethodId',
    'ValidaPay Customer ID': 'validaPayCustomerId',
    'ID': '_id',
    'Data de criação': '_createdDate',
    'Data de atualização': '_updatedDate',
    'Proprietário': '_owner',
    'Title': 'title'
  },

  Entregas: {
    'Created Date': '_createdDate',
    'Updated Date': '_updatedDate',
    'ID': '_id',
    'Owner': '_owner',
    'Title': 'title'
  }
};

/**
 * EXECUTE UMA VEZ.
 * Faz uma carga completa imediatamente e instala atualização automática a cada 1 minuto.
 */
function pbxInstalarWixParaSheets() {
  const apiKey = pbxObterApiKeyWix_();

  if (!apiKey) {
    throw new Error(
      'API Key Wix não encontrada. A chave WIX_API_KEY_PELEGO precisa continuar salva nas Script Properties.'
    );
  }

  pbxRemoverSomenteMeuGatilho_();

  ScriptApp.newTrigger('pbxSincronizarWixParaSheets')
    .timeBased()
    .everyMinutes(1)
    .create();

  const resultado = pbxSincronizarWixParaSheetsCompleto();

  SpreadsheetApp.getActive().toast(
    `Wix -> Sheets instalado. ${resultado.novos} novo(s), ${resultado.atualizados} atualizado(s).`,
    'PELEGO BOX',
    8
  );
}

/**
 * Rotina executada pelo gatilho a cada minuto.
 * Busca os 150 itens mais recentemente atualizados de cada coleção.
 */
function pbxSincronizarWixParaSheets() {
  return pbxExecutarSincronizacaoWixSheets_(false);
}

/**
 * Carga completa manual.
 * Útil para recuperar vendas que ficaram faltando antes da instalação.
 */
function pbxSincronizarWixParaSheetsCompleto() {
  return pbxExecutarSincronizacaoWixSheets_(true);
}

/**
 * Teste rápido: consulta o Wix e mostra quantos itens recentes foram encontrados
 * sem alterar a planilha.
 */
function pbxTestarLeituraWix() {
  const apiKey = pbxObterApiKeyWix_();
  if (!apiKey) throw new Error('API Key Wix não encontrada.');

  const linhas = [];

  PBX_SYNC_CONFIG.forEach(cfg => {
    try {
      const itens = pbxConsultarItensWix_(cfg.collection, apiKey, false);
      linhas.push(`${cfg.sheet}: ${itens.length} item(ns) lido(s)`);
    } catch (err) {
      linhas.push(`${cfg.sheet}: ERRO - ${err.message || err}`);
    }
  });

  SpreadsheetApp.getUi().alert(
    'Teste Wix -> Sheets',
    linhas.join('\n'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function pbxExecutarSincronizacaoWixSheets_(completa) {
  const lock = LockService.getDocumentLock();

  // Não deixa duas execuções simultâneas brigarem pelas mesmas linhas.
  if (!lock.tryLock(15000)) {
    return { novos: 0, atualizados: 0, erros: ['Outra sincronização já está em execução.'] };
  }

  try {
    const ss = SpreadsheetApp.getActive();
    const apiKey = pbxObterApiKeyWix_();

    if (!apiKey) {
      throw new Error('API Key Wix não encontrada em Script Properties.');
    }

    const total = {
      novos: 0,
      atualizados: 0,
      erros: []
    };

    PBX_SYNC_CONFIG.forEach(cfg => {
      try {
        const sheet = ss.getSheetByName(cfg.sheet);

        // Se uma aba não existir, ignora somente ela.
        if (!sheet) {
          total.erros.push(`${cfg.sheet}: aba não encontrada`);
          return;
        }

        const itens = pbxConsultarItensWix_(cfg.collection, apiKey, completa);
        const r = pbxUpsertItensNaAba_(sheet, cfg, itens);

        total.novos += r.novos;
        total.atualizados += r.atualizados;

      } catch (err) {
        total.erros.push(`${cfg.sheet}: ${err.message || err}`);
      }
    });

    SpreadsheetApp.flush();

    if (total.erros.length) {
      console.warn('Wix -> Sheets:', total.erros.join(' | '));
    }

    return total;

  } finally {
    lock.releaseLock();
  }
}

function pbxConsultarItensWix_(collectionId, apiKey, completa) {
  const todos = [];
  let offset = 0;

  while (true) {
    const limite = completa
      ? PBX_SYNC_PAGINA_COMPLETA
      : PBX_SYNC_RECENTES_POR_COLECAO;

    const payload = {
      dataCollectionId: collectionId,
      consistentRead: true,
      returnTotalCount: completa,
      query: {
        sort: [
          {
            fieldName: '_updatedDate',
            order: 'DESC'
          }
        ],
        paging: {
          limit: limite,
          offset: offset
        }
      }
    };

    const response = UrlFetchApp.fetch(PBX_SYNC_WIX_QUERY_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: apiKey,
        'wix-site-id': PBX_SYNC_WIX_SITE_ID,
        Accept: 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const texto = response.getContentText();

    if (status < 200 || status >= 300) {
      throw new Error(
        `Wix HTTP ${status} na coleção ${collectionId}: ${texto.slice(0, 500)}`
      );
    }

    let body = {};
    try {
      body = texto ? JSON.parse(texto) : {};
    } catch (_) {
      throw new Error(`Resposta inválida do Wix na coleção ${collectionId}.`);
    }

    const itens = Array.isArray(body.dataItems) ? body.dataItems : [];
    todos.push(...itens);

    // A rotina de 1 minuto precisa apenas dos recentes.
    if (!completa) break;

    const meta = body.pagingMetadata || {};

    if (!meta.hasNext || itens.length === 0) break;

    offset += itens.length;

    if (offset >= PBX_SYNC_MAX_ITENS_COMPLETO) break;
  }

  return todos;
}

function pbxUpsertItensNaAba_(sheet, cfg, dataItems) {
  if (!dataItems || dataItems.length === 0) {
    return { novos: 0, atualizados: 0 };
  }

  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    throw new Error('A aba não possui cabeçalhos.');
  }

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getDisplayValues()[0]
    .map(v => String(v || '').trim());

  const idCol = headers.findIndex(h => h === 'ID') + 1;

  if (!idCol) {
    throw new Error('Coluna ID não encontrada.');
  }

  const lastRow = Math.max(sheet.getLastRow(), 1);

  const idsExistentes = lastRow >= 2
    ? sheet.getRange(2, idCol, lastRow - 1, 1).getDisplayValues()
    : [];

  const linhaPorId = new Map();

  idsExistentes.forEach((r, i) => {
    const id = String(r[0] || '').trim();
    if (id && !linhaPorId.has(id)) {
      linhaPorId.set(id, i + 2);
    }
  });

  const atualizacoes = [];
  const novasLinhas = [];

  dataItems.forEach(item => {
    const data = item && item.data ? item.data : {};
    const id = String(
      (item && item.id) ||
      data._id ||
      ''
    ).trim();

    if (!id) return;

    // Garante os metadados mesmo quando vierem fora do objeto data.
    const objeto = {
      ...data,
      _id: data._id || id,
      _createdDate: data._createdDate || (item && item.createdDate) || '',
      _updatedDate: data._updatedDate || (item && item.updatedDate) || '',
      _owner: data._owner || (item && item.owner) || ''
    };

    const linhaExistente = linhaPorId.get(id);

    if (linhaExistente) {
      atualizacoes.push({
        row: linhaExistente,
        data: objeto
      });
    } else {
      novasLinhas.push(objeto);
    }
  });

  // Atualiza somente valores mapeados nas linhas já existentes.
  atualizacoes.forEach(entry => {
    const range = sheet.getRange(entry.row, 1, 1, lastCol);
    const valores = range.getValues()[0];

    headers.forEach((header, i) => {
      const field = pbxCampoWixDoCabecalho_(cfg.sheet, header);

      if (!field) return;
      if (!Object.prototype.hasOwnProperty.call(entry.data, field)) return;

      valores[i] = pbxValorParaSheet_(entry.data[field], field, header);
    });

    range.setValues([valores]);
  });

  // Linhas novas entram já com todas as colunas conhecidas.
  if (novasLinhas.length) {
    const matriz = novasLinhas.map(objeto => {
      return headers.map(header => {
        const field = pbxCampoWixDoCabecalho_(cfg.sheet, header);
        if (!field) return '';

        return pbxValorParaSheet_(objeto[field], field, header);
      });
    });

    const primeiraNovaLinha = sheet.getLastRow() + 1;
    sheet
      .getRange(primeiraNovaLinha, 1, matriz.length, lastCol)
      .setValues(matriz);
  }

  pbxFormatarAbaDepoisSync_(sheet, cfg, headers);
  pbxOrdenarAbaDepoisSync_(sheet, cfg, headers);

  return {
    novos: novasLinhas.length,
    atualizados: atualizacoes.length
  };
}

function pbxCampoWixDoCabecalho_(sheetName, header) {
  if (!header) return '';

  const map = PBX_SYNC_FIELD_MAP[sheetName] || {};

  if (Object.prototype.hasOwnProperty.call(map, header)) {
    return map[header];
  }

  // Quando o cabeçalho já é o próprio field key Wix.
  return header;
}

function pbxValorParaSheet_(valor, field, header) {
  if (valor === undefined || valor === null) return '';

  // Datas Wix REST podem chegar como {"$date":"..."}.
  if (
    typeof valor === 'object' &&
    !Array.isArray(valor) &&
    Object.prototype.hasOwnProperty.call(valor, '$date')
  ) {
    const d = new Date(valor.$date);
    return Number.isNaN(d.getTime()) ? String(valor.$date) : d;
  }

  const nome = String(field || header || '').toLowerCase();

  if (
    nome.includes('date') ||
    nome.endsWith('em') ||
    nome.endsWith('at') ||
    nome === 'datacompra' ||
    nome === 'dataliberacao' ||
    nome === 'dataprocessamento' ||
    nome === 'criadoem' ||
    nome === 'atualizadoem' ||
    nome === 'ultimoacesso'
  ) {
    if (valor instanceof Date) return valor;

    if (typeof valor === 'string' && valor) {
      const d = new Date(valor);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  // Preserva telefone, CPF/CNPJ, IDs, códigos e últimos 4 como TEXTO.
  if (
    nome.includes('whatsapp') ||
    nome.includes('cpf') ||
    nome.includes('cnpj') ||
    nome.includes('checkoutid') ||
    nome.includes('paymentid') ||
    nome.includes('clienteid') ||
    nome.includes('idpagamento') ||
    nome === '_id' ||
    nome === '_owner' ||
    nome === 'codigoprojeto' ||
    nome === 'codigocompra' ||
    nome === 'codigocheckout' ||
    nome === 'cardlastfour' ||
    nome === 'cardexpirationmonth' ||
    nome === 'cardexpirationyear'
  ) {
    return String(valor);
  }

  if (typeof valor === 'object') {
    try {
      return JSON.stringify(valor);
    } catch (_) {
      return String(valor);
    }
  }

  return valor;
}

function pbxFormatarAbaDepoisSync_(sheet, cfg, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const linhas = lastRow - 1;

  headers.forEach((header, idx) => {
    const col = idx + 1;
    const h = String(header || '').toLowerCase();
    const campo = String(pbxCampoWixDoCabecalho_(cfg.sheet, header) || '').toLowerCase();
    const range = sheet.getRange(2, col, linhas, 1);

    if (
      h.includes('cpf') ||
      h.includes('cnpj') ||
      h.includes('código') ||
      h.includes('codigo') ||
      h.includes('últimos 4') ||
      h.includes('id') ||
      campo.includes('cpf') ||
      campo.includes('cnpj') ||
      campo.includes('codigo') ||
      campo === '_id' ||
      campo === '_owner'
    ) {
      range.setNumberFormat('@');
      return;
    }

    if (h.includes('whatsapp') || campo.includes('whatsapp')) {
      range.setNumberFormat('@');
      return;
    }

    if (
      h.includes('valor') ||
      h === 'price' ||
      campo === 'valor' ||
      campo === 'valorcompra'
    ) {
      range.setNumberFormat('R$ #,##0.00');
      return;
    }

    if (
      h.includes('data') ||
      h.includes('criado em') ||
      h.includes('atualizado em') ||
      h.includes('último acesso') ||
      h.includes('ultimoacesso') ||
      campo.includes('date') ||
      campo.endsWith('em') ||
      campo.endsWith('at')
    ) {
      range.setNumberFormat('dd/MM/yyyy HH:mm');
    }
  });
}

function pbxOrdenarAbaDepoisSync_(sheet, cfg, headers) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return;

  const col = headers.indexOf(cfg.sortHeader) + 1;
  if (!col) return;

  // Mantém registros mais novos no topo sem mexer no cabeçalho.
  sheet
    .getRange(2, 1, lastRow - 1, sheet.getLastColumn())
    .sort({
      column: col,
      ascending: false
    });
}

function pbxObterApiKeyWix_() {
  return String(
    PropertiesService
      .getScriptProperties()
      .getProperty(PBX_SYNC_WIX_API_KEY_PROP) ||
    ''
  ).trim();
}

function pbxRemoverSomenteMeuGatilho_() {
  ScriptApp
    .getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'pbxSincronizarWixParaSheets')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

/* =========================================================
   DASHBOARD MENSAL V2 - PELEGO BOX
   Arquivo pode ficar no mesmo projeto Apps Script.
   ========================================================= */

function refazerDashboardMensalV2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Dashboard_Mensal');
  if (!sh) throw new Error('Aba Dashboard_Mensal não encontrada.');

  sh.setHiddenGridlines(true);
  sh.getCharts().forEach(ch => sh.removeChart(ch));

  const colWidths = [120,120,120,120,120,120,120,120,120,120,120,120,120,120];
  colWidths.forEach((w, i) => sh.setColumnWidth(i + 1, w));

  for (let r = 1; r <= 30; r++) sh.setRowHeight(r, 28);
  sh.setRowHeight(1, 34);
  sh.setRowHeight(2, 34);
  sh.setRowHeight(5, 22);
  sh.setRowHeight(6, 38);
  sh.setRowHeight(7, 38);
  sh.setRowHeight(8, 38);

  if (sh.getMaxColumns() > 14) sh.hideColumns(15, sh.getMaxColumns() - 14);
  if (sh.getMaxRows() > 30) sh.hideRows(31, sh.getMaxRows() - 30);

  const BG = '#EAF1F8';
  const CARD = '#FFFFFF';
  const CARD2 = '#F7FAFC';
  const TXT = '#102A43';
  const SUB = '#486581';
  const CYAN = '#00B8D9';
  const PURPLE = '#7C4DFF';
  const YELLOW = '#FFB300';
  const LIME = '#36B37E';
  const PINK = '#FF4D8D';
  const ORANGE = '#FF8B3D';
  const BLUE = '#2684FF';

  sh.getRange('A1:N30').setBackground(BG).setFontColor(TXT).setFontFamily('Arial');

  sh.getRange('A1:J2')
    .setBackground('#102A43')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setFontSize(16);

  sh.getRange('K1:N2')
    .setBackground('#173F5F')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');

  sh.getRange('A3:N3')
    .setBackground('#D9EAF7')
    .setFontColor('#102A43')
    .setFontWeight('bold');

  const cards = ['A5:C8','D5:F8','G5:I8','J5:K8','L5:N8'];
  const borderColors = [CYAN,PURPLE,PINK,LIME,YELLOW];

  cards.forEach((rng, i) => {
    sh.getRange(rng)
      .setBackground(CARD2)
      .setBorder(true,true,true,true,false,false,borderColors[i], SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });

  sh.getRange('A5:N8').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange('A5:N5').setFontColor(SUB).setFontWeight('bold').setFontSize(10);
  sh.getRange('A6:N8').setFontColor(TXT).setFontWeight('bold').setFontSize(18);

  ['A10:G18','H10:N18','A19:G28','H19:N28'].forEach(rng => {
    sh.getRange(rng)
      .setBackground(CARD)
      .setBorder(true,true,true,true,false,false,'#BCCCDC', SpreadsheetApp.BorderStyle.SOLID);
  });

  // Gráfico combinado: faturamento + vendas por dia.
  const chart1 = sh.newChart()
    .setChartType(Charts.ChartType.COMBO)
    .addRange(sh.getRange('A31:C62'))
    .setNumHeaders(1)
    .setPosition(10, 1, 0, 0)
    .setOption('title', 'Vendas por dia + Faturamento por dia')
    .setOption('backgroundColor', CARD)
    .setOption('chartArea', {left: 60, top: 38, width: '78%', height: '62%'})
    .setOption('titleTextStyle', {color: TXT, bold: true, fontSize: 14})
    .setOption('legend', {position: 'top', textStyle: {color: TXT}})
    .setOption('hAxis', {textStyle: {color: SUB}})
    .setOption('vAxes', {
      0: {title: 'Faturamento (R$)', textStyle: {color: SUB}, titleTextStyle: {color: CYAN}, minValue: 0},
      1: {title: 'Vendas', textStyle: {color: SUB}, titleTextStyle: {color: YELLOW}, minValue: 0}
    })
    .setOption('series', {
      0: {type: 'bars', targetAxisIndex: 0, color: CYAN},
      1: {type: 'line', targetAxisIndex: 1, color: YELLOW, lineWidth: 3, pointSize: 5}
    })
    .setOption('height', 260)
    .setOption('width', 720)
    .build();
  sh.insertChart(chart1);

  // Top 10 por faturamento do projeto.
  const chart2 = sh.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange('H31:H41'))
    .addRange(sh.getRange('J31:J41'))
    .setNumHeaders(1)
    .setPosition(10, 8, 0, 0)
    .setOption('title', 'Faturamento por projeto • Top 10')
    .setOption('backgroundColor', CARD)
    .setOption('chartArea', {left: 90, top: 38, width: '70%', height: '68%'})
    .setOption('titleTextStyle', {color: TXT, bold: true, fontSize: 14})
    .setOption('legend', {position: 'none'})
    .setOption('hAxis', {textStyle: {color: SUB}, minValue: 0})
    .setOption('vAxis', {textStyle: {color: SUB}})
    .setOption('colors', [PURPLE])
    .setOption('height', 260)
    .setOption('width', 540)
    .build();
  sh.insertChart(chart2);

  // Top 10 projetos mais vendidos em rosca.
  const chart3 = sh.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange('H31:I41'))
    .setNumHeaders(1)
    .setPosition(19, 1, 0, 0)
    .setOption('title', 'Projetos mais vendidos • Top 10')
    .setOption('backgroundColor', CARD)
    .setOption('chartArea', {left: 20, top: 38, width: '88%', height: '72%'})
    .setOption('titleTextStyle', {color: TXT, bold: true, fontSize: 14})
    .setOption('legend', {position: 'right', textStyle: {color: TXT, fontSize: 10}})
    .setOption('pieHole', 0.48)
    .setOption('pieSliceText', 'value')
    .setOption('colors', [CYAN,PURPLE,YELLOW,LIME,PINK,ORANGE,BLUE,'#00A896','#FF6B35','#845EC2'])
    .setOption('height', 240)
    .setOption('width', 560)
    .build();
  sh.insertChart(chart3);

  // Top 10 clientes do mês.
  const chart4 = sh.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange('L31:L41'))
    .addRange(sh.getRange('N31:N41'))
    .setNumHeaders(1)
    .setPosition(19, 8, 0, 0)
    .setOption('title', 'Clientes que mais faturam • Top 10 do mês')
    .setOption('backgroundColor', CARD)
    .setOption('chartArea', {left: 115, top: 38, width: '66%', height: '70%'})
    .setOption('titleTextStyle', {color: TXT, bold: true, fontSize: 14})
    .setOption('legend', {position: 'none'})
    .setOption('hAxis', {textStyle: {color: SUB}, minValue: 0})
    .setOption('vAxis', {textStyle: {color: SUB}})
    .setOption('colors', [BLUE])
    .setOption('height', 240)
    .setOption('width', 560)
    .build();
  sh.insertChart(chart4);
}
