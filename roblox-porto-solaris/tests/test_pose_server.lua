-- runs after Server.lua in the same mock (see run_pose_server.js)
local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local RS = game:GetService("ReplicatedStorage")
local pose = RS:FindFirstChild("Pose")
check(pose ~= nil, "Pose remote")
local V = Vector3.new
-- a car (front = -Z) at (500, 0, 600) and a player next to its right side
local car = Instance.new("Model", workspace) car.Name = "Sora GT"
local body = Instance.new("Part", car) body.Size = V(7, 3, 16) body.CFrame = CFrame.new(500, 2, 600)
local seat = Instance.new("VehicleSeat", car) seat.Name = "DriveSeat" seat.Size = V(2, 1, 2) seat.CFrame = CFrame.new(498.5, 2.5, 601)
local plr = Instance.new("Player") plr.Name = "P" plr.UserId = 5
local char = Instance.new("Model", workspace) char.Name = "P"
local hum = Instance.new("Humanoid", char) hum.Name = "Humanoid" hum.Health = 100
local hrp = Instance.new("Part", char) hrp.Name = "HumanoidRootPart" hrp.Size = V(2, 2, 1) hrp.CFrame = CFrame.new(506, 3.1, 598)
char.PrimaryPart = hrp
plr.Character = char
local clock = 1000
os.clock = function() return clock end
local function fire(kind) clock = clock + 2 FIRE(pose.OnServerEvent, plr, kind) end
fire("encostar")
check(char:GetAttribute("Pose") == "encostar", "lean pose set")
check(hum.PlatformStand == true, "PlatformStand on")
local w = hrp:FindFirstChild("PoseWeld")
check(w and w.Part1 == seat, "welded to the car seat")
check(math.abs(hrp.Position.X - (500 + 3.5 + 1.1)) < 0.6 and math.abs(hrp.Position.Y - 3.1) < 0.01, "standing against the right side: " .. tostring(hrp.Position))
check(hrp.CFrame.LookVector.X > 0.99, "facing away from the car")
fire(nil)
check(char:GetAttribute("Pose") == nil and hum.PlatformStand == false and hrp:FindFirstChild("PoseWeld") == nil, "leaving the pose cleans up")
fire("capo")
check(char:GetAttribute("Pose") == "capo", "hood pose")
check(hrp.Position.Z < 600 - 3 and math.abs(hrp.Position.Y - (3.5 + 1.1)) < 0.01, "on the hood (front, on top): " .. tostring(hrp.Position))
check(hrp.CFrame.LookVector.Z < -0.99, "facing forward over the front")
fire("flutuar")
check(char:GetAttribute("Pose") == "flutuar" and char:FindFirstChild("PoseAncora") ~= nil, "float anchor")
check(hrp:FindFirstChild("PoseAura") ~= nil, "aura particles")
check(hrp:FindFirstChild("PoseWeld") ~= nil and char:FindFirstChildOfClass("Part") ~= nil, "float weld")
fire(nil)
check(char:FindFirstChild("PoseAncora") == nil and hrp:FindFirstChild("PoseAura") == nil, "float cleaned up")
-- someone drives the car: refused; spam: refused
seat.Occupant = Instance.new("Humanoid")
fire("encostar")
check(char:GetAttribute("Pose") == nil, "occupied car refused")
seat.Occupant = nil
fire("encostar")
FIRE(pose.OnServerEvent, plr, "capo") -- same instant
check(char:GetAttribute("Pose") == nil, "spam within the cooldown is ignored (and the old pose was cleared)")
fire(nil)
-- far from any car: refused
hrp.CFrame = CFrame.new(5000, 3, 5000)
fire("capo")
check(char:GetAttribute("Pose") == nil and hum.PlatformStand == false, "no car nearby -> no pose")
fire("voar")
check(char:GetAttribute("Pose") == nil, "unknown pose rejected")
-- graphics settings are saved and validated
local sc = RS:FindFirstChild("SalvarConfig")
FIRE(sc.OnServerEvent, plr, "p=baixa;efeitos=0")
check(plr:GetAttribute("Config") == nil, "settings without loaded data are ignored")
print(string.format("%d checks, %d failed", n, fails))
