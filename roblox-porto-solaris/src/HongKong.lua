-- MapaHongKong (ModuleScript under the server script): the Hong Kong inspired city.
-- Central skyline with landmark towers and footbridges, Mong Kok neon street, Temple
-- Street night market with a temple, a "monster building" housing estate, Victoria
-- Harbour (clock tower, promenade, Kowloon skyline across the water), street details
-- (zebra crossings, traffic lights, tram rails) and the vehicles/boats that the
-- "Cidade" LocalScript animates on every client (folder workspace.Transito).

return function(ctx)
	local part, sign, light, nightLights, V, rgb, T = ctx.part, ctx.sign, ctx.light, ctx.nightLights, ctx.V, ctx.rgb, ctx.T

	local function glowSign(p, text, color)
		-- sign whose letters are lit; the board turns to neon at night
		sign(p, text, color)
		table.insert(nightLights, { glow = p })
	end

	-- ------------------------------------------------------------ buildings
	-- glass tower: shaft, mullions on two faces, floor bands lit at night, roof gear
	local function tower(x, z, w, d, h, col, opts)
		opts = opts or {}
		part({ Size = V(w, h, d), Position = V(x, h / 2, z), Color = col, Material = Enum.Material.Glass, Reflectance = 0.3 })
		-- podium in stone with a shop front
		local ph = opts.podium or 10
		part({ Size = V(w + 4, ph, d + 4), Position = V(x, ph / 2, z), Color = rgb(190, 186, 178), Material = Enum.Material.Limestone })
		local shop = part({ Size = V(w * 0.8, 4, d + 4.2), Position = V(x, 2.6, z), Color = rgb(255, 230, 180), Material = Enum.Material.SmoothPlastic, Transparency = 0.35 })
		table.insert(nightLights, { glow = shop })
		-- vertical fins every 6 studs on the long faces
		for k = -w / 2 + 3, w / 2 - 3, 6 do
			for _, s in ipairs({ -1, 1 }) do
				part({ Size = V(0.4, h - ph, 0.6), Position = V(x + k, ph + (h - ph) / 2, z + s * (d / 2 + 0.25)), Color = rgb(50, 54, 60), Material = Enum.Material.Metal, CanCollide = false, CastShadow = false })
			end
		end
		-- lit floors (random) for night
		for y = ph + 4, h - 4, 7 do
			if math.random() < 0.3 then
				local band = part({ Size = V(w + 0.15, 2.4, d + 0.15), Position = V(x, y, z), Color = rgb(255, 222, 160), Material = Enum.Material.Glass, Transparency = 1, CanCollide = false, CastShadow = false })
				table.insert(nightLights, { band = band })
			end
		end
		part({ Size = V(w + 0.8, 1.4, d + 0.8), Position = V(x, h + 0.7, z), Color = rgb(60, 62, 68), Material = Enum.Material.Concrete })
		if opts.helipad then
			part({ Shape = Enum.PartType.Cylinder, Size = V(0.4, w * 0.7, w * 0.7), CFrame = CFrame.new(x, h + 1.6, z) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(70, 72, 76), Material = Enum.Material.Concrete })
			local hl = part({ Size = V(1, 0.3, w * 0.35), Position = V(x - 2, h + 1.9, z), Color = rgb(250, 250, 250), Material = Enum.Material.SmoothPlastic })
			part({ Size = V(1, 0.3, w * 0.35), Position = V(x + 2, h + 1.9, z), Color = rgb(250, 250, 250), Material = Enum.Material.SmoothPlastic })
			part({ Size = V(4, 0.3, 1), Position = V(x, h + 1.9, z), Color = rgb(250, 250, 250), Material = Enum.Material.SmoothPlastic })
			local _ = hl
		elseif opts.antenna then
			part({ Size = V(1, opts.antenna, 1), Position = V(x, h + 1.4 + opts.antenna / 2, z), Color = rgb(200, 200, 205), Material = Enum.Material.Metal })
			local tip = part({ Shape = Enum.PartType.Ball, Size = V(1.6, 1.6, 1.6), Position = V(x, h + 1.4 + opts.antenna, z), Color = rgb(255, 40, 40), Material = Enum.Material.Neon })
			light(tip, rgb(255, 40, 40), 30, 2)
		end
		if opts.billboard then
			local b = part({ Size = V(w * 0.8, 10, 0.4), CFrame = CFrame.new(x, h - 8, z - d / 2 - 0.6), Color = rgb(10, 10, 14), Material = Enum.Material.SmoothPlastic })
			glowSign(b, opts.billboard, opts.bcolor or rgb(80, 200, 255))
		end
	end

	-- old tenement ("tong lau"/1960s block): pastel facade, dark window bands, AC units, laundry
	local PASTEL = { rgb(236, 200, 190), rgb(190, 214, 226), rgb(232, 222, 170), rgb(196, 226, 200), rgb(220, 200, 230), rgb(235, 235, 228), rgb(214, 190, 160) }
	local function tenement(x, z, w, d, h, facing, opts)
		opts = opts or {}
		local col = PASTEL[math.random(1, #PASTEL)]
		part({ Size = V(w, h, d), Position = V(x, h / 2, z), Color = col, Material = Enum.Material.Concrete })
		-- ground floor shop with roller-shutter/lit front
		local fz = z + facing * (d / 2 + 0.15)
		local shop = part({ Size = V(w - 2, 5, 0.3), Position = V(x, 2.6, fz), Color = rgb(255, 225, 170), Material = Enum.Material.SmoothPlastic, Transparency = 0.2 })
		table.insert(nightLights, { glow = shop })
		-- window bands on the street face (one part per floor) + a few lit
		for y = 8, h - 3, 3.4 do
			local lit = math.random() < 0.35
			local band = part({ Size = V(w - 1.5, 1.5, 0.25), Position = V(x, y, fz), Color = lit and rgb(255, 220, 150) or rgb(40, 52, 62), Material = Enum.Material.Glass, Reflectance = 0.2, CastShadow = false, CanCollide = false })
			if lit then table.insert(nightLights, { glow = band }) end
		end
		-- air conditioners and laundry poles on the facade
		for _ = 1, math.floor(h / 6) do
			local ax = x + (math.random() - 0.5) * (w - 3)
			local ay = 8 + math.random() * (h - 12)
			part({ Size = V(1.6, 1.1, 1.2), Position = V(ax, ay, fz + facing * 0.7), Color = rgb(228, 228, 224), Material = Enum.Material.SmoothPlastic, CastShadow = false })
		end
		for _ = 1, math.floor(h / 15) do
			local ax = x + (math.random() - 0.5) * (w - 4)
			local ay = 9 + math.random() * (h - 14)
			part({ Size = V(0.15, 0.15, 3), Position = V(ax, ay, fz + facing * 1.6), Color = rgb(150, 150, 150), Material = Enum.Material.Metal, CanCollide = false, CastShadow = false })
			part({ Size = V(0.1, 1.4, 1.2), Position = V(ax, ay - 0.8, fz + facing * (1.4 + math.random() * 1.2)), Color = Color3.fromHSV(math.random(), 0.6, 0.9), Material = Enum.Material.Fabric, CanCollide = false, CastShadow = false })
		end
		-- roof: water tank and antennas
		part({ Size = V(w + 0.4, 0.8, d + 0.4), Position = V(x, h + 0.4, z), Color = rgb(120, 118, 112), Material = Enum.Material.Concrete })
		part({ Size = V(4, 3, 3), Position = V(x - w / 4, h + 2.3, z), Color = rgb(200, 200, 196), Material = Enum.Material.CorrodedMetal })
		part({ Size = V(0.3, 5, 0.3), Position = V(x + w / 4, h + 3.3, z), Color = rgb(90, 90, 90), Material = Enum.Material.Metal, CanCollide = false })
		-- protruding vertical neon sign over the street (Mong Kok style)
		if opts.signs then
			for _ = 1, opts.signs do
				local words = opts.words
				local wd = words[math.random(1, #words)]
				local sy = 12 + math.random() * math.max(2, h - 24)
				local sx = x + (math.random() - 0.5) * (w - 6)
				local depth = 4 + math.random() * 3
				local board = part({ Size = V(0.6, 9 + math.random() * 5, depth), Position = V(sx, sy, fz + facing * (depth / 2 + 0.4)), Color = rgb(14, 14, 18), Material = Enum.Material.SmoothPlastic, CastShadow = false, CanCollide = false })
				local ncol = Color3.fromHSV(math.random(), 0.75, 1)
				local frame = part({ Size = V(0.7, board.Size.Y + 0.3, board.Size.Z + 0.3), Position = board.Position, Color = ncol, Material = Enum.Material.Neon, Transparency = 0.55, CanCollide = false, CastShadow = false })
				local _ = frame
				-- text on both sides (vertical characters)
				local chars = {}
				for _, code in utf8.codes(wd) do table.insert(chars, utf8.char(code)) end
				for _, face in ipairs({ Enum.NormalId.Left, Enum.NormalId.Right }) do
					local sg = Instance.new("SurfaceGui")
					sg.Face = face
					sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
					sg.PixelsPerStud = 25
					sg.LightInfluence = 0
					sg.Parent = board
					local t = Instance.new("TextLabel")
					t.Size = UDim2.new(1, 0, 1, 0)
					t.BackgroundTransparency = 1
					t.Text = table.concat(chars, "\n")
					t.TextScaled = true
					t.Font = Enum.Font.GothamBlack
					t.TextColor3 = ncol
					t.Parent = sg
				end
				table.insert(nightLights, { glow = frame })
			end
		end
	end

	local CANTONESE = { "旺角", "酒樓", "茶餐廳", "麻雀", "金行", "藥房", "時裝", "電器", "大押", "按摩", "粥麵", "燒味", "手機", "眼鏡", "涼茶", "雀館", "酒店", "夜市" }

	-- ------------------------------------------------------------ city ground: concrete paving instead of lawns
	-- (top at y = 0.12, under the roads and sidewalks; the paving pass removes the grass below)
	local function pave(x1, z1, x2, z2)
		part({ Size = V(x2 - x1, 0.12, z2 - z1), Position = V((x1 + x2) / 2, 0.06, (z1 + z2) / 2), Color = rgb(150, 148, 144), Material = Enum.Material.Pavement, CastShadow = false })
	end
	pave(-405, -505, 405, -272) -- Central
	pave(-270, -268, 270, -200) -- Mong Kok
	pave(225, 112, 405, 250) -- housing estate

	-- ------------------------------------------------------------ CENTRAL (skyline between Mong Kok and the north ring)
	do
		local cols = { -370, -310, -250, -190, -130, -70, 70, 130, 190, 250, 310, 370 }
		local rows = { -300, -360, -420, -480 }
		local GLASS = { rgb(70, 100, 130), rgb(90, 110, 125), rgb(60, 80, 100), rgb(120, 140, 150), rgb(50, 70, 90), rgb(140, 150, 155) }
		local landmark = {}
		-- 1) "Two Finance" style: tall tapering tower with a crown
		do
			local x, z = 130, -420
			landmark[x .. "," .. z] = true
			local h = 0
			for i, s in ipairs({ { 40, 90 }, { 36, 70 }, { 32, 60 }, { 27, 40 }, { 22, 25 } }) do
				local w, hh = s[1], s[2]
				part({ Size = V(w, hh, w), Position = V(x, h + hh / 2, z), Color = rgb(150, 168, 180), Material = Enum.Material.Glass, Reflectance = 0.35 })
				for k = -w / 2 + 2.5, w / 2 - 2.5, 5 do
					for _, sd in ipairs({ -1, 1 }) do
						part({ Size = V(0.4, hh, 0.5), Position = V(x + k, h + hh / 2, z + sd * (w / 2 + 0.2)), Color = rgb(210, 214, 220), Material = Enum.Material.Metal, CanCollide = false, CastShadow = false })
						part({ Size = V(0.5, hh, 0.4), Position = V(x + sd * (w / 2 + 0.2), h + hh / 2, z + k), Color = rgb(210, 214, 220), Material = Enum.Material.Metal, CanCollide = false, CastShadow = false })
					end
				end
				h = h + hh
				local _ = i
			end
			-- crown fins
			for a = 0, 3 do
				local cf = CFrame.new(x, h + 8, z) * CFrame.Angles(0, a * math.pi / 2, 0) * CFrame.new(0, 0, 9)
				local fin = part({ Size = V(14, 16, 0.6), CFrame = cf, Color = rgb(225, 228, 232), Material = Enum.Material.Metal })
				local _ = fin
			end
			local top = part({ Size = V(18, 0.6, 18), Position = V(x, h + 0.3, z), Color = rgb(90, 200, 255), Material = Enum.Material.Neon })
			light(top, rgb(120, 200, 255), 60, 3)
			table.insert(nightLights, { glow = top })
		end
		-- 2) "Bank" tower: dark glass prism with white X bracing and a slanted top
		do
			local x, z, w = -130, -420, 36
			landmark[x .. "," .. z] = true
			local H = 240
			part({ Size = V(w, H, w), Position = V(x, H / 2, z), Color = rgb(40, 60, 80), Material = Enum.Material.Glass, Reflectance = 0.4 })
			for seg = 0, 5 do
				local y0 = seg * H / 6
				local hh = H / 6
				local len = math.sqrt(w * w + hh * hh)
				local ang = math.atan(hh / w)
				for _, s in ipairs({ -1, 1 }) do
					for _, face in ipairs({ -1, 1 }) do
						part({ Size = V(len, 0.8, 0.5), CFrame = CFrame.new(x, y0 + hh / 2, z + face * (w / 2 + 0.3)) * CFrame.Angles(0, 0, s * ang), Color = rgb(235, 238, 242), Material = Enum.Material.Metal, CanCollide = false, CastShadow = false })
						part({ Size = V(0.5, 0.8, len), CFrame = CFrame.new(x + face * (w / 2 + 0.3), y0 + hh / 2, z) * CFrame.Angles(s * ang, 0, 0), Color = rgb(235, 238, 242), Material = Enum.Material.Metal, CanCollide = false, CastShadow = false })
					end
				end
				part({ Size = V(w + 1, 0.8, w + 1), Position = V(x, y0, z), Color = rgb(235, 238, 242), Material = Enum.Material.Metal, CanCollide = false })
			end
			part({ Wedge = true, Size = V(w, 30, w), CFrame = CFrame.new(x, H + 15, z), Color = rgb(40, 60, 80), Material = Enum.Material.Glass, Reflectance = 0.4 })
			for _, dx in ipairs({ -6, 6 }) do
				part({ Size = V(1, 40, 1), Position = V(x + dx, H + 20, z + 12), Color = rgb(220, 220, 225), Material = Enum.Material.Metal })
			end
			part({ Size = V(w * 0.8, 6, 0.4), CFrame = CFrame.new(x, 16, z - w / 2 - 2.2), Color = rgb(15, 15, 18), Material = Enum.Material.SmoothPlastic })
			part({ Size = V(w + 8, 12, w + 8), Position = V(x, 6, z), Color = rgb(150, 145, 138), Material = Enum.Material.Granite })
		end
		-- 3) "Plaza" tower: triangular-ish with a lit spire that changes colour at night
		do
			local x, z = 310, -360
			landmark[x .. "," .. z] = true
			local H = 200
			part({ Size = V(38, H, 38), Position = V(x, H / 2, z), Color = rgb(200, 170, 110), Material = Enum.Material.Glass, Reflectance = 0.25 })
			for y = 14, H - 6, 6 do
				local band = part({ Size = V(38.2, 1.2, 38.2), Position = V(x, y, z), Color = rgb(255, 200, 90), Material = Enum.Material.Glass, Transparency = 1, CanCollide = false, CastShadow = false })
				table.insert(nightLights, { band = band })
			end
			local crown = part({ Size = V(22, 20, 22), Position = V(x, H + 10, z), Color = rgb(255, 120, 200), Material = Enum.Material.Neon, Transparency = 0.25 })
			crown.Name = "CoroaNeon"
			part({ Size = V(2, 70, 2), Position = V(x, H + 55, z), Color = rgb(230, 230, 235), Material = Enum.Material.Metal })
			light(crown, rgb(255, 140, 220), 80, 3)
			part({ Size = V(46, 12, 46), Position = V(x, 6, z), Color = rgb(170, 160, 150), Material = Enum.Material.Granite })
		end
		-- 4) "Centre" tower with horizontal neon rings
		do
			local x, z = -310, -360
			landmark[x .. "," .. z] = true
			local H = 190
			part({ Size = V(34, H, 34), Position = V(x, H / 2, z), Color = rgb(30, 34, 40), Material = Enum.Material.Glass, Reflectance = 0.45 })
			for y = 20, H, 12 do
				local ring = part({ Size = V(34.4, 0.6, 34.4), Position = V(x, y, z), Color = Color3.fromHSV((y / H) * 0.8, 0.8, 1), Material = Enum.Material.Neon, CanCollide = false, CastShadow = false })
				table.insert(nightLights, { glow = ring })
			end
			part({ Size = V(42, 12, 42), Position = V(x, 6, z), Color = rgb(160, 156, 150), Material = Enum.Material.Granite })
		end
		-- the rest of the grid: glass towers of different heights
		local brands = { "SOLARIS", "PORTO BANK", "HARBOUR CITY", "猛龍 DRAGON", "金融中心", "SKYLINE" }
		for _, x in ipairs(cols) do
			for _, z in ipairs(rows) do
				if not landmark[x .. "," .. z] then
					local w = 24 + math.random(0, 10)
					local h = 55 + math.random(0, 130)
					tower(x + math.random(-3, 3), z + math.random(-3, 3), w, w - math.random(0, 6), h, GLASS[math.random(1, #GLASS)], {
						helipad = math.random() < 0.3,
						antenna = math.random() < 0.3 and math.random(10, 30) or nil,
						billboard = math.random() < 0.25 and brands[math.random(1, #brands)] or nil,
						bcolor = Color3.fromHSV(math.random(), 0.6, 1),
					})
				end
			end
		end
		-- covered footbridges over the avenue (HK has them everywhere)
		for _, z in ipairs({ -325, -455 }) do
			part({ Size = V(110, 1, 7), Position = V(0, 14, z), Color = rgb(200, 200, 205), Material = Enum.Material.Concrete })
			part({ Size = V(110, 0.6, 8), Position = V(0, 18.6, z), Color = rgb(60, 64, 70), Material = Enum.Material.Metal })
			for _, s in ipairs({ -1, 1 }) do
				part({ Size = V(110, 3.6, 0.3), Position = V(0, 16.3, z + s * 3.4), Color = rgb(170, 210, 230), Material = Enum.Material.Glass, Transparency = 0.5 })
				part({ Size = V(1.6, 14, 1.6), Position = V(s * 40, 7, z), Color = rgb(190, 190, 195), Material = Enum.Material.Concrete })
			end
			local led = part({ Size = V(110, 0.2, 0.2), Position = V(0, 13.4, z - 3.6), Color = rgb(120, 200, 255), Material = Enum.Material.Neon, CastShadow = false, CanCollide = false })
			table.insert(nightLights, { glow = led })
		end
	end

	-- ------------------------------------------------------------ MONG KOK (the old Rua Neon street, z = -235)
	do
		local cz = -235
		part({ Size = V(520, 0.25, 22), Position = V(0, 0.12, cz), Color = rgb(38, 39, 44), Material = Enum.Material.Asphalt })
		for i = 0, 17 do
			for _, side in ipairs({ -1, 1 }) do
				local x = -250 + i * 29
				if math.abs(x) > 18 then
					local h = 34 + math.random(0, 36)
					tenement(x, cz + side * 22.5, 26, 18, h, -side, { signs = 2, words = CANTONESE })
				end
			end
		end
		-- street name sign
		local nm = part({ Size = V(0.4, 3, 12), CFrame = CFrame.new(-268, 8, cz), Color = rgb(20, 60, 140), Material = Enum.Material.SmoothPlastic })
		sign(nm, "旺角 MONG KOK", rgb(255, 255, 255))
	end

	-- ------------------------------------------------------------ TEMPLE STREET night market (west, where the Sakura district was)
	do
		local cx, cz = -300, 180
		part({ Size = V(220, 0.3, 140), Position = V(cx, 0.12, cz), Color = rgb(128, 126, 122), Material = Enum.Material.Pavement })
		part({ Size = V(220, 0.32, 16), Position = V(cx, 0.14, cz), Color = rgb(70, 70, 74), Material = Enum.Material.Asphalt })
		-- market stalls on both sides with striped canopies and strings of bulbs
		local CANOPY = { rgb(200, 40, 40), rgb(30, 120, 70), rgb(30, 80, 170), rgb(230, 150, 30) }
		for i = 0, 20 do
			for _, side in ipairs({ -1, 1 }) do
				local x = cx - 100 + i * 10
				local z = cz + side * 11.5
				part({ Size = V(8, 2.6, 4), Position = V(x, 1.3, z), Color = rgb(120, 90, 60), Material = Enum.Material.Wood })
				for k = 0, 3 do
					part({ Size = V(1.6, 0.6, 1.4), Position = V(x - 3 + k * 2, 2.9, z + (math.random() - 0.5)), Color = Color3.fromHSV(math.random(), 0.5, 0.9), Material = Enum.Material.Fabric, CanCollide = false, CastShadow = false })
				end
				local cc = CANOPY[math.random(1, #CANOPY)]
				for k = 0, 3 do
					part({ Size = V(2, 0.25, 5.5), CFrame = CFrame.new(x - 3 + k * 2, 7.2, z + side * 0.4) * CFrame.Angles(side * math.rad(12), 0, 0), Color = (k % 2 == 0) and cc or rgb(245, 245, 240), Material = Enum.Material.Fabric, CanCollide = false })
				end
				for _, dx in ipairs({ -3.8, 3.8 }) do part({ Size = V(0.25, 7, 0.25), Position = V(x + dx, 3.5, z - side * 2), Color = rgb(60, 60, 60), Material = Enum.Material.Metal }) end
				local bulb = part({ Shape = Enum.PartType.Ball, Size = V(0.6, 0.6, 0.6), Position = V(x, 6.4, z), Color = rgb(255, 220, 150), Material = Enum.Material.Neon, CanCollide = false, CastShadow = false })
				if i % 3 == 0 then
					local l = light(bulb, rgb(255, 200, 130), 14, 1.2)
					table.insert(nightLights, { l = l })
				end
			end
		end
		-- tenements behind the stalls (south side all along, north side away from the temple)
		for i = 0, 7 do
			local x = cx - 98 + i * 28
			tenement(x, cz - 32, 24, 16, 26 + math.random(0, 26), 1, { signs = 1, words = CANTONESE })
			if x < cx - 40 or x > cx + 30 then
				tenement(x, cz + 32, 24, 16, 26 + math.random(0, 20), -1, { signs = 1, words = CANTONESE })
			end
		end
		-- paifang gate at the east entrance
		local gx = cx + 106
		local red, green, gold = rgb(190, 30, 30), rgb(40, 120, 80), rgb(220, 180, 60)
		for _, dz in ipairs({ -9, 9 }) do
			part({ Size = V(1.8, 16, 1.8), Position = V(gx, 8, cz + dz), Color = red, Material = Enum.Material.SmoothPlastic })
			part({ Size = V(3, 1.2, 3), Position = V(gx, 0.6, cz + dz), Color = rgb(60, 60, 60), Material = Enum.Material.Granite })
		end
		part({ Size = V(2, 1.4, 22), Position = V(gx, 14, cz), Color = red, Material = Enum.Material.SmoothPlastic })
		local plaque = part({ Size = V(0.6, 3.4, 10), Position = V(gx - 0.4, 11.6, cz), Color = rgb(20, 20, 24), Material = Enum.Material.SmoothPlastic })
		local sg = Instance.new("SurfaceGui")
		sg.Face = Enum.NormalId.Right
		sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		sg.PixelsPerStud = 30
		sg.LightInfluence = 0
		sg.Parent = plaque
		local tl = Instance.new("TextLabel")
		tl.Size = UDim2.new(1, 0, 1, 0)
		tl.BackgroundTransparency = 1
		tl.Text = "廟街 TEMPLE STREET"
		tl.TextScaled = true
		tl.Font = Enum.Font.GothamBlack
		tl.TextColor3 = gold
		tl.Parent = sg
		local sg2 = sg:Clone()
		sg2.Face = Enum.NormalId.Left
		sg2.Parent = plaque
		part({ Wedge = true, Size = V(26, 2.4, 2.5), CFrame = CFrame.new(gx - 1.25, 16.5, cz) * CFrame.Angles(0, math.rad(90), 0), Color = green, Material = Enum.Material.Slate })
		part({ Wedge = true, Size = V(26, 2.4, 2.5), CFrame = CFrame.new(gx + 1.25, 16.5, cz) * CFrame.Angles(0, math.rad(-90), 0), Color = green, Material = Enum.Material.Slate })
		-- red lanterns across the lane
		for i = 0, 6 do
			local x = cx - 80 + i * 26
			part({ Size = V(0.15, 0.15, 24), Position = V(x, 9.5, cz), Color = rgb(30, 30, 30), Material = Enum.Material.SmoothPlastic, CanCollide = false })
			for k = -2, 2 do
				local ln = part({ Shape = Enum.PartType.Ball, Size = V(1.4, 1.7, 1.4), Position = V(x, 8.6, cz + k * 4.5), Color = rgb(220, 40, 40), Material = Enum.Material.SmoothPlastic, CanCollide = false, CastShadow = false })
				table.insert(nightLights, { glow = ln })
			end
		end
		-- temple (red walls, green glazed two-tier roof, incense coils with smoke)
		local tx, tz = -300, 236
		part({ Size = V(36, 1, 18), Position = V(tx, 0.5, tz), Color = rgb(150, 145, 138), Material = Enum.Material.Granite })
		part({ Size = V(32, 10, 14), Position = V(tx, 6, tz), Color = rgb(170, 40, 35), Material = Enum.Material.Brick })
		for k = -3, 3 do
			part({ Shape = Enum.PartType.Cylinder, Size = V(10, 1.2, 1.2), CFrame = CFrame.new(tx + k * 5, 6, tz - 7.6) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(200, 30, 30), Material = Enum.Material.SmoothPlastic })
		end
		for tier = 0, 1 do
			local y = 11.2 + tier * 4
			local w, dd = 38 - tier * 8, 20 - tier * 5
			for _, s in ipairs({ -1, 1 }) do
				part({ Size = V(w, 0.8, dd / 2 + 1), CFrame = CFrame.new(tx, y + 1, tz + s * dd / 4) * CFrame.Angles(s * math.rad(-22), 0, 0), Color = green, Material = Enum.Material.Slate })
			end
			part({ Size = V(w - 2, 3, dd - 4), Position = V(tx, y, tz), Color = rgb(170, 40, 35), Material = Enum.Material.Brick })
			for _, s in ipairs({ -1, 1 }) do
				part({ Size = V(1.2, 1.2, 1.2), Position = V(tx + s * (w / 2), y + 1.6, tz - dd / 2), Color = gold, Material = Enum.Material.Metal })
			end
		end
		part({ Size = V(30, 0.8, 1), Position = V(tx, 19.6, tz), Color = gold, Material = Enum.Material.Metal })
		local tp = part({ Size = V(10, 2.4, 0.4), Position = V(tx, 9.6, tz - 7.4), Color = rgb(20, 20, 24), Material = Enum.Material.SmoothPlastic })
		sign(tp, "文武廟 MAN MO", gold)
		for k = -1, 1 do
			local coil = part({ Shape = Enum.PartType.Cylinder, Size = V(0.4, 2.6, 2.6), CFrame = CFrame.new(tx + k * 8, 7, tz - 9) * CFrame.Angles(0, 0, math.rad(90)), Color = rgb(150, 100, 50), Material = Enum.Material.Wood, CanCollide = false })
			local pe = Instance.new("ParticleEmitter")
			pe.Color = ColorSequence.new(rgb(220, 220, 220))
			pe.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 2.5) })
			pe.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 1) })
			pe.Rate = 3
			pe.Lifetime = NumberRange.new(4, 6)
			pe.Speed = NumberRange.new(0.6, 1.2)
			pe.EmissionDirection = Enum.NormalId.Bottom
			pe.Acceleration = V(0.3, 0.8, 0)
			pe.Parent = coil
			local lan = part({ Shape = Enum.PartType.Ball, Size = V(1.8, 2.2, 1.8), Position = V(tx + k * 10, 9.6, tz - 8.6), Color = rgb(230, 50, 40), Material = Enum.Material.Neon, CanCollide = false })
			local l = light(lan, rgb(255, 120, 80), 16, 1.4)
			table.insert(nightLights, { l = l })
		end
	end

	-- ------------------------------------------------------------ HOUSING ESTATE ("monster building", east of the drift arena)
	do
		local function slab(x, z, w, d, h, col, facing, alongX)
			part({ Size = V(w, h, d), Position = V(x, h / 2, z), Color = col, Material = Enum.Material.Concrete })
			for y = 6, h - 2, 3.2 do
				-- one band per floor around the slab: dark windows with a pastel sill
				part({ Size = V(w + 0.2, 1.3, d + 0.2), Position = V(x, y, z), Color = rgb(46, 56, 66), Material = Enum.Material.Glass, Reflectance = 0.15, CastShadow = false, CanCollide = false })
				if math.random() < 0.25 then
					local lit = part({ Size = alongX and V(w * 0.3, 1.2, d + 0.3) or V(w + 0.3, 1.2, d * 0.3), Position = alongX and V(x + (math.random() - 0.5) * w * 0.6, y, z) or V(x, y, z + (math.random() - 0.5) * d * 0.6), Color = rgb(255, 225, 160), Material = Enum.Material.Glass, Transparency = 1, CanCollide = false, CastShadow = false })
					table.insert(nightLights, { band = lit })
				end
			end
			for _ = 1, math.floor(h * (alongX and w or d) / 120) do
				local ax = alongX and (x + (math.random() - 0.5) * (w - 2)) or (x + facing * (w / 2 + 0.6))
				local az = alongX and (z + facing * (d / 2 + 0.6)) or (z + (math.random() - 0.5) * (d - 2))
				part({ Size = V(1.4, 1, 1.4), Position = V(ax, 6 + math.random() * (h - 10), az), Color = rgb(230, 230, 226), Material = Enum.Material.SmoothPlastic, CastShadow = false, CanCollide = false })
			end
			part({ Size = V(w + 0.6, 1, d + 0.6), Position = V(x, h + 0.5, z), Color = rgb(110, 110, 106), Material = Enum.Material.Concrete })
		end
		slab(315, 238, 170, 12, 84, rgb(236, 196, 188), -1, true)
		slab(238, 180, 12, 104, 76, rgb(190, 214, 226), 1, false)
		slab(392, 180, 12, 104, 80, rgb(232, 222, 170), -1, false)
		-- courtyard: basketball court
		part({ Size = V(60, 0.3, 34), Position = V(315, 0.15, 180), Color = rgb(60, 120, 90), Material = Enum.Material.SmoothPlastic })
		part({ Size = V(56, 0.32, 30), Position = V(315, 0.16, 180), Color = rgb(200, 90, 60), Material = Enum.Material.SmoothPlastic })
		for _, s in ipairs({ -1, 1 }) do
			part({ Size = V(0.4, 10, 0.4), Position = V(315 + s * 27, 5, 180), Color = rgb(40, 40, 40), Material = Enum.Material.Metal })
			part({ Size = V(0.3, 3, 5), Position = V(315 + s * 26.5, 10, 180), Color = rgb(250, 250, 250), Material = Enum.Material.SmoothPlastic })
		end
		sign(part({ Size = V(22, 3.5, 0.5), CFrame = CFrame.new(315, 6, 231.6) * CFrame.Angles(0, math.rad(180), 0), Color = rgb(20, 60, 140), Material = Enum.Material.SmoothPlastic }), "益昌大廈 YICK CHEONG", rgb(255, 255, 255))
	end

	-- ------------------------------------------------------------ VICTORIA HARBOUR: clock tower, promenade railing, Kowloon skyline across the water
	do
		-- clock tower on the waterfront (west of the pier)
		local cx, cz = -60, 318
		part({ Size = V(12, 1, 12), Position = V(cx, 0.5, cz), Color = rgb(150, 145, 138), Material = Enum.Material.Granite })
		part({ Size = V(9, 36, 9), Position = V(cx, 18.5, cz), Color = rgb(190, 110, 80), Material = Enum.Material.Brick })
		for y = 4, 34, 6 do part({ Size = V(9.3, 0.8, 9.3), Position = V(cx, y, cz), Color = rgb(225, 220, 205), Material = Enum.Material.Limestone }) end
		part({ Size = V(10, 8, 10), Position = V(cx, 40.5, cz), Color = rgb(225, 220, 205), Material = Enum.Material.Limestone })
		for a = 0, 3 do
			local face = part({ Shape = Enum.PartType.Cylinder, Size = V(0.4, 6, 6), CFrame = CFrame.new(cx, 40.5, cz) * CFrame.Angles(0, a * math.pi / 2, 0) * CFrame.new(5.1, 0, 0), Color = rgb(250, 246, 230), Material = Enum.Material.Neon })
			table.insert(nightLights, { glow = face })
		end
		part({ Shape = Enum.PartType.Ball, Size = V(8, 8, 8), Position = V(cx, 45, cz), Color = rgb(70, 110, 90), Material = Enum.Material.Metal })
		part({ Size = V(0.6, 8, 0.6), Position = V(cx, 52, cz), Color = rgb(70, 110, 90), Material = Enum.Material.Metal })
		-- railing along the promenade edge (gap at the pier)
		for _, seg in ipairs({ { -400, -9 }, { 9, 400 } }) do
			local len = seg[2] - seg[1]
			local mx = (seg[1] + seg[2]) / 2
			part({ Size = V(len, 0.3, 0.3), Position = V(mx, 3.4, 294.6), Color = rgb(60, 64, 70), Material = Enum.Material.Metal })
			part({ Size = V(len, 0.2, 0.2), Position = V(mx, 1.9, 294.6), Color = rgb(60, 64, 70), Material = Enum.Material.Metal })
			for x = seg[1], seg[2], 16 do
				part({ Size = V(0.3, 3.4, 0.3), Position = V(x, 1.9, 294.6), Color = rgb(60, 64, 70), Material = Enum.Material.Metal })
			end
		end
		-- Kowloon skyline on the far shore
		part({ Size = V(2800, 6, 80), Position = V(0, -2, 990), Color = rgb(110, 110, 112), Material = Enum.Material.Concrete })
		for x = -1350, 1350, 42 do
			local w = 22 + math.random(0, 14)
			local h = 40 + math.random(0, 150)
			if math.abs(x - 300) < 25 then h = 330 end
			local col = Color3.fromHSV(0.58 + math.random() * 0.05, 0.2 + math.random() * 0.2, 0.25 + math.random() * 0.3)
			local zz = 975 + math.random(-10, 20)
			part({ Size = V(w, h, w), Position = V(x, h / 2, zz), Color = col, Material = Enum.Material.Glass, Reflectance = 0.3, CastShadow = false })
			for _ = 1, math.random(2, 5) do
				local band = part({ Size = V(w + 0.2, 3, w + 0.2), Position = V(x, 8 + math.random() * (h - 12), zz), Color = Color3.fromHSV(math.random() < 0.7 and 0.12 or math.random(), 0.5, 1), Material = Enum.Material.Glass, Transparency = 1, CanCollide = false, CastShadow = false })
				table.insert(nightLights, { band = band })
			end
			if math.random() < 0.2 then
				local bb = part({ Size = V(w * 0.9, 8, 0.4), Position = V(x, h - 6, zz - w / 2 - 0.4), Color = Color3.fromHSV(math.random(), 0.8, 1), Material = Enum.Material.Neon, Transparency = 0.2, CastShadow = false })
				table.insert(nightLights, { glow = bb })
			end
		end
	end

	-- ------------------------------------------------------------ STREET DETAILS: zebra crossings, traffic lights, tram rails
	do
		local function zebra(cx, cz, alongX, len)
			-- stripes across a road (alongX = the road runs along X)
			for k = -len / 2 + 1, len / 2 - 1, 2 do
				if alongX then
					part({ Size = V(5, 0.22, 1.1), Position = V(cx, 0.235, cz + k), Color = rgb(240, 240, 240), Material = Enum.Material.SmoothPlastic, CanCollide = false, CastShadow = false })
				else
					part({ Size = V(1.1, 0.22, 5), Position = V(cx + k, 0.235, cz), Color = rgb(240, 240, 240), Material = Enum.Material.SmoothPlastic, CanCollide = false, CastShadow = false })
				end
			end
		end
		local function trafficLight(x, z, ry, group)
			local pole = part({ Size = V(0.5, 10, 0.5), Position = V(x, 5, z), Color = rgb(40, 40, 44), Material = Enum.Material.Metal })
			local box = part({ Name = "Semaforo", Size = V(1.4, 4, 1.2), CFrame = CFrame.new(x, 11.5, z) * CFrame.Angles(0, ry, 0), Color = rgb(30, 30, 32), Material = Enum.Material.Metal })
			box:SetAttribute("Grupo", group)
			local cols = { { "Vermelho", rgb(255, 40, 40), 1.2 }, { "Amarelo", rgb(255, 180, 20), 0 }, { "Verde", rgb(40, 255, 110), -1.2 } }
			for _, c in ipairs(cols) do
				local lamp = part({ Name = c[1], Shape = Enum.PartType.Ball, Size = V(0.9, 0.9, 0.9), CFrame = box.CFrame * CFrame.new(0, c[3], -0.6), Color = c[2], Material = Enum.Material.Neon, Transparency = 0.7, CanCollide = false, CastShadow = false })
				lamp.Parent = box
			end
			local _ = pole
		end
		for _, it in ipairs({ { 0, -140, 12, 12 }, { 0, 90, 11, 12 } }) do
			local cx, cz, hz, hx = it[1], it[2], it[3], it[4]
			zebra(cx - hx - 4, cz, true, hz * 2)
			zebra(cx + hx + 4, cz, true, hz * 2)
			zebra(cx, cz - hz - 4, false, hx * 2)
			zebra(cx, cz + hz + 4, false, hx * 2)
			trafficLight(cx - hx - 2, cz - hz - 2, math.rad(180), "A")
			trafficLight(cx + hx + 2, cz + hz + 2, 0, "A")
			trafficLight(cx + hx + 2, cz - hz - 2, math.rad(90), "B")
			trafficLight(cx - hx - 2, cz + hz + 2, math.rad(-90), "B")
		end
		-- tram rails along the middle of the cross avenue
		for _, dz in ipairs({ -1.4, 1.4 }) do
			part({ Size = V(1980, 0.24, 0.3), Position = V(0, 0.24, -140 + dz), Color = rgb(150, 150, 155), Material = Enum.Material.Metal, CanCollide = false, CastShadow = false })
		end
		-- "LOOK RIGHT / 望右" road text at the busy crossings
		for _, p in ipairs({ { -28, -146 }, { -28, -134 } }) do
			local plate = part({ Size = V(8, 0.05, 2.4), Position = V(p[1], 0.25, p[2]), Color = rgb(40, 40, 44), Material = Enum.Material.Asphalt, CanCollide = false, CastShadow = false, Transparency = 0 })
			local g = Instance.new("SurfaceGui")
			g.Face = Enum.NormalId.Top
			g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
			g.PixelsPerStud = 30
			g.Parent = plate
			local t = Instance.new("TextLabel")
			t.Size = UDim2.new(1, 0, 1, 0)
			t.BackgroundTransparency = 1
			t.Text = "望右 LOOK RIGHT →"
			t.TextScaled = true
			t.Font = Enum.Font.GothamBlack
			t.TextColor3 = rgb(250, 250, 250)
			t.Parent = g
		end
	end

	-- ------------------------------------------------------------ CITY TRAFFIC and BOATS (animated by the Cidade LocalScript)
	do
		local folder = Instance.new("Folder")
		folder.Name = "Transito"
		folder.Parent = workspace
		-- a vehicle is a model built around its origin, facing -Z, wheels on y = 0
		local function vehicle(kind)
			local m = Instance.new("Model")
			m.Name = kind
			local function add(size, pos, color, mat, extra)
				local p = Instance.new("Part")
				p.Size = size
				p.CFrame = CFrame.new(pos)
				p.Color = color
				p.Material = mat or Enum.Material.SmoothPlastic
				p.Anchored = true
				p.TopSurface = Enum.SurfaceType.Smooth
				p.BottomSurface = Enum.SurfaceType.Smooth
				if extra then for k, v in pairs(extra) do p[k] = v end end
				p.Parent = m
				return p
			end
			local function wheels(halfW, zs, r)
				for _, z in ipairs(zs) do
					for _, s in ipairs({ -1, 1 }) do
						add(V(0.9, r * 2, r * 2), V(s * halfW, r, z), rgb(20, 20, 20), Enum.Material.SmoothPlastic, { Shape = Enum.PartType.Cylinder, CanCollide = false })
					end
				end
			end
			local root
			if kind == "Taxi" then
				root = add(V(6.6, 2.4, 15), V(0, 2.2, 0), rgb(200, 25, 30), nil, { Reflectance = 0.1 })
				add(V(6.4, 2.6, 15.02), V(0, 2.2, 0), rgb(205, 205, 210), nil, { Size = V(6.62, 1, 15.02), CFrame = CFrame.new(0, 1.2, 0) })
				add(V(5.8, 2.2, 7.5), V(0, 4.5, 0.6), rgb(30, 36, 44), Enum.Material.Glass, { Transparency = 0.2 })
				add(V(5.6, 0.3, 6), V(0, 5.7, 0.6), rgb(200, 25, 30))
				add(V(2, 0.8, 1), V(0, 6.2, 0.6), rgb(255, 240, 200), Enum.Material.Neon)
				for _, s in ipairs({ -1, 1 }) do
					add(V(1.4, 0.5, 0.2), V(s * 2.3, 2.6, -7.55), rgb(255, 250, 230), Enum.Material.Neon, { CanCollide = false })
					add(V(1.4, 0.5, 0.2), V(s * 2.3, 2.6, 7.55), rgb(255, 30, 40), Enum.Material.Neon, { CanCollide = false })
				end
				wheels(3.1, { -4.8, 4.8 }, 1.3)
			elseif kind == "Onibus" then
				-- double-decker bus
				local c1 = ({ rgb(240, 200, 30), rgb(230, 70, 40), rgb(30, 120, 80) })[math.random(1, 3)]
				root = add(V(8.4, 7, 34), V(0, 4.6, 0), c1)
				add(V(8.42, 6.4, 34.02), V(0, 11.3, 0), rgb(245, 245, 240))
				for _, y in ipairs({ 5.6, 11.8 }) do
					add(V(8.5, 2.6, 30), V(0, y, 0.5), rgb(30, 40, 50), Enum.Material.Glass, { Transparency = 0.15, CanCollide = false })
				end
				add(V(7.6, 4, 0.2), V(0, 7, -17.05), rgb(30, 40, 50), Enum.Material.Glass, { CanCollide = false })
				local dest = add(V(6, 1.4, 0.2), V(0, 13.6, -17.05), rgb(10, 10, 10), nil, { CanCollide = false })
				local g = Instance.new("SurfaceGui")
				g.Face = Enum.NormalId.Front
				g.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
				g.PixelsPerStud = 25
				g.LightInfluence = 0
				g.Parent = dest
				local t = Instance.new("TextLabel")
				t.Size = UDim2.new(1, 0, 1, 0)
				t.BackgroundTransparency = 1
				t.Text = "1A 中環 CENTRAL"
				t.TextScaled = true
				t.Font = Enum.Font.GothamBlack
				t.TextColor3 = rgb(255, 160, 30)
				t.Parent = g
				for _, s in ipairs({ -1, 1 }) do
					add(V(1.4, 0.6, 0.2), V(s * 3.3, 2.4, -17.05), rgb(255, 250, 230), Enum.Material.Neon, { CanCollide = false })
				end
				wheels(3.9, { -11, 10 }, 1.7)
			elseif kind == "Bonde" then
				-- "ding ding" double-deck tram
				root = add(V(7, 7, 26), V(0, 4.3, 0), rgb(30, 110, 70))
				add(V(7.02, 6, 26.02), V(0, 10.8, 0), rgb(240, 236, 220))
				for _, y in ipairs({ 6, 11.2 }) do add(V(7.1, 2.6, 22), V(0, y, 0), rgb(40, 50, 40), Enum.Material.Glass, { Transparency = 0.2, CanCollide = false }) end
				add(V(7.2, 0.6, 26.2), V(0, 14, 0), rgb(30, 110, 70))
				add(V(0.3, 4, 0.3), V(0, 16, 0), rgb(40, 40, 40), Enum.Material.Metal, { CanCollide = false })
				wheels(2.8, { -8, 8 }, 1)
			elseif kind == "Microonibus" then
				-- red/green public light bus
				root = add(V(6.8, 6, 18), V(0, 3.8, 0), rgb(245, 245, 240))
				add(V(6.82, 1.4, 18.02), V(0, 1.6, 0), rgb(30, 130, 70))
				add(V(6.9, 2.2, 15), V(0, 5, 0.8), rgb(30, 40, 50), Enum.Material.Glass, { Transparency = 0.15, CanCollide = false })
				add(V(6.84, 0.8, 18.04), V(0, 6.5, 0), rgb(30, 130, 70))
				wheels(3.2, { -6, 6 }, 1.3)
			elseif kind == "Balsa" then
				-- Star Ferry style boat
				root = add(V(16, 5, 52), V(0, 1, 0), rgb(30, 110, 70))
				add(V(16.02, 3.6, 52.02), V(0, 5.2, 0), rgb(245, 245, 240))
				add(V(14, 3.4, 44), V(0, 8.7, 0), rgb(245, 245, 240))
				add(V(14.1, 1.4, 40), V(0, 8.6, 0), rgb(30, 40, 50), Enum.Material.Glass, { CanCollide = false })
				add(V(15, 0.5, 46), V(0, 10.6, 0), rgb(30, 110, 70))
				local nm = add(V(10, 1.4, 0.2), V(0, 5.4, -26.1), rgb(30, 110, 70), nil, { CanCollide = false })
				local _ = nm
			elseif kind == "Junco" then
				-- junk boat with red sails
				root = add(V(10, 4, 34), V(0, 0.5, 0), rgb(120, 70, 40), Enum.Material.Wood)
				add(V(9, 2, 8), V(0, 3.5, 12), rgb(110, 60, 35), Enum.Material.Wood)
				for i, z in ipairs({ -8, 4 }) do
					add(V(0.6, 22 - i * 3, 0.6), V(0, 13 - i * 1.5, z), rgb(70, 45, 30), Enum.Material.Wood, { CanCollide = false })
					add(V(0.2, 16 - i * 3, 12), V(0.4, 14 - i * 1.5, z + 1), rgb(200, 50, 40), Enum.Material.Fabric, { CanCollide = false })
				end
			end
			m.PrimaryPart = root
			-- the model's pivot is its origin on the ground (wheels at y = 0)
			root.PivotOffset = root.CFrame:Inverse()
			return m
		end
		local function route(m, pts, speed, opts)
			opts = opts or {}
			local t = {}
			for _, p in ipairs(pts) do table.insert(t, p[1] .. "," .. p[2]) end
			m:SetAttribute("Rota", table.concat(t, ";"))
			m:SetAttribute("Vel", speed)
			m:SetAttribute("Fase", opts.fase or 0)
			m:SetAttribute("Faixa", opts.faixa or 0)
			m:SetAttribute("Y", opts.y or 0)
			m:SetAttribute("VaiVem", opts.vaivem == true)
			m:PivotTo(CFrame.new(pts[1][1], opts.y or 0, pts[1][2]))
			m.Parent = folder
		end
		-- outer highway (clockwise loop, cars keep LEFT like in Hong Kong)
		local HWY = { { -1000, -1200 }, { 1000, -1200 }, { 1000, 270 }, { -1000, 270 } }
		local kinds = { "Taxi", "Onibus", "Taxi", "Microonibus", "Taxi", "Onibus", "Taxi", "Taxi" }
		for i, k in ipairs(kinds) do
			route(vehicle(k), HWY, k == "Onibus" and 45 or 70, { fase = (i - 1) / #kinds, faixa = 7 })
		end
		-- cross avenue and the z=90 road (loop through the outer highway ends)
		local CROSS = { { -1000, -140 }, { 1000, -140 }, { 1000, 90 }, { -1000, 90 } }
		for i, k in ipairs({ "Taxi", "Microonibus", "Taxi", "Onibus", "Taxi" }) do
			route(vehicle(k), CROSS, k == "Onibus" and 40 or 55, { fase = (i - 1) / 5, faixa = 8 })
		end
		-- trams on their rails (back and forth)
		for i = 0, 1 do
			route(vehicle("Bonde"), { { -900, -140 }, { 900, -140 } }, 22, { fase = i * 0.5, faixa = 0, vaivem = true })
		end
		-- harbour: two ferries across to Kowloon, a junk boat sailing around
		for i = 0, 1 do
			route(vehicle("Balsa"), { { 40 + i * 30, 540 }, { 40 + i * 30, 925 } }, 18, { fase = i * 0.5, y = -1.6, vaivem = true })
		end
		local loop = {}
		for k = 0, 11 do
			local a = k / 12 * math.pi * 2
			table.insert(loop, { -320 + math.cos(a) * 160, 680 + math.sin(a) * 110 })
		end
		route(vehicle("Junco"), loop, 9, { y = -1.4 })
	end
end
