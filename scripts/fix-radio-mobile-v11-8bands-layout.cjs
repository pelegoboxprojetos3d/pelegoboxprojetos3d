const fs=require('fs');
const skinPath='src/public/custom-elements/pelego-radio.js';
const corePath='src/public/custom-elements/pelego-radio-core.js';
let s=fs.readFileSync(skinPath,'utf8');
let c=fs.readFileSync(corePath,'utf8');
const need=(cond,msg)=>{if(!cond)throw new Error(msg)};

// 1) Mobile: títulos de 8 bandas, sem tocar no desktop.
s=s.replace("ANALISADOR - ${mobile ? '6' : '24'} BANDAS","ANALISADOR - ${mobile ? '8' : '24'} BANDAS");
s=s.replace("EQUALIZADOR ${mobile ? '6' : '24'} BANDAS","EQUALIZADOR ${mobile ? '8' : '24'} BANDAS");

// 2) Evita o pisca-pisca: applySkin não recria mais o título TOCANDO a cada ResizeObserver.
const oldTitles=`  const playTitle=root.querySelector('.playbox .panel-title'); title(playTitle, mobile ? \`<span class="play-title-left"><span class="pb-icon" style="font-size:18px">♫</span><span>TOCANDO</span></span><span class="play-meta" id="playMeta"></span>\` : \`<span class="pb-icon" style="font-size:18px">♫</span>TOCANDO\`);\n  if(mobile){\n    const pbMobileTitleV6=root.querySelector('.playbox .panel-title');\n    if(pbMobileTitleV6) pbMobileTitleV6.innerHTML='<span class="play-title-left"><span class="pb-icon" style="font-size:18px">♫</span><span>TOCANDO</span></span><span class="play-meta" id="playMeta"></span>';\n  }`;
const newTitles=`  const playTitle=root.querySelector('.playbox .panel-title');\n  if(playTitle){\n    if(mobile){\n      if(!playTitle.querySelector('.play-title-left') || !playTitle.querySelector('#playMeta')){\n        playTitle.innerHTML='<span class="play-title-left"><span class="pb-icon" style="font-size:18px">♫</span><span>TOCANDO</span></span><span class="play-meta" id="playMeta"></span>';\n      }\n    }else{\n      title(playTitle, \`<span class="pb-icon" style="font-size:18px">♫</span>TOCANDO\`);\n    }\n  }`;
need(s.includes(oldTitles),'marcador atual do título TOCANDO não encontrado');
s=s.replace(oldTitles,newTitles);

// 3) Override final mobile V11: 8 bandas e painel TOCANDO com respiro, largura total permanece 315px.
const cssMarker='  .footer{display:none!important}\n}';
need(s.includes(cssMarker),'fim do CSS mobile não encontrado');
const css=`  /* MOBILE_V11_8_BANDS_RELAXED */\n  .playbox{min-height:224px!important;height:224px!important;max-height:224px!important}\n  .playbody{grid-template-rows:11px 28px 22px 48px 36px!important;row-gap:4px!important;padding:4px 8px 7px!important}\n  .playbody>select{height:28px!important}\n  .volrow{min-height:22px!important}\n  .randomrow{gap:6px!important}\n  .randomrow label{grid-template-rows:11px 30px!important;gap:3px!important;padding:2px 3px 3px!important}\n  .randomrow select{height:30px!important}\n  .controls{gap:6px!important;align-items:center!important}\n  .controls button{height:36px!important}\n  #shell .playbox .panel-title{justify-content:flex-start!important;gap:6px!important}\n  #shell .playbox .play-meta{display:block!important;min-width:0!important;max-width:calc(100% - 98px)!important;margin-left:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;text-align:left!important;font-size:7px!important}\n  .eqgrid{min-width:0!important;width:calc(100% - 30px)!important;height:100%!important;margin:0 0 0 30px!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;gap:0!important;padding:0!important;overflow:hidden!important}\n  .eqgrid .band{display:none!important;justify-items:center!important;align-items:center!important;grid-template-rows:10px minmax(0,1fr) 12px!important;font-size:5.7px!important}\n  .eqgrid .band:nth-child(1),.eqgrid .band:nth-child(5),.eqgrid .band:nth-child(9),.eqgrid .band:nth-child(13),.eqgrid .band:nth-child(17),.eqgrid .band:nth-child(21),.eqgrid .band:nth-child(23),.eqgrid .band:nth-child(24){display:grid!important}\n  .db-scale{left:4px!important;width:26px!important;top:42px!important;bottom:25px!important}\n`;
s=s.replace(cssMarker,css+cssMarker);
s=s.replace(/20260821-mobile-final-v\d+/g,'20260821-mobile-final-v11');

