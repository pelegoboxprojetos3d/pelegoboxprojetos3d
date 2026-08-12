const fs = require("fs");

const arquivo = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let codigo = fs.readFileSync(arquivo, "utf8");
const original = codigo;

/*
  O fluxo cross-browser atual já contempla o objetivo deste script antigo:
  - cliente completo é liberado imediatamente com o estado local;
  - o backend revalida acessos em segundo plano em desktop e mobile;
  - o clique não dispara novamente a cadeia buscarCliente + obterAcessos.

  Não reintroduzimos a lógica antiga quando esse fluxo já está presente.
*/
const temFluxoCrossBrowser =
  codigo.includes("function cadastroProntoParaPagamento(") &&
  codigo.includes("async function revalidarAcessosSalvos(") &&
  codigo.includes("if (cadastroProntoParaPagamento(salva)) {") &&
  codigo.includes("Erro ao atualizar acessos em segundo plano:");

if (temFluxoCrossBrowser) {
  console.log("Cliente cadastrado direto ao pagamento: fluxo cross-browser mais novo já aplicado.");
  process.exit(0);
}

function insertBeforeOnce(source, marker, insertion, uniqueMarker, label) {
  if (source.includes(uniqueMarker)) {
    console.log(`${label}: já aplicado.`);
    return source;
  }
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`${label}: marcador não encontrado.`);
  console.log(`${label}: aplicado.`);
  return source.slice(0, index) + insertion + "\n\n" + source.slice(index);
}

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`${label}: já aplicado.`);
    return source;
  }
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho, encontrados ${count}.`);
  console.log(`${label}: aplicado.`);
  return source.replace(oldText, newText);
}

codigo = insertBeforeOnce(
  codigo,
  "async function iniciarPagina() {",
`function cadastroProntoParaPagamento(data = identificacao) {
  const telefone = normalizarTelefone(data);
  const nome = safe(data?.nome).replace(/\\s+/g, " ");
  const mail = normalizeEmail(data?.email);
  const documento = onlyDigits(data?.cpfCnpj || data?.cpf);

  return Boolean(
    telefone.whatsapp &&
    safe(data?.clienteId) &&
    data?.whatsappConfirmado === true &&
    nome.length >= 3 &&
    /^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/i.test(mail) &&
    documento.length === 11
  );
}`,
  "function cadastroProntoParaPagamento(",
  "Cadastro completo: helper"
);

codigo = replaceOnce(
  codigo,
  `      if (acessosSalvos) {`,
  `      if (acessosSalvos && cadastroProntoParaPagamento(salva)) {`,
  "Cache só libera botão com cadastro completo"
);

codigo = replaceOnce(
  codigo,
`      identificado =
        true;

      identificarCliente(
        salva
      ).catch(
        (
          error
        ) => {
          console.error(
            "Erro ao restaurar identificação:",
            error?.message ||
            error
          );
        }
      );

      return;`,
`      /*
        Registro antigo com apenas WhatsApp não libera o clique antes da hora.
        Fazemos uma única restauração aqui, durante a abertura da página.
        Depois disso o botão não consulta backend e navega imediatamente.
      */
      await identificarCliente(salva);
      return;`,
  "Restaurar cliente antes de liberar os botões"
);

if (codigo !== original) {
  fs.writeFileSync(arquivo, codigo, "utf8");
  console.log("Fluxo simplificado: cliente conhecido fica pronto antes do clique.");
} else {
  console.log("Fluxo simplificado já estava aplicado.");
}