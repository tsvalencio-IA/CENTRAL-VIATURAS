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
    const official=D.isOfficialClient(os,getClient());
    const el=$('permissionNote');
    const badge=$('permissionBadge');
    if(!el||!badge) return;
    if(gestor){
      badge.textContent='GESTÃO';
      badge.className='permission-badge manager';
      el.innerHTML=official
        ? '<b>Cliente oficial / Cilia:</b> gestão vê peças e serviços importados do Cilia, compra vinculada, pendências e execução.'
        : '<b>Cliente normal:</b> gestão vê peças e serviços da O.S., compras vinculadas, pendências e execução.';
    }else{
      badge.textContent='EQUIPE';
      badge.className='permission-badge team';
      el.innerHTML=official
        ? '<b>Cliente oficial / Cilia:</b> equipe vê somente as peças do Cilia que precisam ser trocadas. Compra, marca, código, fornecedor e N.F. são confidenciais.'
        : '<b>Cliente normal:</b> equipe vê somente peças a trocar e serviços a executar. Dados de compra são confidenciais.';
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
    const panel=$('checklistSummaryPanel');
    const root=$('checklist');
    const mini=$('checkMiniLabel');
    const compare=$('checklistCompare');
    if(panel) panel.hidden=false;

    const summary=D.checklistSummary(os);
    if(!summary.exists){
      if(root) root.innerHTML='<div class="empty">Ainda não existe checklist anexado nesta O.S.</div>';
      if($('checkProgress')) $('checkProgress').style.width='0%';
      if($('checkLabel')) $('checkLabel').textContent='Sem checklist anexado';
      if(mini) mini.textContent='SEM CHECKLIST';
      if(compare){compare.hidden=true;compare.innerHTML='';}
      return;
    }

    const pct=Math.max(0,Math.min(100,Number(summary.progresso??0)));
    if($('checkProgress')) $('checkProgress').style.width=pct+'%';
    if($('checkLabel')) $('checkLabel').textContent=pct+'% • '+String(summary.pendentes??0)+' pendente(s)'+(summary.responsavel?' • '+summary.responsavel:'');
    if(mini) mini.textContent=pct+'% • '+String(summary.responsavel||'equipe');

    const plan=D.checklistPlan(os);
    const all=[].concat(plan.pecasTrocar||[],plan.servicosExecutar||[],plan.atencoes||[]);
    if(!all.length){
      if(root) root.innerHTML='<div class="row"><div class="row-title">Checklist salvo sem itens de ação pendente.</div></div>';
    }else if(root){
      root.innerHTML=all.map(function(i){
        const tipo=i.group==='peca'?'PEÇA / TROCAR':i.group==='servico'?'SERVIÇO':'ATENÇÃO / REVISAR';
        return '<div class="row">'+
          '<div class="row-title">'+D.escapeHtml(i.item||i.descricao||'Item')+'</div>'+
          '<div class="row-meta">'+D.escapeHtml(tipo)+' • '+D.escapeHtml(i.secao||'Checklist')+
          (i.acaoLabel?' • '+D.escapeHtml(i.acaoLabel):'')+(i.obs?' • '+D.escapeHtml(i.obs):'')+'</div>'+
        '</div>';
      }).join('');
    }

    if(compare){
      if(!D.isManager(session)){
        compare.hidden=true;
        compare.innerHTML='';
      }else{
        const cmp=D.compareChecklistToWork(os,getClient());
        compare.hidden=false;
        const fonte=cmp.official?'CILIA / O.S.':'O.S.';
        const list=function(title,items,kind){
          if(!items.length) return '';
          return '<div class="check-compare-list"><b>'+D.escapeHtml(title)+'</b>'+
            items.map(function(x){
              const text=kind==='match'
                ? (x.checklist.item+' ↔ '+x.work.descricao)
                : (kind==='check'?x.item:x.descricao);
              return '<span>• '+D.escapeHtml(text)+'</span>';
            }).join('')+
          '</div>';
        };
        compare.innerHTML=
          '<div class="check-compare-head"><b>COMPARAÇÃO DA GESTÃO</b><span>Checklist x '+D.escapeHtml(fonte)+'</span></div>'+
          '<div class="check-compare-stats">'+
            '<span class="state-chip ok">'+cmp.matched.length+' compatível(is)</span>'+
            '<span class="state-chip warn">'+cmp.checklistOnly.length+' só no checklist</span>'+
            '<span class="state-chip">'+cmp.workOnly.length+' só na '+D.escapeHtml(fonte)+'</span>'+
          '</div>'+
          list('Encontrado nos dois',cmp.matched,'match')+
          list('Somente no checklist — revisar antes de executar',cmp.checklistOnly,'check')+
          list('Somente na '+fonte,cmp.workOnly,'work');
      }
    }
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


  function normalizedWorkStatus(item){
    const raw=String(D.workExecution(os,item.key)?.status||item.execucao?.status||'pendente').toLowerCase();
    if(D.executionFinished(raw)||raw==='concluido') return 'concluido';
    if(raw==='em_execucao'||raw==='andamento'||raw==='em andamento') return 'em_execucao';
    if(raw==='impedido'||raw==='nao_resolveu'||raw==='não resolveu'||raw==='bloqueado') return 'impedido';
    return 'pendente';
  }

  function workStatusLabel(status){
    return status==='concluido'?'CONCLUÍDO':status==='em_execucao'?'EM EXECUÇÃO':status==='impedido'?'IMPEDIDO / NÃO RESOLVEU':'PENDENTE';
  }

  function renderWorkItem(item){
    const gestor=D.isManager(session);
    const state=D.workExecution(os,item.key);
    const status=normalizedWorkStatus(item);
    const purchase=item.tipo==='peca'&&gestor?D.workPurchase(os,item.key):null;
    const meta=[];
    if(gestor){
      if(item.origem) meta.push(item.origem);
      if(item.codigo) meta.push('Cód. '+item.codigo);
      if(item.marca) meta.push('Marca '+item.marca);
      if(item.ciliaPieceIndex) meta.push('Cilia #'+item.ciliaPieceIndex);
    }
    const purchaseChips=gestor&&item.tipo==='peca'
      ? (purchase.comprado
          ? '<span class="state-chip bought">'+(purchase.linked?'COMPRADA / VINCULADA':'COMPRADA')+'</span>'
          : '<span class="state-chip warn">FALTA COMPRAR</span>')
      : '';
    const statusClass=status==='concluido'?'ok':status==='impedido'?'warn':'';
    const obs=String(state?.obs||'');
    const buyButton=gestor&&item.tipo==='peca'
      ? '<button class="btn purchase" data-work-buy="'+D.escapeHtml(item.key)+'" data-bought="'+(purchase.comprado?'1':'0')+'">'+
          (purchase.comprado?'DESMARCAR COMPRA':'MARCAR COMPRADA')+'</button>'
      : '';

    return '<article class="op-row work-item '+(status==='concluido'?'is-done ':'')+(status==='impedido'?'is-blocked ':'')+'" data-work-card="'+D.escapeHtml(item.key)+'">'+
      '<div class="op-main">'+
        '<div class="op-type">'+D.escapeHtml(item.tipo==='peca'?'PEÇA A TROCAR':'SERVIÇO A EXECUTAR')+'</div>'+
        '<div class="op-title">'+D.escapeHtml(item.descricao||item.codigo||item.key)+'</div>'+
        (gestor&&meta.length?'<div class="op-meta">'+D.escapeHtml(meta.join(' • '))+'</div>':'')+
        '<div class="op-statuses"><span class="state-chip '+statusClass+'">'+workStatusLabel(status)+'</span>'+purchaseChips+'</div>'+
        (state?.atualizadoPor?'<div class="op-audit">Última atualização: '+D.escapeHtml(state.atualizadoPor)+(state.atualizadoEm?' • '+D.escapeHtml(D.fmt(state.atualizadoEm)):'')+'</div>':'')+
        '<input class="work-obs" data-work-obs="'+D.escapeHtml(item.key)+'" maxlength="500" value="'+D.escapeHtml(obs)+'" placeholder="Observação: ex. fiz, mas não resolveu / aguardando peça...">'+
      '</div>'+
      '<div class="op-actions work-actions">'+
        (status==='concluido'
          ? '<button class="btn success" data-work-status="pendente" data-work-key="'+D.escapeHtml(item.key)+'">REABRIR</button>'
          : '<button class="btn" data-work-status="em_execucao" data-work-key="'+D.escapeHtml(item.key)+'">EM EXECUÇÃO</button>'+
            '<button class="btn primary" data-work-status="concluido" data-work-key="'+D.escapeHtml(item.key)+'">CONCLUIR</button>'+
            '<button class="btn danger" data-work-status="impedido" data-work-key="'+D.escapeHtml(item.key)+'">IMPEDIDO</button>')+
        buyButton+
      '</div>'+
    '</article>';
  }

  function managerPendingSummary(plan,visibleServices){
    const items=[].concat(plan.pieces,visibleServices);
    const pending=items.filter(function(x){return normalizedWorkStatus(x)!=='concluido';});
    const blocked=items.filter(function(x){return normalizedWorkStatus(x)==='impedido';});
    const needBuy=plan.pieces.filter(function(x){return !D.workPurchase(os,x.key).comprado;});
    const boughtWaiting=plan.pieces.filter(function(x){return D.workPurchase(os,x.key).comprado&&normalizedWorkStatus(x)!=='concluido';});
    return '<div class="management-pending">'+
      '<div class="management-pending-title"><b>CONTROLE PARA NÃO ESQUECER NADA</b><span>'+pending.length+' execução(ões) pendente(s)</span></div>'+
      '<div class="management-pending-grid">'+
        '<div><b>'+pending.length+'</b><span>o que falta fazer</span></div>'+
        '<div><b>'+needBuy.length+'</b><span>o que falta comprar</span></div>'+
        '<div><b>'+boughtWaiting.length+'</b><span>comprado / aguardando execução</span></div>'+
        '<div><b>'+blocked.length+'</b><span>impedimentos / não resolveu</span></div>'+
        '<div><b>'+plan.pieces.length+'</b><span>peças controladas</span></div>'+
      '</div>'+
    '</div>';
  }

  function splitWork(items){
    return {
      pending:items.filter(function(x){const s=normalizedWorkStatus(x);return s!=='concluido'&&s!=='impedido';}),
      blocked:items.filter(function(x){return normalizedWorkStatus(x)==='impedido';}),
      done:items.filter(function(x){return normalizedWorkStatus(x)==='concluido';})
    };
  }

  function renderOperational(){
    renderPermission();
    const root=$('operationalItems');
    const gestor=D.isManager(session);
    const plan=D.workPlan(os,getClient());
    const visibleServices=gestor?plan.services:(plan.official?[]:plan.services);
    const pp=splitWork(plan.pieces);
    const ss=splitWork(visibleServices);
    const blocked=[].concat(pp.blocked,ss.blocked);
    const completed=[].concat(pp.done,ss.done);

    let html='';
    if(gestor) html+=managerPendingSummary(plan,visibleServices);

    if(plan.official){
      html+=opGroup(
        'work-parts',
        gestor?'PEÇAS CILIA A TROCAR':'PEÇAS A TROCAR',
        gestor?'Peças importadas do Cilia que estão na O.S.':'Somente peças importadas do Cilia que precisam ser executadas',
        pp.pending,renderWorkItem,'Nenhuma peça pendente.'
      );
      if(gestor){
        html+=opGroup(
          'work-services',
          'SERVIÇOS CILIA A EXECUTAR',
          'Serviços do Cilia relacionados à O.S.',
          ss.pending,renderWorkItem,'Nenhum serviço Cilia pendente.'
        );
      }
    }else{
      html+=opGroup('work-parts','PEÇAS A TROCAR','Peças da O.S. que precisam ser executadas',pp.pending,renderWorkItem,'Nenhuma peça pendente.');
      html+=opGroup('work-services','SERVIÇOS A EXECUTAR','Serviços da O.S. que precisam ser executados',ss.pending,renderWorkItem,'Nenhum serviço pendente.');
    }

    html+=opGroup(
      'work-blocked',
      'IMPEDIMENTOS / NÃO RESOLVEU',
      'Itens que precisam de atenção antes de considerar a viatura concluída',
      blocked,renderWorkItem,'Nenhum impedimento informado.'
    );
    html+=opGroup(
      'work-completed',
      'CONCLUÍDOS',
      'Itens retirados das pendências após a execução',
      completed,renderWorkItem,'Nenhum item concluído ainda.'
    );
    root.innerHTML=html;

    root.querySelectorAll('[data-collapse-group]').forEach(function(btn){
      btn.addEventListener('click',function(){
        const id=btn.dataset.collapseGroup;
        setCollapsed(id,!isCollapsed(id));
        renderOperational();
      });
    });

    root.querySelectorAll('[data-work-status]').forEach(function(btn){
      btn.addEventListener('click',async function(){
        const key=btn.dataset.workKey;
        const status=btn.dataset.workStatus;
        const card=btn.closest('[data-work-card]');
        const obs=card?.querySelector('[data-work-obs]')?.value?.trim()||'';
        if(status==='impedido'&&!obs){
          toast('Para marcar IMPEDIDO, escreva o que aconteceu na observação.','err');
          card?.querySelector('[data-work-obs]')?.focus();
          return;
        }
        btn.disabled=true;
        try{
          await D.setWorkState(db,session,os.id,key,status,obs,getClient());
          toast(status==='concluido'?'Item concluído.':status==='impedido'?'Impedimento registrado.':status==='em_execucao'?'Item em execução.':'Item reaberto.','ok');
        }catch(e){toast(e.message||'Não foi possível atualizar o item.','err');}
        finally{btn.disabled=false;}
      });
    });

    root.querySelectorAll('[data-work-buy]').forEach(function(btn){
      btn.addEventListener('click',async function(){
        const bought=btn.dataset.bought==='1';
        btn.disabled=true;
        try{
          await D.setPurchaseState(db,session,os.id,btn.dataset.workBuy,!bought);
          toast(bought?'Compra reaberta.':'Peça marcada como comprada.','ok');
        }catch(e){toast(e.message||'Não foi possível atualizar a compra.','err');}
        finally{btn.disabled=false;}
      });
    });
  }


  function printOperational(){
    const gestor=D.isManager(session);
    const plan=D.workPlan(os,getClient());
    const services=gestor?plan.services:(plan.official?[]:plan.services);
    const items=[].concat(plan.pieces,services);
    const body=items.map(function(item){
      const st=normalizedWorkStatus(item);
      const purchase=gestor&&item.tipo==='peca'?D.workPurchase(os,item.key):null;
      const meta=gestor
        ? [item.origem,item.codigo?('Cód. '+item.codigo):'',item.marca?('Marca '+item.marca):'',purchase?.comprado?'COMPRADA':''].filter(Boolean).join(' • ')
        : '';
      return '<tr><td>'+D.escapeHtml(item.descricao)+'</td><td>'+D.escapeHtml(item.tipo==='peca'?'PEÇA':'SERVIÇO')+'</td><td>'+
        D.escapeHtml(workStatusLabel(st))+'</td><td>'+D.escapeHtml(meta)+'</td></tr>';
    }).join('');

    const w=window.open('','_blank');
    if(!w){toast('O navegador bloqueou a janela de impressão.','err');return;}
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Relatório operacional '+D.escapeHtml(currentPlate())+
      '</title><style>@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;color:#111;font-size:11px}h1{font-size:20px;margin:0 0 4px}p{margin:2px 0 10px;color:#444}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #bbb;padding:5px;text-align:left;vertical-align:top}th{background:#eee}.footer{margin-top:18px;text-align:center;font-size:9px;color:#666}</style></head><body>'+
      '<h1>RELATÓRIO OPERACIONAL DA VIATURA '+D.escapeHtml(currentPlate())+'</h1>'+
      '<p>O.S. '+D.escapeHtml(D.getOSNumber(os)||os.id)+' • '+D.escapeHtml(D.getVehicleLabel(os,getVehicle()))+' • '+(plan.official?'CLIENTE OFICIAL / CILIA':'CLIENTE NORMAL')+'</p>'+
      '<table><thead><tr><th>Item</th><th>Tipo</th><th>Status</th><th>'+(gestor?'Gestão':'')+'</th></tr></thead><tbody>'+
      (body||'<tr><td colspan="4">Nenhum item operacional.</td></tr>')+'</tbody></table>'+
      '<div class="footer">Powered by thIAguinho Soluções Digitais</div></body></html>');
    w.document.close();
    setTimeout(function(){w.print();},250);
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
    if(!D.isManager(session)){if(panel)panel.hidden=true;if(root)root.innerHTML='';return;}
    if(panel)panel.hidden=false;

    const plan=D.workPlan(os,getClient());
    const pieces=plan.pieces||[];
    const links=os?.centralCompraVinculos||{};
    const reverse={};
    Object.keys(links).forEach(function(key){
      const id=String(links[key]?.nfVinculoId||'');
      if(id) reverse[id]=key;
    });

    if(!extras.nf.length){
      root.innerHTML='<div class="empty">Nenhuma peça comprada/N.F. vinculada a esta O.S. foi encontrada.</div>';
      return;
    }

    root.innerHTML=extras.nf.map(function(p){
      const linkedKey=reverse[p.id]||'';
      const suggested=linkedKey||D.suggestPurchaseTarget(p,pieces);
      const options='<option value="">ESCOLHA A PEÇA DA O.S.</option>'+
        pieces.map(function(item){
          return '<option value="'+D.escapeHtml(item.key)+'" '+(suggested===item.key?'selected':'')+'>'+
            D.escapeHtml(item.descricao)+(item.codigo?' — '+D.escapeHtml(item.codigo):'')+
          '</option>';
        }).join('');
      const linked=linkedKey?pieces.find(function(x){return x.key===linkedKey;}):null;
      return '<div class="row purchase-link-row" data-purchase-id="'+D.escapeHtml(p.id)+'">'+
        '<div class="row-title">'+D.escapeHtml(p.descricao||p.codigo)+'</div>'+
        '<div class="row-meta">'+
          (p.codigo?'Cód. '+D.escapeHtml(p.codigo)+' • ':'')+
          (p.marca?'Marca '+D.escapeHtml(p.marca)+' • ':'')+
          'Qtd. '+D.escapeHtml(p.qtd||'-')+
          (p.fornecedor?' • '+D.escapeHtml(p.fornecedor):'')+
          (p.nfNumero?' • NF '+D.escapeHtml(p.nfNumero):'')+
        '</div>'+
        (linked?'<div class="purchase-linked">VINCULADA → '+D.escapeHtml(linked.descricao)+'</div>':'')+
        '<div class="purchase-link-controls"><select class="search" data-purchase-target="'+D.escapeHtml(p.id)+'">'+options+'</select>'+
          '<button class="btn purchase" data-link-purchase="'+D.escapeHtml(p.id)+'">VINCULAR / DAR BAIXA</button>'+
          (linked?'<button class="btn danger" data-unlink-purchase="'+D.escapeHtml(p.id)+'" data-work-key="'+D.escapeHtml(linkedKey)+'">REMOVER VÍNCULO</button>':'')+
        '</div>'+
      '</div>';
    }).join('');

    root.querySelectorAll('[data-link-purchase]').forEach(function(btn){
      btn.addEventListener('click',async function(){
        const id=btn.dataset.linkPurchase;
        const p=extras.nf.find(function(x){return String(x.id)===String(id);});
        const select=root.querySelector('[data-purchase-target="'+CSS.escape(id)+'"]');
        const key=select?.value||'';
        if(!p||!key){toast('Escolha a peça da O.S. que corresponde a esta compra.','err');return;}
        btn.disabled=true;
        try{
          await D.linkPurchaseToWorkItem(db,session,os.id,key,p);
          toast('Compra vinculada à peça da O.S.','ok');
        }catch(e){toast(e.message||'Não foi possível vincular.','err');}
        finally{btn.disabled=false;}
      });
    });

    root.querySelectorAll('[data-unlink-purchase]').forEach(function(btn){
      btn.addEventListener('click',async function(){
        btn.disabled=true;
        try{
          await D.linkPurchaseToWorkItem(db,session,os.id,btn.dataset.workKey,null);
          toast('Vínculo de compra removido.','ok');
        }catch(e){toast(e.message||'Não foi possível remover o vínculo.','err');}
        finally{btn.disabled=false;}
      });
    });
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
      reabriu_compra_peca_checklist:'Compra do checklist reaberta',
      alterou_status_item:'Fila operacional atualizada',
      vinculou_compra_os:'Compra vinculada à O.S.',
      removeu_vinculo_compra_os:'Vínculo de compra removido'
    };
    return map[a]||'Atualização da Central';
  }

  function renderTimeline(){
    const ev=[];
    const manager=D.isManager(session);
    const report=D.reportEvents(os).filter(e=>{
      if(manager) return true;
      const a=String(e?.acao||'');
      if(['registrou_peca_real_trocada','marcou_peca_trocada','marcou_peca_comprada','desmarcou_peca_comprada','marcou_peca_checklist_comprada','reabriu_compra_peca_checklist','vinculou_compra_os','removeu_vinculo_compra_os'].includes(a)) return false;
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
