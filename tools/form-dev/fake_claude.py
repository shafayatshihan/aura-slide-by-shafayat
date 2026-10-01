"""Developer-only stand-in for the Claude CLI, used by the real form server when AURA_FAKE_CLAUDE points here.
Reads the message from stdin and prints realistic stream-json (same shapes the real `claude -p --output-format
stream-json --verbose` prints on this PC), writes a small sample deck into "4 - Your slides" and honours --resume.
Also answers `auth status` / `auth login`.

Trigger words (in the message, or for the first run also in the brief's notes):
  ask-me          first run asks a question with [[aura:choice ...]] + [[aura:ask]] and ends its turn
  take-your-time  works slowly for up to AURA_FAKE_LONG seconds (default 60), for stop/idle tests
  auth-fail       behaves like a signed-out CLI
  rate-limit      hits the usage limit
  usage-windows   the rate_limit_event carries unifiedWindows.five_hour (instead of a top-level utilization)
  crash           dies without a result line
Every run first says "[fake-argv] <json list of its arguments>" so tests can check the flags (--model, --resume ...),
and a resumed run also says "[fake-heard] <the message>" (to check the [slide N] prefix).
A finished deck ends with 3 [[aura:hint slide=N text="..."]] lines. The deck is written both as a build source
(.aura/temp/build/<slug>/index.html) and as the packed file, with data-edit ids on every text; slide 2's title
(data-edit="s2-t1") shrinks to fit its box, so a very long text there breaks the 26 px rule.
Env: AURA_FAKE_DELAY seconds between lines (default 0.35), AURA_FAKE_LOGGED_IN=0 for a signed-out status,
AURA_FAKE_PLAN=<subscriptionType> (default max)."""
import html as htm, json, os, re, sys, time, uuid
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
args = sys.argv[1:]
DELAY = float(os.environ.get('AURA_FAKE_DELAY', '0.35'))


def out(obj):
    print(obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False), flush=True)
    time.sleep(DELAY)


if args[:2] == ['auth', 'status']:
    ok = os.environ.get('AURA_FAKE_LOGGED_IN', '1') != '0'
    info = {'loggedIn': ok, 'authMethod': 'claude.ai' if ok else 'none', 'apiProvider': 'firstParty'}
    if ok: info['subscriptionType'] = os.environ.get('AURA_FAKE_PLAN', 'max')
    print(json.dumps(info, indent=2))
    sys.exit(0 if ok else 1)
if args[:2] == ['auth', 'login']:
    print('Opening your browser to sign in... (fake)'); time.sleep(2); print('Login successful.'); sys.exit(0)

message = sys.stdin.read()
resume = args[args.index('--resume') + 1] if '--resume' in args else None
session = resume or str(uuid.uuid4())
cwd = Path.cwd()
brief = {}
try:
    brief = json.loads((cwd / '.aura' / 'brief' / 'brief.json').read_text(encoding='utf-8'))
except Exception:
    pass
notes = str((brief.get('extra') or {}).get('notes') or '')
trigger = lambda w: w in message or (not resume and w in notes)
n_tool = [0]


def say(text):
    out({'type': 'assistant', 'message': {'id': 'msg_' + uuid.uuid4().hex[:12], 'type': 'message', 'role': 'assistant',
                                          'content': [{'type': 'text', 'text': text}]}, 'session_id': session})


def tool(name, inp, result, error=False):
    n_tool[0] += 1
    tid = f'toolu_fake{n_tool[0]:03d}'
    out({'type': 'assistant', 'message': {'role': 'assistant', 'content': [{'type': 'tool_use', 'id': tid, 'name': name, 'input': inp}]},
         'session_id': session})
    out({'type': 'user', 'message': {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': tid, 'content': result,
                                                                 'is_error': error}]}, 'session_id': session})


def result(text, error=False, sub='success'):
    out({'type': 'result', 'subtype': sub, 'is_error': error, 'duration_ms': 4200, 'num_turns': n_tool[0] + 1,
         'result': text, 'session_id': session, 'total_cost_usd': 0})


out('Ignoring 15 permissions.allow entries from .claude/settings.json: this folder has not been trusted yet (fake)')
out({'type': 'system', 'subtype': 'hook_started', 'hook_name': 'SessionStart:startup', 'session_id': session})
out({'type': 'system', 'subtype': 'init', 'session_id': session, 'cwd': str(cwd), 'model': 'fake-claude',
     'tools': ['Read', 'Write', 'Edit', 'Bash'], 'permissionMode': 'acceptEdits'})
say('[fake-argv] ' + json.dumps(args, ensure_ascii=False))
if resume: say('[fake-heard] ' + message[:300])

if 'auth-fail' in message:
    result('Invalid API key · Please run /login', error=True)
    sys.exit(1)
if 'crash' in message:
    print('Error: something went badly wrong (fake crash)', file=sys.stderr, flush=True)
    sys.exit(3)
if 'usage-windows' in message:
    out({'type': 'rate_limit_event', 'rate_limit_info': {'status': 'allowed_warning', 'rateLimitType': 'five_hour',
         'unifiedWindows': {'five_hour': {'utilization': 0.81, 'resetsAt': int(time.time()) + 1800}}}})
else:
    out({'type': 'rate_limit_event', 'rate_limit_info': {'status': 'allowed', 'resetsAt': int(time.time()) + 3600,
         'rateLimitType': 'five_hour', 'utilization': 0.42}})
