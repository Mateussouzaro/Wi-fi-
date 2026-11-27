#!/usr/bin/env python3
"""Packs src/Server.lua and src/Client.lua into place.rbxlx (Roblox XML place)."""
import pathlib
root = pathlib.Path(__file__).parent
server = (root / "src/Server.lua").read_text()
client = (root / "src/Client.lua").read_text()
assert "]]>" not in server + client
ref = iter(f"RBX{i:032X}" for i in range(1, 100))
def item(cls, name, body="", children=""):
    return f'<Item class="{cls}" referent="{next(ref)}"><Properties><string name="Name">{name}</string>{body}</Properties>{children}</Item>'
def script(cls, name, src):
    return item(cls, name, f'<bool name="Disabled">false</bool><ProtectedString name="Source"><![CDATA[{src}]]></ProtectedString>')
xml = '<roblox version="4">'
xml += item("Workspace", "Workspace", '<float name="Gravity">196.2</float>')
xml += item("Lighting", "Lighting", "<token name=\"Technology\">4</token>")
xml += item("ReplicatedStorage", "ReplicatedStorage")
xml += item("ServerScriptService", "ServerScriptService", children=script("Script", "PortoSolaris", server))
xml += item("StarterPlayer", "StarterPlayer", children=item("StarterPlayerScripts", "StarterPlayerScripts", children=script("LocalScript", "Jogador", client)))
xml += item("StarterGui", "StarterGui")
xml += item("SoundService", "SoundService")
xml += "</roblox>"
(root / "place.rbxlx").write_text(xml, encoding="utf-8")
print("place.rbxlx", len(xml), "bytes")
