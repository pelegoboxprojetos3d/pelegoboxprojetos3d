const fs = require("fs");

const path = "src/pages/checkout-projeto-pronto.i9aj1.js";
let text = fs.readFileSync(path, "utf8");

const marker = "function deliveryUrl() {";
const flag = "async function configurarBannersPagamento(tipoProduto)";

if (!text.includes(flag)) {
  if (!text.includes(marker)) {
    throw new Error("Ponto de inserção dos banners do checkout não encontrado.");
  }

  const block = `const BANNERS_PAGAMENTO = {\n  medidas: \"#botao1baixarmedidas\",\n  graficos: \"#botao2baixargraficos\",\n  projeto: \"#botao3projetocompleto\",\n  importante: \"#textoimportante\"\n};\n\nasync function alternarBannerPagamento(id, mostrar) {\n  try {\n    const elemento = $w(id);\n\n    if (mostrar) {\n      if (typeof elemento.expand === \"function\") await elemento.expand();\n      if (typeof elemento.show === \"function\") await elemento.show();\n      return;\n    }\n\n    if (typeof elemento.hide === \"function\") await elemento.hide();\n    if (typeof elemento.collapse === \"function\") await elemento.collapse();\n  } catch (error) {\n    console.warn(\`Falha ao alternar banner do pagamento \${id}:\`, error?.message || error);\n  }\n}\n\nasync function configurarBannersPagamento(tipoProduto) {\n  const tipo = safe(tipoProduto || \"MEDIDAS\").toUpperCase();\n  const mostrarMedidas = tipo === \"MEDIDAS\";\n  const mostrarGraficos = tipo === \"MEDIDAS\" || tipo === \"GRAFICOS\";\n  const mostrarProjeto = [\"MEDIDAS\", \"GRAFICOS\", \"PROJETO_COMPLETO\"].includes(tipo);\n\n  await Promise.allSettled([\n    alternarBannerPagamento(BANNERS_PAGAMENTO.medidas, mostrarMedidas),\n    alternarBannerPagamento(BANNERS_PAGAMENTO.graficos, mostrarGraficos),\n    alternarBannerPagamento(BANNERS_PAGAMENTO.projeto, mostrarProjeto),\n    alternarBannerPagamento(BANNERS_PAGAMENTO.importante, true)\n  ]);\n}\n\n`;

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

const sequentialInit = `  completarContextoPelaColecao()\n    .then(()=>hydrateReturningCustomer())\n    .catch(error => console.error(\"Falha ao preparar contexto do checkout:\", error?.message || error))\n    .finally(() => {\n      contextReady=true;\n      checkoutUiReady=true;\n      sendInit(true);\n    });`;
const parallelInit = `  Promise.allSettled([\n    completarContextoPelaColecao(),\n    hydrateReturningCustomer()\n  ])\n    .finally(() => {\n      contextReady=true;\n      checkoutUiReady=true;\n      sendInit(true);\n    });`;
if (text.includes(sequentialInit)) text = text.replace(sequentialInit, parallelInit);

if (!text.includes('let cardRequestBusy = false;')) {
  const vars = 'let busy = false;\nlet chargeId = "";';
  if (!text.includes(vars)) throw new Error("Variáveis de trava do checkout não encontradas.");
  text = text.replace(vars, 'let busy = false;\nlet cardRequestBusy = false;\nlet chargeId = "";');
}

const oldCardStart = `async function createCard(data={}) {\n  if(busy) return post({type:\"CARD_RESULT\",ok:false,error:\"Já existe um pagamento em processamento.\"});\n  busy=true;\n  stopCardPoll();`;
const newCardStart = `async function createCard(data={}) {\n  if(cardRequestBusy) return;\n  if(polling) return post({type:\"CARD_RESULT\",ok:false,approved:false,accepted:false,error:\"Existe um Pix aguardando pagamento nesta tentativa. Volte e gere um novo checkout para pagar com cartão.\"});\n  cardRequestBusy=true;\n  stopCardPoll();`;
if (text.includes(oldCardStart)) text = text.replace(oldCardStart, newCardStart);

const oldCardEnd = `  } catch(e) {\n    post({type:\"CARD_RESULT\",ok:false,approved:false,accepted:false,error:e?.message||\"Não foi possível processar o cartão.\"});\n  } finally { busy=false; }\n}`;
const newCardEnd = `  } catch(e) {\n    post({type:\"CARD_RESULT\",ok:false,approved:false,accepted:false,error:e?.message||\"Não foi possível processar o cartão.\"});\n  } finally { cardRequestBusy=false; }\n}`;
if (text.includes(oldCardEnd)) text = text.replace(oldCardEnd, newCardEnd);

fs.writeFileSync(path, text);

const customPath = "src/public/custom-elements/pelego-checkout-pronto.js";
let custom = fs.readFileSync(customPath, "utf8");

const newHeightMeasure = `function checkoutRealHeight(){\n  var wrap=document.querySelector(\".wrap\");\n  var body=document.body;\n\n  if(wrap){\n    var rect=wrap.getBoundingClientRect();\n    if(rect.height>0){\n      var styles=body ? window.getComputedStyle(body) : null;\n      var paddingTop=styles ? (parseFloat(styles.paddingTop)||0) : 0;\n      var paddingBottom=styles ? (parseFloat(styles.paddingBottom)||0) : 0;\n      return Math.ceil(rect.height + paddingTop + paddingBottom);\n    }\n  }\n\n  var boot=document.getElementById(\"checkoutBoot\");\n  if(boot && !boot.classList.contains(\"hidden\")){\n    return Math.ceil(boot.getBoundingClientRect().height + 12);\n  }\n\n  return Math.ceil(document.documentElement.scrollHeight || 0);\n}`;

const heightFn = /function checkoutRealHeight\(\)\{[\s\S]*?\n\}/;
if (heightFn.test(custom)) custom = custom.replace(heightFn, newHeightMeasure);

const widthResponsiveV1 = `    /*\n      Desktop volta ao comportamento que já estava aprovado.\n      No mobile, o Wix pode manter um slot estreito: expandimos o checkout\n      até quase toda a viewport e compensamos metade da diferença para\n      continuar centralizado no mesmo eixo do elemento desenhado no Editor.\n    */\n    if (window.innerWidth <= 680) {\n      const slotWidth = this.getBoundingClientRect().width || this.offsetWidth || 0;\n      const targetWidth = Math.max(280, window.innerWidth - 8);\n      this.style.width = \`\${targetWidth}px\`;\n      this.style.maxWidth = \`\${targetWidth}px\`;\n      this.style.marginLeft = slotWidth > 0\n        ? \`\${Math.round((slotWidth - targetWidth) / 2)}px\`\n        : \"0\";\n    } else {\n      this.style.width = \"min(1000px, calc(100vw - 24px))\";\n      this.style.maxWidth = \"1000px\";\n      this.style.marginLeft = \"0\";\n    }`;
const widthResponsiveV2 = `    /* Desktop largo; mobile limitado e centralizado. */\n    if (window.innerWidth <= 680) {\n      const slotWidth = this.getBoundingClientRect().width || this.offsetWidth || 300;\n      const targetWidth = Math.min(320, Math.max(290, window.innerWidth - 36));\n      this.style.width = \`\${targetWidth}px\`;\n      this.style.maxWidth = \`\${targetWidth}px\`;\n      this.style.marginLeft = \`\${Math.round((slotWidth - targetWidth) / 2)}px\`;\n    } else {\n      this.style.width = \"min(1000px, calc(100vw - 24px))\";\n      this.style.maxWidth = \"1000px\";\n      this.style.marginLeft = \"0\";\n    }`;
if (custom.includes(widthResponsiveV1)) custom = custom.replace(widthResponsiveV1, widthResponsiveV2);

custom = custom.replace(
  '<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>',
  '<script defer src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>'
);

if (!custom.includes(".checkoutBoot{")) {
  custom = custom.replace(
    "</style>\n</head>",
    `.checkoutBoot{min-height:72px;display:flex;align-items:center;justify-content:center;padding:12px;color:#555;font:600 12px Arial,Helvetica,sans-serif;text-align:center}\n.checkoutBootDot{width:18px;height:18px;margin-right:9px;border:3px solid #dfeee4;border-top-color:#159447;border-radius:50%;animation:checkoutBootSpin .65s linear infinite}\n@keyframes checkoutBootSpin{to{transform:rotate(360deg)}}\n</style>\n</head>`
  );
}

if (!custom.includes('id="checkoutBoot"')) {
  custom = custom.replace(
    '<body>\n<main class="wrap">',
    '<body>\n<div id="checkoutBoot" class="checkoutBoot"><span class="checkoutBootDot"></span><span>Carregando checkout...</span></div>\n<main id="checkoutMain" class="wrap" style="display:none">'
  );
}

const initOld = 'if(type==="INIT"){S.checkoutId=safe(d.checkoutId);hydrate(d.ctx||{});document.body.style.visibility="visible";setStep(1);';
const initNew = 'if(type==="INIT"){S.checkoutId=safe(d.checkoutId);hydrate(d.ctx||{});var boot=$("checkoutBoot"),main=$("checkoutMain");if(boot)boot.classList.add("hidden");if(main)main.style.display="block";document.body.style.visibility="visible";setStep(1);';
if (custom.includes(initOld)) custom = custom.replace(initOld, initNew);

const oldMobilePixOrder = `function mobilePixOrder(){\n if(window.innerWidth>680)return;\n E.topGrid.classList.add(\"pix-selected\");\n [E.google,E.pixAuto,E.apple,E.paypal,E.notice].forEach(function(node){E.deferred.appendChild(node)});\n E.deferred.classList.add(\"active\");\n}`;
const newMobilePixOrder = `function mobilePixOrder(){\n if(window.innerWidth>680)return;\n E.topGrid.classList.add(\"pix-selected\");\n [E.card,E.google,E.pixAuto,E.apple,E.paypal,E.notice].forEach(function(node){E.deferred.appendChild(node)});\n E.deferred.classList.add(\"active\");\n}`;
if (custom.includes(oldMobilePixOrder)) custom = custom.replace(oldMobilePixOrder, newMobilePixOrder);

const oldRestoreDesktop = ` E.left.appendChild(E.google);E.center.appendChild(E.pixAuto);E.center.appendChild(E.apple);E.center.appendChild(E.paypal);E.topGrid.appendChild(E.notice);`;
const newRestoreDesktop = ` E.left.appendChild(E.card);E.left.appendChild(E.google);E.center.appendChild(E.pixAuto);E.center.appendChild(E.apple);E.center.appendChild(E.paypal);E.topGrid.appendChild(E.notice);`;
if (custom.includes(oldRestoreDesktop)) custom = custom.replace(oldRestoreDesktop, newRestoreDesktop);

const heightApplyOld = `    this.style.height = css;\n    if (this._frame) this._frame.style.height = css;`;
const heightApplyNew = `    this.style.height = css;\n    this.style.minHeight = css;\n    this.style.maxHeight = css;\n    if (this._frame) this._frame.style.height = css;\n    requestAnimationFrame(() => {\n      this.style.height = css;\n      this.style.minHeight = css;\n      this.style.maxHeight = css;\n    });`;
if (custom.includes(heightApplyOld)) custom = custom.replace(heightApplyOld, heightApplyNew);
custom = custom.replace('this.style.transition = "height 160ms ease";', 'this.style.transition = "none";');

custom = custom
  .replace('post({type:"READY",version:"HTML29_CUSTOM_ELEMENT_HOST"});', 'post({type:"READY",version:"HTML32_TIGHT_MOBILE"});')
  .replace('post({type:"READY",version:"HTML30_DYNAMIC_SIZE"});', 'post({type:"READY",version:"HTML32_TIGHT_MOBILE"});')
  .replace('post({type:"READY",version:"HTML31_LAUNCH_READY"});', 'post({type:"READY",version:"HTML32_TIGHT_MOBILE"});');

fs.writeFileSync(customPath, custom);
console.log("Checkout ajustado: mobile limitado e centralizado, flash inicial eliminado, retração instantânea, ordem Pix/Cartão preservada e trava do cartão mantida.");
