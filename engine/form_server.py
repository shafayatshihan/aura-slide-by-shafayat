"""Aura-Slide form server. Serves the "tell us about your presentation" form on http://127.0.0.1:<port>/ (this PC
only) and saves the answers to .aura/brief/brief.json plus a readable brief.md for Claude.
Also lists the files the user has dropped into "3 - Put your files here", so slides can point at them.
Stops by itself after 45 minutes without use. Standard library only."""
import json, os, re, sys, threading, time, datetime, subprocess
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ENGINE = Path(__file__).resolve().parent
AURA = ENGINE.parent
ROOT = AURA.parent
FILES = ROOT / '3 - Put your files here'
BRIEF = AURA / 'brief'
CFG = json.loads((AURA / 'aura.config.json').read_text(encoding='utf-8'))
PORT = int(CFG.get('formPort', 8765))
IDLE_LIMIT = 45 * 60
last_hit = time.time()


def list_files():
    out = []
    if FILES.exists():
        order = ['Report', 'Images and photos', 'Data (csv, excel, graphs)', 'Logo and university template',
                 'Previous year reports', 'Journal papers', 'Anything else']
        rank = lambda p: (order.index(p.name) if p.name in order else len(order), p.name.lower())
        for sub in sorted((p for p in FILES.iterdir() if p.is_dir()), key=rank):
            items = [str(f.relative_to(FILES)).replace('\\', '/') for f in sorted(sub.rglob('*'))
                     if f.is_file() and not f.name.startswith(('~$', '.')) and f.name.lower() != 'desktop.ini']
            out.append({'folder': sub.name, 'files': items})
    return out


