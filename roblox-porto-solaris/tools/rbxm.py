#!/usr/bin/env python3
"""Minimal reader for Roblox binary model files (.rbxm/.rbxl) and an XML (.rbxmx) writer.

Parses INST/PROP/PRNT chunks (LZ4 or uncompressed) into a tree of instances
with Python values, and serialises that tree back as Roblox XML items so it can
be embedded in a place file. Unknown property types are skipped (Roblox then
uses the default value).
"""
import base64, struct, sys, xml.sax.saxutils as sx
import lz4.block
try:
    import zstandard
except ImportError:
    zstandard = None

MAGIC = b"<roblox!\x89\xff\r\n\x1a\n"


def _rot32(u):
    return (u >> 1) ^ -(u & 1)


def _interleave(data, n, size):
    # bytes are stored column-major: all first bytes, then all second bytes...
    out = []
    for i in range(n):
        out.append(bytes(data[j * n + i] for j in range(size)))
    return out


class R:
    def __init__(self, b):
        self.b, self.p = b, 0

    def take(self, n):
        v = self.b[self.p:self.p + n]
        self.p += n
        return v

    def u8(self): return self.take(1)[0]
    def u16(self): return struct.unpack("<H", self.take(2))[0]
    def u32(self): return struct.unpack("<I", self.take(4))[0]
    def i32(self): return struct.unpack("<i", self.take(4))[0]
    def f32(self): return struct.unpack("<f", self.take(4))[0]
    def f64(self): return struct.unpack("<d", self.take(8))[0]
    def string(self): return self.take(self.u32())

    def ints(self, n):
        return [_rot32(int.from_bytes(x, "big")) for x in _interleave(self.take(4 * n), n, 4)]

    def uints(self, n):
        return [int.from_bytes(x, "big") for x in _interleave(self.take(4 * n), n, 4)]

    def floats(self, n):
        res = []
        for x in _interleave(self.take(4 * n), n, 4):
            u = int.from_bytes(x, "big")
            u = ((u >> 1) | ((u & 1) << 31)) & 0xFFFFFFFF
            res.append(struct.unpack(">f", u.to_bytes(4, "big"))[0])
        return res

    def refs(self, n):
        v, acc = [], 0
        for d in self.ints(n):
            acc += d
            v.append(acc)
        return v


