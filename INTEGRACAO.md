# Mapeamento de integração — fonte de verdade

## SAAS-2

Firebase oficial confirmado no código: `hub-thiaguinho`.

Coleções/dados utilizados pela Central:

- `ordens_servico`: fonte principal da Central.
- `veiculos`: resolução de placa/modelo quando a O.S. guarda apenas `veiculoId`.
- `clientes`: resolução de nome quando necessário.
- `nf_itens_vinculos`: rastreabilidade de peça comprada/vinculada, sem exibir campos financeiros.
- `cotacoes_pecas`: leitura operacional das cotações que já estiverem no Firebase.
- `notificacoes_live`: tentativa de aviso complementar somente quando a sessão Firebase Auth permite.

### Recados

A Central usa o mesmo `ordens_servico.etapasInternas` do SaaS. Formato preservado:

- `id`
- `texto`
- `realizado`
- `criadoEm`
- `criadoPor`
- `realizadoEm`
- `realizadoPor`
- `interno: true`
- `visivelCliente: false`

## CHECKLIS_SOS

O Checklist já escreve de volta na O.S.:

- `checklistId`
- `checklistResumo`
- `checklistUltimo`
- `checklistAtualizadoEm`
- `checklistsTecnicos`

Logo a Central lê a própria O.S.; não é necessário duplicar o checklist.

## COTAR

O comparador/pedidos atuais estão persistidos principalmente em `localStorage`. Isso funciona no aparelho em que a cotação foi feita, mas não é uma fonte compartilhada para o grupo.

Próxima fase correta: acrescentar ao COTAR uma gravação de **resumo operacional** no Firebase por placa/O.S., mantendo toda a lógica local existente. O resumo da Central deverá conter apenas descrição, código, quantidade, fornecedor/status e datas; nunca preço no painel operacional.
