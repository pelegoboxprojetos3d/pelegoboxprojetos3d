// TÍTULO NO WIX: backend/http-functions.js
// VERSÃO: R8 - CAMPOS CANÔNICOS + IDEMPOTÊNCIA + 4 GRÁFICOS

import {
  ok,
  forbidden,
  badRequest,
  serverError
} from "wix-http-functions";
import wixData from "wix-data";
import { createHmac, timingSafeEqual } from "crypto";
import { fetch } from "wix-fetch";
import { getSecret } from "wix-secrets-backend";
import { checkAbandoned } from "backend/checkAbandoned";
import { importarImagensProjetoPronto } from "backend/processarImagensProjetosProntos";
import { processarCompraProjetoPronto } from "backend/processarCompraProjetoPronto";
import { notificarVendaProjetoProntoAprovada } from "backend/notificarVendaProjetoPronto";

const DB_OPTS = {
  suppressAuth: true
};

// ======================================================
// PROJETOS FEITOS DO ZERO - FLUXO ANTIGO
// ======================================================

const COLLECTION = "MpSessions";

const WHATSAPP_WEBHOOK_VENDA =
  "https://backend.respondechat.ai/webhook/1455/4PoYMna8Z0S0GL8W0tXGMB7lgmWnMfaxW3NesVkPaN";

const MAKE_WEBHOOK =
  "https://hook.us2.make.com/osvbc5a9x3g2g5pufjdajg27quany57b";

// ======================================================
// PROJETOS PRONTOS
// ======================================================

const SESSIONS_PRO_COLLECTION =
  "SessoesProjetosProntos2";

const PURCHASES_COLLECTION =
  "ComprasProjetos";

const CLIENTS_COLLECTION =
  "Campo";

const MAKE_PRO_SECRET =
  "MAKE_WEBHOOK_PROJETOS_PRONTOS";

const IMPORT_SECRET =
  "PROJETOS_PRONTOS_IMPORT_KEY";

const VALIDAPAY_WEBHOOK_AUTH_SECRET =
  "VALIDAPAY_WEBHOOK_TOKEN";

const VALIDAPAY_WEBHOOK_SIGNING_SECRET =
  "VALIDAPAY_WEBHOOK_SIGNING_SECRET";

const VALIDAPAY_AUTH_URL =
  "https://oauth2.validapay.com.br/auth/token";

const VALIDAPAY_API_BASE =
  "https://api.validapay.com.br";

// ======================================================
// FUNÇÕES GERAIS
// ======================================================

function safe(value) {
  return String(value ?? "").trim();
}

function onlyDigits(value) {
  return safe(value).replace(/\D/g, "");
}

function normalizeEmail(value) {
  return safe(value).toLowerCase();
}

function normalizeWhatsapp(value) {
  let digits = onlyDigits(value);

  /*
    Proteção para sessões antigas gravadas como
    +1 + 55DDDNÚMERO pelo HTML do checkout.
  */
  if (
    digits.startsWith("155") &&
    (
      digits.length === 13 ||
      digits.length === 14
    )
  ) {
    digits = digits.slice(1);
  }

  return digits
    ? `+${digits}`
    : "";
}

function normalizeWhatsappFromItem(item) {
  const explicit = safe(
    item?.whatsappE164 ||
    item?.whatsApp ||
    item?.whatsapp
  );

  if (explicit) {
    return normalizeWhatsapp(explicit);
  }

  const ddi = onlyDigits(
    item?.ddi ||
    item?.countryCode
  );

  const number = onlyDigits(
    item?.whatsappDigits
  );

  if (ddi && number) {
    return normalizeWhatsapp(
      `+${ddi}${number}`
    );
  }

  return number
    ? normalizeWhatsapp(number)
    : "";
}

/*
  Padrão exclusivo dos Projetos Prontos:
  +55 + DDD + número.

  O helper antigo acima é preservado porque também
  atende ao fluxo de Projetos Feitos do Zero.
*/
function normalizeWhatsappBrasil(value) {
  let number = onlyDigits(value);

  if (
    number.startsWith("55") &&
    (
      number.length === 12 ||
      number.length === 13
    )
  ) {
    number = number.slice(2);
  }

  if (
    number.length !== 10 &&
    number.length !== 11
  ) {
    return "";
  }

  return `+55${number}`;
}

function normalizeWhatsappProjetoProntoFromItem(
  item
) {
  const explicit = safe(
    item?.whatsapp ||
    item?.whatsappE164 ||
    item?.whatsApp
  );

  if (explicit) {
    return normalizeWhatsappBrasil(
      explicit
    );
  }

  const ddi = onlyDigits(
    item?.ddi ||
    item?.countryCode ||
    "55"
  );

  const number = onlyDigits(
    item?.whatsappDigits
  );

  if (!number) {
    return "";
  }

  return normalizeWhatsappBrasil(
    `${ddi}${number}`
  );
}

function normalizeCpfCnpj(value) {
  const document = onlyDigits(value);

  return (
    document.length === 11 ||
    document.length === 14
  )
    ? document
    : "";
}

function formatPublicProjectCode(value) {
  const code = onlyDigits(value);

  if (!code) {
    return "";
  }

  const number = Number(code);

  if (!Number.isFinite(number)) {
    return code;
  }

  return number <= 100
    ? String(number).padStart(3, "0")
    : String(number);
}

function moneyBR(value) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "0,00";
  }

  return number
    .toFixed(2)
    .replace(".", ",");
}

