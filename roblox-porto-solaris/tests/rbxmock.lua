-- Minimal Roblox mock to RUN Server.lua's map building on plain Lua 5.3 (fengari):
-- Vector3/CFrame math, Instances with Parent/children/attributes, a few services.
-- Event connections are recorded but never fired; task.spawn/delay do not run.
local sqrt, cos, sin, abs = math.sqrt, math.cos, math.sin, math.abs
math.clamp = function(x, a, b) if x < a then return a elseif x > b then return b end return x end
math.sign = function(x) return x > 0 and 1 or (x < 0 and -1 or 0) end
warn = function(...) print("WARN", ...) end
ERRORS = {}

-- ---------------------------------------------------------------- Vector3
local V3 = {}
V3.__index = function(v, k)
	if k == "Magnitude" then return sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z) end
	if k == "Unit" then local m = sqrt(v.X * v.X + v.Y * v.Y + v.Z * v.Z) return Vector3.new(v.X / m, v.Y / m, v.Z / m) end
	return V3[k]
end
local function v3(x, y, z) return setmetatable({ X = x or 0, Y = y or 0, Z = z or 0, __v3 = true }, V3) end
V3.__add = function(a, b) return v3(a.X + b.X, a.Y + b.Y, a.Z + b.Z) end
V3.__sub = function(a, b) return v3(a.X - b.X, a.Y - b.Y, a.Z - b.Z) end
V3.__unm = function(a) return v3(-a.X, -a.Y, -a.Z) end
V3.__mul = function(a, b)
	if type(a) == "number" then return v3(a * b.X, a * b.Y, a * b.Z) end
	if type(b) == "number" then return v3(a.X * b, a.Y * b, a.Z * b) end
	return v3(a.X * b.X, a.Y * b.Y, a.Z * b.Z)
end
V3.__div = function(a, b) if type(b) == "number" then return v3(a.X / b, a.Y / b, a.Z / b) end return v3(a.X / b.X, a.Y / b.Y, a.Z / b.Z) end
V3.__eq = function(a, b) return a.X == b.X and a.Y == b.Y and a.Z == b.Z end
V3.__tostring = function(a) return string.format("%g, %g, %g", a.X, a.Y, a.Z) end
function V3.Dot(a, b) return a.X * b.X + a.Y * b.Y + a.Z * b.Z end
function V3.Cross(a, b) return v3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X) end
function V3.Lerp(a, b, t) return a + (b - a) * t end
Vector3 = { new = v3 }
Vector3.zero = v3(0, 0, 0)
Vector3.one = v3(1, 1, 1)
Vector2 = { new = function(x, y) return { X = x or 0, Y = y or 0 } end }

-- ---------------------------------------------------------------- CFrame (rotation matrix m[r][c])
local CF = {}
local function cf(p, m) return setmetatable({ p = p, m = m, __cf = true }, CF) end
local I = { { 1, 0, 0 }, { 0, 1, 0 }, { 0, 0, 1 } }
local function mmul(a, b)
	local r = {}
	for i = 1, 3 do
		r[i] = {}
		for j = 1, 3 do r[i][j] = a[i][1] * b[1][j] + a[i][2] * b[2][j] + a[i][3] * b[3][j] end
	end
	return r
end
local function mvec(m, v) return v3(m[1][1] * v.X + m[1][2] * v.Y + m[1][3] * v.Z, m[2][1] * v.X + m[2][2] * v.Y + m[2][3] * v.Z, m[3][1] * v.X + m[3][2] * v.Y + m[3][3] * v.Z) end
local function mT(m) return { { m[1][1], m[2][1], m[3][1] }, { m[1][2], m[2][2], m[3][2] }, { m[1][3], m[2][3], m[3][3] } } end
CF.__index = function(c, k)
	if k == "Position" then return c.p end
	if k == "X" then return c.p.X end
	if k == "Y" then return c.p.Y end
	if k == "Z" then return c.p.Z end
	if k == "RightVector" then return v3(c.m[1][1], c.m[2][1], c.m[3][1]) end
	if k == "UpVector" then return v3(c.m[1][2], c.m[2][2], c.m[3][2]) end
	if k == "LookVector" then return v3(-c.m[1][3], -c.m[2][3], -c.m[3][3]) end
	if k == "Rotation" then return cf(v3(), c.m) end
	return CF[k]
