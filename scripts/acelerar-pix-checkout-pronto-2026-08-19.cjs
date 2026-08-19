const fs = require('fs');

const CORE = 'src/backend/validaPayPixProjetosProntosCore.jsw';
const R2 = 'src/backend/validaPayPixProjetosProntosCoreR2.jsw';

function patch(path, from, to, marker) {
  let code = fs.readFileSync(path, 'utf8');
  if (code.includes(marker)) return;
  if (!code.includes(from)) throw new Error(`${path}: ponto exato não encontrado; nada foi alterado.`);
  code = code.replace(from, to);
  fs.writeFileSync(path, code, 'utf8');
}

patch(
  CORE,
  '    const immediate = publicCharge(checkoutId, chargeId, created || {}, valor);\n    if (immediate.emv || immediate.approved) return immediate;\n    return readChargeReady(checkoutId, chargeId, valor, 4);',
  '    const immediate = publicCharge(checkoutId, chargeId, created || {}, valor);\n    if (immediate.emv || immediate.approved) return immediate;\n    // PIX_CREATE_FAST_RETURN_V1: não segura o clique esperando várias leituras do provedor.\n    // O polling já consulta a cobrança a cada 2s e continua responsável por obter QR/EMV.\n    return immediate;',
  'PIX_CREATE_FAST_RETURN_V1'
);

patch(
  R2,
  'export async function criarCobrancaPixTransparente(input = {}) {\n  return enrich(await criarBase(input));\n}',
  'export async function criarCobrancaPixTransparente(input = {}) {\n  // PIX_CREATE_NO_EXTRA_DEEP_READ_V1: criação retorna assim que o core cria a cobrança.\n  // A leitura profunda fica somente no consultarCobrancaPix, sem bloquear a tela inicial.\n  return criarBase(input);\n}',
  'PIX_CREATE_NO_EXTRA_DEEP_READ_V1'
);

for (const [path, marker] of [[CORE,'PIX_CREATE_FAST_RETURN_V1'],[R2,'PIX_CREATE_NO_EXTRA_DEEP_READ_V1']]) {
  const code = fs.readFileSync(path, 'utf8');
  if (!code.includes(marker)) throw new Error(`${path}: validação falhou em ${marker}`);
}

console.log('OK: criação do Pix não aguarda leituras extras; polling preservado.');
