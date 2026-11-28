-- Cidade (LocalScript): brings the Hong Kong city to life on each client.
-- Moves the taxis, buses, trams and boats in workspace.Transito along their routes
-- (all clients use the server clock, so everyone sees the traffic in the same place),
-- runs the traffic lights and the colour-changing neon crown.
-- Route attributes (set by the server): Rota "x,z;x,z;...", Vel (studs/s), Fase (0-1),
-- Faixa (lane offset to the LEFT of the direction: Hong Kong drives on the left),
-- Y (height), VaiVem (back and forth instead of a loop).

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local camera = workspace.CurrentCamera
local player = Players.LocalPlayer
local trafficFolder = nil

local function parse(str)
	local pts = {}
	for x, z in string.gmatch(str or "", "([%-%d%.]+),([%-%d%.]+)") do
		table.insert(pts, Vector3.new(tonumber(x), 0, tonumber(z)))
	end
	return pts
end

-- shift a polyline to the left of its direction (miter at the corners)
local function offsetPath(pts, d, closed)
	if d == 0 then return pts end
	local n = #pts
	local function left(a, b)
		local dir = (b - a).Unit
		return Vector3.new(dir.Z, 0, -dir.X)
	end
	local out = {}
	for i = 1, n do
		local prev = pts[i - 1] or (closed and pts[n] or nil)
		local nxt = pts[i + 1] or (closed and pts[1] or nil)
		local lIn = prev and left(prev, pts[i]) or nil
		local lOut = nxt and left(pts[i], nxt) or nil
		local off
		if lIn and lOut then
			local m = lIn + lOut
			local dot = math.max(0.2, m.Unit:Dot(lOut))
			off = m.Unit * (d / dot)
		else
			off = (lIn or lOut) * d
		end
		out[i] = pts[i] + off
	end
	return out
end

-- a route turned into segments with cumulative length
local function build(pts, closed, pingpong)
	local seq = {}
	for _, p in ipairs(pts) do table.insert(seq, p) end
	if pingpong then
		for i = #pts - 1, 1, -1 do table.insert(seq, pts[i]) end
	elseif closed then
		table.insert(seq, pts[1])
	end
	local cum, total = { 0 }, 0
	for i = 2, #seq do
		total = total + (seq[i] - seq[i - 1]).Magnitude
		cum[i] = total
	end
	return { pts = seq, cum = cum, total = total }
end

local function pointAt(r, s)
	s = s % r.total
	local pts, cum = r.pts, r.cum
	local lo, hi = 1, #pts
	while hi - lo > 1 do
		local mid = math.floor((lo + hi) / 2)
		if cum[mid] <= s then lo = mid else hi = mid end
	end
	local segLen = cum[hi] - cum[lo]
	local t = segLen > 0 and (s - cum[lo]) / segLen or 0
	return pts[lo]:Lerp(pts[hi], t)
end

local movers = {}
local function register(m)
	if movers[m] or not m:IsA("Model") or not m:GetAttribute("Rota") then return end
	local raw = parse(m:GetAttribute("Rota"))
	if #raw < 2 then return end
	local pingpong = m:GetAttribute("VaiVem") == true
	local lane = m:GetAttribute("Faixa") or 0
	local route = build(offsetPath(raw, lane, not pingpong), not pingpong, pingpong)
	movers[m] = {
		route = route,
		vel = m:GetAttribute("Vel") or 40,
		fase = m:GetAttribute("Fase") or 0,
		y = (m:GetAttribute("Y") or 0) + 0.25,
		frame = math.random(0, 14),
	}
end

-- where a mover is at a given time (pure, used by the tests too)
local function placeAt(mv, now)
	local s = now * mv.vel + mv.fase * mv.route.total
	local p = pointAt(mv.route, s)
	local ahead = pointAt(mv.route, s + 7)
	local dir = ahead - p
	if dir.Magnitude < 0.01 then dir = Vector3.new(0, 0, -1) end
	local pos = p + Vector3.new(0, mv.y, 0)
	return CFrame.lookAt(pos, pos + Vector3.new(dir.X, 0, dir.Z))
end

task.spawn(function()
	local folder = workspace:WaitForChild("Transito", 60)
	if not folder then return end
	trafficFolder = folder
	for _, m in ipairs(folder:GetChildren()) do register(m) end
	folder.ChildAdded:Connect(register)
	folder.ChildRemoved:Connect(function(m) movers[m] = nil end)
end)

-- traffic lights and the neon crown (looked up once the map has arrived)
local lights, crowns = {}, {}
task.spawn(function()
	local mapa = workspace:WaitForChild("Mapa", 60)
	if not mapa then return end
	task.wait(2)
	for _, d in ipairs(mapa:GetDescendants()) do
		if d.Name == "Semaforo" and d:IsA("BasePart") then
			table.insert(lights, { group = d:GetAttribute("Grupo") or "A", r = d:FindFirstChild("Vermelho"), y = d:FindFirstChild("Amarelo"), g = d:FindFirstChild("Verde") })
		elseif d.Name == "CoroaNeon" and d:IsA("BasePart") then
			table.insert(crowns, d)
		end
	end
end)
-- 24 s cycle: group A green 9 s, yellow 3 s, red 12 s; group B the opposite
local function lightState(group, t)
	local c = t % 24
	if group == "B" then c = (c + 12) % 24 end
	if c < 9 then return "g" elseif c < 12 then return "y" end
	return "r"
end
local lastLightUpdate = 0

RunService.RenderStepped:Connect(function()
	local now = workspace:GetServerTimeNow()
	-- "Trânsito animado" switched off in the settings: hide the vehicles on this device
	local trafficOn = player == nil or player:GetAttribute("CfgTransito") ~= false
	if trafficFolder then
		local want = trafficOn and workspace or nil
		if trafficFolder.Parent ~= want then trafficFolder.Parent = want end
	end
	local camPos = camera.CFrame.Position
	for m, mv in pairs(movers) do
		if not trafficOn then
			-- nothing to move
		elseif m.Parent then
			mv.frame = mv.frame + 1
			local pivot = m:GetPivot().Position
			-- near vehicles move every frame, far ones a few times a second (phone CPU)
			if not mv.placed or (pivot - camPos).Magnitude < 650 or mv.frame % 15 == 0 then
				mv.placed = true
				local cf = placeAt(mv, now)
				local root = m.PrimaryPart
				if root and root.Anchored then
					-- one anchored root with everything welded to it: moving it moves the vehicle
					root.CFrame = cf * root.PivotOffset:Inverse()
				else
					m:PivotTo(cf)
				end
			end
		else
			movers[m] = nil
		end
	end
	if now - lastLightUpdate > 0.25 then
		lastLightUpdate = now
		for _, l in ipairs(lights) do
			local st = lightState(l.group, now)
			if l.r then l.r.Transparency = st == "r" and 0 or 0.75 end
			if l.y then l.y.Transparency = st == "y" and 0 or 0.75 end
			if l.g then l.g.Transparency = st == "g" and 0 or 0.75 end
		end
		for _, c in ipairs(crowns) do
			c.Color = Color3.fromHSV((now / 20) % 1, 0.7, 1)
		end
	end
end)

-- exposed for the offline tests
_G.CidadeTeste = { offsetPath = offsetPath, build = build, pointAt = pointAt, placeAt = placeAt, register = register, movers = movers, lightState = lightState }
