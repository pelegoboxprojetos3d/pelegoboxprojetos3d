const fs = require("fs");

const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const CHECKOUT = "src/pages/checkout-projeto-pronto.i9aj1.js";
const CUSTOM = "src/public/custom-elements/pelego-checkout-pronto.js";

function fail(message) {
  throw new Error(message);
}

function replaceSection(text, startMarker, endMarker, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) fail(`${label}: início não encontrado.`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) fail(`${label}: fim não encontrado.`);
  return text.slice(0, start) + replacement.trimEnd() + "\n\n" + text.slice(end);
}

function replaceExact(text, from, to, label) {
  if (text.includes(to)) return text;
  if (!text.includes(from)) fail(`${label}: trecho não encontrado.`);
  return text.replace(from, to);
}

function patchPage() {
  let code = fs.readFileSync(PAGE, "utf8");

  if (!code.includes('from "wix-members-frontend"')) {
    code = replaceExact(
      code,
      'import wixWindowFrontend from "wix-window-frontend";\n',
      'import wixWindowFrontend from "wix-window-frontend";\nimport { authentication, currentMember } from "wix-members-frontend";\n',
      "Import social frontend"
    );
  }

  if (!code.includes("buscarClienteDoMembroAtual")) {
    code = replaceExact(
      code,
      'import {\n  buscarCliente\n} from "backend/clientes.web";',
      'import {\n  buscarCliente,\n  buscarClienteDoMembroAtual\n} from "backend/clientes.web";',
      "Import do cliente social"
    );
  }

  const social = `function perfilMembroFrontend(membro = {}) {
  const emails =
    Array.isArray(membro?.contactDetails?.emails)
      ? membro.contactDetails.emails
      : [];

  const memberId =
    safe(membro?._id);

  const memberEmail =
    normalizeEmail(
      membro?.loginEmail ||
      emails[0] ||
      membro?.contactDetails?.email
    );

  const memberName =
    safe(
      membro?.profile?.nickname ||
      [
        membro?.contactDetails?.firstName,
        membro?.contactDetails?.lastName
      ]
        .filter(Boolean)
        .join(" ")
    ).replace(/\\s+/g, " ");

  return {
    memberId,
    memberEmail,
    memberName
  };
}

async function hidratarClienteMembroSocial(memberEmail) {
  try {
    const perfil =
      await comTimeout(
        buscarClienteDoMembroAtual(),
        7000,
        "A identificação do membro Wix não respondeu."
      );

    const emailSeguro =
      normalizeEmail(
        perfil?.email ||
        memberEmail
      );

    if (!emailSeguro) {
      return;
    }

    const cliente =
      perfil?.cliente &&
      typeof perfil.cliente === "object"
        ? perfil.cliente
        : null;

    if (!cliente) {
      identificacao = {
        ...identificacao,
        nome:
          firstValue(
            identificacao.nome,
            perfil?.nome
          ),
        email:
          emailSeguro
      };

      salvarIdentificacao();
      return;
    }

    const telefone =
      normalizarTelefone({
        whatsapp:
          cliente.whatsappNacional ||
          cliente.whatsapp,
        whatsappE164:
          cliente.whatsappE164 ||
          cliente.whatsapp,
        ddi: "55",
        country: "br"
      });

    /*
      Encontrar o cadastro pelo e-mail social NÃO significa que os dados já
      foram conferidos neste navegador. Preservamos a confirmação anterior
      somente quando ela já existia no próprio navegador.
    */
    const jaConfirmadoAqui =
      identificacao.whatsappConfirmado === true;

    identificacao = {
      ...identificacao,
      whatsapp:
        telefone.whatsapp ||
        identificacao.whatsapp,
      whatsappE164:
        telefone.whatsappE164 ||
        identificacao.whatsappE164,
      ddi: "55",
      country: "br",
      countryName: "Brasil",
      clienteId:
        firstValue(
          cliente._id,
          cliente.clienteId,
          identificacao.clienteId
        ),
      nome:
        firstValue(
          cliente.nome,
          identificacao.nome,
          perfil?.nome
        ),
      email:
        emailSeguro,
      cpfCnpj:
        onlyDigits(
          cliente.cpfCnpj ||
          cliente.cpf ||
          identificacao.cpfCnpj
        ),
      whatsappConfirmado:
        jaConfirmadoAqui,
      confirmacaoWhatsappVersao:
        jaConfirmadoAqui
          ? Number(
              identificacao.confirmacaoWhatsappVersao ||
              CONFIRMACAO_FLUXO_VERSAO
            )
          : 0,
      confirmadoEm:
        jaConfirmadoAqui
          ? safe(identificacao.confirmadoEm)
          : ""
    };

    clienteAtual =
      cliente;

    if (
      identificacao.clienteId
    ) {
      try {
        const resultado =
          await comTimeout(
            obterAcessosProjeto({
              codigoProjeto:
                codigoPublico(projeto),
              clienteId:
                identificacao.clienteId,
              email:
                identificacao.email,
              whatsapp:
                onlyDigits(
                  identificacao.whatsappE164
                )
            }),
            7000,
            "A consulta das compras não respondeu."
          );

        if (
          resultado?.ok &&
          resultado?.access
        ) {
          acessos = {
            medidas:
              resultado.access.medidas === true,
            graficos:
              resultado.access.graficos === true,
            projeto:
              resultado.access.projeto === true
          };

          capturarDownloads(
            resultado
          );

          salvarAcessosLocais(
            codigoPublico(projeto),
            acessos
          );
        }
      } catch (error) {
        console.warn(
          "Falha ao carregar compras do membro Wix:",
          error?.message || error
        );
      }
    }

    salvarIdentificacao();
    await mostrarValoresEAcessos();

  } catch (error) {
    console.warn(
      "Hidratação social em segundo plano falhou:",
      error?.message || error
    );
  }
}

async function identificarMembroSocial() {
  cancelarPopupAgendado();

  const membro =
    await currentMember.getMember();

  const {
    memberId,
    memberEmail,
    memberName
  } = perfilMembroFrontend(
    membro
  );

  if (!memberId || !memberEmail) {
    identificado = false;
    bloquearSemIdentificacao();
    throw new Error(
      "Não foi possível identificar o membro Wix autenticado."
    );
  }

  const salva =
    lerIdentificacaoSalva();

  const mesmoMembro =
    Boolean(
      salva &&
      normalizeEmail(salva.email) ===
        memberEmail
    );

  const telefoneSalvo =
    mesmoMembro
      ? normalizarTelefone(salva)
      : {
          whatsapp: "",
          whatsappE164: "",
          ddi: "55",
          country: "br"
        };

  identificacao = {
    whatsapp:
      telefoneSalvo.whatsapp,
    whatsappE164:
      telefoneSalvo.whatsappE164,
    ddi: "55",
    country: "br",
    countryName: "Brasil",
    clienteId:
      mesmoMembro
        ? safe(salva.clienteId)
        : "",
    nome:
      firstValue(
        mesmoMembro
          ? salva.nome
          : "",
        memberName
      ),
    email:
      memberEmail,
    cpfCnpj:
      mesmoMembro
        ? onlyDigits(
            salva.cpfCnpj ||
            salva.cpf
          )
        : "",
    whatsappConfirmado:
      mesmoMembro &&
      salva.whatsappConfirmado === true,
    confirmacaoWhatsappVersao:
      mesmoMembro &&
      salva.whatsappConfirmado === true
        ? Number(
            salva.confirmacaoWhatsappVersao ||
            CONFIRMACAO_FLUXO_VERSAO
          )
        : 0,
    confirmadoEm:
      mesmoMembro &&
      salva.whatsappConfirmado === true
        ? safe(salva.confirmadoEm)
        : ""
  };

  clienteAtual =
    null;

  identificado =
    true;

  consultaConcluida =
    true;

  const acessosLocais =
    mesmoMembro
      ? lerAcessosLocais(
          codigoPublico(projeto)
        )
      : null;

  acessos =
    acessosLocais || {
      medidas: false,
      graficos: false,
      projeto: false
    };

  downloads = {
    medidas: "",
    graficos: "",
    projeto: ""
  };

  salvarIdentificacao();

  /*
    REGRA DE PERFORMANCE:
    login Google/Facebook confirmado libera valores e o primeiro botão agora.
    A coleção de clientes e as compras são consultadas depois, sem prender a UI.
  */
  await mostrarValoresEAcessos();

  hidratarClienteMembroSocial(
    memberEmail
  ).catch(console.error);
}
`;

  code = replaceSection(
    code,
    "async function identificarMembroSocial() {",
    "async function identificarCliente(\n  data = {}\n) {",
    social,
    "Fluxo social rápido"
  );

  fs.writeFileSync(PAGE, code, "utf8");
}

