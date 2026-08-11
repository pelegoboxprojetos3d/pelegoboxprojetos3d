const fs = require('fs');

const path = 'src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js';
let text = fs.readFileSync(path, 'utf8');

function mustReplace(from, to, label) {
  if (!text.includes(from)) {
    throw new Error(`Marcador não encontrado: ${label}`);
  }
  text = text.replace(from, to);
}

mustReplace(`async function mostrarProcessamento() {
  /*
    O HTML da impressora fica sobre a galeria no Editor.
    Enquanto ele estiver visível, a galeria fica apenas OCULTA, sem
    recolher o espaço. Isso evita a imagem aparecendo por baixo.
  */
  try {
    await $w(IDS.galeria).hide();
  } catch (erro) {
    console.warn(
      "Falha ao ocultar a galeria durante o processamento:",
      erro?.message || erro
    );
  }

  if (!processamentoVisivelDesde) {
    processamentoVisivelDesde = Date.now();
  }

  try {
    await $w(IDS.processando).expand();
    await $w(IDS.processando).show();
  } catch (erro) {
    console.warn(
      "Falha ao mostrar o HTML de processamento:",
      erro?.message || erro
    );
  }
}`,
`async function mostrarProcessamento() {
  /*
    PRIORIDADE ABSOLUTA DA ENTREGA:
    a impressora precisa ser o primeiro elemento dinâmico a aparecer.

    Antes o código esperava a galeria terminar de ocultar para só depois
    expandir/mostrar o HTML. Em carregamentos lentos isso criava uma tela
    branca desnecessária. Agora disparo a impressora primeiro e oculto a
    galeria em paralelo. A galeria continua sem collapse para preservar o
    espaço do layout enquanto o Make trabalha.
  */
  if (!processamentoVisivelDesde) {
    processamentoVisivelDesde = Date.now();
  }

  const tarefas = [];

  try {
    const processando = $w(IDS.processando);

    if (typeof processando.expand === "function") {
      tarefas.push(processando.expand());
    }

    if (typeof processando.show === "function") {
      tarefas.push(processando.show());
    }
  } catch (erro) {
    console.warn(
      "Falha ao iniciar o HTML de processamento:",
      erro?.message || erro
    );
  }

  try {
    const galeria = $w(IDS.galeria);

    if (typeof galeria.hide === "function") {
      tarefas.push(galeria.hide());
    }
  } catch (erro) {
    console.warn(
      "Falha ao ocultar a galeria durante o processamento:",
      erro?.message || erro
    );
  }

  await Promise.allSettled(tarefas);
}`,
'mostrarProcessamento');

mustReplace(`$w.onReady(
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

    ocultarDadosAteCarregamento()
      .catch(
        (erro) => {
          console.warn(
            "Falha ao ocultar placeholders da entrega:",
            erro?.message || erro
          );
        }
      );

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
      A galeria fica oculta enquanto a impressora estiver por cima.
      Depois começa a consulta da coleção/Make sem bloquear a página.
      Mesmo se a imagem já existir (acesso pelo e-mail), a impressora
      permanece visível por pelo menos 3 segundos antes da galeria.
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
);`,
`$w.onReady(
  function () {
    checkoutEmAndamento =
      false;

    /*
      PRIMEIRO A IMPRESSORA.
      Nenhuma limpeza de placeholder, vídeo, botão ou consulta de coleção
      entra na frente dela. O navegador recebe o comando de exibição logo
      no começo do onReady; todo o restante continua assíncrono.
    */
    const impressoraPronta =
      mostrarProcessamento()
        .catch(
          (erro) => {
            console.error(
              "Falha ao abrir a impressora da entrega:",
              erro?.message || erro
            );
          }
        );

    ocultarDadosAteCarregamento()
      .catch(
        (erro) => {
          console.warn(
            "Falha ao ocultar placeholders da entrega:",
            erro?.message || erro
          );
        }
      );

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
      A consulta da compra só começa depois que a tentativa de exibir a
      impressora terminou. Assim o primeiro trabalho pesado da página não
      compete com o primeiro paint do processamento.
    */
    impressoraPronta.finally(
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
);`,
'onReady-prioridade-impressora');

fs.writeFileSync(path, text);
console.log('R28 aplicada: impressora priorizada na entrega.');
