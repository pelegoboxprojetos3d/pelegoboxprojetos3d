/**
 * PELEGO BOX - SINCRONIZACAO GERAL BIDIRECIONAL GOOGLE SHEETS <-> WIX
 *
 * Objetivo:
 * - edicao manual na planilha -> Wix imediatamente (via gatilho instalavel existente);
 * - alteracao feita por API/Make/script -> detectada pelo ciclo de 1 minuto;
 * - alteracao no Wix -> planilha no ciclo de 1 minuto;
 * - novas linhas vindas do Wix -> anexadas na aba correspondente;
 * - novas linhas manuais em abas administrativas -> criadas no Wix quando houver campos mapeaveis;
 * - Videos_projetos preserva as regras comerciais de preco ja existentes.
 *
 * As abas de dashboard nao possuem colecao CMS propria. Elas continuam derivadas das abas de dados.
 */

const PBX_SYNC_GERAL_VERSAO = '2026-08-20-v1';
const PBX_SYNC_STATE_SHEET = '__PBX_SYNC_STATE';
const PBX_SYNC_LAST_POLL_PROP = 'PBX_SYNC_GERAL_LAST_WIX_POLL_MS';
const PBX_SYNC_BOOTSTRAP_VIDEOS_PROP = 'PBX_SYNC_GERAL_VIDEOS_BOOTSTRAP_V1';
const PBX_SYNC_LOCK_TIMEOUT_MS = 5000;
const PBX_SYNC_WIX_OVERLAP_MS = 2 * 60 * 1000;
const PBX_SYNC_QUERY_LIMIT = 100;

const PBX_SYNC_ABAS_GERAL = Object.freeze({
  Videos_projetos: { collectionId: 'Videosprojetos', mode: 'VIDEOS' },
  Clientes: { collectionId: 'Campo', mode: 'GENERIC' },
  ComprasProjetos: { collectionId: 'ComprasProjetos', mode: 'GENERIC' },
  HistoricoComprasProjetosProntos: { collectionId: 'HistoricoComprasProjetosProntos', mode: 'GENERIC' },
  SessoesProjetosProntos2: { collectionId: 'SessoesProjetosProntos2', mode: 'GENERIC' },
  MetodosPagamentoProjetosProntos: { collectionId: 'MetodosPagamentoProjetosProntos', mode: 'GENERIC' },
  Entregas: { collectionId: 'Entregas', mode: 'GENERIC' },
  ranking_marcas: { collectionId: 'ranking_marcas', mode: 'GENERIC' },
  MpSessions: { collectionId: 'MpSessions', mode: 'GENERIC' },
  Services: { collectionId: 'Services', mode: 'GENERIC' }
});

const PBX_SYNC_META_FIELD_KEYS = new Set([
  '_id', '_createdDate', '_updatedDate', '_owner',
  'createdDate', 'updatedDate', 'owner',
  'createdDate1', 'updatedDate1', 'owner1',
  'createdDate2', 'updatedDate2', 'owner2',
  'createdDate3', 'updatedDate3', 'owner3',
  'createdDate4', 'updatedDate4', 'owner4',
  'createdDate5', 'updatedDate5', 'owner5'
]);

const PBX_SYNC_SKIP_WRITE_TYPES = new Set(['MULTI_REFERENCE']);

