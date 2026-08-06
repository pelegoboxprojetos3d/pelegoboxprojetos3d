import wixWindow from 'wix-window';

import {
    buscarCliente,
    criarCliente,
    atualizarUltimoAcesso
} from 'backend/clientes.web';

import {
    createCheckoutProPreference
} from 'backend/mpCheckoutPro-pro';

let contexto = {};

$w.onReady(function () {

    contexto = wixWindow.lightbox.getContext() || {};

    $w("#html1").postMessage({
        type: "INIT",
        ctx: {
            produto: contexto.titulo,
            sku: contexto.sku,
            valor: contexto.valor,
            img: contexto.imagem
        }
    });

    $w("#html1").onMessage(async (event) => {

        const dados = event.data;

        if (!dados) return;

        switch (dados.type || dados.tipo) {

            case "FECHAR":
            case "CLOSE":

                wixWindow.lightbox.close();
                break;

            case "CHECK_CUSTOMER":

                try {

                    const telefone =
                        dados.telefone ||
                        dados.whatsapp ||
                        "";

                    const cliente = await buscarCliente({
                        telefone
                    });

                    if (cliente) {

                        await atualizarUltimoAcesso({
                            telefone
                        });

                        const checkout =
                            await createCheckoutProPreference({

                                codigoProjeto: contexto.codigo,
                                etapa: contexto.etapa,

                                produto: contexto.titulo,
                                sku: contexto.sku,
                                valor: contexto.valor,
                                imagem: contexto.imagem,

                                telefone,
                                email: cliente.email || ""

                            });

                        $w("#html1").postMessage({

                            type: "PRO_RESULT",

                            ok: checkout.ok,

                            preferenceId: checkout.preferenceId,

                            checkoutId: checkout.checkoutId,

                            init_point: checkout.init_point

                        });

                    } else {

                        $w("#html1").postMessage({

                            type: "SHOW_EMAIL"

                        });

                    }

                } catch (erro) {

                    console.error(erro);

                    $w("#html1").postMessage({

                        type: "ERROR",
                        message: erro.message

                    });

                }

                break;
                            case "CREATE_CUSTOMER":

                try {

                    const telefone =
                        dados.telefone ||
                        dados.whatsapp ||
                        "";

                    const email =
                        dados.email || "";

                    await criarCliente({

                        telefone,
                        email

                    });

                    const checkout =
                        await createCheckoutProPreference({

                            codigoProjeto: contexto.codigo,
                            etapa: contexto.etapa,

                            produto: contexto.titulo,
                            sku: contexto.sku,
                            valor: contexto.valor,
                            imagem: contexto.imagem,

                            telefone,
                            email

                        });

                    $w("#html1").postMessage({

                        type: "PRO_RESULT",

                        ok: checkout.ok,

                        preferenceId: checkout.preferenceId,

                        checkoutId: checkout.checkoutId,

                        init_point: checkout.init_point

                    });

                } catch (erro) {

                    console.error(erro);

                    $w("#html1").postMessage({

                        type: "ERROR",
                        message: erro.message

                    });

                }

                break;

            case "WHATSAPP":

                wixWindow.lightbox.close({

                    codigoProjeto: contexto.codigo,
                    etapa: contexto.etapa,

                    telefone: dados.telefone || dados.whatsapp,
                    pais: dados.pais || dados.country,
                    ddi: dados.ddi || "55",
                    email: dados.email || ""

                });

                break;

        }

    });

});