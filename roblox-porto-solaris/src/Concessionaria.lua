-- Concessionaria (LocalScript): Solaris Motors dealership.
-- Catalogue by category with live 3D thumbnails, 3D inspection studio (orbit, zoom,
-- camera presets), real-time paint, purchase with confirmation (checked by the
-- server), saved paint and "drive now". Built for phones first (touch + UIScale).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local Catalogo = require(ReplicatedStorage:WaitForChild("Catalogo"))
local Loja = ReplicatedStorage:WaitForChild("Loja")
local RAbrir = Loja:WaitForChild("Abrir")
local RComprar = Loja:WaitForChild("Comprar")
local RSalvarCor = Loja:WaitForChild("SalvarCor")
local RDirigir = Loja:WaitForChild("Dirigir")
local estudio = ReplicatedStorage:WaitForChild("Estudio")

local function rgb(r, g, b) return Color3.fromRGB(r, g, b) end
local C = {
	bg = rgb(13, 14, 18), panel = rgb(20, 22, 28), card = rgb(27, 30, 37), card2 = rgb(34, 38, 47),
	line = rgb(255, 255, 255), text = rgb(240, 242, 245), muted = rgb(150, 158, 170),
	blue = rgb(60, 140, 255), green = rgb(52, 199, 110), gold = rgb(255, 200, 60), red = rgb(235, 70, 80),
}

-- ---------------------------------------------------------------- sounds
local function snd(id, vol)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = vol
	s.Parent = SoundService
	return s
end
local sClick = snd("rbxasset://sounds/electronicpingshort.wav", 0.3)
local sBuy = snd("rbxasset://sounds/victory.wav", 0.5)
local sWhoosh = snd("rbxasset://sounds/action_falling.mp3", 0.2)