function pbxSincronizarEdicaoAbaGenericaWix_(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const cfg = PBX_SYNC_ABAS_GERAL[sheet.getName()];
  if (!cfg || e.range.getRow() < 2) return;

  const apiKey = obterWixApiKey_();
  if (!apiKey) throw new Error('API Wix nao configurada para a sincronizacao geral.');

  const schema = pbxObterSchemaColecaoSync_(cfg.collectionId, apiKey);
  const info = pbxPrepararAbaSync_(sheet, schema);
  if (!info.idCol) return;

  const primeiraCol = e.range.getColumn();
  const ultimaCol = primeiraCol + e.range.getNumColumns() - 1;
  const camposAlterados = [];

  for (let c = primeiraCol; c <= ultimaCol; c++) {
    const field = info.fieldByColumn[c];
    if (field && pbxCampoWixGravavelSync_(field)) camposAlterados.push({ col: c, field });
  }

  const primeiraLinha = e.range.getRow();
  const ultimaLinha = primeiraLinha + e.range.getNumRows() - 1;

  // Videos_projetos ja passa pela rotina especializada antes de chegar aqui.
  // Nao recalculamos preco duas vezes. Este complemento serve para sincronizar
  // os demais campos mapeados (marca, slug, thumbnail, link, etc.).

  const patches = [];
  const novos = [];

  for (let linha = primeiraLinha; linha <= ultimaLinha; linha++) {
    let id = String(sheet.getRange(linha, info.idCol).getValue() || '').trim();

    // Novas linhas de Videos ficam a cargo do fluxo especializado, que evita duplicidade por ordem_video.
    if (!id && cfg.mode === 'VIDEOS') continue;

    if (!id) {
      const row = sheet.getRange(linha, 1, 1, sheet.getLastColumn()).getValues()[0];
      if (!pbxRowTemConteudoSync_(row, info)) continue;
      const data = pbxMontarDataRowArraySync_(row, info);
      if (Object.keys(data).length) novos.push({ linha, data });
      continue;
    }

    const mods = [];
    camposAlterados.forEach(({ col, field }) => {
      const conversao = pbxValorPlanilhaParaWixSync_(sheet.getRange(linha, col).getValue(), field, false);
      if (!conversao.ok || conversao.skip) return;
      if (conversao.remove) {
        mods.push({ fieldPath: field.key, action: 'REMOVE_FIELD' });
      } else {
        mods.push({
          fieldPath: field.key,
          action: 'SET_FIELD',
          setFieldOptions: { value: conversao.value }
        });
      }
    });

    if (mods.length) patches.push({ dataItemId: id, fieldModifications: mods });
  }

  if (patches.length) {
    const r = sincronizarPatchesWixColecao_(cfg.collectionId, patches, apiKey);
    if (r.erros.length) throw new Error(`${sheet.getName()} -> Wix: ${r.erros.join(' | ')}`);
  }

  for (const novo of novos) {
    const id = pbxCriarItemGenericoWixSync_(cfg.collectionId, novo.data, apiKey);
    sheet.getRange(novo.linha, info.idCol).setValue(id);
  }

  SpreadsheetApp.flush();
  pbxAtualizarEstadoLinhasSync_(sheet, cfg, schema, primeiraLinha, ultimaLinha);
}

/**
 * Executado pelo gatilho de 1 minuto ja usado por Videos_projetos.
 * Detecta alteracoes feitas por API/Make, e puxa alteracoes recentes do Wix.
 */
