import wixData from 'wix-data';
import wixLocation from 'wix-location';

const COLECAO_RADIO = 'RadioPelegoBoxProdutos';
const CODIGOS_CHECKOUT = {
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

function montarCheckout(item) {
  const codigoRadio = safe(item?.codigo);
  const codigoProjeto = CODIGOS_CHECKOUT[codigoRadio];
  const titulo = safe(item?.title) || 'Rádio Pelego Box';
  const valor = Number(item?.valor || 0);
  const linkEntrega = safe(item?.linkEntrega);

  if (!codigoProjeto || !(valor > 0)) return '';

  const params = new URLSearchParams({
    codigoProjeto,
    tipoProduto: 'PROJETO_COMPLETO',
    produto: titulo,
    titulo,
    tituloOriginal: titulo,
    valor: String(valor),
    price: String(valor),
    radioCodigo: codigoRadio,
    radioProduto: '1',
    returnUrl: '/radiopelegobox',
  });

  if (linkEntrega) params.set('radioLinkEntrega', linkEntrega);

  return `/checkout-projeto-pronto?${params.toString()}`;
}

function ligarBotao(id, item) {
  try {
    const elemento = $w(id);
    const destino = montarCheckout(item);
    if (!destino || typeof elemento?.onClick !== 'function') return;

    elemento.onClick(() => {
      wixLocation.to(destino);
    });
  } catch (erro) {
    console.warn(`[RADIO] Não foi possível ligar ${id}:`, erro?.message || erro);
  }
}

async function carregarRadio() {
  try {
    const resultado = await wixData
      .query(COLECAO_RADIO)
      .hasSome('codigo', ['RADIO-PC', 'RADIO-CELULAR'])
      .limit(10)
      .find();

    const pc = resultado.items.find((item) => item.codigo === 'RADIO-PC');
    const celular = resultado.items.find((item) => item.codigo === 'RADIO-CELULAR');

    if ($w('#valorum')) $w('#valorum').text = formatarReal(pc?.valor);
    if ($w('#valordois')) $w('#valordois').text = formatarReal(celular?.valor);

    ligarBotao('#baixarpc', pc);
    ligarBotao('#baixarcelular', celular);
  } catch (erro) {
    console.error('[RADIO] Erro ao carregar produtos:', erro);
    if ($w('#valorum')) $w('#valorum').text = 'R$ --';
    if ($w('#valordois')) $w('#valordois').text = 'R$ --';
  }
}

$w.onReady(async function () {
  await carregarRadio();
});
