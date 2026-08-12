const fs = require("fs");

const PAGE = "src/pages/ENTREGA PROJETOS PRONTOS.hr1cn.js";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, text) {
  fs.writeFileSync(path, `${text.trimEnd()}\n`, "utf8");
}

function replaceFunction(text, signature, replacement) {
  const start = text.indexOf(signature);
  if (start < 0) {
    throw new Error(`Função não encontrada: ${signature}`);
  }

  const open = text.indexOf("{", start);
  if (open < 0) {
    throw new Error(`Abertura da função não encontrada: ${signature}`);
  }

  let depth = 0;
  let end = -1;

  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) {
    throw new Error(`Fim da função não encontrado: ${signature}`);
  }

  return text.slice(0, start) + replacement + text.slice(end);
}

let page = read(PAGE);

page = replaceFunction(
  page,
  "function entregaProcessada(",
  `function entregaProcessada(resultado) {
  const projeto = resultado?.project || {};

  /*
    REGRA OFICIAL DA PÁGINA DE ENTREGA:
    na abertura após pagamento, a impressora só precisa aguardar a imagem
    de MEDIDAS. Nas compras seguintes essa imagem já existe e a galeria pode
    aparecer sem ficar presa esperando Gráficos ou o PDF do Projeto Completo.
  */
  return Boolean(
    safe(projeto.imagemMedidas)
  );
}`
);

page = replaceFunction(
  page,
  "async function baixarProjetoCompleto(",
  `async function baixarProjetoCompleto() {
  if (
    entrega?.access?.projeto !== true
  ) {
    return;
  }

  let arquivo =
    safe(entrega?.project?.pdfProjeto);

  /*
    O pagamento pode liberar o botão alguns instantes antes de o Make gravar
    o webUrl do OneDrive na compra. Em vez de o clique morrer silenciosamente,
    consulta novamente a entrega por alguns segundos e abre o PDF assim que o
    link aparecer.
  */
  if (!arquivo) {
    alterarDescricao(
      "Projeto completo pago. Localizando o PDF..."
    );

    const checkoutId =
      safe(
        wixLocation.query.checkout_id ||
        wixLocation.query.checkoutId
      );

    const token =
      safe(wixLocation.query.token);

    for (
      let tentativa = 1;
      tentativa <= 5 && !arquivo;
      tentativa += 1
    ) {
      try {
        const atualizado =
          await buscarEntregaProjetoPronto({
            checkoutId,
            token
          });

        if (
          atualizado?.ok &&
          atualizado?.approved
        ) {
          entrega = atualizado;
          arquivo =
            safe(atualizado?.project?.pdfProjeto);
        }
      } catch (erro) {
        console.warn(
          "Falha ao atualizar link do projeto completo:",
          erro?.message || erro
        );
      }

      if (
        !arquivo &&
        tentativa < 5
      ) {
        await esperar(800);
      }
    }
  }

  if (!arquivo) {
    await mostrarGaleria();

    alterarDescricao(
      "O PDF do projeto completo ainda está sendo finalizado. Tente novamente em alguns segundos."
    );

    return;
  }

  /* Abre o compartilhamento original do OneDrive para visualizar o PDF online. */
  wixLocation.to(
    arquivo
  );
}`
);

write(PAGE, page);

console.log(
  "Entrega corrigida: impressora espera Medidas; Projeto Completo atualiza o link e abre o PDF online."
);
