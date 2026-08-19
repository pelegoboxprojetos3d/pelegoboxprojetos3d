import wixData from 'wix-data';
import wixLocation from 'wix-location';

const COLECAO_RADIO = 'RadioPelegoBoxProdutos';
const PLAYER_ID = '#playerradiopelegobox';

const RADIO_CHECKOUT_CODE = {
  'RADIO-PC': '990001',
  'RADIO-CELULAR': '990002',
};

function formatarReal(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 'R$ --';

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

function safe(value) {
  return String(value ?? '').trim();
}

function imagemPublica(value) {
  const bruto = safe(
    typeof value === 'object'
      ? (
          value?.src ||
          value?.url ||
          value?.fileUrl ||
          value?.image?.url ||
          value?.image?.src ||
          value?.media?.image?.url
        )
      : value
  );

  if (!bruto) return '';
  if (/^https?:\/\//i.test(bruto)) return bruto;

  const wixImage = bruto.match(/^wix:image:\/\/v1\/([^/]+)\//i);
  if (wixImage?.[1]) {
    return `https://static.wixstatic.com/media/${wixImage[1]}`;
  }

  return bruto;
}

function montarQuery(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && safe(value) !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function checkoutRadioUrl(item) {
  const codigo = safe(item?.codigo).toUpperCase();
  const codigoProjeto = RADIO_CHECKOUT_CODE[codigo];
  const valor = Number(item?.valor || 0);
  const titulo = safe(item?.title) || 'Rádio Pelego Box';

  if (!codigoProjeto || !(valor > 0)) return '';

  const query = montarQuery({
    codigoProjeto,
    codigo: codigoProjeto,
    tipoProduto: 'PROJETO_COMPLETO',
    produto: titulo,
    titulo,
    tituloOriginal: titulo,
    tituloBase: titulo,
    valor: String(valor),
    price: String(valor),
    radioProduto: '1',
    radioCodigo: codigo,
    returnUrl: '/radiopelegobox',
  });

  return `/checkout-projeto-pronto?${query}`;
}

async function mostrarElemento(id) {
  try {
    const elemento = $w(id);
    if (!elemento) return;
    if (typeof elemento.expand === 'function') await elemento.expand();
    if (typeof elemento.show === 'function') await elemento.show();
  } catch (_) {}
}

async function ocultarElemento(id) {
  try {
    const elemento = $w(id);
    if (!elemento) return;
    if (typeof elemento.hide === 'function') await elemento.hide();
    if (typeof elemento.collapse === 'function') await elemento.collapse();
  } catch (_) {}
}

async function ocultarBotaoRadioNestaPagina() {
  // O atalho flutuante da Rádio faz sentido no restante do site, mas não dentro
  // da própria página da Rádio. Tentamos os dois IDs para cobrir o nome atual
  // no Editor e o ID anterior da imagem sem afetar nenhuma outra página.
  await Promise.allSettled([
    ocultarElemento('#botaoradio'),
    ocultarElemento('#image107'),
  ]);
}

async function garantirControlesRadioVisiveis() {
  await Promise.allSettled([
    mostrarElemento('#baixarpc'),
    mostrarElemento('#baixarcelular'),
    mostrarElemento('#valorum'),
    mostrarElemento('#valordois'),
  ]);
}

function ligarCheckoutRadio(id, item) {
  try {
    const botao = $w(id);
    const destino = checkoutRadioUrl(item);

    if (!botao) {
      console.warn(`[RADIO] Elemento ${id} não encontrado.`);
      return;
    }

    if (!destino) {
      console.warn(`[RADIO] Checkout não configurado para ${safe(item?.codigo) || id}.`);
      return;
    }

    // Link direto no próprio elemento. Isto funciona tanto para botão quanto
    // para imagem clicável e não depende apenas do evento onClick.
    try {
      if ('link' in botao) botao.link = destino;
      if ('target' in botao) botao.target = '_self';
      if ('clickAction' in botao) botao.clickAction = 'link';
    } catch (_) {}

    // Mantemos também o evento como fallback para elementos que não expõem link.
    if (typeof botao.onClick === 'function') {
      botao.onClick(() => {
        wixLocation.to(destino);
      });
    }
  } catch (erro) {
    console.error(`[RADIO] Não foi possível ligar ${id} ao checkout:`, erro?.message || erro);
  }
}

async function carregarValoresRadio() {
  try {
    const resultado = await wixData
      .query(COLECAO_RADIO)
      .hasSome('codigo', ['RADIO-PC', 'RADIO-CELULAR'])
      .limit(10)
      .find();

    const pc = resultado.items.find((item) => item.codigo === 'RADIO-PC');
    const celular = resultado.items.find((item) => item.codigo === 'RADIO-CELULAR');

    if ($w('#valorum')) {
      $w('#valorum').text = formatarReal(pc?.valor);
    }

    if ($w('#valordois')) {
      $w('#valordois').text = formatarReal(celular?.valor);
    }

    ligarCheckoutRadio('#baixarpc', pc);
    ligarCheckoutRadio('#baixarcelular', celular);
    await garantirControlesRadioVisiveis();
  } catch (erro) {
    console.error('[RADIO] Erro ao carregar valores:', erro);

    if ($w('#valorum')) $w('#valorum').text = 'R$ --';
    if ($w('#valordois')) $w('#valordois').text = 'R$ --';
  }
}

async function carregarProjetosDoZero() {
  try {
    const resultado = await wixData
      .query('Stores/Products')
      .eq('ribbon', 'Feito do Zero')
      .ascending('sku')
      .limit(20)
      .find();

    return (resultado.items || []).map((item) => ({
      id: safe(item?._id),
      sku: safe(item?.sku),
      brand: safe(item?.brand || 'PELEGO BOX'),
      title: safe(item?.name).toUpperCase(),
      image: imagemPublica(item?.mainMedia),
      buyUrl: item?.productPageUrl
        ? `https://www.pelegobox.com.br${safe(item.productPageUrl)}`
        : '',
    }));
  } catch (erro) {
    console.warn('[RADIO] Catálogo do zero indisponível:', erro?.message || erro);
    return [];
  }
}

function codigoProjeto(item = {}) {
  const direto = safe(
    item?.ordem_video ||
    item?.ordemVideo ||
    item?.codigoProjeto
  ).replace(/\D/g, '');

  if (direto) return direto;

  const match = safe(item?.titulo_video).match(/^\s*#?\s*(\d+)/);
  return match?.[1] || '';
}

async function carregarProjetosProntos() {
  try {
    const resultado = await wixData
      .query('Videosprojetos')
      .eq('ativo_checkout', 'SIM')
      .descending('ordem_video')
      .limit(20)
      .find();

    return (resultado.items || []).map((item) => {
      const code = codigoProjeto(item);
      const brand = safe(item?.marca_1 || item?.marca_2 || item?.marca_3);

      return {
        id: safe(item?._id),
        code,
        brand,
        title: safe(item?.titulo_video).toUpperCase(),
        image: imagemPublica(item?.thumbnail),
        buyUrl: code
          ? `https://www.pelegobox.com.br/checkoutprojetosprontos?codigo=${encodeURIComponent(code)}${brand ? `&marca=${encodeURIComponent(brand)}` : ''}`
          : '',
      };
    });
  } catch (erro) {
    console.warn('[RADIO] Catálogo de projetos prontos indisponível:', erro?.message || erro);
    return [];
  }
}

async function alimentarPlayer() {
  try {
    const player = $w(PLAYER_ID);
    if (!player || typeof player.setAttribute !== 'function') return;

    const [zero, prontos] = await Promise.all([
      carregarProjetosDoZero(),
      carregarProjetosProntos(),
    ]);

    player.setAttribute('catalog-zero-json', JSON.stringify(zero));
    player.setAttribute('catalog-pronto-json', JSON.stringify(prontos));
    player.setAttribute('app-version', '5.4.8');
  } catch (erro) {
    console.warn('[RADIO] Não foi possível alimentar o player:', erro?.message || erro);
  }
}

$w.onReady(async function () {
  await ocultarBotaoRadioNestaPagina();
  await garantirControlesRadioVisiveis();

  await Promise.allSettled([
    carregarValoresRadio(),
    alimentarPlayer(),
  ]);
});
