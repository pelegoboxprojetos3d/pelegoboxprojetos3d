# Apps Script — SITE PELEGO BOX

Esta pasta será a fonte oficial dos códigos do Google Apps Script ligados à planilha `SITE`.

## Estrutura planejada

- `codigo.gs` — código principal da planilha / integrações
- `BUSCADOR_PELEGO_BOX.gs` — lógica do buscador lateral
- `BuscadorPeleGoBox.html` — interface do buscador
- `appsscript.json` — manifesto do projeto Apps Script

## Regra de trabalho

1. Alterações de código serão feitas e versionadas aqui no GitHub.
2. Depois, o deploy para o Apps Script será automatizado com `clasp` + GitHub Actions.
3. A planilha `SITE`, Wix e Make continuam armazenando/rodando os dados; o GitHub será a fonte oficial do código.
4. Não colocar chaves, tokens, webhooks ou segredos dentro do repositório. Eles ficam em propriedades/segredos próprios.

## Status

Estrutura criada para iniciar a centralização. O próximo passo é importar os três arquivos atuais do Apps Script sem alterar o funcionamento da planilha.
