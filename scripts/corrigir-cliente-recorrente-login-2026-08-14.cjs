const fs = require('fs');

const BACKEND = 'src/backend/clientes.web.js';
const CHECKOUT = 'src/pages/checkout-projeto-pronto.i9aj1.js';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content, 'utf8'); }
function fail(msg) { throw new Error(msg); }

// ======================================================
// 1) BACKEND: conta Wix é a âncora. Se houver cadastros
// duplicados com o mesmo e-mail, escolhe o cadastro mais
// completo/recente em vez de devolver cliente:null.
// ======================================================
let backend = read(BACKEND);

if (!backend.includes('CLIENTE_RECORRENTE_EMAIL_CANONICO_V1')) {
  const oldBlock = `      const unicos =\n        Array.from(\n          new Map(\n            encontrados\n              .filter(Boolean)\n              .map((item) => [safe(item?._id), item])\n          ).values()\n        ).filter((item) => safe(item?._id));\n\n      return {\n        memberId,\n        email: memberEmail,\n        nome: memberName,\n        cliente:\n          unicos.length === 1\n            ? clientePublico(unicos[0])\n            : null,\n        ambiguo:\n          unicos.length > 1\n      };`;

  const newBlock = `      const unicos =\n        Array.from(\n          new Map(\n            encontrados\n              .filter(Boolean)\n              .map((item) => [safe(item?._id), item])\n          ).values()\n        ).filter((item) => safe(item?._id));\n\n      // CLIENTE_RECORRENTE_EMAIL_CANONICO_V1\n      // A conta Wix autenticada já fixa o e-mail. Cadastros duplicados com\n      // esse MESMO e-mail não devem obrigar o cliente a preencher tudo outra vez.\n      // Escolhemos o registro mais completo e, em empate, o mais recente.\n      const pontuarCadastro = (item) => {\n        const publico = clientePublico(item);\n        if (!publico) return -1;\n\n        let pontos = 0;\n        const documento = limparCpfCnpj(publico.cpfCnpj);\n\n        if (limparEmail(publico.email) === memberEmail) pontos += 100;\n        if (safe(publico.whatsapp)) pontos += 30;\n        if (limparNome(publico.nome).length >= 3) pontos += 20;\n        if (documento.length === 11 || documento.length === 14) pontos += 30;\n        if (safe(publico.clienteId)) pontos += 10;\n        if (publico.ativo !== false) pontos += 5;\n\n        return pontos;\n      };\n\n      const timestampCadastro = (item) =>\n        new Date(\n          item?._updatedDate ||\n          item?._createdDate ||\n          0\n        ).getTime();\n\n      const ordenados =\n        [...unicos].sort((a, b) => {\n          const diferencaPontos =\n            pontuarCadastro(b) -\n            pontuarCadastro(a);\n\n          if (diferencaPontos) {\n            return diferencaPontos;\n          }\n\n          return (\n            timestampCadastro(b) -\n            timestampCadastro(a)\n          );\n        });\n\n      const clienteCanonico =\n        ordenados[0] ||\n        null;\n\n      return {\n        memberId,\n        email: memberEmail,\n        nome: memberName,\n        cliente: clientePublico(clienteCanonico),\n        ambiguo: unicos.length > 1,\n        totalCadastrosMesmoEmail: unicos.length\n      };`;

  if (!backend.includes(oldBlock)) fail('Bloco de resolução do cliente por e-mail não encontrado.');
  backend = backend.replace(oldBlock, newBlock);
  write(BACKEND, backend);
}

// ======================================================
// 2) CHECKOUT: antes de exibir a etapa de identificação,
// dá uma janela curta para o backend reconhecer a conta.
// Se reconhecer, o primeiro INIT já abre no pagamento.
// ======================================================
let checkout = read(CHECKOUT);

if (!checkout.includes('BOOT_CLIENTE_RECORRENTE_V1')) {
  const oldBoot = `  contextReady=true;\n  sendInit(true);\n  carregarContextoClienteAutenticado().catch(console.error);\n  carregarMetodoPagamentoSalvo().catch(console.error);\n\n  completarContextoPelaColecao()\n    .then(() => {`;

  const newBoot = `  // BOOT_CLIENTE_RECORRENTE_V1\n  // Evita mostrar Nome/CPF/WhatsApp por um instante para quem acabou de\n  // entrar novamente na MESMA conta Wix. Damos no máximo 850 ms para o\n  // backend recuperar o cadastro; depois o checkout abre normalmente e a\n  // consulta continua em segundo plano, sem travar a compra.\n  const contextoAutenticadoPromise =\n    carregarContextoClienteAutenticado();\n\n  Promise.race([\n    contextoAutenticadoPromise,\n    new Promise((resolve) => setTimeout(resolve, 850))\n  ])\n    .catch(() => {})\n    .finally(() => {\n      contextReady = true;\n      sendInit(true);\n    });\n\n  carregarMetodoPagamentoSalvo().catch(console.error);\n\n  completarContextoPelaColecao()\n    .then(() => {`;

  if (!checkout.includes(oldBoot)) fail('Boot atual do checkout não encontrado.');
  checkout = checkout.replace(oldBoot, newBoot);
  write(CHECKOUT, checkout);
}

// Garantias.
backend = read(BACKEND);
checkout = read(CHECKOUT);
if (!backend.includes('CLIENTE_RECORRENTE_EMAIL_CANONICO_V1')) fail('Backend não recebeu a correção.');
if (!backend.includes('cliente: clientePublico(clienteCanonico)')) fail('Backend ainda não retorna cliente canônico.');
if (!checkout.includes('BOOT_CLIENTE_RECORRENTE_V1')) fail('Checkout não recebeu o boot recorrente.');
if (checkout.includes('sendInit(true);\n  carregarContextoClienteAutenticado().catch(console.error);')) fail('Fluxo antigo de INIT ainda está ativo.');

console.log('Cliente recorrente reconhecido pela conta Wix sem pedir cadastro novamente.');
