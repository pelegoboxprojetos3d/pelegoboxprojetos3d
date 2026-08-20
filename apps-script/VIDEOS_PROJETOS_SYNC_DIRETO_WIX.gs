/**
 * PELEGO BOX - VIDEOS_PROJETOS -> WIX DIRETO
 *
 * Mantem as regras comerciais de Videos_projetos e funciona como ponto de entrada
 * do sincronizador geral bidirecional da planilha SITE.
 */

function instalarSyncDiretoVideos() {
  const ss = SpreadsheetApp.getActive();

  const handlersAntigos = new Set([
    'sincronizarEdicao',
    'sincronizarEdicaoVideosDiretoWix',
    'processarNovasLinhasPendentes',
    'processarNovasLinhasPendentesDiretoWix'
  ]);

  ScriptApp.getProjectTriggers()
    .filter(t => handlersAntigos.has(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('sincronizarEdicaoVideosDiretoWix')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  ScriptApp.newTrigger('processarNovasLinhasPendentesDiretoWix')
    .timeBased()
    .everyMinutes(1)
    .create();

  ss.toast(
    'Sync direto Videos + sincronizacao geral SITE <-> Wix instalada.',
    'PELEGO BOX',
    8
  );
}

function sincronizarEdicaoVideosDiretoWix(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const nomeAba = sheet.getName();

  // Clientes conserva as validacoes especificas ja existentes e, em seguida,
  // passa pelo sincronizador geral para os demais campos da mesma colecao.
  if (nomeAba === NOME_ABA_CLIENTES) {
    sincronizarEdicaoClientes_(e);
    if (typeof pbxSincronizarEdicaoAbaGenericaWix_ === 'function') {
      pbxSincronizarEdicaoAbaGenericaWix_(e);
    }
    return;
  }

  // Todas as outras abas de dados da planilha SITE sao tratadas pelo sync geral.
  if (nomeAba !== NOME_ABA) {
    if (typeof pbxSincronizarEdicaoAbaGenericaWix_ === 'function') {
      pbxSincronizarEdicaoAbaGenericaWix_(e);
    }
    return;
  }

  if (e.range.getRow() < 2) return;

  const apiKey = obterWixApiKey_();
  if (!apiKey) {
    throw new Error('API Wix nao configurada. Nada foi enviado ao Wix.');
  }

  const cabecalhos = obterCabecalhos(sheet);
  const primeiraColuna = e.range.getColumn();
  const ultimaColuna = primeiraColuna + e.range.getNumColumns() - 1;
  const camposEditados = new Set();

  for (let col = primeiraColuna; col <= ultimaColuna; col++) {
    const nome = cabecalhos[col - 1];
    if (CAMPOS_EDITAVEIS.has(nome)) camposEditados.add(nome);
  }

  // Marca, slug, thumbnail, link e outros campos de Videos nao precisam das
  // regras de preco, mas ainda precisam ir ao Wix.
  if (camposEditados.size === 0) {
    if (typeof pbxSincronizarEdicaoAbaGenericaWix_ === 'function') {
      pbxSincronizarEdicaoAbaGenericaWix_(e);
    }
    return;
  }

  const primeiraLinha = e.range.getRow();
  const ultimaLinha = primeiraLinha + e.range.getNumRows() - 1;
  const patches = [];

  for (let linha = primeiraLinha; linha <= ultimaLinha; linha++) {
    pbxAplicarRegrasPrecoMultiplo5_(sheet, cabecalhos, linha, camposEditados);
    const patch = pbxCriarPatchVideos_(sheet, cabecalhos, linha);
    if (patch) patches.push(patch);
  }

  SpreadsheetApp.flush();

  const r = sincronizarPatchesWix_(patches, apiKey);
  if (r.erros.length) {
    SpreadsheetApp.getActive().toast(
      'Planilha alterada, mas houve falha ao atualizar o Wix.',
      'VIDEOS -> WIX: ERRO',
      10
    );
    throw new Error('Videos_projetos -> Wix: ' + r.erros.join(' | '));
  }

  // Complementa com campos que nao pertencem ao conjunto comercial antigo e
  // atualiza o estado do sincronizador bidirecional.
  if (typeof pbxSincronizarEdicaoAbaGenericaWix_ === 'function') {
    pbxSincronizarEdicaoAbaGenericaWix_(e);
  }

  SpreadsheetApp.getActive().toast(
    `${r.sucessos} projeto(s) sincronizado(s) direto com Wix.`,
    'VIDEOS -> WIX',
    4
  );
}

function processarNovasLinhasPendentesDiretoWix() {
  // Este gatilho ja roda a cada minuto. Aproveitamos o mesmo relogio para manter
  // TODAS as abas de dados da planilha SITE e as colecoes Wix reconciliadas.
  if (typeof pbxSincronizacaoGeralUmCiclo_ === 'function') {
    try {
      pbxSincronizacaoGeralUmCiclo_();
    } catch (err) {
      console.error('Sincronizacao geral SITE <-> Wix: ' + (err && err.message ? err.message : err));
    }
  }

  const sheet = obterAba();
  const cabecalhos = obterCabecalhos(sheet);
  const mapa = mapaCabecalhos(cabecalhos);

  const colId = mapa.ID;
  const colOrdem = mapa.ordem_video;
  const colTitulo = mapa.titulo_video;
  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];
  const colAjuste = mapa[CAB_AJUSTE_PERCENTUAL];
  const colBase = mapa[CAB_PRECO_TOTAL_BASE];

  if (!colId || !colOrdem || !colTitulo || !colTotal || !col1 || !col2 || !col3 || !colAjuste || !colBase) {
    throw new Error('Nao encontrei as colunas necessarias para processar novas linhas.');
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const primeiraLinhaBusca = Math.max(2, ultimaLinha - 99);
  const qtd = ultimaLinha - primeiraLinhaBusca + 1;
  const dados = sheet.getRange(primeiraLinhaBusca, 1, qtd, sheet.getLastColumn()).getValues();

  const apiKey = obterWixApiKey_();
  if (!apiKey) throw new Error('API Wix nao configurada.');

  const linhasProcessadas = [];
  const linhasParaPatch = new Set();

  for (let i = 0; i < dados.length; i++) {
    const linha = primeiraLinhaBusca + i;
    const row = dados[i];

    let id = String(row[colId - 1] ?? '').trim();
    const ordem = normalizarNumero(row[colOrdem - 1]);
    const titulo = String(row[colTitulo - 1] ?? '').trim();
    const totalBruto = normalizarNumero(row[colTotal - 1]);

    const vazio1 = row[col1 - 1] === '' || row[col1 - 1] === null;
    const vazio2 = row[col2 - 1] === '' || row[col2 - 1] === null;
    const vazio3 = row[col3 - 1] === '' || row[col3 - 1] === null;
    const etapasVazias = vazio1 && vazio2 && vazio3;

    if (!(ordem > 0) || !titulo || !(totalBruto > 0)) continue;
    if (id && !etapasVazias) continue;

    if (etapasVazias) {
      const totalRedondo = arredondarParaMultiplo(totalBruto, MULTIPLO_PRECO);
      sheet.getRange(linha, colTotal).setValue(totalRedondo);
      sheet.getRange(linha, colTotal).setNumberFormat('R$ #,##0.00');
      sheet.getRange(linha, colBase).setValue(totalRedondo);

      if (row[colAjuste - 1] === '' || row[colAjuste - 1] === null) {
        sheet.getRange(linha, colAjuste).setValue(0);
      }

      aplicarRegrasDaLinha(sheet, cabecalhos, linha, new Set([CAB_PRECO_TOTAL]));
    }

    SpreadsheetApp.flush();

    if (!id) {
      id = pbxBuscarIdWixPorOrdem_(ordem, apiKey);

      if (id) {
        sheet.getRange(linha, colId).setValue(id);
        linhasParaPatch.add(linha);
      } else {
        id = pbxCriarItemWix_(sheet, cabecalhos, linha, apiKey);
        sheet.getRange(linha, colId).setValue(id);
      }

      SpreadsheetApp.flush();
    } else if (etapasVazias) {
      linhasParaPatch.add(linha);
    }

    linhasProcessadas.push(linha);
  }

  if (linhasProcessadas.length === 0) return;

  SpreadsheetApp.flush();

  const patches = Array.from(linhasParaPatch)
    .map(linha => pbxCriarPatchVideos_(sheet, cabecalhos, linha))
    .filter(Boolean);

  const r = sincronizarPatchesWix_(patches, apiKey);
  if (r.erros.length) {
    throw new Error('Novas linhas -> Wix: ' + r.erros.join(' | '));
  }

  ordenarProjetosMaisNovosPrimeiro(sheet);
}

function pbxAplicarRegrasPrecoMultiplo5_(sheet, cabecalhos, linha, camposEditados) {
  const mapa = mapaCabecalhos(cabecalhos);
  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];

  if (!colTotal || !col1 || !col2 || !col3) {
    throw new Error(`Linha ${linha}: colunas de preco nao encontradas.`);
  }

  if (camposEditados.has(CAB_PRECO_TOTAL)) {
    const bruto = normalizarNumero(sheet.getRange(linha, colTotal).getValue());
    if (bruto > 0) {
      sheet.getRange(linha, colTotal).setValue(arredondarParaMultiplo(bruto, MULTIPLO_PRECO));
      sheet.getRange(linha, colTotal).setNumberFormat('R$ #,##0.00');
    }
  }

  aplicarRegrasDaLinha(sheet, cabecalhos, linha, camposEditados);

  if (camposEditados.has(CAB_ETAPA_3)) {
    const e1 = normalizarNumero(sheet.getRange(linha, col1).getValue());
    const e2 = normalizarNumero(sheet.getRange(linha, col2).getValue());
    const e3 = normalizarNumero(sheet.getRange(linha, col3).getValue());
    const totalRedondo = arredondarParaMultiplo(e1 + e2 + e3, MULTIPLO_PRECO);
    sheet.getRange(linha, colTotal).setValue(totalRedondo);
    sheet.getRange(linha, colTotal).setNumberFormat('R$ #,##0.00');
    sheet.getRange(linha, col3).setValue(arredondarCentavos(totalRedondo - e1 - e2));
  }
}

function pbxCriarPatchVideos_(sheet, cabecalhos, linha) {
  const mapa = mapaCabecalhos(cabecalhos);
  const colId = mapa.ID;
  if (!colId) throw new Error('Coluna ID nao encontrada.');

  const id = String(sheet.getRange(linha, colId).getValue() || '').trim();
  if (!id) return null;

  const mods = [];
  const adicionar = (campo, valor) => {
    mods.push({ fieldPath: campo, action: 'SET_FIELD', setFieldOptions: { value: valor } });
  };

  if (mapa.titulo_video) adicionar('titulo_video', String(sheet.getRange(linha, mapa.titulo_video).getValue() || ''));
  if (mapa.valor_etapa_1) adicionar('valor_etapa_1', normalizarNumero(sheet.getRange(linha, mapa.valor_etapa_1).getValue()));
  if (mapa.valor_etapa_2) adicionar('valor_etapa_2', normalizarNumero(sheet.getRange(linha, mapa.valor_etapa_2).getValue()));
  if (mapa.valor_etapa_3) adicionar('valor_etapa_3', normalizarNumero(sheet.getRange(linha, mapa.valor_etapa_3).getValue()));
  if (mapa.ativo_checkout) adicionar('ativo_checkout', String(sheet.getRange(linha, mapa.ativo_checkout).getValue() || ''));

  return { dataItemId: id, fieldModifications: mods };
}

function pbxBuscarIdWixPorOrdem_(ordemVideo, apiKey) {
  if (!(ordemVideo > 0)) return '';

  const response = UrlFetchApp.fetch('https://www.wixapis.com/wix-data/v2/items/query', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: apiKey, 'wix-site-id': WIX_SITE_ID, Accept: 'application/json' },
    payload: JSON.stringify({
      dataCollectionId: WIX_COLLECTION_ID,
      query: {
        filter: { ordem_video: { '$eq': ordemVideo } },
        fields: ['ordem_video'],
        paging: { limit: 1, offset: 0 }
      }
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const texto = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Buscar projeto Wix: HTTP ${status} - ${texto.slice(0, 500)}`);
  }

  let body = {};
  try { body = texto ? JSON.parse(texto) : {}; } catch (_) { throw new Error('Buscar projeto Wix: resposta JSON invalida.'); }

  const itens = Array.isArray(body.dataItems)
    ? body.dataItems
    : (body.data && Array.isArray(body.data.dataItems) ? body.data.dataItems : []);

  if (!itens.length) return '';
  const item = itens[0] || {};
  return String(item.id || item._id || item.dataItemId || '').trim();
}

function pbxCriarItemWix_(sheet, cabecalhos, linha, apiKey) {
  const mapa = mapaCabecalhos(cabecalhos);
  const valor = campo => {
    const col = mapa[campo];
    return col ? sheet.getRange(linha, col).getValue() : '';
  };
  const numero = campo => normalizarNumero(valor(campo));

  const data = {
    ordem_video: numero('ordem_video'),
    titulo_video: String(valor('titulo_video') || ''),
    thumbnail: String(valor('thumbnail') || ''),
    link_video: String(valor('link_video') || ''),
    marca_1: String(valor('marca_1') || ''),
    marca_2: String(valor('marca_2') || ''),
    marca_3: String(valor('marca_3') || ''),
    valor_etapa_1: numero('valor_etapa_1'),
    valor_etapa_2: numero('valor_etapa_2'),
    valor_etapa_3: numero('valor_etapa_3'),
    slug_checkout: String(valor('slug_checkout') || ''),
    ativo_checkout: String(valor('ativo_checkout') || '')
  };

  const response = UrlFetchApp.fetch('https://www.wixapis.com/wix-data/v2/items', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: apiKey, 'wix-site-id': WIX_SITE_ID, Accept: 'application/json' },
    payload: JSON.stringify({ dataCollectionId: WIX_COLLECTION_ID, dataItem: { data } }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const texto = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(`Criar projeto Wix: HTTP ${status} - ${texto.slice(0, 500)}`);
  }

  const body = JSON.parse(texto || '{}');
  const id = (body.dataItem && (body.dataItem.id || body.dataItem._id)) || body.id || '';
  if (!id) throw new Error('Wix criou o projeto, mas nao devolveu o ID.');
  return String(id);
}
