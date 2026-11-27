dofile("rbxmock.lua")
local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local Players = game:GetService("Players")
local RS = game:GetService("ReplicatedStorage")
local UIS = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local Catalogo = require(RS.Catalogo)

-- local player with data, character and GUI
local player = Instance.new("Player")
player.Name = "Tester"
player.UserId = 1
Players.LocalPlayer = player
local pg = Instance.new("PlayerGui", player) pg.Name = "PlayerGui"
local ps = Instance.new("PlayerScripts", player) ps.Name = "PlayerScripts"
local pm = Instance.new("ModuleScript", ps) pm.Name = "PlayerModule"
controlsStateGlobal = { enabled = true }
local controlsState = controlsStateGlobal
MODULES[pm] = "fake_playermodule.lua"
local ls = Instance.new("Folder", player) ls.Name = "leaderstats"
local cred = Instance.new("IntValue", ls) cred.Name = "Creditos" cred.Value = 1000
player:SetAttribute("Carros", "|Superbo|Pontis G8|")
player:SetAttribute("Cores", "Superbo=3")
local char = Instance.new("Model", workspace) char.Name = "Tester"
local hum = Instance.new("Humanoid", char) hum.Name = "Humanoid"
local hrp = Instance.new("Part", char) hrp.Name = "HumanoidRootPart"
player.Character = char
local mainGui = Instance.new("ScreenGui", pg) mainGui.Name = "PortoSolaris" mainGui.Enabled = true
local camera = Instance.new("Camera", workspace) camera.Name = "Camera"
camera.ViewportSize = Vector2.new(844, 390)
camera.CameraType = "CameraType.Custom"
workspace.CurrentCamera = camera

-- remotes, studio and the spawner's display models
local loja = Instance.new("Folder", RS) loja.Name = "Loja"
local abrir = Instance.new("RemoteEvent", loja) abrir.Name = "Abrir"
local calls = {}
local function rf(name, fn) local r = Instance.new("RemoteFunction", loja) r.Name = name r.InvokeServer = function(_, ...) table.insert(calls, name) return fn(...) end end
local owned = {}
rf("Comprar", function(nome, cor)
	local ok, why, price, missing = Catalogo.validarCompra(cred.Value, owned, nome)
	if not ok then return false, why, missing end
	cred.Value = cred.Value - price
	owned[nome] = true
	player:SetAttribute("Carros", player:GetAttribute("Carros") .. nome .. "|")
	return true, "ok", cred.Value
end)
rf("SalvarCor", function(nome, cor) return true end)
rf("Dirigir", function(nome) return true end)
local est = Instance.new("CFrameValue", RS) est.Name = "Estudio" est.Value = CFrame.new(-220, 0.9, 40)
local svm = Instance.new("Folder", RS) svm.Name = "SpawnerViewportModels"
for _, nome in ipairs(Catalogo.lista()) do
	local m = Instance.new("Model", svm) m.Name = nome
	local body = Instance.new("Part", m) body.Name = "Paint" body.Size = Vector3.new(7, 3, 16) body.Color = Color3.fromRGB(200, 200, 200)
	local wheel = Instance.new("Part", m) wheel.Name = "Wheel" wheel.Size = Vector3.new(1, 3, 3) wheel.CFrame = CFrame.new(3, -1, 5)
	local cb = Instance.new("Part", m) cb.Name = "_CenterBrick" cb.Size = Vector3.new(1, 1, 1)
	m.PrimaryPart = cb
	Catalogo.marcarPintura(m)
end

-- run the LocalScript
local ok, err = xpcall(function() dofile("Concessionaria.lua") end, debug.traceback)
check(ok, "script loads: " .. tostring(err))
local gui = pg:FindFirstChild("SolarisMotors")
check(gui ~= nil, "ScreenGui created")
local function find(pred)
	for _, d in ipairs(gui:GetDescendants()) do if pred(d) then return d end end
