# CENTRAL-VIATURAS

Central operacional para acompanhamento das viaturas da S.O.S. Valêncio, criada para abrir por links enviados no grupo de WhatsApp e reunir informações que já existem nos sistemas da oficina.

## Fontes integradas

- `tsvalencio-IA/SAAS-2`: O.S., veículos, clientes, etapas/recados internos, peças da O.S., vínculos de NF e cotações do Firebase.
- `tsvalencio-IA/CHECKLIS_SOS`: o checklist já anexa `checklistResumo`, `checklistUltimo` e `checklistsTecnicos` diretamente na O.S.; a Central lê esses dados sem duplicá-los.
- `tsvalencio-IA/COTAR`: atualmente mantém o comparador principal em `localStorage`. A Central identifica esta limitação e não inventa sincronização entre aparelhos. A próxima integração será publicar um resumo operacional no Firebase, sem remover o funcionamento local atual.

## Regra principal

A Central **não mostra valores**. Campos de preço, custo, margem, lucro, total, pagamento e recebimento não são exibidos neste aplicativo.

## Link individual

Exemplo:

`viatura.html?placa=ESF1H43`

Também é aceito `&os=<ID_DA_OS>` para abrir uma O.S. exata.

## O que já funciona na V1

- login com a mesma lógica operacional usada pelo Checklist/SaaS;
- tenant/oficina preservado;
- dashboard responsivo com viaturas ativas, novidades e recados pendentes;
- busca por placa, veículo, O.S. ou cliente;
- atualização em tempo real das O.S.;
- tela individual por placa;
- checklist e pendências da O.S.;
- recados internos gravados no mesmo campo `etapasInternas` já usado pelo SaaS;
- marcar/reabrir recado sem criar uma segunda fonte de verdade;
- peças da O.S. sem valores;
- tentativa controlada de leitura de `nf_itens_vinculos` e `cotacoes_pecas` quando o perfil/regras permitem;
- compartilhamento do link e atalho para WhatsApp;
- PWA básica;
- indicador de novidade por usuário/aparelho, usando o horário de atividade da O.S.

## Não alterado

Esta primeira implantação não altera nenhum arquivo de `SAAS-2`, `CHECKLIS_SOS` ou `COTAR`.
