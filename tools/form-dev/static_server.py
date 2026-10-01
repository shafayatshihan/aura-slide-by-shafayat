"""Developer-only static server for building the Lumi web app before/without the real form_server.py.
Serves engine/form at /, engine/fonts at /fonts/, three.js at /vendor/three/, tools/form-dev at /dev/, with byte-range
support (the gaze video seeks), plus small MOCK versions of the /api/* endpoints so the UI can be exercised end to end.
Not shipped (tools/ is excluded from releases).
usage: python tools/form-dev/static_server.py [port]   (default 8790)"""
import json, mimetypes, os, re, sys, threading, time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FORM, FONTS, DEV = REPO / 'engine' / 'form', REPO / 'engine' / 'fonts', REPO / 'tools' / 'form-dev'
THREE_DIRS = [REPO / 'engine' / 'node_modules' / 'three' / 'build',
              Path(os.environ.get('AURA_NODE_MODULES', r'C:\Aura-Slide by Shafayat\.aura\engine\node_modules')) / 'three' / 'build']
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
MIME = {'.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.json': 'application/json',
        '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
        '.otf': 'font/otf', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav'}
MOCK_FILES = [{'folder': 'Report', 'files': ['Report/thesis_final.pdf']}, {'folder': 'Images and photos', 'files': ['Images and photos/setup.jpg', 'Images and photos/rig.png']},
              {'folder': 'Data (csv, excel, graphs)', 'files': []}, {'folder': 'Logo and university template', 'files': []},
              {'folder': 'Previous year reports', 'files': []}, {'folder': 'Journal papers', 'files': ['Journal papers/xu2005.pdf']}, {'folder': 'Anything else', 'files': []}]
BRIEF = {}
EVENTS, RUN = [], {'running': False}

def fake_run(first):
    """Scripted Claude-like run for UI testing: stages, tool steps, a question, then done."""
    RUN['running'] = True
    script = [('status', 'Claude is starting'), ('say', '[[aura:stage=read]]\nReading your brief and files.'), ('tool', 'Read', 'Report/thesis_final.pdf'),
              ('tool', 'Read', 'Images and photos/setup.jpg'), ('say', '[[aura:stage=plan]]\nPlanning 12 slides for a 10 minute talk.'),
              ('say', '[[aura:stage=build]]\nBuilding the slides in the Bold Blue look.'), ('tool', 'Write', '4 - Your slides/My talk.html'),
              ('hook', 'Checked text sizes: all 26 px or larger'), ('say', '[[aura:stage=check]]\nChecking every slide.'),
              ('say', '[[aura:stage=export]]\nMaking the PDF backup.'), ('tool', 'Bash', 'node .aura/engine/tools/export_pdf.js'),
              ('say', '[[aura:stage=done]]\n[[aura:done path="4 - Your slides/My talk.html"]]\nYour slides are ready: 12 slides, plus a PDF backup.')] if first else \
             [('say', 'Thanks! Updating slide 3 now.'), ('tool', 'Edit', '4 - Your slides/My talk.html'), ('say', '[[aura:done path="4 - Your slides/My talk.html"]]\nDone.')]
    for item in script:
        time.sleep(0.9)
        kind = item[0]
        ev = {'i': len(EVENTS), 't': time.time(), 'kind': kind}
        if kind == 'tool': ev.update(tool=item[1], detail=item[2], text=f'{item[1]} {item[2]}')
        else: ev['text'] = item[1]
        EVENTS.append(ev)
    EVENTS.append({'i': len(EVENTS), 't': time.time(), 'kind': 'done', 'ok': True, 'text': 'finished'})
    RUN['running'] = False

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def json(self, obj, code=200):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b))); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(b)
    def file(self, f):
        if not f.is_file(): return self.json({'error': 'not found'}, 404)
        data = f.read_bytes(); ctype = MIME.get(f.suffix.lower(), mimetypes.guess_type(f.name)[0] or 'application/octet-stream')
        m = re.fullmatch(r'bytes=(\d*)-(\d*)', self.headers.get('Range', ''))
        a, z = (int(m.group(1) or 0), min(int(m.group(2) or len(data) - 1), len(data) - 1)) if m else (0, len(data) - 1)
        self.send_response(206 if m else 200); self.send_header('Content-Type', ctype); self.send_header('Accept-Ranges', 'bytes')
        if m: self.send_header('Content-Range', f'bytes {a}-{z}/{len(data)}')
        self.send_header('Content-Length', str(z - a + 1)); self.send_header('Cache-Control', 'no-store'); self.end_headers()
        self.wfile.write(data[a:z + 1])
    def safe(self, base, rel):
        p = (base / rel).resolve()
        return p if str(p).startswith(str(base.resolve())) else None
    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ('/', '/index.html'): return self.file(FORM / 'index.html')
        if path.startswith('/fonts/'): return self.file(self.safe(FONTS, path[7:]) or FONTS / '__none__')
        if path.startswith('/dev/'): return self.file(self.safe(DEV, path[5:]) or DEV / '__none__')
        if path.startswith('/vendor/three/'):
            name = path[len('/vendor/three/'):]
            for d in THREE_DIRS:
                if name in ('three.module.js', 'three.core.js') and (d / name).is_file(): return self.file(d / name)
            return self.json({'error': 'three not installed'}, 404)
        if path == '/api/ping': return self.json({'ok': True})
        if path == '/api/files': return self.json(MOCK_FILES)
        if path == '/api/brief': return self.json(BRIEF)
        if path == '/api/claude/status': return self.json({'cli': True, 'signedIn': True, 'running': RUN['running'], 'sessionId': 'mock', 'mock': True})
        if path == '/api/claude/events':
            since = int(re.search(r'since=(\d+)', self.path).group(1)) if 'since=' in self.path else 0
            return self.json({'events': EVENTS[since:], 'next': len(EVENTS), 'running': RUN['running']})
        f = self.safe(FORM, path.lstrip('/'))
        return self.file(f) if f else self.json({'error': 'not found'}, 404)
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(n) if n else b''
        path = self.path.split('?')[0]
        if path == '/api/brief':
            BRIEF.clear(); BRIEF.update(json.loads(body or b'{}')); return self.json({'ok': True, 'savedAt': time.strftime('%Y-%m-%d %H:%M')})
        if path == '/api/upload':
            q = dict(re.findall(r'([a-z]+)=([^&]*)', self.path.split('?', 1)[1] if '?' in self.path else ''))
            from urllib.parse import unquote
            folder, name = unquote(q.get('folder', '')), unquote(q.get('name', 'file'))
            for g in MOCK_FILES:
                if g['folder'] == folder: g['files'].append(f'{folder}/{name}')
            return self.json({'ok': True, 'path': f'{folder}/{name}', 'name': name, 'size': n})
        if path == '/api/remove': return self.json({'ok': True})
        if path == '/api/claude/start' or path == '/api/claude/reply':
            threading.Thread(target=fake_run, args=(path.endswith('start'),), daemon=True).start(); return self.json({'ok': True})
        if path in ('/api/claude/stop', '/api/claude/login', '/api/open-files', '/api/open-slides', '/api/open-vscode'): return self.json({'ok': True})
        return self.json({'error': 'not found'}, 404)

if __name__ == '__main__':
    print(f'dev static server on http://127.0.0.1:{PORT}/  (mock APIs)')
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
