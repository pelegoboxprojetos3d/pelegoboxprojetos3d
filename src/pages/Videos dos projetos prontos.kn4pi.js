import wixData from "wix-data";
import wixLocation from "wix-location";

import {
  buscarProjetosProntos
} from "backend/buscaProjetosProntos.web";

// TÍTULO NO WIX: Videos dos projetos prontos
//
// R7
//
// BOTÃO VERDE:
// projeto feito do zero -> /checkout-mp
// SKU recebido da coluna codigo_checkout.
//
// BOTÃO ROXO:
// projeto pronto -> /checkoutprojetosprontos
// usando o código público do projeto.
//
// BOTÃO AZUL:
// vídeo no YouTube.

function safe(value) {
  return String(value ?? "").trim();
}

function onlyDigits(value) {
  return safe(value).replace(/\D/g, "");
}

function numberValue(...values) {
  for (const value of values) {
    if (
      value === undefined ||
      value === null ||
      safe(value) === ""
    ) {
      continue;
    }

    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return 0;
}

function normalizeBrand(value) {
  try {
    return decodeURIComponent(
      safe(value)
    )
      .replace(/\+/g, " ")
      .trim();
  } catch (error) {
    return safe(value)
      .replace(/\+/g, " ")
      .trim();
  }
}

function decodeTitle(value) {
  return safe(value)
    .replace(/&amp;quot;/gi, '"')
    .replace(
      /&quot;|&#34;|&#x22;/gi,
      '"'
    )
    .replace(
      /&apos;|&#39;/gi,
      "'"
    )
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value) {
  return decodeTitle(value)
    .split(
      /\bPELEGO(?:\s*BOX)?\b/i
    )[0]
    .replace(/\s+/g, " ")
    .trim();
}

function mediaUrl(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    return safe(
      value.src ||
      value.url ||
      value.fileUrl
    );
  }

  return "";
}

function projectCode(itemData) {
  const direct = onlyDigits(
    itemData?.ordem_video ||
    itemData?.ordemVideo ||
    itemData?.codigoProjeto
  );

  if (direct) {
    return direct;
  }

  const title = cleanTitle(
    itemData?.titulo_video
  );

  const match = title.match(
    /^\s*#?\s*(\d+)/
  );

  return match
    ? match[1]
    : "";
}

/*
  SKU usado somente quando o botão verde abre
  o checkout de projeto feito do zero.

  A origem correta é a coluna codigo_checkout
  da coleção Videosprojetos.

  Exemplos:
  codigo_checkout = "003" -> SKU "003"
  codigo_checkout = 3     -> SKU "003"
  codigo_checkout = "014" -> SKU "014"

  Não existe mais fallback PRJ01804.
*/
function zeroProjectSku(itemData) {
  const rawValue =
    itemData?.codigo_checkout ??
    itemData?.codigoCheckout ??
    "";

  const value = safe(rawValue);

  if (!value) {
    return "";
  }

  const digits = onlyDigits(value);

  /*
    Para os códigos de questionário:
    001 até 014.
  */
  if (
    digits &&
    digits.length <= 3
  ) {
    return digits.padStart(
      3,
      "0"
    );
  }

  /*
    Caso futuramente a coluna receba outro
    formato de texto, preservamos o conteúdo.
  */
  return value;
}

function totalProjectValue(itemData) {
  const measures = numberValue(
    itemData?.valor_medidas,
    itemData?.valor_etapa_1
  );

  const graphics = numberValue(
    itemData?.valor_graficos,
    itemData?.valor_etapa_2
  );

  const complete = numberValue(
    itemData?.valor_projeto,
    itemData?.valor_etapa_3
  );

  return (
    measures +
    graphics +
    complete
  );
}

function buildZeroCheckoutUrl({
  itemData,
  title,
  code
}) {
  const sku =
    zeroProjectSku(itemData);

  /*
    Sem codigo_checkout não abrimos o checkout.
    Melhor bloquear o botão do que inventar SKU.
  */
  if (!sku) {
    console.error(
      "codigo_checkout não informado para o projeto:",
      {
        projeto: code,
        itemId: safe(itemData?._id),
        titulo: title
      }
    );

    return "";
  }

  const image = mediaUrl(
    itemData?.thumbnail ||
    itemData?.imagem ||
    itemData?.image
  );

  const price =
    totalProjectValue(itemData);

  const returnUrl =
    wixLocation.url;

  return (
    "/checkout-mp" +
    `?name=${encodeURIComponent(title)}` +
    `&produto=${encodeURIComponent(title)}` +
    `&sku=${encodeURIComponent(sku)}` +
    `&codigoCheckout=${encodeURIComponent(sku)}` +
    `&productId=${encodeURIComponent(safe(itemData?._id))}` +
    `&img=${encodeURIComponent(image)}` +
    `&price=${encodeURIComponent(String(price))}` +
    `&valor=${encodeURIComponent(String(price))}` +
    `&codigoProjeto=${encodeURIComponent(code)}` +
    `&returnUrl=${encodeURIComponent(returnUrl)}`
  );
}

function buildReadyCheckoutUrl(
  itemData
) {
  /*
    Para comprar o projeto pronto, usamos
    o código público do projeto.

    Exemplo:
    projeto 1816
    -> /checkoutprojetosprontos?codigo=1816
  */

  const code =
    projectCode(itemData);

  return code
    ? (
      "/checkoutprojetosprontos" +
      `?codigo=${encodeURIComponent(code)}`
    )
    : "";
}

const READY_PROJECTS_ROUTE =
  "/videos-dos-projetos-prontos";

