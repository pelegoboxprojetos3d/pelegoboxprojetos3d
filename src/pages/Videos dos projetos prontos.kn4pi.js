import wixData from "wix-data";
import wixLocation from "wix-location";
import wixWindowFrontend from "wix-window-frontend";

// TÍTULO NO WIX: Videos dos projetos prontos
//
// R11
//
// BOTÃO VERDE:
// projeto feito do zero -> /checkout-mp
// envia título da coleção, thumbnail e preço.
// NÃO depende de SKU nem de codigo_checkout.
//
// BOTÃO ROXO:
// projeto pronto -> /checkoutprojetosprontos
// usando o código público do projeto.
//
// BOTÃO AZUL:
// vídeo no YouTube.
//
// NAVEGAÇÃO:
// desktop/tablet: 2 projetos por página.
// celular: 1 projeto por página.
// usando as setas #setaProjetoAnterior e #setaProjetoProximo.

const DESKTOP_PROJECTS_PER_PAGE = 2;
const MOBILE_PROJECTS_PER_PAGE = 1;

function projectsPerPage() {
  return wixWindowFrontend.formFactor === "Mobile"
    ? MOBILE_PROJECTS_PER_PAGE
    : DESKTOP_PROJECTS_PER_PAGE;
}

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

function checkoutDisplayTitle(value, itemData = {}) {
  const decoded = decodeTitle(value);

  if (!decoded) {
    return "";
  }

  const connectors = new Set([
    "a", "as", "o", "os",
    "de", "da", "das", "do", "dos",
    "e", "em", "no", "na", "nos", "nas",
    "para", "por", "com", "sem"
  ]);

  const brandWords = new Map();

  [
    itemData?.marca_1,
    itemData?.marca_2,
    itemData?.marca_3
  ]
    .filter(Boolean)
    .forEach((brand) => {
      safe(brand)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => {
          brandWords.set(
            word.toLocaleLowerCase("pt-BR"),
            word
          );
        });
    });

  return decoded
    .split(/\s+/)
    .map((token, index) => {
      /*
        Códigos, potências, medidas e modelos ficam intactos:
        #1818, 1X, 15SWV3.8, 1900W, 3D, 003 etc.
      */
      if (/\d/.test(token)) {
        return token;
      }

      const match = token.match(
        /^([^A-Za-zÀ-ÖØ-öø-ÿ]*)([A-Za-zÀ-ÖØ-öø-ÿ]+)([^A-Za-zÀ-ÖØ-öø-ÿ]*)$/
      );

      if (!match) {
        return token;
      }

      const prefix = match[1];
      const word = match[2];
      const suffix = match[3];
      const lower = word.toLocaleLowerCase("pt-BR");

      const brandWord = brandWords.get(lower);

      if (brandWord) {
        return prefix + brandWord + suffix;
      }

      if (connectors.has(lower) && index > 0) {
        return prefix + lower + suffix;
      }

      return (
        prefix +
        lower.charAt(0).toLocaleUpperCase("pt-BR") +
        lower.slice(1) +
        suffix
      );
    })
    .join(" ")
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
  /*
    Fluxo exclusivo do botão COMPRAR PROJETO FEITO DO ZERO.

    - título: titulo_video completo, incluindo código do questionário;
    - imagem: thumbnail da coleção;
    - preço: soma das três etapas;
    - SKU: não é enviado;
    - codigo_checkout: não é usado.
  */
  const checkoutTitle = checkoutDisplayTitle(
    itemData?.titulo_video || title,
    itemData
  );

  const image = mediaUrl(
    itemData?.thumbnail ||
    itemData?.imagem ||
    itemData?.image
  );

  const price = totalProjectValue(
    itemData
  );

  if (!checkoutTitle) {
    console.error(
      "titulo_video não informado para o checkout de projeto feito do zero:",
      {
        projeto: code,
        itemId: safe(itemData?._id)
      }
    );

    return "";
  }

  if (!(price > 0)) {
    console.error(
      "Preço inválido para o checkout de projeto feito do zero:",
      {
        projeto: code,
        itemId: safe(itemData?._id),
        titulo: checkoutTitle,
        price
      }
    );

    return "";
  }

  const returnUrl = wixLocation.url;

  return (
    "/checkout-mp" +
    `?name=${encodeURIComponent(checkoutTitle)}` +
    `&price=${encodeURIComponent(String(price))}` +
    `&img=${encodeURIComponent(image)}` +
    "&hideSku=1" +
    "&source=projeto-zero" +
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

  const brand =
    normalizeBrand(
      wixLocation.query.marca
    ) ||
    normalizeBrand(itemData?.marca_1) ||
    normalizeBrand(itemData?.marca_2) ||
    normalizeBrand(itemData?.marca_3);

  if (!code) {
    return "";
  }

  return (
    "/checkoutprojetosprontos" +
    `?codigo=${encodeURIComponent(code)}` +
    (brand
      ? `&marca=${encodeURIComponent(brand)}`
      : "")
  );
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

function updateNavigationState() {
  const dataset = $w("#dataset1");
  const previousButton = $w("#setaProjetoAnterior");
  const nextButton = $w("#setaProjetoProximo");

  try {
    if (dataset.hasPreviousPage()) {
      previousButton.enable();
    } else {
      previousButton.disable();
    }

    if (dataset.hasNextPage()) {
      nextButton.enable();
    } else {
      nextButton.disable();
    }
  } catch (error) {
    console.warn(
      "Não foi possível atualizar o estado das setas:",
      error?.message || error
    );
  }
}

function configureProjectNavigation() {
  const dataset = $w("#dataset1");
  const previousButton = $w("#setaProjetoAnterior");
  const nextButton = $w("#setaProjetoProximo");

  previousButton.onClick(
    async () => {
      if (!dataset.hasPreviousPage()) {
        updateNavigationState();
        return;
      }

      previousButton.disable();
      nextButton.disable();

      try {
        await dataset.previousPage();
      } catch (error) {
        console.error(
          "Erro ao voltar projetos:",
          error?.message || error,
          error
        );
      } finally {
        updateNavigationState();
      }
    }
  );

  nextButton.onClick(
    async () => {
      if (!dataset.hasNextPage()) {
        updateNavigationState();
        return;
      }

      previousButton.disable();
      nextButton.disable();

      try {
        await dataset.nextPage();
      } catch (error) {
        console.error(
          "Erro ao avançar projetos:",
          error?.message || error,
          error
        );
      } finally {
        updateNavigationState();
      }
    }
  );

  updateNavigationState();
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
            $item("#checkVideo").show("fade");

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
      // título = titulo_video completo da coleção
      // imagem = thumbnail
      // preço = soma dos valores configurados
      // sem SKU / sem codigo_checkout
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
        $item("#btnOrcamento").disable();
        $item("#btnOrcamento").link = "";
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

    try {
      await new Promise(
        (resolve) => {
          $w("#dataset1").onReady(resolve);
        }
      );

      await $w("#dataset1")
        .setPageSize(projectsPerPage());

      await applyBrandFilter();

      configureProjectNavigation();
    } catch (error) {
      console.error(
        "Erro ao preparar projetos e navegação:",
        error?.message || error,
        error
      );
    }
  }
);
