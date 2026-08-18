import wixData from 'wix-data';

const COLECAO_RADIO = 'RadioPelegoBoxProdutos';

function formatarReal(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 'R$ --';

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
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
  } catch (erro) {
    console.error('[RADIO] Erro ao carregar valores:', erro);

    if ($w('#valorum')) $w('#valorum').text = 'R$ --';
    if ($w('#valordois')) $w('#valordois').text = 'R$ --';
  }
}

$w.onReady(async function () {
  await carregarValoresRadio();
});
