'use strict';

(function(){
  const D=window.CentralData,A=window.CentralAuth;
  const $=id=>document.getElementById(id); let session=null,db=null,os=null,refs={vehicles:[],clients:[]},extras={nf:[],cotacoes:[]},unsub=null;
  function toast(msg){const e=document.createElement('div');e.className='toast';e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),2600);}
  const params=new URLSearchParams(location.search), requestedPlate=D.plate(params.get('placa')||''), requestedOs=params.get('os')||'';
  function showLogin(){ $('loginView').classList.remove('hidden');$('detailView').classList.add('hidden');$('loginUsr').value=A.lastUser();$('loginTarget').textContent=requestedPlate?`Acesso à viatura ${requestedPlate}`:'Acesso à Central de Viaturas'; }
  function showDetail(){ $('loginView').classList.add('hidden');$('detailView').classList.remove('hidden');$('userLabel').textContent=`${session.name} • ${session.role}`; }
  function getVehicle(){return refs.vehicles.find(v=>String(v.id)===String(os?.veiculoId||''))||os?.veiculoSnapshot||{};}
  function getClient(){return refs.clients.find(c=>String(c.id)===String(os?.clienteId||''))||os?.clienteSnapshot||{};}
  function currentPlate(){return D.getOSPlate(os,getVehicle())||requestedPlate||'SEMPLACA';}
  function renderRecados(){
    const list=D.normalizeEtapas(os?.etapasInternas), root=$('recados');
    $('recCount').textContent=`${list.filter(x=>!x.realizado).length} pendente(s)`;
    if(!list.length){root.innerHTML='<div class="empty">Nenhum recado interno registrado.</div>';return;}
    root.innerHTML=list.slice().reverse().map(i=>`<div class="row ${i.realizado?'done':''}"><div class="row-title">${i.realizado?'✓ ':'○ '}${D.escapeHtml(i.texto)}</div><div class="row-meta">${i.realizado?'Realizado por '+D.escapeHtml(i.realizadoPor||'equipe')+(i.realizadoEm?' • '+D.escapeHtml(D.fmt(i.realizadoEm)):''):'Registrado por '+D.escapeHtml(i.criadoPor||'equipe')+(i.criadoEm?' • '+D.escapeHtml(D.fmt(i.criadoEm)):'')}</div><div class="row-actions"><button class="btn" data-toggle="${D.escapeHtml(i.id)}">${i.realizado?'REABRIR':'MARCAR REALIZADO'}</button></div></div>`).join('');
    root.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await D.toggleEtapa(db,session,os.id,b.dataset.toggle);toast('Recado atualizado.');}catch(e){toast(e.message||'Não foi possível atualizar.');}finally{b.disabled=false;}}));
  }
  function renderChecklist(){
    const c=D.checklistSummary(os), root=$('checklist');
    if(!c.exists){root.innerHTML='<div class="empty">Ainda não existe checklist anexado nesta O.S.</div>';$('checkProgress').style.width='0%';$('checkLabel').textContent='Sem checklist';return;}
    const pct=Math.max(0,Math.min(100,Number(c.progresso??0)));$('checkProgress').style.width=pct+'%';$('checkLabel').textContent=`${pct}% • ${c.pendentes??0} pendente(s)${c.responsavel?' • '+c.responsavel:''}`;
    if(!c.criticos.length){root.innerHTML='<div class="row"><div class="row-title">Nenhum item crítico/pendente informado no resumo.</div></div>';return;}
    root.innerHTML=c.criticos.map(i=>`<div class="row"><div class="row-title">${D.escapeHtml(i.item||i.descricao||'Item')}</div><div class="row-meta">${D.escapeHtml(i.secao||'Checklist')} • ${D.escapeHtml(i.acaoLabel||i.acao||'Atenção')}${i.obs?' • '+D.escapeHtml(i.obs):''}</div></div>`).join('');
  }
  function renderPieces(){
    const pieces=D.osPieces(os), root=$('pieces');
    if(!pieces.length){root.innerHTML='<div class="empty">Nenhuma peça operacional registrada diretamente nesta O.S.</div>';return;}
    root.innerHTML=pieces.map(p=>`<div class="row"><div class="row-title">${D.escapeHtml(p.descricao||p.codigo)}</div><div class="row-meta">${p.codigo?'Cód. '+D.escapeHtml(p.codigo)+' • ':''}Qtd. ${D.escapeHtml(p.qtd)}${p.status?' • '+D.escapeHtml(p.status):''}</div></div>`).join('');
  }
  function renderNF(){
    const root=$('purchased');
    if(!extras.nf.length){root.innerHTML='<div class="empty">Nenhum vínculo de nota/peça acessível para esta O.S. neste perfil.</div>';return;}
    root.innerHTML=extras.nf.map(p=>`<div class="row"><div class="row-title">${D.escapeHtml(p.descricao||p.codigo)}</div><div class="row-meta">${p.codigo?'Cód. '+D.escapeHtml(p.codigo)+' • ':''}Qtd. ${D.escapeHtml(p.qtd||'-')}${p.fornecedor?' • '+D.escapeHtml(p.fornecedor):''}${p.nfNumero?' • NF '+D.escapeHtml(p.nfNumero):''}${p.finalidade?' • '+D.escapeHtml(p.finalidade):''}</div></div>`).join('');
  }
  function renderCotacoes(){
    const root=$('quotes');
    if(!extras.cotacoes.length){root.innerHTML='<div class="empty">Nenhuma cotação do Firebase acessível para esta O.S. neste perfil. A integração do COTAR local continua separada até a sincronização central.</div>';return;}
    root.innerHTML=extras.cotacoes.map(c=>`<div class="row"><div class="row-title">Cotação ${D.escapeHtml(c.status||'registrada')}</div><div class="row-meta">${c.itens.length} item(ns)${c.createdAt?' • '+D.escapeHtml(D.fmt(c.createdAt)):''}</div>${c.itens.slice(0,8).map(i=>`<div class="row-meta">• ${D.escapeHtml(i.descricao||i.codigo)}${i.qtd?' — qtd. '+D.escapeHtml(i.qtd):''}</div>`).join('')}</div>`).join('');
  }
  function renderTimeline(){
    const ev=[];D.normalizeEtapas(os?.etapasInternas).forEach(i=>ev.push({t:D.ts(i.realizadoEm||i.criadoEm),title:i.realizado?'Recado realizado':'Recado registrado',text:i.texto+' • '+(i.realizado?i.realizadoPor:i.criadoPor)}));
    const c=D.checklistSummary(os); if(c.exists) ev.push({t:D.ts(c.atualizadoEm),title:'Checklist atualizado',text:`${c.progresso??0}% • ${c.responsavel||'equipe'}`});
    extras.nf.forEach(i=>ev.push({t:D.ts(i.createdAt),title:'Peça vinculada/comprada',text:i.descricao||i.codigo}));
    extras.cotacoes.forEach(i=>ev.push({t:D.ts(i.createdAt),title:'Cotação registrada',text:`${i.itens.length} item(ns) • ${i.status||''}`}));
    ev.sort((a,b)=>b.t-a.t);$('timeline').innerHTML=ev.length?ev.slice(0,30).map(e=>`<div class="timeline-item"><b>${D.escapeHtml(e.title)}</b><span>${D.escapeHtml(e.text||'')}${e.t?' • '+D.escapeHtml(D.fmt(new Date(e.t))):''}</span></div>`).join(''):'<div class="empty">Sem eventos operacionais para mostrar.</div>';
  }
  function renderAll(){
    const v=getVehicle(),c=getClient(),p=currentPlate(),status=String(os?.status||os?.etapa||'Sem status');
    $('plate').textContent=p;$('vehicle').textContent=D.getVehicleLabel(os,v);$('osNumber').textContent=D.getOSNumber(os)||os.id;$('client').textContent=D.getClientLabel(os,c)||'—';$('status').textContent=status;
    renderChecklist();renderRecados();renderPieces();renderNF();renderCotacoes();renderTimeline();
    D.markRead(session,os.id,D.activityTs(os)||Date.now());
  }
  async function loadExtras(){extras=await D.loadOperationalExtras(db,session,os,currentPlate());renderNF();renderCotacoes();renderTimeline();}
  async function subscribe(){
    if(unsub)unsub();
    unsub=db.collection('ordens_servico').doc(os.id).onSnapshot(async snap=>{if(!snap.exists){toast('O.S. não encontrada.');return;}os={id:snap.id,...snap.data()};renderAll();await loadExtras();},e=>toast(e.message||'Falha na atualização em tempo real.'));
  }
  async function start(){
    session=A.loadSession(); if(!session){showLogin();return;} showDetail();db=A.activeDb(session);refs=await D.loadReferenceData(db,session);
    if(requestedOs){try{const snap=await db.collection('ordens_servico').doc(requestedOs).get();if(snap.exists)os={id:snap.id,...snap.data()};}catch(_){} }
    if(!os&&requestedPlate) os=await D.findOSByPlate(db,session,requestedPlate);
    if(!os){$('detailContent').innerHTML='<div class="empty">Não encontrei uma O.S. desta placa para a sua oficina.</div>';return;}
    renderAll();await loadExtras();await subscribe();
  }
  $('loginForm').addEventListener('submit',async ev=>{ev.preventDefault();$('loginErr').classList.add('hidden');$('btnLogin').disabled=true;$('btnLogin').textContent='Entrando...';try{session=await A.login($('loginUsr').value,$('loginPwd').value,$('remember').checked);showDetail();await start();}catch(e){$('loginErr').textContent=e.message||'Falha no login.';$('loginErr').classList.remove('hidden');}finally{$('btnLogin').disabled=false;$('btnLogin').textContent='ENTRAR';}});
  $('logout').addEventListener('click',async()=>{unsub?.();await A.logout();showLogin();});
  $('recadoForm').addEventListener('submit',async ev=>{ev.preventDefault();const text=$('recadoText').value.trim();if(!text)return;const btn=$('addRecado');btn.disabled=true;try{await D.addEtapa(db,session,os.id,text);$('recadoText').value='';toast('Recado registrado na O.S.');}catch(e){toast(e.message||'Não foi possível registrar.');}finally{btn.disabled=false;}});
  $('share').addEventListener('click',async()=>{const url=location.href;const text=`${currentPlate()} — acompanhar viatura\n${url}`;try{if(navigator.share)await navigator.share({title:`Viatura ${currentPlate()}`,text,url});else{await navigator.clipboard.writeText(text);toast('Link copiado.');}}catch(e){if(e.name!=='AbortError')toast('Não foi possível compartilhar.');}});
  $('whatsapp').addEventListener('click',()=>{const text=encodeURIComponent(`${currentPlate()} — ACOMPANHAR VIATURA\n${location.href}`);window.open(`https://wa.me/?text=${text}`,'_blank','noopener');});
  start().catch(e=>{console.error(e);toast(e.message||'Erro ao abrir a viatura.');});
})();
