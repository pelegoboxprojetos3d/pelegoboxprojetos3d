import wixLocation from "wix-location";

import {
  local,
  session
} from "wix-storage-frontend";

import {
  buscarCliente,
  criarCliente
} from "backend/clientes.web";

import {
  criarCobrancaPixTransparente,
  consultarCobrancaPix
} from "backend/validaPayPixProjetosProntos.jsw";

import {
  obterAcessosProjeto
} from "backend/entregaProjetosProntos.jsw";

// PÁGINA: /checkout-projeto-pronto
// HTML: #htmlIframeMP
// R21 — CONTRATO ANTIGO DO HTML + RECUPERAÇÃO DO PIX

const PIX_POLL_INTERVALO_RAPIDO = 750;
const PIX_POLL_INTERVALO = 2500;
const PIX_POLL_MAX_TENTATIVAS = 240;
const PIX_PRE_QR_LIMITE_MS = 18000;
const PIX_CRIACAO_TIMEOUT = 6000;
const PIX_CONSULTA_TIMEOUT = 3000;

const SESSION_KEY =
  "pp_identificacao_atual";

const LOCAL_KEY =
  "pp_identificacao_persistente";

const FIRST_WHATSAPP_SESSION_KEY =
  "pp_whatsapp_primeiro_estagio";

const FIRST_WHATSAPP_LOCAL_KEY =
  "pp_whatsapp_primeiro_estagio_persistente";

const PIX_RECOVERY_TENTATIVAS = 4;
const PIX_RECOVERY_ESPERA = 500;

let contexto = {};
let checkoutId = "";

let htmlPronto = false;
let initEnviado = false;
let mensagensPendentes = [];

let consultandoCliente = false;
let criandoCliente = false;
let criandoCheckout = false;
let fluxoAutomaticoIniciado = false;

let clienteConsultado = null;
let whatsappConsultado = "";
let checkoutAutorizado = false;
let acessoPendente = null;

let chargeIdAtual = "";
let pollingPix = false;
let pixPollTimer = null;
let pixConteudoEnviado = false;
let pixPollingInicio = 0;


// ======================================================
// HELPERS
// ======================================================

function safe(value) {
  return String(value ?? "").trim();
}

function digits(value) {
  return safe(value).replace(/\D/g, "");
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizarEmail(value) {
  return safe(value).toLowerCase();
}

function normalizarCpfCnpj(value) {
  return digits(value).slice(0, 14);
}

function gerarCheckoutId() {
  return (
    `ckpro_${Date.now().toString(36)}_` +
    Math.random().toString(16).slice(2, 12)
  );
}

function normalizarMensagem(raw) {
  let data = raw;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (_) {
      data = { type: data };
    }
  }

  if (
    data &&
    typeof data === "object" &&
    data.data &&
    typeof data.data === "object" &&
    !data.type &&
    !data.tipo
  ) {
    data = data.data;
  }

  return data && typeof data === "object" ? data : {};
}

function comTimeout(promise, ms, message) {
  return Promise.race([
    promise,

    new Promise((_, reject) => {
      setTimeout(
        () => reject(
          new Error(
            message ||
            "Tempo limite excedido."
          )
        ),
        ms
      );
    })
  ]);
}

function respostaRecuperavel(response) {
  return Boolean(
    response?.recoverable === true ||
    response?.processing === true
  );
}


// ======================================================
// VALIDAÇÕES
// ======================================================

function validarEmail(value) {
  const email = normalizarEmail(value);

  const ok =
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
      .test(email);

  return {
    ok,
    email,
    error:
      ok
        ? ""
        : "Informe um e-mail válido."
  };
}

function cpfValido(value) {
  const cpf =
    normalizarCpfCnpj(value);

  if (
    cpf.length !== 11 ||
    /^(\d)\1{10}$/.test(cpf)
  ) {
    return false;
  }

  let soma = 0;

  for (
    let index = 0;
    index < 9;
    index += 1
  ) {
    soma +=
      Number(cpf[index]) *
      (10 - index);
  }

  let digito =
    (soma * 10) % 11;

  if (digito === 10) {
    digito = 0;
  }

  if (
    digito !==
    Number(cpf[9])
  ) {
    return false;
  }

  soma = 0;

  for (
    let index = 0;
    index < 10;
    index += 1
  ) {
    soma +=
      Number(cpf[index]) *
      (11 - index);
  }

  digito =
    (soma * 10) % 11;

  if (digito === 10) {
    digito = 0;
  }

  return (
    digito ===
    Number(cpf[10])
  );
}

function calcularDigitoCnpj(
  base,
  pesos
) {
  let soma = 0;

  for (
    let index = 0;
    index < pesos.length;
    index += 1
  ) {
    soma +=
      Number(base[index]) *
      pesos[index];
  }

  const resto =
    soma % 11;

  return resto < 2
    ? 0
    : 11 - resto;
}

function cnpjValido(value) {
  const cnpj =
    normalizarCpfCnpj(value);

  if (
    cnpj.length !== 14 ||
    /^(\d)\1{13}$/.test(cnpj)
  ) {
    return false;
  }

  const base =
    cnpj.slice(0, 12);

  const digito1 =
    calcularDigitoCnpj(
      base,
      [
        5, 4, 3, 2,
        9, 8, 7, 6,
        5, 4, 3, 2
      ]
    );

  const digito2 =
    calcularDigitoCnpj(
      base + digito1,
      [
        6, 5, 4, 3, 2,
        9, 8, 7, 6,
        5, 4, 3, 2
      ]
    );

  return (
    cnpj ===
    `${base}${digito1}${digito2}`
  );
}

