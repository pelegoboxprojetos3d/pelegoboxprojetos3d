const fs = require('fs');

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value, 'utf8'); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function replaceOnce(text, search, replacement, label) {
  if (text.includes(replacement)) return text;
  const count = text.split(search).length - 1;
  assert(count === 1, `${label}: esperado 1 trecho, encontrado ${count}.`);
  return text.replace(search, replacement);
}

function patchMainPage() {
  const path = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
  let s = read(path);

  if (!s.includes('FIRST_WHATSAPP_SESSION_KEY')) {
    s = replaceOnce(
      s,
      'const LOCAL_KEY =\n  "pp_identificacao_persistente";\n',
      'const LOCAL_KEY =\n  "pp_identificacao_persistente";\n\nconst FIRST_WHATSAPP_SESSION_KEY =\n  "pp_whatsapp_primeiro_estagio";\n\nconst FIRST_WHATSAPP_LOCAL_KEY =\n  "pp_whatsapp_primeiro_estagio_persistente";\n',
      'MAIN: chaves do primeiro WhatsApp'
    );
  }

  if (!s.includes('confirmacaoWhatsappVersao: 0,')) {
    s = replaceOnce(
      s,
      '  clienteId: "",\n  nome: "",\n  email: ""\n};',
      '  clienteId: "",\n  nome: "",\n  email: "",\n  cpfCnpj: "",\n  whatsappConfirmado: false,\n  confirmacaoWhatsappVersao: 0,\n  confirmadoEm: ""\n};',
      'MAIN: estado da confirmação'
    );
  }

  if (!s.includes('confirmacaoWhatsappVersao:\n      Number(')) {
    s = replaceOnce(
      s,
      '    email:\n      normalizeEmail(\n        data.email\n      )\n  };',
      '    email:\n      normalizeEmail(\n        data.email\n      ),\n\n    cpfCnpj:\n      onlyDigits(\n        data.cpfCnpj ||\n        data.cpf ||\n        data.cnpj ||\n        ""\n      ),\n\n    whatsappConfirmado:\n      data.whatsappConfirmado === true,\n\n    confirmacaoWhatsappVersao:\n      Number(\n        data.confirmacaoWhatsappVersao ||\n        0\n      ),\n\n    confirmadoEm:\n      safe(\n        data.confirmadoEm\n      )\n  };',
      'MAIN: preservar confirmação salva'
    );
  }

  if (!s.includes('function salvarWhatsappPrimeiroEstagio(')) {
    const block = `function salvarWhatsappPrimeiroEstagio(value) {\n  const numero =\n    normalizarTelefone({\n      whatsapp: value,\n      ddi: "55"\n    }).whatsapp;\n\n  if (!/^\\d{10,11}$/.test(numero)) {\n    return;\n  }\n\n  try {\n    session.setItem(\n      FIRST_WHATSAPP_SESSION_KEY,\n      numero\n    );\n  } catch (_) {}\n\n  try {\n    local.setItem(\n      FIRST_WHATSAPP_LOCAL_KEY,\n      numero\n    );\n  } catch (_) {}\n}\n\n`;

    s = replaceOnce(
      s,
      'function salvarIdentificacao() {\n',
      block + 'function salvarIdentificacao() {\n  salvarWhatsappPrimeiroEstagio(\n    identificacao.whatsappE164 ||\n    identificacao.whatsapp\n  );\n\n',
      'MAIN: persistir primeiro WhatsApp'
    );
  }

  if (!s.includes('const confirmacaoMantida =')) {
    s = replaceOnce(
      s,
      '  cancelarPopupAgendado();\n\n  identificacao = {',
      '  cancelarPopupAgendado();\n\n  const telefoneAnterior =\n    normalizarTelefone(\n      identificacao\n    ).whatsapp;\n\n  const confirmacaoMantida =\n    identificacao.whatsappConfirmado === true &&\n    Number(\n      identificacao.confirmacaoWhatsappVersao ||\n      0\n    ) === 2 &&\n    telefoneAnterior ===\n      telefone.whatsapp;\n\n  identificacao = {',
      'MAIN: validar confirmação existente'
    );

    s = replaceOnce(
      s,
      '    countryName:\n      safe(\n        data.countryName\n      ) ||\n      identificacao.countryName ||\n      "Brasil"\n  };',
      '    countryName:\n      safe(\n        data.countryName\n      ) ||\n      identificacao.countryName ||\n      "Brasil",\n\n    whatsappConfirmado:\n      confirmacaoMantida,\n\n    confirmacaoWhatsappVersao:\n      confirmacaoMantida\n        ? 2\n        : 0,\n\n    confirmadoEm:\n      confirmacaoMantida\n        ? safe(identificacao.confirmadoEm)\n        : ""\n  };',
      'MAIN: resetar confirmação quando necessário'
    );
  }

  s = s.replace(
    /\n\s*identificacao\.whatsappConfirmado =\s*\n\s*true;\s*\n\s*identificacao\.confirmadoEm =\s*\n\s*identificacao\.confirmadoEm \|\|\s*\n\s*new Date\(\)\.toISOString\(\);/,
    ''
  );

  write(path, s);
}

