-- Porto Solaris — car meet open world (server)
-- Builds the map (meet lot, gas station, showroom, downtown, beach), the car
-- catalogue and spawner, credits, places to discover and the day/night cycle.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local DataStoreService = game:GetService("DataStoreService")

local store = nil
pcall(function() store = DataStoreService:GetDataStore("PortoSolaris_v1") end)

local function remote(name)
	local r = Instance.new("RemoteEvent")
	r.Name = name
	r.Parent = ReplicatedStorage
	return r
end
local SpawnCar = remote("SpawnCar")
local Notify = remote("Notify")
local Progress = remote("Progress")

local map = Instance.new("Folder")
map.Name = "Mapa"
map.Parent = workspace
local carsFolder = Instance.new("Folder")
carsFolder.Name = "Carros"
carsFolder.Parent = workspace

local function rgb(r, g, b) return Color3.fromRGB(r, g, b) end
local V = Vector3.new

-- ------------------------------------------------------------------ lighting
Lighting.ClockTime = 15.5
Lighting.Brightness = 2.6
Lighting.EnvironmentDiffuseScale = 1
Lighting.EnvironmentSpecularScale = 1
Lighting.GlobalShadows = true
Lighting.OutdoorAmbient = rgb(120, 120, 130)
Lighting.ShadowSoftness = 0.25
local atmo = Instance.new("Atmosphere")
atmo.Density = 0.3
atmo.Offset = 0.1
atmo.Color = rgb(199, 186, 170)
atmo.Decay = rgb(106, 112, 125)
atmo.Glare = 0.4
atmo.Haze = 1.6
atmo.Parent = Lighting
local bloom = Instance.new("BloomEffect")
bloom.Intensity = 0.7
bloom.Size = 30
bloom.Threshold = 1.1
bloom.Parent = Lighting
local rays = Instance.new("SunRaysEffect")
rays.Intensity = 0.08
rays.Spread = 0.6
rays.Parent = Lighting
local cc = Instance.new("ColorCorrectionEffect")
cc.Contrast = 0.12
cc.Saturation = 0.12
cc.TintColor = rgb(255, 246, 236)
cc.Parent = Lighting
local sky = Instance.new("Sky")
sky.SunAngularSize = 14
sky.Parent = Lighting

-- ------------------------------------------------------------------ helpers
local function part(p)
	local o = Instance.new(p.Wedge and "WedgePart" or "Part")
	o.Anchored = true
	o.TopSurface = Enum.SurfaceType.Smooth
	o.BottomSurface = Enum.SurfaceType.Smooth
	if p.Shape then o.Shape = p.Shape end
	for k, v in pairs(p) do
		if k ~= "Parent" and k ~= "Shape" and k ~= "Wedge" then o[k] = v end
	end
	o.Parent = p.Parent or map
	return o
end
local function light(parent, color, range, brightness, kind)
	local l = Instance.new(kind or "PointLight")
	l.Color = color
	l.Range = range
	l.Brightness = brightness
	l.Parent = parent
	return l
end
local nightLights = {} -- turned on at night
local function sign(p, text, color, size)
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Front
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 30
	sg.LightInfluence = 0
	sg.Parent = p
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, 0, 1, 0)
	t.BackgroundTransparency = 1
	t.Text = text
	t.TextColor3 = color
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Parent = sg
	return sg
end

-- ------------------------------------------------------------------ terrain: land, beach, sea
local T = workspace.Terrain
T.WaterColor = rgb(24, 110, 140)
T.WaterReflectance = 0.6
T.WaterTransparency = 0.6
T.WaterWaveSize = 0.15
T.WaterWaveSpeed = 8
local function fill(cx, cy, cz, sx, sy, sz, mat)
	-- split into chunks so each terrain call stays small
	local step = 400
	local x0 = cx - sx / 2
	local z0 = cz - sz / 2
	local nx = math.ceil(sx / step)
	local nz = math.ceil(sz / step)
	for i = 0, nx - 1 do
		for j = 0, nz - 1 do
			local w = math.min(step, sx - i * step)
			local d = math.min(step, sz - j * step)
			T:FillBlock(CFrame.new(x0 + i * step + w / 2, cy, z0 + j * step + d / 2), V(w, sy, d), mat)
		end
	end
end
fill(0, -5.2, -200, 1600, 8, 1000, Enum.Material.Grass) -- land (top about y=-1.2, under every road), z from -700 to 300
fill(0, -5.6, 330, 1600, 8, 60, Enum.Material.Sand) -- beach
fill(0, -22, 700, 1600, 20, 680, Enum.Material.Sand) -- sea floor
fill(0, -7, 700, 1600, 12, 680, Enum.Material.Water) -- sea (surface at y=-1)

-- ------------------------------------------------------------------ roads
local asphalt = rgb(52, 54, 58)
local roadN = 0
local function road(x1, z1, x2, z2, w)
	roadN = roadN + 1
	local y = 0.1 + roadN * 0.004
	local a, b = V(x1, y, z1), V(x2, y, z2)
	local len = (b - a).Magnitude
	local cf = CFrame.lookAt((a + b) / 2, b)
	local r = part({ Size = V(w, 0.2, len + w), CFrame = cf, Color = asphalt, Material = Enum.Material.Asphalt })
	-- dashed centre line
	local n = math.floor(len / 14)
	for i = 0, n - 1 do
		part({ Size = V(0.5, 0.22, 6), CFrame = cf * CFrame.new(0, 0.01, -len / 2 + 7 + i * 14), Color = rgb(245, 210, 80), Material = Enum.Material.SmoothPlastic, CanCollide = false })
	end
	-- kerbs
	for _, s in ipairs({ -1, 1 }) do
		part({ Size = V(1.2, 0.3, len), CFrame = cf * CFrame.new(s * (w / 2 + 0.6), 0.05, 0), Color = rgb(200, 200, 195), Material = Enum.Material.Concrete, CanCollide = false })
	end
	return r
end
-- ring road + avenues
road(-420, -520, 420, -520, 26)
road(420, -520, 420, 270, 26)
road(420, 270, -420, 270, 26) -- beach boulevard
road(-420, 270, -420, -520, 26)
road(0, -520, 0, 270, 24) -- central avenue
road(-420, -140, 420, -140, 24) -- cross avenue
road(-420, 90, 420, 90, 22)

-- street lamps along the roads
local function lamp(x, z, ry)
	local pole = part({ Size = V(0.6, 16, 0.6), Position = V(x, 8, z), Color = rgb(40, 42, 46), Material = Enum.Material.Metal })
	local arm = part({ Size = V(0.4, 0.4, 5), CFrame = CFrame.new(x, 15.8, z) * CFrame.Angles(0, ry, 0) * CFrame.new(0, 0, -2.4), Color = rgb(40, 42, 46), Material = Enum.Material.Metal })
	local head = part({ Size = V(1.6, 0.5, 2.4), CFrame = arm.CFrame * CFrame.new(0, -0.3, -2.4), Color = rgb(255, 240, 200), Material = Enum.Material.Neon })
	local l = light(head, rgb(255, 214, 160), 40, 2.2, "SpotLight")
	l.Face = Enum.NormalId.Bottom
	l.Angle = 110
	table.insert(nightLights, { l = l, p = head })
	return pole
end
for z = -500, 250, 50 do
	lamp(14, z, math.rad(90))
	lamp(-14, z, math.rad(-90))
end
for x = -400, 400, 60 do
	if math.abs(x) > 20 then
		lamp(x, 284, 0)
		lamp(x, -154, math.rad(180))
	end
end

-- palms
local function palm(x, z, h)
	h = h or (14 + math.random() * 8)
	local lean = math.rad(math.random(-8, 8))
	local segs = 6
	local top = V(x, 0, z)
	for i = 1, segs do
		local y0 = (i - 1) * h / segs
		local p = part({ Size = V(1.3 - i * 0.08, h / segs + 0.3, 1.3 - i * 0.08), CFrame = CFrame.new(x + math.sin(lean) * y0, y0 + h / segs / 2, z) * CFrame.Angles(0, 0, -lean), Color = rgb(140 - i * 5, 110 - i * 4, 80), Material = Enum.Material.Wood })
		top = p.Position + V(0, h / segs / 2, 0)
	end
	for i = 1, 8 do
		local a = i / 8 * math.pi * 2
		part({ Size = V(1.6, 0.25, 9), CFrame = CFrame.new(top) * CFrame.Angles(0, a, 0) * CFrame.Angles(math.rad(-25), 0, 0) * CFrame.new(0, 0, -4.2), Color = rgb(60, 130 + math.random(0, 30), 50), Material = Enum.Material.Grass, CanCollide = false })
	end
end
math.randomseed(7)

-- ------------------------------------------------------------------ CAR CATALOGUE
-- len/width/height of the body, cabin size and position, nose wedge, wing, price, top speed (studs/s)
local CARS = {
	{ id = "solaris", name = "Solaris GT", len = 15, w = 6.6, h = 2.2, cab = { 6, 1.6, 0.6 }, wing = false, price = 0, top = 120, acc = 34, turn = 1.9, tag = "Esportivo" },
	{ id = "klassik", name = "Klassik 73", len = 13.5, w = 6.2, h = 2.4, cab = { 5.6, 1.9, 1.2 }, wing = false, round = true, price = 0, top = 100, acc = 28, turn = 2.0, tag = "Clássico" },
	{ id = "bravo", name = "Bravo V8", len = 16, w = 6.8, h = 2.4, cab = { 5.5, 1.7, 1.6 }, wing = true, price = 0, top = 125, acc = 36, turn = 1.7, tag = "Muscle" },
	{ id = "titan", name = "Titan X", len = 16, w = 7, h = 3.4, cab = { 9, 2.4, 0.8 }, wing = false, tall = true, price = 0, top = 95, acc = 26, turn = 1.6, tag = "SUV" },
	{ id = "luxo", name = "Luxo S", len = 17, w = 6.8, h = 2.4, cab = { 8, 2.0, 0.4 }, wing = false, price = 300, top = 115, acc = 30, turn = 1.7, tag = "Luxo" },
	{ id = "nova", name = "Nova E", len = 15, w = 6.6, h = 2.3, cab = { 8.5, 1.8, 0 }, wing = false, price = 500, top = 130, acc = 44, turn = 1.9, tag = "Elétrico" },
	{ id = "vortex", name = "Vortex R", len = 16, w = 7.2, h = 1.8, cab = { 5, 1.4, -0.4 }, wing = true, wedge = true, price = 800, top = 150, acc = 42, turn = 2.0, tag = "Supercarro" },
	{ id = "aero", name = "Aero LM", len = 17, w = 7.2, h = 1.9, cab = { 4.5, 1.5, -0.8 }, wing = true, wedge = true, stripe = true, price = 1200, top = 160, acc = 40, turn = 1.9, tag = "Corrida" },
}
local CAR_BY_ID = {}
for _, c in ipairs(CARS) do CAR_BY_ID[c.id] = c end
local catalogue = Instance.new("StringValue")
catalogue.Name = "Catalogo"
do
	local ids = {}
	for _, c in ipairs(CARS) do
		table.insert(ids, c.id .. "|" .. c.name .. "|" .. c.price .. "|" .. c.top .. "|" .. c.acc .. "|" .. c.tag)
	end
	catalogue.Value = table.concat(ids, ";")
