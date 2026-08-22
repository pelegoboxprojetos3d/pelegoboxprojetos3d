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
                "_self";

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

        // Navegação interna permanece na mesma aba/página.
        $item("#btnProjetos").target =
            "_self";

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

function configurarBotaoVerTodos() {
    const botao = $w("#vertodososprojeosprontos");

    botao.link =
        "/videos-dos-projetos-prontos";

    botao.target =
        "_self";
}

$w.onReady(function () {
    configurarProjetos();
    configurarBotaoVerTodos();
});
