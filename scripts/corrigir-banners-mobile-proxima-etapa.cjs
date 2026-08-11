const fs = require("fs");

const caminho = "src/pages/CHECKOUT PROJETOS PRONTOS.p5onq.js";
let codigo = fs.readFileSync(caminho, "utf8");
let alterou = false;

const regraAntiga = `async function aplicarRegraVisualAvisosPaginaPrincipal() {
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  const etapas = [
    { id: IDS.avisoMedidas, pago: acessos.medidas === true },
    { id: IDS.avisoGraficos, pago: acessos.graficos === true },
    { id: IDS.avisoProjeto, pago: acessos.projeto === true }
  ];

  for (const etapa of etapas) {
    estilizarAvisoPaginaPrincipal(etapa.id, etapa.pago);

    /*
      REGRA DA PÁGINA /checkoutprojetosprontos:
      - Desktop: os três banners aparecem sempre.
      - Desktop: pago recebe borda verde; a sombra configurada no Editor é preservada.
      - Mobile: o banner referente à etapa paga some e recolhe o espaço.
      - Estado vem de acessos + IDs dos banners, nunca de sessão visual.
    */
    await alternarAvisoPaginaPrincipal(
      etapa.id,
      mobile ? !etapa.pago : true
    );
  }
}`;

const regraNova = `async function aplicarRegraVisualAvisosPaginaPrincipal() {
  const mobile = wixWindowFrontend.formFactor === "Mobile";

  const etapas = [
    { id: IDS.avisoMedidas, pago: acessos.medidas === true },
    { id: IDS.avisoGraficos, pago: acessos.graficos === true },
    { id: IDS.avisoProjeto, pago: acessos.projeto === true }
  ];

  /*
    REGRA MOBILE OFICIAL:
    mostra SOMENTE o banner da próxima etapa que falta pagar.

    nenhuma compra       -> banner Medidas
    Medidas paga         -> banner Gráficos
    Medidas + Gráficos   -> banner Projeto Completo
    tudo pago            -> nenhum banner

    Desktop continua mostrando os três banners.
  */
  const proximoBannerMobile =
    !acessos.medidas
      ? IDS.avisoMedidas
      : !acessos.graficos
        ? IDS.avisoGraficos
        : !acessos.projeto
          ? IDS.avisoProjeto
          : "";

  for (const etapa of etapas) {
    estilizarAvisoPaginaPrincipal(etapa.id, etapa.pago);

    await alternarAvisoPaginaPrincipal(
      etapa.id,
      mobile
        ? etapa.id === proximoBannerMobile
        : true
    );
  }
}`;

if (codigo.includes(regraAntiga)) {
  codigo = codigo.replace(regraAntiga, regraNova);
  alterou = true;
} else if (!codigo.includes("const proximoBannerMobile =")) {
  throw new Error("Não encontrei a regra visual antiga dos banners mobile.");
}

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

if (codigo.includes(cacheAntigo)) {
  codigo = codigo.replace(cacheAntigo, cacheNovo);
  alterou = true;
} else if (!codigo.includes("Erro ao revalidar acessos mobile:")) {
  throw new Error("Não encontrei o retorno do cache local para revalidar no mobile.");
}

if (alterou) {
  fs.writeFileSync(caminho, codigo, "utf8");
  console.log("Correção mobile aplicada: somente próxima etapa + revalidação do backend.");
} else {
  console.log("Correção mobile já estava aplicada.");
}
