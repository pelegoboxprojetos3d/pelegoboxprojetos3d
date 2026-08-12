const fs = require("fs");

const FILE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";

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

if (!code.includes("function agendarRetornoLoginSocial(")) {
  const anchor = `function perfilMembroFrontend(membro = {}) {`;
  const helper = `function agendarRetornoLoginSocial(\n  milliseconds = POPUP_REOPEN_DELAY\n) {\n  cancelarPopupAgendado();\n\n  if (identificado) {\n    return;\n  }\n\n  popupAgendado = setTimeout(\n    () => {\n      popupAgendado = null;\n\n      if (identificado || popupAberto) {\n        return;\n      }\n\n      /*\n        O cancelamento pode ocorrer antes de a consulta do projeto terminar.\n        Os 3 segundos contam a partir do fechamento. Se o projeto ainda não\n        estiver pronto, tentamos novamente em 250 ms, sem mandar o visitante\n        para outra página.\n      */\n      if (!projeto) {\n        agendarRetornoLoginSocial(250);\n        return;\n      }\n\n      abrirPopupWhatsapp()\n        .catch(console.error);\n    },\n    milliseconds\n  );\n}\n\n`;
  if (!code.includes(anchor)) fail("Helper de reabertura: âncora não encontrada.");
  code = code.replace(anchor, helper + anchor);
  changed = true;
}

replaceExact(
`async function abrirPopupWhatsapp() {\n  if (\n    popupAberto ||\n    !projeto\n  ) {\n    return;\n  }\n\n  cancelarPopupAgendado();\n\n  popupAberto =\n    true;\n\n  try {`,
`async function abrirPopupWhatsapp() {\n  if (\n    popupAberto ||\n    !projeto\n  ) {\n    return;\n  }\n\n  cancelarPopupAgendado();\n\n  popupAberto =\n    true;\n\n  let reabrirAposCancelamento =\n    false;\n\n  try {`,
"Marcar cancelamento no popup social"
);

replaceExact(
`  } catch (error) {\n    console.error(\n      "Erro no login social:",\n      error?.message || error\n    );\n\n    bloquearSemIdentificacao();\n  } finally {\n    popupAberto =\n      false;\n  }\n}`,
`  } catch (error) {\n    console.error(\n      "Erro no login social:",\n      error?.message || error\n    );\n\n    reabrirAposCancelamento =\n      true;\n\n    bloquearSemIdentificacao();\n  } finally {\n    popupAberto =\n      false;\n\n    if (\n      reabrirAposCancelamento &&\n      !identificado\n    ) {\n      agendarRetornoLoginSocial();\n    }\n  }\n}`,
"Reabrir login após cancelar tentativa"
);

replaceExact(
`    .catch(\n      () => {\n        /*\n          Fechar o login social no X ou clicar fora NÃO tira o visitante\n          da página do projeto. Carregamos a página normalmente, mantendo\n          valores e compras bloqueados até ele tentar fazer login novamente.\n        */\n        iniciarPaginaComTratamento();\n      }\n    );`,
`    .catch(\n      () => {\n        /*\n          Fechar no X ou clicar fora mantém o visitante nesta página e\n          reabre o login automaticamente após 3 segundos.\n        */\n        iniciarPaginaComTratamento();\n        agendarRetornoLoginSocial();\n      }\n    );`,
"Reabrir login inicial em 3 segundos"
);

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Login social configurado para reabrir 3s após X/clique fora em /checkoutprojetosprontos.");
} else {
  console.log("Reabertura do login social em 3s já está aplicada.");
}