# special rotation ids used by the CFrame encoding
def _rot_from_id(i):
    axes = [(1, 0, 0), (0, 1, 0), (0, 0, 1), (-1, 0, 0), (0, -1, 0), (0, 0, -1)]
    r = axes[(i - 1) // 6]
    u = axes[(i - 1) % 6]
    # back = right x up
    b = (r[1] * u[2] - r[2] * u[1], r[2] * u[0] - r[0] * u[2], r[0] * u[1] - r[1] * u[0])
    return [r[0], u[0], b[0], r[1], u[1], b[1], r[2], u[2], b[2]]


class Inst:
    def __init__(self, cls, ref):
        self.cls, self.ref, self.props, self.children, self.parent = cls, ref, {}, [], None

    @property
    def name(self):
        return self.props.get("Name", ("string", ""))[1]


def parse(path):
    b = open(path, "rb").read()
    assert b.startswith(MAGIC), "not a binary roblox file"
    r = R(b)
    r.take(len(MAGIC))
    r.u16()
    nclass, ninst = r.i32(), r.i32()
    r.take(8)
    classes, insts, sstr = {}, {}, []
    while r.p < len(b):
        name = r.take(4)
        clen, ulen = r.u32(), r.u32()
        r.take(4)
        raw = r.take(clen if clen else ulen)
        if clen and raw[:4] == b"\x28\xb5\x2f\xfd":
            data = zstandard.ZstdDecompressor().decompress(raw, max_output_size=ulen)
        else:
            data = lz4.block.decompress(raw, uncompressed_size=ulen) if clen else raw
        c = R(data)
        if name == b"INST":
            cid = c.u32()
            cls = c.string().decode()
            c.u8()
            n = c.u32()
            refs = c.refs(n)
            classes[cid] = (cls, refs)
            for rf in refs:
                insts[rf] = Inst(cls, rf)
        elif name == b"SSTR":
            c.u32()
            for _ in range(c.u32()):
                c.take(16)
                sstr.append(c.string())
        elif name == b"PROP":
            cid = c.u32()
            pname = c.string().decode()
            t = c.u8()
            cls, refs = classes[cid]
            n = len(refs)
            vals = read_values(c, t, n, sstr)
            if vals is None:
                continue
            kind, arr = vals
            for rf, v in zip(refs, arr):
                insts[rf].props[pname] = (kind, v)
        elif name == b"PRNT":
            c.u8()
            n = c.u32()
            ch, pa = c.refs(n), c.refs(n)
            for a, p in zip(ch, pa):
                if p >= 0 and p in insts:
                    insts[a].parent = insts[p]
                    insts[p].children.append(insts[a])
        elif name == b"END\x00":
            break
    roots = [i for i in insts.values() if i.parent is None]
    return roots, insts


def read_values(c, t, n, sstr):
    if t == 0x01:
        return "string", [c.string() for _ in range(n)]
    if t == 0x02:
        return "bool", [bool(c.u8()) for _ in range(n)]
    if t == 0x03:
        return "int", c.ints(n)
    if t == 0x04:
        return "float", c.floats(n)
    if t == 0x05:
        return "double", [c.f64() for _ in range(n)]
    if t == 0x06:
        s, o = c.floats(n), c.ints(n)
        return "UDim", list(zip(s, o))
    if t == 0x07:
        xs, ys, xo, yo = c.floats(n), c.floats(n), c.ints(n), c.ints(n)
        return "UDim2", list(zip(xs, xo, ys, yo))
    if t == 0x09:
        return "Faces", [c.u8() for _ in range(n)]
    if t == 0x0A:
        return "Axes", [c.u8() for _ in range(n)]
    if t == 0x0B:
        return "BrickColor", c.uints(n)
    if t == 0x0C:
        r_, g_, b_ = c.floats(n), c.floats(n), c.floats(n)
        return "Color3", list(zip(r_, g_, b_))
    if t == 0x0D:
        x, y = c.floats(n), c.floats(n)
        return "Vector2", list(zip(x, y))
    if t == 0x0E:
        x, y, z = c.floats(n), c.floats(n), c.floats(n)
        return "Vector3", list(zip(x, y, z))
    if t == 0x10:
        return "CFrame", read_cframes(c, n)
    if t == 0x12:
        return "token", c.uints(n)
    if t == 0x13:
        return "Ref", c.refs(n)
    if t == 0x15:
        out = []
        for _ in range(n):
            k = c.u32()
            out.append([(c.f32(), c.f32(), c.f32()) for _ in range(k)])
        return "NumberSequence", out
    if t == 0x16:
        out = []
        for _ in range(n):
            k = c.u32()
            out.append([(c.f32(), c.f32(), c.f32(), c.f32(), c.f32()) for _ in range(k)])
        return "ColorSequence", out
    if t == 0x17:
        return "NumberRange", [(c.f32(), c.f32()) for _ in range(n)]
    if t == 0x18:
        a, b_, cc, d = c.floats(n), c.floats(n), c.floats(n), c.floats(n)
        return "Rect2D", list(zip(a, b_, cc, d))
    if t == 0x19:
        out = []
        for _ in range(n):
            flag = c.u8()
            if flag & 1:
                v = [c.f32() for _ in range(5)]
                if flag & 2:
                    c.f32()
                out.append(v)
            else:
                out.append(None)
        return "PhysicalProperties", out
    if t == 0x1A:
        r_, g_, b_ = c.take(n), c.take(n), c.take(n)
        return "Color3uint8", list(zip(r_, g_, b_))
    if t == 0x1B:
        res = []
        for x in _interleave(c.take(8 * n), n, 8):
            u = int.from_bytes(x, "big")
            res.append((u >> 1) ^ -(u & 1))
        return "int64", res
    if t == 0x1C:
        return "SharedString", [sstr[i] if i < len(sstr) else b"" for i in c.uints(n)]
    if t == 0x20:
        out = []
        for _ in range(n):
            fam = c.string().decode()
            w = c.u16()
            st = c.u8()
            c.string()
            out.append((fam, w, st))
        return "Font", out
    return None  # unsupported type: skip


def read_cframes(c, n):
    rots = []
    for _ in range(n):
        k = c.u8()
        if k == 0:
            rots.append([c.f32() for _ in range(9)])
        else:
            rots.append(_rot_from_id(k))
    x, y, z = c.floats(n), c.floats(n), c.floats(n)
    return [(x[i], y[i], z[i], *rots[i]) for i in range(n)]


# ------------------------------------------------------------------ XML writer
CONTENT_PROPS = {"Image", "SoundId", "Texture", "TextureId", "TextureID", "ShirtTemplate", "PantsTemplate", "MeshId", "AnimationId", "ColorMap", "NormalMap", "RoughnessMap", "MetalnessMap",
                 "SkyboxBk", "SkyboxDn", "SkyboxFt", "SkyboxLf", "SkyboxRt", "SkyboxUp", "SunTextureId", "MoonTextureId", "HoverImage", "PressedImage", "LinkedSource", "Graphic"}
def esc(s):
    return sx.escape(s)


def fmt(v):
    return repr(float(v)) if isinstance(v, float) else str(v)


def prop_xml(name, kind, v, refmap):
    n = esc(name)
    if kind == "string" and name in ("Tags", "AttributesSerialize"):
        raw = v if isinstance(v, bytes) else v.encode()
        return f'<BinaryString name="{n}">{base64.b64encode(raw).decode()}</BinaryString>' if raw else ""
    if kind == "string":
        if isinstance(v, bytes):
            try:
                v = v.decode("utf-8")
            except UnicodeDecodeError:
                return ""
        if name == "Source":
            assert "]]>" not in v
            return f'<ProtectedString name="Source"><![CDATA[{v}]]></ProtectedString>'
        if name in CONTENT_PROPS:
            return f'<Content name="{n}"><url>{esc(v)}</url></Content>' if v else f'<Content name="{n}"><null></null></Content>'
        return f'<string name="{n}">{esc(v)}</string>'
    if kind == "bool":
        return f'<bool name="{n}">{"true" if v else "false"}</bool>'
    if kind == "int":
        return f'<int name="{n}">{v}</int>'
    if kind == "int64":
        return f'<int64 name="{n}">{v}</int64>'
    if kind == "float":
        return f'<float name="{n}">{fmt(v)}</float>'
    if kind == "double":
        return f'<double name="{n}">{fmt(v)}</double>'
    if kind == "token":
        return f'<token name="{n}">{v}</token>'
    if kind == "BrickColor":
        return f'<int name="{n}">{v}</int>'
    if kind == "UDim":
        return f'<UDim name="{n}"><S>{fmt(v[0])}</S><O>{v[1]}</O></UDim>'
    if kind == "UDim2":
        return f'<UDim2 name="{n}"><XS>{fmt(v[0])}</XS><XO>{v[1]}</XO><YS>{fmt(v[2])}</YS><YO>{v[3]}</YO></UDim2>'
    if kind == "Color3":
        return f'<Color3 name="{n}"><R>{fmt(v[0])}</R><G>{fmt(v[1])}</G><B>{fmt(v[2])}</B></Color3>'
    if kind == "Color3uint8":
        return f'<Color3uint8 name="{n}">{0xFF000000 | (v[0] << 16) | (v[1] << 8) | v[2]}</Color3uint8>'
    if kind == "Vector2":
        return f'<Vector2 name="{n}"><X>{fmt(v[0])}</X><Y>{fmt(v[1])}</Y></Vector2>'
    if kind == "Vector3":
        return f'<Vector3 name="{n}"><X>{fmt(v[0])}</X><Y>{fmt(v[1])}</Y><Z>{fmt(v[2])}</Z></Vector3>'
    if kind == "CFrame":
        keys = ["X", "Y", "Z", "R00", "R01", "R02", "R10", "R11", "R12", "R20", "R21", "R22"]
        return f'<CoordinateFrame name="{n}">' + "".join(f"<{k}>{fmt(x)}</{k}>" for k, x in zip(keys, v)) + "</CoordinateFrame>"
    if kind == "Faces":
        return f'<Faces name="{n}"><faces>{v}</faces></Faces>'
    if kind == "Axes":
        return f'<Axes name="{n}"><axes>{v}</axes></Axes>'
    if kind == "NumberSequence":
        return f'<NumberSequence name="{n}">' + " ".join(f"{fmt(a)} {fmt(b)} {fmt(c)}" for a, b, c in v) + " </NumberSequence>"
    if kind == "ColorSequence":
        return f'<ColorSequence name="{n}">' + " ".join(f"{fmt(a)} {fmt(r)} {fmt(g)} {fmt(b)} 0" for a, r, g, b, _ in v) + " </ColorSequence>"
    if kind == "NumberRange":
        return f'<NumberRange name="{n}">{fmt(v[0])} {fmt(v[1])} </NumberRange>'
    if kind == "Rect2D":
        return f'<Rect2D name="{n}"><min><X>{fmt(v[0])}</X><Y>{fmt(v[1])}</Y></min><max><X>{fmt(v[2])}</X><Y>{fmt(v[3])}</Y></max></Rect2D>'
    if kind == "PhysicalProperties":
        if v is None:
            return f'<PhysicalProperties name="{n}"><CustomPhysics>false</CustomPhysics></PhysicalProperties>'
        d, f, e, fw, ew = v
        return f'<PhysicalProperties name="{n}"><CustomPhysics>true</CustomPhysics><Density>{fmt(d)}</Density><Friction>{fmt(f)}</Friction><Elasticity>{fmt(e)}</Elasticity><FrictionWeight>{fmt(fw)}</FrictionWeight><ElasticityWeight>{fmt(ew)}</ElasticityWeight></PhysicalProperties>'
    if kind == "Ref":
        tgt = refmap.get(v)
        return f'<Ref name="{n}">{tgt if tgt else "null"}</Ref>'
    if kind == "Font":
        fam, w, st = v
        return f'<Font name="{n}"><Family><url>{esc(fam)}</url></Family><Weight>{w}</Weight><Style>{"Italic" if st else "Normal"}</Style></Font>'
    return ""


def to_xml(inst, refmap, prefix="A"):
    body = "".join(prop_xml(k, kind, v, refmap) for k, (kind, v) in inst.props.items())
    kids = "".join(to_xml(c, refmap, prefix) for c in inst.children)
    return f'<Item class="{inst.cls}" referent="{refmap[inst.ref]}"><Properties>{body}</Properties>{kids}</Item>'


def refmap_for(insts, prefix="RBXA"):
    return {r: f"{prefix}{i:028X}" for i, r in enumerate(sorted(insts))}


def tree(inst, depth=0, out=None):
    out = out if out is not None else []
    src = inst.props.get("Source")
    extra = f"  ({len(src[1])} bytes)" if src else ""
    out.append("  " * depth + f"{inst.cls} {inst.name!r}{extra}")
    for c in inst.children:
        tree(c, depth + 1, out)
    return out


if __name__ == "__main__":
    roots, insts = parse(sys.argv[1])
    for r in roots:
        print("\n".join(tree(r)))
