"""Builds docs/1 - Read me first.pdf: the step-by-step guide, screenshots only (no QR codes, no videos).
1) crops each screenshot to what matters, draws an orange box around what to click, blurs personal details;
2) writes docs/guide/guide.html (A4 pages); 3) prints it to PDF with Microsoft Edge (tools/print_pdf.js).
usage: python tools/build_guide.py   (raw screenshots live in docs/screenshots/user and docs/screenshots/raw)"""
import os, glob, html, subprocess, base64, io
from PIL import Image, ImageDraw, ImageFilter

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RAW = os.path.join(REPO, 'docs', 'screenshots', 'raw')
USER = os.path.join(REPO, 'docs', 'screenshots', 'user')   # raw and unblurred: never committed (see .gitignore)
OUT = os.path.join(REPO, 'docs', 'guide'); os.makedirs(OUT, exist_ok=True)
ORANGE = (255, 106, 0)
U = sorted(glob.glob(os.path.join(USER, '*.png')))          # user shots, in the order they were taken

def shot(src, crop=None, boxes=(), blur=(), name=None, maxw=1500):
    im = Image.open(src).convert('RGB')
    for b in blur:                                           # personal details (email, login code)
        r = im.crop(b).filter(ImageFilter.GaussianBlur(14)); im.paste(r, b[:2])
    if crop:
        im = im.crop(crop); ox, oy = crop[:2]
    else:
        ox = oy = 0
    d = ImageDraw.Draw(im)
    for b in boxes:                                          # what to click
        x0, y0, x1, y1 = b[0] - ox, b[1] - oy, b[2] - ox, b[3] - oy
        d.rounded_rectangle((x0 - 6, y0 - 6, x1 + 6, y1 + 6), 12, outline=ORANGE, width=7)
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

u = lambda i: U[i - 1]                                        # 1-based, as numbered on the contact sheet
R = lambda n: os.path.join(RAW, n)
IMG = {
    'extract_menu': shot(u(1), (130, 70, 1570, 860), [(1035, 535, 1510, 578)]),
    'extract_btn':  shot(u(2), (490, 140, 1240, 760), [(1015, 698, 1120, 740)]),
    'setup_file':   shot(u(3), (140, 80, 1600, 860), [(395, 425, 1160, 465)]),
    'run_warning':  shot(u(4), (470, 140, 1060, 630), [(778, 416, 896, 458)]),
    'setup_busy':   shot(u(5), (40, 55, 1150, 700)),
    'setup_done':   shot(R('setup_final.png'), None, [(20, 568, 1140, 592)]),
    'folder':       shot(R('folder.png'), (268, 50, 1100, 460)),
    'files':        shot(R('files_folder.png'), (268, 50, 1100, 500)),
    'form_start':   shot(R('form_1_basics.png'), None),
    'form_files':   shot(R('form_6_files.png'), None, [(356, 496, 628, 560), (644, 496, 826, 560)]),
    'form_saved':   shot(R('form_10_saved.png'), (300, 230, 1620, 850), [(780, 546, 1140, 634)]),
    'trust':        shot(u(7), (220, 110, 1720, 920), [(553, 696, 664, 726)]),
    'claude_icon':  shot(u(8), (0, 0, 900, 997), [(12, 325, 55, 372), (85, 468, 420, 510)]),
    'login':        shot(u(9), (500, 20, 1420, 900), [(706, 612, 1206, 700)], blur=[(720, 615, 1190, 685)]),
    'code':         shot(u(11), (480, 90, 1420, 900), [(730, 700, 1180, 815)], blur=[(790, 495, 1120, 535), (740, 712, 1170, 756)]),
    'authorize':    shot(u(12), (560, 60, 1290, 960), [(615, 826, 1268, 885)]),
    'aura':         shot(u(14), (1095, 30, 1807, 960), [(1110, 180, 1790, 224)]),
}
ICON = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(REPO, 'setup', 'icon', 'aura-slide.png'), 'rb').read()).decode()
LINK = 'github.com/shafayatshihan/aura-slide-by-shafayat'
ZIP = f'https://{LINK}/releases/latest/download/Aura-Slide-Setup.zip'   # clicking it downloads straight away; the PDF stays open

