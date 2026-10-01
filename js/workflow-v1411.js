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

  function tokens(v){
    return new Set(norm(v).replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2&&!['para','com','sem','lado','peca','servico','troca'].includes(x)));
  }
  function similarity(a,b){
    const A=tokens(a),B=tokens(b); if(!A.size||!B.size) return 0;
    let inter=0; A.forEach(x=>{if(B.has(x)) inter++;});
    return inter/Math.max(A.size,B.size);
  }
  function bestWorkMatch(purchase,items){
    const pdesc=clean(purchase?.descricao||purchase?.desc),pcode=norm(purchase?.codigo||'');
    let best=null,score=0;
    (items||[]).filter(x=>x.tipo==='peca').forEach(item=>{
      let s=similarity(pdesc,item.descricao);
      const icode=norm(item.codigo||'');
      if(pcode&&icode&&pcode===icode) s=Math.max(s,1);
      else if(pcode&&icode&&(pcode.includes(icode)||icode.includes(pcode))) s=Math.max(s,.88);
      if(s>score){score=s;best=item;}
    });
    return {item:score>=.5?best:null,score};
  }

  function checklistComparison(os,plan){
    const cp=D.checklistPlan(os);
    const check=[...cp.pecasTrocar,...cp.servicosExecutar,...cp.atencoes];
    const work=(plan?.all||[]).slice();
    const used=new Set(),matched=[],checklistOnly=[];
    check.forEach(ci=>{
      let best=null,bestScore=0;
      work.forEach(w=>{
        if(used.has(w.key)) return;
        const s=similarity(ci.item,w.descricao);
        if(s>bestScore){bestScore=s;best=w;}
      });
      if(best&&bestScore>=.5){used.add(best.key);matched.push({check:ci,work:best,score:bestScore});}
      else checklistOnly.push(ci);
    });
    const workOnly=work.filter(w=>!used.has(w.key));
    return {matched,checklistOnly,workOnly,check};
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
    purchaseLinks,purchaseLinkForNF,purchaseLinkForWork,setPurchaseLink,bestWorkMatch,similarity,checklistComparison,
    loadReferencesForOS,loadOperationalExtrasEfficient
  });
})();
