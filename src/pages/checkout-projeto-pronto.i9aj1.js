import wixLocation from "wix-location";
import wixData from "wix-data";
import { local, session } from "wix-storage-frontend";
import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual } from "backend/clientes.web";
import { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";
import { criarCobrancaPixTransparente, consultarCobrancaPix } from "backend/validaPayPixProjetosProntos.jsw";
import { criarCobrancaCartaoTransparente, consultarCobrancaCartaoTransparente } from "backend/validaPayCartaoProjetosProntosSeguro.jsw";
import { obterAcessosProjeto, buscarEntregaProjetoPronto } from "backend/entregaProjetosProntos.jsw";

const CUSTOM_ID = "#checkoutProntoCustom";
const PROJECTS_COLLECTION = "Videosprojetos";
const SESSION_KEY = "pp_identificacao_atual";
const LOCAL_KEY = "pp_identificacao_persistente";
const VERIFIED_SESSION_KEY = "pp_checkout_cliente_validado_sessao";
const CHECKOUT_AUTH_KEY = "pp_checkout_autorizado";
const SOCIAL_CONFIRM_KEY = "pp_social_dados_confirmados_v1";
const CHECKOUT_AUTH_MAX_AGE = 5 * 60 * 1000;
const PIX_CREATE_TIMEOUT = 12000;
const PIX_READ_TIMEOUT = 3500;
const PIX_INTERVAL = 2000;
const PIX_MAX = 300;
const CARD_DELIVERY_INTERVAL = 1500;
const CARD_DELIVERY_MAX = 80;

let ctx = {};
let checkoutId = "";
let customer = null;
let checkoutUiReady = false;
let bridgeSeq = 0;
let contextReady = false;
let initSent = false;
let busy = false;
let cardRequestBusy = false;
let chargeId = "";
let pollTimer = null;
let polling = false;
let cardPollTimer = null;
let cardPolling = false;
let savedCardPayload = null;

const safe = v => String(v ?? "").trim();
const digits = v => safe(v).replace(/\D/g, "");
const email = v => safe(v).toLowerCase();
const waitTimeout = (p, ms, m) => Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error(m)),ms))]);

function phone(v, ddi = "55") {
  let n = digits(v);
  const d = digits(ddi) || "55";
  if (d && n.startsWith(d) && n.length > d.length + 5) n = n.slice(d.length);
  return n.length >= 6 && n.length <= 15 ? n : "";
}

function phoneE164(v, ddi = "55") {
  const d = digits(ddi) || "55";
  const n = phone(v, d);
  return n ? "+" + d + n : "";
}

function cpf(v) { return digits(v).slice(0,11); }

function validCpf(v) {
  const n = cpf(v);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s=0;
  for(let i=0;i<9;i++) s += Number(n[i])*(10-i);
  let d=(s*10)%11; if(d===10)d=0; if(d!==Number(n[9])) return false;
  s=0; for(let i=0;i<10;i++) s += Number(n[i])*(11-i);
  d=(s*10)%11; if(d===10)d=0;
  return d===Number(n[10]);
}


function identityComplete(value = ctx) {
  return Boolean(
    phone(value?.whatsappE164 || value?.whatsapp, value?.ddi || "55") &&
    safe(value?.nome || value?.nomeCliente).replace(/\s+/g," ").length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email(value?.email)) &&
    validCpf(value?.cpfCnpj || value?.cpf)
  );
}

function checkoutHandoffSnapshot(project = "", type = "") {
  try {
    const raw = session.getItem(CHECKOUT_AUTH_KEY);
    if (!raw) return null;

    const marker = JSON.parse(raw);
    if (!marker || typeof marker !== "object") return null;

    const createdAt = Number(marker.criadoEm || 0);
    const age = Date.now() - createdAt;
    if (!(createdAt > 0 && age >= 0 && age <= CHECKOUT_AUTH_MAX_AGE)) return null;
    if (digits(marker.codigoProjeto) !== digits(project)) return null;
    if (safe(marker.tipoProduto).toUpperCase() !== safe(type).toUpperCase()) return null;

    const snapshot = {
      clienteId: safe(marker.clienteId),
      nome: safe(marker.nome || marker.nomeCliente),
      email: email(marker.email),
      cpfCnpj: cpf(marker.cpfCnpj || marker.cpf),
      ddi: digits(marker.ddi || "55") || "55",
      country: safe(marker.country || "br").toLowerCase(),
      whatsapp: phone(marker.whatsappE164 || marker.whatsapp, marker.ddi || "55"),
      whatsappE164: "",
      whatsappConfirmado: marker.whatsappConfirmado === true
    };

    if (snapshot.whatsapp) snapshot.whatsappE164 = phoneE164(snapshot.whatsapp, snapshot.ddi);

    if (!snapshot.clienteId || snapshot.whatsappConfirmado !== true || !identityComplete(snapshot)) {
      return null;
    }

    return snapshot;
  } catch (_) {
    return null;
  }
}

