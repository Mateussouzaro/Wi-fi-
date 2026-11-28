-- PosesCarro (LocalScript): procedural poses for every character that has the
-- attribute "Pose" (set by the server): "encostar" (leaning on the car, arms crossed),
-- "capo" (sitting on the hood) and "flutuar" (floating, cross-legged, gently bobbing).
-- Joints are bent by writing Motor6D.Transform after the default animations each frame,
-- so the pose wins over idle/walk animations. Works for R15 and R6 characters: rotations
-- are written in body space (X right, Y up, -Z forward) and converted to each joint.
-- The local player leaves the pose by walking or jumping.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local PoseRemote = ReplicatedStorage:WaitForChild("Pose")
local A = CFrame.Angles

-- Motor6D names per rig, mapped to short keys
local JOINTS = {
	root = { "Root", "RootJoint" }, waist = { "Waist" }, neck = { "Neck" },
	lsh = { "LeftShoulder", "Left Shoulder" }, lel = { "LeftElbow" },
	rsh = { "RightShoulder", "Right Shoulder" }, rel = { "RightElbow" },
	lhip = { "LeftHip", "Left Hip" }, lknee = { "LeftKnee" },
	rhip = { "RightHip", "Right Hip" }, rknee = { "RightKnee" },
}

-- +X rotation swings a limb forward (and leans the body back for "root"),
-- +Z swings a right limb outward, -Z a left limb outward.
local POSES = {
	encostar = {
		root = A(0.16, 0, 0),
		neck = A(-0.08, 0.3, 0),
		rsh = A(0.35, 0, -0.25), rel = A(1.65, -0.9, 0),
		lsh = A(0.35, 0, 0.25), lel = A(1.65, 0.9, 0),
		rhip = A(0.12, 0, -0.16), rknee = A(-0.12, 0, 0),
		lhip = A(-0.06, 0, 0.04),
	},
	capo = {
		root = A(0.22, 0, 0),
		neck = A(-0.15, 0, 0),
		lhip = A(1.45, 0, -0.1), lknee = A(-1.25, 0, 0),
		rhip = A(1.35, 0, 0.12), rknee = A(-1.1, 0, 0),
		lsh = A(-0.55, 0, -0.3), lel = A(0.15, 0, 0),
		rsh = A(-0.55, 0, 0.3), rel = A(0.15, 0, 0),
	},
	flutuar = {
		neck = A(-0.12, 0, 0),
		lhip = A(1.4, 0, -0.75), lknee = A(-2.0, 0, 0),
		rhip = A(1.4, 0, 0.75), rknee = A(-2.0, 0, 0),
		lsh = A(0.45, 0, -0.45), lel = A(0.5, 0, 0),
		rsh = A(0.45, 0, 0.45), rel = A(0.5, 0, 0),
	},
}

local function findJoints(char)
	local found = {}
	for _, m in ipairs(char:GetDescendants()) do
		if m:IsA("Motor6D") then
			for key, names in pairs(JOINTS) do
				for _, n in ipairs(names) do
					if m.Name == n then found[key] = m end
				end
			end
		end
	end
	return found
end

-- The pose is applied to Motor6D.C0 (the joint's base), which no animation overwrites:
-- a rotation R about the joint, written in the parent part's space, gives
-- C0' = translation(C0) * R * rotation(C0)   (same as C0 * Transform with Q^-1 R Q).
-- Only this device changes C0 (it is not replicated); every client poses every character.
local function posedC0(base, rot, offset)
	return CFrame.new(base.Position + (offset or Vector3.zero)) * rot * (base - base.Position)
end

local cache = {} -- character -> joints
local baseC0 = {} -- motor -> original C0
local blend = {} -- character -> 0..1 (smooth in/out)
local lastKind = {} -- character -> pose being blended out

local function restore(joints)
	for _, m in pairs(joints) do
		if baseC0[m] and m.Parent then m.C0 = baseC0[m] end
		baseC0[m] = nil
	end
end

RunService.Stepped:Connect(function(t, dt)
	for _, plr in ipairs(Players:GetPlayers()) do
		local char = plr.Character
		if char then
			local kind = char:GetAttribute("Pose")
			local active = POSES[kind or ""] ~= nil
			if active then lastKind[char] = kind end
			local pose = POSES[lastKind[char] or ""]
			local b = blend[char] or 0
			b = math.clamp(b + (active and dt * 3 or -dt * 4), 0, 1)
			blend[char] = (b > 0 or active) and b or nil -- (no entry for characters that never pose)
			if pose and (b > 0 or not active) then
				local joints = cache[char]
				if not joints or not joints.root then
					joints = findJoints(char)
					cache[char] = joints
				end
				local bob = nil
				if lastKind[char] == "flutuar" then
					bob = { off = Vector3.new(0, math.sin(t * 1.6) * 0.35 * b, 0), rot = A(0, math.sin(t * 0.5) * 0.15 * b, 0) }
				end
				-- every joint is written (identity where the pose says nothing), so switching
				-- poses directly never leaves a bent knee behind
				for key in pairs(JOINTS) do
					local m = joints[key]
					if m and m.Parent then
						baseC0[m] = baseC0[m] or m.C0
						local rot = pose[key] or CFrame.identity
						local off = nil
						if key == "root" and bob then
							rot = rot * bob.rot
							off = bob.off
						end
						m.C0 = baseC0[m]:Lerp(posedC0(baseC0[m], rot, off), b)
					end
				end
				if b <= 0 and not active then
					restore(joints)
					lastKind[char] = nil
					blend[char] = nil
				end
			end
		end
	end
	for char, joints in pairs(cache) do
		if not char.Parent then
			for _, m in pairs(joints) do baseC0[m] = nil end
			cache[char] = nil
			blend[char] = nil
			lastKind[char] = nil
		end
	end
end)

-- leaving the pose: walking or jumping (keyboard, thumbstick or the jump button)
local leaving = false
local function leave()
	if leaving then return end
	local char = player.Character
	if char and char:GetAttribute("Pose") then
		leaving = true
		PoseRemote:FireServer(nil)
		task.delay(0.5, function() leaving = false end)
	end
end
local function watch(char)
	local hum = char:WaitForChild("Humanoid", 10)
	if not hum then return end
	hum:GetPropertyChangedSignal("Jump"):Connect(function()
		if hum.Jump then leave() end
	end)
	hum:GetPropertyChangedSignal("MoveDirection"):Connect(function()
		if hum.MoveDirection.Magnitude > 0.2 then leave() end
	end)
end
if player.Character then task.spawn(watch, player.Character) end
player.CharacterAdded:Connect(watch)