-- ---------------------------------------------------------------- small UI kit
local function make(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do o[k] = v end
	o.Parent = parent
	return o
end
local function corner(o, r) make("UICorner", { CornerRadius = UDim.new(0, r or 10) }, o) end
local function stroke(o, col, th, tr)
	make("UIStroke", { Color = col or C.line, Thickness = th or 1, Transparency = tr or 0.88, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, o)
end
local function pad(o, l, t, r, b)
	make("UIPadding", { PaddingLeft = UDim.new(0, l), PaddingTop = UDim.new(0, t or l), PaddingRight = UDim.new(0, r or l), PaddingBottom = UDim.new(0, b or t or l) }, o)
end
local function frame(parent, size, pos, color, tr)
	return make("Frame", { Size = size, Position = pos or UDim2.new(), BackgroundColor3 = color or C.panel, BackgroundTransparency = tr or 0, BorderSizePixel = 0 }, parent)
end
local function label(parent, txt, size, pos, ts, color, font)
	return make("TextLabel", {
		Size = size, Position = pos or UDim2.new(), BackgroundTransparency = 1, Text = txt, TextSize = ts or 14,
		TextColor3 = color or C.text, Font = font or Enum.Font.GothamBold, TextXAlignment = Enum.TextXAlignment.Left,
		TextWrapped = true, RichText = true,
	}, parent)
end
local function button(parent, txt, size, pos, color, ts)
	local b = make("TextButton", {
		Size = size, Position = pos or UDim2.new(), BackgroundColor3 = color or C.card2, Text = txt, TextSize = ts or 15,
		TextColor3 = C.text, Font = Enum.Font.GothamBlack, AutoButtonColor = false, BorderSizePixel = 0,
	}, parent)
	corner(b, 10)
	local base = b.BackgroundColor3
	b.MouseEnter:Connect(function() TweenService:Create(b, TweenInfo.new(0.12), { BackgroundColor3 = base:Lerp(Color3.new(1, 1, 1), 0.12) }):Play() end)
	b.MouseLeave:Connect(function() TweenService:Create(b, TweenInfo.new(0.12), { BackgroundColor3 = base }):Play() end)
	b.MouseButton1Down:Connect(function()
		sClick:Play()
		local sc = b:FindFirstChildOfClass("UIScale") or make("UIScale", {}, b)
		sc.Scale = 0.94
		TweenService:Create(sc, TweenInfo.new(0.18, Enum.EasingStyle.Back), { Scale = 1 }):Play()
	end)
	b:GetPropertyChangedSignal("BackgroundColor3"):Connect(function()
		if b:GetAttribute("Base") then base = b.BackgroundColor3 b:SetAttribute("Base", nil) end
	end)
	return b
end
local function setButtonColor(b, col)
	b:SetAttribute("Base", true)
	b.BackgroundColor3 = col
end
-- a panel with its own UIScale, so every panel fits small phone screens
local scales = {}
local function scaled(o)
	local s = make("UIScale", {}, o)
	table.insert(scales, s)
	return s
end

-- ---------------------------------------------------------------- player data (from the server)
local function credits()
	local ls = player:FindFirstChild("leaderstats")
	local c = ls and ls:FindFirstChild("Creditos")
	return c and c.Value or 0
end
local function owns(nome)
	return string.find(player:GetAttribute("Carros") or "", "|" .. nome .. "|", 1, true) ~= nil
end
local function savedColor(nome)
	for entry in string.gmatch(player:GetAttribute("Cores") or "", "[^;]+") do
		local n, i = string.match(entry, "^(.-)=(%d+)$")
		if n == nome then return tonumber(i) end
	end
	return 0
end
local function money(n) return "💰 " .. Catalogo.formatar(n) end
local function catInfo(id)
	for _, c in ipairs(Catalogo.CATEGORIAS) do if c.id == id then return c end end
	return Catalogo.CATEGORIAS[1]
end

-- 3D models: the spawner's display copies (scripts removed, centred at the origin)
local modelsFolder = nil
local function displayModel(nome)
	modelsFolder = modelsFolder or ReplicatedStorage:WaitForChild("SpawnerViewportModels", 30)
	local m = modelsFolder and modelsFolder:FindFirstChild(nome)
	if not m then return nil end
	local c = m:Clone()
	local centre = c:FindFirstChild("_CenterBrick")
	if centre then centre.Transparency = 1 end
	return c
end

-- ---------------------------------------------------------------- root GUI
local gui = make("ScreenGui", { Name = "SolarisMotors", ResetOnSpawn = false, IgnoreGuiInset = true, DisplayOrder = 20, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, Enabled = true }, player:WaitForChild("PlayerGui"))
local dim = frame(gui, UDim2.new(1, 0, 1, 0), nil, rgb(0, 0, 0), 1)
dim.Visible = false
local toastBox = frame(gui, UDim2.new(0, 360, 0, 44), UDim2.new(0.5, -180, 0, 64), C.bg, 0.08)
toastBox.ZIndex = 50
corner(toastBox, 22)
stroke(toastBox, C.gold, 1.5, 0.2)
toastBox.Visible = false
local toastText = label(toastBox, "", UDim2.new(1, -24, 1, 0), UDim2.new(0, 12, 0, 0), 14, C.gold)
toastText.TextXAlignment = Enum.TextXAlignment.Center
toastText.ZIndex = 51
local toastId = 0
local function toast(msg, col)
	toastId = toastId + 1
	local my = toastId
	toastText.Text = msg
	toastText.TextColor3 = col or C.gold
	toastBox.Visible = true
	task.delay(3, function() if toastId == my then toastBox.Visible = false end end)
end

-- ================================================================= CATALOGUE WINDOW (designed at 900x520)
local cat = frame(gui, UDim2.new(0, 900, 0, 520), UDim2.new(0.5, 0, 0.5, 0), C.bg, 0.03)
cat.AnchorPoint = Vector2.new(0.5, 0.5)
cat.Visible = false
corner(cat, 18)
stroke(cat, C.line, 1, 0.85)
local catScale = scaled(cat)
make("UIGradient", { Rotation = 90, Color = ColorSequence.new(rgb(24, 26, 33), rgb(12, 13, 17)) }, cat)
-- header
local title = label(cat, "SOLARIS MOTORS", UDim2.new(0, 300, 0, 26), UDim2.new(0, 22, 0, 14), 22, C.text, Enum.Font.GothamBlack)
local _ = title
label(cat, "Concessionária oficial • escolha, personalize e compre", UDim2.new(0, 420, 0, 16), UDim2.new(0, 22, 0, 40), 12, C.muted, Enum.Font.Gotham)
local search = make("TextBox", {
	Size = UDim2.new(0, 230, 0, 36), Position = UDim2.new(1, -300, 0, 16), BackgroundColor3 = C.card, Text = "", PlaceholderText = "🔍  Buscar carro...",
	PlaceholderColor3 = C.muted, TextColor3 = C.text, TextSize = 14, Font = Enum.Font.GothamBold, ClearTextOnFocus = false, TextXAlignment = Enum.TextXAlignment.Left, BorderSizePixel = 0,
}, cat)
corner(search, 10)
pad(search, 12, 0)
local closeBtn = button(cat, "✕", UDim2.new(0, 40, 0, 36), UDim2.new(1, -58, 0, 16), C.red, 18)
-- sidebar
local side = frame(cat, UDim2.new(0, 170, 1, -86), UDim2.new(0, 14, 0, 72), C.panel, 0)
corner(side, 14)
pad(side, 10)
local balance = frame(side, UDim2.new(1, 0, 0, 44), nil, C.card, 0)
corner(balance, 10)
local balanceText = label(balance, "", UDim2.new(1, -16, 1, 0), UDim2.new(0, 10, 0, 0), 16, C.green, Enum.Font.GothamBlack)
label(side, "CATEGORIAS", UDim2.new(1, 0, 0, 16), UDim2.new(0, 2, 0, 56), 11, C.muted)
local catList = frame(side, UDim2.new(1, 0, 1, -110), UDim2.new(0, 0, 0, 78), C.panel, 1)
make("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, catList)
local garageHint = label(side, "🚗 Seus carros saem pelo ícone <b>Car Spawner</b> no topo da tela", UDim2.new(1, 0, 0, 40), UDim2.new(0, 2, 1, -36), 10, C.muted, Enum.Font.Gotham)
local _2 = garageHint
-- grid
local grid = make("ScrollingFrame", {
	Size = UDim2.new(1, -212, 1, -86), Position = UDim2.new(0, 196, 0, 72), BackgroundTransparency = 1, BorderSizePixel = 0,
	ScrollBarThickness = 5, ScrollBarImageColor3 = C.muted, CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, cat)
local gridLayout = make("UIGridLayout", { CellPadding = UDim2.new(0, 12, 0, 12), CellSize = UDim2.new(0, 214, 0, 196), SortOrder = Enum.SortOrder.LayoutOrder }, grid)
pad(grid, 2, 2, 8, 8)
local emptyText = label(grid, "Nenhum carro encontrado.", UDim2.new(1, 0, 0, 40), nil, 14, C.muted)
emptyText.Visible = false

local state = { categoria = "Todos", busca = "", carro = nil, cor = 0, modo = nil }
local cards = {}
local catButtons = {}

local function refreshBalance()
	balanceText.Text = money(credits())
end

local function cardBadge(nome)
	local info = Catalogo.info(nome)
	if owns(nome) and info.preco > 0 then return "NA GARAGEM", C.green end
	if info.preco <= 0 then return "GRÁTIS", C.blue end
	if credits() < info.preco then return "FALTAM " .. Catalogo.formatar(info.preco - credits()), C.red end
	return "DISPONÍVEL", C.gold
end

local function makeCard(nome, order)
	local info = Catalogo.info(nome)
	local ci = catInfo(info.categoria)
	local b = make("TextButton", { Name = nome, Text = "", AutoButtonColor = false, BackgroundColor3 = C.card, BorderSizePixel = 0, LayoutOrder = order }, grid)
	corner(b, 14)
	local st = make("UIStroke", { Color = ci.cor, Thickness = 1.5, Transparency = 0.75, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, b)
	make("UIGradient", { Rotation = 90, Color = ColorSequence.new(rgb(44, 40, 34), rgb(24, 26, 32)) }, b)
	local vp = make("ViewportFrame", {
		Size = UDim2.new(1, -12, 0.56, 0), Position = UDim2.new(0, 6, 0, 22), BackgroundTransparency = 1,
		Ambient = rgb(150, 150, 160), LightColor = rgb(255, 250, 245), LightDirection = Vector3.new(-1, -1.4, -0.6),
	}, b)
	local m = displayModel(nome)
	if m then
		m:PivotTo(CFrame.new())
		m.Parent = vp
		local _, size = m:GetBoundingBox()
		local dist = math.max(size.X, size.Z) * 1.55
		local vc = make("Camera", { FieldOfView = 32 }, vp)
		local a = math.rad(215)
		vc.CFrame = CFrame.lookAt(Vector3.new(math.sin(a) * dist, size.Y * 0.9, math.cos(a) * dist), Vector3.new(0, -size.Y * 0.1, 0))
		vp.CurrentCamera = vc
	end
	local pill = frame(b, UDim2.new(0, 0, 0, 18), UDim2.new(0, 8, 0, 6), ci.cor, 0)
	pill.AutomaticSize = Enum.AutomaticSize.X
	corner(pill, 9)
	pad(pill, 7, 0)
	local pt = label(pill, string.upper(ci.nome), UDim2.new(0, 0, 1, 0), nil, 10, C.bg, Enum.Font.GothamBlack)
	pt.AutomaticSize = Enum.AutomaticSize.X
	local badge = frame(b, UDim2.new(0, 0, 0, 18), UDim2.new(1, -8, 0, 6), C.gold, 0)
	badge.AnchorPoint = Vector2.new(1, 0)
	badge.AutomaticSize = Enum.AutomaticSize.X
	corner(badge, 9)
	pad(badge, 7, 0)
	local bt = label(badge, "", UDim2.new(0, 0, 1, 0), nil, 10, C.bg, Enum.Font.GothamBlack)
	bt.AutomaticSize = Enum.AutomaticSize.X
	label(b, string.upper(info.marca), UDim2.new(1, -20, 0, 16), UDim2.new(0, 10, 0.66, 0), 12, C.muted, Enum.Font.GothamBlack)
	label(b, info.modelo, UDim2.new(1, -20, 0, 18), UDim2.new(0, 10, 0.66, 16), 14, C.text, Enum.Font.GothamBold)
	local price = label(b, "", UDim2.new(1, -20, 0, 20), UDim2.new(0, 10, 1, -26), 16, C.green, Enum.Font.GothamBlack)
	local function refresh()
		local t, col = cardBadge(nome)
		bt.Text = t
		badge.BackgroundColor3 = col
		price.Text = info.preco > 0 and money(info.preco) or "GRÁTIS"
	end
	refresh()
	b.MouseEnter:Connect(function() TweenService:Create(st, TweenInfo.new(0.15), { Transparency = 0.1 }):Play() end)
	b.MouseLeave:Connect(function() TweenService:Create(st, TweenInfo.new(0.15), { Transparency = 0.75 }):Play() end)
	cards[nome] = { button = b, refresh = refresh, info = info }
	return b
end

local function layoutGrid()
	local w = grid.AbsoluteSize.X / math.max(catScale.Scale, 0.01) - 12
	local cols = w > 600 and 3 or 2
	local cw = math.floor((w - (cols - 1) * 12) / cols)
	gridLayout.CellSize = UDim2.new(0, cw, 0, math.floor(cw * 0.9))
end
grid:GetPropertyChangedSignal("AbsoluteSize"):Connect(layoutGrid)

local function applyFilter()
	local q = string.lower(state.busca)
	local shown = 0
	for nome, c in pairs(cards) do
		local okCat = state.categoria == "Todos" or c.info.categoria == state.categoria
		local hay = string.lower(nome .. " " .. c.info.marca .. " " .. c.info.modelo)
		local okText = q == "" or string.find(hay, q, 1, true) ~= nil
		c.button.Visible = okCat and okText
		if c.button.Visible then shown = shown + 1 end
		c.refresh()
	end
	emptyText.Visible = shown == 0
	for id, b in pairs(catButtons) do
		local sel = id == state.categoria
		setButtonColor(b, sel and C.blue or C.card)
		b.TextColor3 = sel and C.text or C.muted
	end
	grid.CanvasPosition = Vector2.new()
end

local openInspect -- defined with the inspection screen below
local built = false
local function buildCatalogue()
	if built then return end
	built = true
	for i, ci in ipairs(Catalogo.CATEGORIAS) do
		local n = 0
		for _, nome in ipairs(Catalogo.lista()) do
			if ci.id == "Todos" or Catalogo.info(nome).categoria == ci.id then n = n + 1 end
		end
		local b = button(catList, "      " .. ci.nome .. "  (" .. n .. ")", UDim2.new(1, 0, 0, 38), nil, C.card, 13)
		b.LayoutOrder = i
		b.TextXAlignment = Enum.TextXAlignment.Left
		local dot = frame(b, UDim2.new(0, 8, 0, 8), UDim2.new(0, 12, 0.5, -4), ci.cor, 0)
		corner(dot, 4)
		catButtons[ci.id] = b
		b.MouseButton1Click:Connect(function()
			state.categoria = ci.id
			applyFilter()
		end)
	end
	for i, nome in ipairs(Catalogo.lista()) do
		local b = makeCard(nome, i)
		b.MouseButton1Click:Connect(function()
			sClick:Play()
			openInspect(nome)
		end)
	end
	layoutGrid()
	applyFilter()
end
search:GetPropertyChangedSignal("Text"):Connect(function()
	state.busca = search.Text
	applyFilter()
end)

-- ================================================================= INSPECTION (3D studio)
local insp = frame(gui, UDim2.new(1, 0, 1, 0), nil, C.bg, 1)
insp.Visible = false
-- top-left: back + title
local topBar = frame(insp, UDim2.new(0, 420, 0, 64), UDim2.new(0, 14, 0, 14), C.bg, 1)
scaled(topBar)
local backBtn = button(topBar, "‹  VOLTAR", UDim2.new(0, 120, 0, 40), nil, C.card, 14)
local tMarca = label(topBar, "", UDim2.new(0, 280, 0, 16), UDim2.new(0, 134, 0, 0), 12, C.muted, Enum.Font.GothamBlack)
local tModelo = label(topBar, "", UDim2.new(0, 280, 0, 28), UDim2.new(0, 134, 0, 14), 22, C.text, Enum.Font.GothamBlack)
tModelo.TextStrokeTransparency = 0.6
tMarca.TextStrokeTransparency = 0.7
-- right: info panel
local panel = frame(insp, UDim2.new(0, 330, 0, 500), UDim2.new(1, -14, 0, 14), C.bg, 0.08)
panel.AnchorPoint = Vector2.new(1, 0)
corner(panel, 16)
stroke(panel, C.line, 1, 0.85)
local panelScale = scaled(panel)
local body = make("ScrollingFrame", {
	Size = UDim2.new(1, -20, 1, -128), Position = UDim2.new(0, 10, 0, 10), BackgroundTransparency = 1, BorderSizePixel = 0,
	ScrollBarThickness = 4, ScrollBarImageColor3 = C.muted, CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, panel)
make("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }, body)
local rowTags = frame(body, UDim2.new(1, -6, 0, 22), nil, C.bg, 1)
rowTags.LayoutOrder = 1
make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6) }, rowTags)
local function chip(parent)
	local f = frame(parent, UDim2.new(0, 0, 1, 0), nil, C.card2, 0)
	f.AutomaticSize = Enum.AutomaticSize.X
	corner(f, 11)
	pad(f, 9, 0)
	local t = label(f, "", UDim2.new(0, 0, 1, 0), nil, 11, C.bg, Enum.Font.GothamBlack)
	t.AutomaticSize = Enum.AutomaticSize.X
	return f, t
end
local chipCat, chipCatT = chip(rowTags)
local chipAv, chipAvT = chip(rowTags)
local descText = label(body, "", UDim2.new(1, -6, 0, 0), nil, 13, C.muted, Enum.Font.Gotham)
descText.AutomaticSize = Enum.AutomaticSize.Y
descText.LayoutOrder = 2
label(body, "DESEMPENHO", UDim2.new(1, -6, 0, 16), nil, 11, C.muted, Enum.Font.GothamBlack).LayoutOrder = 3
local function statRow(order, name)
	local f = frame(body, UDim2.new(1, -6, 0, 34), nil, C.bg, 1)
	f.LayoutOrder = order
	label(f, name, UDim2.new(0.6, 0, 0, 16), nil, 12, C.text, Enum.Font.GothamBold)
	local v = label(f, "", UDim2.new(0.4, 0, 0, 16), UDim2.new(0.6, 0, 0, 0), 12, C.gold, Enum.Font.GothamBlack)
	v.TextXAlignment = Enum.TextXAlignment.Right
	local bg = frame(f, UDim2.new(1, 0, 0, 6), UDim2.new(0, 0, 0, 22), C.card2, 0)
	corner(bg, 3)
	local fill = frame(bg, UDim2.new(0, 0, 1, 0), nil, C.gold, 0)
	corner(fill, 3)
	make("UIGradient", { Color = ColorSequence.new(rgb(255, 150, 40), rgb(255, 220, 90)) }, fill)
	return v, fill
end
local vVmax, fVmax = statRow(4, "Velocidade máxima")
local vAcc, fAcc = statRow(5, "Aceleração 0-100 km/h")
local vPot, fPot = statRow(6, "Potência")
local paintHead = frame(body, UDim2.new(1, -6, 0, 18), nil, C.bg, 1)
paintHead.LayoutOrder = 7
label(paintHead, "PINTURA", UDim2.new(0.5, 0, 1, 0), nil, 11, C.muted, Enum.Font.GothamBlack)
local paintName = label(paintHead, "", UDim2.new(0.5, 0, 1, 0), UDim2.new(0.5, 0, 0, 0), 12, C.text, Enum.Font.GothamBold)
paintName.TextXAlignment = Enum.TextXAlignment.Right
local swatches = frame(body, UDim2.new(1, -6, 0, 0), nil, C.bg, 1)
swatches.AutomaticSize = Enum.AutomaticSize.Y
swatches.LayoutOrder = 8
make("UIGridLayout", { CellSize = UDim2.new(0, 40, 0, 40), CellPadding = UDim2.new(0, 8, 0, 8), SortOrder = Enum.SortOrder.LayoutOrder }, swatches)
local swatchButtons = {}
-- bottom of the panel: price + action buttons
local foot = frame(panel, UDim2.new(1, -20, 0, 108), UDim2.new(0, 10, 1, -114), C.panel, 0)
corner(foot, 12)
label(foot, "PREÇO", UDim2.new(0.4, 0, 0, 16), UDim2.new(0, 12, 0, 8), 11, C.muted, Enum.Font.GothamBlack)
local priceText = label(foot, "", UDim2.new(0.65, 0, 0, 26), UDim2.new(0.35, -12, 0, 4), 22, C.green, Enum.Font.GothamBlack)
priceText.TextXAlignment = Enum.TextXAlignment.Right
local actionA = button(foot, "", UDim2.new(0.5, -15, 0, 46), UDim2.new(0, 10, 1, -54), C.card2, 14)
local actionB = button(foot, "", UDim2.new(0.5, -15, 0, 46), UDim2.new(0.5, 5, 1, -54), C.green, 15)
-- bottom-left: camera presets and zoom
local camBar = frame(insp, UDim2.new(0, 470, 0, 76), UDim2.new(0, 14, 1, -14), C.bg, 1)
camBar.AnchorPoint = Vector2.new(0, 1)
scaled(camBar)
local hint = label(camBar, "☝️ Arraste para girar  •  🤏 pinça ou +/− para zoom", UDim2.new(1, 0, 0, 18), nil, 12, C.text, Enum.Font.GothamBold)
hint.TextStrokeTransparency = 0.5
local presetRow = frame(camBar, UDim2.new(1, 0, 0, 46), UDim2.new(0, 0, 0, 26), C.bg, 1)
make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6) }, presetRow)

-- confirmation / success dialogs
local modal = frame(gui, UDim2.new(0, 380, 0, 250), UDim2.new(0.5, 0, 0.5, 0), C.bg, 0.02)
modal.AnchorPoint = Vector2.new(0.5, 0.5)
modal.Visible = false
modal.ZIndex = 30
corner(modal, 18)
stroke(modal, C.gold, 1.5, 0.3)
scaled(modal)
local mTitle = label(modal, "", UDim2.new(1, -40, 0, 30), UDim2.new(0, 20, 0, 18), 22, C.text, Enum.Font.GothamBlack)
local mBody = label(modal, "", UDim2.new(1, -40, 0, 110), UDim2.new(0, 20, 0, 56), 15, C.muted, Enum.Font.GothamBold)
mBody.TextYAlignment = Enum.TextYAlignment.Top
local mNo = button(modal, "", UDim2.new(0.5, -25, 0, 48), UDim2.new(0, 20, 1, -66), C.card2, 15)
local mYes = button(modal, "", UDim2.new(0.5, -25, 0, 48), UDim2.new(0.5, 5, 1, -66), C.green, 15)
for _, o in ipairs(modal:GetDescendants()) do if o:IsA("GuiObject") then o.ZIndex = 31 end end
local modalYes, modalNo = nil, nil
local function showModal(t, b, no, yes, onNo, onYes, yesColor)
	mTitle.Text = t
	mBody.Text = b
	mNo.Text = no
	mYes.Text = yes
	setButtonColor(mYes, yesColor or C.green)
	modalNo, modalYes = onNo, onYes
	modal.Visible = true
	local sc = modal:FindFirstChildOfClass("UIScale")
	local target = sc.Scale
	sc.Scale = target * 0.85
	TweenService:Create(sc, TweenInfo.new(0.22, Enum.EasingStyle.Back), { Scale = target }):Play()
end
mNo.MouseButton1Click:Connect(function()
	modal.Visible = false
	if modalNo then modalNo() end
end)
mYes.MouseButton1Click:Connect(function()
	modal.Visible = false
	if modalYes then modalYes() end
end)

-- ---------------------------------------------------------------- screen-size adaptation
local function fit()
	local vs = camera.ViewportSize
	local s = math.clamp(math.min(vs.X * 0.96 / 900, vs.Y * 0.92 / 520), 0.5, 1.25)
	for _, sc in ipairs(scales) do sc.Scale = s end
	-- the info panel takes the full height of the screen (in its own scaled units)
	panel.Size = UDim2.new(0, 330, 0, math.floor((vs.Y - 28) / s))
	camBar.Size = UDim2.new(0, math.floor(math.max(300, (vs.X - 28) / s - 360)), 0, 76)
	layoutGrid()
end
camera:GetPropertyChangedSignal("ViewportSize"):Connect(fit)
fit()

-- ---------------------------------------------------------------- hiding the rest of the game while the dealership is open
local controls = nil
pcall(function()
	controls = require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule")):GetControls()
end)
local hiddenGuis = {}
local function setWorldUI(visible)
	if not visible then
		hiddenGuis = {}
		for _, g in ipairs(player.PlayerGui:GetChildren()) do
			if g:IsA("ScreenGui") and g ~= gui and g.Enabled and g.Name ~= "Chat" then
				g.Enabled = false
				table.insert(hiddenGuis, g)
			end
		end
		if controls then pcall(function() controls:Disable() end) end
	else
		for _, g in ipairs(hiddenGuis) do if g.Parent then g.Enabled = true end end
		hiddenGuis = {}
		if controls then pcall(function() controls:Enable() end) end
	end
end

-- ================================================================= 3D preview + orbit camera
local preview, target, maxDim = nil, Vector3.zero, 16
local cam = { yaw = 0, pitch = 0.25, dist = 20, ty = 0, tp = 0, td = 20, idle = 0 }
local dragging, lastPos, touches = false, nil, {}
local pinchStart = nil
local studioCF = estudio.Value
local DOF = nil

local function clampCam()
	-- (the studio walls are ~32 studs from the turntable)
	local minD, maxD = maxDim * 0.55, math.min(maxDim * 1.7, 30)
	cam.td = math.clamp(cam.td, minD, maxD)
	cam.tp = math.clamp(cam.tp, math.rad(2), math.rad(68))
	-- keep the camera under the studio ceiling (26 studs)
	local maxY = studioCF.Position.Y + 22 - (target.Y - studioCF.Position.Y)
	if cam.td * math.sin(cam.tp) > maxY then cam.tp = math.asin(math.clamp(maxY / cam.td, 0, 1)) end
end

local function placePreview(nome)
	if preview then preview:Destroy() preview = nil end
	local m = displayModel(nome)
	if not m then return false end
	m:PivotTo(CFrame.new(studioCF.Position))
	local bcf, size = m:GetBoundingBox()
	local lift = studioCF.Position.Y - (bcf.Position.Y - size.Y / 2)
	m:PivotTo(m:GetPivot() + Vector3.new(studioCF.Position.X - bcf.Position.X, lift, studioCF.Position.Z - bcf.Position.Z))
	m.Name = "PreviewSolaris"
	m.Parent = workspace
	preview = m
	maxDim = math.max(size.X, size.Z)
	target = studioCF.Position + Vector3.new(0, size.Y * 0.42, 0)
	return true
end

local PRESETS = {
	{ "Frente", 180, 10, 1.0 },
	{ "Lateral", 270, 6, 1.05 },
	{ "Traseira", 0, 12, 1.0 },
	{ "3/4", 215, 18, 1.05 },
	{ "Roda", 245, 4, 0.6 },
	{ "Topo", 200, 62, 1.25 },
}
for i, p in ipairs(PRESETS) do
	local b = button(presetRow, p[1], UDim2.new(0, 64, 1, 0), nil, C.card, 12)
	b.LayoutOrder = i
	b.BackgroundTransparency = 0.1
	b.MouseButton1Click:Connect(function()
		cam.ty = math.rad(p[2])
		-- go the short way round
		while cam.ty - cam.yaw > math.pi do cam.ty = cam.ty - 2 * math.pi end
		while cam.yaw - cam.ty > math.pi do cam.ty = cam.ty + 2 * math.pi end
		cam.tp = math.rad(p[3])
		cam.td = maxDim * p[4]
		cam.idle = -4
		clampCam()
	end)
end
for i, z in ipairs({ { "＋", 0.8 }, { "－", 1.25 } }) do
	local b = button(presetRow, z[1], UDim2.new(0, 46, 1, 0), nil, C.card2, 20)
	b.LayoutOrder = 100 + i
	b.MouseButton1Click:Connect(function()
		cam.td = cam.td * z[2]
		cam.idle = -4
		clampCam()
	end)
end

UserInputService.InputBegan:Connect(function(input, processed)
	if state.modo ~= "inspecao" or modal.Visible then return end
	if input.UserInputType == Enum.UserInputType.Touch then
		touches[input] = true
		if processed then return end
		dragging, lastPos = true, input.Position
	elseif input.UserInputType == Enum.UserInputType.MouseButton1 and not processed then
		dragging, lastPos = true, input.Position
	end
end)
UserInputService.InputEnded:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.Touch then touches[input] = nil end
	if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
		dragging = false
	end
end)
UserInputService.InputChanged:Connect(function(input, processed)
	if state.modo ~= "inspecao" then return end
	if input.UserInputType == Enum.UserInputType.MouseWheel and not processed then
		cam.td = cam.td * (input.Position.Z > 0 and 0.88 or 1.14)
		cam.idle = -4
		clampCam()
		return
	end
	local n = 0
	for _ in pairs(touches) do n = n + 1 end
	if dragging and n <= 1 and (input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseMovement) then
		local d = input.Position - lastPos
		lastPos = input.Position
		cam.ty = cam.ty - d.X * 0.008
		cam.tp = cam.tp + d.Y * 0.006
		cam.idle = -3
		clampCam()
	end
end)
UserInputService.TouchPinch:Connect(function(_, scale, _, st, processed)
	if state.modo ~= "inspecao" or processed then return end
	if st == Enum.UserInputState.Begin then
		pinchStart = cam.td
	elseif pinchStart and scale > 0 then
		cam.td = pinchStart / scale
		cam.idle = -4
		clampCam()
	end
end)

