dofile("rbxmock.lua")
local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local cam = Instance.new("Camera", workspace) cam.CFrame = CFrame.new(0, 50, 0) workspace.CurrentCamera = cam
_G = _G
local ok, e = xpcall(function() dofile("Cidade.lua") end, debug.traceback)
check(ok, tostring(e))
local C = _G.CidadeTeste
-- clockwise square: (-1000,-1200) -> (1000,-1200) -> (1000,270) -> (-1000,270)
local sq = { Vector3.new(-1000, 0, -1200), Vector3.new(1000, 0, -1200), Vector3.new(1000, 0, 270), Vector3.new(-1000, 0, 270) }
local off = C.offsetPath(sq, 7, true)
-- going +X along z=-1200 the LEFT side (Hong Kong) is -Z (north edge of the road)
check(math.abs(off[1].Z - (-1207)) < 1e-6 and math.abs(off[2].Z - (-1207)) < 1e-6, "keep left on the north road: " .. tostring(off[1]))
check(math.abs(off[2].X - 1007) < 1e-6, "corner miter on the east road: " .. tostring(off[2]))
local r = C.build(off, true, false)
check(math.abs(r.total - 2 * (2014 + 1484)) < 1e-6, "loop length " .. r.total)
check((C.pointAt(r, 0) - off[1]).Magnitude < 1e-6 and (C.pointAt(r, r.total) - off[1]).Magnitude < 1e-6, "loop wraps")
-- ping-pong for trams: comes back
local pp = C.build({ Vector3.new(-900, 0, -140), Vector3.new(900, 0, -140) }, false, true)
check(pp.total == 3600 and (C.pointAt(pp, 2700) - Vector3.new(0, 0, -140)).Magnitude < 1e-6, "tram goes back")
-- a vehicle registered from attributes moves along the road and faces its direction
local folder = Instance.new("Folder", workspace) folder.Name = "Transito"
local m = Instance.new("Model", folder) m.Name = "Taxi"
local root = Instance.new("Part", m) root.CFrame = CFrame.new(0, 2.2, 0) root.Size = Vector3.new(6, 2, 15)
root.PivotOffset = root.CFrame:Inverse()
m.PrimaryPart = root
m:SetAttribute("Rota", "-1000,-1200;1000,-1200;1000,270;-1000,270")
m:SetAttribute("Vel", 70) m:SetAttribute("Fase", 0) m:SetAttribute("Faixa", 7) m:SetAttribute("Y", 0)
C.register(m)
local mv = C.movers[m]
check(mv ~= nil, "registered")
local cf = C.placeAt(mv, 10) -- 700 studs along the north road
check(math.abs(cf.Position.X - (-1007 + 700 + 0)) < 8 and math.abs(cf.Position.Z + 1207) < 0.01, "position after 10 s: " .. tostring(cf.Position))
check(cf.LookVector.X > 0.99, "faces +X")
MOCK_TIME = 10
cam.CFrame = CFrame.new(-300, 10, -1200)
FIRE(game:GetService("RunService").RenderStepped)
check((m:GetPivot().Position - cf.Position).Magnitude < 0.01, "model moved by RenderStepped")
check(math.abs(root.Position.Y - (2.2 + 0.25)) < 0.01, "body stays above the road (pivot on the ground)")
-- turning smoothly at the corner (look-ahead)
local corner = (2014) / 70
local cfc = C.placeAt(mv, corner - 0.05)
check(cfc.LookVector.Z > 0.1 and cfc.LookVector.X > 0.1, "starts turning before the corner")
-- traffic lights never both green
local both = false
for t = 0, 48, 0.5 do if C.lightState("A", t) == "g" and C.lightState("B", t) == "g" then both = true end end
check(not both, "A and B are never green together")
print(string.format("%d checks, %d failed", n, fails))
