"""Aura-Slide Studio server. Serves the web app on http://127.0.0.1:<port>/ (this PC only), saves the brief to
.aura/brief/brief.json plus a readable brief.md for Claude, takes file uploads into "3 - Put your files here", and
runs Claude in the background to build the slides (live events for the page, kept under .aura/temp).
v0.3: a deck library (.aura/decks/<id>.json, /api/decks..., /deck/<id>/ previews, slide pictures, direct text tweaks
checked by the hard rules), Claude runs tied to a deck (its own session and quality: best / balanced / fast), the
loading-screen checks (/api/health) with fixes (/api/fix/<npm|pip|signin|update>), and the usage meter (/api/usage).
Stops by itself after 45 minutes without use, but never while Claude is working. Standard library only.

  python form_server.py [--port N]
Environment (dev/test): AURA_HOME (the .aura folder), AURA_NODE_MODULES (fallback for three.js),
AURA_FAKE_CLAUDE (a script to run instead of Claude), AURA_IDLE_SECONDS, AURA_NO_LAUNCH=1 (never open windows),
AURA_NO_NETWORK=1 (no GitHub version check), AURA_LATEST_VERSION (pretend this is the latest release),
AURA_HEALTH_FAIL=<id,id> (pretend these health checks fail), AURA_FAKE_FIX=1 (fixes run a harmless stand-in command;
AURA_FAKE_FIX_FAIL=<name> makes that one fail)."""
import concurrent.futures, datetime, html as htmllib, json, os, re, shutil, subprocess, sys, threading, time, unicodedata
import urllib.request, uuid
from collections import deque
from html.parser import HTMLParser
from email.utils import formatdate, parsedate_to_datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs

# ---------------------------------------------------------------- paths and settings
ENGINE = Path(os.path.abspath(__file__)).parent          # not resolve(): keep a junctioned .aura/engine as is
AURA = Path(os.environ['AURA_HOME']).absolute() if os.environ.get('AURA_HOME') else ENGINE.parent
ROOT = AURA.parent
FILES = ROOT / '3 - Put your files here'
SLIDES = ROOT / '4 - Your slides'
BRIEF = AURA / 'brief'
TEMP = AURA / 'temp'
LOGS = AURA / 'logs'
FORM = ENGINE / 'form'
FONTS = ENGINE / 'fonts'
DECKS = AURA / 'decks'
THUMBS = TEMP / 'thumbs'
BUILDS = TEMP / 'build'
VENV_PY = AURA / 'venv' / 'Scripts' / 'python.exe'
try:
    CFG = json.loads((AURA / 'aura.config.json').read_text(encoding='utf-8'))
except Exception:
    CFG = {}
PORT = int(CFG.get('formPort', 8765))
IDLE_LIMIT = float(os.environ.get('AURA_IDLE_SECONDS') or 45 * 60)
NO_LAUNCH = os.environ.get('AURA_NO_LAUNCH') == '1'
NO_WINDOW = getattr(subprocess, 'CREATE_NO_WINDOW', 0)
NEW_CONSOLE = getattr(subprocess, 'CREATE_NEW_CONSOLE', 0)
API_VERSION = 2
last_hit = time.time()

FOLDERS = ['Report', 'Images and photos', 'Data (csv, excel, graphs)', 'Logo and university template',
           'Previous year reports', 'Journal papers', 'Anything else']
MAX_UPLOAD = 2 * 1024 ** 3
MAX_JSON = 2_000_000
CHUNK = 1024 * 1024

MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.mp4': 'video/mp4',
        '.webm': 'video/webm', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
        '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
        '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
        '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8'}
STATIC = {'css': FORM / 'css', 'js': FORM / 'js', 'assets': FORM / 'assets', 'themes': FORM / 'themes', 'fonts': FONTS}
THREE_FILES = ('three.module.js', 'three.core.js')

WEB_PROMPT = ('You are running inside the Aura-Slide web app, not a terminal. The person reads your messages in a chat '
              'panel and is not technical: keep messages short, friendly and plain, no code. Use the aura-slide skill '
              'progress markers. When you need an answer, ask one clear question, put [[aura:ask]] on its own line, '
              'and end your turn.')
FIRST_MESSAGE = ('show your aura\n\n[from-web] Started from the Aura-Slide web app. The brief is saved and the user '
                 'reviewed it, so skip the confirmation step and build the slides.')
AUTH_RE = re.compile(r'not logged in|please run /login|run\s+/login|invalid api key|authentication[_ ]error|'
                     r'oauth token (has )?expired|token has expired|please log ?in|login required|not authenticated', re.I)
LIMIT_RE = re.compile(r'usage limit|hit your limit|limit reached|rate[_ ]limit', re.I)
DONE_RE = re.compile(r'\[\[aura:done\s+path="([^"]+)"\s*\]\]')
BUILD_RE = re.compile(r'\.aura/temp/build/([A-Za-z0-9_.-]+)')


def log(*parts):
    try:
        LOGS.mkdir(parents=True, exist_ok=True)
        with open(LOGS / 'form_server.log', 'a', encoding='utf-8') as f:
            f.write(datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S ') + ' '.join(str(p) for p in parts) + '\n')
    except Exception:
        pass


def write_atomic(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f'.{path.name}.{uuid.uuid4().hex[:8]}.tmp')
    tmp.write_text(text, encoding='utf-8')
    os.replace(tmp, path)


def inside(child, base):
    try:
        Path(child).resolve().relative_to(Path(base).resolve())
        return True
    except (ValueError, OSError):
        return False


# ---------------------------------------------------------------- files and brief
def list_files():
    out = []
    if FILES.exists():
        rank = lambda p: (FOLDERS.index(p.name) if p.name in FOLDERS else len(FOLDERS), p.name.lower())
        for sub in sorted((p for p in FILES.iterdir() if p.is_dir()), key=rank):
            items = [str(f.relative_to(FILES)).replace('\\', '/') for f in sorted(sub.rglob('*'))
                     if f.is_file() and not f.name.startswith(('~$', '.')) and f.name.lower() != 'desktop.ini']
            out.append({'folder': sub.name, 'files': items})
    return out


QUALITIES = ('best', 'balanced', 'fast')
QUALITY_TEXT = {'best': 'Best quality (slower, uses more of the plan)', 'balanced': 'Balanced',
                'fast': 'Fast (quickest, lighter on the plan)'}


def norm_quality(q):
    q = str(q or '').strip().lower()
    return q if q in QUALITIES else 'balanced'


def quality_of(brief):
    st = brief.get('style') if isinstance(brief, dict) and isinstance(brief.get('style'), dict) else {}
    return norm_quality(st.get('quality'))


def quality_flags(q):
    """Claude command-line flags for the quality vs speed choice. Every choice can fall back to Sonnet."""
    q = norm_quality(q)
    if q == 'best': return ['--model', 'opus', '--effort', 'high', '--fallback-model', 'sonnet']
    if q == 'fast': return ['--model', 'sonnet', '--effort', 'low']
    return ['--model', 'sonnet', '--effort', 'high']


def amount_label(n):
    return 'Minimal' if n <= 20 else 'Light' if n <= 45 else 'Balanced' if n <= 70 else 'Rich' if n <= 90 else 'Maximum'


def yes_no(v):
    if isinstance(v, bool): return 'Yes' if v else 'No'
    if isinstance(v, str) and v.strip().lower() in ('yes', 'no'): return v.strip().capitalize()
    return v


def as_markdown(b):
    """Readable version of the answers for Claude. Unknown keys are kept, so the form can grow freely."""
    L = ['# Presentation brief', f"_Saved {b.get('_savedAt', '')}_", '']
    sec = lambda k: b.get(k) if isinstance(b.get(k), dict) else {}
    join = lambda *xs: ' - '.join(str(x) for x in xs if x not in (None, ''))
    def row(label, v):
        if v in (None, '', [], {}): return
        if isinstance(v, list): v = ', '.join(str(x) for x in v if x not in (None, ''))
        if v != '': L.append(f'- **{label}:** {v}')
    s = sec('basics')
    L.append('## The talk'); row('Type', s.get('typeOther') or s.get('type')); row('Title', s.get('title')); row('Subtitle', s.get('subtitle'))
    row('Date', s.get('date')); row('Event / course', s.get('event'))
    lk, st = sec('look'), sec('style')
    theme = lk.get('theme')
    L.append('\n## Look and motion')
    row('Theme', theme if theme and theme != 'Claude chooses' else 'Claude chooses (pick the Aura theme that suits the topic and audience)')
    row('3D simulations', yes_no(st.get('threeD')))
    row('2D animations', yes_no(st.get('twoD')))
    amt = st.get('amount')
    try:
        n = max(0, min(100, int(round(float(amt)))))
        row('Amount of illustration and animation', f"{n} / 100 ({st.get('amountLabel') or amount_label(n)})")
    except (TypeError, ValueError):
        row('Amount of illustration and animation', st.get('amountLabel'))
    row('Quality', QUALITY_TEXT[quality_of(b)])
    p = sec('people')
    L.append('\n## People')
    for m in p.get('presenters') or []:
        if isinstance(m, dict): row('Presenter', join(m.get('name'), m.get('id'), m.get('role')))
    row('Supervisor / instructor', join(p.get('supervisor'), p.get('supervisorTitle')))
    row('Institution', p.get('institution')); row('Department', p.get('department'))
    a = sec('audience')
    L.append('\n## Audience and time'); row('Audience', a.get('who')); row('What they already know', a.get('level'))
    row('Time limit (minutes)', a.get('minutes')); row('Number of slides', a.get('slides') or 'Claude decides'); row('Q&A (minutes)', a.get('qa'))
    w = sec('work')
    L.append('\n## The work'); row('Subject area', w.get('field')); row('What we did (one sentence)', w.get('summary'))
    row('Why it matters', w.get('problem')); row('How we did it', w.get('method'))
    for r in w.get('results') or []:
        if isinstance(r, dict): row('Key result', join(r.get('what'), r.get('value')))
    row('Main message to remember', w.get('message')); row('Status', w.get('status')); row('What comes next', w.get('next'))
    pl = sec('plan')
    L.append('\n## Slide plan')
    planned = [] if pl.get('auto', True) else [sl for sl in pl.get('slides') or [] if isinstance(sl, dict) and any(sl.values())]
    if not planned:
        L.append('- Claude plans the slides.')
    for i, sl in enumerate(planned, 1):
        L.append(f"{i}. **{sl.get('title') or '(no title)'}** - {sl.get('covers') or ''}" + (f" _(use: {sl.get('file')})_" if sl.get('file') else ''))
    f = sec('files')
    L.append('\n## Files'); row('Main report', f.get('mainReport')); row('Do not use', f.get('avoid'))
    for g in list_files():
        if g['files']: row(g['folder'], g['files'])
    c = sec('content')
    L.append('\n## Special content'); row('Include', c.get('include')); row('Citation style', c.get('citations'))
    d = sec('delivery')
    L.append('\n## On the day'); row('Where', d.get('where')); row('Needs to work offline', d.get('offline')); row('Backups', d.get('backups'))
    row('Speaker help', d.get('help')); row('Clicker', d.get('clicker'))
    e = sec('extra')
    L.append('\n## Anything else'); row('Avoid', e.get('avoid')); row('Deadline', e.get('deadline')); row('Notes', e.get('notes'))
    # drop section headings that got no rows
    head = lambda s: s.lstrip('\n').startswith('## ')
    L = [ln for i, ln in enumerate(L) if not (head(ln) and (i + 1 == len(L) or head(L[i + 1])))]
    return '\n'.join(L) + '\n'


RESERVED = {'CON', 'PRN', 'AUX', 'NUL', 'CONIN$', 'CONOUT$', *(f'COM{i}' for i in range(10)), *(f'LPT{i}' for i in range(10))}


def clean_name(raw):
    """A safe Windows file name: no folders, no reserved characters or device names, no hidden names."""
    name = unicodedata.normalize('NFC', raw or '')
    name = re.split(r'[\\/]', name)[-1]
    name = ''.join('_' if (ord(ch) < 32 or ch in '<>:"|?*') else ch for ch in name)
    name = name.strip(' .\t')
    if not name: name = 'file'
    if name.split('.')[0].strip().upper() in RESERVED or name.lower() == 'desktop.ini' or name.startswith('~$'):
        name = '_' + name
    if len(name) > 120:
        stem, ext = os.path.splitext(name)
        ext = ext[:16]
        name = stem[:120 - len(ext)].rstrip(' .') + ext
    return name


def static_path(url_path):
    """Map a URL path to a file the app may serve, or None. Confined to its base folder, whitelisted extensions."""
    p = unquote(urlsplit(url_path).path)
    if p in ('/', '/index.html'): return FORM / 'index.html'
    if p in ('/icon.png', '/favicon.ico'):
        f = FORM / 'icon.png'
        return f if f.is_file() else None
    if '\x00' in p or '\\' in p or ':' in p: return None
    if p.startswith('/vendor/three/'):
        name = p[len('/vendor/three/'):]
        if name not in THREE_FILES: return None
        dirs = [ENGINE / 'node_modules' / 'three' / 'build']
        if os.environ.get('AURA_NODE_MODULES'): dirs.append(Path(os.environ['AURA_NODE_MODULES']) / 'three' / 'build')
        return next((d / name for d in dirs if (d / name).is_file()), None)
    parts = p.lstrip('/').split('/')
    base = STATIC.get(parts[0])
    rest = parts[1:]
    if not base or not rest: return None
    if any(seg in ('', '.', '..') or seg.startswith('.') for seg in rest): return None
    if Path(rest[-1]).suffix.lower() not in MIME or rest[-1].lower().endswith('.html'): return None
    f = base.joinpath(*rest)
    if not inside(f, base) or not f.is_file(): return None
    return f


def now_iso():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


def write_bytes_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f'.{path.name}.{uuid.uuid4().hex[:8]}.tmp')
    tmp.write_bytes(data)
    os.replace(tmp, path)


