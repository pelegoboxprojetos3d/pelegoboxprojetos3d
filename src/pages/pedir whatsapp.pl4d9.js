import wixWindowFrontend from "wix-window-frontend";

// POPUP LEGADO: pedir whatsapp
//
// O fluxo oficial de Projetos Prontos agora usa autenticação Wix
// com Google/Facebook. Este popup permanece temporariamente no site
// apenas para não quebrar eventuais vínculos antigos do Editor.
// Se algum vínculo antigo tentar abri-lo, ele fecha imediatamente.

$w.onReady(function () {
  try {
    const html = $w("#htmlWhatsappInicial");

    if (html && typeof html.hide === "function") {
      html.hide();
    }
  } catch (_) {}

  wixWindowFrontend.lightbox.close({
    action: "LEGACY_DISABLED",
    closed: true
  });
});
