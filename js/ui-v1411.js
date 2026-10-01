'use strict';
(function(){
  const locks=new Set();
  const C=c=>{if(!c||!c.D) throw new Error('Contexto operacional indisponível.'); return c;};
  const plan=c=>c.D.buildWorkPlan(c.os,c.getClient(),c.session);

  function renderPermission(c){
    c=C(c); const {D,$,os,session}=c, manager=D.isManager(session), official=D.isOfficialClient(os,c.getClient());
    const el=$('permissionNote'), badge=$('permissionBadge'); if(!el||!badge) return;
    badge.textContent=manager?'GESTÃO':'EQUIPE'; badge.className='permission-badge '+(manager?'manager':'team');
    if(official){
      el.innerHTML=manager
        ? '<b>CLIENTE OFICIAL:</b> peças e serviços Cilia/O.S. + compras. Compra vinculada não significa peça trocada.'
        : '<b>CLIENTE OFICIAL:</b> somente peças Cilia da O.S.; sem NF, fornecedor, marca, código de compra ou informação comercial.';
    }else{
      el.innerHTML=manager
        ? '<b>GESTÃO:</b> fila completa, impedimentos e compras. Dados comerciais ficam restritos à gestão.'
        : '<b>EQUIPE:</b> somente o que precisa ser trocado ou executado.';
    }
  }

  function renderChecklist(c){
    c=C(c); const {D,$,os,session}=c, panel=$('checklistSummaryPanel'),root=$('checklist'); if(!panel||!root) return;
    panel.hidden=false; const s=D.checklistSummary(os);
    if(!s.exists){root.innerHTML='<div class="empty">Sem checklist salvo nesta O.S.</div>'; $('checkProgress').style.width='0%'; $('checkLabel').textContent='Sem checklist salvo'; return;}
    const pct=Math.max(0,Math.min(100,Number(s.progresso||0))); $('checkProgress').style.width=pct+'%'; $('checkLabel').textContent=pct+'% • '+(s.pendentes||0)+' pendente(s)';
    const cp=D.checklistPlan(os), all=[...cp.pecasTrocar,...cp.servicosExecutar,...cp.atencoes];
    if(!D.isManager(session)){
      root.innerHTML=all.length?all.map(i=>'<div class="row checklist-reference-row"><div class="row-title">'+D.escapeHtml(i.item||'Item')+'</div><div class="row-meta">'+D.escapeHtml(i.secao||'Checklist')+' • '+D.escapeHtml(i.acaoLabel||i.acao||'')+'</div>'+(i.obs?'<div class="row-meta">OBS: '+D.escapeHtml(i.obs)+'</div>':'')+'</div>').join(''):'<div class="empty">Checklist sem itens de atenção/troca/serviço.</div>';
      return;
    }
    const cmp=D.checklistComparison(os,plan(c));
    const box=(title,items,kind)=>'<div class="compare-box '+kind+'"><b>'+title+'</b><span>'+items.length+'</span>'+(items.length?items.slice(0,25).map(x=>'<small>'+D.escapeHtml(kind==='matched'?(x.check?.item||''):kind==='checkonly'?(x.item||''):(x.descricao||''))+'</small>').join(''):'<small>Nenhum item.</small>')+'</div>';
    root.innerHTML='<div class="compare-grid">'+box('CHECKLIST + O.S./CILIA',cmp.matched,'matched')+box('SÓ NO CHECKLIST',cmp.checklistOnly,'checkonly')+box('SÓ NA O.S./CILIA',cmp.workOnly,'workonly')+'</div><div class="panel-sub compare-note">Comparação informativa. O checklist não altera a fila automaticamente e não modifica o CHECKLIS_SOS.</div>';
  }

  function group(c,id,title,subtitle,items,renderer,empty,kind){
    const {D}=c, collapsed=c.isCollapsed(id);
    return '<section class="op-group '+(kind||'')+' '+(collapsed?'collapsed':'')+'" data-op-group="'+D.escapeHtml(id)+'"><button type="button" class="op-group-head" data-collapse-group="'+D.escapeHtml(id)+'"><span><b>'+D.escapeHtml(title)+'</b><small>'+D.escapeHtml(subtitle||'')+'</small></span><span class="op-group-count">'+items.length+'</span><span class="op-group-toggle">'+(collapsed?'EXPANDIR':'MINIMIZAR')+'</span></button><div class="op-group-body">'+(items.length?items.map(renderer).join(''):'<div class="empty compact-empty">'+D.escapeHtml(empty)+'</div>')+'</div></section>';
  }

  function row(c,item){
    const {D,session,os}=c, manager=D.isManager(session), done=D.doneStatus(item.status), blocked=D.blockedStatus(item.status), progress=D.inProgressStatus(item.status);
    const purchase=manager&&item.tipo==='peca'?D.purchaseLinkForWork(os,item.key):null;
    const cls=done?'ok':blocked?'danger':progress?'progress':'pending';
    let buttons='';
    if(done) buttons='<button class="btn compact" data-work-action="pendente" data-work-key="'+D.escapeHtml(item.key)+'">REABRIR</button>';
    else if(blocked) buttons='<button class="btn compact" data-work-action="pendente" data-work-key="'+D.escapeHtml(item.key)+'">REABRIR</button><button class="btn success compact" data-work-action="done" data-work-key="'+D.escapeHtml(item.key)+'">CONCLUÍDO</button>';
    else buttons=(progress?'':'<button class="btn compact" data-work-action="em_execucao" data-work-key="'+D.escapeHtml(item.key)+'">INICIAR</button>')+'<button class="btn success compact" data-work-action="done" data-work-key="'+D.escapeHtml(item.key)+'">CONCLUÍDO</button><button class="btn danger compact" data-work-action="impedido" data-work-key="'+D.escapeHtml(item.key)+'">NÃO RESOLVEU</button>';
    return '<article class="op-row '+(done?'is-done ':'')+(blocked?'is-blocked ':'')+(progress?'is-progress ':'')+'"><div class="op-main"><div class="op-type">ORIGEM: '+D.escapeHtml(item.source)+' • '+(item.tipo==='peca'?'PEÇA':'SERVIÇO')+'</div><div class="op-title">'+D.escapeHtml(item.descricao||item.codigo||item.key)+'</div><div class="op-meta">'+(manager&&item.codigo?'<span>Cód. '+D.escapeHtml(item.codigo)+'</span>':'')+(item.tipo==='peca'&&item.qtd?'<span>Qtd. '+D.escapeHtml(item.qtd)+'</span>':'')+'</div><div class="op-statuses"><span class="state-chip '+cls+'">'+D.escapeHtml(D.statusLabel(item.status,item.tipo))+'</span>'+(purchase?'<span class="state-chip bought">COMPRA VINCULADA</span>':'')+'</div>'+(item.state?.obs?'<div class="work-note"><b>OBS:</b> '+D.escapeHtml(item.state.obs)+'</div>':'')+(item.state?.atualizadoPor?'<div class="op-audit">Atualizado por '+D.escapeHtml(item.state.atualizadoPor)+'</div>':'')+'</div><div class="op-actions">'+buttons+'</div></article>';
  }

  function summary(c,p){
    const {D,session,os}=c, manager=D.isManager(session), activePieces=p.pieces.filter(x=>!D.doneStatus(x.status));
    if(!manager){
      const parts=activePieces.length, services=p.services.filter(x=>!D.doneStatus(x.status)).length;
      return '<div class="management-pending team-focus"><div class="management-pending-title"><b>FOCO AGORA — SÓ O QUE EXIGE AÇÃO</b><span>'+(parts+services)+' item(ns)</span></div><div class="management-pending-grid team-grid"><div><b>'+parts+'</b><span>peças a trocar</span></div><div><b>'+services+'</b><span>serviços a fazer</span></div><div class="warn-card"><b>'+p.blocked.length+'</b><span>impedimentos</span></div></div><div class="focus-note">Concluiu? O item desce automaticamente para o histórico.</div></div>';
    }
    const linked=activePieces.filter(x=>D.purchaseLinkForWork(os,x.key)).length, unlinked=activePieces.length-linked;
    return '<div class="management-pending"><div class="management-pending-title"><b>CONTROLE PARA NÃO ESQUECER NADA</b><span>'+(p.all.length-p.done.length)+' ação(ões) aberta(s)</span></div><div class="management-pending-grid"><div><b>'+p.pending.length+'</b><span>pendentes</span></div><div><b>'+p.progress.length+'</b><span>em execução</span></div><div class="warn-card"><b>'+p.blocked.length+'</b><span>impedimentos</span></div><div><b>'+unlinked+'</b><span>peças sem compra vinculada</span></div><div><b>'+linked+'</b><span>compradas aguardando execução</span></div></div><div class="focus-note">Compra e execução são controles separados.</div></div>';
  }

  async function change(c,item,action,obs){
    if(!item||locks.has(item.key)) return; locks.add(item.key);
    document.querySelectorAll('[data-work-key="'+CSS.escape(item.key)+'"]').forEach(b=>b.disabled=true);
    try{
      const next=action==='done'?(item.tipo==='peca'?'trocada':'executado'):action;
      const r=await c.D.setWorkState(c.db,c.session,c.os.id,item,next,obs||'');
      c.toast(r?.unchanged?'Nada mudou.':next==='impedido'?'Impedimento registrado.':next==='pendente'?'Item reaberto.':next==='em_execucao'?'Item em execução.':'Concluído e enviado para o histórico.','ok');
    }catch(e){c.toast(e.message||'Não foi possível atualizar.','err');}
    finally{locks.delete(item.key);document.querySelectorAll('[data-work-key="'+CSS.escape(item.key)+'"]').forEach(b=>b.disabled=false);}
  }

  function wire(c,root){
    const {$}=c;
    root.querySelectorAll('[data-collapse-group]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.collapseGroup,g=b.closest('[data-op-group]'),v=!g.classList.contains('collapsed');c.setCollapsed(id,v);g.classList.toggle('collapsed',v);b.querySelector('.op-group-toggle').textContent=v?'EXPANDIR':'MINIMIZAR';}));
    root.querySelectorAll('[data-work-action]').forEach(b=>b.addEventListener('click',async()=>{const item=plan(c).all.find(x=>x.key===b.dataset.workKey);if(!item)return;const action=b.dataset.workAction;if(action==='impedido'){const d=$('workNoteDialog');$('workNoteKey').value=item.key;$('workNoteItem').textContent=item.descricao;$('workNoteText').value=item.state?.obs||'';d.showModal();return;}await change(c,item,action);}));
    const form=$('workNoteForm');
    if(form&&form.dataset.ready!=='1'){form.dataset.ready='1';form.addEventListener('submit',async e=>{e.preventDefault();const item=plan(c).all.find(x=>x.key===$('workNoteKey').value),obs=$('workNoteText').value.trim();if(!item||!obs)return;$('workNoteDialog').close();await change(c,item,'impedido',obs);});$('workNoteDialog')?.querySelector('[data-close-work-note]')?.addEventListener('click',()=> $('workNoteDialog').close());}
  }

  function renderOperational(c){
    c=C(c); renderPermission(c); const {D,$,session}=c,p=plan(c),manager=D.isManager(session),root=$('operationalItems');
    const active=[...p.blocked,...p.pending,...p.progress],parts=active.filter(x=>x.tipo==='peca'),services=active.filter(x=>x.tipo==='servico'),renderer=i=>row(c,i);
    const mode=p.official?'<div class="official-mode"><b>CLIENTE OFICIAL</b> • '+(manager?'Gestão: peças e serviços Cilia/O.S. + compras.':'Equipe: somente peças Cilia da O.S.')+'</div>':'';
    root.innerHTML=mode+summary(c,p)+(p.blocked.length?group(c,'blocked','⚠ IMPEDIMENTOS / NÃO RESOLVEU','Exigem decisão antes de fechar o veículo.',p.blocked,renderer,'Nenhum impedimento.','origin-blocked'):'')+group(c,'work-parts',p.official?'CILIA / O.S. — PEÇAS A TROCAR':'O.S. — PEÇAS A TROCAR','Somente o que ainda falta.',parts.filter(x=>!D.blockedStatus(x.status)),renderer,'Nenhuma peça pendente.','origin-parts')+(services.length?group(c,'work-services',p.official?'CILIA / O.S. — SERVIÇOS A EXECUTAR':'O.S. — SERVIÇOS A EXECUTAR','Serviços pendentes ou em execução.',services.filter(x=>!D.blockedStatus(x.status)),renderer,'Nenhum serviço pendente.','origin-services'):'')+group(c,'completed','CONCLUÍDOS — HISTÓRICO','No fim e minimizado para não atrapalhar.',p.done,renderer,'Nenhum item concluído.','origin-completed');
    wire(c,root);
  }

  function renderNF(c){
    c=C(c); const {D,$,session,os,extras,db,toast}=c,panel=$('managerNfPanel'),root=$('purchased'); if(!D.isManager(session)){if(panel)panel.hidden=true;return;} panel.hidden=false;
    if(!extras.nf.length){root.innerHTML='<div class="empty">Nenhuma peça de NF vinculada à O.S.</div>';return;}
    const p=plan(c);
    root.innerHTML=extras.nf.map(n=>{const l=D.purchaseLinkForNF(os,n.id),s=!l?D.bestWorkMatch(n,p.pieces):{item:null},sel=l?.workKey||s.item?.key||'';const opts=['<option value="">SELECIONE A PEÇA DA O.S./CILIA</option>',...p.pieces.map(i=>'<option value="'+D.escapeHtml(i.key)+'" '+(i.key===sel?'selected':'')+'>'+D.escapeHtml(i.source+' • '+i.descricao+(i.codigo?' • cód. '+i.codigo:''))+'</option>')].join('');return '<div class="row purchase-link-row" data-nf-row="'+D.escapeHtml(n.id)+'"><div class="row-title">'+D.escapeHtml(n.descricao||n.codigo||'Peça comprada')+'</div><div class="row-meta">'+(n.codigo?'Cód. '+D.escapeHtml(n.codigo)+' • ':'')+'Qtd. '+D.escapeHtml(n.qtd||'-')+(n.fornecedor?' • '+D.escapeHtml(n.fornecedor):'')+(n.nfNumero?' • NF '+D.escapeHtml(n.nfNumero):'')+'</div>'+(l?'<div class="purchase-linked"><b>VINCULADA:</b> '+D.escapeHtml(l.workDescricao||l.workKey)+'</div>':'<div class="purchase-suggest">'+(s.item?'Sugestão para conferência — não vincula sozinho.':'Selecione a peça correspondente.')+'</div>')+'<div class="purchase-link-controls"><select class="search" data-purchase-select '+(l?'disabled':'')+'>'+opts+'</select>'+(l?'<button class="btn compact" data-unlink="'+D.escapeHtml(n.id)+'">DESVINCULAR</button>':'<button class="btn primary compact" data-link="'+D.escapeHtml(n.id)+'">VINCULAR / DAR BAIXA</button>')+'</div></div>';}).join('');
    root.querySelectorAll('[data-link]').forEach(b=>b.addEventListener('click',async()=>{const n=extras.nf.find(x=>String(x.id)===String(b.dataset.link)),r=b.closest('[data-nf-row]'),i=p.pieces.find(x=>x.key===r?.querySelector('[data-purchase-select]')?.value);if(!n||!i){toast('Selecione a peça correspondente.','err');return;}b.disabled=true;try{await D.setPurchaseLink(db,session,os.id,n,i,true);toast('Compra vinculada; execução continua pendente.','ok');}catch(e){toast(e.message,'err');}finally{b.disabled=false;}}));
    root.querySelectorAll('[data-unlink]').forEach(b=>b.addEventListener('click',async()=>{const n=extras.nf.find(x=>String(x.id)===String(b.dataset.unlink));if(!n)return;b.disabled=true;try{await D.setPurchaseLink(db,session,os.id,n,null,false);toast('Vínculo removido.','ok');}catch(e){toast(e.message,'err');}finally{b.disabled=false;}}));
  }

  window.CentralV1411UI={renderPermission,renderChecklist,renderOperational,renderNF};
})();