dofile("rbxmock.lua")
local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local Players, RS = game:GetService("Players"), game:GetService("ReplicatedStorage")
-- what the server publishes (same names as Server.lua)
for _, r in ipairs({ "SpawnCarBloco", "Notify", "Progress", "Pose", "Score", "Evento", "Voto", "Paint" }) do
	local e = Instance.new("RemoteEvent", RS) e.Name = r
end
-- the dealership module has the name "Catalogo" too (the clash that broke the HUD)
local mod = Instance.new("ModuleScript", RS) mod.Name = "Catalogo"
local cat = Instance.new("StringValue", RS) cat.Name = "CatalogoBlocos"
cat.Value = "solaris|Solaris GT|0|120|34|Esportivo;luxo|Luxo S|300|115|30|Luxo"
local places = Instance.new("StringValue", RS) places.Name = "Lugares"
places.Value = "meet|Encontro Solaris|105|0|75;posto|Posto Aurora|260|-60|35"
local d = Instance.new("StringValue", RS) d.Name = "Drift" d.Value = "320|20|140|90"
local c = Instance.new("StringValue", RS) c.Name = "Corrida" c.Value = "0,270;410,262;-10,270"
local player = Instance.new("Player") Players.LocalPlayer = player
local pg = Instance.new("PlayerGui", player) pg.Name = "PlayerGui"
local cam = Instance.new("Camera", workspace) cam.ViewportSize = Vector2.new(844, 390) workspace.CurrentCamera = cam
local ok, e = xpcall(function() dofile("Client.lua") end, debug.traceback)
check(ok, "Client.lua runs to the end: " .. tostring(e))
local gui = pg:FindFirstChild("PortoSolaris")
check(gui ~= nil, "main GUI")
local hud = gui and gui:FindFirstChild("HUD")
check(hud ~= nil, "HUD frame named HUD (the settings gear follows it)")
local texts = {}
for _, d2 in ipairs(gui:GetDescendants()) do if d2.Text then texts[d2.Text] = d2 end end
for _, t in ipairs({ "🚗", "😎", "📷", "❓", "JOGAR", "👋 Acenar", "💃 Dançar", "🚗 Encostar no carro", "🛋️ Sentar no capô", "✨ Flutuar" }) do
	check(texts[t] ~= nil, "button " .. t)
end
-- pressing JOGAR shows the HUD
if texts["JOGAR"] then FIRE(texts["JOGAR"].MouseButton1Click) end
check(hud and hud.Visible == true, "HUD visible after JOGAR")
print(string.format("%d checks, %d failed", n, fails))
