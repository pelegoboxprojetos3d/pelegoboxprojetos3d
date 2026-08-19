/**
 * PELEGO BOX - CORREÇÃO CIRÚRGICA VIDEOS_PROJETOS -> WIX
 *
 * Objetivos:
 * 1) toda edição manual de preço na aba Videos_projetos atualiza o Wix DIRETO;
 * 2) novas linhas vindas do Make têm preco_total arredondado para múltiplo de R$ 5;
 * 3) valor_etapa_1/2/3 são calculados na planilha e enviados direto ao Wix;
 * 4) não depende do cenário 036 para sincronizar preços;
 * 5) mantém a aba Clientes usando a sincronização direta que já existia.
 *
 * Este arquivo usa as constantes e funções já existentes em codigo.gs.
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
    'Sincronização direta Videos_projetos -> Wix instalada. O cenário 036 não é mais necessário para preços.',
    'PELEGO BOX',
    8
  );
}

function sincronizarEdicaoVideosDiretoWix(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();

  // Preserva a lógica que já funcionava na aba Clientes.
  if (sheet.getName() === NOME_ABA_CLIENTES) {
    sincronizarEdicaoClientes_(e);
    return;
  }

  if (sheet.getName() !== NOME_ABA) return;
  if (e.range.getRow() < 2) return;

  const apiKey = obterWixApiKey_();
  if (!apiKey) {
    throw new Error('API Wix não configurada. Nada foi enviado ao Wix.');
  }

  const cabecalhos = obterCabecalhos(sheet);
  const primeiraColuna = e.range.getColumn();
  const ultimaColuna = primeiraColuna + e.range.getNumColumns() - 1;
  const camposEditados = new Set();

  for (let col = primeiraColuna; col <= ultimaColuna; col++) {
    const nome = cabecalhos[col - 1];
    if (CAMPOS_EDITAVEIS.has(nome)) camposEditados.add(nome);
  }

  if (camposEditados.size === 0) return;

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

  SpreadsheetApp.getActive().toast(
    `${r.sucessos} projeto(s) sincronizado(s) direto com Wix.`,
    'VIDEOS -> WIX',
    4
  );
}

function processarNovasLinhasPendentesDiretoWix() {
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
    throw new Error('Não encontrei as colunas necessárias para processar novas linhas.');
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return;

  const primeiraLinhaBusca = Math.max(2, ultimaLinha - 99);
  const qtd = ultimaLinha - primeiraLinhaBusca + 1;
  const dados = sheet.getRange(primeiraLinhaBusca, 1, qtd, sheet.getLastColumn()).getValues();
  const linhasProcessadas = [];

  for (let i = 0; i < dados.length; i++) {
    const linha = primeiraLinhaBusca + i;
    const row = dados[i];

    const id = String(row[colId - 1] ?? '').trim();
    const totalBruto = normalizarNumero(row[colTotal - 1]);
    const vazio1 = row[col1 - 1] === '' || row[col1 - 1] === null;
    const vazio2 = row[col2 - 1] === '' || row[col2 - 1] === null;
    const vazio3 = row[col3 - 1] === '' || row[col3 - 1] === null;

    if (!id || !(totalBruto > 0)) continue;
    if (!(vazio1 && vazio2 && vazio3)) continue;

    const totalRedondo = arredondarParaMultiplo(totalBruto, MULTIPLO_PRECO);
    sheet.getRange(linha, colTotal).setValue(totalRedondo);
    sheet.getRange(linha, colBase).setValue(totalRedondo);

    if (row[colAjuste - 1] === '' || row[colAjuste - 1] === null) {
      sheet.getRange(linha, colAjuste).setValue(0);
    }

    aplicarRegrasDaLinha(
      sheet,
      cabecalhos,
      linha,
      new Set([CAB_PRECO_TOTAL])
    );

    linhasProcessadas.push(linha);
  }

  if (!linhasProcessadas.length) return;

  SpreadsheetApp.flush();

  const apiKey = obterWixApiKey_();
  if (!apiKey) throw new Error('API Wix não configurada.');

  const patches = linhasProcessadas
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
    throw new Error(`Linha ${linha}: colunas de preço não encontradas.`);
  }

  // Regra comercial: preco_total SEMPRE múltiplo de 5.
  if (camposEditados.has(CAB_PRECO_TOTAL)) {
    const bruto = normalizarNumero(sheet.getRange(linha, colTotal).getValue());
    if (bruto > 0) {
      sheet.getRange(linha, colTotal).setValue(
        arredondarParaMultiplo(bruto, MULTIPLO_PRECO)
      );
    }
  }

  aplicarRegrasDaLinha(sheet, cabecalhos, linha, camposEditados);

  // Se a etapa 3 foi alterada manualmente, a soma pode gerar total quebrado.
  // Corrige o total para múltiplo de 5 e absorve a diferença na etapa 3.
  if (camposEditados.has(CAB_ETAPA_3)) {
    const e1 = normalizarNumero(sheet.getRange(linha, col1).getValue());
    const e2 = normalizarNumero(sheet.getRange(linha, col2).getValue());
    const e3 = normalizarNumero(sheet.getRange(linha, col3).getValue());
    const totalRedondo = arredondarParaMultiplo(e1 + e2 + e3, MULTIPLO_PRECO);
    sheet.getRange(linha, colTotal).setValue(totalRedondo);
    sheet.getRange(linha, col3).setValue(arredondarCentavos(totalRedondo - e1 - e2));
  }
}

function pbxCriarPatchVideos_(sheet, cabecalhos, linha) {
  const mapa = mapaCabecalhos(cabecalhos);
  const colId = mapa.ID;
  if (!colId) throw new Error('Coluna ID não encontrada.');

  const id = String(sheet.getRange(linha, colId).getValue() || '').trim();
  if (!id) return null;

  const mods = [];

  const adicionar = (campo, valor) => {
    mods.push({
      fieldPath: campo,
      action: 'SET_FIELD',
      setFieldOptions: { value: valor }
    });
  };

  if (mapa.titulo_video) {
    adicionar('titulo_video', String(sheet.getRange(linha, mapa.titulo_video).getValue() || ''));
  }
  if (mapa.valor_etapa_1) {
    adicionar('valor_etapa_1', normalizarNumero(sheet.getRange(linha, mapa.valor_etapa_1).getValue()));
  }
  if (mapa.valor_etapa_2) {
    adicionar('valor_etapa_2', normalizarNumero(sheet.getRange(linha, mapa.valor_etapa_2).getValue()));
  }
  if (mapa.valor_etapa_3) {
    adicionar('valor_etapa_3', normalizarNumero(sheet.getRange(linha, mapa.valor_etapa_3).getValue()));
  }
  if (mapa.ativo_checkout) {
    adicionar('ativo_checkout', String(sheet.getRange(linha, mapa.ativo_checkout).getValue() || ''));
  }

  return { dataItemId: id, fieldModifications: mods };
}

/**
 * Cria um item novo na coleção Videosprojetos a partir de uma linha da planilha.
 * Esta função é isolada de propósito: por enquanto ela NÃO é chamada pelo fluxo automático.
 * Assim conseguimos adicionar e validar a peça nova sem alterar o comportamento que já funciona.
 */
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

  const response = UrlFetchApp.fetch(
    'https://www.wixapis.com/wix-data/v2/items',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: apiKey,
        'wix-site-id': WIX_SITE_ID,
        Accept: 'application/json'
      },
      payload: JSON.stringify({
        dataCollectionId: WIX_COLLECTION_ID,
        dataItem: { data }
      }),
      muteHttpExceptions: true
    }
  );

  const status = response.getResponseCode();
  const texto = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error(`Criar projeto Wix: HTTP ${status} - ${texto.slice(0, 500)}`);
  }

  const body = JSON.parse(texto || '{}');
  const id =
    (body.dataItem && (body.dataItem.id || body.dataItem._id)) ||
    body.id ||
    '';

  if (!id) {
    throw new Error('Wix criou o projeto, mas não devolveu o ID.');
  }

  return String(id);
}
