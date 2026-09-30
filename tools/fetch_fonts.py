"""Download the Aura theme fonts (all SIL Open Font License, from Google Fonts) with their licence files.
Output: engine/fonts/<file>.woff2 + engine/fonts/licenses/<family>-OFL.txt. These are safe to ship to users.
The three fonts supplied by the project owner (Work Sans, Quicksand: OFL; Reno Mono: CC BY 4.0) are copied in too."""
import os, re, shutil, sys, urllib.request
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'engine', 'fonts'); LIC = os.path.join(OUT, 'licenses'); os.makedirs(LIC, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'}
#        family,            css2 axis spec,        google/fonts licence folder
FAMILIES = [('Anton', 'wght@400', 'ofl/anton'),
            ('Plus Jakarta Sans', 'wght@200..800', 'ofl/plusjakartasans'),
            ('DM Sans', 'opsz,wght@9..40,100..1000', 'ofl/dmsans'),
            ('Geist', 'wght@100..900', 'ofl/geist'),
            ('Geist Mono', 'wght@100..900', 'ofl/geistmono'),
            ('Doto', 'wght@100..900', 'ofl/doto'),
            ('Fraunces', 'opsz,wght@9..144,100..900', 'ofl/fraunces'),
            ('Jost', 'wght@100..900', 'ofl/jost'),
            ('DM Mono', 'wght@400;500', 'ofl/dmmono'),
            ('Noto Sans', 'wght@100..900', 'ofl/notosans'),
            ('Source Serif 4', 'opsz,wght@8..60,200..900', 'ofl/sourceserif4'),
            ('Open Sans', 'wght@300..800', 'ofl/opensans')]
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
for fam, axes, lic in FAMILIES:
    css = get(f'https://fonts.googleapis.com/css2?family={fam.replace(" ", "+")}:{axes}&display=block').decode()
    blocks = re.findall(r'/\* latin \*/\s*@font-face\s*\{([^}]*)\}', css)
    for blk in blocks:
        url = re.search(r'url\((https://[^)]+\.woff2)\)', blk).group(1)
        w = re.search(r'font-weight:\s*([^;]+);', blk).group(1).strip().replace(' ', '-')
        name = f'{fam.replace(" ", "")}-{w}.woff2'
        open(os.path.join(OUT, name), 'wb').write(get(url)); print('font', name)
    open(os.path.join(LIC, fam.replace(' ', '') + '-OFL.txt'), 'wb').write(get(f'https://raw.githubusercontent.com/google/fonts/main/{lic}/OFL.txt'))
# owner-supplied fonts with public licences
SRC = sys.argv[1] if len(sys.argv) > 1 else None
if SRC:
    pick = {'WorkSans-VariableFont_wght.ttf': 'WorkSans-100-900.ttf', 'Quicksand-VariableFont_wght.ttf': 'Quicksand-300-700.ttf', 'RenoMono.otf': 'RenoMono-400.otf'}
    lic = {'Work_Sans': 'WorkSans-OFL.txt', 'Quicksand': 'Quicksand-OFL.txt', 'reno-mono': 'RenoMono-CC-BY-4.0.txt'}
    for dp, _, fs in os.walk(SRC):
        for f in fs:
            if f in pick and 'Web' not in dp: shutil.copy(os.path.join(dp, f), os.path.join(OUT, pick[f])); print('font', pick[f])
            if f in ('OFL.txt', 'readme.txt'):
                for k, v in lic.items():
                    if k in dp and 'Web' not in dp: shutil.copy(os.path.join(dp, f), os.path.join(LIC, v))
    open(os.path.join(LIC, 'RenoMono-CC-BY-4.0.txt'), 'a').write('\nReno Mono by Renaud Futterer (http://www.renaudfutterer.com/), licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).\n')
print('licences:', sorted(os.listdir(LIC)))
