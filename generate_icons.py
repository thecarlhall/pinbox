#!/usr/bin/env python3
"""Generate simple PNG icons for the Pinbox extension.
Run once: python3 generate_icons.py
"""
import os
import struct
import zlib

def make_png(size, bg_color, tab_color, dot_color):
    """Create a simple PNG icon: blue background + white tab shapes."""
    w = h = size
    scale = size / 32  # design at 32px, scale up/down

    pixels = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = bg_color

            # Draw two simple rectangles representing "tabs" in the icon
            tx1 = int(3 * scale); ty1 = int(6 * scale)
            tw  = int(10 * scale); th  = int(6 * scale)
            tx2 = tx1 + tw + int(2 * scale)

            if (tx1 <= x < tx1 + tw and ty1 <= y < ty1 + th) or \
               (tx2 <= x < tx2 + tw and ty1 <= y < ty1 + th):
                r, g, b, a = tab_color

            # Body rectangle below tabs
            bx = int(3 * scale); by = ty1 + th
            bw = int(26 * scale); bh = int(16 * scale)
            if bx <= x < bx + bw and by <= y < by + bh:
                if not ((tx1 <= x < tx1 + tw) and ty1 <= y < ty1 + th) and \
                   not ((tx2 <= x < tx2 + tw) and ty1 <= y < ty1 + th):
                    r, g, b, a = tab_color

            # Active tab indicator (blue dot on first tab)
            dx = int(tx1 + tw // 2); dy = int(ty1 + th - 2 * scale)
            dr = max(1, int(2 * scale))
            if (x - dx) ** 2 + (y - dy) ** 2 <= dr ** 2:
                r, g, b, a = dot_color

            pixels.append(bytes([r, g, b, a]))

    # Build raw image data (filter byte 0 per row + RGBA pixels)
    raw = b''
    for y in range(h):
        raw += b'\x00'  # None filter
        for x in range(w):
            raw += pixels[y * w + x]

    compressed = zlib.compress(raw, 9)

    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    ihdr_data = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)  # 8-bit RGBA

    png = (
        b'\x89PNG\r\n\x1a\n' +
        chunk(b'IHDR', ihdr_data) +
        chunk(b'IDAT', compressed) +
        chunk(b'IEND', b'')
    )
    return png


def main():
    os.makedirs('assets/icons', exist_ok=True)

    bg    = (26,  115, 232, 255)   # Gmail blue
    tab   = (255, 255, 255, 255)   # White tabs
    dot   = (255, 255, 100, 255)   # Yellow active indicator

    for size in (16, 32, 48, 128):
        data = make_png(size, bg, tab, dot)
        path = f'assets/icons/icon{size}.png'
        with open(path, 'wb') as f:
            f.write(data)
        print(f'  ✓ {path}  ({size}x{size}, {len(data)} bytes)')

    print('Done.')


if __name__ == '__main__':
    main()
