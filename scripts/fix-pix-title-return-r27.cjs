const fs = require('fs');

const backendPath = 'src/backend/validaPayPixProjetosProntos.jsw';
const checkoutPath = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const principalPath = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';

function mustReplace(text, from, to, label) {
  if (!text.includes(from)) {
    throw new Error(`Marcador não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

// ======================================================
// BACKEND VALIDAPAY: produto/preço real para a fatura
// ======================================================
let backend = fs.readFileSync(backendPath, 'utf8');

backend = mustReplace(
  backend,
  'const SESSIONS = "SessoesProjetosProntos2";\nconst MAKE_SECRET =',
  'const SESSIONS = "SessoesProjetosProntos2";\nconst PRODUCT_TEMPLATE = "PP_VALIDAPAY_R27";\nconst MAKE_SECRET =',
  'PRODUCT_TEMPLATE'
);

backend = mustReplace(
  backend,
  'const SCOPE_CHARGE_WRITE = "checkouts/write";\nconst SCOPE_CHARGE_READ = "pix.cob/read";',
  'const SCOPE_CHARGE_WRITE = "checkouts/write";\nconst SCOPE_CHARGE_READ = "pix.cob/read";\nconst SCOPE_PRODUCTS_READ = "products/read";\nconst SCOPE_PRODUCTS_WRITE = "products/write";',
  'scopes produtos'
);

backend = mustReplace(
  backend,
  '\n\nfunction normalizeType(value) {',
  `\n\nfunction sameMoney(left, right) {\n  return (\n    Math.abs(\n      parseMoney(left) -\n      parseMoney(right)\n    ) <= 0.01\n  );\n}\n\n\nfunction normalizeType(value) {`,
  'sameMoney'
);

backend = mustReplace(
  backend,
  `function scopeForRequest(path, method) {\n  const verb = safe(method).toLowerCase();\n\n  if (\n    verb === "post" &&\n    path === "/v1/charges"\n  ) {\n    return SCOPE_CHARGE_WRITE;\n  }\n\n  return SCOPE_CHARGE_READ;\n}`,
  `function scopeForRequest(path, method) {\n  const verb = safe(method).toLowerCase();\n\n  if (path.startsWith("/v1/products")) {\n    return ["post", "put", "patch", "delete"].includes(verb)\n      ? SCOPE_PRODUCTS_WRITE\n      : SCOPE_PRODUCTS_READ;\n  }\n\n  if (\n    verb === "post" &&\n    path === "/v1/charges"\n  ) {\n    return SCOPE_CHARGE_WRITE;\n  }\n\n  return SCOPE_CHARGE_READ;\n}`,
  'scopeForRequest'
);

const productHelpers = `\n\n// ======================================================\n// PRODUTOS VALIDAPAY\n// ======================================================\n\nfunction productIdFrom(data = {}) {\n  return safe(\n    data?.productId ||\n    data?.id ||\n    data?.product?.productId ||\n    data?.product?.id\n  );\n}\n\nfunction pricesFrom(data = {}) {\n  if (Array.isArray(data?.prices)) {\n    return data.prices;\n  }\n\n  if (Array.isArray(data?.product?.prices)) {\n    return data.product.prices;\n  }\n\n  return [];\n}\n\nfunction priceIdFrom(price = {}) {\n  return safe(\n    price?.priceId ||\n    price?.id\n  );\n}\n\nasync function findReusableProductMapping({\n  projectCode,\n  checkoutCode,\n  type,\n  amount,\n  name\n}) {\n  try {\n    const result = await wixData\n      .query(SESSIONS)\n      .eq("codigoProjeto", safe(projectCode))\n      .eq("tipoProduto", safe(type))\n      .descending("updatedAtDate")\n      .limit(50)\n      .find({\n        ...DB_OPTS,\n        consistentRead: true\n      });\n\n    const expectedCheckout =\n      formatarCodigoCheckout(checkoutCode);\n\n    const expectedName =\n      safe(name).toLowerCase();\n\n    const match = result.items.find((item) => (\n      safe(item?.validaPayProductId) &&\n      safe(item?.validaPayPriceId) &&\n      sameMoney(item?.valor, amount) &&\n      formatarCodigoCheckout(item?.codigoCheckout) === expectedCheckout &&\n      safe(item?.produto).toLowerCase() === expectedName\n    ));\n\n    if (!match) {\n      return null;\n    }\n\n    return {\n      productId: safe(match.validaPayProductId),\n      priceId: safe(match.validaPayPriceId),\n      reused: true\n    };\n  } catch (error) {\n    console.warn(\n      "Mapeamento local de produto ValidaPay não pôde ser reutilizado:",\n      error?.message || error\n    );\n\n    return null;\n  }\n}\n\nasync function createProduct({\n  name,\n  sku,\n  projectCode,\n  checkoutCode,\n  type,\n  amount,\n  image\n}) {\n  const data = await requestValidaPay({\n    path: "/v1/products",\n    method: "post",\n    body: {\n      name,\n      description: stageLabel(type),\n      type: "ONE_TIME",\n      isActive: true,\n      metadata: {\n        origem: "PELEGO_BOX_PROJETOS_PRONTOS",\n        checkoutTemplate: PRODUCT_TEMPLATE,\n        sku,\n        codigoProjeto: projectCode,\n        codigoCheckout: checkoutCode,\n        tipoProduto: type,\n        etapa: stageLabel(type),\n        imagem: image\n      },\n      prices: [\n        {\n          title: stageLabel(type),\n          amount,\n          currency: "BRL",\n          recurrenceType: "ONE_TIME",\n          recurrenceInterval: 1\n        }\n      ]\n    }\n  });\n\n  const productId = productIdFrom(data);\n  const price =\n    pricesFrom(data).find((item) =>\n      sameMoney(item?.amount, amount)\n    ) || pricesFrom(data)[0];\n  const priceId = priceIdFrom(price);\n\n  if (!productId || !priceId) {\n    throw new Error(\n      "A ValidaPay não devolveu productId e priceId."\n    );\n  }\n\n  return {\n    productId,\n    priceId,\n    reused: false\n  };\n}\n\nasync function ensureProduct({\n  session: currentSession,\n  name,\n  sku,\n  projectCode,\n  checkoutCode,\n  type,\n  amount,\n  image\n}) {\n  const savedProductId =\n    safe(currentSession?.validaPayProductId);\n  const savedPriceId =\n    safe(currentSession?.validaPayPriceId);\n\n  if (\n    savedProductId &&\n    savedPriceId &&\n    sameMoney(currentSession?.valor, amount) &&\n    safe(currentSession?.produto).toLowerCase() === safe(name).toLowerCase()\n  ) {\n    return {\n      productId: savedProductId,\n      priceId: savedPriceId,\n      reused: true\n    };\n  }\n\n  const localMapping =\n    await findReusableProductMapping({\n      projectCode,\n      checkoutCode,\n      type,\n      amount,\n      name\n    });\n\n  if (localMapping) {\n    return localMapping;\n  }\n\n  return createProduct({\n    name,\n    sku,\n    projectCode,\n    checkoutCode,\n    type,\n    amount,\n    image\n  });\n}\n`;

backend = mustReplace(
  backend,
  '\n\n// ======================================================\n// COBRANÇAS VALIDAPAY\n// ======================================================\n',
  productHelpers + '\n\n// ======================================================\n// COBRANÇAS VALIDAPAY\n// ======================================================\n',
  'helpers produtos'
);

backend = mustReplace(
  backend,
  `    const now =\n      new Date();\n\n    await upsertSession(`,
  `    const now =\n      new Date();\n\n    /*\n      A documentação da ValidaPay diferencia cobrança avulsa (amount)\n      de cobrança com produto (items + priceId). Tentamos usar um produto\n      ONE_TIME reutilizável para que a fatura leve o título real. Se a\n      criação/mapeamento do produto falhar, o PIX continua disponível como\n      cobrança avulsa em vez de derrubar a venda.\n    */\n    let product = null;\n\n    try {\n      product = await ensureProduct({\n        session: existing,\n        name,\n        sku,\n        projectCode,\n        checkoutCode,\n        type,\n        amount,\n        image\n      });\n    } catch (error) {\n      console.warn(\n        "Produto ValidaPay indisponível; mantendo fallback avulso:",\n        error?.message || error\n      );\n    }\n\n    await upsertSession(`,
  'ensureProduct antes da sessão'
);

backend = mustReplace(
  backend,
  `        validaPayProductId:\n          safe(\n            existing\n              ?.validaPayProductId\n          ),\n\n        validaPayPriceId:\n          safe(\n            existing\n              ?.validaPayPriceId\n          ),`,
  `        validaPayProductId:\n          safe(\n            product?.productId ||\n            existing?.validaPayProductId\n          ),\n\n        validaPayPriceId:\n          safe(\n            product?.priceId ||\n            existing?.validaPayPriceId\n          ),`,
  'persistir productId priceId'
);

backend = mustReplace(
  backend,
  `      },\n      amount,\n\n\n      metadata: {`,
  `      },\n\n      ...(product?.priceId\n        ? {\n          items: [\n            {\n              priceId: product.priceId,\n              quantity: 1\n            }\n          ]\n        }\n        : { amount }),\n\n      metadata: {`,
  'items priceId na cobrança'
);

fs.writeFileSync(backendPath, backend);

// ======================================================
// CHECKOUT: sincronizar tentativa ao voltar / BFCache
// ======================================================
let checkout = fs.readFileSync(checkoutPath, 'utf8');

checkout = mustReplace(
  checkout,
  `function checkoutPixAindaAtivo() {\n  try {\n    return (\n      Boolean(checkoutId) &&\n      safe(\n        session.getItem(\n          ACTIVE_PIX_SESSION_KEY\n        )\n      ) === safe(checkoutId)\n    );\n  } catch (_) {\n    return true;\n  }\n}\n\nfunction normalizarMensagem(raw) {`,
  `function checkoutPixAindaAtivo() {\n  try {\n    return (\n      Boolean(checkoutId) &&\n      safe(\n        session.getItem(\n          ACTIVE_PIX_SESSION_KEY\n        )\n      ) === safe(checkoutId)\n    );\n  } catch (_) {\n    return true;\n  }\n}\n\nfunction sincronizarTentativaComUrl() {\n  const checkoutIdUrl =\n    safe(wixLocation.query?.checkoutId);\n\n  if (\n    !checkoutIdUrl ||\n    checkoutIdUrl === checkoutId\n  ) {\n    return false;\n  }\n\n  pararPollingPix();\n\n  checkoutId = checkoutIdUrl;\n  contexto = contextoDaUrl();\n\n  chargeIdAtual = \"\";\n  pixConteudoEnviado = false;\n  pixPollingInicio = 0;\n  criandoCheckout = false;\n  fluxoAutomaticoIniciado = false;\n  checkoutAutorizado = false;\n  clienteConsultado = null;\n  whatsappConsultado = \"\";\n  acessoPendente = null;\n  initEnviado = false;\n  htmlPronto = false;\n  mensagensPendentes = [];\n\n  marcarCheckoutPixAtivo(checkoutId);\n  return true;\n}\n\nfunction normalizarMensagem(raw) {`,
  'sincronizar tentativa URL'
);

checkout = mustReplace(
  checkout,
  `function liberarHtml() {\n  if (htmlPronto) {\n    return;\n  }`,
  `function liberarHtml() {\n  sincronizarTentativaComUrl();\n\n  if (htmlPronto) {\n    return;\n  }`,
  'liberarHtml sync'
);

checkout = mustReplace(
  checkout,
  `async function abrirPixTransparente(\n  data = {}\n) {\n  if (\n    criandoCheckout ||\n    !checkoutPixAindaAtivo()\n  ) {\n    return;\n  }\n\n  criandoCheckout = true;`,
  `async function abrirPixTransparente(\n  data = {}\n) {\n  sincronizarTentativaComUrl();\n\n  if (criandoCheckout) {\n    return;\n  }\n\n  /*\n    A chave compartilhada serve para encerrar polling antigo, não para\n    impedir a criação da tentativa atual. Em páginas restauradas pelo\n    histórico/BFCache, bloquear aqui podia deixar o HTML eternamente no\n    joguinho sem sequer chamar a ValidaPay.\n  */\n  marcarCheckoutPixAtivo(checkoutId);\n  criandoCheckout = true;`,
  'não bloquear criação por chave antiga'
);

checkout = mustReplace(
  checkout,
  `async function iniciarFluxoAutomatico() {\n  if (\n    fluxoAutomaticoIniciado ||\n    criandoCheckout\n  ) {`,
  `async function iniciarFluxoAutomatico() {\n  sincronizarTentativaComUrl();\n\n  if (\n    fluxoAutomaticoIniciado ||\n    criandoCheckout\n  ) {`,
  'sync fluxo automático'
);

checkout = mustReplace(
  checkout,
  `      const type =\n        safe(\n          data.type ||\n          data.tipo\n        ).toUpperCase();\n\n      switch (type) {`,
  `      const type =\n        safe(\n          data.type ||\n          data.tipo\n        ).toUpperCase();\n\n      sincronizarTentativaComUrl();\n\n      switch (type) {`,
  'sync mensagens HTML'
);

fs.writeFileSync(checkoutPath, checkout);

// ======================================================
// PÁGINA PRINCIPAL: não reconsultar rede ao voltar se cache existe
// ======================================================
let principal = fs.readFileSync(principalPath, 'utf8');

principal = mustReplace(
  principal,
  `function normalizarIdentificacaoSalva(\n  data\n) {`,
  `function lerAcessosLocais(codigoProjeto) {\n  const codigo = onlyDigits(codigoProjeto);\n\n  if (!codigo) {\n    return null;\n  }\n\n  try {\n    const raw = local.getItem(\n      \`pp_acessos_\${codigo}\`\n    );\n\n    if (!raw) {\n      return null;\n    }\n\n    const data = JSON.parse(raw);\n\n    if (!data || typeof data !== \"object\") {\n      return null;\n    }\n\n    return {\n      medidas: data.medidas === true,\n      graficos: data.graficos === true,\n      projeto: data.projeto === true\n    };\n  } catch (_) {\n    return null;\n  }\n}\n\nfunction salvarAcessosLocais(codigoProjeto, access = {}) {\n  const codigo = onlyDigits(codigoProjeto);\n\n  if (!codigo) {\n    return;\n  }\n\n  try {\n    local.setItem(\n      \`pp_acessos_\${codigo}\`,\n      JSON.stringify({\n        medidas: access.medidas === true,\n        graficos: access.graficos === true,\n        projeto: access.projeto === true,\n        atualizadoEm: new Date().toISOString()\n      })\n    );\n  } catch (_) {}\n}\n\nfunction normalizarIdentificacaoSalva(\n  data\n) {`,
  'cache acessos local'
);

principal = mustReplace(
  principal,
  `        capturarDownloads(\n          resultado\n        );\n      }`,
  `        capturarDownloads(\n          resultado\n        );\n\n        salvarAcessosLocais(\n          codigoPublico(projeto),\n          acessos\n        );\n      }`,
  'salvar acessos após consulta'
);

principal = mustReplace(
  principal,
  `    if (confirmacaoAtualValida) {\n      identificado =\n        true;\n\n      identificarCliente(\n        salva\n      ).catch(\n        (\n          error\n        ) => {\n          console.error(\n            "Erro ao restaurar identificação:",\n            error?.message ||\n            error\n          );\n        }\n      );\n\n      return;\n    }`,
  `    if (confirmacaoAtualValida) {\n      const acessosSalvos =\n        lerAcessosLocais(\n          codigoPublico(projeto)\n        );\n\n      if (acessosSalvos) {\n        identificado = true;\n        consultaConcluida = true;\n        acessos = acessosSalvos;\n\n        clienteAtual = {\n          _id: safe(salva.clienteId),\n          clienteId: safe(salva.clienteId),\n          nome: safe(salva.nome),\n          title: safe(salva.nome),\n          email: normalizeEmail(salva.email),\n          cpfCnpj: onlyDigits(salva.cpfCnpj)\n        };\n\n        /*\n          Ao voltar do checkout, a página usa o estado que já foi validado\n          e salvo. Não dispara buscarCliente + obterAcessosProjeto em paralelo\n          com a nova criação de PIX. A validação definitiva continua no\n          checkout/backend antes de cobrar.\n        */\n        capturarDownloads({\n          access: acessos\n        });\n\n        await mostrarValoresEAcessos();\n        return;\n      }\n\n      identificado =\n        true;\n\n      identificarCliente(\n        salva\n      ).catch(\n        (\n          error\n        ) => {\n          console.error(\n            "Erro ao restaurar identificação:",\n            error?.message ||\n            error\n          );\n        }\n      );\n\n      return;\n    }`,
  'restaurar sem rede quando cache existe'
);

fs.writeFileSync(principalPath, principal);

console.log('R27 aplicada com sucesso');
