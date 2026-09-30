'use strict';

(function(){
  const D=window.CentralData,A=window.CentralAuth;
  const $=id=>document.getElementById(id);
  let session=null,db=null,os=null,refs={vehicles:[],clients:[]},extras={nf:[],cotacoes:[]},unsub=null;

  function toast(msg,type=''){
    const e=document.createElement('div');
    e.className='toast'+(type?' '+type:'');
    e.textContent=msg;
    document.body.appendChild(e);
    setTimeout(()=>e.remove(),2800);
  }

  const params=new URLSearchParams(location.search);
  const rawShortQuery=location.search && !location.search.includes('=') ? decodeURIComponent(location.search.slice(1)) : '';
  const requestedPlate=D.plate(params.get('placa')||params.get('p')||rawShortQuery||'');
  const requestedOs=params.get('os')||'';

  function showLogin(){
    $('loginView').classList.remove('hidden');
    $('detailView').classList.add('hidden');
    $('loginUsr').value=A.lastUser();
    $('loginTarget').textContent=requestedPlate?`Acesso à viatura ${requestedPlate}`:'Acesso à Central de Viaturas';
  }
  function showDetail(){
    $('loginView').classList.add('hidden');
    $('detailView').classList.remove('hidden');
    $('userLabel').textContent=`${session.name} • ${session.role}`;
  }
  function getVehicle(){
    return refs.vehicles.find(v=>String(v.id)===String(os?.veiculoId||''))||os?.veiculoSnapshot||{};
  }
  function getClient(){
    return refs.clients.find(c=>String(c.id)===String(os?.clienteId||''))||os?.clienteSnapshot||{};
  }
  function currentPlate(){
    return D.getOSPlate(os,getVehicle())||requestedPlate||'SEMPLACA';
  }

  function renderPermission(){
    const gestor=D.isManager(session);
    const el=$('permissionNote');
    const badge=$('permissionBadge');
    if(!el||!badge) return;
    if(gestor){
      badge.textContent='GESTÃO';
      badge.className='permission-badge manager';
      el.innerHTML='<b>Gestor / gerente / admin:</b> pode controlar execução, compras e informações gerenciais de peças da O.S.';
    }else{
      badge.textContent='EQUIPE';
      badge.className='permission-badge team';
      el.innerHTML='<b>Equipe:</b> pode atualizar serviços e itens do checklist. Informações gerenciais confidenciais de peças ficam ocultas neste perfil.';
    }
  }

  function renderRecados(){
    const list=D.normalizeEtapas(os?.etapasInternas),root=$('recados');
    $('recCount').textContent=`${list.filter(x=>!x.realizado).length} pendente(s)`;
    if(!list.length){
      root.innerHTML='<div class="empty">Nenhum recado interno registrado.</div>';
      return;
    }
    root.innerHTML=list.slice().reverse().map(i=>`
      <div class="row ${i.realizado?'done':''}">
        <div class="row-title">${i.realizado?'✓ ':'○ '}${D.escapeHtml(i.texto)}</div>
        <div class="row-meta">${i.realizado
          ? 'Realizado por '+D.escapeHtml(i.realizadoPor||'equipe')+(i.realizadoEm?' • '+D.escapeHtml(D.fmt(i.realizadoEm)):'')
          : 'Registrado por '+D.escapeHtml(i.criadoPor||'equipe')+(i.criadoEm?' • '+D.escapeHtml(D.fmt(i.criadoEm)):'')}</div>
        <div class="row-actions"><button class="btn compact" data-toggle-recado="${D.escapeHtml(i.id)}">${i.realizado?'REABRIR':'MARCAR REALIZADO'}</button></div>
      </div>`).join('');
    root.querySelectorAll('[data-toggle-recado]').forEach(b=>b.addEventListener('click',async()=>{
      b.disabled=true;
      try{
        await D.toggleEtapa(db,session,os.id,b.dataset.toggleRecado);
        toast('Recado atualizado na O.S.','ok');
      }catch(e){ toast(e.message||'Não foi possível atualizar.','err'); }
      finally{ b.disabled=false; }
    }));
  }

  function renderChecklist(){
    const panel=$('checklistSummaryPanel'),root=$('checklist');
    if(!D.isManager(session)){
      if(panel) panel.hidden=true;
      if(root) root.innerHTML='';
      return;
    }
    if(panel) panel.hidden=false;
    const c=D.checklistSummary(os);
    if(!c.exists){
      root.innerHTML='<div class="empty">Ainda não existe checklist anexado nesta O.S.</div>';
      $('checkProgress').style.width='0%';
      $('checkLabel').textContent='Sem checklist';
      return;
    }
    const pct=Math.max(0,Math.min(100,Number(c.progresso??0)));
    $('checkProgress').style.width=pct+'%';
    $('checkLabel').textContent=`${pct}% • ${c.pendentes??0} pendente(s)${c.responsavel?' • '+c.responsavel:''}`;
    if(!c.criticos.length){
      root.innerHTML='<div class="row"><div class="row-title">Nenhum item crítico/pendente informado no resumo.</div></div>';
      return;
    }
    root.innerHTML=c.criticos.map(i=>`
      <div class="row">
        <div class="row-title">${D.escapeHtml(i.item||i.descricao||'Item')}</div>
        <div class="row-meta">${D.escapeHtml(i.secao||'Checklist')} • ${D.escapeHtml(i.acaoLabel||i.acao||'Atenção')}${i.obs?' • '+D.escapeHtml(i.obs):''}</div>
      </div>`).join('');
  }


  function collapseStoreKey(id){ return 'CENTRAL_VIATURAS_COLLAPSE::'+id; }
  function isCollapsed(id){ return localStorage.getItem(collapseStoreKey(id))==='1'; }
  function setCollapsed(id,value){ localStorage.setItem(collapseStoreKey(id),value?'1':'0'); }

  function opGroup(id,title,subtitle,items,renderer,emptyText){
    const collapsed=isCollapsed(id);
    return '<section class="op-group '+(collapsed?'collapsed':'')+'" data-op-group="'+D.escapeHtml(id)+'">'+
      '<button type="button" class="op-group-head" data-collapse-group="'+D.escapeHtml(id)+'">'+
        '<span><b>'+D.escapeHtml(title)+'</b><small>'+D.escapeHtml(subtitle||'')+'</small></span>'+
        '<span class="op-group-count">'+items.length+'</span>'+
        '<span class="op-group-toggle">'+(collapsed?'EXPANDIR':'MINIMIZAR')+'</span>'+
      '</button>'+
      '<div class="op-group-body">'+
        (items.length?items.map(renderer).join(''):'<div class="empty compact-empty">'+D.escapeHtml(emptyText||'Nenhum item.')+'</div>')+
      '</div>'+
    '</section>';
  }

  function renderOSService(item){
    const execStatus=String(item.execucao?.status||'pendente');
    const done=D.executionFinished(execStatus);
    const disabled=item.approvalExists&&!item.aprovado;
    return '<article class="op-row '+(done?'is-done ':'')+(disabled?'is-disabled':'')+'">'+
      '<div class="op-main">'+
        '<div class="op-type">SERVIÇO DA O.S.</div>'+
        '<div class="op-title">'+D.escapeHtml(item.descricao||item.codigo||item.key)+'</div>'+
        '<div class="op-meta">'+(item.codigo?'Cód. '+D.escapeHtml(item.codigo)+' • ':'')+'Serviço cadastrado na O.S.</div>'+
        '<div class="op-statuses">'+
          (disabled?'<span class="state-chip warn">NÃO APROVADO</span>':(item.approvalExists?'<span class="state-chip ok">APROVADO</span>':''))+
          (done?'<span class="state-chip ok">EXECUTADO</span>':'<span class="state-chip">PENDENTE</span>')+
        '</div>'+
        (item.execucao?.atualizadoPor?'<div class="op-audit">Atualizado por '+D.escapeHtml(item.execucao.atualizadoPor)+(item.execucao.atualizadoEm?' • '+D.escapeHtml(D.fmt(item.execucao.atualizadoEm)):'')+'</div>':'')+
      '</div>'+
      '<div class="op-actions"><button class="btn '+(done?'success':'primary')+'" data-exec-key="'+D.escapeHtml(item.key)+'" data-done="'+(done?'1':'0')+'" '+(disabled?'disabled title="Item não aprovado"':'')+'>'+(done?'REABRIR':'MARCAR EXECUTADO')+'</button></div>'+
    '</article>';
  }

  function renderChecklistItem(item){
    const state=D.checklistExecution(os,item.key);
    const status=String(state.status||'pendente');
    const done=D.executionFinished(status)||status==='resolvido';
    const gestor=D.isManager(session);
    const purchase=gestor?D.checklistPurchase(os,item.key):{};
    const bought=gestor&&purchase?.comprado===true;
    const label=item.group==='peca'?'PEÇA A TROCAR':item.group==='servico'?'SERVIÇO A FAZER':'ATENÇÃO / OBSERVAR';
    const doneLabel=item.group==='peca'?(gestor?'TROCADA':'CONCLUÍDA'):item.group==='servico'?'EXECUTADO':'RESOLVIDO';
    const actionLabel=item.group==='peca'?(gestor?'MARCAR TROCADA':'MARCAR CONCLUÍDA'):item.group==='servico'?'MARCAR EXECUTADO':'MARCAR RESOLVIDO';
    const buyButton=item.group==='peca'&&gestor
      ? '<button class="btn '+(bought?'':'purchase')+'" data-check-buy-key="'+D.escapeHtml(item.key)+'" data-bought="'+(bought?'1':'0')+'">'+(bought?'DESMARCAR COMPRA':'MARCAR COMPRADA')+'</button>'
      : '';
    return '<article class="op-row '+(done?'is-done':'')+'">'+
      '<div class="op-main">'+
        '<div class="op-type">'+label+'</div>'+
        '<div class="op-title">'+D.escapeHtml(item.item||'Item')+'</div>'+
        '<div class="op-meta">'+D.escapeHtml(item.secao||'Checklist')+(item.acaoLabel?' • '+D.escapeHtml(item.acaoLabel):'')+(item.obs?' • '+D.escapeHtml(item.obs):'')+'</div>'+
        '<div class="op-statuses">'+
          (done?'<span class="state-chip ok">'+doneLabel+'</span>':'<span class="state-chip">PENDENTE</span>')+
          (item.group==='peca'&&gestor?(bought?'<span class="state-chip bought">COMPRADA</span>':'<span class="state-chip">COMPRA PENDENTE</span>'):'')+
        '</div>'+
        (state?.atualizadoPor?'<div class="op-audit">Execução: '+D.escapeHtml(state.atualizadoPor)+(state.atualizadoEm?' • '+D.escapeHtml(D.fmt(state.atualizadoEm)):'')+'</div>':'')+
        (gestor&&purchase?.compradoPor?'<div class="op-audit">Compra: '+D.escapeHtml(purchase.compradoPor)+(purchase.compradoEm?' • '+D.escapeHtml(D.fmt(purchase.compradoEm)):'')+'</div>':'')+
      '</div>'+
      '<div class="op-actions">'+
        '<button class="btn '+(done?'success':'primary')+'" data-check-exec-key="'+D.escapeHtml(item.key)+'" data-done="'+(done?'1':'0')+'">'+(done?'REABRIR':actionLabel)+'</button>'+
        buyButton+
      '</div>'+
    '</article>';
  }

  function managerPendingSummary(pendingOS,pp,ps,pa){
    const total=pendingOS.length+pp.pending.length+ps.pending.length+pa.pending.length;
    const bought=pp.pending.filter(x=>D.checklistPurchase(os,x.key)?.comprado===true).length;
    const buyPending=Math.max(0,pp.pending.length-bought);
    return '<div class="management-pending">'+
      '<div class="management-pending-title"><b>O QUE AINDA FALTA FAZER</b><span>'+total+' pendência(s)</span></div>'+
      '<div class="management-pending-grid">'+
        '<div><b>'+pendingOS.length+'</b><span>serviços da O.S.</span></div>'+
        '<div><b>'+pp.pending.length+'</b><span>peças a trocar</span></div>'+
        '<div><b>'+ps.pending.length+'</b><span>serviços do checklist</span></div>'+
        '<div><b>'+pa.pending.length+'</b><span>atenções</span></div>'+
        '<div><b>'+buyPending+'</b><span>peças com compra pendente</span></div>'+
      '</div>'+
    '</div>';
  }

  function renderOperational(){
    renderPermission();
    const root=$('operationalItems');
    const gestor=D.isManager(session);
    const osServices=D.operationalItems(os).filter(x=>x.tipo==='servico');
    const pendingOS=osServices.filter(x=>!D.executionFinished(String(x.execucao?.status||'pendente')));
    const doneOS=osServices.filter(x=>D.executionFinished(String(x.execucao?.status||'pendente')));

    const plan=D.checklistPlan(os);
    const split=(arr)=>({
      pending:arr.filter(x=>{
        const s=String(D.checklistExecution(os,x.key)?.status||'pendente');
        return !(D.executionFinished(s)||s==='resolvido');
      }),
      done:arr.filter(x=>{
        const s=String(D.checklistExecution(os,x.key)?.status||'pendente');
        return D.executionFinished(s)||s==='resolvido';
      })
    });
    const pp=split(plan.pecasTrocar), ps=split(plan.servicosExecutar), pa=split(plan.atencoes);

    if(gestor){
      const completed=[...doneOS,...pp.done,...ps.done,...pa.done];
      root.innerHTML=
        managerPendingSummary(pendingOS,pp,ps,pa)+
        opGroup('os-services','SERVIÇOS DA O.S.','Serviços cadastrados na própria ordem de serviço',pendingOS,renderOSService,'Nenhum serviço pendente da O.S.')+
        opGroup('check-parts','PEÇAS A TROCAR — CHECKLIST','Itens marcados como Trocar no CHECKLIS_SOS',pp.pending,renderChecklistItem,'Nenhuma peça marcada para troca no checklist.')+
        opGroup('check-services','SERVIÇOS A EXECUTAR — CHECKLIST','Retificar, regular, ajustar, lubrificar ou limpar',ps.pending,renderChecklistItem,'Nenhum serviço técnico pendente do checklist.')+
        opGroup('check-attention','ATENÇÕES / OBSERVAR — CHECKLIST','Itens marcados como Atenção ou Revisar',pa.pending,renderChecklistItem,'Nenhum item de atenção pendente.')+
        opGroup('completed','CONCLUÍDOS / EXECUTADOS','Itens concluídos saem das pendências e ficam aqui',completed,(item)=>item.group?renderChecklistItem(item):renderOSService(item),'Nenhum item concluído ainda.');
    }else{
      // Equipe vê somente o necessário para executar o trabalho.
      const completed=[...doneOS,...pp.done,...ps.done];
      root.innerHTML=
        opGroup('os-services','SERVIÇOS A FAZER','Serviços da ordem de serviço',pendingOS,renderOSService,'Nenhum serviço pendente.')+
        opGroup('check-parts','PEÇAS A TROCAR','Peças indicadas pelo CHECKLIS_SOS',pp.pending,renderChecklistItem,'Nenhuma peça pendente de troca.')+
        opGroup('check-services','SERVIÇOS DO CHECKLIST','Serviços técnicos indicados pelo CHECKLIS_SOS',ps.pending,renderChecklistItem,'Nenhum serviço técnico pendente.')+
        opGroup('completed','CONCLUÍDOS','Itens já concluídos pela equipe',completed,(item)=>item.group?renderChecklistItem(item):renderOSService(item),'Nenhum item concluído ainda.');
    }

    root.querySelectorAll('[data-collapse-group]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.dataset.collapseGroup;
      setCollapsed(id,!isCollapsed(id));
      renderOperational();
    }));

    root.querySelectorAll('[data-exec-key]').forEach(btn=>btn.addEventListener('click',async()=>{
      const done=btn.dataset.done==='1';
      btn.disabled=true;
      try{
        await D.setExecutionState(db,session,os.id,btn.dataset.execKey,!done);
        toast(done?'Serviço reaberto.':'Serviço marcado como executado.','ok');
      }catch(e){ toast(e.message||'Não foi possível atualizar a execução.','err'); }
      finally{ btn.disabled=false; }
    }));

    root.querySelectorAll('[data-check-exec-key]').forEach(btn=>btn.addEventListener('click',async()=>{
      const done=btn.dataset.done==='1';
      btn.disabled=true;
      try{
        const r=await D.setChecklistExecutionState(db,session,os.id,btn.dataset.checkExecKey,!done);
        const manager=D.isManager(session);
        const msg=r?.item?.group==='peca'
          ? (done?'Item reaberto.':(manager?'Controle da peça atualizado.':'Peça concluída.'))
          : r?.item?.group==='atencao'
            ? (done?'Atenção reaberta.':'Atenção marcada como resolvida.')
            : (done?'Serviço reaberto.':'Serviço executado.');
        toast(msg,'ok');
      }catch(e){ toast(e.message||'Não foi possível atualizar o checklist.','err'); }
      finally{ btn.disabled=false; }
    }));

    root.querySelectorAll('[data-check-buy-key]').forEach(btn=>btn.addEventListener('click',async()=>{
      const bought=btn.dataset.bought==='1';
      btn.disabled=true;
      try{
        await D.setChecklistPurchaseState(db,session,os.id,btn.dataset.checkBuyKey,!bought);
        toast(bought?'Compra reaberta.':'Peça marcada como comprada.','ok');
      }catch(e){ toast(e.message||'Não foi possível atualizar a compra.','err'); }
      finally{ btn.disabled=false; }
    }));
  }

  function printOperational(){
    const plan=D.checklistPlan(os);
    const osServices=D.operationalItems(os).filter(x=>x.tipo==='servico');
    const real=D.osPieces(os);
    const rows=(title,items,kind)=> {
      const body=items.map(item=>{
        let desc='',meta='',status='';
        if(kind==='os'){
          desc=item.descricao||'Serviço';
          meta='Serviço da O.S.';
          status=D.executionFinished(String(item.execucao?.status||''))?'EXECUTADO':'PENDENTE';
        }else if(kind==='real'){
          desc=item.descricao||item.codigo||'Peça';
          meta='Peça realmente trocada';
          status='TROCADA';
        }else{
          desc=item.item||'Item';
          meta=(item.secao||'Checklist')+(item.acaoLabel?' • '+item.acaoLabel:'');
          const st=String(D.checklistExecution(os,item.key)?.status||'pendente');
          status=D.executionFinished(st)||st==='resolvido'?(item.group==='peca'?'TROCADA':item.group==='atencao'?'RESOLVIDO':'EXECUTADO'):'PENDENTE';
          if(item.group==='peca' && D.checklistPurchase(os,item.key)?.comprado) status+=' • COMPRADA';
        }
        return '<tr><td>'+D.escapeHtml(desc)+'</td><td>'+D.escapeHtml(meta)+'</td><td>'+D.escapeHtml(status)+'</td></tr>';
      }).join('');
      return '<h2>'+D.escapeHtml(title)+'</h2><table><thead><tr><th>Item</th><th>Origem / ação</th><th>Status</th></tr></thead><tbody>'+(body||'<tr><td colspan="3">Nenhum item</td></tr>')+'</tbody></table>';
    };

    const w=window.open('','_blank');
    if(!w){ toast('O navegador bloqueou a janela de impressão.','err'); return; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório operacional '+D.escapeHtml(currentPlate())+'</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;color:#111;font-size:11px}h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 5px}p{margin:2px 0 10px;color:#444}table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #bbb;padding:5px;text-align:left;vertical-align:top}th{background:#eee}.footer{margin-top:18px;text-align:center;font-size:9px;color:#666}</style></head><body>'+
      '<h1>RELATÓRIO OPERACIONAL DA VIATURA '+D.escapeHtml(currentPlate())+'</h1>'+
      '<p>O.S. '+D.escapeHtml(D.getOSNumber(os)||os.id)+' • '+D.escapeHtml(D.getVehicleLabel(os,getVehicle()))+' • Impresso em '+D.escapeHtml(new Date().toLocaleString('pt-BR'))+'</p>'+
      rows('SERVIÇOS DA O.S.',osServices,'os')+
      rows('PEÇAS A TROCAR — CHECKLIST',plan.pecasTrocar,'check')+
      rows('SERVIÇOS A EXECUTAR — CHECKLIST',plan.servicosExecutar,'check')+
      (D.isManager(session)?rows('ATENÇÕES / OBSERVAR — CHECKLIST',plan.atencoes,'check'):'')+
      (D.isManager(session)?rows('CONTROLE GERENCIAL DE PEÇAS',real,'real'):'')+
      '<div class="footer">Powered by thIAguinho Soluções Digitais</div></body></html>');
    w.document.close();
    setTimeout(()=>w.print(),250);
  }


  function renderPieces(){
    const panel=$('realPartsPanel');
    const root=$('pieces');
    if(!D.isManager(session)){
      if(panel) panel.hidden=true;
      if(root) root.innerHTML='';
      return;
    }
    if(panel) panel.hidden=false;
    const pieces=D.osPieces(os);
    if(!pieces.length){
      root.innerHTML='<div class="empty">Nenhum registro gerencial de peça nesta O.S.</div>';
      return;
    }
    root.innerHTML=pieces.map(p=>`
      <div class="row">
        <div class="row-title">${D.escapeHtml(p.descricao||p.codigo)}</div>
        <div class="row-meta">${p.codigo?'Cód. '+D.escapeHtml(p.codigo)+' • ':''}Qtd. ${D.escapeHtml(p.qtd)}${p.fornecedor?' • '+D.escapeHtml(p.fornecedor):''}${p.nfNumero?' • NF '+D.escapeHtml(p.nfNumero):''}</div>
      </div>`).join('');
  }

  function renderNF(){
    const panel=$('managerNfPanel'),root=$('purchased');
    if(!D.isManager(session)){ if(panel) panel.hidden=true; if(root) root.innerHTML=''; return; }
    if(panel) panel.hidden=false;
    if(!extras.nf.length){
      root.innerHTML='<div class="empty">Nenhum vínculo de nota/peça acessível para esta O.S. neste perfil.</div>';
      return;
    }
    root.innerHTML=extras.nf.map(p=>`
      <div class="row">
        <div class="row-title">${D.escapeHtml(p.descricao||p.codigo)}</div>
        <div class="row-meta">${p.codigo?'Cód. '+D.escapeHtml(p.codigo)+' • ':''}Qtd. ${D.escapeHtml(p.qtd||'-')}${p.fornecedor?' • '+D.escapeHtml(p.fornecedor):''}${p.nfNumero?' • NF '+D.escapeHtml(p.nfNumero):''}${p.finalidade?' • '+D.escapeHtml(p.finalidade):''}</div>
      </div>`).join('');
  }

  function renderCotacoes(){
    const panel=$('managerQuotesPanel'),root=$('quotes');
    if(!D.isManager(session)){ if(panel) panel.hidden=true; if(root) root.innerHTML=''; return; }
    if(panel) panel.hidden=false;
    if(!extras.cotacoes.length){
      root.innerHTML='<div class="empty">Nenhuma cotação compartilhada encontrada para esta O.S. O COTAR local continua preservado até a sincronização central.</div>';
      return;
    }
    root.innerHTML=extras.cotacoes.map(c=>`
      <div class="row">
        <div class="row-title">Cotação ${D.escapeHtml(c.status||'registrada')}</div>
        <div class="row-meta">${c.itens.length} item(ns)${c.createdAt?' • '+D.escapeHtml(D.fmt(c.createdAt)):''}</div>
        ${c.itens.slice(0,8).map(i=>`<div class="row-meta">• ${D.escapeHtml(i.descricao||i.codigo)}${i.qtd?' — qtd. '+D.escapeHtml(i.qtd):''}</div>`).join('')}
      </div>`).join('');
  }

  function reportTitle(e){
    const a=String(e?.acao||'');
    const map={
      marcou_peca_trocada:'Peça marcada como trocada',
      marcou_servico_executado:'Serviço marcado como executado',
      reabriu_execucao:'Execução reaberta',
      marcou_peca_comprada:'Peça marcada como comprada',
      desmarcou_peca_comprada:'Compra desmarcada',
      registrou_recado:'Recado registrado',
      concluiu_recado:'Recado concluído',
      reabriu_recado:'Recado reaberto',
      registrou_peca_real_trocada:'Peça realmente trocada registrada',
      concluiu_item_checklist:'Item do checklist concluído',
      reabriu_item_checklist:'Item do checklist reaberto',
      marcou_peca_checklist_comprada:'Peça do checklist marcada como comprada',
      reabriu_compra_peca_checklist:'Compra do checklist reaberta'
    };
    return map[a]||'Atualização da Central';
  }

  function renderTimeline(){
    const ev=[];
    const manager=D.isManager(session);
    const report=D.reportEvents(os).filter(e=>{
      if(manager) return true;
      const a=String(e?.acao||'');
      if(['registrou_peca_real_trocada','marcou_peca_trocada','marcou_peca_comprada','desmarcou_peca_comprada','marcou_peca_checklist_comprada','reabriu_compra_peca_checklist'].includes(a)) return false;
      return true;
    });
    report.forEach(e=>ev.push({
      t:D.ts(e.data),
      title:reportTitle(e),
      text:[e.descricao||e.texto||'',e.usuario||'',e.perfil||''].filter(Boolean).join(' • ')
    }));

    const c=D.checklistSummary(os);
    if(c.exists) ev.push({
      t:D.ts(c.atualizadoEm),
      title:'Checklist atualizado',
      text:`${c.progresso??0}% • ${c.responsavel||'equipe'}`
    });

    extras.nf.forEach(i=>ev.push({
      t:D.ts(i.createdAt),
      title:'Peça vinculada por NF',
      text:[i.descricao||i.codigo,i.fornecedor,i.nfNumero?`NF ${i.nfNumero}`:''].filter(Boolean).join(' • ')
    }));
    extras.cotacoes.forEach(i=>ev.push({
      t:D.ts(i.createdAt),
      title:'Cotação registrada',
      text:`${i.itens.length} item(ns) • ${i.status||''}`
    }));

    if(!report.length){
      D.normalizeEtapas(os?.etapasInternas).forEach(i=>ev.push({
        t:D.ts(i.realizadoEm||i.criadoEm),
        title:i.realizado?'Recado realizado':'Recado registrado',
        text:i.texto+' • '+(i.realizado?i.realizadoPor:i.criadoPor)
      }));
    }

    ev.sort((a,b)=>b.t-a.t);
    $('timeline').innerHTML=ev.length
      ? ev.slice(0,60).map(e=>`<div class="timeline-item"><b>${D.escapeHtml(e.title)}</b><span>${D.escapeHtml(e.text||'')}${e.t?' • '+D.escapeHtml(D.fmt(new Date(e.t))):''}</span></div>`).join('')
      : '<div class="empty">Sem eventos operacionais para mostrar.</div>';
  }

  function renderAll(){
    const v=getVehicle(),c=getClient(),p=currentPlate(),status=String(os?.status||os?.etapa||'Sem status');
    $('plate').textContent=p;
    $('vehicle').textContent=D.getVehicleLabel(os,v);
    $('osNumber').textContent=D.getOSNumber(os)||os.id;
    $('client').textContent=D.getClientLabel(os,c)||'—';
    $('status').textContent=status;
    renderOperational();
    renderChecklist();
    renderRecados();
    renderPieces();
    renderNF();
    renderCotacoes();
    renderTimeline();
    D.markRead(session,os.id,D.activityTs(os)||Date.now());
  }

  async function loadExtras(){
    extras=await D.loadOperationalExtras(db,session,os,currentPlate());
    renderNF();
    renderCotacoes();
    renderTimeline();
  }

  async function subscribe(){
    if(unsub) unsub();
    unsub=db.collection('ordens_servico').doc(os.id).onSnapshot(async snap=>{
      if(!snap.exists){ toast('O.S. não encontrada.','err'); return; }
      os={id:snap.id,...snap.data()};
      renderAll();
      await loadExtras();
    },e=>toast(e.message||'Falha na atualização em tempo real.','err'));
  }

  async function start(){
    session=A.loadSession();
    if(!session){ showLogin(); return; }
    showDetail();
    db=A.activeDb(session);
    refs=await D.loadReferenceData(db,session);

    if(requestedOs){
      try{
        const snap=await db.collection('ordens_servico').doc(requestedOs).get();
        if(snap.exists) os={id:snap.id,...snap.data()};
      }catch(_){}
    }
    if(!os&&requestedPlate) os=await D.findOSByPlate(db,session,requestedPlate);
    if(!os){
      $('detailContent').innerHTML='<div class="empty">Não encontrei uma O.S. desta placa para a sua oficina.</div>';
      return;
    }
    renderAll();
    await loadExtras();
    await subscribe();
  }

  function shareUrl(){
    return 'https://viaturas.vercel.app/p/'+encodeURIComponent(currentPlate())+'?v=143';
  }

  function shareMessage(){
    return `ATUALIZAÇÃO PLACA "${currentPlate()}" ${shareUrl()}`;
  }

  async function shareCurrent(){
    const url=shareUrl();
    const text=shareMessage();
    try{
      if(navigator.share) await navigator.share({title:`🚙 ${currentPlate()} — Central de Viaturas`,text,url});
      else{
        await navigator.clipboard.writeText(text);
        toast('Link da placa copiado.','ok');
      }
    }catch(e){
      if(e.name!=='AbortError') toast('Não foi possível compartilhar.','err');
    }
  }

  function whatsappCurrent(){
    const text=encodeURIComponent(shareMessage());
    window.open(`https://wa.me/?text=${text}`,'_blank','noopener');
  }

  $('loginForm').addEventListener('submit',async ev=>{
    ev.preventDefault();
    $('loginErr').classList.add('hidden');
    $('btnLogin').disabled=true;
    $('btnLogin').textContent='Entrando...';
    try{
      session=await A.login($('loginUsr').value,$('loginPwd').value,$('remember').checked);
      showDetail();
      await start();
    }catch(e){
      $('loginErr').textContent=e.message||'Falha no login.';
      $('loginErr').classList.remove('hidden');
    }finally{
      $('btnLogin').disabled=false;
      $('btnLogin').textContent='ENTRAR';
    }
  });

  document.querySelectorAll('[data-logout]').forEach(btn=>btn.addEventListener('click',async()=>{
    unsub?.();
    await A.logout();
    showLogin();
  }));

  const realPartForm=$('realPartForm');
  if(realPartForm){
    if(!D.isManager(session)) realPartForm.closest('#realPartsPanel')?.setAttribute('hidden','');
    realPartForm.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const descricao=$('realPartDesc')?.value?.trim()||'';
    const codigo=$('realPartCode')?.value?.trim()||'';
    const qtd=Number($('realPartQty')?.value||1)||1;
    const btn=$('addRealPart');
    if(btn) btn.disabled=true;
    try{
      await D.addRealPart(db,session,os.id,{descricao,codigo,qtd});
      if($('realPartDesc')) $('realPartDesc').value='';
      if($('realPartCode')) $('realPartCode').value='';
      if($('realPartQty')) $('realPartQty').value='1';
      toast('Peça registrada como realmente trocada na própria O.S.','ok');
    }catch(e){
      toast(e.message||'Não foi possível registrar a peça trocada.','err');
    }finally{
      if(btn) btn.disabled=false;
    }
    });
  }

  $('recadoForm').addEventListener('submit',async ev=>{
    ev.preventDefault();
    const text=$('recadoText').value.trim();
    if(!text) return;
    const btn=$('addRecado');
    btn.disabled=true;
    try{
      await D.addEtapa(db,session,os.id,text);
      $('recadoText').value='';
      toast('Recado registrado diretamente na O.S.','ok');
    }catch(e){ toast(e.message||'Não foi possível registrar.','err'); }
    finally{ btn.disabled=false; }
  });

  document.querySelectorAll('[data-print-operational]').forEach(btn=>btn.addEventListener('click',printOperational));
  document.querySelectorAll('[data-share]').forEach(btn=>btn.addEventListener('click',shareCurrent));
  document.querySelectorAll('[data-whatsapp]').forEach(btn=>btn.addEventListener('click',whatsappCurrent));

  start().catch(e=>{
    console.error(e);
    toast(e.message||'Erro ao abrir a viatura.','err');
  });
})();
