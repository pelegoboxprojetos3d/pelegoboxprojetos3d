const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let src = fs.readFileSync(file, 'utf8');

const replaceAllExact = (from, to, label) => {
  if (!src.includes(from)) throw new Error(`V35 não encontrou: ${label}`);
  src = src.split(from).join(to);
};

/* 1) O host/shell deve terminar junto com os quatro painéis, sem sobra preta artificial. */
replaceAllExact(
  'height:auto!important;min-height:700px!important;max-height:none!important;',
  'height:auto!important;min-height:0!important;max-height:none!important;',
  'min-height 700 do host/shell'
);

/* 2) ANALISADOR: reserva folga interna real para GRAVE / MÉDIO / AGUDO. */
replaceAllExact(
  '.analyzer{display:grid!important;grid-template-rows:25px 118px 17px!important;overflow:hidden!important}',
  '.analyzer{display:grid!important;grid-template-rows:25px 114px 17px!important;overflow:hidden!important}',
  'linhas do analisador'
);
replaceAllExact(
  '.analyzer canvas{display:block!important;width:286px!important;height:118px!important;min-height:118px!important;max-height:118px!important;margin:0 7px!important;border:1px solid #385047!important;border-radius:3px!important;background:#020707!important}',
  '.analyzer canvas{display:block!important;width:286px!important;height:114px!important;min-height:114px!important;max-height:114px!important;margin:0 7px!important;border:1px solid #385047!important;border-radius:3px!important;background:#020707!important}',
  'altura do canvas do analisador'
);

/* 3) ESCOLHA: dá 8 px extras para Nacional e a última linha não serem cortados. */
replaceAllExact(
  '.filters{height:132px!important;min-height:132px!important;max-height:132px!important}',
  '.filters{height:140px!important;min-height:140px!important;max-height:140px!important}',
  'altura de filtros'
);
replaceAllExact(
  '.filterbody{height:107px!important;min-height:107px!important;max-height:107px!important;display:grid!important;grid-template-columns:76px minmax(0,1fr)!important;gap:5px!important;padding:0 6px 6px!important;overflow:hidden!important}',
  '.filterbody{height:113px!important;min-height:113px!important;max-height:113px!important;display:grid!important;grid-template-columns:76px minmax(0,1fr)!important;gap:5px!important;padding:0 6px 6px!important;overflow:hidden!important}',
  'altura interna de filtros'
);
replaceAllExact(
  '.scopebuttons{height:101px!important;display:grid!important;grid-template-rows:repeat(2,1fr)!important;gap:4px!important}',
  '.scopebuttons{height:107px!important;display:grid!important;grid-template-rows:repeat(2,1fr)!important;gap:4px!important}',
  'altura dos botões internacional/nacional'
);
replaceAllExact(
  '.genres{height:101px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:repeat(4,minmax(0,1fr))!important;gap:4px!important;padding:0!important;overflow:hidden!important}',
  '.genres{height:107px!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-rows:repeat(4,minmax(0,1fr))!important;gap:4px!important;padding:0!important;overflow:hidden!important}',
  'altura da grade de gêneros'
);

/* 4) EQUALIZADOR: a faixa GRAVE / MÉDIO / AGUDO fica dentro dos 160 px. */
replaceAllExact(
  '.eqpanel{display:grid!important;grid-template-rows:25px 117px 18px!important;overflow:hidden!important}',
  '.eqpanel{display:grid!important;grid-template-rows:25px 113px 18px!important;overflow:hidden!important}',
  'linhas do equalizador'
);
replaceAllExact(
  '.eqgrid{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;width:264px!important;height:117px!important;margin:0 0 0 30px!important;padding:0!important;gap:0!important;overflow:hidden!important;align-items:stretch!important}',
  '.eqgrid{display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;width:264px!important;height:113px!important;margin:0 0 0 30px!important;padding:0!important;gap:0!important;overflow:hidden!important;align-items:stretch!important}',
  'altura da grade do equalizador'
);
replaceAllExact(
  '.eqgrid .band{display:none!important;grid-template-rows:10px 90px 17px!important;justify-items:center!important;font-size:6px!important;min-width:0!important}',
  '.eqgrid .band{display:none!important;grid-template-rows:10px 86px 17px!important;justify-items:center!important;font-size:6px!important;min-width:0!important}',
  'linhas internas das bandas do equalizador'
);

/* Marcador final para validação do deploy. */
if (!src.includes('MOBILE_V35_FINISH')) {
  src = src.replace(
    '/* END_MOBILE_V34_TITLE_LOCK */',
    '/* END_MOBILE_V34_TITLE_LOCK */\n/* MOBILE_V35_FINISH: acabamento aprovado, sem sobra preta e sem cortes inferiores. */'
  );
}

fs.writeFileSync(file, src, 'utf8');

const required = [
  'MOBILE_V35_FINISH',
  'min-height:0!important;max-height:none!important',
  '.filters{height:140px!important;min-height:140px!important;max-height:140px!important}',
  'grid-template-rows:25px 114px 17px!important',
  'height:114px!important;min-height:114px!important;max-height:114px!important',
  'grid-template-rows:25px 113px 18px!important',
  'height:113px!important;margin:0 0 0 30px!important',
  'grid-template-rows:10px 86px 17px!important'
];
for (const token of required) if (!src.includes(token)) throw new Error('Validação V35 falhou: ' + token);

console.log('V35 aplicada: labels inferiores preservados, filtros sem corte e altura externa sem sobra preta.');