function patchCheckout() {
  let code = fs.readFileSync(CHECKOUT, "utf8");

  code = replaceExact(
    code,
    'import { criarCliente, buscarClienteCadastrado } from "backend/clientes.web";',
    'import { criarCliente, buscarClienteCadastrado, buscarClienteDoMembroAtual } from "backend/clientes.web";',
    "Import social no checkout"
  );

  if (!code.includes('const SOCIAL_CONFIRM_KEY = "pp_social_dados_confirmados_v1";')) {
    code = replaceExact(
      code,
      'const CHECKOUT_AUTH_KEY = "pp_checkout_autorizado";\n',
      'const CHECKOUT_AUTH_KEY = "pp_checkout_autorizado";\nconst SOCIAL_CONFIRM_KEY = "pp_social_dados_confirmados_v1";\n',
      "Chave de confirmação social"
    );
  }

  const socialHelpers = `function socialDataConfirmed(mail) {
  const target = email(mail);
  if (!target) return false;

  for (const store of [session, local]) {
    try {
      const raw = store.getItem(SOCIAL_CONFIRM_KEY);
      if (!raw) continue;
      const marker = JSON.parse(raw);
      if (
        marker?.ok === true &&
        email(marker.email) === target
      ) {
        return true;
      }
    } catch (_) {}
  }

  return false;
}

function markSocialDataConfirmed(mail) {
  const target = email(mail);
  if (!target) return;

  const raw = JSON.stringify({
    ok: true,
    email: target,
    confirmedAt: Date.now()
  });

  try { session.setItem(SOCIAL_CONFIRM_KEY, raw); } catch (_) {}
  try { local.setItem(SOCIAL_CONFIRM_KEY, raw); } catch (_) {}
}
`;

  if (!code.includes("function socialDataConfirmed(mail)")) {
    code = replaceSection(
      code,
      "function mediaSource(value) {",
      "function contextFromUrl() {",
      socialHelpers + "\nfunction mediaSource(value) {\n  if (!value) return \"\";\n  if (typeof value === \"string\") return value.trim();\n  if (typeof value === \"object\") {\n    return safe(value.src || value.url || value.fileUrl || value.mediaUrl || value.image);\n  }\n  return \"\";\n}\n",
      "Helpers de confirmação social"
    );
  }

  code = code.replace(
    /skipIdentity:\s*Boolean\(handoff\) \|\| verifiedSession,/,
    'skipIdentity:(Boolean(handoff) || verifiedSession) && socialDataConfirmed(email(source.email)),'
  );

  code = code.replace(
    '  ctx.skipIdentity = alreadyVerifiedThisSession || ctx.skipIdentity === true;',
    '  ctx.skipIdentity = (alreadyVerifiedThisSession || ctx.skipIdentity === true) && socialDataConfirmed(ctx.email);'
  );

  code = code.replace(
    '    ctx.skipIdentity = true;\n    markSessionIdentityVerified(ctx);',
    '    ctx.skipIdentity = socialDataConfirmed(cadastroBackend.email);\n    markSessionIdentityVerified(ctx);'
  );

  code = code.replace(
    '    requiredFields:{name:true,email:true,cpfCnpj:true},',
    '    requiredFields:{name:true,email:false,cpfCnpj:true,whatsapp:true},'
  );

  const saveCustomer = `async function saveCustomer(data={}) {
  if (busy) return;

  const n =
    phone(
      data.whatsappE164 ||
      data.whatsapp ||
      ctx.whatsappE164 ||
      ctx.whatsapp
    );

  const name =
    safe(
      data.nome ||
      data.nomeCliente ||
      ctx.nome
    ).replace(/\\s+/g, " ");

  const document =
    cpf(
      data.cpfCnpj ||
      data.cpf ||
      ctx.cpfCnpj
    );

  if (!n) {
    return post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:"WhatsApp inválido."
    });
  }

  if (name.length < 3) {
    return post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:"Informe seu nome completo."
    });
  }

  if (!validCpf(document)) {
    return post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:"Informe um CPF válido."
    });
  }

  busy = true;

  try {
    /*
      O e-mail NÃO vem do campo do HTML. Ele é relido do membro Wix autenticado,
      portanto o usuário não consegue trocar o destino da compra no formulário.
    */
    const perfil =
      await waitTimeout(
        buscarClienteDoMembroAtual(),
        7000,
        "Não foi possível confirmar sua conta Wix."
      );

    const mail =
      email(
        perfil?.email ||
        ctx.email
      );

    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(mail)) {
      throw new Error(
        "Não foi possível obter o e-mail autenticado da sua conta."
      );
    }

    customer =
      await waitTimeout(
        criarCliente({
          whatsapp:
            \`+55\${n}\`,
          nome:
            name,
          email:
            mail,
          cpfCnpj:
            document,
          origem:
            "CHECKOUT_PROJETOS_PRONTOS_SOCIAL"
        }),
        8000,
        "O cadastro demorou para responder."
      );

    if (!customer) {
      throw new Error(
        "Não foi possível salvar o cadastro."
      );
    }

    const id =
      safe(
        customer._id ||
        customer.clienteId
      );

    saveIdentity({
      clienteId: id,
      nome:
        safe(
          customer.nome ||
          name
        ),
      email:
        mail,
      cpfCnpj:
        cpf(
          customer.cpfCnpj ||
          document
        ),
      whatsapp: n,
      whatsappE164:
        \`+55\${n}\`,
      whatsappConfirmado: true,
      confirmacaoWhatsappVersao: 5,
      confirmadoEm:
        new Date().toISOString()
    });

    markSessionIdentityVerified(ctx);
    markSocialDataConfirmed(mail);

    try {
      const a =
        await waitTimeout(
          obterAcessosProjeto({
            codigoProjeto:
              ctx.codigoProjeto,
            clienteId:
              id,
            email:
              mail,
            whatsapp:
              n
          }),
          3500,
          ""
        );

      const access =
        a?.access || {};

      const bought =
        ctx.tipoProduto === "GRAFICOS"
          ? access.graficos === true
          : ctx.tipoProduto === "PROJETO_COMPLETO"
            ? access.projeto === true
            : access.medidas === true;

      if (bought) {
        post({
          type:"ALREADY_PURCHASED",
          ok:true,
          tipoProduto:ctx.tipoProduto,
          access
        });
        return;
      }
    } catch (_) {}

    avisarDadosSalvos({
      ok:true,
      exists:true,
      clienteId:id,
      nome:ctx.nome,
      email:mail,
      cpfCnpj:ctx.cpfCnpj,
      whatsapp:ctx.whatsapp,
      whatsappE164:ctx.whatsappE164,
      autoPayment:false
    });

  } catch (e) {
    console.error(
      "saveCustomer:",
      e?.message || e
    );

    post({
      type:"CUSTOMER_RESULT",
      ok:false,
      error:
        e?.message ||
        "Não foi possível salvar os dados."
    });

  } finally {
    busy = false;
  }
}
`;

  code = replaceSection(
    code,
    "async function saveCustomer(data={}) {",
    "function stopPoll() {",
    saveCustomer,
    "Salvar dados com e-mail social"
  );

  fs.writeFileSync(CHECKOUT, code, "utf8");
}