function pbxSincronizacaoGeralUmCiclo_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(PBX_SYNC_LOCK_TIMEOUT_MS)) return;

  try {
    const apiKey = obterWixApiKey_();
    if (!apiKey) return;

    const ss = SpreadsheetApp.getActive();
    pbxGarantirEstadoSync_(ss);

    // Corrige o lote de precos/titulos que foi alterado via API e, uma unica vez,
    // usa a planilha como fonte para reconciliar Videos_projetos com o Wix.
    pbxBootstrapVideosPlanilhaParaWixSync_(ss, apiKey);

    const estado = pbxCarregarEstadoSync_(ss);
    let estadoMudou = false;

    // 1) PLANILHA -> WIX: detecta inclusive alteracoes que nao disparam onEdit.
    for (const [sheetName, cfg] of Object.entries(PBX_SYNC_ABAS_GERAL)) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet || sheet.getLastRow() < 2) continue;

      const schema = pbxObterSchemaColecaoSync_(cfg.collectionId, apiKey);
      const info = pbxPrepararAbaSync_(sheet, schema);
      if (!info.idCol) continue;

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      const patches = [];

      for (let i = 0; i < values.length; i++) {
        const linha = i + 2;
        const row = values[i];
        let id = String(row[info.idCol - 1] || '').trim();

        if (!id) {
          if (cfg.mode === 'VIDEOS') continue;
          if (!pbxRowTemConteudoSync_(row, info)) continue;
          const data = pbxMontarDataRowArraySync_(row, info);
          if (!Object.keys(data).length) continue;
          id = pbxCriarItemGenericoWixSync_(cfg.collectionId, data, apiKey);
          sheet.getRange(linha, info.idCol).setValue(id);
          row[info.idCol - 1] = id;
          SpreadsheetApp.flush();
        }

        const key = pbxEstadoKeySync_(cfg.collectionId, id);
        let st = estado.get(key);

        // Primeiro contato: cria baseline sem sobrescrever historicos administrativos.
        if (!st) {
          st = {
            key,
            sheetName,
            collectionId: cfg.collectionId,
            itemId: id,
            sheetHash: pbxHashRowArraySync_(row, info, cfg),
            wixUpdatedMs: 0,
            businessJson: cfg.mode === 'VIDEOS' ? pbxBusinessJsonVideosRowSync_(row, info) : '',
            rowNumber: linha,
            lastAction: 'BASELINE',
            lastSyncIso: new Date().toISOString()
          };
          estado.set(key, st);
          estadoMudou = true;
          continue;
        }

        if (cfg.mode === 'VIDEOS') {
          const businessAtual = pbxBusinessJsonVideosRowSync_(row, info);
          if (businessAtual !== st.businessJson) {
            pbxAplicarRegrasVideosPorMudancaSync_(sheet, info, linha, st.businessJson);
            SpreadsheetApp.flush();
            const novaRow = sheet.getRange(linha, 1, 1, lastCol).getValues()[0];
            values[i] = novaRow;
            st.businessJson = pbxBusinessJsonVideosRowSync_(novaRow, info);
          }
        }

        const rowAtual = values[i];
        const hashAtual = pbxHashRowArraySync_(rowAtual, info, cfg);
        if (hashAtual === st.sheetHash) {
          st.rowNumber = linha;
          continue;
        }

        const mods = pbxMontarModsRowArraySync_(rowAtual, info);
        if (mods.length) patches.push({ dataItemId: id, fieldModifications: mods, __key: key, __hash: hashAtual, __linha: linha, __business: cfg.mode === 'VIDEOS' ? pbxBusinessJsonVideosRowSync_(rowAtual, info) : '' });
      }

      for (let inicio = 0; inicio < patches.length; inicio += WIX_LOTE_MAXIMO) {
        const lote = patches.slice(inicio, inicio + WIX_LOTE_MAXIMO);
        const clean = lote.map(p => ({ dataItemId: p.dataItemId, fieldModifications: p.fieldModifications }));
        const r = sincronizarPatchesWixColecao_(cfg.collectionId, clean, apiKey);
        if (r.erros.length) {
          console.error(`PBX sync ${sheetName} -> Wix: ${r.erros.join(' | ')}`);
          continue;
        }

        lote.forEach(p => {
          const st = estado.get(p.__key);
          if (!st) return;
          st.sheetHash = p.__hash;
          st.businessJson = p.__business;
          st.rowNumber = p.__linha;
          st.lastAction = 'SHEET_TO_WIX';
          st.lastSyncIso = new Date().toISOString();
          estadoMudou = true;
        });
      }
    }

    // 2) WIX -> PLANILHA: somente itens alterados desde o ultimo ciclo.
    const props = PropertiesService.getScriptProperties();
    const agora = Date.now();
    const lastPoll = Number(props.getProperty(PBX_SYNC_LAST_POLL_PROP) || 0);

    if (lastPoll > 0) {
      const desde = Math.max(0, lastPoll - PBX_SYNC_WIX_OVERLAP_MS);

      for (const [sheetName, cfg] of Object.entries(PBX_SYNC_ABAS_GERAL)) {
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) continue;

        const schema = pbxObterSchemaColecaoSync_(cfg.collectionId, apiKey);
        const info = pbxPrepararAbaSync_(sheet, schema);
        if (!info.idCol) continue;

        const itens = pbxBuscarItensWixAlteradosSync_(cfg.collectionId, desde, apiKey);
        if (!itens.length) continue;

        const rowById = pbxMapearLinhasPorIdSync_(sheet, info.idCol);

        for (const item of itens) {
          const id = String(item.id || item._id || (item.data && item.data._id) || '').trim();
          if (!id) continue;
          const key = pbxEstadoKeySync_(cfg.collectionId, id);
          const st = estado.get(key);
          let linha = rowById.get(id) || 0;

          if (!linha) {
            linha = Math.max(2, sheet.getLastRow() + 1);
            pbxEscreverItemWixNaLinhaSync_(sheet, linha, info, item);
            rowById.set(id, linha);
            SpreadsheetApp.flush();
            const row = sheet.getRange(linha, 1, 1, sheet.getLastColumn()).getValues()[0];
            estado.set(key, {
              key,
              sheetName,
              collectionId: cfg.collectionId,
              itemId: id,
              sheetHash: pbxHashRowArraySync_(row, info, cfg),
              wixUpdatedMs: pbxWixUpdatedMsSync_(item),
              businessJson: cfg.mode === 'VIDEOS' ? pbxBusinessJsonVideosRowSync_(row, info) : '',
              rowNumber: linha,
              lastAction: 'WIX_APPEND',
              lastSyncIso: new Date().toISOString()
            });
            estadoMudou = true;
            continue;
          }

          const rowAntes = sheet.getRange(linha, 1, 1, sheet.getLastColumn()).getValues()[0];
          const hashAntes = pbxHashRowArraySync_(rowAntes, info, cfg);
          const sheetMudou = st && hashAntes !== st.sheetHash;

          // Conflito no mesmo intervalo: preserva a planilha, pois e a mesa de trabalho do usuario.
          if (sheetMudou) continue;

          pbxEscreverItemWixNaLinhaSync_(sheet, linha, info, item);

          if (cfg.mode === 'VIDEOS') {
            pbxAtualizarTotalVideosAposPullSync_(sheet, info, linha);
          }

          SpreadsheetApp.flush();
          const rowDepois = sheet.getRange(linha, 1, 1, sheet.getLastColumn()).getValues()[0];
          const novo = st || {
            key,
            sheetName,
            collectionId: cfg.collectionId,
            itemId: id
          };
          novo.sheetHash = pbxHashRowArraySync_(rowDepois, info, cfg);
          novo.wixUpdatedMs = pbxWixUpdatedMsSync_(item);
          novo.businessJson = cfg.mode === 'VIDEOS' ? pbxBusinessJsonVideosRowSync_(rowDepois, info) : '';
          novo.rowNumber = linha;
          novo.lastAction = 'WIX_TO_SHEET';
          novo.lastSyncIso = new Date().toISOString();
          estado.set(key, novo);
          estadoMudou = true;
        }
      }
    }

    props.setProperty(PBX_SYNC_LAST_POLL_PROP, String(agora));
    if (estadoMudou) pbxSalvarEstadoSync_(ss, estado);
  } finally {
    lock.releaseLock();
  }
}

