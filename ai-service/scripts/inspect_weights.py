"""Read the class-name dict from a .pt checkpoint's pickle WITHOUT importing torch.
Sanity check only; the authoritative check is model.names at service startup (app/main.py -> /v1/models)."""
import re, struct, sys, zipfile

path = sys.argv[1] if len(sys.argv) > 1 else "models/yolov8n.pt"
z = zipfile.ZipFile(path)
raw = z.read(next(n for n in z.namelist() if n.endswith("data.pkl")))
start = raw.find(b"X\x05\x00\x00\x00names")
if start < 0:
    sys.exit("names dict not found in pickle (checkpoint layout differs); load it with ultralytics instead")
names, pos = {}, start + 10
# entries look like: K<idx> X<len32><label> r<memo32>   (K = BININT1, X = BINUNICODE, r = LONG_BINPUT)
for m in re.finditer(rb"K(.)X(....)", raw[pos:pos + 6000], flags=re.S):
    idx, ln = m.group(1)[0], struct.unpack("<I", m.group(2))[0]
    label = raw[pos + m.end():pos + m.end() + ln].decode("utf-8", "replace")
    if label == "args":  # next pickle key: end of the names dict
        break
    if idx not in names and idx == len(names):
        names[idx] = label
print(f"{path}: {len(names)} classes parsed")
print("sample:", {k: names[k] for k in list(names)[:5]}, "...")
for want in ["person", "car", "motorcycle", "bus", "truck", "backpack", "handbag", "suitcase", "knife", "gun", "pistol"]:
    print(f"  {want:11s} {'PRESENT' if want in names.values() else 'ABSENT'}")