function sessionIdentityCandidate() {
  try {
    const raw = session.getItem(SESSION_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return false;
    return Boolean(
      safe(value.clienteId) &&
      value.whatsappConfirmado === true &&
      identityComplete(value)
    );
  } catch (_) {
    return false;
  }
}

function sessionIdentityVerified(value = ctx) {
  const n = phone(value?.whatsappE164 || value?.whatsapp, value?.ddi || "55");
  if (!n || !identityComplete(value)) return false;

  try {
    const raw = session.getItem(VERIFIED_SESSION_KEY);
    if (raw) {
      const marker = JSON.parse(raw);
      if (marker?.ok === true && phone(marker.whatsapp, marker.ddi || value?.ddi || "55") === n) return true;
    }
  } catch (_) {}

  /*
    Compatibilidade com clientes já validados antes deste hotfix:
    a sessão atual já contém clienteId + dados completos + WhatsApp confirmado.
    Isso só decide a tela inicial; autorização de pagamento continua no backend.
  */
  return Boolean(
    safe(value?.clienteId) &&
    value?.whatsappConfirmado === true &&
    identityComplete(value)
  );
}

function markSessionIdentityVerified(value = ctx) {
  const n = phone(value?.whatsappE164 || value?.whatsapp, value?.ddi || "55");
  if (!n || !identityComplete(value)) return;

  try {
    session.setItem(
      VERIFIED_SESSION_KEY,
      JSON.stringify({
        ok:true,
        whatsapp:n,
        ddi:digits(value?.ddi || "55") || "55",
        clienteId:safe(value?.clienteId),
        verifiedAt:Date.now()
      })
    );
  } catch (_) {}
}

async function hydrateReturningCustomer() {
  const n = phone(ctx.whatsappE164 || ctx.whatsapp, ctx.ddi || "55");
  if (!n) {
    ctx.skipIdentity = false;
    return;
  }

  const alreadyVerifiedThisSession = sessionIdentityVerified(ctx);

  /*
    Cliente já confirmado nesta sessão entra direto no pagamento.
    A consulta ao backend continua acontecendo, mas não faz a etapa de
    identificação piscar antes de mostrar as formas de pagamento.
  */
  ctx.skipIdentity = ctx.skipIdentity === true || (alreadyVerifiedThisSession && socialDataConfirmed(ctx.email));

  try {
    const found = await waitTimeout(buscarClienteCadastrado(phoneE164(n, ctx.ddi || "55")), 3500, "");
    if (!found) return;

    customer = found;
    const id = safe(found._id || found.clienteId);
    const cadastroBackend = {
      whatsapp:n,
      whatsappE164:phoneE164(n, ctx.ddi || "55"),
      nome:safe(found.nome || found.nomeCliente),
      email:email(found.email),
      cpfCnpj:cpf(found.cpfCnpj || found.cpf)
    };

    if (!identityComplete(cadastroBackend)) return;

    saveIdentity({
      clienteId:id,
      nome:cadastroBackend.nome,
      email:cadastroBackend.email,
      cpfCnpj:cadastroBackend.cpfCnpj,
      whatsapp:n,
      whatsappE164:phoneE164(n, ctx.ddi || "55"),
      whatsappConfirmado:true
    });
    ctx.skipIdentity = ctx.skipIdentity === true || socialDataConfirmed(cadastroBackend.email);
    markSessionIdentityVerified(ctx);
  } catch (_) {
    if (!alreadyVerifiedThisSession && ctx.skipIdentity !== true) ctx.skipIdentity = false;
  }
}

function savedIdentity() {
  for (const [store,key] of [[session,SESSION_KEY],[local,LOCAL_KEY]]) {
    try {
      const raw = store.getItem(key);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v === "object") return v;
      }
    } catch (_) {}
  }
  return {};
}

function saveIdentity(patch) {
  const next = { ...savedIdentity(), ...patch };
  const ddi = digits(next.ddi || "55") || "55";
  const n = phone(next.whatsappE164 || next.whatsapp, ddi);
  if (n) {
    next.whatsapp=n;
    next.whatsappE164=phoneE164(n, ddi);
    next.ddi=ddi;
    next.country=safe(next.country || "br").toLowerCase();
  }
  const raw = JSON.stringify(next);
  try { session.setItem(SESSION_KEY,raw); } catch(_) {}
  try { local.setItem(LOCAL_KEY,raw); } catch(_) {}
  ctx = { ...ctx, ...next };
}

