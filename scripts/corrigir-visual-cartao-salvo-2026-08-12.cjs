const fs = require("fs");
const file = "src/public/custom-elements/pelego-checkout-pronto.js";
let code = fs.readFileSync(file, "utf8");
const from = '[120,350,800,1500].forEach(function(ms){setTimeout(updateVisual,ms)});';
const to = '[120,350,800,1500].forEach(function(ms){setTimeout(function(){if(!S.useSavedCard)updateVisual()},ms)});';
if (!code.includes(to)) {
  if (!code.includes(from)) throw new Error("Trecho de atualização tardia do cartão não encontrado.");
  code = code.replace(from, to);
  fs.writeFileSync(file, code, "utf8");
  console.log("Visual do cartão salvo protegido contra autofill tardio do navegador.");
} else {
  console.log("Visual do cartão salvo já protegido.");
}
