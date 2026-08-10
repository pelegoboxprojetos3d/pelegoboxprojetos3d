import wixLocation from "wix-location";
import wixData from "wix-data";
import wixWindowFrontend from "wix-window-frontend";

import {
  local,
  session
} from "wix-storage-frontend";

import {
  buscarCliente
} from "backend/clientes.web";

import {
  obterAcessosProjeto
} from "backend/entregaProjetosProntos.jsw";

// ======================================================
// PÁGINA: CHECKOUT PROJETOS PRONTOS
// SLUG: /checkoutprojetosprontos
//
// R9 — VALIDAPAY TRANSPARENTE
//
// - Preserva identificação no navegador.
// - Não pede WhatsApp novamente ao voltar.
// - Botão não permanece travado após fechar checkout.
// - Todas as compras seguem para /checkout-projeto-pronto.
// - Não cria Mercado Pago nem checkout hospedado.
// - Mantém manutenção, etapas, valores e downloads.
// ======================================================

const COLLECTION =
  "Videosprojetos";

const POPUP_NAME =
  "pedir whatsapp";

const POPUP_REOPEN_DELAY =
  3000;

const SESSION_KEY =
  "pp_identificacao_atual";

const LOCAL_KEY =
  "pp_identificacao_persistente";

const FIRST_WHATSAPP_SESSION_KEY =
  "pp_whatsapp_primeiro_estagio";

const FIRST_WHATSAPP_LOCAL_KEY =
  "pp_whatsapp_primeiro_estagio_persistente";

const CONFIRMACAO_FLUXO_VERSAO =
  3;

const CHECKOUT_AUTH_KEY =
  "pp_checkout_autorizado";

const MANUTENCAO_ATIVA =
  true;

const CHAVE_MANUTENCAO =
  "pele2026";

const PAGINA_MANUTENCAO =
  "/projetos-prontos-manutencao";

const IDS = {
  titulo:
    "#txtTitulo",

  imagem:
    "#imageProjeto",

  medidas:
    "#button1",

  valorMedidas:
    "#txtValor1",

  graficos:
    "#button2",

  valorGraficos:
    "#txtValor2",

  projeto:
    "#button3",

  valorProjeto:
    "#txtValor3",

  avisoMedidas:
    "#box1",

  avisoGraficos:
    "#box2",

  avisoProjeto:
    "#box3"
};

let projeto =
  null;

let clienteAtual =
  null;

let identificado =
  false;

let consultaConcluida =
  false;

let popupAberto =
  false;

let popupAgendado =
  null;

let bloqueioCliqueAte =
  0;

let eventosLigados =
  false;

let identificacao = {
  whatsapp: "",
  whatsappE164: "",
  ddi: "55",
  country: "br",
  countryName: "Brasil",
  clienteId: "",
  nome: "",
  email: "",
  cpfCnpj: "",
  whatsappConfirmado: false,
  confirmacaoWhatsappVersao: 0,
  confirmadoEm: ""
};

let acessos = {
  medidas: false,
  graficos: false,
  projeto: false
};

let downloads = {
  medidas: "",
  graficos: "",
  projeto: ""
};


// ======================================================
// HELPERS
// ======================================================

function safe(value) {
  return String(
    value ?? ""
  ).trim();
}

