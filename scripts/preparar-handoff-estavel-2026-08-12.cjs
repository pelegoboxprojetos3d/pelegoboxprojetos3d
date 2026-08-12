const fs = require("fs");

const arquivo = "src/pages/checkout-projeto-pronto.i9aj1.js";
let codigo = fs.readFileSync(arquivo, "utf8");
const original = codigo;

const linhaBase = 'const VERIFIED_SESSION_KEY = "pp_checkout_cliente_validado_sessao";';
const constantes = `${linhaBase}\nconst CHECKOUT_AUTH_KEY = "pp_checkout_autorizado";\nconst CHECKOUT_AUTH_MAX_AGE = 5 * 60 * 1000;`;

if (!codigo.includes('const CHECKOUT_AUTH_KEY = "pp_checkout_autorizado";')) {
  if (!codigo.includes(linhaBase)) {
    throw new Error("Preparador do handoff: VERIFIED_SESSION_KEY não encontrada.");
  }
  codigo = codigo.replace(linhaBase, constantes);
  console.log("Preparador: constantes do handoff restauradas.");
}

/*
  O script estável substitui a versão antiga chamada checkoutHandoffVerified.
  Se a versão atual já usa checkoutHandoffSnapshot, renomeamos temporariamente
  apenas dentro deste job. O passo seguinte recria checkoutHandoffSnapshot com
  a implementação definitiva antes do lint/publicação.
*/
if (
  codigo.includes("function checkoutHandoffSnapshot(") &&
  !codigo.includes("function checkoutHandoffVerified(")
) {
  codigo = codigo.replace(
    "function checkoutHandoffSnapshot(",
    "function checkoutHandoffVerified("
  );
  console.log("Preparador: snapshot atual marcado para substituição estável.");
}

if (
  !codigo.includes("function checkoutHandoffSnapshot(") &&
  !codigo.includes("function checkoutHandoffVerified(")
) {
  const marcador = "function sessionIdentityCandidate()";
  const pos = codigo.indexOf(marcador);
  if (pos < 0) {
    throw new Error("Preparador do handoff: sessionIdentityCandidate não encontrada.");
  }

  const ponteTemporaria = `function checkoutHandoffVerified(saved = {}, project = "", type = "") {\n  return false;\n}\n\n`;
  codigo = codigo.slice(0, pos) + ponteTemporaria + codigo.slice(pos);
  console.log("Preparador: marcador de handoff restaurado para a correção estável.");
}

if (codigo !== original) {
  fs.writeFileSync(arquivo, codigo, "utf8");
  console.log("Preparador do handoff aplicado.");
} else {
  console.log("Preparador do handoff: nada a fazer.");
}
