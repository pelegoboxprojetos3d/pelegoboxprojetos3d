const fs = require("fs");

const FILE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceOnce(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

replaceOnce(
`const PAGINA_MANUTENCAO =
  "/projetos-prontos-manutencao";`,
`const PAGINA_MANUTENCAO =
  "/projetos-prontos-manutencao";

const SLUG_LOGIN_SOCIAL =
  "checkoutprojetosprontos";`,
"Constante do slug exclusivo"
);

if (!code.includes("function paginaLoginSocialAtiva()")) {
  const marker = `function safe(value) {
  return String(
    value ?? ""
  ).trim();
}
`;

  const helper = `function safe(value) {
  return String(
    value ?? ""
  ).trim();
}

function paginaLoginSocialAtiva() {
  return (
    safe(
      wixLocation.path?.[0]
    ).toLowerCase() ===
    SLUG_LOGIN_SOCIAL
  );
}
`;

  if (!code.includes(marker)) throw new Error("Helper safe não encontrado.");
  code = code.replace(marker, helper);
  changed = true;
}

replaceOnce(
`  if (
    identificado ||
    popupAberto ||
    !projeto
  ) {`,
`  if (
    !paginaLoginSocialAtiva() ||
    identificado ||
    popupAberto ||
    !projeto
  ) {`,
"Guarda do reagendamento antigo"
);

replaceOnce(
`  if (identificado) {
    return;
  }

  popupAgendado = setTimeout(`,
`  if (
    !paginaLoginSocialAtiva() ||
    identificado
  ) {
    return;
  }

  popupAgendado = setTimeout(`,
"Guarda do retorno social"
);

replaceOnce(
`      if (identificado || popupAberto) {
        return;
      }
`,
`      if (
        !paginaLoginSocialAtiva() ||
        identificado ||
        popupAberto
      ) {
        return;
      }
`,
"Guarda interna do timer social"
);

replaceOnce(
`async function abrirPopupWhatsapp() {
  if (
    popupAberto ||
    !projeto
  ) {`,
`async function abrirPopupWhatsapp() {
  if (
    !paginaLoginSocialAtiva() ||
    popupAberto ||
    !projeto
  ) {`,
"Guarda ao abrir login"
);

replaceOnce(
`async function iniciarPagina() {
  /*`,
`async function iniciarPagina() {
  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  /*`,
"Guarda no início da página"
);

replaceOnce(
`async function solicitarLoginSocial() {
  try {`,
`async function solicitarLoginSocial() {
  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  try {`,
"Guarda antes do promptLogin"
);

replaceOnce(
`  let membro = null;
  try {
    membro = await currentMember.getMember();`,
`  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  let membro = null;
  try {
    membro = await currentMember.getMember();`,
"Guarda após fechamento do modal"
);

replaceOnce(
`function iniciarComLoginSocial() {
  currentMember`,
`function iniciarComLoginSocial() {
  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  currentMember`,
"Guarda do boot social"
);

replaceOnce(
`$w.onReady(
  function () {
    if (
      aplicarBloqueioManutencao()
    ) {
      return;
    }

    iniciarComLoginSocial();
  }
);`,
`$w.onReady(
  function () {
    if (!paginaLoginSocialAtiva()) {
      cancelarPopupAgendado();
      return;
    }

    if (
      aplicarBloqueioManutencao()
    ) {
      return;
    }

    iniciarComLoginSocial();
  }
);`,
"Guarda final do onReady"
);

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Login social limitado exclusivamente a /checkoutprojetosprontos.");
} else {
  console.log("Login social já está limitado ao slug correto.");
}
