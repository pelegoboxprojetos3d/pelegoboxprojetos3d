const fs = require("fs");

const ENTREGA = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const AVISO = "src/pages/sem produto ou nao logado.xu6gd.js";

function fail(msg) {
  throw new Error(msg);
}

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) fail(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

function patchEntrega() {
  let code = fs.readFileSync(ENTREGA, "utf8");

  if (!code.includes('const PAGINA_AVISO_PROJETOS_PRONTOS =')) {
    const anchor = `const SECOES_ENTREGA = {
  principal: '#imagensdoprodutobotao1e2',
  banners: '#section1',
  final: '#section2'
};`;

    const addition = `${anchor}

// Página limpa usada somente para avisos de login/ausência de compras.
const PAGINA_AVISO_PROJETOS_PRONTOS =
  "/semprodutonaologao";`;

    code = replaceOnce(
      code,
      anchor,
      addition,
      "Constante da página de aviso"
    );
  }

  if (!code.includes("function abrirPaginaAvisoProjetosProntos(")) {
    const anchor = `function esperar(
  milliseconds
) {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}`;

    const addition = `${anchor}

function abrirPaginaAvisoProjetosProntos(motivo, extras = {}) {
  const partes = [
    \`motivo=\${encodeURIComponent(safe(motivo))}\`
  ];

  if (safe(extras.checkoutId)) {
    partes.push(
      \`checkout_id=\${encodeURIComponent(safe(extras.checkoutId))}\`
    );
  }

  if (safe(extras.token)) {
    partes.push(
      \`token=\${encodeURIComponent(safe(extras.token))}\`
    );
  }

  if (safe(extras.via)) {
    partes.push(
      \`via=\${encodeURIComponent(safe(extras.via))}\`
    );
  }

  wixLocation.to(
    \`\${PAGINA_AVISO_PROJETOS_PRONTOS}?\${partes.join("&")}\`
  );
}`;

    code = replaceOnce(
      code,
      anchor,
      addition,
      "Helper de redirecionamento"
    );
  }

  const oldCentralError = `    if (!resultado?.ok) {
      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          resultado?.error === "LOGIN_NECESSARIO"
            ? "Entre na sua conta para consultar seus Projetos Prontos."
            : "Não foi possível consultar seus projetos agora."
        )
      ]);
      return;
    }`;

  const newCentralError = `    if (!resultado?.ok) {
      if (resultado?.error === "LOGIN_NECESSARIO") {
        abrirPaginaAvisoProjetosProntos(
          "login",
          { via: "avatar" }
        );
        return;
      }

      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          "Não foi possível consultar seus projetos agora."
        )
      ]);
      return;
    }`;

  code = replaceOnce(
    code,
    oldCentralError,
    newCentralError,
    "Central sem login"
  );

  const oldNoProjects = `    if (!projetosSegundaVia.length) {
      await mostrarDadosRepeater([
        itemRepeaterMensagem(
          "SEUS PROJETOS PRONTOS",
          "Nenhum Projeto Pronto comprado foi encontrado nesta conta."
        )
      ]);
      return;
    }`;

  const newNoProjects = `    if (!projetosSegundaVia.length) {
      abrirPaginaAvisoProjetosProntos(
        "sem_produtos",
        { via: "avatar" }
      );
      return;
    }`;

  code = replaceOnce(
    code,
    oldNoProjects,
    newNoProjects,
    "Central sem produtos"
  );

  const oldLoginDirect = `        if (
          resultado?.error ===
          "LOGIN_NECESSARIO"
        ) {
          await encerrarProcessamentoPendente(
            "ACESSO PROTEGIDO",
            "Entre na sua conta usando o mesmo e-mail informado na compra para acessar este produto."
          );

          solicitarLoginDaCompra();
          return;
        }`;

  const newLoginDirect = `        if (
          resultado?.error ===
          "LOGIN_NECESSARIO"
        ) {
          abrirPaginaAvisoProjetosProntos(
            "login",
            {
              checkoutId,
              token,
              via: firstValue(
                wixLocation.query.via,
                "email"
              )
            }
          );
          return;
        }`;

  code = replaceOnce(
    code,
    oldLoginDirect,
    newLoginDirect,
    "Link de e-mail sem login"
  );

  fs.writeFileSync(ENTREGA, code, "utf8");
}

function rewriteAviso() {
  const code = `import wixLocation from "wix-location";
import {
  authentication,
  currentMember
} from "wix-members-frontend";

import {
  listarProjetosProntosDoMembroAtual
} from "backend/entregaProjetosProntos.jsw";

// ======================================================
// PÁGINA: SEM PRODUTO OU NÃO LOGADO
// SLUG: /semprodutonaologao
//
// Esta página NÃO entrega arquivos e NÃO possui Repeater.
// Ela mostra somente dois avisos:
// 1) membro logado sem Projeto Pronto comprado;
// 2) visitante de link/e-mail que ainda não fez login.
// ======================================================

const IDS = {
  titulo: "#textomaior",
  texto: "#textomenor",
  secaoBanners: "#SESSAO2BANEERDOBOTAO"
};

const PAGINA_PROJETOS = "/entregaprojetosprontos";

let resolvendo = false;

function safe(value) {
  return String(value ?? "").trim();
}

function firstValue(...values) {
  for (const value of values) {
    const text = safe(value);
    if (text) return text;
  }
  return "";
}

function definirMensagem(titulo, texto) {
  try { $w(IDS.titulo).text = safe(titulo); } catch (_) {}
  try { $w(IDS.texto).text = safe(texto); } catch (_) {}
}

async function esconderElementosQueNaoPertencemAoAviso() {
  try {
    const secao = $w(IDS.secaoBanners);
    if (typeof secao.hide === "function") await secao.hide();
    if (typeof secao.collapse === "function") await secao.collapse();
  } catch (_) {}
}

function parametros() {
  const query = wixLocation.query || {};
  return {
    motivo: safe(query.motivo).toLowerCase(),
    checkoutId: firstValue(query.checkout_id, query.checkoutId),
    token: safe(query.token),
    via: safe(query.via).toLowerCase()
  };
}

async function membroLogado() {
  try {
    const member = await currentMember.getMember({ fieldsets: ["FULL"] });
    return member?._id ? member : null;
  } catch (_) {
    return null;
  }
}

function abrirProjetos(params = {}) {
  const parts = [];

  if (safe(params.checkoutId)) {
    parts.push(\`checkout_id=\${encodeURIComponent(safe(params.checkoutId))}\`);
  }

  if (safe(params.token)) {
    parts.push(\`token=\${encodeURIComponent(safe(params.token))}\`);
  }

  if (safe(params.via)) {
    parts.push(\`via=\${encodeURIComponent(safe(params.via))}\`);
  }

  wixLocation.to(
    parts.length
      ? \`\${PAGINA_PROJETOS}?\${parts.join("&")}\`
      : PAGINA_PROJETOS
  );
}

function mostrarAvisoLogin() {
  definirMensagem(
    "VOCÊ NÃO ESTÁ LOGADO",
    "Entre com a mesma conta e o mesmo e-mail utilizado na compra para acessar seus Projetos Prontos."
  );
}

function mostrarAvisoSemProdutos() {
  definirMensagem(
    "VOCÊ AINDA NÃO TEM PROJETOS PRONTOS",
    "Quando você realizar sua primeira compra, seus Projetos Prontos aparecerão automaticamente aqui."
  );
}

async function resolverPagina() {
  if (resolvendo) return;
  resolvendo = true;

  try {
    const p = parametros();
    const member = await membroLogado();

    // Veio de e-mail/checkout sem login. A página apenas orienta.
    // Quando o login acontecer pelo cabeçalho, onLogin continua o fluxo.
    if (p.motivo === "login" && !member) {
      mostrarAvisoLogin();
      return;
    }

    // Se a pessoa já fez login enquanto estava nesta página,
    // voltamos ao mesmo checkout protegido para o backend validar a conta.
    if (p.motivo === "login" && member && (p.checkoutId || p.token)) {
      abrirProjetos({
        checkoutId: p.checkoutId,
        token: p.token,
        via: p.via || "email"
      });
      return;
    }

    if (!member) {
      mostrarAvisoLogin();
      return;
    }

    if (p.motivo === "sem_produtos") {
      mostrarAvisoSemProdutos();
      return;
    }

    // Entrada direta nesta página: confirma a situação real da conta.
    const resultado = await listarProjetosProntosDoMembroAtual();

    if (!resultado?.ok) {
      if (resultado?.error === "LOGIN_NECESSARIO") {
        mostrarAvisoLogin();
      } else {
        definirMensagem(
          "NÃO FOI POSSÍVEL CONSULTAR",
          "Não conseguimos consultar seus Projetos Prontos agora. Atualize esta página em instantes."
        );
      }
      return;
    }

    const items = Array.isArray(resultado.items) ? resultado.items : [];

    if (items.length > 0) {
      abrirProjetos();
      return;
    }

    mostrarAvisoSemProdutos();
  } catch (error) {
    console.error(
      "Falha ao resolver página sem produto/não logado:",
      error?.message || error
    );

    definirMensagem(
      "NÃO FOI POSSÍVEL CONSULTAR",
      "Atualize esta página e tente novamente."
    );
  } finally {
    resolvendo = false;
  }
}

$w.onReady(function () {
  esconderElementosQueNaoPertencemAoAviso().catch(() => {});

  try {
    authentication.onLogin(() => {
      resolverPagina().catch((error) => {
        console.error(
          "Falha ao continuar após login:",
          error?.message || error
        );
      });
    });
  } catch (_) {}

  resolverPagina().catch((error) => {
    console.error(
      "Falha ao iniciar página de aviso:",
      error?.message || error
    );
  });
});
`;

  fs.writeFileSync(AVISO, code, "utf8");
}

patchEntrega();
rewriteAviso();

console.log("Fluxo separado: entrega só mostra projetos; página de aviso trata sem login/sem produtos.");
