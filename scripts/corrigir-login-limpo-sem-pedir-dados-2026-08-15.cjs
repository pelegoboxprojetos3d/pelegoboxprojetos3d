const fs = require('fs');

const file = 'src/pages/checkout-projeto-pronto.i9aj1.js';
let src = fs.readFileSync(file, 'utf8');

const marker = 'LOGIN_LIMPO_REAPROVEITA_CADASTRO_V2';
if (src.includes(marker)) {
  console.log('Hotfix já aplicado.');
  process.exit(0);
}

const constAnchor = 'const CARD_DELIVERY_MAX = 80;';
if (!src.includes(constAnchor)) {
  throw new Error('Âncora CARD_DELIVERY_MAX não encontrada.');
}
src = src.replace(
  constAnchor,
  `${constAnchor}\nconst AUTH_CONTEXT_PREFLIGHT_MAX = 5200; // LOGIN_LIMPO_REAPROVEITA_CADASTRO_V2`
);

const oldComment = `  // BOOT_CLIENTE_RECORRENTE_V1\n  // Evita mostrar Nome/CPF/WhatsApp por um instante para quem acabou de\n  // entrar novamente na MESMA conta Wix. Damos no máximo 850 ms para o\n  // backend recuperar o cadastro; depois o checkout abre normalmente e a\n  // consulta continua em segundo plano, sem travar a compra.`;

const newComment = `  // BOOT_CLIENTE_RECORRENTE_V2\n  // Depois de limpar histórico ou trocar de aparelho não existe storage local.\n  // Antes de mostrar Nome/CPF/WhatsApp, aguardamos a consulta da conta Wix\n  // autenticada. O próprio backend tem timeout de 5 s, então este preflight\n  // apenas impede o formulário errado de aparecer antes da resposta.`;

if (!src.includes(oldComment)) {
  throw new Error('Bloco BOOT_CLIENTE_RECORRENTE_V1 não encontrado.');
}
src = src.replace(oldComment, newComment);

const oldTimer = 'new Promise((resolve) => setTimeout(resolve, 850))';
const newTimer = 'new Promise((resolve) => setTimeout(resolve, AUTH_CONTEXT_PREFLIGHT_MAX))';
if (!src.includes(oldTimer)) {
  throw new Error('Timer antigo de 850 ms não encontrado.');
}
src = src.replace(oldTimer, newTimer);

fs.writeFileSync(file, src);
console.log('Login recorrente após limpar histórico corrigido.');