def read_brief():
    try:
        b = json.loads((BRIEF / 'brief.json').read_text(encoding='utf-8'))
        return b if isinstance(b, dict) else {}
    except (OSError, ValueError):
        return {}


def rel_root(p):
    return str(Path(p).resolve().relative_to(ROOT.resolve())).replace('\\', '/')


# ---------------------------------------------------------------- deck library (.aura/decks/<id>.json)
DECK_ID_RE = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
DECK_ROUTE = re.compile(r'^/api/decks/([A-Za-z0-9_-]{1,64})(?:/(thumb\.png|slides|slides/(\d{1,3})\.png|text))?$')
DECK_LOCK = threading.RLock()
DECK_FIELDS = ('id', 'title', 'file', 'look', 'quality', 'createdAt', 'updatedAt', 'sessionId', 'brief', 'build')


def deck_json(deck_id):
    return DECKS / f'{deck_id}.json' if isinstance(deck_id, str) and DECK_ID_RE.match(deck_id) else None


def load_deck(deck_id):
    f = deck_json(deck_id)
    if not f: return None
    try:
        rec = json.loads(f.read_text(encoding='utf-8'))
        return rec if isinstance(rec, dict) and rec.get('id') == deck_id else None
    except (OSError, ValueError):
        return None


def save_deck(rec, touch=True):
    with DECK_LOCK:
        if touch: rec['updatedAt'] = now_iso()
        write_atomic(deck_json(rec['id']), json.dumps(rec, indent=2, ensure_ascii=False))
    return rec


def update_deck(deck_id, **fields):
    with DECK_LOCK:
        rec = load_deck(deck_id)
        if not rec: return None
        rec.update(fields)
        return save_deck(rec)


def look_of(brief):
    lk = brief.get('look') if isinstance(brief.get('look'), dict) else {}
    return lk.get('theme') or 'Claude chooses'


def new_deck(brief=None, **fields):
    """A new library record. By default it is made from the current draft brief (the wizard's answers)."""
    brief = read_brief() if brief is None else brief
    basics = brief.get('basics') if isinstance(brief.get('basics'), dict) else {}
    t = now_iso()
    rec = {'id': uuid.uuid4().hex[:12], 'title': str(basics.get('title') or '').strip() or 'Untitled deck', 'file': None,
           'look': look_of(brief), 'quality': quality_of(brief), 'createdAt': t, 'updatedAt': t, 'sessionId': None,
           'brief': brief, 'build': None}
    rec.update(fields)
    return save_deck(rec, touch=False)


def deck_file(rec):
    """The packed deck of a record as a Path, only when it exists inside "4 - Your slides"."""
    f = rec.get('file') if isinstance(rec, dict) else None
    if not isinstance(f, str) or not f or '\x00' in f: return None
    p = ROOT / f
    if not inside(p, SLIDES) or not p.is_file() or p.suffix.lower() not in ('.html', '.htm'): return None
    return p.resolve()


def all_decks():
    out = []
    if DECKS.is_dir():
        for f in DECKS.glob('*.json'):
            rec = load_deck(f.stem)
            if rec: out.append(rec)
    return out


def migrate_decks():
    """Give every packed deck in "4 - Your slides" (not in Older versions) a record, so decks made before the library
    (or packed by hand) show up on the home screen. The old single Claude session belongs to the last finished deck."""
    if not SLIDES.is_dir() or (RUNNER and RUNNER.running): return    # a deck being built gets its own record at the end
    with DECK_LOCK:
        known = {os.path.normcase(str(p)) for p in (deck_file(r) for r in all_decks()) if p}
        for f in sorted(SLIDES.glob('*.htm*')):
            if not f.is_file() or f.suffix.lower() not in ('.html', '.htm') or f.name.startswith(('.', '~$')): continue
            if os.path.normcase(str(f.resolve())) in known: continue
            rel = rel_root(f)
            st = f.stat()
            t = datetime.datetime.fromtimestamp(st.st_mtime).astimezone().isoformat(timespec='seconds')
            sid = RUNNER.session_id if RUNNER and RUNNER.last_deck == rel and not RUNNER.deck_id else None
            rec = new_deck({}, title=f.stem, file=rel, look=None, createdAt=t, updatedAt=t, sessionId=sid, migrated=True)
            log('deck record made for', rel, rec['id'])


def deck_view(rec):
    """A record as the page sees it: the stored fields plus where it stands right now."""
    f = deck_file(rec)
    busy = bool(RUNNER and RUNNER.running and RUNNER.deck_id == rec['id'])
    status = 'building' if busy else 'ready' if f else 'missing' if rec.get('file') else 'draft'
    v = {k: rec.get(k) for k in DECK_FIELDS}
    v.update(status=status, exists=bool(f), migrated=bool(rec.get('migrated')),
             mtime=int(f.stat().st_mtime) if f else None,
             url=f"/deck/{rec['id']}/" if f else None,
             thumb=f"/api/decks/{rec['id']}/thumb.png?v={int(f.stat().st_mtime)}" if f else None)
    return v


def list_decks():
    migrate_decks()
    decks = [deck_view(r) for r in all_decks()]
    decks.sort(key=lambda d: str(d.get('updatedAt') or ''), reverse=True)
    return decks


def find_build(rec, packed):
    """The build folder (.aura/temp/build/<slug>/index.html) a packed deck came from, or None."""
    cands = []
    if rec.get('build'): cands.append(BUILDS / rec['build'] / 'index.html')
    if BUILDS.is_dir():
        stem = packed.stem.lower()
        slug = re.sub(r'[^a-z0-9]+', '-', stem).strip('-')
        for d in BUILDS.iterdir():
            f = d / 'index.html'
            if not f.is_file(): continue
            if d.name.lower() in (stem, slug): cands.append(f); continue
            try:
                head = f.read_text(encoding='utf-8', errors='replace')[:20000]
            except OSError:
                continue
            m = re.search(r'<title[^>]*>(.*?)</title>', head, re.S | re.I)
            if m and htmllib.unescape(m.group(1)).strip().lower() == stem: cands.append(f)
    return next((c for c in cands if c.is_file() and inside(c, BUILDS)), None)


# ---------------------------------------------------------------- direct text tweaks (data-edit)
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class _EndFinder(HTMLParser):
    """Finds where the element that starts at offset 0 ends (the offset of its closing tag)."""
    class Found(Exception): pass

    def __init__(self, tag):
        super().__init__(convert_charrefs=False)
        self.tag, self.depth, self.end = tag, 0, None

    def handle_starttag(self, tag, attrs):
        if tag == self.tag: self.depth += 1

    def handle_endtag(self, tag):
        if tag == self.tag:
            self.depth -= 1
            if self.depth == 0:
                self.end = self.getpos(); raise self.Found()