if 'rate-limit' in message:
    out({'type': 'rate_limit_event', 'rate_limit_info': {'status': 'rejected', 'resetsAt': int(time.time()) + 5400,
         'rateLimitType': 'five_hour', 'utilization': 1.0}})
    result("You've hit your limit · resets 3pm", error=True)
    sys.exit(1)

title = str((brief.get('basics') or {}).get('title') or 'My talk').strip() or 'My talk'
# a resumed session keeps working on its own deck (the draft brief may belong to a newer deck by now)
memo = cwd / '.aura' / 'temp' / 'fake-sessions.json'
try:
    sessions = json.loads(memo.read_text(encoding='utf-8'))
except Exception:
    sessions = {}
if resume and sessions.get(session): title = sessions[session]
else:
    sessions[session] = title
    memo.parent.mkdir(parents=True, exist_ok=True)
    memo.write_text(json.dumps(sessions, indent=2), encoding='utf-8')
safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', title)[:60].strip(' .') or 'My talk'
deck_rel = f'4 - Your slides/{safe}.html'
slug = re.sub(r'[^a-z0-9]+', '-', safe.lower()).strip('-') or 'deck'
build_rel = f'.aura/temp/build/{slug}/index.html'

if resume:
    say(f'Thanks, got it! Picking up where we left off (session {session[:8]}).')
else:
    say('[[aura:stage=read]]\nHi! I’m reading your brief and your files first.')
    tool('Read', {'file_path': str(cwd / '.aura' / 'brief' / 'brief.md')}, '# Presentation brief ...')
    tool('Bash', {'command': 'node --version', 'description': 'Check Node'}, 'v24.21.0')
    tool('Bash', {'command': 'python .aura/engine/tools/extract_text.py "3 - Put your files here/Report"'},
         'No report found in "Report". Using the brief only.', error=True)
    if trigger('ask-me'):
        q = ('Quick question before I start.\n'
             '[[aura:choice id="q1" question="Which look?" options="Bold Blue|Flat-Pack|Claude chooses"]]\n[[aura:ask]]')
        say(q); result(q); sys.exit(0)

if trigger('take-your-time'):
    say('[[aura:stage=plan]]\nThis one needs some careful thought, give me a moment.')
    end = time.time() + float(os.environ.get('AURA_FAKE_LONG', '60'))
    while time.time() < end:
        time.sleep(0.5)

say('[[aura:stage=plan]]\nPlanning 5 slides for your talk.')
tool('TodoWrite', {'todos': [{'content': 'Build slides', 'status': 'in_progress'}]}, 'ok')
say('[[aura:stage=build]]\nBuilding the slides now.')
deck = cwd / deck_rel
build = cwd / build_rel
slides = ''.join(
    f'<section class="slide"><h1 data-edit="s{i}-t1"{fit}>{htm.escape(h)}</h1><p data-edit="s{i}-t2">{htm.escape(p)}</p></section>'
    for i, (h, p, fit) in enumerate([
        (title, 'A sample deck made by the fake Claude.', ''),
        ('The problem', 'Why this matters, in one line.', ' class="fit"'),
        ('What we did', 'Method in three simple steps.', ''), ('Results', 'The numbers that matter.', ''),
        ('Thank you', 'Questions?', '')], 1))
html_text = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + htm.escape(title) + '</title><style>'
             'body{margin:0;background:#EEEDF9;font-family:system-ui;color:#080909}'
             '.slide{width:1920px;height:1080px;display:flex;flex-direction:column;justify-content:center;padding:0 192px;'
             'box-sizing:border-box;overflow:hidden}'
             'h1{font-size:64px;margin:0 0 16px}p{font-size:32px;margin:0}'
             '.fit{width:900px;white-space:nowrap;overflow:hidden}</style></head><body>' + slides +
             '<script>document.querySelectorAll(".fit").forEach(function(e){var s=64;'
             'while(e.scrollWidth>e.clientWidth&&s>6){s--;e.style.fontSize=s+"px";}});</script></body></html>')
for f in (build, deck):
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(html_text, encoding='utf-8', newline='\n')
tool('Write', {'file_path': str(build), 'content': '<!doctype html>...'}, f'File created successfully at: {build}')
tool('Bash', {'command': f'.aura/venv/Scripts/python.exe .aura/engine/tools/pack_deck.py .aura/temp/build/{slug}'},
     f'Packed: {deck_rel}')
if resume:
    tool('Edit', {'file_path': str(build), 'old_string': 'a', 'new_string': 'b'}, 'The file has been updated.')
say('[[aura:stage=check]]\nChecking every slide: all text is 26 px or larger.')
tool('Bash', {'command': 'node .aura/engine/tools/deck_check.js .aura/temp/build/' + slug}, 'OK: 5 slides, 0 problems')
say('[[aura:stage=export]]\nMaking the PDF backup.')
tool('Bash', {'command': 'node .aura/engine/tools/export_pdf.js "' + deck_rel + '"'}, 'PDF written')
final = (f'[[aura:stage=done]]\n[[aura:done path="{deck_rel}"]]\nYour slides are ready: 5 slides, plus a PDF backup.\n'
         '[[aura:hint slide=1 text="make the title shorter"]]\n'
         '[[aura:hint slide=3 text="add a simple diagram of the method"]]\n'
         '[[aura:hint slide=4 text="show the results as a bar chart"]]')
say(final)
result(final)