end
CF.__mul = function(a, b)
	if b.__cf then return cf(a.p + mvec(a.m, b.p), mmul(a.m, b.m)) end
	return a.p + mvec(a.m, b)
end
CF.__add = function(a, b) return cf(a.p + b, a.m) end
CF.__sub = function(a, b) return cf(a.p - b, a.m) end
function CF.Lerp(a, b, t)
	if t >= 1 then return b end
	if t <= 0 then return a end
	local m = {}
	for i = 1, 3 do m[i] = {} for j = 1, 3 do m[i][j] = a.m[i][j] + (b.m[i][j] - a.m[i][j]) * t end end
	return cf(a.p + (b.p - a.p) * t, m)
end
function CF.Inverse(c) local t = mT(c.m) return cf(-mvec(t, c.p), t) end
function CF.PointToObjectSpace(c, v) return mvec(mT(c.m), v - c.p) end
function CF.PointToWorldSpace(c, v) return c * v end
function CF.ToObjectSpace(c, o) return c:Inverse() * o end
function CF.ToWorldSpace(c, o) return c * o end
function CF.ToEulerAnglesYXZ(c)
	local m = c.m
	local x = math.asin(math.clamp(-m[2][3], -1, 1))
	local y = math.atan(m[1][3], m[3][3])
	local z = math.atan(m[2][1], m[2][2])
	return x, y, z
end
CF.ToOrientation = CF.ToEulerAnglesYXZ
function CF.GetComponents(c)
	local m = c.m
	return c.p.X, c.p.Y, c.p.Z, m[1][1], m[1][2], m[1][3], m[2][1], m[2][2], m[2][3], m[3][1], m[3][2], m[3][3]
end
local function rx(a) return { { 1, 0, 0 }, { 0, cos(a), -sin(a) }, { 0, sin(a), cos(a) } } end
local function ry(a) return { { cos(a), 0, sin(a) }, { 0, 1, 0 }, { -sin(a), 0, cos(a) } } end
local function rz(a) return { { cos(a), -sin(a), 0 }, { sin(a), cos(a), 0 }, { 0, 0, 1 } } end
local function lookAt(at, target, up)
	up = up or v3(0, 1, 0)
	local f = (target - at)
	if f.Magnitude < 1e-9 then return cf(at, I) end
	f = f.Unit
	local r = f:Cross(up)
	if r.Magnitude < 1e-6 then r = v3(1, 0, 0) else r = r.Unit end
	local u = r:Cross(f)
	return cf(at, { { r.X, u.X, -f.X }, { r.Y, u.Y, -f.Y }, { r.Z, u.Z, -f.Z } })
end
CFrame = {
	new = function(a, b, c)
		if a == nil then return cf(v3(), I) end
		if type(a) == "table" and a.__v3 then
			if b and b.__v3 then return lookAt(a, b) end
			return cf(a, I)
		end
		return cf(v3(a, b, c), I)
	end,
	Angles = function(x, y, z) return cf(v3(), mmul(mmul(rx(x), ry(y)), rz(z))) end,
	lookAt = lookAt,
	fromEulerAnglesYXZ = function(x, y, z) return cf(v3(), mmul(mmul(ry(y), rx(x)), rz(z))) end,
}
CFrame.fromEulerAnglesXYZ = CFrame.Angles
CFrame.identity = cf(v3(), I)

