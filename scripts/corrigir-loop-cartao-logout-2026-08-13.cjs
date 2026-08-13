const fs = require("fs");

const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const PAYMENT = "src/pages/checkout-projeto-pronto.i9aj1.js";
const ELEMENT = "src/public/custom-elements/pelego-checkout-pronto.js";

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

function patchProjectPage() {
  let code = fs.readFileSync(PAGE, "utf8");

  const oldNeighborReturn = `    return resultado.items.length\n      ? resultado.items[0]\n      : null;`;
  const circularReturn = `    if (resultado.items.length) {\n      return resultado.items[0];\n    }\n\n    /*\n      Navegação circular: ao ultrapassar o último projeto pela direita,\n      volta para o primeiro. Ao ultrapassar o primeiro pela esquerda,\n      volta para o último. Assim as duas setas nunca chegam a um beco sem saída.\n    */\n    let consultaExtremo = wixData.query(COLLECTION);\n    consultaExtremo = direcao < 0\n      ? consultaExtremo.descending("ordem_video")\n      : consultaExtremo.ascending("ordem_video");\n\n    const extremo = await consultaExtremo.limit(1).find();\n    const circular = extremo.items.length ? extremo.items[0] : null;\n\n    if (\n      circular &&\n      codigoPublico(circular) !== String(codigoAtual)\n    ) {\n      return circular;\n    }\n\n    return null;`;

  // Esse trecho aparece também em outras funções. Fazemos a troca somente dentro
  // da função buscarProjetoVizinho, usando o recorte delimitado.
  const start = code.indexOf("async function buscarProjetoVizinho(");
  const end = code.indexOf("async function prepararProjetosVizinhos()", start);
  if (start < 0 || end < 0) throw new Error("Função buscarProjetoVizinho não encontrada.");
  let neighborBlock = code.slice(start, end);
  neighborBlock = replaceOnce(neighborBlock, oldNeighborReturn, circularReturn, "Loop circular");
  code = code.slice(0, start) + neighborBlock + code.slice(end);

  const oldReady = `$w.onReady(\n  function () {\n    if (!paginaLoginSocialAtiva()) {\n      cancelarPopupAgendado();\n      return;\n    }`;
  const newReady = `$w.onReady(\n  function () {\n    if (!paginaLoginSocialAtiva()) {\n      cancelarPopupAgendado();\n      return;\n    }\n\n    /*\n      Regra da página protegida: se o membro deslogar enquanto estiver aqui,\n      não deixamos o checkout social aberto nem reabrimos o modal de login.\n      O visitante volta imediatamente para a Home.\n    */\n    try {\n      authentication.onLogout(() => {\n        cancelarPopupAgendado();\n        identificado = false;\n        popupAberto = false;\n        wixLocation.to("/");\n      });\n    } catch (error) {\n      console.warn("Não foi possível registrar o redirecionamento após logout:", error?.message || error);\n    }`;
  code = replaceOnce(code, oldReady, newReady, "Logout para Home");

  fs.writeFileSync(PAGE, code, "utf8");
  console.log("Página principal: loop circular + logout para Home aplicados.");
}

function patchPaymentBridge() {
  let code = fs.readFileSync(PAYMENT, "utf8");

  if (!code.includes("async function carregarContextoClienteAutenticado()")) {
    const marker = "async function carregarMetodoPagamentoSalvo() {";
    if (!code.includes(marker)) throw new Error("Âncora do contexto autenticado não encontrada.");
    const helper = `async function carregarContextoClienteAutenticado() {\n  try {\n    const perfil = await waitTimeout(buscarClienteDoMembroAtual(), 5000, "");\n    const cliente = perfil?.cliente && typeof perfil.cliente === "object" ? perfil.cliente : null;\n    const mail = email(perfil?.email || cliente?.email || ctx.email);\n\n    const patch = {\n      clienteId: safe(cliente?._id || cliente?.clienteId || ctx.clienteId),\n      nome: safe(cliente?.nome || perfil?.nome || ctx.nome),\n      email: mail,\n      cpfCnpj: cpf(cliente?.cpfCnpj || cliente?.cpf || ctx.cpfCnpj)\n    };\n\n    ctx = { ...ctx, ...patch };\n    saveIdentity(patch);\n\n    post({\n      type: "CUSTOMER_CONTEXT",\n      ok: true,\n      clienteId: ctx.clienteId,\n      nome: ctx.nome,\n      email: ctx.email,\n      cpfCnpj: ctx.cpfCnpj\n    });\n  } catch (error) {\n    console.warn("Contexto do cliente autenticado não pôde ser atualizado:", error?.message || error);\n  }\n}\n\n`;
    code = code.replace(marker, helper + marker);
  }

  const oldBoot = `  contextReady=true;\n  sendInit(true);\n  carregarMetodoPagamentoSalvo().catch(console.error);`;
  const newBoot = `  contextReady=true;\n  sendInit(true);\n  carregarContextoClienteAutenticado().catch(console.error);\n  carregarMetodoPagamentoSalvo().catch(console.error);`;
  code = replaceOnce(code, oldBoot, newBoot, "Carregar contexto autenticado no checkout");

  fs.writeFileSync(PAYMENT, code, "utf8");
  console.log("Ponte do pagamento: nome/CPF do membro autenticado passam a ser reenviados ao formulário.");
}

