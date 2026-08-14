const fs = require("fs");

const FILE = "scripts/blindar-regra-titulos-2026-08-13.cjs";
let code = fs.readFileSync(FILE, "utf8");

const from = `  let start = code.indexOf("async function tituloProjetoParaEmail(session) {");
  if (start < 0) start = code.indexOf("function tituloProjetoParaEmail(session) {");`;

const to = `  let start = code.indexOf("function tituloProjetoSessao(session) {");
  if (start < 0) start = code.indexOf("async function tituloProjetoParaEmail(session) {");
  if (start < 0) start = code.indexOf("function tituloProjetoParaEmail(session) {");`;

if (code.includes(from)) {
  code = code.replace(from, to);
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Regra de títulos blindada contra helper duplicado.");
} else if (code.includes(to)) {
  console.log("Regra de títulos já está idempotente.");
} else {
  throw new Error("Trecho da regra de títulos não encontrado.");
}