function validarCpfCnpj(value) {
  const cpfCnpj =
    normalizarCpfCnpj(value);

  const ok =
    cpfCnpj.length === 11
      ? cpfValido(cpfCnpj)
      : (
        cpfCnpj.length === 14 &&
        cnpjValido(cpfCnpj)
      );

  return {
    ok,
    cpfCnpj,

    error:
      ok
        ? ""
        : "Informe um CPF ou CNPJ válido."
  };
}


// ======================================================
// CONTEXTO E TELEFONE
// ======================================================

function formatarSku(
  codigoProjeto,
  skuInformado
) {
  const codigo =
    digits(codigoProjeto);

  return codigo
    ? `PP-${String(
      Number(codigo)
    ).padStart(4, "0")}`
    : safe(skuInformado) ||
      "PP";
}

function returnUrlProjeto(
  codigoProjeto
) {
  const codigo =
    digits(codigoProjeto);

  return codigo
    ? (
      "/checkoutprojetosprontos" +
      `?codigo=${encodeURIComponent(codigo)}`
    )
    : "/checkoutprojetosprontos";
}

function urlEntrega() {
  return (
    "/entregaprojetosprontos" +
    `?checkout_id=${encodeURIComponent(checkoutId)}`
  );
}

function lerIdentificacaoSalva() {
  const fontes = [
    {
      storage: session,
      key: SESSION_KEY
    },
    {
      storage: local,
      key: LOCAL_KEY
    }
  ];

  for (const fonte of fontes) {
    try {
      const raw =
        fonte.storage.getItem(
          fonte.key
        );

      if (!raw) {
        continue;
      }

      const data =
        JSON.parse(raw);

      if (
        data &&
        typeof data === "object"
      ) {
        return data;
      }

    } catch (_) {
      /*
        Ignora identificação antiga ou inválida.
      */
    }
  }

  return {};
}

function lerWhatsappPrimeiroEstagioDedicado() {
  const fontes = [
    {
      storage: session,
      key:
        FIRST_WHATSAPP_SESSION_KEY
    },
    {
      storage: local,
      key:
        FIRST_WHATSAPP_LOCAL_KEY
    }
  ];

  for (const fonte of fontes) {
    try {
      const numero =
        normalizarWhatsappBrasil(
          fonte.storage.getItem(
            fonte.key
          )
        );

      if (numero) {
        return numero;
      }
    } catch (_) {
      /*
        Ignora armazenamento indisponível.
      */
    }
  }

  return "";
}

function normalizarCodigoCheckout(value) {
  const codigo =
    digits(value);

  return codigo
    ? codigo
      .slice(-3)
      .padStart(3, "0")
    : "";
}

function tituloProdutoComCodigo(
  titulo,
  codigoCheckout
) {
  const codigo =
    normalizarCodigoCheckout(
      codigoCheckout
    );

  const tituloBase =
    (
      safe(titulo) ||
      "Produto"
    )
      .replace(
        /\s*\|\s*C[oó]digo\s+\d{1,3}.*$/i,
        ""
      )
      .trim();

  return codigo
    ? `${tituloBase} | Código ${codigo}`
    : tituloBase;
}

function contextoDaUrl() {
  const query =
    wixLocation.query ||
    {};

  const identificacao =
    lerIdentificacaoSalva();

  const codigoProjeto =
    digits(
      query.codigoProjeto ||
      query.ordemVideo ||
      ""
    );

  const codigoCheckout =
    normalizarCodigoCheckout(
      query.codigoCheckout ||
      ""
    );

  const produtoOriginal =
    safe(
      query.titulo ||
      query.produto ||
      query.name ||
      "Produto"
    );

  return {
    codigoProjeto,
    codigoCheckout,

    produto:
      tituloProdutoComCodigo(
        produtoOriginal,
        codigoCheckout
      ),

    sku:
      formatarSku(
        codigoProjeto,
        query.sku
      ),

    productId:
      safe(
        query.productId ||
        codigoCheckout
      ),

    img:
      safe(
        query.imagem ||
        query.img ||
        ""
      ),

    valor:
      Number(
        query.valor ||
        query.price ||
        0
      ),

    tipoProduto:
      safe(
        query.tipoProduto ||
        "MEDIDAS"
      ).toUpperCase(),

    /*
      Dados pessoais vêm do armazenamento do navegador,
      nunca da URL pública.
    */
    whatsapp:
      digits(
        identificacao.whatsapp ||
        ""
      ),

    whatsappE164:
      safe(
        identificacao.whatsappE164 ||
        ""
      ),

    ddi:
      digits(
        identificacao.ddi ||
        "55"
      ),

    country:
      safe(
        identificacao.country ||
        "br"
      ).toLowerCase(),

    clienteId:
      safe(
        identificacao.clienteId ||
        ""
      ),

    nome:
      safe(
        identificacao.nome ||
        identificacao.nomeCliente ||
        ""
      ),

    email:
      normalizarEmail(
        identificacao.email ||
        ""
      ),

    cpfCnpj:
      normalizarCpfCnpj(
        identificacao.cpfCnpj ||
        identificacao.cpf ||
        identificacao.cnpj ||
        ""
      ),

    returnUrl:
      safe(
        query.returnUrl
      ) ||
      returnUrlProjeto(
        codigoProjeto
      )
  };
}

function normalizarWhatsappBrasil(value) {
  let numero =
    digits(value);

  if (
    numero.startsWith("55") &&
    (
      numero.length === 12 ||
      numero.length === 13
    )
  ) {
    numero =
      numero.slice(2);
  }

  return (
    numero.length === 10 ||
    numero.length === 11
  )
    ? numero
    : "";
}

