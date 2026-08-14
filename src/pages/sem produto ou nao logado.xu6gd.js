import wixLocation from "wix-location";
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
  if (safe(params.checkoutId)) parts.push(`checkout_id=${encodeURIComponent(safe(params.checkoutId))}`);
  if (safe(params.token)) parts.push(`token=${encodeURIComponent(safe(params.token))}`);
  if (safe(params.via)) parts.push(`via=${encodeURIComponent(safe(params.via))}`);

  wixLocation.to(
    parts.length
      ? `${PAGINA_PROJETOS}?${parts.join("&")}`
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
