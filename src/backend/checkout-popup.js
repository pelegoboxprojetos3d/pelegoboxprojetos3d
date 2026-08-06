import wixWindow from "wix-window";
import wixLocation from "wix-location";

import {
  buscarCliente,
  criarCliente
} from "backend/clientes.web";

import {
  createCheckoutProPreference
} from "backend/mpCheckoutPro.jsw";

let contexto = {};
let checkoutId = "";

let consultandoCliente = false;
let criandoCliente = false;
let criandoCheckout = false;

function safeStr(valor) {
  return String(valor ?? "").trim();
}

function somenteNumeros(valor) {
  return safeStr(valor).replace(/\D/g, "");
}

function gerarCheckoutId() {
  return (
    "ck_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(16).slice(2)
  );
}

function normalizarMensagem(raw) {
  let dados = raw;

  if (typeof dados === "string") {
    const texto = dados.trim();

    if (
      texto.startsWith("{") ||
      texto.startsWith("[")
    ) {
      try {
        dados = JSON.parse(texto);
      } catch (erro) {
        console.warn("Mensagem JSON inválida:", texto);
      }
    } else {
      dados = { type: texto };
    }
  }

  if (
    dados &&
    typeof dados === "object" &&
    dados.data &&
    typeof dados.data === "object" &&
    !dados.type &&
    !dados.tipo
  ) {
    dados = dados.data;
  }

  return (
    dados &&
    typeof dados === "object"
      ? dados
      : {}
  );
}

function comTimeout(promessa, milissegundos, mensagem) {
  return Promise.race([
    promessa,

    new Promise((_, rejeitar) => {
      setTimeout(() => {
        rejeitar(
          new Error(
            mensagem ||
            "Tempo limite excedido."
          )
        );
      }, milissegundos);
    })
  ]);
}

function montarContextoCheckout() {
  return {
    produto: safeStr(
      contexto.titulo ||
      contexto.produto ||
      contexto.name ||
      "Produto"
    ),

    sku: safeStr(
      contexto.sku ||
      contexto.codigo ||
      "-"
    ),

    productId: safeStr(
      contexto.productId ||
      contexto.codigo ||
      ""
    ),

    img: safeStr(
      contexto.imagem ||
      contexto.img ||
      ""
    ),

    valor: Number(
      contexto.valor ||
      contexto.price ||
      0
    ),

    returnUrl: safeStr(
      contexto.returnUrl ||
      "/"
    )
  };
}

function enviarParaHtml(mensagem) {
  try {
    const html = $w("#html1");

    if (!html) {
      console.error("Elemento #html1 não encontrado.");
      return;
    }

    console.log(
      "CHECKOUT POPUP → HTML:",
      mensagem?.type,
      mensagem
    );

    /*
      O HTML aceita objeto e JSON stringificado.
      Usamos JSON para eliminar variações do transporte Wix.
    */
    html.postMessage(
      JSON.stringify(mensagem)
    );

  } catch (erro) {
    console.error(
      "Erro ao enviar mensagem para o HTML:",
      erro
    );
  }
}

function dadosWhatsapp(dados = {}) {
  const whatsapp = somenteNumeros(
    dados.whatsapp ||
    dados.telefone
  );

  const ddi = somenteNumeros(
    dados.ddi ||
    "55"
  );

  const country = safeStr(
    dados.country ||
    dados.pais ||
    "br"
  ).toLowerCase();

  return {
    whatsapp,
    whatsappE164: whatsapp
      ? `+${ddi}${whatsapp}`
      : "",
    ddi,
    country
  };
}

async function abrirMercadoPago(dados = {}) {
  if (criandoCheckout) return;

  criandoCheckout = true;

  try {
    const telefone = dadosWhatsapp(dados);
    const ctx = montarContextoCheckout();

    const resposta = await createCheckoutProPreference({
      checkoutId,

      whatsapp: telefone.whatsapp,
      whatsappE164: telefone.whatsappE164,
      ddi: telefone.ddi,
      country: telefone.country,

      ctx,
      returnUrl: ctx.returnUrl || "/"
    });

    if (!resposta?.ok || !resposta?.init_point) {
      criandoCheckout = false;

      enviarParaHtml({
        type: "PRO_RESULT",
        ok: false,
        error:
          resposta?.error ||
          "Não foi possível abrir o pagamento."
      });

      return;
    }

    enviarParaHtml({
      type: "PRO_RESULT",
      ok: true
    });

    wixLocation.to(resposta.init_point);

  } catch (erro) {
    criandoCheckout = false;

    console.error("Erro ao criar checkout Mercado Pago:", erro);

    enviarParaHtml({
      type: "PRO_RESULT",
      ok: false,
      error: "Falha ao abrir o Mercado Pago. Tente novamente."
    });
  }
}

