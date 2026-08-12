const fs = require("fs");

const PRODUCT_PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const CHECKOUT_PAGE = "src/pages/checkout-projeto-pronto.i9aj1.js";
const CUSTOM_ELEMENT = "src/public/custom-elements/pelego-checkout-pronto.js";
const PIX_CORE = "src/backend/validaPayPixProjetosProntosCore.jsw";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, value, original) {
  if (value !== original) {
    fs.writeFileSync(path, value, "utf8");
    console.log(`Atualizado: ${path}`);
  } else {
    console.log(`Sem alteração: ${path}`);
  }
}
function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: início não encontrado.`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`${label}: fim não encontrado.`);
  return source.slice(0, start) + replacement.trimEnd() + "\n\n" + source.slice(end);
}
function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`${label}: já aplicado.`);
    return source;
  }
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrados ${count}.`);
  console.log(`${label}: aplicado.`);
  return source.replace(oldText, newText);
}

// -----------------------------------------------------------------------------
// 1) Página anterior: o handoff leva uma fotografia completa da identificação
// já validada, em vez de apenas clienteId. Assim o checkout não depende de
// storage antigo/incompleto para decidir a primeira tela.
// -----------------------------------------------------------------------------
{
  const original = read(PRODUCT_PAGE);
  let code = original;
  const handoff = `function salvarAutorizacaoCheckout(
  tipoProduto
) {
  try {
    const telefone =
      normalizarTelefone(
        identificacao
      );

    session.setItem(
      CHECKOUT_AUTH_KEY,
      JSON.stringify({
        codigoProjeto:
          codigoPublico(projeto),

        tipoProduto:
          safe(tipoProduto)
            .toUpperCase(),

        clienteId:
          safe(identificacao.clienteId),

        nome:
          safe(identificacao.nome),

        email:
          normalizeEmail(identificacao.email),

        cpfCnpj:
          onlyDigits(
            identificacao.cpfCnpj ||
            identificacao.cpf
          ),

        whatsapp:
          telefone.whatsapp,

        whatsappE164:
          telefone.whatsappE164,

        whatsappConfirmado:
          identificacao.whatsappConfirmado === true,

        criadoEm:
          Date.now()
      })
    );
  } catch (_) {}
}`;
  code = replaceSection(
    code,
    "function salvarAutorizacaoCheckout(",
    "// ======================================================\n// URL DO CHECKOUT TRANSPARENTE",
    handoff,
    "Handoff completo da página anterior"
  );
  write(PRODUCT_PAGE, code, original);
}

