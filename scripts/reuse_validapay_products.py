from pathlib import Path


def js_helper(api_name: str, pix: bool = False) -> str:
    text = r'''
async function buscarPriceIdExistenteValidaPay({ produto, valor }) {
  const nomeEsperado = normalizarTituloProduto(produto).toLowerCase();
  if (!nomeEsperado || !(Number(valor) > 0)) return "";

  try {
    const lista = await __LIST_CALL__;
    if (!lista.ok) return "";

    const items = lista.data?.items || lista.data?.data?.items || [];
    for (const item of items) {
      if (normalizarTituloProduto(item?.name).toLowerCase() !== nomeEsperado) continue;

      let detalhe = item;
      let prices = item?.prices || [];
      const productId = safe(item?.productId || item?.id);

      if ((!Array.isArray(prices) || !prices.length) && productId) {
        const respostaDetalhe = await __DETAIL_CALL__;
        if (respostaDetalhe.ok) detalhe = respostaDetalhe.data?.data || respostaDetalhe.data || detalhe;
        prices = detalhe?.prices || detalhe?.data?.prices || [];
      }

      const preco = (Array.isArray(prices) ? prices : []).find(price =>
        safe(price?.priceId || price?.id) &&
        Math.abs(Number(price?.amount || 0) - Number(valor || 0)) <= 0.01 &&
        (!safe(price?.recurrenceType) || safe(price?.recurrenceType).toUpperCase() === "ONE_TIME")
      );

      if (preco) return safe(preco?.priceId || preco?.id);
    }
  } catch (error) {
    console.warn("Não foi possível localizar produto existente na ValidaPay:", error?.message || error);
  }

  return "";
}
'''
    search_path = '`/v1/products?limit=50&status=active&search=${encodeURIComponent(produto)}`'
    detail_path = '`/v1/products/${encodeURIComponent(productId)}`'
    if pix:
        list_call = f'requestValidaPay({search_path}, "get")'
        detail_call = f'requestValidaPay({detail_path}, "get")'
    else:
        list_call = f'api("get", {search_path})'
        detail_call = f'api("get", {detail_path})'
    return text.replace('__LIST_CALL__', list_call).replace('__DETAIL_CALL__', detail_call)


# CARTÃO
p = Path('src/backend/validaPayCartaoProjetosProntos.jsw')
s = p.read_text(encoding='utf-8')
old_scope = 'scope=${encodeURIComponent("checkouts/write products/write checkouts/read pix.cob/read")}'
new_scope = 'scope=${encodeURIComponent("checkouts/write products/write products/read checkouts/read pix.cob/read")}'
if old_scope in s:
    s = s.replace(old_scope, new_scope, 1)
elif 'products/read' not in s:
    raise SystemExit('Escopo esperado do cartão não encontrado')

marker = 'async function reusablePriceId({ codigoProjeto, tipoProduto, produto, valor }) {'
if 'async function buscarPriceIdExistenteValidaPay' not in s:
    if marker not in s:
        raise SystemExit('Ponto de helper do cartão não encontrado')
    s = s.replace(marker, js_helper('api', pix=False) + '\n' + marker, 1)

old = '''  const reused = await reusablePriceId({ codigoProjeto, tipoProduto, produto, valor });
  if (reused) {
    await saveSession(checkoutId, { validaPayPriceId: reused, updatedAtDate: new Date() });
    return reused;
  }

  const response = await api("post", "/v1/products", {'''
new = '''  const reused = await reusablePriceId({ codigoProjeto, tipoProduto, produto, valor });
  if (reused) {
    await saveSession(checkoutId, { validaPayPriceId: reused, updatedAtDate: new Date() });
    return reused;
  }

  const providerReused = await buscarPriceIdExistenteValidaPay({ produto, valor });
  if (providerReused) {
    await saveSession(checkoutId, { validaPayPriceId: providerReused, updatedAtDate: new Date() });
    return providerReused;
  }

  const response = await api("post", "/v1/products", {'''
if 'const providerReused = await buscarPriceIdExistenteValidaPay' not in s:
    if old not in s:
        raise SystemExit('ensurePriceId do cartão não encontrado')
    s = s.replace(old, new, 1)
p.write_text(s.rstrip() + '\n', encoding='utf-8')


# PIX
p = Path('src/backend/validaPayPixProjetosProntosCore.jsw')
s = p.read_text(encoding='utf-8')
old_request = 'const scope = method.toLowerCase() === "post" ? "checkouts/write products/write checkouts/read" : "pix.cob/read";'
new_request = '''const lowerMethod = method.toLowerCase();
  const scope = lowerMethod === "post"
    ? "checkouts/write products/write products/read checkouts/read"
    : path.startsWith("/v1/products")
      ? "products/read"
      : "pix.cob/read";'''
if old_request in s:
    s = s.replace(old_request, new_request, 1)
elif 'path.startsWith("/v1/products")' not in s:
    raise SystemExit('Seleção de escopo do Pix não encontrada')

marker = 'async function reusablePriceId({ codigoProjeto, tipoProduto, produto, valor }) {'
if 'async function buscarPriceIdExistenteValidaPay' not in s:
    if marker not in s:
        raise SystemExit('Ponto de helper do Pix não encontrado')
    s = s.replace(marker, js_helper('requestValidaPay', pix=True) + '\n' + marker, 1)

old = '''  if (reused) {
    await saveSession(checkoutId, { validaPayPriceId: reused, updatedAtDate: new Date() });
    return reused;
  }

  const response = await requestValidaPay("/v1/products", "post", {'''
new = '''  if (reused) {
    await saveSession(checkoutId, { validaPayPriceId: reused, updatedAtDate: new Date() });
    return reused;
  }

  const providerReused = await buscarPriceIdExistenteValidaPay({ produto, valor });
  if (providerReused) {
    await saveSession(checkoutId, { validaPayPriceId: providerReused, updatedAtDate: new Date() });
    return providerReused;
  }

  const response = await requestValidaPay("/v1/products", "post", {'''
if 'const providerReused = await buscarPriceIdExistenteValidaPay' not in s:
    if old not in s:
        raise SystemExit('ensurePriceId do Pix não encontrado')
    s = s.replace(old, new, 1)
p.write_text(s.rstrip() + '\n', encoding='utf-8')
