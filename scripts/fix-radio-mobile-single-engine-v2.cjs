const fs=require('fs');
const path='src/public/custom-elements/pelego-radio.js';
let s=fs.readFileSync(path,'utf8');
function rep(a,b,label){if(!s.includes(a))throw new Error('Nao achei: '+label);s=s.replace(a,b);}
rep(".grid-top>.panel:nth-child(3),.analyzer{min-height:129px!important;height:129px!important;max-height:129px!important}",".grid-top>.panel:nth-child(3),.analyzer{min-height:148px!important;height:148px!important;max-height:148px!important}",'altura analisador');
rep(".eqgrid{min-width:0!important;width:100%!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:3px!important;padding:2px 4px 0 25px!important;overflow:hidden!important;align-items:stretch!important}",".eqgrid{min-width:0!important;width:100%!important;grid-template-columns:repeat(6,30px)!important;gap:9px!important;padding:2px 0 0 25px!important;overflow:hidden!important;align-items:stretch!important;justify-content:center!important}",'espacamento equalizador');
rep(".playbox .panel-title{justify-content:flex-start!important;text-align:left!important}.playbox .play-title-left{margin:0!important;justify-content:flex-start!important}.playbox .play-meta{display:none!important}","#shell .playbox .panel-title{justify-content:flex-start!important;text-align:left!important;gap:6px!important}#shell .playbox .play-title-left{margin:0!important;justify-content:flex-start!important;display:inline-flex!important;align-items:center!important;gap:6px!important}#shell .playbox .play-meta{display:none!important}",'titulo tocando');
rep("const mobile=window.matchMedia('(max-width:640px)').matches,count=mobile?6:24;","const mobile=isMobileRadio(this),count=mobile?6:24;",'analisador mobile container');
rep("function applySkin(el){\n  const root = el?.shadowRoot;\n  if(!root) return;","function applySkin(el){\n  const root = el?.shadowRoot;\n  if(!root) return;\n  bindSingleEngine(el);",'bind no skin');
const marker='function patchAnalyzer(Klass){';
if(!s.includes(marker))throw new Error('Nao achei patchAnalyzer');
if(!s.includes('function bindSingleEngine(el){')){
const helper=`function bindSingleEngine(el){
  const engine=window.PelegoRadioPersistent;
  if(!el || !engine?.audio) return false;
  try{
    if(el.localAudio && el.localAudio!==engine.audio){
      if(!el.localAudio.paused) el.localAudio.pause();
      if(el.localAudio.getAttribute?.('src')){ el.localAudio.removeAttribute('src'); el.localAudio.load?.(); }
    }
  }catch(_){}
  const changed=el.persistentRadio!==engine || el.audio!==engine.audio;
  el.persistentRadio=engine;
  el.audio=engine.audio;
  try{
    const snap=engine.snapshot?.();
    if(engine.currentStation) el.currentStation={...engine.currentStation};
    if(snap?.audioCtx) el.audioCtx=snap.audioCtx;
    if(snap?.analyser) el.analyser=snap.analyser;
    el.filters=snap?.filters||el.filters||[];
    if(snap?.gainNode) el.gainNode=snap.gainNode;
    if(snap?.playing && !snap?.analyser && typeof engine.ensureGraph==='function' && !el.__pbEnsuringGraph){
      el.__pbEnsuringGraph=true;
      Promise.resolve(engine.ensureGraph()).then(()=>{el.__pbEnsuringGraph=false;bindSingleEngine(el);try{el.drawAnalyzer?.();}catch(_){}}).catch(()=>{el.__pbEnsuringGraph=false;});
    }
    if(snap?.playing){
      el.$?.('play') && (el.$('play').textContent='❚❚ PAUSAR');
      if(el.status) el.status.textContent='Tocando: '+(engine.currentStation?.name||'PELEGO RADIO');
      if(el.analyser) el.drawAnalyzer?.();
    }else if(el.$?.('play')) el.$('play').textContent='▶ TOCAR';
    el.updatePlayMeta?.();
  }catch(_){}
  if(!el.__pbEngineStateHandler){
    el.__pbEngineStateHandler=()=>{if(el.isConnected)bindSingleEngine(el);};
    window.addEventListener('pelego-radio-state',el.__pbEngineStateHandler);
  }
  if(changed && !el.__pbInitialEngineSync){
    el.__pbInitialEngineSync=true;
    queueMicrotask(()=>{try{el.syncPersistentState?.();}catch(_){}});
  }
  return true;
}

async function waitSingleEngine(el,timeout=2500){
  const end=Date.now()+timeout;
  do{
    if(bindSingleEngine(el)) return true;
    await new Promise(r=>setTimeout(r,50));
  }while(Date.now()<end);
  return false;
}

`;
s=s.replace(marker,helper+marker);
}
const anchor="  const originalConnected = p.connectedCallback;\n  p.connectedCallback = function(){\n    originalConnected?.call(this);\n    applySkin(this);\n  };";
if(!s.includes(anchor))throw new Error('Nao achei connected patch');
const replacement=`  const originalPlay = p.play;
  p.play = async function(...args){
    if(!(await waitSingleEngine(this))){ if(this.status)this.status.textContent='Motor da Rádio carregando. Tente novamente.'; return false; }
    return originalPlay?.apply(this,args);
  };
  const originalNext = p.nextStation;
  p.nextStation = async function(...args){
    if(!(await waitSingleEngine(this))){ if(this.status)this.status.textContent='Motor da Rádio carregando. Tente novamente.'; return false; }
    return originalNext?.apply(this,args);
  };
  const originalStop = p.stop;
  p.stop = function(...args){ bindSingleEngine(this); return originalStop?.apply(this,args); };
  const originalSync = p.syncPersistentState;
  p.syncPersistentState = function(...args){ bindSingleEngine(this); if(!this.persistentRadio)return; return originalSync?.apply(this,args); };

  const originalConnected = p.connectedCallback;
  p.connectedCallback = function(){
    originalConnected?.call(this);
    bindSingleEngine(this);
    applySkin(this);
  };`;
s=s.replace(anchor,replacement);
fs.writeFileSync(path,s);
console.log('OK: mobile refinado e player da pagina preso ao motor global unico');