def patch_text(src, edit_id, text):
    """Replace the content of the element with data-edit="edit_id" by plain (escaped) text. Returns the new HTML, or
    None when the element is not there."""
    m = re.search(r'<([A-Za-z][A-Za-z0-9-]*)\b[^>]*?\sdata-edit\s*=\s*(["\']?)' + re.escape(edit_id) + r'\2(?=[\s/>])[^>]*>', src)
    if not m: return None
    tag = m.group(1).lower()
    if tag in VOID or m.group(0).endswith('/>'): return None
    p = _EndFinder(tag)
    rest = src[m.start():]
    try:
        p.feed(rest); p.close()
    except _EndFinder.Found:
        pass
    if not p.end: return None
    line, col = p.end
    end = 0
    for _ in range(line - 1): end = rest.index('\n', end) + 1
    end += col
    body = '<br>'.join(htmllib.escape(part, quote=False) for part in text.split('\n'))
    return src[:m.end()] + body + src[m.start() + end:]


def node_exe():
    return shutil.which('node.exe') or shutil.which('node')


def check_rules(packed):
    """Run the hard-rule checker on one deck. Returns (ok, message)."""
    node = node_exe()
    script = ENGINE / 'rules' / 'check_rules.js'
    if not node or not script.is_file(): return False, 'The text-size check could not run (Node.js or the checker is missing).'
    env = child_env(); env['CLAUDE_PROJECT_DIR'] = str(ROOT)
    try:
        r = subprocess.run([node, str(script), str(packed)], cwd=str(ROOT), capture_output=True, timeout=180,
                           stdin=subprocess.DEVNULL, creationflags=NO_WINDOW, env=env)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, f'The text-size check could not run ({e.__class__.__name__}).'
    out = (r.stdout + r.stderr).decode('utf-8', 'replace').strip()
    return r.returncode == 0, out


OVERFLOW_RE = re.compile(r'^\s*ERROR .*(cut off by its box|edge safe zone)', re.M)


def overflow_count(packed):
    """How many texts deck_check sees running off their box or into the slide edge (None if the check cannot run).
    check_rules only measures text size, so a long direct tweak could otherwise spill off the slide unnoticed."""
    node = node_exe()
    script = ENGINE / 'tools' / 'deck_check.js'
    if not node or not script.is_file(): return None
    try:
        r = subprocess.run([node, str(script), str(packed), '--no-shots'], cwd=str(ROOT), capture_output=True, timeout=90,
                           stdin=subprocess.DEVNULL, creationflags=NO_WINDOW, env=child_env())
    except (OSError, subprocess.TimeoutExpired):
        return None
    if r.returncode not in (0, 1): return None
    return len(OVERFLOW_RE.findall((r.stdout + r.stderr).decode('utf-8', 'replace')))


def friendly_rule_reason(out):
    m = re.findall(r'([\d.]+)px\s+"([^"]*)"', out or '')
    if m:
        px, txt = m[0]
        return (f'That text would end up {px} px, and Aura-Slide keeps every text at 26 px or bigger so it can be read '
                f'from the back of the room. Try fewer words, or ask Claude to rework the slide.')
    return 'The change did not pass the slide check, so it was undone. ' + (out.splitlines()[0][:200] if out else '')


TEXT_LOCK = threading.Lock()


def edit_text(deck_id, edit_id, text):
    rec = load_deck(deck_id)
    if not rec: return 404, {'ok': False, 'error': 'no-deck'}
    if not isinstance(edit_id, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,80}', edit_id):
        return 400, {'ok': False, 'error': 'bad-edit-id'}
    if not isinstance(text, str) or len(text) > 4000: return 400, {'ok': False, 'error': 'bad-text'}
    text = text.replace('\r\n', '\n').replace('\r', '\n').strip()
    if RUNNER.running and RUNNER.deck_id == deck_id:
        return 409, {'ok': False, 'error': 'busy', 'reason': 'Claude is working on this deck right now. Try again when it is done.'}
    packed = deck_file(rec)
    if not packed: return 404, {'ok': False, 'error': 'no-file'}
    with TEXT_LOCK:
        targets = [packed]
        build = find_build(rec, packed)
        if build: targets.append(build)
        before, after = {}, {}
        for f in targets:
            raw = f.read_bytes()
            new = patch_text(raw.decode('utf-8'), edit_id, text)
            if new is None:
                if f == packed: return 404, {'ok': False, 'error': 'no-element', 'reason': 'That text could not be found in the deck.'}
                continue                       # an older build without this id: only the packed deck changes
            before[f], after[f] = raw, new.encode('utf-8')
        for f, data in after.items(): write_bytes_atomic(f, data)
        ok, out = check_rules(packed)
        if not ok:
            for f, data in before.items(): write_bytes_atomic(f, data)
            log('text tweak reverted', deck_id, edit_id, out[:300])
            return 200, {'ok': False, 'error': 'rules', 'reason': friendly_rule_reason(out), 'detail': out[:1000]}
        spill = overflow_count(packed)
        if spill:                               # compare with the deck as it was, so an older issue never blocks a tweak
            for f, data in before.items(): write_bytes_atomic(f, data)
            was = overflow_count(packed)
            if was is None or spill > was:
                log('text tweak reverted (overflow)', deck_id, edit_id, spill, was)
                return 200, {'ok': False, 'error': 'rules', 'detail': f'{spill} text(s) off the slide',
                             'reason': 'That text is too long to fit on the slide, so try fewer words'}
            for f, data in after.items(): write_bytes_atomic(f, data)
        update_deck(deck_id)
    return 200, {'ok': True, 'editId': edit_id, 'text': text, 'patched': [rel_root(f) for f in after],
                 'mtime': int(packed.stat().st_mtime)}


# ---------------------------------------------------------------- slide pictures (.aura/temp/thumbs/<id>/)
SHOT_LOCKS, SHOT_LOCKS_GUARD = {}, threading.Lock()


def render_slides(rec):
    """Per-slide PNGs of a deck, rendered with engine/tools/shoot_slides.js and cached until the deck file changes.
    Returns (list of {n, file, title}, error)."""
    packed = deck_file(rec)
    if not packed: return [], 'no-file'
    out = THUMBS / rec['id']
    st = packed.stat()
    stamp = {'file': rec.get('file'), 'mtime': st.st_mtime, 'size': st.st_size}
    with SHOT_LOCKS_GUARD:
        lock = SHOT_LOCKS.setdefault(rec['id'], threading.Lock())
    with lock:
        try:
            old = json.loads((out / 'stamp.json').read_text(encoding='utf-8'))
        except (OSError, ValueError):
            old = {}
        if {k: old.get(k) for k in stamp} == stamp:
            if old.get('error') and time.time() - old.get('at', 0) < 60: return [], old['error']
            if not old.get('error'):
                return old.get('slides') or [], None
        node, script = node_exe(), ENGINE / 'tools' / 'shoot_slides.js'
        err, slides = None, []
        if not node or not script.is_file():
            err = 'node-missing'
        else:
            try:
                r = subprocess.run([node, str(script), str(packed), str(out)], cwd=str(ROOT), capture_output=True,
                                   timeout=240, stdin=subprocess.DEVNULL, creationflags=NO_WINDOW, env=child_env())
                if r.returncode != 0:
                    err = (r.stdout + r.stderr).decode('utf-8', 'replace').strip()[:300] or f'exit {r.returncode}'
            except (OSError, subprocess.TimeoutExpired) as e:
                err = e.__class__.__name__
        if not err:
            try:
                info = json.loads((out / 'slides.json').read_text(encoding='utf-8'))
                for i, s in enumerate(info.get('slides') or [], 1):
                    if s.get('image') and (out / s['image']).is_file():
                        slides.append({'n': i, 'file': s['image'], 'title': str(s.get('title') or '').strip()})
            except (OSError, ValueError):
                slides = [{'n': i, 'file': f.name, 'title': ''} for i, f in enumerate(sorted(out.glob('slide-*.png')), 1)]
            if not slides: err = 'no-slides'
        if err: log('slide pictures failed', rec['id'], err)
        out.mkdir(parents=True, exist_ok=True)
        write_atomic(out / 'stamp.json', json.dumps(dict(stamp, slides=slides, error=err, at=time.time()), indent=2))
        return slides, err


# ---------------------------------------------------------------- Claude
def claude_cmd():
    """The command prefix that runs Claude (or the fake used for testing), or None if Claude is not installed."""
    fake = os.environ.get('AURA_FAKE_CLAUDE')
    if fake:
        return [sys.executable, fake] if Path(fake).is_file() else None
    home, appdata = os.environ.get('USERPROFILE', ''), os.environ.get('APPDATA', '')
    for c in (home and Path(home) / '.local' / 'bin' / 'claude.exe', shutil.which('claude.exe'),
              appdata and Path(appdata) / 'npm' / 'node_modules' / '@anthropic-ai' / 'claude-code' / 'bin' / 'claude.exe',
              shutil.which('claude.cmd')):
        if c and Path(c).is_file():
            return [str(c)]
    return None


def make_job():
    """A Windows job object that kills Claude's whole process tree if this server ever dies, so no orphan keeps
    editing the slides in the background. None where unavailable (then only Stop/taskkill ends a run)."""
    if os.name != 'nt': return None
    try:
        import ctypes
        from ctypes import wintypes
        k32 = ctypes.WinDLL('kernel32', use_last_error=True)

        class Basic(ctypes.Structure):
            _fields_ = [('PerProcessUserTimeLimit', ctypes.c_int64), ('PerJobUserTimeLimit', ctypes.c_int64),
                        ('LimitFlags', wintypes.DWORD), ('MinimumWorkingSetSize', ctypes.c_size_t),
                        ('MaximumWorkingSetSize', ctypes.c_size_t), ('ActiveProcessLimit', wintypes.DWORD),
                        ('Affinity', ctypes.c_size_t), ('PriorityClass', wintypes.DWORD), ('SchedulingClass', wintypes.DWORD)]

        class Extended(ctypes.Structure):
            _fields_ = [('Basic', Basic), ('Io', ctypes.c_uint64 * 6), ('ProcessMemoryLimit', ctypes.c_size_t),
                        ('JobMemoryLimit', ctypes.c_size_t), ('PeakProcessMemoryUsed', ctypes.c_size_t),
                        ('PeakJobMemoryUsed', ctypes.c_size_t)]
        k32.CreateJobObjectW.restype = wintypes.HANDLE
        k32.CreateJobObjectW.argtypes = (ctypes.c_void_p, wintypes.LPCWSTR)
        k32.SetInformationJobObject.argtypes = (wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD)
        k32.AssignProcessToJobObject.argtypes = (wintypes.HANDLE, wintypes.HANDLE)
        job = k32.CreateJobObjectW(None, None)
        info = Extended()
        info.Basic.LimitFlags = 0x2000                      # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not job or not k32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):
            return None
        return lambda proc: bool(k32.AssignProcessToJobObject(job, int(proc._handle)))
    except Exception as e:
        log('job object unavailable', e)
        return None