def as_markdown(b):
    """Readable version of the answers for Claude. Unknown keys are kept, so the form can grow freely."""
    L = [f"# Presentation brief", f"_Saved {b.get('_savedAt', '')}_", '']
    def row(label, v):
        if v in (None, '', [], {}): return
        if isinstance(v, list): v = ', '.join(str(x) for x in v if x)
        L.append(f'- **{label}:** {v}')
    s = b.get('basics', {})
    L.append('## The talk'); row('Type', s.get('typeOther') or s.get('type')); row('Title', s.get('title')); row('Subtitle', s.get('subtitle'))
    row('Date', s.get('date')); row('Event / course', s.get('event'))
    lk = b.get('look', {})
    L.append('\n## Look'); row('Theme', lk.get('theme') or 'Claude chooses (pick the Aura theme that suits the topic and audience)')
    p = b.get('people', {})
    L.append('\n## People')
    for m in p.get('presenters', []):
        row('Presenter', ' - '.join(x for x in [m.get('name'), m.get('id'), m.get('role')] if x))
    row('Supervisor / instructor', ' - '.join(x for x in [p.get('supervisor'), p.get('supervisorTitle')] if x))
    row('Institution', p.get('institution')); row('Department', p.get('department'))
    a = b.get('audience', {})
    L.append('\n## Audience and time'); row('Audience', a.get('who')); row('What they already know', a.get('level'))
    row('Time limit (minutes)', a.get('minutes')); row('Number of slides', a.get('slides') or 'Claude decides'); row('Q&A (minutes)', a.get('qa'))
    w = b.get('work', {})
    L.append('\n## The work'); row('Subject area', w.get('field')); row('What we did (one sentence)', w.get('summary'))
    row('Why it matters', w.get('problem')); row('How we did it', w.get('method'))
    for r in w.get('results', []):
        row('Key result', ' - '.join(x for x in [r.get('what'), r.get('value')] if x))
    row('Main message to remember', w.get('message')); row('Status', w.get('status')); row('What comes next', w.get('next'))
    pl = b.get('plan', {})
    L.append('\n## Slide plan')
    planned = [] if pl.get('auto', True) else [sl for sl in pl.get('slides', []) if any(sl.values())]
    if not planned:
        L.append('- Claude plans the slides.')
    for i, sl in enumerate(planned, 1):
        L.append(f"{i}. **{sl.get('title') or '(no title)'}** - {sl.get('covers') or ''}" + (f" _(use: {sl.get('file')})_" if sl.get('file') else ''))
    f = b.get('files', {})
    L.append('\n## Files'); row('Main report', f.get('mainReport')); row('Do not use', f.get('avoid'))
    for g in list_files():
        if g['files']: row(g['folder'], g['files'])
    c = b.get('content', {})
    L.append('\n## Special content'); row('Include', c.get('include')); row('Citation style', c.get('citations'))
    d = b.get('delivery', {})
    L.append('\n## On the day'); row('Where', d.get('where')); row('Needs to work offline', d.get('offline')); row('Backups', d.get('backups'))
    row('Speaker help', d.get('help')); row('Clicker', d.get('clicker'))
    e = b.get('extra', {})
    L.append('\n## Anything else'); row('Avoid', e.get('avoid')); row('Deadline', e.get('deadline')); row('Notes', e.get('notes'))
    # drop section headings that got no rows
    head = lambda s: s.lstrip('\n').startswith('## ')
    L = [ln for i, ln in enumerate(L) if not (head(ln) and (i + 1 == len(L) or head(L[i + 1])))]
    return '\n'.join(L) + '\n'


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str): body = body.encode('utf-8')
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        global last_hit; last_hit = time.time()
        if self.path in ('/', '/index.html'):
            return self.send(200, (ENGINE / 'form' / 'index.html').read_bytes(), 'text/html; charset=utf-8')
        if self.path == '/icon.png':
            ic = ENGINE / 'form' / 'icon.png'
            return self.send(200, ic.read_bytes(), 'image/png') if ic.exists() else self.send(404, {})
        if self.path.startswith('/themes/'):
            return self.theme_file(self.path[len('/themes/'):].split('?')[0])
        if self.path == '/api/ping': return self.send(200, {'ok': True})
        if self.path == '/api/files': return self.send(200, list_files())
        if self.path == '/api/brief':
            f = BRIEF / 'brief.json'
            return self.send(200, json.loads(f.read_text(encoding='utf-8')) if f.exists() else {})
        self.send(404, {'error': 'not found'})

    def theme_file(self, name):
        """Theme demo videos and posters for the form. Supports byte ranges so the browser can loop and seek."""
        f = ENGINE / 'form' / 'themes' / name
        if not re.fullmatch(r'[\w-]+\.(mp4|jpg)', name) or not f.is_file(): return self.send(404, {'error': 'not found'})
        data, ctype = f.read_bytes(), ('video/mp4' if name.endswith('.mp4') else 'image/jpeg')
        m = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        a, z = (int(m.group(1) or 0), min(int(m.group(2) or len(data) - 1), len(data) - 1)) if m else (0, len(data) - 1)
        self.send_response(206 if m else 200); self.send_header('Content-Type', ctype); self.send_header('Accept-Ranges', 'bytes')
        if m: self.send_header('Content-Range', f'bytes {a}-{z}/{len(data)}')
        self.send_header('Content-Length', str(z - a + 1)); self.send_header('Cache-Control', 'max-age=3600'); self.end_headers()
        self.wfile.write(data[a:z + 1])

    def do_POST(self):
        global last_hit; last_hit = time.time()
        # only accept requests coming from our own page
        if self.headers.get('Origin') not in (None, f'http://127.0.0.1:{PORT}', f'http://localhost:{PORT}'):
            return self.send(403, {'error': 'forbidden'})
        if self.path == '/api/brief':
            n = int(self.headers.get('Content-Length', 0))
            if n > 2_000_000: return self.send(413, {'error': 'too large'})
            try: b = json.loads(self.rfile.read(n).decode('utf-8'))
            except Exception: return self.send(400, {'error': 'bad data'})
            b['_savedAt'] = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
            BRIEF.mkdir(parents=True, exist_ok=True)
            (BRIEF / 'brief.json').write_text(json.dumps(b, indent=2, ensure_ascii=False), encoding='utf-8')
            (BRIEF / 'brief.md').write_text(as_markdown(b), encoding='utf-8')
            return self.send(200, {'ok': True, 'savedAt': b['_savedAt']})
        if self.path == '/api/open-files':
            FILES.mkdir(parents=True, exist_ok=True)
            subprocess.Popen(['explorer.exe', str(FILES)])
            return self.send(200, {'ok': True})
        self.send(404, {'error': 'not found'})


def reaper(srv):
    while True:
        time.sleep(30)
        if time.time() - last_hit > IDLE_LIMIT:
            srv.shutdown(); return


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    threading.Thread(target=reaper, args=(srv,), daemon=True).start()
    srv.serve_forever()
