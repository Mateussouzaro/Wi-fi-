#!/usr/bin/env python3
"""Packs the Porto Solaris place into place.rbxlx (Roblox XML place).

- src/Server.lua, src/Client.lua: the game
- assets/A-Chassis_1.6.6.rbxm: A-Chassis (GPL), template for the driveable cars
- assets/VehicleSpawnerByFORTUNE.rbxm: FORTUNE vehicle spawner (menu, Icon module,
  demo S15 and motorcycle), installed into the services its README asks for
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent / "tools"))
import rbxm

root = pathlib.Path(__file__).parent
server = (root / "src/Server.lua").read_text()
client = (root / "src/Client.lua").read_text()
catalogo = (root / "src/Catalogo.lua").read_text()
loja = (root / "src/Concessionaria.lua").read_text()
assert "]]>" not in server + client + catalogo + loja
ref = iter(f"RBX{i:032X}" for i in range(1, 1000))


def item(cls, name, body="", children=""):
    return f'<Item class="{cls}" referent="{next(ref)}"><Properties><string name="Name">{name}</string>{body}</Properties>{children}</Item>'


def script(cls, name, src, disabled=False):
    return item(cls, name, f'<bool name="Disabled">{"true" if disabled else "false"}</bool><ProtectedString name="Source"><![CDATA[{src}]]></ProtectedString>')


def name_of(i):
    v = i.props.get("Name", ("", b""))[1]
    return v.decode("utf-8", "replace") if isinstance(v, bytes) else v


def patch(inst, pairs):
    """replace exact snippets in a script's Source (each must exist once)"""
    src = inst.props["Source"][1]
    src = src.decode("utf-8") if isinstance(src, bytes) else src
    for old, new in pairs:
        assert src.count(old) == 1, old
        src = src.replace(old, new)
    inst.props["Source"] = ("string", src)


# ---- A-Chassis template
a_roots, a_insts = rbxm.parse(str(root / "assets/A-Chassis_1.6.6.rbxm"))
chassis = a_roots[0]
chassis.props["Name"] = ("string", "AChassis")
achassis_xml = rbxm.to_xml(chassis, rbxm.refmap_for(a_insts, "RBXC"))

# ---- FORTUNE spawner package
f_roots, f_insts = rbxm.parse(str(root / "assets/VehicleSpawnerByFORTUNE.rbxm"))
f_ref = rbxm.refmap_for(f_insts, "RBXF")
pkg = {name_of(c): c for c in f_roots[0].children}


def walk(i):
    yield i
    for c in i.children:
        yield from walk(c)


# garage menu: unowned cars show a lock, and the "denied" message points to the dealership
for inst in walk(pkg["Place in StarterGui"]):
    if inst.cls == "TextLabel" and name_of(inst) == "AccessDenied":
        inst.props["Text"] = ("string", "🔒 Compre este carro na Solaris Motors")
    if inst.cls == "LocalScript" and name_of(inst) == "SpawnerClient":
        patch(inst, [
            ("""	if isSelected == true then
		StartCarButtonConnections()
		return
	end""", """	if isSelected == true then
		local owned = game:GetService("Players").LocalPlayer:GetAttribute("Carros") or ""
		for _, frame in pairs({ window.Grid, window.List }) do
			for _, b in pairs(frame:GetChildren()) do
				if b:IsA("GuiButton") and b:FindFirstChild("VehicleName") then
					local has = string.find(owned, "|" .. b.Name .. "|", 1, true) ~= nil
					b.VehicleName.Text = (has and "" or "🔒 ") .. b.Name
				end
			end
		end
		StartCarButtonConnections()
		return
	end"""),
        ])


def kids(folder, skip=()):
    return "".join(rbxm.to_xml(c, f_ref) for c in pkg[folder].children if name_of(c) not in skip)


# the spawner server waits for our script to build the cars, which then enables it
spawner = [c for c in pkg["Place in ServerScriptService"].children if name_of(c) == "SpawnerServer"][0]
spawner.props["Disabled"] = ("bool", True)
spawner.props["Enabled"] = ("bool", False)


