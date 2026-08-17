/**
 * RESET FORTE DO BUSCADOR PELEGO BOX
 * Restaura explicitamente a aba de origem do buscador.
 * Não depende da aba que o Apps Script considerar ativa no instante do clique.
 */
function pbxResetarBuscadorCompleto(aba) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nome = String(aba || '').trim();
  let sh = nome ? ss.getSheetByName(nome) : null;

  if (!sh) sh = ss.getActiveSheet();
  if (!sh) throw new Error('Aba não encontrada para resetar o buscador.');

  if (pbxEhDashboardProtegido_(sh)) {
    return {
      ok: true,
      desativado: true,
      aba: sh.getName()
    };
  }

  ss.setActiveSheet(sh);

  const maxRows = sh.getMaxRows();
  if (maxRows > 0) {
    sh.showRows(1, maxRows);
  }

  SpreadsheetApp.flush();

  // Volta para o início da planilha, deixando claro visualmente que o reset ocorreu.
  sh.getRange('A1').activate();

  return {
    ok: true,
    aba: sh.getName(),
    linhas: maxRows,
    mensagem: 'Planilha restaurada.'
  };
}