// -----------------------------------------------------------------------------
// 2) Checkout: usa o snapshot do handoff como fonte principal quando ele é
// recente, corresponde ao projeto/etapa e contém identidade completa.
// -----------------------------------------------------------------------------
{
  const original = read(CHECKOUT_PAGE);
  let code = original;

  const handoffReader = `function checkoutHandoffSnapshot(project = "", type = "") {
  try {
    const raw = session.getItem(CHECKOUT_AUTH_KEY);
    if (!raw) return null;

    const marker = JSON.parse(raw);
    if (!marker || typeof marker !== "object") return null;

    const createdAt = Number(marker.criadoEm || 0);
    const age = Date.now() - createdAt;
    if (!(createdAt > 0 && age >= 0 && age <= CHECKOUT_AUTH_MAX_AGE)) return null;
    if (digits(marker.codigoProjeto) !== digits(project)) return null;
    if (safe(marker.tipoProduto).toUpperCase() !== safe(type).toUpperCase()) return null;

    const snapshot = {
      clienteId: safe(marker.clienteId),
      nome: safe(marker.nome || marker.nomeCliente),
      email: email(marker.email),
      cpfCnpj: cpf(marker.cpfCnpj || marker.cpf),
      whatsapp: phone(marker.whatsappE164 || marker.whatsapp),
      whatsappE164: "",
      whatsappConfirmado: marker.whatsappConfirmado === true
    };

    if (snapshot.whatsapp) snapshot.whatsappE164 = "+55" + snapshot.whatsapp;

    if (!snapshot.clienteId || snapshot.whatsappConfirmado !== true || !identityComplete(snapshot)) {
      return null;
    }

    return snapshot;
  } catch (_) {
    return null;
  }
}`;

  code = replaceSection(
    code,
    "function checkoutHandoffVerified(",
    "function sessionIdentityCandidate()",
    handoffReader,
    "Leitura do snapshot de handoff"
  );

  const context = `function contextFromUrl() {
  const q=wixLocation.query || {};
  const saved=savedIdentity();
  const project=digits(q.codigoProjeto || q.ordemVideo || q.codigo);
  const type=safe(q.tipoProduto || "MEDIDAS").toUpperCase();
  const handoff=checkoutHandoffSnapshot(project,type);
  const source=handoff || saved;
  const verifiedSession=sessionIdentityVerified(source);
  const number=phone(source.whatsappE164 || source.whatsapp);
  const product=safe(q.tituloOriginal || q.titulo || q.produto || q.name || "Projeto Pronto");
  return {
    codigoProjeto:project,
    produto:product,
    titulo:product,
    productId:safe(q.productId),
    img:safe(q.imagem || q.img),
    imagem:safe(q.imagem || q.img),
    valor:Number(q.valor || q.price || 0),
    price:Number(q.valor || q.price || 0),
    tipoProduto:type,
    whatsapp:number,
    whatsappE164:number ? \`+55\${number}\` : "",
    ddi:"55", country:"br",
    clienteId:safe(source.clienteId),
    nome:safe(source.nome || source.nomeCliente),
    email:email(source.email),
    cpfCnpj:cpf(source.cpfCnpj || source.cpf),
    whatsappConfirmado:source.whatsappConfirmado === true,
    skipIdentity:Boolean(handoff) || verifiedSession,
    hideSku:true,
    returnUrl:safe(q.returnUrl) || (project ? \`/checkoutprojetosprontos?codigo=\${encodeURIComponent(project)}\` : "/checkoutprojetosprontos")
  };
}`;

  code = replaceSection(
    code,
    "function contextFromUrl() {",
    "async function buscarProjetoCatalogo(",
    context,
    "Contexto inicial pelo handoff"
  );

  write(CHECKOUT_PAGE, code, original);
}

