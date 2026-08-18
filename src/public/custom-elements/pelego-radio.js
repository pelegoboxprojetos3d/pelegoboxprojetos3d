const PELEGO_RADIO_HTML = String.raw`
<style>
  :host {
    display: block;
    width: 100%;
    color: #f4f7f5;
    font-family: Arial, Helvetica, sans-serif;
    --pb-green: #24d66b;
    --pb-green-dark: #138b45;
    --pb-bg: #080c0a;
    --pb-panel: #0e1511;
    --pb-line: rgba(68, 255, 138, .28);
    --pb-muted: #8d9991;
  }

  * { box-sizing: border-box; }

  .radio-page {
    width: 100%;
    margin: 0 auto;
    padding: 10px;
    background:
      radial-gradient(circle at 50% -15%, rgba(36, 214, 107, .12), transparent 38%),
      linear-gradient(180deg, #090e0b 0%, #060806 100%);
    border: 1px solid rgba(255,255,255,.06);
    border-radius: 18px;
    overflow: hidden;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 12px 16px 14px;
    border-bottom: 1px solid var(--pb-line);
  }

  .brand {
    min-width: 0;
  }

  .brand strong {
    display: block;
    color: #fff;
    font-size: clamp(19px, 2vw, 31px);
    line-height: 1;
    letter-spacing: .5px;
  }

  .brand strong span { color: var(--pb-green); }

  .brand small {
    display: block;
    margin-top: 7px;
    color: var(--pb-muted);
    font-size: clamp(9px, .9vw, 13px);
  }

  .live {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex: 0 0 auto;
    padding: 8px 11px;
    border: 1px solid rgba(36,214,107,.35);
    border-radius: 999px;
    background: rgba(36,214,107,.08);
    color: #baf6cf;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .6px;
  }

  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--pb-green);
    box-shadow: 0 0 0 0 rgba(36,214,107,.55);
    animation: pulse 1.25s infinite;
  }

  .stage {
    position: relative;
    width: 100%;
    min-height: 560px;
    margin-top: 10px;
    overflow: hidden;
    border: 1px solid var(--pb-line);
    border-radius: 14px;
    background: #050706;
  }

  .player-frame {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 560px;
    border: 0;
    background: #050706;
  }

  .native-player,
  .waiting {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 34px;
    text-align: center;
    background:
      linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px),
      radial-gradient(circle at center, rgba(36,214,107,.10), transparent 50%),
      #070b08;
    background-size: 32px 32px, 32px 32px, auto, auto;
  }

  .waiting-title {
    margin: 0;
    color: #f8fff9;
    font-size: clamp(20px, 2vw, 34px);
    font-weight: 800;
    letter-spacing: .7px;
  }

  .waiting-subtitle {
    max-width: 700px;
    margin: 0;
    color: var(--pb-muted);
    font-size: 12px;
    line-height: 1.55;
  }

  .bars {
    display: flex;
    height: 86px;
    align-items: flex-end;
    justify-content: center;
    gap: 6px;
  }

  .bars i {
    display: block;
    width: 7px;
    min-height: 10px;
    border-radius: 5px 5px 2px 2px;
    background: linear-gradient(180deg, #7cffaa, var(--pb-green));
    box-shadow: 0 0 13px rgba(36,214,107,.18);
    animation: eq 1s ease-in-out infinite alternate;
  }

  .bars i:nth-child(2n) { animation-delay: -.33s; }
  .bars i:nth-child(3n) { animation-delay: -.68s; }
  .bars i:nth-child(5n) { animation-delay: -.18s; }

  .native-player audio {
    width: min(760px, 92%);
    margin-top: 8px;
  }

  .downloads {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    padding: 14px 0 2px;
  }

  .download {
    display: flex;
    min-height: 74px;
    align-items: center;
    justify-content: center;
    gap: 13px;
    padding: 12px 18px;
    border: 1px solid rgba(36,214,107,.35);
    border-radius: 13px;
    background: linear-gradient(180deg, rgba(36,214,107,.13), rgba(36,214,107,.055));
    color: #f8fff9;
    text-decoration: none;
    transition: transform .14s ease, border-color .14s ease, background .14s ease;
  }

  .download:hover {
    transform: translateY(-2px);
    border-color: rgba(36,214,107,.75);
    background: linear-gradient(180deg, rgba(36,214,107,.22), rgba(36,214,107,.08));
  }

  .download.disabled {
    cursor: default;
    opacity: .46;
    pointer-events: none;
  }

  .download svg {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    fill: none;
    stroke: var(--pb-green);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .download-text {
    min-width: 0;
  }

  .download-text strong {
    display: block;
    font-size: clamp(12px, 1.15vw, 16px);
    line-height: 1.15;
  }

  .download-text small {
    display: block;
    margin-top: 5px;
    color: #9ca7a0;
    font-size: 9px;
  }

  @keyframes pulse {
    70% { box-shadow: 0 0 0 8px rgba(36,214,107,0); }
    100% { box-shadow: 0 0 0 0 rgba(36,214,107,0); }
  }

  @keyframes eq {
    from { height: 13px; opacity: .55; }
    to { height: 78px; opacity: 1; }
  }

  @media (min-width: 1450px) {
    .stage,
    .player-frame { min-height: 720px; }
  }

  @media (max-width: 780px) {
    .radio-page { padding: 7px; border-radius: 12px; }
    .head { padding: 10px 9px 12px; }
    .live { font-size: 9px; padding: 7px 9px; }
    .stage,
    .player-frame { min-height: 610px; }
    .downloads { grid-template-columns: 1fr; gap: 8px; padding-top: 9px; }
    .download { min-height: 64px; justify-content: flex-start; }
  }
</style>

<section class="radio-page">
  <header class="head">
    <div class="brand">
      <strong>PELEGO <span>RADIO</span></strong>
      <small>Rádio Pelego Box • Player oficial</small>
    </div>
    <div class="live"><span class="live-dot"></span> ONLINE</div>
  </header>

  <main class="stage" id="stage"></main>

  <div class="downloads">
    <a class="download disabled" id="desktopDownload" href="#" rel="noopener">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2"></rect>
        <path d="M8 20h8M12 16v4"></path>
        <path d="M12 7v6m0 0 2.5-2.5M12 13l-2.5-2.5"></path>
      </svg>
      <span class="download-text">
        <strong>BAIXAR PARA COMPUTADOR</strong>
        <small id="desktopStatus">LINK EM CONFIGURAÇÃO</small>
      </span>
    </a>

    <a class="download disabled" id="mobileDownload" href="#" rel="noopener">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="2" width="10" height="20" rx="2"></rect>
        <path d="M10 5h4M11 19h2"></path>
        <path d="M12 8v6m0 0 2.5-2.5M12 14l-2.5-2.5"></path>
      </svg>
      <span class="download-text">
        <strong>BAIXAR PARA CELULAR</strong>
        <small id="mobileStatus">LINK EM CONFIGURAÇÃO</small>
      </span>
    </a>
  </div>
</section>
`;