function dadosTelefone(
  data = {}
) {
  const recebido =
    safe(
      data.whatsappE164 ||
      data.whatsapp ||
      data.whatsappDigits ||
      data.telefone ||
      contexto.whatsappE164 ||
      contexto.whatsapp
    );

  const whatsapp =
    normalizarWhatsappBrasil(
      recebido
    );

  return {
    whatsapp,

    whatsappE164:
      whatsapp
        ? `+55${whatsapp}`
        : "",

    ddi:
      "55",

    country:
      "br"
  };
}

function dadosTelefoneDigitado(
  data = {}
) {
  const recebido =
    safe(
      data.whatsappE164 ||
      data.whatsapp ||
      data.whatsappDigits ||
      data.telefone
    );

  const whatsapp =
    normalizarWhatsappBrasil(
      recebido
    );

  return {
    whatsapp,

    whatsappE164:
      whatsapp
        ? `+55${whatsapp}`
        : "",

    ddi:
      "55",

    country:
      "br"
  };
}

function whatsappPrimeiroEstagio() {
  /*
    A chave dedicada é imutável neste checkout:
    apenas o popup anterior pode gravá-la.

    O objeto legado fica somente como compatibilidade
    para clientes que iniciaram o fluxo antes da correção.
  */
  return (
    lerWhatsappPrimeiroEstagioDedicado() ||
    normalizarWhatsappBrasil(
      contexto.whatsappE164 ||
      contexto.whatsapp
    )
  );
}


// ======================================================
// COMUNICAÇÃO COM O HTML
// ======================================================

function postarDiretoNoHtml(message) {
  try {
    $w(
      "#htmlIframeMP"
    ).postMessage(
      message
    );

  } catch (error) {
    console.error(
      "Erro ao enviar mensagem ao HTML:",
      error?.message ||
      error
    );
  }
}

function enviarParaHtml(message) {
  if (
    !htmlPronto &&
    safe(
      message?.type
    ).toUpperCase() !==
      "INIT"
  ) {
    mensagensPendentes.push(
      message
    );

    return;
  }

  postarDiretoNoHtml(
    message
  );
}

function enviarInit() {
  if (initEnviado) {
    return;
  }

  initEnviado =
    true;

  const telefone =
    dadosTelefone(
      contexto
    );

  const clienteJaIdentificado =
    Boolean(
      safe(
        contexto.clienteId
      )
    );

  /*
    O HTML já faz a confirmação dupla do WhatsApp.

    Cliente novo recebe o campo vazio.

    Cliente já identificado recebe o número
    e segue automaticamente.
  */

  const contextoHtml = {
    ...contexto,

    whatsapp:
      clienteJaIdentificado
        ? contexto.whatsapp
        : "",

    whatsappE164:
      clienteJaIdentificado
        ? contexto.whatsappE164
        : ""
  };

  postarDiretoNoHtml({
    type:
      "INIT",

    checkoutId,

    provider:
      "VALIDAPAY",

    autoLookup:
      clienteJaIdentificado &&
      Boolean(
        telefone.whatsapp
      ),

    hasWhatsappFromPreviousStep:
      clienteJaIdentificado &&
      Boolean(
        telefone.whatsapp
      ),

    requiredFields: {
      name:
        true,

      email:
        true,

      cpfCnpj:
        true
    },

    ctx:
      contextoHtml
  });
}

function liberarHtml() {
  if (htmlPronto) {
    return;
  }

  htmlPronto =
    true;

  enviarInit();

  const pendentes =
    mensagensPendentes;

  mensagensPendentes =
    [];

  pendentes.forEach(
    postarDiretoNoHtml
  );

  iniciarFluxoAutomatico()
    .catch(
      (error) => {
        console.error(
          "Falha ao iniciar automaticamente:",
          error?.message ||
          error
        );
      }
    );
}


// ======================================================
// ACESSOS E COMPRA EXISTENTE
// ======================================================

function acessoVazio() {
  return {
    medidas:
      false,

    graficos:
      false,

    projeto:
      false
  };
}

function nomeEtapa(tipoProduto) {
  const tipo =
    safe(
      tipoProduto
    ).toUpperCase();

  if (tipo === "GRAFICOS") {
    return "Análises Gráficas";
  }

  if (
    tipo ===
    "PROJETO_COMPLETO"
  ) {
    return "Projeto Completo";
  }

  return "Medidas";
}

function produtoJaComprado(
  access,
  tipoProduto
) {
  const tipo =
    safe(
      tipoProduto
    ).toUpperCase();

  if (tipo === "GRAFICOS") {
    return (
      access?.graficos ===
      true
    );
  }

  if (
    tipo ===
    "PROJETO_COMPLETO"
  ) {
    return (
      access?.projeto ===
      true
    );
  }

  return (
    access?.medidas ===
    true
  );
}

function proximaEtapa(
  access = {}
) {
  if (
    access.medidas === true &&
    access.graficos !== true
  ) {
    return {
      type:
        "GRAFICOS",

      label:
        "Continuar para gráficos",

      name:
        "Análises Gráficas"
    };
  }

  if (
    access.graficos === true &&
    access.projeto !== true
  ) {
    return {
      type:
        "PROJETO_COMPLETO",

      label:
        "Continuar para o projeto completo",

      name:
        "Projeto Completo"
    };
  }

  return null;
}

