-- Coração da Floresta — client: story dialogue (typewriter + sounds), objective,
-- chapter banners and per-zone lighting/ambience.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer
local Story = ReplicatedStorage:WaitForChild("Story")
local Zone = ReplicatedStorage:WaitForChild("Zone")

-- ------------------------------------------------------------------ sounds (built into every Roblox client)
local function snd(id, vol, looped)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = vol
	s.Looped = looped or false
	s.Parent = SoundService
	return s
end
local sBlip = snd("rbxasset://sounds/electronicpingshort.wav", 0.15)
local sPick = snd("rbxasset://sounds/action_get_up.mp3", 0.8)
local sCheck = snd("rbxasset://sounds/button.wav", 0.6)
local sBoom = snd("rbxasset://sounds/collide.wav", 0.9)
local sSwim = snd("rbxasset://sounds/action_swim.mp3", 0.5)
local sWind = snd("rbxasset://sounds/action_falling.mp3", 0.12, true)
local sSplash = snd("rbxasset://sounds/impact_water.mp3", 0.5)

-- ------------------------------------------------------------------ UI
local gui = Instance.new("ScreenGui")
gui.Name = "Historia"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(o, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r or 12)
	c.Parent = o
end
local function stroke(o, col, th)
	local s = Instance.new("UIStroke")
	s.Color = col
	s.Thickness = th or 2
	s.Parent = o
end

-- objective (top left)
local obj = Instance.new("TextLabel")
obj.Size = UDim2.new(0, 360, 0, 46)
obj.Position = UDim2.new(0, 14, 0, 60)
obj.BackgroundColor3 = Color3.fromRGB(12, 26, 18)
obj.BackgroundTransparency = 0.25
obj.TextColor3 = Color3.fromRGB(230, 255, 235)
obj.Font = Enum.Font.GothamBold
obj.TextSize = 15
obj.TextWrapped = true
obj.TextXAlignment = Enum.TextXAlignment.Left
obj.Text = ""
obj.Parent = gui
corner(obj, 10)
stroke(obj, Color3.fromRGB(82, 183, 136), 2)
local pad = Instance.new("UIPadding")
pad.PaddingLeft = UDim.new(0, 12)
pad.PaddingRight = UDim.new(0, 12)
pad.Parent = obj

-- fragment counter (top right)
local frags = Instance.new("TextLabel")
frags.Size = UDim2.new(0, 170, 0, 40)
frags.Position = UDim2.new(1, -184, 0, 60)
frags.BackgroundColor3 = Color3.fromRGB(12, 26, 18)
frags.BackgroundTransparency = 0.25
frags.TextColor3 = Color3.fromRGB(183, 245, 201)
frags.Font = Enum.Font.FredokaOne
frags.TextSize = 20
frags.Text = "💎 0 / 4"
frags.Parent = gui
corner(frags, 10)

