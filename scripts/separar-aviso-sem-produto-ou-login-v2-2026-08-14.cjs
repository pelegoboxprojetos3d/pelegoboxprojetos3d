const fs = require("fs");

const ENTREGA = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";
const AVISO = "src/pages/sem produto ou nao logado.xu6gd.js";

function fail(msg) { throw new Error(msg); }

function replaceSlice(code, start, end, replacement, label) {
  if (start < 0 || end < 0 || end <= start) fail(`${label}: limites não encontrados.`);
  return code.slice(0, start) + replacement + code.slice(end);
}

function patchEntrega() {
  let code = fs.readFileSync(ENTREGA, "utf8");

  if (!code.includes('const PAGINA_AVISO_PROJETOS_PRONTOS =')) {
    const anchor = `const SECOES_ENTREGA = {
  principal: '#imagensdoprodutobotao1e2',
  banners: '#section1',
  final: '#section2'
};`;
    const i = code.indexOf(anchor);
    if (i < 0) fail("Constante de seções não encontrada.");
    code = code.slice(0, i) + anchor + `

const PAGINA_AVISO_PROJETOS_PRONTOS =
  "/semprodutonaologao";` + code.slice(i + anchor.length);
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
    const i = code.indexOf(anchor);
    if (i < 0) fail("Helper esperar não encontrado.");
    const helper = `

function abrirPaginaAvisoProjetosProntos(motivo, extras = {}) {
  const partes = [
    \`motivo=\${encodeURIComponent(safe(motivo))}\`
  ];

  if (safe(extras.checkoutId)) {
    partes.push(\`checkout_id=\${encodeURIComponent(safe(extras.checkoutId))}\`);
  }
  if (safe(extras.token)) {
    partes.push(\`token=\${encodeURIComponent(safe(extras.token))}\`);
  }
  if (safe(extras.via)) {
    partes.push(\`via=\${encodeURIComponent(safe(extras.via))}\`);
  }

  wixLocation.to(
    \`\${PAGINA_AVISO_PROJETOS_PRONTOS}?\${partes.join("&")}\`
  );
}`;
    code = code.slice(0, i + anchor.length) + helper + code.slice(i + anchor.length);
  }

  const central = code.indexOf("async function carregarCentralSegundasVias()");
  if (central < 0) fail("Central não encontrada.");

  let start = code.indexOf("    if (!resultado?.ok) {", central);
  let end = code.indexOf("    projetosSegundaVia =", start);
  if (!code.slice(start, end).includes("mostrarDadosRepeater")) {
    fail("Bloco de erro da central inesperado.");
  }
  code = replaceSlice(code, start, end, `    if (!resultado?.ok) {
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
    }

`, "Erro da central");

  start = code.indexOf("    if (!projetosSegundaVia.length) {", central);
  end = code.indexOf("    const detalhes =", start);
  if (start >= 0 && end >= 0) {
    code = replaceSlice(code, start, end, `    if (!projetosSegundaVia.length) {
      abrirPaginaAvisoProjetosProntos(
        "sem_produtos",
        { via: "avatar" }
      );
      return;
    }

`, "Sem produtos");
  }

  const carregar = code.indexOf("async function carregarEntrega()");
  if (carregar < 0) fail("Carregar entrega não encontrado.");

  const loginMarker = `        if (
          resultado?.error ===
          "LOGIN_NECESSARIO"
        ) {`;
  const contaMarker = `        if (
          resultado?.error ===
          "COMPRA_DE_OUTRA_CONTA"`;
  start = code.indexOf(loginMarker, carregar);
  end = code.indexOf(contaMarker, start);
  if (start >= 0 && end >= 0) {
    code = replaceSlice(code, start, end, `        if (
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
        }

`, "E-mail sem login");
  }

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

async function esconderBanners() {
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
  if (safe(params.checkoutId)) parts.push(\`checkout_id=\${encodeURIComponent(safe(params.checkoutId))}\`);
  if (safe(params.token)) parts.push(\`token=\${encodeURIComponent(safe(params.token))}\`);
  if (safe(params.via)) parts.push(\`via=\${encodeURIComponent(safe(params.via))}\`);

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

    if (p.motivo === "login" && !member) {
      mostrarAvisoLogin();
      return;
    }

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
    console.error("Falha ao resolver página de aviso:", error?.message || error);
    definirMensagem(
      "NÃO FOI POSSÍVEL CONSULTAR",
      "Atualize esta página e tente novamente."
    );
  } finally {
    resolvendo = false;
  }
}

$w.onReady(function () {
  esconderBanners().catch(() => {});

  try {
    authentication.onLogin(() => {
      resolverPagina().catch((error) => {
        console.error("Falha ao continuar após login:", error?.message || error);
      });
    });
  } catch (_) {}

  resolverPagina().catch((error) => {
    console.error("Falha ao iniciar página de aviso:", error?.message || error);
  });
});
`;

  fs.writeFileSync(AVISO, code, "utf8");
}

patchEntrega();
rewriteAviso();
console.log("Página de aviso separada aplicada com sucesso.");
