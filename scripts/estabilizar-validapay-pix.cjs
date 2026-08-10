const fs = require('fs');

const path = 'src/backend/validaPayPixProjetosProntos.jsw';
let s = fs.readFileSync(path, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = s.indexOf(startMarker);
  const end = s.indexOf(endMarker, start);
  assert(start >= 0, `${label}: início não encontrado.`);
  assert(end > start, `${label}: fim não encontrado.`);
  s = s.slice(0, start) + replacement + s.slice(end);
}

// O checkout transparente atual da ValidaPay usa checkouts/write para criar
// cobranças e pix.cob/read para consultar o status. Não precisamos pedir
// todos os escopos de produtos/checkouts a cada autenticação.
const scopesStart = 'const SCOPES = [';
const scopesEnd = 'const CREATE_ATTEMPTS = 3;';
replaceBetween(
  scopesStart,
  scopesEnd,
  'const SCOPE_CHARGE_WRITE = "checkouts/write";\nconst SCOPE_CHARGE_READ = "pix.cob/read";\n\n',
  'escopos ValidaPay'
);

// Cache de token separado por escopo. Evita que um token de leitura seja
// reutilizado numa criação e vice-versa.
const cacheStart = 'let accessTokenCache =';
const cacheEnd = '// ======================================================\n// HELPERS';
replaceBetween(
  cacheStart,
  cacheEnd,
  `const accessTokenCache = new Map();\nconst accessTokenExpiresAt = new Map();\nconst accessTokenPromise = new Map();\n\n\n`,
  'cache de token'
);

// Remove helper que só era necessário para comparar preços de produtos.
const sameMoneyStart = 'function sameMoney(';
const normalizeTypeMarker = 'function normalizeType(value) {';
if (s.includes(sameMoneyStart)) {
  replaceBetween(
    sameMoneyStart,
    normalizeTypeMarker,
    '',
    'helper de preço antigo'
  );
}

// Autenticação mais simples e resiliente. Cada chamada pede somente o escopo
// necessário, com uma segunda tentativa apenas para falhas transitórias.
const authStart = 'async function requestAccessToken() {';
const sessionsMarker = '// ======================================================\n// SESSÕES WIX';
const authBlock = `async function requestAccessToken(scope) {\n  const clientId =\n    safe(\n      await getSecret(\n        \"VALIDAPAY_CLIENT_ID\"\n      )\n    );\n\n  const clientSecret =\n    safe(\n      await getSecret(\n        \"VALIDAPAY_CLIENT_SECRET\"\n      )\n    );\n\n  if (!clientId || !clientSecret) {\n    throw new Error(\n      \"Credenciais da ValidaPay não encontradas.\"\n    );\n  }\n\n  const body = [\n    \"grant_type=client_credentials\",\n    \`client_id=\${encodeURIComponent(clientId)}\`,\n    \`client_secret=\${encodeURIComponent(clientSecret)}\`,\n    \`scope=\${encodeURIComponent(scope)}\`\n  ].join(\"&\");\n\n  let lastError = null;\n\n  for (let attempt = 1; attempt <= 2; attempt += 1) {\n    const response =\n      await fetch(\n        AUTH_URL,\n        {\n          method: \"post\",\n          headers: {\n            \"Content-Type\":\n              \"application/x-www-form-urlencoded\"\n          },\n          body\n        }\n      );\n\n    const data =\n      await readResponse(response);\n\n    const token =\n      safe(data?.access_token);\n\n    if (response.ok && token) {\n      return {\n        token,\n        expiresIn:\n          Number(\n            data?.expires_in ||\n            data?.expiresIn ||\n            300\n          )\n      };\n    }\n\n    lastError =\n      createApiError(\n        data,\n        response.status,\n        AUTH_URL\n      );\n\n    if (\n      attempt < 2 &&\n      [408, 429, 500, 502, 503, 504]\n        .includes(Number(response.status || 0))\n    ) {\n      await sleep(250);\n      continue;\n    }\n\n    throw lastError;\n  }\n\n  throw lastError ||\n    new Error(\"Falha ao autenticar na ValidaPay.\");\n}\n\nfunction clearToken(scope) {\n  accessTokenCache.delete(scope);\n  accessTokenExpiresAt.delete(scope);\n  accessTokenPromise.delete(scope);\n}\n\nasync function getAccessToken(scope, force = false) {\n  const now = Date.now();\n\n  if (!force) {\n    const cached = safe(accessTokenCache.get(scope));\n    const expiresAt = Number(accessTokenExpiresAt.get(scope) || 0);\n\n    if (\n      cached &&\n      now < expiresAt - TOKEN_SAFETY_MS\n    ) {\n      return cached;\n    }\n\n    if (accessTokenPromise.get(scope)) {\n      return accessTokenPromise.get(scope);\n    }\n  } else {\n    clearToken(scope);\n  }\n\n  const promise =\n    requestAccessToken(scope)\n      .then(({ token, expiresIn }) => {\n        accessTokenCache.set(scope, token);\n        accessTokenExpiresAt.set(\n          scope,\n          Date.now() +\n            Math.max(120, expiresIn) * 1000\n        );\n        return token;\n      })\n      .finally(() => {\n        accessTokenPromise.delete(scope);\n      });\n\n  accessTokenPromise.set(scope, promise);\n  return promise;\n}\n\nfunction scopeForRequest(path, method) {\n  const verb = safe(method).toLowerCase();\n\n  if (\n    verb === \"post\" &&\n    path === \"/v1/charges\"\n  ) {\n    return SCOPE_CHARGE_WRITE;\n  }\n\n  return SCOPE_CHARGE_READ;\n}\n\nasync function requestValidaPay({\n  path,\n  method = \"get\",\n  body\n}) {\n  const scope = scopeForRequest(path, method);\n\n  for (let attempt = 1; attempt <= 2; attempt += 1) {\n    const token =\n      await getAccessToken(\n        scope,\n        attempt > 1\n      );\n\n    const options = {\n      method,\n      headers: {\n        Authorization: \`Bearer \${token}\`,\n        \"Content-Type\": \"application/json\"\n      }\n    };\n\n    if (body !== undefined) {\n      options.body = JSON.stringify(body);\n    }\n\n    const response =\n      await fetch(\n        \`\${API_BASE}\${path}\`,\n        options\n      );\n\n    const data =\n      await readResponse(response);\n\n    if (response.ok) {\n      return data;\n    }\n\n    if (\n      attempt === 1 &&\n      [401, 403].includes(Number(response.status || 0))\n    ) {\n      clearToken(scope);\n      continue;\n    }\n\n    throw createApiError(\n      data,\n      response.status,\n      path\n    );\n  }\n\n  throw new Error(\"Falha ao consultar a ValidaPay.\");\n}\n\n\n`;
replaceBetween(
  authStart,
  sessionsMarker,
  authBlock,
  'autenticação ValidaPay'
);

