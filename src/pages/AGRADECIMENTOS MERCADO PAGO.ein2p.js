// ===============================
// AGRADECIMENTOS MERCADO PAGO
// PADRÃO FIFA R3
// ===============================

import wixLocation from "wix-location";
import { getMpSession } from "backend/mpSessionsApi.jsw";


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


// ===============================
// PAGE READY
// ===============================

$w.onReady(async function(){

  const q = wixLocation.query;

  const checkoutId = safeStr(q.checkout_id || q.checkoutId);

  const statusUrl = safeStr(q.status || q.collection_status).toLowerCase();


  // ===============================
  // BUSCAR SESSÃO
  // ===============================

  const r = await getMpSession({ checkoutId });

  if(!r?.ok){

    console.log("Erro ao buscar sessão");

    wixLocation.to("/");
    return;

  }

  const sess = r.session;


  if(!sess){

    console.log("Sessão não encontrada");

    wixLocation.to("/");
    return;

  }


  const statusSess = safeStr(sess.status).toLowerCase();


  // ===============================
  // PAGAMENTO APROVADO
  // ===============================

  if(statusSess === "approved" || statusUrl === "approved"){

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

  const returnUrl = safeStr(sess.returnUrl);

  if(returnUrl){

    wixLocation.to(returnUrl);

  }else{

    wixLocation.to("/");

  }

});