-- ControlesMobile (LocalScript): on-screen car controls.
-- ENTRAR button next to a car (every device). While driving on a phone/tablet:
-- ACELERAR and FREIO/RÉ pedals, ◀ ▶ steering and SAIR. The A-Chassis "Drive" script of
-- each car reads the pedals from the player's attributes MobAtivo/MobGas/MobFreio/MobVolante.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local Entrar = ReplicatedStorage:WaitForChild("EntrarCarro")

local function rgb(r, g, b) return Color3.fromRGB(r, g, b) end

local gui = Instance.new("ScreenGui")
gui.Name = "ControlesCarro"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 15
gui.Parent = player:WaitForChild("PlayerGui")

local root = Instance.new("Frame")
root.Size = UDim2.new(1, 0, 1, 0)
root.BackgroundTransparency = 1
root.Parent = gui

local ALL = {}
-- a round touch button that reports press/release for every finger
local function pad(text, size, pos, anchor, color, textSize)
	local b = Instance.new("TextButton")
	b.Size = size
	b.Position = pos
	b.AnchorPoint = anchor
	b.BackgroundColor3 = color
	b.BackgroundTransparency = 0.25
	b.Text = text
	b.TextColor3 = rgb(255, 255, 255)
	b.TextSize = textSize or 18
	b.Font = Enum.Font.GothamBlack
	b.TextWrapped = true
	b.AutoButtonColor = false
	b.Visible = false
	b.Parent = root
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 18)
	c.Parent = b
	local s = Instance.new("UIStroke")
	s.Color = rgb(255, 255, 255)
	s.Transparency = 0.6
	s.Thickness = 2
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	s.Parent = b
	local sc = Instance.new("UIScale")
	sc.Parent = b
	local held = {}
	local state = { down = false }
	local function update()
		local any = next(held) ~= nil
		if any ~= state.down then
			state.down = any
			b.BackgroundTransparency = any and 0.02 or 0.25
			TweenService:Create(sc, TweenInfo.new(0.08), { Scale = any and 0.92 or 1 }):Play()
		end
	end
	b.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			held[input] = true
			update()
		end
	end)
	b.InputEnded:Connect(function(input)
		held[input] = nil
		update()
	end)
	state.reset = function() held = {} update() end
	state.button = b
	state.size, state.pos = size, pos
	table.insert(ALL, state)
	return state
end

local BLUE, GREEN, RED, DARK = rgb(40, 110, 220), rgb(40, 170, 90), rgb(200, 50, 60), rgb(25, 27, 33)
local left = pad("◀", UDim2.new(0, 96, 0, 96), UDim2.new(0, 22, 1, -24), Vector2.new(0, 1), DARK, 40)
local right = pad("▶", UDim2.new(0, 96, 0, 96), UDim2.new(0, 132, 1, -24), Vector2.new(0, 1), DARK, 40)
local gas = pad("ACELERAR", UDim2.new(0, 104, 0, 140), UDim2.new(1, -22, 1, -24), Vector2.new(1, 1), GREEN, 16)
local brake = pad("FREIO\nRÉ", UDim2.new(0, 96, 0, 100), UDim2.new(1, -140, 1, -24), Vector2.new(1, 1), RED, 16)
local exitBtn = pad("🚪 SAIR", UDim2.new(0, 96, 0, 44), UDim2.new(1, -22, 1, -176), Vector2.new(1, 1), DARK, 15)
local enterBtn = pad("🚗 ENTRAR", UDim2.new(0, 150, 0, 60), UDim2.new(1, -22, 1, -140), Vector2.new(1, 1), BLUE, 20)
local DRIVE = { left, right, gas, brake, exitBtn }

-- everything a bit bigger on tablets, smaller on very short screens (sizes and the
-- distances from the screen corners grow together, so buttons stay in their corners)
local function fit()
	local k = math.clamp(camera.ViewportSize.Y / 390, 0.8, 1.35)
	for _, st in ipairs(ALL) do
		st.button.Size = UDim2.new(0, st.size.X.Offset * k, 0, st.size.Y.Offset * k)
		st.button.Position = UDim2.new(st.pos.X.Scale, st.pos.X.Offset * k, st.pos.Y.Scale, st.pos.Y.Offset * k)
	end
end
camera:GetPropertyChangedSignal("ViewportSize"):Connect(fit)
fit()

-- the Roblox thumbstick/jump would sit under our pedals: switched off while driving
local controls = nil
task.spawn(function()
	pcall(function()
		controls = require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule")):GetControls()
	end)
end)

local function humanoid()
	return player.Character and player.Character:FindFirstChildOfClass("Humanoid")
end
local function drivingSeat()
	local h = humanoid()
	local s = h and h.SeatPart
	if s and s:IsA("VehicleSeat") and s.Name == "DriveSeat" then return s end
	return nil
end

exitBtn.button.MouseButton1Click:Connect(function()
	local h = humanoid()
	if h then
		h.Sit = false
		h:ChangeState(Enum.HumanoidStateType.Jumping)
	end
end)

-- nearest free car seat (own car or a car without an owner)
local nearSeat = nil
local function findNearSeat()
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart")
	if not hrp then return nil end
	local best, bd = nil, 12
	for _, m in ipairs(workspace:GetChildren()) do
		if m:IsA("Model") then
			local s = m:FindFirstChild("DriveSeat")
			if s and s:IsA("VehicleSeat") and not s.Disabled and not s.Occupant then
				local owner = m:GetAttribute("Dono")
				if owner == nil or owner == player.UserId then
					local d = (s.Position - hrp.Position).Magnitude
					if d < bd then best, bd = s, d end
				end
			end
		end
	end
	return best
end
enterBtn.button.MouseButton1Click:Connect(function()
	if nearSeat then Entrar:FireServer(nearSeat) end
end)
task.spawn(function()
	while true do
		task.wait(0.3)
		if drivingSeat() then
			nearSeat = nil
		else
			nearSeat = findNearSeat()
		end
		enterBtn.button.Visible = nearSeat ~= nil
	end
end)

-- pedals → smooth values for the car's Drive script
local touchDevice = UserInputService.TouchEnabled
local wasDriving = false
local g, b, st = 0, 0, 0
local function approach(v, target, rate, dt)
	if v < target then return math.min(target, v + rate * dt) end
	return math.max(target, v - rate * dt)
end
RunService.Heartbeat:Connect(function(dt)
	local seat = drivingSeat()
	local driving = seat ~= nil and touchDevice
	if driving ~= wasDriving then
		wasDriving = driving
		for _, p in ipairs(DRIVE) do
			p.reset()
			p.button.Visible = driving
		end
		if controls then pcall(function() if driving then controls:Disable() else controls:Enable() end end) end
		if not driving then
			g, b, st = 0, 0, 0
			player:SetAttribute("MobAtivo", false)
			player:SetAttribute("MobGas", 0)
			player:SetAttribute("MobFreio", 0)
			player:SetAttribute("MobVolante", 0)
		end
	end
	if not driving then return end
	g = approach(g, gas.down and 1 or 0, gas.down and 3 or 6, dt)
	b = approach(b, brake.down and 1 or 0, 6, dt)
	local steerTarget = (right.down and 1 or 0) - (left.down and 1 or 0)
	st = approach(st, steerTarget, steerTarget == 0 and 8 or 5, dt)
	player:SetAttribute("MobAtivo", true)
	player:SetAttribute("MobGas", g)
	player:SetAttribute("MobFreio", b)
	player:SetAttribute("MobVolante", st)
end)
