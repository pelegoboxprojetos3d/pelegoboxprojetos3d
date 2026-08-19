const fs = require('fs');

const file = 'src/public/custom-elements/pelego-radio.js';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(before, after, label) {
  if (source.includes(after)) {
    console.log(`${label}: já aplicado.`);
    return;
  }
  if (!source.includes(before)) {
    throw new Error(`${label}: trecho esperado não encontrado.`);
  }
  source = source.replace(before, after);
  console.log(`${label}: aplicado.`);
}

// Fecha somente o vão vertical entre ANALISADOR e TOCANDO.
// O +7px compensa exatamente o gap da grade sem deslocar a borda inferior.
replaceOnce(
  '.playbox{grid-template-rows:27px minmax(0,1fr)!important}',
  '.playbox{grid-template-rows:27px minmax(0,1fr)!important;margin-top:-7px!important;height:calc(100% + 7px)!important}',
  'Remover vão entre analisador e tocador'
);

// A frase de status em branco estava microscópica. Aumenta sem estourar a linha fixa.
replaceOnce(
  '.hint{font-size:7px!important}',
  '.hint{font-size:8.5px!important;line-height:8px!important;color:#fff!important;font-weight:500!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}',
  'Aumentar frase branca do tocador'
);

// Guardas para não deixar a automação mexer numa versão errada do layout.
if (!source.includes('grid-template-columns:1.948fr 1fr!important')) {
  throw new Error('A largura do TOCANDO ainda não está alinhada ao ANALISADOR.');
}
if (!source.includes('height:720px!important')) {
  throw new Error('Altura desktop esperada de 720px não encontrada.');
}
if (!source.includes('viewBox="0 0 479.302 479.302"')) {
  throw new Error('Silhueta real do mapa do Brasil não encontrada.');
}

fs.writeFileSync(file, source, 'utf8');
console.log('Rádio Pelego: ajuste visual concluído.');