-- ---------------------------------------------------------------- simple value types
local C3 = {}
C3.__index = C3
local function c3(r, g, b) return setmetatable({ R = r, G = g, B = b }, C3) end
function C3.Lerp(a, b, t) return c3(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t) end
C3.__eq = function(a, b) return a.R == b.R and a.G == b.G and a.B == b.B end
Color3 = {
	new = c3,
	fromRGB = function(r, g, b) return c3(r / 255, g / 255, b / 255) end,
	fromHSV = function(h, s, v)
		local i = math.floor(h * 6) % 6
		local f = h * 6 - math.floor(h * 6)
		local p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
		local t2 = ({ { v, t, p }, { q, v, p }, { p, v, t }, { p, q, v }, { t, p, v }, { v, p, q } })[i + 1]
		return c3(t2[1], t2[2], t2[3])
	end,
}
local function stub(name) return { new = function(...) return { __type = name, args = { ... } } end } end
ColorSequence, NumberSequence, NumberRange, NumberSequenceKeypoint, TweenInfo, PhysicalProperties = stub("CS"), stub("NS"), stub("NR"), stub("NSK"), stub("TI"), stub("PP")
UDim2 = { new = function(xs, xo, ys, yo)
	return { __type = "UDim2", args = { xs, xo, ys, yo }, X = { Scale = xs or 0, Offset = xo or 0 }, Y = { Scale = ys or 0, Offset = yo or 0 } }
end }
UDim = stub("UDim")
RaycastParams = { new = function() return {} end }
Enum = setmetatable({}, { __index = function(_, k) return setmetatable({}, { __index = function(_, v) return k .. "." .. v end }) end })

-- ---------------------------------------------------------------- signals
local function signal()
	local sg = { handlers = {} }
	function sg:Connect(f) table.insert(self.handlers, f) return { Disconnect = function() end } end
	function sg:Once(f) return self:Connect(f) end
	function sg:Wait() end
	return sg
end
function FIRE(sg, ...)
	for _, f in ipairs(sg.handlers) do f(...) end
end

-- ---------------------------------------------------------------- Instances
local BASEPART = { Part = true, WedgePart = true, CornerWedgePart = true, MeshPart = true, TrussPart = true, VehicleSeat = true, Seat = true, SpawnLocation = true, UnionOperation = true }
local EVENTS = { Triggered = true, Changed = true, OnServerEvent = true, Event = true, PlayerAdded = true, PlayerRemoving = true, Heartbeat = true, Touched = true, ChildAdded = true, CharacterAdded = true, Completed = true,
	OnClientEvent = true, MouseButton1Click = true, MouseButton1Down = true, MouseEnter = true, MouseLeave = true, InputBegan = true, InputEnded = true, InputChanged = true,
	TouchPinch = true, RenderStepped = true, Stepped = true, DescendantAdded = true, Activated = true, FocusLost = true }
local Inst = {}
local ALL = {}
local function isA(o, c)
	if c == "Instance" then return true end
	if c == "BasePart" then return BASEPART[o.ClassName] == true end
	if c == "GuiObject" then return ({ Frame = 1, TextLabel = 1, TextButton = 1, TextBox = 1, ScrollingFrame = 1, ViewportFrame = 1, ImageLabel = 1, ImageButton = 1 })[o.ClassName] ~= nil end
	if c == "PostEffect" then return ({ BloomEffect = 1, SunRaysEffect = 1, ColorCorrectionEffect = 1, DepthOfFieldEffect = 1, BlurEffect = 1 })[o.ClassName] ~= nil end
	if c == "Light" then return ({ PointLight = 1, SpotLight = 1, SurfaceLight = 1 })[o.ClassName] ~= nil end
	if c == "GuiButton" then return o.ClassName == "TextButton" or o.ClassName == "ImageButton" end
	if c == "LuaSourceContainer" then return o.ClassName == "Script" or o.ClassName == "LocalScript" or o.ClassName == "ModuleScript" end
	if c == "Light" then return o.ClassName == "PointLight" or o.ClassName == "SpotLight" or o.ClassName == "SurfaceLight" end
	return o.ClassName == c