async function consultarAcessos({
  clienteId,
  email,
  whatsapp
}) {
  try {
    const result =
      await comTimeout(
        obterAcessosProjeto({
          codigoProjeto:
            contexto.codigoProjeto,

          clienteId:
            safe(
              clienteId
            ),

          email:
            normalizarEmail(
              email
            ),

          whatsapp:
            normalizarWhatsappBrasil(
              whatsapp
            )
        }),

        10000,

        "A consulta das compras não respondeu."
      );

    return (
      result?.ok &&
      result?.access
    )
      ? result.access
      : acessoVazio();

  } catch (error) {
    console.warn(
      "Consulta de acessos falhou:",
      error?.message ||
      error
    );

    return acessoVazio();
  }
}

function avisarCompraExistente({
  access,
  cliente,
  whatsapp
}) {
  const next =
    proximaEtapa(
      access
    );

  acessoPendente = {
    access,

    nextType:
      next?.type ||
      "",

    nextLabel:
      next?.label ||
      "",

    nextName:
      next?.name ||
      "",

    clienteId:
      safe(
        cliente?._id ||
        cliente?.clienteId
      ),

    email:
      normalizarEmail(
        cliente?.email
      ),

    whatsapp:
      normalizarWhatsappBrasil(
        whatsapp
      )
  };

  enviarParaHtml({
    type:
      "ALREADY_PURCHASED",

    ok:
      true,

    codigoProjeto:
      contexto.codigoProjeto,

    tipoProduto:
      contexto.tipoProduto,

    etapaComprada:
      nomeEtapa(
        contexto.tipoProduto
      ),

    nextType:
      acessoPendente.nextType,

    nextLabel:
      acessoPendente.nextLabel,

    nextName:
      acessoPendente.nextName,

    access
  });
}

function voltarParaPaginaAnterior(
  tipo = ""
) {
  pararPollingPix();

  const base =
    contexto.returnUrl ||
    returnUrlProjeto(
      contexto.codigoProjeto
    );

  const destino =
    tipo
      ? (
        `${base}` +
        `${base.includes("?") ? "&" : "?"}` +
        `tipo=${encodeURIComponent(tipo)}`
      )
      : base;

  wixLocation.to(
    destino
  );
}

function concluirAviso(
  action = "CLOSE"
) {
  const acao =
    safe(
      action
    ).toUpperCase();

  if (
    acao === "CONTINUE" &&
    acessoPendente?.nextType
  ) {
    voltarParaPaginaAnterior(
      acessoPendente.nextType
    );

    return;
  }

  voltarParaPaginaAnterior();
}


// ======================================================
// PIX: RESPOSTAS, RECUPERAÇÃO E POLLING
// ======================================================

function respostaPixPronta(response) {
  return Boolean(
    response?.ok === true &&
    response?.chargeId &&
    response?.emv
  );
}

function enviarResultadoPix(response) {
  pixConteudoEnviado =
    true;

  chargeIdAtual =
    safe(
      response.chargeId ||
      chargeIdAtual
    );

  enviarParaHtml({
    type:
      "PIX_RESULT",

    ok:
      true,

    provider:
      "VALIDAPAY",

    paymentMethod:
      "PIX",

    checkoutId,

    chargeId:
      chargeIdAtual,

    status:
      response.status ||
      "pending",

    approved:
      response.approved ===
      true,

    amount:
      Number(
        response.amount ||
        contexto.valor ||
        0
      ),

    emv:
      response.emv,

    qrCode:
      response.qrCode ||
      "",

    returnUrl:
      contexto.returnUrl,

    deliveryUrl:
      urlEntrega()
  });
}

function enviarStatusPix(
  response = {}
) {
  enviarParaHtml({
    type:
      "PIX_STATUS",

    ok:
      response.ok !==
      false,

    processing:
      response.processing ===
      true,

    recoverable:
      response.recoverable ===
      true,

    checkoutId,

    chargeId:
      response.chargeId ||
      chargeIdAtual,

    status:
      response.status ||
      "pending",

    approved:
      response.approved ===
      true,

    amount:
      Number(
        response.amount ||
        contexto.valor ||
        0
      ),

    error:
      response.error ||
      ""
  });
}

async function recuperarPix(
  responseInicial = {}
) {
  let ultimaResposta = responseInicial;
  let chargeId = safe(
    responseInicial.chargeId ||
    chargeIdAtual
  );

  for (
    let tentativa = 1;
    tentativa <= PIX_RECOVERY_TENTATIVAS;
    tentativa += 1
  ) {
    await esperar(PIX_RECOVERY_ESPERA);

    try {
      const resposta = await comTimeout(
        consultarCobrancaPix({
          checkoutId,
          chargeId
        }),
        PIX_CONSULTA_TIMEOUT,
        "A consulta do PIX demorou mais que o esperado."
      );

      ultimaResposta = resposta || ultimaResposta;
      chargeId = safe(
        resposta?.chargeId ||
        chargeId
      );

      if (respostaPixPronta(resposta)) {
        return resposta;
      }

      if (
        resposta &&
        resposta.ok === false &&
        !respostaRecuperavel(resposta)
      ) {
        return resposta;
      }
    } catch (error) {
      console.warn(
        "Tentativa de localizar o PIX falhou:",
        error?.message || error
      );
    }
  }

  return ultimaResposta;
}

function pararPollingPix() {
  pollingPix =
    false;

  if (pixPollTimer) {
    clearTimeout(
      pixPollTimer
    );

    pixPollTimer =
      null;
  }
}

function statusFinalPix(status) {
  return [
    "approved",
    "rejected",
    "cancelled",
    "expired"
  ].includes(
    safe(
      status
    ).toLowerCase()
  );
}