RunService.RenderStepped:Connect(function(dt)
	if state.modo ~= "inspecao" then return end
	-- slow showroom orbit when nobody touches the screen
	cam.idle = cam.idle + dt
	if cam.idle > 0 and not dragging then cam.ty = cam.ty + dt * 0.12 end
	local k = math.clamp(dt * 7, 0, 1)
	cam.yaw = cam.yaw + (cam.ty - cam.yaw) * k
	cam.pitch = cam.pitch + (cam.tp - cam.pitch) * k
	cam.dist = cam.dist + (cam.td - cam.dist) * k
	local off = Vector3.new(math.sin(cam.yaw) * math.cos(cam.pitch), math.sin(cam.pitch), math.cos(cam.yaw) * math.cos(cam.pitch)) * cam.dist
	camera.CameraType = Enum.CameraType.Scriptable
	camera.CFrame = CFrame.lookAt(target + off, target)
	if DOF then DOF.FocusDistance = cam.dist end
end)

-- ---------------------------------------------------------------- info panel
local function availability(nome)
	local info = Catalogo.info(nome)
	if owns(nome) and info.preco > 0 then return "NA SUA GARAGEM", C.green end
	if info.preco <= 0 then return "GRÁTIS • NA GARAGEM", C.blue end
	if credits() < info.preco then return "CRÉDITOS INSUFICIENTES", C.red end
	return "DISPONÍVEL PARA COMPRA", C.gold
