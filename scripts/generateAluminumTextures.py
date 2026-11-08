"""Generate small, seamless PBR maps for the scope's bead-blasted finish."""
import math
import random
import struct
import zlib
from pathlib import Path

SIZE = 256
OUT = Path(__file__).resolve().parents[1] / 'public/materials/aluminum'
rng = random.Random(47)
heights = [rng.random() for _ in range(SIZE * SIZE)]

def height(x, y):
    return heights[(y % SIZE) * SIZE + x % SIZE]

def png(name, pixels):
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xffffffff)
    raw = b''.join(b'\0' + bytes(pixels[y * SIZE * 3:(y + 1) * SIZE * 3]) for y in range(SIZE))
    header = struct.pack('!2I5B', SIZE, SIZE, 8, 2, 0, 0, 0)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

albedo, roughness, normal = [], [], []
for y in range(SIZE):
    for x in range(SIZE):
        grain = height(x, y) - .5
        # Small isotropic pits, rather than the directional scratches of brushing.
        silver = round(232 + grain * 16)
        albedo.extend([silver, silver, silver])
        matte = round(178 + grain * 20)
        roughness.extend([matte, matte, matte])
        dx = (height(x + 1, y) - height(x - 1, y)) * .48
        dy = (height(x, y + 1) - height(x, y - 1)) * .48
        length = math.sqrt(dx * dx + dy * dy + 1)
        normal.extend([round((-dx / length * .5 + .5) * 255), round((dy / length * .5 + .5) * 255), round((1 / length * .5 + .5) * 255)])
png('base-color.png', albedo)
png('roughness.png', roughness)
png('normal.png', normal)