def child_env():
    env = dict(os.environ)
    for k in ('CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'ELECTRON_RUN_AS_NODE'):
        env.pop(k, None)
    env['PYTHONIOENCODING'] = 'utf-8'
    return env


def short_path(p):
    try:
        q = Path(p)
        if not q.is_absolute(): q = ROOT / q
        return str(q.resolve().relative_to(ROOT.resolve())).replace('\\', '/')
    except Exception:
        return re.split(r'[\\/]', str(p))[-1]


def tool_detail(name, inp):
    inp = inp if isinstance(inp, dict) else {}
    for k in ('file_path', 'notebook_path', 'path'):
        if isinstance(inp.get(k), str) and inp[k]: return short_path(inp[k])
    if name == 'Bash' and isinstance(inp.get('command'), str):
        head = (inp['command'].strip().splitlines() or [''])[0]
        return head[:80] + ('...' if len(head) > 80 else '')
    if name == 'TodoWrite': return 'updating the plan'
    for k in ('skill', 'pattern', 'description', 'url', 'query'):
        if isinstance(inp.get(k), str) and inp[k]: return inp[k][:80]
    return ''


def result_text(content):
    if isinstance(content, str): return content
    if isinstance(content, list):
        return '\n'.join(c.get('text', '') for c in content if isinstance(c, dict) and c.get('type') == 'text')
    return ''


class Run:
    """One Claude process and the context needed to normalise its output."""
    def __init__(self, proc, deck_id=None):
        self.proc, self.stopped, self.got_result = proc, False, False
        self.deck_id, self.build, self.deck_done = deck_id, None, None
        self.noise, self.err, self.tools = deque(maxlen=30), deque(maxlen=30), {}
        self.limited = False
        self.finished = threading.Event()


class Runner:
    """Starts Claude, turns its stream-json into simple events and keeps them on disk (.aura/temp)."""
    STATE, EVENTS = 'claude-state.json', 'claude-events.jsonl'

    def __init__(self):
        self.lock = threading.RLock()
        self.run, self.events = None, []
        self.session_id = self.last_deck = self.deck_id = None
        self.waiting, self.run_start = False, 0
        self.auth = {'value': None, 'plan': None, 'at': 0.0}
        self.auth_lock = threading.Lock()
        self.assign_job = make_job()
        self.load()

    @property
    def running(self):
        return self.run is not None

    # ---- persistence
    def load(self):
        try:
            st = json.loads((TEMP / self.STATE).read_text(encoding='utf-8'))
        except Exception:
            st = {}
        self.session_id, self.last_deck, self.deck_id = st.get('sessionId'), st.get('lastDeck'), st.get('deckId')
        self.waiting, self.run_start = bool(st.get('waiting')), int(st.get('runStart') or 0)
        try:
            for ln in (TEMP / self.EVENTS).read_text(encoding='utf-8').splitlines():
                try:
                    ev = json.loads(ln)
                except ValueError:
                    continue
                if isinstance(ev, dict):
                    ev['i'] = len(self.events); self.events.append(ev)
        except OSError:
            pass
        if st.get('running'):   # the server stopped while Claude was working
            self.add('error', 'Aura-Slide was closed while Claude was working. Send a message to carry on, or start again.',
                     code='interrupted')
            self.save()

    def save(self):
        try:
            write_atomic(TEMP / self.STATE, json.dumps({'sessionId': self.session_id, 'lastDeck': self.last_deck,
                                                        'deckId': self.deck_id,
                                                        'waiting': self.waiting, 'running': self.running,
                                                        'runStart': self.run_start}, indent=2))
        except OSError as e:
            log('save state failed', e)

    def add(self, kind, text='', **extra):
        ev = {'i': len(self.events), 't': round(time.time(), 3), 'kind': kind, 'text': text}
        if self.deck_id: ev['deck'] = self.deck_id
        ev.update({k: v for k, v in extra.items() if v is not None})
        self.events.append(ev)
        try:
            TEMP.mkdir(parents=True, exist_ok=True)
            with open(TEMP / self.EVENTS, 'a', encoding='utf-8') as f:
                f.write(json.dumps(ev, ensure_ascii=False) + '\n')
        except OSError as e:
            log('save event failed', e)
        return ev

    # ---- status and sign-in
    def signed_in(self, refresh=False):
        with self.auth_lock:
            fresh = time.time() - self.auth['at'] < 3
            if self.auth['at'] and (not refresh or fresh):
                return self.auth['value']
            cmd, val, plan = claude_cmd(), None, None
            if cmd:
                try:
                    r = subprocess.run(cmd + ['auth', 'status'], cwd=str(ROOT), capture_output=True, timeout=25,
                                       stdin=subprocess.DEVNULL, creationflags=NO_WINDOW, env=child_env())
                    out = r.stdout.decode('utf-8', 'replace')
                    m = re.search(r'\{.*\}', out, re.S)
                    if m:
                        info = json.loads(m.group(0))
                        val = bool(info.get('loggedIn'))
                        plan = info.get('subscriptionType') if isinstance(info.get('subscriptionType'), str) else None
                    elif AUTH_RE.search(out + r.stderr.decode('utf-8', 'replace')): val = False
                except Exception as e:
                    log('auth status failed', e)
            self.auth = {'value': val, 'plan': plan, 'at': time.time()}
            return val

    def plan(self, refresh=False):
        """The Claude plan (subscriptionType), asked again when unknown and the last answer was not a clean sign-in."""
        if self.auth.get('plan') is None and self.auth.get('value') is not True: refresh = True
        self.signed_in(refresh)
        return self.auth.get('plan')

    def status(self, refresh=False):
        signed = self.signed_in(refresh)
        with self.lock:
            return {'cli': claude_cmd() is not None, 'signedIn': signed, 'running': self.running, 'waiting': self.waiting,
                    'sessionId': self.session_id, 'lastDeck': self.last_deck, 'eventCount': len(self.events),
                    'runStart': self.run_start, 'deckId': self.deck_id, 'subscriptionType': self.auth.get('plan')}

    def events_since(self, since):
        with self.lock:
            reset = since > len(self.events)
            return {'events': self.events[0 if reset else since:], 'next': len(self.events), 'running': self.running,
                    'waiting': self.waiting, 'sessionId': self.session_id, 'lastDeck': self.last_deck,
                    'runStart': self.run_start, 'deckId': self.deck_id, **({'reset': True} if reset else {})}

    # ---- runs
    def launch(self, message, resume=False, user_text=None, deck_id=None, slide=None):
        """Start Claude. A new build (resume=False) belongs to deck_id; a reply resumes deck_id's own session (or the
        current session when no deck is given). The quality flags come from that deck's record."""
        with self.lock:
            if self.run: return 409, {'ok': False, 'error': 'busy'}
            cmd = claude_cmd()
            if not cmd: return 503, {'ok': False, 'error': 'cli-missing'}
            rec = load_deck(deck_id) if deck_id else None
            if deck_id and not rec: return 404, {'ok': False, 'error': 'no-deck'}
            session = None
            if resume:
                session = (rec.get('sessionId') if rec else None) if deck_id else self.session_id
                if not session: return 409, {'ok': False, 'error': 'no-session'}
                if not deck_id and self.deck_id:
                    rec = load_deck(self.deck_id)
                    if rec and rec.get('sessionId') != session: rec = None
            quality = rec.get('quality') if rec else quality_of(read_brief())
            args = cmd + ['-p', '--settings', '.claude/settings.json', '--output-format', 'stream-json', '--verbose',
                          '--permission-mode', 'acceptEdits', '--append-system-prompt', WEB_PROMPT] + quality_flags(quality)
            if resume: args += ['--resume', session]
            try:
                proc = subprocess.Popen(args, cwd=str(ROOT), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, creationflags=NO_WINDOW, env=child_env())
            except OSError as e:
                log('start failed', e)
                return 500, {'ok': False, 'error': 'start-failed'}
            if self.assign_job and not self.assign_job(proc):
                log('could not add Claude to the job object')
            self.deck_id = rec['id'] if rec else None
            if resume:
                self.session_id = session
                self.add('user', user_text or message, slide=slide)
            else:
                self.run_start = len(self.events)
                self.last_deck = None
                self.add('status', 'Claude is getting ready', code='start')
            self.waiting = False
            run = self.run = Run(proc, self.deck_id)
            self.save()
        threading.Thread(target=self._feed, args=(proc, message), daemon=True).start()
        threading.Thread(target=self._drain_err, args=(run,), daemon=True).start()
        threading.Thread(target=self._pump, args=(run,), daemon=True).start()
        return 200, {'ok': True, 'running': True, 'sessionId': self.session_id, 'deckId': self.deck_id,
                     'quality': norm_quality(quality)}

    @staticmethod
    def _feed(proc, message):
        # the prompt goes through stdin only, never on a command line
        try:
            proc.stdin.write(message.encode('utf-8')); proc.stdin.close()
        except OSError:
            pass

    @staticmethod
    def _drain_err(run):
        for raw in iter(run.proc.stderr.readline, b''):
            s = raw.decode('utf-8', 'replace').strip()
            if s: run.err.append(s[:500])

    def _pump(self, run):
        try:
            for raw in iter(run.proc.stdout.readline, b''):
                try:
                    self._line(run, raw.decode('utf-8', 'replace'))
                except Exception as e:
                    log('bad stream line', e)
            run.proc.wait()
        finally:
            self._finish(run)

    def _line(self, run, s):
        s = s.strip()
        if not s: return
        try:
            m = json.loads(s)
        except ValueError:
            run.noise.append(s[:500]); return
        if not isinstance(m, dict): return
        t = m.get('type')
        with self.lock:
            if run.stopped: return
            if t == 'system':
                if m.get('subtype') == 'init' and m.get('session_id'):
                    self.session_id = m['session_id']; self.save()
                    if run.deck_id: update_deck(run.deck_id, sessionId=self.session_id)
            elif t == 'assistant':
                content = (m.get('message') or {}).get('content') or []
                for c in content if isinstance(content, list) else []:
                    if not isinstance(c, dict): continue
                    if c.get('type') == 'text' and (c.get('text') or '').strip():
                        self._deck_from(c['text'])
                        self.add('say', c['text'])
                    elif c.get('type') == 'tool_use':
                        name = c.get('name') or 'Tool'
                        run.tools[c.get('id')] = name
                        bm = BUILD_RE.search(json.dumps(c.get('input') or {}, ensure_ascii=False).replace('\\\\', '/').replace('\\', '/'))
                        if bm: run.build = bm.group(1)
                        d = tool_detail(name, c.get('input'))
                        self.add('tool', f'{name} {d}'.strip(), tool=name, detail=d)
            elif t == 'user':
                content = (m.get('message') or {}).get('content') or []
                for c in content if isinstance(content, list) else []:
                    if isinstance(c, dict) and c.get('type') == 'tool_result' and c.get('is_error'):
                        txt = result_text(c.get('content')).strip()
                        self.add('tool-error', txt[:400] or 'A step did not work', tool=run.tools.get(c.get('tool_use_id')))
            elif t == 'rate_limit_event':
                info = m.get('rate_limit_info') or {}
                save_usage(info)
                status = str(info.get('status') or '')
                if status and not status.startswith('allowed'):
                    run.limited = True
                    self.add('limit', limit_text(info.get('resetsAt')), code=status, resetsAt=info.get('resetsAt'))
            elif t == 'result':
                run.got_result = True
                if m.get('session_id'): self.session_id = m['session_id']
                text = m.get('result') if isinstance(m.get('result'), str) else ''
                err = bool(m.get('is_error')) or str(m.get('subtype') or '').startswith('error')
                self._deck_from(text)
                if err and AUTH_RE.search(text):
                    self.auth = {'value': False, 'plan': None, 'at': time.time()}
                    self.add('error', 'Claude needs you to sign in first.', code='auth', detail=text[:300])
                elif err and (run.limited or LIMIT_RE.search(text)):
                    if not run.limited: self.add('limit', limit_text(None), code='limit', detail=text[:300])
                    self.add('done', text[:2000], ok=False, code='limit')
                else:
                    self.waiting = (not err) and '[[aura:ask]]' in text
                    self.add('done', text[:4000], ok=not err)
                self.save()
                self._deck_record(run)

    def _deck_from(self, text):
        hits = DONE_RE.findall(text or '')
        if hits:
            self.last_deck = hits[-1].replace('\\', '/')
            if self.run: self.run.deck_done = self.last_deck

    def _deck_record(self, run):
        """After a run: the deck record learns its session, finished file and build folder."""
        if not run.deck_id: return
        fields = {'sessionId': self.session_id} if self.session_id else {}
        if run.deck_done:
            p = Path(run.deck_done)
            p = p if p.is_absolute() else ROOT / p
            if inside(p, SLIDES): fields['file'] = rel_root(p)
        if run.build: fields['build'] = run.build
        rec = update_deck(run.deck_id, **fields)
        if rec and rec.get('file'):     # a migrated stand-in for the same file is no longer needed
            for other in all_decks():
                if other['id'] != rec['id'] and other.get('migrated') and other.get('file') == rec['file']:
                    try:
                        deck_json(other['id']).unlink()
                    except OSError:
                        pass

    def _finish(self, run):
        run.proc.wait()
        time.sleep(0.05)   # let stderr settle
        global last_hit
        with self.lock:
            if run.stopped:
                self.add('done', 'Stopped', ok=False, code='stopped')
            elif not run.got_result:
                tail = '\n'.join(list(run.noise)[-8:] + list(run.err)[-8:])
                if AUTH_RE.search(tail):
                    self.auth = {'value': False, 'plan': None, 'at': time.time()}
                    self.add('error', 'Claude needs you to sign in first.', code='auth', detail=tail[-400:])
                elif LIMIT_RE.search(tail) or run.limited:
                    self.add('limit', limit_text(None), code='limit', detail=tail[-400:])
                else:
                    self.add('error', 'Claude stopped unexpectedly. You can try again.', code='failed',
                             detail=(tail[-400:] or f'exit code {run.proc.returncode}'))
            if self.run is run: self.run = None
            self.save()
            last_hit = time.time()
        run.finished.set()

    def stop(self):
        with self.lock:
            run = self.run
            if not run: return 200, {'ok': True, 'running': False}
            run.stopped = True
            self.waiting = False
        try:
            subprocess.run(['taskkill', '/T', '/F', '/PID', str(run.proc.pid)], capture_output=True, timeout=15,
                           creationflags=NO_WINDOW)
        except Exception as e:
            log('taskkill failed', e)
        try:
            run.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            run.proc.kill()
        run.finished.wait(8)
        return 200, {'ok': True, 'running': self.running}

    def login(self):
        cmd = claude_cmd()
        if not cmd: return 503, {'ok': False, 'error': 'cli-missing'}
        with self.auth_lock: self.auth = {'value': None, 'plan': None, 'at': 0.0}
        if NO_LAUNCH: return 200, {'ok': True, 'launched': False}
        line = subprocess.list2cmdline(cmd + ['auth', 'login'])
        script = ('title Sign in to Claude & echo Follow the steps in your browser to sign in to Claude. & echo. & '
                  + line + ' & echo. & echo All done. You can close this window now. & pause >nul')
        subprocess.Popen(f'cmd.exe /d /c "{script}"', cwd=str(ROOT), creationflags=NEW_CONSOLE, env=child_env())
        return 200, {'ok': True, 'launched': True}


def limit_text(resets_at):
    try:
        when = datetime.datetime.fromtimestamp(int(resets_at)).strftime('%I:%M %p').lstrip('0')
        return f'Claude has reached its usage limit for now. It resets at {when}.'
    except (TypeError, ValueError, OSError, OverflowError):
        return 'Claude has reached its usage limit for now. Please try again a bit later.'


# ---------------------------------------------------------------- usage (latest rate_limit_event)
USAGE = TEMP / 'usage.json'


def save_usage(info):
    if not isinstance(info, dict): return
    windows = info.get('unifiedWindows') if isinstance(info.get('unifiedWindows'), dict) else {}
    five = windows.get('five_hour') if isinstance(windows.get('five_hour'), dict) else {}
    util = five.get('utilization', info.get('utilization'))
    try:
        util = None if util is None else float(util)
    except (TypeError, ValueError):
        util = None
    rec = {'status': info.get('status'), 'utilization': util,
           'resetsAt': info.get('resetsAt') or five.get('resetsAt'),
           'type': info.get('rateLimitType') or ('five_hour' if five else None), 'capturedAt': int(time.time())}
    try:
        write_atomic(USAGE, json.dumps(rec, indent=2))
    except OSError as e:
        log('save usage failed', e)


def read_usage():
    try:
        u = json.loads(USAGE.read_text(encoding='utf-8'))
        return u if isinstance(u, dict) else None
    except (OSError, ValueError):
        return None


# ---------------------------------------------------------------- loading-screen checks and fixes
PY_MODULES = {'pillow': 'PIL', 'python-pptx': 'pptx', 'imageio-ffmpeg': 'imageio_ffmpeg', 'python-docx': 'docx',
              'beautifulsoup4': 'bs4', 'pyyaml': 'yaml'}
PREMIUM_PLANS = ('pro', 'max', 'team', 'enterprise')
LATEST = {'tag': None, 'at': 0.0, 'error': None}
LATEST_LOCK = threading.Lock()
LATEST_FILE = TEMP / 'latest-release.json'


def find_edge():
    env = os.environ.get
    cands = [env('ProgramFiles(x86)') and Path(env('ProgramFiles(x86)')) / 'Microsoft' / 'Edge' / 'Application' / 'msedge.exe',
             env('ProgramFiles') and Path(env('ProgramFiles')) / 'Microsoft' / 'Edge' / 'Application' / 'msedge.exe',
             env('LOCALAPPDATA') and Path(env('LOCALAPPDATA')) / 'Microsoft' / 'Edge' / 'Application' / 'msedge.exe']
    return next((c for c in cands if c and c.is_file()), None)


def version_tuple(v):
    nums = re.findall(r'\d+', str(v or ''))
    return tuple(int(n) for n in nums[:4]) if nums else None


def latest_release():
    """The newest GitHub release tag, cached for 6 hours (memory + .aura/temp). Never raises; None when unknown."""
    if os.environ.get('AURA_LATEST_VERSION'): return os.environ['AURA_LATEST_VERSION']
    if os.environ.get('AURA_NO_NETWORK') == '1': return None
    with LATEST_LOCK:
        if not LATEST['at']:
            try:
                LATEST.update(json.loads(LATEST_FILE.read_text(encoding='utf-8')))
            except (OSError, ValueError):
                pass
        if time.time() - LATEST['at'] < 6 * 3600: return LATEST['tag']
        m = re.search(r'github\.com/([^/]+)/([^/#?]+)', str(CFG.get('repoUrl') or ''))
        tag, err = None, None
        if m:
            try:
                r = urllib.request.Request(f'https://api.github.com/repos/{m.group(1)}/{m.group(2).removesuffix(".git")}/releases/latest',
                                           headers={'Accept': 'application/vnd.github+json', 'User-Agent': 'Aura-Slide'})
                with urllib.request.urlopen(r, timeout=4) as resp:
                    tag = json.loads(resp.read().decode('utf-8')).get('tag_name')
            except Exception as e:
                err = e.__class__.__name__
        # a failed check is cached for 30 minutes only, a good one for 6 hours
        LATEST.update(tag=tag or LATEST.get('tag'), error=err, at=time.time() - (0 if tag else 5.5 * 3600))
        try:
            write_atomic(LATEST_FILE, json.dumps(LATEST))
        except OSError:
            pass
        return LATEST['tag']


def _chk(id_, ok, label, detail='', fix=None, blocking=True):
    c = {'id': id_, 'ok': bool(ok), 'label': label, 'detail': detail, 'blocking': blocking}
    if fix and not ok: c['fix'] = fix
    return c


def check_engine():
    need = [FORM / 'index.html', ENGINE / 'form_server.py', ENGINE / 'rules' / 'check_rules.js', ENGINE / 'rules' / 'hard-rules.json',
            ENGINE / 'deck' / 'runtime.js', ENGINE / 'tools' / 'pack_deck.py', ENGINE / 'tools' / 'shoot_slides.js',
            FORM / 'assets' / 'character.mp4']
    missing = [str(p.relative_to(ENGINE)).replace('\\', '/') for p in need if not p.is_file()]
    fonts = len(list(FONTS.glob('*.woff2'))) if FONTS.is_dir() else 0
    if fonts == 0: missing.append('fonts')
    ok = not missing
    return _chk('engine', ok, 'Aura-Slide files are all here' if ok else 'Some Aura-Slide files are missing',
                f'{fonts} fonts' if ok else 'Missing: ' + ', '.join(missing[:5]), 'update')


def check_node():
    node = node_exe()
    if not node: return _chk('node', False, 'Node.js is missing', 'Aura-Slide uses Node.js to check and export slides.', 'update')
    try:
        v = subprocess.run([node, '--version'], capture_output=True, timeout=15, stdin=subprocess.DEVNULL,
                           creationflags=NO_WINDOW).stdout.decode('utf-8', 'replace').strip()
    except (OSError, subprocess.TimeoutExpired):
        v = ''
    t = version_tuple(v) or (0,)
    ok = t[0] >= 22 or (t[0] == 20 and len(t) > 1 and t[1] >= 19)
    return _chk('node', ok, 'Node.js is ready' if ok else 'Node.js needs an update', v or 'not working', 'update')


def check_modules():
    nm = ENGINE / 'node_modules'
    have = {'three': (nm / 'three' / 'build' / 'three.module.js').is_file(),
            'playwright-core': (nm / 'playwright-core' / 'package.json').is_file()}
    missing = [k for k, v in have.items() if not v]
    return _chk('modules', not missing, 'Slide tools are installed' if not missing else 'Slide tools need installing',
                'three, playwright-core' if not missing else 'Missing: ' + ', '.join(missing), 'npm')


def check_edge():
    e = find_edge()
    return _chk('edge', e, 'Microsoft Edge is here' if e else 'Microsoft Edge is missing',
                'used for the app window and slide checks' if e else 'Please install Microsoft Edge from microsoft.com/edge')


def check_python():
    pkgs = [str(p) for p in CFG.get('pythonPackages') or []]
    if not VENV_PY.is_file():
        return _chk('python', False, 'The slide export tools need installing', 'Aura-Slide’s private Python is missing.', 'pip')
    mods = [PY_MODULES.get(p.lower(), p.replace('-', '_')) for p in pkgs]
    code = 'import importlib.util as u, json, sys; print(json.dumps({m: bool(u.find_spec(m)) for m in sys.argv[1:]}))'
    try:
        r = subprocess.run([str(VENV_PY), '-c', code, *mods], capture_output=True, timeout=40, stdin=subprocess.DEVNULL,
                           creationflags=NO_WINDOW)
        found = json.loads(r.stdout.decode('utf-8', 'replace').strip().splitlines()[-1])
    except Exception:
        return _chk('python', False, 'The slide export tools need repairing', 'Aura-Slide’s private Python does not start.', 'pip')
    missing = [p for p, m in zip(pkgs, mods) if not found.get(m)]
    return _chk('python', not missing, 'Export tools are installed' if not missing else 'Some export tools are missing',
                ', '.join(pkgs) if not missing else 'Missing: ' + ', '.join(missing), 'pip')


def check_claude():
    cmd = claude_cmd()
    cli = _chk('claude', cmd, 'Claude is installed' if cmd else 'Claude is not installed',
               '' if cmd else 'Aura-Slide needs the Claude app (Claude Code) to make slides.', 'update')
    if not cmd:
        return [cli, _chk('signin', False, 'Sign in to Claude', 'Install Claude first.', None)]
    signed = RUNNER.signed_in(refresh=True)
    plan = RUNNER.auth.get('plan')
    if signed is None:
        si = _chk('signin', False, 'Could not ask Claude whether you are signed in', 'Try signing in again.', 'signin')
    elif not signed:
        si = _chk('signin', False, 'Sign in to Claude', 'Use the Claude account with your Pro, Max or Team plan.', 'signin')
    elif plan and plan.lower() not in PREMIUM_PLANS:
        si = _chk('signin', False, 'Aura-Slide needs a Claude Pro, Max or Team plan',
                  f'You are signed in with a {plan} plan. Upgrade at claude.ai, or sign in with another account.', 'signin')
    else:
        si = _chk('signin', True, 'Signed in to Claude', f'{plan.capitalize()} plan' if plan else 'signed in')
    si['subscriptionType'] = plan
    return [cli, si]


def check_disk():
    try:
        free = shutil.disk_usage(ROOT.anchor or str(ROOT)).free
    except OSError:
        return _chk('disk', True, 'Free space unknown', '', blocking=False)
    gb = free / 1024 ** 3
    return _chk('disk', gb >= 1, 'Enough free space' if gb >= 1 else 'Your disk is almost full',
                f'{gb:.1f} GB free on {ROOT.anchor or ROOT}' + ('' if gb >= 1 else ' - free up at least 1 GB'), blocking=gb < 0.3)


def check_version():
    mine = CFG.get('version')
    latest = latest_release()
    newer = bool(latest and version_tuple(latest) and version_tuple(mine) and version_tuple(latest) > version_tuple(mine))
    c = _chk('version', not newer, f'A new version is ready ({str(latest).lstrip("v")})' if newer else 'Aura-Slide is up to date',
             f'you have {mine}' + ('' if latest else ' (could not check for updates)'), 'update', blocking=False)
    c.update(version=mine, latest=latest)
    return c


def health():
    forced = {x.strip() for x in (os.environ.get('AURA_HEALTH_FAIL') or '').split(',') if x.strip()}
    jobs = [check_engine, check_node, check_modules, check_edge, check_python, check_claude, check_disk, check_version]
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(jobs)) as ex:
        futures = [ex.submit(j) for j in jobs]
        checks = []
        for j, f in zip(jobs, futures):
            try:
                r = f.result(timeout=60)
            except Exception as e:
                log('health check failed', j.__name__, repr(e))
                r = _chk(j.__name__.removeprefix('check_'), False, 'This check did not finish', str(e)[:200])
            checks.extend(r if isinstance(r, list) else [r])
    fixes = {'engine': 'update', 'node': 'update', 'modules': 'npm', 'python': 'pip', 'claude': 'update', 'signin': 'signin',
             'version': 'update'}
    for c in checks:
        if c['id'] in forced:
            c.update(ok=False, detail='(simulated failure) ' + c.get('detail', ''))
            if fixes.get(c['id']): c['fix'] = fixes[c['id']]
    sig = next((c for c in checks if c['id'] == 'signin'), {})
    ver = next((c for c in checks if c['id'] == 'version'), {})
    return {'ok': all(c['ok'] for c in checks if c.get('blocking', True)), 'checks': checks,
            'version': ver.get('version'), 'latest': ver.get('latest'), 'subscriptionType': sig.get('subscriptionType')}


