const fs = require("fs");

const caminho = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let codigo = fs.readFileSync(caminho, "utf8");

const inicio = "async function aplicarRegraVisualAvisosPaginaPrincipal() {";
const fim = "\n\nasync function mostrarValoresEAcessos() {";

const posInicio = codigo.indexOf(inicio);
const posFim = codigo.indexOf(fim, posInicio);

if (posInicio < 0 || posFim < 0) {
  throw new Error("Não encontrei a função de banners mobile do checkout.");
}

const regraNova = `async function aplicarRegraVisualAvisosPaginaPrincipal() {
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  const etapas = [
    { id: IDS.avisoMedidas, pago: acessos.medidas === true },
    { id: IDS.avisoGraficos, pago: acessos.graficos === true },
    { id: IDS.avisoProjeto, pago: acessos.projeto === true }
  ];

  /*
    REGRA MOBILE OFICIAL E ÚNICA:
    - etapa paga: esconde e recolhe o banner;
    - etapa não paga: mostra o banner;
    - não depende de ser a próxima etapa disponível;
    - desktop continua mostrando os três banners.
  */
  for (const etapa of etapas) {
    estilizarAvisoPaginaPrincipal(etapa.id, etapa.pago);

    await alternarAvisoPaginaPrincipal(
      etapa.id,
      mobile ? !etapa.pago : true
    );
  }
}`;

const atual = codigo.slice(posInicio, posFim);
let alterou = false;

if (atual !== regraNova) {
  codigo =
    codigo.slice(0, posInicio) +
    regraNova +
    codigo.slice(posFim);
  alterou = true;
}

/*
  Compatibilidade:
  - fluxo antigo: revalidava somente no mobile;
  - fluxo atual: usa o cache apenas para pintar rápido e revalida no backend
    em segundo plano no desktop e no mobile.

  Se a revalidação cross-browser já existe, não tentamos reintroduzir o
  bloco mobile antigo.
*/
const temRevalidacaoMobileAntiga =
  codigo.includes("Erro ao revalidar acessos mobile:");

const temRevalidacaoCrossBrowser =
  codigo.includes("Erro ao atualizar acessos em segundo plano:");

if (!temRevalidacaoMobileAntiga && !temRevalidacaoCrossBrowser) {
  const cacheAntigo = `        await mostrarValoresEAcessos();
        return;`;

  const cacheNovo = `        await mostrarValoresEAcessos();

        /*
          No celular, o cache serve apenas para pintar a tela rápido.
          Logo depois confirmamos os acessos no backend. Assim uma compra
          recente não deixa banner antigo preso no navegador.
        */
        if (
          wixWindowFrontend.formFactor === "Mobile"
        ) {
          identificarCliente(
            salva
          ).catch(
            (error) => {
              console.error(
                "Erro ao revalidar acessos mobile:",
                error?.message || error
              );
            }
          );
        }

        return;`;

  if (!codigo.includes(cacheAntigo)) {
    throw new Error("Não encontrei o retorno do cache local para revalidar no mobile.");
  }

  codigo = codigo.replace(cacheAntigo, cacheNovo);
  alterou = true;
}

if (alterou) {
  fs.writeFileSync(caminho, codigo, "utf8");
  console.log("Banners mobile corrigidos: pago some; não pago aparece.");
} else {
  console.log("Regra mobile já está correta: pago some; não pago aparece.");
}