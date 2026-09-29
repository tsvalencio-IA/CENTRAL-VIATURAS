# CENTRAL-VIATURAS

Central operacional para acompanhamento das viaturas da S.O.S. Valêncio, criada para abrir por links enviados no grupo de WhatsApp e reunir informações que já existem nos sistemas da oficina.

## Firebase e fonte de verdade

A Central usa exatamente o projeto Firebase oficial do `SAAS-2`: `hub-thiaguinho`.

Não existe banco paralelo para o acompanhamento. Tudo que o usuário altera na Central é salvo no próprio documento da viatura em `ordens_servico`:

- `etapasInternas`: recados/orientações internas, no mesmo formato já utilizado pelo SaaS;
- `execucaoItens`: peça trocada e serviço executado, compatível com a rotina real da equipe do SAAS-2;
- `centralComprasItens`: marcação operacional manual de peça comprada, separada de vínculo fiscal;
- `centralViaturasRelatorio`: histórico auditável das ações feitas pela Central;
- `timeline`: registro resumido adicional da alteração;
- `updatedAt` / `centralViaturasAtualizadoEm`: atualização em tempo real e indicação de novidade.

A marcação manual de **comprada** não cria NF falsa e não grava `comprada_vinculada_nf`. Vínculo fiscal real continua vindo de `nf_itens_vinculos`/entrada de NF do SAAS-2.

## Permissões

- Gestor, gerente, admin, superadmin, dono/proprietário: podem marcar **trocado**, **executado** e **comprado**.
- Equipe, mecânicos e técnicos: podem marcar **trocado** e **executado**, mas não conseguem marcar compra.
- A restrição de compra é aplicada no JavaScript de gravação, não apenas escondida na tela.

## Integrações

- `tsvalencio-IA/SAAS-2`: O.S., veículos, clientes, aprovação, `execucaoItens`, etapas/recados internos, peças, NF e cotações do Firebase.
- `tsvalencio-IA/CHECKLIS_SOS`: o checklist já anexa `checklistResumo`, `checklistUltimo` e `checklistsTecnicos` diretamente na O.S.; a Central lê esses dados sem duplicá-los.
- `tsvalencio-IA/COTAR`: atualmente mantém o comparador principal em `localStorage`. A Central não inventa sincronização inexistente; a futura integração deverá publicar apenas um resumo operacional compartilhado.

## Regra principal

A Central **não mostra valores**. Preço, custo, margem, lucro, total, pagamento e recebimento ficam fora deste aplicativo.

## Link individual

Exemplo:

`viatura.html?placa=ESF1H43`

Também é aceito `&os=<ID_DA_OS>` para abrir uma O.S. exata.

## Interface V1.1

- responsividade automática para celular, tablet e PC;
- tema claro/escuro;
- botões voltar;
- dock inferior no celular;
- dashboard em tempo real;
- tela individual da placa;
- painel de execução e compras por perfil;
- checklist e pendências;
- recados internos;
- peças da O.S.;
- vínculos de NF sem preço;
- cotações compartilhadas sem preço;
- relatório operacional da própria O.S. por data e usuário;
- compartilhamento para WhatsApp.

## Sistemas preservados

A V1.1 não altera os arquivos do `SAAS-2`, `CHECKLIS_SOS` ou `COTAR`. Ela usa e respeita os dados reais existentes nesses sistemas.



## Compartilhamento no WhatsApp — GitHub Pages

A Central permanece publicada somente no GitHub Pages.

O botão **WHATSAPP** envia:

`ATUALIZAÇÃO PLACA "PLACA" https://tsvalencio-ia.github.io/CENTRAL-VIATURAS/v.html?PLACA`

A página `v.html` possui metadados Open Graph estáticos para o WhatsApp exibir o nome **Central de Viaturas** e a descrição **ABRIR VIATURA • Acompanhamento operacional**.

Limitação técnica do GitHub Pages: como ele entrega arquivos estáticos, o robô do WhatsApp não executa JavaScript e não consegue transformar o parâmetro `?PLACA` em um título/imagem Open Graph diferente para cada placa. Portanto, a placa fica no texto da mensagem e no link; um cartão visual diferente por placa exige uma resposta dinâmica no servidor.
