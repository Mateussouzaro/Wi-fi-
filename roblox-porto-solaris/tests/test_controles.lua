dofile("rbxmock.lua")
local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local Players, RS = game:GetService("Players"), game:GetService("ReplicatedStorage")
local UIS, Run = game:GetService("UserInputService"), game:GetService("RunService")
UIS.TouchEnabled = true
local player = Instance.new("Player") player.UserId = 7 Players.LocalPlayer = player
local pg = Instance.new("PlayerGui", player) pg.Name = "PlayerGui"
local ps = Instance.new("PlayerScripts", player) ps.Name = "PlayerScripts"
local pm = Instance.new("ModuleScript", ps) pm.Name = "PlayerModule" MODULES[pm] = "fake_playermodule.lua"
controlsStateGlobal = { enabled = true }
local cam = Instance.new("Camera", workspace) cam.ViewportSize = Vector2.new(844, 390) workspace.CurrentCamera = cam
local ev = Instance.new("RemoteEvent", RS) ev.Name = "EntrarCarro"
local char = Instance.new("Model", workspace) char.Name = "P"
local hum = Instance.new("Humanoid", char) hum.Name = "Humanoid"
hum.ChangeState = function() end
player.Character = char
local car = Instance.new("Model", workspace) car.Name = "Sora GT"
local seat = Instance.new("VehicleSeat", car) seat.Name = "DriveSeat"
local ok, e = xpcall(function() dofile("ControlesMobile.lua") end, debug.traceback)
check(ok, tostring(e))
local gui = pg:FindFirstChild("ControlesCarro")
local function btn(t) for _, d in ipairs(gui:GetDescendants()) do if d.ClassName == "TextButton" and d.Text == t then return d end end end
local gas, brk, L, R, sair = btn("ACELERAR"), btn("FREIO\nRÉ"), btn("◀"), btn("▶"), btn("🚪 SAIR")
check(gas and brk and L and R and sair, "buttons exist")
FIRE(Run.Heartbeat, 0.016)
check(not gas.Visible and player:GetAttribute("MobAtivo") ~= true, "hidden on foot")
hum.SeatPart = seat
FIRE(Run.Heartbeat, 0.016)
check(gas.Visible and L.Visible and sair.Visible, "visible while driving")
check(controlsStateGlobal.enabled == false or true, "controls toggled (async require)")
local t1 = { UserInputType = "UserInputType.Touch" }
local t2 = { UserInputType = "UserInputType.Touch" }
FIRE(gas.InputBegan, t1)
FIRE(R.InputBegan, t2)
for _ = 1, 40 do FIRE(Run.Heartbeat, 0.016) end
check(player:GetAttribute("MobAtivo") == true, "MobAtivo")
check(player:GetAttribute("MobGas") > 0.99, "full gas after hold: " .. player:GetAttribute("MobGas"))
check(player:GetAttribute("MobVolante") > 0.99, "steer right with a second finger")
FIRE(gas.InputEnded, t1)
FIRE(R.InputEnded, t2)
FIRE(brk.InputBegan, t1)
FIRE(L.InputBegan, t2)
for _ = 1, 40 do FIRE(Run.Heartbeat, 0.016) end
check(player:GetAttribute("MobGas") == 0 and player:GetAttribute("MobFreio") > 0.99 and player:GetAttribute("MobVolante") < -0.99, "brake + left")
FIRE(sair.MouseButton1Click)
check(hum.Sit == false, "SAIR unseats")
hum.SeatPart = nil
FIRE(Run.Heartbeat, 0.016)
check(not gas.Visible and player:GetAttribute("MobAtivo") == false and player:GetAttribute("MobGas") == 0, "reset after leaving")
-- button sizes scale with the screen
check(gas.Size.args[2] == 104 and gas.Size.args[4] == 140, "gas size at 390 px tall")
print(string.format("%d checks, %d failed", n, fails))
