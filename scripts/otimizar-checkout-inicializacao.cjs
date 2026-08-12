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

if (!page.includes('const VERIFIED_SESSION_KEY = "pp_checkout_cliente_validado_sessao";')) {
  page = replaceOnce(
    page,
    `const SESSION_KEY = "pp_identificacao_atual";\nconst LOCAL_KEY = "pp_identificacao_persistente";`,
    `const SESSION_KEY = "pp_identificacao_atual";\nconst LOCAL_KEY = "pp_identificacao_persistente";\nconst VERIFIED_SESSION_KEY = "pp_checkout_cliente_validado_sessao";`,
    "Página: chave de cliente validado na sessão"
  );
} else {
  console.log("Página: chave de cliente validado na sessão: já aplicada.");
}

page = replaceOnce(
  page,
  `function identityComplete(value = ctx) {\n  return Boolean(\n    phone(value?.whatsappE164 || value?.whatsapp) &&\n    safe(value?.nome || value?.nomeCliente).replace(/\\s+/g," ").length >= 3 &&\n    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(email(value?.email)) &&\n    validCpf(value?.cpfCnpj || value?.cpf)\n  );\n}\n\nasync function hydrateReturningCustomer() {`,
  `function identityComplete(value = ctx) {\n  return Boolean(\n    phone(value?.whatsappE164 || value?.whatsapp) &&\n    safe(value?.nome || value?.nomeCliente).replace(/\\s+/g," ").length >= 3 &&\n    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(email(value?.email)) &&\n    validCpf(value?.cpfCnpj || value?.cpf)\n  );\n}\n\nfunction sessionIdentityCandidate() {\n  try {\n    const raw = session.getItem(SESSION_KEY);\n    if (!raw) return false;\n    const value = JSON.parse(raw);\n    if (!value || typeof value !== "object") return false;\n    return Boolean(\n      safe(value.clienteId) &&\n      value.whatsappConfirmado === true &&\n      identityComplete(value)\n    );\n  } catch (_) {\n    return false;\n  }\n}\n\nfunction sessionIdentityVerified(value = ctx) {\n  const n = phone(value?.whatsappE164 || value?.whatsapp);\n  if (!n || !identityComplete(value)) return false;\n\n  try {\n    const raw = session.getItem(VERIFIED_SESSION_KEY);\n    if (raw) {\n      const marker = JSON.parse(raw);\n      if (marker?.ok === true && phone(marker.whatsapp) === n) return true;\n    }\n  } catch (_) {}\n\n  /*\n    Compatibilidade com clientes já validados antes deste hotfix:\n    a sessão atual já contém clienteId + dados completos + WhatsApp confirmado.\n    Isso só decide a tela inicial; autorização de pagamento continua no backend.\n  */\n  return sessionIdentityCandidate();\n}\n\nfunction markSessionIdentityVerified(value = ctx) {\n  const n = phone(value?.whatsappE164 || value?.whatsapp);\n  if (!n || !identityComplete(value)) return;\n\n  try {\n    session.setItem(\n      VERIFIED_SESSION_KEY,\n      JSON.stringify({\n        ok:true,\n        whatsapp:n,\n        clienteId:safe(value?.clienteId),\n        verifiedAt:Date.now()\n      })\n    );\n  } catch (_) {}\n}\n\nasync function hydrateReturningCustomer() {`,
  "Página: memória segura de cliente recorrente"
);

page = replaceOnce(
  page,
  `async function hydrateReturningCustomer() {\n  const n = phone(ctx.whatsappE164 || ctx.whatsapp);\n  if (!n) {\n    ctx.skipIdentity = false;\n    return;\n  }\n\n  /*\n    Segurança da primeira compra:\n    dados completos existentes apenas no storage do navegador não autorizam\n    pular Nome/CPF/e-mail. O pulo só acontece depois de confirmar um cadastro\n    completo recuperado pelo backend para este WhatsApp.\n  */\n  ctx.skipIdentity = false;\n\n  try {\n    const found = await waitTimeout(buscarClienteCadastrado(n), 3500, "");\n    if (!found) return;\n\n    customer = found;\n    const id = safe(found._id || found.clienteId);\n    const cadastroBackend = {\n      whatsapp:n,\n      whatsappE164:\`+55\${n}\`,\n      nome:safe(found.nome || found.nomeCliente),\n      email:email(found.email),\n      cpfCnpj:cpf(found.cpfCnpj || found.cpf)\n    };\n\n    if (!identityComplete(cadastroBackend)) return;\n\n    saveIdentity({\n      clienteId:id,\n      nome:cadastroBackend.nome,\n      email:cadastroBackend.email,\n      cpfCnpj:cadastroBackend.cpfCnpj,\n      whatsapp:n,\n      whatsappE164:\`+55\${n}\`,\n      whatsappConfirmado:true\n    });\n    ctx.skipIdentity = true;\n  } catch (_) {\n    ctx.skipIdentity = false;\n  }\n}`,
  `async function hydrateReturningCustomer() {\n  const n = phone(ctx.whatsappE164 || ctx.whatsapp);\n  if (!n) {\n    ctx.skipIdentity = false;\n    return;\n  }\n\n  const alreadyVerifiedThisSession = sessionIdentityVerified(ctx);\n\n  /*\n    Cliente já confirmado nesta sessão entra direto no pagamento.\n    A consulta ao backend continua acontecendo, mas não faz a etapa de\n    identificação piscar antes de mostrar as formas de pagamento.\n  */\n  ctx.skipIdentity = alreadyVerifiedThisSession;\n\n  try {\n    const found = await waitTimeout(buscarClienteCadastrado(n), 3500, "");\n    if (!found) return;\n\n    customer = found;\n    const id = safe(found._id || found.clienteId);\n    const cadastroBackend = {\n      whatsapp:n,\n      whatsappE164:\`+55\${n}\`,\n      nome:safe(found.nome || found.nomeCliente),\n      email:email(found.email),\n      cpfCnpj:cpf(found.cpfCnpj || found.cpf)\n    };\n\n    if (!identityComplete(cadastroBackend)) return;\n\n    saveIdentity({\n      clienteId:id,\n      nome:cadastroBackend.nome,\n      email:cadastroBackend.email,\n      cpfCnpj:cadastroBackend.cpfCnpj,\n      whatsapp:n,\n      whatsappE164:\`+55\${n}\`,\n      whatsappConfirmado:true\n    });\n    ctx.skipIdentity = true;\n    markSessionIdentityVerified(ctx);\n  } catch (_) {\n    if (!alreadyVerifiedThisSession) ctx.skipIdentity = false;\n  }\n}`,
  "Página: não piscar identificação do cliente recorrente"
);

