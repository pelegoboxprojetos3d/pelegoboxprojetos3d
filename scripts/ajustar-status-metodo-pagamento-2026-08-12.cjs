const fs = require("fs");

const FILE = "src/public/custom-elements/pelego-checkout-pronto.js";

function fail(message) {
  throw new Error(message);
}

let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceExact(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) fail(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

if (!code.includes("function setPaymentMethodStatus(")) {
  replaceExact(
    "function openPix(){\n E.cardMode.classList.add(\"hidden\");E.normal.classList.remove(\"hidden\");E.pixArea.classList.remove(\"hidden\");",
    `function setPaymentMethodStatus(node,text){\n if(!node)return;\n var status=node.querySelector(\".methodStatus\");\n if(status)status.textContent=text;\n}\nfunction selectPaymentMethod(method){\n var selected=safe(method).toUpperCase();\n setPaymentMethodStatus(E.pix,selected===\"PIX\"?\"Selecionado\":\"Ativo\");\n setPaymentMethodStatus(E.card,selected===\"CARD\"?\"Selecionado\":\"Ativo\");\n setPaymentMethodStatus(E.cardSelected,\"Selecionado\");\n setPaymentMethodStatus(E.pixFromCard,\"Ativo\");\n}\nfunction openPix(){\n selectPaymentMethod(\"PIX\");\n E.cardMode.classList.add(\"hidden\");E.normal.classList.remove(\"hidden\");E.pixArea.classList.remove(\"hidden\");`,
    "Estado selecionado do Pix"
  );
}

if (!code.includes('selectPaymentMethod("CARD");')) {
  replaceExact(
    "function openCard(){\n restoreDesktopOrder();",
    "function openCard(){\n selectPaymentMethod(\"CARD\");\n restoreDesktopOrder();",
    "Estado selecionado do cartão"
  );
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Status dos métodos ajustado: método escolhido = SELECIONADO; demais disponíveis = ATIVO.");
} else {
  console.log("Status dos métodos de pagamento já está correto.");
}