-- chapter banner
local banner = Instance.new("TextLabel")
banner.Size = UDim2.new(1, 0, 0, 90)
banner.Position = UDim2.new(0, 0, 0.22, 0)
banner.BackgroundTransparency = 1
banner.TextColor3 = Color3.fromRGB(255, 214, 102)
banner.TextStrokeTransparency = 0.2
banner.Font = Enum.Font.FredokaOne
banner.TextSize = 44
banner.TextTransparency = 1
banner.TextStrokeColor3 = Color3.new(0, 0, 0)
banner.Text = ""
banner.Parent = gui
local function showBanner(t)
	banner.Text = t
	banner.TextTransparency = 0
	banner.TextStrokeTransparency = 0.2
	task.delay(3, function()
		TweenService:Create(banner, TweenInfo.new(1), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	end)
end

-- dialogue box
local box = Instance.new("Frame")
box.Size = UDim2.new(0.9, 0, 0, 120)
box.Position = UDim2.new(0.05, 0, 1, -140)
box.BackgroundColor3 = Color3.fromRGB(10, 18, 14)
box.BackgroundTransparency = 0.1
box.Visible = false
box.Parent = gui
corner(box, 16)
stroke(box, Color3.fromRGB(255, 214, 102), 2)
local who = Instance.new("TextLabel")
who.Size = UDim2.new(1, -24, 0, 26)
who.Position = UDim2.new(0, 14, 0, 8)
who.BackgroundTransparency = 1
who.Font = Enum.Font.FredokaOne
who.TextSize = 20
who.TextXAlignment = Enum.TextXAlignment.Left
who.Parent = box
local say = Instance.new("TextLabel")
say.Size = UDim2.new(1, -28, 1, -64)
say.Position = UDim2.new(0, 14, 0, 36)
say.BackgroundTransparency = 1
say.Font = Enum.Font.Gotham
say.TextSize = 17
say.TextWrapped = true
say.TextXAlignment = Enum.TextXAlignment.Left
say.TextYAlignment = Enum.TextYAlignment.Top
say.TextColor3 = Color3.new(1, 1, 1)
say.Parent = box
local hint = Instance.new("TextButton")
hint.Size = UDim2.new(0, 160, 0, 26)
hint.Position = UDim2.new(1, -172, 1, -32)
hint.BackgroundTransparency = 1
hint.Font = Enum.Font.GothamBold
hint.TextSize = 14
hint.TextColor3 = Color3.fromRGB(255, 214, 102)
hint.Text = "Toque para continuar ▶"
hint.Parent = box

local COLORS = {
	["Narrador"] = Color3.fromRGB(233, 196, 106),
	["Professora Luz"] = Color3.fromRGB(255, 214, 102),
	["Boto Cor-de-Rosa"] = Color3.fromRGB(255, 170, 210),
	["Arara Azul"] = Color3.fromRGB(120, 180, 255),
	["Tatu-Bola"] = Color3.fromRGB(230, 200, 150),
	["Dr. Fumaça"] = Color3.fromRGB(255, 120, 120),
	["Você"] = Color3.fromRGB(142, 202, 230),
}

local queue = {}
local playing = false
local advance = false
hint.MouseButton1Click:Connect(function() advance = true end)
box.InputBegan:Connect(function(i)
	if i.UserInputType == Enum.UserInputType.Touch or i.UserInputType == Enum.UserInputType.MouseButton1 then advance = true end
end)

local function runQueue()
	if playing then return end
	playing = true
	while #queue > 0 do
		local line = table.remove(queue, 1)
		box.Visible = true
		who.Text = line[1]
		who.TextColor3 = COLORS[line[1]] or Color3.new(1, 1, 1)
		say.Text = ""
		advance = false
		local text = line[2]
		-- typewriter with a soft blip, tap to finish the line
		local n = 0
		for _, cp in utf8.codes(text) do
			n = n + 1
			if advance then break end
			say.Text = say.Text .. utf8.char(cp)
			if n % 3 == 0 then sBlip:Play() end
			task.wait(0.022)
		end
		say.Text = text
		advance = false
		local t0 = os.clock()
		while not advance and os.clock() - t0 < 4 + #text * 0.03 do task.wait(0.05) end
	end
	box.Visible = false
	playing = false
end
local function talk(lines)
	for _, l in ipairs(lines) do table.insert(queue, l) end
	task.spawn(runQueue)
end

-- ------------------------------------------------------------------ story text
local OBJ = {
	[0] = "Fale com a Professora Luz no acampamento",
	[1] = "Entre no portal 1: Rio das Piranhas",
	[2] = "Entre no portal 2: Copas das Árvores",
	[3] = "Entre no portal 3: Caverna de Cristal",
	[4] = "Entre no portal 4: Fábrica do Dr. Fumaça",
	[5] = "O Coração da Floresta voltou a brilhar! 🌳",
}
local fragCount = 0
local talked = false
local function refreshObjective()
	frags.Text = "💎 " .. fragCount .. " / 4"
	if not talked and fragCount == 0 then
		obj.Text = OBJ[0]
	elseif fragCount >= 4 then
		obj.Text = OBJ[5]
	else
		obj.Text = OBJ[fragCount + 1]
	end
end

local CHAPTER_NAMES = { "Rio das Piranhas", "Copas das Árvores", "Caverna de Cristal", "Fábrica do Dr. Fumaça" }
local CHAPTER_OBJ = {
	"Atravesse o rio sem cair na água das piranhas",
	"Suba pelas árvores até a copa mais alta",
	"Atravesse a caverna sem tocar na lava",
	"Invada a fábrica e derrote o Dr. Fumaça",
}

Story.OnClientEvent:Connect(function(kind, a, b)
	if kind == "intro" then
		fragCount = a or 0
		talked = fragCount > 0
		refreshObjective()
		if fragCount == 0 then
			showBanner("Coração da Floresta")
			talk({
				{ "Narrador", "No meio da Amazônia existe o Coração da Floresta, um cristal mágico que mantém a mata viva." },
				{ "Narrador", "Mas o Dr. Fumaça roubou o cristal para alimentar a fábrica dele… e o Coração se partiu em 4 fragmentos." },
				{ "Narrador", "Sem ele, a floresta está morrendo. Vá até a Professora Luz, no acampamento." },
			})
		elseif b then
			showBanner("Bem-vindo de volta, Guardião!")
		else
			showBanner("Bem-vindo de volta!")
		end
	elseif kind == "talk" then
		talked = true
		refreshObjective()
		if (a or 0) == 0 then
			talk({
				{ "Professora Luz", "Que bom que você chegou, explorador! O altar está vazio… o Coração da Floresta sumiu." },
				{ "Professora Luz", "Os fragmentos caíram em quatro lugares: o Rio das Piranhas, as Copas das Árvores, a Caverna de Cristal e a fábrica do Dr. Fumaça." },
				{ "Professora Luz", "Os portais de pedra levam até lá. Comece pelo rio. E cuidado: não caia na água!" },
			})
		elseif a < 4 then
			talk({ { "Professora Luz", "Você já tem " .. a .. " fragmento(s)! O próximo portal já está aberto. Vai lá!" } })
		else
			talk({ { "Professora Luz", "Você salvou a floresta! Obrigada, Guardião. Volte sempre ao acampamento." } })
		end
	elseif kind == "needTalk" then
		talk({ { "Você", "Melhor falar com a Professora Luz antes de entrar no portal." } })
	elseif kind == "locked" then
		talk({ { "Você", "Esse portal ainda está fechado. Preciso pegar o fragmento anterior primeiro." } })
	elseif kind == "chapter" then
		showBanner("Capítulo " .. a .. ": " .. CHAPTER_NAMES[a])
		obj.Text = CHAPTER_OBJ[a]
		if a == 1 then
			sSplash:Play()
			talk({ { "Narrador", "O rio está cheio de piranhas bravas. Pule de pedra em pedra e nos troncos que boiam." } })
		elseif a == 2 then
			talk({ { "Narrador", "As árvores gigantes guardam o segundo fragmento lá no alto. Os cogumelos vermelhos te jogam pra cima!" } })
		elseif a == 3 then
			talk({ { "Narrador", "A caverna é escura e o chão é de lava. Cuidado com os cristais que giram." } })
		elseif a == 4 then
			talk({
				{ "Dr. Fumaça", "Hahaha! Um explorador na minha fábrica? Você nunca vai chegar até mim!" },
				{ "Narrador", "Desvie das esteiras, dos lasers e das prensas. O último fragmento está com o Dr. Fumaça." },
			})
		end
	elseif kind == "checkpoint" then
		sCheck:Play()
		showBanner("✔ Checkpoint")
	elseif kind == "fragment" then
		sPick:Play()
		fragCount = fragCount + 1
		refreshObjective()
		showBanner("💎 Fragmento " .. a .. " recuperado!")
		local who2 = ({ "Boto Cor-de-Rosa", "Arara Azul", "Tatu-Bola", "Narrador" })[a]
		local thanks = ({
			"Obrigado, amigo! Agora as águas do rio vão voltar a brilhar. Leve o fragmento de volta ao acampamento!",
			"Craaá! Você é corajoso! O segundo fragmento é seu. Voe de volta… quer dizer, pegue o portal!",
			"Eu me escondi aqui na caverna o tempo todo… Obrigado por salvar o terceiro fragmento!",
			"O Dr. Fumaça fugiu e a fábrica parou! O último fragmento está com você!",
		})[a]
		talk({ { who2, thanks } })
	elseif kind == "boss" then
		sBoom:Play()
		showBanner("CHEFE: DR. FUMAÇA")
		obj.Text = "Pise nos 3 botões vermelhos e desvie das bolas de fumaça"
		talk({
			{ "Dr. Fumaça", "Chega de brincadeira! Minha máquina vai engolir a floresta inteira!" },
			{ "Você", "Os botões vermelhos! Se eu apertar os três, a máquina desliga!" },
		})
	elseif kind == "button" then
		sCheck:Play()
		showBanner("Botão " .. a .. " / 3")
	elseif kind == "bossDown" then
		sBoom:Play()
		showBanner("A MÁQUINA EXPLODIU!")
		obj.Text = "Pegue o último fragmento"
		talk({ { "Dr. Fumaça", "Nããão! Minha fábrica! Isso não vai ficar assim!" } })
	elseif kind == "ending" then
		showBanner("🌳 A FLORESTA FOI SALVA! 🌳")
		talk({
			{ "Professora Luz", "Os quatro fragmentos! Coloque-os no altar… olha só, o Coração da Floresta voltou a brilhar!" },
			{ "Narrador", "As árvores voltaram a crescer, os rios ficaram limpos e os animais voltaram para casa." },
			{ "Narrador", "E você virou o Guardião da Floresta. Fim… por enquanto!" },
		})
	end
end)

-- ------------------------------------------------------------------ per-zone lighting
local base = {
	ClockTime = Lighting.ClockTime,
	Ambient = Lighting.Ambient,
	OutdoorAmbient = Lighting.OutdoorAmbient,
	FogEnd = Lighting.FogEnd,
	FogColor = Lighting.FogColor,
}
Zone.OnClientEvent:Connect(function(z)
	local goal
	if z == 3 then
		goal = { ClockTime = 0, Ambient = Color3.fromRGB(60, 40, 80), OutdoorAmbient = Color3.fromRGB(50, 30, 70), FogEnd = 260, FogColor = Color3.fromRGB(30, 15, 40) }
		sWind:Play()
	elseif z == 4 then
		goal = { ClockTime = 17.6, Ambient = Color3.fromRGB(90, 80, 70), OutdoorAmbient = Color3.fromRGB(120, 100, 90), FogEnd = 400, FogColor = Color3.fromRGB(120, 110, 100) }
		sWind:Stop()
	elseif z == 1 then
		goal = base
		sSwim:Play()
		sWind:Stop()
	else
		goal = base
		sWind:Stop()
	end
	TweenService:Create(Lighting, TweenInfo.new(1.5), goal):Play()
end)

refreshObjective()
