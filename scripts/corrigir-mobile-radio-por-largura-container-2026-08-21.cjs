const fs = require('fs');
const path = 'src/public/custom-elements/pelego-radio.js';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes("function title(el, html){ if(el) el.innerHTML = html; }")) {
  throw new Error('Ponto de inserção da detecção mobile não encontrado.');
}

if (!s.includes('function isMobileRadio(el){')) {
  s = s.replace(
    "function title(el, html){ if(el) el.innerHTML = html; }",
    `function title(el, html){ if(el) el.innerHTML = html; }\n\nfunction isMobileRadio(el){\n  const own = Number(el?.getBoundingClientRect?.().width || el?.clientWidth || 0);\n  const parent = Number(el?.parentElement?.getBoundingClientRect?.().width || 0);\n  const viewportMobile = !!window.matchMedia?.('(max-width:640px)')?.matches;\n  return viewportMobile || (own > 0 && own <= 640) || (parent > 0 && parent <= 640);\n}`
  );
}

const oldSkinLine = "  if(style.textContent !== SKIN) style.textContent = SKIN;\n  style.dataset.pelegoSkinRev = '20260820-mobile-compact';\n\n  const top = root.querySelectorAll('.grid-top .panel-title');\n  const mobile = window.matchMedia('(max-width:640px)').matches;";
const newSkinLine = "  const mobile = isMobileRadio(el);\n  const skinForThisView = mobile ? SKIN.replace('@media(max-width:640px){','@media(max-width:100000px){') : SKIN;\n  if(style.textContent !== skinForThisView) style.textContent = skinForThisView;\n  style.dataset.pelegoSkinRev = mobile ? '20260821-mobile-container-v2' : '20260821-desktop-preservado-v2';\n\n  if(!el.__pbMobileResizeObserver && typeof ResizeObserver !== 'undefined'){\n    el.__pbMobileResizeObserver = new ResizeObserver(()=>{ try{ applySkin(el); }catch(_){} });\n    el.__pbMobileResizeObserver.observe(el);\n  }\n\n  const top = root.querySelectorAll('.grid-top .panel-title');";

if (s.includes(oldSkinLine)) {
  s = s.replace(oldSkinLine, newSkinLine);
} else if (!s.includes("const skinForThisView = mobile ? SKIN.replace('@media(max-width:640px){','@media(max-width:100000px){') : SKIN;")) {
  throw new Error('Bloco applySkin esperado não encontrado.');
}

s = s.replaceAll("window.matchMedia('(max-width:640px)').matches?6:24", "isMobileRadio(this)?6:24");
s = s.replaceAll("const mobile=window.matchMedia('(max-width:640px)').matches;", "const mobile=isMobileRadio(this);");

fs.writeFileSync(path, s, 'utf8');
console.log('Detecção mobile da Rádio Pelego corrigida por largura real do componente.');
