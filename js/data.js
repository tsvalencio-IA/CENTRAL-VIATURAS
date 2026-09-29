'use strict';

(function(){
  const CFG=window.CENTRAL_CONFIG;
  function norm(v){ return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
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
  function fmt(v){ const s=iso(v); if(!s) return ''; return new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  function escapeHtml(v){ return String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

  function getOSPlate(os,vehicle){ return plate(os?.placa||os?.veiculoPlaca||vehicle?.placa||os?.veiculoSnapshot?.placa||''); }
  function getOSNumber(os){ return String(os?.numero||os?.codigo||os?.osRef||os?.referencia||os?.prisma||os?.numeroPrisma||os?.id||'').trim(); }
  function getVehicleLabel(os,vehicle){
    return String(vehicle?.modelo||os?.veiculoModelo||os?.veiculo||os?.veiculoSnapshot?.modelo||vehicle?.descricao||'VEÍCULO').trim();
  }
  function getClientLabel(os,client){ return String(client?.nome||client?.razaoSocial||client?.fantasia||os?.clienteNome||os?.cliente||'').trim(); }
  function activityTs(os){
    const vals=[os?.updatedAt,os?.atualizadoEm,os?.etapasInternasAtualizadoEm,os?.checklistAtualizadoEm,os?.checklistEntregaAtualizadoEm,os?.checklistUltimo?.atualizadoEm,os?.checklistResumo?.atualizadoEm,os?.centralViaturasAtualizadoEm,os?.createdAt,os?.data];
    return Math.max(0,...vals.map(ts));
  }
  function activityIso(os){ const n=activityTs(os); return n?new Date(n).toISOString():''; }
  function normalizeEtapas(lista){
    if(!Array.isArray(lista)) return [];
    return lista.map((item,idx)=>{
      if(typeof item==='string') return {id:`legado-${idx}`,texto:item,realizado:false,interno:true};
      return {
        id:String(item?.id||`legado-${idx}`), texto:String(item?.texto||item?.descricao||item?.recado||'').trim(),
        realizado:item?.realizado===true||item?.feito===true||item?.concluido===true,
        criadoEm:item?.criadoEm||item?.createdAt||'', criadoPor:item?.criadoPor||item?.createdBy||'',
        realizadoEm:item?.realizadoEm||item?.feitoEm||item?.concluidoEm||'', realizadoPor:item?.realizadoPor||item?.feitoPor||item?.concluidoPor||'',
        interno:true, visivelCliente:false
      };
    }).filter(x=>x.texto);
  }
  function checklistSummary(os){
    const c=os?.checklistUltimo||{};
    const full=os?.checklistResumo||{};
    const crit=Array.isArray(c.criticos)?c.criticos:(Array.isArray(full.itens)?full.itens.filter(i=>!['ok','na','nao_se_aplica','não se aplica'].includes(norm(i.acao))):[]);
    return {
      exists:!!(os?.checklistUltimo||os?.checklistResumo||os?.checklistId),
      status:c.statusChecklist||full.statusChecklist||'', progresso:c.progressoPercent??full.progressoPercent??full.stats?.percent??null,
      pendentes:c.itensPendentes??full.itensPendentes??full.stats?.pending??null,
      responsavel:c.tecnicoChecklist||c.responsavel||full.tecnicoChecklist||full.responsavel||'',
      atualizadoEm:c.atualizadoEm||full.atualizadoEm||os?.checklistAtualizadoEm||'', criticos:crit
    };
  }
  function isActive(os){
    const s=norm(os?.status||os?.etapa||'');
    if(!s) return true;
    return !['entregue','concluido','concluído','cancelado','cancelada'].some(x=>s.includes(norm(x)));
  }

  function safePiece(p){
    if(!p || typeof p!=='object') return null;
    const descricao=String(p.desc||p.descricao||p.item||p.nome||p.peca||p.peça||'').trim();
    const codigo=String(p.codigo||p.cod||p.codigoFornecedor||p.oem||'').trim();
    const qtd=p.qtd??p.quantidade??p.qtde??1;
    const status=String(p.status||p.etapa||p.situacao||p.situação||'').trim();
    const fornecedor=String(p.fornecedorNome||p.fornecedor||'').trim();
    if(!descricao && !codigo) return null;
    return {descricao,codigo,qtd,status,fornecedor};
  }
  function osPieces(os){
    const raw=Array.isArray(os?.pecasReais)?os.pecasReais:(Array.isArray(os?.pecas)?os.pecas:[]);
    return raw.map(safePiece).filter(Boolean);
  }
  function safeNF(doc){
    if(!doc) return null;
    const descricao=String(doc.desc||doc.descricao||doc.item||'').trim();
    const codigo=String(doc.codigo||doc.codigoFornecedor||doc.codigoComercial||'').trim();
    if(!descricao && !codigo) return null;
    return {
      id:doc.id||'', descricao,codigo, qtd:doc.qtd??doc.quantidade??'', fornecedor:String(doc.fornecedorNome||'').trim(),
      nfNumero:String(doc.nfNumero||'').trim(), finalidade:String(doc.finalidade||doc.destino||'').trim(), status:String(doc.status||'').trim(), createdAt:doc.createdAt||doc.updatedAt||''
    };
  }
  function safeCotacao(doc){
    if(!doc) return null;
    const itens=Array.isArray(doc.itens)?doc.itens:[];
    return {id:doc.id||'',osId:doc.osId||'',placa:plate(doc.placa||''),status:String(doc.status||doc.situacao||'').trim(),createdAt:doc.createdAt||doc.updatedAt||'',itens:itens.map(i=>({descricao:String(i.descricao||i.desc||i.item||'').trim(),codigo:String(i.codigo||i.cod||'').trim(),qtd:i.qtd??i.quantidade??''})).filter(i=>i.descricao||i.codigo)};
  }

  function readKey(session){ return `CENTRAL_VIATURAS_READS::${session?.tenantId||'sem'}::${CentralAuth.sessionIdentity(session)}`; }
  function loadReads(session){ try{return JSON.parse(localStorage.getItem(readKey(session))||'{}')||{};}catch(_){return{};} }
  function markRead(session,key,value=Date.now()){
    const reads=loadReads(session); reads[String(key)]=Number(value)||Date.now(); localStorage.setItem(readKey(session),JSON.stringify(reads)); return reads;
  }
  function seenAt(session,key){ return Number(loadReads(session)[String(key)]||0); }

  async function queryByTenant(db,col,tenantId,limit=500){
    try{ const snap=await db.collection(col).where('tenantId','==',tenantId).limit(limit).get(); return snap.docs.map(d=>({id:d.id,...d.data()})); }
    catch(e){ console.warn('[Central data]',col,e.message); return []; }
  }
  async function loadReferenceData(db,session){
    const [vehicles,clients]=await Promise.all([
      queryByTenant(db,CFG.collections.veiculos,session.tenantId,1000),
      queryByTenant(db,CFG.collections.clientes,session.tenantId,1000)
    ]);
    return {vehicles,clients};
  }
  function listenOS(db,session,onData,onError){
    let q=db.collection(CFG.collections.os).where('tenantId','==',session.tenantId);
    return q.onSnapshot(s=>onData(s.docs.map(d=>({id:d.id,...d.data()}))),err=>{console.error('[Central OS listener]',err);onError?.(err);});
  }
  async function findOSByPlate(db,session,plateValue){
    const target=plate(plateValue); if(!target) return null;
    const candidates=[];
    for(const field of ['placa','veiculoPlaca']){
      try{ const snap=await db.collection(CFG.collections.os).where('tenantId','==',session.tenantId).where(field,'==',target).limit(20).get(); snap.docs.forEach(d=>candidates.push({id:d.id,...d.data()})); }catch(_){}
    }
    if(!candidates.length){
      const all=await queryByTenant(db,CFG.collections.os,session.tenantId,500);
      const refs=await loadReferenceData(db,session); const vmap=new Map(refs.vehicles.map(v=>[String(v.id),v]));
      candidates.push(...all.filter(o=>getOSPlate(o,vmap.get(String(o.veiculoId)))===target));
    }
    if(!candidates.length) return null;
    candidates.sort((a,b)=>activityTs(b)-activityTs(a)); return candidates[0];
  }
  async function loadOperationalExtras(db,session,os,plateValue){
    const p=plate(plateValue); const osId=String(os?.id||'');
    const nf=[], cot=[];
    const addDocs=(arr,snap,mapper)=>snap?.docs?.forEach(d=>{const x=mapper({id:d.id,...d.data()});if(x&&!arr.some(y=>y.id===x.id))arr.push(x);});
    for(const spec of [{field:'osId',value:osId},{field:'placa',value:p}]){
      if(!spec.value) continue;
      try{ const s=await db.collection(CFG.collections.nfVinculos).where('tenantId','==',session.tenantId).where(spec.field,'==',spec.value).limit(120).get(); addDocs(nf,s,safeNF); }catch(e){ console.warn('[Central NF]',e.message); }
      try{ const s=await db.collection(CFG.collections.cotacoes).where('tenantId','==',session.tenantId).where(spec.field,'==',spec.value).limit(80).get(); addDocs(cot,s,safeCotacao); }catch(e){ console.warn('[Central cotação]',e.message); }
    }
    return {nf,cotacoes:cot};
  }
  async function addEtapa(db,session,osId,texto){
    texto=String(texto||'').trim(); if(!texto) throw new Error('Digite o recado.');
    const ref=db.collection(CFG.collections.os).doc(osId); const agora=new Date().toISOString();
    let nova=null;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref); if(!snap.exists) throw new Error('O.S. não encontrada.');
      const etapas=normalizeEtapas(snap.data()?.etapasInternas);
      nova={id:`cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,texto,realizado:false,criadoEm:agora,criadoPor:session.name||'Usuário',realizadoEm:'',realizadoPor:'',interno:true,visivelCliente:false,origem:'CENTRAL-VIATURAS'};
      etapas.push(nova);
      tx.update(ref,{etapasInternas:etapas,etapasInternasAtualizadoEm:agora,etapasInternasAtualizadoPor:session.name||'Usuário',centralViaturasAtualizadoEm:agora,centralViaturasAtualizadoPor:session.name||'Usuário',updatedAt:agora});
    });
return nova;
  }
  async function toggleEtapa(db,session,osId,etapaId){
    const ref=db.collection(CFG.collections.os).doc(osId); const agora=new Date().toISOString();
    let done=false;
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref); if(!snap.exists) throw new Error('O.S. não encontrada.');
      const etapas=normalizeEtapas(snap.data()?.etapasInternas).map(item=>{
        if(String(item.id)!==String(etapaId)) return item;
        done=!item.realizado;
        return {...item,realizado:done,realizadoEm:done?agora:'',realizadoPor:done?(session.name||'Usuário'):'',interno:true,visivelCliente:false};
      });
      tx.update(ref,{etapasInternas:etapas,etapasInternasAtualizadoEm:agora,etapasInternasAtualizadoPor:session.name||'Usuário',centralViaturasAtualizadoEm:agora,centralViaturasAtualizadoPor:session.name||'Usuário',updatedAt:agora});
    });
    return done;
  }

  window.CentralData={norm,plate,iso,ts,fmt,escapeHtml,getOSPlate,getOSNumber,getVehicleLabel,getClientLabel,activityTs,activityIso,normalizeEtapas,checklistSummary,isActive,osPieces,safeNF,safeCotacao,loadReads,markRead,seenAt,queryByTenant,loadReferenceData,listenOS,findOSByPlate,loadOperationalExtras,addEtapa,toggleEtapa};
})();