async function executarPollingPix(
  tentativa = 1
) {
  if (
    !pollingPix ||
    (
      !chargeIdAtual &&
      !checkoutId
    )
  ) {
    return;
  }

  if (
    !pixConteudoEnviado &&
    pixPollingInicio > 0 &&
    Date.now() - pixPollingInicio >=
      PIX_PRE_QR_LIMITE_MS
  ) {
    pararPollingPix();

    enviarParaHtml({
      type: "PIX_RESULT",
      ok: false,
      processing: false,
      recoverable: true,
      checkoutId,
      chargeId: chargeIdAtual,
      status: "timeout",
      error:
        "Não foi possível gerar o PIX agora. Clique em tentar novamente."
    });

    return;
  }

  try {
    const resultado = await comTimeout(
      consultarCobrancaPix({
        checkoutId,
        chargeId: chargeIdAtual
      }),
      PIX_CONSULTA_TIMEOUT,
      "A atualização do PIX demorou mais que o esperado."
    );

    if (resultado?.chargeId) {
      chargeIdAtual = safe(resultado.chargeId);
    }

    if (resultado?.ok) {
      if (
        respostaPixPronta(resultado) &&
        !pixConteudoEnviado
      ) {
        enviarResultadoPix(resultado);
      } else {
        enviarStatusPix(resultado);
      }

      if (resultado.approved === true) {
        pararPollingPix();

        enviarParaHtml({
          type: "PIX_APPROVED",
          ok: true,
          checkoutId,
          chargeId: chargeIdAtual,
          deliveryUrl: urlEntrega()
        });

        setTimeout(
          () => wixLocation.to(urlEntrega()),
          750
        );

        return;
      }

      if (statusFinalPix(resultado.status)) {
        pararPollingPix();
        return;
      }
    }
  } catch (error) {
    console.warn(
      "Consulta automática do PIX falhou:",
      error?.message || error
    );
  }

  if (
    tentativa >= PIX_POLL_MAX_TENTATIVAS
  ) {
    pararPollingPix();

    enviarParaHtml({
      type: "PIX_STATUS",
      ok: false,
      processing: false,
      recoverable: true,
      checkoutId,
      chargeId: chargeIdAtual,
      status: "timeout",
      error:
        "O PIX continua aguardando pagamento. Atualize esta página para consultar novamente."
    });

    return;
  }

  pixPollTimer = setTimeout(
    () => {
      executarPollingPix(
        tentativa + 1
      ).catch(console.error);
    },
    pixConteudoEnviado
      ? PIX_POLL_INTERVALO
      : PIX_POLL_INTERVALO_RAPIDO
  );
}

function iniciarPollingPix(chargeId) {
  pararPollingPix();

  chargeIdAtual = safe(
    chargeId ||
    chargeIdAtual
  );

  if (
    !chargeIdAtual &&
    !checkoutId
  ) {
    return;
  }

  pixPollingInicio = Date.now();
  pollingPix = true;

  executarPollingPix(1)
    .catch(
      (error) => {
        console.error(
          "Falha ao iniciar consulta do PIX:",
          error?.message || error
        );
      }
    );
}

async function consultarPixAgora() {
  const resultado =
    await comTimeout(
      consultarCobrancaPix({
        checkoutId,

        chargeId:
          chargeIdAtual
      }),

      PIX_CONSULTA_TIMEOUT,

      "A consulta do PIX demorou mais que o esperado."
    );

  if (
    resultado?.chargeId
  ) {
    chargeIdAtual =
      safe(
        resultado.chargeId
      );
  }

  if (
    respostaPixPronta(
      resultado
    )
  ) {
    enviarResultadoPix(
      resultado
    );

    iniciarPollingPix(
      chargeIdAtual
    );

    return;
  }

  enviarStatusPix(
    resultado ||
    {}
  );
}


// ======================================================
// GERAR PIX
// ======================================================

