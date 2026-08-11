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

/*
  Catálogo e confirmação do cliente não dependem um do outro.
  Rodar em paralelo evita somar duas esperas antes de liberar o checkout.
*/
const sequentialInit = `  completarContextoPelaColecao()\n    .then(()=>hydrateReturningCustomer())\n    .catch(error => console.error(\"Falha ao preparar contexto do checkout:\", error?.message || error))\n    .finally(() => {\n      contextReady=true;\n      checkoutUiReady=true;\n      sendInit(true);\n    });`;

const parallelInit = `  Promise.allSettled([\n    completarContextoPelaColecao(),\n    hydrateReturningCustomer()\n  ])\n    .finally(() => {\n      contextReady=true;\n      checkoutUiReady=true;\n      sendInit(true);\n    });`;

if (text.includes(sequentialInit)) {
  text = text.replace(sequentialInit, parallelInit);
}

fs.writeFileSync(path, text);

// ======================================================
// CUSTOM ELEMENT: largura responsiva + altura retrátil + carregamento rápido
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

const width100 = `    // A largura externa pertence ao elemento desenhado no Wix.\n    // O checkout apenas ocupa 100% desse espaço, inclusive no mobile.\n    this.style.width = \"100%\";\n    this.style.maxWidth = \"100%\";`;

const widthOld = `    this.style.width = \"min(1000px, calc(100vw - 24px))\";\n    this.style.maxWidth = \"1000px\";`;

const widthResponsive = `    /*\n      Desktop volta ao comportamento que já estava aprovado.\n      No mobile, o Wix pode manter um slot estreito: expandimos o checkout\n      até quase toda a viewport e compensamos metade da diferença para\n      continuar centralizado no mesmo eixo do elemento desenhado no Editor.\n    */\n    if (window.innerWidth <= 680) {\n      const slotWidth = this.getBoundingClientRect().width || this.offsetWidth || 0;\n      const targetWidth = Math.max(280, window.innerWidth - 8);\n      this.style.width = \`\${targetWidth}px\`;\n      this.style.maxWidth = \`\${targetWidth}px\`;\n      this.style.marginLeft = slotWidth > 0\n        ? \`\${Math.round((slotWidth - targetWidth) / 2)}px\`\n        : \"0\";\n    } else {\n      this.style.width = \"min(1000px, calc(100vw - 24px))\";\n      this.style.maxWidth = \"1000px\";\n      this.style.marginLeft = \"0\";\n    }`;

if (custom.includes(width100)) {
  custom = custom.replace(width100, widthResponsive);
} else if (custom.includes(widthOld)) {
  custom = custom.replace(widthOld, widthResponsive);
} else if (!custom.includes("const targetWidth = Math.max(280, window.innerWidth - 8)")) {
  throw new Error("Regra de largura do Custom Element não encontrada.");
}

/* QRCode não pode bloquear a primeira pintura do checkout. */
custom = custom.replace(
  '<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>',
  '<script defer src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>'
);

/* O checkout deixa de ficar invisível enquanto aguarda consultas de backend. */
custom = custom.replace(
  'body{padding:7px;visibility:hidden}',
  'body{padding:7px}'
);

/*
  Mobile Pix: depois de escolher Pix, o Cartão desce para depois do bloco
  do QR / Aguardando Pix. Os demais métodos continuam abaixo dele.
*/
const oldMobilePixOrder = `function mobilePixOrder(){\n if(window.innerWidth>680)return;\n E.topGrid.classList.add(\"pix-selected\");\n [E.google,E.pixAuto,E.apple,E.paypal,E.notice].forEach(function(node){E.deferred.appendChild(node)});\n E.deferred.classList.add(\"active\");\n}`;

const newMobilePixOrder = `function mobilePixOrder(){\n if(window.innerWidth>680)return;\n E.topGrid.classList.add(\"pix-selected\");\n [E.card,E.google,E.pixAuto,E.apple,E.paypal,E.notice].forEach(function(node){E.deferred.appendChild(node)});\n E.deferred.classList.add(\"active\");\n}`;

if (custom.includes(oldMobilePixOrder)) {
  custom = custom.replace(oldMobilePixOrder, newMobilePixOrder);
}

const oldRestoreDesktop = ` E.left.appendChild(E.google);E.center.appendChild(E.pixAuto);E.center.appendChild(E.apple);E.center.appendChild(E.paypal);E.topGrid.appendChild(E.notice);`;
const newRestoreDesktop = ` E.left.appendChild(E.card);E.left.appendChild(E.google);E.center.appendChild(E.pixAuto);E.center.appendChild(E.apple);E.center.appendChild(E.paypal);E.topGrid.appendChild(E.notice);`;

if (custom.includes(oldRestoreDesktop)) {
  custom = custom.replace(oldRestoreDesktop, newRestoreDesktop);
}

custom = custom
  .replace('post({type:"READY",version:"HTML29_CUSTOM_ELEMENT_HOST"});', 'post({type:"READY",version:"HTML31_LAUNCH_READY"});')
  .replace('post({type:"READY",version:"HTML30_DYNAMIC_SIZE"});', 'post({type:"READY",version:"HTML31_LAUNCH_READY"});');

fs.writeFileSync(customPath, custom);

console.log("Checkout atualizado para lançamento: desktop restaurado, mobile mais largo/centralizado, carregamento destravado, altura retrátil e cartão abaixo do Pix no mobile.");
