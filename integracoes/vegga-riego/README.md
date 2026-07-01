# Integracao Vegga Riego

Servico local para permitir que a app da quinta envie o valor calculado do ET Pomar para o Vegga.

Limite atual: apenas programa `19 - Testes`, `SP1`, setor `S5`.

## Configuracao

Cria um ficheiro local chamado `config.local.json` nesta pasta:

```json
{
  "username": "utilizador-veggadigital",
  "password": "palavra-passe-veggadigital"
}
```

Este ficheiro esta ignorado pelo Git para nao publicar credenciais.

## Instalar

```powershell
npm install
```

## Abrir o servico local

```powershell
npm start
```

Com o servico aberto, o botao `Guardar configuracao` na aba `Vegga` tenta enviar o valor calculado da parcela `A05/S5` para o programa `19 - Testes`.

## Arranque automatico no Windows

O ficheiro `iniciar-servico-veggariego.vbs` inicia o servico em segundo plano.
Para arrancar automaticamente com o Windows, cria um atalho para esse ficheiro na pasta de Arranque do utilizador.

## Teste manual

```powershell
npm run save:testes-s5 -- 12.5 m3
```
