const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let text = fs.readFileSync(path, 'utf8');

const oldBlock = `$w.onReady(
  async function () {
    checkoutEmAndamento =
      false;

    await esconderBotaoVideo();

    ligarEventos();

    await $w(
      IDS.medidas
    ).disable();

    await $w(
      IDS.graficos
    ).disable();

    await $w(
      IDS.projeto
    ).disable();

    /*
      A impressora nostálgica começa visível em qualquer entrada válida
      da página de entrega e permanece até o arquivo aparecer na coleção.
      A galeria não é escondida nem recolhida por esta rotina.
      Assim que o Make termina, renderizarEntrega() mostra a imagem e
      esconderProcessamento() remove a impressora.
    */
    await mostrarProcessamento();

    await carregarEntrega();
  }
);`;

const newBlock = `$w.onReady(
  function () {
    checkoutEmAndamento =
      false;

    /*
      IMPORTANTE:
      O onReady não pode ficar aguardando o polling da entrega.
      O Wix aborta callbacks longos por volta de 25 segundos e a página
      pode ficar totalmente branca antes mesmo de pintar a impressora.

      Tudo que pode demorar roda em segundo plano depois que o onReady
      devolve o controle para o navegador.
    */

    esconderBotaoVideo()
      .catch(
        (erro) => {
          console.warn(
            "Falha ao esconder botão de vídeo no início:",
            erro?.message || erro
          );
        }
      );

    ligarEventos();

    Promise.allSettled([
      $w(IDS.medidas).disable(),
      $w(IDS.graficos).disable(),
      $w(IDS.projeto).disable()
    ]).catch(() => {});

    /*
      A impressora é exibida primeiro e imediatamente.
      Depois disso começa a consulta da coleção/Make sem bloquear a
      renderização da página. A galeria continua livre para receber a
      imagem assim que ela aparecer na coleção.
    */
    mostrarProcessamento()
      .catch(
        (erro) => {
          console.error(
            "Falha ao abrir a impressora da entrega:",
            erro?.message || erro
          );
        }
      )
      .finally(
        () => {
          carregarEntrega()
            .catch(
              (erro) => {
                console.error(
                  "Falha assíncrona ao carregar a entrega:",
                  erro?.message || erro
                );

                alterarDescricao(
                  "Pagamento recebido. A entrega ainda está sendo preparada. Atualize a página em alguns instantes."
                );
              }
            );
        }
      );
  }
);`;

if (text.includes(newBlock)) {
  console.log('Correção da entrega já aplicada.');
  process.exit(0);
}

if (!text.includes(oldBlock)) {
  throw new Error('Bloco onReady esperado não encontrado.');
}

text = text.replace(oldBlock, newBlock);
fs.writeFileSync(path, text);
console.log('Entrega corrigida: onReady não bloqueia mais o primeiro paint.');
