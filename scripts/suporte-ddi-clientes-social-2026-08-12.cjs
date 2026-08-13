const fs = require("fs");

const PAGE = "src/pages/checkout-projeto-pronto.i9aj1.js";
const CLIENTS = "src/backend/clientes.js";
const CLIENTS_WEB = "src/backend/clientes.web.js";
const MAIN = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";

function update(file, fn) {
  let code = fs.readFileSync(file, "utf8");
  const before = code;
  code = fn(code);
  if (code !== before) {
    fs.writeFileSync(file, code, "utf8");
    console.log(`Atualizado: ${file}`);
  } else {
    console.log(`Sem alteração: ${file}`);
  }
}

function must(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

update(PAGE, code => {
  code = must(
    code,
`function phone(v) {
  let n = digits(v);
  if (n.startsWith("55") && (n.length === 12 || n.length === 13)) n = n.slice(2);
  return n.length === 10 || n.length === 11 ? n : "";
}`,
`function phone(v, ddi = "55") {
  let n = digits(v);
  const d = digits(ddi) || "55";
  if (d && n.startsWith(d) && n.length > d.length + 5) n = n.slice(d.length);
  return n.length >= 6 && n.length <= 15 ? n : "";
}

function phoneE164(v, ddi = "55") {
  const d = digits(ddi) || "55";
  const n = phone(v, d);
  return n ? "+" + d + n : "";
}`,
    "Helper de telefone internacional"
  );

  code = code.replace(
    'phone(value?.whatsappE164 || value?.whatsapp) &&',
    'phone(value?.whatsappE164 || value?.whatsapp, value?.ddi || "55") &&'
  );

  code = must(
    code,
`      cpfCnpj: cpf(marker.cpfCnpj || marker.cpf),
      whatsapp: phone(marker.whatsappE164 || marker.whatsapp),
      whatsappE164: "",
      whatsappConfirmado: marker.whatsappConfirmado === true
    };

    if (snapshot.whatsapp) snapshot.whatsappE164 = "+55" + snapshot.whatsapp;`,
`      cpfCnpj: cpf(marker.cpfCnpj || marker.cpf),
      ddi: digits(marker.ddi || "55") || "55",
      country: safe(marker.country || "br").toLowerCase(),
      whatsapp: phone(marker.whatsappE164 || marker.whatsapp, marker.ddi || "55"),
      whatsappE164: "",
      whatsappConfirmado: marker.whatsappConfirmado === true
    };

    if (snapshot.whatsapp) snapshot.whatsappE164 = phoneE164(snapshot.whatsapp, snapshot.ddi);`,
    "Handoff com DDI"
  );

  code = code.replace(
    'const n = phone(value?.whatsappE164 || value?.whatsapp);',
    'const n = phone(value?.whatsappE164 || value?.whatsapp, value?.ddi || "55");'
  );
  code = code.replace(
    'if (marker?.ok === true && phone(marker.whatsapp) === n) return true;',
    'if (marker?.ok === true && phone(marker.whatsapp, marker.ddi || value?.ddi || "55") === n) return true;'
  );

  code = must(
    code,
`        whatsapp:n,
        clienteId:safe(value?.clienteId),
        verifiedAt:Date.now()`,
`        whatsapp:n,
        ddi:digits(value?.ddi || "55") || "55",
        clienteId:safe(value?.clienteId),
        verifiedAt:Date.now()`,
    "Sessão verificada com DDI"
  );

  code = code.replace(
    'const n = phone(ctx.whatsappE164 || ctx.whatsapp);',
    'const n = phone(ctx.whatsappE164 || ctx.whatsapp, ctx.ddi || "55");'
  );
  code = code.replace(
    'const found = await waitTimeout(buscarClienteCadastrado(n), 3500, "");',
    'const found = await waitTimeout(buscarClienteCadastrado(phoneE164(n, ctx.ddi || "55")), 3500, "");'
  );
  code = code.replace(/whatsappE164:`\+55\$\{n\}`/g, 'whatsappE164:phoneE164(n, ctx.ddi || "55")');

  code = must(
    code,
`function saveIdentity(patch) {
  const next = { ...savedIdentity(), ...patch };
  const n = phone(next.whatsappE164 || next.whatsapp);
  if (n) {
    next.whatsapp=n; next.whatsappE164=\`+55\${n}\`; next.ddi="55"; next.country="br";
  }`,
`function saveIdentity(patch) {
  const next = { ...savedIdentity(), ...patch };
  const ddi = digits(next.ddi || "55") || "55";
  const n = phone(next.whatsappE164 || next.whatsapp, ddi);
  if (n) {
    next.whatsapp=n;
    next.whatsappE164=phoneE164(n, ddi);
    next.ddi=ddi;
    next.country=safe(next.country || "br").toLowerCase();
  }`,
    "Persistência do DDI"
  );

  code = must(
    code,
`  const verifiedSession=sessionIdentityVerified(source);
  const number=phone(source.whatsappE164 || source.whatsapp);
  const product=`,
`  const verifiedSession=sessionIdentityVerified(source);
  const sourceDdi=digits(source.ddi || "55") || "55";
  const sourceCountry=safe(source.country || "br").toLowerCase();
  const number=phone(source.whatsappE164 || source.whatsapp, sourceDdi);
  const product=`,
    "Contexto com DDI"
  );
  code = must(
    code,
`    whatsapp:number,
    whatsappE164:number ? \`+55\${number}\` : "",
    ddi:"55", country:"br",`,
`    whatsapp:number,
    whatsappE164:number ? phoneE164(number, sourceDdi) : "",
    ddi:sourceDdi, country:sourceCountry,`,
    "Contexto do checkout com DDI"
  );

  code = must(
    code,
`function basePayload(data={}) {
  const n=phone(data.whatsappE164 || data.whatsapp || ctx.whatsappE164 || ctx.whatsapp);
  return {`,
`function basePayload(data={}) {
  const ddi=digits(data.ddi || ctx.ddi || "55") || "55";
  const country=safe(data.country || ctx.country || "br").toLowerCase();
  const n=phone(data.whatsappE164 || data.whatsapp || ctx.whatsappE164 || ctx.whatsapp, ddi);
  return {`,
    "Base payload com DDI"
  );
  code = must(
    code,
`    whatsapp:n,
    whatsappE164:n ? \`+55\${n}\` : "",
    ddi:"55", country:"br",`,
`    whatsapp:n,
    whatsappE164:n ? phoneE164(n, ddi) : "",
    ddi, country,`,
    "Payload de pagamento com DDI"
  );

  code = must(
    code,
`  const n =
    phone(
      data.whatsappE164 ||
      data.whatsapp ||
      ctx.whatsappE164 ||
      ctx.whatsapp
    );`,
`  const ddi = digits(data.ddi || ctx.ddi || "55") || "55";
  const country = safe(data.country || ctx.country || "br").toLowerCase();
  const n =
    phone(
      data.whatsappE164 ||
      data.whatsapp ||
      ctx.whatsappE164 ||
      ctx.whatsapp,
      ddi
    );`,
    "Salvar cliente com DDI"
  );

  code = must(
    code,
`        criarCliente({
          whatsapp:
            \`+55\${n}\`,
          nome:`,
`        criarCliente({
          whatsapp:
            phoneE164(n, ddi),
          ddi,
          country,
          nome:`,
    "Cadastro com telefone E164"
  );

  code = must(
    code,
`      whatsapp: n,
      whatsappE164:
        \`+55\${n}\`,
      whatsappConfirmado: true,`,
`      whatsapp: n,
      whatsappE164:
        phoneE164(n, ddi),
      ddi,
      country,
      whatsappConfirmado: true,`,
    "Identidade salva com DDI"
  );

  code = code.replace(
    'whatsapp:\n              n',
    'whatsapp:\n              digits(phoneE164(n, ddi))'
  );

  return code;
});

update(CLIENTS, code => {
  code = must(
    code,
`export function normalizarWhatsapp(numero) {
  let numeros = somenteNumeros(numero);

  if (
    numeros.startsWith(DDI_BRASIL) &&
    (
      numeros.length === 12 ||
      numeros.length === 13
    )
  ) {
    numeros = numeros.slice(2);
  }

  if (
    numeros.length !== 10 &&
    numeros.length !== 11
  ) {
    return "";
  }

  return \`+\${DDI_BRASIL}\${numeros}\`;
}`,
`export function normalizarWhatsapp(numero) {
  const original = texto(numero);
  let numeros = somenteNumeros(original);

  if (!numeros) return "";

  // E164 explícito: preserva qualquer DDI válido.
  if (original.startsWith("+") && numeros.length >= 7 && numeros.length <= 15) {
    return \`+\${numeros}\`;
  }

  // Compatibilidade com o Brasil legado.
  if (numeros.startsWith(DDI_BRASIL) && (numeros.length === 12 || numeros.length === 13)) {
    return \`+\${numeros}\`;
  }
  if (numeros.length === 10 || numeros.length === 11) {
    return \`+\${DDI_BRASIL}\${numeros}\`;
  }

  // Número internacional sem o sinal +, já contendo DDI.
  if (numeros.length >= 7 && numeros.length <= 15) {
    return \`+\${numeros}\`;
  }

  return "";
}`,
    "Normalização E164 internacional"
  );
  return code;
});

update(CLIENTS_WEB, code => {
  // O web method já recebe whatsapp completo. Não adicionamos campos novos à coleção;
  // o DDI fica preservado dentro do próprio E164 salvo em whatsapp.
  return code;
});

update(MAIN, code => {
  // Leva DDI/país no handoff para o checkout transparente.
  const needle = `        whatsappE164:\n          telefone.whatsappE164,\n\n        whatsappConfirmado:`;
  const replacement = `        whatsappE164:\n          telefone.whatsappE164,\n\n        ddi:\n          telefone.ddi,\n\n        country:\n          telefone.country,\n\n        whatsappConfirmado:`;
  code = must(code, needle, replacement, "Handoff principal com DDI");
  return code;
});
