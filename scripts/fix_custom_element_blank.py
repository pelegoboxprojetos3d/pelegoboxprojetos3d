from pathlib import Path

page = Path('src/pages/checkout-projeto-pronto.i9aj1.js')
s = page.read_text(encoding='utf-8')

replacements = [
    ('const HTML_ID = "#htmlCheckoutValidaPay";', 'const CUSTOM_ID = "#checkoutProntoCustom";'),
    ('$w(HTML_ID).postMessage(payload);', '$w(CUSTOM_ID).setAttribute("checkout-message", JSON.stringify(payload));'),
    ('console.error("HTML checkout post:", e?.message || e);', 'console.error("Custom Element post:", e?.message || e);'),
    ('const checkout=$w(HTML_ID);\n  checkout.onMessage(event=>{\n    let data=event?.data ?? event;', 'const checkout=$w(CUSTOM_ID);\n  checkout.on("checkout-message", event=>{\n    let data=event?.detail ?? event?.data ?? event;')
]

for old, new in replacements:
    if old not in s:
        raise SystemExit(f'Trecho esperado não encontrado na página: {old[:80]}')
    s = s.replace(old, new, 1)

if 'HTML_ID' in s or '#htmlCheckoutValidaPay' in s:
    raise SystemExit('Referência ao HTML antigo ainda ficou na página')
if '#checkoutProntoCustom' not in s or 'checkout.on("checkout-message"' not in s:
    raise SystemExit('Ponte do Custom Element não ficou completa')

page.write_text(s.rstrip() + '\n', encoding='utf-8')

custom = Path('src/public/custom-elements/pelego-checkout-pronto.js')
c = custom.read_text(encoding='utf-8')

old = '''    frame.srcdoc = CHECKOUT_HTML;
    this.replaceChildren(frame);
    this._frame = frame;
    window.addEventListener("message", this._windowHandler);
    frame.addEventListener("load", () => this._flush());'''

new = '''    this.replaceChildren(frame);
    this._frame = frame;
    window.addEventListener("message", this._windowHandler);

    let checkoutMounted = false;
    const mountCheckout = () => {
      if (checkoutMounted) return;
      const doc = frame.contentDocument;
      if (!doc) return;
      checkoutMounted = true;
      doc.open();
      doc.write(CHECKOUT_HTML);
      doc.close();
      setTimeout(() => this._flush(), 0);
    };

    frame.addEventListener("load", mountCheckout, { once: true });
    frame.src = "about:blank";
    setTimeout(mountCheckout, 0);'''

if old not in c:
    raise SystemExit('Trecho srcdoc esperado não encontrado no Custom Element')
c = c.replace(old, new, 1)

if 'frame.srcdoc = CHECKOUT_HTML' in c:
    raise SystemExit('srcdoc antigo ainda presente')
if 'doc.write(CHECKOUT_HTML)' not in c:
    raise SystemExit('Nova montagem do checkout não foi aplicada')
if 'customElements.define("pelego-checkout-pronto"' not in c:
    raise SystemExit('Registro da tag foi perdido')

custom.write_text(c.rstrip() + '\n', encoding='utf-8')
print('Correção aplicada aos dois arquivos.')
