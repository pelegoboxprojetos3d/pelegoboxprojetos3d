const fs = require("fs");

const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";
const CARD = "src/backend/validaPayCartaoProjetosProntos.jsw";
const PIX = "src/backend/validaPayPixProjetosProntosCore.jsw";
const DELIVERY = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const FINALIZER = "scripts/finalizar-confete-fullscreen-fatura-validapay-2026-08-12.cjs";
const PENTE = "scripts/pente-fino-email-fatura-2026-08-13.cjs";

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

function patchEmailTitle() {
  let code = fs.readFileSync(NOTIFY, "utf8");

  code = code.replace('import { normalizarTituloProduto } from "backend/projetosProntosNormalizacao";\n', "");
  code = code.replace('const PROJECTS = "Videosprojetos";\n', "");

  const start = code.indexOf("async function tituloProjetoParaEmail(session) {");
  const end = code.indexOf("async function reservarEnvioEmail(checkoutId)", start);
  if (start < 0 || end < 0) throw new Error("Helper tituloProjetoParaEmail não encontrado.");

  const helper = `function tituloProjetoParaEmail(session) {\n  /*\n    REGRA FINAL: o e-mail usa exatamente o mesmo título comercial já salvo\n    na sessão do checkout. Não consulta Videosprojetos e não reconstrói a frase.\n  */\n  return safe(session?.produto) || "Projeto Pronto";\n}\n\n`;
  code = code.slice(0, start) + helper + code.slice(end);

  code = code.replace(
    "  const tituloEmailCorreto = await tituloProjetoParaEmail(session);",
    "  const tituloEmailCorreto = tituloProjetoParaEmail(session);"
  );

  code = code.replace(
    '// sobrescreve esse campo com o título canônico vindo de Videosprojetos.',
    '// sobrescreve esse campo com o título exato já usado no checkout.'
  );

  fs.writeFileSync(NOTIFY, code, "utf8");
  console.log("E-mail Pelego: título passa a ser exatamente session.produto do checkout.");
}

function patchInvoiceFunction(file, sleepCall) {
  let code = fs.readFileSync(file, "utf8");
  const start = code.indexOf("async function reenviarNotificacaoValidaPay(chargeId) {");
  const end = code.indexOf("async function garantirFaturaValidaPay", start);
  if (start < 0 || end < 0) throw new Error(`${file}: função de reenvio não encontrada.`);

  let block = code.slice(start, end);
  block = block.replace("const waits = [900, 1400, 2100];", "const waits = [0, 900, 2200];");

  block = block.replace(
    "      const providerConfirmed = response.ok && response.data?.success !== false;\n      if (providerConfirmed) {",
    "      const providerConfirmed = response.ok && response.data?.success === true;\n      if (providerConfirmed) {"
  );
  block = block.replace(
    "      if (response.ok) {",
    "      const providerConfirmed = response.ok && response.data?.success === true;\n      if (providerConfirmed) {"
  );

  block = block.replace(
    '        error: response.error || "notification_resend_failed",',
    '        error: response.ok && response.data?.success !== true ? "notification_not_confirmed" : (response.error || "notification_resend_failed"),'
  );
  block = block.replace(
    '        error: response.ok && response.data?.success === false ? "notification_not_confirmed" : (response.error || "notification_resend_failed"),',
    '        error: response.ok && response.data?.success !== true ? "notification_not_confirmed" : (response.error || "notification_resend_failed"),'
  );

  if (sleepCall === "timeout") {
    block = block.replace(
      "    await new Promise(resolve => setTimeout(resolve, waits[attempt]));",
      "    if (waits[attempt]) await new Promise(resolve => setTimeout(resolve, waits[attempt]));"
    );
  } else {
    block = block.replace(
      "    await sleep(waits[attempt]);",
      "    if (waits[attempt]) await sleep(waits[attempt]);"
    );
  }

  code = code.slice(0, start) + block + code.slice(end);
  fs.writeFileSync(file, code, "utf8");
  console.log(`${file}: fatura só confirma com success:true; primeira tentativa é imediata.`);
}

function patchDeliveryTime() {
  let code = fs.readFileSync(DELIVERY, "utf8");
  code = replaceOnce(
    code,
    "const MIN_PROCESSAMENTO_VISIVEL =\n  500;",
    "const MIN_PROCESSAMENTO_VISIVEL =\n  5000;",
    "Tempo mínimo da impressora"
  );
  code = code.replace(
    "a impressora permanece realmente visível por pelo menos 3 segundos.",
    "a impressora permanece realmente visível por pelo menos 5 segundos."
  );
  fs.writeFileSync(DELIVERY, code, "utf8");
  console.log("Entrega: impressora fica visível por no mínimo 5 segundos.");
}

function patchRegressionScripts() {
  let finalizer = fs.readFileSync(FINALIZER, "utf8");
  finalizer = finalizer.replaceAll(
    "response.ok && response.data?.success !== false",
    "response.ok && response.data?.success === true"
  );
  finalizer = finalizer.replaceAll(
    "response.ok && response.data?.success === false ? \"notification_not_confirmed\"",
    "response.ok && response.data?.success !== true ? \"notification_not_confirmed\""
  );
  finalizer = finalizer.replace(
    "o provedor não responde explicitamente success:false.",
    "o provedor responde explicitamente success:true."
  );
  fs.writeFileSync(FINALIZER, finalizer, "utf8");

  fs.writeFileSync(
    PENTE,
    'require("./estado-final-projetos-prontos-2026-08-13.cjs");\n',
    "utf8"
  );
  console.log("Scripts de automação blindados para não reverter título/fatura depois.");
}

patchEmailTitle();
patchInvoiceFunction(CARD, "timeout");
patchInvoiceFunction(PIX, "sleep");
patchDeliveryTime();
patchRegressionScripts();
require("./corrigir-central-projetos-email-2026-08-13.cjs");
console.log("Estado final Projetos Prontos aplicado.");