/**
 * PELEGO BOX - MONITOR DE LOGINS DOS PROJETOS PRONTOS
 *
 * A Wix expoe o campo lastLoginDate do membro, mas nao um historico completo
 * de logins anteriores. Este monitor cria:
 * - Membros_ProjetosProntos: retrato atual dos membros;
 * - Logins_ProjetosProntos: uma linha por novo lastLoginDate detectado;
 * - Resumo_Logins: total diario, pessoas unicas, novos membros e retornos.
 *
 * Na primeira execucao, o ultimo login atual de cada membro vira uma linha
 * BASELINE_WIX_ULTIMO_LOGIN. Depois disso, qualquer mudanca de lastLoginDate
 * vira LOGIN_DETECTADO.
 */

const PBX_LOGIN_SPREADSHEET_ID = '1F2SBmr0JtY9qRnabDlM5zImtCORZOirgjuAHGFaFq0E';
const PBX_LOGIN_WIX_SITE_ID = 'd1022df4-d4fd-4561-8909-a59d876691b3';
const PBX_LOGIN_WIX_MEMBERS_URL = 'https://www.wixapis.com/members/v1/members/query';
const PBX_LOGIN_TZ = 'America/Sao_Paulo';
const PBX_LOGIN_SHEET_MEMBROS = 'Membros_ProjetosProntos';
const PBX_LOGIN_SHEET_EVENTOS = 'Logins_ProjetosProntos';
const PBX_LOGIN_SHEET_RESUMO = 'Resumo_Logins';
const PBX_LOGIN_HANDLER = 'pbxMonitorarLoginsProjetosProntos';

const PBX_LOGIN_HEADERS_MEMBROS = [
  'member_id','contact_id','nome','sobrenome','apelido','email_login','email_verificado',
  'telefones','emails_contato','status','atividade','privacidade','data_cadastro',
  'ultima_atualizacao','ultimo_login','cidade','estado','pais','cep','endereco',
  'empresa','cargo','aniversario','slug_perfil','foto_url','enderecos_json',
  'campos_customizados_json','ultimo_login_iso'
];

const PBX_LOGIN_HEADERS_EVENTOS = [
  'data_hora_login','data_login','hora_login','member_id','contact_id','nome','sobrenome',
  'apelido','email_login','telefones','status','atividade','data_cadastro','cidade','estado',
  'pais','fonte','login_iso'
];

const PBX_LOGIN_HEADERS_RESUMO = [
  'data','total_logins','pessoas_unicas','novos_cadastros','pessoas_retornando'
];

function pbxInstalarMonitorLoginsProjetosProntos() {
  const ss = SpreadsheetApp.openById(PBX_LOGIN_SPREADSHEET_ID);
  pbxPrepararAbasLoginProjetosProntos_(ss);

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === PBX_LOGIN_HANDLER)
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger(PBX_LOGIN_HANDLER)
    .timeBased()
    .everyMinutes(1)
    .create();

  const resultado = pbxMonitorarLoginsProjetosProntos();
  PropertiesService.getScriptProperties()
    .setProperty('PBX_LOGIN_MONITOR_LAST_INSTALL', new Date().toISOString());

  return {
    ok: true,
    handler: PBX_LOGIN_HANDLER,
    resultado,
    triggers: ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction() + ':' + String(t.getEventType()))
  };
}

