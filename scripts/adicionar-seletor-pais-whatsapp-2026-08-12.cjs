const fs = require("fs");
const FILE = "src/public/custom-elements/pelego-checkout-pronto.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceExact(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

replaceExact(
  ".phoneRow{display:grid;grid-template-columns:76px 1fr}",
  ".phoneRow{display:grid;grid-template-columns:122px 1fr}",
  "Largura do seletor de país"
);

if (!code.includes(".countrySelect{")) {
  replaceExact(
    ".phonePrefix{height:48px;display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid #d7d7d7;border-right:0;border-radius:12px 0 0 12px;background:#fafafa;font-size:13px;font-weight:700}",
    ".phonePrefix{height:48px;display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid #d7d7d7;border-right:0;border-radius:12px 0 0 12px;background:#fafafa;font-size:13px;font-weight:700}.countrySelect{width:122px;padding:0 7px;cursor:pointer;outline:none;color:#171717;appearance:auto}.countrySelect:focus{border-color:#71ba87;box-shadow:0 0 0 3px rgba(21,148,71,.10)}",
    "CSS do seletor de país"
  );
}

const options = `<option value="55|br">🇧🇷 +55</option>
<option value="1|us">🇺🇸 +1</option>
<option value="351|pt">🇵🇹 +351</option>
<option value="54|ar">🇦🇷 +54</option>
<option value="595|py">🇵🇾 +595</option>
<option value="598|uy">🇺🇾 +598</option>
<option value="56|cl">🇨🇱 +56</option>
<option value="591|bo">🇧🇴 +591</option>
<option value="51|pe">🇵🇪 +51</option>
<option value="57|co">🇨🇴 +57</option>
<option value="593|ec">🇪🇨 +593</option>
<option value="58|ve">🇻🇪 +58</option>
<option value="52|mx">🇲🇽 +52</option>
<option value="34|es">🇪🇸 +34</option>
<option value="44|gb">🇬🇧 +44</option>
<option value="33|fr">🇫🇷 +33</option>
<option value="49|de">🇩🇪 +49</option>
<option value="39|it">🇮🇹 +39</option>
<option value="41|ch">🇨🇭 +41</option>
<option value="31|nl">🇳🇱 +31</option>
<option value="32|be">🇧🇪 +32</option>
<option value="353|ie">🇮🇪 +353</option>
<option value="81|jp">🇯🇵 +81</option>
<option value="61|au">🇦🇺 +61</option>
<option value="64|nz">🇳🇿 +64</option>`;

if (!code.includes('id="countrySelect"')) {
  code = code.replace(
    '<div class="phonePrefix">🇧🇷 +55</div>\n              <input id="phoneInput"',
    `<select id="countrySelect" class="phonePrefix countrySelect" aria-label="País e código do WhatsApp">${options}</select>\n              <input id="phoneInput"`
  );
  code = code.replace(
    '<div class="phonePrefix">🇧🇷 +55</div>\n              <input id="phoneConfirmInput"',
    `<select id="countryConfirmSelect" class="phonePrefix countrySelect" aria-label="País e código da confirmação do WhatsApp">${options}</select>\n              <input id="phoneConfirmInput"`
  );
  if (!code.includes('id="countrySelect"') || !code.includes('id="countryConfirmSelect"')) {
    throw new Error("Não foi possível inserir os seletores de país.");
  }
  changed = true;
}

if (!code.includes('country:$("countrySelect")')) {
  replaceExact(
    'phone:$("phoneInput"),phoneConfirm:$("phoneConfirmInput"),phoneConfirmHint:$("phoneConfirmHint"),name:$("nameInput")',
    'country:$("countrySelect"),countryConfirm:$("countryConfirmSelect"),phone:$("phoneInput"),phoneConfirm:$("phoneConfirmInput"),phoneConfirmHint:$("phoneConfirmHint"),name:$("nameInput")',
    "Referências dos seletores"
  );
}

replaceExact(
  'function phoneLocal(v){var n=digits(v);if(n.indexOf("55")===0&&(n.length===12||n.length===13))n=n.slice(2);return n.length===10||n.length===11?n:""}\nfunction formatPhone(v){var n=phoneLocal(v)||digits(v).slice(-11);if(n.length===11)return n.replace(/^(\\d{2})(\\d{5})(\\d{4})$/,"($1) $2-$3");if(n.length===10)return n.replace(/^(\\d{2})(\\d{4})(\\d{4})$/,"($1) $2-$3");return n}',
  'function countryInfo(select){var raw=safe(select&&select.value||"55|br").split("|");return{ddi:digits(raw[0])||"55",country:safe(raw[1]||"br").toLowerCase()}}\nfunction phoneLocal(v,ddi){var n=digits(v),d=digits(ddi||"55");if(d&&n.indexOf(d)===0&&n.length>d.length+5)n=n.slice(d.length);return n.length>=6&&n.length<=15?n:""}\nfunction formatPhone(v,ddi){var d=digits(ddi||"55"),n=phoneLocal(v,d)||digits(v).slice(0,15);if(d==="55"&&n.length===11)return n.replace(/^(\\d{2})(\\d{5})(\\d{4})$/,"($1) $2-$3");if(d==="55"&&n.length===10)return n.replace(/^(\\d{2})(\\d{4})(\\d{4})$/,"($1) $2-$3");return n}',
  "Telefone internacional"
);

