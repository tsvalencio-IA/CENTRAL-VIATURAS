'use strict';

(function(){
  const D=window.CentralData;
  const CFG=window.CENTRAL_CONFIG;
  if(!D||!CFG) return;

  const norm=D.norm||function(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();};
  const nowIso=()=>new Date().toISOString();
  const clean=v=>String(v==null?'':v).trim();

  function officialText(os,client){
    return [
      client?.nome,client?.razaoSocial,client?.fantasia,client?.tipoCliente,
      client?.clienteOficial===true?'OFICIAL':'',client?.orgaoPublico===true?'ORGAO PUBLICO':'',client?.publico===true?'PUBLICO':'',client?.gov===true?'GOVERNO':'',client?.govUnidade,
      os?.clienteNome,os?.cliente,os?.tipoCliente,os?.clienteTipo,
      os?.clienteOficial===true?'OFICIAL':'',os?.orgaoPublico===true?'ORGAO PUBLICO':'',os?.gov===true?'GOVERNO':'',
      os?.fiscalContrato,os?.contrato,os?.orgao,os?.unidade
    ].filter(Boolean).join('|');
  }

  function isOfficialClient(os,client){
    const tipo=norm(client?.tipoCliente||os?.tipoCliente||os?.clienteTipo||'');
    if(tipo==='governo'||tipo==='oficial') return true;
    if(client?.clienteOficial===true||client?.orgaoPublico===true||client?.gov===true||os?.clienteOficial===true||os?.orgaoPublico==true||os?.gov===true) return true;
    return /oficial|governo|pmsp|policia|militar|bpm|prefeitura|estado|municip|secretaria|orgao publico/.test(norm(officialText(os,client)));
  }

  function isNFPurchaseOnlyPiece(p){
    const origem=norm(p?.origem||'').replace(/\s+/g,'_');
    const status=norm(p?.statusAplicacao||p?.status||p?.situacao||'').replace(/\s+/g,'_');
    return p?.origemNFVinculada===true || origem==='nf_entrada_os' || origem==='nf_entrada' || status==='comprada_vinculada_nf';
  }

  function isCiliaPiece(p) {
    const idx=clean(p?.ciliaPieceIndex);
    if(!idx) return false;
    if(norm(p?.ciliaAgrupador||'')==='manual'||p?.ciliaManual===true) return false;
    return true;
  }

  function isCiliaService(s){
    const origem=norm(s?.origemServico||'');
    return s?.relacionadoCilia===true || origem.startsWith('cilia_') || clean(s?.ciliaPieceIndex)!=='';
  }

  function workState(os,key){
    return (os?.execucaoItens||{})[String(key)]||{};
  }
  function workStatus(os,key){ return clean(workState(os,key)?.status||'pendente').toLowerCase(); }
  function doneStatus(status){ return /^(executado|executado_obs|executado_com_observacao|concluido|finalizado|feito|realizado|trocada|resolvido)$/i.test(clean(status)); }
  function blockedStatus(status){ return /^(impedido|nao_resolveu|não_resolveu|bloqueado)$/i.test(clean(status)); }
  function inProgressStatus(status){ return /^(em_execucao|em execução|em_execução|iniciado)$/i.test(clean(status)); }
  function statusLabel(status,tipo){
    if(doneStatus(status)) return tipo==='peca'?'TROCADA':'EXECUTADO';
    if(blockedStatus(status)) return 'IMPEDIDO / NÃO RESOLVEU';
    if(inProgressStatus(status)) return 'EM EXECUÇÃO';
    return 'PENDENTE';
  }

  function approvedSet(os){ return D.approvedKeys?D.approvedKeys(os):new Set(); }
  function hasApproval(os){ return D.hasApproval?D.hasApproval(os):false; }
  function isApproved(os,key){ return !hasApproval(os)||approvedSet(os).has(String(key)); }

  function pieceDescription(p){ return clean(p?.desc||p?.descricao||p?.descricaoExibicao||p?.nomePeca||p?.nome||p?.item||'Peça'); }
  function pieceCode(p){ return clean(p?.codigo||p?.codigoExibicao||p?.codigoComercial||p?.codigoFornecedor||p?.oem||''); }
  function serviceDescription(s){ return clean(s?.desc||s?.descricao||s?.servico||s?.nome||'Serviço'); }
  function serviceCode(s){ return clean(s?.codigoInterno||s?.codInterno||s?.codigoServicoInterno||s?.codigoTabela||s?.codigo||''); }

  function buildWorkPlan(os,client,session){
    const official=isOfficialClient(os,client);
    const manager=D.isManager(session);
    const pieces=(Array.isArray(os?.pecas)?os.pecas:[]).map((p,index)=>({
      key:`peca-${index}`,index,tipo:'peca',descricao:pieceDescription(p),codigo:pieceCode(p),marca:clean(p?.marca||p?.fabricante||''),qtd:p?.qtd??p?.q??p?.quantidade??1,
      source:isCiliaPiece(p)?'CILIA':'O.S.',cilia:isCiliaPiece(p),raw:p,state:workState(os,`peca-${index}`)
    })).filter(x=>x.descricao||x.codigo).filter(x=>!isNFPurchaseOnlyPiece(x.raw)).filter(x=>isApproved(os,x.key));

    const services=(Array.isArray(os?.servicos)?os.servicos:[]).map((s,index)=>({
      key:`servico-${index}`,index,tipo:'servico',descricao:serviceDescription(s),codigo:serviceCode(s),qtd:1,
      source:isCiliaService(s)?'CILIA':'O.S.',cilia:isCiliaService(s),raw:s,state:workState(os,`servico-${index}`)
    })).filter(x=>x.descricao||x.codigo).filter(x=>isApproved(os,x.key));

    let visiblePieces=official?pieces.filter(x=>x.cilia):pieces;
    let visibleServices=official?services.filter(x=>x.cilia):services;
    if(official&&!manager) visibleServices=[]; // regra da oficina: equipe oficial recebe somente peças Cilia.

    const all=[...visiblePieces,...visibleServices];
    const pending=[],progress=[],blocked=[],done=[];
    all.forEach(item=>{
      const status=workStatus(os,item.key);
      item.state=workState(os,item.key);
      item.status=status;
      if(doneStatus(status)) done.push(item);
      else if(blockedStatus(status)) blocked.push(item);
      else if(inProgressStatus(status)) progress.push(item);
      else pending.push(item);
    });
    return {official,manager,pieces:visiblePieces,services:visibleServices,all,pending,progress,blocked,done};
  }

  function reportEvent(session,acao,item,status,obs,extra={}){
    return {
      id:`cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
      tipo:'trabalho',acao,data:nowIso(),
      usuario:session?.name||'Equipe',usuarioId:session?.funcionarioId||session?.email||'',perfil:session?.role||session?.cargo||'equipe',origem:'CENTRAL-VIATURAS',
      itemKey:item?.key||'',itemTipo:item?.tipo||'',descricao:item?.descricao||'',codigo:item?.codigo||'',status,obs:clean(obs),...extra
    };
  }

  async function setWorkState(db,session,osId,item,status,obs=''){
    if(!D.canExecute(session)) throw new Error('Seu perfil não pode alterar a execução.');
    const allowed=new Set(['pendente','em_execucao','executado','trocada','impedido']);
    let next=clean(status).toLowerCase();
    if(item?.tipo==='peca'&&next==='executado') next='trocada';
    if(item?.tipo==='servico'&&next==='trocada') next='executado';
    if(!allowed.has(next)) throw new Error('Status inválido.');
    const note=clean(obs);
    if(next==='impedido'&&!note) throw new Error('Informe o que aconteceu antes de marcar como impedido.');
    const key=clean(item?.key);
    if(!key||key.includes('.')) throw new Error('Item inválido.');
    const current=item?.state||{};
    if(clean(current.status).toLowerCase()===next && clean(current.obs)===note) return {item,status:next,unchanged:true};

    const agora=nowIso();
    const state={
      ...current,key,tipo:item.tipo,status:next,obs:note||current.obs||'',
      mecId:session.funcionarioId||current.mecId||'',mecNome:session.name||current.mecNome||'',
      responsavelId:session.funcionarioId||current.responsavelId||'',responsavelNome:session.name||current.responsavelNome||'',
      atualizadoEm:agora,atualizadoPorId:session.funcionarioId||session.email||'',atualizadoPor:session.name||'Equipe',
      atualizadoPorTipo:session.role||session.cargo||'equipe',origemAtualizacao:'CENTRAL-VIATURAS'
    };
    const acao=next==='pendente'?'reabriu_execucao':next==='em_execucao'?'iniciou_execucao':next==='impedido'?'marcou_impedimento':item.tipo==='peca'?'marcou_peca_trocada':'marcou_servico_executado';
    const ev=reportEvent(session,acao,item,next,note);
    const FV=window.firebase?.firestore?.FieldValue;
    if(!FV) throw new Error('Firebase indisponível.');
    const ref=db.collection(CFG.collections.os).doc(osId);
    await ref.update({
      [`execucaoItens.${key}`]:state,
      centralViaturasRelatorio:FV.arrayUnion(ev),
      centralViaturasAtualizadoEm:agora,centralViaturasAtualizadoPor:session.name||'Usuário',updatedAt:agora
    });
    return {item,status:next,state};
  }

  function hashKey(v){
    let h=2166136261; const s=String(v||'');
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
    return 'nf_'+(h>>>0).toString(36);
  }
  function purchaseLinks(os){ return os?.centralCompraVinculos||{}; }
  function purchaseLinkForNF(os,nfId){
    return Object.values(purchaseLinks(os)).find(x=>String(x?.nfItemId||'')===String(nfId||''))||null;
  }
  function purchaseLinkForWork(os,workKey){
    return Object.values(purchaseLinks(os)).find(x=>String(x?.workKey||'')===String(workKey||'')&&x?.ativo!==false)||null;
  }

  async function setPurchaseLink(db,session,osId,purchase,item,linked=true){
    if(!D.canPurchase(session)) throw new Error('Somente gestão pode vincular compras.');
    const nfItemId=clean(purchase?.id);
    if(!nfItemId) throw new Error('Item de compra inválido.');
    const mapKey=hashKey(nfItemId);
    const agora=nowIso();
    const FV=window.firebase?.firestore?.FieldValue;
    if(!FV) throw new Error('Firebase indisponível.');
    const ref=db.collection(CFG.collections.os).doc(osId);
    const ev={
      id:`cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,tipo:'compra_vinculo',
      acao:linked?'vinculou_compra_item':'desvinculou_compra_item',data:agora,usuario:session.name||'Gestão',
      usuarioId:session.funcionarioId||session.email||'',perfil:session.role||session.cargo||'gestao',origem:'CENTRAL-VIATURAS',
      nfItemId,nfNumero:clean(purchase?.nfNumero),descricao:clean(purchase?.descricao||purchase?.desc),codigo:clean(purchase?.codigo),workKey:linked?clean(item?.key):'',workDescricao:linked?clean(item?.descricao):''
    };
    const value=linked?{
      id:mapKey,ativo:true,nfItemId,nfNumero:clean(purchase?.nfNumero),fornecedor:clean(purchase?.fornecedor),
      descricaoCompra:clean(purchase?.descricao||purchase?.desc),codigoCompra:clean(purchase?.codigo),qtd:purchase?.qtd??'',
      workKey:clean(item?.key),workTipo:clean(item?.tipo),workDescricao:clean(item?.descricao),
      vinculadoEm:agora,vinculadoPor:session.name||'Gestão',vinculadoPorId:session.funcionarioId||session.email||''
    }:FV.delete();
    await ref.update({
      [`centralCompraVinculos.${mapKey}`]:value,
      centralViaturasRelatorio:FV.arrayUnion(ev),
      centralViaturasAtualizadoEm:agora,centralViaturasAtualizadoPor:session.name||'Gestão',updatedAt:agora
    });
    return {linked,mapKey};
  }

  function canonical(v){
    return norm(v)
      .replace(/\bdiant(?:eiro|eira)?\b/g,' dianteiro ')
      .replace(/\btras(?:eiro|eira)?\b/g,' traseiro ')
      .replace(/\bdir(?:eito|eita)?\b/g,' direito ')
      .replace(/\besq(?:uerdo|uerda)?\b/g,' esquerdo ')
      .replace(/\bpivos\b/g,'pivo')
      .replace(/\bbieletas\b/g,'bieleta')
      .replace(/\bamortecedores\b/g,'amortecedor')
      .replace(/\bbuchas\b/g,'bucha')
      .replace(/\bbandejas\b/g,'bandeja')
      .replace(/\bcoifas\b/g,'coifa')
      .replace(/\bvelas\b/g,'vela')
      .replace(/\bcorreias\b/g,'correia')
      .replace(/\bpalhetas\b/g,'palheta')
      .replace(/\bpneus\b/g,'pneu')
      .replace(/\bcoxins\b/g,'coxim')
      .replace(/\brolamentos\b/g,'rolamento')
      .replace(/\bfiltros\b/g,'filtro')
      .replace(/\bbobinas\b/g,'bobina')
      .replace(/\bcabos\b/g,'cabo')
      .replace(/\btensores\b/g,'tensor')
      .replace(/\baneis\b/g,'anel')
      .replace(/\bvedacoes\b/g,'vedacao')
      .replace(/\bbicos\b/g,'bico')
      .replace(/\breservatorios\b/g,'reservatorio')
      .replace(/\bsemi[\s-]*eixos\b/g,'semi eixo')
      .replace(/\s+/g,' ')
      .trim();
  }

  function axleOf(v){
    const p=canonical(v);
    if(/\btraseir/.test(p)) return 'R';
    if(/\bdianteir|\bparabrisa\b/.test(p)) return 'F';
    return '';
  }

  function sideOf(v){
    const p=canonical(v);
    if(/\besquerd/.test(p)) return 'L';
    if(/\bdireit/.test(p)) return 'R';
    return '';
  }

  function concepts(v){
    const p=canonical(v), out=new Set();
    const add=x=>out.add(x);

    if(/\bpivo\b/.test(p)) add('pivo');
    if(/\bbieleta\b|haste.*barra.*estabiliz/.test(p)) add('bieleta');
    if(/\bbraco oscilante\b|\bbandeja\b/.test(p)) add('bandeja');
    if(/\bbucha\b.*\bbandeja\b|\bbandeja\b.*\bbucha\b/.test(p)) add('bucha_bandeja');

    if(/\bcoifa\b.*\bamortecedor\b/.test(p)) add('coifa_amortecedor');
    if(/\bbatente\b.*\bamortecedor\b/.test(p)) add('batente_amortecedor');
    if(/\bcoxim\b.*\bamortecedor\b/.test(p)) add('coxim_amortecedor');
    if(/\bamortecedor\b/.test(p) && !/\bcoifa\b|\bbatente\b|\bcoxim\b/.test(p)) add('amortecedor');

    if(/\brolamento\b.*\broda\b/.test(p)) add('rolamento_roda');
    if(/\bcubo\b.*(?:\brolamento\b|\broda\b)|\bcubo da roda\b/.test(p)) add('cubo_roda');

    if(/\bvela\b.*(?:ignicao|aquecimento)|(?:ignicao|aquecimento).*\bvela\b/.test(p)) add('vela');
    if(/\bcorreia\b.*(?:dentad|comando)|\bcorrente\b.*\bcomando\b/.test(p)) add('correia_dentada');
    if(/\bcorreia\b.*(?:acessor|auxiliar|alternador)|\bpoli v\b/.test(p)) add('correia_acessorios');
    if(/\bpolia\b.*\balternador\b|\brolamento\b.*\balternador\b/.test(p)) add('polia_alternador');
    if(/\btensor\b|\btensionador\b|\bpolia tensora\b/.test(p)) add('tensor_correia');

    if(/\bbomba\b.*\bagua\b/.test(p)) add('bomba_agua');
    if(/\bbomba\b.*\bcombustivel\b/.test(p)) add('bomba_combustivel');

    if(/\bcoxim\b.*\bcambio\b|\bsuporte\b.*\bcambio\b/.test(p)) add('coxim_cambio');
    if(/\bcoxim\b.*\bmotor\b/.test(p)) add('coxim_motor');
    if(/\bcoxim\b.*(?:motor|cambio)|\bsuporte\b.*\bcambio\b/.test(p)) add('coxim_motor_cambio');

    if(/(?:\bmaquina\b|\bmotor\b).*\bvidro\b|\bvidro\b.*(?:\bmaquina\b|\bmotor\b)/.test(p)) add('maquina_motor_vidro');
    if(/\bbotao\b.*\bvidro\b/.test(p)) add('botao_vidro');

    if(/\bpalheta\b/.test(p)) add('palheta');
    if(/\bradiador\b/.test(p)) add('radiador');
    if(/\bhigieniz.*ar condicionado\b/.test(p)) add('higienizacao_ar');
    if(/\bcarpete\b|\bassoalho\b/.test(p)) add('carpete_assoalho');
    if(/\bbateria\b/.test(p)) add('bateria');
    if(/(?:\bguarnicao\b|\bborracha\b|\bvedacao\b).*\bporta\b/.test(p)) add('vedacao_porta');

    if(/\bpastilha\b.*\bfreio\b/.test(p)) add('pastilha_freio');
    if(/\bdisco\b.*\bfreio\b/.test(p)) add('disco_freio');
    if(/\bfluido\b.*\bfreio\b/.test(p)) add('fluido_freio');
    if(/\bpneu\b/.test(p)) add('pneu');
    if(/\bfiltro\b.*\bar\b/.test(p) && !/ar condicionado|cabine/.test(p)) add('filtro_ar');
    if(/\bbobina\b/.test(p)) add('bobina');
    if(/\bcabo\b.*\bvela\b/.test(p)) add('cabo_vela');
    if(/\bbobina\b|\bcabo\b.*\bvela\b/.test(p)) add('ignicao_bobina_cabo');
    if(/\banel\b.*\bvedacao\b.*\bbico\b|\bvedacao\b.*\bbico\b.*\binjetor\b/.test(p)) add('anel_bico_injetor');
    if(/\banti chama\b|\bpcv\b|\brespiro\b/.test(p)) add('pcv_respiro');
    if(/\bliquido\b.*\barrefecimento\b/.test(p)) add('liquido_arrefecimento');
    if(/\bvalvula\b.*\btermostat/.test(p)) add('valvula_termostatica');
    if(/\breservatorio\b.*(?:arrefecimento|agua)|\btampa\b.*\breservatorio\b/.test(p)) add('reservatorio_arrefecimento');
    if(/\bfluido\b.*\bdirecao\b/.test(p)) add('fluido_direcao');
    if(/\bsemi eixo\b|\bhomocinetica\b/.test(p)) add('homocinetica');
    if(/\bcoifa\b.*\bhomocinetica\b/.test(p)) add('coifa_homocinetica');

    if(/\bfechadura\b.*\bcapo\b/.test(p)) add('fechadura_capo');
    if(/\bretrovisor\b|\bespelho\b.*\bretrovisor\b/.test(p)) add('retrovisor');
    if(/\bparabrisa\b/.test(p) && !/\bpalheta\b/.test(p)) add('parabrisa');
    if(/\bmodulo\b.*\bconforto\b|\bcentral\b.*\bmultimidia\b/.test(p)) add('eletronica_conforto');

    return out;
  }

  function tokens(v){
    return new Set(canonical(v).replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2&&!['para','com','sem','lado','peca','servico','troca','trocar','revisar','atencao','observar'].includes(x)));
  }

  function semanticSimilarity(a,b){
    const pa=canonical(a),pb=canonical(b);
    if(!pa||!pb) return 0;

    const axA=axleOf(pa),axB=axleOf(pb),sideA=sideOf(pa),sideB=sideOf(pb);
    if(axA&&axB&&axA!==axB) return 0;
    if(sideA&&sideB&&sideA!==sideB) return 0;

    const ca=concepts(pa),cb=concepts(pb);
    let conceptHit=false;
    ca.forEach(x=>{if(cb.has(x)) conceptHit=true;});

    const A=tokens(pa),B=tokens(pb);
    let inter=0; A.forEach(x=>{if(B.has(x)) inter++;});
    const lexical=A.size&&B.size?inter/Math.max(A.size,B.size):0;

    let score=lexical;
    if(conceptHit) score=Math.max(score,.82);
    if(pa===pb) score=1;
    else if(pa.includes(pb)||pb.includes(pa)) score=Math.max(score,.9);
    if(axA&&axB&&axA===axB) score=Math.min(1,score+.06);
    if(sideA&&sideB&&sideA===sideB) score=Math.min(1,score+.06);
    return score;
  }

  function similarity(a,b){ return semanticSimilarity(a,b); }

  function bestWorkMatch(purchase,items){
    const pdesc=clean(purchase?.descricao||purchase?.desc),pcode=norm(purchase?.codigo||'');
    let best=null,score=0;
    (items||[]).filter(x=>x.tipo==='peca').forEach(item=>{
      let s=semanticSimilarity(pdesc,item.descricao);
      const icode=norm(item.codigo||'');
      if(pcode&&icode&&pcode===icode) s=Math.max(s,1);
      else if(pcode&&icode&&(pcode.includes(icode)||icode.includes(pcode))) s=Math.max(s,.88);
      if(s>score){score=s;best=item;}
    });
    return {item:score>=.58?best:null,score};
  }

  function matchChecklistItems(checkItems,workItems){
    const relations={},matched=[],actionMismatch=[],checklistOnly=[];
    const matchedWork=new Set();

    (checkItems||[]).forEach(ci=>{
      const candidates=(workItems||[]).map(w=>({work:w,score:semanticSimilarity(ci.item,w.descricao)}))
        .filter(x=>x.score>=.58)
        .sort((a,b)=>b.score-a.score);
      if(!candidates.length){
        checklistOnly.push(ci);
        return;
      }

      const best=candidates[0].score;
      const chosen=candidates.filter(x=>x.score>=Math.max(.58,best-.10));
      chosen.forEach(x=>{
        matchedWork.add(x.work.key);
        if(!relations[x.work.key]) relations[x.work.key]=[];
        relations[x.work.key].push({check:ci,score:x.score});
      });

      const entry={check:ci,workMatches:chosen.map(x=>x.work),score:best};
      if(ci.group==='atencao') actionMismatch.push(entry);
      else matched.push(entry);
    });

    const workOnly=(workItems||[]).filter(w=>!matchedWork.has(w.key));
    return {matched,actionMismatch,checklistOnly,workOnly,relations};
  }

  function checklistComparison(os,plan){
    const cp=D.checklistPlan(os);
    const partChecks=[...(cp.pecasTrocar||[]),...(cp.atencoes||[])];
    const serviceChecks=[...(cp.servicosExecutar||[])];

    const parts=matchChecklistItems(partChecks,plan?.pieces||[]);
    const services=matchChecklistItems(serviceChecks,plan?.services||[]);

    return {
      matched:parts.matched,
      actionMismatch:parts.actionMismatch,
      checklistOnly:parts.checklistOnly,
      workOnly:parts.workOnly,
      workRelations:parts.relations,
      serviceMatched:services.matched,
      serviceChecklistOnly:services.checklistOnly,
      serviceWorkOnly:services.workOnly,
      serviceRelations:services.relations,
      check:[...partChecks,...serviceChecks]
    };
  }


  async function loadReferencesForOS(db,session,os){
    const refs={vehicles:[],clients:[]};
    const vid=clean(os?.veiculoId); const cid=clean(os?.clienteId);
    const vs=os?.veiculoSnapshot&&typeof os.veiculoSnapshot==='object'?{id:vid||os.veiculoSnapshot.id||'',...os.veiculoSnapshot}:null;
    if(vs&&(vs.placa||vs.modelo||vs.descricao)) refs.vehicles.push(vs);
    if(cid){
      try{const snap=await db.collection(CFG.collections.clientes).doc(cid).get(); if(snap.exists){const d={id:snap.id,...snap.data()}; if(!session?.tenantId||!d.tenantId||d.tenantId===session.tenantId) refs.clients.push(d);}}catch(e){console.warn('[Central cliente]',e.message);}
    }else if(os?.clienteSnapshot&&typeof os.clienteSnapshot==='object') refs.clients.push({id:'snapshot',...os.clienteSnapshot});
    if(vid&&!refs.vehicles.length){
      try{const snap=await db.collection(CFG.collections.veiculos).doc(vid).get(); if(snap.exists){const d={id:snap.id,...snap.data()}; if(!session?.tenantId||!d.tenantId||d.tenantId===session.tenantId) refs.vehicles.push(d);}}catch(e){console.warn('[Central veículo]',e.message);}
    }
    return refs;
  }

  async function loadOperationalExtrasEfficient(db,session,os,plateValue){
    if(!D.isManager(session)) return {nf:[],cotacoes:[]};
    const nf=[],cotacoes=[]; const osId=clean(os?.id),p=D.plate(plateValue||'');
    const queryOne=async(col,field,value,limit,mapper)=>{
      if(!value) return [];
      try{const snap=await db.collection(col).where('tenantId','==',session.tenantId).where(field,'==',value).limit(limit).get();return snap.docs.map(d=>mapper({id:d.id,...d.data()})).filter(Boolean);}catch(e){console.warn('[Central extras]',col,e.message);return[];}
    };
    const nfMapper=x=>D.safeNF(x),cotMapper=x=>D.safeCotacao(x);
    nf.push(...await queryOne(CFG.collections.nfVinculos,'osId',osId,120,nfMapper));
    if(!nf.length&&p) nf.push(...await queryOne(CFG.collections.nfVinculos,'placa',p,120,nfMapper));
    cotacoes.push(...await queryOne(CFG.collections.cotacoes,'osId',osId,80,cotMapper));
    if(!cotacoes.length&&p) cotacoes.push(...await queryOne(CFG.collections.cotacoes,'placa',p,80,cotMapper));
    return {nf,cotacoes};
  }

  Object.assign(D,{
    isOfficialClient,isCiliaPiece,isCiliaService,isNFPurchaseOnlyPiece,
    workState,workStatus,doneStatus,blockedStatus,inProgressStatus,statusLabel,buildWorkPlan,setWorkState,
    purchaseLinks,purchaseLinkForNF,purchaseLinkForWork,setPurchaseLink,bestWorkMatch,similarity,semanticSimilarity,concepts,checklistComparison,
    loadReferencesForOS,loadOperationalExtrasEfficient
  });
})();
