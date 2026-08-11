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
console.log("Checkout de pagamento atualizado: somente banners de etapas ainda não pagas ficam visíveis em desktop e mobile.");
