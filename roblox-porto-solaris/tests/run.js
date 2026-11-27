const fengari = require('/tmp/luacheck/node_modules/fengari');
const {lua, lauxlib, lualib, to_luastring} = fengari;
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
lua.lua_newtable(L); lua.lua_pushstring(L, to_luastring(process.argv[3]||"")); lua.lua_rawseti(L,-2,1); lua.lua_setglobal(L, to_luastring("arg"));
const st = lauxlib.luaL_dofile(L, to_luastring(process.argv[2]));
if (st !== 0) { console.log("ERROR:", lua.lua_tojsstring(L,-1)); process.exit(1); }
