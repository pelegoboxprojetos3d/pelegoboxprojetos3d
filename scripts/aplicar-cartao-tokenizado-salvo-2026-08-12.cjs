const fs = require("fs");

const CARD_BACKEND = "src/backend/validaPayCartaoProjetosProntos.jsw";
const PAGE = "src/pages/checkout-projeto-pronto.i9aj1.js";
const HTML = "src/public/custom-elements/pelego-checkout-pronto.js";

function patchFile(path, fn) {
  const before = fs.readFileSync(path, "utf8");
  const after = fn(before);
  if (after !== before) {
    fs.writeFileSync(path, after, "utf8");
    console.log(`Atualizado: ${path}`);
  } else {
    console.log(`Sem alterações: ${path}`);
  }
}

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

patchFile(CARD_BACKEND, code => {
  code = replaceOnce(
    code,
    'import { getSecret } from "wix-secrets-backend";\n',
    'import { getSecret } from "wix-secrets-backend";\nimport { currentMember as currentMemberBackend } from "wix-members-backend";\nimport { tokenize } from "@validapay/tokenize";\nimport { buscarMetodoPagamentoPrivadoPorEmail, salvarMetodoPagamentoAprovado } from "backend/metodosPagamentoProjetosProntos";\n',
    "Imports de tokenização"
  );

  if (!code.includes("async function identidadeMembroAtualCartao()")) {
    const anchor = '// CARTÃO TRANSPARENTE VALIDAPAY\n';
    if (!code.includes(anchor)) throw new Error("Âncora de helpers do cartão não encontrada.");
    const helpers = `async function identidadeMembroAtualCartao() {\n  const membro = await currentMemberBackend.getMember();\n  const emails = Array.isArray(membro?.contactDetails?.emails) ? membro.contactDetails.emails : [];\n  const memberId = safe(membro?._id);\n  const email = safe(membro?.loginEmail || emails[0] || membro?.contactDetails?.email).toLowerCase();\n  return { memberId, email };\n}\n\nasync function tokenizarNovoCartao({ number, cvv, month, year, holder, nome, cpfCnpj, email }) {\n  const clientId = safe(await getSecret("VALIDAPAY_CLIENT_ID"));\n  const clientSecret = safe(await getSecret("VALIDAPAY_CLIENT_SECRET"));\n  if (!clientId || !clientSecret) throw new Error("Credenciais ValidaPay não configuradas para tokenização.");\n\n  const result = await tokenize({\n    clientId,\n    clientSecret,\n    card: {\n      number,\n      cardHolderName: holder,\n      cvv,\n      expiration: \`${'${month}/${year}'}\`\n    },\n    customer: {\n      name: nome,\n      document: cpfCnpj,\n      email\n    }\n  });\n\n  if (!safe(result?.paymentMethodId)) throw new Error("A ValidaPay não retornou o token seguro do cartão.");\n  return result;\n}\n\nasync function persistirMetodoPagamentoAprovado(session, chargeId) {\n  const paymentMethodId = safe(session?.pendingPaymentMethodId);\n  const email = safe(session?.email).toLowerCase();\n  if (!paymentMethodId || !email) return null;\n  try {\n    return await salvarMetodoPagamentoAprovado({\n      email,\n      memberId: safe(session?.memberId),\n      clienteId: safe(session?.clienteId),\n      paymentMethodId,\n      validaPayCustomerId: safe(session?.pendingValidaPayCustomerId),\n      cardBrand: safe(session?.pendingCardBrand),\n      cardLastFour: safe(session?.pendingCardLastFour),\n      cardExpirationMonth: safe(session?.pendingCardExpirationMonth),\n      cardExpirationYear: safe(session?.pendingCardExpirationYear),\n      cardHolderName: safe(session?.pendingCardHolderName),\n      cardDocument: safe(session?.pendingCardDocument || session?.cpfCnpj),\n      ultimoPagamentoId: safe(chargeId)\n    });\n  } catch (error) {\n    console.warn("Falha ao salvar método de pagamento tokenizado:", error?.message || error);\n    return null;\n  }\n}\n\n`;
    code = code.replace(anchor, helpers + anchor);
  }

  code = replaceOnce(
    code,
    '  let session = await findSession(checkoutId);\n  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n',
    '  let session = await findSession(checkoutId);\n  if (!session) throw new Error("Sessão do cartão não encontrada após aprovação.");\n  await persistirMetodoPagamentoAprovado(session, chargeId);\n',
    "Persistência após aprovação"
  );

  code = replaceOnce(
    code,
    'export async function criarCobrancaCartaoTransparente(input = {}) {\n  const card = input.card || {};\n',
    'export async function criarCobrancaCartaoTransparente(input = {}) {\n  const card = input.card || {};\n  const useSavedPaymentMethod = input.useSavedPaymentMethod === true;\n',
    "Flag do cartão salvo"
  );

  code = replaceOnce(
    code,
    '    const email = safe(input.email || ctx.email).toLowerCase();\n    const cpfCnpj = digits(input.cpfCnpj || ctx.cpfCnpj);\n',
    '    const emailInformado = safe(input.email || ctx.email).toLowerCase();\n    const identidadeMembro = await identidadeMembroAtualCartao();\n    if (!identidadeMembro.memberId || !identidadeMembro.email) return { ok:false, error:"Faça login novamente para pagar com cartão." };\n    if (emailInformado && emailInformado !== identidadeMembro.email) return { ok:false, error:"O e-mail do checkout não corresponde ao login atual." };\n    const email = identidadeMembro.email;\n    const memberId = identidadeMembro.memberId;\n    const cpfCnpj = digits(input.cpfCnpj || ctx.cpfCnpj);\n',
    "E-mail autenticado como chave mestra"
  );

  code = replaceOnce(
    code,
    '    if (!luhn(number)) return { ok: false, error: "Número do cartão inválido." };\n    if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\\d{2}$/.test(year)) return { ok: false, error: "Validade do cartão inválida." };\n    if (!/^\\d{3,4}$/.test(cvv)) return { ok: false, error: "CVV inválido." };\n    if (holder.length < 3) return { ok: false, error: "Nome impresso no cartão inválido." };\n    if (![11, 14].includes(cardDocument.length)) return { ok: false, error: "CPF/CNPJ do portador inválido." };\n',
    '    if (!useSavedPaymentMethod) {\n      if (!luhn(number)) return { ok: false, error: "Número do cartão inválido." };\n      if (!/^(0[1-9]|1[0-2])$/.test(month) || !/^20\\d{2}$/.test(year)) return { ok: false, error: "Validade do cartão inválida." };\n      if (!/^\\d{3,4}$/.test(cvv)) return { ok: false, error: "CVV inválido." };\n      if (holder.length < 3) return { ok: false, error: "Nome impresso no cartão inválido." };\n    }\n    if (![11, 14].includes(cardDocument.length)) return { ok: false, error: "CPF/CNPJ do portador inválido." };\n',
    "Validação condicional do cartão"
  );

  if (!code.includes("let tokenInfo;\n    if (useSavedPaymentMethod)")) {
    const anchor = '    await saveSession(checkoutId, {\n      status: "pending",\n      paymentMethod: "CARD",\n';
    if (!code.includes(anchor)) throw new Error("Âncora de tokenização antes da sessão não encontrada.");
    const tokenBlock = `    let tokenInfo;\n    if (useSavedPaymentMethod) {\n      const savedMethod = await buscarMetodoPagamentoPrivadoPorEmail(email);\n      if (!savedMethod?.paymentMethodId || savedMethod.ativo === false) {\n        return { ok:false, error:"Seu cartão salvo não está mais disponível. Informe um novo cartão." };\n      }\n      tokenInfo = {\n        paymentMethodId: safe(savedMethod.paymentMethodId),\n        customerId: safe(savedMethod.validaPayCustomerId),\n        cardBrand: safe(savedMethod.cardBrand),\n        cardLastFour: safe(savedMethod.cardLastFour),\n        cardExpirationMonth: safe(savedMethod.cardExpirationMonth),\n        cardExpirationYear: safe(savedMethod.cardExpirationYear),\n        cardHolderName: safe(savedMethod.cardHolderName),\n        cardDocument: safe(savedMethod.cardDocument || cardDocument)\n      };\n    } else {\n      tokenInfo = await tokenizarNovoCartao({ number, cvv, month, year, holder, nome, cpfCnpj: cardDocument, email });\n    }\n\n    const paymentMethodId = safe(tokenInfo?.paymentMethodId);\n    if (!paymentMethodId) return { ok:false, error:"Não foi possível preparar o cartão com segurança." };\n\n`;
    code = code.replace(anchor, tokenBlock + anchor);
  }

  code = replaceOnce(
    code,
    '      compraRegistrada: false,\n      cardAttempt,\n      updatedAtDate: new Date()\n',
    '      compraRegistrada: false,\n      cardAttempt,\n      memberId,\n      pendingPaymentMethodId: paymentMethodId,\n      pendingValidaPayCustomerId: safe(tokenInfo?.customerId),\n      pendingCardBrand: safe(tokenInfo?.cardBrand) || brand(number),\n      pendingCardLastFour: safe(tokenInfo?.cardLastFour) || number.slice(-4),\n      pendingCardExpirationMonth: safe(tokenInfo?.cardExpirationMonth) || month,\n      pendingCardExpirationYear: safe(tokenInfo?.cardExpirationYear) || year,\n      pendingCardHolderName: safe(tokenInfo?.cardHolderName) || holder,\n      pendingCardDocument: digits(tokenInfo?.cardDocument || cardDocument),\n      updatedAtDate: new Date()\n',
    "Dados tokenizados na sessão"
  );

  code = replaceOnce(
    code,
    '      card: {\n        number,\n        cvv,\n        name: holder,\n        expiration: `${month}/${year}`\n      },\n      installments,\n',
    '      paymentMethodId,\n      installments,\n',
    "Cobrança com paymentMethodId"
  );

  code = replaceOnce(
    code,
    '      cardBrand: safe(response.data?.cardBrand) || brand(number),\n      cardLastFour: number.slice(-4),\n',
    '      cardBrand: safe(tokenInfo?.cardBrand) || safe(response.data?.cardBrand) || brand(number),\n      cardLastFour: safe(tokenInfo?.cardLastFour) || number.slice(-4),\n',
    "Retorno do cartão tokenizado"
  );

  return code;
});