def fig(key, cap, w='100%'):
    return f'<figure style="width:{w}"><img src="{IMG[key]}" alt=""><figcaption>{cap}</figcaption></figure>'
def page(n, title, lead, body):
    num = f'<div class="num">{n}</div>' if n else ''
    return f'<section class="page"><header>{num}<div><h2>{title}</h2><p class="lead">{lead}</p></div></header>{body}<footer>Aura-Slide by Shafayat · {LINK}</footer></section>'
def tip(t, kind=''):
    return f'<div class="tip {kind}">{t}</div>'

pages = []
pages.append(f'''<section class="page cover">
  <div class="warn">&#9888;&#65039;&nbsp; Only for Claude premium users &mdash; free won't work, sadly.</div>
  <img class="logo" src="{ICON}" alt="">
  <h1>Aura-Slide <span>by Shafayat</span></h1>
  <p class="sub">Beautiful presentation slides for your thesis, project or class &mdash; made by Claude from your own files.
  No coding needed. Just follow the pictures.</p>
  <div class="need"><h3>What you need</h3><ul>
    <li><b>Your own laptop</b> with Windows 10 or 11 (university lab PCs usually block installs)</li>
    <li>A <b>Claude Pro</b> (or higher) account</li>
    <li><b>Internet</b>, and about <b>3 GB</b> free space on drive C</li>
    <li>About <b>30 minutes</b> the first time. After that, only a few clicks.</li></ul></div>
  <div class="need"><h3>The steps</h3><ol class="toc">
    <li>Download</li><li>Unzip</li><li>Start the setup</li><li>Let it install</li><li>Your Aura-Slide folder</li>
    <li>Put your files in</li><li>Fill in the form</li><li>Trust the folder in VS Code</li><li>Sign in to Claude</li><li>Say the magic words</li></ol></div>
  <a class="dl cover-dl" href="{ZIP}">&#11015;&#65039;&nbsp; Download Aura-Slide</a>
  <p class="link">Project page: <a href="https://{LINK}">{LINK}</a></p>
</section>''')
pages.append(page(1, 'Download Aura-Slide', 'Click the button. The download starts by itself.', f'''
  <a class="dl" href="{ZIP}">&#11015;&#65039;&nbsp; Download Aura-Slide</a>
  <ol class="do"><li>Click <b>Download Aura-Slide</b> above. This PDF stays open.</li>
  <li>Your browser saves <b>Aura-Slide-Setup.zip</b> in your <b>Downloads</b> folder.</li>
  <li>If your browser asks <b>&ldquo;Keep&rdquo;</b> or <b>&ldquo;Save&rdquo;</b>, click it.</li></ol>
  <p class="small">Button not working? Type this into your browser instead:<br><span class="url">{LINK}/releases/latest</span> and click <b>Aura-Slide-Setup.zip</b>.</p>
  {tip('Download it only from this page. Never run an Aura-Slide file someone sends you on WhatsApp or email.')}
''' + '<h3 class="next">Step 2 &mdash; Unzip it</h3><p class="lead">Open your <b>Downloads</b> folder. <b>Right-click</b> the ZIP file and choose <b>Extract All&hellip;</b></p>'
    + fig('extract_menu', 'Right-click <b>Aura-Slide-Setup</b> &rarr; <b>Extract All&hellip;</b>')))
pages.append(page(2, 'Unzip it (continued)', 'A small window opens. Just click <b>Extract</b>.', fig('extract_btn', 'Click <b>Extract</b>. Do not change anything else.', '82%')
    + tip('Do not double-click files <i>inside</i> the ZIP without extracting first &mdash; it will not work.')))
