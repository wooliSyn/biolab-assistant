from PIL import Image, ImageDraw

def render(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    s = size / 512.0
    # gradient background
    grad = Image.new("RGB", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(99 + (147 - 99) * t)
        g = int(102 + (74 - 102) * t)
        b = int(241 + (226 - 241) * t)
        gd.line([(0, y), (size, y)], fill=(r, g, b))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(112 * s), fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    cx = size // 2
    white = (255, 255, 255, 255)
    # test tube (capsule)
    tw = int(150 * s)
    d.rounded_rectangle([cx - tw // 2, int(120 * s), cx + tw // 2, int(420 * s)], radius=tw // 2, fill=white)
    # rim
    rw = int(200 * s)
    d.rounded_rectangle([cx - rw // 2, int(96 * s), cx + rw // 2, int(140 * s)], radius=int(22 * s), fill=white)
    # liquid (bottom inside tube)
    lw = tw - int(44 * s)
    d.rounded_rectangle([cx - lw // 2, int(290 * s), cx + lw // 2, int(398 * s)], radius=lw // 2, fill=(165, 180, 252, 255))
    # bubbles
    d.ellipse([cx - int(28 * s), int(250 * s), cx - int(8 * s), int(270 * s)], fill=(199, 210, 254, 255))
    d.ellipse([cx + int(6 * s), int(222 * s), cx + int(22 * s), int(238 * s)], fill=(199, 210, 254, 255))
    return img

base = "C:/Users/Wan/.qoderworkcn/workspace/mrub8fj2efm3sv2l/outputs/biolab-desktop/src-tauri/icons"
# multi-size ICO (crisp at each size)
sizes = [16, 24, 32, 48, 64, 128, 256]
imgs = [render(sz) for sz in sizes]
imgs[-1].save(f"{base}/icon.ico", format="ICO", sizes=[(sz, sz) for sz in sizes], append_images=imgs[:-1])
# high-res PNG for tray / window
render(512).save(f"{base}/icon.png", format="PNG")
# 32x32 for tray (crisp small icon)
render(64).save(f"{base}/tray.png", format="PNG")
print("icons generated")
