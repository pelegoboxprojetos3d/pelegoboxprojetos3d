# BUILD V5.4.5 — LAYOUT APROVADO

Status: **pronta para teste visual no Windows**.

## Base
- `PELEGO_RADIO_V5.4.3_LIMPA.zip`
- SHA-256: `9e732e260b1e80f0db4ca95347d54b42f2a8db3ae5f7d1802e00c9aeb8ce5d1c`

## Build gerada
- `PELEGO_BOX_RADIO_V5.4.5_LAYOUT_APROVADO.zip`
- SHA-256: `fe79d92b7b1ec8f1423fc81c714c6ec27ec153d6d32dfb2a786a12127f031dc8`

## Alterações controladas
- Layout reorganizado conforme `LAYOUT_APROVADO.md`.
- Catálogos completos sincronizados em segundo plano pelo endpoint público PELEGO RADIO.
- Rotação de ambos os catálogos a cada 15 segundos.
- Imagens remotas em cache local, sem bloquear a interface.
- Popup estilizado de confirmação antes da desinstalação.
- `PelegoAudioDsp.cs` preservado byte a byte da base funcional.
- `stations.json` preservado byte a byte da base funcional.

## Validação antes do ZIP
- JSONs locais parseados.
- Arquivos PowerShell sem tokens léxicos de erro.
- Chaves, parênteses e colchetes balanceados fora de strings/comentários.
- ZIP testado sem erro de integridade.

## Próxima aprovação
Instalar no Windows e comparar visualmente com os prints aprovados. O próximo ajuste deve ser somente o que aparecer diferente no screenshot, sem reabrir escopo funcional.
