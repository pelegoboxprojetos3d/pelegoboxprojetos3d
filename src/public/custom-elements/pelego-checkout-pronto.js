class PelegoCheckoutPronto extends HTMLElement {
  constructor() {
    super();
    this.estado = "INICIAL";
    this.alturas = {
      INICIAL: 220,
      DADOS: 340,
      PIX: 560,
      CARTAO: 760
    };
  }

  connectedCallback() {
    this.style.display = "block";
    this.style.width = "100%";
    this.style.boxSizing = "border-box";
    this.render();
  }

  mudarEstado(estado) {
    if (!this.alturas[estado]) return;
    this.estado = estado;
    this.render();
  }

  aplicarAltura() {
    const altura = this.alturas[this.estado] || this.alturas.INICIAL;
    this.style.height = `${altura}px`;

    this.dispatchEvent(new CustomEvent("checkout-height-change", {
      detail: { estado: this.estado, altura },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const altura = this.alturas[this.estado] || this.alturas.INICIAL;

    this.innerHTML = `
      <style>
        .pelegoTest {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif;
          border: 2px solid #159447;
          border-radius: 14px;
          background: #fff;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .pelegoTest h2 {
          margin: 0;
          font-size: 20px;
        }
        .pelegoTest p {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;
        }
        .buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        button {
          border: 0;
          border-radius: 9px;
          padding: 10px 14px;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
        }
        .content {
          flex: 1;
          border-radius: 10px;
          background: #f7f9fb;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 16px;
        }
      </style>

      <div class="pelegoTest">
        <h2>Teste de altura dinâmica do checkout</h2>
        <p>Estado atual: <strong>${this.estado}</strong> · altura do componente: <strong>${altura}px</strong></p>

        <div class="buttons">
          <button data-estado="INICIAL">1. Inicial</button>
          <button data-estado="DADOS">2. Dados confirmados</button>
          <button data-estado="PIX">3. Pix</button>
          <button data-estado="CARTAO">4. Cartão</button>
        </div>

        <div class="content">
          Se o banner abaixo descer e subir junto quando você trocar os estados, a solução funciona.
        </div>
      </div>
    `;

    this.querySelectorAll("button[data-estado]").forEach((botao) => {
      botao.addEventListener("click", () => this.mudarEstado(botao.dataset.estado));
    });

    this.aplicarAltura();
  }
}

if (!customElements.get("pelego-checkout-pronto")) {
  customElements.define("pelego-checkout-pronto", PelegoCheckoutPronto);
}
