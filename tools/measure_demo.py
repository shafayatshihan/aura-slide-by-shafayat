"""Rule #4 whitespace (share of pixels that are plain slide background; >= 40 %, hero >= 60 %) and rule #12 accent area
(share of pixels in the slide's one accent colour; aim 5-15 %, < 2 % means no focal accent) for each demo PNG,
plus a side-by-side overview image."""
import glob, json, os, sys
from PIL import Image
D = os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots', sys.argv[1] if len(sys.argv) > 1 else 'theme-demo')
#        canvas     accent colour(s)
THEME = {'1': ('#faf9f5', ['#a9583e']), '2': ('#ffffff', ['#0f62fe']), '3': ('#ffffff', ['#533afd']),
         '4': ('#f2f0eb', ['#006241']), '5': ('#ffffff', ['#dceeb1'])}
if os.path.exists(os.path.join(D, 'themes.json')): THEME = json.load(open(os.path.join(D, 'themes.json')))
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
near = lambda a, b, t: all(abs(x - y) <= t for x, y in zip(a, b))
fs = sorted(glob.glob(os.path.join(D, '[1-5]-*.png')) + glob.glob(os.path.join(D, '[1-5][a-c]-*.png')))
for f in fs:
    im = Image.open(f).convert('RGB').resize((960, 540)); bg, acc = THEME[os.path.basename(f)[0]]
    px = list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata()); n = len(px)
    white = sum(near(p, rgb(bg), 5) for p in px) / n
    a = sum(any(near(p, rgb(c), 28) for c in acc) for p in px) / n
    print(f'{os.path.basename(f):<28} #4 whitespace {white:5.1%} {"PASS" if white >= .40 else "FAIL"}   '
          f'#12 accent area {a:5.1%} {"PASS" if .05 <= a <= .15 else "low" if a < .05 else "high"}')
W, H = 960, 540; s = Image.new('RGB', (W * 2 + 24, (H + 24) * 3), (40, 40, 44))
for i, f in enumerate(fs): s.paste(Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS), ((i % 2) * (W + 24), (i // 2) * (H + 24)))
s.save(os.path.join(D, 'all-five.png'))
