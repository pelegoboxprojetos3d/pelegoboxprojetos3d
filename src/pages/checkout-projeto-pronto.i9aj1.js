import wixLocation from "wix-location";
import wixData from "wix-data";
import { local, session } from "wix-storage-frontend";
import { criarCliente, buscarClienteCadastrado } from "backend/clientes.web";
import { criarCobrancaPixTransparente, consultarCobrancaPix } from "backend/validaPayPixProjetosProntos.jsw";
import { criarCobrancaCartaoTransparente, consultarCobrancaCartaoTransparente } from "backend/validaPayCartaoProjetosProntosSeguro.jsw";
import { obterAcessosProjeto, buscarEntregaProjetoPronto } from "backend/entregaProjetosProntos.jsw";

const CUSTOM_ID = "#checkoutProntoCustom";
const PROJECTS_COLLECTION = "Videosprojetos";
const SESSION_KEY = "pp_identificacao_atual";
const LOCAL_KEY = "pp_identificacao_persistente";
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

const safe = v => String(v ?? "").trim();
const digits = v => safe(v).replace(/\D/g, "");
const email = v => safe(v).toLowerCase();
const waitTimeout = (p, ms, m) => Promise.race([p, new Promise((_,r)=>setTimeout(()=>r(new Error(m)),ms))]);

function phone(v) {
  let n = digits(v);
  if (n.startsWith("55") && (n.length === 12 || n.length === 13)) n = n.slice(2);
  return n.length === 10 || n.length === 11 ? n : "";
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
    phone(value?.whatsappE164 || value?.whatsapp) &&
    safe(value?.nome || value?.nomeCliente).replace(/\s+/g," ").length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email(value?.email)) &&
    validCpf(value?.cpfCnpj || value?.cpf)
  );
}

async function hydrateReturningCustomer() {
  const n = phone(ctx.whatsappE164 || ctx.whatsapp);
  if (!n) {
    ctx.skipIdentity = false;
    return;
  }

  /*
    Segurança da primeira compra:
    dados completos existentes apenas no storage do navegador não autorizam
    pular Nome/CPF/e-mail. O pulo só acontece depois de confirmar um cadastro
    completo recuperado pelo backend para este WhatsApp.
  */
  ctx.skipIdentity = false;

  try {
    const found = await waitTimeout(buscarClienteCadastrado(n), 3500, "");
    if (!found) return;

    customer = found;
    const id = safe(found._id || found.clienteId);
    const cadastroBackend = {
      whatsapp:n,
      whatsappE164:`+55${n}`,
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
      whatsappE164:`+55${n}`,
      whatsappConfirmado:true
    });
    ctx.skipIdentity = true;
  } catch (_) {
    ctx.skipIdentity = false;
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
  const n = phone(next.whatsappE164 || next.whatsapp);
  if (n) {
    next.whatsapp=n; next.whatsappE164=`+55${n}`; next.ddi="55"; next.country="br";
  }
  const raw = JSON.stringify(next);
  try { session.setItem(SESSION_KEY,raw); } catch(_) {}
  try { local.setItem(LOCAL_KEY,raw); } catch(_) {}
  ctx = { ...ctx, ...next };
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
  const s=savedIdentity();
  const project=digits(q.codigoProjeto || q.ordemVideo || q.codigo);
  const number=phone(s.whatsappE164 || s.whatsapp);
  const product=safe(q.tituloOriginal || q.titulo || q.produto || q.name || "Projeto Pronto");
  return {
    codigoProjeto:project,
    produto:product,
    titulo:product,
    productId:safe(q.productId),
    img:safe(q.imagem || q.img),
    imagem:safe(q.imagem || q.img),
    valor:Number(q.valor || q.price || 0),
    price:Number(q.valor || q.price || 0),
    tipoProduto:safe(q.tipoProduto || "MEDIDAS").toUpperCase(),
    whatsapp:number,
    whatsappE164:number ? `+55${number}` : "",
    ddi:"55", country:"br",
    clienteId:safe(s.clienteId),
    nome:safe(s.nome || s.nomeCliente),
    email:email(s.email),
    cpfCnpj:cpf(s.cpfCnpj || s.cpf),
    whatsappConfirmado:s.whatsappConfirmado === true,
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
    ctx.titulo = tituloReal;
    ctx.produto = tituloReal;
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
    requiredFields:{name:true,email:true,cpfCnpj:true},
    ctx:{...ctx}
  });
}

function basePayload(data={}) {
  const n=phone(data.whatsappE164 || data.whatsapp || ctx.whatsappE164 || ctx.whatsapp);
  return {
    checkoutId,
    clienteId:safe(data.clienteId || customer?._id || customer?.clienteId || ctx.clienteId),
    nomeCliente:safe(data.nome || ctx.nome),
    nome:safe(data.nome || ctx.nome),
    email:email(data.email || ctx.email),
    cpfCnpj:cpf(data.cpfCnpj || ctx.cpfCnpj),
    whatsapp:n,
    whatsappE164:n ? `+55${n}` : "",
    ddi:"55", country:"br",
    codigoProjeto:ctx.codigoProjeto,
    tipoProduto:ctx.tipoProduto,
    produto:ctx.produto,
    valor:ctx.valor,
    img:ctx.img,
    returnUrl:ctx.returnUrl,
    ctx:{...ctx}
  };
}

function avisarDadosSalvos(payload) {
  post({type:"CUSTOMER_READY",...payload});
  post({type:"DATA_SAVED",...payload});
  post({type:"PAYMENT_READY",...payload});
  post({type:"SHOW_PAYMENT",...payload});
}

