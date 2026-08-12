const fs = require("fs");

const pagePath = "src/pages/checkout-projeto-pronto.i9aj1.js";
const elementPath = "src/public/custom-elements/pelego-checkout-pronto.js";

function replaceOnce(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count === 0) {
    if (source.includes(newText)) {
      console.log(`${label}: já aplicado.`);
      return source;
    }
    throw new Error(`${label}: trecho original não encontrado.`);
  }
  if (count !== 1) {
    throw new Error(`${label}: esperado 1 trecho, encontrados ${count}.`);
  }
  console.log(`${label}: aplicado.`);
  return source.replace(oldText, newText);
}

let page = fs.readFileSync(pagePath, "utf8");

/*
  CLIENTE RECORRENTE SEM FLASH:
  savedIdentity() já escolhe session e, se necessário, local.
  Portanto a decisão da PRIMEIRA TELA deve usar o objeto recebido por
  sessionIdentityVerified(value), e não voltar a consultar apenas SESSION_KEY.

  Exigimos clienteId + WhatsApp confirmado + identidade completa. Esses dados
  só são gravados pelo fluxo depois de cadastro/identificação. A consulta ao
  backend continua em paralelo para atualizar o contexto, mas não bloqueia a UI.
*/
page = replaceOnce(
  page,
  `  return sessionIdentityCandidate();`,
  `  return Boolean(\n    safe(value?.clienteId) &&\n    value?.whatsappConfirmado === true &&\n    identityComplete(value)\n  );`,
  "Página: reconhecer cliente persistente antes do primeiro INIT"
);

fs.writeFileSync(pagePath, page);

let element = fs.readFileSync(elementPath, "utf8");
if (element.includes('post({type:"READY",version:"HTML34_RETURNING_NO_FLASH"});')) {
  element = element.replace(
    'post({type:"READY",version:"HTML34_RETURNING_NO_FLASH"});',
    'post({type:"READY",version:"HTML35_PERSISTENT_FAST_RETURN"});'
  );
  console.log("Custom Element: versão HTML35 aplicada.");
} else if (element.includes('post({type:"READY",version:"HTML35_PERSISTENT_FAST_RETURN"});')) {
  console.log("Custom Element: versão HTML35 já aplicada.");
} else {
  throw new Error("Custom Element: versão HTML34/HTML35 não encontrada.");
}

fs.writeFileSync(elementPath, element);
console.log("Correção de cliente recorrente concluída.");
