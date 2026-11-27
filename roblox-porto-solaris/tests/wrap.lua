arg = { "Catalogo.lua" }
local ok, e = xpcall(function() dofile("test_catalogo.lua") end, debug.traceback)
if not ok then print("TRACE", tostring(e)) end