function pbxMonitorarLoginsProjetosProntos() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: true, skipped: 'LOCKED' };

  try {
    const apiKey = obterWixApiKey_();
    if (!apiKey) throw new Error('API Wix nao configurada para ler membros.');

    const membros = pbxBuscarTodosMembrosWix_(apiKey);
    const ss = SpreadsheetApp.openById(PBX_LOGIN_SPREADSHEET_ID);
    const abas = pbxPrepararAbasLoginProjetosProntos_(ss);
    const sheetMembros = abas.membros;
    const sheetEventos = abas.eventos;
    const sheetResumo = abas.resumo;

    const estadoAnterior = pbxLerEstadoMembrosLogin_(sheetMembros);
    const primeiraCarga = estadoAnterior.size === 0;
    const novasLinhasEvento = [];
    const linhasMembros = [];

    membros.forEach(m => {
      const id = String(m.id || '').trim();
      if (!id) return;

      const ultimoLoginIso = String(m.lastLoginDate || '').trim();
      const anterior = estadoAnterior.get(id) || '';

      if (ultimoLoginIso && ultimoLoginIso !== anterior) {
        const fonte = anterior
          ? 'LOGIN_DETECTADO'
          : (primeiraCarga ? 'BASELINE_WIX_ULTIMO_LOGIN' : 'NOVO_MEMBRO_LOGIN');
        novasLinhasEvento.push(pbxLinhaEventoLogin_(m, fonte));
      }

      linhasMembros.push(pbxLinhaMembroLogin_(m));
    });

    pbxSubstituirTabelaDados_(sheetMembros, PBX_LOGIN_HEADERS_MEMBROS, linhasMembros);

    if (novasLinhasEvento.length) {
      const inicio = Math.max(2, sheetEventos.getLastRow() + 1);
      sheetEventos.getRange(inicio, 1, novasLinhasEvento.length, PBX_LOGIN_HEADERS_EVENTOS.length)
        .setValues(novasLinhasEvento);
      sheetEventos.getRange(inicio, 1, novasLinhasEvento.length, 1)
        .setNumberFormat('dd/MM/yyyy HH:mm:ss');
    }

    pbxAtualizarResumoLogins_(sheetResumo, sheetEventos, membros);
    pbxGarantirGraficoLogins_(sheetResumo);

    PropertiesService.getScriptProperties()
      .setProperty('PBX_LOGIN_MONITOR_LAST_OK', new Date().toISOString());

    return {
      ok: true,
      membros: membros.length,
      novosEventos: novasLinhasEvento.length,
      primeiraCarga
    };
  } finally {
    lock.releaseLock();
  }
}

function pbxBuscarTodosMembrosWix_(apiKey) {
  const todos = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = UrlFetchApp.fetch(PBX_LOGIN_WIX_MEMBERS_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: apiKey,
        'wix-site-id': PBX_LOGIN_WIX_SITE_ID,
        Accept: 'application/json'
      },
      payload: JSON.stringify({
        query: { paging: { limit, offset } },
        fieldsets: ['FULL']
      }),
      muteHttpExceptions: true
    });

    const status = response.getResponseCode();
    const texto = response.getContentText();
    if (status < 200 || status >= 300) {
      throw new Error(`Wix Members: HTTP ${status} - ${texto.slice(0, 800)}`);
    }

    let body = {};
    try { body = texto ? JSON.parse(texto) : {}; }
    catch (_) { throw new Error('Wix Members: resposta JSON invalida.'); }

    const lote = Array.isArray(body.members) ? body.members : [];
    todos.push(...lote);

    const total = Number(body.metadata && body.metadata.total || todos.length);
    offset += lote.length;
    if (!lote.length || offset >= total || lote.length < limit) break;
  }

  return todos;
}