function pbxBootstrapVideosPlanilhaParaWixSync_(ss, apiKey) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(PBX_SYNC_BOOTSTRAP_VIDEOS_PROP) === PBX_SYNC_GERAL_VERSAO) return;

  const sheet = ss.getSheetByName('Videos_projetos');
  if (!sheet || sheet.getLastRow() < 2) {
    props.setProperty(PBX_SYNC_BOOTSTRAP_VIDEOS_PROP, PBX_SYNC_GERAL_VERSAO);
    return;
  }

  const schema = pbxObterSchemaColecaoSync_('Videosprojetos', apiKey);
  const info = pbxPrepararAbaSync_(sheet, schema);
  if (!info.idCol) throw new Error('Videos_projetos sem coluna ID.');

  pbxCorrigirInconsistenciasVideosSync_(sheet, info);
  SpreadsheetApp.flush();

  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const patches = [];

  data.forEach(row => {
    const id = String(row[info.idCol - 1] || '').trim();
    if (!id) return;
    const mods = pbxMontarModsRowArraySync_(row, info);
    if (mods.length) patches.push({ dataItemId: id, fieldModifications: mods });
  });

  for (let i = 0; i < patches.length; i += WIX_LOTE_MAXIMO) {
    const lote = patches.slice(i, i + WIX_LOTE_MAXIMO);
    const r = sincronizarPatchesWixColecao_('Videosprojetos', lote, apiKey);
    if (r.erros.length) throw new Error('Bootstrap Videos -> Wix: ' + r.erros.join(' | '));
  }

  props.setProperty(PBX_SYNC_BOOTSTRAP_VIDEOS_PROP, PBX_SYNC_GERAL_VERSAO);
  console.log(`PBX bootstrap Videos concluido: ${patches.length} itens reconciliados.`);
}

function pbxCorrigirInconsistenciasVideosSync_(sheet, info) {
  const mapa = info.headerMap;
  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];
  if (!colTotal || !col1 || !col2 || !col3) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const vals = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (let i = 0; i < vals.length; i++) {
    const row = vals[i];
    const total = normalizarNumero(row[colTotal - 1]);
    const e1 = normalizarNumero(row[col1 - 1]);
    const e2 = normalizarNumero(row[col2 - 1]);
    const e3 = normalizarNumero(row[col3 - 1]);
    if (!(total > 0)) continue;
    if (Math.abs(total - (e1 + e2 + e3)) < 0.009) continue;

    pbxAplicarRegrasPrecoMultiplo5_(sheet, info.headers, i + 2, new Set([CAB_PRECO_TOTAL]));
  }
}

function pbxAplicarRegrasVideosPorMudancaSync_(sheet, info, linha, businessAnteriorJson) {
  const atual = pbxBusinessObjetoVideosLinhaSync_(sheet, info, linha);
  let anterior = {};
  try { anterior = businessAnteriorJson ? JSON.parse(businessAnteriorJson) : {}; } catch (_) {}

  const mudouAjuste = atual.ajuste !== anterior.ajuste;
  const mudouTotal = atual.total !== anterior.total;
  const mudou1 = atual.e1 !== anterior.e1;
  const mudou2 = atual.e2 !== anterior.e2;
  const mudou3 = atual.e3 !== anterior.e3;

  if (mudouAjuste) {
    pbxAplicarRegrasPrecoMultiplo5_(sheet, info.headers, linha, new Set([CAB_AJUSTE_PERCENTUAL]));
    return;
  }
  if (mudouTotal) {
    pbxAplicarRegrasPrecoMultiplo5_(sheet, info.headers, linha, new Set([CAB_PRECO_TOTAL]));
    return;
  }
  if (mudou3) {
    pbxAplicarRegrasPrecoMultiplo5_(sheet, info.headers, linha, new Set([CAB_ETAPA_3]));
    return;
  }
  if (mudou1 || mudou2) {
    const set = new Set();
    if (mudou1) set.add(CAB_ETAPA_1);
    if (mudou2) set.add(CAB_ETAPA_2);
    pbxAplicarRegrasPrecoMultiplo5_(sheet, info.headers, linha, set);
  }
}