function optionalElement(selector) {
  try {
    return $w(selector);
  } catch (_) {
    return null;
  }
}

function currentSearchTerm() {
  return safe(
    wixLocation.query.busca
  );
}

function setSearchStatus(
  message
) {
  const status =
    optionalElement(
      "#txtStatusBusca"
    );

  if (status) {
    status.text =
      safe(message);
  }
}

function configureSearchBox() {
  const input =
    optionalElement(
      "#inputBuscaProjetos"
    );

  const button =
    optionalElement(
      "#btnBuscarProjetos"
    );

  if (!input || !button) {
    return;
  }

  input.value =
    currentSearchTerm();

  const submit = () => {
    const term =
      safe(input.value);

    const url = term
      ? (
        READY_PROJECTS_ROUTE +
        `?busca=${encodeURIComponent(term)}`
      )
      : READY_PROJECTS_ROUTE;

    wixLocation.to(url);
  };

  button.onClick(submit);

  input.onKeyPress(
    (event) => {
      if (
        event.key === "Enter"
      ) {
        submit();
      }
    }
  );
}

async function applyProjectSearch() {
  const term =
    currentSearchTerm();

  if (!term) {
    return false;
  }

  setSearchStatus(
    "Procurando os melhores projetos..."
  );

  const response =
    await buscarProjetosProntos(
      term,
      36
    );

  if (!response?.ok) {
    throw new Error(
      response?.error ||
      "A busca não respondeu."
    );
  }

  const results =
    Array.isArray(
      response.resultados
    )
      ? response.resultados
      : [];

  const ids =
    results
      .map(
        (item) =>
          safe(item?._id)
      )
      .filter(Boolean);

  const filter = ids.length
    ? wixData
        .filter()
        .hasSome(
          "_id",
          ids
        )
    : wixData
        .filter()
        .eq(
          "_id",
          "__nenhum_projeto__"
        );

  await $w("#dataset1")
    .setFilter(filter);

  if (response.fallback) {
    $w("#txtTituloPagina").text =
      "Sugestões de projetos prontos";

    setSearchStatus(
      `Não encontramos exatamente "${term}". Veja estas sugestões.`
    );
  } else {
    $w("#txtTituloPagina").text =
      `Resultados para "${term}"`;

    setSearchStatus(
      `${ids.length} projeto(s) encontrado(s).`
    );
  }

  return true;
}

async function applyBrandFilter() {
  const brand = normalizeBrand(
    wixLocation.query.marca
  );

  if (!brand) {
    return;
  }

  $w("#txtTituloPagina").text =
    `Projetos prontos para alto-falantes da marca ${brand}`;

  const filter = wixData
    .filter()
    .eq("marca_1", brand)
    .or(
      wixData
        .filter()
        .eq("marca_2", brand)
    )
    .or(
      wixData
        .filter()
        .eq("marca_3", brand)
    );

  await $w("#dataset1")
    .setFilter(filter);
}

function configureRepeater() {
  $w("#repeater1").onItemReady(
    ($item, itemData) => {
      const title = cleanTitle(
        itemData?.titulo_video
      );

      const code = projectCode(
        itemData
      );

      $item("#text103").text =
        title;

      // ========================================
      // BOTÃO AZUL — VÍDEO
      // ========================================

      $item("#checkVideo").checked =
        false;

      $item("#checkVideo").hide();

      const videoUrl = safe(
        itemData?.link_video
      );

      if (videoUrl) {
        $item("#btnProjetos").show();
        $item("#btnProjetos").enable();

        $item("#btnProjetos").link =
          videoUrl;

        $item("#btnProjetos").target =
          "_blank";

        $item("#btnProjetos").onClick(
          () => {
            $item("#checkVideo").show();

            $item("#checkVideo").checked =
              true;
          }
        );
      } else {
        $item("#btnProjetos").disable();
      }

      // ========================================
      // BOTÃO VERDE — PROJETO FEITO DO ZERO
      // ID: #btnOrcamento
      //
      // SKU = codigo_checkout
      // ========================================

      const zeroCheckoutUrl =
        buildZeroCheckoutUrl({
          itemData,
          title,
          code
        });

      $item("#btnOrcamento").show();

      if (zeroCheckoutUrl) {
        $item("#btnOrcamento").enable();

        $item("#btnOrcamento").link =
          zeroCheckoutUrl;

        $item("#btnOrcamento").target =
          "_self";
      } else {
        /*
          Não existe codigo_checkout.
          Bloqueia para não enviar dado falso.
        */
        $item("#btnOrcamento").disable();

        $item("#btnOrcamento").link =
          "";
      }

      // ========================================
      // BOTÃO ROXO — PROJETO PRONTO
      // ID: #buttonCOMPRAR
      // ========================================

      const readyCheckoutUrl =
        buildReadyCheckoutUrl(
          itemData
        );

      $item("#buttonCOMPRAR").show();

      if (readyCheckoutUrl) {
        $item("#buttonCOMPRAR").enable();

        $item("#buttonCOMPRAR").link =
          readyCheckoutUrl;

        $item("#buttonCOMPRAR").target =
          "_self";
      } else {
        $item("#buttonCOMPRAR").disable();
      }
    }
  );
}

$w.onReady(
  async function () {
    configureRepeater();
    configureSearchBox();

    try {
      const searched =
        await applyProjectSearch();

      if (!searched) {
        await applyBrandFilter();
      }
    } catch (error) {
      console.error(
        "Erro ao buscar projetos prontos:",
        error?.message || error,
        error
      );

      setSearchStatus(
        "Não foi possível pesquisar agora. Tente novamente."
      );
    }
  }
);