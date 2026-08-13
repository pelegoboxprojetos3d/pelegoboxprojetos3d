// ===============================
// AGRADECIMENTOS MERCADO PAGO
// PADRÃO FIFA R3
// ===============================

import wixLocation from "wix-location";
import { getMpSession } from "backend/mpSessionsApi.jsw";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180000;
const CAMPOS_CONFIRMACAO = ["#txtProduto", "#txtSku", "#txtValor", "#txtEmail1", "#imgProduto"];

function safeStr(v){
  return String(v === undefined || v === null ? "" : v);
}

function moneyBR(v){
  const n = Number(v || 0);
  if(!Number.isFinite(n)) return "R$ 0,00";
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function setText(id, val, fallback="-"){
  try{
    const el = $w(id);
    if(!el) return;
    const s = safeStr(val).trim() || fallback;
    if("text" in el) el.text = s;
  }catch(e){
    console.log("Elemento não encontrado:", id);
  }
}

function setImageNice(id, src){
  try{
    const el = $w(id);
    if(!el) return;
    const s = safeStr(src).trim();
    if(!s) return;
    if("src" in el) el.src = s;
    if("fitMode" in el) el.fitMode = "fit";
    if("focalPoint" in el) el.focalPoint = { x:0.5, y:0.5 };
  }catch(e){
    console.log("Erro imagem:", id);
  }
}

function ocultarConfirmacao(){
  CAMPOS_CONFIRMACAO.forEach((id) => {
    try{
      const el = $w(id);
      if(typeof el.hide === "function") el.hide();
    }catch(_){}
  });
}

async function revelarConfirmacao(){
  await Promise.allSettled(CAMPOS_CONFIRMACAO.map(async (id) => {
    try{
      const el = $w(id);
      if(typeof el.expand === "function") await el.expand();
      if(typeof el.show === "function") await el.show("fade");
    }catch(_){}
  }));
}

function wait(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForApprovedSession(checkoutId){
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while(Date.now() < deadline){
    let sess = null;
    try{
      const r = await getMpSession({ checkoutId });
      sess = r?.session || null;
    }catch(e){
      console.log("Falha temporária ao consultar pagamento:", e);
    }
    if(sess && safeStr(sess.status).toLowerCase() === "approved") return sess;
    await wait(POLL_INTERVAL_MS);
  }
  return null;
}

$w.onReady(async function(){
  ocultarConfirmacao();

  const q = wixLocation.query;
  const checkoutId = safeStr(q.checkout_id || q.checkoutId);

  if(!checkoutId){
    setText("#txtStatus", "Não foi possível identificar a compra");
    return;
  }

  setText("#txtStatus", "Confirmando seu pagamento...");
  const sess = await waitForApprovedSession(checkoutId);

  if(!sess){
    setText("#txtStatus", "Pagamento ainda em confirmação. Atualize esta página em alguns segundos.");
    return;
  }

  if(safeStr(sess.status).toLowerCase() === "approved"){
    setText("#txtProduto", sess?.produto || "Compra confirmada");
    setText("#txtSku", sess?.sku ? `SKU: ${sess.sku}` : "SKU: -", "SKU: -");
    setText("#txtValor", moneyBR(sess?.valor || 0));
    setText("#txtStatus", "Pagamento aprovado");
    setText("#txtEmail1", sess?.email || "-", "-");
    setImageNice("#imgProduto", sess?.img || "");
    await revelarConfirmacao();
    return;
  }

  setText("#txtStatus", "Pagamento ainda em confirmação.");
});
