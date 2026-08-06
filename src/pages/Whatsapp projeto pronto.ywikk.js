import wixWindow from "wix-window";
import wixLocation from "wix-location";

import {
  buscarCliente,
  criarCliente
} from "backend/clientes.web";

import {
  createCheckoutProPreference
} from "backend/validaPayProjetosProntos.jsw";

import {
  obterAcessosProjeto
} from "backend/entregaProjetosProntos.jsw";

// TÍTULO NO WIX: Whatsapp projeto pronto
// TIPO: Código JavaScript da Lightbox | R13 - VALIDAPAY + CPF/CNPJ
// ELEMENTO HTML CONTROLADO: #html1

let contexto = {};
let checkoutId = "";

let consultandoCliente = false;
let criandoCliente = false;
let criandoCheckout = false;

let clienteConsultado = null;
let whatsappConsultado = "";
let checkoutAutorizado = false;
let acessoPendente = null;

function safeStr(valor) {
  return String(valor ?? "").trim();
}

function somenteNumeros(valor) {
  return safeStr(valor).replace(/\D/g, "");
}

function normalizarEmail(valor) {
  return safeStr(valor).toLowerCase();
}

function normalizarCpfCnpj(valor) {
  const documento = somenteNumeros(valor);

  return (
    documento.length === 11 ||
    documento.length === 14
  )
    ? documento
    : "";
}

function normalizarWhatsappBrasil(valor) {
  let numero = somenteNumeros(valor);

  if (
    numero.startsWith("55") &&
    (
      numero.length === 12 ||
      numero.length === 13
    )
  ) {
    numero = numero.slice(2);
  }

  if (
    numero.length !== 10 &&
    numero.length !== 11
  ) {
    return "";
  }

  return `+55${numero}`;
}

function whatsappNacional(valor) {
  const whatsapp =
    normalizarWhatsappBrasil(valor);

  return whatsapp
    ? somenteNumeros(whatsapp).slice(2)
    : "";
}

function gerarCheckoutId() {
  return (
    "ckpro_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(16).slice(2)
  );
}