function pbxAtualizarTotalVideosAposPullSync_(sheet, info, linha) {
  const mapa = info.headerMap;
  const colTotal = mapa[CAB_PRECO_TOTAL];
  const col1 = mapa[CAB_ETAPA_1];
  const col2 = mapa[CAB_ETAPA_2];
  const col3 = mapa[CAB_ETAPA_3];
  if (!colTotal || !col1 || !col2 || !col3) return;
  const e1 = normalizarNumero(sheet.getRange(linha, col1).getValue());
  const e2 = normalizarNumero(sheet.getRange(linha, col2).getValue());
  const e3 = normalizarNumero(sheet.getRange(linha, col3).getValue());
  sheet.getRange(linha, colTotal).setValue(arredondarParaMultiplo(e1 + e2 + e3, MULTIPLO_PRECO));
  sheet.getRange(linha, colTotal).setNumberFormat('R$ #,##0.00');
}

function pbxBusinessObjetoVideosLinhaSync_(sheet, info, linha) {
  const m = info.headerMap;
  const v = h => m[h] ? normalizarNumero(sheet.getRange(linha, m[h]).getValue()) : 0;
  return { total: v(CAB_PRECO_TOTAL), ajuste: v(CAB_AJUSTE_PERCENTUAL), e1: v(CAB_ETAPA_1), e2: v(CAB_ETAPA_2), e3: v(CAB_ETAPA_3) };
}

function pbxBusinessJsonVideosRowSync_(row, info) {
  const m = info.headerMap;
  const v = h => m[h] ? normalizarNumero(row[m[h] - 1]) : 0;
  return JSON.stringify({ total: v(CAB_PRECO_TOTAL), ajuste: v(CAB_AJUSTE_PERCENTUAL), e1: v(CAB_ETAPA_1), e2: v(CAB_ETAPA_2), e3: v(CAB_ETAPA_3) });
}

function pbxPrepararAbaSync_(sheet, schema) {
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || '').trim());
  const headerMap = {};
  headers.forEach((h, i) => { if (h && !headerMap[h]) headerMap[h] = i + 1; });

  const byKey = new Map();
  const byDisplay = new Map();
  (schema.fields || []).forEach(f => {
    byKey.set(pbxNormSync_(f.key), f);
    const d = pbxNormSync_(f.displayName || f.key);
    if (!byDisplay.has(d)) byDisplay.set(d, []);
    byDisplay.get(d).push(f);
  });

  const fieldByColumn = {};
  headers.forEach((h, i) => {
    if (!h) return;
    const n = pbxNormSync_(h);
    let f = byKey.get(n) || null;
    if (!f) {
      const candidatos = byDisplay.get(n) || [];
      f = candidatos.find(x => !x.systemField && !PBX_SYNC_META_FIELD_KEYS.has(x.key)) || candidatos.find(x => x.systemField) || candidatos[0] || null;
    }
    if (f) fieldByColumn[i + 1] = f;
  });

  const idCol = headers.findIndex(h => pbxNormSync_(h) === 'id') + 1;
  return { sheet, headers, headerMap, fieldByColumn, idCol: idCol > 0 ? idCol : 0 };
}

function pbxCampoWixGravavelSync_(field) {
  if (!field || field.systemField) return false;
  if (PBX_SYNC_META_FIELD_KEYS.has(field.key)) return false;
  if (PBX_SYNC_SKIP_WRITE_TYPES.has(field.type)) return false;
  return true;
}

function pbxMontarDataLinhaSync_(sheet, linha, info) {
  const row = sheet.getRange(linha, 1, 1, sheet.getLastColumn()).getValues()[0];
  return pbxMontarDataRowArraySync_(row, info);
}

function pbxRowTemConteudoSync_(row, info) {
  return Object.entries(info.fieldByColumn).some(([colStr, field]) => {
    if (!pbxCampoWixGravavelSync_(field)) return false;
    const value = row[Number(colStr) - 1];
    if (value instanceof Date) return true;
    return !(value === '' || value === null || typeof value === 'undefined');
  });
}

