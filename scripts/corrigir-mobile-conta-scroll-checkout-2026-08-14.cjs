const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`${label}: trecho nao encontrado`);
  return source.replace(from, to);
}

function replaceBetween(source, start, end, replacement, label) {
  if (source.includes(replacement)) return source;
  const i = source.indexOf(start);
  const j = source.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error(`${label}: limites nao encontrados`);
  return source.slice(0, i) + replacement + '\n\n' + source.slice(j);
}

// ======================================================
// 1) CHECKOUT DE PAGAMENTO: MOBILE / MESMA CONTA WIX
// ======================================================
{
  const file = 'src/pages/checkout-projeto-pronto.i9aj1.js';
  let s = read(file);

  s = replaceOnce(
    s,
    'if(type==="READY"){checkoutUiReady=true;sendInit();if(savedCardPayload)post(savedCardPayload);return;}',
    `if(type==="READY"){
      checkoutUiReady=true;

      /*
        O Custom Element pode receber mensagens antes de terminar o bridge,
        especialmente no celular. Quando ele declara READY, reenviamos o INIT
        obrigatoriamente para impedir o loader infinito.
      */
      sendInit(true);

      if(savedCardPayload)post(savedCardPayload);
      return;
    }`,
    'READY deve reenviar INIT'
  );

  s = replaceOnce(
    s,
    'skipIdentity:(Boolean(handoff) || verifiedSession) && socialDataConfirmed(email(source.email)),',
    'skipIdentity:Boolean(handoff) || (verifiedSession && socialDataConfirmed(email(source.email))),',
    'handoff autenticado deve valer em outro dispositivo'
  );

  s = replaceOnce(
    s,
    'ctx.skipIdentity = (alreadyVerifiedThisSession || ctx.skipIdentity === true) && socialDataConfirmed(ctx.email);',
    'ctx.skipIdentity = ctx.skipIdentity === true || (alreadyVerifiedThisSession && socialDataConfirmed(ctx.email));',
    'nao rebaixar handoff confiavel'
  );

  s = replaceOnce(
    s,
    'ctx.skipIdentity = socialDataConfirmed(cadastroBackend.email);',
    'ctx.skipIdentity = ctx.skipIdentity === true || socialDataConfirmed(cadastroBackend.email);',
    'preservar skipIdentity depois da consulta do cliente'
  );

  const novaFuncaoConta = `async function carregarContextoClienteAutenticado() {
  try {
    const perfil = await waitTimeout(buscarClienteDoMembroAtual(), 5000, "");
    const cliente = perfil?.cliente && typeof perfil.cliente === "object" ? perfil.cliente : null;
    const mail = email(perfil?.email || cliente?.email || ctx.email);
    const ddi = "55";
    const n = phone(
      cliente?.whatsappE164 ||
      cliente?.whatsappNacional ||
      cliente?.whatsapp ||
      ctx.whatsappE164 ||
      ctx.whatsapp,
      ddi
    );

    const patch = {
      clienteId: safe(cliente?._id || cliente?.clienteId || ctx.clienteId),
      nome: safe(cliente?.nome || perfil?.nome || ctx.nome),
      email: mail,
      cpfCnpj: cpf(cliente?.cpfCnpj || cliente?.cpf || ctx.cpfCnpj),
      whatsapp: n,
      whatsappE164: n ? phoneE164(n, ddi) : "",
      ddi,
      country: "br"
    };

    ctx = { ...ctx, ...patch };
    saveIdentity(patch);

    /*
      REGRA MULTIDISPOSITIVO:
      se a pessoa esta autenticada na mesma conta Wix e o backend localiza um
      unico cadastro completo pelo e-mail dessa conta, nao pedimos os mesmos
      dados de novo naquele celular/navegador. A conta Wix passa a ser a ancora
      de identidade; storage local vira apenas cache, nunca fonte da verdade.
    */
    const cadastroContaCompleto = Boolean(
      patch.clienteId &&
      n &&
      identityComplete(patch)
    );

    if (cadastroContaCompleto) {
      saveIdentity({
        ...patch,
        whatsappConfirmado: true,
        confirmacaoWhatsappVersao: 5,
        confirmadoEm: new Date().toISOString()
      });

      ctx.skipIdentity = true;
      markSessionIdentityVerified(ctx);
      markSocialDataConfirmed(mail);
    }

    /*
      Antes do READY nao mandamos mensagens auxiliares, pois o Custom Element
      guarda apenas o ultimo payload pendente. Isso evita que CUSTOMER_CONTEXT
      substitua o INIT e deixe o celular preso em \"Carregando checkout...\".
    */
    if (checkoutUiReady) {
      post({
        type: "CUSTOMER_CONTEXT",
        ok: true,
        clienteId: ctx.clienteId,
        nome: ctx.nome,
        email: ctx.email,
        cpfCnpj: ctx.cpfCnpj,
        whatsapp: ctx.whatsapp,
        whatsappE164: ctx.whatsappE164
      });

      if (cadastroContaCompleto) {
        post({
          type: "CUSTOMER_READY",
          ok: true,
          exists: true,
          clienteId: ctx.clienteId,
          nome: ctx.nome,
          email: ctx.email,
          cpfCnpj: ctx.cpfCnpj,
          whatsapp: ctx.whatsapp,
          whatsappE164: ctx.whatsappE164,
          autoPayment: false
        });
      }
    }
  } catch (error) {
    console.warn("Contexto do cliente autenticado nao pode ser atualizado:", error?.message || error);
  }
}`;

  s = replaceBetween(
    s,
    'async function carregarContextoClienteAutenticado() {',
    'async function carregarMetodoPagamentoSalvo() {',
    novaFuncaoConta,
    'contexto autenticado multidispositivo'
  );

  write(file, s);
}