function socialDataConfirmed(mail) {
  const target = email(mail);
  if (!target) return false;

  for (const store of [session, local]) {
    try {
      const raw = store.getItem(SOCIAL_CONFIRM_KEY);
      if (!raw) continue;
      const marker = JSON.parse(raw);
      if (
        marker?.ok === true &&
        email(marker.email) === target
      ) {
        return true;
      }
    } catch (_) {}
  }

  return false;
}

function markSocialDataConfirmed(mail) {
  const target = email(mail);
  if (!target) return;

  const raw = JSON.stringify({
    ok: true,
    email: target,
    confirmedAt: Date.now()
  });

  try { session.setItem(SOCIAL_CONFIRM_KEY, raw); } catch (_) {}
  try { local.setItem(SOCIAL_CONFIRM_KEY, raw); } catch (_) {}
}

function mediaSource(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") {
    return safe(value.src || value.url || value.fileUrl || value.mediaUrl || value.image);
  }
  return "";
}

function contextFromUrl() {
  const q=wixLocation.query || {};
  const saved=savedIdentity();
  const project=digits(q.codigoProjeto || q.ordemVideo || q.codigo);
  const type=safe(q.tipoProduto || "MEDIDAS").toUpperCase();
  const handoff=checkoutHandoffSnapshot(project,type);
  const source=handoff || saved;
  const verifiedSession=sessionIdentityVerified(source);
  const sourceDdi=digits(source.ddi || "55") || "55";
  const sourceCountry=safe(source.country || "br").toLowerCase();
  const number=phone(source.whatsappE164 || source.whatsapp, sourceDdi);
  const product=safe(q.tituloOriginal || q.titulo || q.produto || q.name || "Projeto Pronto");
  const displayTitle=safe(q.tituloBase || q.tituloProjeto || product);
  return {
    codigoProjeto:project,
    produto:product,
    titulo:displayTitle,
    productId:safe(q.productId),
    img:safe(q.imagem || q.img),
    imagem:safe(q.imagem || q.img),
    valor:Number(q.valor || q.price || 0),
    price:Number(q.valor || q.price || 0),
    tipoProduto:type,
    whatsapp:number,
    whatsappE164:number ? phoneE164(number, sourceDdi) : "",
    ddi:sourceDdi, country:sourceCountry,
    clienteId:safe(source.clienteId),
    nome:safe(source.nome || source.nomeCliente),
    email:email(source.email),
    cpfCnpj:cpf(source.cpfCnpj || source.cpf),
    whatsappConfirmado:source.whatsappConfirmado === true,
    skipIdentity:Boolean(handoff) || (verifiedSession && socialDataConfirmed(email(source.email))),
    hideSku:true,
    returnUrl:safe(q.returnUrl) || (project ? `/checkoutprojetosprontos?codigo=${encodeURIComponent(project)}` : "/checkoutprojetosprontos")
  };
}

async function buscarProjetoCatalogo(codigoProjeto) {
  const code = digits(codigoProjeto);
  if (!code) return null;

  const numeric = Number(code);

  if (Number.isSafeInteger(numeric)) {
    try {
      const r = await wixData.query(PROJECTS_COLLECTION).eq("ordem_video", numeric).limit(1).find();
      if (r.items.length) return r.items[0];
    } catch (e) {
      console.warn("Busca numérica do projeto falhou:", e?.message || e);
    }
  }

  try {
    const r = await wixData.query(PROJECTS_COLLECTION).eq("ordem_video", code).limit(1).find();
    if (r.items.length) return r.items[0];
  } catch (e) {
    console.warn("Busca textual do projeto falhou:", e?.message || e);
  }

  try {
    const r = await wixData.query(PROJECTS_COLLECTION).startsWith("titulo_video", `#${code}`).limit(1).find();
    return r.items.length ? r.items[0] : null;
  } catch (e) {
    console.warn("Busca pelo titulo do projeto falhou:", e?.message || e);
    return null;
  }
}

async function completarContextoPelaColecao() {
  const item = await buscarProjetoCatalogo(ctx.codigoProjeto);
  if (!item) return;

  const tituloReal = safe(item.titulo_video);
  const imagemReal = mediaSource(item.thumbnail);

  if (tituloReal) {
    /*
      Videosprojetos.titulo_video é a fonte da verdade do título visual.
      Não sobrescrevemos ctx.produto, pois ele identifica a etapa comercial.
    */
    ctx.titulo = tituloReal;
    if (!safe(ctx.produto)) ctx.produto = tituloReal;
  }

  if (imagemReal) {
    ctx.img = imagemReal;
    ctx.imagem = imagemReal;
  }

  if (safe(item._id)) {
    ctx.productId = safe(item._id);
  }
}

