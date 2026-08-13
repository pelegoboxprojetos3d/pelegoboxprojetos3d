const fs = require('fs');

const CHECKOUT = 'src/public/custom-elements/pelego-checkout-pronto.js';
const PAYMENT_FILES = [
  'src/backend/validaPayPixProjetosProntosCore.jsw',
  'src/backend/validaPayCartaoProjetosProntos.jsw'
];

function patchCheckout() {
  let code = fs.readFileSync(CHECKOUT, 'utf8');
  let changed = false;

  const oldSuccess = 'function showSuccess(){stopTetris();E.identity.classList.add("hidden");E.payment.classList.add("hidden");E.already.classList.add("hidden");E.success.classList.remove("hidden");setStep(3);layoutMode("SUCCESS");requestAnimationFrame(celebratePayment)}';
  const newSuccess = 'function showSuccess(){stopTetris();E.identity.classList.add("hidden");E.payment.classList.add("hidden");E.already.classList.add("hidden");E.success.classList.remove("hidden");setStep(3);layoutMode("SUCCESS");post({type:"PAYMENT_CELEBRATION",tipoProduto:S.ctx.tipoProduto||"MEDIDAS"})}';

  if (!code.includes(newSuccess)) {
    if (!code.includes(oldSuccess)) throw new Error('showSuccess do checkout não encontrado.');
    code = code.replace(oldSuccess, newSuccess);
    changed = true;
  }

  if (!code.includes('function pelegoCelebrateFullScreen(tipoProduto)')) {
    const marker = 'class PelegoCheckoutPronto extends HTMLElement {';
    if (!code.includes(marker)) throw new Error('Classe do Custom Element não encontrada.');

    const fn = String.raw`
function pelegoCelebrateFullScreen(tipoProduto) {
  try {
    const old = document.getElementById('pelegoPaymentCelebrationFullScreen');
    if (old) old.remove();

    const canvas = document.createElement('canvas');
    canvas.id = 'pelegoPaymentCelebrationFullScreen';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;margin:0;padding:0;';
    (document.body || document.documentElement).appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    let h = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const raw = String(tipoProduto || 'MEDIDAS')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/[\s-]+/g, '_');
    const mode = raw === 'GRAFICOS' ? 2 : raw === 'PROJETO_COMPLETO' ? 3 : 1;
    const palettes = {
      1: ['#159447', '#7dd89b', '#ffffff', '#f4c84b', '#e8f7ed'],
      2: ['#159447', '#48b8ff', '#ffffff', '#8b7cf6', '#73e1d2'],
      3: ['#159447', '#ffd24d', '#ffffff', '#ff7b5c', '#58c7c7', '#c67cff']
    };
    const colors = palettes[mode];
    const particles = [];
    const start = performance.now();
    const duration = 1850;
    let raf = 0;

    function add(x, y, vx, vy, size, life, shape) {
      particles.push({
        x, y, vx, vy, size, life, max: life,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.26,
        color: colors[(Math.random() * colors.length) | 0],
        shape: shape || 0
      });
    }

    function burst(x, y, count, power, upward) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const speed = power * (0.45 + Math.random() * 0.8);
        add(
          x, y,
          Math.cos(a) * speed,
          Math.sin(a) * speed - (upward || 0),
          5 + Math.random() * 7,
          70 + Math.random() * 45,
          i % 3
        );
      }
    }

    function rain(count) {
      for (let i = 0; i < count; i++) {
        add(
          Math.random() * w,
          -20 - Math.random() * h * 0.28,
          (Math.random() - 0.5) * 1.8,
          2.5 + Math.random() * 3.4,
          4 + Math.random() * 6,
          85 + Math.random() * 45,
          i % 3
        );
      }
    }

    if (mode === 1) {
      burst(w * 0.50, h * 0.46, 135, 8.2, 1.6);
      burst(w * 0.10, h * 0.72, 55, 6.8, 4.2);
      burst(w * 0.90, h * 0.72, 55, 6.8, 4.2);
    } else if (mode === 2) {
      rain(190);
      burst(w * 0.18, h * 0.38, 60, 6.6, 1.4);
      burst(w * 0.82, h * 0.38, 60, 6.6, 1.4);
    } else {
      burst(w * 0.50, h * 0.84, 150, 10.2, 7.0);
      burst(w * 0.18, h * 0.70, 75, 7.8, 5.3);
      burst(w * 0.82, h * 0.70, 75, 7.8, 5.3);
      rain(80);
    }

    function draw(p) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      if (p.shape === 1) {
        ctx.fillRect(-p.size * 0.8, -p.size * 0.18, p.size * 1.6, p.size * 0.36);
      } else if (p.shape === 2) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.48, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size * 0.48, -p.size * 0.48, p.size * 0.96, p.size * 0.96);
      }
      ctx.restore();
    }

    function frame(now) {
      ctx.clearRect(0, 0, w, h);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= 1.35;
        p.vy += mode === 2 ? 0.055 : 0.105;
        p.vx *= 0.994;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        draw(p);
        if (p.life <= 0 || p.y > h + 100) particles.splice(i, 1);
      }

      if (now - start < duration && particles.length) {
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    }

    raf = requestAnimationFrame(frame);
    setTimeout(() => {
      if (canvas.isConnected) {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    }, 2200);
  } catch (error) {
    console.warn('Falha na celebração fullscreen:', error?.message || error);
  }
}

`;

    code = code.replace(marker, fn + marker);
    changed = true;
  }

  const readyMarker = '    if (type === "READY") {';
  const celebrationHandler = '    if (type === "PAYMENT_CELEBRATION") { pelegoCelebrateFullScreen(data.tipoProduto || data.productType || "MEDIDAS"); return; }\n';
  if (!code.includes(celebrationHandler.trim())) {
    if (!code.includes(readyMarker)) throw new Error('Handler externo do iframe não encontrado.');
    code = code.replace(readyMarker, celebrationHandler + readyMarker);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(CHECKOUT, code, 'utf8');
    console.log('Celebração movida do iframe para a tela inteira do Wix.');
  } else {
    console.log('Celebração fullscreen já aplicada.');
  }
}

