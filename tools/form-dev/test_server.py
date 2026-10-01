"""Developer-only automated tests for engine/form_server.py against a throwaway sandbox (never a real installation).
  python tools/form-dev/test_server.py [--port 8767] [--sandbox X:\\aura-dev-server]
Makes the sandbox with sandbox.py --reset, runs the real server with AURA_HOME/--port/AURA_FAKE_CLAUDE and checks:
host/origin rejection, path traversal, MIME types and byte ranges, uploads, removes, the brief round trip, a full fake
Claude run (start, events, question, reply with --resume, stop), events surviving a restart, and the idle shutdown.
v0.3: quality flags on the command line, deck records (create / list / migrate / patch), deck-tied start and reply
(session switching, [slide N] prefix), /deck/<id>/ serving, slide pictures (real render with Edge), direct text tweaks
(patched in packed + build, 26 px rule rejection reverts both), usage capture, choice / hint markers, health checks and
fixes (simulated failures, fake fix commands)."""
import http.client, json, os, socket, subprocess, sys, time, traceback
try: sys.stdout.reconfigure(encoding='utf-8', errors='replace'); sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception: pass
from pathlib import Path
from urllib.parse import quote

REPO = Path(__file__).resolve().parents[2]
args = sys.argv[1:]
PORT = int(args[args.index('--port') + 1]) if '--port' in args else 8767
SANDBOX = Path(args[args.index('--sandbox') + 1]) if '--sandbox' in args else Path(r'X:\aura-dev-server')
AURA = SANDBOX / '.aura'
FILES = SANDBOX / '3 - Put your files here'
HOST = f'127.0.0.1:{PORT}'
SERVER = REPO / 'engine' / 'form_server.py'
FAKE = REPO / 'tools' / 'form-dev' / 'fake_claude.py'
results = []


def check(name, cond, info=''):
    results.append((name, bool(cond)))
    print(('  PASS ' if cond else '  FAIL ') + name + ('' if cond else f'   -> {info}'), flush=True)


def req(method, path, body=None, headers=None, host=HOST):
    c = http.client.HTTPConnection('127.0.0.1', PORT, timeout=30)
    h = {'Host': host}
    h.update(headers or {})
    if isinstance(body, (dict, list)):
        body = json.dumps(body).encode(); h.setdefault('Content-Type', 'application/json')
    c.putrequest(method, path, skip_host=True, skip_accept_encoding=True)
    for k, v in h.items(): c.putheader(k, v)
    if body is not None: c.putheader('Content-Length', str(len(body)))
    c.endheaders(body)
    r = c.getresponse()
    data = r.read()
    c.close()
    return r.status, dict((k.lower(), v) for k, v in r.getheaders()), data


def jget(path, **kw):
    s, h, d = req('GET', path, **kw)
    try: return s, json.loads(d or b'{}')
    except ValueError: return s, {}


def jpost(path, body=None, **kw):
    s, h, d = req('POST', path, body if body is not None else {}, **kw)
    try: return s, json.loads(d or b'{}')
    except ValueError: return s, {}


def raw(lines):
    """Send raw request bytes (no body) and return the status line."""
    s = socket.create_connection(('127.0.0.1', PORT), timeout=10)
    s.sendall(('\r\n'.join(lines) + '\r\n\r\n').encode())
    data = b''
    try:
        while b'\r\n' not in data:
            chunk = s.recv(4096)
            if not chunk: break
            data += chunk
    finally:
        s.close()
    return data.split(b'\r\n')[0].decode(errors='replace')