// ======================================================
// 2) PAGINA DE PROJETOS: CONTA WIX E DADOS JA CADASTRADOS
// ======================================================
{
  const file = 'src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js';
  let s = read(file);

  const antigo = `    /*
      Encontrar o cadastro pelo e-mail social NÃO significa que os dados já
      foram conferidos neste navegador. Preservamos a confirmação anterior
      somente quando ela já existia no próprio navegador.
    */
    const jaConfirmadoAqui =
      identificacao.whatsappConfirmado === true;`;

  const novo = `    /*
      A conta Wix autenticada e o cadastro unico encontrado pelo mesmo e-mail
      sao a fonte da verdade entre dispositivos. Se o cadastro backend ja tem
      telefone, nome e documento, nao obrigamos o cliente a repetir tudo apenas
      porque trocou do PC para o celular.
    */
    const jaConfirmadoAqui =
      identificacao.whatsappConfirmado === true;

    const cadastroContaCompleto = Boolean(
      telefone.whatsapp &&
      firstValue(cliente._id, cliente.clienteId) &&
      firstValue(cliente.nome, perfil?.nome).length >= 3 &&
      emailSeguro &&
      onlyDigits(cliente.cpfCnpj || cliente.cpf).length === 11
    );`;

  s = replaceOnce(s, antigo, novo, 'regra de conta entre dispositivos');

  s = replaceOnce(
    s,
    '      whatsappConfirmado:\n        jaConfirmadoAqui,',
    '      whatsappConfirmado:\n        jaConfirmadoAqui || cadastroContaCompleto,',
    'confirmar whatsapp por conta backend'
  );

  s = replaceOnce(
    s,
    `      confirmacaoWhatsappVersao:
        jaConfirmadoAqui
          ? Number(
              identificacao.confirmacaoWhatsappVersao ||
              CONFIRMACAO_FLUXO_VERSAO
            )
          : 0,`,
    `      confirmacaoWhatsappVersao:
        jaConfirmadoAqui || cadastroContaCompleto
          ? Number(
              identificacao.confirmacaoWhatsappVersao ||
              CONFIRMACAO_FLUXO_VERSAO
            )
          : 0,`,
    'versao confirmacao backend'
  );

  s = replaceOnce(
    s,
    `      confirmadoEm:
        jaConfirmadoAqui
          ? safe(identificacao.confirmadoEm)
          : ""`,
    `      confirmadoEm:
        jaConfirmadoAqui || cadastroContaCompleto
          ? safe(identificacao.confirmadoEm) || new Date().toISOString()
          : ""`,
    'data confirmacao backend'
  );

  write(file, s);
}

// ======================================================
// 3) CUSTOM ELEMENT: TODA TROCA DE LAYOUT SOBE O CHECKOUT
// ======================================================
{
  const file = 'src/public/custom-elements/pelego-checkout-pronto.js';
  let s = read(file);

  const novaAltura = `  _scrollCheckoutToTop() {
    const scrollNow = () => {
      try {
        this.style.scrollMarginTop = "8px";
        this.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      } catch (_) {
        try {
          const top = Math.max(0, (this.getBoundingClientRect().top || 0) + (window.scrollY || window.pageYOffset || 0) - 8);
          window.scrollTo({ top, behavior: "smooth" });
        } catch (_) {}
      }
    };

    scrollNow();
    requestAnimationFrame(scrollNow);
    setTimeout(scrollNow, 120);
  }
  _height(value, mode = "") {
    const requested = Math.ceil(Number(value || 0));
    if (!Number.isFinite(requested) || requested <= 0) return;

    const modeKey = String(mode || "").trim().toUpperCase();
    const modeChanged = Boolean(modeKey && modeKey !== this._lastLayoutMode);
    if (modeKey) this._lastLayoutMode = modeKey;

    const height = Math.max(180, Math.min(2300, requested + 2));

    /*
      Mesmo quando a altura nao muda, uma troca real de microtela precisa
      trazer o checkout para o topo. Isso e especialmente importante no
      celular depois de teclado, telefone, CPF, Pix ou troca para cartao.
    */
    if (Math.abs(height - this._appliedHeight) <= 1) {
      if (modeChanged) this._scrollCheckoutToTop();
      return;
    }

    /*
      Dentro do mesmo formulario de cartao preservamos a posicao durante
      pequenos ajustes de altura. Na ENTRADA do modo CARD, entretanto, sobe.
    */
    const preserveScroll = modeKey === "CARD" && !modeChanged;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    this._appliedHeight = height;
    const css = \`${'${height}'}px\`;
    this.style.overflowAnchor = "none";
    this.style.height = css;
    this.style.minHeight = css;
    this.style.maxHeight = css;

    if (this._frame) {
      this._frame.style.overflowAnchor = "none";
      this._frame.style.height = css;
    }

    if (preserveScroll) {
      const restoreScroll = () => {
        try { window.scrollTo(scrollX, scrollY); } catch (_) {}
      };

      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(restoreScroll);
      });
      setTimeout(restoreScroll, 80);
      setTimeout(restoreScroll, 180);
    }

    if (modeChanged) {
      this._scrollCheckoutToTop();
    }

    this.dispatchEvent(new CustomEvent("checkout-height-change", { detail: { height }, bubbles: true, composed: true }));
  }`;

  s = replaceBetween(
    s,
    '  _height(value, mode = "") {',
    '  _onWindowMessage(event) {',
    novaAltura,
    'scroll universal nas trocas de layout'
  );

  write(file, s);
}

console.log('Correcoes aplicadas: INIT mobile, identidade multidispositivo e scroll de etapas.');