class Fixer:
    """Runs one long repair at a time (npm install / pip install) in the background, keeping its last output lines."""
    def __init__(self):
        self.lock = threading.Lock()
        self.state = {'running': False, 'name': None, 'ok': None, 'log': [], 'message': '', 'startedAt': None, 'endedAt': None}
        self.proc = None

    def status(self):
        with self.lock:
            return dict(self.state, log=list(self.state['log'][-40:]))

    def _steps(self, name):
        if os.environ.get('AURA_FAKE_FIX') == '1':
            bad = os.environ.get('AURA_FAKE_FIX_FAIL') == name
            code = (f'import time\nfor i in range(3):\n    print("fake {name} step", i + 1, flush=True); time.sleep(0.3)\n'
                    + ('raise SystemExit(1)\n' if bad else 'print("done")\n'))
            return [([sys.executable, '-c', code], ENGINE)]
        if name == 'npm':
            npm = shutil.which('npm.cmd') or shutil.which('npm')
            if not npm: raise RuntimeError('Node.js (npm) is missing. Use "Update Aura-Slide" instead.')
            return [([npm, 'install', '--no-audit', '--no-fund', '--loglevel=error'], ENGINE)]
        if name == 'pip':
            steps = []
            if not VENV_PY.is_file():
                base = getattr(sys, '_base_executable', None) or sys.executable
                if Path(base).name.lower() == 'pythonw.exe': base = str(Path(base).with_name('python.exe'))
                steps.append(([base, '-m', 'venv', str(AURA / 'venv')], AURA))
            pkgs = [str(p) for p in CFG.get('pythonPackages') or []]
            steps.append(([str(VENV_PY), '-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade', *pkgs], AURA))
            return steps
        raise RuntimeError('unknown fix')

    def start(self, name):
        with self.lock:
            if self.state['running']: return 409, {'ok': False, 'error': 'busy', 'name': self.state['name']}
            try:
                steps = self._steps(name)
            except RuntimeError as e:
                return 503, {'ok': False, 'error': 'cannot-fix', 'message': str(e)}
            self.state = {'running': True, 'name': name, 'ok': None, 'log': [], 'message': '', 'startedAt': int(time.time()),
                          'endedAt': None}
        threading.Thread(target=self._work, args=(name, steps), daemon=True).start()
        return 200, {'ok': True, 'started': True, 'name': name}

    def _work(self, name, steps):
        ok, msg = True, ''
        for cmd, cwd in steps:
            try:
                p = self.proc = subprocess.Popen(cmd, cwd=str(cwd), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                                 stdin=subprocess.DEVNULL, creationflags=NO_WINDOW, env=child_env())
                if RUNNER and RUNNER.assign_job: RUNNER.assign_job(p)
                for raw in iter(p.stdout.readline, b''):
                    s = raw.decode('utf-8', 'replace').rstrip()
                    if s:
                        with self.lock: self.state['log'].append(s[:300]); del self.state['log'][:-200]
                p.wait()
                if p.returncode != 0:
                    ok, msg = False, f'The repair did not finish (code {p.returncode}).'
                    break
            except OSError as e:
                ok, msg = False, f'The repair could not start ({e.__class__.__name__}).'
                break
        with self.lock:
            self.state.update(running=False, ok=ok, endedAt=int(time.time()),
                              message=msg or ('All fixed.' if ok else 'Something went wrong.'))
        global last_hit
        last_hit = time.time()
        log('fix', name, 'ok' if ok else 'failed', msg)


