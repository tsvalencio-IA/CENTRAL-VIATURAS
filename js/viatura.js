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
      el.innerHTML='<b>Gestor / gerente / admin:</b> pode registrar peça realmente trocada, marcar serviço executado e registrar compra. As peças exibidas vêm somente do controle real da O.S., nunca da lista de peças orçadas.';
    }else{
      badge.textContent='EQUIPE';
      badge.className='permission-badge team';
      el.innerHTML='<b>Equipe:</b> pode registrar peça realmente trocada e marcar serviço executado. A marcação de compra fica disponível somente para gestão.';
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
    const c=D.checklistSummary(os),root=$('checklist');
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

  function renderOperational(){
    renderPermission();
    const root=$('operationalItems');
    const items=D.operationalItems(os);
    if(!items.length){
      root.innerHTML='<div class="empty">Nenhum serviço da O.S. ou peça realmente trocada foi encontrado.</div>';
      return;
    }
    const gestor=D.isManager(session);
    root.innerHTML=items.map(item=>{
      const execStatus=String(item.execucao?.status||'pendente');
      const done=item.real===true ? true : D.executionFinished(execStatus);
      const bought=item.tipo==='peca'&&(item.compra?.comprado===true||item.compraFiscal===true);
      const boughtSource=item.compraFiscal===true?'NF vinculada':(item.compra?.comprado===true?'Gestão':'');
      const disabled=item.approvalExists&&!item.aprovado;
      const execClass=done?'btn success':'btn primary';
      const approvalChip=item.real?'':(disabled?'<span class="state-chip warn">NÃO APROVADO</span>':(item.approvalExists?'<span class="state-chip ok">APROVADO</span>':''));
      const execChip=item.real
        ? '<span class="state-chip ok">TROCADA REAL</span>'
        : (done?'<span class="state-chip ok">EXECUTADO</span>':'<span class="state-chip">PENDENTE</span>');
      const buyChip=item.tipo==='peca'?(bought?`<span class="state-chip bought">COMPRADA${boughtSource?' • '+D.escapeHtml(boughtSource):''}</span>`:'<span class="state-chip">COMPRA NÃO INFORMADA</span>'):'';
      const buyButton=item.tipo==='peca'&&gestor
        ? `<button class="btn ${bought?'':'purchase'}" data-buy-key="${D.escapeHtml(item.key)}" data-bought="${bought?'1':'0'}">${bought?'DESMARCAR COMPRA':'MARCAR COMPRADA'}</button>`
        : '';
      const execButton=item.real
        ? ''
        : `<button class="${execClass}" data-exec-key="${D.escapeHtml(item.key)}" data-done="${done?'1':'0'}" ${disabled?'disabled title="Item não aprovado"':''}>${done?'REABRIR':'MARCAR EXECUTADO'}</button>`;
      return `
        <article class="op-row ${done?'is-done':''} ${disabled?'is-disabled':''}">
          <div class="op-main">
            <div class="op-type">${D.escapeHtml(item.labelTipo)}</div>
            <div class="op-title">${D.escapeHtml(item.descricao||item.codigo||item.key)}</div>
            <div class="op-meta">${item.codigo?'Cód. '+D.escapeHtml(item.codigo)+' • ':''}${item.tipo==='peca'?'Qtd. '+D.escapeHtml(item.qtd):'Execução operacional'}</div>
            <div class="op-statuses">${approvalChip}${execChip}${buyChip}</div>
            ${item.execucao?.atualizadoPor?`<div class="op-audit">Última execução: ${D.escapeHtml(item.execucao.atualizadoPor)}${item.execucao.atualizadoEm?' • '+D.escapeHtml(D.fmt(item.execucao.atualizadoEm)):''}</div>`:''}
            ${item.compra?.comprado&&item.compra?.compradoPor?`<div class="op-audit">Compra: ${D.escapeHtml(item.compra.compradoPor)}${item.compra.compradoEm?' • '+D.escapeHtml(D.fmt(item.compra.compradoEm)):''}</div>`:''}
          </div>
          <div class="op-actions">
            ${execButton}
            ${buyButton}
          </div>
        </article>`;
    }).join('');

    root.querySelectorAll('[data-exec-key]').forEach(btn=>btn.addEventListener('click',async()=>{
      const done=btn.dataset.done==='1';
      btn.disabled=true;
      try{
        await D.setExecutionState(db,session,os.id,btn.dataset.execKey,!done);
        toast(done?'Execução reaberta na O.S.':'Execução registrada diretamente na O.S.','ok');
      }catch(e){ toast(e.message||'Não foi possível atualizar a execução.','err'); }
      finally{ btn.disabled=false; }
    }));

    root.querySelectorAll('[data-buy-key]').forEach(btn=>btn.addEventListener('click',async()=>{
      const bought=btn.dataset.bought==='1';
      btn.disabled=true;
      try{
        await D.setPurchaseState(db,session,os.id,btn.dataset.buyKey,!bought);
        toast(bought?'Compra desmarcada na O.S.':'Peça marcada como comprada na O.S.','ok');
      }catch(e){ toast(e.message||'Não foi possível atualizar a compra.','err'); }
      finally{ btn.disabled=false; }
    }));
  }

  function renderPieces(){
    const pieces=D.osPieces(os),root=$('pieces');
    if(!pieces.length){
      root.innerHTML='<div class="empty">Nenhuma peça realmente trocada registrada no controle real desta O.S.</div>';
      return;
    }
    root.innerHTML=pieces.map(p=>`
      <div class="row">
        <div class="row-title">${D.escapeHtml(p.descricao||p.codigo)}</div>
        <div class="row-meta">${p.codigo?'Cód. '+D.escapeHtml(p.codigo)+' • ':''}Qtd. ${D.escapeHtml(p.qtd)}${p.fornecedor?' • '+D.escapeHtml(p.fornecedor):''}${p.nfNumero?' • NF '+D.escapeHtml(p.nfNumero):''}</div>
      </div>`).join('');
  }

  function renderNF(){
    const root=$('purchased');
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
    const root=$('quotes');
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
      registrou_peca_real_trocada:'Peça realmente trocada registrada'
    };
    return map[a]||'Atualização da Central';
  }

  function renderTimeline(){
    const ev=[];
    const report=D.reportEvents(os);
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
    const url=new URL('v.html',location.href);
    url.search='?'+encodeURIComponent(currentPlate());
    url.hash='';
    return url.toString();
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
  if(realPartForm) realPartForm.addEventListener('submit',async ev=>{
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

  document.querySelectorAll('[data-share]').forEach(btn=>btn.addEventListener('click',shareCurrent));
  document.querySelectorAll('[data-whatsapp]').forEach(btn=>btn.addEventListener('click',whatsappCurrent));

  start().catch(e=>{
    console.error(e);
    toast(e.message||'Erro ao abrir a viatura.','err');
  });
})();
