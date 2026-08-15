const fs = require('fs');

const FILE = 'src/backend/entregaProjetosProntos.jsw';
let code = fs.readFileSync(FILE, 'utf8');

function replaceRequired(from, to, label) {
  if (code.includes(to)) {
    console.log(`${label}: já aplicado.`);
    return;
  }
  if (!code.includes(from)) throw new Error(`${label}: trecho esperado não encontrado.`);
  code = code.replace(from, to);
  console.log(`${label}: aplicado.`);
}

replaceRequired(
  `  setCanonical(\n    "chaveCompra",\n    purchaseKey\n  );`,
  `  setCanonical(\n    "chaveCompra",\n    purchaseKey\n  );\n\n  // METODO_PAGAMENTO_CANONICO_V1\n  // A sessão sabe se a etapa aprovada foi PIX ou CARD. Mantemos essa\n  // informação também em ComprasProjetos para a planilha mãe ter uma\n  // fonte única e não precisar deduzir o método pelo ID da cobrança.\n  setCanonical(\n    "metodoPagamento",\n    safe(session?.paymentMethod).toUpperCase()\n  );`,
  'método de pagamento canônico em ComprasProjetos'
);

replaceRequired(
  `    pagamento: "approved",\n    statusCompra: "approved",\n    idPagamento: paymentId,`,
  `    pagamento: "approved",\n    statusCompra: "approved",\n    metodoPagamento: safe(session?.paymentMethod).toUpperCase(),\n    idPagamento: paymentId,`,
  'método de pagamento no payload de processamento'
);

for (const marker of [
  'METODO_PAGAMENTO_CANONICO_V1',
  '"metodoPagamento",',
  'metodoPagamento: safe(session?.paymentMethod).toUpperCase()'
]) {
  if (!code.includes(marker)) throw new Error(`Validação final falhou: ${marker}`);
}

fs.writeFileSync(FILE, code, 'utf8');
console.log('OK: ComprasProjetos passa a manter PIX/CARD de forma canônica para a planilha mãe.');
