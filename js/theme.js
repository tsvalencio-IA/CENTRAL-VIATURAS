'use strict';

(function(){
  const KEY='CENTRAL_VIATURAS_THEME';
  function preferred(){
    const saved=localStorage.getItem(KEY);
    if(saved==='light'||saved==='dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  function apply(theme){
    const t=theme==='light'?'light':'dark';
    document.documentElement.dataset.theme=t;
    localStorage.setItem(KEY,t);
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute('content',t==='light'?'#f4f7fb':'#0b1118');
    document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
      btn.textContent=t==='dark'?'☀ CLARO':'☾ ESCURO';
      btn.setAttribute('aria-label',t==='dark'?'Ativar tema claro':'Ativar tema escuro');
      btn.title=t==='dark'?'Ativar tema claro':'Ativar tema escuro';
    });
  }
  function toggle(){ apply(document.documentElement.dataset.theme==='light'?'dark':'light'); }
  function goBack(target){
    try{
      if(document.referrer && history.length>1){ history.back(); return; }
    }catch(_){}
    location.href=target||'index.html';
  }
  apply(preferred());
  document.addEventListener('DOMContentLoaded',()=>{
    apply(document.documentElement.dataset.theme||preferred());
    document.querySelectorAll('[data-theme-toggle]').forEach(btn=>btn.addEventListener('click',toggle));
    document.querySelectorAll('[data-back]').forEach(btn=>btn.addEventListener('click',()=>goBack(btn.dataset.back||'index.html')));
  });
  window.CentralTheme={apply,toggle,goBack,current:()=>document.documentElement.dataset.theme||preferred()};
})();
