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

const oldBoot = `  Promise.allSettled([\n    completarContextoPelaColecao(),\n    hydrateReturningCustomer()\n  ])\n    .finally(() => {\n      contextReady=true;\n      checkoutUiReady=true;\n      sendInit(true);\n    });`;

const newBoot = `  /*\n    FAST BOOT:\n    o checkout visual não espera consultas de coleção/cliente.\n    O contexto da URL + storage é enviado imediatamente e as consultas\n    complementares continuam em paralelo, sem bloquear a renderização.\n  */\n  contextReady=true;\n  sendInit(true);\n\n  completarContextoPelaColecao()\n    .then(() => {\n      /* Se o iframe ainda não ficou pronto, atualiza o INIT pendente. */\n      if (!checkoutUiReady) sendInit(true);\n    })\n    .catch(error => {\n      console.warn(\"Complemento do projeto em segundo plano falhou:\", error?.message || error);\n    });\n\n  hydrateReturningCustomer()\n    .then(() => {\n      /*\n        Cliente recorrente: se a confirmação do backend terminar antes do\n        iframe, substituímos o INIT pendente. Se terminar depois, avançamos\n        diretamente para pagamento sem reconstruir o checkout.\n      */\n      if (!checkoutUiReady) {\n        sendInit(true);\n        return;\n      }\n\n      if (ctx.skipIdentity === true) {\n        post({\n          type:\"CUSTOMER_READY\",\n          ok:true,\n          exists:true,\n          clienteId:safe(customer?._id || customer?.clienteId || ctx.clienteId),\n          nome:ctx.nome,\n          email:ctx.email,\n          cpfCnpj:ctx.cpfCnpj,\n          whatsapp:ctx.whatsapp,\n          whatsappE164:ctx.whatsappE164\n        });\n      }\n    })\n    .catch(error => {\n      console.warn(\"Identificação em segundo plano falhou:\", error?.message || error);\n    });`;

page = replaceOnce(page, oldBoot, newBoot, "Página: fast boot paralelo");
fs.writeFileSync(pagePath, page);

let element = fs.readFileSync(elementPath, "utf8");

element = replaceOnce(
  element,
  `    this._frame = null;\n    this._mounted = false;\n    this._pending = null;\n    this._windowHandler = this._onWindowMessage.bind(this);`,
  `    this._frame = null;\n    this._mounted = false;\n    this._pending = null;\n    this._frameReady = false;\n    this._windowHandler = this._onWindowMessage.bind(this);`,
  "Custom Element: estado de prontidão"
);

element = replaceOnce(
  element,
  `    this._mounted = true;\n    this.style.display = \"block\";`,
  `    this._mounted = true;\n    this._frameReady = false;\n    this.style.display = \"block\";`,
  "Custom Element: reset ao conectar"
);

element = replaceOnce(
  element,
  `  disconnectedCallback() {\n    window.removeEventListener(\"message\", this._windowHandler);\n    this._mounted = false;\n  }`,
  `  disconnectedCallback() {\n    window.removeEventListener(\"message\", this._windowHandler);\n    this._mounted = false;\n    this._frameReady = false;\n  }`,
  "Custom Element: reset ao desconectar"
);

element = replaceOnce(
  element,
  `  sendToCheckout(data) {\n    if (!data || typeof data !== \"object\") return;\n    if (this._frame?.contentWindow) {\n      try { this._frame.contentWindow.postMessage(data, \"*\"); return; }\n      catch (_) {}\n    }\n    this._pending = data;\n  }`,
  `  sendToCheckout(data) {\n    if (!data || typeof data !== \"object\") return;\n\n    /*\n      Não joga INIT dentro do about:blank. Antes isso podia perder a primeira\n      mensagem quando a página era rápida demais. Guardamos o último payload\n      até o HTML interno avisar READY.\n    */\n    if (!this._frameReady) {\n      this._pending = data;\n      return;\n    }\n\n    if (this._frame?.contentWindow) {\n      try { this._frame.contentWindow.postMessage(data, \"*\"); return; }\n      catch (_) {}\n    }\n    this._pending = data;\n  }`,
  "Custom Element: fila segura do INIT"
);

element = replaceOnce(
  element,
  `    const type = String(data.type || data.tipo || data.action || \"\").trim().toUpperCase();\n    if (type === \"CHECKOUT_LAYOUT\") { this._height(data.height); return; }\n    this.dispatchEvent(new CustomEvent(\"checkout-message\", { detail: data, bubbles: true, composed: true }));`,
  `    const type = String(data.type || data.tipo || data.action || \"\").trim().toUpperCase();\n    if (type === \"READY\") {\n      this._frameReady = true;\n      this._flush();\n    }\n    if (type === \"CHECKOUT_LAYOUT\") { this._height(data.height); return; }\n    this.dispatchEvent(new CustomEvent(\"checkout-message\", { detail: data, bubbles: true, composed: true }));`,
  "Custom Element: liberar fila no READY"
);

element = element.replace('post({type:"READY",version:"HTML32_TIGHT_MOBILE"});', 'post({type:"READY",version:"HTML33_FAST_BOOT"});');

fs.writeFileSync(elementPath, element);
console.log("Otimização de inicialização concluída.");
