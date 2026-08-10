const fs = require('fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, value) {
  fs.writeFileSync(path, value, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function replaceOnce(text, search, replacement, label) {
  if (text.includes(replacement)) {
    return text;
  }

  const count = text.split(search).length - 1;
  assert(count === 1, `${label}: esperado 1 trecho, encontrado ${count}.`);
  return text.replace(search, replacement);
}

function patchMainPage() {
  const path = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
  let s = read(path);

  if (!s.includes('const CONFIRMACAO_FLUXO_VERSAO =')) {
    s = replaceOnce(
      s,
      'const FIRST_WHATSAPP_LOCAL_KEY =\n  "pp_whatsapp_primeiro_estagio_persistente";\n\nconst MANUTENCAO_ATIVA =',
      'const FIRST_WHATSAPP_LOCAL_KEY =\n  "pp_whatsapp_primeiro_estagio_persistente";\n\nconst CONFIRMACAO_FLUXO_VERSAO =\n  3;\n\nconst CHECKOUT_AUTH_KEY =\n  "pp_checkout_autorizado";\n\nconst MANUTENCAO_ATIVA =',
      'MAIN: constantes de confirmação'
    );
  }

  if (!s.includes('confirmacaoWhatsappVersao: 0,')) {
    s = replaceOnce(
      s,
      '  clienteId: "",\n  nome: "",\n  email: ""\n};',
      '  clienteId: "",\n  nome: "",\n  email: "",\n  cpfCnpj: "",\n  whatsappConfirmado: false,\n  confirmacaoWhatsappVersao: 0,\n  confirmadoEm: ""\n};',
      'MAIN: estado inicial'
    );
  }

  if (!s.includes('confirmacaoWhatsappVersao:\n      Number(')) {
    s = replaceOnce(
      s,
      '    email:\n      normalizeEmail(\n        data.email\n      )\n  };',
      '    email:\n      normalizeEmail(\n        data.email\n      ),\n\n    cpfCnpj:\n      onlyDigits(\n        data.cpfCnpj ||\n        data.cpf ||\n        data.cnpj ||\n        ""\n      ),\n\n    whatsappConfirmado:\n      data.whatsappConfirmado === true,\n\n    confirmacaoWhatsappVersao:\n      Number(\n        data.confirmacaoWhatsappVersao ||\n        0\n      ),\n\n    confirmadoEm:\n      safe(\n        data.confirmadoEm\n      )\n  };',
      'MAIN: normalizar confirmação persistida'
    );
  }

  if (!s.includes('clienteAtual.documentNumber')) {
    s = replaceOnce(
      s,
      '      identificacao.email =\n        normalizeEmail(\n          clienteAtual.email\n        );\n\n      const resultado =',
      '      identificacao.email =\n        normalizeEmail(\n          clienteAtual.email\n        );\n\n      identificacao.cpfCnpj =\n        onlyDigits(\n          clienteAtual.cpfCnpj ||\n          clienteAtual.cpf ||\n          clienteAtual.documentNumber ||\n          clienteAtual.documento ||\n          clienteAtual.cpfcnpj ||\n          ""\n        );\n\n      const resultado =',
      'MAIN: preencher CPF/CNPJ'
    );
  }

  if (!s.includes('identificacao.confirmacaoWhatsappVersao =\n      0;')) {
    s = replaceOnce(
      s,
      '    await identificarCliente(\n      resultado\n    );',
      '    identificacao.whatsappConfirmado =\n      false;\n\n    identificacao.confirmacaoWhatsappVersao =\n      0;\n\n    identificacao.confirmadoEm =\n      "";\n\n    await identificarCliente(\n      resultado\n    );',
      'MAIN: reiniciar confirmação ao usar popup'
    );
  }

  if (!s.includes('function salvarAutorizacaoCheckout(')) {
    const marker = '// ======================================================\n// URL DO CHECKOUT TRANSPARENTE';
    const block = `function salvarAutorizacaoCheckout(\n  tipoProduto\n) {\n  try {\n    session.setItem(\n      CHECKOUT_AUTH_KEY,\n      JSON.stringify({\n        codigoProjeto:\n          codigoPublico(projeto),\n\n        tipoProduto:\n          safe(tipoProduto)\n            .toUpperCase(),\n\n        clienteId:\n          safe(identificacao.clienteId),\n\n        criadoEm:\n          Date.now()\n      })\n    );\n  } catch (_) {}\n}\n\n`;

    s = replaceOnce(
      s,
      marker,
      block + marker,
      'MAIN: autorização curta do checkout'
    );
  }

  if (!s.includes('salvarAutorizacaoCheckout(\n    tipoProduto\n  );')) {
    s = replaceOnce(
      s,
      '  const destino =\n    montarUrlCheckout(\n      tipoProduto\n    );',
      '  salvarAutorizacaoCheckout(\n    tipoProduto\n  );\n\n  const destino =\n    montarUrlCheckout(\n      tipoProduto\n    );',
      'MAIN: autorizar navegação'
    );
  }

  if (!s.includes('const confirmacaoAtualValida =\n      salva.whatsappConfirmado === true')) {
    const oldBlock = `  if (salva) {\n    identificacao = {\n      ...identificacao,\n      ...salva\n    };\n\n    identificado =\n      true;\n\n    identificarCliente(\n      salva\n    ).catch(\n      (\n        error\n      ) => {\n        console.error(\n          "Erro ao restaurar identificação:",\n          error?.message ||\n          error\n        );\n      }\n    );\n\n    return;\n  }`;

    const newBlock = `  if (salva) {\n    identificacao = {\n      ...identificacao,\n      ...salva\n    };\n\n    const confirmacaoAtualValida =\n      salva.whatsappConfirmado === true &&\n      Number(\n        salva.confirmacaoWhatsappVersao ||\n        0\n      ) === CONFIRMACAO_FLUXO_VERSAO;\n\n    if (confirmacaoAtualValida) {\n      identificado =\n        true;\n\n      identificarCliente(\n        salva\n      ).catch(\n        (\n          error\n        ) => {\n          console.error(\n            "Erro ao restaurar identificação:",\n            error?.message ||\n            error\n          );\n        }\n      );\n\n      return;\n    }\n\n    identificado =\n      false;\n\n    agendarPopupWhatsapp(\n      300\n    );\n\n    return;\n  }`;

    s = replaceOnce(
      s,
      oldBlock,
      newBlock,
      'MAIN: revalidar fluxo antigo uma vez'
    );
  }

  write(path, s);
}

function patchCheckoutPage() {
  const path = 'src/pages/checkout-projeto-pronto.i9aj1.js';
  let s = read(path);

  if (!s.includes('const CONFIRMACAO_FLUXO_VERSAO =')) {
    s = replaceOnce(
      s,
      'const FIRST_WHATSAPP_LOCAL_KEY =\n  "pp_whatsapp_primeiro_estagio_persistente";\n\nconst PIX_RECOVERY_TENTATIVAS =',
      'const FIRST_WHATSAPP_LOCAL_KEY =\n  "pp_whatsapp_primeiro_estagio_persistente";\n\nconst CONFIRMACAO_FLUXO_VERSAO =\n  3;\n\nconst CHECKOUT_AUTH_KEY =\n  "pp_checkout_autorizado";\n\nconst CHECKOUT_AUTH_TTL_MS =\n  120000;\n\nconst PIX_RECOVERY_TENTATIVAS =',
      'CHECKOUT: constantes do fluxo'
    );
  }

  if (!s.includes('whatsappConfirmado:\n      identificacao.whatsappConfirmado ===')) {
    s = replaceOnce(
      s,
      '    cpfCnpj:\n      normalizarCpfCnpj(\n        identificacao.cpfCnpj ||\n        identificacao.cpf ||\n        identificacao.cnpj ||\n        ""\n      ),\n\n    returnUrl:',
      '    cpfCnpj:\n      normalizarCpfCnpj(\n        identificacao.cpfCnpj ||\n        identificacao.cpf ||\n        identificacao.cnpj ||\n        ""\n      ),\n\n    whatsappConfirmado:\n      identificacao.whatsappConfirmado ===\n        true,\n\n    confirmacaoWhatsappVersao:\n      Number(\n        identificacao.confirmacaoWhatsappVersao ||\n        0\n      ),\n\n    confirmadoEm:\n      safe(\n        identificacao.confirmadoEm\n      ),\n\n    returnUrl:',
      'CHECKOUT: carregar confirmação persistida'
    );
  }

  if (!s.includes('function salvarIdentificacaoCheckout(')) {
    const marker = 'function lerWhatsappPrimeiroEstagioDedicado() {';
    const block = `function salvarIdentificacaoCheckout(\n  patch = {}\n) {\n  const atual =\n    lerIdentificacaoSalva();\n\n  const proxima = {\n    ...(atual || {}),\n    ...(patch || {})\n  };\n\n  const numero =\n    normalizarWhatsappBrasil(\n      proxima.whatsappE164 ||\n      proxima.whatsapp\n    );\n\n  if (numero) {\n    proxima.whatsapp =\n      numero;\n\n    proxima.whatsappE164 =\n      \`+55\${numero}\`;\n\n    proxima.ddi =\n      "55";\n\n    proxima.country =\n      "br";\n  }\n\n  const serialized =\n    JSON.stringify(proxima);\n\n  try {\n    session.setItem(\n      SESSION_KEY,\n      serialized\n    );\n  } catch (_) {}\n\n  try {\n    local.setItem(\n      LOCAL_KEY,\n      serialized\n    );\n  } catch (_) {}\n\n  contexto = {\n    ...contexto,\n    ...proxima\n  };\n}\n\nfunction autorizacaoCheckoutValida() {\n  try {\n    const raw =\n      session.getItem(\n        CHECKOUT_AUTH_KEY\n      );\n\n    if (!raw) {\n      return false;\n    }\n\n    const auth =\n      JSON.parse(raw);\n\n    if (\n      !auth ||\n      typeof auth !== "object"\n    ) {\n      return false;\n    }\n\n    const idade =\n      Date.now() -\n      Number(auth.criadoEm || 0);\n\n    if (\n      idade < 0 ||\n      idade > CHECKOUT_AUTH_TTL_MS\n    ) {\n      return false;\n    }\n\n    if (\n      digits(auth.codigoProjeto) !==\n      digits(contexto.codigoProjeto)\n    ) {\n      return false;\n    }\n\n    if (\n      safe(auth.tipoProduto).toUpperCase() !==\n      safe(contexto.tipoProduto).toUpperCase()\n    ) {\n      return false;\n    }\n\n    const authCliente =\n      safe(auth.clienteId);\n\n    const ctxCliente =\n      safe(contexto.clienteId);\n\n    if (\n      authCliente &&\n      ctxCliente &&\n      authCliente !== ctxCliente\n    ) {\n      return false;\n    }\n\n    return true;\n\n  } catch (_) {\n    return false;\n  }\n}\n\nfunction confirmacaoPersistenteValida() {\n  return Boolean(\n    normalizarWhatsappBrasil(\n      contexto.whatsappE164 ||\n      contexto.whatsapp\n    ) &&\n    contexto.whatsappConfirmado === true &&\n    Number(\n      contexto.confirmacaoWhatsappVersao ||\n      0\n    ) === CONFIRMACAO_FLUXO_VERSAO\n  );\n}\n\n`;

    s = replaceOnce(
      s,
      marker,
      block + marker,
      'CHECKOUT: persistência e autorização'
    );
  }

  if (s.includes('const clienteJaIdentificado =')) {
    s = s.replace(
      `  const clienteJaIdentificado =\n    Boolean(\n      safe(\n        contexto.clienteId\n      )\n    );`,
      `  const confirmacaoPersistente =\n    confirmacaoPersistenteValida();`
    );

    s = s.replace(/clienteJaIdentificado/g, 'confirmacaoPersistente');
  }

  if (!s.includes('confirmacaoWhatsappVersao:\n        CONFIRMACAO_FLUXO_VERSAO')) {
    const anchor = `    if (\n      telefone.whatsapp !==\n      whatsappEsperado\n    ) {\n      enviarParaHtml({\n        type:\n          "CUSTOMER_RESULT",\n\n        ok:\n          false,\n\n        exists:\n          false,\n\n        needsName:\n          false,\n\n        needsEmail:\n          false,\n\n        needsCpfCnpj:\n          false,\n\n        needsCustomerData:\n          false,\n\n        error:\n          "O WhatsApp digitado não confere com o informado na primeira etapa."\n      });\n\n      return;\n    }\n\n    const cliente =`;

    const replacement = `    if (\n      telefone.whatsapp !==\n      whatsappEsperado\n    ) {\n      enviarParaHtml({\n        type:\n          "CUSTOMER_RESULT",\n\n        ok:\n          false,\n\n        exists:\n          false,\n\n        needsName:\n          false,\n\n        needsEmail:\n          false,\n\n        needsCpfCnpj:\n          false,\n\n        needsCustomerData:\n          false,\n\n        error:\n          "O WhatsApp digitado não confere com o informado na primeira etapa."\n      });\n\n      return;\n    }\n\n    salvarIdentificacaoCheckout({\n      whatsapp:\n        telefone.whatsapp,\n\n      whatsappE164:\n        telefone.whatsappE164,\n\n      whatsappConfirmado:\n        true,\n\n      confirmacaoWhatsappVersao:\n        CONFIRMACAO_FLUXO_VERSAO,\n\n      confirmadoEm:\n        new Date().toISOString()\n    });\n\n    const emailContexto =\n      validarEmail(\n        contexto.email\n      );\n\n    const documentoContexto =\n      validarCpfCnpj(\n        contexto.cpfCnpj\n      );\n\n    if (\n      autorizacaoCheckoutValida() &&\n      safe(contexto.clienteId) &&\n      safe(contexto.nome) &&\n      emailContexto.ok &&\n      documentoContexto.ok\n    ) {\n      whatsappConsultado =\n        telefone.whatsapp;\n\n      clienteConsultado = {\n        _id:\n          contexto.clienteId,\n\n        clienteId:\n          contexto.clienteId,\n\n        nome:\n          contexto.nome,\n\n        email:\n          emailContexto.email,\n\n        cpfCnpj:\n          documentoContexto.cpfCnpj\n      };\n\n      checkoutAutorizado =\n        true;\n\n      await abrirPixTransparente({\n        clienteId:\n          contexto.clienteId,\n\n        nomeCliente:\n          contexto.nome,\n\n        email:\n          emailContexto.email,\n\n        cpfCnpj:\n          documentoContexto.cpfCnpj,\n\n        whatsapp:\n          telefone.whatsapp,\n\n        whatsappE164:\n          telefone.whatsappE164,\n\n        ddi:\n          telefone.ddi,\n\n        country:\n          telefone.country\n      });\n\n      return;\n    }\n\n    const cliente =`;

    s = replaceOnce(
      s,
      anchor,
      replacement,
      'CHECKOUT: confirmar e iniciar PIX sem segunda consulta'
    );
  }

  if (!s.includes('salvarIdentificacaoCheckout({\n    clienteId,')) {
    const anchor = `  const documentoResult =\n    validarCpfCnpj(\n      cliente.cpfCnpj ||\n      cliente.cpfcnpj ||\n      cliente.Cpfcnpj ||\n      cliente["CPF/CNPJ"] ||\n      contexto.cpfCnpj\n    );\n\n  const access =`;

    const replacement = `  const documentoResult =\n    validarCpfCnpj(\n      cliente.cpfCnpj ||\n      cliente.cpfcnpj ||\n      cliente.Cpfcnpj ||\n      cliente["CPF/CNPJ"] ||\n      contexto.cpfCnpj\n    );\n\n  salvarIdentificacaoCheckout({\n    clienteId,\n    nome:\n      nomeCliente,\n    email:\n      emailResult.ok\n        ? emailResult.email\n        : contexto.email,\n    cpfCnpj:\n      documentoResult.ok\n        ? documentoResult.cpfCnpj\n        : contexto.cpfCnpj,\n    whatsapp:\n      telefone.whatsapp,\n    whatsappE164:\n      telefone.whatsappE164\n  });\n\n  const access =`;

    s = replaceOnce(
      s,
      anchor,
      replacement,
      'CHECKOUT: persistir cliente encontrado'
    );
  }

  const autoStart = s.indexOf('async function iniciarFluxoAutomatico() {');
  const autoEndMarker = '\n\n\n// ======================================================\n// ON READY';
  const autoEnd = s.indexOf(autoEndMarker, autoStart);
  assert(autoStart >= 0 && autoEnd > autoStart, 'CHECKOUT: fluxo automático não encontrado.');
  const currentAuto = s.slice(autoStart, autoEnd);

  if (!currentAuto.includes('autorizacaoCheckoutValida()')) {
    const newAuto = `async function iniciarFluxoAutomatico() {\n  if (\n    fluxoAutomaticoIniciado ||\n    criandoCheckout\n  ) {\n    return;\n  }\n\n  const telefone =\n    dadosTelefone(\n      contexto\n    );\n\n  if (\n    !telefone.whatsapp ||\n    !confirmacaoPersistenteValida()\n  ) {\n    return;\n  }\n\n  fluxoAutomaticoIniciado =\n    true;\n\n  consultandoCliente =\n    true;\n\n  checkoutAutorizado =\n    false;\n\n  try {\n    const emailContexto =\n      validarEmail(\n        contexto.email\n      );\n\n    const documentoContexto =\n      validarCpfCnpj(\n        contexto.cpfCnpj\n      );\n\n    if (\n      autorizacaoCheckoutValida() &&\n      safe(contexto.clienteId) &&\n      safe(contexto.nome) &&\n      emailContexto.ok &&\n      documentoContexto.ok\n    ) {\n      clienteConsultado = {\n        _id:\n          contexto.clienteId,\n        clienteId:\n          contexto.clienteId,\n        nome:\n          contexto.nome,\n        email:\n          emailContexto.email,\n        cpfCnpj:\n          documentoContexto.cpfCnpj\n      };\n\n      whatsappConsultado =\n        telefone.whatsapp;\n\n      checkoutAutorizado =\n        true;\n\n      await abrirPixTransparente({\n        clienteId:\n          contexto.clienteId,\n        nomeCliente:\n          contexto.nome,\n        email:\n          emailContexto.email,\n        cpfCnpj:\n          documentoContexto.cpfCnpj,\n        whatsapp:\n          telefone.whatsapp,\n        whatsappE164:\n          telefone.whatsappE164,\n        ddi:\n          telefone.ddi,\n        country:\n          telefone.country\n      });\n\n      return;\n    }\n\n    const cliente =\n      await comTimeout(\n        buscarCliente(\n          telefone.whatsappE164\n        ),\n\n        7000,\n\n        "A consulta do cliente não respondeu."\n      );\n\n    if (!cliente) {\n      whatsappConsultado =\n        telefone.whatsapp;\n\n      clienteConsultado =\n        null;\n\n      liberarCadastroClienteNovo();\n\n      return;\n    }\n\n    await processarClienteEncontrado(\n      cliente,\n      telefone\n    );\n\n  } catch (error) {\n    console.error(\n      "Erro na identificação automática:",\n      error?.message ||\n      error,\n      error\n    );\n\n    fluxoAutomaticoIniciado =\n      false;\n\n    enviarParaHtml({\n      type:\n        "CUSTOMER_RESULT",\n\n      ok:\n        false,\n\n      exists:\n        false,\n\n      needsName:\n        true,\n\n      needsEmail:\n        true,\n\n      needsCpfCnpj:\n        true,\n\n      needsCustomerData:\n        true,\n\n      lookupFailed:\n        true,\n\n      error:\n        "Não foi possível consultar o cadastro agora. Tente novamente."\n    });\n\n  } finally {\n    consultandoCliente =\n      false;\n  }\n}`;

    s = s.slice(0, autoStart) + newAuto + s.slice(autoEnd);
  }

  if (!s.includes('salvarIdentificacaoCheckout({\n      clienteId,')) {
    const anchor = `    if (!clienteId) {\n      throw new Error(\n        "O cadastro não retornou um ID válido."\n      );\n    }\n\n    const access =\n      await consultarAcessos({`;

    const replacement = `    if (!clienteId) {\n      throw new Error(\n        "O cadastro não retornou um ID válido."\n      );\n    }\n\n    salvarIdentificacaoCheckout({\n      clienteId,\n      nome,\n      email:\n        cliente.email ||\n        emailResult.email,\n      cpfCnpj:\n        documentoResult.cpfCnpj,\n      whatsapp:\n        telefone.whatsapp,\n      whatsappE164:\n        telefone.whatsappE164,\n      whatsappConfirmado:\n        true,\n      confirmacaoWhatsappVersao:\n        CONFIRMACAO_FLUXO_VERSAO,\n      confirmadoEm:\n        new Date().toISOString()\n    });\n\n    const access =\n      autorizacaoCheckoutValida()\n        ? acessoVazio()\n        : await consultarAcessos({`;

    s = replaceOnce(
      s,
      anchor,
      replacement,
      'CHECKOUT: cliente novo sem consulta redundante'
    );
  }

  write(path, s);
}

function patchValidaPay() {
  const path = 'src/backend/validaPayPixProjetosProntos.jsw';
  let s = read(path);

  if (!s.includes('async function findProductReferenceSession(')) {
    const marker = '// ======================================================\n// PRODUTOS VALIDAPAY';
    const block = `async function findProductReferenceSession({\n  projectCode,\n  type,\n  amount\n}) {\n  const codigo =\n    safe(projectCode);\n\n  const candidatos = [\n    codigo\n  ];\n\n  const numero =\n    Number(codigo);\n\n  if (\n    codigo &&\n    Number.isSafeInteger(numero)\n  ) {\n    candidatos.push(numero);\n  }\n\n  for (const codigoValor of candidatos) {\n    try {\n      const result =\n        await wixData\n          .query(SESSIONS)\n          .eq(\n            "codigoProjeto",\n            codigoValor\n          )\n          .descending(\n            "updatedAtDate"\n          )\n          .limit(50)\n          .find(DB_OPTS);\n\n      const match =\n        (result.items || [])\n          .find(\n            (item) =>\n              normalizeType(\n                item?.tipoProduto\n              ) === type &&\n              sameMoney(\n                item?.valor,\n                amount\n              ) &&\n              safe(\n                item?.validaPayProductId\n              ) &&\n              safe(\n                item?.validaPayPriceId\n              )\n          );\n\n      if (match) {\n        return match;\n      }\n\n    } catch (error) {\n      console.warn(\n        "Falha ao procurar referência local do produto ValidaPay:",\n        error?.message || error\n      );\n    }\n  }\n\n  return null;\n}\n\n`;

    s = replaceOnce(
      s,
      marker,
      block + marker,
      'PIX: referência local do produto'
    );
  }

  const ensureStart = s.indexOf('async function ensureProduct({');
  const ensureEnd = s.indexOf('\n\n\n// ======================================================\n// COBRANÇAS VALIDAPAY', ensureStart);
  assert(ensureStart >= 0 && ensureEnd > ensureStart, 'PIX: ensureProduct não encontrado.');
  const ensureCurrent = s.slice(ensureStart, ensureEnd);

  if (!ensureCurrent.includes('session?.validaPayProductId')) {
    throw new Error('PIX: ensureProduct em formato inesperado.');
  }

  if (ensureCurrent.includes('await findReusableProduct(') || ensureCurrent.includes('await fetchProduct(')) {
    const newEnsure = `async function ensureProduct({\n  session,\n  name,\n  sku,\n  projectCode,\n  checkoutCode,\n  type,\n  amount,\n  image\n}) {\n  const savedProductId =\n    safe(\n      session?.validaPayProductId\n    );\n\n  const savedPriceId =\n    safe(\n      session?.validaPayPriceId\n    );\n\n  if (\n    savedProductId &&\n    savedPriceId\n  ) {\n    return {\n      productId:\n        savedProductId,\n\n      priceId:\n        savedPriceId,\n\n      reused:\n        true\n    };\n  }\n\n  return createProduct({\n    name,\n    sku,\n    projectCode,\n    checkoutCode,\n    type,\n    amount,\n    image\n  });\n}`;

    s = s.slice(0, ensureStart) + newEnsure + s.slice(ensureEnd);
  }

  s = s.replace(
    `function extractChargeId(\n  data = {}\n) {\n  return safe(\n    first(\n      data?.chargeId,\n      data?.id,\n      data?.charge?.id,\n      data?.payment?.chargeId,\n      data?.error\n        ?.details\n        ?.chargeId,\n      data?.details\n        ?.chargeId\n    )\n  );\n}`,
    `function extractChargeId(\n  data = {}\n) {\n  return safe(\n    first(\n      data?.chargeId,\n      data?.id,\n      data?.charge?.id,\n      data?.payment?.chargeId,\n      data?.data?.chargeId,\n      data?.data?.id,\n      data?.data?.charge?.id,\n      data?.result?.chargeId,\n      data?.result?.id,\n      data?.result?.charge?.id,\n      data?.error\n        ?.details\n        ?.chargeId,\n      data?.details\n        ?.chargeId\n    )\n  );\n}`
  );

  s = s.replace(
    `function extractEmv(\n  data = {}\n) {\n  return safe(\n    first(\n      data?.pix?.emv,\n      data?.emv,\n      data?.payment\n        ?.pix\n        ?.emv,\n      data?.charge\n        ?.pix\n        ?.emv,\n      data?.pix?.copyPaste,\n      data?.copyPaste\n    )\n  );\n}`,
    `function extractEmv(\n  data = {}\n) {\n  return safe(\n    first(\n      data?.pix?.emv,\n      data?.emv,\n      data?.payment?.pix?.emv,\n      data?.charge?.pix?.emv,\n      data?.data?.pix?.emv,\n      data?.data?.emv,\n      data?.data?.charge?.pix?.emv,\n      data?.result?.pix?.emv,\n      data?.result?.emv,\n      data?.result?.charge?.pix?.emv,\n      data?.pix?.copyPaste,\n      data?.copyPaste,\n      data?.payment?.pix?.copyPaste,\n      data?.charge?.pix?.copyPaste,\n      data?.data?.pix?.copyPaste,\n      data?.data?.copyPaste,\n      data?.result?.pix?.copyPaste,\n      data?.result?.copyPaste,\n      data?.pixCode,\n      data?.data?.pixCode,\n      data?.result?.pixCode,\n      data?.brCode,\n      data?.brcode\n    )\n  );\n}`
  );

  s = s.replace(
    `function extractQrCode(\n  data = {}\n) {\n  return safe(\n    first(\n      data?.pix?.qrCode,\n      data?.qrCode,\n      data?.payment\n        ?.pix\n        ?.qrCode,\n      data?.charge\n        ?.pix\n        ?.qrCode\n    )\n  );\n}`,
    `function extractQrCode(\n  data = {}\n) {\n  return safe(\n    first(\n      data?.pix?.qrCode,\n      data?.qrCode,\n      data?.payment?.pix?.qrCode,\n      data?.charge?.pix?.qrCode,\n      data?.data?.pix?.qrCode,\n      data?.data?.qrCode,\n      data?.result?.pix?.qrCode,\n      data?.result?.qrCode,\n      data?.qr_code,\n      data?.qrcode,\n      data?.qrCodeBase64\n    )\n  );\n}`
  );

  s = s.replace(
    `        const details =\n          await fetchChargeReady(\n            chargeId,\n            2\n          );\n\n        return mergeCharge(\n          merged,\n          {\n            ...details,\n            chargeId\n          }\n        );`,
    `        return {\n          ...merged,\n          chargeId\n        };`
  );

  s = s.replace(
    `        const details =\n          await fetchChargeReady(\n            recoveredId,\n            2\n          );\n\n        return mergeCharge(\n          merged,\n          {\n            ...details,\n\n            chargeId:\n              recoveredId\n          }\n        );`,
    `        return {\n          ...merged,\n          chargeId:\n            recoveredId\n        };`
  );

  if (!s.includes('const productReferenceSession =')) {
    s = replaceOnce(
      s,
      `    const product =\n      await ensureProduct({\n        session:\n          existing,`,
      `    const productReferenceSession =\n      existing?.validaPayProductId &&\n      existing?.validaPayPriceId\n        ? existing\n        : await findProductReferenceSession({\n          projectCode,\n          type,\n          amount\n        });\n\n    const product =\n      await ensureProduct({\n        session:\n          productReferenceSession ||\n          existing,`,
      'PIX: reutilizar produto local'
    );
  }

  s = s.replace(
    `        await fetchChargeReady(\n          existingChargeId\n        );`,
    `        await fetchChargeReady(\n          existingChargeId,\n          1\n        );`
  );

  write(path, s);
}

function patchProcessor() {
  const path = 'src/backend/processarCompraProjetoPronto.js';
  let s = read(path);

  if (!s.includes('const arquivosFaltantes = [];')) {
    const anchor = `  salvo.statusProcessamento =\n    falhas.length\n      ? "PARCIAL"\n      : "PROCESSADO";`;

    const replacement = `  const arquivosFaltantes = [];\n\n  if (\n    tipoProduto === "MEDIDAS" &&\n    !safe(salvo.imagemMedidas)\n  ) {\n    arquivosFaltantes.push({\n      field:\n        "imagemMedidas",\n      error:\n        "A imagem de medidas não foi recebida ou importada."\n    });\n  }\n\n  if (tipoProduto === "GRAFICOS") {\n    [\n      "imagemGrafico1",\n      "imagemGrafico2",\n      "imagemGrafico3",\n      "imagemGrafico4"\n    ].forEach((field) => {\n      if (!safe(salvo[field])) {\n        arquivosFaltantes.push({\n          field,\n          error:\n            \`O arquivo \${field} não foi recebido ou importado.\`\n        });\n      }\n    });\n  }\n\n  if (\n    tipoProduto === "PROJETO_COMPLETO" &&\n    !safe(salvo.arquivoProjeto)\n  ) {\n    arquivosFaltantes.push({\n      field:\n        "arquivoProjeto",\n      error:\n        "O PDF do projeto completo não foi recebido."\n    });\n  }\n\n  if (arquivosFaltantes.length) {\n    falhas.push(\n      ...arquivosFaltantes\n    );\n  }\n\n  salvo.statusProcessamento =\n    falhas.length\n      ? "PARCIAL"\n      : "PROCESSADO";`;

    s = replaceOnce(
      s,
      anchor,
      replacement,
      'PROCESSADOR: só concluir com arquivos presentes'
    );
  }

  write(path, s);
}

patchMainPage();
patchCheckoutPage();
patchValidaPay();
patchProcessor();
console.log('Fluxo final estabilizado.');