function pbxMontarDataRowArraySync_(row, info) {
  const data = {};
  Object.entries(info.fieldByColumn).forEach(([colStr, field]) => {
    if (!pbxCampoWixGravavelSync_(field)) return;
    const col = Number(colStr);
    const conv = pbxValorPlanilhaParaWixSync_(row[col - 1], field, true);
    if (!conv.ok || conv.skip || conv.remove) return;
    data[field.key] = conv.value;
  });
  return data;
}

function pbxMontarModsRowArraySync_(row, info) {
  const mods = [];
  Object.entries(info.fieldByColumn).forEach(([colStr, field]) => {
    if (!pbxCampoWixGravavelSync_(field)) return;
    const col = Number(colStr);
    const conv = pbxValorPlanilhaParaWixSync_(row[col - 1], field, false);
    if (!conv.ok || conv.skip) return;
    if (conv.remove) {
      mods.push({ fieldPath: field.key, action: 'REMOVE_FIELD' });
    } else {
      mods.push({ fieldPath: field.key, action: 'SET_FIELD', setFieldOptions: { value: conv.value } });
    }
  });
  return mods;
}

function pbxValorPlanilhaParaWixSync_(value, field, criando) {
  const vazio = value === '' || value === null || typeof value === 'undefined';
  const type = String(field.type || 'TEXT').toUpperCase();

  if (vazio) {
    // Em criacao, campo vazio simplesmente nao e enviado. Em atualizacao,
    // texto vazio limpa o texto; tipos estruturados/numericos removem o campo
    // em vez de inventar 0/false e corromper semantica da colecao.
    if (criando) return { ok: true, skip: true };
    if (type === 'TEXT' || type === 'EMAIL' || type === 'URL' || type === 'IMAGE' || type === 'REFERENCE') {
      return { ok: true, value: '' };
    }
    return { ok: true, remove: true };
  }

  if (type === 'NUMBER') {
    const n = normalizarNumero(value);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  if (type === 'BOOLEAN') {
    if (typeof value === 'boolean') return { ok: true, value };
    if (typeof value === 'number') return { ok: true, value: value !== 0 };
    const t = String(value).trim().toLowerCase();
    if (['true', 'sim', '1', 'yes', 'ativo', 'approved'].includes(t)) return { ok: true, value: true };
    if (['false', 'nao', 'não', '0', 'no', 'inativo', 'pending', ''].includes(t)) return { ok: true, value: false };
    return { ok: false };
  }
  if (type === 'DATETIME') {
    const d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? { ok: false } : { ok: true, value: { '$date': d.toISOString() } };
  }
  if (type === 'DATE') {
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return { ok: true, value: String(value) };
    return { ok: true, value: Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd') };
  }
  if (type === 'RICH_CONTENT' || type === 'OBJECT') {
    if (typeof value === 'object') return { ok: true, value };
    try { return { ok: true, value: JSON.parse(String(value)) }; } catch (_) { return { ok: false }; }
  }
  return { ok: true, value: String(value) };
}

function pbxValorWixParaPlanilhaSync_(value, field) {
  if (value === null || typeof value === 'undefined') return '';
  const type = String(field.type || 'TEXT').toUpperCase();
  if ((type === 'DATETIME' || type === 'DATE') && typeof value === 'object' && value['$date']) return new Date(value['$date']);
  if (type === 'RICH_CONTENT' || type === 'OBJECT' || Array.isArray(value) || (typeof value === 'object' && !(value instanceof Date))) {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }
  return value;
}

function pbxCriarItemGenericoWixSync_(collectionId, data, apiKey) {
  const response = UrlFetchApp.fetch('https://www.wixapis.com/wix-data/v2/items', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: apiKey, 'wix-site-id': WIX_SITE_ID, Accept: 'application/json' },
    payload: JSON.stringify({ dataCollectionId: collectionId, dataItem: { data } }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const texto = response.getContentText();
  if (status < 200 || status >= 300) throw new Error(`Criar ${collectionId}: HTTP ${status} - ${texto.slice(0, 500)}`);
  const body = texto ? JSON.parse(texto) : {};
  const item = body.dataItem || body.item || {};
  const id = String(item.id || item._id || body.id || '').trim();
  if (!id) throw new Error(`Wix criou item em ${collectionId}, mas nao devolveu ID.`);
  return id;
}

function pbxObterSchemaColecaoSync_(collectionId, apiKey) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `PBX_SCHEMA_${collectionId}`;
  const hit = cache.get(cacheKey);
  if (hit) {
    try { return JSON.parse(hit); } catch (_) {}
  }

  const response = UrlFetchApp.fetch(`https://www.wixapis.com/wix-data/v2/collections/${encodeURIComponent(collectionId)}`, {
    method: 'get',
    headers: { Authorization: apiKey, 'wix-site-id': WIX_SITE_ID, Accept: 'application/json' },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const texto = response.getContentText();
  if (status < 200 || status >= 300) throw new Error(`Schema ${collectionId}: HTTP ${status} - ${texto.slice(0, 500)}`);
  const body = texto ? JSON.parse(texto) : {};
  const c = body.collection || body.dataCollection || {};
  const schema = { id: c.id || collectionId, fields: (c.fields || []).map(f => ({ key: f.key, displayName: f.displayName || f.key, type: f.type || 'TEXT', systemField: !!f.systemField })) };
  try { cache.put(cacheKey, JSON.stringify(schema), 21600); } catch (_) {}
  return schema;
}

function pbxBuscarItensWixAlteradosSync_(collectionId, desdeMs, apiKey) {
  const todos = [];
  let offset = 0;
  const desdeIso = new Date(desdeMs).toISOString();

  while (true) {
    const payload = {
      dataCollectionId: collectionId,
      query: {
        filter: { '_updatedDate': { '$gt': { '$date': desdeIso } } },
        paging: { limit: PBX_SYNC_QUERY_LIMIT, offset }
      },
      returnTotalCount: true,
      consistentRead: true
    };

    const response = UrlFetchApp.fetch('https://www.wixapis.com/wix-data/v2/items/query', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: apiKey, 'wix-site-id': WIX_SITE_ID, Accept: 'application/json' },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    const texto = response.getContentText();
    if (status < 200 || status >= 300) throw new Error(`Query ${collectionId}: HTTP ${status} - ${texto.slice(0, 500)}`);
    const body = texto ? JSON.parse(texto) : {};
    const itens = Array.isArray(body.dataItems) ? body.dataItems : [];
    todos.push(...itens);

    const total = body.pagingMetadata && Number(body.pagingMetadata.total);
    if (itens.length < PBX_SYNC_QUERY_LIMIT) break;
    offset += itens.length;
    if (Number.isFinite(total) && offset >= total) break;
    if (offset > 100000) break;
  }

  return todos;
}

function pbxEscreverItemWixNaLinhaSync_(sheet, linha, info, item) {
  const data = item.data || {};
  const lastCol = sheet.getLastColumn();
  const atual = linha <= sheet.getLastRow()
    ? sheet.getRange(linha, 1, 1, lastCol).getValues()[0]
    : new Array(lastCol).fill('');

  if (info.idCol) atual[info.idCol - 1] = String(item.id || item._id || data._id || '');

  Object.entries(info.fieldByColumn).forEach(([colStr, field]) => {
    const col = Number(colStr);
    if (field.systemField) {
      if (field.key === '_id') atual[col - 1] = String(item.id || item._id || data._id || '');
      else if (Object.prototype.hasOwnProperty.call(data, field.key)) atual[col - 1] = pbxValorWixParaPlanilhaSync_(data[field.key], field);
      return;
    }
    if (PBX_SYNC_META_FIELD_KEYS.has(field.key)) return;
    if (Object.prototype.hasOwnProperty.call(data, field.key)) atual[col - 1] = pbxValorWixParaPlanilhaSync_(data[field.key], field);
  });

  sheet.getRange(linha, 1, 1, lastCol).setValues([atual]);
}

function pbxMapearLinhasPorIdSync_(sheet, idCol) {
  const map = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2 || !idCol) return map;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  ids.forEach((r, i) => {
    const id = String(r[0] || '').trim();
    if (id) map.set(id, i + 2);
  });
  return map;
}

function pbxWixUpdatedMsSync_(item) {
  const data = item.data || {};
  const v = data._updatedDate || item.updatedDate || item._updatedDate;
  const iso = v && typeof v === 'object' && v['$date'] ? v['$date'] : v;
  const ms = iso ? new Date(iso).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function pbxHashRowArraySync_(row, info, cfg) {
  const obj = {};
  Object.entries(info.fieldByColumn).forEach(([colStr, field]) => {
    if (!pbxCampoWixGravavelSync_(field)) return;
    const col = Number(colStr);
    let v = row[col - 1];
    if (v instanceof Date) v = v.toISOString();
    obj[field.key] = v;
  });
  if (cfg && cfg.mode === 'VIDEOS') obj.__business = pbxBusinessJsonVideosRowSync_(row, info);
  return pbxDigestSync_(JSON.stringify(obj));
}

function pbxDigestSync_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s), Utilities.Charset.UTF_8);
  return bytes.map(b => (b + 256) % 256).map(b => b.toString(16).padStart(2, '0')).join('');
}

function pbxNormSync_(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pbxEstadoKeySync_(collectionId, id) {
  return `${collectionId}|${id}`;
}

function pbxGarantirEstadoSync_(ss) {
  let sh = ss.getSheetByName(PBX_SYNC_STATE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PBX_SYNC_STATE_SHEET);
    sh.getRange(1, 1, 1, 9).setValues([['key','sheet_name','collection_id','item_id','sheet_hash','wix_updated_ms','business_json','row_number','last_action_sync']]);
    sh.hideSheet();
  }
  return sh;
}

function pbxCarregarEstadoSync_(ss) {
  const sh = pbxGarantirEstadoSync_(ss);
  const map = new Map();
  const last = sh.getLastRow();
  if (last < 2) return map;
  const rows = sh.getRange(2, 1, last - 1, 9).getValues();
  rows.forEach(r => {
    const key = String(r[0] || '').trim();
    if (!key) return;
    const actionSync = String(r[8] || '');
    const parts = actionSync.split('@@');
    map.set(key, {
      key,
      sheetName: String(r[1] || ''),
      collectionId: String(r[2] || ''),
      itemId: String(r[3] || ''),
      sheetHash: String(r[4] || ''),
      wixUpdatedMs: Number(r[5] || 0),
      businessJson: String(r[6] || ''),
      rowNumber: Number(r[7] || 0),
      lastAction: parts[0] || '',
      lastSyncIso: parts[1] || ''
    });
  });
  return map;
}

function pbxSalvarEstadoSync_(ss, estado) {
  const sh = pbxGarantirEstadoSync_(ss);
  const rows = Array.from(estado.values())
    .sort((a, b) => (a.sheetName + a.itemId).localeCompare(b.sheetName + b.itemId))
    .map(s => [s.key, s.sheetName, s.collectionId, s.itemId, s.sheetHash, s.wixUpdatedMs || 0, s.businessJson || '', s.rowNumber || 0, `${s.lastAction || ''}@@${s.lastSyncIso || ''}`]);

  const oldLast = sh.getLastRow();
  if (oldLast > 1) sh.getRange(2, 1, oldLast - 1, 9).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 9).setValues(rows);
  if (!sh.isSheetHidden()) sh.hideSheet();
}

