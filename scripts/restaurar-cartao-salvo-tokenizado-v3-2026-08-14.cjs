const fs = require("fs");
const path = require("path");

const v2 = path.join(__dirname, "restaurar-cartao-salvo-tokenizado-v2-2026-08-14.cjs");
let code = fs.readFileSync(v2, "utf8");
const from = '  if (code.includes(to)) return;';
const to = '  if (to && code.includes(to)) return;';
if (code.includes(from)) {
  code = code.replace(from, to);
  fs.writeFileSync(v2, code, "utf8");
}
require(v2);
