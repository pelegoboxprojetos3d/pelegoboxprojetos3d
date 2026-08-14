const fs = require('fs');

const file = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
let s = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`${label}: trecho não encontrado`);
  s = s.replace(from, to);
}

function replaceBetween(start, end, value, label) {
  const i = s.indexOf(start);
  const j = s.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error(`${label}: trecho não encontrado`);
  s = s.slice(0, i) + value.trimEnd() + '\n\n' + s.slice(j);
}

if (!s.includes('async function aguardarMembroLogado(')) {
  replaceOnce(
    'async function hidratarClienteMembroSocial(memberEmail) {',
    `async function aguardarMembroLogado(maxWaitMs = 8000) {
  const inicio = Date.now();

  while (Date.now() - inicio < maxWaitMs) {
    try {
      const membro = await currentMember.getMember();
      if (membro?._id) return membro;
    } catch (_) {}

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

async function hidratarClienteMembroSocial(memberEmail) {`,
    'helper de propagação do login'
  );
}

replaceOnce(
  `async function identificarMembroSocial() {
  cancelarPopupAgendado();

  const membro =
    await currentMember.getMember();`,
  `async function identificarMembroSocial(membroConfirmado = null) {
  cancelarPopupAgendado();

  const membro =
    membroConfirmado?._id
      ? membroConfirmado
      : await aguardarMembroLogado(5000);`,
  'identificação com membro confirmado'
);

replaceBetween(
  'async function abrirPopupWhatsapp() {',
  'function salvarAutorizacaoCheckout(',
  `async function abrirPopupWhatsapp() {
  if (
    !paginaLoginSocialAtiva() ||
    popupAberto ||
    !projeto
  ) {
    return;
  }

  cancelarPopupAgendado();
  popupAberto = true;

  let reabrirAposCancelamento = false;

  try {
    let membro = null;

    try {
      membro = await currentMember.getMember();
    } catch (_) {}

    if (!membro?._id) {
      let loginConcluido = false;

      try {
        await authentication.promptLogin({
          mode: "login",
          modal: true
        });
        loginConcluido = true;
      } catch (_) {
        loginConcluido = false;
      }

      if (!loginConcluido) {
        reabrirAposCancelamento = true;
        bloquearSemIdentificacao();
        return;
      }

      /*
        No celular o cookie/sessão do Wix pode levar alguns instantes para
        aparecer em currentMember depois que o login social fecha. Não abrimos
        outro modal nesse intervalo. Esperamos a sessão propagar primeiro.
      */
      membro = await aguardarMembroLogado(10000);

      if (!membro?._id) {
        reabrirAposCancelamento = true;
        bloquearSemIdentificacao();
        return;
      }
    }

    await identificarMembroSocial(membro);

  } catch (error) {
    console.error(
      "Erro no login social:",
      error?.message || error
    );

    reabrirAposCancelamento = true;
    bloquearSemIdentificacao();
  } finally {
    popupAberto = false;

    if (
      reabrirAposCancelamento &&
      !identificado
    ) {
      agendarRetornoLoginSocial();
    }
  }
}`,
  'fluxo principal do login social'
);

replaceBetween(
  'async function solicitarLoginSocial() {',
  'function iniciarDepoisDeRender() {',
  `async function solicitarLoginSocial() {
  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  let loginConcluido = false;

  try {
    await authentication.promptLogin({
      mode: "login",
      modal: true
    });
    loginConcluido = true;
  } catch (_) {
    loginConcluido = false;
  }

  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  if (!loginConcluido) {
    identificado = false;
    bloquearSemIdentificacao();
    agendarRetornoLoginSocial();
    return;
  }

  const membro = await aguardarMembroLogado(10000);

  if (membro?._id) {
    cancelarPopupAgendado();
    await identificarMembroSocial(membro);
    return;
  }

  identificado = false;
  bloquearSemIdentificacao();
  agendarRetornoLoginSocial();
}`,
  'login social auxiliar'
);

if (!s.includes('LOGIN MOBILE: o evento oficial do Wix é a confirmação principal')) {
  replaceOnce(
    `    /*
      Regra da página protegida: se o membro deslogar enquanto estiver aqui,
      não deixamos o checkout social aberto nem reabrimos o modal de login.
      O visitante volta imediatamente para a Home.
    */`,
    `    /*
      LOGIN MOBILE: o evento oficial do Wix é a confirmação principal.
      Isso evita pedir login de novo enquanto currentMember ainda está
      propagando a sessão criada pelo Google/Facebook no navegador móvel.
    */
    try {
      authentication.onLogin(async (memberApi) => {
        cancelarPopupAgendado();
        popupAberto = false;

        let membro = null;

        try {
          membro = await memberApi.getMember();
        } catch (_) {}

        if (!membro?._id) {
          membro = await aguardarMembroLogado(10000);
        }

        if (!membro?._id) return;

        try {
          await identificarMembroSocial(membro);
        } catch (error) {
          console.error(
            "Falha ao consolidar login do membro:",
            error?.message || error
          );
        }
      });
    } catch (error) {
      console.warn(
        "Não foi possível registrar confirmação de login:",
        error?.message || error
      );
    }

    /*
      Regra da página protegida: se o membro deslogar enquanto estiver aqui,
      não deixamos o checkout social aberto nem reabrimos o modal de login.
      O visitante volta imediatamente para a Home.
    */`,
    'evento onLogin'
  );
}

fs.writeFileSync(file, s, 'utf8');
console.log('Loop de login mobile corrigido com espera de propagação e onLogin.');
