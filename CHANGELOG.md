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


## 1.2.1 — 2026-09-29

- Projeto mantido exclusivamente no GitHub Pages.
- Removidos `vercel.json`, `package.json` e endpoints `api/share.js` / `api/og.js`.
- Compartilhamento volta a usar somente `v.html?PLACA` no domínio GitHub Pages.
- `v.html` ganhou metadados Open Graph estáticos para uma prévia mais limpa no WhatsApp.
- Documentada a limitação real: GitHub Pages não consegue gerar Open Graph diferente por parâmetro de placa.


## 1.3.0 — 2026-09-29

- Removida a lista de peças orçadas da O.S. do acompanhamento operacional.
- Peças agora vêm exclusivamente dos registros reais da O.S. equivalentes à área interna de peças realmente instaladas.
- Entrada de NF marcada como apenas comprada/vinculada não é tratada como peça trocada.
- Serviços continuam vindo normalmente de `servicos` da O.S.
- Adicionado registro de peça realmente trocada diretamente pelo dashboard, gravando em `pecasReais`.
- Mantida separação de permissões: equipe registra troca/execução; gestão também controla compra operacional.


## 1.4.0 — 2026-09-29

- Integração operacional direta com CHECKLIS_SOS V15.24.
- Separação de Serviços da O.S., Peças a trocar, Serviços do checklist, Atenções e Concluídos.
- Blocos minimizáveis.
- Itens concluídos migram visualmente para a seção de concluídos.
- Compra de peça do checklist disponível somente para gestão.
- Troca de peça do checklist alimenta `pecasReais`.
- Auditoria global e timeline para execução/compra do checklist.
- Impressão A4 do relatório operacional.


## 1.4.1 — 2026-09-29

- O botão WHATSAPP passa a compartilhar a rota dinâmica da Vercel: `https://viaturas.vercel.app/p/PLACA`.
- A mensagem continua mínima: `ATUALIZAÇÃO PLACA "PLACA" LINK`.
- A rota dinâmica entrega Open Graph com título da placa e PNG 1200×630 gerado para cada viatura.
- Ao tocar no cartão, o usuário é redirecionado para a viatura real no GitHub Pages.


## 1.4.2 — 2026-09-29

- Redesenhada a imagem dinâmica da placa para leitura boa tanto no WhatsApp Desktop quanto no WhatsApp mobile/web.
- Todo o conteúdo essencial passou para uma área segura central compatível com recorte quadrado.
- Placa ampliada, contraste aumentado e botão visual simplificado.
- Link compartilhado recebeu versão de cache para forçar o WhatsApp a buscar a nova prévia.
- `og:image:alt` adicionado e cache da imagem reduzido para facilitar atualizações.


## 1.4.3 — 2026-09-29

- Corrigido o PNG da prévia que aparecia sem os textos dentro da imagem em alguns ambientes.
- Removido o gerador SVG/Sharp que dependia das fontes instaladas na Function.
- Novo PNG gerado por `@vercel/og`, com renderização de texto própria para Open Graph.
- Mantida área segura central para WhatsApp Desktop/Web e WhatsApp mobile.
- Cache do compartilhamento alterado para `?v=143`.


## 1.4.4 — 2026-09-29

- PWA concluída para instalação no PC e celular.
- Botão INSTALAR APP aparece automaticamente quando o navegador permite instalação.
- No Android/Chrome/Edge, o botão abre o prompt nativo de instalação.
- No iPhone/iPad, o botão orienta o fluxo Compartilhar → Adicionar à Tela de Início.
- Criado ícone profissional dinâmico da Central de Viaturas em 64, 180, 192 e 512 px.
- Manifesto ganhou ícones normal e maskable, categorias, ID, orientação e atalhos.
- Adicionado favicon e Apple Touch Icon.
- Service worker deixou de tentar armazenar Firebase/CDNs/serviços externos no cache.


## 1.4.5 — 2026-09-29

- Checklist passa a usar `checklistResumo.itens[].acao` como fonte de verdade antes de qualquer resumo derivado.
- Corrigido cenário em que um item com ação real `revisar` podia herdar label antigo `Trocar`.
- Classificação passa a ser sempre: `trocar` → peça; retificar/regular/ajustar/lubrificar/limpar → serviço; atenção/revisar → atenção.
- `checklistOperacional` e `checklistUltimo` ficam apenas como fallback quando o payload completo não existe.


## 1.4.6 — 2026-09-30

- Controle de peças reais passa a ser área confidencial de gestão.
- Equipe/mecânicos não visualizam a seção, lista ou formulário gerencial de peças.
- Impressão da equipe não inclui o controle gerencial de peças.
- Eventos explícitos de peça real são filtrados do relatório visual da equipe.
- Registro manual no controle gerencial passa a exigir perfil de gestão.
- Atualizações confidenciais de peça deixam de entrar na timeline comum da O.S.; ficam registradas na auditoria gerencial.
- Mecânicos continuam podendo concluir itens de peça do CHECKLIS_SOS, sem acesso ao relatório gerencial consolidado.


## 1.4.7 — 2026-09-30

- Perfil de equipe/mecânico passa a ver somente o necessário para execução: peças a trocar e serviços a fazer.
- Equipe não consulta nem visualiza fornecedor, NF, origem de compra ou cotações.
- Status de compra e responsável pela compra deixam de aparecer para equipe.
- Visão completa do checklist, atenções, NF, cotações e controle gerencial ficam restritos à gestão.
- Linguagem da equipe deixa de exibir “peça realmente trocada”; usa “concluída”.
- Gestão recebe quadro “O QUE AINDA FALTA FAZER” com contadores de serviços, peças, atenções e compras pendentes.
- Impressão da equipe não inclui controle gerencial, compras ou atenções da gestão.


## 1.4.8 — 2026-10-01

- Identidade PWA da Central de Viaturas tornou-se explícita e exclusiva.
- `id`: `/CENTRAL-VIATURAS/`.
- `start_url`: `/CENTRAL-VIATURAS/index.html`.
- `scope`: `/CENTRAL-VIATURAS/`.
- Nome curto: `VIATURAS`.
- Evita qualquer ambiguidade com o PWA COTARP/COTAR, que permanece no caminho `/COTAR/`.


## 1.4.9 — 2026-10-01

- Criado manifesto novo e exclusivo `manifest-viaturas-v2.webmanifest`.
- Novo ID PWA: `/CENTRAL-VIATURAS/viaturas-app-v2`.
- Start URL exclusivo: `/CENTRAL-VIATURAS/index.html?app=viaturas-v2`.
- Scope exclusivo: `/CENTRAL-VIATURAS/`.
- Evita reutilização da identidade instalada do COTARP no Chrome/Windows.
