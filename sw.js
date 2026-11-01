/* Roster service worker — makes the app open offline.
   Bump VERSION when you publish a new index.html to force a fresh shell. */
var VERSION='roster-v1';
var SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];

self.addEventListener('install',function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){return c.addAll(SHELL)}).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){return k!==VERSION}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});

function withTimeout(ms,p){
  return new Promise(function(res,rej){
    var t=setTimeout(function(){rej(new Error('timeout'))},ms);
    p.then(function(v){clearTimeout(t);res(v)},function(err){clearTimeout(t);rej(err)});
  });
}

self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);

  /* the page itself: newest from the network, cached copy if offline or slow */
  if(req.mode==='navigate'){
    e.respondWith(
      withTimeout(4000,fetch(req)).then(function(r){
        if(r&&r.ok){var copy=r.clone();caches.open(VERSION).then(function(c){c.put('index.html',copy)})}
        return r;
      }).catch(function(){
        return caches.match('index.html').then(function(m){return m||caches.match('./')});
      })
    );
    return;
  }

  /* Google Fonts: serve cached, refresh in the background */
  if(url.hostname==='fonts.googleapis.com'||url.hostname==='fonts.gstatic.com'){
    e.respondWith(caches.open(VERSION).then(function(c){
      return c.match(req).then(function(hit){
        var net=fetch(req).then(function(r){if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}).catch(function(){return hit});
        return hit||net;
      });
    }));
    return;
  }

  /* own files: cache first */
  if(url.origin===self.location.origin){
    e.respondWith(caches.match(req).then(function(hit){
      return hit||fetch(req).then(function(r){
        if(r&&r.ok){var copy=r.clone();caches.open(VERSION).then(function(c){c.put(req,copy)})}
        return r;
      });
    }));
  }
  /* everything else (the Anthropic API) goes straight to the network */
});
