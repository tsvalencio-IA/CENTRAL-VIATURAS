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

## 1.1.0 — 2026-09-29

- Responsividade refeita para celular, tablet e desktop sem rolagem lateral de componentes operacionais.
- Tema claro e escuro com preferência salva no aparelho.
- Botões de voltar no dashboard e na tela da viatura; dock móvel com ações rápidas.
- Gestão (`gestor`, `gerente`, `admin`, `superadmin`, `dono` e equivalentes) pode marcar peças como **trocadas**, serviços como **executados** e peças como **compradas**.
- Equipe/mecânicos pode marcar somente **trocado/executado**; compra é bloqueada tanto na interface quanto na função de gravação.
- Execução usa o campo real `execucaoItens` já adotado pelo SAAS-2, com as chaves `peca-N` e `servico-N`.
- Compra manual é registrada em `centralComprasItens` dentro do próprio documento de `ordens_servico`, sem criar coleção paralela e sem fingir vínculo fiscal.
- Toda ação da Central gera `centralViaturasRelatorio` dentro da mesma O.S. e também acrescenta uma linha de auditoria em `timeline`.
- Recados continuam em `etapasInternas`, agora também refletidos no relatório operacional da própria O.S.
- Nenhum valor financeiro foi adicionado ao painel.

## 1.1.1 — 2026-09-29

- Compartilhamento do WhatsApp agora usa somente a placa no link público, sem expor o ID da O.S.
- Mensagem compartilhada destaca a placa como um pseudo-botão visual: `🟩 *[ PLACA ]*` + `🔧 ABRIR ACOMPANHAMENTO DA VIATURA`.
- Link canônico gerado no formato `viatura.html?placa=PLACA`.


## 1.1.2 — 2026-09-29

- Botão WhatsApp gera somente: `ATUALIZAÇÃO PLACA "PLACA" LINK`.
- Link encurtado para `v.html?PLACA`.
- Removidos emojis, instruções extras e ID da O.S. da mensagem compartilhada.
- O WhatsApp continua exigindo a seleção da conversa/grupo, pois o recurso oficial de link com mensagem pronta não permite pré-selecionar um grupo.


## 1.2.0 — 2026-09-29

- Criado endpoint dinâmico `/p/PLACA` para o WhatsApp ler Open Graph antes de abrir a página.
- Criada imagem PNG dinâmica 1200×630 com a placa da viatura.
- Cartão passa a apresentar título `🚙 PLACA` e descrição `ABRIR VIATURA • Central de Viaturas`.
- Clique no cartão redireciona para a tela real da viatura.
- Projeto preparado para implantação Vercel sem substituir o GitHub Pages atual.
- Compartilhamento usa automaticamente o preview Vercel quando a Central estiver rodando em domínio `.vercel.app`.
