const fs = require("fs");

function patch(path, fn) {
  const before = fs.readFileSync(path, "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(path, after, "utf8");
    console.log(`Atualizado: ${path}`);
  } else {
    console.log(`Sem alterações: ${path}`);
  }
}

function replaceRequired(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado`);
  return code.replace(from, to);
}

// 1) O título do e-mail deve vir literalmente do título visual do checkout.
patch("src/backend/notificarVendaProjetoPronto.js", code => {
  code = replaceRequired(
    code,
    '  return safe(session?.produto) || "Projeto Pronto";\n',
    '  return safe(session?.tituloCheckout) || safe(session?.produto) || "Projeto Pronto";\n',
    "Título exato do checkout no e-mail"
  );

  code = replaceRequired(
    code,
    '  const produto = safe(session?.produto);\n',
    '  const produto = safe(session?.tituloCheckout) || safe(session?.produto);\n',
    "Título exato no histórico"
  );

  return code;
});

// 2) Cartão: salvar ctx.titulo como fonte literal do e-mail e eliminar o
//    reenvio interno /users/notifications/resend, que não faz parte da API
//    OAuth pública e hoje responde 401 TOKEN EXPIRADO OU INVALIDO.
patch("src/backend/validaPayCartaoProjetosProntos.jsw", code => {
  code = replaceRequired(
    code,
    '    const produto = tituloEtapaProjetoPronto(input.produto || ctx.produto || ctx.titulo || "Projeto Pronto", tipoProduto, codigoProjeto);\n    const valor = money(input.valor ?? ctx.valor ?? ctx.price);\n',
    '    const produto = tituloEtapaProjetoPronto(input.produto || ctx.produto || ctx.titulo || "Projeto Pronto", tipoProduto, codigoProjeto);\n    const tituloCheckout = decodeTitle(input.tituloCheckout || ctx.titulo || "");\n    const valor = money(input.valor ?? ctx.valor ?? ctx.price);\n',
    "Captura do título visual no cartão"
  );

  code = replaceRequired(
    code,
    '      tipoProduto,\n      produto,\n      img: safe(input.img || ctx.img || ctx.imagem),\n',
    '      tipoProduto,\n      produto,\n      tituloCheckout,\n      img: safe(input.img || ctx.img || ctx.imagem),\n',
    "Persistência do título visual no cartão"
  );

  const oldExisting = `    const faturaValidaPay=await garantirFaturaValidaPay(checkoutId,chargeId,session);\n    return {compraRegistrada:true,purchaseId:safe(existente._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao,faturaValidaPay};\n`;
  const newExisting = `    const faturaValidaPay={sent:false,skipped:true,reason:"provider_native_resend_not_supported_public_api"};\n    return {compraRegistrada:true,purchaseId:safe(existente._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao,faturaValidaPay};\n`;
  code = replaceRequired(code, oldExisting, newExisting, "Remover 401 no branch já registrado");

  const oldFirst = `  // O painel oficial da ValidaPay usa esta rota para enviar/re-enviar a fatura por e-mail.\n  // Chamamos somente na primeira finalizacao da compra; o branch de compra ja registrada nao repete.\n  const faturaValidaPay=await reenviarNotificacaoValidaPay(chargeId);\n  await saveSession(checkoutId,{\n    faturaValidaPayEnviada:faturaValidaPay?.sent===true,\n    faturaValidaPayStatusCode:Number(faturaValidaPay?.statusCode||0),\n    faturaValidaPayErro:safe(faturaValidaPay?.error),\n    faturaValidaPayTentativa:Number(faturaValidaPay?.attempt||0),\n    updatedAtDate:new Date()\n  });\n  return {compraRegistrada:true,purchaseId:safe(savedPurchase?._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao,faturaValidaPay};\n`;
  const newFirst = `  // A rota /v1/users/notifications/resend pertence ao painel e não aceita\n  // o OAuth client_credentials da API pública. Não bloqueamos mais o cliente\n  // com três tentativas 401 depois de o pagamento já estar aprovado.\n  const faturaValidaPay={sent:false,skipped:true,reason:"provider_native_resend_not_supported_public_api"};\n  return {compraRegistrada:true,purchaseId:safe(savedPurchase?._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao,faturaValidaPay};\n`;
  code = replaceRequired(code, oldFirst, newFirst, "Remover 401 da primeira finalização");

  return code;
});

// 3) Pix: a mesma regra de título vale para qualquer forma de pagamento e a
//    chamada 401 também não pode atrasar o pós-pagamento.
patch("src/backend/validaPayPixProjetosProntosCore.jsw", code => {
  code = replaceRequired(
    code,
    '    const produto = tituloEtapaProjetoPronto(first(input.produto, ctx.produto, ctx.titulo, "Projeto Pronto"), tipoProduto, codigoProjeto);\n    const valor = parseMoney(input.valor ?? ctx.valor ?? ctx.price);\n',
    '    const produto = tituloEtapaProjetoPronto(first(input.produto, ctx.produto, ctx.titulo, "Projeto Pronto"), tipoProduto, codigoProjeto);\n    const tituloCheckout = decodeTitle(first(input.tituloCheckout, ctx.titulo));\n    const valor = parseMoney(input.valor ?? ctx.valor ?? ctx.price);\n',
    "Captura do título visual no Pix"
  );

  code = replaceRequired(
    code,
    '      tipoProduto,\n      produto,\n      img,\n',
    '      tipoProduto,\n      produto,\n      tituloCheckout,\n      img,\n',
    "Persistência do título visual no Pix"
  );

  code = code.replace(
    '    produto: decodeTitle(session.produto),\n',
    '    produto: decodeTitle(session.tituloCheckout || session.produto),\n'
  );
  code = code.replace(
    '    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + decodeTitle(session.produto),\n    tituloEmail: decodeTitle(session.produto),\n',
    '    assuntoEmail: "Pagamento confirmado com sucesso! ✅ " + decodeTitle(session.tituloCheckout || session.produto),\n    tituloEmail: decodeTitle(session.tituloCheckout || session.produto),\n'
  );

  const oldInvoice = `  let invoice = { sent: false, error: "not_attempted" };\n  try {\n    invoice = await garantirFaturaValidaPay(id, charge);\n  } catch (error) {\n    invoice = { sent: false, error: error?.message || "invoice_error" };\n    console.error("Falha ao garantir fatura ValidaPay:", error?.message || error);\n  }\n\n  return { ok: true, notification, invoice };\n`;
  const newInvoice = `  const invoice = { sent:false, skipped:true, reason:"provider_native_resend_not_supported_public_api" };\n\n  return { ok: true, notification, invoice };\n`;
  code = replaceRequired(code, oldInvoice, newInvoice, "Remover reenvio 401 do Pix/webhook");

  return code;
});

// 4) Página: explicita o título visual também no payload principal.
patch("src/pages/checkout-projeto-pronto.i9aj1.js", code => {
  code = replaceRequired(
    code,
    '    tipoProduto:ctx.tipoProduto,\n    produto:ctx.produto,\n    valor:ctx.valor,\n',
    '    tipoProduto:ctx.tipoProduto,\n    produto:ctx.produto,\n    tituloCheckout:ctx.titulo,\n    valor:ctx.valor,\n',
    "Título visual na ponte do checkout"
  );
  return code;
});

console.log("Pacote final de cartão/título aplicado.");
