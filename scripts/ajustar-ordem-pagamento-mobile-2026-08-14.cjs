const fs = require("fs");

const FILE = "src/public/custom-elements/pelego-checkout-pronto.js";
let code = fs.readFileSync(FILE, "utf8");

function replaceRequired(from, to, label) {
  if (code.includes(to)) {
    console.log(`${label}: já aplicado.`);
    return;
  }
  if (!code.includes(from)) {
    throw new Error(`${label}: trecho esperado não encontrado.`);
  }
  code = code.replace(from, to);
}

const oldPix = `function mobilePixOrder(){
 if(window.innerWidth>680)return;
 E.topGrid.classList.add("pix-selected");
 [E.card,E.google,E.pixAuto,E.apple,E.paypal,E.notice].forEach(function(node){E.deferred.appendChild(node)});
 E.deferred.classList.add("active");
}`;

const newPix = `function mobilePixOrder(){
 if(window.innerWidth>680)return;
 E.topGrid.classList.add("pix-selected");

 /* MOBILE PIX:
    Cartão fica acima do Pix.
    O QR continua imediatamente abaixo do bloco principal.
    Informações importantes ficam logo abaixo de AGUARDANDO PIX.
    Os métodos em breve permanecem depois do aviso. */
 if(E.card&&E.pix&&E.pix.parentElement===E.left){
   E.left.insertBefore(E.card,E.pix);
 }
 [E.notice,E.google,E.pixAuto,E.apple,E.paypal].forEach(function(node){
   if(node)E.deferred.appendChild(node);
 });
 E.deferred.classList.add("active");
}`;

replaceRequired(oldPix, newPix, "Ordem mobile do Pix");

const oldCard = `function mobileCardOrder(){
 if(window.innerWidth>680){restoreCardDesktop();return}
 var list=E.cardSelected&&E.cardSelected.parentElement;
 if(!list)return;

 /* Ordem mobile aprovada:
    Cartão selecionado -> cartão/formulário/Pagar -> informações -> Pix -> demais métodos. */
 if(E.cardRight)list.insertBefore(E.cardRight,E.cardSelected.nextSibling);
 if(E.cardPaymentNotice){
   if(E.pixFromCard&&E.pixFromCard.parentElement===list)list.insertBefore(E.cardPaymentNotice,E.pixFromCard);
   else list.appendChild(E.cardPaymentNotice);
 }
}`;

const newCard = `function mobileCardOrder(){
 if(window.innerWidth>680){restoreCardDesktop();return}
 var list=E.cardSelected&&E.cardSelected.parentElement;
 if(!list)return;

 /* MOBILE CARTÃO:
    Pix fica acima do cartão selecionado.
    Depois vêm cartão/formulário/Pagar, informações e os demais métodos. */
 if(E.pixFromCard)list.insertBefore(E.pixFromCard,E.cardSelected);
 if(E.cardRight)list.insertBefore(E.cardRight,E.cardSelected.nextSibling);
 if(E.cardPaymentNotice){
   if(E.cardRight&&E.cardRight.parentElement===list){
     list.insertBefore(E.cardPaymentNotice,E.cardRight.nextSibling);
   }else{
     list.appendChild(E.cardPaymentNotice);
   }
 }
}`;

replaceRequired(oldCard, newCard, "Ordem mobile do cartão");

fs.writeFileSync(FILE, code, "utf8");
console.log("Ordem mobile Pix/Cartão aplicada sem alterar desktop ou pagamento.");
