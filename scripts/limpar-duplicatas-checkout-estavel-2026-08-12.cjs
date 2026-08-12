const fs = require("fs");

const arquivo = "src/public/custom-elements/pelego-checkout-pronto.js";
let codigo = fs.readFileSync(arquivo, "utf8");
const original = codigo;

const bloco = `function identityFieldsReady(){
 var p=phoneLocal(E.phone.value),n=safe(E.name.value).replace(/\\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value),b=email(E.email2.value);
 return Boolean(p && n.length>=3 && validCpf(c) && validEmail(a) && validEmail(b) && a===b)
}
function syncIdentityButton(){
 if(!E.identityBtn)return;
 E.identityBtn.disabled=S.saving || !identityFieldsReady();
}`;

let quantidade = codigo.split(bloco).length - 1;

if (quantidade > 1) {
  codigo = codigo.split(bloco).join("");
  const marcador = "function validateIdentity(){";
  const pos = codigo.indexOf(marcador);
  if (pos < 0) throw new Error("Limpeza do checkout: validateIdentity não encontrada.");
  codigo = codigo.slice(0, pos) + bloco + "\n" + codigo.slice(pos);
  console.log(`Limpeza do checkout: ${quantidade} cópias reduzidas para 1.`);
} else {
  console.log("Limpeza do checkout: helpers sem duplicação.");
}

if (codigo !== original) {
  fs.writeFileSync(arquivo, codigo, "utf8");
}
