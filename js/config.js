'use strict';

window.CENTRAL_CONFIG = {
  version: '1.0.0',
  appName: 'Central de Viaturas',
  footer: 'Powered by thIAguinho Soluções Digitais',
  firebaseConfig: {
    apiKey: 'AIzaSyBqIuCsHHuy_f-mBWV4JBkbyOorXpqQvqg',
    authDomain: 'hub-thiaguinho.firebaseapp.com',
    projectId: 'hub-thiaguinho',
    storageBucket: 'hub-thiaguinho.firebasestorage.app',
    messagingSenderId: '453508098543',
    appId: '1:453508098543:web:305f4d48edd9be40bd6e1a'
  },
  collections: {
    oficinas: 'oficinas',
    funcionarios: 'funcionarios',
    os: 'ordens_servico',
    veiculos: 'veiculos',
    clientes: 'clientes',
    checklists: 'checklists',
    nfVinculos: 'nf_itens_vinculos',
    cotacoes: 'cotacoes_pecas',
    notificacoes: 'notificacoes_live'
  },
  activeStatuses: ['Triagem','Orcamento','Orcamento_Enviado','Aprovado','Andamento','Pronto','Em Serviço','Serviço Aprovado','Veículo Pronto'],
  hiddenValueKeys: ['valor','preco','preço','custo','total','margem','lucro','desconto','descontoPercentual','venda','valorUnitario','valorTotal','financeiro','pagamento','recebimento'],
  rolesPermitidos: [
    'mecanico','mecânico','tecnico','técnico','gerente','gestor','dono','proprietario','proprietário',
    'administrativo','admin','admin master','adminmaster','admin_master','admin-oficina','admin oficina',
    'financeiro','recepcionista','superadmin','master'
  ]
};