function pbxAtualizarEstadoLinhasSync_(sheet, cfg, schema, primeiraLinha, ultimaLinha) {
  try {
    const ss = sheet.getParent();
    const estado = pbxCarregarEstadoSync_(ss);
    const info = pbxPrepararAbaSync_(sheet, schema);
    const lastCol = sheet.getLastColumn();
    let mudou = false;

    for (let linha = primeiraLinha; linha <= ultimaLinha; linha++) {
      if (linha > sheet.getLastRow()) continue;
      const row = sheet.getRange(linha, 1, 1, lastCol).getValues()[0];
      const id = info.idCol ? String(row[info.idCol - 1] || '').trim() : '';
      if (!id) continue;
      const key = pbxEstadoKeySync_(cfg.collectionId, id);
      const st = estado.get(key) || { key, sheetName: sheet.getName(), collectionId: cfg.collectionId, itemId: id, wixUpdatedMs: 0 };
      st.sheetHash = pbxHashRowArraySync_(row, info, cfg);
      st.businessJson = cfg.mode === 'VIDEOS' ? pbxBusinessJsonVideosRowSync_(row, info) : '';
      st.rowNumber = linha;
      st.lastAction = 'ON_EDIT_TO_WIX';
      st.lastSyncIso = new Date().toISOString();
      estado.set(key, st);
      mudou = true;
    }
    if (mudou) pbxSalvarEstadoSync_(ss, estado);
  } catch (err) {
    console.error('Atualizar estado sync: ' + (err.message || err));
  }
}

function pbxStatusSincronizacaoGeral() {
  const ss = SpreadsheetApp.getActive();
  const state = pbxCarregarEstadoSync_(ss);
  const lastPoll = Number(PropertiesService.getScriptProperties().getProperty(PBX_SYNC_LAST_POLL_PROP) || 0);
  SpreadsheetApp.getUi().alert(
    `Sincronizacao geral ativa\nVersao: ${PBX_SYNC_GERAL_VERSAO}\nItens monitorados: ${state.size}\nUltimo ciclo Wix: ${lastPoll ? new Date(lastPoll).toLocaleString() : 'ainda nao executado'}`
  );
}