const BANNERS_PAGAMENTO = {
  medidas: "#botao1baixarmedidas",
  graficos: "#botao2baixargraficos",
  projeto: "#botao3projetocompleto",
  importante: "#textoimportante"
};

async function alternarBannerPagamento(id, mostrar) {
  try {
    const elemento = $w(id);

    if (mostrar) {
      if (typeof elemento.expand === "function") await elemento.expand();
      if (typeof elemento.show === "function") await elemento.show();
      return;
    }

    if (typeof elemento.hide === "function") await elemento.hide();
    if (typeof elemento.collapse === "function") await elemento.collapse();
  } catch (error) {
    console.warn(`Falha ao alternar banner do pagamento ${id}:`, error?.message || error);
  }
}

async function configurarBannersPagamento(tipoProduto) {
  const tipo = safe(tipoProduto || "MEDIDAS").toUpperCase();
  const mostrarMedidas = tipo === "MEDIDAS";
  const mostrarGraficos = tipo === "MEDIDAS" || tipo === "GRAFICOS";
  const mostrarProjeto = ["MEDIDAS", "GRAFICOS", "PROJETO_COMPLETO"].includes(tipo);

  await Promise.allSettled([
    alternarBannerPagamento(BANNERS_PAGAMENTO.medidas, mostrarMedidas),
    alternarBannerPagamento(BANNERS_PAGAMENTO.graficos, mostrarGraficos),
    alternarBannerPagamento(BANNERS_PAGAMENTO.projeto, mostrarProjeto),
    alternarBannerPagamento(BANNERS_PAGAMENTO.importante, true)
  ]);
}

function deliveryUrl() {
  return `/entregaprojetosprontos?checkout_id=${encodeURIComponent(checkoutId)}&pos_pagamento=1`;
}

function abrirEntregaComFallback(delay=650) {
  const destino = deliveryUrl();
  setTimeout(() => {
    try { wixLocation.to(destino); } catch (_) {}
  }, delay);
  setTimeout(() => {
    try {
      if (safe(wixLocation.path?.[0]).toLowerCase() === "checkout-projeto-pronto") {
        wixLocation.to(destino);
      }
    } catch (_) {}
  }, delay + 1800);
}

function post(data) {
  const payload = { ...(data || {}), __bridgeSeq: ++bridgeSeq };
  try {
    $w(CUSTOM_ID).setAttribute("checkout-message", JSON.stringify(payload));
  } catch(e) {
    console.error("Custom Element post:", e?.message || e);
  }
}

function sendInit(force=false) {
  if (!contextReady) return;
  if (!checkoutUiReady && !force) return;
  if (initSent && !force) return;
  initSent=true;
  post({
    type:"INIT",
    provider:"VALIDAPAY",
    checkoutId,
    autoLookup:false,
    skipIdentity:ctx.skipIdentity === true,
    hasWhatsappFromPreviousStep:Boolean(ctx.whatsapp),
    hideSku:true,
    requiredFields:{name:true,email:false,cpfCnpj:true,whatsapp:true},
    ctx:{...ctx}
  });
}

function basePayload(data={}) {
  const ddi=digits(data.ddi || ctx.ddi || "55") || "55";
  const country=safe(data.country || ctx.country || "br").toLowerCase();
  const n=phone(data.whatsappE164 || data.whatsapp || ctx.whatsappE164 || ctx.whatsapp, ddi);
  return {
    checkoutId,
    clienteId:safe(data.clienteId || customer?._id || customer?.clienteId || ctx.clienteId),
    nomeCliente:safe(data.nome || ctx.nome),
    nome:safe(data.nome || ctx.nome),
    email:email(data.email || ctx.email),
    cpfCnpj:cpf(data.cpfCnpj || ctx.cpfCnpj),
    whatsapp:n,
    whatsappE164:n ? phoneE164(n, ddi) : "",
    ddi, country,
    codigoProjeto:ctx.codigoProjeto,
    tipoProduto:ctx.tipoProduto,
    produto:ctx.produto,
    tituloCheckout:ctx.titulo,
    valor:ctx.valor,
    img:ctx.img,
    returnUrl:ctx.returnUrl,
    ctx:{...ctx}
  };
}

function avisarDadosSalvos(payload) {
  // Um único evento é suficiente. O HTML trata os aliases antigos, mas
  // disparar quatro mensagens iguais só multiplica trabalho no Custom Element.
  post({type:"CUSTOMER_READY",...payload});
}

