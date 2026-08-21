const fs = require("fs");

const FILE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

/*
  PB_LOGIN_PASSIVO_V1

  O rastreamento/monitoramento de membros não pode interferir na sessão Wix.
  Esta correção mantém a página capaz de identificar um membro já autenticado
  e mantém o login por ação explícita do cliente, mas elimina o temporizador
  que abria/reabria o modal sozinho.

  Isso evita o ciclo observado no mobile: o prompt fecha, currentMember ainda
  está propagando a sessão e um novo prompt é disparado como se o cliente
  tivesse saído da conta.
*/

const schedulerRegex = /function agendarRetornoLoginSocial\([\s\S]*?\n}\n\nfunction perfilMembroFrontend/;

if (!code.includes("PB_LOGIN_PASSIVO_V1_APLICADO")) {
  if (!schedulerRegex.test(code)) {
    throw new Error("Agendador automático de login não encontrado no checkout.");
  }

  code = code.replace(
    schedulerRegex,
    `function agendarRetornoLoginSocial() {
  // PB_LOGIN_PASSIVO_V1_APLICADO
  // Nunca abrir/reabrir o login por temporizador. A autenticação só pode
  // começar a partir de uma ação explícita do visitante.
  cancelarPopupAgendado();
}

function perfilMembroFrontend`
  );

  changed = true;
}

/*
  Se o Wix já informa que existe uma sessão, damos tempo para currentMember
  terminar de propagá-la antes de concluir que o visitante não está logado.
  Isso preserva logins existentes principalmente em navegadores móveis.
*/
const sessionOld = `      let membro = null;

      try {
        membro = await currentMember.getMember();
      } catch (_) {}

      if (membro?._id) {
        cancelarPopupAgendado();
        await identificarMembroSocial();
        return;
      }

      identificado = false;
      bloquearSemIdentificacao();

      agendarRetornoLoginSocial(
        MOBILE_LOGIN_AFTER_RENDER_DELAY
      );`;

const sessionNew = `      let membro = null;

      try {
        membro = await currentMember.getMember();
      } catch (_) {}

      if (!membro?._id) {
        try {
          if (authentication.loggedIn()) {
            membro = await aguardarMembroLogado(10000);
          }
        } catch (_) {}
      }

      if (membro?._id) {
        cancelarPopupAgendado();
        await identificarMembroSocial(membro);
        return;
      }

      identificado = false;
      bloquearSemIdentificacao();

      // PB_LOGIN_PASSIVO_V1: não abrir login sozinho ao carregar a página.
      agendarRetornoLoginSocial(
        MOBILE_LOGIN_AFTER_RENDER_DELAY
      );`;

if (!code.includes(sessionNew)) {
  if (!code.includes(sessionOld)) {
    throw new Error("Bloco de conferência da sessão não encontrado no checkout.");
  }

  code = code.replace(sessionOld, sessionNew);
  changed = true;
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Login corrigido: sessão preservada e nenhum prompt automático por temporizador.");
} else {
  console.log("Login passivo já aplicado; nenhuma alteração necessária.");
}
