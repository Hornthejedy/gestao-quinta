(function(){
  'use strict';
  const PREFS_KEY = 'gestao_quinta_supabase_sync_v28';
  const PENDING_KEY = 'gestao_quinta_sync_pending_v1';
  const BRIDGE_URL = 'modulos/alertas.html?v=20260623-sync-1';
  const WATCHED_KEYS = ['gestao_quinta_v2', 'fertilizacao_app_v1', 'gestao_quinta_combustivel_v1', 'gestao_quinta_et_pomar_v1', 'et_pomar_porches_lagoa_history_v1'];
  let baseline = '';
  let dirty = false;
  let bridgeReady = false;
  let pushTimer = null;
  let startupComplete = false;

  function status(message, type){
    const el = document.getElementById('syncStatusShell');
    if (!el) return;
    el.textContent = message;
    el.className = 'sync-status-shell' + (type ? ' ' + type : '');
  }

  function prefs(){
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; }
    catch(_e) { return {}; }
  }

  function configured(){
    const p = prefs();
    return !!(p.url && p.anonKey && p.farmId && p.syncSecret);
  }

  function signature(){
    return WATCHED_KEYS.map(key => key + '=' + (localStorage.getItem(key) || '')).join('\n');
  }

  function setDirty(next){
    dirty = !!next;
    try { localStorage.setItem(PENDING_KEY, dirty ? '1' : '0'); } catch(_e) {}
    status(dirty ? 'Alterações por sincronizar' : 'Sincronizado', dirty ? 'pending' : '');
  }

  function hasPending(){
    try { return localStorage.getItem(PENDING_KEY) === '1'; }
    catch(_e) { return false; }
  }

  function bridge(){ return document.getElementById('syncBridgeFrame'); }

  function withBridge(){
    return new Promise((resolve, reject) => {
      const frame = bridge();
      if (!frame) return reject(new Error('Serviço de sincronização indisponível.'));
      const ready = function(){
        const api = frame.contentWindow;
        if (api && typeof api.supabasePush === 'function' && typeof api.supabasePull === 'function') {
          bridgeReady = true;
          resolve(api);
        } else reject(new Error('O serviço de sincronização não ficou disponível.'));
      };
      if (bridgeReady) return ready();
      frame.addEventListener('load', ready, { once:true });
      frame.src = BRIDGE_URL;
    });
  }

  function push(silent){
    if (!dirty || !configured()) return Promise.resolve();
    status('A enviar alterações para a cloud...');
    return withBridge().then(api => api.supabasePush({ silent: !!silent })).then(() => {
      baseline = signature();
      setDirty(false);
      status('Sincronizado agora');
    }).catch(error => {
      setDirty(true);
      status('Alterações por sincronizar', 'pending');
      if (!silent) console.warn('Não foi possível sincronizar:', error);
      throw error;
    });
  }

  function schedulePush(){
    if (!configured() || !prefs().autoSync) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(true).catch(() => {}), 2500);
  }

  function watchChanges(){
    const current = signature();
    if (current === baseline) return;
    baseline = current;
    if (!startupComplete) return;
    setDirty(true);
    schedulePush();
  }

  function pullOnStartup(afterReady){
    baseline = signature();
    if (!configured()) {
      status('Sincronização não configurada', 'pending');
      startupComplete = true;
      afterReady();
      return;
    }
    if (hasPending()) {
      setDirty(true);
      startupComplete = true;
      afterReady();
      return;
    }
    status('A receber dados da cloud...');
    withBridge().then(api => api.supabasePull()).then(() => {
      baseline = signature();
      setDirty(false);
      status('Dados recebidos da cloud');
    }).catch(() => {
      baseline = signature();
      status('Não foi possível receber a cloud', 'error');
    }).then(() => {
      startupComplete = true;
      afterReady();
    });
  }

  window.iniciarSincronizacaoGlobal = function(afterReady){
    pullOnStartup(afterReady);
    setInterval(watchChanges, 800);
    window.addEventListener('beforeunload', event => {
      if (!dirty) return;
      push(true).catch(() => {});
      event.preventDefault();
      event.returnValue = '';
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && dirty) push(true).catch(() => {});
    });
  };
})();
