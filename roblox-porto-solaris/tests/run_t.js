const fengari = require('/tmp/luacheck/node_modules/fengari');
const {lua, lauxlib, lualib, to_luastring} = fengari;
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
lauxlib.luaL_dostring(L, to_luastring('local ok, e = xpcall(function() dofile("' + process.argv[2] + '") end, debug.traceback) if not ok then print("ERROR", e) end'));
