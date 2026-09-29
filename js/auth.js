'use strict';

(function(){
  const CFG=window.CENTRAL_CONFIG;
  const KEY='CENTRAL_VIATURAS_SESSION_V1';
  const apps=new Map();

  function norm(v){return String(v==null?'':v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();}
  function emailOk(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());}
  function roleAllowed(v){
    const r=norm(v);
    return !!r && !r.includes('cliente') && (CFG.rolesPermitidos||[]).some(x=>r.includes(norm(x)));
  }
  function centralApp(){
    let app=firebase.apps.find(a=>a.name==='[DEFAULT]');
    if(!app) app=firebase.initializeApp(CFG.firebaseConfig);
    return app;
  }
  function centralDb(){return centralApp().firestore();}
  function parseCfg(v){if(!v)return null;if(typeof v==='object')return v;try{return JSON.parse(v);}catch(_){return null;}}
  function dbFromCfg(cfg){
    if(!cfg?.apiKey||!cfg?.projectId)return centralDb();
    const pid=String(cfg.projectId);
    if(apps.has(pid))return apps.get(pid).firestore();
    const name='central-tenant-'+pid.replace(/[^a-z0-9-]/gi,'-');
    let app=firebase.apps.find(a=>a.name===name);
    if(!app)app=firebase.initializeApp(cfg,name);
    apps.set(pid,app);
    return app.firestore();
  }
  function fromSaas(s){
    if(!s?.j_tid||!s?.j_nome)return null;
    const role=s.j_tid==='MASTER_ADMIN'?'superadmin':(s.j_cargo||s.j_role||'mecanico');
    if(s.j_tid!=='MASTER_ADMIN'&&!roleAllowed(role))return null;
    return {
      tenantId:s.j_tid,oficinaId:s.j_tid,oficinaNome:s.j_tnome||'Oficina',
      role:s.j_tid==='MASTER_ADMIN'?'superadmin':role,cargo:s.j_cargo||s.j_role||role,
      name:s.j_nome,login:s.j_admin_email||s.j_nome,email:s.j_admin_email||'',
      funcionarioId:s.j_fid||'',firebaseConfig:parseCfg(s.j_firebase_config),
      actorType:s.j_actor_type||'saas-session',saasSession:s,createdAt:new Date().toISOString()
    };
  }
  function readSaasSession(){
    const keys=['j_tid','j_tnome','j_role','j_cargo','j_cargo_acesso','j_actor_type','j_nome','j_admin_email','j_fid','j_firebase_config'];
    const s={}; keys.forEach(k=>{const v=sessionStorage.getItem(k);if(v!=null)s[k]=v;});
    if(s.j_tid&&s.j_nome)return s;
    try{
      const saved=JSON.parse(localStorage.getItem('j_saved_login')||'null');
      if(saved?.session?.j_tid&&saved?.session?.j_nome){
        Object.entries(saved.session).forEach(([k,v])=>sessionStorage.setItem(k,String(v)));
        return saved.session;
      }
    }catch(_){}
    return null;
  }
  function writeSaasSession(s){Object.entries(s||{}).forEach(([k,v])=>{if(v!=null)sessionStorage.setItem(k,String(v));});}
  function save(sess,remember){
    const clean={...sess,expiresAt:Date.now()+7*24*60*60*1000};
    delete clean.password;delete clean.senha;delete clean.pwd;
    sessionStorage.setItem(KEY,JSON.stringify(clean));
    if(remember)localStorage.setItem(KEY,JSON.stringify(clean));else localStorage.removeItem(KEY);
    if(clean.login)localStorage.setItem('j_last_user',clean.login);
    return clean;
  }
  function loadSession(){
    const existing=fromSaas(readSaasSession());
    if(existing)return existing;
    try{
      const c=JSON.parse(sessionStorage.getItem(KEY)||localStorage.getItem(KEY)||'null');
      if(c?.tenantId&&c?.name&&(!c.expiresAt||Date.now()<c.expiresAt)&&roleAllowed(c.role))return c;
    }catch(_){}
    return null;
  }
  function activeDb(s){const cfg=s?.firebaseConfig||parseCfg(s?.saasSession?.j_firebase_config);return cfg?.apiKey?dbFromCfg(cfg):centralDb();}

  async function buscarOficina(usr){
    const db=centralDb(),raw=String(usr||'').trim(),email=raw.toLowerCase();
    const t=[{campo:'usuario',op:'==',valor:raw}];
    if(emailOk(raw)){
      if(email!==raw)t.push({campo:'usuario',op:'==',valor:email});
      [...new Set([email,raw])].forEach(valor=>['adminEmails','emailsAdmin','adminsEmails'].forEach(campo=>t.push({campo,op:'array-contains',valor})));
    }
    for(const x of t){
      try{
        const s=await db.collection('oficinas').where(x.campo,x.op,x.valor).limit(1).get();
        if(!s.empty)return {doc:s.docs[0],adminEmail:x.op==='array-contains'?email:''};
      }catch(e){console.warn('[Central login oficina]',x.campo,e.message);}
    }
    return null;
  }
  async function buscarFuncionario(usr){
    const db=centralDb();
    try{
      const s=await db.collection('funcionarios').where('usuario','==',usr).limit(1).get();
      if(!s.empty){
        const docF=s.docs[0],dF=docF.data(),mae=await db.collection('oficinas').doc(dF.tenantId).get();
        return {docF,dF,mae,maeData:mae.exists?mae.data():null,tenantId:dF.tenantId};
      }
    }catch(e){console.warn('[Central login equipe]',e.message);}
    let oficinas=[];
    try{oficinas=(await db.collection('oficinas').get()).docs;}catch(e){console.warn('[Central oficinas]',e.message);}
    for(const ofDoc of oficinas){
      const ofi=ofDoc.data()||{};
      if(ofi.status==='Bloqueado'||!ofi.firebaseConfig?.apiKey)continue;
      try{
        const s=await dbFromCfg(ofi.firebaseConfig).collection('funcionarios').where('usuario','==',usr).limit(1).get();
        if(!s.empty){const docF=s.docs[0];return {docF,dF:docF.data(),mae:ofDoc,maeData:ofi,tenantId:ofDoc.id};}
      }catch(e){console.warn('[Central login tenant]',ofDoc.id,e.message);}
    }
    return null;
  }
  function jarvis(c){return /^(gerente|gestor|dono|proprietario|owner|admin|administrador)$/.test(norm(c));}
  function adminSession(found,d,usr){
    const s={j_tid:found.doc.id,j_tnome:d.nomeFantasia||'Oficina',j_role:'admin',j_nome:found.adminEmail||d.nomeFantasia||'Gestor',j_admin_email:found.adminEmail||(emailOk(usr)?usr.toLowerCase():''),j_nicho:d.nicho||'carros',j_actor_type:'admin'};
    if(d.firebaseConfig?.projectId&&d.firebaseConfig?.apiKey)s.j_firebase_config=JSON.stringify(d.firebaseConfig);
    return s;
  }
  function equipeSession(found){
    const dF=found.dF,mae=found.maeData||found.mae.data()||{},cargo=String(dF.cargo||'mecanico').trim()||'mecanico',j=jarvis(cargo);
    const s={j_tid:found.tenantId||dF.tenantId,j_tnome:mae.nomeFantasia||'Oficina',j_role:j?'admin':cargo,j_cargo:cargo,j_cargo_acesso:j?'jarvis':'equipe',j_actor_type:'equipe',j_nome:dF.nome||dF.usuario||'Funcionário',j_fid:found.docF.id,j_comissao:String(dF.comissao||0),j_nicho:mae.nicho||'carros'};
    if(mae.firebaseConfig?.projectId&&mae.firebaseConfig?.apiKey)s.j_firebase_config=JSON.stringify(mae.firebaseConfig);
    return s;
  }
  async function login(usr,pwd,remember=true){
    usr=String(usr||'').trim();pwd=String(pwd||'').trim();
    if(!usr||!pwd)throw new Error('Informe usuário e senha.');
    if(usr.includes('@')){
      try{
        await centralApp().auth().signInWithEmailAndPassword(usr,pwd);
        const s={j_tid:'MASTER_ADMIN',j_tnome:'OFICIN-IA',j_role:'superadmin',j_nome:usr,j_admin_email:usr,j_actor_type:'superadmin'};
        writeSaasSession(s);return save(fromSaas(s),remember);
      }catch(_){}
    }
    const of=await buscarOficina(usr);
    if(of){
      const d=of.doc.data()||{};
      if(d.senha!==pwd)throw new Error('Senha incorreta.');
      if(d.status==='Bloqueado')throw new Error('Licença bloqueada. Contate o suporte.');
      const s=adminSession(of,d,usr);writeSaasSession(s);return save(fromSaas(s),remember);
    }
    const fn=await buscarFuncionario(usr);
    if(fn){
      if(fn.dF?.senha!==pwd)throw new Error('Senha incorreta.');
      if(!fn.mae?.exists||fn.mae.data()?.status==='Bloqueado')throw new Error('Oficina bloqueada.');
      const s=equipeSession(fn);writeSaasSession(s);return save(fromSaas(s),remember);
    }
    throw new Error('Usuário não encontrado no sistema.');
  }
  async function logout(){
    try{await centralApp().auth().signOut();}catch(_){}
    sessionStorage.removeItem(KEY);localStorage.removeItem(KEY);
    ['j_tid','j_tnome','j_role','j_cargo','j_cargo_acesso','j_actor_type','j_nome','j_admin_email','j_fid','j_firebase_config'].forEach(k=>sessionStorage.removeItem(k));
  }
  function lastUser(){return localStorage.getItem('j_last_user')||'';}
  function sessionIdentity(s){return String(s?.funcionarioId||s?.email||s?.login||s?.name||'usuario').replace(/[^a-z0-9_-]/gi,'_');}

  window.CentralAuth={norm,roleAllowed,centralApp,centralDb,activeDb,login,logout,loadSession,lastUser,sessionIdentity};
})();
