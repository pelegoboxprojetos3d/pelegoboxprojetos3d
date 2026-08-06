import wixLocation from "wix-location";
import { createCheckoutProPreference } from "backend/mpCheckoutPro.jsw";

let submitting = false;
let initialized = false;

function safeStr(v){
  return String(v ?? "");
}

function mkCheckoutId(){
  return "ck_" +
  Date.now().toString(36) +
  "_" +
  Math.random().toString(16).slice(2);
}

function buildCtxFromQuery(){

  const q = wixLocation.query;

  const produto =
  safeStr(q.name || q.produto || "Produto");

  const sku =
  safeStr(q.sku || "-");

  const productId =
  safeStr(q.productId || "");

  const img =
  q.img ? decodeURIComponent(q.img) : "";

  const valor =
  Number(q.price || q.valor || 0);

  const returnUrl =
  q.returnUrl
  ? decodeURIComponent(q.returnUrl)
  : "/";

  return {
    produto,
    sku,
    productId,
    img,
    valor,
    returnUrl
  };
}

$w.onReady(function(){

  const ctx = buildCtxFromQuery();

  const checkoutId = mkCheckoutId();

  const html = $w("#htmlIframeMP");

  if(!html) return;

  if(!initialized){

    initialized = true;

    html.postMessage({
      type:"INIT",
      checkoutId,
      ctx
    });

  }

  html.onMessage(async (event)=>{

    const d = event.data || {};

    if(d.type === "CLOSE"){

      wixLocation.to(ctx.returnUrl || "/");
      return;

    }

    if(d.type === "SUBMIT_PRO"){

      if(submitting) return;

      submitting = true;

      try{

        const resp =
        await createCheckoutProPreference({

          checkoutId,

          whatsapp: safeStr(d.whatsapp),
          whatsappE164: safeStr(d.whatsappE164),
          ddi: safeStr(d.ddi),
          country: safeStr(d.country),

          ctx,

          returnUrl: ctx.returnUrl || "/"

        });

        if(!resp?.ok || !resp?.init_point){

          submitting = false;

          html.postMessage({
            type:"PRO_RESULT",
            ok:false
          });

          return;

        }

        wixLocation.to(resp.init_point);

      }
      catch(e){

        submitting = false;

        html.postMessage({
          type:"PRO_RESULT",
          ok:false
        });

      }

    }

  });

});