end
local meta = {}
meta.__index = function(o, k)
	local raw = rawget(o, "_p")
	if k == "Position" and raw.CFrame then return raw.CFrame.p end
	if raw[k] ~= nil then return raw[k] end
	if Inst[k] then return Inst[k] end
	if EVENTS[k] then local s = signal() raw[k] = s return s end
	-- like Roblox: obj.ChildName
	for _, c in ipairs(rawget(o, "_c")) do if c.Name == k then return c end end
	return nil
end
meta.__newindex = function(o, k, v)
	local raw = rawget(o, "_p")
	if k == "Parent" then
		local old = raw.Parent
		if old then
			local ch = rawget(old, "_c")
			for i, c in ipairs(ch) do if c == o then table.remove(ch, i) break end end
		end
		raw.Parent = v
		if v then table.insert(rawget(v, "_c"), o) end
		return
	end
	if k == "Position" then
		local c = raw.CFrame or CFrame.new()
		raw.CFrame = cf(v, c.m)
		return
	end
	if k == "CFrame" and (type(v) ~= "table" or not v.__cf) then error("CFrame must be a CFrame, got " .. tostring(v), 2) end
	if k == "Size" and BASEPART[raw.ClassName] and (type(v) ~= "table" or not v.__v3) then error(k .. " must be a Vector3", 2) end
	if ((k == "Color" and BASEPART[raw.ClassName]) or k == "BackgroundColor3" or k == "TextColor3") and (type(v) ~= "table" or v.R == nil) then error(k .. " must be a Color3", 2) end
	raw[k] = v
end
meta.__tostring = function(o) return o.Name end
local function new(class)
	local o = setmetatable({ _p = { ClassName = class, Name = class, _attrs = {} }, _c = {} }, meta)
	if BASEPART[class] then
		o._p.Size = v3(4, 1, 2)
		o._p.CFrame = CFrame.new()
		o._p.Color = c3(0.64, 0.64, 0.65)
		o._p.Transparency = 0
		o._p.Material = "Material.Plastic"
		o._p.Anchored = false
		o._p.CanCollide = true
		if class == "Part" then o._p.Shape = "PartType.Block" end
	end
	if not BASEPART[class] then
		o._p.AbsoluteSize = Vector2.new(600, 400)
		o._p.Visible = true
	end
	table.insert(ALL, o)
	return o
end
Instance = { new = function(class, parent) local o = new(class) if parent then o.Parent = parent end return o end }
function Inst.IsA(o, c) return isA(o, c) end
function Inst.GetChildren(o) local t = {} for i, c in ipairs(rawget(o, "_c")) do t[i] = c end return t end
function Inst.GetDescendants(o)
	local out = {}
	local function r(x) for _, c in ipairs(rawget(x, "_c")) do table.insert(out, c) r(c) end end
	r(o)
	return out
end
function Inst.FindFirstChild(o, name, rec)
	for _, c in ipairs(rawget(o, "_c")) do if c.Name == name then return c end end
	if rec then for _, c in ipairs(rawget(o, "_c")) do local f = c:FindFirstChild(name, true) if f then return f end end end
	return nil
end
function Inst.FindFirstChildOfClass(o, cl) for _, c in ipairs(rawget(o, "_c")) do if c.ClassName == cl then return c end end end
function Inst.FindFirstChildWhichIsA(o, cl) for _, c in ipairs(rawget(o, "_c")) do if isA(c, cl) then return c end end end
function Inst.WaitForChild(o, name)
	local c = o:FindFirstChild(name)
	if not c then table.insert(ERRORS, "WaitForChild would hang: " .. o.Name .. "." .. name) end
	return c
