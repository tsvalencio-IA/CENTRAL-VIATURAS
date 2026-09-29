# Changelog

## 1.0.0 — 2026-09-29

- Fundação do repositório CENTRAL-VIATURAS.
- Integração somente leitura com dados já existentes do SaaS/Checklist.
- Recados internos gravados na própria O.S. via `etapasInternas`.
- Dashboard responsivo para PC/celular.
- Link individual por placa para compartilhamento no WhatsApp.
- Proteção visual: nenhum valor financeiro é apresentado.
- Novidades calculadas por usuário/aparelho sem alterar as três aplicações atuais.
- COTAR documentado como integração parcial até receber sincronização compartilhada.


## 1.0.1 — 2026-09-29

- Corrigido o entendimento da persistência: atualizações são gravadas somente na O.S. real.
- Removida qualquer tentativa de escrita em coleção paralela de notificações.
- Login/sessão alinhados ao SAAS-2.
- Reuso da sessão do SAAS-2 quando disponível no mesmo domínio.
- Cache versionado para evitar carregar JS antigo.
- Validação automática de JavaScript adicionada no GitHub Actions.
