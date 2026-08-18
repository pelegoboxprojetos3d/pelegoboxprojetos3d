# PELEGO BOX RÁDIO DESKTOP

Área isolada do repositório para o aplicativo PELEGO BOX RÁDIO de Windows.

## Verdade do projeto
- Base funcional congelada: `PELEGO_RADIO_V5.4.3_LIMPA.zip`
- SHA-256 da base: `9e732e260b1e80f0db4ca95347d54b42f2a8db3ae5f7d1802e00c9aeb8ce5d1c`
- Branch de trabalho: `pelego-radio-desktop`
- Layout aprovado em 17/08/2026.

## Fase atual
Implementar o layout aprovado sem reescrever o motor de áudio. Catálogos completos entram por sincronização do endpoint público `/_functions/pelegoRadioCatalog`.

## Regra de trabalho
Uma mudança por vez, sempre com diff rastreável. Nada de gerar sucessivas versões quase iguais sem identificar exatamente o que mudou.
