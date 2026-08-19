const fs = require("fs");

const PAGE = "src/pages/checkout-projeto-pronto.i9aj1.js";
const ELEMENT = "src/public/custom-elements/pelego-checkout-pronto.js";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content, "utf8"); }

function patchPage() {
  let code = read(PAGE);

  if (!code.includes("PIX_QR_ACCEPTS_PROVIDER_IMAGE_V2")) {
    const anchor = "async function pollPix(n=1) {";
    if (!code.includes(anchor)) throw new Error("Página: pollPix não encontrado.");
    code = code.replace(anchor, "// PIX_QR_ACCEPTS_PROVIDER_IMAGE_V2\n// Aceita tanto EMV quanto imagem/base64 de QR devolvida pela ValidaPay.\n" + anchor);
  }

  let replacements = 0;
  code = code.replace(/if\(r\?\.ok && r\?\.chargeId && r\?\.emv\) \{/g, () => {
    replacements += 1;
    return "if(r?.ok && r?.chargeId && (r?.emv || r?.qrCode)) {";
  });

  if (!code.includes("r?.chargeId && (r?.emv || r?.qrCode)")) {
    throw new Error("Página: condição de QR Pix não foi aplicada.");
  }

  const occurrences = (code.match(/r\?\.chargeId && \(r\?\.emv \|\| r\?\.qrCode\)/g) || []).length;
  if (occurrences < 2) {
    throw new Error(`Página: esperado aceitar QR no create+poll, encontrados ${occurrences}.`);
  }

  write(PAGE, code);
  console.log(`Página Pix corrigida. Substituições novas: ${replacements}.`);
}

function patchElement() {
  let code = read(ELEMENT);

  const tetrisBlock = `/* TETRIS AUTÔNOMO DENTRO DO QR */
/* TETRIS_AUTOPLAY_LINHAS_RESTART_V2 */
function startTetris(){
 stopTetris();
 var canvas=E.tetrisCanvas,ctx=canvas.getContext("2d"),cols=16,rows=16;
 var cell=Math.floor(Math.min(canvas.width/cols,canvas.height/rows));
 var fieldW=cols*cell,fieldH=rows*cell,ox=Math.floor((canvas.width-fieldW)/2),oy=Math.floor((canvas.height-fieldH)/2);
 var board=Array.from({length:rows},function(){return Array(cols).fill(0)});
 var pieces=[
  [[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]
 ];
 var piece=null,x=0,y=0,targetX=0,last=0,firstSpawn=true;
 function rotate(p){var h=p.length,w=p[0].length,out=Array.from({length:w},function(){return Array(h).fill(0)});for(var py=0;py<h;py++)for(var px=0;px<w;px++)out[px][h-1-py]=p[py][px];return out}
 function samePiece(a,b){return JSON.stringify(a)===JSON.stringify(b)}
 function collideOn(testBoard,nx,ny,p){for(var py=0;py<p.length;py++)for(var px=0;px<p[py].length;px++)if(p[py][px]){var bx=nx+px,by=ny+py;if(bx<0||bx>=cols||by>=rows)return true;if(by>=0&&testBoard[by][bx])return true}return false}
 function collide(nx,ny,p){return collideOn(board,nx,ny,p||piece)}
 function resetBoard(){board=Array.from({length:rows},function(){return Array(cols).fill(0)});for(var c=0;c<cols;c++){board[rows-1][c]=1;board[rows-2][c]=1}board[rows-1][7]=0;board[rows-1][8]=0;board[rows-2][7]=0;board[rows-2][8]=0;firstSpawn=true}
 function landingY(testBoard,p,sx){var sy=-p.length;while(!collideOn(testBoard,sx,sy+1,p))sy++;return sy}
 function evaluate(p,sx){var test=board.map(function(r){return r.slice()}),sy=landingY(test,p,sx);var above=false;for(var py=0;py<p.length;py++)for(var px=0;px<p[py].length;px++)if(p[py][px]){var by=sy+py,bx=sx+px;if(by<0)above=true;else if(by<rows)test[by][bx]=1}if(above)return-999999;var lines=0;for(var r=rows-1;r>=0;r--)if(test[r].every(Boolean)){test.splice(r,1);test.unshift(Array(cols).fill(0));lines++;r++}var heights=[],holes=0,aggregate=0,bump=0,maxHeight=0;for(var c=0;c<cols;c++){var first=-1;for(var rr=0;rr<rows;rr++){if(test[rr][c]){first=rr;break}}var h=first<0?0:rows-first;heights.push(h);aggregate+=h;if(h>maxHeight)maxHeight=h;if(first>=0)for(var hr=first+1;hr<rows;hr++)if(!test[hr][c])holes++}for(var i=1;i<heights.length;i++)bump+=Math.abs(heights[i]-heights[i-1]);return lines*1200-holes*95-aggregate*4-bump*3-maxHeight*8}
 function choose(raw){var variants=[],p=raw.map(function(r){return r.slice()});for(var s=0;s<4;s++){if(!variants.some(function(v){return samePiece(v,p)}))variants.push(p);p=rotate(p)}var best=null;variants.forEach(function(v){for(var sx=0;sx<=cols-v[0].length;sx++){var score=evaluate(v,sx)+Math.random()*.25;if(!best||score>best.score)best={piece:v,x:sx,score:score}}});return best||{piece:raw.map(function(r){return r.slice()}),x:Math.floor((cols-raw[0].length)/2)}}
 function spawn(){var raw;if(firstSpawn){raw=pieces[1];firstSpawn=false}else raw=pieces[Math.floor(Math.random()*pieces.length)];var plan=choose(raw);piece=plan.piece.map(function(r){return r.slice()});x=Math.floor((cols-piece[0].length)/2);y=-piece.length;targetX=plan.x}
 function lock(){var above=false;for(var py=0;py<piece.length;py++)for(var px=0;px<piece[py].length;px++)if(piece[py][px]){var by=y+py,bx=x+px;if(by<0)above=true;else if(by<rows)board[by][bx]=1}for(var r=rows-1;r>=0;r--)if(board[r].every(Boolean)){board.splice(r,1);board.unshift(Array(cols).fill(0));r++}if(above){resetBoard()}spawn();if(collide(x,y,piece)){resetBoard();spawn()}}
 function playMove(){if(x<targetX&&!collide(x+1,y))x++;else if(x>targetX&&!collide(x-1,y))x--;if(!collide(x,y+1))y++;else lock()}
 function draw(){var grad=ctx.createLinearGradient(0,0,0,canvas.height);grad.addColorStop(0,"#0a1119");grad.addColorStop(1,"#111b25");ctx.fillStyle=grad;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="rgba(255,255,255,.045)";ctx.lineWidth=1;for(var gy=0;gy<=rows;gy++){ctx.beginPath();ctx.moveTo(ox,oy+gy*cell);ctx.lineTo(ox+fieldW,oy+gy*cell);ctx.stroke()}for(var gx=0;gx<=cols;gx++){ctx.beginPath();ctx.moveTo(ox+gx*cell,oy);ctx.lineTo(ox+gx*cell,oy+fieldH);ctx.stroke()}function block(bx,by,live){if(by<0)return;var px=ox+bx*cell,py=oy+by*cell;ctx.fillStyle=live?"#56e36f":"#22a447";ctx.fillRect(px+1,py+1,cell-2,cell-2);ctx.fillStyle=live?"rgba(255,255,255,.34)":"rgba(255,255,255,.14)";ctx.fillRect(px+2,py+2,cell-4,Math.max(2,Math.floor(cell*.16)));ctx.fillStyle="rgba(0,0,0,.18)";ctx.fillRect(px+2,py+cell-4,cell-4,2)}for(var r=0;r<rows;r++)for(var c=0;c<cols;c++)if(board[r][c])block(c,r,false);for(var py=0;py<piece.length;py++)for(var px=0;px<piece[py].length;px++)if(piece[py][px])block(x+px,y+py,true)}
 function loop(ts){if(!last||ts-last>70){if(last)playMove();last=ts;draw()}S.tetris=requestAnimationFrame(loop)}
 resetBoard();spawn();S.tetris=requestAnimationFrame(loop)
}
function stopTetris(){if(S.tetris){cancelAnimationFrame(S.tetris);S.tetris=null}}`;

  if (!code.includes("TETRIS_AUTOPLAY_LINHAS_RESTART_V2")) {
    const regex = /\/\* TETRIS AUTÔNOMO DENTRO DO QR \*\/[\s\S]*?function stopTetris\(\)\{if\(S\.tetris\)\{cancelAnimationFrame\(S\.tetris\);S\.tetris=null\}\}/;
    if (!regex.test(code)) throw new Error("Custom Element: bloco Tetris não encontrado.");
    code = code.replace(regex, tetrisBlock);
  }

  const qrBlock = `/* QR_MOBILE_RETRY_PROVIDER_IMAGE_V2 */
var QR_RENDER_SEQ=0;
function renderQr(code,qrSource){
 var seq=++QR_RENDER_SEQ,c=safe(code);S.pixCode=c;E.pixCode.value=c;E.copy.disabled=!c;E.qr.innerHTML="";
 var source=safe(qrSource);
 if(source&&/^<svg/i.test(source))source="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(source);
 if(source&&!/^data:image/i.test(source)&&!/^https?:\\/\\//i.test(source)&&source.length>150&&/^[A-Za-z0-9+/=\\s]+$/.test(source))source="data:image/png;base64,"+source.replace(/\\s+/g,"");
 if(source&&(/^data:image/i.test(source)||/^https?:\\/\\//i.test(source))){
   var img=document.createElement("img");img.src=source;img.alt="QR Code Pix";
   img.onload=function(){if(seq!==QR_RENDER_SEQ)return;stopTetris();E.tetrisWrap.classList.add("hidden")};
   img.onerror=function(){if(seq!==QR_RENDER_SEQ)return;E.qr.innerHTML="";E.tetrisWrap.classList.remove("hidden");if(!S.tetris)startTetris();if(c)waitLibrary(0)};
   E.qr.appendChild(img);return
 }
 waitLibrary(0);
 function waitLibrary(attempt){
   if(seq!==QR_RENDER_SEQ)return;
   if(c&&typeof QRCode!=="undefined"){
     try{E.qr.innerHTML="";new QRCode(E.qr,{text:c,width:195,height:195,correctLevel:QRCode.CorrectLevel.M});stopTetris();E.tetrisWrap.classList.add("hidden");return}catch(_){}
   }
   E.tetrisWrap.classList.remove("hidden");if(!S.tetris)startTetris();
   if(c&&attempt<50)setTimeout(function(){waitLibrary(attempt+1)},80)
 }
}
function copyPix(){`;

  if (!code.includes("QR_MOBILE_RETRY_PROVIDER_IMAGE_V2")) {
    const qrRegex = /function renderQr\(code,qrSource\)\{[\s\S]*?\n\}\nfunction copyPix\(\)\{/;
    if (!qrRegex.test(code)) throw new Error("Custom Element: renderQr não encontrado.");
    code = code.replace(qrRegex, qrBlock);
  }

  const mobileTetrisOld = "  #tetrisCanvas{width:min(190px,64vw);height:min(190px,64vw)}";
  const mobileTetrisNew = "  /* TETRIS_MOBILE_FILL_QR_V3 */\n  #tetrisCanvas{width:100%;height:100%}";
  if (!code.includes("TETRIS_MOBILE_FILL_QR_V3")) {
    if (!code.includes(mobileTetrisOld)) {
      throw new Error("Custom Element: regra mobile antiga do Tetris não encontrada; nada foi alterado.");
    }
    code = code.replace(mobileTetrisOld, mobileTetrisNew);
  }

  for (const marker of ["TETRIS_AUTOPLAY_LINHAS_RESTART_V2", "QR_MOBILE_RETRY_PROVIDER_IMAGE_V2", "TETRIS_MOBILE_FILL_QR_V3", "lines*1200", "attempt<50"]) {
    if (!code.includes(marker)) throw new Error(`Custom Element: validação falhou em ${marker}.`);
  }

  write(ELEMENT, code);
  console.log("Custom Element corrigido: QR resiliente e Tetris preenchendo toda a área no mobile.");
}

patchPage();
patchElement();
console.log("OK: hotfix Pix mobile + Tetris aplicado.");
