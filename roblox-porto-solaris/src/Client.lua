-- Porto Solaris — client: cinematic intro, tutorial, garage, driving, speedometer,
-- poses, photo mode, places to discover and notifications.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local SpawnCar = ReplicatedStorage:WaitForChild("SpawnCarBloco")
local Notify = ReplicatedStorage:WaitForChild("Notify")
local Progress = ReplicatedStorage:WaitForChild("Progress")
local catalogueValue = ReplicatedStorage:WaitForChild("Catalogo")
local placesValue = ReplicatedStorage:WaitForChild("Lugares")

local function rgb(r, g, b) return Color3.fromRGB(r, g, b) end
local GOLD = rgb(255, 200, 60)
local DARK = rgb(14, 15, 18)

-- ------------------------------------------------------------------ sounds (built into the client)
local function snd(id, vol)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = vol
	s.Parent = SoundService
	return s
end
local sClick = snd("rbxasset://sounds/electronicpingshort.wav", 0.35)
local sDone = snd("rbxasset://sounds/button.wav", 0.7)
local sWhoosh = snd("rbxasset://sounds/action_falling.mp3", 0.25)

-- ------------------------------------------------------------------ data from the server
local CARS = {}
for entry in string.gmatch(catalogueValue.Value, "[^;]+") do
	local id, name, price, top, acc, tag = string.match(entry, "([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)|([^|]+)")
	table.insert(CARS, { id = id, name = name, price = tonumber(price), top = tonumber(top), acc = tonumber(acc), tag = tag })
