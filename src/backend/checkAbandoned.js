import wixData from "wix-data";
import { fetch } from "wix-fetch";

const COLLECTION = "MpSessions";
const ABANDON_DELAY_MS = 1 * 60000;

const ABANDON_URL =
"https://backend.respondechat.ai/webhook/1455/TmoeuykoF4mgTWNx1Ovdsuzlaw74w5zBOi4kpJvG6J";

function safe(v){
  return String(v ?? "");
}

function onlyDigits(v){
  return safe(v).replace(/[^\d]/g, "");
}

function formatDateTimeBR(date){
  const d = date instanceof Date ? date : new Date(date);
  if(Number.isNaN(d.getTime())){
    return "";
  }

  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeWhatsapp(item){
  const current = safe(item?.whatsapp).trim();
  if(current.startsWith("+")) return current.replace(/\s+/g, "");

  const ddi = onlyDigits(item?.ddi || item?.countryCode || "");
  const digits = onlyDigits(item?.whatsappDigits || current);

  if(ddi && digits){
    return `+${ddi}${digits}`;
  }

  if(digits){
    return `+${digits}`;
  }

  return current ? `+${onlyDigits(current)}` : "";
}

function asBool(v){
  return v === true || v === "true";
}

export async function checkAbandoned(){

  const now = Date.now();

  const r = await wixData.query(COLLECTION)
    .eq("abandonSent", false)
    .limit(1000)
    .find({ suppressAuth:true });

  let processed = 0;

  for(const item of r.items){

    if(asBool(item.saleSent)) continue;

    if(safe(item.status).toLowerCase() === "approved") continue;

    if(!safe(item.whatsapp)) continue;

    const created = new Date(item._createdDate).getTime();

    if(!created) continue;

    const diff = now - created;

    if(diff < ABANDON_DELAY_MS) continue;

    try{

      const agora = new Date();
      const dataHora = formatDateTimeBR(agora);
      const dataISO = agora.toISOString();

      await fetch(ABANDON_URL,{
        method:"post",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({

          event: "carrinho_abandonado",
          dataHora: dataHora,
          dataISO: dataISO,

          checkoutId: item.checkoutId,
          whatsapp: normalizeWhatsapp(item),

          produto: item.produto,
          sku: item.sku || "-",
          img: item.img || "",
          valor: Number(item.valor || 0)
            .toFixed(2)
            .replace(".", ",")

        })
      });

      item.abandonSent = true;

      await wixData.update(COLLECTION,item,{ suppressAuth:true });

      processed++;

    }catch(e){

      console.log("ABANDON ERROR", e);

    }

  }

  return {
    ok:true,
    processed
  };

}
