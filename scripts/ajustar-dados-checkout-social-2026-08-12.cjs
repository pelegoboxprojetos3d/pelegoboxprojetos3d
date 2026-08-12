const fs = require("fs");

const FILE = "src/public/custom-elements/pelego-checkout-pronto.js";

function fail(message) {
  throw new Error(message);
}

let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceExact(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) fail(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

// 1) Botão de continuar: desabilitado continua no padrão visual verde,
//    e habilitado fica no verde forte já usado no checkout.
replaceExact(
  ".buttonPrimary{background:var(--green);color:#fff}",
  ".buttonPrimary{background:var(--green);color:#fff;border:2px solid var(--green)}",
  "Botão primário"
);

replaceExact(
  ".buttonPrimary:disabled{background:#d9d9d9;color:#8a8a8a;opacity:1}",
  ".buttonPrimary:disabled{background:#f5fff7;color:var(--green);border-color:var(--green);opacity:1;box-shadow:0 3px 11px rgba(38,133,53,.09)}",
  "Botão primário desabilitado"
);

// 2) Dois campos de WhatsApp, lado a lado no desktop e empilhados no mobile.
if (!code.includes('id="phoneConfirmInput"')) {
  const phoneBlock = /<div class="fieldFull">\s*<label class="label">WhatsApp com DDD <span class="required">\*<\/span><\/label>[\s\S]*?<p class="hint">Informe somente DDD e número\.<\/p>\s*<\/div>/;

  if (!phoneBlock.test(code)) {
    fail("Bloco de WhatsApp não encontrado.");
  }

  const replacement = String.raw`<div>
            <label class="label">WhatsApp com DDD <span class="required">*</span></label>
            <div class="phoneRow">
              <div class="phonePrefix">🇧🇷 +55</div>
              <input id="phoneInput" class="control" type="tel" inputmode="numeric" maxlength="15" placeholder="Ex: (11) 99888-7766">
            </div>
            <p class="hint">Informe somente DDD e número.</p>
          </div>
          <div>
            <label class="label">Confirme seu WhatsApp <span class="required">*</span></label>
            <div class="phoneRow">
              <div class="phonePrefix">🇧🇷 +55</div>
              <input id="phoneConfirmInput" class="control" type="tel" inputmode="numeric" maxlength="15" placeholder="Digite novamente">
            </div>
            <p id="phoneConfirmHint" class="hint">Digite novamente o mesmo WhatsApp.</p>
          </div>`;

  code = code.replace(phoneBlock, replacement);
  changed = true;
} else {
  const oldExample = 'placeholder="Ex: 47988419261"';
  if (code.includes(oldExample)) {
    code = code.replace(oldExample, 'placeholder="Ex: (11) 99888-7766"');
    changed = true;
  }
}

// 3) Referências JS dos novos elementos.
if (!code.includes('phoneConfirm:$("phoneConfirmInput")')) {
  replaceExact(
    'phone:$("phoneInput"),name:$("nameInput"),cpf:$("cpfInput")',
    'phone:$("phoneInput"),phoneConfirm:$("phoneConfirmInput"),phoneConfirmHint:$("phoneConfirmHint"),name:$("nameInput"),cpf:$("cpfInput")',
    "Referências do WhatsApp confirmado"
  );
}

// 4) Uma única validação canônica dos dados. Remove duplicações antigas de
//    identityFieldsReady/syncIdentityButton e valida os dois WhatsApps.
const validationRegion = /function identityFieldsReady\(\)\{[\s\S]*?function customerPayload\(\)\{/;

if (!code.includes("function phoneConfirmationMatches()")) {
  if (!validationRegion.test(code)) {
    fail("Região de validação da identificação não encontrada.");
  }

  const canonicalValidation = String.raw`function phoneConfirmationMatches(){
 var a=phoneLocal(E.phone.value),b=phoneLocal(E.phoneConfirm.value);
 return Boolean(a&&b&&a===b)
}
function syncPhoneConfirmationState(){
 if(!E.phoneConfirm||!E.phoneConfirmHint)return;
 var a=phoneLocal(E.phone.value),b=phoneLocal(E.phoneConfirm.value),mismatch=Boolean(b&&a!==b);
 E.phoneConfirm.style.borderColor=mismatch?"#d32f2f":"";
 E.phoneConfirm.style.boxShadow=mismatch?"0 0 0 3px rgba(211,47,47,.10)":"";
 E.phoneConfirmHint.textContent=mismatch?"Os números não conferem.":"Digite novamente o mesmo WhatsApp.";
 E.phoneConfirmHint.style.color=mismatch?"#b3261e":"#777";
}
function identityFieldsReady(){
 var p=phoneLocal(E.phone.value),p2=phoneLocal(E.phoneConfirm.value),n=safe(E.name.value).replace(/\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value);
 return Boolean(p&&p2&&p===p2&&n.length>=3&&validCpf(c)&&validEmail(a))
}
function syncIdentityButton(){
 syncPhoneConfirmationState();
 if(!E.identityBtn)return;
 E.identityBtn.disabled=S.saving||!identityFieldsReady();
}
function validateIdentity(){
 var p=phoneLocal(E.phone.value),p2=phoneLocal(E.phoneConfirm.value),n=safe(E.name.value).replace(/\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value);
 if(!p){setAlert(E.identityAlert,"error","Informe um WhatsApp válido com DDD.");E.phone.focus();return false}
 if(!p2){setAlert(E.identityAlert,"error","Confirme seu WhatsApp.");E.phoneConfirm.focus();return false}
 if(p!==p2){setAlert(E.identityAlert,"error","Os números de WhatsApp não conferem.");syncPhoneConfirmationState();E.phoneConfirm.focus();return false}
 if(n.length<3){setAlert(E.identityAlert,"error","Informe seu nome completo.");E.name.focus();return false}
 if(!validCpf(c)){setAlert(E.identityAlert,"error","Informe um CPF válido.");E.cpf.focus();return false}
 if(!validEmail(a)){setAlert(E.identityAlert,"error","Não foi possível carregar o e-mail da sua conta Google/Facebook.");return false}
 return true
}

function customerPayload(){`;

  code = code.replace(validationRegion, canonicalValidation);
  changed = true;
}

// 5) Validação em tempo real dos dois números.
if (!code.includes('E.phoneConfirm.addEventListener("input"')) {
  replaceExact(
    'E.phone.addEventListener("input",function(){this.value=formatPhone(this.value);syncIdentityButton()});',
    'E.phone.addEventListener("input",function(){this.value=formatPhone(this.value);syncIdentityButton()});\nE.phoneConfirm.addEventListener("input",function(){this.value=formatPhone(this.value);syncIdentityButton()});',
    "Eventos dos dois WhatsApps"
  );
}

// Ao abrir a conferência em um navegador ainda não validado, o número
// principal pode vir preenchido, mas a confirmação deve ser digitada pelo usuário.
if (!code.includes('if(E.phoneConfirm)E.phoneConfirm.value="";')) {
  replaceExact(
    'var p=phoneLocal(S.ctx.whatsappE164||S.ctx.whatsapp);if(p)E.phone.value=formatPhone(p);',
    'var p=phoneLocal(S.ctx.whatsappE164||S.ctx.whatsapp);if(p)E.phone.value=formatPhone(p);if(E.phoneConfirm)E.phoneConfirm.value="";',
    "Limpeza da confirmação ao hidratar"
  );
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Checkout social ajustado: botão verde, exemplo genérico e confirmação dupla do WhatsApp.");
} else {
  console.log("Checkout social já está com os ajustes finais de dados.");
}
