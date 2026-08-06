$w.onReady(function () {

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

        $item("#btnProjetos").onClick(() => {

            $item("#checkVideo").checked =
                true;

            $item("#checkVideo").expand();

        });

    });

});