function firstValue(
  ...values
) {
  for (
    const value of
    values
  ) {
    const normalized =
      safe(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function onlyDigits(value) {
  return safe(value)
    .replace(/\D/g, "");
}

function normalizeEmail(value) {
  return safe(value)
    .toLowerCase();
}

function decodeText(value) {
  return safe(value)
    .replace(/&amp;quot;/gi, '"')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function mediaUrl(value) {
  if (!value) {
    return "";
  }

  if (
    typeof value ===
    "string"
  ) {
    return value.trim();
  }

  if (
    typeof value ===
    "object"
  ) {
    return firstValue(
      value.src,
      value.url,
      value.fileUrl,
      value.mediaUrl
    );
  }

  return "";
}

function numberValue(
  ...values
) {
  for (
    const value of
    values
  ) {
    if (
      value === undefined ||
      value === null ||
      safe(value) === ""
    ) {
      continue;
    }

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }

    let text =
      safe(value)
        .replace(
          /[^\d,.-]/g,
          ""
        );

    if (
      text.includes(",") &&
      text.includes(".")
    ) {
      text =
        text
          .replace(/\./g, "")
          .replace(",", ".");

    } else if (
      text.includes(",")
    ) {
      text =
        text.replace(",", ".");
    }

    const number =
      Number(text);

    if (
      Number.isFinite(number)
    ) {
      return number;
    }
  }

  return 0;
}

function formatMoney(value) {
  const number =
    numberValue(value);

  if (!(number > 0)) {
    return "R$ 0,00";
  }

  return number.toLocaleString(
    "pt-BR",
    {
      style:
        "currency",

      currency:
        "BRL"
    }
  );
}

function comTimeout(
  promise,
  milliseconds,
  message
) {
  return Promise.race([
    promise,

    new Promise(
      (
        _,
        reject
      ) => {
        setTimeout(
          () => {
            reject(
              new Error(
                message ||
                "Tempo limite excedido."
              )
            );
          },
          milliseconds
        );
      }
    )
  ]);
}

function cliqueBloqueado() {
  return (
    Date.now() <
    bloqueioCliqueAte
  );
}

function bloquearCliqueTemporariamente() {
  /*
    Não usamos mais um booleano permanente.

    O código antigo deixava redirecionando=true
    e, quando o Wix restaurava a página, o botão
    podia continuar morto.

    Agora o bloqueio dura somente 1,5 segundo.
  */

  bloqueioCliqueAte =
    Date.now() + 1500;
}


// ======================================================
// MANUTENÇÃO
// ======================================================

function acessoManutencaoLiberado() {
  if (!MANUTENCAO_ATIVA) {
    return true;
  }

  if (
    wixWindowFrontend.viewMode ===
      "Preview" ||
    wixWindowFrontend.viewMode ===
      "Editor"
  ) {
    return true;
  }

  return (
    safe(
      wixLocation.query.acesso
    ) ===
    CHAVE_MANUTENCAO
  );
}

function aplicarBloqueioManutencao() {
  if (
    acessoManutencaoLiberado()
  ) {
    return false;
  }

  cancelarPopupAgendado();

  wixLocation.to(
    PAGINA_MANUTENCAO
  );

  return true;
}


// ======================================================
// DADOS DO PROJETO
// ======================================================

function codigoPublico(item) {
  const direto =
    onlyDigits(
      item?.ordem_video ||
      item?.ordemVideo ||
      item?.codigoProjeto
    );

  if (direto) {
    return direto;
  }

  const match =
    decodeText(
      item?.titulo_video
    ).match(
      /^\s*#?\s*(\d+)/
    );

  return (
    match?.[1] ||
    ""
  );
}

function codigoCheckout(item) {
  const value =
    firstValue(
      item?.codigo_checkout,
      item?.codigoCheckout
    );

  const digits =
    onlyDigits(value);

  if (
    digits &&
    digits.length <= 3
  ) {
    return digits
      .padStart(
        3,
        "0"
      );
  }

  return value;
}

function tituloProjeto(item) {
  return decodeText(
    item?.titulo_video
  )
    .split(
      /\bPELEGO(?:\s*BOX)?\b/i
    )[0]
    .replace(/\s+/g, " ")
    .trim();
}

function tituloSemCodigo(value) {
  return safe(value)
    .replace(
      /^\s*#?\s*\d+\s*/i,
      ""
    )
    .trim();
}

function valorMedidas(item) {
  return numberValue(
    item?.valor_medidas,
    item?.valor_etapa_1
  );
}

function valorGraficos(item) {
  return numberValue(
    item?.valor_graficos,
    item?.valor_etapa_2
  );
}

function valorProjeto(item) {
  return numberValue(
    item?.valor_projeto,
    item?.valor_etapa_3
  );
}

function valorDaEtapa(
  tipoProduto
) {
  if (
    tipoProduto ===
    "GRAFICOS"
  ) {
    return valorGraficos(
      projeto
    );
  }

  if (
    tipoProduto ===
    "PROJETO_COMPLETO"
  ) {
    return valorProjeto(
      projeto
    );
  }

  return valorMedidas(
    projeto
  );
}

function tituloEtapa(
  tipoProduto
) {
  const codigo =
    codigoPublico(
      projeto
    );

  const base =
    tituloSemCodigo(
      tituloProjeto(
        projeto
      )
    );

  if (
    tipoProduto ===
    "GRAFICOS"
  ) {
    return (
      `#${codigo} ` +
      "ANÁLISES GRÁFICAS DO PROJETO PRONTO PARA " +
      base
    );
  }

  if (
    tipoProduto ===
    "PROJETO_COMPLETO"
  ) {
    return (
      `#${codigo} ` +
      "PROJETO COMPLETO PARA " +
      base
    );
  }

  return (
    `#${codigo} ` +
    "MEDIDAS DO PROJETO PRONTO PARA " +
    base
  );
}


// ======================================================
// BUSCAR PROJETO
// ======================================================

async function buscarProjeto(
  codigoRecebido
) {
  const codigo =
    onlyDigits(
      codigoRecebido
    );

  if (!codigo) {
    return null;
  }

  const codigoNumerico =
    Number(codigo);

  if (
    Number.isSafeInteger(
      codigoNumerico
    )
  ) {
    try {
      const resultado =
        await wixData
          .query(
            COLLECTION
          )
          .eq(
            "ordem_video",
            codigoNumerico
          )
          .limit(1)
          .find();

      if (
        resultado.items.length
      ) {
        return resultado
          .items[0];
      }

    } catch (error) {
      console.warn(
        "Busca numérica falhou:",
        error?.message ||
        error
      );
    }
  }

  try {
    const resultado =
      await wixData
        .query(
          COLLECTION
        )
        .eq(
          "ordem_video",
          codigo
        )
        .limit(1)
        .find();

    if (
      resultado.items.length
    ) {
      return resultado
        .items[0];
    }

  } catch (error) {
    console.warn(
      "Busca textual falhou:",
      error?.message ||
      error
    );
  }

  try {
    const resultado =
      await wixData
        .query(
          COLLECTION
        )
        .startsWith(
          "titulo_video",
          `#${codigo}`
        )
        .limit(1)
        .find();

    return resultado.items.length
      ? resultado.items[0]
      : null;

  } catch (error) {
    console.warn(
      "Busca pelo título falhou:",
      error?.message ||
      error
    );

    return null;
  }
}


// ======================================================
// IDENTIFICAÇÃO
// ======================================================

function normalizarTelefone(
  data = {}
) {
  const ddi =
    onlyDigits(
      data.ddi ||
      identificacao.ddi ||
      "55"
    ) || "55";

  const explicitE164 =
    onlyDigits(
      data.whatsappE164
    );

  let whatsapp =
    onlyDigits(
      data.whatsapp ||
      data.telefone ||
      data.whatsappDigits
    );

  if (
    !whatsapp &&
    explicitE164
  ) {
    whatsapp =
      explicitE164.startsWith(
        ddi
      )
        ? explicitE164.slice(
          ddi.length
        )
        : explicitE164;
  }

  if (
    ddi === "55" &&
    whatsapp.startsWith("55") &&
    whatsapp.length >= 12
  ) {
    whatsapp =
      whatsapp.slice(2);
  }

  return {
    whatsapp,

    whatsappE164:
      explicitE164
        ? `+${explicitE164}`
        : (
          whatsapp
            ? `+${ddi}${whatsapp}`
            : ""
        ),

    ddi,

    country:
      safe(
        data.country ||
        identificacao.country ||
        "br"
      ).toLowerCase()
  };
}

function normalizarIdentificacaoSalva(
  data
) {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return null;
  }

  const telefone =
    normalizarTelefone(
      data
    );

  const telefoneValido =
    telefone.ddi === "55"
      ? /^\d{10,11}$/.test(
        telefone.whatsapp
      )
      : (
        telefone.whatsapp.length >= 8 &&
        telefone.whatsapp.length <= 15
      );

  if (!telefoneValido) {
    return null;
  }

  return {
    whatsapp:
      telefone.whatsapp,

    whatsappE164:
      telefone.whatsappE164,

    ddi:
      telefone.ddi,

    country:
      telefone.country,

    countryName:
      safe(
        data.countryName
      ) || "Brasil",

    clienteId:
      safe(
        data.clienteId
      ),

    nome:
      safe(
        data.nome
      ),

    email:
      normalizeEmail(
        data.email
      ),

    cpfCnpj:
      onlyDigits(
        data.cpfCnpj ||
        data.cpf ||
        data.cnpj ||
        ""
      ),

    whatsappConfirmado:
      data.whatsappConfirmado === true,

    confirmacaoWhatsappVersao:
      Number(
        data.confirmacaoWhatsappVersao ||
        0
      ),

    confirmadoEm:
      safe(
        data.confirmadoEm
      )
  };
}

function lerIdentificacaoSalva() {
  const fontes = [
    {
      storage:
        session,

      key:
        SESSION_KEY
    },
    {
      storage:
        local,

      key:
        LOCAL_KEY
    }
  ];

  for (
    const fonte of
    fontes
  ) {
    try {
      const raw =
        fonte.storage
          .getItem(
            fonte.key
          );

      if (!raw) {
        continue;
      }

      const parsed =
        JSON.parse(raw);

      const normalized =
        normalizarIdentificacaoSalva(
          parsed
        );

      if (normalized) {
        return normalized;
      }

    } catch (_) {
      /*
        Ignora registro antigo inválido.
      */
    }
  }

  return null;
}

function salvarWhatsappPrimeiroEstagio(
  value
) {
  let numero =
    onlyDigits(
      value
    );

  if (
    numero.startsWith("55") &&
    (
      numero.length === 12 ||
      numero.length === 13
    )
  ) {
    numero =
      numero.slice(2);
  }

  if (
    numero.length !== 10 &&
    numero.length !== 11
  ) {
    return;
  }

  try {
    session.setItem(
      FIRST_WHATSAPP_SESSION_KEY,
      numero
    );
  } catch (_) {}

  try {
    local.setItem(
      FIRST_WHATSAPP_LOCAL_KEY,
      numero
    );
  } catch (_) {}
}

function salvarIdentificacao() {
  const serialized =
    JSON.stringify(
      identificacao
    );

  /*
    Esta chave só é gravada no primeiro estágio.
    O checkout de confirmação nunca pode alterá-la.
  */
  salvarWhatsappPrimeiroEstagio(
    identificacao.whatsappE164 ||
    identificacao.whatsapp
  );

  try {
    session.setItem(
      SESSION_KEY,
      serialized
    );
  } catch (_) {}

  try {
    local.setItem(
      LOCAL_KEY,
      serialized
    );
  } catch (_) {}
}


// ======================================================
// VISUAL DOS BOTÕES
// ======================================================

function aplicarCorBotao(
  button,
  background,
  color,
  border
) {
  try {
    button.style.backgroundColor =
      background;

    button.style.color =
      color;

    button.style.borderColor =
      border;
  } catch (_) {}
}

function estadoBloqueado(
  button
) {
  aplicarCorBotao(
    button,
    "#D9D9D9",
    "#8A8A8A",
    "#9B7664"
  );

  button.disable();
}

function estadoDisponivel(
  button
) {
  aplicarCorBotao(
    button,
    "#FFFFFF",
    "#111111",
    "#111111"
  );

  button.enable();
}

function estadoPago(
  button
) {
  aplicarCorBotao(
    button,
    "#159447",
    "#FFFFFF",
    "#159447"
  );

  button.enable();
}

function ligarDestaqueAoPassarMouse(
  buttonId,
  avisoId
) {
  const button =
    $w(buttonId);

  const aviso =
    $w(avisoId);

  let corOriginal =
    "";

  let larguraOriginal =
    0;

  try {
    corOriginal =
      aviso.style.borderColor;

    larguraOriginal =
      aviso.style.borderWidth;
  } catch (_) {
    return;
  }

  button.onMouseIn(
    () => {
      try {
        aviso.style.borderColor =
          "#159447";

        aviso.style.borderWidth =
          3;
      } catch (_) {}
    }
  );

  button.onMouseOut(
    () => {
      try {
        aviso.style.borderColor =
          corOriginal;

        aviso.style.borderWidth =
          larguraOriginal;
      } catch (_) {}
    }
  );
}

function ligarDestaquesDosAvisos() {
  ligarDestaqueAoPassarMouse(
    IDS.medidas,
    IDS.avisoMedidas
  );

  ligarDestaqueAoPassarMouse(
    IDS.graficos,
    IDS.avisoGraficos
  );

  ligarDestaqueAoPassarMouse(
    IDS.projeto,
    IDS.avisoProjeto
  );
}


// ======================================================
// ESTADO DAS ETAPAS
// ======================================================

function etapaPaga(
  tipoProduto
) {
  if (
    tipoProduto ===
    "MEDIDAS"
  ) {
    return acessos.medidas;
  }

  if (
    tipoProduto ===
    "GRAFICOS"
  ) {
    return acessos.graficos;
  }

  return acessos.projeto;
}

function etapaDisponivel(
  tipoProduto
) {
  if (
    tipoProduto ===
    "MEDIDAS"
  ) {
    return !acessos.medidas;
  }

  if (
    tipoProduto ===
    "GRAFICOS"
  ) {
    return (
      acessos.medidas &&
      !acessos.graficos
    );
  }

  return (
    acessos.graficos &&
    !acessos.projeto
  );
}


// ======================================================
// PREPARAR PÁGINA
// ======================================================

function esconderValores() {
  $w(
    IDS.valorMedidas
  ).hide();

  $w(
    IDS.valorGraficos
  ).hide();

  $w(
    IDS.valorProjeto
  ).hide();
}

function bloquearSemIdentificacao() {
  esconderValores();

  estadoBloqueado(
    $w(
      IDS.medidas
    )
  );

  estadoBloqueado(
    $w(
      IDS.graficos
    )
  );

  estadoBloqueado(
    $w(
      IDS.projeto
    )
  );
}

function esconderConteudoPrincipal() {
  $w(
    IDS.titulo
  ).hide();

  $w(
    IDS.imagem
  ).hide();

  $w(
    IDS.medidas
  ).hide();

  $w(
    IDS.graficos
  ).hide();

  $w(
    IDS.projeto
  ).hide();

  bloquearSemIdentificacao();
}

async function mostrarProjetoCompleto() {
  const titulo =
    tituloProjeto(
      projeto
    );

  const imagem =
    mediaUrl(
      projeto?.thumbnail
    );

  if (titulo) {
    $w(
      IDS.titulo
    ).text =
      titulo;
  }

  if (imagem) {
    $w(
      IDS.imagem
    ).src =
      imagem;
  }

  await Promise.all([
    $w(
      IDS.titulo
    ).show(),

    $w(
      IDS.imagem
    ).show(),

    $w(
      IDS.medidas
    ).show(),

    $w(
      IDS.graficos
    ).show(),

    $w(
      IDS.projeto
    ).show()
  ]);

  bloquearSemIdentificacao();
}


// ======================================================
// DOWNLOADS
// ======================================================

function capturarDownloads(
  resultado
) {
  const access =
    resultado?.access ||
    {};

  const resultDownloads =
    resultado?.downloads ||
    {};

  const links =
    resultado?.links ||
    {};

  const compra =
    resultado?.compra ||
    resultado?.purchase ||
    {};

  downloads = {
    medidas:
      firstValue(
        resultado?.downloadMedidas,
        resultDownloads?.medidas,
        links?.medidas,
        access?.downloadMedidas,
        compra?.downloadMedidas,
        projeto?.popup_medidas,
        projeto?.popupMedidas
      ),

    graficos:
      firstValue(
        resultado?.downloadGraficos,
        resultDownloads?.graficos,
        links?.graficos,
        access?.downloadGraficos,
        compra?.downloadGraficos,
        projeto?.popup_graficos,
        projeto?.popupGraficos
      ),

    projeto:
      firstValue(
        resultado?.downloadProjeto,
        resultDownloads?.projeto,
        links?.projeto,
        access?.downloadProjeto,
        compra?.downloadProjeto,
        projeto?.arquivo_projeto,
        projeto?.arquivoProjeto
      )
  };
}

function urlDownloadDaEtapa(
  tipoProduto
) {
  if (
    tipoProduto ===
    "GRAFICOS"
  ) {
    return downloads.graficos;
  }

  if (
    tipoProduto ===
    "PROJETO_COMPLETO"
  ) {
    return downloads.projeto;
  }

  return downloads.medidas;
}

function abrirDownloadPago(
  tipoProduto
) {
  const url =
    urlDownloadDaEtapa(
      tipoProduto
    );

  if (!url) {
    console.error(
      "Link de download não encontrado:",
      tipoProduto
    );

    return;
  }

  wixLocation.to(
    url
  );
}


// ======================================================
// VALORES E ACESSOS
// ======================================================

async function mostrarValoresEAcessos() {
  $w(
    IDS.valorMedidas
  ).text =
    acessos.medidas
      ? (
        "PAGO — " +
        formatMoney(
          valorMedidas(
            projeto
          )
        )
      )
      : formatMoney(
        valorMedidas(
          projeto
        )
      );

  $w(
    IDS.valorGraficos
  ).text =
    acessos.graficos
      ? (
        "PAGO — " +
        formatMoney(
          valorGraficos(
            projeto
          )
        )
      )
      : formatMoney(
        valorGraficos(
          projeto
        )
      );

  $w(
    IDS.valorProjeto
  ).text =
    acessos.projeto
      ? (
        "PAGO — " +
        formatMoney(
          valorProjeto(
            projeto
          )
        )
      )
      : formatMoney(
        valorProjeto(
          projeto
        )
      );

  await Promise.all([
    $w(
      IDS.valorMedidas
    ).show(),

    $w(
      IDS.valorGraficos
    ).show(),

    $w(
      IDS.valorProjeto
    ).show()
  ]);

  if (
    acessos.medidas
  ) {
    estadoPago(
      $w(
        IDS.medidas
      )
    );
  } else {
    estadoDisponivel(
      $w(
        IDS.medidas
      )
    );
  }

  if (
    acessos.graficos
  ) {
    estadoPago(
      $w(
        IDS.graficos
      )
    );
  } else if (
    acessos.medidas
  ) {
    estadoDisponivel(
      $w(
        IDS.graficos
      )
    );
  } else {
    estadoBloqueado(
      $w(
        IDS.graficos
      )
    );
  }

  if (
    acessos.projeto
  ) {
    estadoPago(
      $w(
        IDS.projeto
      )
    );
  } else if (
    acessos.graficos
  ) {
    estadoDisponivel(
      $w(
        IDS.projeto
      )
    );
  } else {
    estadoBloqueado(
      $w(
        IDS.projeto
      )
    );
  }
}


// ======================================================
// POPUP
// ======================================================

function cancelarPopupAgendado() {
  if (
    popupAgendado !== null
  ) {
    clearTimeout(
      popupAgendado
    );

    popupAgendado =
      null;
  }
}

function agendarPopupWhatsapp(
  milliseconds =
    POPUP_REOPEN_DELAY
) {
  cancelarPopupAgendado();

  if (
    identificado ||
    popupAberto ||
    !projeto
  ) {
    return;
  }

  popupAgendado =
    setTimeout(
      () => {
        popupAgendado =
          null;

        if (
          identificado ||
          popupAberto ||
          !projeto
        ) {
          return;
        }

        abrirPopupWhatsapp()
          .catch(
            console.error
          );
      },

      milliseconds
    );
}

async function identificarCliente(
  data = {}
) {
  const telefone =
    normalizarTelefone(
      data
    );

  if (!telefone.whatsapp) {
    throw new Error(
      "WhatsApp não informado."
    );
  }

  cancelarPopupAgendado();

  identificacao = {
    ...identificacao,

    whatsapp:
      telefone.whatsapp,

    whatsappE164:
      telefone.whatsappE164,

    ddi:
      telefone.ddi,

    country:
      telefone.country,

    countryName:
      safe(
        data.countryName
      ) ||
      identificacao.countryName ||
      "Brasil"
  };

  identificado =
    true;

  consultaConcluida =
    false;

  salvarIdentificacao();

  clienteAtual =
    null;

  acessos = {
    medidas: false,
    graficos: false,
    projeto: false
  };

  downloads = {
    medidas: "",
    graficos: "",
    projeto: ""
  };

  try {
    clienteAtual =
      await comTimeout(
        buscarCliente(
          telefone.whatsapp
        ),

        12000,

        "A consulta do cliente não respondeu."
      );

    if (
      clienteAtual
    ) {
      identificacao.clienteId =
        firstValue(
          clienteAtual._id,
          clienteAtual.clienteId
        );

      identificacao.nome =
        firstValue(
          clienteAtual.nome,
          clienteAtual.title
        );

      identificacao.email =
        normalizeEmail(
          clienteAtual.email
        );

      identificacao.cpfCnpj =
        onlyDigits(
          clienteAtual.cpfCnpj ||
          clienteAtual.cpf ||
          clienteAtual.documentNumber ||
          clienteAtual.documento ||
          clienteAtual.cpfcnpj ||
          ""
        );

      const resultado =
        await comTimeout(
          obterAcessosProjeto({
            codigoProjeto:
              codigoPublico(
                projeto
              ),

            clienteId:
              identificacao.clienteId,

            email:
              identificacao.email,

            whatsapp:
              onlyDigits(
                telefone.whatsappE164
              )
          }),

          12000,

          "A consulta das compras não respondeu."
        );

      if (
        resultado?.ok &&
        resultado?.access
      ) {
        acessos = {
          medidas:
            resultado
              .access
              .medidas ===
              true,

          graficos:
            resultado
              .access
              .graficos ===
              true,

          projeto:
            resultado
              .access
              .projeto ===
              true
        };

        capturarDownloads(
          resultado
        );
      }

    } else {
      identificacao.clienteId =
        "";

      identificacao.nome =
        "";

      identificacao.email =
        "";
    }

  } catch (error) {
    console.error(
      "Falha ao consultar cliente:",
      error?.message ||
      error
    );

  } finally {
    consultaConcluida =
      true;

    salvarIdentificacao();

    await mostrarValoresEAcessos();
  }
}

async function abrirPopupWhatsapp() {
  if (
    popupAberto ||
    identificado ||
    !projeto
  ) {
    return;
  }

  cancelarPopupAgendado();

  popupAberto =
    true;

  let deveReabrir =
    false;

  try {
    const resultado =
      await wixWindowFrontend
        .openLightbox(
          POPUP_NAME,
          {
            codigoProjeto:
              codigoPublico(
                projeto
              ),

            tituloProjeto:
              tituloProjeto(
                projeto
              ),

            whatsapp:
              "",

            ddi:
              "55",

            country:
              "br"
          }
        );

    if (
      resultado?.action !==
      "VERIFY"
    ) {
      bloquearSemIdentificacao();

      deveReabrir =
        true;

      return;
    }

    identificacao.whatsappConfirmado =
      false;

    identificacao.confirmacaoWhatsappVersao =
      0;

    identificacao.confirmadoEm =
      "";

    await identificarCliente(
      resultado
    );

  } catch (error) {
    console.error(
      "Erro no popup:",
      error?.message ||
      error
    );

    if (!identificado) {
      bloquearSemIdentificacao();

      deveReabrir =
        true;
    }

  } finally {
    popupAberto =
      false;

    if (
      deveReabrir &&
      !identificado
    ) {
      agendarPopupWhatsapp();
    }
  }
}


function salvarAutorizacaoCheckout(
  tipoProduto
) {
  try {
    session.setItem(
      CHECKOUT_AUTH_KEY,
      JSON.stringify({
        codigoProjeto:
          codigoPublico(projeto),

        tipoProduto:
          safe(tipoProduto)
            .toUpperCase(),

        clienteId:
          safe(identificacao.clienteId),

        criadoEm:
          Date.now()
      })
    );
  } catch (_) {}
}

// ======================================================
// URL DO CHECKOUT TRANSPARENTE
// ======================================================

function montarUrlCheckout(
  tipoProduto
) {
  const codigoProjeto =
    codigoPublico(
      projeto
    );

  const codigoInterno =
    codigoCheckout(
      projeto
    );

  const valor =
    valorDaEtapa(
      tipoProduto
    );

  if (
    !codigoProjeto ||
    !codigoInterno ||
    !(valor > 0)
  ) {
    return "";
  }

  const titulo =
    tituloEtapa(
      tipoProduto
    );

  const imagem =
    mediaUrl(
      projeto?.thumbnail
    );

  /*
    A identificação do cliente já está salva no navegador.
    Não coloque nome, e-mail, WhatsApp ou clienteId na URL.
  */
  const parametros = {
    codigoProjeto,

    codigoCheckout:
      codigoInterno,

    titulo,

    productId:
      safe(
        projeto?._id
      ),

    imagem,

    sku:
      `PP-${codigoProjeto}`,

    valor:
      String(valor),

    tipoProduto,

    returnUrl:
      wixLocation.url
  };

  const query =
    Object
      .entries(
        parametros
      )
      .map(
        (
          [
            key,
            value
          ]
        ) => (
          `${encodeURIComponent(key)}=` +
          `${encodeURIComponent(value)}`
        )
      )
      .join("&");

  return (
    "/checkout-projeto-pronto?" +
    query
  );
}


// ======================================================
// CLIQUES
// ======================================================

async function abrirEtapa(
  tipoProduto
) {
  if (
    cliqueBloqueado() ||
    !projeto
  ) {
    return;
  }

  if (!identificado) {
    await abrirPopupWhatsapp();
    return;
  }

  if (!consultaConcluida) {
    try {
      await identificarCliente(
        identificacao
      );
    } catch (error) {
      console.error(
        "Não foi possível atualizar o cliente:",
        error?.message ||
        error
      );

      return;
    }
  }

  if (
    etapaPaga(
      tipoProduto
    )
  ) {
    abrirDownloadPago(
      tipoProduto
    );

    return;
  }

  if (
    !etapaDisponivel(
      tipoProduto
    )
  ) {
    return;
  }

  salvarAutorizacaoCheckout(
    tipoProduto
  );

  const destino =
    montarUrlCheckout(
      tipoProduto
    );

  if (!destino) {
    console.error(
      "Não foi possível montar o checkout:",
      tipoProduto
    );

    return;
  }

  bloquearCliqueTemporariamente();

  wixLocation.to(
    destino
  );
}

function ligarEventos() {
  if (
    eventosLigados
  ) {
    return;
  }

  eventosLigados =
    true;

  ligarDestaquesDosAvisos();

  $w(
    IDS.medidas
  ).onClick(
    () => {
      abrirEtapa(
        "MEDIDAS"
      ).catch(
        console.error
      );
    }
  );

  $w(
    IDS.graficos
  ).onClick(
    () => {
      abrirEtapa(
        "GRAFICOS"
      ).catch(
        console.error
      );
    }
  );

  $w(
    IDS.projeto
  ).onClick(
    () => {
      abrirEtapa(
        "PROJETO_COMPLETO"
      ).catch(
        console.error
      );
    }
  );
}


// ======================================================
// INICIAR
// ======================================================

async function iniciarPagina() {
  /*
    Toda vez que a página aparece novamente,
    o bloqueio de clique começa zerado.
  */

  bloqueioCliqueAte =
    0;

  esconderConteudoPrincipal();

  ligarEventos();

  const codigoRecebido =
    safe(
      wixLocation.query.codigo ||
      wixLocation.query.codigoProjeto
    );

  if (!codigoRecebido) {
    console.error(
      "Código do projeto não informado."
    );

    return;
  }

  projeto =
    await buscarProjeto(
      codigoRecebido
    );

  if (!projeto) {
    console.error(
      "Projeto não encontrado:",
      codigoRecebido
    );

    return;
  }

  await mostrarProjetoCompleto();

  const salva =
    lerIdentificacaoSalva();

  if (salva) {
    identificacao = {
      ...identificacao,
      ...salva
    };

    const confirmacaoAtualValida =
      salva.whatsappConfirmado === true &&
      Number(
        salva.confirmacaoWhatsappVersao ||
        0
      ) === CONFIRMACAO_FLUXO_VERSAO;

    if (confirmacaoAtualValida) {
      identificado =
        true;

      identificarCliente(
        salva
      ).catch(
        (
          error
        ) => {
          console.error(
            "Erro ao restaurar identificação:",
            error?.message ||
            error
          );
        }
      );

      return;
    }

    identificado =
      false;

    agendarPopupWhatsapp(
      300
    );

    return;
  }

  agendarPopupWhatsapp(
    800
  );
}


// ======================================================
// ON READY
// ======================================================

$w.onReady(
  function () {
    if (
      aplicarBloqueioManutencao()
    ) {
      return;
    }

    iniciarPagina()
      .catch(
        (
          error
        ) => {
          console.error(
            "Erro ao iniciar página:",
            error?.message ||
            error,
            error
          );
        }
      );
  }
);