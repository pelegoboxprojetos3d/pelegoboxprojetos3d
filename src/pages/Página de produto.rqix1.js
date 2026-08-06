// PRODUTO (FRONTEND) — PADRÃO FIFA R5.10

import wixLocation from "wix-location";

let bound = false;
let redirecting = false;
let lastClickAt = 0;

function getPrice(product) {
  const p = product?.priceData?.price;
  if (typeof p === "number") return p;

  const fp = product?.formattedPrice;
  if (typeof fp === "string" && fp.trim()) {
    const raw = fp.replace(/[^\d,]/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getSku(product) {
  return String(product?.sku || product?.stockKeepingUnit || "");
}

function toPublicWixUrl(url) {
  const s = String(url || "");
  const m = s.match(/^wix:image:\/\/v1\/([^\/?#]+)\//i);
  if (m && m[1]) return `https://static.wixstatic.com/media/${m[1]}`;
  return s;
}

function pick(...vals) {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function getImgUrl(product) {
  const mi0 = product?.mediaItems?.[0] || {};
  const mm = product?.mainMedia || {};
  const raw = pick(
    mm?.image?.url,
    mm?.url,
    mm?.src,
    mi0?.image?.url,
    mi0?.url,
    mi0?.src,
    product?.media?.mainMedia?.image?.url,
    product?.media?.items?.[0]?.image?.url,
    product?.media?.items?.[0]?.url
  );
  return toPublicWixUrl(raw);
}

function unlockSoon() {
  setTimeout(() => { redirecting = false; }, 1500);
}

$w.onReady(function () {

  // ==================================================
  // DETECTAR RETORNO DO MERCADO PAGO
  // ==================================================

  const q = wixLocation.query;

  const status = q.status || q.collection_status;
  const checkoutId = q.external_reference;

  if (status === "approved" && checkoutId) {

    wixLocation.to(
      `/agradecimentos-mercado-pago?checkout_id=${checkoutId}`
    );

    return;
  }

  // ==================================================

  if (bound) return;
  bound = true;

  const pp = $w("#productPage1");
  if (!pp) return;

  pp.onAddToCart((resume, cancel) => {
    const now = Date.now();

    if (redirecting || (now - lastClickAt) < 900) {
      cancel();
      return;
    }

    lastClickAt = now;
    redirecting = true;
    cancel();

    pp.getProduct()
      .then((product) => {
        const name = String(product?.name || "Produto");
        const sku = getSku(product);
        const productId = String(product?._id || product?.id || "");
        const price = getPrice(product);
        const img = getImgUrl(product);

        const returnUrl = encodeURIComponent(wixLocation.url);

        const url =
          `/checkout-mp?name=${encodeURIComponent(name)}` +
          `&sku=${encodeURIComponent(sku)}` +
          `&productId=${encodeURIComponent(productId)}` +
          `&price=${encodeURIComponent(String(price))}` +
          `&img=${encodeURIComponent(img)}` +
          `&returnUrl=${returnUrl}`;

        wixLocation.to(url);
      })
      .catch(() => { unlockSoon(); });

    unlockSoon();
  });

});