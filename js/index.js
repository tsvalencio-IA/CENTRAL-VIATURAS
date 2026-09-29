'use strict';

(function(){
  const D=window.CentralData,A=window.CentralAuth,CFG=window.CENTRAL_CONFIG;
  let session=null,db=null,refs={vehicles:[],clients:[]},osList=[],unsub=null,filter='active';
  const $=id=>document.getElementById(id);
  function toast(msg){ const e=document.createElement('div');e.className='toast';e.textContent=msg;document.body.appendChild(e);setTimeout(()=>e.remove(),2600); }
  function showLogin(){ $('loginView').classList.remove('hidden');$('appView').classList.add('hidden');$('loginUsr').value=A.lastUser(); }
  function showApp(){ $('loginView').classList.add('hidden');$('appView').classList.remove('hidden');$('userLabel').textContent=`${session.name} • ${session.role}`;$('officeLabel').textContent=session.oficinaNome||'Oficina'; }
  function resolve(os){
    const vehicle=refs.vehicles.find(v=>String(v.id)===String(os.veiculoId||''))||os.veiculoSnapshot||{};
    const client=refs.clients.find(c=>String(c.id)===String(os.clienteId||''))||os.clienteSnapshot||{};
    const placa=D.getOSPlate(os,vehicle)||'SEMPLACA', activity=D.activityTs(os), key=os.id||placa, seen=D.seenAt(session,key), newer=activity>seen;
    const checklist=D.checklistSummary(os), etapas=D.normalizeEtapas(os.etapasInternas), pend=etapas.filter(e=>!e.realizado).length;
    return {os,vehicle,client,placa,activity,key,newer,checklist,etapas,pend};
  }
  function filtered(){
    const q=D.norm($('search').value||'');
    return osList.map(resolve).filter(x=>{
      if(filter==='active'&&!D.isActive(x.os)) return false;
      if(filter==='new'&&!x.newer) return false;
      if(q){ const hay=D.norm([x.placa,D.getVehicleLabel(x.os,x.vehicle),D.getClientLabel(x.os,x.client),D.getOSNumber(x.os),x.os.status].join(' ')); if(!hay.includes(q)) return false; }
      return true;
    }).sort((a,b)=>(Number(b.newer)-Number(a.newer))||(b.activity-a.activity));
  }
  function render(){
    const items=filtered(); const all=osList.map(resolve); const active=all.filter(x=>D.isActive(x.os)); const newer=all.filter(x=>x.newer); const waiting=active.filter(x=>x.pend>0);
    $('stActive').textContent=active.length;$('stNew').textContent=newer.length;$('stPend').textContent=waiting.length;$('stTotal').textContent=all.length;
    const root=$('cards');
    if(!items.length){root.innerHTML='<div class="empty">Nenhuma viatura encontrada neste filtro.</div>';return;}
    root.innerHTML=items.map(x=>{
      const status=String(x.os.status||x.os.etapa||'Sem status'); const vehicle=D.getVehicleLabel(x.os,x.vehicle); const osn=D.getOSNumber(x.os)||x.os.id; const client=D.getClientLabel(x.os,x.client);
      const check=x.checklist.exists?`Checklist ${x.checklist.progresso==null?'registrado':x.checklist.progresso+'%'}`:'Sem checklist';
      const href=`viatura.html?placa=${encodeURIComponent(x.placa)}&os=${encodeURIComponent(x.os.id)}`;
      return `<article class="vehicle-card ${x.newer?'new':''}" data-href="${href}">${x.newer?'<span class="new-dot"></span>':''}<div class="plate">${D.escapeHtml(x.placa)}</div><div class="vehicle">${D.escapeHtml(vehicle)}</div><div class="meta">O.S. ${D.escapeHtml(osn)}${client?' • '+D.escapeHtml(client):''}<br>${D.escapeHtml(status)}${x.activity?' • Atualizado '+D.escapeHtml(D.fmt(new Date(x.activity))):''}</div><div class="chips"><span class="chip ${x.checklist.exists?'ok':''}">${D.escapeHtml(check)}</span>${x.pend?`<span class="chip warn">${x.pend} recado(s) pendente(s)</span>`:'<span class="chip ok">Sem recado pendente</span>'}${x.newer?'<span class="chip new">NOVIDADE</span>':''}</div></article>`;
    }).join('');
    root.querySelectorAll('[data-href]').forEach(el=>el.addEventListener('click',()=>location.href=el.dataset.href));
  }
  async function start(){
    session=A.loadSession(); if(!session){showLogin();return;} showApp(); db=A.activeDb(session); $('cards').innerHTML='<div class="empty skeleton">Carregando viaturas em tempo real...</div>';
    try{ refs=await D.loadReferenceData(db,session); }catch(e){ console.warn(e); }
    unsub=D.listenOS(db,session,list=>{osList=list;render();},err=>{ $('cards').innerHTML=`<div class="empty">Não foi possível ler as O.S.: ${D.escapeHtml(err.message||'erro de acesso')}</div>`; });
  }
  $('loginForm').addEventListener('submit',async ev=>{ev.preventDefault();$('loginErr').classList.add('hidden');$('btnLogin').disabled=true;$('btnLogin').textContent='Entrando...';try{session=await A.login($('loginUsr').value,$('loginPwd').value,$('remember').checked);showApp();await start();}catch(e){$('loginErr').textContent=e.message||'Falha no login.';$('loginErr').classList.remove('hidden');}finally{$('btnLogin').disabled=false;$('btnLogin').textContent='ENTRAR';}});
  $('logout').addEventListener('click',async()=>{unsub?.();await A.logout();showLogin();});
  $('search').addEventListener('input',render);
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');filter=btn.dataset.filter;render();}));
  window.addEventListener('pageshow',()=>{if(session&&osList.length)render();});
  start();
})();
