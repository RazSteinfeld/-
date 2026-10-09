"""יוצר את האייקון ומסך הפתיחה של האפליקציה (Pillow). הרצה: python3 scripts/make-icons.py"""
import math
from PIL import Image, ImageDraw, ImageFont

OUT = "assets"
S = 1024
SS = 3  # supersampling
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def gradient(size, c1, c2):
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            px[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))
    return img


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def draw_mark(diameter, colors, glyph_color, ring_ratio=0.15, mono=False):
    """טבעת של שלושה קטעים + סימן שקל במרכז. מחזיר תמונת RGBA שקופה."""
    k = diameter * SS
    img = Image.new("RGBA", (k, k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    thick = int(k * ring_ratio)
    pad = 2
    outer = (k - 2 * pad) / 2
    box = (pad, pad, k - pad, k - pad)
    r = outer - thick / 2  # רדיוס קו האמצע של הטבעת
    cx = cy = k / 2
    cap = math.degrees(thick / 2 / r)  # זווית שתופסת כל קצה מעוגל
    gap = 2 * cap + 7
    shares = [0.5, 0.3, 0.2]
    avail = 360 - 3 * gap
    start = -90 + gap / 2 + cap
    for share, col in zip(shares, colors):
        sweep = avail * share - 2 * cap
        end = start + sweep
        d.arc(box, start, end, fill=col, width=thick)
        for ang in (start, end):
            x = cx + r * math.cos(math.radians(ang))
            y = cy + r * math.sin(math.radians(ang))
            d.ellipse((x - thick / 2, y - thick / 2, x + thick / 2, y + thick / 2), fill=col)
        start = end + gap
    font = ImageFont.truetype(FONT, int(k * 0.36))
    d.text((cx, cy), "₪", font=font, fill=glyph_color, anchor="mm")
    return img.resize((diameter, diameter), Image.LANCZOS)


def paste_center(base, mark, scale_to=None):
    if scale_to:
        mark = mark.resize((scale_to, scale_to), Image.LANCZOS)
    x = (base.width - mark.width) // 2
    y = (base.height - mark.height) // 2
    base.alpha_composite(mark, (x, y))


C1, C2 = hex_rgb("#4636E0"), hex_rgb("#9A4DF0")
WHITE = (255, 255, 255, 255)
MINT = hex_rgb("#34D6A2") + (255,)

# סמל לבן על רקע סגול: קטעים לבן / לבן שקוף / מנטה
mark_main = draw_mark(640, [WHITE, (255, 255, 255, 170), MINT], WHITE)

# icon.png – מלא, ללא שקיפות
bg = gradient((S, S), C1, C2).convert("RGBA")
icon = bg.copy()
paste_center(icon, mark_main, 600)
icon.convert("RGB").save(f"{OUT}/icon.png")

# רקע אדפטיבי
bg.convert("RGB").save(f"{OUT}/android-icon-background.png")

# חזית אדפטיבית – בתוך אזור הבטיחות (66%)
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
paste_center(fg, mark_main, 560)
fg.save(f"{OUT}/android-icon-foreground.png")

# מונוכרום (Android 13+ themed icons) – אלפא בלבד
mono = Image.new("RGBA", (S, S), (0, 0, 0, 0))
mono_mark = draw_mark(640, [WHITE, WHITE, WHITE], WHITE)
paste_center(mono, mono_mark, 560)
mono.save(f"{OUT}/android-icon-monochrome.png")

# מסך פתיחה – בהיר וכהה
splash_light = draw_mark(640, [hex_rgb("#5645F0") + (255,), hex_rgb("#9A4DF0") + (255,), hex_rgb("#0E9F68") + (255,)], hex_rgb("#5645F0") + (255,))
splash_dark = draw_mark(640, [hex_rgb("#8E80FF") + (255,), hex_rgb("#B79BFF") + (255,), hex_rgb("#34D6A2") + (255,)], hex_rgb("#8E80FF") + (255,))
for name, m in (("splash-icon.png", splash_light), ("splash-icon-dark.png", splash_dark)):
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    paste_center(canvas, m, 640)
    canvas.save(f"{OUT}/{name}")

# favicon
icon.convert("RGB").resize((48, 48), Image.LANCZOS).save(f"{OUT}/favicon.png")
print("ok")