async function abrirPixTransparente(
  data = {}
) {
  if (criandoCheckout) {
    return;
  }

  criandoCheckout = true;

  try {
    const telefone = dadosTelefone(data);
    const clienteId = safe(
      data.clienteId ||
      clienteConsultado?._id ||
      clienteConsultado?.clienteId ||
      contexto.clienteId
    );
    const nomeCliente = safe(
      data.nome ||
      data.nomeCliente ||
      clienteConsultado?.nome ||
      clienteConsultado?.title ||
      contexto.nome
    );
    const emailResult = validarEmail(
      data.email ||
      clienteConsultado?.email ||
      contexto.email
    );
    const documentoResult = validarCpfCnpj(
      data.cpfCnpj ||
      data.cpf ||
      data.cnpj ||
      clienteConsultado?.cpfCnpj ||
      contexto.cpfCnpj
    );

    if (
      !contexto.codigoProjeto ||
      !contexto.codigoCheckout ||
      !(contexto.valor > 0)
    ) {
      throw new Error(
        "Dados do produto incompletos."
      );
    }
    if (!clienteId) {
      throw new Error(
        "Cliente não identificado."
      );
    }
    if (!nomeCliente) {
      throw new Error(
        "Nome do cliente não identificado."
      );
    }
    if (!telefone.whatsapp) {
      throw new Error(
        "WhatsApp não identificado."
      );
    }
    if (!emailResult.ok) {
      throw new Error(emailResult.error);
    }
    if (!documentoResult.ok) {
      throw new Error(documentoResult.error);
    }

    enviarParaHtml({
      type: "PIX_LOADING",
      checkoutId,
      message:
        "Preparando ambiente seguro de pagamento..."
    });

    const payload = {
      checkoutId,
      clienteId,
      nomeCliente,
      email: emailResult.email,
      cpfCnpj: documentoResult.cpfCnpj,
      whatsapp: telefone.whatsapp,
      whatsappE164: telefone.whatsappE164,
      ddi: telefone.ddi,
      country: telefone.country,
      codigoProjeto: contexto.codigoProjeto,
      codigoCheckout: contexto.codigoCheckout,
      sku: contexto.sku,
      tipoProduto: contexto.tipoProduto,
      produto: contexto.produto,
      valor: contexto.valor,
      img: contexto.img,
      ctx: contexto,
      returnUrl: contexto.returnUrl
    };

    let resposta;

    try {
      resposta = await comTimeout(
        criarCobrancaPixTransparente(payload),
        PIX_CRIACAO_TIMEOUT,
        "A cobrança ainda está sendo localizada."
      );
    } catch (error) {
      console.warn(
        "Criação do PIX demorou; recuperando pelo checkoutId:",
        error?.message || error
      );

      enviarStatusPix({
        ok: true,
        processing: true,
        recoverable: true,
        status: "processing",
        error:
          "Localizando a cobrança já criada..."
      });

      iniciarPollingPix("");
      return;
    }

    if (respostaPixPronta(resposta)) {
      enviarResultadoPix(resposta);
      iniciarPollingPix(resposta.chargeId);
      return;
    }

    const chargeId = safe(
      resposta?.chargeId
    );

    if (respostaRecuperavel(resposta)) {
      chargeIdAtual =
        chargeId ||
        chargeIdAtual;

      enviarStatusPix({
        ...resposta,
        ok: true,
        processing: true,
        recoverable: true
      });

      iniciarPollingPix(chargeId);
      return;
    }

    throw new Error(
      resposta?.error ||
      "Não foi possível gerar o PIX."
    );
  } catch (error) {
    console.error(
      "Erro ao gerar PIX:",
      error?.message || error,
      error
    );

    enviarParaHtml({
      type: "PIX_RESULT",
      ok: false,
      processing: false,
      checkoutId,
      recoverable: true,
      error:
        error?.message ||
        "Não foi possível gerar o PIX."
    });
  } finally {
    criandoCheckout = false;
  }
}


// ======================================================
// CLIENTES
// ======================================================

function liberarCadastroClienteNovo() {
  enviarParaHtml({
    type:
      "CUSTOMER_RESULT",

    ok:
      true,

    exists:
      false,

    needsName:
      true,

    needsEmail:
      true,

    needsCpfCnpj:
      true,

    needsCustomerData:
      true
  });
}

async function processarClienteEncontrado(
  cliente,
  telefone
) {
  clienteConsultado =
    cliente;

  whatsappConsultado =
    telefone.whatsapp;

  const clienteId =
    safe(
      cliente._id ||
      cliente.clienteId ||
      contexto.clienteId
    );

  const nomeCliente =
    safe(
      cliente.nome ||
      cliente.title ||
      contexto.nome
    );

  const emailResult =
    validarEmail(
      cliente.email ||
      contexto.email
    );

  const documentoResult =
    validarCpfCnpj(
      cliente.cpfCnpj ||
      contexto.cpfCnpj
    );

  const access =
    await consultarAcessos({
      clienteId,

      email:
        emailResult.ok
          ? emailResult.email
          : "",

      whatsapp:
        telefone.whatsapp
    });

  if (
    produtoJaComprado(
      access,
      contexto.tipoProduto
    )
  ) {
    avisarCompraExistente({
      access,
      cliente,

      whatsapp:
        telefone.whatsapp
    });

    return;
  }

  const needsName =
    !nomeCliente;

  const needsEmail =
    !emailResult.ok;

  const needsCpfCnpj =
    !documentoResult.ok;

  if (
    needsName ||
    needsEmail ||
    needsCpfCnpj
  ) {
    enviarParaHtml({
      type:
        "CUSTOMER_RESULT",

      ok:
        true,

      exists:
        true,

      needsName,
      needsEmail,
      needsCpfCnpj,

      needsCustomerData:
        needsName ||
        needsEmail ||
        needsCpfCnpj,

      customerId:
        clienteId,

      clienteId,

      nome:
        nomeCliente,

      email:
        emailResult.ok
          ? emailResult.email
          : "",

      cpfCnpj:
        documentoResult.ok
          ? documentoResult.cpfCnpj
          : "",

      access
    });

    return;
  }

  checkoutAutorizado =
    true;

  await abrirPixTransparente({
    clienteId,
    nomeCliente,

    email:
      emailResult.email,

    cpfCnpj:
      documentoResult.cpfCnpj,

    whatsapp:
      telefone.whatsapp,

    whatsappE164:
      telefone.whatsappE164,

    ddi:
      telefone.ddi,

    country:
      telefone.country
  });
}

