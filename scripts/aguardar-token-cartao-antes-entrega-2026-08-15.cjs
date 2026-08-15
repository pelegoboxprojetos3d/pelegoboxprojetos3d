const fs = require('fs');

const PAGE = 'src/pages/checkout-projeto-pronto.i9aj1.js';
const WEB = 'src/backend/salvarCartaoValidaPay.web.js';

function patch(path, fn) {
  const before = fs.readFileSync(path, 'utf8');
  const after = fn(before);
  if (after === before) {
    console.log(`Sem alterações: ${path}`);
    return;
  }
  fs.writeFileSync(path, after, 'utf8');
  console.log(`Atualizado: ${path}`);
}

function replaceOnce(text, from, to, label) {
  if (text.includes(to)) {
    console.log(`${label}: já aplicado.`);
    return text;
  }
  if (!text.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  console.log(`${label}: aplicado.`);
  return text.replace(from, to);
}

patch(WEB, code => {
  const from = `    const membro = await currentMemberBackend.getMember();\n    const memberId = safe(membro?._id);\n    const email = emailDoMembro(membro);\n    if (!memberId || !email) return { ok:false, saved:false, reason:"membro_nao_autenticado" };\n\n    const session = await sessaoPorCheckout(id);\n    if (!session) return { ok:false, saved:false, reason:"sessao_nao_encontrada" };\n\n    const sessionEmail = mail(session.email);\n    const sessionMemberId = safe(session.memberId || session.cardAuthMemberId);\n`;

  const to = `    let memberId = "";\n    let email = "";\n    try {\n      const membro = await currentMemberBackend.getMember();\n      memberId = safe(membro?._id);\n      email = emailDoMembro(membro);\n    } catch (_) {}\n\n    const session = await sessaoPorCheckout(id);\n    if (!session) return { ok:false, saved:false, reason:"sessao_nao_encontrada" };\n\n    const sessionEmail = mail(session.email);\n    const sessionMemberId = safe(session.memberId || session.cardAuthMemberId);\n\n    // CARTAO_TOKEN_FALLBACK_SESSAO_AUTENTICADA_V1\n    // O pagamento já validou a conta Wix. Se currentMember oscilar no instante\n    // pós-aprovação, usamos somente a prova autenticada e recente da própria sessão.\n    if (!memberId || !email) {\n      const authAt = new Date(session.cardAuthAt || session.authVerifiedAt || 0).getTime();\n      const authAge = Date.now() - authAt;\n      const provaRecente =\n        session.authMemberVerified === true &&\n        sessionMemberId &&\n        sessionEmail &&\n        Number.isFinite(authAge) &&\n        authAge >= 0 &&\n        authAge <= 30 * 60 * 1000;\n\n      if (provaRecente) {\n        memberId = sessionMemberId;\n        email = sessionEmail;\n      }\n    }\n\n    if (!memberId || !email) return { ok:false, saved:false, reason:"membro_nao_autenticado" };\n`;

  return replaceOnce(code, from, to, 'fallback de identidade para tokenização');
});

patch(PAGE, code => {
  code = replaceOnce(
    code,
    `    if (result?.saved === true && result?.metodo) {\n      savedCardPayload = { type:"SAVED_CARD", existe:true, ...result.metodo };\n      if (checkoutUiReady) post(savedCardPayload);\n      cartaoPendenteParaTokenizar = null;\n    } else {\n      console.warn("Cartão aprovado, mas token reutilizável não foi salvo:", result?.reason || "sem motivo");\n    }\n  } catch (error) {\n    console.warn("Salvamento isolado do cartão não bloqueou a venda:", error?.message || error);\n  } finally {\n    salvamentoCartaoEmAndamento = false;\n  }\n}\n`,
    `    if (result?.saved === true && result?.metodo) {\n      savedCardPayload = { type:"SAVED_CARD", existe:true, ...result.metodo };\n      if (checkoutUiReady) post(savedCardPayload);\n      cartaoPendenteParaTokenizar = null;\n      return result;\n    }\n    console.warn("Cartão aprovado, mas token reutilizável não foi salvo:", result?.reason || "sem motivo");\n    return result || { ok:false, saved:false, reason:"sem_resposta" };\n  } catch (error) {\n    console.warn("Salvamento isolado do cartão não bloqueou a venda:", error?.message || error);\n    return { ok:false, saved:false, reason:error?.message || "falha_tokenizacao" };\n  } finally {\n    salvamentoCartaoEmAndamento = false;\n  }\n}\n`,
    'retorno explícito do salvamento'
  );

  code = replaceOnce(
    code,
    `      stopCardPoll();\n      salvarCartaoAprovadoSemBloquearVenda(chargeId).catch(console.error);\n      post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,status:cardStatus || "paid",deliveryUrl:deliveryUrl()});\n      abrirEntregaComFallback(1900);\n`,
    `      stopCardPoll();\n      post({type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,processing:false,checkoutId,chargeId,status:cardStatus || "paid",deliveryUrl:deliveryUrl()});\n      // CARTAO_SALVO_AGUARDA_TOKEN_ANTES_REDIRECT_V1\n      // A venda já está aprovada e visível. Mantemos a página viva só até o\n      // webMethod concluir a tokenização, evitando que a navegação cancele a chamada.\n      await salvarCartaoAprovadoSemBloquearVenda(chargeId);\n      abrirEntregaComFallback(250);\n`,
    'aguardar tokenização na aprovação por polling'
  );

  code = replaceOnce(
    code,
    `    if(paymentApproved) {\n      salvarCartaoAprovadoSemBloquearVenda(chargeId).catch(console.error);\n      post({\n        type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,\n        processing:false,checkoutId,chargeId,status:safe(r?.status)||"paid",\n        cardBrand:safe(r?.cardBrand),cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),\n        error:"Pagamento aprovado. Abrindo sua entrega..."\n      });\n      abrirEntregaComFallback(1900);\n      return;\n    }\n`,
    `    if(paymentApproved) {\n      post({\n        type:"CARD_RESULT",ok:true,accepted:true,approved:true,paymentApproved:true,\n        processing:false,checkoutId,chargeId,status:safe(r?.status)||"paid",\n        cardBrand:safe(r?.cardBrand),cardLastFour:safe(r?.cardLastFour),deliveryUrl:deliveryUrl(),\n        error:"Pagamento aprovado. Abrindo sua entrega..."\n      });\n      // CARTAO_SALVO_AGUARDA_TOKEN_ANTES_REDIRECT_V1\n      await salvarCartaoAprovadoSemBloquearVenda(chargeId);\n      abrirEntregaComFallback(250);\n      return;\n    }\n`,
    'aguardar tokenização na aprovação imediata'
  );

  return code;
});
