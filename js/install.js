(()=>{
  'use strict';

  let deferredPrompt=null;
  const buttons=()=>Array.from(document.querySelectorAll('[data-install-app]'));

  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone===true ||
      document.referrer.startsWith('android-app://');
  }

  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function setState(state){
    buttons().forEach(btn=>{
      if(state==='installed'){
        btn.hidden=false;
        btn.disabled=true;
        btn.textContent='APP INSTALADO';
        btn.classList.add('installed');
        return;
      }
      if(state==='ready'){
        btn.hidden=false;
        btn.disabled=false;
        btn.textContent='INSTALAR APP';
        btn.classList.remove('installed');
        return;
      }
      if(state==='ios'){
        btn.hidden=false;
        btn.disabled=false;
        btn.textContent='INSTALAR APP';
        btn.classList.remove('installed');
        return;
      }
      btn.hidden=true;
    });
  }

  async function install(){
    if(isStandalone()){
      setState('installed');
      return;
    }

    if(deferredPrompt){
      deferredPrompt.prompt();
      const choice=await deferredPrompt.userChoice.catch(()=>null);
      if(choice?.outcome==='accepted') setState('installed');
      deferredPrompt=null;
      return;
    }

    if(isIOS()){
      alert('No iPhone/iPad: toque em Compartilhar e depois em “Adicionar à Tela de Início”.');
      return;
    }

    alert('Neste navegador, abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.');
  }

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    setState('ready');
  });

  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    setState('installed');
  });

  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-install-app]');
    if(!btn) return;
    event.preventDefault();
    install();
  });

  document.addEventListener('DOMContentLoaded',()=>{
    if(isStandalone()) setState('installed');
    else if(isIOS()) setState('ios');
    else setState('hidden');
  });
})();