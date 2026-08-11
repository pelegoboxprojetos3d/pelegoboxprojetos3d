const fs = require("fs");

function replaceOrFail(path, before, after, label) {
  let text = fs.readFileSync(path, "utf8");
  if (text.includes(after)) {
    console.log(`${label}: já aplicado`);
    return;
  }
  if (!text.includes(before)) {
    throw new Error(`${label}: trecho não encontrado em ${path}`);
  }
  text = text.replace(before, after);
  fs.writeFileSync(path, text);
  console.log(`${label}: aplicado`);
}

const backend = "src/backend/validaPayCartaoProjetosProntos.jsw";
replaceOrFail(
  backend,
  'scope=${encodeURIComponent("checkouts/write products/write checkouts/read")}',
  'scope=${encodeURIComponent("checkouts/write products/write checkouts/read pix.cob/read")}',
  "escopo de leitura da cobrança"
);

replaceOrFail(
  backend,
  'const approved = response.data?.success === true && ["paid", "approved", "succeeded"].includes(status);',
  'const approved = response.data?.success !== false && isApprovedCardStatus(status);',
  "reconhecimento de pagamento aprovado"
);

const page = "src/pages/checkout-projeto-pronto.i9aj1.js";
const oldPoll = `    if(statusResult?.approved === true) {
      const delivery = await waitTimeout(buscarEntregaProjetoPronto({checkoutId}),4500,"");
      if(deliveryReady(delivery)) {
        stopCardPoll();
        post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,deliveryUrl:deliveryUrl()});
        setTimeout(()=>wixLocation.to(deliveryUrl()),650);
        return;
      }
      post({type:"CARD_RESULT",ok:true,accepted:true,approved:false,paymentApproved:true,processing:true,checkoutId,chargeId,status:cardStatus || "paid",error:"Pagamento aprovado. Preparando sua entrega e os e-mails..."});
    }`;
const newPoll = `    if(statusResult?.approved === true || ["paid","approved","succeeded"].includes(cardStatus)) {
      /*
        A página de entrega já possui processamento visual e polling próprios.
        Assim que a operadora confirmar o pagamento, saímos do checkout
        imediatamente em vez de esperar Make/OneDrive terminar os arquivos.
      */
      stopCardPoll();
      post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,status:cardStatus || "paid",deliveryUrl:deliveryUrl()});
      setTimeout(()=>wixLocation.to(deliveryUrl()),650);
      return;
    }`;
replaceOrFail(page, oldPoll, newPoll, "redirecionamento após confirmação no polling");

const oldCreate = `    post({
      type:"CARD_RESULT",ok:accepted || r?.ok===true,accepted,approved:false,paymentApproved,
      processing:accepted || paymentApproved,checkoutId,chargeId,status:safe(r?.status),
      cardBrand:safe(r?.cardBrand),cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),
      error:accepted ? (paymentApproved ? "Pagamento aprovado. Preparando sua entrega e os e-mails..." : "Pagamento recebido. Aguardando confirmação...") : (r?.error||"")
    });
    if(accepted || paymentApproved) {
      cardPolling=true;
      pollCardDelivery(1).catch(console.error);
    }`;
const newCreate = `    if(paymentApproved) {
      post({
        type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,
        processing:false,checkoutId,chargeId,status:safe(r?.status)||"paid",
        cardBrand:safe(r?.cardBrand),cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),
        error:"Pagamento aprovado. Abrindo sua entrega..."
      });
      setTimeout(()=>wixLocation.to(deliveryUrl()),650);
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
    }`;
replaceOrFail(page, oldCreate, newCreate, "redirecionamento imediato quando POST retorna pago");

console.log("Correção do cartão concluída.");
