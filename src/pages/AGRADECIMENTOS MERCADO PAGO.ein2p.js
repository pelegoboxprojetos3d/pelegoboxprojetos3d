// ===============================
// AGRADECIMENTOS MERCADO PAGO
// PADRÃO FIFA R3
// ===============================

import wixLocation from "wix-location";
import { getMpSession } from "backend/mpSessionsApi.jsw";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 180000;


// ===============================
// HELPERS
// ===============================

function safeStr(v){
  return String(v === undefined || v === null ? "" : v);
}

function moneyBR(v){

  const n = Number(v || 0);

  if(!Number.isFinite(n)){
    return "R$ 0,00";
  }

  return `R$ ${n.toFixed(2).replace(".", ",")}`;

}

function setText(id, val, fallback="-"){

  try{

    const el = $w(id);

    if(!el) return;

    const s = safeStr(val).trim() || fallback;

    if("text" in el){
      el.text = s;
    }

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

    if("src" in el){
      el.src = s;
    }

    if("fitMode" in el){
      el.fitMode = "fit";
    }

    if("focalPoint" in el){
      el.focalPoint = { x:0.5, y:0.5 };
    }

  }catch(e){
    console.log("Erro imagem:", id);
  }

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

    if(sess && safeStr(sess.status).toLowerCase() === "approved"){
      return sess;
    }

    await wait(POLL_INTERVAL_MS);
  }

  return null;
}


// ===============================
// PAGE READY
// ===============================

$w.onReady(async function(){

  const q = wixLocation.query;

  const checkoutId = safeStr(q.checkout_id || q.checkoutId);

  if(!checkoutId){
    setText("#txtStatus", "Não foi possível identificar a compra");
    return;
  }


  // ===============================
  // BUSCAR SESSÃO
  // ===============================

  setText("#txtStatus", "Confirmando seu pagamento...");

  const sess = await waitForApprovedSession(checkoutId);

  if(!sess){
    setText(
      "#txtStatus",
      "Pagamento ainda em confirmação. Atualize esta página em alguns segundos."
    );
    return;
  }


  // ===============================
  // PAGAMENTO APROVADO
  // ===============================

  if(safeStr(sess.status).toLowerCase() === "approved"){

    setText("#txtProduto", sess?.produto || "Compra confirmada");

    setText(
      "#txtSku",
      sess?.sku ? `SKU: ${sess.sku}` : "SKU: -",
      "SKU: -"
    );

    setText("#txtValor", moneyBR(sess?.valor || 0));

    setText("#txtStatus", "Pagamento aprovado");

    setText("#txtEmail1", sess?.email || "-", "-");

    setImageNice("#imgProduto", sess?.img || "");

    return;

  }


  // ===============================
  // NÃO APROVADO
  // ===============================

  setText("#txtStatus", "Pagamento ainda em confirmação.");

});