async function saveCustomer(data={}) {
  if (busy) return;

  const ddi = digits(data.ddi || ctx.ddi || "55") || "55";
  const country = safe(data.country || ctx.country || "br").toLowerCase();
  const n =
    phone(
      data.whatsappE164 ||
      data.whatsapp ||
      ctx.whatsappE164 ||
      ctx.whatsapp,
      ddi
    );

  const name =
    safe(
      data.nome ||
      data.nomeCliente ||
      ctx.nome
    ).replace(/\s+/g, " ");

  const document =
    cpf(
      data.cpfCnpj ||
      data.cpf ||
      ctx.cpfCnpj
    );

  if (!n) {
    return post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:"WhatsApp inválido."
    });
  }

  if (name.length < 3) {
    return post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:"Informe seu nome completo."
    });
  }

  if (!validCpf(document)) {
    return post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:"Informe um CPF válido."
    });
  }

  busy = true;

  try {
    /*
      O e-mail NÃO vem do campo do HTML. Ele é relido do membro Wix autenticado,
      portanto o usuário não consegue trocar o destino da compra no formulário.
    */
    const perfil =
      await waitTimeout(
        buscarClienteDoMembroAtual(),
        7000,
        "Não foi possível confirmar sua conta Wix."
      );

    const mail =
      email(
        perfil?.email ||
        ctx.email
      );

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(mail)) {
      throw new Error(
        "Não foi possível obter o e-mail autenticado da sua conta."
      );
    }

    customer =
      await waitTimeout(
        criarCliente({
          whatsapp:
            phoneE164(n, ddi),
          ddi,
          country,
          nome:
            name,
          email:
            mail,
          cpfCnpj:
            document,
          origem:
            "CHECKOUT_PROJETOS_PRONTOS_SOCIAL"
        }),
        8000,
        "O cadastro demorou para responder."
      );

    if (!customer) {
      throw new Error(
        "Não foi possível salvar o cadastro."
      );
    }

    const id =
      safe(
        customer._id ||
        customer.clienteId
      );

    saveIdentity({
      clienteId: id,
      nome:
        safe(
          customer.nome ||
          name
        ),
      email:
        mail,
      cpfCnpj:
        cpf(
          customer.cpfCnpj ||
          document
        ),
      whatsapp: n,
      whatsappE164:
        phoneE164(n, ddi),
      ddi,
      country,
      whatsappConfirmado: true,
      confirmacaoWhatsappVersao: 5,
      confirmadoEm:
        new Date().toISOString()
    });

    markSessionIdentityVerified(ctx);
    markSocialDataConfirmed(mail);

    try {
      const a =
        await waitTimeout(
          obterAcessosProjeto({
            codigoProjeto:
              ctx.codigoProjeto,
            clienteId:
              id,
            email:
              mail,
            whatsapp:
              digits(phoneE164(n, ddi))
          }),
          3500,
          ""
        );

      const access =
        a?.access || {};

      const bought =
        ctx.tipoProduto === "GRAFICOS"
          ? access.graficos === true
          : ctx.tipoProduto === "PROJETO_COMPLETO"
            ? access.projeto === true
            : access.medidas === true;

      if (bought) {
        post({
          type:"ALREADY_PURCHASED",
          ok:true,
          tipoProduto:ctx.tipoProduto,
          access
        });
        return;
      }
    } catch (_) {}

    avisarDadosSalvos({
      ok:true,
      exists:true,
      clienteId:id,
      nome:ctx.nome,
      email:mail,
      cpfCnpj:ctx.cpfCnpj,
      whatsapp:ctx.whatsapp,
      whatsappE164:ctx.whatsappE164,
      autoPayment:false
    });

  } catch (e) {
    console.error(
      "saveCustomer:",
      e?.message || e
    );

    post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:
        e?.message ||
        "Não foi possível salvar os dados."
    });

  } finally {
    busy = false;
  }
}

function stopPoll() {
  polling=false;
  if(pollTimer) clearTimeout(pollTimer);
  pollTimer=null;
}

function stopCardPoll() {
  cardPolling=false;
  if(cardPollTimer) clearTimeout(cardPollTimer);
  cardPollTimer=null;
}

function deliveryReady(result) {
  if (result?.approved !== true) return false;
  const project = result?.project || {};
  const status = safe(project.statusProcessamento).toUpperCase();
  if (status && !["PROCESSADO", "PARCIAL"].includes(status)) return false;
  const type = safe(result?.session?.tipoProduto || ctx.tipoProduto).toUpperCase();
  if (type === "PROJETO_COMPLETO") return Boolean(safe(project.pdfProjeto));
  if (type === "GRAFICOS") return Array.isArray(project.imagensGraficos) && project.imagensGraficos.filter(Boolean).length > 0;
  return Boolean(safe(project.imagemMedidas));
}