pages.append(page(3, 'Start the setup', 'A new folder opens. Double-click <b>Setup Aura-Slide</b>.', fig('setup_file', 'Double-click <b>Setup Aura-Slide</b>.')
    + fig('run_warning', 'Windows asks if you are sure. Click <b>Run</b>.', '62%')
    + tip('If you see a blue box <b>&ldquo;Windows protected your PC&rdquo;</b> instead: click <b>More info</b>, then <b>Run anyway</b>.')))
pages.append(page(4, 'Let it install', 'Setup installs everything by itself. It takes <b>10 to 20 minutes</b>.', fig('setup_busy', 'Setup is working. The bar shows how far it is.', '80%')
    + tip('If the screen goes dark and asks <b>&ldquo;Do you want to allow this app to make changes?&rdquo;</b> &mdash; click <b>Yes</b>. It can ask a few times.')
    + tip('Some steps take several minutes. <b>Do not close the window.</b>', 'warn')))
pages.append(page(4, 'Let it install (finished)', 'Wait for the green <b>All done!</b> line.', fig('setup_done', 'All done! Setup now opens the form and VS Code for you.')
    + tip('Red <b>FAIL</b> on a line? Run <b>Setup Aura-Slide</b> again &mdash; it continues where it stopped.')))
pages.append(page(5, 'Your Aura-Slide folder', 'Setup made a folder on drive C: <b>C:\\Aura-Slide by Shafayat</b>. You also get an <b>Aura-Slide</b> icon on your Desktop.',
    fig('folder', 'Everything you need is in this one folder.', '86%') + '''
  <table class="what"><tr><td><b>3 - Put your files here</b></td><td>Your report, pictures and data go here</td></tr>
  <tr><td><b>4 - Your slides</b></td><td>Your finished slides appear here</td></tr>
  <tr><td><b>2 - Fill in the form</b></td><td>Tell Aura-Slide about your presentation</td></tr>
  <tr><td><b>Start Aura-Slide</b></td><td>Opens VS Code, where you talk to Claude</td></tr>
  <tr><td><b>Update Aura-Slide</b></td><td>Gets the newest version</td></tr>
  <tr><td><b>Send problem report</b></td><td>Makes a file you can send to Shafayat if something breaks</td></tr></table>'''))
pages.append(page(6, 'Put your files in', 'Open <b>3 - Put your files here</b> and drag your files into the right folders.', fig('files', 'Seven folders, one for each kind of file.', '80%') + '''
  <table class="what"><tr><td><b>Report</b></td><td>Your thesis or project report (PDF or Word)</td></tr>
  <tr><td><b>Images and photos</b></td><td>Photos of your setup, diagrams, screenshots</td></tr>
  <tr><td><b>Data (csv, excel, graphs)</b></td><td>Your measurements, tables and charts</td></tr>
  <tr><td><b>Logo and university template</b></td><td>Your university logo or slide template</td></tr>
  <tr><td><b>Previous year reports</b></td><td>Older reports on the same topic</td></tr>
  <tr><td><b>Journal papers</b></td><td>Papers you used</td></tr>
  <tr><td><b>Anything else</b></td><td>Anything that does not fit above</td></tr></table>'''
    + tip('Empty folders are fine. Claude only uses what you put here, and never changes or deletes your files.')))
pages.append(page(7, 'Fill in the form', 'The form opens in your browser. Only <b>4 questions</b> are required. Skip the rest and Claude decides.',
    fig('form_start', 'Step 1 of the form: pick the kind of presentation and write the title.', '84%')
    + tip('To open the form again later: double-click <b>2 - Fill in the form</b> in your Aura-Slide folder.')))
pages.append(page(7, 'Fill in the form (continued)', 'In the <b>Your files</b> step, press <b>Check again</b> after adding files. At the end, press <b>Save</b>.',
    fig('form_files', 'Your files are listed. <b>Open my files folder</b> and <b>Check again</b> help you add more.', '80%')
    + fig('form_saved', 'Saved! Now go to VS Code.', '66%')))
