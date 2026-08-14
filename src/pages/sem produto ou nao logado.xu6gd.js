import wixLocation from "wix-location";
import {
  authentication,
  currentMember
} from "wix-members-frontend";

import {
  listarProjetosProntosDoMembroAtual,
  buscarSegundaViaProjetoPronto
} from "backend/entregaProjetosProntos.jsw";

// ======================================================
// PÁGINA: SEM PRODUTO OU NÃO LOGADO
//
// FUNÇÃO:
// - Entrada pelo avatar > SEUS PROJETOS PRONTOS.
// - Entrada por link de produto recebido por e-mail.
// - Obriga login quando necessário.
// - Usa a mesma identidade segura da central de Projetos Prontos.
// - Se houver compras, envia para /entregaprojetosprontos.
// - Se não houver compras, mantém o cliente nesta página.
// ======================================================

const IDS = {
  titulo: "#textomaior",
  texto: "#textomenor"
};

const PAGINA_CENTRAL =
  "/entregaprojetosprontos";

let loginEmAndamento =
  false;

let verificacaoEmAndamento =
  false;

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
    checkoutId: firstValue(
      query.checkout_id,
      query.checkoutId
    ),

    token: safe(query.token),

    codigoProjeto: digits(
      firstValue(
        query.codigoProjeto,
        query.codigo
      )
    ),

    via: safe(query.via).toLowerCase()
  };
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

async function pedirLogin() {
  if (loginEmAndamento) {
    return false;
  }

  loginEmAndamento = true;

  definirMensagem(
    "ENTRE NA SUA CONTA",
    "Use o mesmo e-mail informado na compra para acessar seus Projetos Prontos."
  );

  try {
    await authentication.promptLogin({
      mode: "login",
      modal: true
    });

    return true;
  } catch (_) {
    definirMensagem(
      "ACESSO AOS SEUS PROJETOS",
      "Entre na sua conta usando o mesmo e-mail informado na compra."
    );

    return false;
  } finally {
    loginEmAndamento = false;
  }
}

function abrirCentralComCompra(parametros) {
  const partes = [];

  if (parametros?.checkoutId) {
    partes.push(
      `checkout_id=${encodeURIComponent(parametros.checkoutId)}`
    );
  }

  if (parametros?.token) {
    partes.push(
      `token=${encodeURIComponent(parametros.token)}`
    );
  }

  if (parametros?.via) {
    partes.push(
      `via=${encodeURIComponent(parametros.via)}`
    );
  }

  const destino = partes.length
    ? `${PAGINA_CENTRAL}?${partes.join("&")}`
    : PAGINA_CENTRAL;

  wixLocation.to(destino);
}

async function validarCodigoDoEmail(codigoProjeto) {
  if (!codigoProjeto) {
    return null;
  }

  try {
    return await buscarSegundaViaProjetoPronto({
      codigoProjeto
    });
  } catch (erro) {
    console.error(
      "Falha ao validar projeto do e-mail:",
      erro?.message || erro
    );

    return {
      ok: false,
      error: "ERRO_CONSULTA"
    };
  }
}

async function resolverAcesso() {
  if (verificacaoEmAndamento) {
    return;
  }

  verificacaoEmAndamento = true;

  try {
    const parametros =
      parametrosDaUrl();

    definirMensagem(
      "VERIFICANDO SUA CONTA",
      "Estamos localizando seus Projetos Prontos..."
    );

    let membro =
      await membroAtual();

    if (!membro) {
      const entrou =
        await pedirLogin();

      if (!entrou) {
        return;
      }

      membro =
        await membroAtual();

      if (!membro) {
        definirMensagem(
          "LOGIN NECESSÁRIO",
          "Não foi possível confirmar sua conta. Entre novamente usando o e-mail da compra."
        );

        return;
      }
    }

    // Link protegido vindo do e-mail ou do checkout.
    // A página de entrega fará a conferência final do e-mail da compra.
    if (
      parametros.checkoutId ||
      parametros.token
    ) {
      abrirCentralComCompra({
        ...parametros,
        via: parametros.via || "email"
      });

      return;
    }

    // Compatibilidade com links antigos que tragam somente o código do projeto.
    if (parametros.codigoProjeto) {
      const resultadoCodigo =
        await validarCodigoDoEmail(
          parametros.codigoProjeto
        );

      if (
        resultadoCodigo?.ok === true &&
        resultadoCodigo?.approved === true
      ) {
        wixLocation.to(PAGINA_CENTRAL);
        return;
      }

      if (
        resultadoCodigo?.error ===
        "COMPRA_NAO_ENCONTRADA"
      ) {
        definirMensagem(
          "ESTE PRODUTO NÃO ESTÁ NESTA CONTA",
          "Entre com o mesmo e-mail utilizado na compra para acessar este Projeto Pronto."
        );

        return;
      }

      if (
        resultadoCodigo?.error ===
        "PROJETO_NAO_ENCONTRADO"
      ) {
        definirMensagem(
          "PROJETO NÃO ENCONTRADO",
          "A compra foi localizada, mas o projeto não está disponível neste momento."
        );

        return;
      }
    }

    const resultado =
      await listarProjetosProntosDoMembroAtual();

    if (!resultado?.ok) {
      if (
        resultado?.error ===
        "LOGIN_NECESSARIO"
      ) {
        definirMensagem(
          "ENTRE NA SUA CONTA",
          "Faça login para consultar seus Projetos Prontos."
        );
      } else {
        definirMensagem(
          "NÃO FOI POSSÍVEL CONSULTAR",
          "Não conseguimos consultar seus projetos agora. Atualize esta página em instantes."
        );
      }

      return;
    }

    const projetos =
      Array.isArray(resultado.items)
        ? resultado.items
        : [];

    if (projetos.length > 0) {
      wixLocation.to(PAGINA_CENTRAL);
      return;
    }

    definirMensagem(
      "VOCÊ AINDA NÃO TEM PROJETOS PRONTOS",
      "Quando você comprar seu primeiro Projeto Pronto, ele aparecerá automaticamente aqui."
    );
  } catch (erro) {
    console.error(
      "Falha ao verificar acesso aos Projetos Prontos:",
      erro?.message || erro,
      erro
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
