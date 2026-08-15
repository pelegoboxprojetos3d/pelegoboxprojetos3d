const fs = require('fs');
const file = 'src/backend/validaPayCartaoProjetosProntos.jsw';
let code = fs.readFileSync(file, 'utf8');

function troca(de, para, nome) {
  if (code.includes(para)) return;
  if (!code.includes(de)) throw new Error(`Trecho não encontrado: ${nome}`);
  code = code.replace(de, para);
}

troca(
`  const paymentMethodId = safe(session?.pendingPaymentMethodId);\n  const email = safe(session?.email).toLowerCase();\n  if (!paymentMethodId || !email) return null;`,
`  const paymentMethodId = safe(session?.pendingPaymentMethodId);\n  const email = safe(session?.email).toLowerCase();\n  // METADADOS_CARTAO_APROVADO_V2\n  // O histórico seguro deve ser salvo mesmo quando o provedor não retorna token reutilizável.\n  if (!email) return null;`,
'persistência sem token'
);

troca(
`    const id = extractChargeId(response.data || {});\n    const status = extractChargeStatus(response.data || {});`,
`    const id = extractChargeId(response.data || {});\n    const status = extractChargeStatus(response.data || {});\n    const customerIdRetornado = campoProfundoCartao(response.data || {}, ["customerId"]);`,
'customerId da cobrança'
);

troca(
`      pendingPaymentMethodId: paymentMethodId || safe(previousSession?.pendingPaymentMethodId),\n      cardAttempt,`,
`      pendingPaymentMethodId: paymentMethodId || safe(previousSession?.pendingPaymentMethodId),\n      pendingValidaPayCustomerId: customerIdRetornado || safe(previousSession?.pendingValidaPayCustomerId),\n      cardAttempt,`,
'gravação do customerId'
);

if (!code.includes('METADADOS_CARTAO_APROVADO_V2')) throw new Error('Validação falhou.');
fs.writeFileSync(file, code, 'utf8');
console.log('OK');
