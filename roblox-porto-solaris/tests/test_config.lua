dofile("rbxmock.lua")
local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local Players, RS, Lighting = game:GetService("Players"), game:GetService("ReplicatedStorage"), game:GetService("Lighting")
local saved = {}
local sc = Instance.new("RemoteEvent", RS) sc.Name = "SalvarConfig" sc.FireServer = function(_, s) table.insert(saved, s) end
local player = Instance.new("Player") Players.LocalPlayer = player
local pg = Instance.new("PlayerGui", player) pg.Name = "PlayerGui"
local cam = Instance.new("Camera", workspace) cam.ViewportSize = Vector2.new(844, 390) workspace.CurrentCamera = cam
local bloom = Instance.new("BloomEffect", Lighting) bloom.Enabled = true
local atmo = Instance.new("Atmosphere", Lighting) atmo.Density = 0.34
Lighting.GlobalShadows = true
local brick = Instance.new("Part", workspace) brick.Material = "Material.Brick" brick.Reflectance = 0.3 brick.Anchored = true
local car = Instance.new("Model", workspace) car.Name = "Carro"
Instance.new("VehicleSeat", car).Name = "DriveSeat"
local carMetal = Instance.new("Part", car) carMetal.Material = "Material.Metal" carMetal.Anchored = false
local flames = Instance.new("ParticleEmitter", carMetal) flames.Enabled = false
local neon = Instance.new("Part", workspace) neon.Material = "Material.Neon"
local decal = Instance.new("Decal", brick) decal.Transparency = 0
local pe = Instance.new("ParticleEmitter", brick) pe.Enabled = true
local light = Instance.new("PointLight", brick) light.Enabled = true
-- PostEffect / Light base classes in the mock
local oldIsA = brick.IsA
local ok, e = xpcall(function() dofile("Configuracoes.lua") end, debug.traceback)
check(ok, tostring(e))
local gui = pg:FindFirstChild("Configuracoes")
local function btn(t) for _, d in ipairs(gui:GetDescendants()) do if d.ClassName == "TextButton" and d.Text == t then return d end end end
-- saved "baixa" arrives from the server
player:SetAttribute("Config", "p=baixa;efeitos=0;sombras=0;texturas=0;luzes=0;particulas=0;transito=0")
FIRE(player:GetAttributeChangedSignal("Config"))
check(Lighting.GlobalShadows == false, "shadows off")
check(brick.Material == "Material.SmoothPlastic" and brick.Reflectance == 0, "materials simplified")
check(neon.Material == "Material.Neon", "neon untouched")
check(decal.Transparency == 1, "decals hidden")
check(pe.Enabled == false, "particles off")
check(light.Enabled == false, "lights off")
check(player:GetAttribute("CfgTransito") == false, "traffic off")
check(atmo.Density < 0.2, "haze reduced")
check(carMetal.Material == "Material.Metal", "car parts keep their material (mass/handling)")
-- choose ALTA: everything back
FIRE(btn("ALTA").MouseButton1Click)
check(Lighting.GlobalShadows == true and brick.Material == "Material.Brick" and brick.Reflectance == 0.3, "materials restored")
check(decal.Transparency == 0 and pe.Enabled and player:GetAttribute("CfgTransito") == true, "decals/particles/traffic restored")
check(math.abs(atmo.Density - 0.34) < 1e-6, "haze restored")
check(light.Enabled == true, "lights restored")
check(flames.Enabled == false, "emitters that ship disabled (exhaust flames) stay off")
check(saved[#saved]:find("p=alta", 1, true) ~= nil, "saved to the server: " .. tostring(saved[#saved]))
-- a single switch makes it a custom preset
local sw
for _, d in ipairs(gui:GetDescendants()) do if d.ClassName == "TextButton" and d.Text == "LIGADO" then sw = d break end end
FIRE(sw.MouseButton1Click)
check(saved[#saved]:find("p=c", 1, true) ~= nil, "custom preset saved as p=c")
print(string.format("%d checks, %d failed", n, fails))