end
local function byText(t) return find(function(d) return d.ClassName == "TextButton" and type(d.Text) == "string" and string.find(d.Text, t, 1, true) end) end
local function click(b) check(b ~= nil, "button exists") if b then FIRE(b.MouseButton1Down) FIRE(b.MouseButton1Click) end end
local cat = find(function(d) return d.ClassName == "Frame" and d.Size and d.Size.args and d.Size.args[2] == 900 end)
-- scale for a 844x390 phone
local sc = cat and cat:FindFirstChildOfClass("UIScale")
check(sc and sc.Scale > 0.5 and sc.Scale < 0.8, "UIScale for 844x390: " .. tostring(sc and sc.Scale))

-- 1) open the catalogue from the server event
FIRE(abrir.OnClientEvent)
check(cat.Visible == true, "catalogue visible")
check(mainGui.Enabled == false, "main HUD hidden while open")
local cards = {}
for _, d in ipairs(gui:GetDescendants()) do if d.ClassName == "TextButton" and Catalogo.info(d.Name) then cards[d.Name] = d end end
local nc = 0 for _ in pairs(cards) do nc = nc + 1 end
check(nc == 13, "13 cards, got " .. nc)
check(cards["Sora GT"]:FindFirstChildOfClass("ViewportFrame"):FindFirstChildOfClass("Model") ~= nil, "card has a 3D model")
-- 2) category filter + search
click(byText("Esportivos"))
check(cards["Sora GT"].Visible and not cards["Superbo"].Visible, "category filter")
click(byText("Todos"))
check(cards["Superbo"].Visible, "Todos shows all")
local search = find(function(d) return d.ClassName == "TextBox" end)
search.Text = "bella"
FIRE(search:GetPropertyChangedSignal("Text"))
check(cards["Mistral W16"].Visible and not cards["Sora GT"].Visible, "search by maker")
search.Text = ""
FIRE(search:GetPropertyChangedSignal("Text"))

-- 3) inspect a car: preview in the studio, camera scriptable, controls disabled
click(cards["Sora GT"])
local preview = workspace:FindFirstChild("PreviewSolaris")
check(preview ~= nil, "preview spawned")
check(cat.Visible == false, "catalogue hidden in inspection")
FIRE(RunService.RenderStepped, 0.016)
check(camera.CameraType == "CameraType.Scriptable", "camera scriptable")
check(controlsState.enabled == false, "controls disabled")
local bcf, size = preview:GetBoundingBox()
check(math.abs((bcf.Position.Y - size.Y / 2) - 0.9) < 0.01, "car rests on the turntable top")
check(math.abs(bcf.Position.X + 220) < 0.01 and math.abs(bcf.Position.Z - 40) < 0.01, "car centred on the turntable")
local c0 = camera.CFrame.Position
-- drag (touch) rotates, pinch zooms
local t = { UserInputType = "UserInputType.Touch", Position = Vector3.new(100, 100, 0) }
FIRE(UIS.InputBegan, t, false)
FIRE(UIS.InputChanged, { UserInputType = "UserInputType.Touch", Position = Vector3.new(220, 130, 0) }, false)
FIRE(UIS.InputEnded, t)
for _ = 1, 30 do FIRE(RunService.RenderStepped, 0.016) end
check((camera.CFrame.Position - c0).Magnitude > 1, "drag moves the camera")
local function camDist() return (camera.CFrame.Position - Vector3.new(-220, 0.9 + 1.26, 40)).Magnitude end
local d0 = camDist()
FIRE(UIS.TouchPinch, {}, 1, 0, "UserInputState.Begin", false)
FIRE(UIS.TouchPinch, {}, 1.6, 0, "UserInputState.Change", false)
for _ = 1, 60 do FIRE(RunService.RenderStepped, 0.016) end
check(camDist() < d0 - 0.5, "pinch zooms in: " .. d0 .. " -> " .. camDist())
-- camera never leaves the studio (walls about 32 studs away, ceiling 26)
for i = 1, 6 do
	FIRE(UIS.InputBegan, t, false)
	FIRE(UIS.InputChanged, { UserInputType = "UserInputType.Touch", Position = Vector3.new(100, 100 - i * 400, 0) }, false)
	FIRE(UIS.InputEnded, t)