function idCliente(cliente) {
  return safeStr(
    cliente?.clienteId ||
    cliente?._id
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
        console.warn(
          "Mensagem JSON inválida:",
          texto
        );
      }
    } else {
      dados = {
        type: texto
      };
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

function comTimeout(
  promessa,
  milissegundos,
  mensagem
) {
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

function formatarSkuProjeto(
  codigoProjeto,
  skuInformado
) {
  const codigo =
    somenteNumeros(codigoProjeto);

  if (codigo) {
    return (
      "PP-" +
      String(Number(codigo))
        .padStart(4, "0")
    );
  }

  return safeStr(skuInformado);
}

function montarContextoCheckout() {
  const codigoProjeto = safeStr(
    contexto.codigoProjeto ||
    contexto.ordemVideo ||
    ""
  );

  const codigoCheckout = safeStr(
    contexto.codigoCheckout ||
    contexto.codigo ||
    contexto.sku ||
    ""
  );

  return {
    codigoProjeto,
    codigoCheckout,

    produto: safeStr(
      contexto.titulo ||
      contexto.produto ||
      contexto.name ||
      "Produto"
    ),

    sku: formatarSkuProjeto(
      codigoProjeto,
      contexto.sku ||
      codigoCheckout
    ),

    productId: safeStr(
      contexto.productId ||
      codigoCheckout ||
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

    tipoProduto: safeStr(
      contexto.tipoProduto ||
      "MEDIDAS"
    ).toUpperCase(),

    returnUrl: safeStr(
      contexto.returnUrl ||
      "/"
    )
  };
}

function acessoVazio() {
  return {
    medidas: false,
    graficos: false,
    projeto: false,
    podeComprarMedidas: true,
    podeComprarGraficos: false,
    podeComprarProjeto: false
  };
}

function produtoJaComprado(
  access,
  tipoProduto
) {
  const tipo =
    safeStr(tipoProduto).toUpperCase();

  if (tipo === "GRAFICOS") {
    return access?.graficos === true;
  }

  if (tipo === "PROJETO_COMPLETO") {
    return access?.projeto === true;
  }

  return access?.medidas === true;
}

async function consultarAcessosCliente({
  clienteId,
  email,
  whatsapp
}) {
  const ctx =
    montarContextoCheckout();

  try {
    const resultado =
      await comTimeout(
        obterAcessosProjeto({
          codigoProjeto:
            ctx.codigoProjeto,

          clienteId:
            safeStr(clienteId),

          email:
            normalizarEmail(email),

          whatsapp:
            normalizarWhatsappBrasil(
              whatsapp
            )
        }),
        10000,
        "A consulta das compras não respondeu."
      );

    return (
      resultado?.ok &&
      resultado?.access
        ? resultado.access
        : acessoVazio()
    );

  } catch (erro) {
    console.warn(
      "Consulta de compras falhou:",
      erro?.message || erro
    );

    return acessoVazio();
  }
}

function proximaEtapaDisponivel(
  access = {}
) {
  if (
    access.medidas === true &&
    access.graficos !== true
  ) {
    return {
      type: "GRAFICOS",
      label: "Continuar para gráficos",
      nome: "Análises Gráficas"
    };
  }

  if (
    access.graficos === true &&
    access.projeto !== true
  ) {
    return {
      type: "PROJETO_COMPLETO",
      label:
        "Continuar para o projeto completo",
      nome: "Projeto Completo"
    };
  }

  return null;
}

function nomeEtapa(tipoProduto) {
  const tipo =
    safeStr(tipoProduto).toUpperCase();

  if (tipo === "GRAFICOS") {
    return "Análises Gráficas";
  }

  if (tipo === "PROJETO_COMPLETO") {
    return "Projeto Completo";
  }

  return "Medidas";
}

function avisarProdutoJaComprado({
  access,
  cliente,
  whatsapp
}) {
  const ctx =
    montarContextoCheckout();

  const next =
    proximaEtapaDisponivel(access);

  acessoPendente = {
    type: "ACCESS_RESULT",
    ok: true,
    alreadyPurchased: true,

    codigoProjeto:
      ctx.codigoProjeto,

    tipoProduto:
      ctx.tipoProduto,

    etapaComprada:
      nomeEtapa(ctx.tipoProduto),

    nextType:
      next?.type || "",

    nextLabel:
      next?.label || "",

    nextName:
      next?.nome || "",

    access,

    clienteId:
      idCliente(cliente),

    email:
      normalizarEmail(cliente?.email),

    cpfCnpj:
      normalizarCpfCnpj(
        cliente?.cpfCnpj
      ),

    whatsapp:
      normalizarWhatsappBrasil(
        whatsapp
      )
  };

  enviarParaHtml({
    type: "ALREADY_PURCHASED",
    ok: true,

    codigoProjeto:
      ctx.codigoProjeto,

    tipoProduto:
      ctx.tipoProduto,

    etapaComprada:
      acessoPendente.etapaComprada,

    nextType:
      acessoPendente.nextType,

    nextLabel:
      acessoPendente.nextLabel,

    nextName:
      acessoPendente.nextName,

    access
  });
}

function concluirAvisoCompraExistente(
  action = "CLOSE"
) {
  if (!acessoPendente) {
    wixWindow.lightbox.close();
    return;
  }

  wixWindow.lightbox.close({
    ...acessoPendente,

    action:
      safeStr(action).toUpperCase()
  });
}

function enviarParaHtml(mensagem) {
  try {
    const html = $w("#html1");

    if (!html) {
      console.error(
        "Elemento #html1 não encontrado."
      );
      return;
    }

    console.log(
      "CHECKOUT POPUP → HTML:",
      mensagem?.type,
      mensagem
    );

    html.postMessage(mensagem);

  } catch (erro) {
    console.error(
      "Erro ao enviar mensagem para o HTML:",
      erro
    );
  }
}

function dadosWhatsapp(dados = {}) {
  const recebido = safeStr(
    dados.whatsappE164 ||
    dados.whatsapp ||
    dados.telefone ||
    dados.whatsappDigits
  );

  const whatsappE164 =
    normalizarWhatsappBrasil(recebido);

  return {
    whatsapp:
      whatsappNacional(whatsappE164),

    whatsappE164,

    ddi: "55",
    country: "br"
  };
}

function dadosClienteCheckout(
  dados = {}
) {
  return {
    clienteId: safeStr(
      idCliente(clienteConsultado) ||
      dados.clienteId
    ),

    nomeCliente: safeStr(
      dados.nomeCliente ||
      dados.nome ||
      clienteConsultado?.nome ||
      contexto.nome ||
      contexto.cliente
    ),

    email: normalizarEmail(
      dados.email ||
      clienteConsultado?.email
    ),

    cpfCnpj: normalizarCpfCnpj(
      dados.cpfCnpj ||
      dados.cpf ||
      dados.cnpj ||
      clienteConsultado?.cpfCnpj
    )
  };
}

async function abrirValidaPay(
  dados = {}
) {
  if (criandoCheckout) {
    return;
  }

  criandoCheckout = true;

  try {
    const telefone =
      dadosWhatsapp(dados);

    const cliente =
      dadosClienteCheckout(dados);

    const ctx =
      montarContextoCheckout();

    if (!telefone.whatsappE164) {
      throw new Error(
        "WhatsApp inválido."
      );
    }

    if (!cliente.clienteId) {
      throw new Error(
        "Cliente não identificado."
      );
    }

    if (!cliente.email) {
      throw new Error(
        "E-mail não informado."
      );
    }

    if (!cliente.cpfCnpj) {
      throw new Error(
        "CPF/CNPJ não informado."
      );
    }

    const resposta =
      await comTimeout(
        createCheckoutProPreference({
          checkoutId,

          clienteId:
            cliente.clienteId,

          nomeCliente:
            cliente.nomeCliente,

          email:
            cliente.email,

          cpfCnpj:
            cliente.cpfCnpj,

          whatsapp:
            telefone.whatsapp,

          whatsappE164:
            telefone.whatsappE164,

          ddi:
            telefone.ddi,

          country:
            telefone.country,

          codigoProjeto:
            ctx.codigoProjeto,

          codigoCheckout:
            ctx.codigoCheckout,

          sku:
            ctx.sku,

          tipoProduto:
            ctx.tipoProduto,

          valor:
            ctx.valor,

          ctx: {
            ...ctx,

            clienteId:
              cliente.clienteId,

            nomeCliente:
              cliente.nomeCliente,

            email:
              cliente.email,

            cpfCnpj:
              cliente.cpfCnpj,

            whatsapp:
              telefone.whatsapp,

            whatsappE164:
              telefone.whatsappE164
          },

          returnUrl:
            ctx.returnUrl || "/"
        }),
        30000,
        "A ValidaPay não respondeu."
      );

    if (
      !resposta?.ok ||
      !resposta?.init_point
    ) {
      criandoCheckout = false;

      enviarParaHtml({
        type: "PRO_RESULT",
        ok: false,
        provider: "VALIDAPAY",

        error:
          resposta?.error ||
          "Não foi possível abrir o pagamento."
      });

      return;
    }

    enviarParaHtml({
      type: "PRO_RESULT",
      ok: true,
      provider: "VALIDAPAY",

      checkoutId:
        resposta.checkoutId ||
        checkoutId
    });

    wixLocation.to(
      resposta.init_point
    );

  } catch (erro) {
    criandoCheckout = false;

    console.error(
      "Erro ao criar checkout ValidaPay:",
      erro?.message || erro,
      erro
    );

    enviarParaHtml({
      type: "PRO_RESULT",
      ok: false,
      provider: "VALIDAPAY",

      error:
        erro?.message ||
        "Falha ao abrir a ValidaPay. Tente novamente."
    });
  }
}

async function consultarCliente(
  dados = {}
) {
  if (
    consultandoCliente ||
    criandoCliente ||
    criandoCheckout
  ) {
    return;
  }

  consultandoCliente = true;
  checkoutAutorizado = false;
  clienteConsultado = null;
  whatsappConsultado = "";

  try {
    const telefone =
      dadosWhatsapp(dados);

    if (!telefone.whatsappE164) {
      enviarParaHtml({
        type: "CUSTOMER_RESULT",
        ok: false,
        exists: false,
        needsEmail: true,
        needsCpfCnpj: true,
        needsCustomerData: true,
        error: "WhatsApp não informado."
      });

      return;
    }

    const cliente =
      await comTimeout(
        buscarCliente(
          telefone.whatsappE164
        ),
        10000,
        "A consulta do cliente não respondeu."
      );

    whatsappConsultado =
      telefone.whatsappE164;

    clienteConsultado =
      cliente || null;

    if (!cliente) {
      enviarParaHtml({
        type: "CUSTOMER_RESULT",
        ok: true,
        exists: false,
        needsEmail: true,
        needsCpfCnpj: true,
        needsCustomerData: true
      });

      return;
    }

    const email =
      normalizarEmail(
        cliente.email
      );

    const cpfCnpj =
      normalizarCpfCnpj(
        cliente.cpfCnpj
      );

    const access =
      await consultarAcessosCliente({
        clienteId:
          idCliente(cliente),

        email,

        whatsapp:
          telefone.whatsappE164
      });

    const ctx =
      montarContextoCheckout();

    if (
      produtoJaComprado(
        access,
        ctx.tipoProduto
      )
    ) {
      avisarProdutoJaComprado({
        access,
        cliente,

        whatsapp:
          telefone.whatsappE164
      });

      return;
    }

    const needsEmail =
      !email;

    const needsCpfCnpj =
      !cpfCnpj;

    const needsCustomerData =
      needsEmail ||
      needsCpfCnpj;

    checkoutAutorizado =
      !needsCustomerData;

    enviarParaHtml({
      type: "CUSTOMER_RESULT",
      ok: true,
      exists: true,

      needsEmail,
      needsCpfCnpj,
      needsCustomerData,

      customerId:
        idCliente(cliente),

      nome:
        safeStr(cliente.nome),

      email,
      cpfCnpj,
      access
    });

  } catch (erro) {
    console.error(
      "Erro ao consultar cliente:",
      erro?.message || erro,
      erro
    );

    checkoutAutorizado = false;
    clienteConsultado = null;

    whatsappConsultado =
      dadosWhatsapp(dados)
        .whatsappE164;

    enviarParaHtml({
      type: "CUSTOMER_RESULT",
      ok: true,
      exists: false,
      needsEmail: true,
      needsCpfCnpj: true,
      needsCustomerData: true,
      lookupFailed: true
    });

  } finally {
    consultandoCliente = false;
  }
}

async function cadastrarCliente(
  dados = {}
) {
  if (
    criandoCliente ||
    criandoCheckout
  ) {
    return;
  }

  criandoCliente = true;
  checkoutAutorizado = false;

  try {
    const telefone =
      dadosWhatsapp(dados);

    if (!telefone.whatsappE164) {
      enviarParaHtml({
        type: "PRO_RESULT",
        ok: false,
        error: "WhatsApp não informado."
      });

      return;
    }

    let existente = null;

    try {
      existente =
        await comTimeout(
          buscarCliente(
            telefone.whatsappE164
          ),
          10000,
          "A verificação do cliente não respondeu."
        );

    } catch (erroConsulta) {
      console.warn(
        "Consulta antes do cadastro falhou:",
        erroConsulta?.message ||
        erroConsulta
      );
    }

    const email =
      normalizarEmail(
        dados.email ||
        existente?.email
      );

    const cpfCnpj =
      normalizarCpfCnpj(
        dados.cpfCnpj ||
        dados.cpf ||
        dados.cnpj ||
        existente?.cpfCnpj
      );

    const nome = safeStr(
      dados.nomeCliente ||
      dados.nome ||
      existente?.nome ||
      contexto.nome ||
      contexto.cliente ||
      ""
    );

    if (!email) {
      enviarParaHtml({
        type: "PRO_RESULT",
        ok: false,
        error: "E-mail não informado."
      });

      return;
    }

    if (!cpfCnpj) {
      enviarParaHtml({
        type: "PRO_RESULT",
        ok: false,
        error: "CPF/CNPJ não informado."
      });

      return;
    }

    const cliente =
      await comTimeout(
        criarCliente({
          nome,

          whatsapp:
            telefone.whatsappE164,

          email,
          cpfCnpj,

          origem:
            "CHECKOUT_PROJETOS_PRONTOS"
        }),
        15000,
        "A criação do cliente não respondeu."
      );

    if (
      !cliente ||
      !idCliente(cliente)
    ) {
      throw new Error(
        "O cadastro não retornou um identificador válido."
      );
    }

    const access =
      await consultarAcessosCliente({
        clienteId:
          idCliente(cliente),

        email:
          cliente.email || email,

        whatsapp:
          telefone.whatsappE164
      });

    const ctx =
      montarContextoCheckout();

    if (
      produtoJaComprado(
        access,
        ctx.tipoProduto
      )
    ) {
      avisarProdutoJaComprado({
        access,
        cliente,

        whatsapp:
          telefone.whatsappE164
      });

      return;
    }

    clienteConsultado =
      cliente;

    whatsappConsultado =
      telefone.whatsappE164;

    checkoutAutorizado =
      true;

    await abrirValidaPay({
      ...dados,

      clienteId:
        idCliente(cliente),

      nomeCliente:
        nome || cliente.nome,

      whatsapp:
        telefone.whatsapp,

      whatsappE164:
        telefone.whatsappE164,

      ddi:
        telefone.ddi,

      country:
        telefone.country,

      email,
      cpfCnpj
    });

  } catch (erro) {
    console.error(
      "Erro ao criar ou completar cliente:",
      erro?.message || erro,
      erro
    );

    checkoutAutorizado = false;

    enviarParaHtml({
      type: "PRO_RESULT",
      ok: false,

      error:
        erro?.message ||
        "Não foi possível salvar o cadastro."
    });

  } finally {
    criandoCliente = false;
  }
}

async function enviarCheckoutClienteExistente(
  dados = {}
) {
  const telefone =
    dadosWhatsapp(dados);

  const mesmoWhatsapp =
    telefone.whatsappE164 &&
    telefone.whatsappE164 ===
      whatsappConsultado;

  if (
    !checkoutAutorizado ||
    !clienteConsultado ||
    !mesmoWhatsapp
  ) {
    enviarParaHtml({
      type: "PRO_RESULT",
      ok: false,

      error:
        "O cadastro ainda não foi validado."
    });

    return;
  }

  await abrirValidaPay({
    ...dados,

    clienteId:
      idCliente(clienteConsultado),

    nomeCliente:
      clienteConsultado.nome,

    whatsapp:
      telefone.whatsapp,

    whatsappE164:
      telefone.whatsappE164,

    ddi:
      telefone.ddi,

    country:
      telefone.country,

    email:
      clienteConsultado.email,

    cpfCnpj:
      clienteConsultado.cpfCnpj
  });
}

$w.onReady(function () {
  contexto =
    wixWindow.lightbox.getContext() ||
    {};

  checkoutId =
    gerarCheckoutId();

  const html =
    $w("#html1");

  if (!html) {
    console.error(
      "Elemento #html1 não encontrado."
    );
    return;
  }

  html.onMessage(async (event) => {
    const dados =
      normalizarMensagem(event.data);

    const tipo =
      dados.tipo ||
      dados.type;

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

      case "ACCESS_ACK":
        concluirAvisoCompraExistente(
          dados.action ||
          "CLOSE"
        );
        return;

      case "CHECK_CUSTOMER":
        await consultarCliente(dados);
        return;

      case "CREATE_CUSTOMER":
        await cadastrarCliente(dados);
        return;

      case "SUBMIT_PRO":
        await enviarCheckoutClienteExistente(
          dados
        );
        return;

      default:
        return;
    }
  });

  enviarParaHtml({
    type: "INIT",
    checkoutId,
    provider: "VALIDAPAY",

    requiredFields: {
      email: true,
      cpfCnpj: true
    },

    ctx:
      montarContextoCheckout()
  });
});