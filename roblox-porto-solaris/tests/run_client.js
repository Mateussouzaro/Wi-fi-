const fengari = require('/tmp/luacheck/node_modules/fengari');
const {lua, lauxlib, lualib, to_luastring} = fengari;
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const st = lauxlib.luaL_dostring(L, to_luastring('local ok, e = xpcall(function() dofile("test_client.lua") end, debug.traceback) if not ok then print("ERROR", e) end'));
if (st !== 0) console.log("ERR", lua.lua_tojsstring(L,-1));
