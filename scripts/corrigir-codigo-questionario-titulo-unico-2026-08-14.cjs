const fs = require("fs");

const PAGE = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
const CUSTOM = "src/public/custom-elements/pelego-checkout-pronto.js";
const NORMALIZER = "src/backend/projetosProntosNormalizacao.js";

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: início não encontrado.`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: fim não encontrado.`);
  return source.slice(0, start) + replacement + source.slice(end);
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

patchFile(PAGE, (source) => {
  const replacement = `function tituloProjeto(item) {
  const original =
    decodeText(
      item?.titulo_video
    );

  /*
    A coleção já traz o código de questionário 001–014 no título.
    Ele é tratado como dado da fonte, nunca como texto para ser somado.
    Mesmo que um título antigo chegue com o código repetido, removemos todos
    os códigos finais e recolocamos apenas o único código da fonte.
  */
  const codigoQuestionario =
    original.match(
      /\\b(00[1-9]|01[0-4])\\b\\s*$/i
    )?.[1] || "";

  const base =
    original
      .split(
        /\\bPELEGO(?:\\s*BOX)?\\b/i
      )[0]
      .replace(
        /(?:\\s+(?:00[1-9]|01[0-4]))+\\s*$/i,
        ""
      )
      .replace(/\\s+/g, " ")
      .trim();

  return [
    base,
    codigoQuestionario
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();
}

`;

  return replaceBetween(
    source,
    "function tituloProjeto(item) {",
    "function tituloSemCodigo(value) {",
    replacement,
    "tituloProjeto"
  );
});

patchFile(CUSTOM, (source) => {
  const replacement = `function stageDisplayTitle(value,type,projectCode){
 var original=decodeEntities(value);
 if(!original)return "Projeto Pronto";

 /*
   O 001–014 já pertence ao título da coleção. Capturamos o único código
   final da fonte, limpamos qualquer repetição herdada e só então montamos
   o título visual da etapa. Assim 002 002 nunca volta a aparecer.
 */
 var qm=original.match(/\\b(00[1-9]|01[0-4])\\b\\s*$/i);
 var q=qm?qm[1]:"";
 var cut=original
   .replace(/\\s*\\bPELEGO\\s+BOX\\b[\\s\\S]*$/i,"")
   .replace(/(?:\\s+(?:00[1-9]|01[0-4]))+\\s*$/i,"")
   .replace(/\\s+/g," ")
   .trim();
 cut=prettyTitle(cut);
 var found=cut.match(/^\\s*#?\\s*(\\d+)\\s+(.*)$/);
 var code=found?found[1]:digits(projectCode);
 var body=found?found[2]:cut;
 var stagePrefix=/^(?:(?:Medidas(?:\\s+do)?\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Análises\\s+Gráficas\\s+do\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Analises\\s+Graficas\\s+do\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Gráficos(?:\\s+do)?\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Graficos(?:\\s+do)?\\s+Projeto\\s+Pronto(?:\\s+para)?)|(?:Projeto\\s+Completo(?:\\s+para)?)|(?:Projeto\\s+Pronto\\s+Completo))\\s+/i;
 var previous="";
 while(body&&body!==previous){previous=body;body=body.replace(stagePrefix,"").trim()}
 var normalized=safe(type).normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toUpperCase().replace(/[\\s-]+/g,"_");
 var prefix=normalized==="GRAFICOS"?"Gráficos Projeto Pronto":normalized==="PROJETO_COMPLETO"?"Projeto Pronto Completo":"Medidas Projeto Pronto";
 return [code?"#"+code:"",prefix,body,q].filter(Boolean).join(" ").replace(/\\s+/g," ").trim();
}

`;

  return replaceBetween(
    source,
    "function stageDisplayTitle(value,type,projectCode){",
    "function hydrate(ctx){",
    replacement,
    "stageDisplayTitle"
  );
});

patchFile(NORMALIZER, (source) => {
  const replacement = `export function normalizarTituloProduto(value) {
  const original =
    decodificarTitulo(value);

  const codigoQuestionario =
    extrairCodigoQuestionarioTitulo(original);

  /*
    A planilha/coleção é a fonte do 001–014. Não acrescentamos um segundo
    código em cima do que já veio da fonte. Limpamos qualquer repetição final,
    removemos o sufixo institucional e recolocamos exatamente um código.
  */
  const antesDaMarca =
    original
      .replace(
        /\\s*\\bPELEGO\\s+BOX\\b[\\s\\S]*$/i,
        ""
      )
      .replace(
        /(?:\\s+(?:00[1-9]|01[0-4]))+\\s*$/i,
        ""
      )
      .replace(/\\s+/g, " ")
      .trim();

  const natural =
    antesDaMarca
      .split(" ")
      .filter(Boolean)
      .map(capitalizarToken)
      .join(" ")
      .trim();

  return [
    natural,
    codigoQuestionario
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\\s+/g, " ")
    .trim();
}

`;

  return replaceBetween(
    source,
    "export function normalizarTituloProduto(value) {",
    "function normalizarTipoProduto(value) {",
    replacement,
    "normalizarTituloProduto"
  );
});

console.log("Código de questionário blindado para existir uma única vez nos títulos pós-clique.");
