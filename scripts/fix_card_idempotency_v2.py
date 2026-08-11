from pathlib import Path

path = Path('src/backend/validaPayCartaoProjetosProntos.jsw')
s = path.read_text(encoding='utf-8')

def once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'Trecho não encontrado: {label}')
    s = s.replace(old, new, 1)

if 'function cardAttemptExternalId(' not in s:
    once(
        '''function brand(v) {
  const n = digits(v);''',
        '''function cardAttemptExternalId(checkoutId, attempt) {
  const base = safe(checkoutId).replace(/[^a-z0-9_-]/gi, "").slice(0, 54);
  const sequence = Math.max(1, Number(attempt || 1));
  return `${base}-C${sequence}`.slice(0, 64);
}

function isApprovedCardStatus(value) {
  return ["paid", "approved", "succeeded"].includes(safe(value).toLowerCase());
}

function isTerminalCardFailure(value) {
  return ["rejected", "declined", "denied", "failed", "cancelled", "canceled", "expired", "refused"].includes(safe(value).toLowerCase());
}

function brand(v) {
  const n = digits(v);''',
        'helpers de status/idempotência'
    )

anchor = '''    if (![11, 14].includes(cardDocument.length)) return { ok: false, error: "CPF/CNPJ do portador inválido." };

    await saveSession(checkoutId, {'''
replacement = '''    if (![11, 14].includes(cardDocument.length)) return { ok: false, error: "CPF/CNPJ do portador inválido." };

    /*
      externalId da ValidaPay é chave de idempotência.
      Uma nova tentativa real de cartão precisa de outra chave, mas uma tentativa
      ainda incerta deve ser consultada em vez de duplicada.
    */
    const previousSession = await findSession(checkoutId);
    const previousMethod = safe(previousSession?.paymentMethod).toUpperCase();
    const previousChargeId = previousMethod === "CARD"
      ? safe(previousSession?.validaPayChargeId || previousSession?.paymentId)
      : "";
    const previousStatus = safe(previousSession?.status).toLowerCase();
    let cardAttempt = Math.max(1, Number(previousSession?.cardAttempt || 1));

    if (previousChargeId) {
      const previousResponse = await api("get", `/v1/charges/${encodeURIComponent(previousChargeId)}`);

      if (!previousResponse.ok) {
        return {
          ok: true,
          recoverable: true,
          processing: true,
          chargeId: previousChargeId,
          status: previousStatus || "pending",
          error: "A tentativa anterior ainda está sendo conferida pela operadora."
        };
      }

      const previousData = previousResponse.data?.data || previousResponse.data?.charge || previousResponse.data || {};
      const liveStatus = safe(previousData?.status).toLowerCase();

      if (isApprovedCardStatus(liveStatus)) {
        await saveSession(checkoutId, {
          status: "approved",
          paymentMethod: "CARD",
          validaPayChargeId: previousChargeId,
          paymentId: previousChargeId,
          cardAttempt,
          updatedAtDate: new Date()
        });
        const finalization = await finalizeApprovedCard({ checkoutId, chargeId: previousChargeId });
        return {
          ok: true,
          approved: true,
          checkoutId,
          chargeId: previousChargeId,
          status: liveStatus,
          compraRegistrada: finalization.compraRegistrada === true,
          purchaseId: safe(finalization.purchaseId),
          tokenEntrega: safe(finalization.tokenEntrega),
          make: finalization.make
        };
      }

      if (!isTerminalCardFailure(liveStatus)) {
        await saveSession(checkoutId, {
          status: liveStatus || "pending",
          paymentMethod: "CARD",
          validaPayChargeId: previousChargeId,
          paymentId: previousChargeId,
          cardAttempt,
          updatedAtDate: new Date()
        });
        return {
          ok: true,
          recoverable: true,
          processing: true,
          chargeId: previousChargeId,
          status: liveStatus || "pending",
          error: "Já existe uma tentativa de cartão em análise. Aguardando a operadora antes de permitir outra cobrança."
        };
      }

      cardAttempt += 1;
    } else if (previousMethod === "CARD" && isTerminalCardFailure(previousStatus)) {
      cardAttempt += 1;
    }

    await saveSession(checkoutId, {'''
if 'externalId da ValidaPay é chave de idempotência' not in s:
    once(anchor, replacement, 'preflight da tentativa anterior')

once(
    '''      compraRegistrada: false,
      updatedAtDate: new Date()''',
    '''      compraRegistrada: false,
      cardAttempt,
      updatedAtDate: new Date()''',
    'persistência do número da tentativa'
)

once(
    '''      paymentMethod: "creditcard",
      externalId: checkoutId,
      externalTxid:''',
    '''      paymentMethod: "creditcard",
      externalId: cardAttemptExternalId(checkoutId, cardAttempt),
      externalTxid:''',
    'externalId da cobrança'
)

once(
    '''          await saveSession(checkoutId, {
            validaPayChargeId: id,
            paymentId: id,
            updatedAtDate: new Date()
          });''',
    '''          await saveSession(checkoutId, {
            validaPayChargeId: id,
            paymentId: id,
            paymentMethod: "CARD",
            status: "pending",
            cardAttempt,
            updatedAtDate: new Date()
          });''',
    'persistência do 409'
)

once(
    '''      return {
        ok: false,
        declined: response.statusCode === 402,
        error: response.error || "Cartão não aprovado."
      };''',
    '''      const declined = response.statusCode === 402;
      if (declined) {
        await saveSession(checkoutId, {
          status: "rejected",
          paymentMethod: "CARD",
          validaPayChargeId: "",
          paymentId: "",
          cardAttempt,
          updatedAtDate: new Date()
        });
      }
      return {
        ok: false,
        declined,
        status: declined ? "rejected" : "",
        error: response.error || "Cartão não aprovado."
      };''',
    'tratamento de cartão recusado'
)

once(
    '''      paymentMethod: "CARD",
      status: approved ? "approved" : (status || "pending"),''',
    '''      paymentMethod: "CARD",
      cardAttempt,
      status: approved ? "approved" : (status || "pending"),''',
    'persistência após resposta da ValidaPay'
)

# Validações de segurança do patch.
if 'externalId: checkoutId' in s:
    raise SystemExit('externalId antigo ainda presente no cartão')
if 'cardAttemptExternalId(checkoutId, cardAttempt)' not in s:
    raise SystemExit('externalId por tentativa não aplicado')
if 'previousChargeId' not in s:
    raise SystemExit('consulta da tentativa anterior não aplicada')

path.write_text(s.rstrip() + '\n', encoding='utf-8')
