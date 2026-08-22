const fs = require('fs');

const target = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(target, 'utf8');

const marker = 'PB_V42_CORE_ONLY_MOBILE';
if (src.includes(marker)) {
  console.log('V42 já aplicada.');
  process.exit(0);
}

const from = "const skinForThisView = mobile ? MOBILE_CLEAN_SKIN : SKIN;";
const to = "/* PB_V42_CORE_ONLY_MOBILE: no mobile, o core é o único dono do layout. */\n  const skinForThisView = mobile ? '' : SKIN;";

if (!src.includes(from)) {
  throw new Error('Linha de seleção da skin não encontrada. Abortando sem alterar arquivo.');
}

src = src.replace(from, to);

const revFrom = "style.dataset.pelegoSkinRev = mobile ? '20260821-mobile-final-v33' : '20260821-desktop-preservado-v2';";
const revTo = "style.dataset.pelegoSkinRev = mobile ? '20260822-mobile-core-only-v42' : '20260821-desktop-preservado-v2';";
if (src.includes(revFrom)) src = src.replace(revFrom, revTo);

fs.writeFileSync(target, src, 'utf8');
console.log('V42 aplicada: skin mobile duplicada desativada; core permanece como fonte única do layout.');
