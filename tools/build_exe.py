"""Builds release/AuraSlide.exe (installer + launcher) from installer/AuraSlide.cs with the C# compiler that ships
inside Windows (.NET Framework 4.x csc.exe, C# 5) - no Visual Studio or SDK needed. The version comes from
setup/aura.config.json; the icon, the app picture and the character still are embedded in the exe.
Runs locally and on the GitHub windows-latest runner (release workflow).
usage: python tools/build_exe.py"""
import json, os, pathlib, subprocess, sys, tempfile

REPO = pathlib.Path(__file__).resolve().parent.parent
SRC = REPO / 'installer' / 'AuraSlide.cs'
OUT = REPO / 'release' / 'AuraSlide.exe'
ICON = REPO / 'setup' / 'icon' / 'aura-slide.ico'
RESOURCES = {  # embedded as AuraSlide.<name>
    'aura-slide.ico': ICON,
    'aura-slide.png': REPO / 'setup' / 'icon' / 'aura-slide.png',
    'character.jpg': REPO / 'installer' / 'character.jpg',
}
REFS = ['System.dll', 'System.Core.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.IO.Compression.dll',
        'System.IO.Compression.FileSystem.dll', 'System.Web.Extensions.dll']


def find_csc():
    windir = os.environ.get('WINDIR', r'C:\Windows')
    for fw in ('Framework64', 'Framework'):
        p = pathlib.Path(windir) / 'Microsoft.NET' / fw / 'v4.0.30319' / 'csc.exe'
        if p.exists():
            return p
    sys.exit('csc.exe (.NET Framework 4) was not found')


def main():
    cfg = json.loads((REPO / 'setup' / 'aura.config.json').read_text(encoding='utf-8'))
    parts = (str(cfg.get('version', '0.0.0')).split('.') + ['0', '0', '0', '0'])[:4]
    version = '.'.join(str(int(''.join(ch for ch in p if ch.isdigit()) or 0)) for p in parts)
    OUT.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        info = pathlib.Path(tmp) / 'Version.cs'
        info.write_text(
            'using System.Reflection;\n'
            f'[assembly: AssemblyVersion("{version}")]\n'
            f'[assembly: AssemblyFileVersion("{version}")]\n'
            '[assembly: AssemblyTitle("Aura-Slide")]\n'
            '[assembly: AssemblyDescription("Aura-Slide by Shafayat - installer and launcher")]\n'
            '[assembly: AssemblyProduct("Aura-Slide by Shafayat")]\n'
            '[assembly: AssemblyCompany("Shafayat")]\n'
            f'[assembly: AssemblyInformationalVersion("{cfg.get("version", version)}")]\n', encoding='ascii')
        cmd = [str(find_csc()), '/nologo', '/target:winexe', '/optimize+', '/platform:anycpu', '/utf8output',
               f'/out:{OUT}', f'/win32icon:{ICON}', f'/win32manifest:{REPO / "installer" / "AuraSlide.manifest"}']
        cmd += [f'/reference:{r}' for r in REFS]
        for name, path in RESOURCES.items():
            cmd.append(f'/resource:{path},AuraSlide.{name}')
        cmd += [str(SRC), str(info)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        out = (r.stdout + r.stderr).strip()
        if out:
            print(out)
        if r.returncode != 0:
            sys.exit(f'build failed (exit {r.returncode})')
    print(f'{OUT.relative_to(REPO)}: {OUT.stat().st_size / 1e3:.0f} KB, version {version}')


if __name__ == '__main__':
    main()
