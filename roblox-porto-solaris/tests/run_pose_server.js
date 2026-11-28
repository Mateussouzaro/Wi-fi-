const fengari = require('/tmp/luacheck/node_modules/fengari');
const fs = require('fs');
const {lua, lauxlib, lualib, to_luastring} = fengari;
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const drv = `
dofile("rbxmock.lua")
local ok, e = xpcall(function() dofile("Server.lua") end, debug.traceback)
RESULT_ERR = ok and "" or tostring(e)
RESULT_WARN = table.concat(ERRORS, "\\n")
local ok2, e2 = xpcall(function() dofile("test_pose_server.lua") end, debug.traceback) if not ok2 then print("ERROR", e2) end
RESULT = "[]"
`;
if (lauxlib.luaL_dostring(L, to_luastring(drv)) !== 0) { console.log("DRIVER ERROR", lua.lua_tojsstring(L,-1)); process.exit(1); }
for (const g of ["RESULT_ERR","RESULT_WARN"]) { lua.lua_getglobal(L, to_luastring(g)); console.log(g+":", lua.lua_tojsstring(L,-1)); lua.lua_pop(L,1); }
lua.lua_getglobal(L, to_luastring("RESULT")); fs.writeFileSync(process.argv[2]||"parts.json", lua.lua_tojsstring(L,-1));
console.log("parts written");
