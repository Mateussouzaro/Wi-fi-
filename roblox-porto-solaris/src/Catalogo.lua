-- Catalogo (ModuleScript in ReplicatedStorage): the Solaris Motors car catalogue,
-- paint colours and the rules shared by the server (purchases) and the client (UI).
-- The keys are the names of the 3D cars in ServerStorage.Vehicles.

local M = {}

M.CATEGORIAS = {
	{ id = "Todos", nome = "Todos", cor = Color3.fromRGB(255, 200, 60) },
	{ id = "Populares", nome = "Populares", cor = Color3.fromRGB(80, 200, 120) },
	{ id = "Sedas", nome = "Sedãs", cor = Color3.fromRGB(90, 160, 255) },
	{ id = "SUVs", nome = "SUVs", cor = Color3.fromRGB(255, 150, 60) },
	{ id = "Esportivos", nome = "Esportivos", cor = Color3.fromRGB(255, 70, 90) },
	{ id = "Luxo", nome = "Luxo", cor = Color3.fromRGB(190, 110, 255) },
}

-- vmax in km/h, zero100 in seconds, potencia in cv; preco in credits (0 = free starter car)
M.CARROS = {
	["Superbo"] = { marca = "Skovra", modelo = "Superbo 2.0 TSI", categoria = "Populares", preco = 0, vmax = 240, zero100 = 7.0, potencia = 220, ordem = 1,
		descricao = "Sedã familiar espaçoso e econômico. Perfeito para começar no Porto Solaris." },
	["Aurion B9"] = { marca = "Aurion", modelo = "B9 2.0 Quattro", categoria = "Populares", preco = 600, vmax = 250, zero100 = 5.8, potencia = 252, ordem = 2,
		descricao = "Tração integral, acabamento premium e ótimo para o dia a dia." },
	["Pontis G8"] = { marca = "Pontis", modelo = "G8 GXP 6.2 V8", categoria = "Sedas", preco = 0, vmax = 250, zero100 = 4.9, potencia = 415, ordem = 3,
		descricao = "Sedã com alma de muscle car: V8 aspirado e tração traseira." },
	["Brava Charger Wide"] = { marca = "Brava", modelo = "Charger SRT Widebody", categoria = "Sedas", preco = 1500, vmax = 315, zero100 = 3.6, potencia = 717, ordem = 4,
		descricao = "Quatro portas, carroceria alargada e um V8 supercharged de 717 cv." },
	["Trackhawk SRT"] = { marca = "Jepra", modelo = "Grand Trackhawk SRT", categoria = "SUVs", preco = 2000, vmax = 290, zero100 = 3.7, potencia = 710, ordem = 5,
		descricao = "O SUV mais rápido da cidade: tração 4x4 e compressor." },
	["Toro SUV"] = { marca = "Toro", modelo = "Urano V8 Biturbo", categoria = "SUVs", preco = 4000, vmax = 305, zero100 = 3.6, potencia = 650, ordem = 6,
		descricao = "Super SUV italiano com visual agressivo e muito luxo." },
	["Mustero Mach"] = { marca = "Mustero", modelo = "Mach 1 5.0 V8", categoria = "Esportivos", preco = 1400, vmax = 270, zero100 = 4.4, potencia = 480, ordem = 7,
		descricao = "Clássico pony car com V8 e câmbio manual de seis marchas." },
	["Brava Hellstar"] = { marca = "Brava", modelo = "Hellstar SRT", categoria = "Esportivos", preco = 1800, vmax = 320, zero100 = 3.6, potencia = 717, ordem = 8,
		descricao = "Muscle car de duas portas feito para arrancadas e burnouts." },
	["Sora GT"] = { marca = "Sora", modelo = "GT 3.0 Turbo", categoria = "Esportivos", preco = 2200, vmax = 250, zero100 = 4.1, potencia = 387, ordem = 9,
		descricao = "Seis cilindros em linha, chassi equilibrado e ótimo para drift." },
	["Vulpes GT-S"] = { marca = "Vulpes", modelo = "GT-S Coupé", categoria = "Esportivos", preco = 3000, vmax = 290, zero100 = 3.9, potencia = 520, ordem = 10,
		descricao = "Cupê leve de motor central, preciso nas curvas da Serra." },
	["Cadenza V"] = { marca = "Cadenza", modelo = "V Blackwing", categoria = "Luxo", preco = 2500, vmax = 322, zero100 = 3.7, potencia = 668, ordem = 11,
		descricao = "Sedã de luxo com V8 biturbo e interior em fibra de carbono." },
	["Kaiser Roadster"] = { marca = "Kaiser", modelo = "Roadster GTS 4.0", categoria = "Luxo", preco = 3500, vmax = 293, zero100 = 4.0, potencia = 400, ordem = 12,
		descricao = "Conversível de motor central para passear na orla ao pôr do sol." },
	["Mistral W16"] = { marca = "Bellatti", modelo = "Mistral W16 Roadster", categoria = "Luxo", preco = 8000, vmax = 420, zero100 = 2.4, potencia = 1600, ordem = 13,
		descricao = "O carro mais exclusivo da Solaris Motors: W16 quadriturbo de 1600 cv." },
}