end

local function refreshPanel()
	local nome = state.carro
	if not nome then return end
	local info = Catalogo.info(nome)
	local ci = catInfo(info.categoria)
	tMarca.Text = string.upper(info.marca)
	tModelo.Text = info.modelo
	chipCat.BackgroundColor3 = ci.cor
	chipCatT.Text = string.upper(ci.nome)
	local at, ac = availability(nome)
	chipAv.BackgroundColor3 = ac
	chipAvT.Text = at
	descText.Text = info.descricao
	vVmax.Text = info.vmax .. " km/h"
	vAcc.Text = string.format("%.1f s", info.zero100)
	vPot.Text = info.potencia .. " cv"
	TweenService:Create(fVmax, TweenInfo.new(0.5, Enum.EasingStyle.Quad), { Size = UDim2.new(math.clamp(info.vmax / 420, 0.05, 1), 0, 1, 0) }):Play()
	TweenService:Create(fAcc, TweenInfo.new(0.5, Enum.EasingStyle.Quad), { Size = UDim2.new(math.clamp((8.5 - info.zero100) / 6.2, 0.05, 1), 0, 1, 0) }):Play()
	TweenService:Create(fPot, TweenInfo.new(0.5, Enum.EasingStyle.Quad), { Size = UDim2.new(math.clamp(info.potencia / 1600, 0.05, 1) ^ 0.6, 0, 1, 0) }):Play()
	local cor = Catalogo.CORES[state.cor]
	paintName.Text = cor and cor.nome or "Original"
	for i, b in pairs(swatchButtons) do
		local s = b:FindFirstChildOfClass("UIStroke")
		s.Transparency = (i == state.cor) and 0 or 0.8
		s.Thickness = (i == state.cor) and 3 or 1
	end
	local has = owns(nome)
	priceText.Text = info.preco > 0 and money(info.preco) or "GRÁTIS"
	if has then
		actionA.Text = "💾 SALVAR COR"
		setButtonColor(actionA, C.card2)
		actionB.Text = "🚗 DIRIGIR"
		setButtonColor(actionB, C.blue)
	else
		local falta = info.preco - credits()
		actionA.Text = "CORES ↺"
		setButtonColor(actionA, C.card2)
		actionB.Text = falta > 0 and ("FALTAM " .. Catalogo.formatar(falta)) or "COMPRAR"
		setButtonColor(actionB, falta > 0 and rgb(70, 74, 84) or C.green)
	end
