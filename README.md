# Lumi

Beautiful, animated presentation slides for your thesis, project or class talk, made by Claude from your own report
and files. It works for any subject, so you don't need to know any coding. (Lumi was called Aura-Slide before v0.4.)

> ⚠️ **Only for Claude premium users. The free plan won't work, sadly.**
> You need a Claude Pro (or higher) account. Windows 10 or 11 only.

## Get started (about 20 minutes, once)

1. **Download** [`Lumi.exe`](https://github.com/shafayatshihan/lumi/releases/latest/download/Lumi.exe) and double-click it.
   - If Windows says *"Windows protected your PC"*: click **More info** → **Run anyway**.
   - If Windows asks *"Do you want to allow this app to make changes?"*: click **Yes**.
2. Click **Install Lumi** and wait until it says **Lumi is ready**.

Lumi installs anything missing (Git, Node.js, Python and Claude Code), makes your folder at **`C:\Lumi`** and puts a
**Lumi** icon on your Desktop and in the Start menu.

Coming from Aura-Slide? Your files in `C:\Aura-Slide by Shafayat` are copied into `C:\Lumi`. The old folder is left
alone; delete it yourself once you have checked your files.

## Make your slides

1. Open **Lumi** from the Desktop icon and press **make a new deck**.
2. Answer the questions and drop in your report, images, data and logo (they go into `3 - Put your files here`).
3. Press **make my slides**. Claude builds them while you watch, and asks in the chat if it needs anything.
4. Your finished slides appear in your library and in **`4 - Your slides`**. Open one to change it with Claude.

## Something went wrong?

- Run `Lumi.exe` again and choose **Repair Lumi**. It continues where it stopped.
- Still stuck? Open your Lumi folder and double-click **Send problem report**. Then send the ZIP that appears on
  your Desktop.

## For developers

| Path | What |
|---|---|
| `installer/Lumi.cs` | `Lumi.exe`: installer, updater and launcher (WinForms, .NET Framework 4, built by `tools/build_exe.py`) |
| `setup/setup.ps1` | Run by `Lumi.exe` (or `Setup Lumi.bat`): checks the PC, installs the tools, builds `C:\Lumi`, the icon and the shortcuts, and copies an old Aura-Slide folder across |
| `setup/aura.config.json` | Version, repo/release URLs, Python packages, app port |
| `setup/icon/lumi/` | The Lumi icon (`lumi.ico` for the exe and shortcuts, `lumi.png` for the app) |
| `engine/` | Copied to `.aura/engine`: the app server and web app, launchers, update, problem report, npm packages |
| `workspace/` | Copied to the user folder: `.claude/` (settings, CLAUDE.md, the `aura-slide` skill) |
| `tools/make_release.py` | Builds `release/Lumi-Setup.zip` (the files `Lumi.exe` downloads) |
| `Publish to GitHub.bat` → `tools/publish.ps1` | One-click commit + push; the GitHub workflow then makes the release |

**Publishing:** double-click `Publish to GitHub.bat`. It commits and pushes; then `.github/workflows/release.yml`
builds `Lumi.exe` and `Lumi-Setup.zip` and uploads them to the release named after `version` in
`setup/aura.config.json`. Same version: that release's files are replaced. New version: a new release is made. The
links `releases/latest/download/Lumi.exe` and `.../Lumi-Setup.zip` always serve the newest build.

## License

MIT © 2026 S. M. Shafayat Islam

Lumi ships [power-design](https://github.com/ItsssssJack/power-design) by Jack Roberts (MIT) in
`workspace/.claude/skills/power-design/`, with its LICENSE file.
