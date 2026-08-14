const fs = require("fs");
const path = require("path");

const backend = path.join(process.cwd(), "src/backend/validaPayCartaoProjetosProntos.jsw");
const current = fs.readFileSync(backend, "utf8");

const alreadyApplied =
  current.includes('import { tokenize } from "@validapay/tokenize";') &&
  current.includes("useSavedPaymentMethod") &&
  current.includes("pendingPaymentMethodId: paymentMethodId") &&
  current.includes("await persistirMetodoPagamentoAprovado(session, chargeId);") &&
  !current.includes("chargePayload.card = {");

if (alreadyApplied) {
  console.log("Cartão salvo tokenizado já está aplicado e validado.");
  process.exit(0);
}

const v2 = path.join(__dirname, "restaurar-cartao-salvo-tokenizado-v2-2026-08-14.cjs");
let code = fs.readFileSync(v2, "utf8");
const from = '  if (code.includes(to)) return;';
const to = '  if (to && code.includes(to)) return;';
if (code.includes(from)) {
  code = code.replace(from, to);
  fs.writeFileSync(v2, code, "utf8");
}

require(v2);