function pbxPrepararAbasLoginProjetosProntos_(ss) {
  const membros = pbxGarantirAbaLogin_(ss, PBX_LOGIN_SHEET_MEMBROS, PBX_LOGIN_HEADERS_MEMBROS);
  const eventos = pbxGarantirAbaLogin_(ss, PBX_LOGIN_SHEET_EVENTOS, PBX_LOGIN_HEADERS_EVENTOS);
  const resumo = pbxGarantirAbaLogin_(ss, PBX_LOGIN_SHEET_RESUMO, PBX_LOGIN_HEADERS_RESUMO);

  membros.setFrozenRows(1);
  eventos.setFrozenRows(1);
  resumo.setFrozenRows(1);

  membros.getRange('M:O').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  eventos.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');

  pbxFormatarHeaderLogin_(membros, PBX_LOGIN_HEADERS_MEMBROS.length);
  pbxFormatarHeaderLogin_(eventos, PBX_LOGIN_HEADERS_EVENTOS.length);
  pbxFormatarHeaderLogin_(resumo, PBX_LOGIN_HEADERS_RESUMO.length);

  membros.setColumnWidth(1, 260);
  membros.setColumnWidth(2, 260);
  membros.setColumnWidth(3, 170);
  membros.setColumnWidth(4, 170);
  membros.setColumnWidth(5, 200);
  membros.setColumnWidth(6, 260);
  membros.setColumnWidth(8, 170);
  membros.setColumnWidth(15, 155);
  membros.setColumnWidth(20, 280);
  membros.setColumnWidth(25, 280);

  eventos.setColumnWidth(1, 155);
  eventos.setColumnWidth(2, 100);
  eventos.setColumnWidth(3, 90);
  eventos.setColumnWidth(6, 170);
  eventos.setColumnWidth(7, 170);
  eventos.setColumnWidth(9, 250);
  eventos.setColumnWidth(17, 190);

  resumo.setColumnWidth(1, 110);
  resumo.setColumnWidths(2, 4, 125);

  return { membros, eventos, resumo };
}

