const fs = require('fs');

const path = 'scripts/estabilizar-fluxo-final.cjs';
let s = fs.readFileSync(path, 'utf8');

const start = s.indexOf("  const ensureStart = s.indexOf('async function ensureProduct({');");
const end = s.indexOf("\n  s = s.replace(\n    `function extractChargeId", start);

if (start >= 0 && end >= 0) {
  const replacement = `  const oldEnsureStart = s.indexOf('async function ensureProduct({');
  const oldEnsureEnd = s.indexOf('\\n\\n\\n// ======================================================\\n// COBRANÇAS VALIDAPAY', oldEnsureStart);
  assert(oldEnsureStart >= 0 && oldEnsureEnd > oldEnsureStart, 'PIX: ensureProduct não encontrado.');

  const newEnsure = \`async function ensureProduct({\\n  session,\\n  name,\\n  sku,\\n  projectCode,\\n  checkoutCode,\\n  type,\\n  amount,\\n  image\\n}) {\\n  const savedProductId =\\n    safe(\\n      session?.validaPayProductId\\n    );\\n\\n  const savedPriceId =\\n    safe(\\n      session?.validaPayPriceId\\n    );\\n\\n  if (\\n    savedProductId &&\\n    savedPriceId\\n  ) {\\n    return {\\n      productId:\\n        savedProductId,\\n\\n      priceId:\\n        savedPriceId,\\n\\n      reused:\\n        true\\n    };\\n  }\\n\\n  return createProduct({\\n    name,\\n    sku,\\n    projectCode,\\n    checkoutCode,\\n    type,\\n    amount,\\n    image\\n  });\\n}\`;

  s = s.slice(0, oldEnsureStart) + newEnsure + s.slice(oldEnsureEnd);
`;

  s = s.slice(0, start) + replacement + s.slice(end);
} else if (!s.includes("const oldEnsureStart = s.indexOf('async function ensureProduct({');")) {
  throw new Error('Bloco ensureProduct do estabilizador não encontrado.');
}

s = s.replace(
  '\npatchProcessor();\n',
  '\n// patchProcessor executado pelo script dedicado.\n'
);

fs.writeFileSync(path, s, 'utf8');
console.log('Estabilizador corrigido e processador delegado.');
