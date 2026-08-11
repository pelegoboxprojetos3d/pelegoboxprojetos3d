const fs = require("fs");

const path = "src/public/custom-elements/pelego-checkout-pronto.js";
let text = fs.readFileSync(path, "utf8");

const oldMeasure = `function checkoutRealHeight(){
  var body=document.body;
  var html=document.documentElement;
  return Math.ceil(Math.max(
    body ? body.scrollHeight : 0,
    body ? body.offsetHeight : 0,
    html ? html.scrollHeight : 0,
    html ? html.offsetHeight : 0
  ));
}`;

const newMeasure = `function checkoutRealHeight(){
  /*
    Mede somente o conteúdo real do checkout.

    Não usamos body/html scrollHeight ou offsetHeight aqui porque esses valores
    passam a herdar a altura atual do iframe. Depois que PIX ou CARTÃO aumentam
    o iframe, medir o próprio documento cria um efeito catraca: ele cresce, mas
    nunca consegue informar uma altura menor quando volta para uma etapa curta.
  */
  var wrap=document.querySelector(".wrap");
  if(!wrap)return 0;

  var rect=wrap.getBoundingClientRect();
  var bodyStyle=window.getComputedStyle(document.body);
  var paddingTop=parseFloat(bodyStyle.paddingTop)||0;
  var paddingBottom=parseFloat(bodyStyle.paddingBottom)||0;

  return Math.ceil(rect.height+paddingTop+paddingBottom);
}`;

if (text.includes(oldMeasure)) {
  text = text.replace(oldMeasure, newMeasure);
} else if (!text.includes('var wrap=document.querySelector(".wrap");')) {
  throw new Error("Bloco de medição de altura do checkout não encontrado.");
}

const oldObserver = `if(typeof ResizeObserver!=="undefined"){
  try{
    var checkoutHeightObserver=new ResizeObserver(function(){
      clearTimeout(HEIGHT_TIMER);
      HEIGHT_TIMER=setTimeout(emitCheckoutHeight,35);
    });
    checkoutHeightObserver.observe(document.documentElement);
    if(document.body)checkoutHeightObserver.observe(document.body);
  }catch(_){}
}`;

const newObserver = `if(typeof ResizeObserver!=="undefined"){
  try{
    var checkoutHeightObserver=new ResizeObserver(function(){
      clearTimeout(HEIGHT_TIMER);
      HEIGHT_TIMER=setTimeout(emitCheckoutHeight,35);
    });

    /*
      Observa o conteúdo, não o viewport do iframe. Assim qualquer uma das
      quatro fases pode crescer E retrair sem realimentar a própria altura.
    */
    var checkoutWrap=document.querySelector(".wrap");
    if(checkoutWrap)checkoutHeightObserver.observe(checkoutWrap);
    else if(document.body)checkoutHeightObserver.observe(document.body);
  }catch(_){}
}`;

if (text.includes(oldObserver)) {
  text = text.replace(oldObserver, newObserver);
} else if (!text.includes('var checkoutWrap=document.querySelector(".wrap");')) {
  throw new Error("ResizeObserver do checkout não encontrado.");
}

fs.writeFileSync(path, text);
console.log("Checkout atualizado: altura acompanha o conteúdo real e retrai ao voltar de PIX/cartão.");
