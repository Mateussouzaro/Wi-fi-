-- mocks of the few Roblox types the module touches
local function color(r, g, b) return { R = r, G = g, B = b, __color = true } end
Color3 = { fromRGB = function(r, g, b) return color(r / 255, g / 255, b / 255) end, new = function(r, g, b) return color(r, g, b) end }
Enum = setmetatable({}, { __index = function(_, k) return setmetatable({}, { __index = function(_, v) return k .. "." .. v end }) end })
local Inst = {}
Inst.__index = Inst
local function new(class, name, props, children)
	local o = setmetatable({ ClassName = class, Name = name, attrs = {}, children = {} }, Inst)
	for k, v in pairs(props or {}) do o[k] = v end
	for _, c in ipairs(children or {}) do c.Parent = o table.insert(o.children, c) end
	return o
end
local BASE = { Part = true, MeshPart = true, VehicleSeat = true, Seat = true }
function Inst:IsA(c) if c == "BasePart" then return BASE[self.ClassName] == true end return self.ClassName == c end
function Inst:GetDescendants() local out = {} local function r(o) for _, c in ipairs(o.children) do table.insert(out, c) r(c) end end r(self) return out end
function Inst:FindFirstChildOfClass(c) for _, k in ipairs(self.children) do if k.ClassName == c then return k end end end
function Inst:SetAttribute(k, v) self.attrs[k] = v end
function Inst:GetAttribute(k) return self.attrs[k] end
local function part(name, rgb, props)
	local p = { Color = Color3.fromRGB(rgb[1], rgb[2], rgb[3]), Size = { X = 2, Y = 1, Z = 4 }, Transparency = 0, Material = "Material.SmoothPlastic" }
	for k, v in pairs(props or {}) do if k ~= "children" and k ~= "class" then p[k] = v end end
	return new(props and props.class or "MeshPart", name, p, props and props.children)
end

local M = dofile(arg and arg[1] or "Catalogo.lua")
local fails, n = 0, 0
local function check(cond, msg) n = n + 1 if not cond then fails = fails + 1 print("FAIL: " .. msg) end end

