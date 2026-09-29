'use strict';

(function(){
  const CFG = window.CENTRAL_CONFIG;
  const SESSION_KEY = 'CENTRAL_VIATURAS_SESSION_V1';
  const REMEMBER_KEY = 'CENTRAL_VIATURAS_LAST_USER';
  const appsByProject = new Map();

  function norm(v){
    return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  }
  function emailValido(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim()); }
  function roleAllowed(role){
    const r = norm(role);
    if(!r || r.includes('cliente')) return false;
    return (CFG.rolesPermitidos||[]).some(x => r.includes(norm(x)));
  }
  function senhaBate(docData,pwd){
    return ['senha','password','adminSenha','senhaAdmin','pwd'].some(k => String(docData?.[k]||'') === String(pwd||''));
  }
  function cargoLabel(v){
    const r=norm(v||'mecanico');
    if(r.includes('super') || r==='master') return 'superadmin';
    if(r.includes('financ')) return 'financeiro';
    if(r.includes('recep')) return 'recepcionista';
    if(r.includes('geren')) return 'gerente';
    if(r.includes('gest')) return 'gestor';
    if(r.includes('admin')) return 'admin';
    if(r.includes('tec')) return 'tecnico';
    return 'mecanico';
  }

  function centralApp(){
    let app = firebase.apps.find(a => a.name === '[DEFAULT]');
    if(!app) app = firebase.initializeApp(CFG.firebaseConfig);
    return app;
  }
  function centralDb(){ return centralApp().firestore(); }
  function dbFromConfig(config){
    if(!config?.apiKey || !config?.projectId) return centralDb();
    const projectId=String(config.projectId);
    if(appsByProject.has(projectId)) return appsByProject.get(projectId).firestore();
    const name='central-tenant-'+projectId.replace(/[^a-z0-9-]/gi,'-');
    let app=firebase.apps.find(a=>a.name===name);
    if(!app) app=firebase.initializeApp(config,name);
    appsByProject.set(projectId,app);
    return app.firestore();
  }
  function activeDb(session){ return session?.firebaseConfig?.apiKey ? dbFromConfig(session.firebaseConfig) : centralDb(); }

  async function firstQuery(db,col,fields,value){
    for(const f of fields){
      try{
        const snap=await db.collection(col).where(f,'==',value).limit(1).get();
        if(!snap.empty) return snap.docs[0];
      }catch(e){ console.warn('[Central auth query]',col,f,e.message); }
    }
    return null;
  }
  async function firstArrayContains(db,col,fields,value){
    for(const f of fields){
      try{
        const snap=await db.collection(col).where(f,'array-contains',value).limit(1).get();
        if(!snap.empty) return snap.docs[0];
      }catch(e){ console.warn('[Central auth array]',col,f,e.message); }
    }
    return null;
  }
  async function buscarOficinaComoSaas(usr){
    const db=centralDb(), raw=String(usr||'').trim(), email=raw.toLowerCase();
    let doc=await firstQuery(db,'oficinas',['usuario'],raw);
    if(!doc && emailValido(raw) && email!==raw) doc=await firstQuery(db,'oficinas',['usuario'],email);
    if(!doc && emailValido(raw)) doc=await firstArrayContains(db,'oficinas',['adminEmails','emailsAdmin','adminsEmails'],email);
    if(!doc && emailValido(raw)) doc=await firstQuery(db,'oficinas',['email','adminEmail','ownerEmail'],email);
    return doc;
  }
  function oficinaSess(doc,d,role='admin',name='Gestor'){
    return {
      tenantId:doc.id, oficinaId:doc.id, oficinaNome:d.nomeFantasia||d.nome||'Oficina', role, cargo:role,
      name, login:name, email:emailValido(name)?name.toLowerCase():'', funcionarioId:'',
      firebaseConfig:d.firebaseConfig&&d.firebaseConfig.apiKey?d.firebaseConfig:null,
      actorType:'central-viaturas', createdAt:new Date().toISOString()
    };
  }
  function funcionarioSess(docF,dF,ofDoc,ofData){
    const role=cargoLabel(dF.cargo||dF.role||dF.perfil||'mecanico');
    return {
      tenantId:ofDoc.id, oficinaId:ofDoc.id, oficinaNome:ofData.nomeFantasia||ofData.nome||'Oficina', role, cargo:role,
      name:dF.nome||dF.name||dF.usuario||dF.email||'Funcionário', login:dF.usuario||dF.login||dF.email||'',
      email:dF.email||'', funcionarioId:docF.id,
      firebaseConfig:ofData.firebaseConfig&&ofData.firebaseConfig.apiKey?ofData.firebaseConfig:null,
      actorType:'central-viaturas', createdAt:new Date().toISOString()
    };
  }

  async function loginPorOficina(usr,pwd){
    const doc=await buscarOficinaComoSaas(usr); if(!doc) return null;
    const d=doc.data()||{};
    if(String(d.status||'').toLowerCase().includes('bloque')) throw new Error('Oficina bloqueada no SaaS.');
    if(!senhaBate(d,pwd)) throw new Error('Senha incorreta.');
    const nome=emailValido(usr)?String(usr).trim().toLowerCase():(d.adminNome||d.nomeResponsavel||d.nomeFantasia||usr);
    return oficinaSess(doc,d,'admin',nome);
  }
  async function loginFuncionarioCentral(usr,pwd){
    const db=centralDb();
    const doc=await firstQuery(db,'funcionarios',['usuario','login','email'],usr) || await firstQuery(db,'funcionarios',['email'],usr.toLowerCase());
    if(!doc) return null;
    const d=doc.data()||{};
    if(!senhaBate(d,pwd)) throw new Error('Senha incorreta para funcionário.');
    const tenantId=d.tenantId||d.oficinaId||d.tid;
    if(!tenantId) throw new Error('Funcionário sem oficina vinculada.');
    const ofDoc=await db.collection('oficinas').doc(tenantId).get();
    if(!ofDoc.exists) throw new Error('Oficina vinculada não encontrada.');
    const ofData=ofDoc.data()||{};
    if(String(ofData.status||'').toLowerCase().includes('bloque')) throw new Error('Oficina bloqueada no SaaS.');
    return funcionarioSess(doc,d,ofDoc,ofData);
  }
  async function loginFuncionarioTenant(usr,pwd){
    const db=centralDb();
    let oficinas=[];
    try{ const snap=await db.collection('oficinas').get(); oficinas=snap.docs; }catch(e){ oficinas=[]; }
    for(const ofDoc of oficinas){
      const ofData=ofDoc.data()||{};
      if(String(ofData.status||'').toLowerCase().includes('bloque')) continue;
      const tdb=ofData.firebaseConfig&&ofData.firebaseConfig.apiKey?dbFromConfig(ofData.firebaseConfig):db;
      try{
        const doc=await firstQuery(tdb,'funcionarios',['usuario','login','email'],usr) || await firstQuery(tdb,'funcionarios',['email'],usr.toLowerCase());
        if(doc){
          const d=doc.data()||{};
          if(!senhaBate(d,pwd)) throw new Error('Senha incorreta para funcionário.');
          return funcionarioSess(doc,d,ofDoc,ofData);
        }
      }catch(e){ if(String(e.message||'').includes('Senha incorreta')) throw e; }
    }
    return null;
  }
  async function loginFirebaseEmail(usr,pwd){
    if(!usr.includes('@')) return null;
    const app=centralApp();
    await app.auth().signInWithEmailAndPassword(usr,pwd);
    const email=usr.toLowerCase(), db=centralDb();
    const checks=[['usuariosAutorizados',['email']],['admins',['email']],['users',['email']],['usuarios',['email']],['funcionarios',['email']],['oficinas',['adminEmail','email','ownerEmail']]];
    for(const [col,fields] of checks){
      const doc=await firstQuery(db,col,fields,email); if(!doc) continue;
      const d=doc.data()||{};
      if(col==='oficinas') return oficinaSess(doc,d,'admin',d.adminNome||email);
      const tenantId=d.tenantId||d.oficinaId||d.tid;
      if(tenantId){
        const ofDoc=await db.collection('oficinas').doc(tenantId).get();
        if(ofDoc.exists) return funcionarioSess(doc,d,ofDoc,ofDoc.data()||{});
      }
      const role=cargoLabel(d.role||d.cargo||d.perfil||'admin');
      if(roleAllowed(role)) return {tenantId:d.tenantId||'MASTER_ADMIN',oficinaId:d.tenantId||'MASTER_ADMIN',oficinaNome:d.oficinaNome||'OFICIN-IA',role,cargo:role,name:d.nome||d.name||email,login:email,email,actorType:'firebase-auth',createdAt:new Date().toISOString()};
    }
    return {tenantId:'MASTER_ADMIN',oficinaId:'MASTER_ADMIN',oficinaNome:'OFICIN-IA',role:'superadmin',cargo:'superadmin',name:email,login:email,email,actorType:'firebase-auth',createdAt:new Date().toISOString()};
  }

  function validSession(sess){
    return !!(sess && sess.tenantId && sess.name && roleAllowed(sess.role) && (!sess.expiresAt || Date.now()<sess.expiresAt));
  }
  function saveSession(sess,remember=true){
    const clean={...sess,expiresAt:Date.now()+1000*60*60*24*7};
    delete clean.password; delete clean.senha; delete clean.pwd;
    sessionStorage.setItem(SESSION_KEY,JSON.stringify(clean));
    if(remember) localStorage.setItem(SESSION_KEY,JSON.stringify(clean)); else localStorage.removeItem(SESSION_KEY);
    localStorage.setItem(REMEMBER_KEY,clean.login||clean.email||'');
    return clean;
  }
  function loadSession(){
    let sess=null;
    try{ sess=JSON.parse(sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY)||'null'); }catch(_){ sess=null; }
    return validSession(sess)?sess:null;
  }
  async function login(usr,pwd,remember=true){
    let sess=await loginPorOficina(usr,pwd);
    if(!sess) sess=await loginFuncionarioCentral(usr,pwd);
    if(!sess) sess=await loginFuncionarioTenant(usr,pwd);
    if(!sess) sess=await loginFirebaseEmail(usr,pwd);
    if(!validSession(sess)) throw new Error('Perfil não autorizado para a Central de Viaturas.');
    return saveSession(sess,remember);
  }
  async function logout(){
    try{ await centralApp().auth().signOut(); }catch(_){}
    sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY);
  }
  function lastUser(){ return localStorage.getItem(REMEMBER_KEY)||''; }
  function sessionIdentity(sess){ return String(sess?.funcionarioId||sess?.email||sess?.login||sess?.name||'usuario').replace(/[^a-z0-9_-]/gi,'_'); }

  window.CentralAuth={norm,roleAllowed,centralApp,centralDb,activeDb,login,logout,loadSession,lastUser,sessionIdentity};
})();
