-- Configuracoes (LocalScript): in-game graphics settings (⚙️ button under the side bar).
-- Quality presets ALTA / MÉDIA / BAIXA plus individual switches: effects (bloom, colour,
-- sun rays, depth of field, haze), shadows, textures & materials, lights, particles and
-- animated traffic. Everything changes only on this device; the choice is saved with the
-- player's data (attribute "Config" from the server, sent back with SalvarConfig).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local SalvarConfig = ReplicatedStorage:WaitForChild("SalvarConfig")

local function rgb(r, g, b) return Color3.fromRGB(r, g, b) end
local GOLD, DARK, CARD = rgb(255, 200, 60), rgb(14, 15, 18), rgb(30, 33, 40)

-- ---------------------------------------------------------------- the settings
local KEYS = { "efeitos", "sombras", "texturas", "luzes", "particulas", "transito" }
local LABELS = {
	efeitos = "✨ Efeitos visuais (shaders)",
	sombras = "🌗 Sombras",
	texturas = "🧱 Texturas e materiais",
	luzes = "💡 Luzes da cidade",
	particulas = "💨 Fumaça e partículas",
	transito = "🚕 Trânsito animado",
}
local PRESETS = {
	alta = { efeitos = true, sombras = true, texturas = true, luzes = true, particulas = true, transito = true },
	media = { efeitos = true, sombras = true, texturas = true, luzes = false, particulas = true, transito = true },
	baixa = { efeitos = false, sombras = false, texturas = false, luzes = false, particulas = false, transito = false },
}
local cfg = { preset = "alta" }
for k, v in pairs(PRESETS.alta) do cfg[k] = v end

local function encode()
	local t = { "p=" .. cfg.preset }
	for _, k in ipairs(KEYS) do table.insert(t, k .. "=" .. (cfg[k] and "1" or "0")) end
	return table.concat(t, ";")
end
local function decode(s)
	for k, v in string.gmatch(s or "", "(%w+)=(%w+)") do
		if k == "p" then cfg.preset = PRESETS[v] and v or "personalizada"
		elseif cfg[k] ~= nil then cfg[k] = (v == "1") end
	end
end

-- ---------------------------------------------------------------- applying (local only)
local original = {} -- part -> {material, reflectance}
local function setTextures(on)
	for _, d in ipairs(workspace:GetDescendants()) do
		if d:IsA("BasePart") and not d:IsA("Terrain") then
			if not on then
				if not original[d] and d.Material ~= Enum.Material.SmoothPlastic and d.Material ~= Enum.Material.Neon and d.Material ~= Enum.Material.Glass then
					original[d] = { d.Material, d.Reflectance }
					d.Material = Enum.Material.SmoothPlastic
					d.Reflectance = 0
				end
			elseif original[d] then
				d.Material, d.Reflectance = original[d][1], original[d][2]
				original[d] = nil
			end
		elseif d:IsA("Decal") or d:IsA("Texture") then
			if not on then
				if d:GetAttribute("CfgT") == nil then d:SetAttribute("CfgT", d.Transparency) end
				d.Transparency = 1
			elseif d:GetAttribute("CfgT") ~= nil then
				d.Transparency = d:GetAttribute("CfgT")
				d:SetAttribute("CfgT", nil)
			end
		end
	end
	if on then
		for p, o in pairs(original) do
			if p.Parent then p.Material, p.Reflectance = o[1], o[2] end
		end
		original = {}
	end
end
local function setClass(className, on)
	for _, d in ipairs(workspace:GetDescendants()) do
		if d:IsA(className) then d.Enabled = on end
	end
end
local function apply()
	for _, e in ipairs(Lighting:GetChildren()) do
		if e:IsA("PostEffect") then e.Enabled = cfg.efeitos end
		if e:IsA("Atmosphere") then
			e:SetAttribute("Dens0", e:GetAttribute("Dens0") or e.Density)
			e.Density = cfg.efeitos and e:GetAttribute("Dens0") or 0.15
		end
	end
	Lighting.GlobalShadows = cfg.sombras
	setTextures(cfg.texturas)
	if not cfg.luzes then setClass("Light", false) end
	setClass("ParticleEmitter", cfg.particulas)
	player:SetAttribute("CfgTransito", cfg.transito)
end
-- things that appear later (spawned cars, lights switched on at night by the server)
workspace.DescendantAdded:Connect(function(d)
	if not cfg.texturas and d:IsA("BasePart") and d.Material ~= Enum.Material.SmoothPlastic and d.Material ~= Enum.Material.Neon and d.Material ~= Enum.Material.Glass then
		original[d] = { d.Material, d.Reflectance }
		d.Material = Enum.Material.SmoothPlastic
	elseif not cfg.particulas and d:IsA("ParticleEmitter") then
		d.Enabled = false
	elseif not cfg.luzes and d:IsA("Light") then
		d.Enabled = false
	end
end)
task.spawn(function()
	while true do
		task.wait(5)
		if not cfg.luzes then setClass("Light", false) end
	end
end)

-- ---------------------------------------------------------------- UI
local gui = Instance.new("ScreenGui")
gui.Name = "Configuracoes"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 12
gui.Parent = player:WaitForChild("PlayerGui")

local gear = Instance.new("TextButton")
gear.Size = UDim2.new(0, 60, 0, 60)
gear.Position = UDim2.new(1, -78, 0.5, 122)
gear.BackgroundColor3 = rgb(22, 24, 30)
gear.BackgroundTransparency = 0.05
gear.Text = "⚙️"
gear.TextSize = 28
gear.Visible = false
gear.Parent = gui
Instance.new("UICorner", gear).CornerRadius = UDim.new(0, 12)