// Hidrata DDI/país salvo no contexto.
replaceExact(
  'var p=phoneLocal(S.ctx.whatsappE164||S.ctx.whatsapp);if(p)E.phone.value=formatPhone(p);if(E.phoneConfirm)E.phoneConfirm.value="";',
  'var wantedDdi=digits(S.ctx.ddi||"55")||"55";[E.country,E.countryConfirm].forEach(function(sel){if(!sel)return;var opt=Array.prototype.find.call(sel.options,function(o){return safe(o.value).split("|")[0]===wantedDdi});if(opt)sel.value=opt.value});var ci=countryInfo(E.country),p=phoneLocal(S.ctx.whatsappE164||S.ctx.whatsapp,ci.ddi);if(p)E.phone.value=formatPhone(p,ci.ddi);if(E.phoneConfirm)E.phoneConfirm.value="";',
  "Hidratação internacional"
);

// Valida confirmação usando o mesmo DDI.
code = code.replace(/phoneLocal\(E\.phone\.value\)/g, 'phoneLocal(E.phone.value,countryInfo(E.country).ddi)');
code = code.replace(/phoneLocal\(E\.phoneConfirm\.value\)/g, 'phoneLocal(E.phoneConfirm.value,countryInfo(E.countryConfirm).ddi)');

replaceExact(
`function customerPayload(){
 var p=phoneLocal(E.phone.value,countryInfo(E.country).ddi),n=safe(E.name.value).replace(/\\s+/g," ");
 return{type:"CREATE_CUSTOMER",checkoutId:S.checkoutId,whatsapp:p,whatsappE164:p?"+55"+p:"",ddi:"55",country:"br",nome:n,nomeCliente:n,cpfCnpj:cpf(E.cpf.value),cpf:cpf(E.cpf.value),email:email(E.email.value),ctx:S.ctx}
}
function basePayment(){
 var p=phoneLocal(E.phone.value||S.ctx.whatsapp);`,
`function customerPayload(){
 var ci=countryInfo(E.country),p=phoneLocal(E.phone.value,ci.ddi),n=safe(E.name.value).replace(/\\s+/g," ");
 return{type:"CREATE_CUSTOMER",checkoutId:S.checkoutId,whatsapp:p,whatsappE164:p?"+"+ci.ddi+p:"",ddi:ci.ddi,country:ci.country,nome:n,nomeCliente:n,cpfCnpj:cpf(E.cpf.value),cpf:cpf(E.cpf.value),email:email(E.email.value),ctx:S.ctx}
}
function basePayment(){
 var ci=countryInfo(E.country),p=phoneLocal(E.phone.value||S.ctx.whatsapp,ci.ddi);`,
"Payload internacional"
);

replaceExact(
  'return{checkoutId:S.checkoutId,clienteId:safe(S.ctx.clienteId),nome:safe(E.name.value||S.ctx.nome),nomeCliente:safe(E.name.value||S.ctx.nome),email:email(E.email.value||S.ctx.email),cpfCnpj:cpf(E.cpf.value||S.ctx.cpfCnpj),whatsapp:p,whatsappE164:p?"+55"+p:"",ddi:"55",country:"br",codigoProjeto:',
  'return{checkoutId:S.checkoutId,clienteId:safe(S.ctx.clienteId),nome:safe(E.name.value||S.ctx.nome),nomeCliente:safe(E.name.value||S.ctx.nome),email:email(E.email.value||S.ctx.email),cpfCnpj:cpf(E.cpf.value||S.ctx.cpfCnpj),whatsapp:p,whatsappE164:p?"+"+ci.ddi+p:"",ddi:ci.ddi,country:ci.country,codigoProjeto:',
  "Pagamento internacional"
);

replaceExact(
  'E.phone.addEventListener("input",function(){this.value=formatPhone(this.value);syncIdentityButton()});\nE.phoneConfirm.addEventListener("input",function(){this.value=formatPhone(this.value);syncIdentityButton()});',
  'E.country.addEventListener("change",function(){E.countryConfirm.value=this.value;E.phone.value=formatPhone(E.phone.value,countryInfo(E.country).ddi);E.phoneConfirm.value="";syncIdentityButton()});\nE.countryConfirm.addEventListener("change",function(){E.country.value=this.value;E.phone.value=formatPhone(E.phone.value,countryInfo(E.country).ddi);E.phoneConfirm.value="";syncIdentityButton()});\nE.phone.addEventListener("input",function(){this.value=formatPhone(this.value,countryInfo(E.country).ddi);syncIdentityButton()});\nE.phoneConfirm.addEventListener("input",function(){this.value=formatPhone(this.value,countryInfo(E.countryConfirm).ddi);syncIdentityButton()});',
  "Eventos do seletor de país"
);

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Seletor de país/DDI adicionado aos dois campos de WhatsApp.");
} else {
  console.log("Seletor de país/DDI já aplicado.");
}