end
function Inst.SetAttribute(o, k, v) rawget(o, "_p")._attrs[k] = v end
function Inst.GetAttribute(o, k) return rawget(o, "_p")._attrs[k] end
function Inst.GetPropertyChangedSignal(o, k) local raw = rawget(o, "_p") raw["_pc_" .. k] = raw["_pc_" .. k] or signal() return raw["_pc_" .. k] end
function Inst.GetAttributeChangedSignal(o, k) local raw = rawget(o, "_p") raw["_ac_" .. k] = raw["_ac_" .. k] or signal() return raw["_ac_" .. k] end
function Inst.Destroy(o) o.Parent = nil end
function Inst.ClearAllChildren(o) for _, c in ipairs(o:GetChildren()) do c.Parent = nil end end
function Inst.Clone(o)
	local c = new(o.ClassName)
	for k, v in pairs(rawget(o, "_p")) do
		if k ~= "Parent" and k ~= "_attrs" then rawget(c, "_p")[k] = v end
	end
	for k, v in pairs(rawget(o, "_p")._attrs) do rawget(c, "_p")._attrs[k] = v end
	for _, ch in ipairs(rawget(o, "_c")) do ch:Clone().Parent = c end
	return c
end
function Inst.GetPivot(o)
	if isA(o, "BasePart") then return o.CFrame end
	if o.PrimaryPart then return o.PrimaryPart.CFrame * (o.PrimaryPart.PivotOffset or CFrame.new()) end
	local c = o:GetBoundingBox()
	return c
end
function Inst.PivotTo(o, target)
	if isA(o, "BasePart") then o.CFrame = target return end
	local cur = o:GetPivot()
	local delta = target * cur:Inverse()
	for _, d in ipairs(o:GetDescendants()) do if isA(d, "BasePart") then d.CFrame = delta * d.CFrame end end
end
function Inst.GetBoundingBox(o)
	local lo, hi = v3(math.huge, math.huge, math.huge), v3(-math.huge, -math.huge, -math.huge)
	for _, d in ipairs(o:GetDescendants()) do
		if isA(d, "BasePart") then
			local c, s = d.CFrame, d.Size
			for _, sx in ipairs({ -1, 1 }) do for _, sy in ipairs({ -1, 1 }) do for _, sz in ipairs({ -1, 1 }) do
				local p = c * v3(sx * s.X / 2, sy * s.Y / 2, sz * s.Z / 2)
				lo = v3(math.min(lo.X, p.X), math.min(lo.Y, p.Y), math.min(lo.Z, p.Z))
				hi = v3(math.max(hi.X, p.X), math.max(hi.Y, p.Y), math.max(hi.Z, p.Z))
			end end end
		end
	end
	return CFrame.new((lo + hi) / 2), hi - lo
end
function Inst.GetExtentsSize(o) local _, s = o:GetBoundingBox() return s end
function Inst.SetNetworkOwner() end
function Inst.Sit() end
function Inst.Play() end
function Inst.Stop() end
function Inst.Clear() end
function Inst.FillBlock() end
function Inst.FillBall() end
function Inst.FillCylinder() end
function Inst.FillWedge() end
function Inst.GetPlayers() return {} end
function Inst.GetPlayerFromCharacter() return nil end
function Inst.GetDataStore() error("DataStore not available in the mock") end
function Inst.Create(_, obj, info, goal) return { Play = function() end, Cancel = function() end, Completed = signal() } end
function Inst.BindToClose() end
function Inst.Raycast(_, origin, dir, params)
	-- hits the top of the highest part of the filtered model below the ray
	local best = nil
	for _, root in ipairs(params and params.FilterDescendantsInstances or {}) do
		for _, d in ipairs(root:GetDescendants()) do
			if isA(d, "BasePart") then
				local cfp, s = d.CFrame.p, d.Size
				if math.abs(origin.X - cfp.X) <= s.X / 2 and math.abs(origin.Z - cfp.Z) <= s.Z / 2 then
					local top = cfp.Y + s.Y / 2
					if not best or top > best then best = top end
				end
			end
		end
	end
	return best and { Position = v3(origin.X, best, origin.Z) } or nil
