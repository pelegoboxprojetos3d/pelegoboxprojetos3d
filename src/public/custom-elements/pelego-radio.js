import './pelego-radio-core.js';

const CUBE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5-8-4.5m8 4.5v9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
const BARS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10m4 10V6m4 14V3m4 17V8m4 12v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const HEADPHONES = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v7H5a1 1 0 0 1-1-1v-6Zm16 0h-3v7h2a1 1 0 0 0 1-1v-6Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
const GLOBE = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 12h17M12 3c2.3 2.4 3.5 5.4 3.5 9S14.3 18.6 12 21c-2.3-2.4-3.5-5.4-3.5-9S9.7 5.4 12 3Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`;
const BRAZIL = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M29.8 3.5 35 7.1l4.7-.8 2.7 5.5 6.3 1.7 1.2 5.3 5.6 4.1-3.1 4.4 1.9 5.2-4.5 5.3-2.7 5.6-5.8 4.2-1.2 7.2-4.6 5.7-2.2 7.1-5.3-5.5-2.1-7.5-5.2-4.6-2.2-7.1-5.7-4.5 2.6-6.3-4.1-5.5 3.6-5.7-2.1-5.8 5-4.4 1.8-6.5 6-1.4 3.7-5Z"/></svg>`;
const SAVE = `<svg viewBox="0 0 24 24"><path d="M5 3h12l2 2v16H5V3Zm3 0v6h8V3M8 21v-7h8v7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const EYE = `<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m4 4 16 16" stroke="currentColor" stroke-width="2"/></svg>`;
const TRASH = `<svg viewBox="0 0 24 24"><path d="M5 7h14m-10 0V4h6v3m-8 0 1 14h8l1-14" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

const SKIN = `
:host{width:100%!important;height:905px!important;max-height:none!important;min-height:905px!important;overflow:visible!important}
*{box-sizing:border-box}
.shell{
  width:100%!important;height:905px!important;max-height:none!important;min-height:905px!important;overflow:hidden!important;
  border:0!important;border-radius:0!important;background:#010504!important;box-shadow:none!important;
  padding:6px!important;gap:7px!important;
  grid-template-rows:40px 350px 210px 205px 60px!important;
}
.topbar{padding:0 8px!important;min-height:0!important}
.brandrow{gap:12px!important}.logo-bars{width:30px!important;height:29px!important}.title{font-size:24px!important;font-weight:400!important;letter-spacing:.2px!important}.title .green{font-weight:500!important}.subtitle{font-size:8px!important;margin-top:4px!important}.win{gap:25px!important;font-size:17px!important;padding-right:4px!important}
.grid-top{grid-template-columns:1fr 1fr 1.04fr!important;gap:12px!important;min-height:0!important;overflow:hidden!important}
.panel{background:linear-gradient(180deg,#020806,#010504)!important;border:1px solid #13d94f!important;border-radius:10px!important;box-shadow:0 0 9px rgba(0,255,75,.08) inset!important}
.panel-title{height:27px!important;padding:0 10px!important;gap:8px!important;color:#19ef5d!important;font-size:12px!important;font-weight:700!important;letter-spacing:.2px!important}
.panel-title .pb-icon{width:18px!important;height:18px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 18px!important;color:#19ef5d!important}.panel-title .pb-icon svg{width:18px!important;height:18px!important;display:block!important}
.product{height:calc(100% - 27px)!important;padding:0 11px 9px!important;grid-template-rows:minmax(0,1fr) 68px!important;min-height:0!important}
.product>div:last-child{display:grid!important;grid-template-rows:43px 25px!important;min-height:0!important}
.product-visual{min-height:0!important;border:0!important;border-radius:6px!important;overflow:hidden!important;display:flex!important;align-items:stretch!important;justify-content:center!important;background:#020706!important}
.product-visual img{display:block!important;object-fit:contain!important}
.grid-top>.panel:nth-child(1) .product-visual img{width:42%!important;height:100%!important;background:#f4f4f4!important}
.grid-top>.panel:nth-child(2) .product-visual{background:#f2f2f2!important}.grid-top>.panel:nth-child(2) .product-visual img{width:100%!important;height:100%!important;background:#f2f2f2!important}
.product-meta{padding:7px 1px 0!important;min-height:0!important;overflow:hidden!important}.product-code{font-size:12px!important;line-height:1.15!important;color:#19ef5d!important}.product-desc{font-size:9px!important;line-height:1.15!important;margin-top:5px!important;color:#fff!important}
.grid-top>.panel:nth-child(1) .product-code,.grid-top>.panel:nth-child(1) .product-desc{text-align:center!important}
.navrow{grid-template-columns:1fr 1fr 1.08fr!important;gap:5px!important;margin-top:0!important;align-items:end!important}.vbtn{height:25px!important;border-radius:6px!important;padding:0 5px!important;font-size:10px!important;background:linear-gradient(#15201b,#070b09)!important;border:1px solid #33423b!important}.vbtn.buy{background:linear-gradient(#10c94c,#089134)!important;border-color:#16e75b!important;font-size:10px!important}
.analyzer{grid-template-rows:27px minmax(0,1fr) 22px!important}.analyzer canvas{width:calc(100% - 28px)!important;height:100%!important;margin:0 14px!important;border:1px solid #486058!important;background:#020707!important}.bands-label{font-size:8px!important;border-top:0!important}.bands-label span{border-right:1px solid #33443c!important}
.grid-middle{grid-template-columns:2fr 1fr!important;gap:12px!important;min-height:0!important;overflow:hidden!important}.filters{padding-bottom:0!important}.filterbody{grid-template-columns:112px minmax(0,1fr)!important;gap:9px!important;padding:0 11px 10px!important;height:calc(100% - 27px)!important}.scopebuttons{gap:8px!important}.scope{border-radius:6px!important;font-size:9px!important;gap:5px!important;background:linear-gradient(#0b1510,#050a07)!important;border-color:#30453b!important}.scope.active{background:linear-gradient(#0ec648,#078a31)!important;border-color:#18ef5d!important}.scope .scope-icon{width:35px!important;height:30px!important;font-size:0!important;color:#c5cbc8!important;display:flex!important;align-items:center!important;justify-content:center!important}.scope.active .scope-icon{color:#fff!important}.scope .scope-icon svg{width:100%!important;height:100%!important;display:block!important;fill:currentColor!important}#national .scope-icon{width:40px!important;height:34px!important;color:#b8bfbc!important}#national .scope-icon svg{width:36px!important;height:34px!important;fill:currentColor!important;filter:drop-shadow(0 1px 0 rgba(0,0,0,.75))!important}#national.scope.active .scope-icon{color:#fff!important}
.genres{grid-template-columns:repeat(9,minmax(0,1fr))!important;grid-template-rows:repeat(6,1fr)!important;grid-auto-rows:auto!important;gap:5px!important;padding-top:1px!important;overflow:hidden!important}.genre{height:auto!important;min-height:0!important;border-radius:5px!important;font-size:7px!important;border-color:#35483f!important;background:linear-gradient(#131c18,#070b09)!important}.genre.active{background:linear-gradient(#0fbd47,#087d30)!important;border-color:#12de53!important}
.playbox{grid-template-rows:27px minmax(0,1fr)!important}.playbody{padding:0 14px 10px!important;grid-template-rows:9px 23px 18px 32px 8px 27px!important;gap:1px!important}.label{font-size:8px!important}.playbody select{height:23px!important;font-size:9px!important}.volrow{grid-template-columns:22px minmax(0,1fr) 32px!important;font-size:8px!important}.randomrow{gap:14px!important}.randomrow label{grid-template-rows:9px 21px!important}.randomrow label:first-child .label{background:#049a32!important;border:1px solid #16d954!important;text-align:center!important;padding-top:1px!important}.randomrow .label{font-size:7px!important}.hint{font-size:7px!important}.controls{gap:12px!important}.controls button{height:27px!important;font-size:10px!important;border-radius:5px!important}.controls .play{background:linear-gradient(#0fc14a,#087f31)!important}.controls .stop{background:linear-gradient(#d73931,#9b1c17)!important}
.eqpanel{position:relative!important;grid-template-rows:29px minmax(0,1fr) 23px!important;padding:0 11px 8px!important;min-height:0!important}.eqhead{min-height:0!important}.eqtitle{font-size:12px!important;font-weight:700!important}.preset{font-size:8px!important}.preset select{width:110px!important;height:23px!important;min-width:110px!important}.eqgrid{padding:0 8px 0 38px!important;gap:3px!important;min-height:0!important;overflow:hidden!important}.band{grid-template-rows:12px minmax(0,1fr) 13px!important;font-size:7px!important}.sliderwrap:before{height:88%!important;width:3px!important;background:linear-gradient(#335349,#17e75a,#335349)!important}.band input[type=range]{width:72px!important;height:16px!important}.band input::-webkit-slider-thumb{width:15px!important;height:15px!important;border-radius:1px!important}.eqgroups{margin-left:38px!important;height:23px!important}.eqgroups span{font-size:9px!important;padding-top:4px!important}.eqpanel:before{content:'+12\A 0\A -12';white-space:pre;position:absolute;left:17px;top:47px;bottom:42px;width:22px;display:flex;flex-direction:column;justify-content:space-between;color:#fff;font-size:7px;line-height:31px;pointer-events:none}
.footer{grid-template-columns:1fr 1fr 1.55fr 1.6fr!important;gap:10px!important;min-height:0!important}.footer button,.versionbox{height:100%!important;border:1px solid #293b33!important;border-radius:6px!important;background:linear-gradient(#17201d,#0b0f0d)!important}.footer button{font-size:13px!important;gap:14px!important}.footer .pb-foot-icon{width:23px;height:23px;display:inline-flex}.footer .pb-foot-icon svg{width:23px;height:23px;display:block}.footer .danger{color:#ff5d58!important}.versionbox{font-size:8px!important;color:#b4beb8!important}
@media(max-width:640px){
  :host{width:315px!important;max-width:315px!important;height:auto!important;max-height:none!important;min-height:0!important;margin:0 auto!important;overflow:visible!important}
  .shell{width:315px!important;max-width:315px!important;height:auto!important;min-height:1180px!important;max-height:none!important;overflow:hidden!important;grid-template-rows:auto auto auto auto auto!important;padding:5px!important;gap:7px!important}
  .topbar{min-height:42px!important;padding:0 4px!important}.brandrow{gap:6px!important}.logo-bars{width:22px!important;height:24px!important}.title{font-size:14px!important;white-space:nowrap!important}.subtitle{font-size:5.5px!important;white-space:nowrap!important;margin-top:2px!important}.win{display:none!important}
  .grid-top,.grid-middle{grid-template-columns:1fr!important;gap:7px!important;overflow:visible!important}
  .grid-top>.panel:nth-child(1),.grid-top>.panel:nth-child(2){min-height:270px!important}.grid-top>.panel:nth-child(3){min-height:330px!important}
  .grid-top>.panel:nth-child(1) .product-visual img{width:100%!important;height:100%!important;object-fit:contain!important}
  .panel-title{font-size:10px!important;height:25px!important}.product{height:calc(100% - 25px)!important;padding:0 6px 7px!important}.product-meta{padding-top:4px!important}.product-code{font-size:10px!important}.product-desc{font-size:7px!important}.vbtn,.vbtn.buy{height:24px!important;font-size:8px!important}
  .filters{min-height:300px!important}.filterbody{grid-template-columns:90px minmax(0,1fr)!important;padding:0 7px 8px!important;gap:6px!important}.genres{grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-template-rows:none!important;grid-auto-rows:20px!important;overflow:auto!important}.scope{font-size:8px!important}.scope .scope-icon{width:30px!important;height:26px!important}
  .playbox{min-height:235px!important}.playbody{padding:0 8px 8px!important}.randomrow{gap:5px!important}.controls{gap:5px!important}
  .eqpanel{min-height:320px!important;overflow-x:auto!important;padding-left:6px!important;padding-right:6px!important}.eqgrid{min-width:760px!important;padding-left:30px!important}.eqgroups{min-width:760px!important;margin-left:30px!important}.eqpanel:before{left:8px!important}
  .footer{grid-template-columns:1fr 1fr!important;min-height:100px!important}.footer button{min-height:45px!important;font-size:10px!important}.versionbox{min-height:45px!important}
}
`;

function title(el, html){ if(el) el.innerHTML = html; }

function applySkin(el){
  const root = el?.shadowRoot;
  if(!root) return;
  if(!root.getElementById('pb-v548-reference-skin')){
    const style = document.createElement('style');
    style.id = 'pb-v548-reference-skin';
    style.textContent = SKIN;
    root.appendChild(style);
  }

  const top = root.querySelectorAll('.grid-top .panel-title');
  title(top[0], `<span class="pb-icon">${CUBE}</span>PROJETOS FEITOS DO ZERO`);
  title(top[1], `<span class="pb-icon">${CUBE}</span>PROJETOS PRONTOS`);
  title(top[2], `<span class="pb-icon">${BARS}</span>ANALISADOR - 24 BANDAS`);
  title(root.querySelector('.filters .panel-title'), `<span class="pb-icon">${HEADPHONES}</span>ESCOLHA O QUE QUER OUVIR`);
  title(root.querySelector('.playbox .panel-title'), `<span class="pb-icon" style="font-size:18px">♫</span>TOCANDO`);

  const international = root.querySelector('#international .scope-icon');
  if(international) international.innerHTML = GLOBE;
  const national = root.querySelector('#national .scope-icon');
  if(national) national.innerHTML = BRAZIL;

  const save = root.getElementById('save');
  if(save) save.innerHTML = `<span class="pb-foot-icon">${SAVE}</span><span>SALVAR</span>`;
  const hide = root.getElementById('hide');
  if(hide && !hide.dataset.pbSkin){ hide.innerHTML = `<span class="pb-foot-icon">${EYE}</span><span>OCULTAR</span>`; hide.dataset.pbSkin='1'; }
  const uninstall = root.getElementById('uninstall');
  if(uninstall) uninstall.innerHTML = `<span class="pb-foot-icon">${TRASH}</span><span>DESINSTALAR APLICATIVO</span>`;

  requestAnimationFrame(()=>{ try{ el.resizeCanvas?.(); el.drawIdleAnalyzer?.(); }catch(_){} });
}

function patchAnalyzer(Klass){
  if(!Klass || Klass.prototype.__pbReferencePatched) return;
  const p = Klass.prototype;
  p.__pbReferencePatched = true;

  p.drawAnalyzerGrid = function(c,w,h){
    c.fillStyle='#020707'; c.fillRect(0,0,w,h);
    const left=34,right=9,top=14,bottom=29;
    c.strokeStyle='rgba(69,103,90,.50)'; c.lineWidth=1;
    for(let i=0;i<=24;i++){ const x=left+(w-left-right)*(i/24); c.beginPath(); c.moveTo(x,top); c.lineTo(x,h-bottom); c.stroke(); }
    for(let i=0;i<=12;i++){ const y=top+(h-top-bottom)*(i/12); c.beginPath(); c.moveTo(left,y); c.lineTo(w-right,y); c.stroke(); }
    c.fillStyle='#e8eeea'; c.font='7px Arial';
    c.fillText('+12',2,15); c.fillText('+6',5,Math.round(h*.28)); c.fillText('0',8,Math.round(h*.51)); c.fillText('-6',5,Math.round(h*.72)); c.fillText('-12',2,h-26);
    const labels=['40','50','63','80','100','125','160','200','250','315','400','500','630','800','1K','1.25K','1.6K','2K','2.5K','3.15K','4K','6.3K','10K','16K'];
    labels.forEach((t,i)=>{ const x=left+(w-left-right)*((i+.5)/24); c.fillText(t,x-5,h-16); });
  };

  p.__pbDrawSegments = function(values){
    if(!this.ctx2d || !this.canvas) return;
    const r=this.canvas.getBoundingClientRect(),w=r.width,h=r.height,c=this.ctx2d;
    if(w<2||h<2) return;
    this.drawAnalyzerGrid(c,w,h);
    const left=34,right=9,top=14,bottom=30,usableW=w-left-right,usableH=h-top-bottom,bw=usableW/24,segs=12,gap=2,segH=Math.max(2,(usableH-(segs-1)*gap)/segs);
    for(let i=0;i<24;i++){
      const level=Math.max(1,Math.min(segs,Math.round((values[i]||0)*segs)));
      for(let s=0;s<level;s++){
        const y=h-bottom-(s+1)*segH-s*gap;
        c.fillStyle=s>=10?'#4cff7a':'#12d84d';
        c.fillRect(left+i*bw+2,y,Math.max(3,bw-4),segH);
      }
    }
  };

  p.drawIdleAnalyzer = function(){
    const vals=Array.from({length:24},(_,i)=>.25+.45*(.55+.45*Math.sin(i*.55+1.2)));
    this.__pbDrawSegments(vals);
  };

  p.drawAnalyzer = function(){
    cancelAnimationFrame(this.visualFrame);
    const loop=()=>{
      const values=Array(24).fill(.05);
      if(this.analyser && this.audioCtx){
        const bins=new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(bins);
        const freqs=[40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,6300,10000,16000];
        for(let i=0;i<24;i++){
          const idx=Math.min(bins.length-1,Math.round(freqs[i]/(this.audioCtx.sampleRate/2)*(bins.length-1)));
          let sum=0,count=0;
          for(let j=Math.max(0,idx-2);j<=Math.min(bins.length-1,idx+2);j++){sum+=bins[j];count++;}
          values[i]=(count?sum/count:0)/255;
        }
      }
      this.__pbDrawSegments(values);
      this.visualFrame=requestAnimationFrame(loop);
    };
    loop();
  };

  const originalConnected = p.connectedCallback;
  p.connectedCallback = function(){
    originalConnected?.call(this);
    applySkin(this);
  };
}

const RadioClass = customElements.get('pelego-radio');
patchAnalyzer(RadioClass);
queueMicrotask(()=>{
  document.querySelectorAll('pelego-radio').forEach(el=>applySkin(el));
});