async function pollCardDelivery(n=1) {
  if(!cardPolling) return;
  try {
    const statusResult = await waitTimeout(consultarCobrancaCartaoTransparente({checkoutId, chargeId}),4500,"");
    if(statusResult?.chargeId) chargeId = safe(statusResult.chargeId);
    const cardStatus = safe(statusResult?.status).toLowerCase();
    const rejected = ["rejected","declined","denied","failed","cancelled","canceled","expired","refused"].includes(cardStatus);
    if(rejected || statusResult?.declined === true) {
      stopCardPoll();
      post({type:"CARD_RESULT",ok:false,approved:false,accepted:false,error:statusResult?.error || "Cartão não aprovado."});
      return;
    }
    if(statusResult?.approved === true || ["paid","approved","succeeded"].includes(cardStatus)) {
      /*
        A página de entrega já possui processamento visual e polling próprios.
        Assim que a operadora confirmar o pagamento, saímos do checkout
        imediatamente em vez de esperar Make/OneDrive terminar os arquivos.
      */
      stopCardPoll();
      post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,status:cardStatus || "paid",deliveryUrl:deliveryUrl()});
      abrirEntregaComFallback(1900);
      return;
    }
  } catch(_) {}
  if(n>=CARD_DELIVERY_MAX) {
    stopCardPoll();
    post({type:"CARD_RESULT",ok:true,accepted:true,approved:false,processing:true,checkoutId,chargeId,error:"Pagamento recebido. A entrega ainda está sendo finalizada."});
    return;
  }
  cardPollTimer=setTimeout(()=>pollCardDelivery(n+1).catch(console.error),CARD_DELIVERY_INTERVAL);
}

async function pollPix(n=1) {
  if(!polling) return;
  try {
    const r=await waitTimeout(consultarCobrancaPix({checkoutId,chargeId}),PIX_READ_TIMEOUT,"");
    if(r?.chargeId) chargeId=safe(r.chargeId);
    if(r?.ok && r?.chargeId && r?.emv) {
      post({type:"PIX_RESULT",ok:true,checkoutId,chargeId,status:r.status||"pending",
        approved:r.approved===true,amount:Number(r.amount||ctx.valor),emv:r.emv,qrCode:r.qrCode||"",deliveryUrl:deliveryUrl()});
    } else {
      post({type:"PIX_STATUS",ok:r?.ok!==false,processing:r?.processing===true,recoverable:r?.recoverable===true,
        checkoutId,chargeId,status:r?.status||"pending",approved:r?.approved===true,error:r?.error||""});
    }
    if(r?.approved===true || ["approved","paid"].includes(safe(r?.status).toLowerCase())) {
      stopPoll(); busy=false;
      post({type:"PIX_APPROVED",ok:true,checkoutId,chargeId,deliveryUrl:deliveryUrl()});
      abrirEntregaComFallback(1900);
      return;
    }
  } catch(_) {}
  if(n>=PIX_MAX) { stopPoll(); busy=false; return; }
  pollTimer=setTimeout(()=>pollPix(n+1).catch(console.error),PIX_INTERVAL);
}

async function createPix(data={}) {
  if(busy) return;
  busy=true; chargeId="";
  post({type:"PIX_LOADING",checkoutId,message:"Gerando Pix seguro..."});
  try {
    const r=await waitTimeout(criarCobrancaPixTransparente(basePayload(data)),PIX_CREATE_TIMEOUT,"A ValidaPay ainda está finalizando o Pix.");
    if(r?.chargeId) chargeId=safe(r.chargeId);
    if(r?.ok && r?.chargeId && r?.emv) {
      post({type:"PIX_RESULT",ok:true,checkoutId,chargeId,status:r.status||"pending",
        approved:r.approved===true,amount:Number(r.amount||ctx.valor),emv:r.emv,qrCode:r.qrCode||"",deliveryUrl:deliveryUrl()});
    } else if(!(r?.recoverable || r?.processing)) {
      throw new Error(r?.error || "Não foi possível gerar o Pix.");
    }
    polling=true;
    pollPix(1).catch(console.error);
  } catch(e) {
    post({type:"PIX_STATUS",ok:true,processing:true,recoverable:true,checkoutId,status:"processing",
      error:"Localizando a cobrança..."});
    polling=true;
    pollPix(1).catch(console.error);
  }
}

function cardWasAccepted(result={}) {
  const status=safe(result?.status).toLowerCase();
  const rejected=["rejected","declined","denied","failed","cancelled","canceled","expired","refused"].includes(status);
  if(rejected) return false;
  if(result?.recoverable===true && safe(result?.chargeId)) return true;
  return result?.ok===true && Boolean(safe(result?.chargeId) || status || result?.approved===true);
}