-- paint colours (index 0 = the car's original paint)
M.CORES = {
	{ nome = "Vermelho", cor = Color3.fromRGB(190, 20, 30) },
	{ nome = "Preto", cor = Color3.fromRGB(18, 18, 20) },
	{ nome = "Branco", cor = Color3.fromRGB(240, 240, 242) },
	{ nome = "Azul", cor = Color3.fromRGB(25, 70, 190) },
	{ nome = "Verde", cor = Color3.fromRGB(30, 140, 70) },
	{ nome = "Amarelo", cor = Color3.fromRGB(250, 200, 20) },
	{ nome = "Laranja", cor = Color3.fromRGB(245, 110, 20) },
	{ nome = "Roxo", cor = Color3.fromRGB(110, 40, 170) },
	{ nome = "Prata", cor = Color3.fromRGB(175, 180, 186) },
	{ nome = "Grafite", cor = Color3.fromRGB(60, 63, 68) },
	{ nome = "Azul-bebê", cor = Color3.fromRGB(120, 190, 235) },
	{ nome = "Rosa", cor = Color3.fromRGB(240, 110, 170) },
	{ nome = "Vinho", cor = Color3.fromRGB(110, 15, 30) },
	{ nome = "Dourado", cor = Color3.fromRGB(200, 160, 60) },
}

function M.info(nome)
	return M.CARROS[nome]
end

-- list of car names, sorted by catalogue order
function M.lista()
	local t = {}
	for nome in pairs(M.CARROS) do table.insert(t, nome) end
	table.sort(t, function(a, b) return M.CARROS[a].ordem < M.CARROS[b].ordem end)
	return t
end

function M.formatar(n)
	local s = tostring(math.floor(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1."):reverse()
	if out:sub(1, 1) == "." then out = out:sub(2) end
	return out
end

-- can this player (owned = set of names) drive this car?
function M.podeUsar(owned, nome)
	local info = M.CARROS[nome]
	if not info then return true end -- cars outside the catalogue stay free
	return info.preco <= 0 or (owned ~= nil and owned[nome] == true)
end

-- purchase rules: returns ok, reason ("ok" | "desconhecido" | "ja_tem" | "sem_dinheiro"), price, missing
function M.validarCompra(credits, owned, nome)
	local info = M.CARROS[nome]
	if not info then return false, "desconhecido", 0, 0 end
	if M.podeUsar(owned, nome) then return false, "ja_tem", info.preco, 0 end
	if type(credits) ~= "number" or credits < info.preco then
		return false, "sem_dinheiro", info.preco, info.preco - (tonumber(credits) or 0)
	end
	return true, "ok", info.preco, 0
end

function M.corValida(i)
	i = tonumber(i)
	if i == nil or i ~= math.floor(i) or i < 0 or i > #M.CORES then return nil end
	return i
end

-- ---------------------------------------------------------------- paint (Roblox only)
-- The server tags the paint parts of every car once (attribute "Pintura" plus the
-- original colour in "CorOriginal"); clones made later (spawned cars, the
-- spawner's flattened display models, the studio preview) keep those attributes.
local SKIP_MATERIALS = { [Enum.Material.Glass] = true, [Enum.Material.Neon] = true, [Enum.Material.ForceField] = true }

local function inside(part, model, name)
	local p = part.Parent
	while p and p ~= model do
		local n = string.lower(p.Name)
		if n == name or string.sub(n, 1, #name) == name then return true end
		p = p.Parent
	end
	return false
end

local function key(c)
	return math.floor(c.R * 255 + 0.5) * 65536 + math.floor(c.G * 255 + 0.5) * 256 + math.floor(c.B * 255 + 0.5)
end

function M.marcarPintura(model)
	local named, all = {}, {}
	local areaByColor, namedArea = {}, {}
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") and d.Transparency < 0.5 and not SKIP_MATERIALS[d.Material] and not inside(d, model, "wheels") and not d:IsA("VehicleSeat") and not d:IsA("Seat") then
			local s = d.Size
			local area = s.X * s.Y + s.Y * s.Z + s.X * s.Z
			local k = key(d.Color)
			table.insert(all, { p = d, k = k })
			areaByColor[k] = (areaByColor[k] or 0) + area
			local n = string.lower(d.Name)
			local sa = d:FindFirstChildOfClass("SurfaceAppearance")
			if string.sub(n, 1, 5) == "paint" or inside(d, model, "paint") or (sa and string.lower(sa.Name) == "paint") then
				named[d] = true
				namedArea[k] = (namedArea[k] or 0) + area
			end
		end
	end
	-- main colour of the named paint parts, and the biggest colour of the whole body
	local nk, na = nil, 0
	for k, a in pairs(namedArea) do if a > na then nk, na = k, a end end
	local dk, da = nil, 0
	for k, a in pairs(areaByColor) do if a > da then dk, da = k, a end end
	local count = 0
	for _, e in ipairs(all) do
		local paint = named[e.p] or (nk ~= nil and e.k == nk) or (dk ~= nil and e.k == dk and (nk == nil or na < da * 0.1))
		if paint then
			e.p:SetAttribute("Pintura", true)
			e.p:SetAttribute("CorOriginal", e.p.Color)
			local sa = e.p:FindFirstChildOfClass("SurfaceAppearance")
			if sa then pcall(function() e.p:SetAttribute("CorOriginalSA", sa.Color) end) end
			count = count + 1
		end
	end
	return count
end

-- recolour a car (index 0 or nil = original paint)
function M.pintar(model, indice)
	local entry = indice and M.CORES[indice]
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") and d:GetAttribute("Pintura") then
			local c = entry and entry.cor or d:GetAttribute("CorOriginal") or d.Color
			d.Color = c
			local sa = d:FindFirstChildOfClass("SurfaceAppearance")
			if sa then
				pcall(function() sa.Color = entry and entry.cor or d:GetAttribute("CorOriginalSA") or Color3.new(1, 1, 1) end)
			end
		end
	end
end

return M
