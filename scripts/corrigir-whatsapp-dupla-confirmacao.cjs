const fs = require('fs');

const MAIN = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
const CHECKOUT = 'src/pages/checkout-projeto-pronto.i9aj1.js';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`[ok] ${label} já aplicado.`);
    return source;
  }

  if (!source.includes(oldText)) {
    throw new Error(`Não encontrei o trecho esperado para: ${label}`);
  }

  console.log(`[aplicar] ${label}`);
  return source.replace(oldText, newText);
}

let main = read(MAIN);

main = replaceOnce(
  main,
`  /*
    Esta chave só é gravada no primeiro estágio.
    O checkout de confirmação nunca pode alterá-la.
  */
  salvarWhatsappPrimeiroEstagio(
    identificacao.whatsappE164 ||
    identificacao.whatsapp
  );

`,
`  /*
    A chave dedicada do primeiro WhatsApp NÃO é atualizada aqui.
    Ela só pode ser gravada explicitamente quando o popup 1 retorna VERIFY.
    Isso impede o checkout/popup 2 de transformar outro número no "primeiro".
  */

`,
  'não sobrescrever o WhatsApp do popup 1 no armazenamento genérico'
);

main = replaceOnce(
  main,
`    identificacao.whatsappConfirmado =
      false;
`,
`    /*
      Fonte da verdade da etapa 1.
      Gravamos uma única vez, exatamente com o número retornado pelo popup 1.
    */
    salvarWhatsappPrimeiroEstagio(
      resultado.whatsappE164 ||
      resultado.whatsapp
    );

    identificacao.whatsappConfirmado =
      false;
`,
  'gravar explicitamente o WhatsApp do popup 1'
);

write(MAIN, main);

let checkout = read(CHECKOUT);

checkout = replaceOnce(
  checkout,
`function whatsappPrimeiroEstagio() {
  /*
    A chave dedicada é imutável neste checkout:
    apenas o popup anterior pode gravá-la.

    O objeto legado fica somente como compatibilidade
    para clientes que iniciaram o fluxo antes da correção.
  */
  return (
    lerWhatsappPrimeiroEstagioDedicado() ||
    normalizarWhatsappBrasil(
      contexto.whatsappE164 ||
      contexto.whatsapp
    )
  );
}
`,
`function whatsappPrimeiroEstagio() {
  /*
    REGRA RÍGIDA:
    a única fonte válida é a chave dedicada gravada pelo popup 1.
    Não usamos contexto, cadastro nem o número digitado no popup 2 como fallback.
  */
  return lerWhatsappPrimeiroEstagioDedicado();
}
`,
  'usar somente a chave imutável do popup 1'
);

checkout = replaceOnce(
  checkout,
`    if (!telefone.whatsapp) {
      throw new Error(
        "WhatsApp não informado."
      );
    }

    if (
      whatsappConsultado &&
      telefone.whatsapp !==
        whatsappConsultado
    ) {
`,
`    if (!telefone.whatsapp) {
      throw new Error(
        "WhatsApp não informado."
      );
    }

    const whatsappEsperado =
      whatsappPrimeiroEstagio();

    if (
      !whatsappEsperado ||
      telefone.whatsapp !== whatsappEsperado
    ) {
      throw new Error(
        "O WhatsApp informado não confere com o digitado na primeira etapa."
      );
    }

    if (
      whatsappConsultado &&
      telefone.whatsapp !==
        whatsappConsultado
    ) {
`,
  'revalidar popup 1 antes de cadastrar cliente'
);

checkout = replaceOnce(
  checkout,
`async function enviarClienteExistente(
  data = {}
) {
  const telefone =
    dadosTelefone(
      data
    );

  if (
    !checkoutAutorizado ||
    !clienteConsultado ||
    telefone.whatsapp !==
      whatsappConsultado
  ) {
`,
`async function enviarClienteExistente(
  data = {}
) {
  const telefone =
    dadosTelefone(
      data
    );

  const whatsappEsperado =
    whatsappPrimeiroEstagio();

  if (
    !checkoutAutorizado ||
    !clienteConsultado ||
    !whatsappEsperado ||
    telefone.whatsapp !== whatsappEsperado ||
    telefone.whatsapp !==
      whatsappConsultado
  ) {
`,
  'revalidar popup 1 antes de gerar PIX para cliente existente'
);

write(CHECKOUT, checkout);

console.log('Dupla confirmação do WhatsApp travada com fonte única no popup 1.');
