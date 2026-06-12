
(function(){
  'use strict';
  const moduloFrameId = 'moduloFrame';
  const moduloPadrao = 'alertas';
  const modulos = {
    alertas: 'modulos/alertas.html?v=20260612-sanitario-1',
    dashboard: 'modulos/dashboard.html',
    culturas: 'modulos/culturas.html',
    fertilizacao: 'modulos/calculadora-fertilizacao.html?v=20260612-edicao-1',
    stocks: 'modulos/stocks.html',
    stocksQuinta: 'modulos/stocks-quinta.html',
    caixa: 'modulos/caixa.html',
    produtosAutorizados: 'modulos/produtos-autorizados.html',
    fitossanidade: 'modulos/fitossanidade.html',
    operacoes: 'modulos/operacoes.html',
    maquinas: 'modulos/tratores-maquinas.html',
    viaturas: 'modulos/viaturas.html',
    combustivel: 'modulos/combustivel.html?v=20260612-ordenacao-saldo-1',
    alfaias: 'modulos/alfaias.html',
    equipamentos: 'modulos/equipamentos.html',
    animais: 'modulos/animais.html?v=20260612-sanitario-1',
    relatorios: 'modulos/relatorios.html'
  };
  function frame(){ return document.getElementById(moduloFrameId); }
  function moduloActualWindow(){ const f=frame(); return f && f.contentWindow ? f.contentWindow : null; }
  window.abrirModulo = function(nome, ev){
    const f = frame();
    if (!f || !modulos[nome]) return;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = ev && ev.currentTarget ? ev.currentTarget : document.querySelector('[data-modulo="'+nome+'"]');
    if (btn) btn.classList.add('active');
    f.src = modulos[nome];
    try { localStorage.setItem('gestao_quinta_modulo_activo_v42', nome); } catch(_e) {}
    const status = document.getElementById('estadoModulo');
    if (status) status.textContent = 'Módulo activo: ' + (btn ? btn.textContent.trim() : nome);
  };
  window.executarNoModulo = function(nomeFuncao, args){
    const w = moduloActualWindow();
    if (w && typeof w[nomeFuncao] === 'function') return w[nomeFuncao].apply(w, args || []);
    alert('A função ainda não está disponível neste módulo: ' + nomeFuncao);
  };
  window.abrirPesquisaGlobal = function(){
    const input = document.getElementById('pesquisaGlobalInput');
    const termo = input ? input.value : '';
    const w = moduloActualWindow();
    if (w && typeof w.executarPesquisaGlobal === 'function') return w.executarPesquisaGlobal(termo);
    if (w && typeof w.abrirPesquisaGlobal === 'function') return w.abrirPesquisaGlobal();
    alert('Pesquisa global indisponível no módulo actual.');
  };
  window.executarPesquisaGlobalShell = function(valor){
    const w = moduloActualWindow();
    if (valor && valor.length > 2 && w && typeof w.executarPesquisaGlobal === 'function') w.executarPesquisaGlobal(valor);
  };
  window.exportarDadosShell = function(){ return window.executarNoModulo('exportarDados'); };
  window.importarDadosShell = function(event){
    const w = moduloActualWindow();
    if (w && typeof w.importarDados === 'function') return w.importarDados(event);
    alert('Importação indisponível no módulo actual.');
  };
  window.abrirBackupsShell = function(){ return window.executarNoModulo('abrirGestorBackupsV21'); };
  window.abrirRelatoriosShell = function(){ abrirModulo('relatorios'); };
  window.abrirSincronizacaoShell = function(){
    const w = moduloActualWindow();
    if (w) {
      try { w.location.hash = 'modalSupabaseSync'; return; } catch(_e) {}
    }
    alert('Sincronização indisponível no módulo actual.');
  };
  document.addEventListener('DOMContentLoaded', function(){
    let inicial = moduloPadrao;
    try { inicial = localStorage.getItem('gestao_quinta_modulo_activo_v42') || moduloPadrao; } catch(_e) {}
    if (!modulos[inicial]) inicial = moduloPadrao;
    window.abrirModulo(inicial);
  });
})();
