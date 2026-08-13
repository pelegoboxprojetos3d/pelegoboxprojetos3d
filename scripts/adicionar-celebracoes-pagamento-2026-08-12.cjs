const fs = require("fs");

const FILE = "src/public/custom-elements/pelego-checkout-pronto.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceExact(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

if (!code.includes("function celebratePayment()")) {
  const anchor = 'function resetCard(){S.cardBusy=false;E.cardSubmit.disabled=false;E.cardCvv.value=""}\nfunction showSuccess(){';
  const celebration = String.raw`function resetCard(){S.cardBusy=false;E.cardSubmit.disabled=false;E.cardCvv.value=""}
function celebratePayment(){
 var old=document.getElementById("paymentCelebrationCanvas");if(old)old.remove();
 var canvas=document.createElement("canvas");canvas.id="paymentCelebrationCanvas";
 canvas.style.cssText="position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646;";
 document.body.appendChild(canvas);
 var ctx=canvas.getContext("2d"),dpr=Math.min(window.devicePixelRatio||1,2),w=0,h=0,particles=[],raf=0,start=performance.now();
 function resize(){w=window.innerWidth;h=window.innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
 resize();
 var raw=safe(S.ctx.tipoProduto||"MEDIDAS").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[\s-]+/g,"_");
 var mode=raw==="GRAFICOS"?2:raw==="PROJETO_COMPLETO"?3:1;
 var colors=mode===1?["#159447","#88d49f","#ffffff","#f0c84b"]:mode===2?["#159447","#77c8ff","#ffffff","#a78bfa"]:["#159447","#f1c84b","#ffffff","#ff8a65","#80cbc4"];
 function add(x,y,vx,vy,size,life,shape){particles.push({x:x,y:y,vx:vx,vy:vy,size:size,life:life,max:life,rot:Math.random()*6.28,vr:(Math.random()-.5)*.22,color:colors[(Math.random()*colors.length)|0],shape:shape||0})}
 function burst(x,y,count,power){for(var i=0;i<count;i++){var a=Math.random()*Math.PI*2,s=power*(.45+Math.random()*.75);add(x,y,Math.cos(a)*s,Math.sin(a)*s-(Math.random()*1.5),4+Math.random()*6,80+Math.random()*40,i%3)}}
 if(mode===1){
   burst(w*.5,h*.42,88,6.2);
   for(var i=0;i<28;i++){add(0,h*.68,3+Math.random()*4,-5-Math.random()*4,4+Math.random()*5,95+Math.random()*30,i%3);add(w,h*.68,-3-Math.random()*4,-5-Math.random()*4,4+Math.random()*5,95+Math.random()*30,i%3)}
 }else if(mode===2){
   for(var j=0;j<95;j++){add(Math.random()*w,-20-Math.random()*h*.28,(Math.random()-.5)*1.8,2.2+Math.random()*3.8,3+Math.random()*5,120+Math.random()*60,j%2)}
   setTimeout(function(){if(canvas.isConnected)burst(w*.5,h*.38,54,5.2)},260);
 }else{
   burst(w*.28,h*.38,62,6.8);burst(w*.72,h*.38,62,6.8);
   setTimeout(function(){if(canvas.isConnected)burst(w*.5,h*.30,96,7.6)},240);
   setTimeout(function(){if(canvas.isConnected)burst(w*.5,h*.48,70,6.4)},520);
 }
 function draw(p){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;if(p.shape===1){ctx.fillRect(-p.size*.7,-p.size*.18,p.size*1.4,p.size*.36)}else if(p.shape===2){ctx.beginPath();ctx.arc(0,0,p.size*.46,0,Math.PI*2);ctx.fill()}else{ctx.fillRect(-p.size*.45,-p.size*.45,p.size*.9,p.size*.9)}ctx.restore()}
 function frame(now){ctx.clearRect(0,0,w,h);for(var i=particles.length-1;i>=0;i--){var p=particles[i];p.life--;p.vy+=mode===2?.045:.085;p.vx*=.992;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;draw(p);if(p.life<=0||p.y>h+80)particles.splice(i,1)}if((particles.length&&now-start<4200)||now-start<900){raf=requestAnimationFrame(frame)}else{cancelAnimationFrame(raf);canvas.remove()}}
 raf=requestAnimationFrame(frame);
 setTimeout(function(){if(canvas.isConnected){cancelAnimationFrame(raf);canvas.remove()}},4700)
}
function showSuccess(){`;
  replaceExact(anchor, celebration, "Inserção das celebrações");
}

replaceExact(
  'function showSuccess(){stopTetris();E.identity.classList.add("hidden");E.payment.classList.add("hidden");E.already.classList.add("hidden");E.success.classList.remove("hidden");setStep(3);layoutMode("SUCCESS")}',
  'function showSuccess(){stopTetris();E.identity.classList.add("hidden");E.payment.classList.add("hidden");E.already.classList.add("hidden");E.success.classList.remove("hidden");setStep(3);layoutMode("SUCCESS");requestAnimationFrame(celebratePayment)}',
  "Disparo da celebração"
);

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Celebrações pós-pagamento adicionadas: MEDIDAS, GRAFICOS e PROJETO_COMPLETO.");
} else {
  console.log("Celebrações pós-pagamento já aplicadas.");
}
