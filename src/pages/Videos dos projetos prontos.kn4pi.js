import wixData from "wix-data";
import wixLocation from "wix-location";

// TÍTULO NO WIX: Videos dos projetos prontos
//
// R8
//
// BOTÃO VERDE:
// projeto feito do zero -> /checkout-mp
// envia somente o título real da coleção + preço.
// NÃO depende de SKU nem de codigo_checkout.
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
    O checkout de Projetos Feitos do Zero é padrão e não é
    alterado aqui. Apenas montamos a URL de entrada.

    O título vem DIRETAMENTE de titulo_video, sem remover o
    código do questionário que já está incorporado ao final.

    Não enviamos SKU e não usamos codigo_checkout.
  */
  const checkoutTitle = decodeTitle(
    itemData?.titulo_video || title
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
      // título = titulo_video completo da coleção
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
      await applyBrandFilter();
    } catch (error) {
      console.error(
        "Erro ao filtrar projetos pela marca:",
        error?.message || error,
        error
      );
    }
  }
);