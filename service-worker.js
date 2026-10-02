const CACHE='valencio-sos-v1-4-13';
const ASSETS=[
  './','./index.html','./viatura.html','./v.html','./css/app.css','./css/v1411.css',
  './js/config.js','./js/theme.js','./js/install.js','./js/auth.js','./js/data.js',
  './js/index.js','./js/workflow-v1411.js','./js/ui-v1411.js','./js/viatura.js','./manifest-viaturas-v2.webmanifest?v=1.4.13'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  // Firebase, Vercel, CDN e outros serviços externos não entram no cache do PWA.
  if(url.origin!==self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(response=>{
      if(response && response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});
      }
      return response;
    }).catch(()=>caches.match(event.request))
  );
});
