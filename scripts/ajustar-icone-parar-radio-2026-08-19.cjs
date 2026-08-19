const fs = require('fs');
const path = 'src/public/custom-elements/pelego-radio-core.js';
let s = fs.readFileSync(path, 'utf8');

const oldButton = '<button class="stop" id="stop">■ PARAR</button>';
const newButton = '<button class="stop" id="stop"><span class="stop-square" aria-hidden="true"></span><span>PARAR</span></button>';
if (!s.includes(oldButton) && !s.includes(newButton)) {
  throw new Error('Botão PARAR não encontrado no formato esperado.');
}
s = s.replace(oldButton, newButton);

const anchor = '.controls .stop{background:linear-gradient(#d62d25,#941a16);border-color:#f34a41}';
const css = '.controls .stop{background:linear-gradient(#d62d25,#941a16);border-color:#f34a41;display:flex;align-items:center;justify-content:center;gap:8px}.controls .stop .stop-square{width:13px;height:13px;display:inline-block;flex:0 0 13px;background:currentColor;border-radius:1px}';
if (!s.includes(css)) {
  if (!s.includes(anchor)) throw new Error('Âncora CSS do botão PARAR não encontrada.');
  s = s.replace(anchor, css);
}

fs.writeFileSync(path, s);
console.log('Ícone PARAR ajustado para quadrado 13x13px, proporcional aos demais controles.');