local panel = Instance.new("Frame")
panel.Size = UDim2.new(0, 380, 0, 400)
panel.Position = UDim2.new(0.5, 0, 0.5, 0)
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.BackgroundColor3 = DARK
panel.BackgroundTransparency = 0.04
panel.Visible = false
panel.Active = true
panel.Parent = gui
Instance.new("UICorner", panel).CornerRadius = UDim.new(0, 18)
local st = Instance.new("UIStroke", panel)
st.Color = GOLD
st.Thickness = 2
local scale = Instance.new("UIScale", panel)
local function fit()
	local vs = camera.ViewportSize
	scale.Scale = math.clamp(math.min((vs.Y - 24) / 400, (vs.X - 24) / 380), 0.5, 1.2)
end
camera:GetPropertyChangedSignal("ViewportSize"):Connect(fit)
fit()

local function label(text, y, size, color)
	local l = Instance.new("TextLabel")
	l.Size = UDim2.new(1, -40, 0, size + 6)
	l.Position = UDim2.new(0, 20, 0, y)
	l.BackgroundTransparency = 1
	l.Text = text
	l.TextSize = size
	l.Font = Enum.Font.GothamBlack
	l.TextColor3 = color or rgb(255, 255, 255)
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Parent = panel
	return l
end
label("CONFIGURAÇÕES", 16, 22, GOLD)
label("Qualidade gráfica (só neste aparelho)", 50, 12, rgb(170, 175, 185))

local presetButtons = {}
local switchButtons = {}
local refresh
local function mkButton(text, size, pos, parent)
	local b = Instance.new("TextButton")
	b.Size = size
	b.Position = pos
	b.BackgroundColor3 = CARD
	b.Text = text
	b.TextColor3 = rgb(255, 255, 255)
	b.TextSize = 15
	b.Font = Enum.Font.GothamBlack
	b.AutoButtonColor = true
	b.Parent = parent or panel
	Instance.new("UICorner", b).CornerRadius = UDim.new(0, 10)
	return b
end
for i, p in ipairs({ { "alta", "ALTA" }, { "media", "MÉDIA" }, { "baixa", "BAIXA" } }) do
	local b = mkButton(p[2], UDim2.new(0, 104, 0, 40), UDim2.new(0, 20 + (i - 1) * 116, 0, 74))
	presetButtons[p[1]] = b
	b.MouseButton1Click:Connect(function()
		cfg.preset = p[1]
		for k, v in pairs(PRESETS[p[1]]) do cfg[k] = v end
		apply()
		refresh()
		SalvarConfig:FireServer(encode())
	end)
end
for i, k in ipairs(KEYS) do
	local y = 128 + (i - 1) * 38
	local l = label(LABELS[k], y + 6, 14)
	l.Size = UDim2.new(1, -130, 0, 20)
	local b = mkButton("", UDim2.new(0, 78, 0, 30), UDim2.new(1, -98, 0, y))
	switchButtons[k] = b
	b.MouseButton1Click:Connect(function()
		cfg[k] = not cfg[k]
		cfg.preset = "personalizada"
		apply()
		refresh()
		SalvarConfig:FireServer((encode():gsub("p=personalizada", "p=c")))
	end)
end
local tip = label("Dica: o menu do Roblox (☰ → Configurações) também tem\n'Qualidade gráfica' para o celular ficar mais leve.", 358, 11, rgb(150, 155, 165))
tip.Size = UDim2.new(1, -40, 0, 30)
tip.TextWrapped = true
local close = mkButton("✕", UDim2.new(0, 36, 0, 36), UDim2.new(1, -52, 0, 14))
close.BackgroundColor3 = rgb(90, 30, 30)
close.MouseButton1Click:Connect(function() panel.Visible = false end)

refresh = function()
	for id, b in pairs(presetButtons) do
		b.BackgroundColor3 = (cfg.preset == id) and GOLD or CARD
		b.TextColor3 = (cfg.preset == id) and DARK or rgb(255, 255, 255)
	end
	for k, b in pairs(switchButtons) do
		b.Text = cfg[k] and "LIGADO" or "DESLIG."
		b.BackgroundColor3 = cfg[k] and rgb(40, 160, 90) or rgb(70, 72, 80)
	end
end
gear.MouseButton1Click:Connect(function()
	panel.Visible = not panel.Visible
	if panel.Visible then
		refresh()
		local target = scale.Scale
		scale.Scale = target * 0.85
		TweenService:Create(scale, TweenInfo.new(0.2, Enum.EasingStyle.Back), { Scale = target }):Play()
	end
end)

-- the gear shows together with the main HUD (after the intro)
task.spawn(function()
	local main = player.PlayerGui:WaitForChild("PortoSolaris", 60)
	local hud = main and main:WaitForChild("HUD", 60)
	while hud do
		gear.Visible = hud.Visible and main.Enabled
		task.wait(0.5)
	end
end)

-- saved choice: the server publishes it as an attribute when the data loads
-- (and again after each save, which simply re-applies the same values)
local lastApplied = nil
local function load()
	local saved = player:GetAttribute("Config")
	if saved == lastApplied and saved ~= nil then return end
	lastApplied = saved
	if saved then decode(saved) end
	apply()
	refresh()
end
player:GetAttributeChangedSignal("Config"):Connect(load)
if player:GetAttribute("Config") then load() else task.delay(6, function() if lastApplied == nil then load() end end) end