async function consultarCliente(dados = {}) {
  if (consultandoCliente || criandoCliente || criandoCheckout) return;

  consultandoCliente = true;

  try {
    const telefone = dadosWhatsapp(dados);

    if (!telefone.whatsapp) {
      enviarParaHtml({
        type: "CUSTOMER_RESULT",
        ok: false,
        exists: false,
        error: "WhatsApp não informado."
      });

      return;
    }

    const cliente = await comTimeout(
      buscarCliente(telefone.whatsapp),
      10000,
      "A consulta do cliente não respondeu."
    );

    if (!cliente) {
      enviarParaHtml({
        type: "CUSTOMER_RESULT",
        ok: true,
        exists: false
      });

      return;
    }

    enviarParaHtml({
      type: "CUSTOMER_RESULT",
      ok: true,
      exists: true,
      customerId: cliente._id || "",
      email: cliente.email || ""
    });

    await abrirMercadoPago({
      ...dados,
      whatsapp: telefone.whatsapp,
      whatsappE164: telefone.whatsappE164,
      ddi: telefone.ddi,
      country: telefone.country
    });

  } catch (erro) {
    console.error("Erro ao consultar cliente:", erro);

    enviarParaHtml({
      type: "CUSTOMER_RESULT",
      ok: false,
      exists: false,
      error: "Não foi possível consultar o cadastro."
    });

  } finally {
    consultandoCliente = false;
  }
}

async function cadastrarCliente(dados = {}) {
  if (criandoCliente || criandoCheckout) return;

  criandoCliente = true;

  try {
    const telefone = dadosWhatsapp(dados);
    const email = safeStr(dados.email).toLowerCase();

    if (!telefone.whatsapp) {
      enviarParaHtml({
        type: "PRO_RESULT",
        ok: false,
        error: "WhatsApp não informado."
      });

      return;
    }

    if (!email) {
      enviarParaHtml({
        type: "PRO_RESULT",
        ok: false,
        error: "E-mail não informado."
      });

      return;
    }

    /*
      Evita duplicidade caso o cliente seja criado
      entre a consulta e o envio do e-mail.
    */
    let cliente = await comTimeout(
      buscarCliente(telefone.whatsapp),
      10000,
      "A verificação do cliente não respondeu."
    );

    if (!cliente) {
      cliente = await comTimeout(
        criarCliente({
        nome: safeStr(
          contexto.nome ||
          contexto.cliente ||
          ""
        ),

        whatsapp: telefone.whatsapp,
        email,

        cpf: "",
        origem: "PROJETOS PRONTOS"
      }),
        10000,
        "A criação do cliente não respondeu."
      );
    }

    await abrirMercadoPago({
      ...dados,
      whatsapp: telefone.whatsapp,
      whatsappE164: telefone.whatsappE164,
      ddi: telefone.ddi,
      country: telefone.country,
      email
    });

  } catch (erro) {
    console.error("Erro ao criar cliente:", erro);

    enviarParaHtml({
      type: "PRO_RESULT",
      ok: false,
      error: "Não foi possível criar o cadastro."
    });

  } finally {
    criandoCliente = false;
  }
}

$w.onReady(function () {
  contexto = wixWindow.lightbox.getContext() || {};
  checkoutId = gerarCheckoutId();

  const html = $w("#html1");

  if (!html) {
    console.error("Elemento #html1 não encontrado.");
    return;
  }

  enviarParaHtml({
    type: "INIT",
    checkoutId,
    ctx: montarContextoCheckout()
  });

  html.onMessage(async (event) => {
    const dados = normalizarMensagem(event.data);
    const tipo = dados.tipo || dados.type;

    console.log(
      "HTML → CHECKOUT POPUP:",
      tipo,
      dados
    );

    if (!tipo) {
      console.warn(
        "Mensagem ignorada por não possuir type/tipo:",
        event.data
      );
      return;
    }

    switch (tipo) {
      case "FECHAR":
      case "CLOSE":
        wixWindow.lightbox.close();
        return;

      case "CHECK_CUSTOMER":
        await consultarCliente(dados);
        return;

      case "CREATE_CUSTOMER":
        await cadastrarCliente(dados);
        return;

      /*
        Compatibilidade defensiva.
        O HTML novo não deve enviar SUBMIT_PRO diretamente,
        mas este bloco impede quebra caso uma versão antiga
        ainda permaneça em cache.
      */
      case "SUBMIT_PRO":
        await abrirMercadoPago(dados);
        return;

      default:
        return;
    }
  });
});