// -----------------------------------------------------------------------------
// 3) Botão de identificação: começa cinza e só libera/verde quando todos os
// campos estão válidos. Tudo local, sem consulta Wix/ValidaPay.
// -----------------------------------------------------------------------------
{
  const original = read(CUSTOM_ELEMENT);
  let code = original;

  if (!code.includes(".buttonPrimary:disabled{background:#d9d9d9")) {
    code = replaceOnce(
      code,
      ".button:disabled{opacity:.45;cursor:not-allowed;transform:none}",
      ".button:disabled{opacity:.45;cursor:not-allowed;transform:none}\n.buttonPrimary:disabled{background:#d9d9d9;color:#8a8a8a;opacity:1}",
      "Visual cinza do botão incompleto"
    );
  }

  code = replaceOnce(
    code,
    '<button id="identityButton" class="button buttonPrimary" type="button">Continuar para pagamento</button>',
    '<button id="identityButton" class="button buttonPrimary" type="button" disabled>Continuar para pagamento</button>',
    "Botão nasce desabilitado"
  );

  const validation = `function identityFieldsReady(){
 var p=phoneLocal(E.phone.value),n=safe(E.name.value).replace(/\\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value),b=email(E.email2.value);
 return Boolean(p && n.length>=3 && validCpf(c) && validEmail(a) && validEmail(b) && a===b)
}
function syncIdentityButton(){
 if(!E.identityBtn)return;
 E.identityBtn.disabled=S.saving || !identityFieldsReady();
}
function validateIdentity(){
 var p=phoneLocal(E.phone.value),n=safe(E.name.value).replace(/\\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value),b=email(E.email2.value);
 if(!p){setAlert(E.identityAlert,"error","Informe um WhatsApp válido com DDD.");E.phone.focus();return false}
 if(n.length<3){setAlert(E.identityAlert,"error","Informe seu nome completo.");E.name.focus();return false}
 if(!validCpf(c)){setAlert(E.identityAlert,"error","Informe um CPF válido.");E.cpf.focus();return false}
 if(!validEmail(a)){setAlert(E.identityAlert,"error","Informe um e-mail válido.");E.email.focus();return false}
 if(!validEmail(b)||a!==b){setAlert(E.identityAlert,"error","Os e-mails não coincidem. Confira os dois campos.");E.email2.focus();return false}
 return true
}`;

  code = replaceSection(
    code,
    "function validateIdentity(){",
    "function customerPayload(){",
    validation,
    "Validação visual em tempo real"
  );

  if (!code.includes("fillInstallments();\n syncIdentityButton();\n}")) {
    code = replaceOnce(
      code,
      " fillInstallments();\n}",
      " fillInstallments();\n syncIdentityButton();\n}",
      "Sincronizar botão após hydrate"
    );
  }

  const oldListeners = `E.phone.addEventListener("input",function(){this.value=formatPhone(this.value)});
E.cpf.addEventListener("input",function(){this.value=formatCpf(this.value)});
E.identityBtn.addEventListener("click",function(){if(S.saving||!validateIdentity())return;S.saving=true;E.identityBtn.disabled=true;setAlert(E.identityAlert,"info","Salvando seus dados...");post(customerPayload())});`;
  const newListeners = `E.phone.addEventListener("input",function(){this.value=formatPhone(this.value);syncIdentityButton()});
E.name.addEventListener("input",syncIdentityButton);
E.cpf.addEventListener("input",function(){this.value=formatCpf(this.value);syncIdentityButton()});
E.email.addEventListener("input",syncIdentityButton);
E.email2.addEventListener("input",syncIdentityButton);
E.identityBtn.addEventListener("click",function(){if(S.saving||!validateIdentity())return;S.saving=true;syncIdentityButton();setAlert(E.identityAlert,"info","Salvando seus dados...");post(customerPayload())});
syncIdentityButton();`;
  code = replaceOnce(code, oldListeners, newListeners, "Eventos do botão em tempo real");

  write(CUSTOM_ELEMENT, code, original);
}

// -----------------------------------------------------------------------------
// 4) Pix: antes de consultar produtos na ValidaPay, tenta um priceId correto já
// conhecido no Wix. Só reutiliza registros com label da etapa atual.
// -----------------------------------------------------------------------------
{
  const original = read(PIX_CORE);
  let code = original;

  const oldFound = `    const found = (result.items || []).find(item =>
      safe(item?.validaPayPriceId) &&
      normalizarTituloProduto(item?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase() &&
      Math.abs(Number(item?.valor || 0) - Number(valor || 0)) <= 0.01
    );`;
  const newFound = `    const tituloPreco = priceTitleForType(tipoProduto);
    const found = (result.items || []).find(item =>
      safe(item?.validaPayPriceId) &&
      safe(item?.validaPayPriceLabel) === tituloPreco &&
      normalizarTituloProduto(item?.produto).toLowerCase() === normalizarTituloProduto(produto).toLowerCase() &&
      Math.abs(Number(item?.valor || 0) - Number(valor || 0)) <= 0.01
    );`;
  code = replaceOnce(code, oldFound, newFound, "PriceId local somente com label correto");

  const oldProvider = `  const providerReused = await buscarPriceIdExistenteValidaPay({ produto, valor, tipoProduto });`;
  const newProvider = `  const localReused = await reusablePriceId({ codigoProjeto, tipoProduto, produto, valor });
  if (localReused) {
    await saveSession(checkoutId, { validaPayPriceId: localReused, validaPayPriceLabel: tituloPreco, updatedAtDate: new Date() });
    return localReused;
  }

  const providerReused = await buscarPriceIdExistenteValidaPay({ produto, valor, tipoProduto });`;
  code = replaceOnce(code, oldProvider, newProvider, "Reutilizar priceId local antes da ValidaPay");

  write(PIX_CORE, code, original);
}

console.log("Correções estáveis de checkout aplicadas.");
