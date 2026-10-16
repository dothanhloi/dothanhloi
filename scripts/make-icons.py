# Tạo bộ icon app: python3 scripts/make-icons.py assets   (cần: pip install pillow)
from PIL import Image, ImageDraw
import math, sys, os
OUT = sys.argv[1]
BLUE = (47, 69, 255, 255)
WHITE = (255, 255, 255, 255)

def draw_scale(d, cx, cy, s, color=WHITE):
    """Vẽ biểu tượng cân bàn: mặt đồng hồ tròn + bệ cân + hạt cà phê"""
    w = int(s * 0.055)
    # bệ cân
    d.rounded_rectangle([cx - s*0.42, cy + s*0.22, cx + s*0.42, cy + s*0.36], radius=int(s*0.06), fill=color)
    # cổ cân
    d.rounded_rectangle([cx - s*0.10, cy + s*0.05, cx + s*0.10, cy + s*0.24], radius=int(s*0.03), fill=color)
    # mặt đồng hồ (vòng)
    r = s*0.30
    d.ellipse([cx - r, cy - s*0.25 - r, cx + r, cy - s*0.25 + r], outline=color, width=int(w*1.6))
    # vạch chia
    for i in range(-4, 5):
        a = math.radians(-90 + i*22)
        r1, r2 = r*0.78, r*0.9 if i % 2 == 0 else r*0.86
        d.line([cx + r1*math.cos(a), cy - s*0.25 + r1*math.sin(a), cx + r2*math.cos(a), cy - s*0.25 + r2*math.sin(a)], fill=color, width=max(2, int(w*0.5)))
    # kim
    a = math.radians(-90 + 35)
    d.line([cx, cy - s*0.25, cx + r*0.72*math.cos(a), cy - s*0.25 + r*0.72*math.sin(a)], fill=color, width=int(w*1.1))
    d.ellipse([cx - w, cy - s*0.25 - w, cx + w, cy - s*0.25 + w], fill=color)
    # hạt cà phê trên bệ
    bx, by, br = cx + s*0.28, cy + s*0.12, s*0.09
    d.ellipse([bx - br, by - br*1.3, bx + br, by + br*1.3], fill=color)
    d.line([bx, by - br*1.1, bx, by + br*1.1], fill=BLUE, width=max(2, int(w*0.45)))

def rounded_bg(size, radius, color=BLUE):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=color)
    return im

S = 1024
# icon.png: iOS cần nền đặc (không alpha) – Expo tự bo góc
icon = Image.new('RGBA', (S, S), BLUE)
draw_scale(ImageDraw.Draw(icon), S/2, S/2, S*0.82)
icon.convert('RGB').save(os.path.join(OUT, 'icon.png'))
# splash
sp = Image.new('RGBA', (S, S), (0, 0, 0, 0))
draw_scale(ImageDraw.Draw(sp), S/2, S/2, S*0.8)
sp.save(os.path.join(OUT, 'splash-icon.png'))
# android adaptive: foreground (safe zone ~ 66%), background, monochrome
fg = Image.new('RGBA', (S, S), (0, 0, 0, 0))
draw_scale(ImageDraw.Draw(fg), S/2, S/2, S*0.56)
fg.save(os.path.join(OUT, 'android-icon-foreground.png'))
Image.new('RGBA', (S, S), BLUE).save(os.path.join(OUT, 'android-icon-background.png'))
mono = Image.new('RGBA', (S, S), (0, 0, 0, 0))
draw_scale(ImageDraw.Draw(mono), S/2, S/2, S*0.56, color=(0, 0, 0, 255))
mono.save(os.path.join(OUT, 'android-icon-monochrome.png'))
# favicon
fav = rounded_bg(256, 56)
draw_scale(ImageDraw.Draw(fav), 128, 128, 256*0.82)
fav.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'favicon.png'))
print('icons ok')