end
click(byText("－")) click(byText("－")) click(byText("－"))
for _ = 1, 200 do FIRE(RunService.RenderStepped, 0.016) end
local cp = camera.CFrame.Position
check(cp.Y < 0.9 + 25.5 and math.abs(cp.X + 220) < 49 and cp.Z > 7 and cp.Z < 72, "camera inside the studio: " .. tostring(cp))
-- presets
for _, pn in ipairs({ "Frente", "Lateral", "Traseira", "3/4", "Roda", "Topo" }) do
	click(byText(pn))
	for _ = 1, 120 do FIRE(RunService.RenderStepped, 0.016) end
end
cp = camera.CFrame.Position
check(cp.Y > 5, "Topo preset looks from above")

-- 4) paint in real time, back to original
local paint = preview:FindFirstChild("Paint")
local swatchRed = find(function(d) return d.ClassName == "TextButton" and d.LayoutOrder == 1 and d.Parent and d.Parent.ClassName == "Frame" and d.Size == nil end)
local swatches = {}
for _, d in ipairs(gui:GetDescendants()) do
	if d.ClassName == "TextButton" and d.Parent and d.Parent:FindFirstChildOfClass("UIGridLayout") and d.Parent.ClassName == "Frame" then swatches[d.LayoutOrder] = d end
end
check(swatches[0] and swatches[14], "15 swatches (original + 14)")
click(swatches[4])
check(paint.Color == Catalogo.CORES[4].cor, "preview painted blue")
click(swatches[0])
check(paint.Color == paint:GetAttribute("CorOriginal"), "preview back to original")
click(swatches[1])

-- 5) cannot buy without money (1000 < 2200): no modal, no server call
local buyBtn = byText("FALTAM")
check(buyBtn ~= nil, "buy button shows missing credits")
click(buyBtn)
local modal = find(function(d) return d.ClassName == "Frame" and d.ZIndex == 30 end)
check(modal.Visible == false, "no confirmation without money")
check(#calls == 0, "no purchase call without money")
-- with money: confirmation, purchase, success, drive
cred.Value = 5000
FIRE(cred.Changed)
click(swatches[1]) -- (the credits listener lives in a task.spawn the mock does not run; any refresh shows the new state)
local comprar = byText("COMPRAR")
check(comprar ~= nil, "COMPRAR button")
click(comprar)
check(modal.Visible == true, "confirmation shown")
click(byText("CONFIRMAR"))
check(calls[1] == "Comprar", "server purchase called")
check(cred.Value == 2800, "credits deducted on the server: " .. cred.Value)
check(owned["Sora GT"], "car added to the garage")
check(modal.Visible == true and byText("DIRIGIR AGORA") ~= nil, "success dialog with DIRIGIR AGORA")
click(byText("DIRIGIR AGORA"))
check(calls[#calls] == "Dirigir", "drive called")
check(camera.CameraType == "CameraType.Custom", "camera restored")
check(mainGui.Enabled == true, "main HUD restored")
check(controlsState.enabled == true, "controls restored")
check(workspace:FindFirstChild("PreviewSolaris") == nil, "preview removed")

-- 6) owned car: save colour / drive; back button; close; dying closes everything
FIRE(abrir.OnClientEvent)
click(cards["Superbo"])
check(byText("SALVAR COR") ~= nil and byText("DIRIGIR") ~= nil, "owned car shows SALVAR COR / DIRIGIR")
check(paint and workspace:FindFirstChild("PreviewSolaris"):FindFirstChild("Paint").Color == Catalogo.CORES[3].cor, "saved colour applied to preview")
click(byText("SALVAR COR"))
check(calls[#calls] == "SalvarCor", "save colour called")
click(byText("VOLTAR"))
check(cat.Visible == true and workspace:FindFirstChild("PreviewSolaris") == nil, "back to catalogue")
click(byText("✕"))
check(cat.Visible == false and mainGui.Enabled == true and camera.CameraType == "CameraType.Custom", "close restores")
FIRE(abrir.OnClientEvent)
click(cards["Mistral W16"])
FIRE(player.CharacterAdded, char)
check(workspace:FindFirstChild("PreviewSolaris") == nil and mainGui.Enabled == true and controlsState.enabled, "respawn closes the dealership")

print(string.format("%d checks, %d failed", n, fails))