async function consultarCliente(
  data = {}
) {
  if (
    consultandoCliente ||
    criandoCliente ||
    criandoCheckout
  ) {
    return;
  }

  consultandoCliente =
    true;

  checkoutAutorizado =
    false;

  clienteConsultado =
    null;

  whatsappConsultado =
    "";

  try {
    const telefone =
      dadosTelefoneDigitado(
        data
      );

    const whatsappEsperado =
      whatsappPrimeiroEstagio();

    if (!telefone.whatsapp) {
      enviarParaHtml({
        type:
          "CUSTOMER_RESULT",

        ok:
          false,

        exists:
          false,

        needsName:
          true,

        needsEmail:
          true,

        needsCpfCnpj:
          true,

        needsCustomerData:
          true,

        error:
          "WhatsApp não informado."
      });

      return;
    }

    if (!whatsappEsperado) {
      enviarParaHtml({
        type:
          "CUSTOMER_RESULT",

        ok:
          false,

        exists:
          false,

        needsName:
          false,

        needsEmail:
          false,

        needsCpfCnpj:
          false,

        needsCustomerData:
          false,

        error:
          "Não encontrei o WhatsApp da primeira etapa. Volte e informe o número novamente."
      });

      return;
    }

    if (
      telefone.whatsapp !==
      whatsappEsperado
    ) {
      enviarParaHtml({
        type:
          "CUSTOMER_RESULT",

        ok:
          false,

        exists:
          false,

        needsName:
          false,

        needsEmail:
          false,

        needsCpfCnpj:
          false,

        needsCustomerData:
          false,

        error:
          "O WhatsApp digitado não confere com o informado na primeira etapa."
      });

      return;
    }

    const cliente =
      await comTimeout(
        buscarCliente(
          telefone.whatsappE164
        ),

        10000,

        "A consulta do cliente não respondeu."
      );

    whatsappConsultado =
      telefone.whatsapp;

    if (!cliente) {
      /*
        O HTML já confirmou o WhatsApp
        duas vezes antes de enviar
        CHECK_CUSTOMER.
      */

      liberarCadastroClienteNovo();

      return;
    }

    await processarClienteEncontrado(
      cliente,
      telefone
    );

  } catch (error) {
    console.error(
      "Erro ao consultar cliente:",
      error?.message ||
      error,
      error
    );

    /*
      criarCliente funciona como upsert
      por WhatsApp, evitando duplicidade.
    */

    enviarParaHtml({
      type:
        "CUSTOMER_RESULT",

      ok:
        true,

      exists:
        false,

      needsName:
        true,

      needsEmail:
        true,

      needsCpfCnpj:
        true,

      needsCustomerData:
        true,

      lookupFailed:
        true,

      error:
        "A consulta demorou mais que o esperado. Confirme seus dados para continuar."
    });

  } finally {
    consultandoCliente =
      false;
  }
}

async function cadastrarCliente(
  data = {}
) {
  if (
    criandoCliente ||
    criandoCheckout
  ) {
    return;
  }

  criandoCliente =
    true;

  checkoutAutorizado =
    false;

  try {
    const telefone =
      dadosTelefone(
        data
      );

    const nome =
      safe(
        data.nome ||
        data.nomeCliente ||
        data.cliente
      );

    const emailResult =
      validarEmail(
        data.email
      );

    const documentoResult =
      validarCpfCnpj(
        data.cpfCnpj ||
        data.cpf ||
        data.cnpj
      );

    if (!telefone.whatsapp) {
      throw new Error(
        "WhatsApp não informado."
      );
    }

    if (
      whatsappConsultado &&
      telefone.whatsapp !==
        whatsappConsultado
    ) {
      throw new Error(
        "O WhatsApp informado mudou durante o cadastro."
      );
    }

    if (!nome) {
      throw new Error(
        "Informe seu nome completo."
      );
    }

    if (!emailResult.ok) {
      throw new Error(
        emailResult.error
      );
    }

    if (!documentoResult.ok) {
      throw new Error(
        documentoResult.error
      );
    }

    const cliente =
      await comTimeout(
        criarCliente({
          nome,

          whatsapp:
            telefone.whatsappE164,

          email:
            emailResult.email,

          cpfCnpj:
            documentoResult.cpfCnpj,

          origem:
            "CHECKOUT_PROJETOS_PRONTOS"
        }),

        15000,

        "O cadastro do cliente não respondeu."
      );

    const clienteId =
      safe(
        cliente?._id ||
        cliente?.clienteId
      );

    if (!clienteId) {
      throw new Error(
        "O cadastro não retornou um ID válido."
      );
    }

    const access =
      await consultarAcessos({
        clienteId,

        email:
          cliente.email ||
          emailResult.email,

        whatsapp:
          telefone.whatsapp
      });

    if (
      produtoJaComprado(
        access,
        contexto.tipoProduto
      )
    ) {
      avisarCompraExistente({
        access,
        cliente,

        whatsapp:
          telefone.whatsapp
      });

      return;
    }

    clienteConsultado =
      cliente;

    whatsappConsultado =
      telefone.whatsapp;

    checkoutAutorizado =
      true;

    await abrirPixTransparente({
      ...data,

      clienteId,
      nome,

      nomeCliente:
        nome,

      email:
        emailResult.email,

      cpfCnpj:
        documentoResult.cpfCnpj,

      whatsapp:
        telefone.whatsapp,

      whatsappE164:
        telefone.whatsappE164,

      ddi:
        telefone.ddi,

      country:
        telefone.country
    });

  } catch (error) {
    console.error(
      "Erro ao criar cliente:",
      error?.message ||
      error,
      error
    );

    enviarParaHtml({
      type:
        "PIX_RESULT",

      ok:
        false,

      checkoutId,

      error:
        error?.message ||
        "Não foi possível salvar o cadastro."
    });

  } finally {
    criandoCliente =
      false;
  }
}