pages.append(page(8, 'Trust the folder in VS Code', 'VS Code opens by itself. (Later, open it with <b>Start Aura-Slide</b>.) The first time it asks whether you trust the folder.',
    fig('trust', 'Click <b>Trust</b>. Without this, Claude cannot work.')
    + tip('If instead you see a question <b>&ldquo;Do you trust the authors of the files in this folder?&rdquo;</b>, click <b>Yes, I trust the authors</b>.')))
pages.append(page(9, 'Sign in to Claude', 'First time only. Click the <b>Claude spark</b> icon on the left, then <b>Claude.ai Subscription</b>.',
    fig('claude_icon', 'The orange-boxed spark icon opens Claude. Choose <b>Claude.ai Subscription</b>.', '74%')))
pages.append(page(9, 'Sign in to Claude (continued)', 'Your browser opens. Sign in with the account that has <b>Claude Pro</b>.',
    '<div class="two">' + fig('login', 'Sign in with Google, Apple or your email.') + fig('code', 'If you used email: type the code from your inbox.') + '</div>'
    + fig('authorize', 'Click <b>Authorize</b>. Then go back to VS Code.', '55%')))
pages.append(page(10, 'Say the magic words', 'In the Claude box at the bottom, type the words below and press <b>Enter</b>.',
    '<div class="magic">show your aura</div>' + fig('aura', 'Claude reads your answers and your files, then shows a summary. Reply <b>yes</b> if it is right.', '58%')
    + tip('If Claude says <b>&ldquo;First, open your Aura-Slide folder and double-click 2 - Fill in the form&rdquo;</b> (like in this picture), you have not saved the form yet. Do step 7, then type <b>show your aura</b> again.')))
pages.append(page(None, 'Something went wrong?', 'Try these in order.', '''
  <ol class="do">
  <li><b>Setup stopped or shows red FAIL</b> &rarr; double-click <b>Setup Aura-Slide</b> again. It skips what is already done.</li>
  <li><b>&ldquo;App Installer is missing&rdquo;</b> &rarr; the Microsoft Store opens. Click <b>Get</b> or <b>Update</b>, wait 5 minutes, run setup again.</li>
  <li><b>&ldquo;No internet connection&rdquo;</b> &rarr; connect to Wi-Fi and run setup again.</li>
  <li><b>&ldquo;Only &hellip; GB free on drive C&rdquo;</b> &rarr; delete big files you do not need, empty the Recycle Bin, run setup again.</li>
  <li><b>Claude does not answer</b> &rarr; check that you clicked <b>Trust</b> (step 8) and signed in (step 9).</li>
  <li><b>Claude says your usage limit is reached</b> &rarr; that is your Claude plan. Wait a few hours and continue.</li>
  <li><b>Still stuck</b> &rarr; open your Aura-Slide folder, double-click <b>Send problem report</b>, and send the ZIP it puts on your Desktop to Shafayat.</li>
  </ol>''' + tip('Your files in <b>3 - Put your files here</b> are never changed, moved or deleted by Aura-Slide.')))