def fix_update():
    exe = AURA / 'AuraSlide.exe'
    if not exe.is_file():
        return 404, {'ok': False, 'error': 'launcher-missing',
                     'message': 'The Aura-Slide updater is not installed here. Download Aura-Slide again from the link you got.'}
    if NO_LAUNCH: return 200, {'ok': True, 'launched': False}
    # detached and outside the job object, so it keeps going when it restarts this server
    flags = getattr(subprocess, 'DETACHED_PROCESS', 0) | getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
    try:
        subprocess.Popen([str(exe), '--update'], cwd=str(AURA), close_fds=True,
                         creationflags=flags | getattr(subprocess, 'CREATE_BREAKAWAY_FROM_JOB', 0))
    except OSError:                  # this server runs in a job that forbids breakaway
        subprocess.Popen([str(exe), '--update'], cwd=str(AURA), close_fds=True, creationflags=flags)
    return 200, {'ok': True, 'launched': True}


FIXER = Fixer()
RUNNER = None
SESSION_UPLOADS = set()


def launch(target):
    """Open a file or folder with its default app (browser for .html, Explorer for folders)."""
    if NO_LAUNCH: return
    if Path(target).is_dir():
        subprocess.Popen(['explorer.exe', str(target)])
    else:
        os.startfile(str(target))


