const fs = require("fs");

const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";
const PIX = "src/backend/validaPayPixProjetosProntosCore.jsw";
const CARD = "src/backend/validaPayCartaoProjetosProntos.jsw";

function patchNotify() {
  let code = fs.readFileSync(NOTIFY, "utf8");
  const importLine = 'import { tituloEtapaProjetoPronto } from "backend/projetosProntosNormalizacao";\n';
  const anchor = 'import { getSecret } from "wix-secrets-backend";\n';
  if (!code.includes(importLine)) code = code.replace(anchor, anchor + importLine);

  const projectConst = 'const PROJECTS = "Videosprojetos";\n';
  const sessionsConst = 'const SESSIONS = "SessoesProjetosProntos2";\n';
  if (!code.includes(projectConst)) code = code.replace(sessionsConst, sessionsConst + projectConst);

  let start = code.indexOf("async function tituloProjetoParaEmail(session) {");
  if (start < 0) start = code.indexOf("function tituloProjetoParaEmail(session) {");
  const end = code.indexOf("async function reservarEnvioEmail(checkoutId)", start);
  if (start < 0 || end < 0) throw new Error("Helper de título do e-mail não encontrado.");

  const helper = `function tituloProjetoSessao(session) {\n  return tituloEtapaProjetoPronto(\n    safe(session?.produto) || safe(session?.tituloCheckout) || \"Projeto Pronto\",\n    type(session?.tipoProduto),\n    digits(session?.codigoProjeto)\n  ) || \"Projeto Pronto\";\n}\n\nasync function tituloProjetoParaEmail(session) {\n  /*\n    REGRA DO E-MAIL VIA MAKE:\n    1) O título-base vem SEMPRE de Videosprojetos.titulo_video.\n    2) O código do projeto vem de ordem_video/codigoProjeto.\n    3) O botão vem de tipoProduto e é aplicado por tituloEtapaProjetoPronto.\n    4) A normalização converte o título para apresentação natural e remove\n       o sufixo PELEGO BOX..., preservando o código 001–014 já existente.\n    O e-mail não usa mais o título bruto da URL/sessão como fonte principal.\n  */\n  const codigo = digits(session?.codigoProjeto);\n  let tituloBase = \"\";\n\n  if (codigo) {\n    const numeric = Number(codigo);\n\n    if (Number.isSafeInteger(numeric)) {\n      try {\n        const r = await wixData.query(PROJECTS).eq(\"ordem_video\", numeric).limit(1).find(DB);\n        tituloBase = safe(r.items?.[0]?.titulo_video);\n      } catch (_) {}\n    }\n\n    if (!tituloBase) {\n      try {\n        const r = await wixData.query(PROJECTS).eq(\"ordem_video\", codigo).limit(1).find(DB);\n        tituloBase = safe(r.items?.[0]?.titulo_video);\n      } catch (_) {}\n    }\n\n    if (!tituloBase) {\n      try {\n        const r = await wixData.query(PROJECTS).startsWith(\"titulo_video\", \`#\${codigo}\`).limit(1).find(DB);\n        tituloBase = safe(r.items?.[0]?.titulo_video);\n      } catch (_) {}\n    }\n  }\n\n  const base = tituloBase || safe(session?.produto) || safe(session?.tituloCheckout) || \"Projeto Pronto\";\n\n  return tituloEtapaProjetoPronto(\n    base,\n    type(session?.tipoProduto),\n    codigo\n  ) || \"Projeto Pronto\";\n}\n\n`;

  code = code.slice(0, start) + helper + code.slice(end);

  code = code.replace(
    "  const produto = tituloProjetoParaEmail(session);",
    "  const produto = tituloProjetoSessao(session);"
  );

  code = code.replace(
    "  const produto = safe(session?.tituloCheckout) || safe(session?.produto);",
    "  const produto = tituloProjetoSessao(session);"
  );

  code = code.replace(
    "  const tituloEmailCorreto = tituloProjetoParaEmail(session);",
    "  const tituloEmailCorreto = await tituloProjetoParaEmail(session);"
  );

  fs.writeFileSync(NOTIFY, code, "utf8");
}

function patchPaymentFile(file) {
  let code = fs.readFileSync(file, "utf8");
  code = code.replaceAll(
    "normalizarTituloProduto(item?.tituloCheckout || item?.produto)",
    "normalizarTituloProduto(item?.produto || item?.tituloCheckout)"
  );
  code = code.replaceAll(
    "normalizarTituloProduto(current?.tituloCheckout || current?.produto)",
    "normalizarTituloProduto(current?.produto || current?.tituloCheckout)"
  );
  code = code.replaceAll(
    "decodeTitle(session.tituloCheckout || session.produto)",
    "decodeTitle(session.produto || session.tituloCheckout)"
  );
  code = code.replace(
    "produto: tituloCheckout || produto,",
    "produto,"
  );
  fs.writeFileSync(file, code, "utf8");
}

patchNotify();
patchPaymentFile(PIX);
patchPaymentFile(CARD);
console.log("E-mail via Make: título vem de Videosprojetos e recebe a etapa correta do botão.");
