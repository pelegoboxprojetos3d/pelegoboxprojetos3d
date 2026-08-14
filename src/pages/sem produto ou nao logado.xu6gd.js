import wixLocation from "wix-location";
import { currentMember } from "wix-members-frontend";

import {
  listarProjetosProntosDoMembroAtual,
  buscarSegundaViaProjetoPronto,
  buscarEntregaProjetoPronto
} from "backend/entregaProjetosProntos.jsw";

// ======================================================
// PÁGINA: SEM PRODUTO OU NÃO LOGADO
// SLUG: /semprodutonaologao
//
// Esta página serve SOMENTE para recados de acesso:
// 1) usuário sem Projetos Prontos;
// 2) pessoa que abriu link do e-mail sem estar logada;
// 3) pessoa logada em conta diferente da usada na compra.
//
// Se a conta estiver correta e houver compra, ela não permanece aqui:
// redireciona para /entregaprojetosprontos.
// ======================================================

const IDS = {
  titulo: "#textomaior",
  texto: "#textomenor"
};

const PAGINA_PROJETOS = "/entregaprojetosprontos";

let verificacaoEmAndamento = false;

function safe(valor) {
  return String(valor ?? "").trim();
}

function digits(valor) {
  return safe(valor).replace(/\D/g, "");
}

function firstValue(...valores) {
  for (const valor of valores) {
    const texto = safe(valor);
    if (texto) return texto;
  }
  return "";
}

function definirMensagem(titulo, texto) {
  try {
    $w(IDS.titulo).text = safe(titulo);
  } catch (_) {}

  try {
    $w(IDS.texto).text = safe(texto);
  } catch (_) {}
}

function parametrosDaUrl() {
  const query = wixLocation.query || {};

  return {
    checkoutId: firstValue(query.checkout_id, query.checkoutId),
    token: safe(query.token),
    codigoProjeto: digits(firstValue(query.codigoProjeto, query.codigo)),
    via: safe(query.via).toLowerCase(),
    motivo: safe(query.motivo).toLowerCase()
  };
}

function veioDeEmailOuCompra(parametros = {}) {
  return Boolean(
    parametros.checkoutId ||
    parametros.token ||
    parametros.codigoProjeto ||
    parametros.via === "email" ||
    parametros.motivo === "login_compra" ||
    parametros.motivo === "conta_errada"
  );
}

async function membroAtual() {
  try {
    const membro = await currentMember.getMember({
      fieldsets: ["FULL"]
    });

    return membro?._id
      ? membro
      : null;
  } catch (_) {
    return null;
  }
}

function mostrarNaoLogado(parametros = {}) {
  if (veioDeEmailOuCompra(parametros)) {
    definirMensagem(
      "VOCÊ NÃO ESTÁ LOGADO",
      "Para acessar este Projeto Pronto, entre no site com a mesma conta e o mesmo e-mail usados no pagamento. Depois abra o botão do e-mail novamente."
    );
    return;
  }

  definirMensagem(
    "VOCÊ NÃO ESTÁ LOGADO",
    "Entre na sua conta para consultar seus Projetos Prontos."
  );
}

function mostrarSemProdutos() {
  definirMensagem(
    "VOCÊ AINDA NÃO TEM PROJETOS PRONTOS",
    "Você ainda não comprou nenhum Projeto Pronto. Após a primeira compra, seus projetos aparecerão automaticamente na sua conta."
  );
}

function mostrarContaErrada() {
  definirMensagem(
    "ESTE PROJETO NÃO PERTENCE A ESTA CONTA",
    "Saia da conta atual e entre com a mesma conta e o mesmo e-mail usados no pagamento para acessar este Projeto Pronto."
  );
}

function abrirPaginaProjetos(parametros = {}) {
  const partes = [];

  if (parametros.checkoutId) {
    partes.push(
      `checkout_id=${encodeURIComponent(parametros.checkoutId)}`
    );
  }

  if (parametros.token) {
    partes.push(
      `token=${encodeURIComponent(parametros.token)}`
    );
  }

  if (parametros.via) {
    partes.push(
      `via=${encodeURIComponent(parametros.via)}`
    );
  }

  const destino = partes.length
    ? `${PAGINA_PROJETOS}?${partes.join("&")}`
    : PAGINA_PROJETOS;

  wixLocation.to(destino);
}

