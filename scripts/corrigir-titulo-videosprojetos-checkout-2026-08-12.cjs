const fs = require("fs");

const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const CHECKOUT = "src/pages/checkout-projeto-pronto.i9aj1.js";
const CUSTOM = "src/public/custom-elements/pelego-checkout-pronto.js";

function fail(message) {
  throw new Error(message);
}

function patchFile(file, patcher) {
  const before = fs.readFileSync(file, "utf8");
  const after = patcher(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    console.log(`Atualizado: ${file}`);
  } else {
    console.log(`Sem alterações: ${file}`);
  }
}

function replaceOnce(code, from, to, label) {
  if (code.includes(to)) return code;
  if (!code.includes(from)) fail(`${label}: trecho não encontrado.`);
  return code.replace(from, to);
}

patchFile(PAGE, (source) => {
  let code = source;

  code = replaceOnce(
    code,
    `  const titulo =\n    tituloEtapa(\n      tipoProduto\n    );\n\n  const imagem =`,
    `  const titulo =\n    tituloEtapa(\n      tipoProduto\n    );\n\n  /*\n    Título-base canônico vem diretamente de Videosprojetos.titulo_video.\n    O checkout usa esse valor apenas para montar a apresentação visual e\n    mantém \"titulo\" como descrição comercial da etapa.\n  */\n  const tituloBase =\n    tituloProjeto(\n      projeto\n    );\n\n  const imagem =`,
    "Título-base na origem"
  );

  code = replaceOnce(
    code,
    `    checkoutId,\n    codigoProjeto,\n    titulo,\n\n    productId:`,
    `    checkoutId,\n    codigoProjeto,\n    titulo,\n    tituloBase,\n\n    productId:`,
    "Enviar tituloBase"
  );

  return code;
});

patchFile(CHECKOUT, (source) => {
  let code = source;

  code = replaceOnce(
    code,
    `  const product=safe(q.tituloOriginal || q.titulo || q.produto || q.name || "Projeto Pronto");\n  return {`,
    `  const product=safe(q.tituloOriginal || q.titulo || q.produto || q.name || "Projeto Pronto");\n  const displayTitle=safe(q.tituloBase || q.tituloProjeto || product);\n  return {`,
    "Separar título comercial e título-base"
  );

  code = replaceOnce(
    code,
    `    produto:product,\n    titulo:product,`,
    `    produto:product,\n    titulo:displayTitle,`,
    "Usar tituloBase no visual"
  );

  code = replaceOnce(
    code,
    `  if (tituloReal) {\n    ctx.titulo = tituloReal;\n    ctx.produto = tituloReal;\n  }`,
    `  if (tituloReal) {\n    /*\n      Videosprojetos.titulo_video é a fonte da verdade do título visual.\n      Não sobrescrevemos ctx.produto, pois ele identifica a etapa comercial.\n    */\n    ctx.titulo = tituloReal;\n    if (!safe(ctx.produto)) ctx.produto = tituloReal;\n  }`,
    "Coleção Videosprojetos como fonte visual"
  );

  code = replaceOnce(
    code,
    `  completarContextoPelaColecao()\n    .then(() => {\n      /* Se o iframe ainda não ficou pronto, atualiza o INIT pendente. */\n      if (!checkoutUiReady) sendInit(true);\n    })`,
    `  completarContextoPelaColecao()\n    .then(() => {\n      /*\n        Se o iframe ainda não ficou pronto, atualizamos o INIT pendente.\n        Se já estiver visível, atualizamos apenas título/imagem sem resetar\n        identificação ou forma de pagamento.\n      */\n      if (!checkoutUiReady) {\n        sendInit(true);\n        return;\n      }\n\n      post({\n        type:"PROJECT_META",\n        titulo:ctx.titulo,\n        imagem:ctx.imagem || ctx.img,\n        codigoProjeto:ctx.codigoProjeto,\n        tipoProduto:ctx.tipoProduto\n      });\n    })`,
    "Atualizar metadados depois da coleção"
  );

  return code;
});

patchFile(CUSTOM, (source) => {
  let code = source;

  // Dá um pequeno respiro entre o aviso do e-mail e o botão.
  if (!code.includes(".emailField{margin-bottom:10px}")) {
    code = replaceOnce(
      code,
      `.fieldFull{grid-column:1/-1}\n.label{display:block`,
      `.fieldFull{grid-column:1/-1}\n.emailField{margin-bottom:10px}\n.label{display:block`,
      "Espaço abaixo do e-mail"
    );
  }

  code = replaceOnce(
    code,
    `<div class="fieldFull">\n            <label class="label">E-mail da sua conta</label>`,
    `<div class="fieldFull emailField">\n            <label class="label">E-mail da sua conta</label>`,
    "Classe do bloco de e-mail"
  );

  // Remove qualquer prefixo de etapa que já tenha vindo na URL/coleção.
  // O prefixo canônico é aplicado uma única vez logo abaixo.
  const oldBody = ` body=body.replace(/^(?:Medidas\\s+Projeto\\s+Pronto|Gráficos\\s+Projeto\\s+Pronto|Graficos\\s+Projeto\\s+Pronto|Projeto\\s+Pronto\\s+Completo)\\s+/i,"").trim();`;
  const newBody = ` var stagePrefix=/^(?:(?:Medidas(?:\\s+do)?\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Análises\\s+Gráficas\\s+do\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Analises\\s+Graficas\\s+do\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Gráficos(?:\\s+do)?\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Graficos(?:\\s+do)?\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Projeto\\s+Completo(?:\\s+para)?)|(?:Projeto\\s+Pronto\\s+Completo))\\s+/i;\n var previous="";\n while(body&&body!==previous){previous=body;body=body.replace(stagePrefix,"").trim()}`;
  code = replaceOnce(code, oldBody, newBody, "Remover prefixo duplicado");

  // Atualização leve dos metadados após a consulta de Videosprojetos.
  if (!code.includes('if(type==="PROJECT_META")')) {
    const initAnchor = `if(type==="INIT"){`;
    const projectMeta = `if(type==="PROJECT_META"){\n if(d.titulo){S.ctx.titulo=safe(d.titulo);E.title.textContent=stageDisplayTitle(S.ctx.titulo,S.ctx.tipoProduto||d.tipoProduto,S.ctx.codigoProjeto||d.codigoProjeto)}\n var projectImage=safe(d.imagem);\n if(projectImage){S.ctx.imagem=projectImage;S.ctx.img=projectImage;E.img.src=projectImage;E.img.classList.remove("hidden");E.fallback.classList.add("hidden")}\n layoutMode(CURRENT_LAYOUT_MODE);\n return\n}\n`;
    if (!code.includes(initAnchor)) fail("PROJECT_META: âncora INIT não encontrada.");
    code = code.replace(initAnchor, projectMeta + initAnchor);
  }

  return code;
});

console.log("Título do checkout corrigido: Videosprojetos.titulo_video + prefixo da etapa aplicado uma única vez.");
