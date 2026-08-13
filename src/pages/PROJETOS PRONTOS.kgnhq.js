import wixLocation from "wix-location";
import { authentication, currentMember } from "wix-members-frontend";

function configurarProjetos() {
    $w("#repeater1").onItemReady(($item, itemData, index) => {

        // ========================================
        // POSIÇÃO
        // ========================================

        $item("#txtPosicao").text =
            "#" + (index + 1);

        // ========================================
        // MARCA / BOTÃO
        // ========================================

        const marcaOriginal =
            String(itemData.marca || "").trim();

        $item("#btnMarca").label =
            marcaOriginal;

        const site =
            String(
                itemData.site ||
                itemData.Site ||
                ""
            ).trim();

        if (site) {

            $item("#btnMarca").link =
                site;

            $item("#btnMarca").target =
                "_blank";

        }

        // ========================================
        // QUANTIDADE
        // ========================================

        $item("#txtQuantidade").text =
            String(itemData.quantidadeDeProjetos || 0);

        // ========================================
        // CHECK ESCONDIDO
        // ========================================

        try {
            $item("#checkVideo").hide();
        } catch (_) {}

        $item("#checkVideo").collapse();

        // ========================================
        // URL DOS PROJETOS
        // ========================================

        const marcaLimpa =
            marcaOriginal
                .replace(/ALTO-FALANTES/gi, "")
                .replace(/\s+/g, " ")
                .trim();

        const marca =
            encodeURIComponent(marcaLimpa);

        const url =
            `/videos-dos-projetos-prontos?marca=${marca}`;

        // ========================================
        // BOTÃO PROJETOS
        // ========================================

        $item("#btnProjetos").link =
            url;

        $item("#btnProjetos").target =
            "_blank";

        $item("#btnProjetos").onClick(async () => {

            const check = $item("#checkVideo");

            check.checked =
                true;

            await check.expand();

            try {
                await check.show("fade");
            } catch (_) {
                check.show();
            }

        });

    });
}

async function verificarAcessoProjetosProntos() {
    try {
        const membro = await currentMember.getMember();

        if (membro?._id) {
            configurarProjetos();
            return;
        }
    } catch (_) {
        // Visitante ainda não autenticado.
    }

    authentication
        .promptLogin({
            mode: "login",
            modal: true
        })
        .then(() => {
            configurarProjetos();
        })
        .catch(() => {
            wixLocation.to("/");
        });
}

$w.onReady(function () {
    verificarAcessoProjetosProntos().catch(console.error);
});
