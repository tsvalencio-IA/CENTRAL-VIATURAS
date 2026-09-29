'use strict';

window.CENTRAL_CONFIG = {
  version: '1.4.3',
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
    nfVinculos: 'nf_itens_vinculos',
    cotacoes: 'cotacoes_pecas'
  },
  activeStatuses: [
    'Triagem','Orcamento','Orcamento_Enviado','Aprovado','Andamento','Pronto',
    'Serviço Aprovado','Em Serviço','Veículo Pronto'
  ],
  managerRoles: [
    'gerente','gestor','admin','administrador','superadmin','dono','proprietario','proprietário','owner','master'
  ],
  rolesPermitidos: [
    'mecanico','mecânico','tecnico','técnico','gerente','gestor','dono',
    'proprietario','proprietário','administrativo','admin','administrador',
    'financeiro','recepcionista','superadmin','master'
  ]
};
