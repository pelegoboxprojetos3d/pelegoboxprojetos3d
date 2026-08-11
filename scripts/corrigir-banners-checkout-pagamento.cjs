const fs = require("fs");

const path = "src/pages/checkout-projeto-pronto.i9aj1.js";
let text = fs.readFileSync(path, "utf8");

const marker = "function deliveryUrl() {";
const flag = "async function configurarBannersPagamento(tipoProduto)";

if (!text.includes(flag)) {
  if (!text.includes(marker)) {
    throw new Error("Ponto de inserção dos banners do checkout não encontrado.");
  }

  const block = `const BANNERS_PAGAMENTO = {\n  medidas: \"#botao1baixarmedidas\",\n  graficos: \"#botao2baixargraficos\",\n  projeto: \"#botao3projetocompleto\",\n  importante: \"#textoimportante\"\n};\n\nasync function alternarBannerPagamento(id, mostrar) {\n  try {\n    const elemento = $w(id);\n\n    if (mostrar) {\n      if (typeof elemento.expand === \"function\") await elemento.expand();\n      if (typeof elemento.show === \"function\") await elemento.show();\n      return;\n    }\n\n    if (typeof elemento.hide === \"function\") await elemento.hide();\n    if (typeof elemento.collapse === \"function\") await elemento.collapse();\n  } catch (error) {\n    console.warn(\`Falha ao alternar banner do pagamento \${id}:\`, error?.message || error);\n  }\n}\n\nasync function configurarBannersPagamento(tipoProduto) {\n  const tipo = safe(tipoProduto || \"MEDIDAS\").toUpperCase();\n\n  /*\n    REGRA OFICIAL DO /checkout-projeto-pronto, igual em desktop e mobile:\n    mostrar somente banners referentes às etapas que ainda faltam pagar.\n\n    Fluxo sequencial:\n    MEDIDAS          -> mostra Medidas + Gráficos + Projeto\n    GRAFICOS         -> mostra Gráficos + Projeto\n    PROJETO_COMPLETO -> mostra somente Projeto\n  */\n  const mostrarMedidas = tipo === \"MEDIDAS\";\n  const mostrarGraficos = tipo === \"MEDIDAS\" || tipo === \"GRAFICOS\";\n  const mostrarProjeto = [\"MEDIDAS\", \"GRAFICOS\", \"PROJETO_COMPLETO\"].includes(tipo);\n\n  await Promise.allSettled([\n    alternarBannerPagamento(BANNERS_PAGAMENTO.medidas, mostrarMedidas),\n    alternarBannerPagamento(BANNERS_PAGAMENTO.graficos, mostrarGraficos),\n    alternarBannerPagamento(BANNERS_PAGAMENTO.projeto, mostrarProjeto),\n    alternarBannerPagamento(BANNERS_PAGAMENTO.importante, true)\n  ]);\n}\n\n`;

  text = text.replace(marker, block + marker);
}

const onReadyMarker = "  ctx=contextFromUrl();\n  const html=$w(HTML_ID);";
const onReadyReplacement = `  ctx=contextFromUrl();\n\n  configurarBannersPagamento(ctx.tipoProduto).catch(error => {\n    console.error(\"Falha ao configurar banners do checkout de pagamento:\", error?.message || error);\n  });\n\n  const html=$w(HTML_ID);`;

if (!text.includes("configurarBannersPagamento(ctx.tipoProduto)")) {
  if (!text.includes(onReadyMarker)) {
    throw new Error("Ponto de inicialização dos banners do checkout não encontrado.");
  }

  text = text.replace(onReadyMarker, onReadyReplacement);
}

fs.writeFileSync(path, text);

// ======================================================
// CUSTOM ELEMENT: largura pelo Wix + altura realmente retrátil
// ======================================================

const customPath = "src/public/custom-elements/pelego-checkout-pronto.js";
let custom = fs.readFileSync(customPath, "utf8");

const oldHeightMeasure = `function checkoutRealHeight(){\n  var body=document.body;\n  var html=document.documentElement;\n  return Math.ceil(Math.max(\n    body ? body.scrollHeight : 0,\n    body ? body.offsetHeight : 0,\n    html ? html.scrollHeight : 0,\n    html ? html.offsetHeight : 0\n  ));\n}`;

const newHeightMeasure = `function checkoutRealHeight(){\n  /*\n    Mede o conteúdo real, não a altura atual do iframe.\n    scrollHeight/offsetHeight do html/body ficam presos na altura maior\n    depois que o iframe cresce e por isso impediam a retração.\n  */\n  var wrap=document.querySelector(\".wrap\");\n  var body=document.body;\n\n  if(wrap){\n    var rect=wrap.getBoundingClientRect();\n    var styles=body ? window.getComputedStyle(body) : null;\n    var paddingTop=styles ? (parseFloat(styles.paddingTop)||0) : 0;\n    var paddingBottom=styles ? (parseFloat(styles.paddingBottom)||0) : 0;\n    return Math.ceil(rect.height + paddingTop + paddingBottom);\n  }\n\n  return Math.ceil(document.documentElement.scrollHeight || 0);\n}`;

if (custom.includes(oldHeightMeasure)) {
  custom = custom.replace(oldHeightMeasure, newHeightMeasure);
} else if (!custom.includes("var wrap=document.querySelector(\".wrap\")")) {
  throw new Error("Medição de altura do Custom Element não encontrada.");
}

const oldWidthRule = `    this.style.width = \"min(1000px, calc(100vw - 24px))\";\n    this.style.maxWidth = \"1000px\";`;
const newWidthRule = `    // A largura externa pertence ao elemento desenhado no Wix.\n    // O checkout apenas ocupa 100% desse espaço, inclusive no mobile.\n    this.style.width = \"100%\";\n    this.style.maxWidth = \"100%\";`;

if (custom.includes(oldWidthRule)) {
  custom = custom.replace(oldWidthRule, newWidthRule);
} else if (!custom.includes('this.style.width = "100%";')) {
  throw new Error("Regra de largura do Custom Element não encontrada.");
}

custom = custom.replace(
  'post({type:"READY",version:"HTML29_CUSTOM_ELEMENT_HOST"});',
  'post({type:"READY",version:"HTML30_DYNAMIC_SIZE"});'
);

fs.writeFileSync(customPath, custom);

console.log("Checkout atualizado: banners preservados, largura segue o Wix e altura cresce/retrai conforme Identificação, Pagamento, Pix e Cartão.");