class PelegoRadio extends HTMLElement {
  static get observedAttributes() {
    return [
      "player-url",
      "stream-url",
      "desktop-download-url",
      "mobile-download-url",
    ];
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = PELEGO_RADIO_HTML;
    }

    this.renderPlayer();
    this.renderDownloads();
  }

  attributeChangedCallback() {
    if (!this.isConnected || !this.shadowRoot) return;
    this.renderPlayer();
    this.renderDownloads();
  }

  renderPlayer() {
    const stage = this.shadowRoot?.getElementById("stage");
    if (!stage) return;

    const playerUrl = String(this.getAttribute("player-url") || "").trim();
    const streamUrl = String(this.getAttribute("stream-url") || "").trim();

    stage.replaceChildren();

    if (playerUrl) {
      const iframe = document.createElement("iframe");
      iframe.className = "player-frame";
      iframe.src = playerUrl;
      iframe.title = "Rádio Pelego Box";
      iframe.loading = "eager";
      iframe.allow = "autoplay; fullscreen; picture-in-picture";
      iframe.allowFullscreen = true;
      stage.appendChild(iframe);
      return;
    }

    if (streamUrl) {
      const shell = document.createElement("div");
      shell.className = "native-player";
      shell.innerHTML = `
        <div class="bars" aria-hidden="true">${"<i></i>".repeat(24)}</div>
        <h2 class="waiting-title">RÁDIO PELEGO BOX</h2>
        <p class="waiting-subtitle">Transmissão online</p>
      `;

      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = streamUrl;
      shell.appendChild(audio);
      stage.appendChild(shell);
      return;
    }

    const waiting = document.createElement("div");
    waiting.className = "waiting";
    waiting.innerHTML = `
      <div class="bars" aria-hidden="true">${"<i></i>".repeat(24)}</div>
      <h2 class="waiting-title">PELEGO RADIO</h2>
      <p class="waiting-subtitle">Estrutura da página pronta. O HTML/URL definitivo do player entra aqui sem alterar o restante da página.</p>
    `;
    stage.appendChild(waiting);
  }

  renderDownloads() {
    this.configureDownload(
      "desktopDownload",
      "desktopStatus",
      this.getAttribute("desktop-download-url"),
      "DOWNLOAD PARA WINDOWS",
    );

    this.configureDownload(
      "mobileDownload",
      "mobileStatus",
      this.getAttribute("mobile-download-url"),
      "DOWNLOAD PARA CELULAR",
    );
  }

  configureDownload(linkId, statusId, rawUrl, readyLabel) {
    const link = this.shadowRoot?.getElementById(linkId);
    const status = this.shadowRoot?.getElementById(statusId);
    const url = String(rawUrl || "").trim();

    if (!(link instanceof HTMLAnchorElement) || !status) return;

    if (url) {
      link.href = url;
      link.classList.remove("disabled");
      link.setAttribute("target", "_blank");
      status.textContent = readyLabel;
    } else {
      link.href = "#";
      link.classList.add("disabled");
      link.removeAttribute("target");
      status.textContent = "LINK EM CONFIGURAÇÃO";
    }
  }
}

if (!customElements.get("pelego-radio")) {
  customElements.define("pelego-radio", PelegoRadio);
}