patchFile(PAGE, code => {
  code = replaceOnce(
    code,
    'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual } from "backend/clientes.web";\n',
    'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual } from "backend/clientes.web";\nimport { buscarMetodoPagamentoDoMembroAtual } from "backend/metodosPagamentoProjetosProntos.web";\n',
    "Import do método salvo"
  );

  code = replaceOnce(
    code,
    'let cardPolling = false;\n',
    'let cardPolling = false;\nlet savedCardPayload = null;\n',
    "Estado do cartão salvo"
  );

  if (!code.includes("async function carregarMetodoPagamentoSalvo()")) {
    const anchor = 'function back() {\n';
    if (!code.includes(anchor)) throw new Error("Âncora de carregamento do cartão salvo não encontrada.");
    const fn = `async function carregarMetodoPagamentoSalvo() {\n  try {\n    const result = await waitTimeout(buscarMetodoPagamentoDoMembroAtual(), 5000, "");\n    savedCardPayload = {\n      type: "SAVED_CARD",\n      existe: result?.metodo?.existe === true,\n      ...(result?.metodo || {})\n    };\n    if (checkoutUiReady) post(savedCardPayload);\n  } catch (_) {\n    savedCardPayload = { type:"SAVED_CARD", existe:false };\n    if (checkoutUiReady) post(savedCardPayload);\n  }\n}\n\n`;
    code = code.replace(anchor, fn + anchor);
  }

  code = replaceOnce(
    code,
    '    if(type==="READY"){checkoutUiReady=true;sendInit();return;}\n',
    '    if(type==="READY"){checkoutUiReady=true;sendInit();if(savedCardPayload)post(savedCardPayload);return;}\n',
    "Entrega do cartão salvo após READY"
  );

  code = replaceOnce(
    code,
    '  contextReady=true;\n  sendInit(true);\n\n  completarContextoPelaColecao()\n',
    '  contextReady=true;\n  sendInit(true);\n  carregarMetodoPagamentoSalvo().catch(console.error);\n\n  completarContextoPelaColecao()\n',
    "Busca do cartão salvo no boot"
  );

  code = replaceOnce(
    code,
    '      card:data.card||{},\n      installments:Number(data.installments||1),\n',
    '      card:data.card||{},\n      useSavedPaymentMethod:data.useSavedPaymentMethod===true,\n      installments:Number(data.installments||1),\n',
    "Flag de cartão salvo na ponte"
  );

  return code;
});

