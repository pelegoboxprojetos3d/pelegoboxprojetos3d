/*
  Consolidação do fluxo de checkout em 12/08/2026.
  O script anterior foi substituído por uma manutenção idempotente que cobre:
  - handoff completo da página anterior para o checkout;
  - botão de identificação cinza/verde em tempo real;
  - reutilização segura de priceId local antes de consultar a ValidaPay.
*/
require("./corrigir-fluxo-checkout-estavel-2026-08-12.cjs");
