const fs = require("fs");

const FILE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceRequired(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

function insertBefore(marker, text, label) {
  if (code.includes(text.trim())) return;
  if (!code.includes(marker)) throw new Error(`${label}: âncora não encontrada.`);
  code = code.replace(marker, text + marker);
  changed = true;
}

/*
  REGRA DE LOGIN SOCIAL:
  - nunca abrir fora de /checkoutprojetosprontos;
  - desktop mantém o comportamento atual;
  - no mobile, primeiro renderiza o checkout e só depois abre Google/Facebook.
  Isso evita que o modal apareça visualmente sobre a página anterior durante
  a transição do Wix.
*/

if (!code.includes('const SLUG_LOGIN_SOCIAL =\n  "checkoutprojetosprontos";')) {
  throw new Error("Slug exclusivo do login social não encontrado.");
}

replaceRequired(
`const SLUG_LOGIN_SOCIAL =
  "checkoutprojetosprontos";`,
`const SLUG_LOGIN_SOCIAL =
  "checkoutprojetosprontos";

const MOBILE_LOGIN_AFTER_RENDER_DELAY =
  350;`,
"Atraso de renderização do mobile"
);

replaceRequired(
`async function iniciarPagina() {
  if (!paginaLoginSocialAtiva()) {`,
`async function iniciarPagina({
  identificarSocial = true
} = {}) {
  if (!paginaLoginSocialAtiva()) {`,
"Inicialização parametrizada"
);

replaceRequired(
`  await mostrarProjetoCompleto();

  await identificarMembroSocial();

}`,
`  await mostrarProjetoCompleto();

  if (identificarSocial) {
    await identificarMembroSocial();
  }

}`,
"Identificação somente após renderização quando solicitado"
);

const mobileBoot = `function iniciarMobileDepoisDeRender() {
  iniciarPagina({
    identificarSocial: false
  })
    .then(() => {
      if (
        !paginaLoginSocialAtiva() ||
        identificado ||
        popupAberto ||
        !projeto
      ) {
        return;
      }

      setTimeout(() => {
        if (
          !paginaLoginSocialAtiva() ||
          identificado ||
          popupAberto ||
          !projeto
        ) {
          return;
        }

        abrirPopupWhatsapp()
          .catch(console.error);
      }, MOBILE_LOGIN_AFTER_RENDER_DELAY);
    })
    .catch(
      (error) => {
        console.error(
          "Erro ao preparar checkout mobile:",
          error?.message || error,
          error
        );
      }
    );
}


`;

insertBefore(
`// ======================================================
// ON READY
// ======================================================`,
mobileBoot,
"Boot mobile depois da renderização"
);

replaceRequired(
`    if (
      aplicarBloqueioManutencao()
    ) {
      return;
    }

    iniciarComLoginSocial();`,
`    if (
      aplicarBloqueioManutencao()
    ) {
      return;
    }

    if (
      wixWindowFrontend.formFactor ===
      "Mobile"
    ) {
      iniciarMobileDepoisDeRender();
      return;
    }

    iniciarComLoginSocial();`,
"Separação mobile/desktop no onReady"
);

if (!code.includes("function paginaLoginSocialAtiva()")) {
  throw new Error("Proteção de rota do login social ausente.");
}

if (!code.includes('wixWindowFrontend.formFactor ===\n      "Mobile"')) {
  throw new Error("Regra específica do mobile não foi aplicada.");
}

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Login social mobile agora abre somente depois de /checkoutprojetosprontos renderizar. Desktop preservado.");
} else {
  console.log("Regra mobile de login social já está aplicada.");
}