page = replaceOnce(
  page,
  `  const q=wixLocation.query || {};\n  const s=savedIdentity();\n  const project=digits(q.codigoProjeto || q.ordemVideo || q.codigo);`,
  `  const q=wixLocation.query || {};\n  const s=savedIdentity();\n  const verifiedSession=sessionIdentityVerified(s);\n  const project=digits(q.codigoProjeto || q.ordemVideo || q.codigo);`,
  "Página: detectar cliente validado antes do INIT"
);

page = replaceOnce(
  page,
  `    whatsappConfirmado:s.whatsappConfirmado === true,\n    hideSku:true,`,
  `    whatsappConfirmado:s.whatsappConfirmado === true,\n    skipIdentity:verifiedSession,\n    hideSku:true,`,
  "Página: INIT direto no pagamento"
);

page = replaceOnce(
  page,
  `    saveIdentity({\n      clienteId:id, nome:safe(customer.nome || name), email:email(customer.email || mail),\n      cpfCnpj:cpf(customer.cpfCnpj || document), whatsapp:n, whatsappE164:\`+55\${n}\`,\n      whatsappConfirmado:true\n    });\n\n    try {`,
  `    saveIdentity({\n      clienteId:id, nome:safe(customer.nome || name), email:email(customer.email || mail),\n      cpfCnpj:cpf(customer.cpfCnpj || document), whatsapp:n, whatsappE164:\`+55\${n}\`,\n      whatsappConfirmado:true\n    });\n    markSessionIdentityVerified(ctx);\n\n    try {`,
  "Página: marcar cadastro confirmado na sessão"
);

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
  `    this._mounted = true;\n    this.style.display = "block";`,
  `    this._mounted = true;\n    this._frameReady = false;\n    this.style.display = "block";`,
  "Custom Element: reset ao conectar"
);

element = replaceOnce(
  element,
  `  disconnectedCallback() {\n    window.removeEventListener("message", this._windowHandler);\n    this._mounted = false;\n  }`,
  `  disconnectedCallback() {\n    window.removeEventListener("message", this._windowHandler);\n    this._mounted = false;\n    this._frameReady = false;\n  }`,
  "Custom Element: reset ao desconectar"
);

element = replaceOnce(
  element,
  `  sendToCheckout(data) {\n    if (!data || typeof data !== "object") return;\n    if (this._frame?.contentWindow) {\n      try { this._frame.contentWindow.postMessage(data, "*"); return; }\n      catch (_) {}\n    }\n    this._pending = data;\n  }`,
  `  sendToCheckout(data) {\n    if (!data || typeof data !== "object") return;\n\n    /*\n      Não joga INIT dentro do about:blank. Antes isso podia perder a primeira\n      mensagem quando a página era rápida demais. Guardamos o último payload\n      até o HTML interno avisar READY.\n    */\n    if (!this._frameReady) {\n      this._pending = data;\n      return;\n    }\n\n    if (this._frame?.contentWindow) {\n      try { this._frame.contentWindow.postMessage(data, "*"); return; }\n      catch (_) {}\n    }\n    this._pending = data;\n  }`,
  "Custom Element: fila segura do INIT"
);

element = replaceOnce(
  element,
  `    const type = String(data.type || data.tipo || data.action || "").trim().toUpperCase();\n    if (type === "CHECKOUT_LAYOUT") { this._height(data.height); return; }\n    this.dispatchEvent(new CustomEvent("checkout-message", { detail: data, bubbles: true, composed: true }));`,
  `    const type = String(data.type || data.tipo || data.action || "").trim().toUpperCase();\n    if (type === "READY") {\n      this._frameReady = true;\n      this._flush();\n    }\n    if (type === "CHECKOUT_LAYOUT") { this._height(data.height); return; }\n    this.dispatchEvent(new CustomEvent("checkout-message", { detail: data, bubbles: true, composed: true }));`,
  "Custom Element: liberar fila no READY"
);

element = element.replace('post({type:"READY",version:"HTML32_TIGHT_MOBILE"});', 'post({type:"READY",version:"HTML33_FAST_BOOT"});');
element = element.replace('post({type:"READY",version:"HTML33_FAST_BOOT"});', 'post({type:"READY",version:"HTML34_RETURNING_NO_FLASH"});');

fs.writeFileSync(elementPath, element);
console.log("Otimização de inicialização concluída.");
