const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let text = fs.readFileSync(path, 'utf8');

const oldBlock = `async function renderizarEntrega(dados) {
  entrega = dados;
  checkoutEmAndamento = false;
  indiceGraficoDownload = 0;

  const projeto = dados?.project || {};

  salvarAcessosLocais(
    projeto?.codigoProjeto,
    dados?.access || {}
  );

  await mostrarDadosRepeater([
    itemRepeaterProjeto(dados, 0)
  ]);
}`;

const newBlock = `async function renderizarEntrega(dados) {
  entrega = dados;
  checkoutEmAndamento = false;
  indiceGraficoDownload = 0;

  const projeto = dados?.project || {};

  salvarAcessosLocais(
    projeto?.codigoProjeto,
    dados?.access || {}
  );

  /*
    Quando a página é aberta pelo checkout/e-mail, o checkout_id identifica
    apenas a compra recém-aberta. Isso não deve transformar a central do
    cliente em uma tela de um único projeto.

    A compra atual entra sempre primeiro, porque ela já foi validada e pode
    ainda não ter aparecido na listagem agregada. Em seguida carregamos os
    demais projetos da conta e eliminamos duplicidades pelo código do projeto.
    Se a central estiver momentaneamente indisponível, a compra atual continua
    sendo entregue normalmente, sem bloquear o pós-pagamento.
  */
  const projetosParaExibir = [dados];
  const codigoAtual = digits(projeto?.codigoProjeto);

  try {
    const resultadoCentral = await listarProjetosProntosDoMembroAtual();

    if (resultadoCentral?.ok && Array.isArray(resultadoCentral.items)) {
      const outrosResumos = resultadoCentral.items.filter((item) => {
        const codigo = digits(item?.codigoProjeto);
        return codigo && codigo !== codigoAtual;
      });

      if (outrosResumos.length) {
        const outrosDetalhes = await carregarDetalhesDaCentral(outrosResumos);
        projetosParaExibir.push(...outrosDetalhes);
      }
    }
  } catch (erro) {
    console.warn(
      'Falha ao agregar os demais projetos após a nova compra:',
      erro?.message || erro
    );
  }

  const vistos = new Set();
  const unicos = projetosParaExibir.filter((item) => {
    const codigo = digits(item?.project?.codigoProjeto);
    const chave = codigo || safe(item?.project?._id);
    if (!chave || vistos.has(chave)) {
      return false;
    }
    vistos.add(chave);
    return true;
  });

  await mostrarDadosRepeater(
    unicos.map((item, indice) => itemRepeaterProjeto(item, indice))
  );
}`;

const count = text.split(oldBlock).length - 1;
if (count !== 1) {
  throw new Error(`renderizarEntrega esperado 1x; encontrado ${count}x`);
}

text = text.replace(oldBlock, newBlock);
fs.writeFileSync(path, text, 'utf8');
console.log('OK: compra atual e demais projetos da conta serão exibidos juntos.');
