const fs = require('fs');
const path = 'src/backend/http-functions.js';
let s = fs.readFileSync(path, 'utf8');

const marker = '// TEMP_DIAG_TOKENIZACAO_VIA_CHECK_ABANDON_V1';
if (s.includes(marker)) {
  console.log('diagnóstico via checkAbandon já presente');
  process.exit(0);
}

const oldBlock = `export async function get_checkAbandon() {\n  const result =\n    await checkAbandoned();\n\n  return ok({\n    body: result\n  });\n}`;

if (!s.includes(oldBlock)) {
  throw new Error('Bloco get_checkAbandon esperado não encontrado; nenhuma alteração aplicada.');
}

const newBlock = `export async function get_checkAbandon(request) {\n  ${marker}\n  // Diagnóstico temporário e sem dados de cartão. Só executa com query explícita.\n  if (safe(request?.query?.diagTokenizacao) === \"oauth\") {\n    try {\n      const clientId = safe(await getSecret(\"VALIDAPAY_CLIENT_ID\"));\n      const clientSecret = safe(await getSecret(\"VALIDAPAY_CLIENT_SECRET\"));\n\n      if (!clientId || !clientSecret) {\n        return ok({ body: {\n          ok: false,\n          stage: \"credentials\",\n          status: 0,\n          scopeRequested: \"payment.methods/write\",\n          tokenReceived: false,\n          error: \"credenciais_ausentes\"\n        }});\n      }\n\n      const form = [\n        \"grant_type=client_credentials\",\n        \`client_id=\${encodeURIComponent(clientId)}\`,\n        \`client_secret=\${encodeURIComponent(clientSecret)}\`,\n        \`scope=\${encodeURIComponent(\"payment.methods/write\")}\`\n      ].join(\"&\");\n\n      const response = await fetch(VALIDAPAY_AUTH_URL, {\n        method: \"post\",\n        headers: { \"Content-Type\": \"application/x-www-form-urlencoded\" },\n        body: form\n      });\n\n      const raw = await response.text();\n      let data = {};\n      try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { raw }; }\n\n      return ok({ body: {\n        ok: response.ok === true,\n        stage: \"oauth\",\n        status: Number(response.status || 0),\n        statusText: safe(response.statusText),\n        scopeRequested: \"payment.methods/write\",\n        grantedScope: safe(data?.scope),\n        tokenReceived: Boolean(safe(data?.access_token)),\n        error: safe(\n          data?.error_description ||\n          data?.message ||\n          (typeof data?.error === \"string\" ? data.error : data?.error?.message) ||\n          data?.code ||\n          data?.raw\n        ).slice(0, 500)\n      }});\n    } catch (error) {\n      return ok({ body: {\n        ok: false,\n        stage: \"exception\",\n        status: 0,\n        scopeRequested: \"payment.methods/write\",\n        tokenReceived: false,\n        error: safe(error?.message || error).slice(0, 500)\n      }});\n    }\n  }\n\n  const result =\n    await checkAbandoned();\n\n  return ok({\n    body: result\n  });\n}`;

s = s.replace(oldBlock, newBlock);
fs.writeFileSync(path, s);
console.log('diagnóstico via rota existente adicionado');
