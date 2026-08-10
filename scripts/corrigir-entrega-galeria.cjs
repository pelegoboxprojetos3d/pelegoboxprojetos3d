const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let s = fs.readFileSync(path, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const trechoOnReadyAntigo = `    await mostrarProcessamento();\n\n    await carregarEntrega();`;
const trechoOnReadyNovo = `    /*\n      A galeria permanece Oculta + Recolhida no editor.\n      O HTML de processamento também começa escondido.\n\n      Primeiro consultamos a entrega. Só depois decidimos:\n      - arquivo pronto: abre a galeria;\n      - pagamento aprovado e arquivo pendente: mostra a impressora.\n    */\n    await esconderProcessamento();\n\n    await carregarEntrega();`;

if (s.includes(trechoOnReadyAntigo)) {
  s = s.replace(trechoOnReadyAntigo, trechoOnReadyNovo);
} else {
  assert(
    s.includes('Primeiro consultamos a entrega. Só depois decidimos:'),
    'Não encontrei o trecho inicial da página de entrega.'
  );
}

const trechoAguardandoAntigo = `        alterarDescricao(\n          "Pagamento aprovado. Estamos preparando seus arquivos..."\n        );\n\n        await esperar(`;

const trechoAguardandoNovo = `        await mostrarProcessamento();\n\n        alterarDescricao(\n          "Pagamento aprovado. Estamos preparando seus arquivos..."\n        );\n\n        await esperar(`;

if (s.includes(trechoAguardandoAntigo)) {
  s = s.replace(trechoAguardandoAntigo, trechoAguardandoNovo);
} else {
  assert(
    s.includes('await mostrarProcessamento();\n\n        alterarDescricao(\n          "Pagamento aprovado. Estamos preparando seus arquivos..."'),
    'Não encontrei o trecho de espera pós-pagamento.'
  );
}

fs.writeFileSync(path, s, 'utf8');
console.log('Página de entrega: galeria/processamento corrigidos.');
