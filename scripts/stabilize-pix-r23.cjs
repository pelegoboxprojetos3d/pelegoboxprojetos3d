const fs = require('fs');

const backendPath = 'src/backend/validaPayPixProjetosProntos.jsw';
const frontendPath = 'src/pages/checkout-projeto-pronto.i9aj1.js';

let backend = fs.readFileSync(backendPath, 'utf8');
let frontend = fs.readFileSync(frontendPath, 'utf8');

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) {
    throw new Error(`Trecho não encontrado: ${label}`);
  }
  return text.replace(from, to);
}

// 1) ValidaPay documenta customer.phone em E.164 (+55...).
backend = replaceOnce(
  backend,
`function nationalPhone(value) {
  const e164 =
    normalizePhone(value);

  return e164
    ? digits(e164).slice(2)
    : "";
}
`,
`function nationalPhone(value) {
  /*
    Apesar do nome legado desta função, a API da ValidaPay exige
    customer.phone no formato internacional E.164.
    Mantemos a função para não espalhar mudança desnecessária pelo arquivo.
  */
  return normalizePhone(value);
}
`,
  'telefone E.164'
);

// 2) Logo após criar uma cobrança, um GET por chargeId pode chegar antes
// da propagação completa do provedor. 404 neste endpoint é recuperável;
// 404 no POST /v1/charges continua sendo erro real (ex.: preço inexistente).
backend = replaceOnce(
  backend,
`function transientError(error) {
  const status =
    Number(
      error?.status ||
      0
    );

  if (
    [
      408,
      425,
      429,
      500,
      502,
      503,
      504
    ].includes(status)
  ) {
    return true;
  }

  const message =
    safe(
      error?.message
    ).toLowerCase();

  return (
    status === 0 &&
    /timeout|timed out|network|fetch|504/.test(
      message
    )
  );
}
`,
`function transientError(error) {
  const status =
    Number(
      error?.status ||
      0
    );

  if (
    [
      408,
      425,
      429,
      500,
      502,
      503,
      504
    ].includes(status)
  ) {
    return true;
  }

  const message =
    safe(
      error?.message
    ).toLowerCase();

  return (
    status === 0 &&
    /timeout|timed out|network|fetch|504/.test(
      message
    )
  );
}

function transientChargeReadError(error) {
  const status = Number(error?.status || 0);
  const path = safe(error?.path);

  return (
    status === 404 &&
    /^\\/v1\\/charges\\/[^/]+$/i.test(path)
  );
}
`,
  'helper 404 transitório de leitura'
);

backend = backend.replace(
`      if (
        !transientError(
          error
        )
      ) {
        throw error;
      }
`,
`      if (
        !transientError(error) &&
        !transientChargeReadError(error)
      ) {
        throw error;
      }
`
);

backend = replaceOnce(
  backend,
`    const recoverable =
      error?.recoverable === true ||
      transientError(error);
`,
`    const recoverable =
      error?.recoverable === true ||
      transientError(error) ||
      transientChargeReadError(error);
`,
  'recuperação na criação/reuso do PIX'
);

backend = replaceOnce(
  backend,
`    const recoverable =
      transientError(error);
`,
`    const recoverable =
      transientError(error) ||
      transientChargeReadError(error);
`,
  'recuperação na consulta do PIX'
);

// 3) Se já existe chargeId, não encerra o polling de pré-QR aos 30s.
// A cobrança existe e deve continuar sendo consultada, não mandar o cliente
// criar/tentar outra no escuro.
frontend = replaceOnce(
  frontend,
`  if (
    !pixConteudoEnviado &&
    pixPollingInicio > 0 &&
    Date.now() - pixPollingInicio >=
      PIX_PRE_QR_LIMITE_MS
  ) {
`,
`  if (
    !pixConteudoEnviado &&
    !chargeIdAtual &&
    pixPollingInicio > 0 &&
    Date.now() - pixPollingInicio >=
      PIX_PRE_QR_LIMITE_MS
  ) {
`,
  'timeout pré-QR com chargeId conhecido'
);

fs.writeFileSync(backendPath, backend);
fs.writeFileSync(frontendPath, frontend);

console.log('PIX R23 aplicado: E.164, 404 transitório e polling sem abortar charge existente.');
