/**
 * PELEGO BOX • DASHBOARDS FINAIS
 * Fonte oficial: GitHub.
 *
 * Regras:
 * - Dashboard_Mensal e Dashboard_Anual não usam o buscador.
 * - A sidebar NÃO é destruída ao entrar no dashboard.
 * - A extensão do Chrome apenas oculta a sidebar no dashboard e a mostra novamente em Videos_projetos.
 * - Eixos dos gráficos de faturamento/vendas usam marcações de 5 em 5.
 * - Os gráficos continuam autoescaláveis: o teto sobe para o próximo múltiplo de 5.
 */

const PBX_DASHBOARD_FINAL_VERSION = '2026-08-17-final-v2';

function onSelectionChange(e) {
  try {
    const sh = e && e.range
      ? e.range.getSheet()
      : SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    const nome = sh.getName();
    const cache = CacheService.getUserCache();
    const ultimaAba = String(cache.get('PBX_ULTIMA_ABA') || '');

    if (ultimaAba !== nome) {
      cache.put('PBX_ULTIMA_ABA', nome, 21600);
      // Importante: não fecha e não tenta reabrir a sidebar aqui.
      // O Apps Script não é confiável para reabrir UI em troca de aba.
      // A extensão do Chrome cuida apenas de ocultar/mostrar a mesma sidebar viva.
    }

    if (nome === 'Dashboard_Mensal' || nome === 'Dashboard_Anual') {
      const marcador = sh.getRange('N80');
      if (String(marcador.getValue() || '') !== PBX_DASHBOARD_FINAL_VERSION) {
        pbxDashboardAjustarEixos5_(sh);
        marcador.setValue(PBX_DASHBOARD_FINAL_VERSION);
      }
    }
  } catch (err) {
    console.log('PBX onSelectionChange:', err && err.message ? err.message : err);
  }
}

// Mantida por compatibilidade com versões anteriores.
// Não fecha mais a sidebar: destruir a sidebar obrigava um novo F5 para recriá-la.
function pbxFecharBuscadorNoDashboard_() {
  return { ok: true, modo: 'sidebar_persistente' };
}

/**
 * Reaplica as escalas de 5 em 5.
 * Pode ser executada manualmente se os dados crescerem muito durante o dia.
 */
function pbxDashboardAtualizarEixos5() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Dashboard_Mensal', 'Dashboard_Anual'].forEach(nome => {
    const sh = ss.getSheetByName(nome);
    if (!sh) return;
    pbxDashboardAjustarEixos5_(sh);
    sh.getRange('N80').setValue(PBX_DASHBOARD_FINAL_VERSION);
  });

  SpreadsheetApp.getActive().toast(
    'Dashboards atualizados em múltiplos de 5.',
    'PELEGO BOX',
    3
  );
}

function pbxDashboardAjustarEixos5_(sh) {
  const nome = sh.getName();
  const mensal = nome === 'Dashboard_Mensal';

  const linhaFimTempo = mensal ? 62 : 43;
  const faixaTempo = sh.getRange(32, 2, linhaFimTempo - 31, 2).getValues();

  const maxFaturamento = pbxMaxNumerico_(faixaTempo.map(r => r[0]));
  const maxVendas = pbxMaxNumerico_(faixaTempo.map(r => r[1]));

  const ticksFat = pbxTicks5_(maxFaturamento);
  const ticksVendas = pbxTicks5_(maxVendas);

  const maxProjeto = pbxMaxNumerico_(sh.getRange('J32:J41').getValues().flat());
  const maxCliente = pbxMaxNumerico_(sh.getRange('N32:N41').getValues().flat());

  const ticksProjeto = pbxTicks5_(maxProjeto);
  const ticksCliente = pbxTicks5_(maxCliente);

  const tituloTempo = mensal
    ? 'Vendas por dia + Faturamento por dia'
    : 'Vendas por mês + Faturamento por mês';

  const tituloProjeto = mensal
    ? 'Faturamento por projeto • Top 10'
    : 'Faturamento por projeto • Top 10 do ano';

  const tituloCliente = mensal
    ? 'Clientes que mais faturam • Top 10 do mês'
    : 'Clientes que mais faturam • Top 10 do ano';

  sh.getCharts().forEach(chart => {
    const titulo = String(chart.getOptions().get('title') || '');
    let builder = chart.modify();

    if (titulo === tituloTempo) {
      builder = builder
        .setOption('vAxes', {
          0: {
            title: 'Faturamento (R$)',
            minValue: 0,
            ticks: ticksFat,
            textStyle: { color: '#486581' },
            titleTextStyle: { color: '#1F6F8B', bold: true }
          },
          1: {
            title: 'Vendas',
            minValue: 0,
            ticks: ticksVendas,
            textStyle: { color: '#486581' },
            titleTextStyle: { color: '#F97316', bold: true }
          }
        })
        .setOption('series', {
          0: {
            type: 'bars',
            targetAxisIndex: 0,
            color: '#1F6F8B'
          },
          1: {
            type: 'line',
            targetAxisIndex: 1,
            color: '#F97316',
            lineWidth: 3,
            pointSize: 7
          }
        })
        .setOption('legend', {
          position: 'top',
          textStyle: { color: '#102A43' }
        });
      sh.updateChart(builder.build());
      return;
    }

    if (titulo === tituloProjeto) {
      builder = builder.setOption('hAxis', {
        minValue: 0,
        ticks: ticksProjeto,
        textStyle: { color: '#486581' }
      });
      sh.updateChart(builder.build());
      return;
    }

    if (titulo === tituloCliente) {
      builder = builder.setOption('hAxis', {
        minValue: 0,
        ticks: ticksCliente,
        textStyle: { color: '#486581' }
      });
      sh.updateChart(builder.build());
    }
  });
}

function pbxTicks5_(maxValor) {
  const max = Math.max(5, Number(maxValor) || 0);
  const teto = Math.ceil(max / 5) * 5;
  const ticks = [];
  for (let v = 0; v <= teto; v += 5) ticks.push(v);
  return ticks;
}

function pbxMaxNumerico_(valores) {
  let max = 0;
  (valores || []).forEach(v => {
    const n = Number(v);
    if (Number.isFinite(n) && n > max) max = n;
  });
  return max;
}
