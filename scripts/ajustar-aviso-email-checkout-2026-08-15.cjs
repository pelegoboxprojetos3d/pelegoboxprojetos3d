const fs = require('fs');

const file = 'src/public/custom-elements/pelego-checkout-pronto.js';
let code = fs.readFileSync(file, 'utf8');

const antigo = 'Você receberá dois e-mails: um confirmando o pagamento e outro com o acesso ao produto.';
const novo = 'Você receberá um e-mail da PELEGO BOX com o botão de acesso ao produto após a confirmação do pagamento.';

const ocorrencias = code.split(antigo).length - 1;

if (ocorrencias === 0) {
  if ((code.split(novo).length - 1) >= 2) {
    console.log('Avisos de e-mail do checkout já estão atualizados.');
    process.exit(0);
  }
  throw new Error('Texto antigo do aviso de e-mail não foi encontrado.');
}

if (ocorrencias !== 2) {
  throw new Error(`Esperadas 2 ocorrências do aviso antigo; encontradas ${ocorrencias}.`);
}

code = code.split(antigo).join(novo);

if ((code.split(novo).length - 1) !== 2) {
  throw new Error('Falha ao atualizar os dois avisos do checkout.');
}

fs.writeFileSync(file, code, 'utf8');
console.log('Avisos de PIX e cartão atualizados para um único e-mail da PELEGO BOX.');