function formatDateTimeBR(value) {
  const date = value instanceof Date
    ? value
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) =>
    String(number).padStart(2, "0");

  return (
    `${pad(date.getDate())}/` +
    `${pad(date.getMonth() + 1)}/` +
    `${date.getFullYear()} ` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}:` +
    `${pad(date.getSeconds())}`
  );
}

function normalizeProductType(value) {
  const type = safe(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (
    type === "MEDIDA" ||
    type === "MEDIDAS"
  ) {
    return "MEDIDAS";
  }

  if (
    type === "GRAFICO" ||
    type === "GRAFICOS"
  ) {
    return "GRAFICOS";
  }

  if (
    type === "PROJETO" ||
    type === "COMPLETO" ||
    type === "PROJETO_COMPLETO"
  ) {
    return "PROJETO_COMPLETO";
  }

  return "MEDIDAS";
}

function generateDeliveryToken() {
  return (
    "entpro_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(16).slice(2) +
    Math.random().toString(16).slice(2)
  );
}

function purchaseKey(
  clientId,
  projectCode
) {
  const client = safe(clientId);
  const project = onlyDigits(projectCode);

  return client && project
    ? `${client}_${project}`
    : "";
}

function mediaValueExists(value) {
  if (!value) {
    return false;
  }

  if (typeof value === "string") {
    return Boolean(value.trim());
  }

  if (typeof value === "object") {
    return Boolean(
      safe(value.src) ||
      safe(value.url) ||
      safe(value.fileUrl)
    );
  }

  return false;
}

function readHeader(
  request,
  headerName
) {
  const headers =
    request?.headers || {};

  const expected = safe(
    headerName
  ).toLowerCase();

  for (const key of Object.keys(headers)) {
    if (
      safe(key).toLowerCase() ===
      expected
    ) {
      return safe(headers[key]);
    }
  }

  return "";
}

async function readJsonBody(request) {
  try {
    return await request.body.json();
  } catch (error) {
    console.warn(
      "Corpo JSON inválido:",
      error?.message || error
    );

    return {};
  }
}

async function fetchMercadoPagoPayment(
  paymentId
) {
  const token = await getSecret(
    "MP_ACCESS_TOKEN"
  );

  if (!token) {
    throw new Error(
      "MP_ACCESS_TOKEN ausente"
    );
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization:
          `Bearer ${token}`
      }
    }
  );

  const payment =
    await response.json();

  if (!response.ok) {
    throw new Error(
      `Mercado Pago respondeu ${response.status}: ${JSON.stringify(payment)}`
    );
  }

  return payment;
}

// ======================================================
// CHECK ABANDONADO
// ======================================================

export async function get_checkAbandon() {
  const result =
    await checkAbandoned();

  return ok({
    body: result
  });
}

// ======================================================
// WEBHOOK ANTIGO - PROJETOS FEITOS DO ZERO
// ROTA: /_functions/mercadoPagoWebhook
// ======================================================

export async function post_mercadoPagoWebhook(
  request
) {
  try {
    const body =
      await readJsonBody(request);

    const paymentId = safe(
      body?.data?.id
    );

    if (!paymentId) {
      return ok({
        body: {
          ok: true,
          ignored: true
        }
      });
    }

    const payment =
      await fetchMercadoPagoPayment(
        paymentId
      );

    const checkoutId = safe(
      payment?.external_reference
    );

    if (!checkoutId) {
      return ok({
        body: {
          ok: true,
          ignored: true
        }
      });
    }

    const sessionResult = await wixData
      .query(COLLECTION)
      .eq("checkoutId", checkoutId)
      .limit(1)
      .find(DB_OPTS);

    if (!sessionResult.items.length) {
      console.log(
        "Sessão antiga não encontrada:",
        checkoutId
      );

      return ok({
        body: {
          ok: true,
          ignored: true
        }
      });
    }

    const session =
      sessionResult.items[0];

    const status = safe(
      payment?.status
    ).toLowerCase();

    session.status =
      status || "unknown";

    session.paymentId =
      paymentId;

    await wixData.update(
      COLLECTION,
      session,
      DB_OPTS
    );

    if (
      status === "approved" &&
      session.saleSent !== true
    ) {
      const now = new Date();

      const payload = {
        event:
          "pagamento_aprovado",

        dataHora:
          formatDateTimeBR(now),

        dataISO:
          now.toISOString(),

        checkoutId:
          session.checkoutId,

        paymentId:
          session.paymentId,

        whatsapp:
          normalizeWhatsappFromItem(
            session
          ),

        produto:
          session.produto,

        sku:
          session.sku,

        img:
          session.img,

        valor:
          moneyBR(session.valor)
      };

      await fetch(
        WHATSAPP_WEBHOOK_VENDA,
        {
          method: "post",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

      await fetch(
        MAKE_WEBHOOK,
        {
          method: "post",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

      session.saleSent = true;

      await wixData.update(
        COLLECTION,
        session,
        DB_OPTS
      );
    }

    return ok({
      body: {
        ok: true,
        status
      }
    });
  } catch (error) {
    console.error(
      "MP WEBHOOK ERROR:",
      error?.message || error,
      error
    );

    return ok({
      body: {
        ok: false,
        error:
          safe(error?.message) ||
          "webhook_error"
      }
    });
  }
}

// ======================================================
// PROJETOS PRONTOS - CONSULTAS
// ======================================================

async function findProSession(
  checkoutId
) {
  const result = await wixData
    .query(SESSIONS_PRO_COLLECTION)
    .eq(
      "checkoutId",
      safe(checkoutId)
    )
    .limit(1)
    .find(DB_OPTS);

  return result.items.length
    ? result.items[0]
    : null;
}

async function findClient(
  clientId
) {
  const id = safe(clientId);

  if (!id) {
    return null;
  }

  try {
    const byId = await wixData.get(
      CLIENTS_COLLECTION,
      id,
      DB_OPTS
    );

    if (byId) {
      return byId;
    }
  } catch (error) {
    console.warn(
      "Cliente não encontrado pelo _id:",
      error?.message || error
    );
  }

  try {
    const result = await wixData
      .query(CLIENTS_COLLECTION)
      .eq("clienteId", id)
      .limit(1)
      .find(DB_OPTS);

    return result.items.length
      ? result.items[0]
      : null;
  } catch (error) {
    console.warn(
      "Cliente não encontrado por clienteId:",
      error?.message || error
    );

    return null;
  }
}

function clientName(
  client,
  session
) {
  return (
    safe(client?.nome) ||
    safe(client?.title) ||
    safe(session?.nomeCliente) ||
    normalizeEmail(session?.email)
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .trim() ||
    safe(session?.clienteId)
  );
}

async function queryOnePurchase(
  field,
  value
) {
  if (
    value === undefined ||
    value === null ||
    safe(value) === ""
  ) {
    return null;
  }

  try {
    const result = await wixData
      .query(PURCHASES_COLLECTION)
      .eq(field, value)
      .limit(1)
      .find(DB_OPTS);

    return result.items.length
      ? result.items[0]
      : null;
  } catch (error) {
    console.warn(
      `Busca de compra em ${field} falhou:`,
      error?.message || error
    );

    return null;
  }
}

async function findPurchaseForSession(
  session
) {
  const clientId = safe(
    session?.clienteId
  );

  const projectCode = onlyDigits(
    session?.codigoProjeto
  );

  const key = purchaseKey(
    clientId,
    projectCode
  );

  if (key) {
    const byKey = await queryOnePurchase(
      "chaveCompra",
      key
    );

    if (byKey) {
      return byKey;
    }
  }

  if (
    clientId &&
    projectCode
  ) {
    try {
      const byText = await wixData
        .query(PURCHASES_COLLECTION)
        .eq("clienteId", clientId)
        .eq(
          "codigoProjeto",
          projectCode
        )
        .limit(1)
        .find(DB_OPTS);

      if (byText.items.length) {
        return byText.items[0];
      }
    } catch (error) {
      console.warn(
        "Busca cliente + projeto texto falhou:",
        error?.message || error
      );
    }

    const projectNumber =
      Number(projectCode);

    if (
      Number.isSafeInteger(
        projectNumber
      )
    ) {
      try {
        const byNumber = await wixData
          .query(PURCHASES_COLLECTION)
          .eq("clienteId", clientId)
          .eq(
            "codigoProjeto",
            projectNumber
          )
          .limit(1)
          .find(DB_OPTS);

        if (byNumber.items.length) {
          return byNumber.items[0];
        }
      } catch (error) {
        console.warn(
          "Busca cliente + projeto número falhou:",
          error?.message || error
        );
      }
    }
  }

  const email = normalizeEmail(
    session?.email
  );

  if (
    email &&
    projectCode
  ) {
    try {
      const byEmail = await wixData
        .query(PURCHASES_COLLECTION)
        .eq("email", email)
        .eq(
          "codigoProjeto",
          projectCode
        )
        .limit(1)
        .find(DB_OPTS);

      if (byEmail.items.length) {
        return byEmail.items[0];
      }
    } catch (error) {
      console.warn(
        "Busca e-mail + projeto falhou:",
        error?.message || error
      );
    }
  }

  return null;
}

function cumulativeAccess(
  existing,
  productType
) {
  const project =
    existing?.downloadProjeto === true ||
    productType ===
      "PROJETO_COMPLETO";

  const graphics =
    existing?.downloadGraficos === true ||
    productType === "GRAFICOS" ||
    project;

  const measures =
    existing?.downloadMedidas === true ||
    productType === "MEDIDAS" ||
    graphics;

  return {
    measures,
    graphics,
    project
  };
}

function buildPurchaseRecord({
  session,
  paymentId,
  paymentStatus,
  existing,
  client
}) {
  const productType =
    normalizeProductType(
      session?.tipoProduto
    );

  const projectCode = onlyDigits(
    session?.codigoProjeto
  );

  const publicProjectCode =
    formatPublicProjectCode(
      projectCode
    );

  const clientId = safe(
    session?.clienteId
  );

  const email = normalizeEmail(
    session?.email
  );

  const whatsapp =
    normalizeWhatsappProjetoProntoFromItem(
      session
    );

  const cpfCnpj =
    normalizeCpfCnpj(
      session?.cpfCnpj ||
      client?.cpfCnpj ||
      existing?.cpfCnpj
    );

  const checkoutId = safe(
    session?.checkoutId
  );

  const deliveryToken = safe(
    session?.tokenEntrega
  );

  const key = purchaseKey(
    clientId,
    projectCode
  );

  const name = clientName(
    client,
    session
  );

  const access = cumulativeAccess(
    existing,
    productType
  );

  const currentPaymentId = safe(
    paymentId
  );

  const previousPaymentId = safe(
    existing?.idPagamento
  );

  const samePayment = Boolean(
    existing &&
    previousPaymentId &&
    previousPaymentId ===
      currentPaymentId
  );

  const previousValue = Number(
    existing?.valor || 0
  );

  const stageValue = Number(
    session?.valor || 0
  );

  const totalValue = samePayment
    ? previousValue
    : previousValue + stageValue;

  const now = new Date();

  const record = {
    ...(existing || {}),

    title:
      `PP-${publicProjectCode || "PROJETO"} - ${name || clientId}`,

    cliente:
      safe(client?._id) ||
      existing?.cliente ||
      clientId ||
      undefined,

    clienteId: clientId,
    nomeCliente: name,
    codigoProjeto: projectCode,
    chaveCompra: key,

    email:
      email ||
      normalizeEmail(existing?.email),

    whatsapp:
      whatsapp ||
      normalizeWhatsappBrasil(
        existing?.whatsapp ||
        existing?.whatsApp
      ),

    cpfCnpj,

    checkoutId,
    tokenDeEntrega: deliveryToken,

    tipoProduto: productType,
    valor: totalValue,

    dataCompra:
      existing?.dataCompra || now,

    pagamento:
      safe(
        paymentStatus ||
        existing?.pagamento ||
        "approved"
      ).toLowerCase(),

    idPagamento:
      currentPaymentId,

    downloadMedidas:
      access.measures,

    downloadGraficos:
      access.graphics,

    downloadProjeto:
      access.project,

    statusCompra:
      "approved",

    dataLiberacao:
      now,

    statusProcessamento:
      safe(
        existing?.statusProcessamento
      ) || "PENDENTE"
  };

  /*
    Remove o identificador antigo antes de gravar.
    O campo oficial em ComprasProjetos é whatsapp.
  */
  delete record.whatsApp;

  return record;
}

async function registerPurchase({
  session,
  paymentId,
  paymentStatus,
  client
}) {
  const existing =
    await findPurchaseForSession(
      session
    );

  const record = buildPurchaseRecord({
    session,
    paymentId,
    paymentStatus,
    existing,
    client
  });

  if (existing) {
    const updated = await wixData.update(
      PURCHASES_COLLECTION,
      record,
      DB_OPTS
    );

    return {
      purchase: updated,
      created: false
    };
  }

  const inserted = await wixData.insert(
    PURCHASES_COLLECTION,
    record,
    DB_OPTS
  );

  return {
    purchase: inserted,
    created: true
  };
}

function processingIsStale(
  purchase
) {
  const date = new Date(
    purchase?.dataProcessamento ||
    purchase?._updatedDate ||
    0
  );

  if (Number.isNaN(date.getTime())) {
    return true;
  }

  return (
    Date.now() - date.getTime()
  ) > 10 * 60 * 1000;
}

function shouldTriggerMake(
  purchase
) {
  if (!purchase) {
    return true;
  }

  const status = safe(
    purchase?.statusProcessamento
  ).toUpperCase();

  const productType =
    normalizeProductType(
      purchase?.tipoProduto
    );

  const hasMeasures =
    mediaValueExists(
      purchase?.imagemMedidas
    );

  const hasGraphics = [
    purchase?.imagemGrafico1,
    purchase?.imagemGrafico2,
    purchase?.imagemGrafico3,
    purchase?.imagemGrafico4
  ].some(
    mediaValueExists
  );

  const hasProject =
    mediaValueExists(
      purchase?.arquivoProjeto
    );

  const hasRequiredAssets =
    productType === "PROJETO_COMPLETO"
      ? (
        hasMeasures &&
        hasGraphics &&
        hasProject
      )
      : productType === "GRAFICOS"
        ? (
          hasMeasures &&
          hasGraphics
        )
        : hasMeasures;

  if (
    status === "PROCESSADO" &&
    hasRequiredAssets
  ) {
    return false;
  }

  if (
    status === "PROCESSANDO" &&
    !processingIsStale(purchase)
  ) {
    return false;
  }

  return true;
}

async function updateProcessingStatus(
  purchase,
  status
) {
  if (!purchase?._id) {
    return purchase;
  }

  return wixData.update(
    PURCHASES_COLLECTION,
    {
      ...purchase,
      statusProcessamento: status,
      dataProcessamento: new Date()
    },
    DB_OPTS
  );
}

function buildMakePayload({
  session,
  purchase,
  paymentId,
  client
}) {
  const projectCode = onlyDigits(
    session?.codigoProjeto
  );

  const clientId = safe(
    session?.clienteId
  );

  return {
    event:
      "pagamento_aprovado_projeto_pronto",

    clienteId: clientId,

    nomeCliente:
      clientName(client, session),

    email:
      normalizeEmail(session?.email),

    whatsapp:
      normalizeWhatsappProjetoProntoFromItem(
        session
      ),

    cpfCnpj:
      normalizeCpfCnpj(
        session?.cpfCnpj ||
        client?.cpfCnpj
      ),

    codigoProjeto:
      projectCode,

    produto:
      safe(session?.produto),

    tipoProduto:
      normalizeProductType(
        session?.tipoProduto
      ),

    valor:
      Number(purchase?.valor || 0),

    pagamento:
      "approved",

    statusCompra:
      "approved",

    idPagamento:
      safe(paymentId),

    checkoutId:
      safe(session?.checkoutId),

    tokenDeEntrega:
      safe(session?.tokenEntrega),

    chaveCompra:
      purchaseKey(
        clientId,
        projectCode
      )
  };
}

async function triggerMake({
  session,
  purchase,
  paymentId,
  client
}) {
  if (!shouldTriggerMake(purchase)) {
    return {
      sent: false,
      skipped: true,
      reason:
        "already_processed_or_processing"
    };
  }

  const webhookUrl = safe(
    await getSecret(
      MAKE_PRO_SECRET
    )
  );

  if (!webhookUrl) {
    return {
      sent: false,
      skipped: false,
      error:
        "make_secret_missing"
    };
  }

  const processingPurchase =
    await updateProcessingStatus(
      purchase,
      "PROCESSANDO"
    );

  const payload = buildMakePayload({
    session,
    purchase: processingPurchase,
    paymentId,
    client
  });

  try {
    const response = await fetch(
      webhookUrl,
      {
        method: "post",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const text =
        await response.text();

      await updateProcessingStatus(
        processingPurchase,
        "PENDENTE"
      );

      console.error(
        "Make recusou o webhook:",
        response.status,
        text
      );

      return {
        sent: false,
        skipped: false,
        error:
          "make_http_error",
        status:
          response.status
      };
    }

    return {
      sent: true,
      skipped: false
    };
  } catch (error) {
    await updateProcessingStatus(
      processingPurchase,
      "PENDENTE"
    );

    console.error(
      "Erro ao chamar Make:",
      error?.message || error,
      error
    );

    return {
      sent: false,
      skipped: false,
      error:
        "make_fetch_error"
    };
  }
}

// ======================================================
// WEBHOOK DE PROJETOS PRONTOS
// ROTA: /_functions/mercadoPagoWebhookPro
// ======================================================

export async function post_mercadoPagoWebhookPro(
  request
) {
  try {
    const body =
      await readJsonBody(request);

    const paymentId = safe(
      body?.data?.id
    );

    if (!paymentId) {
      return ok({
        body: {
          ok: true,
          ignored: true
        }
      });
    }

    const payment =
      await fetchMercadoPagoPayment(
        paymentId
      );

    const checkoutId = safe(
      payment?.external_reference
    );

    if (!checkoutId) {
      return ok({
        body: {
          ok: true,
          ignored: true
        }
      });
    }

    const session =
      await findProSession(
        checkoutId
      );

    if (!session) {
      console.log(
        "Sessão de projeto pronto não encontrada:",
        checkoutId
      );

      return ok({
        body: {
          ok: true,
          ignored: true
        }
      });
    }

    const paymentStatus = safe(
      payment?.status
    ).toLowerCase();

    session.status =
      paymentStatus || "unknown";

    session.paymentId =
      paymentId;

    session.updatedAtDate =
      new Date();

    if (
      paymentStatus !==
      "approved"
    ) {
      await wixData.update(
        SESSIONS_PRO_COLLECTION,
        session,
        DB_OPTS
      );

      return ok({
        body: {
          ok: true,
          status: paymentStatus
        }
      });
    }

    if (!safe(session.tokenEntrega)) {
      session.tokenEntrega =
        generateDeliveryToken();
    }

    session.whatsapp =
      normalizeWhatsappProjetoProntoFromItem(
        session
      );

    session.produto = safe(session.produto);
    delete session.sku;

    session.cpfCnpj =
      normalizeCpfCnpj(
        session.cpfCnpj
      );

    delete session.whatsApp;
    delete session.whatsappE164;

    const client = await findClient(
      session.clienteId
    );

    const purchaseResult =
      await registerPurchase({
        session,
        paymentId,
        paymentStatus,
        client
      });

    session.compraRegistrada = true;
    session.updatedAtDate = new Date();

    await wixData.update(
      SESSIONS_PRO_COLLECTION,
      session,
      DB_OPTS
    );

    const makeResult =
      await triggerMake({
        session,
        purchase:
          purchaseResult.purchase,
        paymentId,
        client
      });

    return ok({
      body: {
        ok: true,
        approved: true,
        checkoutId,

        purchaseId: safe(
          purchaseResult
            .purchase
            ?._id
        ),

        compraCriada:
          purchaseResult.created,

        tokenEntrega: safe(
          session.tokenEntrega
        ),

        make:
          makeResult,
        notification:
          notificationResult
      }
    });
  } catch (error) {
    console.error(
      "MP PRO WEBHOOK ERROR:",
      error?.message || error,
      error
    );

    return ok({
      body: {
        ok: false,
        error:
          safe(error?.message) ||
          "webhook_pro_error"
      }
    });
  }
}

// ======================================================
// WEBHOOK VALIDAPAY - PROJETOS PRONTOS
// ROTA: /_functions/validaPayWebhookPro
// ======================================================

async function readHttpResponse(
  response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    return {
      raw: text
    };
  }
}

async function getValidaPayToken() {
  const clientId = safe(
    await getSecret(
      "VALIDAPAY_CLIENT_ID"
    )
  );

  const clientSecret = safe(
    await getSecret(
      "VALIDAPAY_CLIENT_SECRET"
    )
  );

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Credenciais da ValidaPay ausentes."
    );
  }

  const scopes = [
    "pix.cob/read",
    "checkouts/read"
  ].join(" ");

  const body = [
    "grant_type=client_credentials",

    `client_id=${encodeURIComponent(
      clientId
    )}`,

    `client_secret=${encodeURIComponent(
      clientSecret
    )}`,

    `scope=${encodeURIComponent(
      scopes
    )}`
  ].join("&");

  const response = await fetch(
    VALIDAPAY_AUTH_URL,
    {
      method: "post",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },

      body
    }
  );

  const data =
    await readHttpResponse(
      response
    );

  if (
    !response.ok ||
    !safe(data?.access_token)
  ) {
    throw new Error(
      safe(
        data?.error_description ||
        data?.message ||
        data?.error ||
        data?.raw
      ) ||
      `Autenticação ValidaPay recusada. HTTP ${response.status}.`
    );
  }

  return safe(
    data.access_token
  );
}

async function fetchValidaPayCheckout(
  chargeId
) {
  const id = safe(
    chargeId
  );

  if (!id) {
    return null;
  }

  const accessToken =
    await getValidaPayToken();

  const response = await fetch(
    `${VALIDAPAY_API_BASE}/v1/checkouts/${encodeURIComponent(id)}`,
    {
      method: "get",

      headers: {
        Authorization:
          `Bearer ${accessToken}`
      }
    }
  );

  const data =
    await readHttpResponse(
      response
    );

  if (!response.ok) {
    console.error(
      "Consulta do checkout ValidaPay falhou:",
      response.status,
      data
    );

    return null;
  }

  return data;
}

async function findSessionByField(
  field,
  value
) {
  const normalized = safe(
    value
  );

  if (!normalized) {
    return null;
  }

  try {
    const result = await wixData
      .query(
        SESSIONS_PRO_COLLECTION
      )
      .eq(
        field,
        normalized
      )
      .limit(1)
      .find(DB_OPTS);

    return result.items.length
      ? result.items[0]
      : null;
  } catch (error) {
    console.warn(
      `Busca da sessão por ${field} falhou:`,
      error?.message || error
    );

    return null;
  }
}

async function findLatestPendingSessionByPrice({
  priceId,
  amount
}) {
  const id = safe(priceId);

  if (!id) {
    return null;
  }

  try {
    const result = await wixData
      .query(
        SESSIONS_PRO_COLLECTION
      )
      .eq(
        "validaPayPriceId",
        id
      )
      .descending(
        "createdAtDate"
      )
      .limit(100)
      .find(DB_OPTS);

    const expectedAmount = Number(
      amount || 0
    );

    const candidates =
      result.items.filter(
        (item) => (
          item?.compraRegistrada !== true &&
          safe(item?.status)
            .toLowerCase() !==
            "approved"
        )
      );

    if (expectedAmount > 0) {
      const sameAmount =
        candidates.find(
          (item) => (
            Math.abs(
              Number(item?.valor || 0) -
              expectedAmount
            ) <= 0.01
          )
        );

      if (sameAmount) {
        return sameAmount;
      }
    }

    return candidates.length
      ? candidates[0]
      : null;
  } catch (error) {
    console.warn(
      "Busca segura da sessão por priceId falhou:",
      error?.message || error
    );

    return null;
  }
}

async function findValidaPaySession(
  body = {}
) {
  const chargeId = safe(
    body?.chargeId
  );

  /*
    Fluxo transparente:
    o chargeId é salvo no momento em que o PIX
    é criado, antes de qualquer pagamento.
  */

  if (chargeId) {
    const byCharge =
      await findSessionByField(
        "validaPayChargeId",
        chargeId
      );

    if (byCharge) {
      return byCharge;
    }
  }

  /*
    Compatibilidade caso a ValidaPay acrescente
    externalId ou metadata ao payload.
  */

  const checkoutId = safe(
    body?.externalId ||
    body?.metadata?.checkoutId ||
    body?.metadata?.externalId
  );

  if (checkoutId) {
    const byCheckoutId =
      await findProSession(
        checkoutId
      );

    if (byCheckoutId) {
      return byCheckoutId;
    }
  }

  /*
    Fluxo do checkout hospedado:
    tenta primeiro os identificadores exclusivos
    devolvidos pela API. priceId fica apenas como
    último recurso porque pode ser compartilhado
    por várias tentativas de compra.
  */

  if (chargeId) {
    const checkout =
      await fetchValidaPayCheckout(
        chargeId
      );

    const checkoutIdFromApi = safe(
      checkout?.externalId ||
      checkout?.metadata?.checkoutId ||
      checkout?.metadata?.externalId
    );

    if (checkoutIdFromApi) {
      const byCheckoutId =
        await findProSession(
          checkoutIdFromApi
        );

      if (byCheckoutId) {
        return byCheckoutId;
      }
    }

    const sessionId = safe(
      checkout?.sessionId ||
      checkout?.checkoutSessionId ||
      (
        safe(checkout?.id)
          .startsWith("cs_")
          ? checkout.id
          : ""
      )
    );

    if (sessionId) {
      const bySession =
        await findSessionByField(
          "preferenceId",
          sessionId
        );

      if (bySession) {
        return bySession;
      }
    }

    const priceId = safe(
      checkout?.priceId ||
      checkout?.price?.id ||
      checkout?.items?.[0]?.priceId
    );

    if (priceId) {
      const byPrice =
        await findLatestPendingSessionByPrice({
          priceId,

          amount:
            body?.amount ||
            body?.value
        });

      if (byPrice) {
        return byPrice;
      }
    }
  }

  return null;
}

function parseValidaPaySignature(
  signatureHeader
) {
  const parts = {};

  safe(signatureHeader)
    .split(",")
    .forEach((part) => {
      const separator =
        part.indexOf("=");

      if (separator <= 0) {
        return;
      }

      const key = safe(
        part.slice(0, separator)
      );

      const value = safe(
        part.slice(separator + 1)
      );

      if (key) {
        parts[key] = value;
      }
    });

  return {
    timestamp:
      safe(parts.t),

    signature:
      safe(parts.v1)
        .toLowerCase()
  };
}

function verifyValidaPaySignature({
  rawBody,
  signatureHeader,
  signingSecret
}) {
  const secret = safe(
    signingSecret
  );

  if (!secret) {
    return {
      ok: false,
      reason:
        "signing_secret_missing"
    };
  }

  const parsed =
    parseValidaPaySignature(
      signatureHeader
    );

  const timestampNumber =
    Number(parsed.timestamp);

  if (
    !parsed.timestamp ||
    !Number.isFinite(
      timestampNumber
    )
  ) {
    return {
      ok: false,
      reason:
        "timestamp_missing"
    };
  }

  const age = Math.abs(
    Date.now() -
    timestampNumber
  );

  if (age > 5 * 60 * 1000) {
    return {
      ok: false,
      reason:
        "timestamp_expired"
    };
  }

  if (
    !/^[a-f0-9]{64}$/i.test(
      parsed.signature
    )
  ) {
    return {
      ok: false,
      reason:
        "signature_invalid_format"
    };
  }

  const expectedSignature =
    createHmac(
      "sha256",
      secret
    )
      .update(
        `${parsed.timestamp}.${rawBody}`,
        "utf8"
      )
      .digest("hex");

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "hex"
    );

  const receivedBuffer =
    Buffer.from(
      parsed.signature,
      "hex"
    );

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return {
      ok: false,
      reason:
        "signature_length_mismatch"
    };
  }

  return {
    ok:
      timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      ),

    reason:
      "signature_mismatch"
  };
}

function webhookAuthorizationIsValid(
  request,
  expectedToken
) {
  const received =
    readHeader(
      request,
      "authorization"
    );

  /*
    O token de autenticação no painel da
    ValidaPay é opcional. A assinatura HMAC
    continua obrigatória e é a proteção principal.
  */

  if (!received) {
    return true;
  }

  const expected = safe(
    expectedToken
  );

  if (!expected) {
    return false;
  }

  return (
    received === expected ||
    received ===
      `Bearer ${expected}`
  );
}

function normalizeValidaPayEvent(
  body = {}
) {
  if (
    body?.data &&
    typeof body.data ===
      "object" &&
    !Array.isArray(body.data)
  ) {
    return {
      ...body,
      ...body.data
    };
  }

  return body;
}

function isValidaPayTestEvent(
  body = {}
) {
  return (
    body?.test === true ||
    body?.isTest === true ||
    safe(body?.environment)
      .toLowerCase() === "test" ||
    safe(body?.mode)
      .toLowerCase() === "test"
  );
}

export async function post_validaPayWebhookPro(
  request
) {
  try {
    /*
      A assinatura é calculada sobre o corpo bruto.
      Portanto, o texto precisa ser lido antes do JSON.
    */

    const rawBody =
      await request.body.text();

    const signatureHeader =
      readHeader(
        request,
        "x-webhook-signature"
      );

    const signingSecret = safe(
      await getSecret(
        VALIDAPAY_WEBHOOK_SIGNING_SECRET
      )
    );

    const signatureResult =
      verifyValidaPaySignature({
        rawBody,
        signatureHeader,
        signingSecret
      });

    if (!signatureResult.ok) {
      console.error(
        "VALIDAPAY WEBHOOK: assinatura inválida.",
        signatureResult.reason
      );

      return forbidden({
        headers: {
          "Content-Type":
            "application/json"
        },

        body: {
          ok: false,
          error:
            "invalid_signature"
        }
      });
    }

    const authToken = safe(
      await getSecret(
        VALIDAPAY_WEBHOOK_AUTH_SECRET
      )
    );

    if (
      !webhookAuthorizationIsValid(
        request,
        authToken
      )
    ) {
      console.error(
        "VALIDAPAY WEBHOOK: Authorization inválido."
      );

      return forbidden({
        headers: {
          "Content-Type":
            "application/json"
        },

        body: {
          ok: false,
          error:
            "invalid_authorization"
        }
      });
    }

    let parsedBody;

    try {
      parsedBody = rawBody
        ? JSON.parse(rawBody)
        : {};
    } catch (error) {
      return badRequest({
        headers: {
          "Content-Type":
            "application/json"
        },

        body: {
          ok: false,
          error:
            "invalid_json"
        }
      });
    }

    const body =
      normalizeValidaPayEvent(
        parsedBody
      );

    const event = safe(
      body?.event ||
      body?.type
    ).toLowerCase();

    if (
      event !==
      "payment.success"
    ) {
      return ok({
        headers: {
          "Content-Type":
            "application/json"
        },

        body: {
          ok: true,
          ignored: true,
          event
        }
      });
    }

    const chargeId = safe(
      body?.chargeId ||
      body?.charge?.id ||
      (
        safe(body?.id)
          .startsWith("cha_")
          ? body.id
          : ""
      )
    );

    const paymentId = safe(
      body?.paymentId ||
      body?.payment?.id
    ) || chargeId;

    if (!chargeId) {
      throw new Error(
        "chargeId não recebido."
      );
    }

    const session =
      await findValidaPaySession({
        ...body,
        chargeId
      });

    if (!session) {
      if (
        isValidaPayTestEvent(
          body
        )
      ) {
        return ok({
          headers: {
            "Content-Type":
              "application/json"
          },

          body: {
            ok: true,
            test: true,
            ignored: true,
            reason:
              "session_not_found",
            chargeId
          }
        });
      }

      throw new Error(
        `Sessão não encontrada para ${chargeId}.`
      );
    }

    const paidAmount = Number(
      body?.amount ||
      body?.value ||
      0
    );

    const expectedAmount = Number(
      session?.valor || 0
    );

    if (
      expectedAmount > 0 &&
      paidAmount > 0 &&
      Math.abs(
        paidAmount -
        expectedAmount
      ) > 0.01
    ) {
      throw new Error(
        `Valor divergente. Esperado ${expectedAmount}, recebido ${paidAmount}.`
      );
    }

    /*
      A ValidaPay pode reenviar o mesmo evento.
      Neste caso, confirma 200 sem duplicar compra.
    */

    if (
      session.compraRegistrada === true &&
      safe(session.status)
        .toLowerCase() ===
        "approved" &&
      (
        safe(session.paymentId) ===
          paymentId ||
        safe(session.validaPayChargeId) ===
          chargeId
      )
    ) {
      return ok({
        headers: {
          "Content-Type":
            "application/json"
        },

        body: {
          ok: true,
          approved: true,
          duplicate: true,
          checkoutId:
            safe(
              session.checkoutId
            ),
          chargeId,
          paymentId
        }
      });
    }

    if (!safe(session.tokenEntrega)) {
      session.tokenEntrega =
        generateDeliveryToken();
    }

    session.status =
      "approved";

    session.paymentId =
      paymentId;

    session.validaPayChargeId =
      chargeId;

    session.nomeCliente = safe(
      body?.payer?.name ||
      body?.customer?.name ||
      session.nomeCliente
    );

    session.email = normalizeEmail(
      body?.payer?.email ||
      body?.customer?.email ||
      session.email
    );

    session.whatsapp =
      normalizeWhatsappBrasil(
        body?.payer?.phone ||
        body?.payer?.whatsapp ||
        body?.customer?.phone ||
        body?.customer?.whatsapp ||
        session.whatsapp ||
        session.whatsappE164 ||
        session.whatsApp
      );

    session.produto = safe(session.produto);
    delete session.sku;

    session.cpfCnpj =
      normalizeCpfCnpj(
        body?.payer?.documentNumber ||
        body?.payer?.cpfCnpj ||
        body?.customer?.documentNumber ||
        body?.customer?.cpfCnpj ||
        session.cpfCnpj
      );

    delete session.whatsApp;
    delete session.whatsappE164;

    session.compraRegistrada =
      false;

    session.updatedAtDate =
      new Date();

    /*
      Primeiro confirma a sessão. A página de entrega
      passa a informar que o registro está finalizando.
    */

    await wixData.update(
      SESSIONS_PRO_COLLECTION,
      session,
      DB_OPTS
    );

    const client =
      await findClient(
        session.clienteId
      );

    const purchaseResult =
      await registerPurchase({
        session,
        paymentId,
        paymentStatus:
          "approved",
        client
      });

    session.compraRegistrada =
      true;

    session.updatedAtDate =
      new Date();

    await wixData.update(
      SESSIONS_PRO_COLLECTION,
      session,
      DB_OPTS
    );

    const makeResult =
      await triggerMake({
        session,
        purchase:
          purchaseResult.purchase,
        paymentId,
        client
      });

    const notificationResult =
      await notificarVendaProjetoProntoAprovada({
        checkoutId: safe(session.checkoutId),
        chargeId,
        paymentMethod: safe(session.paymentMethod) || "VALIDAPAY"
      });

    console.log(
      "VALIDAPAY PAGAMENTO APROVADO:",
      {
        checkoutId:
          session.checkoutId,
        chargeId,
        paymentId,
        purchaseId:
          purchaseResult
            .purchase
            ?._id
      }
    );

    return ok({
      headers: {
        "Content-Type":
          "application/json"
      },

      body: {
        ok: true,
        approved: true,
        checkoutId:
          safe(
            session.checkoutId
          ),
        chargeId,
        paymentId,
        purchaseId:
          safe(
            purchaseResult
              .purchase
              ?._id
          ),
        compraCriada:
          purchaseResult.created,
        tokenEntrega:
          safe(
            session.tokenEntrega
          ),
        make:
          makeResult
      }
    });
  } catch (error) {
    console.error(
      "VALIDAPAY WEBHOOK ERROR:",
      error?.message || error,
      error
    );

    return serverError({
      headers: {
        "Content-Type":
          "application/json"
      },

      body: {
        ok: false,
        error:
          safe(error?.message) ||
          "validapay_webhook_error"
      }
    });
  }
}

// ======================================================
// ROTA ANTIGA DE IMPORTAÇÃO PARA Videosprojetos
// POST /_functions/importarImagensProjetoPronto
// ======================================================

export async function post_importarImagensProjetoPronto(
  request
) {
  try {
    const expectedKey = safe(
      await getSecret(
        IMPORT_SECRET
      )
    );

    const receivedKey = readHeader(
      request,
      "x-projetos-prontos-key"
    );

    if (
      !expectedKey ||
      !receivedKey ||
      receivedKey !== expectedKey
    ) {
      return ok({
        headers: {
          "Content-Type":
            "application/json"
        },

        body: {
          ok: false,
          error: "unauthorized"
        }
      });
    }

    const body =
      await readJsonBody(request);

    const result =
      await importarImagensProjetoPronto(
        body
      );

    return ok({
      headers: {
        "Content-Type":
          "application/json"
      },

      body: result
    });
  } catch (error) {
    console.error(
      "IMPORT IMAGES ERROR:",
      error?.message || error,
      error
    );

    return ok({
      headers: {
        "Content-Type":
          "application/json"
      },

      body: {
        ok: false,
        error:
          safe(error?.message) ||
          "import_images_error"
      }
    });
  }
}

// ======================================================
// FLUXO 034 - COMPRA E ARQUIVOS EM ComprasProjetos
// POST /_functions/processarCompraProjetoPronto
// ======================================================

export async function post_processarCompraProjetoPronto(
  request
) {
  try {
    const expectedKey = safe(
      await getSecret(
        IMPORT_SECRET
      )
    );

    const receivedKey = readHeader(
      request,
      "x-projetos-prontos-key"
    );

    if (
      !expectedKey ||
      !receivedKey ||
      receivedKey !== expectedKey
    ) {
      return ok({
        headers: {
          "Content-Type":
            "application/json"
        },

        body: {
          ok: false,
          error: "unauthorized"
        }
      });
    }

    const body =
      await readJsonBody(request);

    const result =
      await processarCompraProjetoPronto(
        body
      );

    return ok({
      headers: {
        "Content-Type":
          "application/json"
      },

      body: result
    });
  } catch (error) {
    console.error(
      "FLUXO 034 ERROR:",
      error?.message || error,
      error
    );

    return ok({
      headers: {
        "Content-Type":
          "application/json"
      },

      body: {
        ok: false,
        error:
          safe(error?.message) ||
          "processar_compra_projeto_pronto_error"
      }
    });
  }
}