end
catalogue.Parent = ReplicatedStorage

-- Build a car model. driveable=false makes a parked showcase car.
local function buildCar(spec, color, cf, driveable, livery)
	local m = Instance.new("Model")
	m.Name = spec.name
	local L, W, H = spec.len, spec.w, spec.h
	local wheelR = spec.tall and 1.7 or 1.35
	local GB = -0.6 -- bottom of the chassis box = ground level
	local root = Instance.new("Part")
	root.Name = "Chassi"
	root.Size = V(W - 0.4, 1.2, L - 0.6)
	root.CFrame = cf * CFrame.new(0, 0.6, 0)
	root.Transparency = 1
	root.CustomPhysicalProperties = PhysicalProperties.new(1.2, 0.05, 0, 1, 1)
	root.Anchored = not driveable
	root.Parent = m
	m.PrimaryPart = root
	local function vis(size, offset, colr, mat, extra)
		local p = Instance.new(extra and extra.wedge and "WedgePart" or "Part")
		p.Size = size
		p.CFrame = root.CFrame * offset
		p.Color = colr
		p.Material = mat or Enum.Material.SmoothPlastic
		p.Reflectance = (mat == nil) and 0.08 or 0
		p.CanCollide = false
		p.Massless = true
		p.Anchored = false
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		if extra and extra.shape then p.Shape = extra.shape end
		p.Parent = m
		local wd = Instance.new("WeldConstraint")
		wd.Part0 = root
		wd.Part1 = p
		wd.Parent = p
		return p
	end
	local paint = color
	local dark = rgb(20, 20, 24)
	-- lower body
	local BH = H * 0.62 + 0.5 -- body height
	local bodyY = GB + wheelR * 0.9 + (spec.tall and 0.5 or 0) + BH / 2
	vis(V(W, BH, L), CFrame.new(0, bodyY, 0), paint)
	-- hood and trunk slopes
	local noseLen = spec.wedge and 4.5 or 3.2
	vis(V(W - 0.2, 0.7, noseLen), CFrame.new(0, bodyY + BH / 2 + 0.25, -L / 2 + noseLen / 2) * CFrame.Angles(0, math.rad(180), 0), paint, nil, { wedge = true })
	-- side skirts / bumpers
	vis(V(W + 0.1, 0.45, L - 4), CFrame.new(0, bodyY - BH / 2 + 0.1, 0), dark)
	vis(V(W - 0.6, 0.6, 0.5), CFrame.new(0, bodyY - 0.2, -L / 2 - 0.1), dark)
	vis(V(W - 0.6, 0.6, 0.5), CFrame.new(0, bodyY - 0.2, L / 2 + 0.1), dark)
	-- cabin: glass greenhouse with a roof in the body colour
	local cl, ch, cz = spec.cab[1], spec.cab[2], spec.cab[3]
	local cabY = bodyY + BH / 2 + ch / 2
	vis(V(W - 1.0, ch, cl), CFrame.new(0, cabY, cz), rgb(25, 30, 38), Enum.Material.Glass).Transparency = 0.25
	vis(V(W - 1.3, 0.25, cl - 1.6), CFrame.new(0, cabY + ch / 2 + 0.05, cz + 0.3), paint)
	vis(V(W - 1.0, ch * 1.02, 1.6), CFrame.new(0, cabY, cz - cl / 2 - 0.6) * CFrame.Angles(0, math.rad(180), 0), rgb(25, 30, 38), Enum.Material.Glass, { wedge = true }).Transparency = 0.25
	vis(V(W - 1.0, ch * 1.02, 1.4), CFrame.new(0, cabY, cz + cl / 2 + 0.5), rgb(25, 30, 38), Enum.Material.Glass, { wedge = true }).Transparency = 0.25
	if spec.round then
		vis(V(W - 0.6, 1.2, 4), CFrame.new(0, bodyY + BH / 2 + 0.3, L / 2 - 2.2), paint, nil, { wedge = true })
	end
	-- wing
	if spec.wing then
		vis(V(W - 0.4, 0.2, 1.4), CFrame.new(0, bodyY + BH / 2 + 1.6, L / 2 - 1), dark)
		for _, s in ipairs({ -1, 1 }) do vis(V(0.2, 1.4, 0.5), CFrame.new(s * (W / 2 - 1), bodyY + BH / 2 + 0.8, L / 2 - 1), dark) end
	end
	-- livery stripes (racing look)
	if livery or spec.stripe then
		local sc = livery or rgb(255, 140, 0)
		vis(V(1.4, BH + 0.04, L + 0.02), CFrame.new(0, bodyY + 0.02, 0), sc)
		vis(V(1.4, 0.3, cl - 1.5), CFrame.new(0, cabY + ch / 2 + 0.12, cz + 0.3), sc)
	end
	-- lights
	local heads = {}
	for _, s in ipairs({ -1, 1 }) do
		local hl = vis(V(1.5, 0.45, 0.2), CFrame.new(s * (W / 2 - 1.1), bodyY + 0.25, -L / 2 - 0.02), rgb(255, 250, 235), Enum.Material.Neon)
		local spot = light(hl, rgb(255, 245, 225), 60, 3, "SpotLight")
		spot.Face = Enum.NormalId.Front
		spot.Angle = 60
		spot.Enabled = false
		table.insert(heads, spot)
		local tl = vis(V(1.6, 0.4, 0.2), CFrame.new(s * (W / 2 - 1.1), bodyY + 0.3, L / 2 + 0.02), rgb(255, 30, 40), Enum.Material.Neon)
		tl.Name = "Lanterna"
	end
	-- wheels (visual) with rims
	local wheels = {}
	for _, wx in ipairs({ -1, 1 }) do
		for _, wz in ipairs({ -1, 1 }) do
			local off = CFrame.new(wx * (W / 2 - 0.45), GB + wheelR, wz * (L / 2 - 2.8))
			local tyre = vis(V(1.1, wheelR * 2, wheelR * 2), off, rgb(22, 22, 22), Enum.Material.SmoothPlastic, { shape = Enum.PartType.Cylinder })
			local rim = vis(V(1.15, wheelR * 1.3, wheelR * 1.3), off, rgb(200, 200, 205), Enum.Material.Metal, { shape = Enum.PartType.Cylinder })
			rim.Reflectance = 0.3
			tyre.Name = "Roda"
			table.insert(wheels, tyre)
		end
	end
	if driveable then
		local seat = Instance.new("VehicleSeat")
		seat.Name = "Banco"
		seat.Size = V(2, 0.4, 2)
		seat.CFrame = root.CFrame * CFrame.new(-1.2, bodyY + BH / 2 - 0.6, cz + 0.6)
		seat.Transparency = 1
		seat.CanCollide = false
		seat.Massless = true
		seat.MaxSpeed = 0
		seat.Torque = 0
		seat.HeadsUpDisplay = false
		seat.Parent = m
		local wd = Instance.new("WeldConstraint")
		wd.Part0 = root
		wd.Part1 = seat
		wd.Parent = seat
		local pas = Instance.new("Seat")
		pas.Name = "Carona"
		pas.Size = V(2, 0.4, 2)
		pas.CFrame = root.CFrame * CFrame.new(1.2, bodyY + BH / 2 - 0.6, cz + 0.6)
		pas.Transparency = 1
		pas.CanCollide = false
		pas.Massless = true
		pas.Parent = m
		local wd2 = Instance.new("WeldConstraint")
		wd2.Part0 = root
		wd2.Part1 = pas
		wd2.Parent = pas
		-- driving constraints, controlled by the driver's client
		local att = Instance.new("Attachment")
		att.Name = "Motor"
		att.Parent = root
		local lv = Instance.new("LinearVelocity")
		lv.Name = "Tracao"
		lv.Attachment0 = att
		lv.RelativeTo = Enum.ActuatorRelativeTo.World
		lv.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
		lv.PrimaryTangentAxis = V(1, 0, 0)
		lv.SecondaryTangentAxis = V(0, 0, 1)
		lv.PlaneVelocity = Vector2.new(0, 0)
		lv.MaxForce = 4e5
		lv.Parent = root
		local av = Instance.new("AngularVelocity")
		av.Name = "Direcao"
		av.Attachment0 = att
		av.RelativeTo = Enum.ActuatorRelativeTo.World
		av.AngularVelocity = V(0, 0, 0)
		av.MaxTorque = 5e6
		av.Parent = root
		m:SetAttribute("Top", spec.top)
		m:SetAttribute("Acc", spec.acc)
		m:SetAttribute("Turn", spec.turn)
		m:SetAttribute("Car", true)
		m:SetAttribute("Nome", spec.name)
		-- a ProximityPrompt to get in
		local pp = Instance.new("ProximityPrompt")
		pp.ActionText = "Dirigir"
		pp.ObjectText = spec.name
		pp.HoldDuration = 0
		pp.MaxActivationDistance = 14
		pp.RequiresLineOfSight = false
		pp.Parent = root
		pp.Triggered:Connect(function(plr)
			local hum = plr.Character and plr.Character:FindFirstChildOfClass("Humanoid")
			if hum and not seat.Occupant then seat:Sit(hum) elseif hum and not pas.Occupant then pas:Sit(hum) end
		end)
		seat:GetPropertyChangedSignal("Occupant"):Connect(function()
			local occ = seat.Occupant
			if occ then
				local plr = Players:GetPlayerFromCharacter(occ.Parent)
				if plr then
					pcall(function() root:SetNetworkOwner(plr) end)
				end
				pp.Enabled = false
			else
				lv.PlaneVelocity = Vector2.new(0, 0)
				av.AngularVelocity = V(0, 0, 0)
				pcall(function() root:SetNetworkOwner(nil) end)
				pp.Enabled = true
			end
		end)
	end
	m:SetAttribute("Heads", #heads)
	for _, h in ipairs(heads) do table.insert(nightLights, { l = h, car = true }) end
	m.Parent = driveable and carsFolder or map
	return m
end

-- ------------------------------------------------------------------ MEET LOT "Encontro Solaris" (spawn)
local PALETTE = { rgb(235, 235, 240), rgb(20, 20, 24), rgb(200, 30, 40), rgb(30, 90, 200), rgb(120, 200, 230), rgb(250, 160, 30), rgb(40, 160, 90), rgb(120, 60, 180), rgb(210, 190, 150), rgb(160, 165, 172) }
-- ------------------------------------------------------------------ VEHICLES for the FORTUNE spawner
-- The cars in ServerStorage.Vehicles come from the vehicle pack, cleaned of every
-- script and fitted with a clean A-Chassis 6C. Here they get their menu category,
-- then the spawner is started.
local ServerStorage = game:GetService("ServerStorage")
local CATEGORY_BY_NAME = {
	["Brava Hellstar"] = "Esportivos", ["Brava Charger Wide"] = "Esportivos", ["Mustero Mach"] = "Esportivos",
	["Sora GT"] = "Esportivos", ["Kaiser Roadster"] = "Esportivos", ["Vulpes GT-S"] = "Esportivos",
	["Toro SUV"] = "Super", ["Mistral W16"] = "Super", ["Cadenza V"] = "Super",
	["Aurion B9"] = "Rua", ["Superbo"] = "Rua", ["Pontis G8"] = "Rua", ["Trackhawk SRT"] = "Rua",
}
local vehicles = ServerStorage:WaitForChild("Vehicles")
for _, v in ipairs(vehicles:GetChildren()) do
	v:SetAttribute("CarCategory", CATEGORY_BY_NAME[v.Name] or "Rua")
end
local SHOWCASE = vehicles:GetChildren()
-- parked copy of a real car for the meet lot and the showroom (no scripts, anchored)
local function showcase(cf, index)
	if #SHOWCASE == 0 then return nil end
	local src = SHOWCASE[((index or math.random(1, 1000)) - 1) % #SHOWCASE + 1]
	local m = src:Clone()
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("LuaSourceContainer") then
			d:Destroy()
		elseif d:IsA("BasePart") then
			d.Anchored = true
		elseif d:IsA("VehicleSeat") or d:IsA("Seat") then
			d.Disabled = true
		end
	end
	local seat = m:FindFirstChild("DriveSeat")
	if seat then m.PrimaryPart = seat end
	-- rest the car on its wheels: lowest wheel bottom goes to the height of cf
	m:PivotTo(cf * CFrame.new(0, 0, 0) * (m:GetPivot() - m:GetPivot().Position))
	local low = nil
	local wheels = m:FindFirstChild("Wheels")
	if wheels then
		for _, w in ipairs(wheels:GetChildren()) do
			if w:IsA("BasePart") then
				local b = w.Position.Y - math.max(w.Size.Y, w.Size.Z) / 2
				low = low and math.min(low, b) or b
			end
		end
	end
	if not low then
		local bcf, size = m:GetBoundingBox()
		low = bcf.Position.Y - size.Y / 2
	end
	m:PivotTo(m:GetPivot() + V(0, cf.Position.Y - low, 0))
	local bcf = m:GetBoundingBox()
	m:PivotTo(m:GetPivot() + V(cf.Position.X - bcf.Position.X, 0, cf.Position.Z - bcf.Position.Z))
	m.Parent = map
	return m
end
do
	local spawnerScript = game:GetService("ServerScriptService"):FindFirstChild("SpawnerServer")
	if spawnerScript then
		pcall(function() spawnerScript.Enabled = true end)
		pcall(function() spawnerScript.Disabled = false end)
	end
end

-- paint shop: recolour the car you are sitting in
local Paint = remote("Paint")
Paint.OnServerEvent:Connect(function(plr, colorIndex, liveryIndex)
	local hum = plr.Character and plr.Character:FindFirstChildOfClass("Humanoid")
	local seat = hum and hum.SeatPart
	if not (seat and seat:IsA("VehicleSeat")) then
		Notify:FireClient(plr, "needcar")
		return
	end
	local car = seat.Parent
	local colr = PALETTE[tonumber(colorIndex) or 1] or PALETTE[1]
	local li = tonumber(liveryIndex) or 0
	for _, p in ipairs(car:GetDescendants()) do
		if p:IsA("BasePart") then
			if p.Name == "Pintura" then p.Color = colr end
			if p.Name == "Faixa" then
				if li > 0 then p.Color = PALETTE[li] p.Transparency = 0 else p.Transparency = 1 end
			end
		end
	end
	Notify:FireClient(plr, "painted")
end)

do
	local cx, cz = 45, 0
	part({ Size = V(150, 0.3, 100), Position = V(cx + 60, 0.12, cz), Color = rgb(46, 48, 52), Material = Enum.Material.Asphalt })
	-- parking stalls, two long rows facing each other plus one middle row
	local stall = 0
	for row = -1, 1 do
		for i = 0, 11 do
			local x = cx + 6 + i * 10
			local z = cz + row * 30
			part({ Size = V(0.4, 0.32, 16), Position = V(x - 5, 0.14, z), Color = rgb(240, 240, 240), Material = Enum.Material.SmoothPlastic, CanCollide = false })
			if i == 11 then part({ Size = V(0.4, 0.32, 16), Position = V(x + 5, 0.14, z), Color = rgb(240, 240, 240), Material = Enum.Material.SmoothPlastic, CanCollide = false }) end
			stall = stall + 1
			-- showcase cars parked in about half the stalls
			if math.random() < 0.3 then
				showcase(CFrame.new(x, 0.3, z) * CFrame.Angles(0, row == 1 and math.rad(180) or 0, 0))
			else
				local mark = part({ Name = "Vaga", Size = V(9, 0.33, 15), Position = V(x, 0.14, z), Color = rgb(46, 48, 52), Material = Enum.Material.Asphalt, CanCollide = false, Transparency = 1 })
				mark:SetAttribute("Vaga", true)
			end
		end
	end
	-- curbs, planters and palms around the lot (like the reference)
	for _, z in ipairs({ -50, 50 }) do
		part({ Size = V(150, 0.6, 3), Position = V(cx + 60, 0.3, z), Color = rgb(190, 180, 160), Material = Enum.Material.Concrete })
		for i = 0, 6 do
			palm(cx - 10 + i * 24, z + (z > 0 and 3 or -3))
		end
	end
	-- light poles inside the lot
	for i = 0, 3 do
		for _, z in ipairs({ -15, 15 }) do lamp(cx + 10 + i * 34, z, 0) end
	end
	-- entrance arch with the event name
	local a1 = part({ Size = V(2, 18, 2), Position = V(cx - 16, 9, -18), Color = rgb(30, 30, 34), Material = Enum.Material.Metal })
	local a2 = part({ Size = V(2, 18, 2), Position = V(cx - 16, 9, 18), Color = rgb(30, 30, 34), Material = Enum.Material.Metal })
	local banner = part({ Size = V(1, 5, 38), CFrame = CFrame.new(cx - 16, 16, 0) * CFrame.Angles(0, math.rad(-90), 0), Color = rgb(15, 15, 18), Material = Enum.Material.SmoothPlastic })
	sign(banner, "PORTO SOLARIS • CAR MEET", rgb(255, 200, 60))
	local neon = part({ Size = V(1.1, 0.4, 38), Position = V(cx - 16, 13.4, 0), Color = rgb(255, 120, 40), Material = Enum.Material.Neon })
	local _ = a1 and a2 and neon
	-- DJ / stage corner
	part({ Size = V(16, 1.2, 12), Position = V(cx + 128, 0.6, -30), Color = rgb(30, 30, 34), Material = Enum.Material.DiamondPlate })
	for i = 0, 3 do
		local spk = part({ Size = V(2.5, 5, 2.5), Position = V(cx + 122 + i * 4, 3.7, -35), Color = rgb(15, 15, 15), Material = Enum.Material.SmoothPlastic })
		local led = part({ Size = V(2.6, 0.3, 2.6), Position = spk.Position + V(0, 2.6, 0), Color = rgb(170, 60, 255), Material = Enum.Material.Neon })
		light(led, rgb(170, 60, 255), 18, 2)
	end
end
local spawn = Instance.new("SpawnLocation")
spawn.Anchored = true
spawn.Size = V(10, 0.4, 10)
spawn.Position = V(30, 0.3, 0)
spawn.Transparency = 1
spawn.CanCollide = false
spawn.Duration = 0
spawn.Parent = map

-- ------------------------------------------------------------------ GAS STATION "Posto Aurora"
do
	local cx, cz = 260, -60
	part({ Size = V(70, 0.3, 50), Position = V(cx, 0.12, cz), Color = rgb(70, 72, 76), Material = Enum.Material.Concrete })
	-- canopy
	local can = part({ Size = V(44, 2.2, 26), Position = V(cx, 14, cz), Color = rgb(245, 245, 245), Material = Enum.Material.SmoothPlastic })
	part({ Size = V(44.2, 0.9, 26.2), Position = V(cx, 13.2, cz), Color = rgb(210, 30, 40), Material = Enum.Material.SmoothPlastic })
	for i = -1, 1 do
		for j = -1, 1, 2 do
			local strip = part({ Size = V(10, 0.15, 1.2), Position = V(cx + i * 14, 12.8, cz + j * 6), Color = rgb(255, 255, 255), Material = Enum.Material.Neon })
			local l = light(strip, rgb(255, 250, 240), 26, 2.5, "SpotLight")
			l.Face = Enum.NormalId.Bottom
			l.Angle = 120
		end
	end
	sign(part({ Size = V(16, 3, 0.4), CFrame = CFrame.new(cx, 14, cz - 13.3) * CFrame.Angles(0, math.rad(180), 0), Color = rgb(210, 30, 40), Material = Enum.Material.SmoothPlastic }), "POSTO AURORA", rgb(255, 255, 255))
	for _, x in ipairs({ -18, 18 }) do
		for _, z in ipairs({ -10, 10 }) do
			part({ Size = V(1.6, 13, 1.6), Position = V(cx + x, 6.5, cz + z), Color = rgb(235, 235, 235), Material = Enum.Material.SmoothPlastic })
		end
	end
	-- pumps on islands
	for i = -1, 1 do
		part({ Size = V(3, 0.6, 12), Position = V(cx + i * 14, 0.4, cz), Color = rgb(180, 180, 175), Material = Enum.Material.Concrete })
		for _, z in ipairs({ -3, 3 }) do
			local pump = part({ Size = V(1.8, 5, 2.4), Position = V(cx + i * 14, 3.1, cz + z), Color = rgb(235, 235, 235), Material = Enum.Material.SmoothPlastic })
			part({ Size = V(1.85, 1.6, 2.45), Position = pump.Position + V(0, 1.2, 0), Color = rgb(210, 30, 40), Material = Enum.Material.SmoothPlastic })
			local scr = part({ Size = V(1.9, 0.8, 1.4), Position = pump.Position + V(0, 0.2, 0), Color = rgb(40, 220, 120), Material = Enum.Material.Neon })
			local _ = scr
		end
	end
	-- convenience store
	part({ Size = V(30, 9, 14), Position = V(cx, 4.5, cz + 28), Color = rgb(230, 225, 215), Material = Enum.Material.Concrete })
	local glass = part({ Size = V(26, 6, 0.4), Position = V(cx, 3.6, cz + 20.9), Color = rgb(150, 200, 220), Material = Enum.Material.Glass, Transparency = 0.3 })
	light(glass, rgb(255, 240, 210), 20, 1.5)
	sign(part({ Size = V(18, 2.5, 0.3), CFrame = CFrame.new(cx, 8.2, cz + 20.8) * CFrame.Angles(0, math.rad(180), 0), Color = rgb(20, 20, 20), Material = Enum.Material.SmoothPlastic }), "LOJA 24H", rgb(255, 210, 60))
	-- price totem
	local tot = part({ Size = V(4, 14, 1), Position = V(cx + 30, 7, cz - 22), Color = rgb(210, 30, 40), Material = Enum.Material.SmoothPlastic })
	sign(tot, "AURORA\n5,99", rgb(255, 255, 255))
	for i = 1, 4 do palm(cx - 34, cz - 24 + i * 12) end
end

-- ------------------------------------------------------------------ SHOWROOM "Solaris Motors"
local turntables = {}
do
	local cx, cz = -180, -60
	part({ Size = V(64, 0.4, 44), Position = V(cx, 0.2, cz), Color = rgb(235, 235, 238), Material = Enum.Material.Marble, Reflectance = 0.15 })
	part({ Size = V(64, 1, 44), Position = V(cx, 16, cz), Color = rgb(40, 40, 44), Material = Enum.Material.Concrete })
	part({ Size = V(64, 16, 1), Position = V(cx, 8, cz + 22), Color = rgb(60, 62, 68), Material = Enum.Material.Concrete })
	part({ Size = V(1, 16, 44), Position = V(cx - 32, 8, cz), Color = rgb(60, 62, 68), Material = Enum.Material.Concrete })
	part({ Size = V(1, 16, 44), Position = V(cx + 32, 8, cz), Color = rgb(60, 62, 68), Material = Enum.Material.Concrete })
	-- glass front with a door gap in the middle
	for _, s in ipairs({ -1, 1 }) do
		part({ Size = V(24, 14, 0.4), Position = V(cx + s * 19, 7, cz - 22), Color = rgb(160, 200, 220), Material = Enum.Material.Glass, Transparency = 0.55 })
	end
	sign(part({ Size = V(30, 4, 0.5), CFrame = CFrame.new(cx, 18.5, cz - 22) * CFrame.Angles(0, math.rad(180), 0), Color = rgb(15, 15, 18), Material = Enum.Material.SmoothPlastic }), "SOLARIS MOTORS", rgb(120, 200, 255))
	-- ceiling light panels
	for i = -1, 1 do
		for j = -1, 1 do
			local pnl = part({ Size = V(10, 0.2, 6), Position = V(cx + i * 18, 15.4, cz + j * 12), Color = rgb(255, 255, 255), Material = Enum.Material.Neon })
			light(pnl, rgb(255, 250, 245), 26, 1.6)
		end
	end
	-- display cars on turntables
	local show = { "vortex", "aero", "nova", "luxo" }
	for i, id in ipairs(show) do
		local x = cx - 21 + (i - 1) * 14
		local tt = part({ Shape = Enum.PartType.Cylinder, Size = V(0.6, 14, 14), CFrame = CFrame.new(x, 0.6, cz + 6) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(30, 30, 34), Material = Enum.Material.Metal, Reflectance = 0.2 })
		local car = showcase(CFrame.new(x, 0.9, cz + 6), i * 3)
		local ring = part({ Shape = Enum.PartType.Cylinder, Size = V(0.1, 14.4, 14.4), CFrame = CFrame.new(x, 0.32, cz + 6) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(120, 200, 255), Material = Enum.Material.Neon })
		local _ = ring and tt
		if car then table.insert(turntables, { car = car, base = car:GetPivot(), speed = 0.35 + i * 0.05 }) end
		local _ = id
	end
	-- garage counter NPC prompt
	local desk = part({ Name = "Balcao", Size = V(8, 3, 3), Position = V(cx + 20, 1.7, cz - 10), Color = rgb(20, 20, 24), Material = Enum.Material.Marble })
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = "Abrir garagem"
	pp.ObjectText = "Solaris Motors"
	pp.MaxActivationDistance = 12
	pp.RequiresLineOfSight = false
	pp.Parent = desk
	pp.Triggered:Connect(function(plr) Notify:FireClient(plr, "garage") end)
end

-- ------------------------------------------------------------------ DOWNTOWN towers (north) and houses
do
	for i = 0, 13 do
		for j = 0, 2 do
			local x = -380 + i * 56 + math.random(-6, 6)
			local z = -330 - j * 60 + math.random(-6, 6)
			if math.abs(x) > 24 then
				local h = 30 + math.random() * 90
				local w = 26 + math.random() * 10
				local tw = part({ Size = V(w, h, w), Position = V(x, h / 2, z), Color = Color3.fromHSV(0.56 + math.random() * 0.05, 0.25, 0.35 + math.random() * 0.25), Material = Enum.Material.Glass, Reflectance = 0.35 })
				-- vertical mullions on every face
				for m = -2, 2 do
					for _, sg in ipairs({ -1, 1 }) do
						part({ Size = V(0.3, h, 0.5), Position = V(x + sg * (w / 2 + 0.15), h / 2, z + m * w / 5), Color = rgb(40, 44, 50), Material = Enum.Material.Metal, CanCollide = false })
						part({ Size = V(0.5, h, 0.3), Position = V(x + m * w / 5, h / 2, z + sg * (w / 2 + 0.15)), Color = rgb(40, 44, 50), Material = Enum.Material.Metal, CanCollide = false })
					end
				end
				-- roof cap and a few lit floors at night
				part({ Size = V(w + 0.6, 1.2, w + 0.6), Position = V(x, h + 0.6, z), Color = rgb(50, 52, 58), Material = Enum.Material.Concrete })
				for k = 1, math.floor(h / 8) do
					if math.random() < 0.35 then
						local band = part({ Size = V(w + 0.1, 2.2, w + 0.1), Position = V(x, k * 8 - 3, z), Color = rgb(255, 214, 150), Material = Enum.Material.Glass, Transparency = 1, CanCollide = false })
						table.insert(nightLights, { band = band })
					end
				end
				local _ = tw
			end
		end
	end
	-- houses south-west and south-east
	for i = 0, 9 do
		for _, x0 in ipairs({ 230 }) do
			local x = x0 + (i % 5) * 26
			local z = 150 + math.floor(i / 5) * 40
			part({ Size = V(16, 8, 14), Position = V(x, 4, z), Color = Color3.fromHSV(math.random(), 0.25, 0.92), Material = Enum.Material.Concrete })
			part({ Size = V(17, 1, 15), Position = V(x, 8.5, z), Color = rgb(160, 80, 50), Material = Enum.Material.Slate })
			if i % 2 == 0 then palm(x + 9, z - 9) end
		end
	end
end

-- ------------------------------------------------------------------ DISTRITO SAKURA (Japanese-style district, west)
local TweenService = game:GetService("TweenService")
do
	local cx, cz = -300, 180
	-- stone paving
	part({ Size = V(220, 0.3, 140), Position = V(cx, 0.12, cz), Color = rgb(150, 146, 140), Material = Enum.Material.Slate })
	-- main street through the district (from the ring road)
	part({ Size = V(220, 0.32, 16), Position = V(cx, 0.14, cz), Color = rgb(70, 70, 74), Material = Enum.Material.Asphalt })
	-- torii gate at the east entrance
	local function torii(x, z, s)
		local red = rgb(200, 40, 35)
		for _, dz in ipairs({ -7 * s, 7 * s }) do
			part({ Shape = Enum.PartType.Cylinder, Size = V(18 * s, 1.6 * s, 1.6 * s), CFrame = CFrame.new(x, 9 * s, z + dz) * CFrame.Angles(0, 0, math.rad(90)), Color = red, Material = Enum.Material.SmoothPlastic })
			part({ Size = V(2.4 * s, 1.2 * s, 2.4 * s), Position = V(x, 0.6 * s, z + dz), Color = rgb(30, 30, 30), Material = Enum.Material.SmoothPlastic })
		end
		part({ Size = V(1.4 * s, 1.2 * s, 19 * s), Position = V(x, 14 * s, z), Color = red, Material = Enum.Material.SmoothPlastic })
		part({ Size = V(2 * s, 1.4 * s, 22 * s), Position = V(x, 17.4 * s, z), Color = red, Material = Enum.Material.SmoothPlastic })
		part({ Size = V(2.2 * s, 0.7 * s, 23 * s), Position = V(x, 18.4 * s, z), Color = rgb(25, 25, 28), Material = Enum.Material.SmoothPlastic })
		part({ Size = V(1.2 * s, 3 * s, 1.2 * s), Position = V(x, 15.7 * s, z), Color = red, Material = Enum.Material.SmoothPlastic })
	end
	torii(cx + 104, cz, 1.2)
	-- five-storey pagoda
	local px, pz = cx - 50, cz + 62
	part({ Size = V(30, 2, 30), Position = V(px, 1, pz), Color = rgb(120, 116, 110), Material = Enum.Material.Cobblestone })
	local y = 2
	for i = 0, 4 do
		local w = 18 - i * 2.6
		local h = 6 - i * 0.4
		part({ Size = V(w, h, w), Position = V(px, y + h / 2, pz), Color = rgb(190, 60, 45), Material = Enum.Material.Wood })
		local roof = part({ Size = V(w + 7, 0.8, w + 7), Position = V(px, y + h + 0.4, pz), Color = rgb(40, 44, 50), Material = Enum.Material.Slate })
		-- curved eaves: small tilted slabs on each side
		for k = 0, 3 do
			local a = k * math.pi / 2
			part({ Size = V(w + 7, 0.5, 2.5), CFrame = CFrame.new(px, y + h + 0.2, pz) * CFrame.Angles(0, a, 0) * CFrame.new(0, 0.3, (w + 7) / 2) * CFrame.Angles(math.rad(-14), 0, 0), Color = rgb(40, 44, 50), Material = Enum.Material.Slate })
		end
		local lan = part({ Shape = Enum.PartType.Ball, Size = V(1.4, 1.4, 1.4), Position = V(px, y + h - 0.8, pz - w / 2 - 1.2), Color = rgb(255, 180, 90), Material = Enum.Material.Neon })
		local l = light(lan, rgb(255, 170, 90), 18, 1.5)
		table.insert(nightLights, { l = l })
		y = y + h + 0.8
		local _ = roof
	end
	part({ Shape = Enum.PartType.Cylinder, Size = V(8, 0.6, 0.6), CFrame = CFrame.new(px, y + 4, pz) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(201, 162, 39), Material = Enum.Material.Metal })
	-- cherry trees with falling petals
	local function sakura(x, z)
		local h = 7 + math.random() * 3
		part({ Size = V(1.4, h, 1.4), CFrame = CFrame.new(x, h / 2, z) * CFrame.Angles(0, 0, math.rad(math.random(-8, 8))), Color = rgb(70, 45, 35), Material = Enum.Material.Wood })
		local top
		for i = 1, 5 do
			local s = 6 + math.random() * 4
			top = part({ Shape = Enum.PartType.Ball, Size = V(s, s, s), Position = V(x + math.random(-3, 3), h + math.random(-1, 3), z + math.random(-3, 3)), Color = Color3.fromHSV(0.93 + math.random() * 0.04, 0.25 + math.random() * 0.15, 1), Material = Enum.Material.SmoothPlastic, CanCollide = false })
		end
		local pe = Instance.new("ParticleEmitter")
		pe.Color = ColorSequence.new(rgb(255, 190, 210))
		pe.Size = NumberSequence.new(0.25)
		pe.Rate = 4
		pe.Lifetime = NumberRange.new(5, 8)
		pe.Speed = NumberRange.new(0.5, 1.5)
		pe.Acceleration = V(0.6, -1.2, 0.3)
		pe.SpreadAngle = Vector2.new(180, 180)
		pe.Rotation = NumberRange.new(0, 360)
		pe.RotSpeed = NumberRange.new(-90, 90)
		pe.LightEmission = 0.2
		pe.Parent = top
	end
	for i = 0, 9 do
		sakura(cx - 100 + i * 21, cz - 22)
		sakura(cx - 100 + i * 21, cz + 22)
	end
	for i = 1, 6 do sakura(px - 22 - math.random(0, 8), pz - 14 + i * 4) end
	-- stone lanterns (toro) along the street
	local function toro(x, z)
		local g = rgb(150, 148, 140)
		part({ Size = V(2.4, 0.6, 2.4), Position = V(x, 0.4, z), Color = g, Material = Enum.Material.Slate })
		part({ Shape = Enum.PartType.Cylinder, Size = V(3, 0.9, 0.9), CFrame = CFrame.new(x, 2.1, z) * CFrame.Angles(0, 0, math.rad(90)), Color = g, Material = Enum.Material.Slate })
		local box = part({ Size = V(1.8, 1.6, 1.8), Position = V(x, 4.4, z), Color = rgb(255, 210, 140), Material = Enum.Material.Neon, Transparency = 0.15 })
		part({ Size = V(3.2, 0.5, 3.2), Position = V(x, 5.4, z), Color = g, Material = Enum.Material.Slate })
		part({ Size = V(1, 0.8, 1), Position = V(x, 6, z), Color = g, Material = Enum.Material.Slate })
		local l = light(box, rgb(255, 190, 120), 16, 1.6)
		table.insert(nightLights, { l = l })
	end
	for i = 0, 8 do
		toro(cx - 96 + i * 24, cz - 10)
		toro(cx - 96 + i * 24, cz + 10)
	end
	-- red paper lanterns strung across the street
	for i = 0, 6 do
		local x = cx - 80 + i * 26
		for _, dz in ipairs({ -12, 12 }) do part({ Size = V(0.5, 12, 0.5), Position = V(x, 6, cz + dz), Color = rgb(40, 30, 25), Material = Enum.Material.Wood }) end
		part({ Size = V(0.15, 0.15, 24), Position = V(x, 11.5, cz), Color = rgb(30, 30, 30), Material = Enum.Material.SmoothPlastic, CanCollide = false })
		for k = -2, 2 do
			local ln = part({ Shape = Enum.PartType.Cylinder, Size = V(1.6, 1.4, 1.4), CFrame = CFrame.new(x, 10.4, cz + k * 4.5) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(220, 40, 40), Material = Enum.Material.Neon, CanCollide = false })
			table.insert(nightLights, { band = ln })
		end
	end
	-- little shops with curtains (noren) and glowing signs
	local SHOPS = { { "RAMEN", rgb(230, 60, 50) }, { "SUSHI", rgb(40, 120, 200) }, { "MANGÁ", rgb(250, 160, 30) }, { "CHÁ", rgb(60, 160, 90) }, { "LAMEN", rgb(180, 60, 160) }, { "DOCES", rgb(240, 110, 150) } }
	for i, sh in ipairs(SHOPS) do
		for _, side in ipairs({ -1, 1 }) do
			local x = cx - 90 + (i - 1) * 32 + (side > 0 and 14 or 0)
			local z = cz + side * 40
			local wall = part({ Size = V(14, 9, 12), Position = V(x, 4.5, z), Color = rgb(230, 220, 200), Material = Enum.Material.Plaster })
			part({ Size = V(16, 1, 14), Position = V(x, 9.4, z), Color = rgb(45, 48, 55), Material = Enum.Material.Slate })
			part({ Size = V(15, 0.5, 3), CFrame = CFrame.new(x, 7.6, z - side * 7) * CFrame.Angles(math.rad(side * 18), 0, 0), Color = rgb(45, 48, 55), Material = Enum.Material.Slate })
			for k = -2, 2 do
				part({ Size = V(1.6, 2.6, 0.1), Position = V(x + k * 1.7, 5.6, z - side * 6.05), Color = sh[2], Material = Enum.Material.Fabric, CanCollide = false })
			end
			local board = part({ Size = V(10, 2, 0.4), CFrame = CFrame.new(x, 8.2, z - side * 6.3) * CFrame.Angles(0, side > 0 and 0 or math.rad(180), 0), Color = rgb(20, 20, 22), Material = Enum.Material.SmoothPlastic })
			sign(board, sh[1], sh[2])
			local glow = part({ Size = V(10, 3, 0.2), Position = V(x, 3.6, z - side * 6.1), Color = rgb(255, 220, 160), Material = Enum.Material.Neon, Transparency = 0.35 })
			table.insert(nightLights, { band = glow })
			local _ = wall
		end
	end
	-- glowing vending machines
	for i = 0, 3 do
		local vm = part({ Size = V(3, 6.5, 2.4), Position = V(cx - 70 + i * 40, 3.25, cz - 14.5), Color = Color3.fromHSV(i * 0.22, 0.6, 0.9), Material = Enum.Material.SmoothPlastic })
		local front = part({ Size = V(2.6, 4, 0.2), Position = vm.Position + V(0, 0.6, 1.25), Color = rgb(230, 240, 255), Material = Enum.Material.Neon, Transparency = 0.2 })
		light(front, rgb(220, 235, 255), 10, 1)
	end
	-- koi pond beside the pagoda (real water)
	local kx, kz = px + 44, pz - 2
	T:FillBlock(CFrame.new(kx, -1.5, kz), V(36, 3, 22), Enum.Material.Air)
	T:FillBlock(CFrame.new(kx, -3.5, kz), V(36, 1, 22), Enum.Material.Mud)
	T:FillBlock(CFrame.new(kx, -1.6, kz), V(34, 2.4, 20), Enum.Material.Water)
	part({ Size = V(38, 0.4, 24), Position = V(kx, 0.25, kz), Color = rgb(150, 146, 140), Material = Enum.Material.Slate, Transparency = 1, CanCollide = false })
	for i = 1, 14 do
		local a = i / 14 * math.pi * 2
		part({ Size = V(3 + math.random() * 2, 1.4, 2.6), CFrame = CFrame.new(kx + math.cos(a) * 18, 0.4, kz + math.sin(a) * 11) * CFrame.Angles(0, a, 0), Color = rgb(110, 108, 102), Material = Enum.Material.Rock })
	end
	for i = 1, 7 do
		local fish = part({ Size = V(1.6, 0.5, 0.6), Position = V(kx - 10 + i * 3, -0.9, kz + math.random(-5, 5)), Color = (i % 2 == 0) and rgb(255, 120, 30) or rgb(250, 250, 250), Material = Enum.Material.SmoothPlastic, CanCollide = false })
		TweenService:Create(fish, TweenInfo.new(3 + math.random() * 2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { CFrame = fish.CFrame * CFrame.new(math.random(-6, 6), 0, math.random(-4, 4)) * CFrame.Angles(0, math.rad(math.random(90, 270)), 0) }):Play()
	end
	-- red arched bridge over the pond
	for k = -4, 4 do
		local yy = 1.6 - (k * k) * 0.08
		part({ Size = V(2.2, 0.5, 5), Position = V(kx + k * 2.1, yy + 0.6, kz), Color = rgb(200, 40, 35), Material = Enum.Material.Wood })
	end
	-- bamboo clusters
	for i = 1, 24 do
		local x = cx - 105 + math.random() * 8
		local z = cz - 60 + i * 5
		local h = 10 + math.random() * 8
		part({ Shape = Enum.PartType.Cylinder, Size = V(h, 0.5, 0.5), CFrame = CFrame.new(x, h / 2, z) * CFrame.Angles(0, 0, math.rad(90 + math.random(-4, 4))), Color = rgb(110, 160, 60), Material = Enum.Material.SmoothPlastic })
	end
end

-- ------------------------------------------------------------------ BEACH boulevard + pier lookout
do
	for x = -400, 400, 30 do
		if math.abs(x) > 15 and x < 240 then palm(x, 300 + math.random(-4, 4)) end
	end
	part({ Size = V(820, 0.4, 8), Position = V(0, 0.2, 290), Color = rgb(225, 205, 170), Material = Enum.Material.WoodPlanks })
	-- pier
	part({ Size = V(14, 0.4, 52), Position = V(0, 0, 315), Color = rgb(150, 110, 75), Material = Enum.Material.WoodPlanks })
	part({ Size = V(14, 1, 120), Position = V(0, 1.6, 426), Color = rgb(150, 110, 75), Material = Enum.Material.WoodPlanks })
	for z = 375, 485, 12 do
		for _, x in ipairs({ -6, 6 }) do part({ Size = V(1, 10, 1), Position = V(x, -3, z), Color = rgb(110, 80, 55), Material = Enum.Material.Wood }) end
	end
	-- ramp from the boulevard up to the pier
	part({ Size = V(14, 1, 27), CFrame = CFrame.new(0, 0.85, 353) * CFrame.Angles(math.rad(3.1), 0, 0), Color = rgb(150, 110, 75), Material = Enum.Material.WoodPlanks })
	local lookout = part({ Size = V(30, 1, 30), Position = V(0, 1.6, 500), Color = rgb(150, 110, 75), Material = Enum.Material.WoodPlanks })
	local lh = part({ Shape = Enum.PartType.Cylinder, Size = V(20, 5, 5), CFrame = CFrame.new(10, 11.6, 508) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(240, 240, 240), Material = Enum.Material.SmoothPlastic })
	local lamp2 = part({ Shape = Enum.PartType.Ball, Size = V(3, 3, 3), Position = V(10, 23, 508), Color = rgb(255, 230, 150), Material = Enum.Material.Neon })
	light(lamp2, rgb(255, 230, 150), 60, 3)
	local _ = lookout and lh
end

-- ------------------------------------------------------------------ REALISM PASS: clouds, sidewalks, greenery, street furniture
do
	local clouds = Instance.new("Clouds")
	clouds.Cover = 0.55
	clouds.Density = 0.6
	clouds.Color = rgb(255, 245, 235)
	clouds.Parent = workspace.Terrain
	Lighting.ShadowSoftness = 0.18
	Lighting.ExposureCompensation = 0.1
	-- sidewalks with a low curb along both sides of the main roads
	local function sidewalk(x1, z1, x2, z2, roadW)
		local a, b = V(x1, 0, z1), V(x2, 0, z2)
		local len = (b - a).Magnitude
		local cf = CFrame.lookAt((a + b) / 2, b)
		for _, s in ipairs({ -1, 1 }) do
			part({ Size = V(5, 0.3, len), CFrame = cf * CFrame.new(s * (roadW / 2 + 4), 0.16, 0), Color = rgb(196, 192, 184), Material = Enum.Material.Concrete, CanCollide = false })
			-- tree pits and bushes every 30 studs
			for d = -len / 2 + 15, len / 2 - 15, 30 do
				local p = (cf * CFrame.new(s * (roadW / 2 + 4.5), 0, d)).Position
				local bush = part({ Shape = Enum.PartType.Ball, Size = V(3.4, 2.6, 3.4), Position = p + V(0, 1.2, 0), Color = Color3.fromHSV(0.27 + math.random() * 0.05, 0.55, 0.32 + math.random() * 0.1), Material = Enum.Material.Grass, CanCollide = false })
				local _ = bush
			end
		end
	end
	sidewalk(0, -520, 0, 270, 24)
	sidewalk(-420, -140, 420, -140, 24)
	sidewalk(-420, 90, 420, 90, 22)
	-- planters with flowers around the meet lot
	local function planter(x, z, w, d)
		part({ Size = V(w, 0.8, d), Position = V(x, 0.4, z), Color = rgb(170, 160, 145), Material = Enum.Material.Concrete })
		part({ Size = V(w - 0.6, 0.3, d - 0.6), Position = V(x, 0.85, z), Color = rgb(70, 50, 35), Material = Enum.Material.Ground })
		for i = 1, math.floor(w * d / 6) do
			part({ Shape = Enum.PartType.Ball, Size = V(0.9, 0.9, 0.9), Position = V(x + (math.random() - 0.5) * (w - 1.5), 1.3, z + (math.random() - 0.5) * (d - 1.5)), Color = Color3.fromHSV(({ 0, 0.08, 0.14, 0.8, 0.92 })[math.random(1, 5)], 0.75, 1), Material = Enum.Material.SmoothPlastic, CanCollide = false })
		end
	end
	for i = 0, 5 do
		planter(55 + i * 22, -44, 12, 3)
		planter(55 + i * 22, 44, 12, 3)
	end
	-- bollards (balizadores) and cones
	local function bollard(x, z)
		part({ Shape = Enum.PartType.Cylinder, Size = V(2.6, 0.7, 0.7), CFrame = CFrame.new(x, 1.3, z) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(250, 140, 30), Material = Enum.Material.SmoothPlastic })
		local band = part({ Shape = Enum.PartType.Cylinder, Size = V(0.3, 0.74, 0.74), CFrame = CFrame.new(x, 2.2, z) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(255, 255, 255), Material = Enum.Material.Neon })
		local _ = band
	end
	for z = -40, 40, 6 do
		if math.abs(z) > 20 then bollard(29, z) end
	end
	for x = 228, 292, 8 do
		if x < 250 or x > 270 then bollard(x, -88) end
	end
	-- benches, bins and bus stops along the central avenue
	local function bench(x, z, ry)
		local base = CFrame.new(x, 0, z) * CFrame.Angles(0, ry, 0)
		part({ Size = V(5, 0.3, 1.4), CFrame = base * CFrame.new(0, 1.4, 0), Color = rgb(140, 95, 60), Material = Enum.Material.WoodPlanks })
		part({ Size = V(5, 1.2, 0.25), CFrame = base * CFrame.new(0, 2.1, 0.6), Color = rgb(140, 95, 60), Material = Enum.Material.WoodPlanks })
		for _, s in ipairs({ -2, 2 }) do part({ Size = V(0.3, 1.4, 1.2), CFrame = base * CFrame.new(s, 0.7, 0), Color = rgb(40, 40, 44), Material = Enum.Material.Metal }) end
	end
	local function bin(x, z)
		part({ Shape = Enum.PartType.Cylinder, Size = V(2.4, 1.6, 1.6), CFrame = CFrame.new(x, 1.2, z) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(40, 110, 60), Material = Enum.Material.Metal })
	end
	local function busStop(x, z, ry)
		local base = CFrame.new(x, 0, z) * CFrame.Angles(0, ry, 0)
		part({ Size = V(10, 0.3, 4), CFrame = base * CFrame.new(0, 8.2, 0), Color = rgb(30, 30, 34), Material = Enum.Material.Metal })
		part({ Size = V(10, 7, 0.2), CFrame = base * CFrame.new(0, 4.6, 1.8), Color = rgb(170, 210, 230), Material = Enum.Material.Glass, Transparency = 0.5 })
		for _, s in ipairs({ -4.8, 4.8 }) do part({ Size = V(0.3, 8, 0.3), CFrame = base * CFrame.new(s, 4, 1.8), Color = rgb(30, 30, 34), Material = Enum.Material.Metal }) end
		local ad = part({ Size = V(3, 5, 0.3), CFrame = base * CFrame.new(-3, 4.5, 1.6), Color = rgb(255, 255, 255), Material = Enum.Material.Neon })
		sign(ad, "PORTO\nSOLARIS\nCAR MEET", rgb(255, 120, 40))
		bench(x, z, ry)
	end
	for _, z in ipairs({ -480, -380, -60, 40, 160 }) do
		busStop(-21, z, math.rad(-90))
		bin(21, z + 20)
		bench(21, z - 20, math.rad(90))
	end
end

-- ------------------------------------------------------------------ RUA NEON (between the cross avenue and downtown)
do
	local cz = -235
	part({ Size = V(520, 0.25, 22), Position = V(0, 0.12, cz), Color = rgb(35, 36, 42), Material = Enum.Material.Asphalt })
	local NEON = { rgb(255, 40, 160), rgb(40, 200, 255), rgb(170, 60, 255), rgb(255, 210, 40), rgb(60, 255, 140) }
	local WORDS = { "KARAOKÊ", "ARCADE", "LANCHES", "TATTOO", "GAMES", "BAR 24H", "CINEMA", "PIZZA", "DJ", "SNEAKERS" }
	for i = 0, 17 do
		for _, side in ipairs({ -1, 1 }) do
			local x = -250 + i * 29
			if math.abs(x) > 18 then
				local z = cz + side * 22
				local h = 16 + math.random(0, 18)
				local b = part({ Size = V(24, h, 18), Position = V(x, h / 2, z + side * 2), Color = Color3.fromHSV(0.65, 0.15, 0.18 + math.random() * 0.12), Material = Enum.Material.Concrete })
				local col = NEON[math.random(1, #NEON)]
				local board = part({ Size = V(14, 3.2, 0.4), CFrame = CFrame.new(x, 8 + math.random(0, 4), z - side * 7.3) * CFrame.Angles(0, side > 0 and 0 or math.rad(180), 0), Color = rgb(10, 10, 14), Material = Enum.Material.SmoothPlastic })
				sign(board, WORDS[math.random(1, #WORDS)], col)
				local strip = part({ Size = V(24.2, 0.4, 0.4), Position = V(x, h - 0.5, z - side * 7.2), Color = col, Material = Enum.Material.Neon })
				local l = light(strip, col, 22, 2)
				table.insert(nightLights, { l = l })
				-- glowing shop front
				local front = part({ Size = V(18, 5, 0.2), Position = V(x, 2.6, z - side * 7.1), Color = col:Lerp(rgb(255, 255, 255), 0.6), Material = Enum.Material.Neon, Transparency = 0.45 })
				local _ = b and front
			end
		end
	end
	-- neon arches over the street
	for i = 0, 4 do
		local x = -200 + i * 100
		local col = NEON[i % #NEON + 1]
		for _, s in ipairs({ -1, 1 }) do part({ Size = V(0.8, 14, 0.8), Position = V(x, 7, cz + s * 11), Color = rgb(20, 20, 24), Material = Enum.Material.Metal }) end
		local arch = part({ Size = V(0.8, 0.8, 23), Position = V(x, 14, cz), Color = col, Material = Enum.Material.Neon })
		light(arch, col, 30, 2.5)
	end
end

-- ------------------------------------------------------------------ PORTO (container port with ships, south-east beach)
do
	local cx, cz = 330, 340
	part({ Size = V(150, 3, 100), Position = V(cx, -1.35, cz), Color = rgb(120, 120, 118), Material = Enum.Material.Concrete })
	-- stacked containers
	local CC = { rgb(200, 60, 40), rgb(40, 110, 190), rgb(240, 170, 40), rgb(60, 150, 90), rgb(230, 230, 230), rgb(120, 60, 140) }
	for row = 0, 3 do
		for col = 0, 5 do
			local stack = math.random(1, 4)
			for k = 0, stack - 1 do
				local c = part({ Size = V(8, 8.5, 20), Position = V(cx - 50 + col * 11, 0.15 + 4.25 + k * 8.6, cz - 30 + row * 23), Color = CC[math.random(1, #CC)], Material = Enum.Material.CorrodedMetal })
				local _ = c
			end
		end
	end
	-- gantry cranes along the quay edge
	for i = 0, 2 do
		local x = cx - 30 + i * 40
		local y0 = 0.15
		for _, dz in ipairs({ -10, 10 }) do
			for _, dx in ipairs({ -6, 6 }) do part({ Size = V(1.6, 40, 1.6), Position = V(x + dx, y0 + 20, cz + 45 + dz), Color = rgb(230, 80, 40), Material = Enum.Material.Metal }) end
		end
		part({ Size = V(14, 2, 70), Position = V(x, y0 + 40, cz + 60), Color = rgb(230, 80, 40), Material = Enum.Material.Metal })
		local tl = part({ Size = V(1, 1, 1), Position = V(x, y0 + 42, cz + 92), Color = rgb(255, 40, 40), Material = Enum.Material.Neon })
		light(tl, rgb(255, 40, 40), 20, 2)
	end
	-- two cargo ships moored at the quay
	local function ship(x, z, len, hullC)
		part({ Size = V(26, 12, len), Position = V(x, 3, z), Color = hullC, Material = Enum.Material.Metal })
		part({ Size = V(26.2, 2, len + 0.2), Position = V(x, -1.5, z), Color = rgb(150, 30, 30), Material = Enum.Material.Metal })
		part({ Size = V(20, 14, 14), Position = V(x, 16, z + len / 2 - 10), Color = rgb(240, 240, 240), Material = Enum.Material.SmoothPlastic })
		part({ Shape = Enum.PartType.Cylinder, Size = V(10, 4, 4), CFrame = CFrame.new(x, 27, z + len / 2 - 8) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(30, 30, 30), Material = Enum.Material.Metal })
		for k = 0, math.floor((len - 30) / 21) do
			for j = -1, 1 do
				part({ Size = V(7.5, 8, 20), Position = V(x + j * 8, 13, z - len / 2 + 12 + k * 21), Color = CC[math.random(1, #CC)], Material = Enum.Material.CorrodedMetal })
			end
		end
	end
	ship(cx - 20, cz + 140, 150, rgb(30, 60, 110))
	ship(cx + 40, cz + 150, 120, rgb(40, 40, 44))
	sign(part({ Size = V(30, 6, 1), CFrame = CFrame.new(cx - 60, 8, cz - 48) * CFrame.Angles(0, math.rad(180), 0), Color = rgb(20, 40, 70), Material = Enum.Material.SmoothPlastic }), "PORTO SOLARIS", rgb(255, 255, 255))
end

-- ------------------------------------------------------------------ TUNNEL through a hill on the west ring road
do
	local x, z = -420, -25
	T:FillBall(V(x, -30, z), 95, Enum.Material.Rock)
	T:FillBall(V(x - 30, -20, z + 20), 70, Enum.Material.Grass)
	-- carve the road corridor through it (keeps the ground below y=0)
	T:FillBlock(CFrame.new(x, 9, z), V(40, 16, 230), Enum.Material.Air)
	-- tunnel shell, lights and portals
	part({ Size = V(36, 1, 200), Position = V(x, 15, z), Color = rgb(60, 60, 64), Material = Enum.Material.Concrete })
	for _, s in ipairs({ -1, 1 }) do
		part({ Size = V(1, 15, 200), Position = V(x + s * 18, 7.5, z), Color = rgb(170, 168, 160), Material = Enum.Material.Concrete })
		for d = -95, 95, 10 do
			local l = part({ Size = V(0.4, 0.5, 4), Position = V(x + s * 17.4, 12, z + d), Color = rgb(255, 200, 120), Material = Enum.Material.Neon })
			if d % 20 == 5 then light(l, rgb(255, 200, 120), 20, 1.6) end
		end
	end
	for _, s in ipairs({ -1, 1 }) do
		sign(part({ Size = V(36, 4, 1), CFrame = CFrame.new(x, 17.5, z + s * 100) * CFrame.Angles(0, s > 0 and 0 or math.rad(180), 0), Color = rgb(30, 70, 40), Material = Enum.Material.SmoothPlastic }), "TÚNEL DA SERRA", rgb(255, 255, 255))
	end
end

-- ------------------------------------------------------------------ DRIFT ARENA (east of the meet lot)
local DRIFT = { cx = 320, cz = 20, w = 140, d = 90 }
do
	part({ Size = V(DRIFT.w, 0.3, DRIFT.d), Position = V(DRIFT.cx, 0.13, DRIFT.cz), Color = rgb(40, 41, 45), Material = Enum.Material.Asphalt })
	-- painted circle and tyre walls
	for a = 0, 355, 6 do
		local r = 26
		part({ Size = V(0.6, 0.32, 3), CFrame = CFrame.new(DRIFT.cx + math.cos(math.rad(a)) * r, 0.15, DRIFT.cz + math.sin(math.rad(a)) * r) * CFrame.Angles(0, -math.rad(a), 0), Color = rgb(255, 210, 40), Material = Enum.Material.SmoothPlastic, CanCollide = false })
	end
	for i = 0, 27 do
		local a = i / 28 * math.pi * 2
		local x = DRIFT.cx + math.cos(a) * (DRIFT.w / 2 - 3)
		local z = DRIFT.cz + math.sin(a) * (DRIFT.d / 2 - 3)
		part({ Shape = Enum.PartType.Cylinder, Size = V(2.4, 3, 3), CFrame = CFrame.new(x, 1.2, z) * CFrame.Angles(0, 0, math.rad(90)), Color = (i % 2 == 0) and rgb(230, 40, 40) or rgb(240, 240, 240), Material = Enum.Material.SmoothPlastic })
	end
	for i = 0, 7 do
		part({ Size = V(1.2, 2, 1.2), Position = V(DRIFT.cx - 40 + i * 11, 1, DRIFT.cz + (i % 2 == 0 and 8 or -8)), Color = rgb(255, 120, 20), Material = Enum.Material.SmoothPlastic })
	end
	sign(part({ Size = V(40, 6, 1), CFrame = CFrame.new(DRIFT.cx, 9, DRIFT.cz - DRIFT.d / 2 - 2) * CFrame.Angles(0, math.rad(180), 0), Color = rgb(15, 15, 18), Material = Enum.Material.SmoothPlastic }), "ARENA DE DRIFT", rgb(255, 60, 60))
	for _, s in ipairs({ -1, 1 }) do
		local p = part({ Size = V(1, 20, 1), Position = V(DRIFT.cx + s * 21, 10, DRIFT.cz - DRIFT.d / 2 - 2), Color = rgb(30, 30, 34), Material = Enum.Material.Metal })
		local _ = p
	end
end
local driftValue = Instance.new("StringValue")
driftValue.Name = "Drift"
driftValue.Value = DRIFT.cx .. "|" .. DRIFT.cz .. "|" .. DRIFT.w .. "|" .. DRIFT.d
driftValue.Parent = ReplicatedStorage

-- ------------------------------------------------------------------ RACE: time trial around the ring road
local RACE = { V(0, 0, 270), V(410, 0, 262), V(412, 0, -510), V(-410, 0, -512), V(-412, 0, 262), V(-10, 0, 270) }
do
	local gate = RACE[1]
	for _, s in ipairs({ -1, 1 }) do part({ Size = V(1.5, 14, 1.5), Position = gate + V(-4, 7, s * 15), Color = rgb(20, 20, 24), Material = Enum.Material.Metal }) end
	local banner = part({ Size = V(1, 4, 31), Position = gate + V(-4, 14, 0), Color = rgb(15, 15, 18), Material = Enum.Material.SmoothPlastic })
	sign(banner, "LARGADA • CORRIDA DO PORTO", rgb(255, 255, 255))
	-- chequered line
	for i = 0, 11 do
		for j = 0, 1 do
			part({ Size = V(1.2, 0.32, 2.2), Position = gate + V(-4 + j * 1.2, 0.14, -12 + i * 2.2), Color = ((i + j) % 2 == 0) and rgb(240, 240, 240) or rgb(20, 20, 20), Material = Enum.Material.SmoothPlastic, CanCollide = false })
		end
	end
end
local raceValue = Instance.new("StringValue")
raceValue.Name = "Corrida"
do
	local t = {}
	for _, p in ipairs(RACE) do table.insert(t, p.X .. "," .. p.Z) end
	raceValue.Value = table.concat(t, ";")
end
raceValue.Parent = ReplicatedStorage

-- ------------------------------------------------------------------ RECORDS BOARD at the meet lot
local recordsBoard
do
	local b = part({ Size = V(1, 14, 22), CFrame = CFrame.new(186, 9, 0), Color = rgb(12, 12, 16), Material = Enum.Material.SmoothPlastic })
	for _, s in ipairs({ -1, 1 }) do part({ Size = V(1, 16, 1), Position = V(186, 8, s * 11), Color = rgb(30, 30, 34), Material = Enum.Material.Metal }) end
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Left
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 30
	sg.LightInfluence = 0
	sg.Parent = b
	local t = Instance.new("TextLabel")
	t.Size = UDim2.new(1, -40, 1, -40)
	t.Position = UDim2.new(0, 20, 0, 20)
	t.BackgroundTransparency = 1
	t.TextColor3 = rgb(255, 210, 60)
	t.Font = Enum.Font.GothamBold
	t.TextScaled = true
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.TextYAlignment = Enum.TextYAlignment.Top
	t.Text = "🏆 RECORDES\n\nCorrida: —\nDrift: —\nCarro mais bonito: —"
	t.Parent = sg
	recordsBoard = t
end

-- ------------------------------------------------------------------ places to discover (credits)
local PLACES = {
	{ id = "meet", name = "Encontro Solaris", pos = V(105, 0, 0), r = 75 },
	{ id = "posto", name = "Posto Aurora", pos = V(260, 0, -60), r = 35 },
	{ id = "loja", name = "Solaris Motors", pos = V(-180, 0, -60), r = 35 },
	{ id = "centro", name = "Centro", pos = V(0, 0, -390), r = 90 },
	{ id = "praia", name = "Mirante do Píer", pos = V(0, 0, 500), r = 25 },
	{ id = "sakura", name = "Distrito Sakura", pos = V(-300, 0, 180), r = 90 },
	{ id = "neon", name = "Rua Neon", pos = V(0, 0, -235), r = 100 },
	{ id = "porto", name = "Porto de Contêineres", pos = V(330, 0, 340), r = 70 },
	{ id = "tunel", name = "Túnel da Serra", pos = V(-420, 0, -25), r = 60 },
	{ id = "drift", name = "Arena de Drift", pos = V(320, 0, 20), r = 60 },
}
local placesValue = Instance.new("StringValue")
placesValue.Name = "Lugares"
do
	local t = {}
	for _, p in ipairs(PLACES) do table.insert(t, p.id .. "|" .. p.name .. "|" .. p.pos.X .. "|" .. p.pos.Z) end
	placesValue.Value = table.concat(t, ";")
end
placesValue.Parent = ReplicatedStorage

-- ------------------------------------------------------------------ players: credits, owned cars, tutorial, discovered places
local data = {}
local function save(plr)
	local d = data[plr]
	if not d or not store then return end
	pcall(function() store:SetAsync("p_" .. plr.UserId, d) end)
end
local function sendProgress(plr)
	local d = data[plr]
	if d then Progress:FireClient(plr, d) end
end
local function addCredits(plr, n, why)
	local d = data[plr]
	if not d then return end
	d.credits = d.credits + n
	local ls = plr:FindFirstChild("leaderstats")
	if ls then ls.Creditos.Value = d.credits end
	Notify:FireClient(plr, "credits", n, why)
	sendProgress(plr)
	save(plr)
end

Players.PlayerAdded:Connect(function(plr)
	local d = { credits = 0, owned = {}, tutorial = false, found = {} }
	if store then
		local ok, s = pcall(function() return store:GetAsync("p_" .. plr.UserId) end)
		if ok and type(s) == "table" then
			d.credits = s.credits or 0
			d.owned = s.owned or {}
			d.tutorial = s.tutorial or false
			d.found = s.found or {}
		end
	end
	data[plr] = d
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local c = Instance.new("IntValue")
	c.Name = "Creditos"
	c.Value = d.credits
	c.Parent = ls
	ls.Parent = plr
	task.wait(1)
	sendProgress(plr)
end)
Players.PlayerRemoving:Connect(function(plr)
	save(plr)
	local car = carsFolder:FindFirstChild("Carro_" .. plr.UserId)
	if car then car:Destroy() end
	data[plr] = nil
end)

-- spawn the chosen car next to the player and sit them in it
SpawnCar.OnServerEvent:Connect(function(plr, id, colorIndex, liveryIndex)
	local d = data[plr]
	local spec = CAR_BY_ID[id]
	if not d or not spec then return end
	if spec.price > 0 and not d.owned[id] then
		if d.credits < spec.price then
			Notify:FireClient(plr, "nomoney", spec.price - d.credits)
			return
		end
		d.credits = d.credits - spec.price
		d.owned[id] = true
		local ls = plr:FindFirstChild("leaderstats")
		if ls then ls.Creditos.Value = d.credits end
		Notify:FireClient(plr, "bought", spec.name)
		save(plr)
	end
	local char = plr.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not root or not hum then return end
	local old = carsFolder:FindFirstChild("Carro_" .. plr.UserId)
	if old then old:Destroy() end
	local color = PALETTE[tonumber(colorIndex) or 1] or PALETTE[1]
	local livery = nil
	local li = tonumber(liveryIndex) or 0
	if li > 0 then livery = PALETTE[li] end
	local look = root.CFrame.LookVector
	look = V(look.X, 0, look.Z).Unit
	local pos = root.Position + look * 12
	local cf = CFrame.lookAt(V(pos.X, 0.5, pos.Z), V(pos.X, 0.5, pos.Z) + look)
	local car = buildCar(spec, color, cf, true, livery)
	car.Name = "Carro_" .. plr.UserId
	car:SetAttribute("Owner", plr.UserId)
	task.wait(0.2)
	local seat = car:FindFirstChild("Banco")
	if seat and hum then seat:Sit(hum) end
	sendProgress(plr)
end)

Progress.OnServerEvent:Connect(function(plr, kind, value)
	local d = data[plr]
	if not d then return end
	if kind == "tutorial" and not d.tutorial then
		d.tutorial = true
		addCredits(plr, 500, "Tutorial concluído")
	elseif kind == "found" and type(value) == "string" and not d.found[value] then
		for _, p in ipairs(PLACES) do
			if p.id == value then
				local root = plr.Character and plr.Character:FindFirstChild("HumanoidRootPart")
				if root and (V(root.Position.X, 0, root.Position.Z) - p.pos).Magnitude < p.r + 20 then
					d.found[value] = true
					addCredits(plr, 100, "Novo lugar: " .. p.name)
				end
			end
		end
	end
end)

-- ------------------------------------------------------------------ RECORDS, DRIFT, RACE and MEET EVENTS
local Score = remote("Score")
local EventR = remote("Evento")
local Vote = remote("Voto")
local records = { lap = nil, lapName = "—", drift = 0, driftName = "—", meetName = "—" }
pcall(function()
	local r = store and store:GetAsync("records")
	if type(r) == "table" then
		for k, v in pairs(r) do records[k] = v end
	end
end)
local function fmtTime(t)
	return string.format("%d:%05.2f", math.floor(t / 60), t % 60)
end
local function refreshBoard()
	recordsBoard.Text = "🏆 RECORDES\n\n🏁 Corrida: " .. (records.lap and (fmtTime(records.lap) .. "  " .. records.lapName) or "—")
		.. "\n💨 Drift: " .. (records.drift > 0 and (tostring(records.drift) .. "  " .. records.driftName) or "—")
		.. "\n⭐ Carro mais bonito: " .. records.meetName
end
local function saveRecords()
	task.spawn(function()
		pcall(function() if store then store:SetAsync("records", records) end end)
	end)
end
refreshBoard()

-- car next to a player (the one they sit in, or the closest model with a DriveSeat)
local function carOf(plr)
	local char = plr.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum and hum.SeatPart and hum.SeatPart.Parent then return hum.SeatPart.Parent end
	local root = char and char:FindFirstChild("HumanoidRootPart")
	if not root then return nil end
	local best, bd = nil, 30
	for _, m in ipairs(workspace:GetChildren()) do
		if m:IsA("Model") and m:FindFirstChild("DriveSeat") then
			local d = (m.DriveSeat.Position - root.Position).Magnitude
			if d < bd then best, bd = m, d end
		end
	end
	return best
end

local lastScore = {}
Score.OnServerEvent:Connect(function(plr, kind, value)
	local d = data[plr]
	value = tonumber(value)
	if not d or not value then return end
	local now = os.clock()
	if lastScore[plr] and now - lastScore[plr] < 3 then return end
	lastScore[plr] = now
	if kind == "drift" then
		local pts = math.clamp(math.floor(value), 0, 60000)
		if pts < 100 then return end
		if pts > (d.bestDrift or 0) then d.bestDrift = pts end
		if pts > records.drift then
			records.drift = pts
			records.driftName = plr.Name
			refreshBoard()
			saveRecords()
			EventR:FireAllClients("record", "💨 Novo recorde de DRIFT: " .. pts .. " por " .. plr.Name)
		end
		addCredits(plr, math.clamp(math.floor(pts / 150), 5, 200), "Drift: " .. pts .. " pontos")
	elseif kind == "lap" then
		-- the loop is about 3,200 studs long: anything under 20 s is not a real lap
		if value < 20 or value > 600 then return end
		local better = (not d.bestLap) or value < d.bestLap
		if better then d.bestLap = value end
		local bonus = 0
		if not records.lap or value < records.lap then
			records.lap = value
			records.lapName = plr.Name
			refreshBoard()
			saveRecords()
			bonus = 200
			EventR:FireAllClients("record", "🏁 Novo recorde da CORRIDA: " .. fmtTime(value) .. " por " .. plr.Name)
		end
		addCredits(plr, 100 + bonus + (better and 50 or 0), "Corrida: " .. fmtTime(value) .. (better and " (seu melhor!)" or ""))
	end
end)

-- meet events: every 8 minutes, at the Encontro Solaris lot
local LOT = { x1 = 30, x2 = 182, z1 = -52, z2 = 52 }
local function inLot(plr)
	local root = plr.Character and plr.Character:FindFirstChild("HumanoidRootPart")
	if not root then return false end
	local p = root.Position
	return p.X > LOT.x1 and p.X < LOT.x2 and p.Z > LOT.z1 and p.Z < LOT.z2
end
local votes, voters, participants = {}, {}, {}
Vote.OnServerEvent:Connect(function(plr, targetId)
	targetId = tonumber(targetId)
	if not targetId or voters[plr] or targetId == plr.UserId then return end
	if not participants[targetId] then return end
	voters[plr] = true
	votes[targetId] = (votes[targetId] or 0) + 1
	Notify:FireClient(plr, "voted")
end)
task.spawn(function()
	task.wait(90)
	while true do
		EventR:FireAllClients("announce", 60)
		task.wait(60)
		EventR:FireAllClients("start", 120)
		task.wait(120)
		-- who is at the meet with a car?
		participants = {}
		local list = {}
		for _, plr in ipairs(Players:GetPlayers()) do
			if inLot(plr) then
				local car = carOf(plr)
				local carName = car and (car:GetAttribute("Nome") or car.Name) or "a pé"
				participants[plr.UserId] = { plr = plr, car = carName }
				table.insert(list, { id = plr.UserId, name = plr.DisplayName, car = carName })
			end
		end
		if #list >= 2 then
			votes, voters = {}, {}
			EventR:FireAllClients("vote", list, 30)
			task.wait(32)
			local winner, top = nil, 0
			for id, n in pairs(votes) do
				if n > top then winner, top = id, n end
			end
			for id, info in pairs(participants) do
				if info.plr.Parent then addCredits(info.plr, 50, "Participou do encontro") end
				local _ = id
			end
			if winner and participants[winner] and participants[winner].plr.Parent then
				local w = participants[winner]
				addCredits(w.plr, 300, "Carro mais bonito do encontro!")
				records.meetName = w.plr.Name .. " (" .. w.car .. ")"
				refreshBoard()
				saveRecords()
				EventR:FireAllClients("result", w.plr.DisplayName, w.car, top)
			else
				EventR:FireAllClients("result", nil)
			end
		else
			for _, info in pairs(participants) do
				if info.plr.Parent then addCredits(info.plr, 50, "Participou do encontro") end
			end
			EventR:FireAllClients("few", #list)
		end
		task.wait(8 * 60 - 212)
	end
end)

-- ------------------------------------------------------------------ keep the grass under the asphalt
-- Terrain is drawn in 4-stud voxels; on phones it is drawn even coarser, so grass whose surface sits
-- 1 stud under a 0.2-stud road can still show through it, and the grass blades poke out of it.
-- Under every paved surface: swap the grass for pavement (no grass blades) at the same height,
-- and give the surface a solid base so no terrain can ever be seen through or beside it.
do
	local PAVED = {
		[Enum.Material.Asphalt] = true,
		[Enum.Material.Concrete] = true,
		[Enum.Material.Pavement] = true,
		[Enum.Material.Cobblestone] = true,
		[Enum.Material.Slate] = true,
		[Enum.Material.Brick] = true,
	}
	local list = {}
	for _, p in ipairs(map:GetDescendants()) do
		if p:IsA("Part") and p.Shape == Enum.PartType.Block and PAVED[p.Material] and p.Transparency < 1
			and p.Size.Y <= 0.6 and p.Position.Y < 0.8 and p.Size.X * p.Size.Z >= 150 then
			table.insert(list, p)
		end
	end
	for _, p in ipairs(list) do
		local _, ry = p.CFrame:ToEulerAnglesYXZ()
		local flat = CFrame.new(p.Position.X, 0, p.Position.Z) * CFrame.Angles(0, ry, 0)
		-- 2 extra studs each side, same height as the lawn around it (top at y=-1.2), so there is no ditch
		local sx, sz = p.Size.X + 4, p.Size.Z + 4
		T:FillBlock(flat * CFrame.new(0, 2, 0), V(sx, 12, sz), Enum.Material.Air)
		T:FillBlock(flat * CFrame.new(0, -5.2, 0), V(sx, 8, sz), Enum.Material.Pavement)
	end
	for _, p in ipairs(list) do
		local bottom = p.Position.Y - p.Size.Y / 2
		part({
			Name = "Base",
			Size = V(p.Size.X, 3, p.Size.Z),
			CFrame = p.CFrame * CFrame.new(0, bottom - p.Position.Y - 1.5 - 0.01, 0),
			Color = p.Color:Lerp(rgb(30, 30, 30), 0.4),
			Material = Enum.Material.Concrete,
			CanCollide = false,
			CanQuery = false,
			CanTouch = false,
			CastShadow = false,
		})
	end
	print("[Porto Solaris] chão pavimentado sob", #list, "superfícies")
end

-- ------------------------------------------------------------------ day/night cycle and animations
local DAY_LENGTH = 24 * 60 -- seconds for a full day
local last = os.clock()
RunService.Heartbeat:Connect(function(dt)
	Lighting.ClockTime = (Lighting.ClockTime + dt * 24 / DAY_LENGTH) % 24
	for _, t in ipairs(turntables) do
		t.base = t.base * CFrame.Angles(0, t.speed * dt, 0)
		t.car:PivotTo(t.base)
	end
end)
task.spawn(function()
	local wasNight = nil
	while true do
		local ct = Lighting.ClockTime
		local night = ct > 18.2 or ct < 6.2
		if night ~= wasNight then
			wasNight = night
			for _, n in ipairs(nightLights) do
				if n.l then n.l.Enabled = night end
				if n.band then n.band.Material = night and Enum.Material.Neon or Enum.Material.Glass n.band.Transparency = night and 0.55 or 1 end
			end
			-- spawned cars switch headlights too
			for _, car in ipairs(carsFolder:GetChildren()) do
				for _, d in ipairs(car:GetDescendants()) do
					if d:IsA("SpotLight") then d.Enabled = night end
				end
			end
			atmo.Density = night and 0.34 or 0.3
			Lighting.OutdoorAmbient = night and rgb(95, 100, 125) or rgb(120, 120, 130)
			Lighting.Brightness = night and 3 or 2.6
		end
		task.wait(2)
		local _ = last
	end
end)
