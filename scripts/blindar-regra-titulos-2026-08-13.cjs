const fs = require("fs");

const NOTIFY = "src/backend/notificarVendaProjetoPronto.js";
const PIX = "src/backend/validaPayPixProjetosProntosCore.jsw";
const CARD = "src/backend/validaPayCartaoProjetosProntos.jsw";

function patchNotify() {
  let code = fs.readFileSync(NOTIFY, "utf8");
  const importLine = 'import { tituloEtapaProjetoPronto } from "backend/projetosProntosNormalizacao";\n';
  const anchor = 'import { getSecret } from "wix-secrets-backend";\n';
  if (!code.includes(importLine)) code = code.replace(anchor, anchor + importLine);

  const start = code.indexOf("function tituloProjetoParaEmail(session) {");
  const end = code.indexOf("async function reservarEnvioEmail(checkoutId)", start);
  if (start < 0 || end < 0) throw new Error("Helper de título não encontrado.");

  const helper = `function tituloProjetoParaEmail(session) {\n  return tituloEtapaProjetoPronto(\n    safe(session?.produto) || safe(session?.tituloCheckout) || \"Projeto Pronto\",\n    type(session?.tipoProduto),\n    digits(session?.codigoProjeto)\n  ) || \"Projeto Pronto\";\n}\n\n`;

  code = code.slice(0, start) + helper + code.slice(end);
  code = code.replace(
    "  const produto = safe(session?.tituloCheckout) || safe(session?.produto);",
    "  const produto = tituloProjetoParaEmail(session);"
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
console.log("Regra mestre de títulos aplicada ao pós-pagamento e à ValidaPay.");
