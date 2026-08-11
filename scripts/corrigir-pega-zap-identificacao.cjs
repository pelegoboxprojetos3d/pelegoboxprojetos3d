const fs = require("fs");

const arquivo = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let codigo = fs.readFileSync(arquivo, "utf8");
const original = codigo;

// 1) O Pega Zap oficial confirma usando a versão 4.
// A página principal precisa reconhecer essa confirmação persistida.
codigo = codigo.replace(
  /const CONFIRMACAO_FLUXO_VERSAO =\s*\n\s*3;/,
  "const CONFIRMACAO_FLUXO_VERSAO =\n  4;"
);

// Aceita a versão atual e versões futuras do mesmo fluxo confirmado.
// Assim uma atualização do Pega Zap não faz a página esquecer um WhatsApp já confirmado.
codigo = codigo.replace(
  /Number\(\s*salva\.confirmacaoWhatsappVersao \|\|\s*0\s*\) === CONFIRMACAO_FLUXO_VERSAO;/,
  "Number(\n        salva.confirmacaoWhatsappVersao ||\n        0\n      ) >= CONFIRMACAO_FLUXO_VERSAO;"
);

// 2) Projetos Prontos não pode depender da antiga coluna codigo_checkout
// para abrir a etapa de dados/pagamento.
codigo = codigo.replace(
  /function codigoCheckout\(item\) \{[\s\S]*?\n\}\n\nfunction tituloProjeto/,
  "function tituloProjeto"
);

codigo = codigo.replace(
  /\n\s*const codigoInterno =\s*\n\s*codigoCheckout\(\s*\n\s*projeto\s*\n\s*\);\s*\n/,
  "\n"
);

codigo = codigo.replace(
  /!codigoProjeto \|\|\s*\n\s*!codigoInterno \|\|\s*\n\s*!\(valor > 0\)/,
  "!codigoProjeto ||\n    !(valor > 0)"
);

codigo = codigo.replace(
  /\n\s*codigoCheckout:\s*\n\s*codigoInterno,\s*\n/,
  "\n"
);

codigo = codigo.replace(
  /\n\s*sku:\s*\n\s*`PP-\$\{codigoProjeto\}`,\s*\n/,
  "\n"
);

// Validações para não publicar uma correção pela metade.
if (/const CONFIRMACAO_FLUXO_VERSAO =\s*\n\s*3;/.test(codigo)) {
  throw new Error("A versão antiga 3 do Pega Zap ainda está na página.");
}

if (/function codigoCheckout\(item\)/.test(codigo)) {
  throw new Error("A dependência codigoCheckout ainda está na página principal.");
}

if (/!codigoInterno/.test(codigo) || /codigoCheckout:\s*\n\s*codigoInterno/.test(codigo)) {
  throw new Error("A abertura do checkout ainda depende de codigo_checkout.");
}

if (/sku:\s*\n\s*`PP-\$\{codigoProjeto\}`/.test(codigo)) {
  throw new Error("SKU ainda está sendo enviado pela página principal de Projetos Prontos.");
}

if (codigo !== original) {
  fs.writeFileSync(arquivo, codigo, "utf8");
  console.log("Persistência do Pega Zap e abertura de Baixar Medidas corrigidas.");
} else {
  console.log("Correções do Pega Zap já estavam aplicadas.");
}
