const fs = require('fs');

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`Sem alteração: ${path}`);
    return;
  }
  fs.writeFileSync(path, after);
  console.log(`Atualizado: ${path}`);
}

const SECRET_OLD = 'RESPONDECHAT_VENDA_PROJETOS_PRONTOS_WEBHOOK';
const SECRET_REAL = 'RESPONDECHAT_VENDA_PROJETOS_PRONTOS_WEBH';

edit('src/backend/notificarVendaProjetoPronto.js', s =>
  s.split(SECRET_OLD).join(SECRET_REAL)
);

for (const path of [
  'src/backend/validaPayCartaoProjetosProntos.jsw',
  'src/backend/validaPayPixProjetosProntosCore.jsw'
]) {
  edit(path, s => {
    s = s.split(SECRET_OLD).join(SECRET_REAL);

    // O nome do produto já contém a descrição completa. O título do preço é o nome do plano.
    // Se ambos forem iguais, a fatura da ValidaPay exibe "produto - produto".
    s = s.replace(/title:\s*produto,\s*\n(\s*)amount:/g, 'title: "Único",\n$1amount:');

    // Não reutilizar priceId guardado em sessões antigas: eles foram criados com title=produto
    // e geram fatura duplicada. A busca no provedor abaixo só aceita o novo plano "Único".
    s = s.replace(/\n\s*const reused = await reusablePriceId\([^;]+;\s*\n\s*if \(reused\) \{[\s\S]*?\n\s*return reused;\s*\n\s*\}\s*\n/g, '\n');

    // Sempre buscar o detalhe do produto para ler o título do preço.
    s = s.replace(/if \(\(!Array\.isArray\(prices\) \|\| !prices\.length\) && productId\) \{/g, 'if (productId) {');

    // Só reutiliza preços já corrigidos. Os antigos ficam preservados no histórico da ValidaPay.
    s = s.replace(
      /safe\(price\?\.priceId \|\| price\?\.id\) &&\s*\n(\s*)Math\.abs/g,
      'safe(price?.priceId || price?.id) &&\n$1["ÚNICO", "UNICO"].includes(safe(price?.title).toUpperCase()) &&\n$1Math.abs'
    );

    return s;
  });
}

edit('src/backend/validaPayCartaoProjetosProntos.jsw', s => {
  const oldFn = `async function reenviarNotificacaoValidaPay(chargeId) {\n  const id = safe(chargeId);\n  if (!id) return { sent: false, error: "charge_id_missing" };\n\n  try {\n    const response = await api("post", "/v1/users/notifications/resend", { chargeId: id });\n    if (!response.ok) {\n      console.warn("ValidaPay não enviou a notificação da fatura:", response.statusCode, response.error);\n      return { sent: false, statusCode: response.statusCode, error: response.error || "notification_resend_failed" };\n    }\n    return {\n      sent: true,\n      statusCode: response.statusCode,\n      event: safe(response.data?.event),\n      success: response.data?.success === true\n    };\n  } catch (error) {\n    console.warn("Falha ao chamar reenvio de notificação ValidaPay:", error?.message || error);\n    return { sent: false, error: error?.message || "notification_resend_error" };\n  }\n}`;

  const newFn = `async function reenviarNotificacaoValidaPay(chargeId) {\n  const id = safe(chargeId);\n  if (!id) return { sent: false, error: "charge_id_missing" };\n\n  // O painel da ValidaPay consegue reenviar depois que a cobrança já está materializada.\n  // Na aprovação transparente a consulta pode chegar cedo demais, então aguardamos e repetimos\n  // somente em caso de falha. Uma resposta 2xx encerra imediatamente e não consome reenvios extras.\n  const waits = [900, 1400, 2100];\n  let last = { sent: false, error: "notification_resend_failed" };\n\n  for (let attempt = 0; attempt < waits.length; attempt += 1) {\n    await new Promise(resolve => setTimeout(resolve, waits[attempt]));\n    try {\n      const response = await api("post", "/v1/users/notifications/resend", { chargeId: id });\n      if (response.ok) {\n        return {\n          sent: true,\n          statusCode: response.statusCode,\n          event: safe(response.data?.event),\n          success: response.data?.success === true,\n          attempt: attempt + 1\n        };\n      }\n      last = {\n        sent: false,\n        statusCode: response.statusCode,\n        error: response.error || "notification_resend_failed",\n        attempt: attempt + 1\n      };\n      console.warn("ValidaPay não enviou a notificação da fatura:", response.statusCode, response.error);\n    } catch (error) {\n      last = { sent: false, error: error?.message || "notification_resend_error", attempt: attempt + 1 };\n      console.warn("Falha ao chamar reenvio de notificação ValidaPay:", error?.message || error);\n    }\n  }\n\n  return last;\n}`;

  if (!s.includes(oldFn)) {
    console.log('Função de reenvio já está em outra versão; preservada.');
    return s;
  }
  return s.replace(oldFn, newFn);
});

// Persistir o resultado do disparo da fatura para diagnóstico sem bloquear a entrega.
edit('src/backend/validaPayCartaoProjetosProntos.jsw', s => {
  const needle = '  const faturaValidaPay=await reenviarNotificacaoValidaPay(chargeId);\n  return {compraRegistrada:true,purchaseId:safe(savedPurchase?._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao,faturaValidaPay};';
  const replacement = '  const faturaValidaPay=await reenviarNotificacaoValidaPay(chargeId);\n  await saveSession(checkoutId,{\n    faturaValidaPayEnviada:faturaValidaPay?.sent===true,\n    faturaValidaPayStatusCode:Number(faturaValidaPay?.statusCode||0),\n    faturaValidaPayErro:safe(faturaValidaPay?.error),\n    faturaValidaPayTentativa:Number(faturaValidaPay?.attempt||0),\n    updatedAtDate:new Date()\n  });\n  return {compraRegistrada:true,purchaseId:safe(savedPurchase?._id),tokenEntrega:safe(session.tokenEntrega),make,notificacao,faturaValidaPay};';
  return s.includes(needle) ? s.replace(needle, replacement) : s;
});

console.log('Hotfix final aplicado.');
