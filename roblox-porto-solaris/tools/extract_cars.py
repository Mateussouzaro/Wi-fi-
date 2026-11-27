#!/usr/bin/env python3
"""Pull chosen cars out of a big .rbxl pack, strip EVERY script from them
(the pack contains backdoors such as require(5617364580) and require(3465353826)),
give each one a clean A-Chassis 6C tune from the FORTUNE package, anchor all parts
and write them as Roblox XML items to assets/cars.xml.

usage: extract_cars.py pack.rbxl
"""
import pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import rbxm

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = {"Script", "LocalScript", "ModuleScript"}

# source name (stripped) -> (in-game name, category)
CHOSEN = {
    "Dodge Challenger SRT Hellcat": ("Brava Hellstar", "Esportivos"),
    "2020 Dodge Charger SRT Hellcat Widebody": ("Brava Charger Wide", "Esportivos"),
    "22, mach 1 Mustang": ("Mustero Mach", "Esportivos"),
    "Toyota supra": ("Sora GT", "Esportivos"),
    "porscheboxterGTS": ("Kaiser Roadster", "Esportivos"),
    "Colt VULPES GT-S": ("Vulpes GT-S", "Esportivos"),
    "Lamborghini Urus": ("Toro SUV", "Super"),
    "GPI 2023 Bugatti Mistral": ("Mistral W16", "Super"),
    "2022 Cadilac CT5-V Blackwing": ("Cadenza V", "Super"),
    "audiB9": ("Aurion B9", "Rua"),
    "skodasuperB": ("Superbo", "Rua"),
    "2010 Pontiac G8 GXP - GPI": ("Pontis G8", "Rua"),
    "2020 Jeep Grand Cherokee SRT Trackhawk": ("Trackhawk SRT", "Rua"),
}


def nm(i):
    v = i.props.get("Name", ("", b""))[1]
    return v.decode("utf-8", "replace") if isinstance(v, bytes) else v


def strip_scripts(inst):
    inst.children = [c for c in inst.children if c.cls not in SCRIPTS]
    for c in inst.children:
        strip_scripts(c)


def anchor(inst):
    if inst.cls in ("Part", "MeshPart", "UnionOperation", "WedgePart", "CornerWedgePart", "TrussPart", "VehicleSeat", "Seat"):
        inst.props["Anchored"] = ("bool", True)
    for c in inst.children:
        anchor(c)


def walk(inst):
    yield inst
    for c in inst.children:
        yield from walk(c)


def copy_xml(top, extra=None, prefix="RBXV"):
    """XML for a subtree (plus an extra subtree appended as a child) with fresh referents."""
    nodes = list(walk(top)) + (list(walk(extra)) if extra else [])
    ids = {id(n): f"{prefix}{k:028X}" for k, n in enumerate(nodes)}
    by_ref = {}
    for n in nodes:
        by_ref.setdefault(n.ref, n)

    def ref_of(r):
        n = by_ref.get(r)
        return ids.get(id(n)) if n is not None else None

    class M(dict):
        def get(self, k, d=None):
            return ref_of(k) or d

    def emit(n):
        body = "".join(rbxm.prop_xml(k, kind, v, M()) for k, (kind, v) in n.props.items())
        kids = "".join(emit(c) for c in n.children)
        if n is top and extra is not None:
            kids += emit(extra)
        return f'<Item class="{n.cls}" referent="{ids[id(n)]}"><Properties>{body}</Properties>{kids}</Item>'

    return emit(top)


def main(pack):
    roots, _ = rbxm.parse(pack)
    ws = [r for r in roots if r.cls == "Workspace"][0]
    pool = []
    for c in ws.children:
        if c.cls == "Model":
            pool.append(c)
        elif c.cls == "Folder":
            pool += [k for k in c.children if k.cls == "Model"]
    f_roots, _ = rbxm.parse(str(ROOT / "assets/VehicleSpawnerByFORTUNE.rbxm"))
    veh = [k for k in walk(f_roots[0]) if nm(k) == "Vehicles"][0]
    clean6c = [c for c in veh.children if nm(c).startswith("A-Chassis 6C")][0]
    tune = [c for c in clean6c.children if nm(c) == "A-Chassis Tune"][0]
    out, seen = [], set()
    for car in pool:
        key = nm(car).strip()
        if key not in CHOSEN or key in seen:
            continue
        seen.add(key)
        new_name, cat = CHOSEN[key]
        car.children = [c for c in car.children if nm(c) != "A-Chassis Tune"]
        strip_scripts(car)
        anchor(car)
        car.props["Name"] = ("string", new_name)
        # category goes in an attribute the server sets at start (see Server.lua)
        out.append(copy_xml(car, tune, prefix=f"RBXV{len(out):02d}"))
        print("ok", key, "->", new_name, cat)
    missing = set(CHOSEN) - seen
    if missing:
        print("missing:", missing)
    (ROOT / "assets/cars.xml").write_text("".join(out), encoding="utf-8")
    print("cars.xml", sum(len(x) for x in out), "bytes")


if __name__ == "__main__":
    main(sys.argv[1])