function patchCheckoutPage() {
  const path = 'src/pages/checkout-projeto-pronto.i9aj1.js';
  let s = read(path);

  s = s.replace('const PIX_POLL_INTERVALO_RAPIDO = 750;', 'const PIX_POLL_INTERVALO_RAPIDO = 600;');
  s = s.replace('const PIX_PRE_QR_LIMITE_MS = 18000;', 'const PIX_PRE_QR_LIMITE_MS = 12000;');
  s = s.replace('const PIX_CRIACAO_TIMEOUT = 6000;', 'const PIX_CRIACAO_TIMEOUT = 5000;');
  s = s.replace('const PIX_CONSULTA_TIMEOUT = 3000;', 'const PIX_CONSULTA_TIMEOUT = 2500;');

  if (!s.includes('const CONFIRMACAO_WHATSAPP_VERSAO =')) {
    s = replaceOnce(
      s,
      'const FIRST_WHATSAPP_LOCAL_KEY =\n  "pp_whatsapp_primeiro_estagio_persistente";\n',
      'const FIRST_WHATSAPP_LOCAL_KEY =\n  "pp_whatsapp_primeiro_estagio_persistente";\n\nconst CONFIRMACAO_WHATSAPP_VERSAO =\n  2;\n',
      'CHECKOUT: versão da confirmação'
    );
  }

  if (!s.includes('whatsappConfirmado:\n      identificacao.whatsappConfirmado')) {
    s = replaceOnce(
      s,
      '    cpfCnpj:\n      normalizarCpfCnpj(\n        identificacao.cpfCnpj ||\n        identificacao.cpf ||\n        identificacao.cnpj ||\n        ""\n      ),\n\n    returnUrl:',
      '    cpfCnpj:\n      normalizarCpfCnpj(\n        identificacao.cpfCnpj ||\n        identificacao.cpf ||\n        identificacao.cnpj ||\n        ""\n      ),\n\n    whatsappConfirmado:\n      identificacao.whatsappConfirmado ===\n        true,\n\n    confirmacaoWhatsappVersao:\n      Number(\n        identificacao.confirmacaoWhatsappVersao ||\n        0\n      ),\n\n    confirmadoEm:\n      safe(\n        identificacao.confirmadoEm\n      ),\n\n    returnUrl:',
      'CHECKOUT: carregar confirmação persistente'
    );
  }

  if (!s.includes('function confirmacaoWhatsappPersistenteValida()')) {
    const marker = '// ======================================================\n// COMUNICAÇÃO COM O HTML';
    const block = `function confirmacaoWhatsappPersistenteValida() {\n  const primeiro =\n    whatsappPrimeiroEstagio();\n\n  const atual =\n    normalizarWhatsappBrasil(\n      contexto.whatsappE164 ||\n      contexto.whatsapp\n    );\n\n  return Boolean(\n    primeiro &&\n    atual &&\n    primeiro === atual &&\n    contexto.whatsappConfirmado === true &&\n    Number(\n      contexto.confirmacaoWhatsappVersao ||\n      0\n    ) === CONFIRMACAO_WHATSAPP_VERSAO\n  );\n}\n\nfunction salvarIdentificacaoCheckout(\n  patch = {}\n) {\n  const atual =\n    lerIdentificacaoSalva();\n\n  const proxima = {\n    ...(atual || {}),\n    ...(patch || {})\n  };\n\n  const numero =\n    normalizarWhatsappBrasil(\n      proxima.whatsappE164 ||\n      proxima.whatsapp\n    );\n\n  if (numero) {\n    proxima.whatsapp =\n      numero;\n\n    proxima.whatsappE164 =\n      \`+55\${numero}\`;\n\n    proxima.ddi =\n      "55";\n\n    proxima.country =\n      "br";\n  }\n\n  const serialized =\n    JSON.stringify(\n      proxima\n    );\n\n  try {\n    session.setItem(\n      SESSION_KEY,\n      serialized\n    );\n  } catch (_) {}\n\n  try {\n    local.setItem(\n      LOCAL_KEY,\n      serialized\n    );\n  } catch (_) {}\n\n  contexto = {\n    ...contexto,\n    ...proxima\n  };\n}\n\n`;

    s = replaceOnce(
      s,
      marker,
      block + marker,
      'CHECKOUT: helpers confirmação'
    );
  }

  if (!s.includes('const confirmacaoPersistente =\n    confirmacaoWhatsappPersistenteValida();')) {
    const old = `  const clienteJaIdentificado =\n    Boolean(\n      safe(\n        contexto.clienteId\n      )\n    );\n\n  /*\n    O HTML já faz a confirmação dupla do WhatsApp.\n\n    Cliente novo recebe o campo vazio.\n\n    Cliente já identificado recebe o número\n    e segue automaticamente.\n  */\n\n  const contextoHtml = {\n    ...contexto,\n\n    whatsapp:\n      clienteJaIdentificado\n        ? contexto.whatsapp\n        : "",\n\n    whatsappE164:\n      clienteJaIdentificado\n        ? contexto.whatsappE164\n        : ""\n  };`;

    const neu = `  const confirmacaoPersistente =\n    confirmacaoWhatsappPersistenteValida();\n\n  /*\n    Enquanto a dupla confirmação ainda não tiver\n    sido concluída nesta versão, o HTML recebe\n    o telefone vazio e exibe a confirmação.\n  */\n\n  const contextoHtml = {\n    ...contexto,\n\n    whatsapp:\n      confirmacaoPersistente\n        ? contexto.whatsapp\n        : "",\n\n    whatsappE164:\n      confirmacaoPersistente\n        ? contexto.whatsappE164\n        : ""\n  };`;

    s = replaceOnce(
      s,
      old,
      neu,
      'CHECKOUT: INIT com confirmação real'
    );

    s = s.replace(
      /clienteJaIdentificado &&\n\s*Boolean\(\n\s*telefone\.whatsapp\n\s*\)/g,
      'confirmacaoPersistente &&\n      Boolean(\n        telefone.whatsapp\n      )'
    );
  }

  if (!s.includes('confirmacaoWhatsappVersao:\n        CONFIRMACAO_WHATSAPP_VERSAO')) {
    const anchor = `      return;\n    }\n\n    const cliente =\n      await comTimeout(\n        buscarCliente(`;

    const insert = `      return;\n    }\n\n    salvarIdentificacaoCheckout({\n      whatsapp:\n        telefone.whatsapp,\n\n      whatsappE164:\n        telefone.whatsappE164,\n\n      whatsappConfirmado:\n        true,\n\n      confirmacaoWhatsappVersao:\n        CONFIRMACAO_WHATSAPP_VERSAO,\n\n      confirmadoEm:\n        new Date().toISOString()\n    });\n\n    const cliente =\n      await comTimeout(\n        buscarCliente(`;

    s = replaceOnce(
      s,
      anchor,
      insert,
      'CHECKOUT: salvar dupla confirmação'
    );
  }

  const autoStart = s.indexOf('async function iniciarFluxoAutomatico() {');
  const autoEndMarker = '\n\n\n// ======================================================\n// ON READY';
  const autoEnd = s.indexOf(autoEndMarker, autoStart);
  assert(autoStart >= 0 && autoEnd > autoStart, 'CHECKOUT: função automática não encontrada.');
  const oldAuto = s.slice(autoStart, autoEnd);

  if (!oldAuto.includes('confirmacaoWhatsappPersistenteValida()')) {
    const newAuto = `async function iniciarFluxoAutomatico() {\n  if (\n    fluxoAutomaticoIniciado ||\n    criandoCheckout\n  ) {\n    return;\n  }\n\n  const telefone =\n    dadosTelefone(\n      contexto\n    );\n\n  if (\n    !telefone.whatsapp ||\n    !confirmacaoWhatsappPersistenteValida()\n  ) {\n    return;\n  }\n\n  fluxoAutomaticoIniciado =\n    true;\n\n  consultandoCliente =\n    true;\n\n  checkoutAutorizado =\n    false;\n\n  try {\n    const clienteId =\n      safe(contexto.clienteId);\n\n    const nomeCliente =\n      safe(contexto.nome);\n\n    const emailResult =\n      validarEmail(contexto.email);\n\n    const documentoResult =\n      validarCpfCnpj(contexto.cpfCnpj);\n\n    let cliente = null;\n\n    if (\n      clienteId &&\n      nomeCliente &&\n      emailResult.ok &&\n      documentoResult.ok\n    ) {\n      cliente = {\n        _id: clienteId,\n        clienteId,\n        nome: nomeCliente,\n        email: emailResult.email,\n        cpfCnpj: documentoResult.cpfCnpj\n      };\n    } else {\n      cliente =\n        await comTimeout(\n          buscarCliente(\n            telefone.whatsappE164\n          ),\n          7000,\n          "A consulta do cliente não respondeu."\n        );\n    }\n\n    if (!cliente) {\n      whatsappConsultado =\n        telefone.whatsapp;\n\n      clienteConsultado =\n        null;\n\n      liberarCadastroClienteNovo();\n      return;\n    }\n\n    await processarClienteEncontrado(\n      cliente,\n      telefone\n    );\n\n  } catch (error) {\n    console.error(\n      "Erro na identificação automática:",\n      error?.message || error,\n      error\n    );\n\n    fluxoAutomaticoIniciado =\n      false;\n\n    enviarParaHtml({\n      type: "CUSTOMER_RESULT",\n      ok: false,\n      exists: false,\n      needsName: true,\n      needsEmail: true,\n      needsCpfCnpj: true,\n      needsCustomerData: true,\n      lookupFailed: true,\n      error:\n        "Não foi possível consultar o cadastro agora. Tente novamente."\n    });\n\n  } finally {\n    consultandoCliente =\n      false;\n  }\n}`;

    s = s.slice(0, autoStart) +
      newAuto +
      s.slice(autoEnd);
  }

  s = s.replace('          750\n        );', '          350\n        );');

  write(path, s);
}

