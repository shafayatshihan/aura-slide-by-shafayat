"""Builds release/Aura-Slide-Setup.zip: what users download. Files sit at the ZIP root, so "Extract All" gives one folder
with "Setup Aura-Slide" directly inside. Developer-only parts (tools, screenshots, GitHub workflow) are left out; the
The installer's C# source is left out too; the built
release/AuraSlide.exe (python tools/build_exe.py, run first) is shipped at the ZIP root as "AuraSlide.exe", where
setup.ps1 picks it up. Used locally and by the GitHub release workflow.
usage: python tools/make_release.py"""
import json, pathlib, zipfile

REPO = pathlib.Path(__file__).resolve().parent.parent
OUT = REPO / 'release' / 'Aura-Slide-Setup.zip'
SKIP_DIRS = {'tools', 'docs', 'release', 'installer', 'node_modules', '__pycache__', '.git', '.github'}
SKIP_FILES = {'.gitignore', '.gitattributes', 'Publish to GitHub.bat', 'preview_sheet.png'}
EXE = REPO / 'release' / 'AuraSlide.exe'

OUT.parent.mkdir(exist_ok=True)
n = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(REPO.rglob('*')):
        rel = p.relative_to(REPO)
        if p.is_dir() or SKIP_DIRS & set(rel.parts) or rel.name in SKIP_FILES:
            continue
        z.write(p, rel.as_posix()); n += 1
    if EXE.exists():
        z.write(EXE, EXE.name); n += 1
version = json.loads((REPO / 'setup' / 'aura.config.json').read_text(encoding='utf-8'))['version']
print(f'{OUT.name}: {n} files, {OUT.stat().st_size / 1e6:.2f} MB, version {version}' +
      ('' if EXE.exists() else '  (no AuraSlide.exe: run tools/build_exe.py first)'))