patchFile(HTML, code => {
  if (!code.includes(".savedCardBanner{")) {
    const anchor = '.cardForm{padding:10px;border:1px solid #e2e2e2;border-radius:12px;background:#fff}\n';
    if (!code.includes(anchor)) throw new Error("Âncora CSS do cartão salvo não encontrada.");
    const css = `.savedCardBanner{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:10px 12px;border:1px solid #b9e5c5;border-radius:11px;background:#effcf3;color:#174d29}\n.savedCardInfo{min-width:0;display:flex;flex-direction:column;gap:3px}\n.savedCardTitle{font-size:11px;font-weight:800;text-transform:uppercase}\n.savedCardMeta{font-size:12px;font-weight:700}\n.savedCardAction{flex:0 0 auto;border:0;background:transparent;color:var(--green-dark);font-size:10px;font-weight:800;text-decoration:underline;cursor:pointer}\n.cardForm.useSavedCard .cardSensitiveField{display:none!important}\n`;
    code = code.replace(anchor, css + anchor);
  }

  if (!code.includes('id="savedCardBanner"')) {
    const anchor = '              <div class="visualCard">\n';
    if (!code.includes(anchor)) throw new Error("Âncora HTML do cartão salvo não encontrada.");
    const banner = `              <div id="savedCardBanner" class="savedCardBanner hidden">\n                <div class="savedCardInfo"><span class="savedCardTitle">Cartão salvo</span><span id="savedCardMeta" class="savedCardMeta"></span></div>\n                <button id="savedCardAction" class="savedCardAction" type="button">Trocar cartão</button>\n              </div>\n`;
    code = code.replace(anchor, banner + anchor);
  }

  const fieldReplacements = [
    ['<div class="cardFull"><label class="label">Número do cartão</label>', '<div class="cardFull cardSensitiveField"><label class="label">Número do cartão</label>'],
    ['<div><label class="label">Mês</label><input id="cardMonth"', '<div class="cardSensitiveField"><label class="label">Mês</label><input id="cardMonth"'],
    ['<div><label class="label">Ano</label><input id="cardYear"', '<div class="cardSensitiveField"><label class="label">Ano</label><input id="cardYear"'],
    ['<div><label class="label">CVV</label><input id="cardCvv"', '<div class="cardSensitiveField"><label class="label">CVV</label><input id="cardCvv"'],
    ['<div class="cardWide"><label class="label">Nome impresso no cartão</label>', '<div class="cardWide cardSensitiveField"><label class="label">Nome impresso no cartão</label>'],
    ['<div><label class="label">CPF/CNPJ</label><input id="cardDocument"', '<div class="cardSensitiveField"><label class="label">CPF/CNPJ</label><input id="cardDocument"']
  ];
  for (const [from, to] of fieldReplacements) code = replaceOnce(code, from, to, `Campo sensível ${from.slice(0,35)}`);

  code = replaceOnce(
    code,
    'var S={ctx:{},checkoutId:"",saving:false,paymentReady:false,pixCode:"",tetris:null,cardBusy:false};\n',
    'var S={ctx:{},checkoutId:"",saving:false,paymentReady:false,pixCode:"",tetris:null,cardBusy:false,savedCard:null,useSavedCard:false};\n',
    "Estado HTML do cartão salvo"
  );

  code = replaceOnce(
    code,
    ' identity:$("identityPanel"),payment:$("paymentPanel"),normal:$("paymentNormal"),cardMode:$("paymentCardMode"),success:$("successPanel"),already:$("alreadyPanel"),\n',
    ' identity:$("identityPanel"),payment:$("paymentPanel"),normal:$("paymentNormal"),cardMode:$("paymentCardMode"),success:$("successPanel"),already:$("alreadyPanel"),savedCardBanner:$("savedCardBanner"),savedCardMeta:$("savedCardMeta"),savedCardAction:$("savedCardAction"),\n',
    "Referências do cartão salvo"
  );

  if (!code.includes("function applySavedCardMode(useSaved)")) {
    const anchor = 'function openCard(){\n';
    if (!code.includes(anchor)) throw new Error("Âncora JS do cartão salvo não encontrada.");
    const fn = `function applySavedCardMode(useSaved){\n S.useSavedCard=Boolean(useSaved&&S.savedCard&&S.savedCard.existe===true);\n if(S.useSavedCard){\n   E.cardForm.classList.add("useSavedCard");E.savedCardBanner.classList.remove("hidden");E.savedCardAction.textContent="Trocar cartão";\n   var c=S.savedCard,last=digits(c.cardLastFour).slice(-4),m=digits(c.cardExpirationMonth).padStart(2,"0").slice(-2),y=digits(c.cardExpirationYear).slice(-2);\n   E.savedCardMeta.textContent=(safe(c.cardBrand)||"CARTÃO")+" •••• "+last+"  |  "+m+"/"+y;\n   E.visualBrand.textContent=safe(c.cardBrand)||"CARTÃO";E.visualNumber.textContent="•••• •••• •••• "+last;E.visualName.textContent=safe(c.cardHolderName).toUpperCase()||"SEU NOME";E.visualExpiry.textContent=(m||"MM")+"/"+(y||"AA");\n   if(!digits(E.cardDocument.value)&&digits(c.cardDocument))E.cardDocument.value=digits(c.cardDocument);\n   E.cardSubmit.textContent="Pagar com cartão salvo";\n }else{\n   E.cardForm.classList.remove("useSavedCard");\n   if(S.savedCard&&S.savedCard.existe===true){E.savedCardBanner.classList.remove("hidden");E.savedCardAction.textContent="Usar cartão salvo"}else E.savedCardBanner.classList.add("hidden");\n   E.cardSubmit.textContent=S.savedCard&&S.savedCard.existe===true?"Pagar com novo cartão":"Pagar com cartão";updateVisual();\n }\n layoutMode("CARD");\n}\n\n`;
    code = code.replace(anchor, fn + anchor);
  }

  code = replaceOnce(
    code,
    ' E.normal.classList.add("hidden");E.cardMode.classList.remove("hidden");setAlert(E.cardAlert,"","");updateVisual();\n layoutMode("CARD");\n',
    ' E.normal.classList.add("hidden");E.cardMode.classList.remove("hidden");setAlert(E.cardAlert,"","");\n applySavedCardMode(Boolean(S.savedCard&&S.savedCard.existe===true));\n',
    "Abertura com cartão salvo"
  );

  code = replaceOnce(
    code,
    'function submitCard(ev){\n ev.preventDefault();if(S.cardBusy)return;\n var number=digits(E.cardNumber.value),month=digits(E.cardMonth.value).padStart(2,"0").slice(-2),year=digits(E.cardYear.value),cvv=digits(E.cardCvv.value),name=safe(E.cardName.value).replace(/\\s+/g," "),doc=digits(E.cardDocument.value);\n',
    'function submitCard(ev){\n ev.preventDefault();if(S.cardBusy)return;\n if(S.useSavedCard&&S.savedCard&&S.savedCard.existe===true){\n   S.cardBusy=true;E.cardSubmit.disabled=true;setAlert(E.cardAlert,"info","Processando seu cartão salvo...");\n   var saved=basePayment();saved.type="CREATE_CARD";saved.useSavedPaymentMethod=true;saved.cardDocument=digits(S.savedCard.cardDocument||E.cardDocument.value||S.ctx.cpfCnpj);saved.installments=Number(E.installments.value||1);post(saved);return;\n }\n var number=digits(E.cardNumber.value),month=digits(E.cardMonth.value).padStart(2,"0").slice(-2),year=digits(E.cardYear.value),cvv=digits(E.cardCvv.value),name=safe(E.cardName.value).replace(/\\s+/g," "),doc=digits(E.cardDocument.value);\n',
    "Submit com cartão salvo"
  );

  code = replaceOnce(
    code,
    'E.cardForm.addEventListener("submit",submitCard);\n',
    'E.cardForm.addEventListener("submit",submitCard);\nE.savedCardAction.addEventListener("click",function(){if(!S.savedCard)return;applySavedCardMode(!S.useSavedCard);});\n',
    "Botão trocar/usar cartão"
  );

  if (!code.includes('if(type==="SAVED_CARD")')) {
    const anchor = 'if(type==="INIT"){S.checkoutId=safe(d.checkoutId);hydrate(d.ctx||{});';
    if (!code.includes(anchor)) throw new Error("Âncora de mensagem SAVED_CARD não encontrada.");
    const handler = 'if(type==="SAVED_CARD"){S.savedCard=d.existe===true?{...d,existe:true}:null;if(!E.cardMode.classList.contains("hidden"))applySavedCardMode(Boolean(S.savedCard));return}\n';
    code = code.replace(anchor, handler + anchor);
  }

  code = replaceOnce(
    code,
    ' if(type==="CARD_RESULT"){if(d.approved===true||d.accepted===true){setAlert(E.cardAlert,"success",d.approved===true?"Pagamento aprovado.":(d.paymentApproved===true?"Pagamento aprovado. Preparando sua entrega...":"Pagamento recebido. Aguardando confirmação..."));E.cardCvv.value="";if(d.approved===true)showSuccess()}else{resetCard();setAlert(E.cardAlert,"error",safe(d.error)||"Não foi possível processar o cartão.")}return}\n',
    ' if(type==="CARD_RESULT"){if(d.approved===true||d.accepted===true){setAlert(E.cardAlert,"success",d.approved===true?"Pagamento aprovado.":(d.paymentApproved===true?"Pagamento aprovado. Preparando sua entrega...":"Pagamento recebido. Aguardando confirmação..."));E.cardCvv.value="";if(d.approved===true)showSuccess()}else{resetCard();if(S.useSavedCard&&safe(d.error).toLowerCase().includes("salvo"))applySavedCardMode(false);setAlert(E.cardAlert,"error",safe(d.error)||"Não foi possível processar o cartão.")}return}\n',
    "Fallback se cartão salvo falhar"
  );

  return code;
});

console.log("Cartão tokenizado e reutilização por e-mail aplicados.");
