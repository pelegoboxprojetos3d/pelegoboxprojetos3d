const fs = require("fs");
const FILE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let code = fs.readFileSync(FILE, "utf8");
let changed = false;

function replaceExact(from, to, label) {
  if (code.includes(to)) return;
  if (!code.includes(from)) throw new Error(`${label}: trecho não encontrado.`);
  code = code.replace(from, to);
  changed = true;
}

// O Wix pode resolver promptLogin() mesmo quando o visitante fecha no X.
// Por isso, depois do fechamento, sempre conferimos currentMember antes de
// considerar o login concluído. Sem membro, agenda nova abertura em 3s.
replaceExact(
`function solicitarLoginSocial() {
  authentication
    .promptLogin({
      mode: "login",
      modal: true
    })
    .then(
      () => {
        iniciarPaginaComTratamento();
      }
    )
    .catch(
      () => {
        /*
          Fechar no X ou clicar fora mantém o visitante nesta página e
          reabre o login automaticamente após 3 segundos.
        */
        iniciarPaginaComTratamento();
        agendarRetornoLoginSocial();
      }
    );
}`,
`async function solicitarLoginSocial() {
  try {
    await authentication.promptLogin({
      mode: "login",
      modal: true
    });
  } catch (_) {
    // Cancelar o modal não muda de página.
  }

  let membro = null;
  try {
    membro = await currentMember.getMember();
  } catch (_) {}

  if (membro?._id) {
    iniciarPaginaComTratamento();
    return;
  }

  identificado = false;
  bloquearSemIdentificacao();
  agendarRetornoLoginSocial();
}`,
"Login inicial robusto"
);

// Também valida o membro após promptLogin() quando o modal é aberto por clique.
replaceExact(
`    if (!membro?._id) {
      await authentication
        .promptLogin({
          mode: "login",
          modal: true
        });
    }

    await identificarMembroSocial();`,
`    if (!membro?._id) {
      try {
        await authentication.promptLogin({
          mode: "login",
          modal: true
        });
      } catch (_) {}

      const membroDepois = await currentMember.getMember();
      if (!membroDepois?._id) {
        reabrirAposCancelamento = true;
        bloquearSemIdentificacao();
        return;
      }
    }

    await identificarMembroSocial();`,
"Login por clique robusto"
);

if (changed) {
  fs.writeFileSync(FILE, code, "utf8");
  console.log("Login social corrigido: X/clique fora reabre sem atualizar a página.");
} else {
  console.log("Reabertura robusta do login social já aplicada.");
}