end
local PLACES = {}
for entry in string.gmatch(placesValue.Value, "[^;]+") do
	local id, name, x, z, r = string.match(entry, "([^|]+)|([^|]+)|([^|]+)|([^|]+)|?([^|]*)")
	-- big places count as found a bit before their centre (the port's centre is inside a container stack)
	table.insert(PLACES, { id = id, name = name, pos = Vector3.new(tonumber(x), 0, tonumber(z)), near = math.max(40, (tonumber(r) or 0) * 0.6) })
end
local progress = { credits = 0, owned = {}, tutorial = false, found = {} }

-- ------------------------------------------------------------------ UI helpers
local gui = Instance.new("ScreenGui")
gui.Name = "PortoSolaris"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(o, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 12)
	c.Parent = o
end
local function stroke(o, col, th, tr)
	local s = Instance.new("UIStroke")
	s.Color = col
	s.Thickness = th or 2
	s.Transparency = tr or 0
	s.ApplyStrokeMode = Enum.ApplyStrokeMode.Border
	s.Parent = o
end
local function frame(parent, size, pos, color, tr)
	local f = Instance.new("Frame")
	f.Size = size
	f.Position = pos
	f.BackgroundColor3 = color or DARK
	f.BackgroundTransparency = tr or 0.15
	f.BorderSizePixel = 0
	f.Parent = parent
	return f
end
local function text(parent, t, size, pos, font, ts, color)
	local l = Instance.new("TextLabel")
	l.Size = size
	l.Position = pos
	l.BackgroundTransparency = 1
	l.Text = t
	l.Font = font or Enum.Font.GothamBold
	l.TextSize = ts or 16
	l.TextColor3 = color or Color3.new(1, 1, 1)
	l.TextWrapped = true
	l.Parent = parent
	return l
end
local function button(parent, t, size, pos, color)
	local b = Instance.new("TextButton")
	b.Size = size
	b.Position = pos
	b.BackgroundColor3 = color or rgb(30, 32, 38)
	b.BackgroundTransparency = 0.05
	b.Text = t
	b.Font = Enum.Font.GothamBlack
	b.TextSize = 16
	b.TextColor3 = Color3.new(1, 1, 1)
	b.AutoButtonColor = true
	b.Parent = parent
	corner(b, 12)
	b.MouseButton1Down:Connect(function()
		sClick:Play()
		local s0 = b.Size
		b.Size = UDim2.new(s0.X.Scale * 0.94, s0.X.Offset * 0.94, s0.Y.Scale * 0.94, s0.Y.Offset * 0.94)
		task.delay(0.08, function() b.Size = s0 end)
	end)
	return b
end
local function slideIn(f, from)
	local goal = f.Position
	f.Position = from
	f.Visible = true
	TweenService:Create(f, TweenInfo.new(0.45, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Position = goal }):Play()
end

-- ------------------------------------------------------------------ toast notifications
-- below the tutorial panel (y 64..160), so they never cover each other
local toastHolder = frame(gui, UDim2.new(0, 320, 0, 300), UDim2.new(0.5, -160, 0, 168), DARK, 1)
local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 6)
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.Parent = toastHolder
local function toast(msg, color)
	local t = frame(toastHolder, UDim2.new(1, 0, 0, 40), UDim2.new(0, 0, 0, 0), DARK, 0.1)
	corner(t, 20)
	stroke(t, color or GOLD, 2)
	local l = text(t, msg, UDim2.new(1, -20, 1, 0), UDim2.new(0, 10, 0, 0), Enum.Font.GothamBold, 15, color or GOLD)
	l.TextTransparency = 1
	TweenService:Create(l, TweenInfo.new(0.3), { TextTransparency = 0 }):Play()
	task.delay(3.5, function()
		TweenService:Create(l, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
		TweenService:Create(t, TweenInfo.new(0.4), { BackgroundTransparency = 1 }):Play()
		task.wait(0.45)
		t:Destroy()
	end)
end

-- ------------------------------------------------------------------ HUD: credits + main buttons
local hud = frame(gui, UDim2.new(1, 0, 1, 0), UDim2.new(0, 0, 0, 0), DARK, 1)
hud.Visible = false
local creditBox = frame(hud, UDim2.new(0, 170, 0, 42), UDim2.new(0, 14, 0, 56), DARK, 0.15)
corner(creditBox, 21)
stroke(creditBox, GOLD, 2)
local creditText = text(creditBox, "💰 0", UDim2.new(1, 0, 1, 0), UDim2.new(0, 0, 0, 0), Enum.Font.GothamBlack, 18, GOLD)
local placeText = text(hud, "", UDim2.new(0, 260, 0, 22), UDim2.new(0, 16, 0, 102), Enum.Font.GothamBold, 13, rgb(200, 210, 220))
placeText.TextXAlignment = Enum.TextXAlignment.Left

local bar = frame(hud, UDim2.new(0, 64, 0, 300), UDim2.new(1, -78, 0.5, -150), DARK, 1)
local barLayout = Instance.new("UIListLayout")
barLayout.Padding = UDim.new(0, 8)
barLayout.Parent = bar
local function sideButton(icon)
	local b = button(bar, icon, UDim2.new(0, 60, 0, 60), UDim2.new(0, 0, 0, 0), rgb(22, 24, 30))
	b.TextSize = 28
	stroke(b, rgb(255, 255, 255), 1.5, 0.6)
	return b
end
local bGarage = sideButton("🚗")
local bPose = sideButton("😎")
local bPhoto = sideButton("📷")
local bHelp = sideButton("❓")

-- speedometer (shown while driving)
local speedo = frame(hud, UDim2.new(0, 150, 0, 150), UDim2.new(1, -170, 1, -170), DARK, 0.2)
corner(speedo, 75)
stroke(speedo, GOLD, 3)
speedo.Visible = false
local speedText = text(speedo, "0", UDim2.new(1, 0, 0, 56), UDim2.new(0, 0, 0, 34), Enum.Font.GothamBlack, 46, Color3.new(1, 1, 1))
text(speedo, "km/h", UDim2.new(1, 0, 0, 20), UDim2.new(0, 0, 0, 90), Enum.Font.GothamBold, 14, GOLD)
local carNameText = text(speedo, "", UDim2.new(1, 0, 0, 18), UDim2.new(0, 0, 0, 112), Enum.Font.GothamBold, 11, rgb(190, 190, 200))

-- ------------------------------------------------------------------ tutorial panel
local tut = frame(gui, UDim2.new(0, 330, 0, 96), UDim2.new(0.5, -165, 0, 64), DARK, 0.1)
corner(tut, 16)
stroke(tut, GOLD, 2)
tut.Visible = false
local tutStep = text(tut, "", UDim2.new(1, -20, 0, 20), UDim2.new(0, 10, 0, 8), Enum.Font.GothamBlack, 13, GOLD)
tutStep.TextXAlignment = Enum.TextXAlignment.Left
local tutText = text(tut, "", UDim2.new(1, -20, 0, 60), UDim2.new(0, 10, 0, 30), Enum.Font.GothamBold, 16, Color3.new(1, 1, 1))
tutText.TextXAlignment = Enum.TextXAlignment.Left
tutText.TextYAlignment = Enum.TextYAlignment.Top

-- arrow that points to the tutorial target (Beam between player and target)
local beamA0 = Instance.new("Attachment")
local beamA1 = Instance.new("Attachment")
local targetPart = Instance.new("Part")
targetPart.Anchored = true
targetPart.CanCollide = false
targetPart.CanQuery = false
targetPart.Transparency = 1
targetPart.Size = Vector3.new(1, 1, 1)
targetPart.Parent = workspace
beamA1.Parent = targetPart
local beam = Instance.new("Beam")
beam.Attachment0 = beamA0
beam.Attachment1 = beamA1
beam.Color = ColorSequence.new(GOLD)
beam.Width0 = 1.2
beam.Width1 = 1.2
beam.FaceCamera = true
beam.LightEmission = 1
beam.Transparency = NumberSequence.new(0.2)
beam.Texture = "rbxasset://textures/particles/sparkles_main.dds"
beam.TextureSpeed = 2
beam.TextureLength = 4
beam.Enabled = false
beam.Parent = targetPart
local pillar = Instance.new("Part")
pillar.Anchored = true
pillar.CanCollide = false
pillar.CanQuery = false
pillar.Material = Enum.Material.Neon
pillar.Color = GOLD
pillar.Transparency = 0.55
pillar.Shape = Enum.PartType.Cylinder
pillar.Size = Vector3.new(60, 8, 8)
pillar.Parent = nil

local function setTarget(pos)
	if pos then
		targetPart.Position = pos + Vector3.new(0, 2, 0)
		pillar.CFrame = CFrame.new(pos + Vector3.new(0, 30, 0)) * CFrame.Angles(0, 0, math.rad(90))
		pillar.Parent = workspace
		beam.Enabled = true
	else
		beam.Enabled = false
		pillar.Parent = nil
	end
end

-- ------------------------------------------------------------------ garage
local garage = frame(gui, UDim2.new(0, 560, 0, 330), UDim2.new(0.5, -280, 0.5, -165), DARK, 0.05)
corner(garage, 18)
stroke(garage, GOLD, 2)
garage.Visible = false
local gTitle = text(garage, "GARAGEM • SOLARIS MOTORS", UDim2.new(1, -60, 0, 36), UDim2.new(0, 16, 0, 6), Enum.Font.GothamBlack, 20, GOLD)
gTitle.TextXAlignment = Enum.TextXAlignment.Left
local gClose = button(garage, "✕", UDim2.new(0, 36, 0, 36), UDim2.new(1, -46, 0, 8), rgb(60, 30, 30))
local list = Instance.new("ScrollingFrame")
list.Size = UDim2.new(0, 250, 1, -60)
list.Position = UDim2.new(0, 12, 0, 50)
list.BackgroundTransparency = 1
list.ScrollBarThickness = 6
list.CanvasSize = UDim2.new(0, 0, 0, #CARS * 58)
list.Parent = garage
local listLayout = Instance.new("UIListLayout")
listLayout.Padding = UDim.new(0, 6)
listLayout.Parent = list
local detail = frame(garage, UDim2.new(1, -290, 1, -60), UDim2.new(0, 276, 0, 50), rgb(26, 28, 34), 0)
corner(detail, 14)
local dName = text(detail, "", UDim2.new(1, -20, 0, 30), UDim2.new(0, 10, 0, 8), Enum.Font.GothamBlack, 22, Color3.new(1, 1, 1))
dName.TextXAlignment = Enum.TextXAlignment.Left
local dTag = text(detail, "", UDim2.new(1, -20, 0, 18), UDim2.new(0, 10, 0, 36), Enum.Font.GothamBold, 13, GOLD)
dTag.TextXAlignment = Enum.TextXAlignment.Left
local function statBar(label, y)
	text(detail, label, UDim2.new(0, 90, 0, 16), UDim2.new(0, 10, 0, y), Enum.Font.GothamBold, 12, rgb(190, 190, 200)).TextXAlignment = Enum.TextXAlignment.Left
	local bg = frame(detail, UDim2.new(1, -120, 0, 8), UDim2.new(0, 104, 0, y + 4), rgb(50, 52, 60), 0)
	corner(bg, 4)
	local fill = frame(bg, UDim2.new(0.5, 0, 1, 0), UDim2.new(0, 0, 0, 0), GOLD, 0)
	corner(fill, 4)
	return fill
end
local fSpeed = statBar("Velocidade", 62)
local fAcc = statBar("Aceleração", 84)
text(detail, "Cor", UDim2.new(0, 60, 0, 16), UDim2.new(0, 10, 0, 108), Enum.Font.GothamBold, 12, rgb(190, 190, 200)).TextXAlignment = Enum.TextXAlignment.Left
text(detail, "Faixa", UDim2.new(0, 60, 0, 16), UDim2.new(0, 10, 0, 152), Enum.Font.GothamBold, 12, rgb(190, 190, 200)).TextXAlignment = Enum.TextXAlignment.Left
local PALETTE = { rgb(235, 235, 240), rgb(20, 20, 24), rgb(200, 30, 40), rgb(30, 90, 200), rgb(120, 200, 230), rgb(250, 160, 30), rgb(40, 160, 90), rgb(120, 60, 180), rgb(210, 190, 150), rgb(160, 165, 172) }
local chosenCar, chosenColor, chosenLivery = CARS[1], 3, 0
local colorButtons, liveryButtons = {}, {}
for i, c in ipairs(PALETTE) do
	local b = Instance.new("TextButton")
	b.Size = UDim2.new(0, 22, 0, 22)
	b.Position = UDim2.new(0, 10 + (i - 1) * 26, 0, 126)
	b.BackgroundColor3 = c
	b.Text = ""
	b.Parent = detail
	corner(b, 11)
	colorButtons[i] = b
	b.MouseButton1Click:Connect(function()
		chosenColor = i
		sClick:Play()
		for k, bb in ipairs(colorButtons) do bb.BorderSizePixel = 0 bb.Size = UDim2.new(0, k == i and 26 or 22, 0, k == i and 26 or 22) end
	end)
	local lb = Instance.new("TextButton")
	lb.Size = UDim2.new(0, 22, 0, 22)
	lb.Position = UDim2.new(0, 10 + i * 26, 0, 170)
	lb.BackgroundColor3 = c
	lb.Text = ""
	lb.Parent = detail
	corner(lb, 4)
	liveryButtons[i] = lb
	lb.MouseButton1Click:Connect(function()
		chosenLivery = i
		sClick:Play()
		for k, bb in ipairs(liveryButtons) do bb.Size = UDim2.new(0, k == i and 26 or 22, 0, k == i and 26 or 22) end
	end)
end
local noStripe = button(detail, "—", UDim2.new(0, 22, 0, 22), UDim2.new(0, 10, 0, 170), rgb(50, 52, 60))
noStripe.TextSize = 12
noStripe.MouseButton1Click:Connect(function()
	chosenLivery = 0
	for _, bb in ipairs(liveryButtons) do bb.Size = UDim2.new(0, 22, 0, 22) end
end)
local spawnBtn = button(detail, "DIRIGIR", UDim2.new(1, -20, 0, 46), UDim2.new(0, 10, 1, -56), GOLD)
spawnBtn.TextColor3 = DARK
spawnBtn.TextSize = 20

local function showCar(c)
	chosenCar = c
	dName.Text = c.name
	dTag.Text = c.tag .. (c.price > 0 and ("  •  " .. (progress.owned[c.id] and "SEU" or ("💰 " .. c.price))) or "  •  GRÁTIS")
	TweenService:Create(fSpeed, TweenInfo.new(0.4, Enum.EasingStyle.Quad), { Size = UDim2.new(c.top / 160, 0, 1, 0) }):Play()
	TweenService:Create(fAcc, TweenInfo.new(0.4, Enum.EasingStyle.Quad), { Size = UDim2.new(c.acc / 46, 0, 1, 0) }):Play()
	spawnBtn.Text = (c.price > 0 and not progress.owned[c.id]) and ("COMPRAR 💰" .. c.price) or "DIRIGIR"
end
local carButtons = {}
local function rebuildList()
	for _, b in ipairs(carButtons) do b:Destroy() end
	carButtons = {}
	for _, c in ipairs(CARS) do
		local locked = c.price > 0 and not progress.owned[c.id]
		local b = button(list, (locked and "🔒 " or "🚗 ") .. c.name, UDim2.new(1, -10, 0, 52), UDim2.new(0, 0, 0, 0), rgb(30, 32, 40))
		b.TextXAlignment = Enum.TextXAlignment.Left
		local pad = Instance.new("UIPadding")
		pad.PaddingLeft = UDim.new(0, 12)
		pad.Parent = b
		b.MouseButton1Click:Connect(function() showCar(c) end)
		table.insert(carButtons, b)
	end
end
local function openGarage()
	rebuildList()
	showCar(chosenCar)
	slideIn(garage, UDim2.new(0.5, -280, 1.2, 0))
end
gClose.MouseButton1Click:Connect(function() garage.Visible = false end)
bGarage.MouseButton1Click:Connect(function()
	toast("🚗 Ícone CARRO lá em cima = sua garagem • 🏪 Compre carros na Solaris Motors")
end)
spawnBtn.MouseButton1Click:Connect(function()
	SpawnCar:FireServer(chosenCar.id, chosenColor, chosenLivery)
	garage.Visible = false
end)

-- ------------------------------------------------------------------ poses (built-in emotes) and photo mode
local poseMenu = frame(gui, UDim2.new(0, 170, 0, 240), UDim2.new(1, -258, 0.5, -120), DARK, 0.1)
corner(poseMenu, 14)
poseMenu.Visible = false
local poseLayout = Instance.new("UIListLayout")
poseLayout.Padding = UDim.new(0, 6)
poseLayout.Parent = poseMenu
local posePad = Instance.new("UIPadding")
posePad.PaddingTop = UDim.new(0, 8)
posePad.PaddingLeft = UDim.new(0, 8)
posePad.Parent = poseMenu
local posed = false
for _, e in ipairs({ { "👋 Acenar", "wave" }, { "👉 Apontar", "point" }, { "💃 Dançar", "dance" }, { "🕺 Dançar 2", "dance2" }, { "😂 Rir", "laugh" }, { "🙌 Comemorar", "cheer" } }) do
	local b = button(poseMenu, e[1], UDim2.new(1, -16, 0, 32), UDim2.new(0, 0, 0, 0), rgb(34, 36, 44))
	b.TextSize = 14
	b.MouseButton1Click:Connect(function()
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if hum then
			pcall(function() hum:PlayEmote(e[2]) end)
			posed = true
		end
		poseMenu.Visible = false
	end)
end
bPose.MouseButton1Click:Connect(function()
	if poseMenu.Visible then poseMenu.Visible = false else slideIn(poseMenu, UDim2.new(1.2, 0, 0.5, -120)) end
end)
local photo = false
local photoHint = text(gui, "📷 MODO FOTO • toque em qualquer lugar para sair", UDim2.new(1, 0, 0, 30), UDim2.new(0, 0, 1, -40), Enum.Font.GothamBold, 14, Color3.new(1, 1, 1))
photoHint.Visible = false
local dof = Instance.new("DepthOfFieldEffect")
dof.Enabled = false
dof.FarIntensity = 0.35
dof.FocusDistance = 18
dof.InFocusRadius = 16
dof.NearIntensity = 0.2
dof.Parent = camera
bPhoto.MouseButton1Click:Connect(function()
	photo = true
	hud.Visible = false
	tut.Visible = false
	photoHint.Visible = true
	dof.Enabled = true
end)
UserInputService.InputBegan:Connect(function(input)
	if photo and (input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1) then
		task.wait(0.15)
		photo = false
		hud.Visible = true
		photoHint.Visible = false
		dof.Enabled = false
		if not progress.tutorial then tut.Visible = true end
	end
end)

-- ------------------------------------------------------------------ help card
local help = frame(gui, UDim2.new(0, 420, 0, 390), UDim2.new(0.5, -210, 0.5, -195), DARK, 0.05)
do
	-- shrink the card on short phone screens
	local hs = Instance.new("UIScale")
	hs.Parent = help
	local function fitHelp()
		local vs = camera.ViewportSize
		hs.Scale = math.clamp(math.min((vs.Y - 20) / 390, (vs.X - 20) / 420), 0.5, 1)
	end
	camera:GetPropertyChangedSignal("ViewportSize"):Connect(fitHelp)
	fitHelp()
end
corner(help, 18)
stroke(help, GOLD, 2)
help.Visible = false
text(help, "COMO JOGAR", UDim2.new(1, 0, 0, 34), UDim2.new(0, 0, 0, 10), Enum.Font.GothamBlack, 22, GOLD)
text(help, "🚗  Toque no ícone de CARRO na barra de cima para tirar seus carros da garagem.\n🏪  Compre carros novos e escolha a cor na concessionária SOLARIS MOTORS.\n🕹️  No carro, use os botões do painel na tela para acelerar, frear e virar.\n🅿️  Estacione nas vagas do Encontro e mostre seu carro.\n😎  POSES: faça poses do lado do carro.  📷 FOTO: esconde a tela para tirar print.\n🏁  CORRIDA: passe pela LARGADA na praia indo para a direita e siga a luz dourada.\n💨  DRIFT: derrape na Arena de Drift para somar pontos e combo.\n📢  ENCONTRO: a cada 8 min, leve o carro ao estacionamento e vote no mais bonito.\n💰  Descubra lugares do mapa para ganhar créditos.", UDim2.new(1, -30, 0, 290), UDim2.new(0, 15, 0, 46), Enum.Font.GothamBold, 13, Color3.new(1, 1, 1)).TextXAlignment = Enum.TextXAlignment.Left
local hClose = button(help, "ENTENDI", UDim2.new(0, 140, 0, 36), UDim2.new(0.5, -70, 1, -46), GOLD)
hClose.TextColor3 = DARK
hClose.MouseButton1Click:Connect(function() help.Visible = false end)
bHelp.MouseButton1Click:Connect(function() slideIn(help, UDim2.new(0.5, -200, -0.6, 0)) end)

-- ------------------------------------------------------------------ server messages
local function refreshCredits()
	creditText.Text = "💰 " .. tostring(progress.credits)
end
Progress.OnClientEvent:Connect(function(d)
	progress = d
	refreshCredits()
end)
Notify.OnClientEvent:Connect(function(kind, a, b)
	if kind == "credits" then
		sDone:Play()
		toast("+" .. a .. " 💰  " .. (b or ""))
	elseif kind == "nomoney" then
		toast("Faltam " .. a .. " créditos para esse carro", rgb(255, 120, 120))
	elseif kind == "bought" then
		sDone:Play()
		toast("🎉 Você comprou o " .. a .. "!")
	elseif kind == "garage" then
		toast("🚗 Toque no ícone de CARRO lá em cima para escolher seu carro")
	elseif kind == "needcar" then
		toast("Entre em um carro primeiro", rgb(255, 120, 120))
	end
end)

-- ------------------------------------------------------------------ DRIFT, RACE and MEET EVENTS
local Score = ReplicatedStorage:WaitForChild("Score")
local EventR = ReplicatedStorage:WaitForChild("Evento")
local Vote = ReplicatedStorage:WaitForChild("Voto")
local DR = {}
for v in string.gmatch(ReplicatedStorage:WaitForChild("Drift").Value, "[^|]+") do table.insert(DR, tonumber(v)) end
local CHECKS = {}
for x, z in string.gmatch(ReplicatedStorage:WaitForChild("Corrida").Value, "([%-%d%.]+),([%-%d%.]+)") do
	table.insert(CHECKS, Vector3.new(tonumber(x), 0, tonumber(z)))
end
local function fmtTime(t)
	return string.format("%d:%05.2f", math.floor(t / 60), t % 60)
end

-- big centre-top label used by drift and race
-- (bottom centre: the notifications use the top of the screen)
local bigBox = frame(gui, UDim2.new(0, 300, 0, 64), UDim2.new(0.5, -150, 1, -150), DARK, 0.2)
corner(bigBox, 16)
stroke(bigBox, rgb(255, 70, 70), 2)
bigBox.Visible = false
local bigText = text(bigBox, "", UDim2.new(1, -16, 0, 38), UDim2.new(0, 8, 0, 2), Enum.Font.GothamBlack, 28, Color3.new(1, 1, 1))
local smallText = text(bigBox, "", UDim2.new(1, -16, 0, 20), UDim2.new(0, 8, 0, 40), Enum.Font.GothamBold, 14, GOLD)

local function driveSeat()
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	local s = hum and hum.SeatPart
	if s and s:IsA("VehicleSeat") then return s end
	return nil
end

-- drift
local drift = { pts = 0, combo = 1, slideT = 0, idleT = 0, active = false, wasIn = false }
local function endDrift()
	if drift.pts >= 100 then
		Score:FireServer("drift", math.floor(drift.pts))
		toast("💨 Drift encerrado: " .. math.floor(drift.pts) .. " pontos", rgb(255, 90, 90))
	end
	drift.pts, drift.combo, drift.slideT, drift.idleT, drift.active = 0, 1, 0, 0, false
end

-- race
local race = { on = false, idx = 2, t = 0, cool = 0 }
local function stopRace(msg)
	race.on = false
	race.cool = 6
	setTarget(nil)
	if msg then toast(msg, rgb(255, 120, 120)) end
end

RunService.Heartbeat:Connect(function(dt)
	local s = driveSeat()
	local pos = s and s.Position
	-- ---- drift arena
	local inside = pos and math.abs(pos.X - DR[1]) < DR[3] / 2 and math.abs(pos.Z - DR[2]) < DR[4] / 2
	if inside and not drift.wasIn then toast("💨 ARENA DE DRIFT • derrape para ganhar pontos!", rgb(255, 90, 90)) end
	drift.wasIn = inside and true or false
	if inside then
		local v = s.AssemblyLinearVelocity
		local flat = Vector3.new(v.X, 0, v.Z)
		local spd = flat.Magnitude
		local look = Vector3.new(s.CFrame.LookVector.X, 0, s.CFrame.LookVector.Z)
		local ang = 0
		if spd > 1 and look.Magnitude > 0.1 then
			ang = math.deg(math.acos(math.clamp(flat.Unit:Dot(look.Unit), -1, 1)))
		end
		if spd > 25 and ang > 12 and ang < 100 then
			drift.active = true
			drift.idleT = 0
			drift.slideT = drift.slideT + dt
			drift.combo = math.min(5, 1 + math.floor(drift.slideT / 2))
			drift.pts = drift.pts + (spd * ang / 30) * drift.combo * dt
		else
			drift.slideT = math.max(0, drift.slideT - dt * 2)
			if drift.active then
				drift.idleT = drift.idleT + dt
				if spd < 3 and drift.idleT > 2 then endDrift() end
			end
		end
		if drift.pts > 0 then
			bigBox.Visible = true
			bigText.Text = "DRIFT  " .. math.floor(drift.pts)
			bigText.TextColor3 = drift.slideT > 0 and rgb(255, 90, 90) or Color3.new(1, 1, 1)
			smallText.Text = "COMBO x" .. drift.combo .. "  •  ângulo " .. math.floor(ang) .. "°"
		end
	elseif drift.active or drift.pts > 0 then
		endDrift()
	end

	-- ---- race
	race.cool = math.max(0, race.cool - dt)
	if race.on then
		race.t = race.t + dt
		if not s then
			stopRace("🏁 Corrida cancelada: você saiu do carro")
		elseif race.t > 300 then
			stopRace("🏁 Corrida cancelada: tempo esgotado")
		else
			local target = CHECKS[race.idx]
			local flatPos = Vector3.new(pos.X, 0, pos.Z)
			if (flatPos - target).Magnitude < 30 then
				if race.idx >= #CHECKS then
					local t = race.t
					stopRace(nil)
					sDone:Play()
					Score:FireServer("lap", t)
					toast("🏁 Volta completa: " .. fmtTime(t), GOLD)
				else
					sClick:Play()
					race.idx = race.idx + 1
					setTarget(CHECKS[race.idx])
				end
			end
			if race.on then
				bigBox.Visible = true
				bigText.Text = "🏁 " .. fmtTime(race.t)
				bigText.TextColor3 = Color3.new(1, 1, 1)
				smallText.Text = "Ponto " .. (race.idx - 1) .. "/" .. (#CHECKS - 1) .. "  •  siga a luz dourada"
			end
		end
	elseif s and race.cool <= 0 and not inside then
		local flatPos = Vector3.new(pos.X, 0, pos.Z)
		-- only when crossing the start line heading east (towards the first point), not when just passing by
		local v = s.AssemblyLinearVelocity
		if (flatPos - CHECKS[1]).Magnitude < 16 and v.X > 8 and math.abs(v.X) > math.abs(v.Z) then
			race.on, race.idx, race.t = true, 2, 0
			sWhoosh:Play()
			toast("🏁 CORRIDA DO PORTO! Siga os pontos e volte à largada", GOLD)
			setTarget(CHECKS[2])
		end
	end
	if not race.on and drift.pts <= 0 then bigBox.Visible = false end
end)

-- meet events + voting panel
local votePanel = frame(gui, UDim2.new(0, 340, 0, 300), UDim2.new(0.5, -170, 0.5, -150), DARK, 0.05)
corner(votePanel, 18)
stroke(votePanel, GOLD, 2)
votePanel.Visible = false
local vTitle = text(votePanel, "⭐ VOTE NO CARRO MAIS BONITO", UDim2.new(1, -20, 0, 34), UDim2.new(0, 10, 0, 6), Enum.Font.GothamBlack, 17, GOLD)
local vTimer = text(votePanel, "", UDim2.new(1, -20, 0, 18), UDim2.new(0, 10, 0, 38), Enum.Font.GothamBold, 13, Color3.new(0.8, 0.8, 0.8))
local vList = Instance.new("ScrollingFrame")
vList.Size = UDim2.new(1, -20, 1, -110)
vList.Position = UDim2.new(0, 10, 0, 60)
vList.BackgroundTransparency = 1
vList.ScrollBarThickness = 5
vList.Parent = votePanel
local vLayout = Instance.new("UIListLayout")
vLayout.Padding = UDim.new(0, 6)
vLayout.Parent = vList
local vClose = button(votePanel, "Fechar", UDim2.new(0, 120, 0, 34), UDim2.new(0.5, -60, 1, -44), rgb(60, 30, 30))
vClose.MouseButton1Click:Connect(function() votePanel.Visible = false end)
local voteEnds = 0
local function lockVotes()
	for _, b in ipairs(vList:GetChildren()) do
		if b:IsA("TextButton") then b.Active = false; b.AutoButtonColor = false; b.BackgroundTransparency = 0.5 end
	end
end
local _ = vTitle

EventR.OnClientEvent:Connect(function(kind, a, b, c)
	if kind == "announce" then
		sWhoosh:Play()
		toast("📢 Encontro Solaris em " .. a .. "s! Leve seu carro ao estacionamento", GOLD)
	elseif kind == "start" then
		sDone:Play()
		toast("📢 O ENCONTRO COMEÇOU! Estacione no Encontro Solaris (" .. math.floor(a / 60) .. " min)", GOLD)
	elseif kind == "vote" then
		for _, ch in ipairs(vList:GetChildren()) do
			if ch:IsA("TextButton") then ch:Destroy() end
		end
		local n = 0
		for _, p in ipairs(a) do
			if p.id ~= player.UserId then
				n = n + 1
				local bt = button(vList, p.name .. "  •  " .. p.car, UDim2.new(1, -8, 0, 40), UDim2.new(0, 0, 0, 0), rgb(35, 38, 46))
				bt.TextSize = 14
				bt.MouseButton1Click:Connect(function()
					if not bt.Active then return end
					Vote:FireServer(p.id)
					lockVotes()
					bt.BackgroundColor3 = rgb(40, 120, 60)
					bt.BackgroundTransparency = 0
				end)
			end
		end
		vList.CanvasSize = UDim2.new(0, 0, 0, n * 46)
		voteEnds = os.clock() + (b or 30)
		votePanel.Visible = n > 0
		task.spawn(function()
			while votePanel.Visible and os.clock() < voteEnds do
				vTimer.Text = "Termina em " .. math.ceil(voteEnds - os.clock()) .. "s • você não pode votar em si mesmo"
				task.wait(0.25)
			end
			votePanel.Visible = false
		end)
	elseif kind == "result" then
		votePanel.Visible = false
		if a then
			sDone:Play()
			toast("🏆 " .. a .. " venceu o encontro com " .. tostring(b) .. " (" .. tostring(c) .. " votos)!", GOLD)
		else
			toast("Encontro encerrado: ninguém recebeu votos", rgb(200, 200, 200))
		end
	elseif kind == "few" then
		toast("Encontro encerrado: precisa de 2+ pessoas para a votação", rgb(200, 200, 200))
	elseif kind == "record" then
		sDone:Play()
		toast(a, rgb(255, 230, 120))
	end
end)
Notify.OnClientEvent:Connect(function(kind)
	if kind == "voted" then toast("✅ Voto registrado!", rgb(120, 255, 140))
	elseif kind == "badlap" then toast("🏁 Volta não contou (tempo inválido)", rgb(255, 120, 120)) end
end)

-- ------------------------------------------------------------------ driving (runs for the car you are driving)
local car, chassis, seat, lv, av
local speed = 0
local vel = Vector3.zero
local function currentSeat()
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	return hum and hum.SeatPart
end
RunService.Heartbeat:Connect(function(dt)
	local s = currentSeat()
	if s and s:IsA("VehicleSeat") and s.Parent and s.Parent:GetAttribute("Car") then
		if s ~= seat then
			seat = s
			car = s.Parent
			chassis = car:FindFirstChild("Chassi")
			lv = chassis and chassis:FindFirstChild("Tracao")
			av = chassis and chassis:FindFirstChild("Direcao")
			speed = 0
			vel = Vector3.zero
			speedo.Visible = true
			carNameText.Text = string.upper(car:GetAttribute("Nome") or "")
		end
		if chassis and lv and av then
			local top = car:GetAttribute("Top") or 110
			local acc = car:GetAttribute("Acc") or 30
			local turn = car:GetAttribute("Turn") or 1.8
			local th = seat.ThrottleFloat
			local st = seat.SteerFloat
			if th > 0.05 then
				speed = speed + (speed < 0 and acc * 2.5 or acc) * th * dt
			elseif th < -0.05 then
				speed = speed + (speed > 0 and -acc * 2.5 or -acc * 0.6) * (-th) * dt
			else
				speed = speed - math.sign(speed) * math.min(math.abs(speed), 14 * dt)
			end
			speed = math.clamp(speed, -top * 0.3, top)
			local grip = math.clamp(1 - math.abs(speed) / (top * 1.6), 0.25, 1)
			local yawRate = -st * turn * math.clamp(math.abs(speed) / 22, 0, 1) * (speed >= 0 and 1 or -1)
			av.AngularVelocity = Vector3.new(0, yawRate, 0)
			local look = chassis.CFrame.LookVector
			look = Vector3.new(look.X, 0, look.Z).Unit
			-- the car "slides" a little at speed (drift feel), then follows the nose
			vel = vel:Lerp(look * speed, math.clamp(dt * (3 + grip * 6), 0, 1))
			lv.PlaneVelocity = Vector2.new(vel.X, vel.Z)
			speedText.Text = tostring(math.floor(math.abs(speed) * 1.25))
		end
	else
		if seat then
			seat = nil
			car = nil
			speedo.Visible = false
		end
	end
	-- the guide beam starts at your character
	beamA0.Parent = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
end)

-- ------------------------------------------------------------------ showroom turntables (spun here, so the server does not send them every frame)
local spinning = {}
task.spawn(function()
	while true do
		local mapa = workspace:FindFirstChild("Mapa")
		if mapa then
			for _, m in ipairs(mapa:GetChildren()) do
				if m:IsA("Model") and m:GetAttribute("Giro") and not spinning[m] then spinning[m] = m:GetPivot() end
			end
		end
		task.wait(3)
	end
end)
RunService.RenderStepped:Connect(function(dt)
	for m, cf in pairs(spinning) do
		if m.Parent then
			cf = cf * CFrame.Angles(0, m:GetAttribute("Giro") * dt, 0)
			spinning[m] = cf
			m:PivotTo(cf)
		else
			spinning[m] = nil
		end
	end
end)

-- ------------------------------------------------------------------ places to discover + tutorial
local TUT = {
	{ "PASSO 1 de 5", "Toque no ícone de CARRO na barra de cima, escolha um carro e entre nele." },
	{ "PASSO 2 de 5", "Use o analógico para dirigir. Siga a luz dourada até o POSTO AURORA." },
	{ "PASSO 3 de 5", "Agora volte ao ENCONTRO SOLARIS e pare em uma vaga livre (siga a luz)." },
	{ "PASSO 4 de 5", "Saia do carro (botão de pular) e faça uma POSE 😎 do lado dele." },
	{ "PASSO 5 de 5", "Toque em 📷 para o MODO FOTO e tire um print do seu carro!" },
}
local step = 0
local function showStep()
	if progress.tutorial or step > #TUT then
		tut.Visible = false
		setTarget(nil)
		return
	end
	tutStep.Text = TUT[step][1]
	tutText.Text = TUT[step][2]
	if not tut.Visible then slideIn(tut, UDim2.new(0.5, -165, -0.3, 0)) end
	if step == 2 then setTarget(PLACES[2] and PLACES[2].pos or nil)
	elseif step == 3 then setTarget(PLACES[1].pos)
	else setTarget(nil) end
end
local function nextStep()
	step = step + 1
	sDone:Play()
	if step > #TUT then
		tut.Visible = false
		setTarget(nil)
		Progress:FireServer("tutorial")
		toast("🏁 Tutorial concluído! O mapa é todo seu.")
	else
		showStep()
	end
end

task.spawn(function()
	while true do
		task.wait(0.5)
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if root then
			local p = Vector3.new(root.Position.X, 0, root.Position.Z)
			local here = ""
			for _, pl in ipairs(PLACES) do
				if (p - pl.pos).Magnitude < 60 then here = "📍 " .. pl.name end
				if (p - pl.pos).Magnitude < pl.near and not progress.found[pl.id] then
					progress.found[pl.id] = true
					Progress:FireServer("found", pl.id)
				end
			end
			placeText.Text = here
			-- tutorial checks
			if not progress.tutorial and step >= 1 and step <= #TUT then
				local s = currentSeat()
				if step == 1 and s and s:IsA("VehicleSeat") then nextStep()
				elseif step == 2 and PLACES[2] and (p - PLACES[2].pos).Magnitude < 35 then nextStep()
				elseif step == 3 and (p - PLACES[1].pos).Magnitude < 70 and s and s.AssemblyLinearVelocity.Magnitude < 3 then nextStep()
				elseif step == 4 and posed and not s then nextStep()
				elseif step == 5 and photo then nextStep() end
			end
		end
	end
end)

-- ------------------------------------------------------------------ cinematic intro
local intro = frame(gui, UDim2.new(1, 0, 1, 0), UDim2.new(0, 0, 0, 0), Color3.new(0, 0, 0), 1)
local barTop = frame(intro, UDim2.new(1, 0, 0.12, 0), UDim2.new(0, 0, 0, 0), Color3.new(0, 0, 0), 0)
local barBot = frame(intro, UDim2.new(1, 0, 0.12, 0), UDim2.new(0, 0, 0.88, 0), Color3.new(0, 0, 0), 0)
local title = text(intro, "PORTO SOLARIS", UDim2.new(1, 0, 0, 80), UDim2.new(0, 0, 0.32, 0), Enum.Font.GothamBlack, 64, Color3.new(1, 1, 1))
title.TextStrokeTransparency = 0.6
local subtitle = text(intro, "CAR MEET  •  MUNDO ABERTO", UDim2.new(1, 0, 0, 30), UDim2.new(0, 0, 0.32, 82), Enum.Font.GothamBold, 22, GOLD)
local caption = text(intro, "", UDim2.new(1, 0, 0, 30), UDim2.new(0, 0, 0.8, 0), Enum.Font.GothamBold, 20, Color3.new(1, 1, 1))
caption.TextStrokeTransparency = 0.5
title.TextTransparency = 1
subtitle.TextTransparency = 1
local play = button(intro, "JOGAR", UDim2.new(0, 220, 0, 58), UDim2.new(0.5, -110, 0.62, 0), GOLD)
play.TextColor3 = DARK
play.TextSize = 26
play.Visible = false
local skip = button(intro, "Pular ⏭", UDim2.new(0, 110, 0, 36), UDim2.new(1, -124, 0.12, 10), rgb(30, 30, 36))
local skipped = false
skip.MouseButton1Click:Connect(function() skipped = true end)

local SHOTS = {
	{ from = CFrame.lookAt(Vector3.new(-20, 60, -90), Vector3.new(105, 0, 0)), to = CFrame.lookAt(Vector3.new(40, 40, -80), Vector3.new(110, 0, 0)), text = "Os encontros de carros mais bonitos da cidade" },
	{ from = CFrame.lookAt(Vector3.new(60, 6, -20), Vector3.new(90, 2, 0)), to = CFrame.lookAt(Vector3.new(140, 6, -20), Vector3.new(160, 2, 0)), text = "Mostre seu carro no Encontro Solaris" },
	{ from = CFrame.lookAt(Vector3.new(230, 10, -100), Vector3.new(260, 6, -60)), to = CFrame.lookAt(Vector3.new(290, 12, -100), Vector3.new(260, 6, -60)), text = "Passe no Posto Aurora" },
	{ from = CFrame.lookAt(Vector3.new(-285, 12, -150), Vector3.new(-220, 8, -80)), to = CFrame.lookAt(Vector3.new(-160, 12, -150), Vector3.new(-220, 8, -80)), text = "Compre seu carro na concessionária Solaris Motors" },
	{ from = CFrame.lookAt(Vector3.new(-80, 40, 380), Vector3.new(0, 2, 470)), to = CFrame.lookAt(Vector3.new(80, 30, 400), Vector3.new(0, 2, 470)), text = "E dirija livre até o pôr do sol na praia" },
}
local function runIntro()
	camera.CameraType = Enum.CameraType.Scriptable
	sWhoosh:Play()
	for i, s in ipairs(SHOTS) do
		if skipped then break end
		camera.CFrame = s.from
		caption.Text = s.text
		caption.TextTransparency = 1
		TweenService:Create(caption, TweenInfo.new(0.6), { TextTransparency = 0 }):Play()
		if i == 1 then
			TweenService:Create(title, TweenInfo.new(1.2), { TextTransparency = 0 }):Play()
			TweenService:Create(subtitle, TweenInfo.new(1.6), { TextTransparency = 0 }):Play()
		elseif i == 2 then
			TweenService:Create(title, TweenInfo.new(0.6), { TextTransparency = 1 }):Play()
			TweenService:Create(subtitle, TweenInfo.new(0.6), { TextTransparency = 1 }):Play()
		end
		local tw = TweenService:Create(camera, TweenInfo.new(4.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { CFrame = s.to })
		tw:Play()
		local t0 = os.clock()
		while os.clock() - t0 < 4.2 and not skipped do task.wait(0.05) end
		tw:Cancel()
	end
	caption.Text = ""
	title.TextTransparency = 0
	subtitle.TextTransparency = 0
	camera.CFrame = SHOTS[1].to
	skip.Visible = false
	play.Visible = true
	play.Size = UDim2.new(0, 10, 0, 10)
	TweenService:Create(play, TweenInfo.new(0.5, Enum.EasingStyle.Back), { Size = UDim2.new(0, 220, 0, 58) }):Play()
end
play.MouseButton1Click:Connect(function()
	TweenService:Create(barTop, TweenInfo.new(0.6), { Position = UDim2.new(0, 0, -0.15, 0) }):Play()
	TweenService:Create(barBot, TweenInfo.new(0.6), { Position = UDim2.new(0, 0, 1.05, 0) }):Play()
	TweenService:Create(title, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
	TweenService:Create(subtitle, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
	play.Visible = false
	task.wait(0.6)
	intro.Visible = false
	camera.CameraType = Enum.CameraType.Custom
	hud.Visible = true
	slideIn(creditBox, UDim2.new(0, -200, 0, 56))
	slideIn(bar, UDim2.new(1.2, 0, 0.5, -150))
	if not progress.tutorial then
		step = 1
		showStep()
		task.delay(0.8, function() slideIn(help, UDim2.new(0.5, -200, -0.6, 0)) end)
	else
		toast("Bem-vindo de volta ao Porto Solaris!")
	end
end)

task.wait(1.5)
runIntro()