-- catalogue consistency
local names = M.lista()
check(#names == 13, "13 cars, got " .. #names)
for i = 2, #names do check(M.CARROS[names[i - 1]].ordem < M.CARROS[names[i]].ordem, "sorted by ordem") end
local cats = {}
for _, c in ipairs(M.CATEGORIAS) do cats[c.id] = true end
local free = 0
for nome, info in pairs(M.CARROS) do
	check(cats[info.categoria] == true, nome .. " has a known category")
	for _, k in ipairs({ "marca", "modelo", "descricao" }) do check(type(info[k]) == "string" and #info[k] > 0, nome .. "." .. k) end
	for _, k in ipairs({ "preco", "vmax", "zero100", "potencia" }) do check(type(info[k]) == "number" and info[k] >= 0, nome .. "." .. k) end
	if info.preco == 0 then free = free + 1 end
end
check(free == 2, "two free starter cars")
for _, c in ipairs(M.CATEGORIAS) do
	if c.id ~= "Todos" then
		local k = 0
		for _, info in pairs(M.CARROS) do if info.categoria == c.id then k = k + 1 end end
		check(k >= 2, "category " .. c.id .. " has cars")
	end
end
-- every catalogue name exists among the real 3D cars
local xmlnames = dofile("names.lua")

for nome in pairs(M.CARROS) do check(xmlnames[nome], nome .. " exists in cars.xml") end

-- money format
check(M.formatar(0) == "0", "fmt 0")
check(M.formatar(600) == "600", "fmt 600")
check(M.formatar(1500) == "1.500", "fmt 1500 -> " .. M.formatar(1500))
check(M.formatar(8000) == "8.000", "fmt 8000")
check(M.formatar(123456) == "123.456", "fmt 123456 -> " .. M.formatar(123456))
check(M.formatar(1234567) == "1.234.567", "fmt 1234567 -> " .. M.formatar(1234567))

-- purchase rules
local ok, why, price, missing = M.validarCompra(5000, {}, "Sora GT")
check(ok and why == "ok" and price == 2200, "can buy with enough credits")
ok, why, price, missing = M.validarCompra(2199, {}, "Sora GT")
check(not ok and why == "sem_dinheiro" and missing == 1, "cannot buy 1 credit short")
ok, why = M.validarCompra(2200, {}, "Sora GT")
check(ok, "exact credits are enough")
ok, why = M.validarCompra(99999, { ["Sora GT"] = true }, "Sora GT")
check(not ok and why == "ja_tem", "cannot buy twice")
ok, why = M.validarCompra(99999, {}, "Superbo")
check(not ok and why == "ja_tem", "free car is already yours")
ok, why = M.validarCompra(99999, {}, "Carro Fantasma")
check(not ok and why == "desconhecido", "unknown car")
ok, why = M.validarCompra(nil, {}, "Sora GT")
check(not ok and why == "sem_dinheiro", "nil credits")
ok, why = M.validarCompra(-5, {}, "Aurion B9")
check(not ok and why == "sem_dinheiro", "negative credits")
check(M.podeUsar({}, "Superbo") and M.podeUsar(nil, "Pontis G8"), "free cars usable")
check(not M.podeUsar({}, "Mistral W16"), "paid car locked")
check(M.podeUsar({ ["Mistral W16"] = true }, "Mistral W16"), "bought car usable")
check(M.podeUsar({}, "S15 de teste"), "cars outside catalogue stay usable")
check(M.corValida(0) == 0 and M.corValida(14) == 14 and M.corValida("3") == 3, "valid colours")
check(M.corValida(15) == nil and M.corValida(-1) == nil and M.corValida(1.5) == nil and M.corValida("x") == nil and M.corValida(nil) == nil, "invalid colours")

-- paint tagging: named paint parts, same-colour body panels, no wheels/glass/seat/interior of other colours
local wheelTyre = part("Tyre", { 112, 12, 12 })
local car = new("Model", "Pontis G8", {}, {
	new("Folder", "Wheels", {}, { new("Model", "FL", {}, { wheelTyre }) }),
	new("Model", "Body", {}, {
		part("Paint", { 112, 12, 12 }, { Size = { X = 6, Y = 2, Z = 10 } }),
		part("Door", { 112, 12, 12 }),
		part("Window", { 112, 12, 12 }, { Material = "Material.Glass" }),
		part("Trim", { 17, 17, 17 }, { Size = { X = 6, Y = 6, Z = 6 } }),
		part("Seat", { 112, 12, 12 }, { class = "VehicleSeat" }),
	}),
})
local count = M.marcarPintura(car)
local tagged = {}
for _, d in ipairs(car:GetDescendants()) do if d:GetAttribute("Pintura") then tagged[d.Name] = true end end
check(tagged.Paint and tagged.Door, "named paint + same colour panels tagged")
check(not tagged.Tyre and not tagged.Window and not tagged.Trim and not tagged.Seat, "wheels/glass/trim/seat not tagged")
check(count == 2, "2 parts tagged, got " .. count)
-- the named paint is tiny compared with the biggest body colour: that colour is added too
local car2 = new("Model", "X", {}, {
	part("Paint", { 17, 17, 17 }),
	part("Shell", { 200, 200, 200 }, { Size = { X = 40, Y = 10, Z = 40 } }),
})
M.marcarPintura(car2)
check(car2.children[1]:GetAttribute("Pintura") and car2.children[2]:GetAttribute("Pintura"), "small named paint -> biggest colour added")
-- no named paint at all: biggest colour of the body
local car3 = new("Model", "Y", {}, {
	part("A", { 248, 248, 248 }, { Size = { X = 20, Y = 5, Z = 20 } }),
	part("B", { 17, 17, 17 }),
})
M.marcarPintura(car3)
check(car3.children[1]:GetAttribute("Pintura") and not car3.children[2]:GetAttribute("Pintura"), "fallback to biggest colour")
-- SurfaceAppearance named Paint
local sa = new("SurfaceAppearance", "Paint", {})
local car4 = new("Model", "Z", {}, { part("Body1", { 50, 50, 50 }, { children = { sa } }), part("Big", { 9, 9, 9 }, { Size = { X = 3, Y = 3, Z = 3 } }) })
M.marcarPintura(car4)
check(car4.children[1]:GetAttribute("Pintura"), "SurfaceAppearance named Paint")

-- painting and going back to the original colour
local p = car.children[2].children[1]
local orig = p.Color
M.pintar(car, 4)
check(p.Color == M.CORES[4].cor, "painted blue")
check(wheelTyre.Color ~= M.CORES[4].cor, "tyre untouched")
M.pintar(car, 0)
check(p.Color == orig, "back to original")
M.pintar(car4, 1)
check(sa.Color == M.CORES[1].cor, "SurfaceAppearance tinted")
M.pintar(car4, nil)
check(sa.Color.R == 1 and car4.children[1].Color.R == 50 / 255, "SurfaceAppearance reset")

-- the client's saved-colour parser
local function savedColor(attr, nome)
	for entry in string.gmatch(attr or "", "[^;]+") do
		local nn, i = string.match(entry, "^(.-)=(%d+)$")
		if nn == nome then return tonumber(i) end
	end
	return 0
end
check(savedColor("Superbo=3;Pontis G8=12", "Pontis G8") == 12, "parse saved colour")
check(savedColor("Superbo=3", "Sora GT") == 0 and savedColor(nil, "Sora GT") == 0, "no saved colour")
-- the owned list lookup used by client and garage menu
local owned = "|Superbo|Pontis G8|Brava Charger Wide|"
check(string.find(owned, "|Brava Charger Wide|", 1, true) and not string.find(owned, "|Brava|", 1, true), "owned lookup is exact")

print(string.format("%d checks, %d failed", n, fails))
if fails > 0 then os.exit(1) end
