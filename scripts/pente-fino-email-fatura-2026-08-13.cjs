const fs = require("fs");

const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";
const PAYMENT_FILES = [
  "src/backend/validaPayCartaoProjetosProntos.jsw",
  "src/backend/validaPayPixProjetosProntosCore.jsw"
];

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

function restoreInvoice(file) {
  let code = fs.readFileSync(file, "utf8");
  let changed = false;

  const hardened = "      const providerConfirmed = response.ok && response.data?.success !== false;\n      if (providerConfirmed) {";
  const knownGood = "      if (response.ok) {";
  if (code.includes(hardened)) {
    code = code.replace(hardened, knownGood);
    changed = true;
  }

  const hardenedError = '        error: response.ok && response.data?.success === false ? "notification_not_confirmed" : (response.error || "notification_resend_failed"),';
  const knownGoodError = '        error: response.error || "notification_resend_failed",';
  if (code.includes(hardenedError)) {
    code = code.replace(hardenedError, knownGoodError);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, code, "utf8");
    console.log(`${file}: fatura restaurada para o comportamento comprovadamente funcional (HTTP 2xx encerra o reenvio).`);
  } else {
    console.log(`${file}: fatura já está no comportamento conhecido como bom.`);
  }
}

function patchNotification() {
  let code = fs.readFileSync(NOTIFY, "utf8");

  code = replaceOnce(
    code,
    'import { getSecret } from "wix-secrets-backend";\n',
    'import { getSecret } from "wix-secrets-backend";\nimport { normalizarTituloProduto } from "backend/projetosProntosNormalizacao";\n',
    "Import da normalização do título"
  );

  code = replaceOnce(
    code,
    'const HISTORICO_COMPRAS = "HistoricoComprasProjetosProntos";\n',
    'const HISTORICO_COMPRAS = "HistoricoComprasProjetosProntos";\nconst PROJECTS = "Videosprojetos";\n',
    "Coleção Videosprojetos"
  );

  if (!code.includes("async function tituloProjetoParaEmail(session)")) {
    const marker = "function gerarCodigoCompra() {";
    if (!code.includes(marker)) throw new Error("Âncora para helpers de e-mail não encontrada.");
    const helpers = `async function tituloProjetoParaEmail(session) {\n  const codigo = digits(session?.codigoProjeto);\n  let item = null;\n\n  if (codigo) {\n    const numeric = Number(codigo);\n    if (Number.isSafeInteger(numeric)) {\n      try {\n        const result = await wixData.query(PROJECTS).eq("ordem_video", numeric).limit(1).find({ ...DB, consistentRead: true });\n        item = result.items?.[0] || null;\n      } catch (_) {}\n    }\n\n    if (!item) {\n      try {\n        const result = await wixData.query(PROJECTS).eq("ordem_video", codigo).limit(1).find({ ...DB, consistentRead: true });\n        item = result.items?.[0] || null;\n      } catch (_) {}\n    }\n\n    if (!item) {\n      try {\n        const result = await wixData.query(PROJECTS).startsWith("titulo_video", \`#\${codigo}\`).limit(1).find({ ...DB, consistentRead: true });\n        item = result.items?.[0] || null;\n      } catch (_) {}\n    }\n  }\n\n  const tituloColecao = normalizarTituloProduto(item?.titulo_video);\n  if (tituloColecao) return tituloColecao;\n\n  return normalizarTituloProduto(session?.produto) || safe(session?.produto) || "Projeto Pronto";\n}\n\nasync function reservarEnvioEmail(checkoutId) {\n  const atual = await findSession(checkoutId);\n  if (!atual) return { ok:false, reason:"session_not_found" };\n  if (atual.emailEnviado === true || atual.emailEnviadoEm) return { ok:false, reason:"already_sent" };\n\n  const reservadoEm = new Date(atual.emailEnvioReservadoEm || 0).getTime();\n  if (reservadoEm && Date.now() - reservadoEm < 120000) {\n    return { ok:false, reason:"send_in_progress" };\n  }\n\n  const token = \`mail_\${Date.now().toString(36)}_\${Math.random().toString(36).slice(2,9)}\`;\n  await wixData.update(SESSIONS, {\n    ...atual,\n    emailEnvioReservaToken: token,\n    emailEnvioReservadoEm: new Date(),\n    updatedAtDate: new Date()\n  }, DB);\n\n  // Duas confirmações podem chegar praticamente juntas. A pequena espera faz\n  // a última reserva vencer; somente quem ainda possuir o token envia o webhook.\n  await new Promise(resolve => setTimeout(resolve, 300));\n  const confirmado = await findSession(checkoutId);\n  if (!confirmado || confirmado.emailEnvioReservaToken !== token) {\n    return { ok:false, reason:"lost_lock" };\n  }\n  if (confirmado.emailEnviado === true || confirmado.emailEnviadoEm) {\n    return { ok:false, reason:"already_sent" };\n  }\n  return { ok:true, token };\n}\n\n`;
    code = code.replace(marker, helpers + marker);
  }

  code = replaceOnce(
    code,
    '  const amount = Number(session.valor || 0);\n  const payload = {\n',
    '  const amount = Number(session.valor || 0);\n  const tituloEmailCorreto = await tituloProjetoParaEmail(session);\n  const payload = {\n',
    "Título canônico antes do payload"
  );

  code = replaceOnce(
    code,
    '    produto: safe(session.produto),\n',
    '    produto: safe(session.produto),\n    tituloProjeto: tituloEmailCorreto,\n',
    "Título canônico no payload"
  );

  code = replaceOnce(
    code,
    '    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + safe(session.produto),\n    tituloEmail: safe(session.produto),\n',
    '    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + tituloEmailCorreto,\n    tituloEmail: tituloEmailCorreto,\n',
    "Assunto e título do e-mail"
  );

  code = replaceOnce(
    code,
    '  const patch = { ...session, updatedAtDate: new Date() };\n',
    '  const patch = { updatedAtDate: new Date() };\n',
    "Patch concorrente seguro"
  );

  const oldEmailBlock = `  if (!session.emailEnviadoEm && session.emailEnviado !== true) {\n    const url = await optionalSecret(MAKE_SALE_SECRET);\n    if (url) {\n      try {\n        await postJson(url, emailPayload);\n        patch.emailEnviadoEm = new Date();\n        patch.emailEnviado = true;\n        changed = true;\n        result.email = "sent";\n      } catch (error) {\n        result.email = "error";\n        console.error("Falha ao disparar email da venda:", error?.message || error);\n      }\n    } else {\n      result.email = "secret_missing";\n    }\n  }`;

  const newEmailBlock = `  if (!session.emailEnviadoEm && session.emailEnviado !== true) {\n    const reserva = await reservarEnvioEmail(checkoutId);\n    if (reserva.ok) {\n      const url = await optionalSecret(MAKE_SALE_SECRET);\n      if (url) {\n        try {\n          await postJson(url, emailPayload);\n          patch.emailEnviadoEm = new Date();\n          patch.emailEnviado = true;\n          patch.emailEnvioReservaToken = "";\n          patch.emailEnvioReservadoEm = null;\n          changed = true;\n          result.email = "sent";\n        } catch (error) {\n          patch.emailEnvioReservaToken = "";\n          patch.emailEnvioReservadoEm = null;\n          changed = true;\n          result.email = "error";\n          console.error("Falha ao disparar email da venda:", error?.message || error);\n        }\n      } else {\n        patch.emailEnvioReservaToken = "";\n        patch.emailEnvioReservadoEm = null;\n        changed = true;\n        result.email = "secret_missing";\n      }\n    } else {\n      result.email = reserva.reason === "already_sent" ? "skipped" : "locked";\n    }\n  }`;

  code = replaceOnce(code, oldEmailBlock, newEmailBlock, "Trava contra e-mail duplicado");

  code = replaceOnce(
    code,
    '  if (changed) await wixData.update(SESSIONS, patch, DB);\n',
    '  if (changed) {\n    const latest = await findSession(checkoutId);\n    if (latest) await wixData.update(SESSIONS, { ...latest, ...patch, updatedAtDate: new Date() }, DB);\n  }\n',
    "Persistência sem sobrescrever alterações concorrentes"
  );

  fs.writeFileSync(NOTIFY, code, "utf8");
  console.log("E-mail: título canônico + código do questionário e trava anti-duplicação aplicados.");
}

for (const file of PAYMENT_FILES) restoreInvoice(file);
patchNotification();
console.log("Pente-fino final de e-mail e fatura concluído.");
