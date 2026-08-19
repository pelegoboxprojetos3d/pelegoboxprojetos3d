import wixData from "wix-data";
import wixLocation from "wix-location";
import wixWindowFrontend from "wix-window-frontend";

// TÍTULO NO WIX: Videos dos projetos prontos
// R12 - catálogo por marca + busca básica por texto

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
    if (value === undefined || value === null || safe(value) === "") {
      continue;
    }

    const number = Number(value);

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return 0;
}

function decodeQueryValue(value) {
  try {
    return decodeURIComponent(safe(value))
      .replace(/\+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (error) {
    return safe(value)
      .replace(/\+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

function normalizeBrand(value) {
  return decodeQueryValue(value);
}

function decodeTitle(value) {
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

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "object") {
    return safe(value.src || value.url || value.fileUrl);
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

  [itemData?.marca_1, itemData?.marca_2, itemData?.marca_3]
    .filter(Boolean)
    .forEach((brand) => {
      safe(brand)
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => {
          brandWords.set(word.toLocaleLowerCase("pt-BR"), word);
        });
    });

  return decoded
    .split(/\s+/)
    .map((token, index) => {
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
    .split(/\bPELEGO(?:\s*BOX)?\b/i)[0]
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

  const title = cleanTitle(itemData?.titulo_video);
  const match = title.match(/^\s*#?\s*(\d+)/);

  return match ? match[1] : "";
}

function totalProjectValue(itemData) {
  const measures = numberValue(itemData?.valor_medidas, itemData?.valor_etapa_1);
  const graphics = numberValue(itemData?.valor_graficos, itemData?.valor_etapa_2);
  const complete = numberValue(itemData?.valor_projeto, itemData?.valor_etapa_3);

  return measures + graphics + complete;
}

function buildZeroCheckoutUrl({ itemData, title, code }) {
  const checkoutTitle = checkoutDisplayTitle(
    itemData?.titulo_video || title,
    itemData
  );

  const image = mediaUrl(
    itemData?.thumbnail || itemData?.imagem || itemData?.image
  );

  const price = totalProjectValue(itemData);

  if (!checkoutTitle) {
    console.error("titulo_video não informado para o checkout de projeto feito do zero:", {
      projeto: code,
      itemId: safe(itemData?._id)
    });
    return "";
  }

  if (!(price > 0)) {
    console.error("Preço inválido para o checkout de projeto feito do zero:", {
      projeto: code,
      itemId: safe(itemData?._id),
      titulo: checkoutTitle,
      price
    });
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

function buildReadyCheckoutUrl(itemData) {
  const code = projectCode(itemData);

  const brand =
    normalizeBrand(wixLocation.query.marca) ||
    normalizeBrand(itemData?.marca_1) ||
    normalizeBrand(itemData?.marca_2) ||
    normalizeBrand(itemData?.marca_3);

  if (!code) {
    return "";
  }

  return (
    "/checkoutprojetosprontos" +
    `?codigo=${encodeURIComponent(code)}` +
    (brand ? `&marca=${encodeURIComponent(brand)}` : "")
  );
}

const SEARCH_STOPWORDS = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas",
  "de", "da", "das", "do", "dos", "e", "em", "no", "na", "nos", "nas",
  "para", "pra", "pro", "por", "com", "sem", "quero", "queria", "preciso",
  "procuro", "procurando", "gostaria", "me", "meu", "minha", "meus", "minhas",
  "eu", "que", "qual", "tipo", "tem", "ter", "caixa"
]);

function searchTerms(value) {
  return decodeQueryValue(value)
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9à-öø-ÿ#.'\"-]+/gi, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term) => !SEARCH_STOPWORDS.has(term))
    .filter((term) => term.length > 1 || /\d/.test(term))
    .slice(0, 6);
}

function termVariants(term) {
  const variants = new Set([
    term,
    term.toLocaleUpperCase("pt-BR"),
    term.charAt(0).toLocaleUpperCase("pt-BR") + term.slice(1)
  ]);

  const accentMap = {
    canhao: ["canhão", "CANHÃO", "Canhão"],
    cornetao: ["cornetão", "CORNETÃO", "Cornetão"],
    trio: ["trio", "TRIO", "Trio"]
  };

  (accentMap[term] || []).forEach((item) => variants.add(item));
  return [...variants];
}

function containsAnyField(variant) {
  return wixData
    .filter()
    .contains("titulo_video", variant)
    .or(wixData.filter().contains("marca_1", variant))
    .or(wixData.filter().contains("marca_2", variant))
    .or(wixData.filter().contains("marca_3", variant));
}

function filterForTerm(term) {
  const variants = termVariants(term);
  let filter = containsAnyField(variants[0]);

  for (let index = 1; index < variants.length; index += 1) {
    filter = filter.or(containsAnyField(variants[index]));
  }

  return filter;
}

function buildSearchFilter(value) {
  const terms = searchTerms(value);

  if (!terms.length) {
    return null;
  }

  let filter = filterForTerm(terms[0]);

  for (let index = 1; index < terms.length; index += 1) {
    filter = filter.and(filterForTerm(terms[index]));
  }

  return filter;
}

function buildBrandFilter(brand) {
  if (!brand) {
    return null;
  }

  return wixData
    .filter()
    .eq("marca_1", brand)
    .or(wixData.filter().eq("marca_2", brand))
    .or(wixData.filter().eq("marca_3", brand));
}

async function applyCatalogFilter() {
  const brand = normalizeBrand(wixLocation.query.marca);
  const search = decodeQueryValue(wixLocation.query.busca);

  const brandFilter = buildBrandFilter(brand);
  const searchFilter = buildSearchFilter(search);

  let filter = null;

  if (brandFilter && searchFilter) {
    filter = brandFilter.and(searchFilter);
  } else {
    filter = brandFilter || searchFilter;
  }

  if (search) {
    $w("#txtTituloPagina").text = brand
      ? `Projetos encontrados para sua busca: “${search}” • ${brand}`
      : `Projetos encontrados para sua busca: “${search}”`;
  } else if (brand) {
    $w("#txtTituloPagina").text =
      `Projetos prontos para alto-falantes da marca ${brand}`;
  }

  if (filter) {
    await $w("#dataset1").setFilter(filter);
  }
}

function updateNavigationState() {
  const dataset = $w("#dataset1");
  const previousButton = $w("#setaProjetoAnterior");
  const nextButton = $w("#setaProjetoProximo");

  try {
    dataset.hasPreviousPage()
      ? previousButton.enable()
      : previousButton.disable();

    dataset.hasNextPage()
      ? nextButton.enable()
      : nextButton.disable();
  } catch (error) {
    console.warn("Não foi possível atualizar o estado das setas:", error?.message || error);
  }
}

function configureProjectNavigation() {
  const dataset = $w("#dataset1");
  const previousButton = $w("#setaProjetoAnterior");
  const nextButton = $w("#setaProjetoProximo");

  previousButton.onClick(async () => {
    if (!dataset.hasPreviousPage()) {
      updateNavigationState();
      return;
    }

    previousButton.disable();
    nextButton.disable();

    try {
      await dataset.previousPage();
    } catch (error) {
      console.error("Erro ao voltar projetos:", error?.message || error, error);
    } finally {
      updateNavigationState();
    }
  });

  nextButton.onClick(async () => {
    if (!dataset.hasNextPage()) {
      updateNavigationState();
      return;
    }

    previousButton.disable();
    nextButton.disable();

    try {
      await dataset.nextPage();
    } catch (error) {
      console.error("Erro ao avançar projetos:", error?.message || error, error);
    } finally {
      updateNavigationState();
    }
  });

  updateNavigationState();
}

function configureRepeater() {
  $w("#repeater1").onItemReady(($item, itemData) => {
    const title = cleanTitle(itemData?.titulo_video);
    const code = projectCode(itemData);

    $item("#text103").text = title;

    $item("#checkVideo").checked = false;
    $item("#checkVideo").hide();

    const videoUrl = safe(itemData?.link_video);

    if (videoUrl) {
      $item("#btnProjetos").show();
      $item("#btnProjetos").enable();
      $item("#btnProjetos").link = videoUrl;
      $item("#btnProjetos").target = "_blank";

      $item("#btnProjetos").onClick(() => {
        $item("#checkVideo").show("fade");
        $item("#checkVideo").checked = true;
      });
    } else {
      $item("#btnProjetos").disable();
    }

    const zeroCheckoutUrl = buildZeroCheckoutUrl({ itemData, title, code });

    $item("#btnOrcamento").show();

    if (zeroCheckoutUrl) {
      $item("#btnOrcamento").enable();
      $item("#btnOrcamento").link = zeroCheckoutUrl;
      $item("#btnOrcamento").target = "_self";
    } else {
      $item("#btnOrcamento").disable();
      $item("#btnOrcamento").link = "";
    }

    const readyCheckoutUrl = buildReadyCheckoutUrl(itemData);

    $item("#buttonCOMPRAR").show();

    if (readyCheckoutUrl) {
      $item("#buttonCOMPRAR").enable();
      $item("#buttonCOMPRAR").link = readyCheckoutUrl;
      $item("#buttonCOMPRAR").target = "_self";
    } else {
      $item("#buttonCOMPRAR").disable();
    }
  });
}

$w.onReady(async function () {
  configureRepeater();

  try {
    await new Promise((resolve) => {
      $w("#dataset1").onReady(resolve);
    });

    await $w("#dataset1").setPageSize(projectsPerPage());
    await applyCatalogFilter();
    configureProjectNavigation();
  } catch (error) {
    console.error(
      "Erro ao preparar projetos e navegação:",
      error?.message || error,
      error
    );
  }
});