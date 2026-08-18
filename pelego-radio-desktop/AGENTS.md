# AGENTS.md — PELEGO BOX RÁDIO DESKTOP

## REGRA PRINCIPAL
A base `V5.4.3 LIMPA` é a referência funcional. Não reescrever o aplicativo inteiro. Alterações devem ser incrementais, pequenas e verificáveis por diff.

## PROTEGIDO — NÃO ALTERAR SEM PEDIDO EXPLÍCITO
- Motor de áudio e DSP.
- Funções de reprodução, parar, próxima faixa e rádio automática.
- Equalizador e presets.
- Persistência/salvamento.
- Ocultar/minimizar.
- Eventos já funcionais dos controles.
- Comportamento funcional existente do instalador, salvo ajuste solicitado.

## LAYOUT
As imagens aprovadas pelo usuário são especificação visual, não inspiração. Reproduzir disposição, proporções, bordas, botões, títulos e hierarquia visual o mais fielmente possível.

## CATÁLOGOS
- Projetos Feitos do Zero: catálogo do site `https://www.pelegobox.com.br/category/all-products`, usando o endpoint público PELEGO RADIO `kind=zero`.
- Projetos Prontos: `https://www.pelegobox.com.br/videos-dos-projetos-prontos`, usando `kind=pronto`.
- Mostrar um item por vez e avançar automaticamente a cada 15 segundos até o último, então voltar ao primeiro.
- VOLTAR e PRÓXIMO navegam manualmente; COMPRAR abre a URL pública do item.
- Usar cache local e não travar o áudio enquanto sincroniza.

## FLUXO
1. Partir sempre da base registrada.
2. Uma missão por commit.
3. Identificar antes quais trechos serão tocados.
4. Comparar diff depois.
5. Não alterar o motor para resolver problema visual.
6. Resultado visual é aprovado por screenshot no Windows.
7. Só após aprovação visual seguir para novas funções.