async function createCard(data={}) {
  // O formulário interno já bloqueia duplo clique. Se a ponte repetir o evento,
  // ignoramos a cópia silenciosamente em vez de exibir um erro falso.
  if(cardRequestBusy) return;
  if(polling) return post({type:"CARD_RESULT",ok:false,approved:false,accepted:false,error:"Existe um Pix aguardando pagamento nesta tentativa. Volte e gere um novo checkout para pagar com cartão."});
  cardRequestBusy=true;
  stopCardPoll();
  post({type:"CARD_LOADING",checkoutId,message:"Processando cartão com segurança..."});
  try {
    const r=await waitTimeout(criarCobrancaCartaoTransparente({
      ...basePayload(data),
      card:data.card||{},
      useSavedPaymentMethod:data.useSavedPaymentMethod===true,
      installments:Number(data.installments||1),
      cardDocument:digits(data.cardDocument || ctx.cpfCnpj)
    }),25000,"A operadora demorou para responder. Aguarde antes de tentar novamente.");
    if(r?.chargeId) chargeId=safe(r.chargeId);
    const accepted=cardWasAccepted(r);
    const paymentApproved=r?.approved===true;
    if(paymentApproved) {
      post({
        type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,
        processing:false,checkoutId,chargeId,status:safe(r?.status)||"paid",
        cardBrand:safe(r?.cardBrand),cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),
        error:"Pagamento aprovado. Abrindo sua entrega..."
      });
      abrirEntregaComFallback(1900);
      return;
    }

    post({
      type:"CARD_RESULT",ok:accepted || r?.ok===true,accepted,approved:false,paymentApproved:false,
      processing:accepted,checkoutId,chargeId,status:safe(r?.status),
      cardBrand:safe(r?.cardBrand),cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),
      error:accepted ? "Pagamento recebido. Aguardando confirmação..." : (r?.error||"")
    });
    if(accepted) {
      cardPolling=true;
      pollCardDelivery(1).catch(console.error);
    }
  } catch(e) {
    post({type:"CARD_RESULT",ok:false,approved:false,accepted:false,error:e?.message||"Não foi possível processar o cartão."});
  } finally { cardRequestBusy=false; }
}

async function carregarContextoClienteAutenticado() {
  try {
    const perfil = await waitTimeout(buscarClienteDoMembroAtual(), 5000, "");
    const cliente = perfil?.cliente && typeof perfil.cliente === "object" ? perfil.cliente : null;
    const mail = email(perfil?.email || cliente?.email || ctx.email);
    const ddi = "55";
    const n = phone(
      cliente?.whatsappE164 ||
      cliente?.whatsappNacional ||
      cliente?.whatsapp ||
      ctx.whatsappE164 ||
      ctx.whatsapp,
      ddi
    );

    const patch = {
      clienteId: safe(cliente?._id || cliente?.clienteId || ctx.clienteId),
      nome: safe(cliente?.nome || perfil?.nome || ctx.nome),
      email: mail,
      cpfCnpj: cpf(cliente?.cpfCnpj || cliente?.cpf || ctx.cpfCnpj),
      whatsapp: n,
      whatsappE164: n ? phoneE164(n, ddi) : "",
      ddi,
      country: "br"
    };

    ctx = { ...ctx, ...patch };
    saveIdentity(patch);

    /*
      REGRA MULTIDISPOSITIVO:
      se a pessoa esta autenticada na mesma conta Wix e o backend localiza um
      unico cadastro completo pelo e-mail dessa conta, nao pedimos os mesmos
      dados de novo naquele celular/navegador. A conta Wix passa a ser a ancora
      de identidade; storage local vira apenas cache, nunca fonte da verdade.
    */
    const cadastroContaCompleto = Boolean(
      patch.clienteId &&
      n &&
      identityComplete(patch)
    );

    if (cadastroContaCompleto) {
      saveIdentity({
        ...patch,
        whatsappConfirmado: true,
        confirmacaoWhatsappVersao: 5,
        confirmadoEm: new Date().toISOString()
      });

      ctx.skipIdentity = true;
      markSessionIdentityVerified(ctx);
      markSocialDataConfirmed(mail);
    }

    /*
      Antes do READY nao mandamos mensagens auxiliares, pois o Custom Element
      guarda apenas o ultimo payload pendente. Isso evita que CUSTOMER_CONTEXT
      substitua o INIT e deixe o celular preso em "Carregando checkout...".
    */
    if (checkoutUiReady) {
      post({
        type: "CUSTOMER_CONTEXT",
        ok: true,
        clienteId: ctx.clienteId,
        nome: ctx.nome,
        email: ctx.email,
        cpfCnpj: ctx.cpfCnpj,
        whatsapp: ctx.whatsapp,
        whatsappE164: ctx.whatsappE164
      });

      if (cadastroContaCompleto) {
        post({
          type: "CUSTOMER_READY",
          ok: true,
          exists: true,
          clienteId: ctx.clienteId,
          nome: ctx.nome,
          email: ctx.email,
          cpfCnpj: ctx.cpfCnpj,
          whatsapp: ctx.whatsapp,
          whatsappE164: ctx.whatsappE164,
          autoPayment: false
        });
      }
    }
  } catch (error) {
    console.warn("Contexto do cliente autenticado nao pode ser atualizado:", error?.message || error);
  }
}