async function saveCustomer(data={}) {
  if (busy) return;
  const n=phone(data.whatsappE164 || data.whatsapp || ctx.whatsappE164 || ctx.whatsapp);
  const name=safe(data.nome || data.nomeCliente).replace(/\s+/g," ");
  const mail=email(data.email);
  const document=cpf(data.cpfCnpj || data.cpf);
  if(!n) return post({type:"CUSTOMER_RESULT",ok:false,error:"WhatsApp inválido."});
  if(name.length<3) return post({type:"CUSTOMER_RESULT",ok:false,error:"Informe seu nome completo."});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(mail)) return post({type:"CUSTOMER_RESULT",ok:false,error:"Informe um e-mail válido."});
  if(!validCpf(document)) return post({type:"CUSTOMER_RESULT",ok:false,error:"Informe um CPF válido."});

  busy=true;
  try {
    customer=await waitTimeout(criarCliente({
      whatsapp:`+55${n}`, nome:name, email:mail, cpfCnpj:document, origem:"CHECKOUT_PROJETOS_PRONTOS"
    }),8000,"O cadastro demorou para responder.");
    if(!customer) throw new Error("Não foi possível salvar o cadastro.");

    const id=safe(customer._id || customer.clienteId);
    saveIdentity({
      clienteId:id, nome:safe(customer.nome || name), email:email(customer.email || mail),
      cpfCnpj:cpf(customer.cpfCnpj || document), whatsapp:n, whatsappE164:`+55${n}`,
      whatsappConfirmado:true
    });

    try {
      const a=await waitTimeout(obterAcessosProjeto({
        codigoProjeto:ctx.codigoProjeto, clienteId:id, email:ctx.email, whatsapp:n
      }),3500,"");
      const access=a?.access || {};
      const bought=ctx.tipoProduto==="GRAFICOS" ? access.graficos===true :
        ctx.tipoProduto==="PROJETO_COMPLETO" ? access.projeto===true : access.medidas===true;
      if(bought) {
        post({type:"ALREADY_PURCHASED",ok:true,tipoProduto:ctx.tipoProduto,access});
        return;
      }
    } catch(_) {}

    avisarDadosSalvos({
      ok:true,exists:true,clienteId:id,
      nome:ctx.nome,email:ctx.email,cpfCnpj:ctx.cpfCnpj,
      whatsapp:ctx.whatsapp,whatsappE164:ctx.whatsappE164,
      autoPayment:false
    });
  } catch(e) {
    console.error("saveCustomer:",e?.message||e);
    post({type:"CUSTOMER_RESULT",ok:false,error:e?.message||"Não foi possível salvar os dados."});
  } finally { busy=false; }
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
    if(statusResult?.approved === true) {
      const delivery = await waitTimeout(buscarEntregaProjetoPronto({checkoutId}),4500,"");
      if(deliveryReady(delivery)) {
        stopCardPoll();
        post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,deliveryUrl:deliveryUrl()});
        setTimeout(()=>wixLocation.to(deliveryUrl()),650);
        return;
      }
      post({type:"CARD_RESULT",ok:true,accepted:true,approved:false,paymentApproved:true,processing:true,checkoutId,chargeId,status:cardStatus || "paid",error:"Pagamento aprovado. Preparando sua entrega e os e-mails..."});
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
      setTimeout(()=>wixLocation.to(deliveryUrl()),850);
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
      installments:Number(data.installments||1),
      cardDocument:digits(data.cardDocument || ctx.cpfCnpj)
    }),25000,"A operadora demorou para responder. Aguarde antes de tentar novamente.");
    if(r?.chargeId) chargeId=safe(r.chargeId);
    const accepted=cardWasAccepted(r);
    const paymentApproved=r?.approved===true;
    post({
      type:"CARD_RESULT",ok:accepted || r?.ok===true,accepted,approved:false,paymentApproved,
      processing:accepted || paymentApproved,checkoutId,chargeId,status:safe(r?.status),
      cardBrand:safe(r?.cardBrand),cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),
      error:accepted ? (paymentApproved ? "Pagamento aprovado. Preparando sua entrega e os e-mails..." : "Pagamento recebido. Aguardando confirmação...") : (r?.error||"")
    });
    if(accepted || paymentApproved) {
      cardPolling=true;
      pollCardDelivery(1).catch(console.error);
    }
  } catch(e) {
    post({type:"CARD_RESULT",ok:false,approved:false,accepted:false,error:e?.message||"Não foi possível processar o cartão."});
  } finally { cardRequestBusy=false; }
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
    if(type==="READY"){checkoutUiReady=true;sendInit();return;}
    if(type==="SAVE_CUSTOMER" || type==="CREATE_CUSTOMER"){saveCustomer(data).catch(console.error);return;}
    if(type==="CREATE_PIX" || type==="SUBMIT_PRO"){createPix(data).catch(console.error);return;}
    if(type==="CREATE_CARD"){createCard(data).catch(console.error);return;}
    if(type==="CHECK_PIX"){if(!polling){polling=true;pollPix(1).catch(console.error)}return;}
    if(["CLOSE","BACK","CANCEL","ACCESS_ACK"].includes(type)){back();return;}
  });
  Promise.allSettled([
    completarContextoPelaColecao(),
    hydrateReturningCustomer()
  ])
    .finally(() => {
      contextReady=true;
      checkoutUiReady=true;
      sendInit(true);
    });
});
