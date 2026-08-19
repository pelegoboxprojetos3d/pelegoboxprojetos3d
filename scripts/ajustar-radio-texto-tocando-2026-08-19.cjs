const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio-core.js';
let source = fs.readFileSync(file, 'utf8');

const rule = '#shell .playbox .hint{transform:translateY(5px)!important;}';

if (source.includes(rule)) {
  console.log('Ajuste do texto Tocando já aplicado.');
  process.exit(0);
}

const marker = '#shell .playbox .randomrow label.active-mode{border-color:#18ef5d!important;box-shadow:0 0 0 1px rgba(24,239,93,.22),0 0 10px rgba(24,239,93,.18)!important;background:linear-gradient(180deg,rgba(8,35,17,.72),rgba(2,13,7,.72))!important}';

if (!source.includes(marker)) {
  throw new Error('Marcador do painel Tocando não encontrado; arquivo mudou e o ajuste foi abortado para não quebrar o restante.');
}

source = source.replace(marker, marker + rule);
fs.writeFileSync(file, source, 'utf8');
console.log('Texto Tocando baixado 5px sem alterar o restante do layout.');
