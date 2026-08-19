const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let s = fs.readFileSync(file, 'utf8');

function rep(from, to, label) {
  if (!s.includes(from)) {
    throw new Error(`Trecho não encontrado para: ${label}`);
  }
  s = s.replace(from, to);
}

rep(
  ':host{width:100%!important;height:720px!important;max-height:none!important;min-height:720px!important;overflow:visible!important}',
  ':host{width:100%!important;height:835px!important;max-height:none!important;min-height:835px!important;overflow:visible!important}',
  'altura do host'
);

rep(
  'width:100%!important;height:720px!important;max-height:none!important;min-height:720px!important;overflow:hidden!important;',
  'width:100%!important;height:835px!important;max-height:none!important;min-height:835px!important;overflow:hidden!important;',
  'altura da shell'
);

rep(
  'grid-template-rows:40px 280px 160px 150px 50px!important;',
  'grid-template-rows:40px 280px 245px 180px 50px!important;',
  'distribuição vertical principal'
);

rep(
  '.analyzer{grid-template-rows:27px minmax(0,1fr) 22px!important}',
  '.analyzer{grid-template-rows:27px minmax(0,1fr) 22px!important;height:260px!important;align-self:start!important}',
  'altura visual do analisador'
);

rep(
  '.playbox{grid-template-rows:27px minmax(0,1fr)!important;margin-top:-7px!important;height:calc(100% + 7px)!important}',
  '.playbox{grid-template-rows:27px minmax(0,1fr)!important;margin-top:-27px!important;height:calc(100% + 27px)!important}',
  'retângulo tocando'
);

rep(
  '.playbody{padding:0 14px 10px!important;grid-template-rows:9px 23px 18px 32px 8px 27px!important;gap:1px!important}',
  '.playbody{padding:6px 14px 10px!important;grid-template-rows:12px 28px 22px 44px minmax(18px,1fr) 34px!important;gap:3px!important}',
  'layout interno tocando'
);

rep(
  '.label{font-size:8px!important}.playbody select{height:23px!important;font-size:9px!important}.volrow{grid-template-columns:22px minmax(0,1fr) 32px!important;font-size:8px!important}',
  '.label{font-size:9px!important}.playbody select{height:28px!important;font-size:10px!important}.volrow{grid-template-columns:22px minmax(0,1fr) 36px!important;font-size:9px!important}',
  'textos e controles do tocando'
);

rep(
  '.randomrow{gap:14px!important}.randomrow label{grid-template-rows:9px 21px!important}',
  '.randomrow{gap:14px!important}.randomrow label{grid-template-rows:12px 28px!important}',
  'campos de aleatoriedade'
);

rep(
  '.randomrow .label{font-size:7px!important}.hint{font-size:8.5px!important;line-height:8px!important;color:#fff!important;font-weight:500!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.controls{gap:12px!important}.controls button{height:27px!important;font-size:10px!important;border-radius:5px!important}',
  '.randomrow .label{font-size:8px!important}.hint{font-size:9px!important;line-height:11px!important;color:#fff!important;font-weight:500!important;white-space:normal!important;overflow:hidden!important;text-overflow:clip!important;padding-top:1px!important}.controls{gap:12px!important}.controls button{height:34px!important;font-size:11px!important;border-radius:5px!important}',
  'frase branca e botões do tocando'
);

rep(
  '.grid-top>.panel:nth-child(3){min-height:330px!important}',
  '.grid-top>.panel:nth-child(3){min-height:330px!important;height:auto!important}',
  'preservar analisador no mobile'
);

rep(
  '.playbox{min-height:235px!important}.playbody{padding:0 8px 8px!important}',
  '.playbox{min-height:235px!important;margin-top:0!important;height:auto!important}.playbody{padding:0 8px 8px!important}',
  'preservar tocando no mobile'
);

fs.writeFileSync(file, s);
console.log('Rádio Pelego ajustada: +115px de altura, analisador menor e TOCANDO maior.');