async function enviarClienteExistente(
  data = {}
) {
  const telefone =
    dadosTelefone(
      data
    );

  if (
    !checkoutAutorizado ||
    !clienteConsultado ||
    telefone.whatsapp !==
      whatsappConsultado
  ) {
    enviarParaHtml({
      type:
        "PIX_RESULT",

      ok:
        false,

      checkoutId,

      error:
        "O cadastro ainda não foi validado."
    });

    return;
  }

  const documentoResult =
    validarCpfCnpj(
      clienteConsultado.cpfCnpj ||
      data.cpfCnpj ||
      data.cpf ||
      data.cnpj
    );

  if (!documentoResult.ok) {
    enviarParaHtml({
      type:
        "PIX_RESULT",

      ok:
        false,

      checkoutId,

      error:
        "O CPF/CNPJ do cadastro ainda não foi validado."
    });

    return;
  }

  await abrirPixTransparente({
    ...data,

    clienteId:
      clienteConsultado._id ||
      clienteConsultado.clienteId,

    nomeCliente:
      clienteConsultado.nome ||
      clienteConsultado.title,

    email:
      clienteConsultado.email,

    cpfCnpj:
      documentoResult.cpfCnpj,

    whatsapp:
      telefone.whatsapp,

    whatsappE164:
      telefone.whatsappE164,

    ddi:
      telefone.ddi,

    country:
      telefone.country
  });
}


// ======================================================
// FLUXO AUTOMÁTICO
// ======================================================

async function iniciarFluxoAutomatico() {
  if (
    fluxoAutomaticoIniciado ||
    criandoCheckout
  ) {
    return;
  }

  const telefone =
    dadosTelefone(
      contexto
    );

  /*
    Sem clienteId, o HTML pede
    a confirmação dupla.

    Não existe confirmação paralela
    dentro da página.
  */

  if (
    !telefone.whatsapp ||
    !safe(
      contexto.clienteId
    )
  ) {
    return;
  }

  fluxoAutomaticoIniciado =
    true;

  consultandoCliente =
    true;

  checkoutAutorizado =
    false;

  try {
    const cliente =
      await comTimeout(
        buscarCliente(
          telefone.whatsappE164
        ),

        10000,

        "A consulta do cliente não respondeu."
      );

    if (!cliente) {
      whatsappConsultado =
        telefone.whatsapp;

      clienteConsultado =
        null;

      liberarCadastroClienteNovo();

      return;
    }

    await processarClienteEncontrado(
      cliente,
      telefone
    );

  } catch (error) {
    console.error(
      "Erro na identificação automática:",
      error?.message ||
      error,
      error
    );

    fluxoAutomaticoIniciado =
      false;

    enviarParaHtml({
      type:
        "CUSTOMER_RESULT",

      ok:
        false,

      exists:
        false,

      needsName:
        true,

      needsEmail:
        true,

      needsCpfCnpj:
        true,

      needsCustomerData:
        true,

      lookupFailed:
        true,

      error:
        "Não foi possível consultar o cadastro agora. Tente novamente."
    });

  } finally {
    consultandoCliente =
      false;
  }
}


// ======================================================
// ON READY
// ======================================================

function tipoDaSecaoInformativa(contextoAtual) {
  const referencia = safe(
    [
      contextoAtual?.tipoProduto,
      wixLocation.query?.tipo,
      wixLocation.query?.tipoProduto,
      contextoAtual?.produto
    ].join(" ")
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (referencia.includes("GRAFIC")) {
    return "GRAFICOS";
  }

  if (
    referencia.includes("PROJETO_COMPLETO") ||
    referencia.includes("PROJETO COMPLETO") ||
    /(^|\s)COMPLETO($|\s)/.test(referencia)
  ) {
    return "PROJETO_COMPLETO";
  }

  return "MEDIDAS";
}

async function configurarSecoesInformativas(contextoAtual) {
  const tipo = tipoDaSecaoInformativa(contextoAtual);
  const secoes = {
    MEDIDAS: "#botao1baixarmedidas",
    GRAFICOS: "#botao2baixargraficos",
    PROJETO_COMPLETO: "#botao3projetocompleto"
  };

  for (const [chave, seletor] of Object.entries(secoes)) {
    try {
      const secao = $w(seletor);
      const ativa = chave === tipo;

      await Promise.allSettled(
        ativa
          ? [secao.expand(), secao.show()]
          : [secao.collapse(), secao.hide()]
      );
    } catch (error) {
      console.error(
        `Falha ao alternar a seção ${seletor}:`,
        error?.message || error
      );
    }
  }

  const importante = $w("#textoimportante");
  await Promise.allSettled([
    importante.expand(),
    importante.show()
  ]);
}

$w.onReady(function () {
  contexto =
    contextoDaUrl();

  configurarSecoesInformativas(contexto)
    .catch((error) => {
      console.error(
        "Falha ao configurar os textos da etapa:",
        error?.message || error
      );
    });

  checkoutId =
    gerarCheckoutId();

  const html =
    $w(
      "#htmlIframeMP"
    );

  html.onMessage(
    async (
      event
    ) => {
      const data =
        normalizarMensagem(
          event.data
        );

      const type =
        safe(
          data.type ||
          data.tipo
        ).toUpperCase();

      switch (type) {
        case "READY":
          liberarHtml();
          return;

        case "FECHAR":
        case "CLOSE":
          voltarParaPaginaAnterior();
          return;

        case "ACCESS_ACK":
          concluirAviso(
            data.action ||
            "CLOSE"
          );
          return;

        case "CHECK_CUSTOMER":
          await consultarCliente(
            data
          );
          return;

        case "CREATE_CUSTOMER":
          await cadastrarCliente(
            data
          );
          return;

        case "SUBMIT_PRO":
        case "CREATE_PIX":
          await enviarClienteExistente(
            data
          );
          return;

        case "CHECK_PIX":
          await consultarPixAgora();
          return;

        default:
          return;
      }
    }
  );

  /*
    Compatibilidade com HTML
    que não envie READY.

    O INIT é enviado uma única vez.
  */

  setTimeout(
    liberarHtml,
    900
  );
});
