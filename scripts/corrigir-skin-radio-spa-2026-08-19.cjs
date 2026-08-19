const fs = require('fs');
const path = 'src/public/custom-elements/pelego-radio.js';
let s = fs.readFileSync(path, 'utf8');

const oldStyleBlock = `  if(!root.getElementById('pb-v548-reference-skin')){\n    const style = document.createElement('style');\n    style.id = 'pb-v548-reference-skin';\n    style.textContent = SKIN;\n    root.appendChild(style);\n  }`;
const newStyleBlock = `  let style = root.getElementById('pb-v548-reference-skin');\n  if(!style){\n    style = document.createElement('style');\n    style.id = 'pb-v548-reference-skin';\n    root.appendChild(style);\n  }\n  if(style.textContent !== SKIN) style.textContent = SKIN;\n  style.dataset.pelegoSkinRev = '20260819-final';`;

if (s.includes(oldStyleBlock)) {
  s = s.replace(oldStyleBlock, newStyleBlock);
} else if (!s.includes("style.dataset.pelegoSkinRev = '20260819-final';")) {
  throw new Error('Bloco de skin esperado não encontrado.');
}

const oldTail = `const RadioClass = customElements.get('pelego-radio');\npatchAnalyzer(RadioClass);\nqueueMicrotask(()=>{\n  document.querySelectorAll('pelego-radio').forEach(el=>applySkin(el));\n});`;
const newTail = `const RadioClass = customElements.get('pelego-radio');\npatchAnalyzer(RadioClass);\n\nconst applyAllSkins = ()=>{\n  document.querySelectorAll('pelego-radio').forEach(el=>{\n    try{ applySkin(el); }catch(_){}\n  });\n};\nconst scheduleSkinSweep = ()=>{\n  queueMicrotask(applyAllSkins);\n  requestAnimationFrame(()=>applyAllSkins());\n  setTimeout(applyAllSkins, 80);\n  setTimeout(applyAllSkins, 350);\n};\n\nscheduleSkinSweep();\n\nif(!window.__PELEGO_RADIO_SKIN_OBSERVER__){\n  window.__PELEGO_RADIO_SKIN_OBSERVER__ = new MutationObserver((mutations)=>{\n    for(const mutation of mutations){\n      for(const node of mutation.addedNodes || []){\n        if(node?.nodeType !== 1) continue;\n        if(node.matches?.('pelego-radio') || node.querySelector?.('pelego-radio')){\n          scheduleSkinSweep();\n          return;\n        }\n      }\n    }\n  });\n  window.__PELEGO_RADIO_SKIN_OBSERVER__.observe(document.documentElement,{childList:true,subtree:true});\n  window.addEventListener('pageshow',scheduleSkinSweep);\n  window.addEventListener('popstate',scheduleSkinSweep);\n  document.addEventListener('visibilitychange',()=>{\n    if(document.visibilityState === 'visible') scheduleSkinSweep();\n  });\n  window.__PELEGO_RADIO_SKIN_HEALER__ = setInterval(applyAllSkins,1200);\n}`;

if (s.includes(oldTail)) {
  s = s.replace(oldTail, newTail);
} else if (!s.includes('window.__PELEGO_RADIO_SKIN_OBSERVER__')) {
  throw new Error('Final do inicializador da skin não encontrado.');
}

fs.writeFileSync(path, s, 'utf8');