# dealership integration: only cars the player owns can come out of the garage,
# each spawned car is reported (to apply the saved paint), and the server can
# take a car out for the player (DIRIGIR AGORA)
patch(spawner, [
    ("""	local categoryName = vehicleIds[carId]:GetAttribute("CarCategory")""",
     """	if vehicleIds[carId] == nil then
		return false, "Unknown vehicle"
	end
	local gate = ServerStorage:FindFirstChild("PodeSpawnar")
	if gate and not gate:Invoke(plr, vehicleIds[carId].Name) then
		return false, "Compre este carro na Solaris Motors"
	end

	local categoryName = vehicleIds[carId]:GetAttribute("CarCategory")"""),
    ("""	table.insert(cars, 1, data)
""", """	table.insert(cars, 1, data)
	local hook = ServerStorage:FindFirstChild("CarroSpawnado")
	if hook then
		hook:Fire(plr, newCar)
	end
"""),
    ("""	spawnRemote.OnServerInvoke = SpawnCar
""", """	spawnRemote.OnServerInvoke = SpawnCar
	local byName = Instance.new("BindableFunction")
	byName.Name = "FortuneSpawn"
	byName.OnInvoke = function(plr, carName)
		for id, car in pairs(vehicleIds) do
			if car.Name == carName then
				return SpawnCar(plr, id)
			end
		end
		return false, "Unknown vehicle"
	end
	byName.Parent = ServerStorage
"""),
])
sss_fortune = rbxm.to_xml(spawner, f_ref)

# our categories (the template module starting with "." is ignored by the spawner)
# same categories as the dealership (src/Catalogo.lua); buying is checked per car by PodeSpawnar
CATEGORIES = [
    ("Populares", "Populares", 0, "ALL", ""),
    ("Sedãs", "Sedas", 1, "ALL", ""),
    ("SUVs", "SUVs", 2, "ALL", ""),
    ("Esportivos", "Esportivos", 3, "ALL", ""),
    ("Luxo", "Luxo", 4, "ALL", ""),
]


def category_module(display, attr, prio, access, custom):
    body = f'''local Category = {{}}
Category.NAME = "{display}"
Category.ATTRIBUTE = "{attr}"
Category.ACCESS = "{access}"
Category.HIDDEN = false
Category.PRIORITY = {prio}
Category.GAMEPASS_ID = 0
Category.PROMPT_GAMEPASS = false
Category.CanPlayerSpawn = function(plr)
	if Category.ACCESS == "CUSTOM" then
		{custom or "return true"}
	end
	return true
end
return Category
'''
    return item("ModuleScript", attr, f'<ProtectedString name="Source"><![CDATA[{body}]]></ProtectedString>')


rs_children = ""
for c in pkg["Place in ReplicatedStorage"].children:
    if name_of(c) == "CarSpawnerCategories":
        inner = "".join(rbxm.to_xml(k, f_ref) for k in c.children)
        inner += "".join(category_module(*x) for x in CATEGORIES)
        rs_children += item("Folder", "CarSpawnerCategories", children=inner)
    else:
        rs_children += rbxm.to_xml(c, f_ref)
rs_children += item("ModuleScript", "Catalogo", f'<ProtectedString name="Source"><![CDATA[{catalogo}]]></ProtectedString>')

xml = '<roblox version="4">'
xml += item("Workspace", "Workspace", '<float name="Gravity">196.2</float>')
xml += item("Lighting", "Lighting", '<token name="Technology">4</token>')
xml += item("ReplicatedStorage", "ReplicatedStorage", children=rs_children)
xml += item("ServerScriptService", "ServerScriptService", children=script("Script", "PortoSolaris", server) + sss_fortune)
xml += item("StarterPlayer", "StarterPlayer", children=item("StarterPlayerScripts", "StarterPlayerScripts", children=script("LocalScript", "Jogador", client) + script("LocalScript", "Concessionaria", loja)))
xml += item("StarterGui", "StarterGui", children=kids("Place in StarterGui"))
cars_xml = (root / "assets/cars.xml").read_text(encoding="utf-8")
xml += item("ServerStorage", "ServerStorage", children=item("Folder", "Vehicles", children=cars_xml))
xml += item("SoundService", "SoundService")
xml += "</roblox>"
(root / "place.rbxlx").write_text(xml, encoding="utf-8")
print("place.rbxlx", len(xml), "bytes")
