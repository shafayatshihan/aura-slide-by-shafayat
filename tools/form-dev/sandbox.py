"""Developer-only: make (or refresh) a throwaway Lumi folder for testing the REAL form server and Claude runner
without touching a real installation. Default location X:\\aura-dev (pass another path as the first argument).
  python tools/form-dev/sandbox.py [X:\\aura-dev] [--reset]
Then run the server against it:
  set AURA_HOME=X:\\aura-dev\\.aura && python engine/form_server.py --port 8766
The engine itself is used straight from the repo (live edits), only the user-side folders live in the sandbox.
The private Python (.aura/venv, the interpreter the skill tells Claude to run) is made too, exactly as setup.ps1 does
(python -m venv + the pythonPackages in setup/aura.config.json); without it every documented tool is unreachable for Claude
(SURVEY L-01). --no-venv skips it (offline / quick UI work). An existing working venv is left alone."""
import json, os, shutil, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
args = [a for a in sys.argv[1:] if not a.startswith('--')]
ROOT = Path(args[0] if args else r'X:\aura-dev')
AURA = ROOT / '.aura'
ENGINE_LINK = AURA / 'engine'                      # directory junction -> repo engine (hooks call .aura/engine/rules/...)

def drop_link():
    # remove the junction itself, never what it points to
    if ENGINE_LINK.exists() or os.path.islink(ENGINE_LINK) or getattr(os.path, 'isjunction', lambda p: False)(ENGINE_LINK):
        os.rmdir(ENGINE_LINK)

if '--reset' in sys.argv and ROOT.exists():
    drop_link()
    shutil.rmtree(ROOT)
for d in ['3 - Put your files here/Report', '3 - Put your files here/Images and photos', '3 - Put your files here/Data (csv, excel, graphs)',
          '3 - Put your files here/Logo and university template', '3 - Put your files here/Previous year reports',
          '3 - Put your files here/Journal papers', '3 - Put your files here/Anything else', '4 - Your slides/Older versions',
          '.aura/brief', '.aura/temp', '.aura/logs']:
    (ROOT / d).mkdir(parents=True, exist_ok=True)
cfg = json.loads((REPO / 'setup' / 'aura.config.json').read_text(encoding='utf-8'))
cfg['formPort'] = 8766
(AURA / 'aura.config.json').write_text(json.dumps(cfg, indent=2), encoding='utf-8')
if not ENGINE_LINK.exists():
    subprocess.run(['cmd', '/d', '/c', 'mklink', '/J', str(ENGINE_LINK), str(REPO / 'engine')], check=True, capture_output=True)
# Claude project files: fresh copy each time so skill/settings edits in the repo are picked up
if (ROOT / '.claude').exists():
    keep = (ROOT / '.claude' / 'settings.local.json').read_bytes() if (ROOT / '.claude' / 'settings.local.json').exists() else None
    shutil.rmtree(ROOT / '.claude')
else:
    keep = None
shutil.copytree(REPO / 'workspace' / '.claude', ROOT / '.claude')
if keep: (ROOT / '.claude' / 'settings.local.json').write_bytes(keep)
print(f'sandbox ready: {ROOT}\n  set AURA_HOME={AURA} && python engine/form_server.py --port 8766')

def make_venv():
    py = AURA / 'venv' / 'Scripts' / 'python.exe'
    if py.exists():
        r = subprocess.run([str(py), '-c', 'import PIL, pptx, docx, openpyxl, pypdf'], capture_output=True)
        if r.returncode == 0:
            print('  venv already works: ' + str(py)); return
    base = shutil.which('py') and ['py', '-3'] or [sys.executable]
    print('  making the private Python (.aura/venv) ...')
    subprocess.run(base + ['-m', 'venv', str(AURA / 'venv')], check=True)
    pkgs = cfg.get('pythonPackages') or []
    subprocess.run([str(py), '-m', 'pip', 'install', '--quiet', '--disable-pip-version-check'] + pkgs, check=True)
    print('  venv ready: ' + str(py))

if '--no-venv' in sys.argv:
    print('  (venv skipped: Claude will not find .aura/venv/Scripts/python.exe)')
else:
    try:
        make_venv()
    except Exception as e:
        print(f'  WARNING: could not make the venv ({e}). Claude runs will fail on every Python tool until it exists.')