// 4) Analisador real: no mobile desenha 8 bandas, desktop continua 24.
const oldIdle=/  drawIdleAnalyzer\(\)\{[^\n]+\}/;
const oldGrid=/  drawAnalyzerGrid\(c,w,h\)\{[^\n]+\}/;
const oldDraw=/  drawAnalyzer\(\)\{[^\n]+\}/;
need(oldIdle.test(c),'drawIdleAnalyzer não encontrado');
need(oldGrid.test(c),'drawAnalyzerGrid não encontrado');
need(oldDraw.test(c),'drawAnalyzer não encontrado');
const idx='[0,4,8,12,16,20,22,23]';
c=c.replace(oldIdle,`  drawIdleAnalyzer(){if(!this.ctx2d)return;const r=this.canvas.getBoundingClientRect(),w=r.width,h=r.height,c=this.ctx2d;if(w<2||h<2)return;c.clearRect(0,0,w,h);this.drawAnalyzerGrid(c,w,h);const mobile=Number(this.getBoundingClientRect?.().width||0)<=640;const indexes=mobile?${idx}:Array.from({length:24},(_,i)=>i);const bw=(w-28)/indexes.length;indexes.forEach((src,i)=>{const amp=.18+.28*Math.abs(Math.sin(src*1.91));const bh=Math.max(4,(h-36)*amp);c.fillStyle='#19c958';c.fillRect(16+i*bw,h-18-bh,Math.max(2,bw-3),bh);});}`);
c=c.replace(oldGrid,`  drawAnalyzerGrid(c,w,h){c.fillStyle='#050908';c.fillRect(0,0,w,h);c.strokeStyle='rgba(80,120,100,.28)';c.lineWidth=1;for(let y=18;y<h-18;y+=Math.max(18,(h-36)/6)){c.beginPath();c.moveTo(14,y);c.lineTo(w-8,y);c.stroke();}const mobile=Number(this.getBoundingClientRect?.().width||0)<=640;const bands=mobile?8:24;for(let i=0;i<=bands;i++){const x=14+i*((w-22)/bands);c.beginPath();c.moveTo(x,8);c.lineTo(x,h-18);c.stroke();}c.fillStyle='#dce2de';c.font='9px Arial';c.fillText('+12',2,14);c.fillText('+6',5,h*.31);c.fillText('0',8,h*.52);c.fillText('-6',5,h*.72);c.fillText('-12',2,h-17);}`);
c=c.replace(oldDraw,`  drawAnalyzer(){cancelAnimationFrame(this.visualFrame);const draw=()=>{const r=this.canvas.getBoundingClientRect(),w=r.width,h=r.height,c=this.ctx2d;this.drawAnalyzerGrid(c,w,h);if(this.analyser){const bins=new Uint8Array(this.analyser.frequencyBinCount);this.analyser.getByteFrequencyData(bins);const mobile=Number(this.getBoundingClientRect?.().width||0)<=640;const indexes=mobile?${idx}:Array.from({length:24},(_,i)=>i);const bw=(w-28)/indexes.length;indexes.forEach((src,i)=>{const target=EQ_FREQS[src];const bin=Math.min(bins.length-1,Math.round(target/(this.audioCtx.sampleRate/2)*(bins.length-1)));let val=0,count=0;for(let j=Math.max(0,bin-2);j<=Math.min(bins.length-1,bin+2);j++){val+=bins[j];count++;}val=count?val/count:0;const bh=Math.max(2,(h-36)*(val/255));c.fillStyle='#18cf55';c.fillRect(16+i*bw,h-18-bh,Math.max(2,bw-3),bh);});}this.visualFrame=requestAnimationFrame(draw);};draw();}`);

fs.writeFileSync(skinPath,s);
fs.writeFileSync(corePath,c);
console.log('OK: mobile V11, TOCANDO estável, layout respirado, analisador/equalizador 8 bandas, largura 315 preservada');
