const fs = require('fs');

const radioFile = 'src/public/custom-elements/pelego-radio.js';
const persistentFile = 'src/public/radioPelegoPersistente.js';
let radio = fs.readFileSync(radioFile, 'utf8');
let persistent = fs.readFileSync(persistentFile, 'utf8');

// V39: não altera nenhuma medida visual aprovada. Corrige somente a detecção
// de mobile durante a hidratação do Wix e amplia a leitura de teclas multimídia.

if (!radio.includes('PB_RESPONSIVE_HOST_V39')) {
  const oldMobile = `function isMobileRadio(el){\n  return !!window.matchMedia?.('(max-width:640px)')?.matches;\n}`;
  const newMobile = `function isMobileRadio(el){\n  /* PB_RESPONSIVE_HOST_V39 */\n  const hostWidth = Number(el?.getBoundingClientRect?.().width || 0);\n  const viewportWidth = Number(window.visualViewport?.width || document.documentElement?.clientWidth || window.innerWidth || 0);\n  if(hostWidth > 0) return hostWidth <= 640;\n  if(viewportWidth > 0) return viewportWidth <= 640;\n  return !!window.matchMedia?.('(max-width:640px)')?.matches;\n}`;
  if (!radio.includes(oldMobile)) throw new Error('V39: função isMobileRadio original não encontrada.');
  radio = radio.replace(oldMobile, newMobile);

  const oldConnected = `  const originalConnected = p.connectedCallback;\n  p.connectedCallback = function(){\n    originalConnected?.call(this);\n    bindSingleEngine(this);\n    applySkin(this);\n    requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(this.isConnected) applySkin(this); }));\n  };`;
  const newConnected = `  const originalConnected = p.connectedCallback;\n  p.connectedCallback = function(){\n    originalConnected?.call(this);\n    bindSingleEngine(this);\n    applySkin(this);\n    if(!this.__pbResponsiveSkinObserver && typeof ResizeObserver === 'function'){\n      let lastWidth = -1;\n      let lastMobile = null;\n      let resizeFrame = 0;\n      this.__pbResponsiveSkinObserver = new ResizeObserver(()=>{\n        if(!this.isConnected) return;\n        const width = Math.round(Number(this.getBoundingClientRect?.().width || 0));\n        const mobile = isMobileRadio(this);\n        if(width === lastWidth && mobile === lastMobile) return;\n        lastWidth = width;\n        lastMobile = mobile;\n        cancelAnimationFrame(resizeFrame);\n        resizeFrame = requestAnimationFrame(()=>{\n          if(!this.isConnected) return;\n          applySkin(this);\n          try{ this.resizeCanvas?.(); this.drawIdleAnalyzer?.(); }catch(_){}\n        });\n      });\n      this.__pbResponsiveSkinObserver.observe(this);\n    }\n    requestAnimationFrame(()=>requestAnimationFrame(()=>{ if(this.isConnected) applySkin(this); }));\n  };\n\n  const originalDisconnected = p.disconnectedCallback;\n  p.disconnectedCallback = function(){\n    try{ this.__pbResponsiveSkinObserver?.disconnect?.(); }catch(_){}\n    this.__pbResponsiveSkinObserver = null;\n    return originalDisconnected?.call(this);\n  };`;
  if (!radio.includes(oldConnected)) throw new Error('V39: connectedCallback patchado não encontrado.');
  radio = radio.replace(oldConnected, newConnected);

  const oldVisibility = `  window.addEventListener('pageshow',scheduleSkinSweep);\n  window.addEventListener('popstate',scheduleSkinSweep);`;
  const newVisibility = `  window.addEventListener('pageshow',scheduleSkinSweep);\n  window.addEventListener('popstate',scheduleSkinSweep);\n  window.addEventListener('resize',scheduleSkinSweep,{passive:true});\n  try{ window.visualViewport?.addEventListener('resize',scheduleSkinSweep,{passive:true}); }catch(_){} `;
  if (!radio.includes(oldVisibility)) throw new Error('V39: listeners de skin não encontrados.');
  radio = radio.replace(oldVisibility, newVisibility);
}

if (!persistent.includes('PB_MEDIA_KEYS_V39_LEGACY')) {
  if (!persistent.includes('PB_MEDIA_KEYS_V38')) throw new Error('V39 exige V38 aplicada.');

  // Amplia os nomes reportados por navegadores/drivers.
  persistent = persistent.split("const nextKeys=['MediaTrackNext','MediaNextTrack','NextTrack','BrowserForward'];")
    .join("const nextKeys=['MediaTrackNext','MediaNextTrack','NextTrack','BrowserForward','MediaFastForward','FastForward'];");
  persistent = persistent.split("const prevKeys=['MediaTrackPrevious','MediaPreviousTrack','PreviousTrack','BrowserBack'];")
    .join("const prevKeys=['MediaTrackPrevious','MediaPreviousTrack','PreviousTrack','BrowserBack','MediaRewind','Rewind'];");
  persistent = persistent.split("const muteKeys=['AudioVolumeMute','VolumeMute'];")
    .join("const muteKeys=['AudioVolumeMute','VolumeMute','MediaSelect','SelectMedia','LaunchMediaPlayer'];");

  // Alguns teclados só chegam ao Chrome com key='Unidentified', mas preservam
  // os códigos virtuais clássicos do Windows.
  persistent = persistent.split("const key=String(event.key||event.code||'');")
    .join("const key=String(event.key||event.code||'');const keyCode=Number(event.keyCode||event.which||0);/* PB_MEDIA_KEYS_V39_LEGACY */");

  persistent = persistent.split("if(nextKeys.includes(key)){")
    .join("if(nextKeys.includes(key)||keyCode===176||keyCode===167){");
  persistent = persistent.split("if(prevKeys.includes(key)){")
    .join("if(prevKeys.includes(key)||keyCode===177||keyCode===166){");
  persistent = persistent.split("if(playKeys.includes(key)){")
    .join("if(playKeys.includes(key)||keyCode===179){");
  persistent = persistent.split("if(stopKeys.includes(key)){")
    .join("if(stopKeys.includes(key)||keyCode===178){");
  persistent = persistent.split("if(upKeys.includes(key)){")
    .join("if(upKeys.includes(key)||keyCode===175){");
  persistent = persistent.split("if(downKeys.includes(key)){")
    .join("if(downKeys.includes(key)||keyCode===174){");
  persistent = persistent.split("if(muteKeys.includes(key)){")
    .join("if(muteKeys.includes(key)||keyCode===173){");
}

fs.writeFileSync(radioFile, radio, 'utf8');
fs.writeFileSync(persistentFile, persistent, 'utf8');

const radioRequired = [
  'PB_RESPONSIVE_HOST_V39',
  'hostWidth <= 640',
  '__pbResponsiveSkinObserver',
  "window.addEventListener('resize',scheduleSkinSweep",
  "visualViewport?.addEventListener('resize'"
];
for (const token of radioRequired) if (!radio.includes(token)) throw new Error('V39 radio falhou: ' + token);

const mediaRequired = [
  'PB_MEDIA_KEYS_V39_LEGACY',
  'keyCode===176',
  'keyCode===177',
  'keyCode===179',
  'keyCode===173',
  'MediaFastForward',
  'MediaRewind'
];
for (const token of mediaRequired) if (!persistent.includes(token)) throw new Error('V39 teclas falhou: ' + token);

console.log('V39 aplicada: mobile por largura real + ResizeObserver; teclas multimídia modernas e legadas.');