def start_server(**env_extra):
    env = dict(os.environ, AURA_HOME=str(AURA), AURA_FAKE_CLAUDE=str(FAKE), AURA_NO_LAUNCH='1', AURA_FAKE_DELAY='0.03',
               AURA_NO_NETWORK='1', AURA_FAKE_FIX='1')
    for k in ('AURA_LATEST_VERSION', 'AURA_HEALTH_FAIL', 'AURA_FAKE_PLAN', 'AURA_FAKE_FIX_FAIL'): env.pop(k, None)
    for k in ('CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT'): env.pop(k, None)
    env.update({k: str(v) for k, v in env_extra.items()})
    p = subprocess.Popen([sys.executable, str(SERVER), '--port', str(PORT)], env=env, stdout=subprocess.DEVNULL,
                         stderr=subprocess.PIPE, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    for _ in range(80):
        try:
            if jget('/api/ping')[0] == 200: return p
        except OSError:
            time.sleep(0.1)
    raise SystemExit('server did not start: ' + (p.stderr.read().decode(errors='replace') if p.poll() is not None else 'timeout'))


def stop_server(p):
    if p.poll() is None:
        p.kill(); p.wait(10)


def python_cmdlines():
    return subprocess.run(['powershell', '-NoProfile', '-Command',
                           "Get-CimInstance Win32_Process -Filter \"name='python.exe'\" | ForEach-Object { $_.CommandLine }"],
                          capture_output=True, text=True).stdout


def wait_run(timeout=40):
    t0 = time.time()
    while time.time() - t0 < timeout:
        s, j = jget('/api/claude/events?since=0')
        if not j.get('running'): return j
        time.sleep(0.2)
    return jget('/api/claude/events?since=0')[1]


def main():
    print(f'sandbox {SANDBOX}, port {PORT}')
    subprocess.run([sys.executable, str(REPO / 'tools' / 'form-dev' / 'sandbox.py'), str(SANDBOX), '--reset'], check=True,
                   stdout=subprocess.DEVNULL)
    srv = start_server()
    try:
        run_main_suite()
        run_v3_suite()
        print('\n[restart: events survive]')
        n_before = jget('/api/claude/status')[1].get('eventCount')
        sid_before = jget('/api/claude/status')[1].get('sessionId')
        stop_server(srv)
        srv = start_server()
        st = jget('/api/claude/status')[1]
        ev = jget('/api/claude/events?since=0')[1]
        check('event count kept after restart', st.get('eventCount') == n_before and len(ev['events']) == n_before,
              (st.get('eventCount'), n_before))
        check('session id kept after restart', st.get('sessionId') == sid_before, (st.get('sessionId'), sid_before))
        check('event indexes contiguous', [e['i'] for e in ev['events']] == list(range(n_before)))
        s, j = jpost('/api/claude/reply', {'text': 'Thanks, one more tweak please'})
        j = wait_run()
        check('resume works after restart', j['events'][-1]['kind'] == 'done' and j['events'][-1].get('ok') and
              j.get('sessionId') == sid_before, j['events'][-1])
        print('\n[server dies during a run]')
        jpost('/api/claude/reply', {'text': 'take-your-time once more'})
        time.sleep(1.0)
        stop_server(srv)
        time.sleep(1.0)
        check('Claude tree dies with the server (job object)', 'fake_claude.py' not in python_cmdlines(), 'orphan alive')
        srv = start_server()
        j = jget('/api/claude/events?since=0')[1]
        check('interrupted run reported after restart', j['events'][-1]['kind'] == 'error' and
              j['events'][-1].get('code') == 'interrupted' and not j['running'], j['events'][-1])
    finally:
        stop_server(srv)
    print('\n[health checks and fixes]')
    run_health_suite()
    print('\n[idle shutdown]')
    run_idle_suite()
    passed = sum(1 for _, ok in results if ok)
    print(f'\n{passed}/{len(results)} checks passed')
    return 0 if passed == len(results) else 1


def run_main_suite():
    print('\n[host and origin]')
    check('good host 127.0.0.1', req('GET', '/api/ping')[0] == 200)
    check('good host localhost', req('GET', '/api/ping', host=f'localhost:{PORT}')[0] == 200)
    for h in ('evil.example:%d' % PORT, 'evil.example', f'127.0.0.1:{PORT + 1}', '127.0.0.1', f'LOCALHOST.evil:{PORT}'):
        check(f'bad host rejected ({h})', req('GET', '/', host=h)[0] == 403)
    check('bad host rejected on POST', req('POST', '/api/brief', {}, host='attacker.test')[0] == 403)
    check('missing host rejected', raw(['GET /api/ping HTTP/1.1']).split(' ')[1:2] == ['403'])
    check('foreign origin rejected', jpost('/api/brief', {'x': 1}, headers={'Origin': 'http://evil.example'})[0] == 403)
    check('null origin rejected', jpost('/api/brief', {'x': 1}, headers={'Origin': 'null'})[0] == 403)
    check('wrong-port origin rejected', jpost('/api/brief', {'x': 1}, headers={'Origin': f'http://127.0.0.1:{PORT + 1}'})[0] == 403)
    check('own origin accepted', jpost('/api/brief', {'x': 1}, headers={'Origin': f'http://localhost:{PORT}'})[0] == 200)
    check('no origin accepted', jpost('/api/brief', {'x': 1})[0] == 200)

    print('\n[path traversal and whitelist]')
    for p in ('/js/../../form_server.py', '/js/%2e%2e/%2e%2e/form_server.py', '/css/..%5c..%5cform_server.py',
              '/fonts/../form_server.py', '/fonts/%2e%2e%2fform_server.py', '/js/scenes/../../../aura.config.json',
              '/themes/../../form_server.py', '/assets/..%2f..%2f..%2faura.config.json', '/js/%00api.js',
              '/vendor/three/three.cjs', '/vendor/three/../../package.json', '/assets/character.mp4::$DATA',
              '/js/api.js:stream', '/css/../index.html', '/form_server.py', '/../aura.config.json', '/js/',
              '/js/.hidden.js', '//etc/passwd', '/C:/Windows/win.ini'):
        s, h, d = req('GET', p)
        check(f'blocked {p}', s == 404 and b'import' not in d, s)
    sys.path.insert(0, str(REPO / 'engine'))
    sys.dont_write_bytecode = True     # no __pycache__ inside the repo engine
    os.environ['AURA_HOME'] = str(AURA)
    import form_server as fs
    check('whitelist refuses .py', fs.static_path('/js/x.py') is None)
    check('whitelist refuses .html outside /', fs.static_path('/css/x.html') is None)
    check('whitelist allows .js', fs.static_path('/js/api.js') is not None)

    print('\n[MIME types and ranges]')
    for p, mime in (('/', 'text/html'), ('/js/api.js', 'text/javascript'), ('/assets/gaze-frames.json', 'application/json'),
                    ('/assets/character.mp4', 'video/mp4'), ('/fonts/DMSans-Regular.woff2', 'font/woff2'),
                    ('/themes/1-pink-punch.jpg', 'image/jpeg'), ('/themes/2-bold-blue.mp4', 'video/mp4'),
                    ('/vendor/three/three.module.js', 'text/javascript'), ('/vendor/three/three.core.js', 'text/javascript')):
        s, h, d = req('HEAD', p)
        check(f'{p} -> {mime}', s == 200 and h.get('content-type', '').startswith(mime), (s, h.get('content-type')))
    video = REPO / 'engine' / 'form' / 'assets' / 'character.mp4'
    size, blob = video.stat().st_size, video.read_bytes()
    s, h, d = req('GET', '/assets/character.mp4', headers={'Range': 'bytes=1000-1999'})
    check('range 206 + exact bytes', s == 206 and d == blob[1000:2000] and h.get('content-range') == f'bytes 1000-1999/{size}', (s, h.get('content-range')))
    s, h, d = req('GET', '/assets/character.mp4', headers={'Range': f'bytes={size - 4096}-'})
    check('open-ended range (seek near end)', s == 206 and d == blob[-4096:])
    s, h, d = req('GET', '/assets/character.mp4', headers={'Range': 'bytes=-500'})
    check('suffix range', s == 206 and d == blob[-500:])
    s, h, d = req('GET', '/assets/character.mp4', headers={'Range': f'bytes={size + 10}-'})
    check('unsatisfiable range 416', s == 416 and h.get('content-range') == f'bytes */{size}', s)
    s, h, d = req('GET', '/assets/character.mp4')
    check('full video 200 with Accept-Ranges', s == 200 and len(d) == size and h.get('accept-ranges') == 'bytes')
    s2, h2, _ = req('GET', '/js/api.js')
    s3, _, _ = req('GET', '/js/api.js', headers={'If-Modified-Since': h2.get('last-modified', '')})
    check('304 when unchanged', s3 == 304, s3)
    check('nosniff header', h2.get('x-content-type-options') == 'nosniff')

    print('\n[uploads]')
    def up(folder, name, data=b'hello'):
        s, h, d = req('POST', f'/api/upload?folder={quote(folder, safe="")}&name={quote(name, safe="")}', data,
                      headers={'Content-Type': 'application/octet-stream'})
        return s, json.loads(d or b'{}')
    s, j = up('Report', 'hello.txt')
    check('upload ok', s == 200 and j.get('path') == 'Report/hello.txt' and j.get('size') == 5 and
          (FILES / 'Report' / 'hello.txt').read_bytes() == b'hello', j)
    s, j = up('Report', 'hello.txt', b'second')
    check('duplicate gets " (2)"', j.get('path') == 'Report/hello (2).txt' and (FILES / 'Report' / 'hello.txt').read_bytes() == b'hello', j)
    s, j = up('Report', 'hello.txt', b'third')
    check('third copy gets " (3)"', j.get('path') == 'Report/hello (3).txt', j)
    for name, want in (('../../evil.txt', 'evil.txt'), ('..\\..\\.aura\\brief\\brief.json', 'brief.json'),
                       ('CON.txt', '_CON.txt'), ('nul', '_nul'), ('com1.tar.gz', '_com1.tar.gz'),
                       ('a<b>c:d|e?f*.pdf', 'a_b_c_d_e_f_.pdf'), ('  .hidden. ', 'hidden'), ('desktop.ini', '_desktop.ini'),
                       ('\u099b\u09ac\u09bf \u09a8\u09ae\u09c1\u09a8\u09be.png', '\u099b\u09ac\u09bf \u09a8\u09ae\u09c1\u09a8\u09be.png'),
                       ('x' * 300 + '.docx', 'x' * 115 + '.docx'), ('', 'file'), ('tab\there.csv', 'tab_here.csv')):
        s, j = up('Images and photos', name)
        check(f'name {name[:30]!r} -> {want[:30]!r}', s == 200 and j.get('name') == want and
              (FILES / 'Images and photos' / want).is_file(), j)
    check('nothing escaped the folder', not (SANDBOX / 'evil.txt').exists() and not (FILES / 'evil.txt').exists())
    for folder in ('Secret', '../.aura', 'Report/../..', ''):
        check(f'bad folder {folder!r} rejected', up(folder, 'x.txt')[0] == 400)
    huge = 3 * 1024 ** 3
    st = raw([f'POST /api/upload?folder=Report&name=big.bin HTTP/1.1', f'Host: {HOST}', f'Content-Length: {huge}'])
    check('oversize rejected by Content-Length (413)', ' 413 ' in st + ' ', st)
    st = raw([f'POST /api/upload?folder=Report&name=nolen.bin HTTP/1.1', f'Host: {HOST}'])
    check('missing Content-Length rejected (411)', ' 411 ' in st + ' ', st)
    check('no partial files left', not list(FILES.rglob('*.part')) and not (FILES / 'Report' / 'big.bin').exists())
    s, j = up('Report', 'cross.txt', b'x')
    s2, _, _ = req('POST', '/api/upload?folder=Report&name=cross2.txt', b'x', headers={'Origin': 'http://evil.example'})
    check('upload with foreign origin rejected', s2 == 403 and not (FILES / 'Report' / 'cross2.txt').exists())
    big = os.urandom(3 * 1024 * 1024 + 17)
    s, j = up('Data (csv, excel, graphs)', 'big.bin', big)
    check('multi-chunk upload intact', s == 200 and (FILES / 'Data (csv, excel, graphs)' / 'big.bin').read_bytes() == big)
    files = jget('/api/files')[1]
    rep = next(g for g in files if g['folder'] == 'Report')
    check('/api/files lists uploads', 'Report/hello (2).txt' in rep['files'], rep)

    print('\n[remove]')
    (FILES / 'Report' / 'mine-before.pdf').write_bytes(b'%PDF-1.4 pre-existing')
    check('remove session upload', jpost('/api/remove', {'path': 'Report/hello (3).txt'})[0] == 200 and
          not (FILES / 'Report' / 'hello (3).txt').exists())
    s, j = jpost('/api/remove', {'path': 'Report/mine-before.pdf'})
    check('pre-existing file protected', s == 403 and (FILES / 'Report' / 'mine-before.pdf').exists(), s)
    for bad in ('../.aura/brief/brief.json', 'Report/../../.aura/aura.config.json', 'C:/Windows/win.ini', '', None, 5):
        check(f'remove {bad!r} refused', jpost('/api/remove', {'path': bad})[0] in (400, 403))
    check('remove twice refused', jpost('/api/remove', {'path': 'Report/hello (3).txt'})[0] == 403)
    check('config untouched', (AURA / 'aura.config.json').exists())

    print('\n[brief round trip]')
    brief = {'basics': {'type': 'Thesis defence', 'title': 'Pulsating heat pipes', 'subtitle': 'Under vacuum'},
             'people': {'presenters': [{'name': 'S. M. Shafayat Islam', 'id': 2110072, 'role': 'Presenter'}]},
             'audience': {'who': ['Teachers', 'Students'], 'level': 'Some background', 'minutes': 12},
             'work': {'results': [{'what': 'R_th drop', 'value': 38}]},
             'look': {'theme': 'Pink Punch'}, 'style': {'threeD': 'yes', 'twoD': 'no', 'amount': 75},
             'extra': {'notes': 'ask-me please'}, 'unknown': {'kept': True}}
    s, j = jpost('/api/brief', brief)
    s2, back = jget('/api/brief')
    check('brief saved', s == 200 and j.get('savedAt'))
    check('brief round trip', back.get('style') == brief['style'] and back.get('unknown') == {'kept': True} and back.get('_savedAt'))
    md = (AURA / 'brief' / 'brief.md').read_text(encoding='utf-8')
    for want in ('## Look and motion', '- **Theme:** Pink Punch', '- **3D simulations:** Yes', '- **2D animations:** No',
                 '- **Amount of illustration and animation:** 75 / 100 (Rich)', 'S. M. Shafayat Islam - 2110072 - Presenter',
                 'R_th drop - 38'):
        check(f'brief.md has {want!r}', want in md, md[:400])
    jpost('/api/brief', dict(brief, look={'theme': 'Claude chooses'}, style={'amount': 10}))
    md2 = (AURA / 'brief' / 'brief.md').read_text(encoding='utf-8')
    check('amount label derived (Minimal) and Claude chooses text', '10 / 100 (Minimal)' in md2 and 'Claude chooses (pick' in md2)
    check('bad JSON -> 400', req('POST', '/api/brief', b'{nope', headers={'Content-Type': 'application/json'})[0] == 400)
    check('non-object JSON -> 400', req('POST', '/api/brief', b'[1,2]')[0] == 400)
    jpost('/api/brief', brief)   # leave the ask-me note in for the run below

    print('\n[open-slides / open-vscode / login (no launch)]')
    (SANDBOX / '4 - Your slides' / 'x.html').write_text('<p>x</p>', encoding='utf-8')
    check('open slides folder', jpost('/api/open-slides', {})[0] == 200)
    check('open deck inside slides', jpost('/api/open-slides', {'path': '4 - Your slides/x.html'})[0] == 200)
    check('open deck relative to slides', jpost('/api/open-slides', {'path': 'x.html'})[0] == 200)
    for bad in ('../3 - Put your files here/Report/hello.txt', '4 - Your slides/../.aura/aura.config.json',
                str(SANDBOX / '.aura' / 'aura.config.json'), 'C:/Windows/notepad.exe', '4 - Your slides/../../x.html'):
        check(f'open-slides {bad[:40]!r} refused', jpost('/api/open-slides', {'path': bad})[0] in (403, 404))
    check('open-vscode answers', jpost('/api/open-vscode')[0] in (200, 404))
    check('login answers (no window in tests)', jpost('/api/claude/login')[0] == 200)

    print('\n[fake Claude run]')
    s, st = jget('/api/claude/status?refresh=1')
    check('status: cli + signed in', st.get('cli') is True and st.get('signedIn') is True and st.get('running') is False, st)
    check('reply without a session refused', jpost('/api/claude/reply', {'text': 'hi'})[0] == 409)
    s, j = jpost('/api/claude/start')
    check('start ok', s == 200 and j.get('ok'), (s, j))
    s2, _ = jpost('/api/claude/start')
    check('second start while running -> 409', s2 == 409, s2)
    j = wait_run()
    kinds = [e['kind'] for e in j['events']]
    check('events: status, say, tool, tool-error, done', all(k in kinds for k in ('status', 'say', 'tool', 'tool-error', 'done')), kinds)
    check('waiting after [[aura:ask]]', j.get('waiting') is True, j.get('waiting'))
    sid = j.get('sessionId')
    check('session id recorded', bool(sid))
    tools = [e for e in j['events'] if e['kind'] == 'tool']
    check('tool detail is short and human', any(e.get('detail') == '.aura/brief/brief.md' and e.get('tool') == 'Read' for e in tools) and
          any(e.get('detail') == 'node --version' for e in tools), tools[:3])
    check('non-JSON warning ignored', not any('Ignoring' in (e.get('text') or '') for e in j['events']))
    check('events have i, t, kind, text', all({'i', 't', 'kind', 'text'} <= set(e) for e in j['events']))
    s, part = jget(f"/api/claude/events?since={j['next'] - 2}")
    check('events?since=n pages', len(part['events']) == 2 and part['next'] == j['next'])
    s, j2 = jpost('/api/claude/reply', {'text': 'Only on the title slide, please.'})
    check('reply ok', s == 200 and j2.get('ok'), j2)
    j = wait_run()
    tail = j['events'][j['events'].index(next(e for e in j['events'] if e['kind'] == 'user')):]
    check('user event recorded', tail[0]['text'] == 'Only on the title slide, please.')
    check('resume kept the session (--resume)', j.get('sessionId') == sid and any(sid[:8] in (e.get('text') or '') for e in tail), sid)
    check('finished ok with lastDeck', tail[-1]['kind'] == 'done' and tail[-1].get('ok') is True and
          j.get('lastDeck') == '4 - Your slides/Pulsating heat pipes.html' and not j.get('waiting'), (tail[-1], j.get('lastDeck')))
    check('deck written into 4 - Your slides', (SANDBOX / '4 - Your slides' / 'Pulsating heat pipes.html').is_file())
    check('open the finished deck', jpost('/api/open-slides', {'path': j['lastDeck']})[0] == 200)

    print('\n[stop]')
    s, _ = jpost('/api/claude/reply', {'text': 'take-your-time please'})
    time.sleep(1.0)
    check('long run is running', jget('/api/claude/status')[1].get('running') is True)
    t0 = time.time()
    s, j = jpost('/api/claude/stop')
    check('stop returns quickly and not running', s == 200 and j.get('running') is False and time.time() - t0 < 10, (s, j))
    ev = jget('/api/claude/events?since=0')[1]
    check('stopped event', ev['events'][-1]['kind'] == 'done' and ev['events'][-1].get('code') == 'stopped', ev['events'][-1])
    n = ev['next']; time.sleep(1.5)
    check('no events after stop (process tree gone)', jget('/api/claude/events?since=0')[1]['next'] == n)
    check('fake process killed', 'fake_claude.py' not in python_cmdlines(), 'fake still alive')

    print('\n[errors: sign-in, usage limit, crash]')
    jpost('/api/claude/reply', {'text': 'auth-fail'}); j = wait_run()
    check('sign-in problem -> error code auth', j['events'][-1]['kind'] == 'error' and j['events'][-1].get('code') == 'auth', j['events'][-1])
    check('status shows signed out after auth error', jget('/api/claude/status')[1].get('signedIn') is False)
    jpost('/api/claude/reply', {'text': 'rate-limit'}); j = wait_run()
    lim = [e for e in j['events'][-4:] if e['kind'] == 'limit']
    check('rate limit -> limit event with resetsAt', lim and lim[0].get('resetsAt') and 'resets at' in lim[0]['text'], j['events'][-3:])
    jpost('/api/claude/reply', {'text': 'crash'}); j = wait_run()
    check('crash -> error failed', j['events'][-1]['kind'] == 'error' and j['events'][-1].get('code') == 'failed', j['events'][-1])
    check('state file under .aura/temp', (AURA / 'temp' / 'claude-state.json').is_file() and (AURA / 'temp' / 'claude-events.jsonl').is_file())


def run_and_wait(path, body):
    """POST a start/reply, wait for the run, return (status, response, the new events)."""
    n = jget('/api/claude/status')[1].get('eventCount', 0)
    s, j = jpost(path, body)
    ev = wait_run(60)['events'][n:] if s == 200 else []
    return s, j, ev


def fake_argv(evs):
    for e in evs:
        if e['kind'] == 'say' and e['text'].startswith('[fake-argv] '):
            return json.loads(e['text'][len('[fake-argv] '):])
    return None


def flag(argv, name):
    return argv[argv.index(name) + 1] if argv and name in argv and argv.index(name) + 1 < len(argv) else None


def run_v3_suite():
    sys.path.insert(0, str(REPO / 'engine'))
    sys.dont_write_bytecode = True
    import form_server as fs
    SLIDES = SANDBOX / '4 - Your slides'

    print('\n[quality flags]')
    check('best -> opus/high + sonnet fallback', fs.quality_flags('best') == ['--model', 'opus', '--effort', 'high', '--fallback-model', 'sonnet'])
    check('balanced -> sonnet/high', fs.quality_flags('balanced') == ['--model', 'sonnet', '--effort', 'high'])
    check('fast -> sonnet/low', fs.quality_flags('fast') == ['--model', 'sonnet', '--effort', 'low'])
    check('unknown -> balanced', fs.quality_flags('ultra') == fs.quality_flags(None) == fs.quality_flags('balanced'))
    brief = {'basics': {'title': 'Heat pipes v3'}, 'look': {'theme': 'Bold Blue'}, 'style': {'quality': 'best', 'amount': 60}}
    jpost('/api/brief', brief)
    md = (AURA / 'brief' / 'brief.md').read_text(encoding='utf-8')
    check('brief.md has the Quality row', '- **Quality:** Best quality' in md, md[:600])
    s, j = jpost('/api/decks')
    A = j.get('id')
    rec = json.loads((AURA / 'decks' / f'{A}.json').read_text(encoding='utf-8')) if A else {}
    check('POST /api/decks makes a record from the draft', s == 200 and rec.get('title') == 'Heat pipes v3' and
          rec.get('quality') == 'best' and rec.get('look') == 'Bold Blue' and rec.get('brief', {}).get('basics') == brief['basics'] and
          rec.get('file') is None and j.get('deck', {}).get('status') == 'draft', (s, j))
    check('record has every field', all(k in rec for k in ('id', 'title', 'file', 'look', 'quality', 'createdAt', 'updatedAt',
                                                          'sessionId', 'brief')), list(rec))
    s, j, ev = run_and_wait('/api/claude/start', {'deckId': A})
    argv = fake_argv(ev)
    check('start for a deck ok', s == 200 and j.get('deckId') == A and j.get('quality') == 'best', j)
    check('start uses best flags', flag(argv, '--model') == 'opus' and flag(argv, '--effort') == 'high' and
          flag(argv, '--fallback-model') == 'sonnet' and '--resume' not in argv and '--settings' in argv, argv)
    rec = jget(f'/api/decks/{A}')[1].get('deck', {})
    check('record learned session, file and build', rec.get('sessionId') and rec.get('file') == '4 - Your slides/Heat pipes v3.html' and
          rec.get('build') == 'heat-pipes-v3' and rec.get('status') == 'ready' and rec.get('url') == f'/deck/{A}/', rec)
    sessA = rec.get('sessionId')
    check('events are tagged with the deck', ev and all(e.get('deck') == A for e in ev), [e.get('deck') for e in ev][:5])
    done = [e for e in ev if e['kind'] == 'done']
    hint_say = [e for e in ev if e['kind'] == 'say' and '[[aura:hint slide=3 text="add a simple diagram of the method"]]' in e['text']]
    check('hint markers pass through untouched', hint_say and done and done[-1]['text'].count('[[aura:hint ') == 3, done[-1:] )

    s, j = req('PATCH', f'/api/decks/{A}', {'quality': 'fast', 'title': 'Renamed deck'})[0], None
    rec = jget(f'/api/decks/{A}')[1].get('deck', {})
    check('PATCH quality + title', s == 200 and rec.get('quality') == 'fast' and rec.get('title') == 'Renamed deck', (s, rec))
    check('PATCH bad quality -> 400', req('PATCH', f'/api/decks/{A}', {'quality': 'turbo'})[0] == 400)
    check('PATCH unknown deck -> 404', req('PATCH', '/api/decks/nope123', {'title': 'x'})[0] == 404)
    check('PATCH foreign origin -> 403', req('PATCH', f'/api/decks/{A}', {'title': 'x'}, headers={'Origin': 'http://evil.example'})[0] == 403)

    s, j, ev = run_and_wait('/api/claude/reply', {'deckId': A, 'text': 'make it pop', 'slide': 3})
    argv = fake_argv(ev)
    heard = next((e['text'] for e in ev if e['kind'] == 'say' and e['text'].startswith('[fake-heard] ')), '')
    user = next((e for e in ev if e['kind'] == 'user'), {})
    check('reply uses the deck quality (fast)', flag(argv, '--model') == 'sonnet' and flag(argv, '--effort') == 'low' and
          '--fallback-model' not in argv, argv)
    check('reply resumes the deck session', flag(argv, '--resume') == sessA, (flag(argv, '--resume'), sessA))
    check('slide prefix reaches Claude, user event keeps plain text', heard == '[fake-heard] [slide 3] make it pop' and
          user.get('text') == 'make it pop' and user.get('slide') == 3, (heard, user))
    check('reply bad slide -> 400', jpost('/api/claude/reply', {'deckId': A, 'text': 'x', 'slide': 0})[0] == 400)
    check('reply unknown deck -> 404', jpost('/api/claude/reply', {'deckId': 'nope123', 'text': 'x'})[0] == 404)
    check('reply bad deck id -> 400', jpost('/api/claude/reply', {'deckId': '../x', 'text': 'x'})[0] == 400)

    print('\n[new deck from start + choice marker]')
    jpost('/api/brief', {'basics': {'title': 'Ask deck'}, 'extra': {'notes': 'ask-me please'}})
    s, j, ev = run_and_wait('/api/claude/start', {})
    B = j.get('deckId')
    argv = fake_argv(ev)
    check('start without deckId makes a record', s == 200 and B and B != A and (AURA / 'decks' / f'{B}.json').is_file(), j)
    check('default quality is balanced', flag(argv, '--model') == 'sonnet' and flag(argv, '--effort') == 'high', argv)
    choice = '[[aura:choice id="q1" question="Which look?" options="Bold Blue|Flat-Pack|Claude chooses"]]'
    check('choice marker passes through untouched', any(e['kind'] == 'say' and choice in e['text'] for e in ev) and
          jget('/api/claude/status')[1].get('waiting') is True, [e['text'][:80] for e in ev if e['kind'] == 'say'])
    recB = jget(f'/api/decks/{B}')[1].get('deck', {})
    check('asking deck has a session but no file yet', recB.get('sessionId') and recB.get('status') == 'draft', recB)
    s, j, ev = run_and_wait('/api/claude/reply', {'deckId': B, 'text': 'Bold Blue'})
    recB = jget(f'/api/decks/{B}')[1].get('deck', {})
    check('answer finishes the deck', recB.get('file') == '4 - Your slides/Ask deck.html' and recB.get('status') == 'ready', recB)
    s, j, ev = run_and_wait('/api/claude/reply', {'deckId': A, 'text': 'back to the first deck'})
    check('switching decks resumes the right session', flag(fake_argv(ev), '--resume') == sessA and
          jget('/api/claude/status')[1].get('deckId') == A, flag(fake_argv(ev), '--resume'))

    print('\n[deck library]')
    (SLIDES / 'Old talk.html').write_text('<!doctype html><html><head><title>Old talk</title><style>.slide{width:1920px;height:1080px;'
                                          'font-size:60px}</style></head><body><section class="slide"><h1>Old talk</h1></section>'
                                          '</body></html>', encoding='utf-8')
    s, j = jget('/api/decks')
    decks = j.get('decks') or []
    ids = [d['id'] for d in decks]
    old = [d for d in decks if d.get('file') == '4 - Your slides/Old talk.html']
    check('GET /api/decks lists A and B', s == 200 and A in ids and B in ids, ids)
    check('loose deck migrated into a record', len(old) == 1 and old[0].get('migrated') and old[0].get('title') == 'Old talk' and
          old[0].get('status') == 'ready', old)
    check('migration does not duplicate', len([d for d in jget('/api/decks')[1]['decks'] if d.get('file') == '4 - Your slides/Old talk.html']) == 1)
    check('newest first', [d['updatedAt'] for d in decks] == sorted([d['updatedAt'] for d in decks], reverse=True))
    check('deck view has thumb url', next(d for d in decks if d['id'] == A).get('thumb', '').startswith(f'/api/decks/{A}/thumb.png?v='))
    check('unknown deck -> 404', jget('/api/decks/nope123')[0] == 404 and jget('/api/decks/..%2f..%2fx')[0] == 404)
    s, h, d = req('GET', f'/deck/{A}/')
    check('/deck/<id>/ serves the packed deck', s == 200 and h.get('content-type', '').startswith('text/html') and b'data-edit="s1-t1"' in d, s)
    s, h, d = req('GET', f'/deck/{A}')
    check('/deck/<id> redirects to the slash form', s == 301 and h.get('location') == f'/deck/{A}/', (s, h.get('location')))
    (SLIDES / 'pic.png').write_bytes(b'\x89PNG\r\n\x1a\nfake')
    check('/deck/<id>/<asset> serves a relative file', req('GET', f'/deck/{A}/pic.png')[0] == 200)
    for bad in ('/deck/nope123/', f'/deck/{A}/../../.aura/aura.config.json', f'/deck/{A}/%2e%2e/%2e%2e/.aura/aura.config.json',
                f'/deck/{A}/..%5c..%5c.aura%5caura.config.json', f'/deck/{A}/x.py', f'/deck/{A}/Old%20talk.html', f'/deck/{B}/.hidden.png'):
        check(f'blocked {bad[:50]}', req('GET', bad)[0] == 404)
    check('POST to /deck refused', req('POST', f'/deck/{A}/', {})[0] == 404)

    print('\n[thumbnails (real render with Edge)]')
    t0 = time.time()
    s, h, d = req('GET', f'/api/decks/{A}/thumb.png')
    check('thumb.png renders', s == 200 and h.get('content-type') == 'image/png' and d[:8] == b'\x89PNG\r\n\x1a\n', (s, d[:80]))
    print(f'    (first render {time.time() - t0:.1f}s)')
    t0 = time.time()
    s, j = jget(f'/api/decks/{A}/slides')
    check('slides list from cache', s == 200 and j.get('count') == 5 and len(j['slides']) == 5 and time.time() - t0 < 2, (s, j))
    check('slides have titles and urls', j.get('slides') and j['slides'][2]['n'] == 3 and
          j['slides'][2]['url'].startswith(f'/api/decks/{A}/slides/3.png?v=') and j['slides'][1]['title'] == 'The problem', j.get('slides'))
    s, h, d = req('GET', j['slides'][4]['url']) if j.get('slides') else (0, {}, b'')
    check('slide 5 png', s == 200 and d[:4] == b'\x89PNG')
    check('slide 9 -> 404', req('GET', f'/api/decks/{A}/slides/9.png')[0] == 404)
    check('PNG cached under .aura/temp/thumbs', (AURA / 'temp' / 'thumbs' / A / 'slide-01.png').is_file())
    jpost('/api/brief', {'basics': {'title': 'Draft only'}})
    D = jpost('/api/decks')[1].get('id')
    check('thumb of a draft deck -> 404', req('GET', f'/api/decks/{D}/thumb.png')[0] == 404)

    print('\n[direct text tweaks]')
    check('patch_text nested same tag', fs.patch_text('<div data-edit="a"><div>x</div></div><div>y</div>', 'a', 'Z') ==
          '<div data-edit="a">Z</div><div>y</div>')
    check('patch_text exact id only', fs.patch_text('<p data-edit="ab">1</p><p data-edit="a">2</p>', 'a', 'Q') ==
          '<p data-edit="ab">1</p><p data-edit="a">Q</p>')
    check('patch_text quotes, escaping, line breaks', fs.patch_text("<h2 class=t data-edit='s1'>old</h2>", 's1', 'a<b>&\nc') ==
          "<h2 class=t data-edit='s1'>a&lt;b&gt;&amp;<br>c</h2>")
    check('patch_text unquoted id', fs.patch_text('<span data-edit=s9 x>old</span>', 's9', 'n') == '<span data-edit=s9 x>n</span>')
    check('patch_text missing -> None', fs.patch_text('<p data-edit="b">x</p>', 'a', 'Z') is None)
    check('patch_text skips script text', fs.patch_text('<p data-edit="a">x<script>var s="</p>"</script>y</p>z', 'a', 'Q') == '<p data-edit="a">Q</p>z')
    packed = SLIDES / 'Heat pipes v3.html'
    build = AURA / 'temp' / 'build' / 'heat-pipes-v3' / 'index.html'
    s, j = jpost(f'/api/decks/{A}/text', {'editId': 's1-t2', 'text': 'Hello <b>world</b> & co'})
    want = 'data-edit="s1-t2">Hello &lt;b&gt;world&lt;/b&gt; &amp; co</p>'
    check('text tweak ok in packed + build', s == 200 and j.get('ok') and len(j.get('patched', [])) == 2 and
          want in packed.read_text(encoding='utf-8') and want in build.read_text(encoding='utf-8'), (s, j))
    before_p, before_b = packed.read_bytes(), build.read_bytes()
    s, j = jpost(f'/api/decks/{A}/text', {'editId': 's2-t1', 'text': 'A very long title ' * 8})
    check('too-small text rejected by the 26 px rule', s == 200 and j.get('ok') is False and j.get('error') == 'rules' and
          '26 px' in j.get('reason', ''), j)
    check('rejected tweak reverted both files', packed.read_bytes() == before_p and build.read_bytes() == before_b)
    check('unknown edit id -> 404', jpost(f'/api/decks/{A}/text', {'editId': 's9-t9', 'text': 'x'})[0] == 404)
    check('bad edit id -> 400', jpost(f'/api/decks/{A}/text', {'editId': '"><x', 'text': 'x'})[0] == 400)
    check('non-string text -> 400', jpost(f'/api/decks/{A}/text', {'editId': 's1-t1', 'text': 5})[0] == 400)
    check('text tweak on a draft -> 404', jpost(f'/api/decks/{D}/text', {'editId': 's1-t1', 'text': 'x'})[0] == 404)
    check('text tweak foreign origin -> 403', req('POST', f'/api/decks/{A}/text', {'editId': 's1-t1', 'text': 'x'},
                                                  headers={'Origin': 'http://evil.example'})[0] == 403)
    s, j = jget(f'/api/decks/{A}/slides')
    check('slide pictures re-rendered after a tweak', s == 200 and j.get('count') == 5 and
          json.loads((AURA / 'temp' / 'thumbs' / A / 'stamp.json').read_text(encoding='utf-8'))['mtime'] == packed.stat().st_mtime)

    print('\n[usage]')
    s, j = jget('/api/usage')
    u = j.get('usage') or {}
    check('usage from the last rate_limit_event', s == 200 and u.get('utilization') == 0.42 and u.get('status') == 'allowed' and
          isinstance(u.get('resetsAt'), int) and u.get('type') == 'five_hour' and u.get('capturedAt'), j)
    check('usage has subscriptionType', j.get('subscriptionType') == 'max', j)
    run_and_wait('/api/claude/reply', {'deckId': A, 'text': 'usage-windows check'})
    u = jget('/api/usage')[1].get('usage') or {}
    check('unifiedWindows.five_hour utilization read', u.get('utilization') == 0.81 and u.get('status') == 'allowed_warning' and
          u.get('resetsAt'), u)
    check('usage.json under .aura/temp', (AURA / 'temp' / 'usage.json').is_file())
    check('status has deckId + subscriptionType', jget('/api/claude/status')[1].get('subscriptionType') == 'max')


def run_health_suite():
    srv = start_server()
    try:
        s, j = jget('/api/health')
        checks = {c['id']: c for c in j.get('checks') or []}
        check('health lists every check', s == 200 and set(checks) >= {'engine', 'node', 'modules', 'edge', 'python', 'claude',
                                                                     'signin', 'disk', 'version'}, list(checks))
        check('every check has id/ok/label/detail', all({'id', 'ok', 'label', 'detail'} <= set(c) for c in checks.values()))
        for k in ('engine', 'node', 'modules', 'edge', 'claude', 'signin', 'disk'):
            check(f'{k} ok on this PC', checks.get(k, {}).get('ok'), checks.get(k))
        check('sandbox has no venv -> python check fails with pip fix', checks['python']['ok'] is False and checks['python'].get('fix') == 'pip',
              checks['python'])
        check('version check offline is fine', checks['version']['ok'] and checks['version'].get('blocking') is False, checks['version'])
        check('subscriptionType reported', j.get('subscriptionType') == 'max' and j.get('version'), j.get('subscriptionType'))
        print('  [fixes, fake commands]')
        s, j = jpost('/api/fix/npm')
        check('npm fix starts', s == 200 and j.get('started'), (s, j))
        check('second fix while running -> 409', jpost('/api/fix/pip')[0] == 409)
        t0 = time.time()
        while jget('/api/fix/status')[1].get('running') and time.time() - t0 < 20: time.sleep(0.2)
        st = jget('/api/fix/status')[1]
        check('npm fix finished ok with log', st.get('ok') is True and st.get('name') == 'npm' and
              any('fake npm step' in x for x in st.get('log', [])), st)
        s, j = jpost('/api/fix/update')
        check('update without the launcher -> friendly 404', s == 404 and j.get('error') == 'launcher-missing' and j.get('message'), j)
        (AURA / 'AuraSlide.exe').write_bytes(b'MZ not really')
        s, j = jpost('/api/fix/update')
        check('update with the launcher (no launch in tests)', s == 200 and j.get('ok'), j)
        (AURA / 'AuraSlide.exe').unlink()
        check('signin fix answers', jpost('/api/fix/signin')[0] == 200)
        check('unknown fix -> 404', jpost('/api/fix/bogus')[0] == 404)
        check('fix foreign origin -> 403', jpost('/api/fix/npm', headers={'Origin': 'http://evil.example'})[0] == 403)
    finally:
        stop_server(srv)
    srv = start_server(AURA_LATEST_VERSION='v9.9.0', AURA_HEALTH_FAIL='modules', AURA_FAKE_PLAN='free', AURA_FAKE_FIX_FAIL='pip')
    try:
        j = jget('/api/health')[1]
        checks = {c['id']: c for c in j.get('checks') or []}
        check('free plan -> premium message', checks['signin']['ok'] is False and 'Pro, Max or Team' in checks['signin']['label'], checks['signin'])
        check('newer release -> update offered', checks['version']['ok'] is False and checks['version'].get('fix') == 'update' and
              '9.9.0' in checks['version']['label'], checks['version'])
        check('simulated failure gets its fix', checks['modules']['ok'] is False and checks['modules'].get('fix') == 'npm', checks['modules'])
        check('overall not ok', j.get('ok') is False)
        jpost('/api/fix/pip')
        t0 = time.time()
        while jget('/api/fix/status')[1].get('running') and time.time() - t0 < 20: time.sleep(0.2)
        st = jget('/api/fix/status')[1]
        check('failing fix reported', st.get('ok') is False and st.get('name') == 'pip' and st.get('message'), st)
    finally:
        stop_server(srv)


def run_idle_suite():
    srv = start_server(AURA_IDLE_SECONDS=2, AURA_FAKE_LONG=12)
    try:
        jpost('/api/claude/reply', {'text': 'take-your-time again'})
        time.sleep(6)      # no requests for 3x the idle limit while Claude works
        check('server alive while Claude runs', srv.poll() is None)
        check('run still active', jget('/api/claude/status')[1].get('running') is True)
        jpost('/api/claude/stop')
        t0 = time.time()
        while srv.poll() is None and time.time() - t0 < 15: time.sleep(0.25)
        check('server shuts down when idle after the run', srv.poll() is not None, 'still running')
    finally:
        stop_server(srv)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc(); sys.exit(1)