def find_vscode():
    env = os.environ.get
    cands = [env('LOCALAPPDATA') and Path(env('LOCALAPPDATA')) / 'Programs' / 'Microsoft VS Code' / 'Code.exe',
             env('ProgramFiles') and Path(env('ProgramFiles')) / 'Microsoft VS Code' / 'Code.exe',
             env('ProgramFiles(x86)') and Path(env('ProgramFiles(x86)')) / 'Microsoft VS Code' / 'Code.exe']
    return next((c for c in cands if c and c.is_file()), None)


# ---------------------------------------------------------------- HTTP
class H(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'AuraSlide/2'
    sys_version = ''

    def log_message(self, *a): pass

    def origins(self):
        port = self.server.server_address[1]
        return (f'127.0.0.1:{port}', f'localhost:{port}')

    def send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype); self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for k, v in (extra or {}).items(): self.send_header(k, v)
        if self.close_connection: self.send_header('Connection', 'close')
        self.send_header('Content-Length', str(len(body))); self.end_headers()
        if self.command != 'HEAD': self.wfile.write(body)

    def guard(self):
        """DNS-rebinding and cross-site protection. Returns True when the request may go on."""
        if (self.headers.get('Host') or '').lower() not in self.origins():
            self.close_connection = True
            self.send(403, {'error': 'forbidden'}); return False
        if self.command in ('POST', 'PATCH', 'PUT', 'DELETE'):
            origin = self.headers.get('Origin')
            if origin is not None and origin.lower() not in tuple('http://' + o for o in self.origins()):
                self.close_connection = True
                self.send(403, {'error': 'forbidden'}); return False
        return True

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionError, TimeoutError):
            self.close_connection = True

    def do_HEAD(self): self.do_GET()

    def do_GET(self):
        global last_hit; last_hit = time.time()
        if not self.guard(): return
        try:
            u = urlsplit(self.path)
            q = parse_qs(u.query)
            if u.path.startswith('/api/'): return self.api_get(u.path, q)
            if u.path == '/deck' or u.path.startswith('/deck/'): return self.deck_get(u.path)
            f = static_path(self.path)
            if not f: return self.send(404, {'error': 'not found'})
            self.send_file(f)
        except (ConnectionError, TimeoutError):
            self.close_connection = True
        except Exception as e:
            log('GET error', self.path, repr(e))
            self.send(500, {'error': 'server error'})

    def api_get(self, path, q):
        if path == '/api/ping':
            return self.send(200, {'ok': True, 'app': 'aura-slide', 'api': API_VERSION, 'version': CFG.get('version'),
                                   'running': RUNNER.running})
        if path == '/api/files': return self.send(200, list_files())
        if path == '/api/brief':
            f = BRIEF / 'brief.json'
            try:
                return self.send(200, json.loads(f.read_text(encoding='utf-8')) if f.exists() else {})
            except ValueError:
                return self.send(200, {})
        if path == '/api/claude/status':
            return self.send(200, RUNNER.status(q.get('refresh', ['0'])[0] not in ('0', '')))
        if path == '/api/claude/events':
            try: since = max(0, int(q.get('since', ['0'])[0]))
            except ValueError: since = 0
            return self.send(200, RUNNER.events_since(since))
        if path == '/api/health': return self.send(200, health())
        if path == '/api/fix/status': return self.send(200, FIXER.status())
        if path == '/api/usage':
            return self.send(200, {'ok': True, 'usage': read_usage(), 'subscriptionType': RUNNER.plan()})
        if path == '/api/decks': return self.send(200, {'ok': True, 'decks': list_decks()})
        m = DECK_ROUTE.match(path)
        if m:
            rec = load_deck(m.group(1))
            if not rec: return self.send(404, {'ok': False, 'error': 'no-deck'})
            sub = m.group(2) or ''
            if sub == '': return self.send(200, {'ok': True, 'deck': deck_view(rec)})
            if sub == 'thumb.png' or sub.startswith('slides'):
                if not deck_file(rec): return self.send(404, {'ok': False, 'error': 'no-file'})
                slides, err = render_slides(rec)
                if sub == 'slides':
                    if err and not slides: return self.send(200, {'ok': False, 'error': 'render-failed', 'detail': err, 'slides': []})
                    v = int(deck_file(rec).stat().st_mtime)
                    return self.send(200, {'ok': True, 'count': len(slides), 'slides': [
                        {'n': x['n'], 'title': x['title'], 'url': f"/api/decks/{rec['id']}/slides/{x['n']}.png?v={v}"} for x in slides]})
                n = 1 if sub == 'thumb.png' else int(m.group(3) or 0)
                hit = next((x for x in slides if x['n'] == n), None)
                f = THUMBS / rec['id'] / hit['file'] if hit else None
                if not f or not f.is_file() or not inside(f, THUMBS / rec['id']):
                    return self.send(404, {'ok': False, 'error': 'no-picture', 'detail': err})
                return self.send_file(f, cache='no-cache')
            return self.send(404, {'error': 'not found'})
        self.send(404, {'error': 'not found'})

    def deck_get(self, path):
        """/deck/<id>/ serves that deck's packed HTML read-only (for preview iframes), /deck/<id>/<path> its relative files."""
        m = re.fullmatch(r'/deck/([A-Za-z0-9_-]{1,64})(/.*)?', path)
        rec = load_deck(m.group(1)) if m else None
        packed = deck_file(rec) if rec else None
        if not packed: return self.send(404, {'error': 'not found'})
        rest = unquote(m.group(2) or '')
        if rest == '':
            return self.send(301, b'', 'text/plain', extra={'Location': f'/deck/{rec["id"]}/'})
        if rest in ('/', '/index.html'): return self.send_file(packed, cache='no-cache')
        if '\x00' in rest or '\\' in rest or ':' in rest: return self.send(404, {'error': 'not found'})
        parts = rest.lstrip('/').split('/')
        if any(seg in ('', '.', '..') or seg.startswith('.') for seg in parts): return self.send(404, {'error': 'not found'})
        ext = Path(parts[-1]).suffix.lower()
        if ext not in MIME or ext == '.html': return self.send(404, {'error': 'not found'})
        f = packed.parent.joinpath(*parts)
        if not inside(f, SLIDES) or not f.is_file(): return self.send(404, {'error': 'not found'})
        return self.send_file(f)

    def send_file(self, f, cache=None):
        size = f.stat().st_size
        mtime = f.stat().st_mtime
        ext = f.suffix.lower()
        ctype = MIME.get(ext, 'application/octet-stream')
        media = ext in ('.mp4', '.webm', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.woff2', '.woff', '.ttf', '.otf',
                        '.mp3', '.ogg', '.wav', '.glb', '.ico')
        ims = self.headers.get('If-Modified-Since')
        if ims and not self.headers.get('Range'):
            try:
                if int(mtime) <= parsedate_to_datetime(ims).timestamp():
                    self.send_response(304); self.send_header('Content-Length', '0'); self.end_headers(); return
            except (TypeError, ValueError):
                pass
        a, z, partial = 0, size - 1, False
        rng = self.headers.get('Range')
        if rng:
            m = re.fullmatch(r'\s*bytes=(\d*)-(\d*)\s*', rng)
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    a = int(m.group(1)); z = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
                else:
                    n = int(m.group(2)); a = max(0, size - n); z = size - 1
                if a >= size or a > z or (not m.group(1) and int(m.group(2)) == 0):
                    return self.send(416, {'error': 'range not satisfiable'}, extra={'Content-Range': f'bytes */{size}'})
                partial = True
        self.send_response(206 if partial else 200)
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        if partial: self.send_header('Content-Range', f'bytes {a}-{z}/{size}')
        self.send_header('Content-Length', str(z - a + 1))
        self.send_header('Last-Modified', formatdate(mtime, usegmt=True))
        self.send_header('Cache-Control', cache or ('max-age=3600' if media else 'no-cache'))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        if self.command == 'HEAD': return
        with open(f, 'rb') as fh:
            fh.seek(a)
            left = z - a + 1
            while left > 0:
                buf = fh.read(min(256 * 1024, left))
                if not buf: break
                self.wfile.write(buf); left -= len(buf)

    def read_json(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_JSON:
            self.close_connection = True
            raise ValueError('too large')
        raw = self.rfile.read(n) if n > 0 else b''
        if not raw.strip(): return {}
        data = json.loads(raw.decode('utf-8'))
        if not isinstance(data, dict): raise ValueError('not an object')
        return data

    def do_POST(self):
        global last_hit; last_hit = time.time()
        if not self.guard(): return
        path = urlsplit(self.path).path
        try:
            if path == '/api/upload': return self.upload()
            try:
                body = self.read_json()
            except ValueError:
                return self.send(413 if self.close_connection else 400, {'ok': False, 'error': 'bad data'})
            return self.api_post(path, body)
        except (ConnectionError, TimeoutError):
            self.close_connection = True
        except Exception as e:
            log('POST error', path, repr(e))
            self.close_connection = True
            self.send(500, {'ok': False, 'error': 'server error'})

    def api_post(self, path, body):
        if path == '/api/brief':
            body['_savedAt'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
            write_atomic(BRIEF / 'brief.json', json.dumps(body, indent=2, ensure_ascii=False))
            write_atomic(BRIEF / 'brief.md', as_markdown(body))
            return self.send(200, {'ok': True, 'savedAt': body['_savedAt']})
        if path == '/api/remove': return self.remove(body.get('path'))
        if path == '/api/claude/start': return self.claude_start(body)
        if path == '/api/claude/reply':
            text = body.get('text') if isinstance(body.get('text'), str) else ''
            text = text.strip()
            if not text: return self.send(400, {'ok': False, 'error': 'empty'})
            if len(text) > 20000: return self.send(413, {'ok': False, 'error': 'too long'})
            deck_id = body.get('deckId') or None
            if deck_id is not None and not deck_json(deck_id): return self.send(400, {'ok': False, 'error': 'bad deck id'})
            slide = body.get('slide')
            if slide is not None:
                try:
                    slide = int(slide)
                except (TypeError, ValueError):
                    return self.send(400, {'ok': False, 'error': 'bad slide'})
                if not 1 <= slide <= 999: return self.send(400, {'ok': False, 'error': 'bad slide'})
            message = f'[slide {slide}] {text}' if slide else text
            return self.send(*RUNNER.launch(message, resume=True, user_text=text, deck_id=deck_id, slide=slide))
        if path == '/api/decks':
            rec = new_deck()
            return self.send(200, {'ok': True, 'id': rec['id'], 'deck': deck_view(rec)})
        m = DECK_ROUTE.match(path)
        if m and m.group(2) == 'text':
            return self.send(*edit_text(m.group(1), body.get('editId'), body.get('text')))
        m = re.fullmatch(r'/api/fix/([a-z]+)', path)
        if m:
            name = m.group(1)
            if name in ('npm', 'pip'): return self.send(*FIXER.start(name))
            if name == 'signin': return self.send(*RUNNER.login())
            if name == 'update': return self.send(*fix_update())
            return self.send(404, {'ok': False, 'error': 'unknown fix'})
        if path == '/api/claude/stop': return self.send(*RUNNER.stop())
        if path == '/api/claude/login': return self.send(*RUNNER.login())
        if path == '/api/open-files':
            folder = body.get('folder')
            target = FILES / folder if folder in FOLDERS else FILES
            target.mkdir(parents=True, exist_ok=True)
            launch(target)
            return self.send(200, {'ok': True})
        if path == '/api/open-slides': return self.open_slides(body.get('path'))
        if path == '/api/open-vscode':
            code = find_vscode()
            if not code: return self.send(404, {'ok': False, 'error': 'vscode-missing'})
            if not NO_LAUNCH:
                env = child_env()
                subprocess.Popen([str(code), str(ROOT)], env=env, creationflags=NO_WINDOW)
            return self.send(200, {'ok': True})
        self.send(404, {'error': 'not found'})

    def claude_start(self, body):
        """A new deck build. Without a deckId a library record is made from the current draft brief first."""
        deck_id = body.get('deckId') or None
        if deck_id is not None:
            if not load_deck(deck_id): return self.send(404, {'ok': False, 'error': 'no-deck'})
        else:
            if RUNNER.running: return self.send(409, {'ok': False, 'error': 'busy'})
            deck_id = new_deck()['id']
        return self.send(*RUNNER.launch(FIRST_MESSAGE, deck_id=deck_id))

    def do_PATCH(self):
        global last_hit; last_hit = time.time()
        if not self.guard(): return
        path = urlsplit(self.path).path
        try:
            try:
                body = self.read_json()
            except ValueError:
                return self.send(413 if self.close_connection else 400, {'ok': False, 'error': 'bad data'})
            m = DECK_ROUTE.match(path)
            if not m or m.group(2): return self.send(404, {'error': 'not found'})
            fields = {}
            if 'title' in body:
                t = body['title']
                if not isinstance(t, str) or not t.strip() or len(t) > 200: return self.send(400, {'ok': False, 'error': 'bad title'})
                fields['title'] = t.strip()
            if 'look' in body:
                if body['look'] is not None and (not isinstance(body['look'], str) or len(body['look']) > 100):
                    return self.send(400, {'ok': False, 'error': 'bad look'})
                fields['look'] = body['look']
            if 'quality' in body:
                if body['quality'] not in QUALITIES: return self.send(400, {'ok': False, 'error': 'bad quality'})
                fields['quality'] = body['quality']
            rec = update_deck(m.group(1), **fields)
            if not rec: return self.send(404, {'ok': False, 'error': 'no-deck'})
            return self.send(200, {'ok': True, 'deck': deck_view(rec)})
        except (ConnectionError, TimeoutError):
            self.close_connection = True
        except Exception as e:
            log('PATCH error', path, repr(e))
            self.close_connection = True
            self.send(500, {'ok': False, 'error': 'server error'})

    def open_slides(self, rel):
        SLIDES.mkdir(parents=True, exist_ok=True)
        if not rel:
            launch(SLIDES)
            return self.send(200, {'ok': True, 'opened': '4 - Your slides'})
        if not isinstance(rel, str) or '\x00' in rel: return self.send(400, {'ok': False, 'error': 'bad path'})
        p = Path(rel)
        if not p.is_absolute():
            p = ROOT / rel if rel.replace('\\', '/').startswith('4 - Your slides/') else SLIDES / rel
        if not inside(p, SLIDES) or p.resolve() == SLIDES.resolve():
            return self.send(403, {'ok': False, 'error': 'forbidden'})
        p = p.resolve()
        if p.is_dir():
            launch(p)
        elif p.is_file() and p.suffix.lower() in ('.html', '.htm', '.pdf', '.pptx'):
            launch(p)
        else:
            return self.send(404, {'ok': False, 'error': 'not found'})
        return self.send(200, {'ok': True, 'opened': str(p.relative_to(ROOT.resolve())).replace('\\', '/')})

    def upload(self):
        q = parse_qs(urlsplit(self.path).query)
        folder = (q.get('folder') or [''])[0]
        if folder not in FOLDERS:
            self.close_connection = True
            return self.send(400, {'ok': False, 'error': 'unknown folder'})
        n = self.headers.get('Content-Length')
        if n is None or not n.strip().isdigit():
            self.close_connection = True
            return self.send(411, {'ok': False, 'error': 'length required'})
        n = int(n)
        if n > MAX_UPLOAD:
            self.close_connection = True
            return self.send(413, {'ok': False, 'error': 'too large', 'max': MAX_UPLOAD})
        target_dir = FILES / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        if shutil.disk_usage(target_dir).free < n + 64 * 1024 * 1024:
            self.close_connection = True
            return self.send(507, {'ok': False, 'error': 'disk full'})
        name = clean_name((q.get('name') or [''])[0])
        part = target_dir / f'.aura-upload-{uuid.uuid4().hex}.part'
        try:
            left = n
            with open(part, 'xb') as out:
                while left > 0:
                    buf = self.rfile.read(min(CHUNK, left))
                    if not buf: break
                    out.write(buf); left -= len(buf)
            if left:
                part.unlink(missing_ok=True)
                self.close_connection = True
                return self.send(400, {'ok': False, 'error': 'incomplete'})
            stem, ext = os.path.splitext(name)
            k = 1
            while True:
                dest = target_dir / (name if k == 1 else f'{stem} ({k}){ext}')
                if not dest.exists():
                    try:
                        os.rename(part, dest); break
                    except FileExistsError:
                        pass
                k += 1
        except BaseException:
            part.unlink(missing_ok=True)
            raise
        SESSION_UPLOADS.add(os.path.normcase(str(dest.resolve())))
        rel = str(dest.relative_to(FILES)).replace('\\', '/')
        return self.send(200, {'ok': True, 'path': rel, 'name': dest.name, 'size': n})

    def remove(self, rel):
        if not isinstance(rel, str) or not rel or '\x00' in rel:
            return self.send(400, {'ok': False, 'error': 'bad path'})
        p = FILES / rel
        key = os.path.normcase(str(p.resolve()))
        if not inside(p, FILES) or key not in SESSION_UPLOADS:
            return self.send(403, {'ok': False, 'error': 'only files added in this session can be removed here'})
        try:
            p.unlink()
        except FileNotFoundError:
            pass
        SESSION_UPLOADS.discard(key)
        return self.send(200, {'ok': True})


class Server(ThreadingHTTPServer):
    allow_reuse_address = os.name != 'nt'    # on Windows SO_REUSEADDR would let two servers share the port
    daemon_threads = True


def reaper(srv):
    global last_hit
    step = min(30.0, max(0.5, IDLE_LIMIT / 4))
    while True:
        time.sleep(step)
        if RUNNER.running:
            last_hit = time.time(); continue   # never stop while Claude is working
        if time.time() - last_hit > IDLE_LIMIT:
            srv.shutdown(); return


def main():
    global PORT, RUNNER
    args = sys.argv[1:]
    if '--port' in args:
        PORT = int(args[args.index('--port') + 1])
    if sys.stderr is None or sys.stdout is None:    # pythonw: keep errors in a log file
        LOGS.mkdir(parents=True, exist_ok=True)
        sys.stderr = sys.stdout = open(LOGS / 'form_server.log', 'a', encoding='utf-8', buffering=1)
    RUNNER = Runner()
    try:
        srv = Server(('127.0.0.1', PORT), H)
    except OSError as e:
        log('cannot listen on port', PORT, e)
        print(f'port {PORT} is busy', file=sys.stderr)
        sys.exit(2)
    threading.Thread(target=reaper, args=(srv,), daemon=True).start()
    print(f'Aura-Slide studio on http://127.0.0.1:{PORT}/  (home: {AURA})', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == '__main__':
    main()