// Remove busca local/reutilização de produto e toda a camada de produtos.
const referenceStart = 'async function findProductReferenceSession({';
const productMarker = '// ======================================================\n// PRODUTOS VALIDAPAY';
if (s.includes(referenceStart)) {
  replaceBetween(
    referenceStart,
    productMarker,
    '',
    'referência antiga de produto'
  );
}

const productsStart = '// ======================================================\n// PRODUTOS VALIDAPAY';
const chargesMarker = '// ======================================================\n// COBRANÇAS VALIDAPAY';
if (s.includes(productsStart)) {
  replaceBetween(
    productsStart,
    chargesMarker,
    '',
    'camada de produtos ValidaPay'
  );
}

s = s.replace(
  /const PRODUCT_TEMPLATE = \"PP_VALIDAPAY_R8\";\n/,
  ''
);

// No fluxo de criação, pula productId/priceId e envia cobrança avulsa por amount.
const productFlowStart = '    const productReferenceSession =';
const chargeBodyMarker = '    const chargeBody = {';
if (s.includes(productFlowStart)) {
  replaceBetween(
    productFlowStart,
    chargeBodyMarker,
    '',
    'produto antes da cobrança'
  );
}

const chargeStart = s.indexOf(chargeBodyMarker);
assert(chargeStart >= 0, 'chargeBody não encontrado.');
const metadataStart = s.indexOf('      metadata: {', chargeStart);
assert(metadataStart > chargeStart, 'metadata do chargeBody não encontrada.');

let chargeHead = s.slice(chargeStart, metadataStart);
chargeHead = chargeHead.replace(
  /\n\s*items:\s*\[\s*\{[\s\S]*?quantity:\s*1\s*\}\s*\],\n/,
  '\n      amount,\n\n'
);

// A documentação atual usa telefone em E.164 no customer.phone.
chargeHead = chargeHead.replace(
  /phone:\n\s*phone,/,
  'phone:\n          whatsapp,'
);

s = s.slice(0, chargeStart) + chargeHead + s.slice(metadataStart);

fs.writeFileSync(path, s, 'utf8');
console.log('ValidaPay PIX simplificado: amount direto, escopos mínimos e token por escopo.');
