'use strict';

(function(){
  const CFG=window.CENTRAL_CONFIG;

  function norm(v){
    return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }
  function plate(v){ return String(v==null?'':v).toUpperCase().replace(/[^A-Z0-9]/g,''); }
  function iso(v){
    if(!v) return '';
    try{
      if(typeof v.toDate==='function') return v.toDate().toISOString();
      if(v.seconds) return new Date(v.seconds*1000).toISOString();
      const d=new Date(v); return Number.isNaN(d.getTime())?'':d.toISOString();
    }catch(_){ return ''; }
  }
  function ts(v){ const s=iso(v); return s?new Date(s).getTime():0; }
  function fmt(v){
    const s=iso(v);
    if(!s) return '';
    return new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  function escapeHtml(v){
    return String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function role(session){ return norm(session?.role||session?.cargo||''); }
  function isManager(session){
    const r=role(session);
    return (CFG.managerRoles||[]).some(x=>r===norm(x)||r.includes(norm(x)));
  }
  function canExecute(session){
    return !!session && window.CentralAuth?.roleAllowed?.(session.role||session.cargo||'');
  }
  function canPurchase(session){ return isManager(session); }

  function getOSPlate(os,vehicle){ return plate(os?.placa||os?.veiculoPlaca||vehicle?.placa||os?.veiculoSnapshot?.placa||''); }
  function getOSNumber(os){ return String(os?.numero||os?.codigo||os?.osRef||os?.referencia||os?.prisma||os?.numeroPrisma||os?.id||'').trim(); }
  function getVehicleLabel(os,vehicle){
    return String(vehicle?.modelo||os?.veiculoModelo||os?.veiculo||os?.veiculoSnapshot?.modelo||vehicle?.descricao||'VEÍCULO').trim();
  }
  function getClientLabel(os,client){
    return String(client?.nome||client?.razaoSocial||client?.fantasia||os?.clienteNome||os?.cliente||'').trim();
  }
  function activityTs(os){
    const vals=[
      os?.updatedAt,os?.atualizadoEm,os?.etapasInternasAtualizadoEm,os?.checklistAtualizadoEm,
      os?.checklistEntregaAtualizadoEm,os?.checklistUltimo?.atualizadoEm,os?.checklistResumo?.atualizadoEm,
      os?.centralViaturasAtualizadoEm,os?.createdAt,os?.data
    ];
    Object.values(os?.execucaoItens||{}).forEach(x=>vals.push(x?.atualizadoEm||x?.updatedAt));
    Object.values(os?.centralComprasItens||{}).forEach(x=>vals.push(x?.atualizadoEm||x?.updatedAt||x?.compradoEm));
    Object.values(os?.centralChecklistExecucaoItens||{}).forEach(x=>vals.push(x?.atualizadoEm||x?.updatedAt));
    Object.values(os?.centralChecklistComprasItens||{}).forEach(x=>vals.push(x?.atualizadoEm||x?.updatedAt||x?.compradoEm));
    vals.push(os?.checklistOperacionalAtualizadoEm);
    return Math.max(0,...vals.map(ts));
  }
  function activityIso(os){ const n=activityTs(os); return n?new Date(n).toISOString():''; }

  function normalizeEtapas(lista){
    if(!Array.isArray(lista)) return [];
    return lista.map((item,idx)=>{
      if(typeof item==='string') return {id:`legado-${idx}`,texto:item,realizado:false,interno:true,visivelCliente:false};
      return {
        id:String(item?.id||`legado-${idx}`),
        texto:String(item?.texto||item?.descricao||item?.recado||'').trim(),
        realizado:item?.realizado===true||item?.feito===true||item?.concluido===true,
        criadoEm:item?.criadoEm||item?.createdAt||'',
        criadoPor:item?.criadoPor||item?.createdBy||'',
        realizadoEm:item?.realizadoEm||item?.feitoEm||item?.concluidoEm||'',
        realizadoPor:item?.realizadoPor||item?.feitoPor||item?.concluidoPor||'',
        interno:true,
        visivelCliente:false,
        origem:item?.origem||''
      };
    }).filter(x=>x.texto);
  }

  function checklistSummary(os){
    const c=os?.checklistUltimo||{};
    const full=os?.checklistResumo||{};
    const crit=Array.isArray(c.criticos)
      ? c.criticos
      : (Array.isArray(full.itens)
          ? full.itens.filter(i=>!['ok','na','nao_se_aplica','não se aplica'].includes(norm(i.acao)))
          : []);
    return {
      exists:!!(os?.checklistUltimo||os?.checklistResumo||os?.checklistId),
      status:c.statusChecklist||full.statusChecklist||'',
      progresso:c.progressoPercent??full.progressoPercent??full.stats?.percent??null,
      pendentes:c.itensPendentes??full.itensPendentes??full.stats?.pending??null,
      responsavel:c.tecnicoChecklist||c.responsavel||full.tecnicoChecklist||full.responsavel||'',
      atualizadoEm:c.atualizadoEm||full.atualizadoEm||os?.checklistAtualizadoEm||'',
      criticos:crit
    };
  }

  const CHECKLIST_ACTION_LABELS={
    ok:'OK',atencao:'Atenção',trocar:'Trocar',retificar:'Retificar',
    regular:'Regular',ajustar:'Ajustar',lubrificar:'Lubrificar',
    limpar:'Limpar',revisar:'Revisar',na:'Não se aplica'
  };
  function normalizeChecklistPlanRow(raw,index,checklistId,group){
    const id=String(raw?.id||raw?.itemId||('item_'+index));
    const acao=norm(raw?.acao||'').replace(/\s+/g,'_');
    return {
      id,
      key:String(raw?.key||('checklist:'+(checklistId||'atual')+':'+id)),
      checklistId:String(raw?.checklistId||checklistId||''),
      group,
      secao:String(raw?.secao||'').trim(),
      item:String(raw?.item||raw?.titulo||raw?.descricao||'Item').trim(),
      acao,
      // A ação do checklist manda; label antigo nunca pode transformar Revisar em Trocar.
      acaoLabel:String(CHECKLIST_ACTION_LABELS[acao]||acao||raw?.acaoLabel||'').trim(),
      obs:String(raw?.obs||raw?.diagnosticoObs||'').trim(),
      fotoUrls:Array.isArray(raw?.fotoUrls)?raw.fotoUrls:(Array.isArray(raw?.fotosUrls)?raw.fotosUrls:[]),
      criticidade:String(raw?.criticidade||'').trim()
    };
  }

  function checklistPlan(os){
    const op=os?.checklistOperacional;
    const full=os?.checklistResumo||{};
    const last=os?.checklistUltimo||{};
    const checklistId=String(full?.id||last?.id||op?.checklistId||os?.checklistId||'');

    // Fonte de verdade: itens completos do CHECKLIS_SOS. O operacional é apenas derivado/fallback.
    const fullItems=Array.isArray(full?.itens)?full.itens:[];
    if(fullItems.length){
      const rows=fullItems.map((x,i)=>{
        const ac=norm(x?.acao||'').replace(/\s+/g,'_');
        let group='';
        if(ac==='trocar') group='peca';
        else if(['retificar','regular','ajustar','lubrificar','limpar'].includes(ac)) group='servico';
        else if(['atencao','revisar'].includes(ac)) group='atencao';
        if(!group) return null;
        return normalizeChecklistPlanRow(x,i,checklistId,group);
      }).filter(Boolean);
      return {
        checklistId,
        atualizadoEm:full?.atualizadoEm||os?.checklistAtualizadoEm||last?.atualizadoEm||'',
        pecasTrocar:rows.filter(x=>x.group==='peca'),
        servicosExecutar:rows.filter(x=>x.group==='servico'),
        atencoes:rows.filter(x=>x.group==='atencao')
      };
    }

    if(op && (Array.isArray(op.pecasTrocar)||Array.isArray(op.servicosExecutar)||Array.isArray(op.atencoes))){
      const all=[
        ...(op.pecasTrocar||[]),
        ...(op.servicosExecutar||[]),
        ...(op.atencoes||[])
      ].map((x,i)=>{
        const ac=norm(x?.acao||'').replace(/\s+/g,'_');
        let group='';
        if(ac==='trocar') group='peca';
        else if(['retificar','regular','ajustar','lubrificar','limpar'].includes(ac)) group='servico';
        else if(['atencao','revisar'].includes(ac)) group='atencao';
        return group?normalizeChecklistPlanRow(x,i,checklistId,group):null;
      }).filter(Boolean);
      return {
        checklistId,
        atualizadoEm:op.atualizadoEm||os?.checklistOperacionalAtualizadoEm||last?.atualizadoEm||'',
        pecasTrocar:all.filter(x=>x.group==='peca'),
        servicosExecutar:all.filter(x=>x.group==='servico'),
        atencoes:all.filter(x=>x.group==='atencao')
      };
    }

    const itens=Array.isArray(last?.criticos)?last.criticos:[];
    const rows=itens.map((x,i)=>{
      const ac=norm(x?.acao||'').replace(/\s+/g,'_');
      let group='';
      if(ac==='trocar') group='peca';
      else if(['retificar','regular','ajustar','lubrificar','limpar'].includes(ac)) group='servico';
      else if(['atencao','revisar'].includes(ac)) group='atencao';
      if(!group) return null;
      return normalizeChecklistPlanRow(x,i,checklistId,group);
    }).filter(Boolean);
    return {
      checklistId,
      atualizadoEm:last?.atualizadoEm||os?.checklistAtualizadoEm||'',
      pecasTrocar:rows.filter(x=>x.group==='peca'),
      servicosExecutar:rows.filter(x=>x.group==='servico'),
      atencoes:rows.filter(x=>x.group==='atencao')
    };
  }

  function checklistExecution(os,key){
    return (os?.centralChecklistExecucaoItens||{})[String(key)]||{};
  }

  function checklistPurchase(os,key){
    return (os?.centralChecklistComprasItens||{})[String(key)]||{};
  }


  function isActive(os){
    const s=norm(os?.status||os?.etapa||'');
    if(!s) return true;
    return !['entregue','concluido','concluído','cancelado','cancelada'].some(x=>s.includes(norm(x)));
  }

  function approvedKeys(os){
    const out=new Set();
    const src=os?.aprovacao?.itens||os?.itensAprovados||[];
    (Array.isArray(src)?src:[]).forEach(x=>{
      if(typeof x==='string') out.add(x);
      else if(x?.key) out.add(String(x.key));
    });
    return out;
  }
  function hasApproval(os){
    return !!((os?.aprovacao&&Array.isArray(os.aprovacao.itens))||Array.isArray(os?.itensAprovados));
  }
  function executionFinished(status){
    return /^(executado|executado_obs|executado_com_observacao|concluido|finalizado|feito|realizado|trocada)$/i.test(String(status||'').trim());
  }

  function realPartIdentity(p,index,source){
    const strong=String(p?.origemNFItemKey||p?.idReal||p?.pecaRealId||p?.origemAutoKey||'').trim();
    if(strong) return strong;
    const codigo=String(p?.codigo||p?.cod||p?.codigoComercial||p?.codigoFornecedor||p?.oem||'').trim();
    const desc=String(p?.desc||p?.descricao||p?.descricaoExibicao||p?.nomePeca||p?.nome||'').trim();
    const qtd=String(p?.qtd??p?.q??p?.quantidade??1);
    return [source||'real',codigo,desc,qtd,index].join('|');
  }

  function getRealParts(os){
    const lists=[
      {source:'pecasReais',items:os?.pecasReais},
      {source:'pecasRealmenteTrocadas',items:os?.pecasRealmenteTrocadas},
      {source:'itensReais',items:os?.itensReais}
    ];
    const out=[],seen=new Set();
    lists.forEach(group=>(Array.isArray(group.items)?group.items:[]).forEach((p,index)=>{
      if(!p||typeof p!=='object') return;
      const id=realPartIdentity(p,index,group.source);
      const dedupe=norm(id);
      if(dedupe&&seen.has(dedupe)) return;
      if(dedupe) seen.add(dedupe);
      out.push({...p,_centralRealSource:group.source,_centralRealIndex:index,_centralRealIdentity:id});
    }));
    return out;
  }

  function isTrulyInstalledRealPart(p){
    if(!p||typeof p!=='object') return false;
    const source=String(p._centralRealSource||'');
    if(source==='pecasRealmenteTrocadas'||source==='itensReais') return true;

    const origem=norm(p.origem||'').replace(/\s+/g,'_');
    const status=norm(p.statusAplicacao||p.statusExecucao||p.status||p.situacao||'').replace(/\s+/g,'_');
    const texto=norm([p.observacao,p.obs,p.motivo,p.descricaoStatus].filter(Boolean).join(' '));

    // O próprio SAAS-2 grava a entrada de NF em pecasReais com este status e
    // observação dizendo explicitamente que isso NÃO indica instalação/execução.
    const somenteComprada =
      status==='comprada_vinculada_nf' ||
      (origem==='nf_entrada' && !/(instalad|trocad|aplicad|executad|realizad|utilizad|baixad)/.test(status+' '+texto)) ||
      /nao indica instalacao|nao executad|aguardando instalacao|somente comprad/.test(texto);
    if(somenteComprada) return false;

    if(/(instalad|trocad|aplicad|executad|realizad|utilizad|baixad)/.test(status+' '+texto)) return true;
    if(p.origemAutoOS===true||origem==='os_estoque') return true;

    // Registro manual da área *177 é, por definição no SAAS-2, "Peças realmente instaladas".
    return source==='pecasReais';
  }

  function trueRealParts(os){
    return getRealParts(os).filter(isTrulyInstalledRealPart);
  }

  function operationalItems(os){
    const keys=approvedKeys(os);
    const approvalExists=hasApproval(os);
    const exec=os?.execucaoItens||{};
    const buys=os?.centralComprasItens||{};

    // SERVIÇOS: vêm da própria O.S., como solicitado.
    const services=(Array.isArray(os?.servicos)?os.servicos:[]).map((s,index)=>{
      const key=`servico-${index}`;
      return {
        key,index,tipo:'servico',labelTipo:'SERVIÇO DA O.S.',
        descricao:String(s?.desc||s?.descricao||s?.servico||s?.nome||'Serviço').trim(),
        codigo:String(s?.codigoInterno||s?.codInterno||s?.codigoServicoInterno||s?.codigoTabela||s?.codigo||'').trim(),
        qtd:1,
        aprovado:!approvalExists||keys.has(key),
        approvalExists,
        execucao:exec[key]||{},
        compra:null,
        real:false
      };
    });

    // PEÇAS: NUNCA usa os.pecas. Só usa as peças verdadeiramente instaladas
    // da área restrita *177 (pecasReais / pecasRealmenteTrocadas / itensReais),
    // excluindo vínculo de NF que o próprio SaaS marca como "não indica instalação".
    const pieces=trueRealParts(os).map((p,index)=>{
      const identity=String(p._centralRealIdentity||realPartIdentity(p,index,p._centralRealSource));
      const key=`real-${identity}`;
      const origem=norm(p?.origem||'');
      const hasNF=!!String(p?.nfId||p?.nf||p?.nfNumero||p?.numeroNF||'').trim();
      return {
        key,index,tipo:'peca',labelTipo:'PEÇA REAL TROCADA',
        descricao:String(p?.desc||p?.descricao||p?.descricaoExibicao||p?.nomePeca||p?.nome||p?.item||'Peça').trim(),
        codigo:String(p?.codigo||p?.cod||p?.codigoComercial||p?.codigoFornecedor||p?.oem||'').trim(),
        qtd:p?.qtd??p?.q??p?.quantidadeOperacionalTotal??p?.quantidade??1,
        aprovado:true,
        approvalExists:false,
        execucao:{
          status:'trocada',
          atualizadoPor:p?.registradoPor||p?.atualizadoPor||p?.mecNome||'',
          atualizadoEm:p?.registradoEm||p?.atualizadoEm||p?.dataInstalacao||p?.dataTroca||''
        },
        compra:buys[key]||{},
        compraFiscal:hasNF,
        fornecedor:String(p?.fornecedor||p?.fornecedorNome||'').trim(),
        nfNumero:String(p?.nfNumero||p?.nf||'').trim(),
        real:true,
        realSource:p?._centralRealSource||'pecasReais',
        origem
      };
    });

    return services.concat(pieces).filter(x=>x.descricao||x.codigo);
  }

  function safePiece(p){
    if(!p||typeof p!=='object') return null;
    const descricao=String(p.desc||p.descricao||p.item||p.nome||p.peca||p.peça||'').trim();
    const codigo=String(p.codigo||p.cod||p.codigoComercial||p.codigoFornecedor||p.oem||'').trim();
    const qtd=p.qtd??p.q??p.quantidadeOperacionalTotal??p.quantidade??p.qtde??1;
    const status=String(p.status||p.etapa||p.situacao||p.situação||p.statusAplicacao||'').trim();
    const fornecedor=String(p.fornecedorNome||p.fornecedor||'').trim();
    const nfNumero=String(p.nfNumero||p.nf||'').trim();
    if(!descricao&&!codigo) return null;
    return {descricao,codigo,qtd,status,fornecedor,nfNumero};
  }

  function osPieces(os){
    return trueRealParts(os).map(safePiece).filter(Boolean);
  }

  function safeNF(doc){
    if(!doc) return null;
    const descricao=String(doc.desc||doc.descricao||doc.item||'').trim();
    const codigo=String(doc.codigo||doc.codigoFornecedor||doc.codigoComercial||'').trim();
    if(!descricao&&!codigo) return null;
    return {
      id:doc.id||'',descricao,codigo,qtd:doc.qtd??doc.quantidade??'',
      fornecedor:String(doc.fornecedorNome||'').trim(),
      nfNumero:String(doc.nfNumero||'').trim(),
      finalidade:String(doc.finalidade||doc.destino||'').trim(),
      status:String(doc.status||doc.statusAplicacao||'').trim(),
      createdAt:doc.createdAt||doc.updatedAt||''
    };
  }
  function safeCotacao(doc){
    if(!doc) return null;
    const itens=Array.isArray(doc.itens)?doc.itens:[];
    return {
      id:doc.id||'',osId:doc.osId||'',placa:plate(doc.placa||''),
      status:String(doc.status||doc.situacao||'').trim(),
      createdAt:doc.createdAt||doc.updatedAt||'',
      itens:itens.map(i=>({
        descricao:String(i.descricao||i.desc||i.item||'').trim(),
        codigo:String(i.codigo||i.cod||'').trim(),
        qtd:i.qtd??i.quantidade??''
      })).filter(i=>i.descricao||i.codigo)
    };
  }

  function reportEvents(os){
    return (Array.isArray(os?.centralViaturasRelatorio)?os.centralViaturasRelatorio:[])
      .map(x=>({...x,data:x?.data||x?.createdAt||x?.atualizadoEm||''}))
      .filter(x=>x&&x.data);
  }
  function eventId(){ return `cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
  function makeEvent(session,tipo,acao,extra={}){
    return {
      id:eventId(),tipo,acao,
      data:new Date().toISOString(),
      usuario:session?.name||'Usuário',
      usuarioId:session?.funcionarioId||session?.email||session?.login||'',
      perfil:session?.role||session?.cargo||'equipe',
      origem:'CENTRAL-VIATURAS',
      ...extra
    };
  }
  function pushReport(current,event){
    const list=Array.isArray(current)?current.slice():[];
    list.push(event);
    return list.slice(-400);
  }
  function pushTimeline(current,user,acao,data){
    const list=Array.isArray(current)?current.slice():[];
    list.push({dt:data||new Date().toISOString(),user:user||'Equipe',acao});
    return list.slice(-500);
  }

  function readKey(session){
    return `CENTRAL_VIATURAS_READS::${session?.tenantId||'sem'}::${CentralAuth.sessionIdentity(session)}`;
  }
  function loadReads(session){
    try{return JSON.parse(localStorage.getItem(readKey(session))||'{}')||{};}catch(_){return{};}
  }
  function markRead(session,key,value=Date.now()){
    const reads=loadReads(session);
    reads[String(key)]=Number(value)||Date.now();
    localStorage.setItem(readKey(session),JSON.stringify(reads));
    return reads;
  }
  function seenAt(session,key){ return Number(loadReads(session)[String(key)]||0); }

  async function queryByTenant(db,col,tenantId,limit=500){
    try{
      const snap=await db.collection(col).where('tenantId','==',tenantId).limit(limit).get();
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    }catch(e){
      console.warn('[Central data]',col,e.message);
      return [];
    }
  }
  async function loadReferenceData(db,session){
    const [vehicles,clients]=await Promise.all([
      queryByTenant(db,CFG.collections.veiculos,session.tenantId,1000),
      queryByTenant(db,CFG.collections.clientes,session.tenantId,1000)
    ]);
    return {vehicles,clients};
  }
  function listenOS(db,session,onData,onError){
    const q=db.collection(CFG.collections.os).where('tenantId','==',session.tenantId);
    return q.onSnapshot(
      s=>onData(s.docs.map(d=>({id:d.id,...d.data()}))),
      err=>{console.error('[Central OS listener]',err);onError?.(err);}
    );
  }
  async function findOSByPlate(db,session,plateValue){
    const target=plate(plateValue);
    if(!target) return null;
    const candidates=[];
    for(const field of ['placa','veiculoPlaca']){
      try{
        const snap=await db.collection(CFG.collections.os)
          .where('tenantId','==',session.tenantId).where(field,'==',target).limit(20).get();
        snap.docs.forEach(d=>candidates.push({id:d.id,...d.data()}));
      }catch(_){}
    }
    if(!candidates.length){
      const all=await queryByTenant(db,CFG.collections.os,session.tenantId,500);
      const refs=await loadReferenceData(db,session);
      const vmap=new Map(refs.vehicles.map(v=>[String(v.id),v]));
      candidates.push(...all.filter(o=>getOSPlate(o,vmap.get(String(o.veiculoId)))===target));
    }
    if(!candidates.length) return null;
    candidates.sort((a,b)=>activityTs(b)-activityTs(a));
    return candidates[0];
  }
  async function loadOperationalExtras(db,session,os,plateValue){
    const p=plate(plateValue);
    const osId=String(os?.id||'');
    const nf=[],cot=[];
    const addDocs=(arr,snap,mapper)=>snap?.docs?.forEach(d=>{
      const x=mapper({id:d.id,...d.data()});
      if(x&&!arr.some(y=>y.id===x.id)) arr.push(x);
    });
    for(const spec of [{field:'osId',value:osId},{field:'placa',value:p}]){
      if(!spec.value) continue;
      try{
        const s=await db.collection(CFG.collections.nfVinculos)
          .where('tenantId','==',session.tenantId).where(spec.field,'==',spec.value).limit(120).get();
        addDocs(nf,s,safeNF);
      }catch(e){ console.warn('[Central NF]',e.message); }
      try{
        const s=await db.collection(CFG.collections.cotacoes)
          .where('tenantId','==',session.tenantId).where(spec.field,'==',spec.value).limit(80).get();
        addDocs(cot,s,safeCotacao);
      }catch(e){ console.warn('[Central cotação]',e.message); }
    }
    return {nf,cotacoes:cot};
  }

  async function addEtapa(db,session,osId,texto){
    texto=String(texto||'').trim();
    if(!texto) throw new Error('Digite o recado.');
    const ref=db.collection(CFG.collections.os).doc(osId);
    const agora=new Date().toISOString();
    let nova=null;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error('O.S. não encontrada.');
      const atual=snap.data()||{};
      const etapas=normalizeEtapas(atual.etapasInternas);
      nova={
        id:eventId(),texto,realizado:false,criadoEm:agora,criadoPor:session.name||'Usuário',
        realizadoEm:'',realizadoPor:'',interno:true,visivelCliente:false,origem:'CENTRAL-VIATURAS'
      };
      etapas.push(nova);
      const ev=makeEvent(session,'recado','registrou_recado',{texto});
      tx.update(ref,{
        etapasInternas:etapas,
        etapasInternasAtualizadoEm:agora,
        etapasInternasAtualizadoPor:session.name||'Usuário',
        centralViaturasRelatorio:pushReport(atual.centralViaturasRelatorio,ev),
        timeline:pushTimeline(atual.timeline,session.name,`Central: registrou recado — ${texto}`,agora),
        centralViaturasAtualizadoEm:agora,
        centralViaturasAtualizadoPor:session.name||'Usuário',
        updatedAt:agora
      });
    });
    return nova;
  }

  async function toggleEtapa(db,session,osId,etapaId){
    const ref=db.collection(CFG.collections.os).doc(osId);
    const agora=new Date().toISOString();
    let done=false;
    let texto='';
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error('O.S. não encontrada.');
      const atual=snap.data()||{};
      const etapas=normalizeEtapas(atual.etapasInternas).map(item=>{
        if(String(item.id)!==String(etapaId)) return item;
        done=!item.realizado;
        texto=item.texto||'';
        return {
          ...item,realizado:done,realizadoEm:done?agora:'',realizadoPor:done?(session.name||'Usuário'):'',
          interno:true,visivelCliente:false
        };
      });
      const ev=makeEvent(session,'recado',done?'concluiu_recado':'reabriu_recado',{texto});
      tx.update(ref,{
        etapasInternas:etapas,
        etapasInternasAtualizadoEm:agora,
        etapasInternasAtualizadoPor:session.name||'Usuário',
        centralViaturasRelatorio:pushReport(atual.centralViaturasRelatorio,ev),
        timeline:pushTimeline(atual.timeline,session.name,`Central: ${done?'concluiu':'reabriu'} recado — ${texto}`,agora),
        centralViaturasAtualizadoEm:agora,
        centralViaturasAtualizadoPor:session.name||'Usuário',
        updatedAt:agora
      });
    });
    return done;
  }

  async function setExecutionState(db,session,osId,itemKey,done){
    if(!canExecute(session)) throw new Error('Seu perfil não pode alterar a execução.');
    const ref=db.collection(CFG.collections.os).doc(osId);
    const agora=new Date().toISOString();
    let result=null;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error('O.S. não encontrada.');
      const atual=snap.data()||{};
      const item=operationalItems(atual).find(x=>String(x.key)===String(itemKey));
      if(!item) throw new Error('Item não encontrado nesta O.S.');
      if(item.real) throw new Error('Esta peça já é uma peça realmente trocada. Para corrigir esse registro, use o controle de peças reais da O.S.');
      if(item.approvalExists&&!item.aprovado) throw new Error('Item não aprovado. Não pode ser marcado como executado/trocado.');
      const execucaoItens={...(atual.execucaoItens||{})};
      const anterior=execucaoItens[item.key]||{};
      const status=done?(item.tipo==='peca'?'trocada':'executado'):'pendente';
      execucaoItens[item.key]={
        ...anterior,
        key:item.key,
        tipo:item.tipo,
        status,
        obs:anterior.obs||'',
        mecId:session.funcionarioId||anterior.mecId||'',
        mecNome:session.name||anterior.mecNome||'',
        responsavelId:session.funcionarioId||anterior.responsavelId||'',
        responsavelNome:session.name||anterior.responsavelNome||'',
        atualizadoEm:agora,
        atualizadoPorId:session.funcionarioId||session.email||'',
        atualizadoPor:session.name||'Equipe',
        atualizadoPorTipo:session.role||session.cargo||'equipe',
        origemAtualizacao:'CENTRAL-VIATURAS'
      };
      const acao=done?(item.tipo==='peca'?'marcou_peca_trocada':'marcou_servico_executado'):'reabriu_execucao';
      const ev=makeEvent(session,'execucao',acao,{
        itemKey:item.key,itemTipo:item.tipo,descricao:item.descricao,codigo:item.codigo||'',status
      });
      tx.update(ref,{
        execucaoItens,
        centralViaturasRelatorio:pushReport(atual.centralViaturasRelatorio,ev),
        timeline:pushTimeline(atual.timeline,session.name,`Central: ${item.tipo==='peca'?(done?'peça marcada como trocada':'peça reaberta'):(done?'serviço marcado como executado':'serviço reaberto')} — ${item.descricao}`,agora),
        centralViaturasAtualizadoEm:agora,
        centralViaturasAtualizadoPor:session.name||'Usuário',
        updatedAt:agora
      });
      result={item,status,done};
    });
    return result;
  }

  async function addRealPart(db,session,osId,input){
    if(!isManager(session)) throw new Error('Somente gestão pode acessar o controle confidencial de peças.');
    const descricao=String(input?.descricao||'').trim();
    const codigo=String(input?.codigo||'').trim();
    const qtd=Math.max(0.0001,Number(input?.qtd||1)||1);
    if(!descricao&&!codigo) throw new Error('Informe a peça trocada.');

    const ref=db.collection(CFG.collections.os).doc(osId);
    const auditRef=db.collection('lixeira_auditoria').doc();
    const agora=new Date().toISOString();
    let created=null;

    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error('O.S. não encontrada.');
      const atual=snap.data()||{};
      const list=Array.isArray(atual.pecasReais)?atual.pecasReais.slice():[];
      created={
        idReal:eventId(),
        origem:'central_viaturas',
        statusAplicacao:'instalada',
        codigo,
        desc:descricao,
        descricao,
        qtd,
        registradoEm:agora,
        registradoPor:session.name||'Equipe',
        registradoPorId:session.funcionarioId||session.email||'',
        registradoPorPerfil:session.role||session.cargo||'equipe',
        observacao:'Peça registrada como realmente trocada pela Central de Viaturas.'
      };
      list.push(created);

      const ev=makeEvent(session,'peca_real','registrou_peca_real_trocada',{
        descricao,codigo,qtd,status:'trocada'
      });

      tx.update(ref,{
        pecasReais:list,
        centralViaturasRelatorio:pushReport(atual.centralViaturasRelatorio,ev),
        centralViaturasAtualizadoEm:agora,
        centralViaturasAtualizadoPor:session.name||'Usuário',
        updatedAt:agora
      });
      tx.set(auditRef,{
        tenantId:session.tenantId||'',
        modulo:'CENTRAL / GESTÃO',
        acao:'Atualização confidencial do controle gerencial de peças',
        usuario:session.name||'Gestão',
        usuarioId:session.funcionarioId||session.email||'',
        perfil:session.role||session.cargo||'gestao',
        entidade:'ordens_servico',
        entidadeId:osId,
        placa:getOSPlate(atual),
        item:descricao||codigo,
        codigo,
        qtd,
        ts:agora,
        createdAt:agora,
        confidencial:true
      });
    });

    return created;
  }

  async function setChecklistExecutionState(db,session,osId,itemKey,done){
    if(!canExecute(session)) throw new Error('Seu perfil não pode alterar a execução.');
    const ref=db.collection(CFG.collections.os).doc(osId);
    const auditRef=db.collection('lixeira_auditoria').doc();
    const agora=new Date().toISOString();
    let result=null;

    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error('O.S. não encontrada.');
      const atual=snap.data()||{};
      const plan=checklistPlan(atual);
      const all=[...plan.pecasTrocar,...plan.servicosExecutar,...plan.atencoes];
      const item=all.find(x=>String(x.key)===String(itemKey));
      if(!item) throw new Error('Item do checklist não encontrado nesta O.S.');

      const map={...(atual.centralChecklistExecucaoItens||{})};
      const anterior=map[item.key]||{};
      const status=done?(item.group==='peca'?'trocada':item.group==='atencao'?'resolvido':'executado'):'pendente';
      map[item.key]={
        ...anterior,key:item.key,checklistId:item.checklistId,itemId:item.id,
        grupo:item.group,descricao:item.item,secao:item.secao,acao:item.acao,
        status,
        atualizadoEm:agora,
        atualizadoPor:session.name||'Equipe',
        atualizadoPorId:session.funcionarioId||session.email||'',
        atualizadoPorTipo:session.role||session.cargo||'equipe',
        origem:'CENTRAL-VIATURAS'
      };

      let pecasReais=Array.isArray(atual.pecasReais)?atual.pecasReais.slice():[];
      if(item.group==='peca'){
        if(done){
          const exists=pecasReais.some(p=>String(p?.checklistItemKey||'')===String(item.key));
          if(!exists){
            pecasReais.push({
              idReal:eventId(),
              origem:'checklist_sos',
              origemChecklist:true,
              checklistId:item.checklistId,
              checklistItemId:item.id,
              checklistItemKey:item.key,
              statusAplicacao:'instalada',
              desc:item.item,
              descricao:item.item,
              qtd:1,
              registradoEm:agora,
              registradoPor:session.name||'Equipe',
              registradoPorId:session.funcionarioId||session.email||'',
              registradoPorPerfil:session.role||session.cargo||'equipe',
              observacao:item.obs?('Checklist: '+item.obs):'Peça marcada como realmente trocada a partir do Checklist SOS.'
            });
          }
        }else{
          pecasReais=pecasReais.filter(p=>!(
            String(p?.origem||'')==='checklist_sos' &&
            String(p?.checklistItemKey||'')===String(item.key)
          ));
        }
      }

      const verb=item.group==='peca'?(done?'item de peça do checklist concluído':'item de peça do checklist reaberto'):
        item.group==='atencao'?(done?'atenção marcada como resolvida':'atenção reaberta'):
        (done?'serviço do checklist executado':'serviço do checklist reaberto');

      const ev=makeEvent(session,'checklist_execucao',done?'concluiu_item_checklist':'reabriu_item_checklist',{
        itemKey:item.key,checklistId:item.checklistId,grupo:item.group,descricao:item.item,secao:item.secao,status
      });

      tx.update(ref,{
        centralChecklistExecucaoItens:map,
        ...(item.group==='peca'?{pecasReais}:{}),
        centralViaturasRelatorio:pushReport(atual.centralViaturasRelatorio,ev),
        timeline:pushTimeline(atual.timeline,session.name,'Central: '+verb+' — '+item.item,agora),
        centralViaturasAtualizadoEm:agora,
        centralViaturasAtualizadoPor:session.name||'Usuário',
        updatedAt:agora
      });

      tx.set(auditRef,{
        tenantId:session.tenantId||'',
        modulo:'CENTRAL / CHECKLIST',
        acao:verb+': '+item.item,
        usuario:session.name||'Equipe',
        usuarioId:session.funcionarioId||session.email||'',
        perfil:session.role||session.cargo||'equipe',
        entidade:'ordens_servico',
        entidadeId:osId,
        checklistId:item.checklistId||'',
        itemKey:item.key,
        placa:getOSPlate(atual),
        ts:agora,
        createdAt:agora
      });
      result={item,status,done};
    });
    return result;
  }

  async function setChecklistPurchaseState(db,session,osId,itemKey,bought){
    if(!canPurchase(session)) throw new Error('Somente gestor, gerente ou administrador pode marcar compra.');
    const ref=db.collection(CFG.collections.os).doc(osId);
    const auditRef=db.collection('lixeira_auditoria').doc();
    const agora=new Date().toISOString();
    let result=null;

    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error('O.S. não encontrada.');
      const atual=snap.data()||{};
      const item=checklistPlan(atual).pecasTrocar.find(x=>String(x.key)===String(itemKey));
      if(!item) throw new Error('Peça do checklist não encontrada nesta O.S.');

      const map={...(atual.centralChecklistComprasItens||{})};
      const anterior=map[item.key]||{};
      map[item.key]={
        ...anterior,
        key:item.key,checklistId:item.checklistId,itemId:item.id,
        descricao:item.item,secao:item.secao,
        comprado:!!bought,
        status:bought?'comprado':'pendente',
        compradoEm:bought?agora:'',
        compradoPor:bought?(session.name||'Gestão'):'',
        atualizadoEm:agora,
        atualizadoPor:session.name||'Gestão',
        atualizadoPorId:session.funcionarioId||session.email||'',
        atualizadoPorTipo:session.role||session.cargo||'gestao',
        origem:'CENTRAL-VIATURAS'
      };

      const verb=bought?'peça do checklist marcada como comprada':'compra da peça do checklist reaberta';
      const ev=makeEvent(session,'checklist_compra',bought?'marcou_peca_checklist_comprada':'reabriu_compra_peca_checklist',{
        itemKey:item.key,checklistId:item.checklistId,descricao:item.item,secao:item.secao,status:bought?'comprado':'pendente'
      });

      tx.update(ref,{
        centralChecklistComprasItens:map,
        centralViaturasRelatorio:pushReport(atual.centralViaturasRelatorio,ev),
        timeline:pushTimeline(atual.timeline,session.name,'Central: '+verb+' — '+item.item,agora),
        centralViaturasAtualizadoEm:agora,
        centralViaturasAtualizadoPor:session.name||'Usuário',
        updatedAt:agora
      });

      tx.set(auditRef,{
        tenantId:session.tenantId||'',
        modulo:'CENTRAL / CHECKLIST',
        acao:verb+': '+item.item,
        usuario:session.name||'Gestão',
        usuarioId:session.funcionarioId||session.email||'',
        perfil:session.role||session.cargo||'gestao',
        entidade:'ordens_servico',
        entidadeId:osId,
        checklistId:item.checklistId||'',
        itemKey:item.key,
        placa:getOSPlate(atual),
        ts:agora,
        createdAt:agora
      });
      result={item,bought};
    });
    return result;
  }


  async function setPurchaseState(db,session,osId,itemKey,bought){
    if(!canPurchase(session)) throw new Error('Somente gestor, gerente ou administrador pode marcar compra.');
    const ref=db.collection(CFG.collections.os).doc(osId);
    const agora=new Date().toISOString();
    let result=null;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) throw new Error('O.S. não encontrada.');
      const atual=snap.data()||{};
      const item=operationalItems(atual).find(x=>String(x.key)===String(itemKey));
      if(!item) throw new Error('Item não encontrado nesta O.S.');
      if(item.tipo!=='peca') throw new Error('Compra manual só se aplica a peças.');
      const compras={...(atual.centralComprasItens||{})};
      const anterior=compras[item.key]||{};
      compras[item.key]={
        ...anterior,
        key:item.key,
        tipo:'peca',
        descricao:item.descricao,
        codigo:item.codigo||'',
        qtd:item.qtd??1,
        comprado:!!bought,
        status:bought?'comprado':'pendente',
        compradoEm:bought?agora:'',
        compradoPor:bought?(session.name||'Gestão'):'',
        atualizadoEm:agora,
        atualizadoPor:session.name||'Gestão',
        atualizadoPorId:session.funcionarioId||session.email||'',
        atualizadoPorTipo:session.role||session.cargo||'gestao',
        origem:'CENTRAL-VIATURAS'
      };
      const ev=makeEvent(session,'compra',bought?'marcou_peca_comprada':'desmarcou_peca_comprada',{
        itemKey:item.key,itemTipo:'peca',descricao:item.descricao,codigo:item.codigo||'',status:bought?'comprado':'pendente'
      });
      tx.update(ref,{
        centralComprasItens:compras,
        centralViaturasRelatorio:pushReport(atual.centralViaturasRelatorio,ev),
        timeline:pushTimeline(atual.timeline,session.name,`Central: ${bought?'peça marcada como comprada':'compra desmarcada'} — ${item.descricao}`,agora),
        centralViaturasAtualizadoEm:agora,
        centralViaturasAtualizadoPor:session.name||'Usuário',
        updatedAt:agora
      });
      result={item,bought};
    });
    return result;
  }

  window.CentralData={
    norm,plate,iso,ts,fmt,escapeHtml,
    role,isManager,canExecute,canPurchase,
    getOSPlate,getOSNumber,getVehicleLabel,getClientLabel,activityTs,activityIso,
    normalizeEtapas,checklistSummary,checklistPlan,checklistExecution,checklistPurchase,isActive,
    approvedKeys,hasApproval,executionFinished,getRealParts,isTrulyInstalledRealPart,trueRealParts,operationalItems,
    osPieces,safeNF,safeCotacao,reportEvents,
    loadReads,markRead,seenAt,
    queryByTenant,loadReferenceData,listenOS,findOSByPlate,loadOperationalExtras,
    addEtapa,toggleEtapa,addRealPart,setExecutionState,setChecklistExecutionState,setChecklistPurchaseState,setPurchaseState
  };
})();