async function carregarMetodoPagamentoSalvo() {
  try {
    const result = await waitTimeout(buscarMetodoPagamentoDoMembroAtual(), 5000, "");
    savedCardPayload = {
      type: "SAVED_CARD",
      existe: result?.metodo?.existe === true,
      ...(result?.metodo || {})
    };
    if (checkoutUiReady) post(savedCardPayload);
  } catch (_) {
    savedCardPayload = { type:"SAVED_CARD", existe:false };
    if (checkoutUiReady) post(savedCardPayload);
  }
}

function back() {
  stopPoll();
  stopCardPoll();
  wixLocation.to(ctx.returnUrl || "/checkoutprojetosprontos");
}

$w.onReady(function(){
  checkoutId=safe(wixLocation.query?.checkoutId) || `ckpro_${Date.now().toString(36)}_${Math.random().toString(16).slice(2,10)}`;
  ctx=contextFromUrl();
  configurarBannersPagamento(ctx.tipoProduto).catch(error => {
    console.error("Falha ao configurar banners do checkout de pagamento:", error?.message || error);
  });
  const checkout=$w(CUSTOM_ID);
  checkout.on("checkout-message", event=>{
    let data=event?.detail ?? event?.data ?? event;
    if(typeof data==="string"){ try{data=JSON.parse(data)}catch(_){data={type:data}} }
    if(data?.data && typeof data.data==="object" && !data.type) data=data.data;
    data=data && typeof data==="object" ? data : {};
    const type=safe(data.type || data.tipo || data.action).toUpperCase();
    if(type==="READY"){
      checkoutUiReady=true;

      /*
        O Custom Element pode receber mensagens antes de terminar o bridge,
        especialmente no celular. Quando ele declara READY, reenviamos o INIT
        obrigatoriamente para impedir o loader infinito.
      */
      sendInit(true);

      if(savedCardPayload)post(savedCardPayload);
      return;
    }
    if(type==="SAVE_CUSTOMER" || type==="CREATE_CUSTOMER"){saveCustomer(data).catch(console.error);return;}
    if(type==="CREATE_PIX" || type==="SUBMIT_PRO"){createPix(data).catch(console.error);return;}
    if(type==="CREATE_CARD"){createCard(data).catch(console.error);return;}
    if(type==="CHECK_PIX"){if(!polling){polling=true;pollPix(1).catch(console.error)}return;}
    if(["CLOSE","BACK","CANCEL","ACCESS_ACK"].includes(type)){back();return;}
  });
  /*
    FAST BOOT:
    o checkout visual não espera consultas de coleção/cliente.
    O contexto da URL + storage é enviado imediatamente e as consultas
    complementares continuam em paralelo, sem bloquear a renderização.
  */
  contextReady=true;
  sendInit(true);
  carregarContextoClienteAutenticado().catch(console.error);
  carregarMetodoPagamentoSalvo().catch(console.error);

  completarContextoPelaColecao()
    .then(() => {
      /*
        Se o iframe ainda não ficou pronto, atualizamos o INIT pendente.
        Se já estiver visível, atualizamos apenas título/imagem sem resetar
        identificação ou forma de pagamento.
      */
      if (!checkoutUiReady) {
        sendInit(true);
        return;
      }

      post({
        type:"PROJECT_META",
        titulo:ctx.titulo,
        imagem:ctx.imagem || ctx.img,
        codigoProjeto:ctx.codigoProjeto,
        tipoProduto:ctx.tipoProduto
      });
    })
    .catch(error => {
      console.warn("Complemento do projeto em segundo plano falhou:", error?.message || error);
    });

  hydrateReturningCustomer()
    .then(() => {
      /*
        Cliente recorrente: se a confirmação do backend terminar antes do
        iframe, substituímos o INIT pendente. Se terminar depois, avançamos
        diretamente para pagamento sem reconstruir o checkout.
      */
      if (!checkoutUiReady) {
        sendInit(true);
        return;
      }

      if (ctx.skipIdentity === true) {
        post({
          type:"CUSTOMER_READY",
          ok:true,
          exists:true,
          clienteId:safe(customer?._id || customer?.clienteId || ctx.clienteId),
          nome:ctx.nome,
          email:ctx.email,
          cpfCnpj:ctx.cpfCnpj,
          whatsapp:ctx.whatsapp,
          whatsappE164:ctx.whatsappE164
        });
      }
    })
    .catch(error => {
      console.warn("Identificação em segundo plano falhou:", error?.message || error);
    });
});