function patchCustom() {
  let code = fs.readFileSync(CUSTOM, "utf8");

  const oldHeader = `<div class="panelHeader">
          <h2>Complete seus dados</h2>
          <p>Confira seu WhatsApp e complete os dados antes de escolher a forma de pagamento.</p>
        </div>`;

  const newHeader = `<div class="panelHeader">
          <h2>Confira seus dados</h2>
          <p>Seu e-mail já vem da conta Google/Facebook. Confira nome, WhatsApp e CPF uma única vez neste navegador.</p>
        </div>`;

  if (code.includes(oldHeader)) {
    code = code.replace(oldHeader, newHeader);
  }

  const oldEmail = `<div>
            <label class="label">Seu melhor e-mail <span class="required">*</span></label>
            <input id="emailInput" class="control" type="email" autocomplete="email" maxlength="254" placeholder="Ex: nome@email.com">
          </div>
          <div>
            <label class="label">Confirme seu e-mail <span class="required">*</span></label>
            <input id="emailConfirmInput" class="control" type="email" autocomplete="off" maxlength="254" placeholder="Digite o mesmo e-mail novamente">
          </div>
          <div class="emailNotice fieldFull">Confira com atenção. Esse e-mail será usado para identificar sua compra e enviar o acesso ao produto.</div>`;

  const newEmail = `<div class="fieldFull">
            <label class="label">E-mail da sua conta</label>
            <input id="emailInput" class="control" type="email" autocomplete="email" maxlength="254" readonly aria-readonly="true">
            <input id="emailConfirmInput" type="hidden">
            <p class="hint">Esse e-mail vem do seu login Google/Facebook e não pode ser alterado aqui.</p>
          </div>`;

  code = replaceExact(
    code,
    oldEmail,
    newEmail,
    "E-mail social travado"
  );

  const oldReady = `function identityFieldsReady(){
 var p=phoneLocal(E.phone.value),n=safe(E.name.value).replace(/\\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value),b=email(E.email2.value);
 return Boolean(p && n.length>=3 && validCpf(c) && validEmail(a) && validEmail(b) && a===b)
}`;

  const newReady = `function identityFieldsReady(){
 var p=phoneLocal(E.phone.value),n=safe(E.name.value).replace(/\\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value);
 return Boolean(p && n.length>=3 && validCpf(c) && validEmail(a))
}`;

  code = replaceExact(
    code,
    oldReady,
    newReady,
    "Validação sem confirmação de e-mail"
  );

  const oldValidate = `function validateIdentity(){
 var p=phoneLocal(E.phone.value),n=safe(E.name.value).replace(/\\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value),b=email(E.email2.value);
 if(!p){setAlert(E.identityAlert,"error","Informe um WhatsApp válido com DDD.");E.phone.focus();return false}
 if(n.length<3){setAlert(E.identityAlert,"error","Informe seu nome completo.");E.name.focus();return false}
 if(!validCpf(c)){setAlert(E.identityAlert,"error","Informe um CPF válido.");E.cpf.focus();return false}
 if(!validEmail(a)){setAlert(E.identityAlert,"error","Informe um e-mail válido.");E.email.focus();return false}
 if(!validEmail(b)||a!==b){setAlert(E.identityAlert,"error","Os e-mails não coincidem. Confira os dois campos.");E.email2.focus();return false}
 return true
}`;

  const newValidate = `function validateIdentity(){
 var p=phoneLocal(E.phone.value),n=safe(E.name.value).replace(/\\s+/g," "),c=cpf(E.cpf.value),a=email(E.email.value);
 if(!p){setAlert(E.identityAlert,"error","Informe um WhatsApp válido com DDD.");E.phone.focus();return false}
 if(n.length<3){setAlert(E.identityAlert,"error","Informe seu nome completo.");E.name.focus();return false}
 if(!validCpf(c)){setAlert(E.identityAlert,"error","Informe um CPF válido.");E.cpf.focus();return false}
 if(!validEmail(a)){setAlert(E.identityAlert,"error","Não foi possível carregar o e-mail da sua conta Google/Facebook.");return false}
 return true
}`;

  code = replaceExact(
    code,
    oldValidate,
    newValidate,
    "Validação do e-mail social"
  );

  code = code.replace(
    'post({type:"READY",version:"HTML35_PERSISTENT_FAST_RETURN"});',
    'post({type:"READY",version:"HTML36_SOCIAL_MINIMAL_DATA"});'
  );

  fs.writeFileSync(CUSTOM, code, "utf8");
}

patchPage();
patchCheckout();
patchCustom();
console.log("Login social V2 aplicado: liberação imediata, e-mail travado e confirmação mínima por navegador.");
