import wixLocation from "wix-location";
import wixData from "wix-data";
import wixWindowFrontend from "wix-window-frontend";
import { authentication, currentMember } from "wix-members-frontend";

import {
  local,
  session
} from "wix-storage-frontend";

import {
  buscarCliente,
  buscarClienteDoMembroAtual
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
  7000;

const SESSION_KEY =
  "pp_identificacao_atual";

const LOCAL_KEY =
  "pp_identificacao_persistente";

const FIRST_WHATSAPP_SESSION_KEY =
  "pp_whatsapp_primeiro_estagio";

const FIRST_WHATSAPP_LOCAL_KEY =
  "pp_whatsapp_primeiro_estagio_persistente";

const CONFIRMACAO_FLUXO_VERSAO =
  4;

const CHECKOUT_AUTH_KEY =
  "pp_checkout_autorizado";

const ACTIVE_PIX_SESSION_KEY =
  "pp_checkout_pix_ativo";

const MANUTENCAO_ATIVA =
  false;

const CHAVE_MANUTENCAO =
  "pele2026";

const PAGINA_MANUTENCAO =
  "/projetos-prontos-manutencao";

const SLUG_LOGIN_SOCIAL =
  "checkoutprojetosprontos";

const MOBILE_LOGIN_AFTER_RENDER_DELAY =
  5000;

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
    "#box3",

  setaAnterior:
    "#setaProjetoAnterior",

  setaProximo:
    "#setaProjetoProximo"
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

let projetoAnteriorCache =
  null;

let projetoProximoCache =
  null;

let navegacaoProjetoEmAndamento =
  false;

let vizinhosToken =
  0;

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

function paginaLoginSocialAtiva() {
  return (
    safe(
      wixLocation.path?.[0]
    ).toLowerCase() ===
    SLUG_LOGIN_SOCIAL
  );
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

function tituloProjeto(item) {
  const original =
    decodeText(
      item?.titulo_video
    );

  /*
    A coleção já traz o código de questionário 001–014 no título.
    Ele é tratado como dado da fonte, nunca como texto para ser somado.
    Mesmo que um título antigo chegue com o código repetido, removemos todos
    os códigos finais e recolocamos apenas o único código da fonte.
  */
  const codigoQuestionario =
    original.match(
      /\b(00[1-9]|01[0-4])\b\s*$/i
    )?.[1] || "";

  const base =
    original
      .split(
        /\bPELEGO(?:\s*BOX)?\b/i
      )[0]
      .replace(
        /(?:\s+(?:00[1-9]|01[0-4]))+\s*$/i,
        ""
      )
      .replace(/\s+/g, " ")
      .trim();

  return [
    base,
    codigoQuestionario
  ]
    .filter(Boolean)
    .join(" ")
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
      `#${codigo} Gráficos Projeto Pronto ${base}`
    );
  }

  if (
    tipoProduto ===
    "PROJETO_COMPLETO"
  ) {
    return (
      `#${codigo} Projeto Pronto Completo ${base}`
    );
  }

  return (
    `#${codigo} Medidas Projeto Pronto ${base}`
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
// NAVEGAÇÃO ENTRE PROJETOS
// ======================================================

function estadoSetaProjeto(
  id,
  disponivel
) {
  try {
    const seta =
      $w(id);

    if (disponivel) {
      seta.enable();
    } else {
      seta.disable();
    }
  } catch (_) {}
}

function normalizarMarcaNavegacao(value) {
  try {
    return decodeURIComponent(
      safe(value)
    )
      .replace(/\+/g, " ")
      .trim();
  } catch (_) {
    return safe(value)
      .replace(/\+/g, " ")
      .trim();
  }
}

function marcaNavegacaoProjeto(
  itemBase = projeto
) {
  /*
    A marca escolhida na página de vídeos manda na navegação.
    Isso é importante para projetos cadastrados em mais de uma marca: ao entrar
    por JBL, as setas continuam em JBL, em vez de trocar para marca_1.
  */
  return (
    normalizarMarcaNavegacao(
      wixLocation.query.marca
    ) ||
    normalizarMarcaNavegacao(
      itemBase?.marca_1
    ) ||
    normalizarMarcaNavegacao(
      itemBase?.marca_2
    ) ||
    normalizarMarcaNavegacao(
      itemBase?.marca_3
    )
  );
}

function consultaProjetosDaMarca(
  itemBase = projeto
) {
  const marca =
    marcaNavegacaoProjeto(
      itemBase
    );

  if (!marca) {
    return wixData.query(
      COLLECTION
    );
  }

  return wixData
    .query(COLLECTION)
    .eq("marca_1", marca)
    .or(
      wixData
        .query(COLLECTION)
        .eq("marca_2", marca)
    )
    .or(
      wixData
        .query(COLLECTION)
        .eq("marca_3", marca)
    );
}

async function buscarProjetoVizinho(
  direcao,
  itemBase = projeto
) {
  const codigoAtual =
    Number(
      codigoPublico(
        itemBase
      )
    );

  if (
    !Number.isSafeInteger(
      codigoAtual
    )
  ) {
    return null;
  }

  try {
    let consulta =
      consultaProjetosDaMarca(
        itemBase
      );

    if (
      direcao < 0
    ) {
      consulta =
        consulta
          .lt(
            "ordem_video",
            codigoAtual
          )
          .descending(
            "ordem_video"
          );
    } else {
      consulta =
        consulta
          .gt(
            "ordem_video",
            codigoAtual
          )
          .ascending(
            "ordem_video"
          );
    }

    const resultado =
      await consulta
        .limit(1)
        .find();

    if (resultado.items.length) {
      return resultado.items[0];
    }

    /*
      Navegação circular: ao ultrapassar o último projeto pela direita,
      volta para o primeiro. Ao ultrapassar o primeiro pela esquerda,
      volta para o último. Assim as duas setas nunca chegam a um beco sem saída.
    */
    let consultaExtremo =
      consultaProjetosDaMarca(
        itemBase
      );
    consultaExtremo = direcao < 0
      ? consultaExtremo.descending("ordem_video")
      : consultaExtremo.ascending("ordem_video");

    const extremo = await consultaExtremo.limit(1).find();
    const circular = extremo.items.length ? extremo.items[0] : null;

    if (
      circular &&
      codigoPublico(circular) !== String(codigoAtual)
    ) {
      return circular;
    }

    return null;

  } catch (error) {
    console.warn(
      "Falha ao localizar projeto vizinho:",
      error?.message ||
      error
    );

    return null;
  }
}

async function prepararProjetosVizinhos() {
  if (!projeto) {
    return;
  }

  const codigoBase =
    codigoPublico(
      projeto
    );

  const token =
    ++vizinhosToken;

  const [
    anterior,
    proximo
  ] = await Promise.all([
    buscarProjetoVizinho(
      -1,
      projeto
    ),

    buscarProjetoVizinho(
      1,
      projeto
    )
  ]);

  if (
    token !== vizinhosToken ||
    codigoPublico(projeto) !==
      codigoBase
  ) {
    return;
  }

  projetoAnteriorCache =
    anterior;

  projetoProximoCache =
    proximo;

  estadoSetaProjeto(
    IDS.setaAnterior,
    Boolean(anterior)
  );

  estadoSetaProjeto(
    IDS.setaProximo,
    Boolean(proximo)
  );
}

function atualizarCodigoNaUrl(
  codigo
) {
  try {
    const params = {
      codigo:
        String(codigo)
    };

    const marca =
      marcaNavegacaoProjeto(
        projeto
      );

    if (marca) {
      params.marca =
        marca;
    }

    wixLocation
      .queryParams
      .add(params);
  } catch (error) {
    console.warn(
      "Não foi possível atualizar o código na URL:",
      error?.message ||
      error
    );
  }
}

async function carregarAcessosDoProjetoAtual(
  codigoEsperado
) {
  const codigo =
    onlyDigits(
      codigoEsperado
    );

  if (
    !codigo ||
    codigoPublico(projeto) !==
      codigo
  ) {
    return;
  }

  const acessosLocais =
    lerAcessosLocais(
      codigo
    );

  acessos =
    acessosLocais || {
      medidas: false,
      graficos: false,
      projeto: false
    };

  downloads = {
    medidas: "",
    graficos: "",
    projeto: ""
  };

  if (!identificado) {
    bloquearSemIdentificacao();
    return;
  }

  await mostrarValoresEAcessos();

  if (
    !identificacao.clienteId
  ) {
    return;
  }

  try {
    const telefone =
      normalizarTelefone(
        identificacao
      );

    const resultado =
      await comTimeout(
        obterAcessosProjeto({
          codigoProjeto:
            codigo,

          clienteId:
            identificacao.clienteId,

          email:
            identificacao.email,

          whatsapp:
            onlyDigits(
              telefone.whatsappE164
            )
        }),

        7000,

        "A consulta das compras do novo projeto não respondeu."
      );

    if (
      codigoPublico(projeto) !==
        codigo
    ) {
      return;
    }

    if (
      resultado?.ok &&
      resultado?.access
    ) {
      acessos = {
        medidas:
          resultado.access.medidas === true,

        graficos:
          resultado.access.graficos === true,

        projeto:
          resultado.access.projeto === true
      };

      capturarDownloads(
        resultado
      );

      salvarAcessosLocais(
        codigo,
        acessos
      );

      await mostrarValoresEAcessos();
    }

  } catch (error) {
    console.warn(
      "Falha ao atualizar acessos do projeto selecionado:",
      error?.message ||
      error
    );
  }
}

async function trocarProjeto(
  direcao
) {
  if (
    navegacaoProjetoEmAndamento ||
    !projeto
  ) {
    return;
  }

  navegacaoProjetoEmAndamento =
    true;

  estadoSetaProjeto(
    IDS.setaAnterior,
    false
  );

  estadoSetaProjeto(
    IDS.setaProximo,
    false
  );

  try {
    let destino =
      direcao < 0
        ? projetoAnteriorCache
        : projetoProximoCache;

    if (!destino) {
      destino =
        await buscarProjetoVizinho(
          direcao,
          projeto
        );
    }

    if (!destino) {
      await prepararProjetosVizinhos();
      return;
    }

    projeto =
      destino;

    projetoAnteriorCache =
      null;

    projetoProximoCache =
      null;

    const codigoNovo =
      codigoPublico(
        projeto
      );

    atualizarCodigoNaUrl(
      codigoNovo
    );

    await mostrarProjetoCompleto();

    await carregarAcessosDoProjetoAtual(
      codigoNovo
    );

  } finally {
    navegacaoProjetoEmAndamento =
      false;

    prepararProjetosVizinhos()
      .catch(
        console.error
      );
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

function lerAcessosLocais(codigoProjeto) {
  const codigo = onlyDigits(codigoProjeto);

  if (!codigo) {
    return null;
  }

  try {
    const raw = local.getItem(
      `pp_acessos_${codigo}`
    );

    if (!raw) {
      return null;
    }

    const data = JSON.parse(raw);

    if (!data || typeof data !== "object") {
      return null;
    }

    return {
      medidas: data.medidas === true,
      graficos: data.graficos === true,
      projeto: data.projeto === true
    };
  } catch (_) {
    return null;
  }
}

function salvarAcessosLocais(codigoProjeto, access = {}) {
  const codigo = onlyDigits(codigoProjeto);

  if (!codigo) {
    return;
  }

  try {
    local.setItem(
      `pp_acessos_${codigo}`,
      JSON.stringify({
        medidas: access.medidas === true,
        graficos: access.graficos === true,
        projeto: access.projeto === true,
        atualizadoEm: new Date().toISOString()
      })
    );
  } catch (_) {}
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
    A chave dedicada do primeiro WhatsApp NÃO é atualizada aqui.
    Ela só pode ser gravada explicitamente quando o popup 1 retorna VERIFY.
    Isso impede o checkout/popup 2 de transformar outro número no "primeiro".
  */

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
    IDS.setaAnterior
  ).hide();

  $w(
    IDS.setaProximo
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
      IDS.setaAnterior
    ).show(),

    $w(
      IDS.setaProximo
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

  prepararProjetosVizinhos()
    .catch(
      console.error
    );
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

async function alternarAvisoPaginaPrincipal(id, mostrar) {
  try {
    const elemento = $w(id);

    if (mostrar) {
      await Promise.allSettled([
        typeof elemento.expand === "function" ? elemento.expand() : Promise.resolve(),
        typeof elemento.show === "function" ? elemento.show() : Promise.resolve()
      ]);
    } else {
      await Promise.allSettled([
        typeof elemento.hide === "function" ? elemento.hide() : Promise.resolve(),
        typeof elemento.collapse === "function" ? elemento.collapse() : Promise.resolve()
      ]);
    }
  } catch (error) {
    console.warn(
      `Falha ao alternar aviso principal ${id}:`,
      error?.message || error
    );
  }
}

function estilizarAvisoPaginaPrincipal(id, pago) {
  try {
    const elemento = $w(id);

    if (!elemento?.style) {
      return;
    }

    /*
      O cartão continua branco.
      Pagamento confirmado recebe contorno verde no desktop.
      A sombra configurada no Editor é preservada.
    */
    elemento.style.backgroundColor = "#FFFFFF";
    elemento.style.borderColor = pago ? "#159447" : "#E0E0E0";
    elemento.style.borderWidth = pago ? 2 : 1;
  } catch (_) {}
}

async function aplicarRegraVisualAvisosPaginaPrincipal() {
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  const etapas = [
    { id: IDS.avisoMedidas, pago: acessos.medidas === true },
    { id: IDS.avisoGraficos, pago: acessos.graficos === true },
    { id: IDS.avisoProjeto, pago: acessos.projeto === true }
  ];

  /*
    REGRA MOBILE OFICIAL E ÚNICA:
    - etapa paga: esconde e recolhe o banner;
    - etapa não paga: mostra o banner;
    - não depende de ser a próxima etapa disponível;
    - desktop continua mostrando os três banners.
  */
  for (const etapa of etapas) {
    estilizarAvisoPaginaPrincipal(etapa.id, etapa.pago);

    await alternarAvisoPaginaPrincipal(
      etapa.id,
      mobile ? !etapa.pago : true
    );
  }
}

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

  await aplicarRegraVisualAvisosPaginaPrincipal();
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
    !paginaLoginSocialAtiva() ||
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

function agendarRetornoLoginSocial() {
  // PB_LOGIN_PASSIVO_V1_APLICADO
  // Nunca abrir/reabrir o login por temporizador. A autenticação só pode
  // começar a partir de uma ação explícita do visitante.
  cancelarPopupAgendado();
}

function perfilMembroFrontend(membro = {}) {
  const emails =
    Array.isArray(membro?.contactDetails?.emails)
      ? membro.contactDetails.emails
      : [];

  const memberId =
    safe(membro?._id);

  const memberEmail =
    normalizeEmail(
      membro?.loginEmail ||
      emails[0] ||
      membro?.contactDetails?.email
    );

  const memberName =
    safe(
      membro?.profile?.nickname ||
      [
        membro?.contactDetails?.firstName,
        membro?.contactDetails?.lastName
      ]
        .filter(Boolean)
        .join(" ")
    ).replace(/\s+/g, " ");

  return {
    memberId,
    memberEmail,
    memberName
  };
}

async function aguardarMembroLogado(maxWaitMs = 8000) {
  const inicio = Date.now();

  while (Date.now() - inicio < maxWaitMs) {
    try {
      const membro = await currentMember.getMember();
      if (membro?._id) return membro;
    } catch (_) {}

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

async function hidratarClienteMembroSocial(memberEmail) {
  try {
    const perfil =
      await comTimeout(
        buscarClienteDoMembroAtual(),
        7000,
        "A identificação do membro Wix não respondeu."
      );

    const emailSeguro =
      normalizeEmail(
        perfil?.email ||
        memberEmail
      );

    if (!emailSeguro) {
      return;
    }

    const cliente =
      perfil?.cliente &&
      typeof perfil.cliente === "object"
        ? perfil.cliente
        : null;

    if (!cliente) {
      identificacao = {
        ...identificacao,
        nome:
          firstValue(
            identificacao.nome,
            perfil?.nome
          ),
        email:
          emailSeguro
      };

      salvarIdentificacao();
      return;
    }

    const telefone =
      normalizarTelefone({
        whatsapp:
          cliente.whatsappNacional ||
          cliente.whatsapp,
        whatsappE164:
          cliente.whatsappE164 ||
          cliente.whatsapp,
        ddi: "55",
        country: "br"
      });

    /*
      A conta Wix autenticada e o cadastro unico encontrado pelo mesmo e-mail
      sao a fonte da verdade entre dispositivos. Se o cadastro backend ja tem
      telefone, nome e documento, nao obrigamos o cliente a repetir tudo apenas
      porque trocou do PC para o celular.
    */
    const jaConfirmadoAqui =
      identificacao.whatsappConfirmado === true;

    const cadastroContaCompleto = Boolean(
      telefone.whatsapp &&
      firstValue(cliente._id, cliente.clienteId) &&
      firstValue(cliente.nome, perfil?.nome).length >= 3 &&
      emailSeguro &&
      onlyDigits(cliente.cpfCnpj || cliente.cpf).length === 11
    );

    identificacao = {
      ...identificacao,
      whatsapp:
        telefone.whatsapp ||
        identificacao.whatsapp,
      whatsappE164:
        telefone.whatsappE164 ||
        identificacao.whatsappE164,
      ddi: "55",
      country: "br",
      countryName: "Brasil",
      clienteId:
        firstValue(
          cliente._id,
          cliente.clienteId,
          identificacao.clienteId
        ),
      nome:
        firstValue(
          cliente.nome,
          identificacao.nome,
          perfil?.nome
        ),
      email:
        emailSeguro,
      cpfCnpj:
        onlyDigits(
          cliente.cpfCnpj ||
          cliente.cpf ||
          identificacao.cpfCnpj
        ),
      whatsappConfirmado:
        jaConfirmadoAqui || cadastroContaCompleto,
      confirmacaoWhatsappVersao:
        jaConfirmadoAqui || cadastroContaCompleto
          ? Number(
              identificacao.confirmacaoWhatsappVersao ||
              CONFIRMACAO_FLUXO_VERSAO
            )
          : 0,
      confirmadoEm:
        jaConfirmadoAqui || cadastroContaCompleto
          ? safe(identificacao.confirmadoEm) || new Date().toISOString()
          : ""
    };

    clienteAtual =
      cliente;

    if (
      identificacao.clienteId
    ) {
      try {
        const codigoConsulta =
          codigoPublico(
            projeto
          );

        const resultado =
          await comTimeout(
            obterAcessosProjeto({
              codigoProjeto:
                codigoConsulta,
              clienteId:
                identificacao.clienteId,
              email:
                identificacao.email,
              whatsapp:
                onlyDigits(
                  identificacao.whatsappE164
                )
            }),
            7000,
            "A consulta das compras não respondeu."
          );

        if (
          codigoPublico(projeto) !==
            codigoConsulta
        ) {
          salvarIdentificacao();
          return;
        }

        if (
          resultado?.ok &&
          resultado?.access
        ) {
          acessos = {
            medidas:
              resultado.access.medidas === true,
            graficos:
              resultado.access.graficos === true,
            projeto:
              resultado.access.projeto === true
          };

          capturarDownloads(
            resultado
          );

          salvarAcessosLocais(
            codigoPublico(projeto),
            acessos
          );
        }
      } catch (error) {
        console.warn(
          "Falha ao carregar compras do membro Wix:",
          error?.message || error
        );
      }
    }

    salvarIdentificacao();
    await mostrarValoresEAcessos();

  } catch (error) {
    console.warn(
      "Hidratação social em segundo plano falhou:",
      error?.message || error
    );
  }
}

async function identificarMembroSocial(membroConfirmado = null) {
  cancelarPopupAgendado();

  const membro =
    membroConfirmado?._id
      ? membroConfirmado
      : await aguardarMembroLogado(5000);

  const {
    memberId,
    memberEmail,
    memberName
  } = perfilMembroFrontend(
    membro
  );

  if (!memberId || !memberEmail) {
    identificado = false;
    bloquearSemIdentificacao();
    throw new Error(
      "Não foi possível identificar o membro Wix autenticado."
    );
  }

  const salva =
    lerIdentificacaoSalva();

  const mesmoMembro =
    Boolean(
      salva &&
      normalizeEmail(salva.email) ===
        memberEmail
    );

  const telefoneSalvo =
    mesmoMembro
      ? normalizarTelefone(salva)
      : {
          whatsapp: "",
          whatsappE164: "",
          ddi: "55",
          country: "br"
        };

  identificacao = {
    whatsapp:
      telefoneSalvo.whatsapp,
    whatsappE164:
      telefoneSalvo.whatsappE164,
    ddi: "55",
    country: "br",
    countryName: "Brasil",
    clienteId:
      mesmoMembro
        ? safe(salva.clienteId)
        : "",
    nome:
      firstValue(
        mesmoMembro
          ? salva.nome
          : "",
        memberName
      ),
    email:
      memberEmail,
    cpfCnpj:
      mesmoMembro
        ? onlyDigits(
            salva.cpfCnpj ||
            salva.cpf
          )
        : "",
    whatsappConfirmado:
      mesmoMembro &&
      salva.whatsappConfirmado === true,
    confirmacaoWhatsappVersao:
      mesmoMembro &&
      salva.whatsappConfirmado === true
        ? Number(
            salva.confirmacaoWhatsappVersao ||
            CONFIRMACAO_FLUXO_VERSAO
          )
        : 0,
    confirmadoEm:
      mesmoMembro &&
      salva.whatsappConfirmado === true
        ? safe(salva.confirmadoEm)
        : ""
  };

  clienteAtual =
    null;

  identificado =
    true;

  consultaConcluida =
    true;

  const acessosLocais =
    mesmoMembro
      ? lerAcessosLocais(
          codigoPublico(projeto)
        )
      : null;

  acessos =
    acessosLocais || {
      medidas: false,
      graficos: false,
      projeto: false
    };

  downloads = {
    medidas: "",
    graficos: "",
    projeto: ""
  };

  salvarIdentificacao();

  /*
    REGRA DE PERFORMANCE:
    login Google/Facebook confirmado libera valores e o primeiro botão agora.
    A coleção de clientes e as compras são consultadas depois, sem prender a UI.
  */
  await mostrarValoresEAcessos();

  hidratarClienteMembroSocial(
    memberEmail
  ).catch(console.error);
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
      "Brasil",

    whatsappConfirmado:
      data.whatsappConfirmado === true ||
      identificacao.whatsappConfirmado === true,

    confirmacaoWhatsappVersao:
      data.whatsappConfirmado === true
        ? Number(
          data.confirmacaoWhatsappVersao ||
          CONFIRMACAO_FLUXO_VERSAO
        )
        : Number(
          identificacao.confirmacaoWhatsappVersao ||
          0
        ),

    confirmadoEm:
      safe(data.confirmadoEm) ||
      identificacao.confirmadoEm ||
      (
        data.whatsappConfirmado === true
          ? new Date().toISOString()
          : ""
      )
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
    const clienteDoPopup =
      data.cliente &&
      typeof data.cliente === "object"
        ? data.cliente
        : null;

    clienteAtual =
      clienteDoPopup ||
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

        salvarAcessosLocais(
          codigoPublico(projeto),
          acessos
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
    !paginaLoginSocialAtiva() ||
    popupAberto ||
    !projeto
  ) {
    return;
  }

  cancelarPopupAgendado();
  popupAberto = true;

  let reabrirAposCancelamento = false;

  try {
    let membro = null;

    try {
      membro = await currentMember.getMember();
    } catch (_) {}

    if (!membro?._id) {
      let loginConcluido = false;

      try {
        await authentication.promptLogin({
          mode: "login",
          modal: true
        });
        loginConcluido = true;
      } catch (_) {
        loginConcluido = false;
      }

      if (!loginConcluido) {
        reabrirAposCancelamento = true;
        bloquearSemIdentificacao();
        return;
      }

      /*
        No celular o cookie/sessão do Wix pode levar alguns instantes para
        aparecer em currentMember depois que o login social fecha. Não abrimos
        outro modal nesse intervalo. Esperamos a sessão propagar primeiro.
      */
      membro = await aguardarMembroLogado(10000);

      if (!membro?._id) {
        reabrirAposCancelamento = true;
        bloquearSemIdentificacao();
        return;
      }
    }

    await identificarMembroSocial(membro);

  } catch (error) {
    console.error(
      "Erro no login social:",
      error?.message || error
    );

    reabrirAposCancelamento = true;
    bloquearSemIdentificacao();
  } finally {
    popupAberto = false;

    if (
      reabrirAposCancelamento &&
      !identificado
    ) {
      agendarRetornoLoginSocial();
    }
  }
}

function salvarAutorizacaoCheckout(
  tipoProduto
) {
  try {
    const telefone =
      normalizarTelefone(
        identificacao
      );

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

        nome:
          safe(identificacao.nome),

        email:
          normalizeEmail(identificacao.email),

        cpfCnpj:
          onlyDigits(
            identificacao.cpfCnpj ||
            identificacao.cpf
          ),

        whatsapp:
          telefone.whatsapp,

        whatsappE164:
          telefone.whatsappE164,

        ddi:
          telefone.ddi,

        country:
          telefone.country,

        whatsappConfirmado:
          identificacao.whatsappConfirmado === true,

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
  const valor =
    valorDaEtapa(
      tipoProduto
    );

  if (
    !codigoProjeto ||
    !(valor > 0)
  ) {
    return "";
  }

  const titulo =
    tituloEtapa(
      tipoProduto
    );

  /*
    Título-base canônico vem diretamente de Videosprojetos.titulo_video.
    O checkout usa esse valor apenas para montar a apresentação visual e
    mantém "titulo" como descrição comercial da etapa.
  */
  const tituloBase =
    tituloProjeto(
      projeto
    );

  const imagem =
    mediaUrl(
      projeto?.thumbnail
    );

  /*
    A identificação do cliente já está salva no navegador.
    Não coloque nome, e-mail, WhatsApp ou clienteId na URL.
  */
  /*
    Cada clique abre uma tentativa independente.
    O checkoutId vai na URL para impedir que o histórico/BFCache
    reaproveite a cobrança de uma navegação anterior.
  */
  const checkoutId =
    `ckpro_${Date.now().toString(36)}_` +
    Math.random().toString(16).slice(2, 12);

  /*
    O novo clique invalida imediatamente qualquer polling deixado pela
    tentativa anterior no histórico do navegador.
  */
  try {
    session.setItem(
      ACTIVE_PIX_SESSION_KEY,
      checkoutId
    );
  } catch (_) {}

  const parametros = {
    checkoutId,
    codigoProjeto,
    titulo,
    tituloBase,

    productId:
      safe(
        projeto?._id
      ),

    imagem,
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

  /*
    A identificação já foi feita antes. Não repetimos consulta de cliente
    e acessos no clique, porque isso segurava a navegação para o checkout.
    O clique deve decidir com o estado já carregado e navegar imediatamente.
  */

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

  $w(
    IDS.setaAnterior
  ).onClick(
    () => {
      trocarProjeto(
        -1
      ).catch(
        console.error
      );
    }
  );

  $w(
    IDS.setaProximo
  ).onClick(
    () => {
      trocarProjeto(
        1
      ).catch(
        console.error
      );
    }
  );
}


// ======================================================
// INICIAR
// ======================================================

function cadastroProntoParaPagamento(data = identificacao) {
  const telefone = normalizarTelefone(data);
  const nome = safe(data?.nome).replace(/\s+/g, " ");
  const mail = normalizeEmail(data?.email);
  const documento = onlyDigits(data?.cpfCnpj || data?.cpf);

  return Boolean(
    telefone.whatsapp &&
    safe(data?.clienteId) &&
    data?.whatsappConfirmado === true &&
    nome.length >= 3 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(mail) &&
    documento.length === 11
  );
}

async function iniciarPagina({
  identificarSocial = true
} = {}) {
  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

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

  if (identificarSocial) {
    await identificarMembroSocial();
  }

}


function iniciarPaginaComTratamento() {
  iniciarPagina()
    .catch(
      (error) => {
        console.error(
          "Erro ao iniciar página:",
          error?.message ||
          error,
          error
        );
      }
    );
}

async function solicitarLoginSocial() {
  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  let loginConcluido = false;

  try {
    await authentication.promptLogin({
      mode: "login",
      modal: true
    });
    loginConcluido = true;
  } catch (_) {
    loginConcluido = false;
  }

  if (!paginaLoginSocialAtiva()) {
    cancelarPopupAgendado();
    return;
  }

  if (!loginConcluido) {
    identificado = false;
    bloquearSemIdentificacao();
    agendarRetornoLoginSocial();
    return;
  }

  const membro = await aguardarMembroLogado(10000);

  if (membro?._id) {
    cancelarPopupAgendado();
    await identificarMembroSocial(membro);
    return;
  }

  identificado = false;
  bloquearSemIdentificacao();
  agendarRetornoLoginSocial();
}

function iniciarDepoisDeRender() {
  iniciarPagina({
    identificarSocial: false
  })
    .then(async () => {
      if (
        !paginaLoginSocialAtiva() ||
        !projeto
      ) {
        cancelarPopupAgendado();
        return;
      }

      /*
        REGRA DA PÁGINA PROTEGIDA:
        - primeiro renderiza título, thumbnail, setas e os três botões;
        - enquanto estiver deslogado, os valores ficam escondidos;
        - os três botões permanecem bloqueados;
        - só depois do conteúdo estar pronto verificamos o membro;
        - se estiver deslogado, o login abre após 5 segundos;
        - se fechar o login, ele volta após POPUP_REOPEN_DELAY;
        - a regra vale igualmente para desktop e mobile.
      */
      let membro = null;

      try {
        membro = await currentMember.getMember();
      } catch (_) {}

      if (!membro?._id) {
        try {
          if (authentication.loggedIn()) {
            membro = await aguardarMembroLogado(10000);
          }
        } catch (_) {}
      }

      if (membro?._id) {
        cancelarPopupAgendado();
        await identificarMembroSocial(membro);
        return;
      }

      identificado = false;
      bloquearSemIdentificacao();

      // PB_LOGIN_PASSIVO_V1: não abrir login sozinho ao carregar a página.
      agendarRetornoLoginSocial(
        MOBILE_LOGIN_AFTER_RENDER_DELAY
      );
    })
    .catch(
      (error) => {
        console.error(
          "Erro ao preparar checkout protegido:",
          error?.message || error,
          error
        );
      }
    );
}

// ======================================================
// ON READY
// ======================================================

$w.onReady(
  function () {
    if (!paginaLoginSocialAtiva()) {
      cancelarPopupAgendado();
      return;
    }

    /*
      LOGIN MOBILE: o evento oficial do Wix é a confirmação principal.
      Isso evita pedir login de novo enquanto currentMember ainda está
      propagando a sessão criada pelo Google/Facebook no navegador móvel.
    */
    try {
      authentication.onLogin(async (memberApi) => {
        cancelarPopupAgendado();
        popupAberto = false;

        let membro = null;

        try {
          membro = await memberApi.getMember();
        } catch (_) {}

        if (!membro?._id) {
          membro = await aguardarMembroLogado(10000);
        }

        if (!membro?._id) return;

        try {
          await identificarMembroSocial(membro);
        } catch (error) {
          console.error(
            "Falha ao consolidar login do membro:",
            error?.message || error
          );
        }
      });
    } catch (error) {
      console.warn(
        "Não foi possível registrar confirmação de login:",
        error?.message || error
      );
    }

    /*
      Regra da página protegida: se o membro deslogar enquanto estiver aqui,
      não deixamos o checkout social aberto nem reabrimos o modal de login.
      O visitante volta imediatamente para a Home.
    */
    try {
      authentication.onLogout(() => {
        cancelarPopupAgendado();
        identificado = false;
        popupAberto = false;
        wixLocation.to("/");
      });
    } catch (error) {
      console.warn("Não foi possível registrar o redirecionamento após logout:", error?.message || error);
    }

    if (
      aplicarBloqueioManutencao()
    ) {
      return;
    }

    iniciarDepoisDeRender();
  }
);