end
function Inst.GetServerTimeNow() return MOCK_TIME or 0 end
function Inst.IsDescendantOf(o, a) local p = o.Parent while p do if p == a then return true end p = p.Parent end return false end
function Inst.FireClient() end
function Inst.FireAllClients() end
function Inst.Fire() end
function Inst.Invoke() return true end

-- ---------------------------------------------------------------- the data model
game = new("DataModel")
workspace = new("Workspace")
workspace.Name = "Workspace"
workspace.Parent = game
local terrain = new("Terrain")
terrain.Name = "Terrain"
terrain.Parent = workspace
local services = {}
function Inst.GetService(_, name)
	if name == "Workspace" then return workspace end
	if not services[name] then
		local s = new(name)
		s.Name = name
		s.Parent = game
		services[name] = s
	end
	return services[name]
end
local rs = game:GetService("ReplicatedStorage")
local ss = game:GetService("ServerStorage")
local veh = new("Folder")
veh.Name = "Vehicles"
veh.Parent = ss
local cat = new("ModuleScript")
cat.Name = "Catalogo"
cat.Parent = rs
MODULES = { [cat] = "Catalogo.lua" }
local cache = {}
require = function(m)
	if not cache[m] then cache[m] = dofile(MODULES[m]) end
	return cache[m]
end
task = {
	spawn = function() end, delay = function() end, defer = function() end,
	wait = function() return 0 end,
}
wait = task.wait
tick = os.clock
typeof = function(v) if type(v) == "table" and v.__v3 then return "Vector3" end if type(v) == "table" and v.__cf then return "CFrame" end return type(v) end

-- ---------------------------------------------------------------- dump
function DUMP(path)
	local out = {}
	for _, o in ipairs(workspace:GetDescendants()) do
		if isA(o, "BasePart") and o.Transparency < 1 then
			local c = o.CFrame
			local m = c.m
			local text = nil
			for _, g in ipairs(o:GetChildren()) do
				if g.ClassName == "SurfaceGui" then
					for _, t in ipairs(g:GetDescendants()) do if t.ClassName == "TextLabel" and t.Text then text = t.Text end end
				end
			end
			local light = nil
			for _, g in ipairs(o:GetChildren()) do
				if isA(g, "Light") then light = g.ClassName end
			end
			table.insert(out, string.format('{"c":"%s","n":"%s","sh":"%s","s":[%.3f,%.3f,%.3f],"p":[%.3f,%.3f,%.3f],"r":[%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f],"col":[%.3f,%.3f,%.3f],"m":"%s","t":%.2f,"rf":%.2f%s%s}',
				o.ClassName, tostring(o.Name):gsub('"', "'"), tostring(o.Shape or ""), o.Size.X, o.Size.Y, o.Size.Z, c.p.X, c.p.Y, c.p.Z,
				m[1][1], m[1][2], m[1][3], m[2][1], m[2][2], m[2][3], m[3][1], m[3][2], m[3][3],
				o.Color.R, o.Color.G, o.Color.B, tostring(o.Material), o.Transparency or 0, o.Reflectance or 0,
				text and (',"txt":"' .. tostring(text):gsub('[\n"\\]', " ") .. '"') or "", light and (',"L":"' .. light .. '"') or ""))
		end
	end
	return "[" .. table.concat(out, ",\n") .. "]"
end

-- the server Script with its MapaHongKong module
script = Instance.new("Script")
script.Name = "PortoSolaris"
script.Parent = game:GetService("ServerScriptService")
local hk = Instance.new("ModuleScript")
hk.Name = "MapaHongKong"
hk.Parent = script
MODULES[hk] = "HongKong.lua"