css = '''
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;font:400 12.5pt/1.5 "Segoe UI",system-ui,sans-serif;color:#1F2230;background:#fff}
.page{position:relative;width:210mm;height:297mm;padding:16mm 16mm 20mm;page-break-after:always;overflow:hidden}
header{display:flex;gap:6mm;align-items:flex-start;margin-bottom:5mm}
.num{flex:none;width:17mm;height:17mm;border-radius:5mm;display:flex;align-items:center;justify-content:center;color:#fff;font:800 28pt/1 "Segoe UI",sans-serif;
  background:linear-gradient(135deg,#2EC9B0,#4D7CFF 50%,#9A5CFF)}
h2{margin:0;font-size:22pt;line-height:1.15}
h3.next{margin:7mm 0 1mm;font-size:17pt}
.lead{margin:1.5mm 0 0;color:#454A5C;font-size:13pt}
figure{margin:4mm auto 0;text-align:center}
figure img{display:block;width:100%;border-radius:3mm;border:1px solid #D9D7E3;box-shadow:0 2mm 5mm rgba(40,30,90,.10)}
figcaption{margin-top:2mm;font-size:11.5pt;color:#454A5C}
.two{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
.tip{margin-top:5mm;padding:3.5mm 5mm;border-radius:3mm;background:#EEF2FF;border-left:2mm solid #4D7CFF;font-size:12pt}
.tip.warn{background:#FFF4E5;border-left-color:#FF6A00}
ol.do{margin:2mm 0 0;padding-left:7mm;font-size:13pt} ol.do li{margin:2mm 0}
.url{margin:2mm 0;padding:2.5mm 4mm;border-radius:2mm;background:#1B1740;color:#fff;font:600 12pt Consolas,monospace;display:inline-block}
a.dl{display:block;width:fit-content;margin:4mm 0 5mm;padding:5mm 12mm;border-radius:4mm;color:#fff;text-decoration:none;font:700 19pt "Segoe UI",sans-serif;
  background:linear-gradient(90deg,#2EC9B0,#4D7CFF 55%,#9A5CFF);box-shadow:0 2mm 5mm rgba(77,124,255,.35)}
a.cover-dl{margin:7mm 0 0;background:#FF6A00;box-shadow:0 2mm 6mm rgba(0,0,0,.35)}
.small{font-size:11.5pt;color:#454A5C}
.cover .link a{color:#fff}
table.what{width:100%;margin-top:5mm;border-collapse:collapse;font-size:12pt}
table.what td{padding:2mm 3mm;border-bottom:1px solid #E3E1EC;vertical-align:top} table.what td:first-child{width:42%}
.magic{margin:6mm auto 2mm;width:fit-content;padding:4mm 12mm;border-radius:4mm;background:#1B1740;color:#fff;font:700 24pt "Segoe UI",sans-serif;letter-spacing:.02em}
footer{position:absolute;left:16mm;right:16mm;bottom:9mm;font-size:9.5pt;color:#8A8FA3;border-top:1px solid #E3E1EC;padding-top:2mm}
.cover{color:#fff;background:radial-gradient(120mm 90mm at 15% 8%,rgba(46,201,176,.55),transparent 70%),radial-gradient(130mm 100mm at 85% 12%,rgba(154,92,255,.65),transparent 70%),
  radial-gradient(120mm 90mm at 70% 45%,rgba(255,111,181,.35),transparent 70%),#15123A}
.cover .warn{padding:4mm 6mm;border-radius:3mm;background:#FF6A00;color:#fff;font:700 14pt "Segoe UI",sans-serif;text-align:center}
.cover .logo{display:block;width:34mm;height:34mm;margin:14mm 0 5mm;border-radius:8mm;box-shadow:0 3mm 8mm rgba(0,0,0,.35)}
.cover h1{margin:0;font-size:34pt;line-height:1.05} .cover h1 span{display:block;font-size:17pt;font-weight:600;opacity:.85;margin-top:2mm}
.cover .sub{font-size:14pt;opacity:.92;max-width:160mm}
.cover .need{margin-top:6mm;padding:4mm 6mm;border-radius:3mm;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.25)}
.cover h3{margin:0 0 1mm;font-size:13pt;letter-spacing:.08em;text-transform:uppercase;opacity:.85}
.cover ul,.cover ol{margin:1mm 0 0;padding-left:6mm} .cover li{margin:1mm 0}
.cover ol.toc{columns:2;column-gap:10mm}
.cover .link{position:absolute;left:16mm;right:16mm;bottom:12mm;font-size:12.5pt;opacity:.9}
'''
doc = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Aura-Slide - Read me first</title><style>{css}</style></head><body>{"".join(pages)}</body></html>'
hp = os.path.join(OUT, 'guide.html'); open(hp, 'w', encoding='utf-8').write(doc)
pdf = os.path.join(REPO, 'docs', '1 - Read me first.pdf')
subprocess.run(['node', os.path.join(REPO, 'tools', 'print_pdf.js'), hp, pdf], check=True)
print('pages:', len(pages), '->', pdf, round(os.path.getsize(pdf) / 1e6, 1), 'MB')
