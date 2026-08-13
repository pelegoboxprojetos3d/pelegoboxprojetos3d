const fs = require("fs");

// Reaplica por último as duas correções que scripts antigos podem sobrescrever:
// 1) celebração fora do iframe, cobrindo a viewport inteira;
// 2) reenvio da notificação/fatura ValidaPay só marcado como enviado quando
//    o provedor não responde explicitamente success:false.
require("./finalizar-confete-fullscreen-fatura-validapay-2026-08-12.cjs");

const PAGE = "src/pages/checkout-projeto-pronto.i9aj1.js";
let code = fs.readFileSync(PAGE, "utf8");
let changed = false;

function replaceAllExact(from, to) {
  if (!code.includes(from)) return;
  code = code.split(from).join(to);
  changed = true;
}

// A comemoração fullscreen dura ~1,85 s. Antes a navegação para a entrega
// acontecia em 650/850 ms e cortava o efeito no meio. Mantemos a tela de
// "Pagamento aprovado" tempo suficiente para a animação terminar.
replaceAllExact("abrirEntregaComFallback(650);", "abrirEntregaComFallback(1900);");
replaceAllExact("abrirEntregaComFallback(850);", "abrirEntregaComFallback(1900);");

if (changed) {
  fs.writeFileSync(PAGE, code, "utf8");
  console.log("Entrega ajustada para abrir após a celebração fullscreen (~1,9 s).");
} else {
  console.log("Tempo pós-pagamento já preserva a celebração fullscreen.");
}