async function validarLinkDireto(parametros) {
  try {
    const resultado = await buscarEntregaProjetoPronto({
      checkoutId: parametros.checkoutId,
      token: parametros.token
    });

    if (resultado?.ok) {
      abrirPaginaProjetos({
        ...parametros,
        via: parametros.via || "email"
      });
      return;
    }

    if (resultado?.error === "LOGIN_NECESSARIO") {
      mostrarNaoLogado(parametros);
      return;
    }

    if (resultado?.error === "COMPRA_DE_OUTRA_CONTA") {
      mostrarContaErrada();
      return;
    }

    if (resultado?.error === "EMAIL_DA_COMPRA_AUSENTE") {
      definirMensagem(
        "NÃO FOI POSSÍVEL VALIDAR A COMPRA",
        "Não conseguimos validar o titular desta compra. Entre em contato com o suporte."
      );
      return;
    }

    if (resultado?.error === "SESSAO_NAO_ENCONTRADA") {
      definirMensagem(
        "LINK DE COMPRA NÃO ENCONTRADO",
        "Este link não corresponde a uma compra disponível."
      );
      return;
    }

    definirMensagem(
      "NÃO FOI POSSÍVEL ABRIR ESTE PROJETO",
      "Não conseguimos validar este acesso agora. Atualize a página em instantes."
    );
  } catch (erro) {
    console.error(
      "Falha ao validar link direto:",
      erro?.message || erro
    );

    definirMensagem(
      "NÃO FOI POSSÍVEL CONSULTAR",
      "Não conseguimos validar este acesso agora. Atualize a página em instantes."
    );
  }
}

async function validarLinkAntigo(codigoProjeto) {
  try {
    const resultado = await buscarSegundaViaProjetoPronto({
      codigoProjeto
    });

    if (resultado?.ok && resultado?.approved) {
      wixLocation.to(PAGINA_PROJETOS);
      return;
    }

    if (resultado?.error === "LOGIN_NECESSARIO") {
      mostrarNaoLogado({
        codigoProjeto,
        via: "email"
      });
      return;
    }

    if (resultado?.error === "COMPRA_NAO_ENCONTRADA") {
      mostrarContaErrada();
      return;
    }

    if (resultado?.error === "PROJETO_NAO_ENCONTRADO") {
      definirMensagem(
        "PROJETO NÃO ENCONTRADO",
        "A compra foi localizada, mas o projeto não está disponível neste momento."
      );
      return;
    }

    definirMensagem(
      "NÃO FOI POSSÍVEL ABRIR ESTE PROJETO",
      "Não conseguimos validar este acesso agora. Atualize a página em instantes."
    );
  } catch (erro) {
    console.error(
      "Falha ao validar link antigo:",
      erro?.message || erro
    );

    definirMensagem(
      "NÃO FOI POSSÍVEL CONSULTAR",
      "Não conseguimos validar este acesso agora. Atualize a página em instantes."
    );
  }
}

async function resolverAcesso() {
  if (verificacaoEmAndamento) {
    return;
  }

  verificacaoEmAndamento = true;

  try {
    const parametros = parametrosDaUrl();
    const membro = await membroAtual();

    if (!membro) {
      mostrarNaoLogado(parametros);
      return;
    }

    if (parametros.checkoutId || parametros.token) {
      await validarLinkDireto(parametros);
      return;
    }

    if (parametros.codigoProjeto) {
      await validarLinkAntigo(parametros.codigoProjeto);
      return;
    }

    definirMensagem(
      "VERIFICANDO SUA CONTA",
      "Estamos localizando seus Projetos Prontos..."
    );

    const resultado = await listarProjetosProntosDoMembroAtual();

    if (!resultado?.ok) {
      if (resultado?.error === "LOGIN_NECESSARIO") {
        mostrarNaoLogado(parametros);
      } else {
        definirMensagem(
          "NÃO FOI POSSÍVEL CONSULTAR",
          "Não conseguimos consultar seus projetos agora. Atualize esta página em instantes."
        );
      }
      return;
    }

    const projetos = Array.isArray(resultado.items)
      ? resultado.items
      : [];

    if (projetos.length > 0) {
      wixLocation.to(PAGINA_PROJETOS);
      return;
    }

    mostrarSemProdutos();
  } catch (erro) {
    console.error(
      "Falha ao verificar acesso aos Projetos Prontos:",
      erro?.message || erro
    );

    definirMensagem(
      "NÃO FOI POSSÍVEL CONSULTAR",
      "Ocorreu uma falha ao verificar sua conta. Atualize esta página."
    );
  } finally {
    verificacaoEmAndamento = false;
  }
}

$w.onReady(function () {
  resolverAcesso().catch((erro) => {
    console.error(
      "Falha ao iniciar página de acesso:",
      erro?.message || erro
    );

    definirMensagem(
      "NÃO FOI POSSÍVEL CONSULTAR",
      "Atualize esta página e tente novamente."
    );
  });
});