function patchCustomElement() {
  let code = fs.readFileSync(ELEMENT, "utf8");

  if (!code.includes("function hydrateCardIdentity(data)")) {
    const marker = "function customerPayload(){";
    if (!code.includes(marker)) throw new Error("Âncora hydrateCardIdentity não encontrada.");
    const helper = `function hydrateCardIdentity(data){\n var d=data&&typeof data==="object"?data:{};\n var name=safe(d.nome||d.nomeCliente||S.ctx.nome);\n var doc=digits(d.cpfCnpj||d.cpf||S.ctx.cpfCnpj).slice(0,14);\n if(name){S.ctx.nome=name;if(!safe(E.cardName.value))E.cardName.value=name}\n if(doc){S.ctx.cpfCnpj=doc;if(!digits(E.cardDocument.value))E.cardDocument.value=doc}\n updateVisual();\n}\n\n`;
    code = code.replace(marker, helper + marker);
  }

  const oldHydrateTail = ` if(S.ctx.nome)E.name.value=safe(S.ctx.nome);\n if(S.ctx.cpfCnpj)E.cpf.value=formatCpf(S.ctx.cpfCnpj);\n if(S.ctx.email){E.email.value=email(S.ctx.email);E.email2.value=email(S.ctx.email)}\n fillInstallments();`;
  const newHydrateTail = ` if(S.ctx.nome)E.name.value=safe(S.ctx.nome);\n if(S.ctx.cpfCnpj)E.cpf.value=formatCpf(S.ctx.cpfCnpj);\n if(S.ctx.email){E.email.value=email(S.ctx.email);E.email2.value=email(S.ctx.email)}\n hydrateCardIdentity(S.ctx);\n fillInstallments();`;
  code = replaceOnce(code, oldHydrateTail, newHydrateTail, "Hidratar cartão no INIT");

  const oldCustomerBranch = ` if(["CUSTOMER_READY","DATA_SAVED","PAYMENT_READY","SHOW_PAYMENT"].indexOf(type)>=0){\n   if(d.ok===false){S.saving=false;E.identityBtn.disabled=false;setAlert(E.identityAlert,"error",safe(d.error)||"Não foi possível salvar os dados.");return}\n   if(d.clienteId)S.ctx.clienteId=safe(d.clienteId);if(d.nome)S.ctx.nome=safe(d.nome);if(d.email)S.ctx.email=email(d.email);if(d.cpfCnpj)S.ctx.cpfCnpj=digits(d.cpfCnpj);showPayment();return\n }`;
  const newCustomerBranch = ` if(type==="CUSTOMER_CONTEXT"){\n   if(d.clienteId)S.ctx.clienteId=safe(d.clienteId);if(d.nome)S.ctx.nome=safe(d.nome);if(d.email)S.ctx.email=email(d.email);if(d.cpfCnpj)S.ctx.cpfCnpj=digits(d.cpfCnpj);hydrateCardIdentity(d);return\n }\n if(["CUSTOMER_READY","DATA_SAVED","PAYMENT_READY","SHOW_PAYMENT"].indexOf(type)>=0){\n   if(d.ok===false){S.saving=false;E.identityBtn.disabled=false;setAlert(E.identityAlert,"error",safe(d.error)||"Não foi possível salvar os dados.");return}\n   if(d.clienteId)S.ctx.clienteId=safe(d.clienteId);if(d.nome)S.ctx.nome=safe(d.nome);if(d.email)S.ctx.email=email(d.email);if(d.cpfCnpj)S.ctx.cpfCnpj=digits(d.cpfCnpj);hydrateCardIdentity(d);showPayment();return\n }`;
  code = replaceOnce(code, oldCustomerBranch, newCustomerBranch, "Atualizar cartão quando cliente chega depois");

  fs.writeFileSync(ELEMENT, code, "utf8");
  console.log("Custom element: nome/CPF passam a preencher o cartão mesmo quando chegam após o INIT.");
}

patchProjectPage();
patchPaymentBridge();
patchCustomElement();
console.log("Pacote loop + cartão + logout concluído.");
