import wixLocation from "wix-location";
import { local, session } from "wix-storage-frontend";
import { criarCliente } from "backend/clientes.web";
import { criarCobrancaPixTransparente, consultarCobrancaPix } from "backend/validaPayPixProjetosProntos.jsw";
import { criarCobrancaCartaoTransparente } from "backend/validaPayCartaoProjetosProntos.jsw";
import { obterAcessosProjeto } from "backend/entregaProjetosProntos.jsw";

const HTML_ID = "#htmlCheckoutValidaPay";
const SESSION_KEY = "pp_identificacao_atual";
const LOCAL_KEY = "pp_identificacao_persistente";
const PIX_CREATE_TIMEOUT = 12000;
const PIX_READ_TIMEOUT = 3500;
const PIX_INTERVAL = 2000;
const PIX_MAX = 300;

let ctx = {};
let checkoutId = "";
let customer = null;
let htmlReady = false;
let initSent = false;
let busy = false;
let chargeId = "";
let pollTimer = null;
let polling = false;

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

function checkoutCode(v) {
  const n=digits(v);
  return n ? n.slice(-3).padStart(3,"0") : "";
}

function contextFromUrl() {
  const q=wixLocation.query || {};
  const s=savedIdentity();
  const project=digits(q.codigoProjeto || q.ordemVideo || q.codigo);
  const number=phone(s.whatsappE164 || s.whatsapp);
  const product=safe(q.titulo || q.produto || q.name || "Projeto Pronto");
  return {
    codigoProjeto:project,
    codigoCheckout:checkoutCode(q.codigoCheckout || q.productId),
    produto:product,
    titulo:product,
    sku:safe(q.sku) || (project ? `PP-${project}` : "PP"),
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
    returnUrl:safe(q.returnUrl) || (project ? `/checkoutprojetosprontos?codigo=${encodeURIComponent(project)}` : "/checkoutprojetosprontos")
  };
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

  /*
    REGRA OFICIAL DO /checkout-projeto-pronto, igual em desktop e mobile:
    mostrar somente banners referentes às etapas que ainda faltam pagar.

    Fluxo sequencial:
    MEDIDAS          -> mostra Medidas + Gráficos + Projeto
    GRAFICOS         -> mostra Gráficos + Projeto
    PROJETO_COMPLETO -> mostra somente Projeto
  */
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
  try { $w(HTML_ID).postMessage(data); }
  catch(e) { console.error("HTML post:",e?.message||e); }
}

function sendInit(force=false) {
  if (!htmlReady && !force) return;
  if (initSent && !force) return;
  initSent=true;
  post({
    type:"INIT",
    provider:"VALIDAPAY",
    checkoutId,
    autoLookup:false,
    hasWhatsappFromPreviousStep:Boolean(ctx.whatsapp),
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
    codigoCheckout:ctx.codigoCheckout,
    sku:ctx.sku,
    tipoProduto:ctx.tipoProduto,
    produto:ctx.produto,
    valor:ctx.valor,
    img:ctx.img,
    returnUrl:ctx.returnUrl,
    ctx:{...ctx}
  };
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

    post({
      type:"CUSTOMER_READY",ok:true,exists:true,clienteId:id,
      nome:ctx.nome,email:ctx.email,cpfCnpj:ctx.cpfCnpj,
      whatsapp:ctx.whatsapp,whatsappE164:ctx.whatsappE164
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
  if(busy) return post({type:"CARD_RESULT",ok:false,error:"Já existe um pagamento em processamento."});
  busy=true;
  post({type:"CARD_LOADING",checkoutId,message:"Processando cartão com segurança..."});
  try {
    const r=await waitTimeout(criarCobrancaCartaoTransparente({
      ...basePayload(data), card:data.card||{}, installments:Number(data.installments||1),
      cardDocument:digits(data.cardDocument || ctx.cpfCnpj)
    }),15000,"A operadora demorou para responder. Aguarde antes de tentar novamente.");

    const accepted=cardWasAccepted(r);
    post({type:"CARD_RESULT",ok:accepted || r?.ok===true,accepted,approved:r?.approved===true,processing:accepted && r?.approved!==true,
      checkoutId,chargeId:safe(r?.chargeId),status:safe(r?.status),cardBrand:safe(r?.cardBrand),
      cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),error:accepted?"":(r?.error||"")});

    if(accepted) {
      setTimeout(()=>wixLocation.to(deliveryUrl()),900);
    }
  } catch(e) {
    post({type:"CARD_RESULT",ok:false,approved:false,accepted:false,error:e?.message||"Não foi possível processar o cartão."});
  } finally { busy=false; }
}

function back() {
  stopPoll();
  wixLocation.to(ctx.returnUrl || "/checkoutprojetosprontos");
}

$w.onReady(function(){
  checkoutId=safe(wixLocation.query?.checkoutId) || `ckpro_${Date.now().toString(36)}_${Math.random().toString(16).slice(2,10)}`;
  ctx=contextFromUrl();

  configurarBannersPagamento(ctx.tipoProduto).catch(error => {
    console.error("Falha ao configurar banners do checkout de pagamento:", error?.message || error);
  });

  const html=$w(HTML_ID);

  html.onMessage(event=>{
    let data=event.data;
    if(typeof data==="string"){ try{data=JSON.parse(data)}catch(_){data={type:data}} }
    if(data?.data && typeof data.data==="object" && !data.type) data=data.data;
    data=data && typeof data==="object" ? data : {};
    const type=safe(data.type || data.tipo || data.action).toUpperCase();

    if(type==="READY"){htmlReady=true;sendInit();return;}
    if(type==="SAVE_CUSTOMER" || type==="CREATE_CUSTOMER"){saveCustomer(data).catch(console.error);return;}
    if(type==="CREATE_PIX" || type==="SUBMIT_PRO"){createPix(data).catch(console.error);return;}
    if(type==="CREATE_CARD"){createCard(data).catch(console.error);return;}
    if(type==="CHECK_PIX"){if(!polling){polling=true;pollPix(1).catch(console.error)}return;}
    if(["CLOSE","BACK","CANCEL","ACCESS_ACK"].includes(type)){back();return;}
  });

  setTimeout(()=>{if(!initSent){htmlReady=true;sendInit(true)}},350);
});