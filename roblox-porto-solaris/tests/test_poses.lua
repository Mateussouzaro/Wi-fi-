dofile("rbxmock.lua")
local fails, n = 0, 0
local function check(c, m) n = n + 1 if not c then fails = fails + 1 print("FAIL: " .. m) end end
local Players, RS, Run = game:GetService("Players"), game:GetService("ReplicatedStorage"), game:GetService("RunService")
local remote = Instance.new("RemoteEvent", RS) remote.Name = "Pose"
local fired = {}
remote.FireServer = function(_, k) table.insert(fired, k == nil and "nil" or k) end
local V = Vector3.new
-- R15 block rig: {name, size, parent, C0 (in parent), C1 (in part), motor}
local RIG = {
	{ "LowerTorso", V(2, 0.6, 1), "HumanoidRootPart", V(0, -0.3, 0), V(0, 0, 0), "Root" },
	{ "UpperTorso", V(2, 1.6, 1), "LowerTorso", V(0, 0.3, 0), V(0, -0.8, 0), "Waist" },
	{ "Head", V(1.2, 1.2, 1.2), "UpperTorso", V(0, 0.8, 0), V(0, -0.6, 0), "Neck" },
	{ "RightUpperArm", V(0.9, 1.3, 0.9), "UpperTorso", V(1.45, 0.65, 0), V(0, 0.55, 0), "RightShoulder" },
	{ "RightLowerArm", V(0.8, 1.2, 0.8), "RightUpperArm", V(0, -0.6, 0), V(0, 0.55, 0), "RightElbow" },
	{ "LeftUpperArm", V(0.9, 1.3, 0.9), "UpperTorso", V(-1.45, 0.65, 0), V(0, 0.55, 0), "LeftShoulder" },
	{ "LeftLowerArm", V(0.8, 1.2, 0.8), "LeftUpperArm", V(0, -0.6, 0), V(0, 0.55, 0), "LeftElbow" },
	{ "RightUpperLeg", V(0.9, 1.4, 0.9), "LowerTorso", V(0.5, -0.3, 0), V(0, 0.65, 0), "RightHip" },
	{ "RightLowerLeg", V(0.8, 1.4, 0.8), "RightUpperLeg", V(0, -0.65, 0), V(0, 0.65, 0), "RightKnee" },
	{ "LeftUpperLeg", V(0.9, 1.4, 0.9), "LowerTorso", V(-0.5, -0.3, 0), V(0, 0.65, 0), "LeftHip" },
	{ "LeftLowerLeg", V(0.8, 1.4, 0.8), "LeftUpperLeg", V(0, -0.65, 0), V(0, 0.65, 0), "LeftKnee" },
}
local function makeChar(name, cf, pose)
	local char = Instance.new("Model", workspace) char.Name = name
	local hrp = Instance.new("Part", char) hrp.Name = "HumanoidRootPart" hrp.Size = V(2, 2, 1) hrp.CFrame = cf hrp.Transparency = 1
	local parts = { HumanoidRootPart = hrp }
	for _, r in ipairs(RIG) do
		local p = Instance.new("Part", char) p.Name = r[1] p.Size = r[2]
		p.Color = r[1]:find("Torso") and Color3.fromRGB(40, 90, 200) or (r[1] == "Head" and Color3.fromRGB(250, 210, 160) or Color3.fromRGB(60, 60, 70))
		parts[r[1]] = p
		local m = Instance.new("Motor6D", p) m.Name = r[6]
		m.Part0, m.Part1, m.C0, m.C1 = parts[r[3]], p, CFrame.new(r[4]), CFrame.new(r[5])
		m.Transform = CFrame.new()
	end
	char:SetAttribute("Pose", pose)
	return char, parts
end
-- forward kinematics like Roblox: Part1 = Part0 * C0 * Transform * C1^-1
local function solve(char, parts)
	for _, r in ipairs(RIG) do
		local p = parts[r[1]]
		local m = p:FindFirstChildOfClass("Motor6D")
		p.CFrame = m.Part0.CFrame * m.C0 * m.Transform * m.C1:Inverse()
	end
end
local plrs = {}
Players.GetPlayers = function() return plrs end
Players.LocalPlayer = Instance.new("Player")
local ok, e = xpcall(function() dofile("PosesCarro.lua") end, debug.traceback)
check(ok, tostring(e))
local chars = {}
for i, pose in ipairs({ "encostar", "capo", "flutuar" }) do
	local c, parts = makeChar("C" .. i, CFrame.new((i - 2) * 8, 3.1, 0), pose)
	local pl = Instance.new("Player") pl.Character = c
	table.insert(plrs, pl)
	chars[pose] = parts
end
for i = 1, 60 do FIRE(Run.Stepped, i / 60, 1 / 60) end
for _, pl in ipairs(plrs) do solve(pl.Character, chars[pl.Character:GetAttribute("Pose")]) end
-- sanity checks of the shapes
local cp = chars.capo
check(cp.RightLowerLeg.Position.Z < cp.LowerTorso.Position.Z - 0.8, "hood: legs go forward (-Z)")
check(cp.RightLowerLeg.Position.Y < cp.RightUpperLeg.Position.Y, "hood: shins hang down")
check(cp.RightLowerArm.Position.Z > cp.UpperTorso.Position.Z, "hood: hands behind the body")
local en = chars.encostar
check(en.RightLowerArm.Position.Z < en.UpperTorso.Position.Z - 0.3, "lean: forearms in front")
check(math.abs(en.RightLowerArm.Position.X - en.UpperTorso.Position.X) < 1.6, "lean: arms crossed towards the middle")
check(en.Head.Position.Z > en.LowerTorso.Position.Z, "lean: body leans back")
local fl = chars.flutuar
check(math.abs(fl.RightLowerLeg.Position.Z - fl.LowerTorso.Position.Z) < 1.6, "float: legs folded under the body")
check(math.abs(fl.RightUpperLeg.Position.X - fl.LowerTorso.Position.X) > 0.6, "float: knees apart")
print(string.format("%d checks, %d failed", n, fails))
-- dump for the renderer
_DUMP = DUMP()
