const fengari = require('/tmp/luacheck/node_modules/fengari');
const fs = require('fs');
const {lua, lauxlib, lualib, to_luastring} = fengari;
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
lauxlib.luaL_dostring(L, to_luastring('local ok, e = xpcall(function() dofile("test_poses.lua") end, debug.traceback) if not ok then print("ERROR", e) end'));
lua.lua_getglobal(L, to_luastring("_DUMP")); fs.writeFileSync("pose_parts.json", lua.lua_tojsstring(L,-1) || "[]");
