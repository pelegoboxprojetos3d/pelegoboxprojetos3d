const fs = require("fs");

const FILE = "src/backend/validaPayCartaoProjetosProntos.jsw";

function read() {
  return fs.readFileSync(FILE, "utf8");
}

function write(code) {
  fs.writeFileSync(FILE, code, "utf8");
}

function replaceRequired(code, from, to, label) {
  if (code.includes(to)) {
    console.log(`${label}: já aplicado.`);
    return code;
  }
  if (!code.includes(from)) {
    throw new Error(`${label}: trecho esperado não encontrado.`);
  }
  console.log(`${label}: aplicado.`);
  return code.replace(from, to);
}

let code = read();

const helperAnchor = `async function triggerMake({ session, purchase, paymentId }) {`;
const helperBlock = `function resumoCartaoCompra(session = {}) {
  const parcelas = Math.max(0, Number(session?.pendingCardInstallments || 0));
  const valorEtapa = Number(session?.valor || 0);

  return {
    metodoPagamento: "CARD",
    bandeiraCartao: safe(session?.pendingCardBrand),
    finalCartao: digits(session?.pendingCardLastFour).slice(-4),
    parcelasCartao: parcelas,
    valorParcelaCartao: parcelas > 0
      ? Number((valorEtapa / parcelas).toFixed(2))
      : 0
  };
}

async function triggerMake({ session, purchase, paymentId }) {`;
code = replaceRequired(
  code,
  helperAnchor,
  helperBlock,
  "Resumo seguro do cartão"
);

const oldPayload = `    valor:Number(processingPurchase?.valor || session.valor || 0),pagamento:"approved",statusCompra:"approved",
    idPagamento:safe(paymentId),checkoutId:safe(session.checkoutId),tokenDeEntrega:safe(session.tokenEntrega),chaveCompra:safe(processingPurchase?.chaveCompra)`;
const newPayload = `    valor:Number(processingPurchase?.valor || session.valor || 0),pagamento:"approved",statusCompra:"approved",
    ...resumoCartaoCompra(session),
    idPagamento:safe(paymentId),checkoutId:safe(session.checkoutId),tokenDeEntrega:safe(session.tokenEntrega),chaveCompra:safe(processingPurchase?.chaveCompra)`;
code = replaceRequired(
  code,
  oldPayload,
  newPayload,
  "Payload do Make com dados do cartão"
);

const oldFinalizeStart = `  const codigoProjeto=digits(session.codigoProjeto),clienteId=safe(session.clienteId),tipoProduto=productType(session.tipoProduto);
  const chaveCompra=\`${"${clienteId}_${codigoProjeto}"}\`;
  const existente=await findPurchase(chaveCompra);
  if (session.compraRegistrada===true && safe(session.status).toLowerCase()==="approved" && existente) {
    const make=await triggerMake({session,purchase:existente,paymentId:chargeId});`;
const newFinalizeStart = `  const codigoProjeto=digits(session.codigoProjeto),clienteId=safe(session.clienteId),tipoProduto=productType(session.tipoProduto);
  const chaveCompra=\`${"${clienteId}_${codigoProjeto}"}\`;
  const existente=await findPurchase(chaveCompra);
  const resumoCartao=resumoCartaoCompra(session);
  if (session.compraRegistrada===true && safe(session.status).toLowerCase()==="approved" && existente) {
    const compraComCartao=await wixData.update(PURCHASES,{...existente,...resumoCartao},DB);
    const make=await triggerMake({session,purchase:compraComCartao,paymentId:chargeId});`;
code = replaceRequired(
  code,
  oldFinalizeStart,
  newFinalizeStart,
  "Backfill do resumo na compra já registrada"
);

const oldPurchase = `    checkoutId:safe(session.checkoutId),tokenDeEntrega:safe(session.tokenEntrega),idPagamento:safe(chargeId),pagamento:"approved",statusCompra:"approved",valor:totalValue,
    dataCompra:existente?.dataCompra||now,dataLiberacao:now,downloadMedidas:access.medidas,downloadGraficos:access.graficos,downloadProjeto:access.projeto,`;
const newPurchase = `    checkoutId:safe(session.checkoutId),tokenDeEntrega:safe(session.tokenEntrega),idPagamento:safe(chargeId),pagamento:"approved",statusCompra:"approved",valor:totalValue,
    ...resumoCartao,
    dataCompra:existente?.dataCompra||now,dataLiberacao:now,downloadMedidas:access.medidas,downloadGraficos:access.graficos,downloadProjeto:access.projeto,`;
code = replaceRequired(
  code,
  oldPurchase,
  newPurchase,
  "ComprasProjetos com resumo do cartão"
);

const oldSession = `      pendingCardDocument: digits(tokenInfo?.cardDocument || cardDocument),
      updatedAtDate: new Date()`;
const newSession = `      pendingCardDocument: digits(tokenInfo?.cardDocument || cardDocument),
      pendingCardInstallments: installments,
      updatedAtDate: new Date()`;
code = replaceRequired(
  code,
  oldSession,
  newSession,
  "Parcelas persistidas na sessão"
);

for (const marker of [
  'metodoPagamento: "CARD"',
  'bandeiraCartao: safe(session?.pendingCardBrand)',
  'finalCartao: digits(session?.pendingCardLastFour).slice(-4)',
  'parcelasCartao: parcelas',
  'valorParcelaCartao:',
  'pendingCardInstallments: installments',
  '...resumoCartaoCompra(session)',
  '...resumoCartao,'
]) {
  if (!code.includes(marker)) {
    throw new Error(`Validação final falhou: ${marker}`);
  }
}

if (/card\.number.*ComprasProjetos|cvv.*ComprasProjetos/i.test(code)) {
  throw new Error("Proteção PCI: tentativa de persistir PAN/CVV detectada.");
}

write(code);
console.log("OK: ComprasProjetos passa a receber método, bandeira, final, parcelas e valor da parcela. PAN completo e CVV continuam fora da coleção.");
