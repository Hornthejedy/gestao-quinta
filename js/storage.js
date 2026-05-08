// Funções comuns de armazenamento. A compatibilidade principal com a versão 41 fica preservada dentro dos módulos.
(function(){
  'use strict';
  window.guardarDadosComChaveV42 = function(chave, dados){ localStorage.setItem(chave, JSON.stringify(dados)); };
  window.lerDadosComChaveV42 = function(chave, valorPadrao){ const v=localStorage.getItem(chave); return v ? JSON.parse(v) : (valorPadrao ?? []); };
})();