function patchInvoice(file) {
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;

  const oldIf = '      if (response.ok) {\n        return {\n          sent: true,';
  const newIf = '      const providerConfirmed = response.ok && response.data?.success === true;\n      if (providerConfirmed) {\n        return {\n          sent: true,';

  if (!code.includes('const providerConfirmed = response.ok && response.data?.success === true;')) {
    if (!code.includes(oldIf)) throw new Error(`${file}: bloco de confirmação da fatura não encontrado.`);
    code = code.replace(oldIf, newIf);
    changed = true;
  }

  const oldError = '        error: response.error || "notification_resend_failed",';
  const newError = '        error: response.ok && response.data?.success !== true ? "notification_not_confirmed" : (response.error || "notification_resend_failed"),';
  if (!code.includes('notification_not_confirmed')) {
    if (!code.includes(oldError)) throw new Error(`${file}: erro do reenvio não encontrado.`);
    code = code.replace(oldError, newError);
    changed = true;
  }

  // Se a primeira rodada não confirmou o envio, permitimos nova tentativa logo depois
  // em vez de congelar por 30 segundos. O flag de sucesso continua impedindo duplicação.
  if (code.includes('Date.now() - ultimaTentativa < 30000')) {
    code = code.replace('Date.now() - ultimaTentativa < 30000', 'Date.now() - ultimaTentativa < 8000');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, code, 'utf8');
    console.log(`${file}: fatura ValidaPay exige confirmação real de sucesso e permite retentativa curta.`);
  } else {
    console.log(`${file}: fatura ValidaPay já está blindada.`);
  }
}

patchCheckout();
for (const file of PAYMENT_FILES) patchInvoice(file);