end

-- colour swatches (index 0 = original)
do
	local list = { { 0, "Original", nil } }
	for i, c in ipairs(Catalogo.CORES) do table.insert(list, { i, c.nome, c.cor }) end
	for _, e in ipairs(list) do
		local b = make("TextButton", { Text = e[1] == 0 and "↺" or "", TextSize = 18, Font = Enum.Font.GothamBlack, TextColor3 = C.text, AutoButtonColor = false, BackgroundColor3 = e[3] or C.card2, LayoutOrder = e[1], BorderSizePixel = 0 }, swatches)
		corner(b, 20)
		make("UIStroke", { Color = C.text, Thickness = 1, Transparency = 0.8, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, b)
		if e[3] then
			make("UIGradient", { Rotation = 45, Color = ColorSequence.new(e[3]:Lerp(Color3.new(1, 1, 1), 0.35), e[3]:Lerp(Color3.new(0, 0, 0), 0.25)) }, b)
		end
		swatchButtons[e[1]] = b
		b.MouseButton1Click:Connect(function()
			sClick:Play()
			state.cor = e[1]
			if preview then Catalogo.pintar(preview, state.cor) end
			refreshPanel()
		end)
	end
end

-- ---------------------------------------------------------------- open / close
local function closeAll()
	state.modo = nil
	cat.Visible = false
	insp.Visible = false
	modal.Visible = false
	dim.Visible = false
	if preview then preview:Destroy() preview = nil end
	if DOF then DOF:Destroy() DOF = nil end
	camera.CameraType = Enum.CameraType.Custom
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if hum then camera.CameraSubject = hum end
	setWorldUI(true)
end

local function openCatalogue()
	if state.modo then return end
	buildCatalogue()
	refreshBalance()
	applyFilter()
	state.modo = "catalogo"
	setWorldUI(false)
	dim.Visible = true
	dim.BackgroundTransparency = 1
	TweenService:Create(dim, TweenInfo.new(0.25), { BackgroundTransparency = 0.45 }):Play()
	cat.Visible = true
	cat.Position = UDim2.new(0.5, 0, 0.56, 0)
	TweenService:Create(cat, TweenInfo.new(0.35, Enum.EasingStyle.Quint), { Position = UDim2.new(0.5, 0, 0.5, 0) }):Play()
	sWhoosh:Play()
end

local function backToCatalogue()
	if preview then preview:Destroy() preview = nil end
	if DOF then DOF:Destroy() DOF = nil end
	insp.Visible = false
	camera.CameraType = Enum.CameraType.Custom
	state.modo = "catalogo"
	dim.Visible = true
	cat.Visible = true
	refreshBalance()
	applyFilter()
end

openInspect = function(nome)
	local info = Catalogo.info(nome)
	if not info then return end
	if not placePreview(nome) then
		toast("Carregando os modelos 3D, tente de novo em instantes", C.red)
		return
	end
	state.carro = nome
	state.cor = savedColor(nome)
	Catalogo.pintar(preview, state.cor)
	cat.Visible = false
	dim.Visible = false
	insp.Visible = true
	state.modo = "inspecao"
	DOF = make("DepthOfFieldEffect", { FarIntensity = 0.25, NearIntensity = 0, InFocusRadius = 14, FocusDistance = 20 }, camera)
	-- cinematic arrival: from wide and high, settling at a 3/4 front view
	cam.yaw, cam.pitch, cam.dist = math.rad(160), math.rad(40), math.min(maxDim * 1.7, 30)
	cam.ty, cam.tp, cam.td = math.rad(215), math.rad(14), maxDim * 1.1
	cam.idle = -2.5
	clampCam()
	body.CanvasPosition = Vector2.new()
	refreshPanel()
	sWhoosh:Play()
end

local function doDrive(nome)
	closeAll()
	toast("🚗 Retirando seu " .. nome .. "...", C.gold)
	local ok, why = RDirigir:InvokeServer(nome)
	if not ok then
		toast(why == "espera" and "⏳ Aguarde alguns segundos para tirar outro carro" or "Não foi possível retirar o carro agora", C.red)
	end
end

actionA.MouseButton1Click:Connect(function()
	local nome = state.carro
	if not nome then return end
	if owns(nome) then
		local ok = RSalvarCor:InvokeServer(nome, state.cor)
		toast(ok and "💾 Cor salva! Seu carro vai sair com essa pintura." or "Não foi possível salvar a cor", ok and C.green or C.red)
	else
		state.cor = savedColor(nome)
		if preview then Catalogo.pintar(preview, state.cor) end
		refreshPanel()
	end
end)

actionB.MouseButton1Click:Connect(function()
	local nome = state.carro
	if not nome then return end
	local info = Catalogo.info(nome)
	if owns(nome) then
		if state.cor ~= savedColor(nome) then RSalvarCor:InvokeServer(nome, state.cor) end
		doDrive(nome)
		return
	end
	local falta = info.preco - credits()
	if falta > 0 then
		toast("Faltam " .. Catalogo.formatar(falta) .. " créditos. Corra, faça drift e descubra lugares!", C.red)
		return
	end
	local cor = Catalogo.CORES[state.cor]
	showModal("Confirmar compra",
		string.format("<b>%s %s</b>\nPintura: %s\n\nPreço: <font color=\"#34c76e\">%s</font>\nSaldo depois da compra: %s",
			info.marca, info.modelo, cor and cor.nome or "Original", money(info.preco), money(credits() - info.preco)),
		"CANCELAR", "CONFIRMAR", nil, function()
			local ok, reason, extra = RComprar:InvokeServer(nome, state.cor)
			if ok then
				sBuy:Play()
				refreshBalance()
				task.wait(0.15) -- let the "Carros" attribute arrive
				refreshPanel()
				showModal("🎉 Parabéns!", string.format("O <b>%s %s</b> foi adicionado à sua garagem.\n\nVocê pode dirigir agora ou tirá-lo depois pelo ícone <b>Car Spawner</b> no topo.", info.marca, info.modelo),
					"CONTINUAR", "🚗 DIRIGIR AGORA", nil, function() doDrive(nome) end, C.blue)
			elseif reason == "sem_dinheiro" then
				toast("Faltam " .. Catalogo.formatar(tonumber(extra) or 0) .. " créditos para esse carro", C.red)
			elseif reason == "ja_tem" then
				toast("Esse carro já está na sua garagem", C.green)
			else
				toast("Não foi possível concluir a compra", C.red)
			end
			refreshPanel()
		end)
end)

backBtn.MouseButton1Click:Connect(backToCatalogue)
closeBtn.MouseButton1Click:Connect(closeAll)
RAbrir.OnClientEvent:Connect(openCatalogue)
player:GetAttributeChangedSignal("Carros"):Connect(function()
	if state.modo == "catalogo" then applyFilter() elseif state.modo == "inspecao" then refreshPanel() end
end)
task.spawn(function()
	local ls = player:WaitForChild("leaderstats", 60)
	local c = ls and ls:WaitForChild("Creditos", 10)
	if c then c.Changed:Connect(function() refreshBalance() if state.modo == "inspecao" then refreshPanel() end end) end
end)
player.CharacterAdded:Connect(function()
	if state.modo then closeAll() end
end)

-- ---------------------------------------------------------------- the green area at the counter + automatic doors
task.spawn(function()
	local inPad = false
	local doors = nil
	while true do
		task.wait(0.2)
		local mapa = workspace:FindFirstChild("Mapa")
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if mapa and root then
			local padPart = mapa:FindFirstChild("AreaCatalogo")
			if padPart then
				local rel = padPart.CFrame:PointToObjectSpace(root.Position)
				local inside = math.abs(rel.X) < padPart.Size.X / 2 and math.abs(rel.Z) < padPart.Size.Z / 2 and rel.Y < 6
				if inside and not inPad and not state.modo then openCatalogue() end
				inPad = inside
			end
			if not doors then
				doors = {}
				for _, d in ipairs(mapa:GetChildren()) do
					if d.Name == "PortaAutomatica" and d:IsA("BasePart") then
						table.insert(doors, { part = d, base = d.CFrame, side = d:GetAttribute("Lado") or 1, open = false })
					end
				end
			end
			for _, d in ipairs(doors) do
				local near = (root.Position - d.base.Position).Magnitude < 20
				if near ~= d.open then
					d.open = near
					local goal = near and (d.base * CFrame.new(d.side * 7.5, 0, 0)) or d.base
					TweenService:Create(d.part, TweenInfo.new(0.6, Enum.EasingStyle.Quad), { CFrame = goal }):Play()
				end
			end
		end
	end
end)
