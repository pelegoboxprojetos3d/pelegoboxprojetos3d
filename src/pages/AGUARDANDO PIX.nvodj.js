import wixLocation from "wix-location";
import wixData from "wix-data";

let timer = null;

function safe(v){
  return String(v ?? "");
}

$w.onReady(function () {

  const q = wixLocation.query;

  const checkoutId = safe(q.checkout_id || q.external_reference);

  if(!checkoutId){
    console.log("checkout_id ausente");
    return;
  }

  console.log("checkoutId:", checkoutId);

  monitorar(checkoutId);

});

function monitorar(checkoutId){

  verificar(checkoutId);

  timer = setInterval(()=>{
    verificar(checkoutId);
  },2000);

}

async function verificar(checkoutId){

  try{

    const r = await wixData.query("MpSessions")
      .eq("checkoutId", checkoutId)
      .limit(1)
      .find({ suppressAuth:true });

    if(!r.items.length){
      return;
    }

    const s = r.items[0];

    console.log("status:", s.status);

    if(String(s.status).toLowerCase() === "approved"){

      clearInterval(timer);

      wixLocation.to(`/agradecimentos-mercado-pago?checkout_id=${checkoutId}`);

    }

  }
  catch(e){
    console.log("erro:", e);
  }

}