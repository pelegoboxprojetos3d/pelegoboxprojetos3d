const fs = require("fs");
const path = require("path");

const file = path.join(process.cwd(), "src", "backend", "http-functions.js");
let source = fs.readFileSync(file, "utf8");

const marker = "// PELEGO_RADIO_CATALOGO_PUBLICO_V1";

if (source.includes(marker)) {
  console.log("Endpoint PELEGO RADIO já presente; nada a fazer.");
  process.exit(0);
}

const block = String.raw`

// ======================================================
// PELEGO RADIO - CATÁLOGO PÚBLICO
// ROTA: /_functions/pelegoRadioCatalog
//
// Somente dados públicos de catálogo. Não expõe clientes,
// pagamentos, compras ou qualquer dado privado.
// ======================================================
// PELEGO_RADIO_CATALOGO_PUBLICO_V1

function radioClamp(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function radioDecodeTitle(value) {
  return safe(value)
    .replace(/&amp;quot;/gi, '"')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function radioImageUrl(value) {
  const raw = safe(
    typeof value === "object"
      ? (value?.src || value?.url || value?.fileUrl)
      : value
  );

  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const wixImage = raw.match(/^wix:image:\/\/v1\/([^/]+)\//i);
  if (wixImage?.[1]) {
    return `https://static.wixstatic.com/media/${wixImage[1]}`;
  }

  return raw;
}

function radioProjectCode(item = {}) {
  const direct = onlyDigits(
    item?.ordem_video ||
    item?.ordemVideo ||
    item?.codigoProjeto
  );

  if (direct) {
    return direct;
  }

  const title = radioDecodeTitle(item?.titulo_video);
  const match = title.match(/^\s*#?\s*(\d+)/);
  return match ? match[1] : "";
}

function radioCorsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=30"
  };
}

export async function get_pelegoRadioCatalog(request) {
  try {
    const kind = safe(request?.query?.kind).toLowerCase();
    const limit = radioClamp(request?.query?.limit, 1, 50, 1);
    const offset = radioClamp(request?.query?.offset, 0, 100000, 0);

    if (kind !== "zero" && kind !== "pronto") {
      return badRequest({
        headers: radioCorsHeaders(),
        body: {
          ok: false,
          error: "kind deve ser zero ou pronto"
        }
      });
    }

    if (kind === "zero") {
      const result = await wixData
        .query("Stores/Products")
        .eq("ribbon", "Feito do Zero")
        .ascending("sku")
        .skip(offset)
        .limit(limit)
        .find(DB_OPTS);

      const items = (result.items || []).map((item) => ({
        id: safe(item?._id),
        sku: safe(item?.sku),
        brand: safe(item?.brand || "PELEGO BOX"),
        title: safe(item?.name).toUpperCase(),
        image: radioImageUrl(item?.mainMedia),
        buyUrl: item?.productPageUrl
          ? `https://www.pelegobox.com.br${safe(item.productPageUrl)}`
          : "",
        slug: safe(item?.slug)
      }));

      return ok({
        headers: radioCorsHeaders(),
        body: {
          ok: true,
          kind: "zero",
          total: Number(result.totalCount || 0),
          offset,
          limit,
          items
        }
      });
    }

    const result = await wixData
      .query("Videosprojetos")
      .eq("ativo_checkout", "SIM")
      .descending("ordem_video")
      .skip(offset)
      .limit(limit)
      .find(DB_OPTS);

    const items = (result.items || []).map((item) => {
      const code = radioProjectCode(item);
      const brand = safe(item?.marca_1 || item?.marca_2 || item?.marca_3);
      const title = radioDecodeTitle(item?.titulo_video).toUpperCase();

      return {
        id: safe(item?._id),
        code,
        brand,
        title,
        image: radioImageUrl(item?.thumbnail),
        videoUrl: safe(item?.link_video),
        buyUrl: code
          ? `https://www.pelegobox.com.br/checkoutprojetosprontos?codigo=${encodeURIComponent(code)}${brand ? `&marca=${encodeURIComponent(brand)}` : ""}`
          : ""
      };
    });

    return ok({
      headers: radioCorsHeaders(),
      body: {
        ok: true,
        kind: "pronto",
        total: Number(result.totalCount || 0),
        offset,
        limit,
        items
      }
    });
  } catch (error) {
    console.error(
      "PELEGO RADIO catálogo:",
      error?.message || error
    );

    return serverError({
      headers: radioCorsHeaders(),
      body: {
        ok: false,
        error: "catalogo_indisponivel"
      }
    });
  }
}
`;

source = source.trimEnd() + block + "\n";
fs.writeFileSync(file, source, "utf8");
console.log("Endpoint PELEGO RADIO adicionado a backend/http-functions.js");