function patchValidaPay() {
  const path = 'src/backend/validaPayPixProjetosProntos.jsw';
  let s = read(path);

  if (!s.includes('import QRCode from "qrcode";')) {
    s = replaceOnce(
      s,
      'import { getSecret } from "wix-secrets-backend";\n',
      'import { getSecret } from "wix-secrets-backend";\nimport QRCode from "qrcode";\n',
      'PIX: importar gerador QR'
    );
  }

  s = s.replace('const READY_ATTEMPTS = 3;', 'const READY_ATTEMPTS = 1;');
  s = s.replace('const READY_DELAY_MS = 300;', 'const READY_DELAY_MS = 150;');

  if (!s.includes('async function qrCodeDataUrl(')) {
    const marker = '// ======================================================\n// NOTIFICAÇÕES DE VENDA';
    const block = `async function qrCodeDataUrl(\n  emv,\n  provided\n) {\n  const source =\n    safe(provided);\n\n  if (\n    /^data:image\\//i.test(source) ||\n    /^https?:\\/\\//i.test(source)\n  ) {\n    return source;\n  }\n\n  const compact =\n    source.replace(/\\s+/g, "");\n\n  if (\n    compact.length > 100 &&\n    /^[a-z0-9+/=]+$/i.test(compact)\n  ) {\n    return \`data:image/png;base64,\${compact}\`;\n  }\n\n  const pix =\n    safe(emv);\n\n  if (!pix) {\n    return "";\n  }\n\n  try {\n    return await QRCode.toDataURL(\n      pix,\n      {\n        errorCorrectionLevel: "M",\n        margin: 1,\n        width: 320\n      }\n    );\n  } catch (error) {\n    console.error(\n      "Falha ao gerar QR Code do PIX no backend:",\n      error?.message || error\n    );\n\n    return "";\n  }\n}\n\n`;

    s = replaceOnce(
      s,
      marker,
      block + marker,
      'PIX: helper QR'
    );
  }

  if (!s.includes('async function publicCharge({')) {
    s = replaceOnce(
      s,
      'function publicCharge({\n',
      'async function publicCharge({\n',
      'PIX: publicCharge async'
    );

    s = replaceOnce(
      s,
      '  const emv =\n    extractEmv(data);\n\n  return {',
      '  const emv =\n    extractEmv(data);\n\n  const qrCode =\n    await qrCodeDataUrl(\n      emv,\n      extractQrCode(data)\n    );\n\n  return {',
      'PIX: gerar QR no servidor'
    );

    s = replaceOnce(
      s,
      '    qrCode:\n      extractQrCode(data),',
      '    qrCode,',
      'PIX: devolver QR pronto'
    );
  }

  if (!s.includes('async function findProductReferenceSession(')) {
    const marker = '// ======================================================\n// PRODUTOS VALIDAPAY';
    const block = `async function findProductReferenceSession({\n  projectCode,\n  type,\n  amount\n}) {\n  try {\n    const result =\n      await wixData\n        .query(SESSIONS)\n        .eq(\n          "codigoProjeto",\n          safe(projectCode)\n        )\n        .descending(\n          "updatedAtDate"\n        )\n        .limit(30)\n        .find(DB_OPTS);\n\n    return (\n      result.items || []\n    ).find(\n      (item) =>\n        normalizeType(\n          item?.tipoProduto\n        ) === type &&\n        sameMoney(\n          item?.valor,\n          amount\n        ) &&\n        safe(\n          item?.validaPayProductId\n        ) &&\n        safe(\n          item?.validaPayPriceId\n        )\n    ) || null;\n\n  } catch (error) {\n    console.warn(\n      "Não foi possível reutilizar referência de produto da sessão:",\n      error?.message || error\n    );\n\n    return null;\n  }\n}\n\n`;

    s = replaceOnce(
      s,
      marker,
      block + marker,
      'PIX: referência produto por sessão'
    );
  }

  const slowFetch = `        const details =\n          await fetchChargeReady(\n            chargeId,\n            2\n          );\n\n        return mergeCharge(\n          merged,\n          {\n            ...details,\n            chargeId\n          }\n        );`;

  if (s.includes(slowFetch)) {
    s = s.replace(
      slowFetch,
      `        return {\n          ...merged,\n          chargeId\n        };`
    );
  }

  const duplicateSlow = `        const details =\n          await fetchChargeReady(\n            recoveredId,\n            2\n          );\n\n        return mergeCharge(\n          merged,\n          {\n            ...details,\n\n            chargeId:\n              recoveredId\n          }\n        );`;

  if (s.includes(duplicateSlow)) {
    s = s.replace(
      duplicateSlow,
      `        return {\n          ...merged,\n          chargeId:\n            recoveredId\n        };`
    );
  }

  if (!s.includes('const productReferenceSession =')) {
    s = replaceOnce(
      s,
      `    const product =\n      await ensureProduct({\n        session:\n          existing,`,
      `    const productReferenceSession =\n      existing?.validaPayProductId &&\n      existing?.validaPayPriceId\n        ? existing\n        : await findProductReferenceSession({\n          projectCode,\n          type,\n          amount\n        });\n\n    const product =\n      await ensureProduct({\n        session:\n          productReferenceSession ||\n          existing,`,
      'PIX: reutilizar produto entre checkouts'
    );
  }

  s = s.replace(
    /await fetchChargeReady\(\n\s*existingChargeId\n\s*\);/,
    'await fetchChargeReady(\n          existingChargeId,\n          1\n        );'
  );

  s = s.replace(
    /await fetchChargeReady\(\n\s*chargeId,\n\s*3\n\s*\);/,
    'await fetchChargeReady(\n        chargeId,\n        1\n      );'
  );

  s = s.replace(/return publicCharge\(\{/g, 'return await publicCharge({');
  s = s.replace(/const result =\n\s*publicCharge\(\{/g, 'const result =\n      await publicCharge({');

  write(path, s);
}

function patchPackage() {
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  pkg.dependencies = pkg.dependencies || {};

  if (!pkg.dependencies.qrcode) {
    pkg.dependencies.qrcode = '^1.5.4';
  }

  write(
    path,
    JSON.stringify(pkg, null, 2) + '\n'
  );
}

patchMainPage();
patchCheckoutPage();
patchValidaPay();
patchPackage();
console.log('Correção final de lançamento aplicada.');
