# Testes fora do Roblox

Rodam o código Lua do jogo num simulador mínimo do Roblox (`rbxmock.lua`) com o interpretador
Lua [fengari](https://www.npmjs.com/package/fengari) (Node).

```bash
npm install fengari            # ajuste o caminho do require nos run*.js
cp ../src/Catalogo.lua ../src/Server.lua ../src/Concessionaria.lua .
node run.js wrap.lua           # regras do catálogo, compra e pintura
node run_client.js             # interface da concessionária (abrir, filtrar, inspecionar, pintar, comprar, dirigir)
node run_server.js parts.json  # executa o Server.lua inteiro e exporta as peças do mapa
```

`render.html` + `shoot.js` desenham as peças exportadas com three.js (Playwright) para conferir o visual.
O simulador não roda física, rede nem modelos 3D dos carros: o teste final é sempre dentro do Roblox.