function pbxGarantirAbaLogin_(ss, nome, headers) {
  let sheet = ss.getSheetByName(nome);
  if (!sheet) sheet = ss.insertSheet(nome);

  const atual = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const diferente = headers.some((h, i) => String(atual[i] || '') !== h);
  if (diferente) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function pbxFormatarHeaderLogin_(sheet, qtdCols) {
  sheet.getRange(1, 1, 1, qtdCols)
    .setBackground('#163A5F')
    .setFontColor('#FFFFFF')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

function pbxLerEstadoMembrosLogin_(sheet) {
  const mapa = new Map();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return mapa;

  const values = sheet.getRange(2, 1, lastRow - 1, PBX_LOGIN_HEADERS_MEMBROS.length).getValues();
  values.forEach(row => {
    const id = String(row[0] || '').trim();
    const iso = String(row[27] || '').trim();
    if (id) mapa.set(id, iso);
  });
  return mapa;
}

function pbxLinhaMembroLogin_(m) {
  const c = m.contact || {};
  const p = m.profile || {};
  const endereco = pbxMelhorEnderecoLogin_(c.addresses || []);
  const foto = p.photo || {};

  return [
    String(m.id || ''),
    String(m.contactId || c.contactId || ''),
    String(c.firstName || ''),
    String(c.lastName || ''),
    String(p.nickname || ''),
    String(m.loginEmail || ''),
    Boolean(m.loginEmailVerified),
    (c.phones || []).join(' | '),
    (c.emails || []).join(' | '),
    String(m.status || ''),
    String(m.activityStatus || ''),
    String(m.privacyStatus || ''),
    pbxDataWixLogin_(m.createdDate),
    pbxDataWixLogin_(m.updatedDate),
    pbxDataWixLogin_(m.lastLoginDate),
    String(endereco.city || ''),
    String(endereco.subdivision || ''),
    String(endereco.country || ''),
    String(endereco.postalCode || ''),
    String(endereco.addressLine || ''),
    String(c.company || ''),
    String(c.jobTitle || ''),
    String(c.birthdate || ''),
    String(p.slug || ''),
    String(foto.url || ''),
    JSON.stringify(c.addresses || []),
    JSON.stringify(c.customFields || {}),
    String(m.lastLoginDate || '')
  ];
}

function pbxLinhaEventoLogin_(m, fonte) {
  const c = m.contact || {};
  const p = m.profile || {};
  const endereco = pbxMelhorEnderecoLogin_(c.addresses || []);
  const iso = String(m.lastLoginDate || '');
  const d = pbxDataWixLogin_(iso);

  return [
    d,
    d ? Utilities.formatDate(d, PBX_LOGIN_TZ, 'dd/MM/yyyy') : '',
    d ? Utilities.formatDate(d, PBX_LOGIN_TZ, 'HH:mm:ss') : '',
    String(m.id || ''),
    String(m.contactId || c.contactId || ''),
    String(c.firstName || ''),
    String(c.lastName || ''),
    String(p.nickname || ''),
    String(m.loginEmail || ''),
    (c.phones || []).join(' | '),
    String(m.status || ''),
    String(m.activityStatus || ''),
    pbxDataWixLogin_(m.createdDate),
    String(endereco.city || ''),
    String(endereco.subdivision || ''),
    String(endereco.country || ''),
    String(fonte || ''),
    iso
  ];
}

function pbxMelhorEnderecoLogin_(enderecos) {
  if (!Array.isArray(enderecos) || !enderecos.length) return {};
  return enderecos.find(a => a && (a.city || a.addressLine || a.postalCode || a.subdivision || a.country)) || enderecos[0] || {};
}

function pbxDataWixLogin_(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  return isNaN(d.getTime()) ? '' : d;
}

function pbxSubstituirTabelaDados_(sheet, headers, rows) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function pbxAtualizarResumoLogins_(sheetResumo, sheetEventos, membros) {
  const porDia = new Map();
  const cadastroPorMembro = new Map();
  const novosPorDia = new Map();

  membros.forEach(m => {
    const id = String(m.id || '');
    if (!id || !m.createdDate) return;
    const d = new Date(m.createdDate);
    if (isNaN(d.getTime())) return;
    const key = Utilities.formatDate(d, PBX_LOGIN_TZ, 'yyyy-MM-dd');
    cadastroPorMembro.set(id, key);
    novosPorDia.set(key, (novosPorDia.get(key) || 0) + 1);
  });

  const lastRow = sheetEventos.getLastRow();
  if (lastRow >= 2) {
    const values = sheetEventos.getRange(2, 1, lastRow - 1, PBX_LOGIN_HEADERS_EVENTOS.length).getValues();
    values.forEach(row => {
      const data = row[0];
      const memberId = String(row[3] || '');
      if (!(data instanceof Date) || isNaN(data.getTime()) || !memberId) return;

      const key = Utilities.formatDate(data, PBX_LOGIN_TZ, 'yyyy-MM-dd');
      if (!porDia.has(key)) porDia.set(key, { total: 0, unicos: new Set(), retornos: new Set() });
      const item = porDia.get(key);
      item.total += 1;
      item.unicos.add(memberId);

      const cadastro = cadastroPorMembro.get(memberId) || '';
      if (cadastro && cadastro < key) item.retornos.add(memberId);
    });
  }

  novosPorDia.forEach((_, key) => {
    if (!porDia.has(key)) porDia.set(key, { total: 0, unicos: new Set(), retornos: new Set() });
  });

  const keys = Array.from(porDia.keys()).sort();
  const rows = keys.map(key => {
    const item = porDia.get(key);
    const partes = key.split('-');
    const rotulo = `${partes[2]}/${partes[1]}/${partes[0]}`;
    return [
      rotulo,
      item.total,
      item.unicos.size,
      novosPorDia.get(key) || 0,
      item.retornos.size
    ];
  });

  pbxSubstituirTabelaDados_(sheetResumo, PBX_LOGIN_HEADERS_RESUMO, rows);
}

function pbxGarantirGraficoLogins_(sheetResumo) {
  const charts = sheetResumo.getCharts();
  if (charts.length) return;

  const chart = sheetResumo.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheetResumo.getRange('A1:E400'))
    .setPosition(2, 7, 0, 0)
    .setOption('title', 'Logins por dia - Projetos Prontos')
    .setOption('legend', { position: 'bottom' })
    .setOption('hAxis', { title: 'Data' })
    .setOption('vAxis', { title: 'Quantidade', minValue: 0 })
    .setOption('width', 900)
    .setOption('height', 420)
    .build();

  sheetResumo.insertChart(chart);
}
