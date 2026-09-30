# Aura-Slide by Shafayat

Beautiful, animated presentation slides for your thesis, project or class talk, made by Claude from your own report
and files. It works for any subject, so you don't need to know any coding.

> ⚠️ **Only for Claude premium users. The free plan won't work, sadly.**
> You need a Claude Pro (or higher) account. Windows 10 or 11 only.

## Get started (about 20 minutes, once)

1. **Download** [`Aura-Slide-Setup.zip`](../../releases/latest/download/Aura-Slide-Setup.zip).
2. **Right-click** the ZIP → **Extract All** → **Extract**.
3. Open the new folder and **double-click `Setup Aura-Slide`**.
   - If Windows says *"Windows protected your PC"*: click **More info** → **Run anyway**.
   - If Windows asks *"Do you want to allow this app to make changes?"*: click **Yes**.
4. Wait for the green **All done!** message.

Setup installs anything missing: VS Code, Git, Node.js, Python, Claude Code and Claude for VS Code.
It then makes your folder at **`C:\Aura-Slide by Shafayat`**, with an **Aura-Slide** icon on your Desktop.

## Make your slides

1. Put your files into **`3 - Put your files here`**: report, images, data, logo, old reports and papers.
2. Double-click **`2 - Fill in the form`**, answer the questions and press **Save**.
3. Double-click **`Start Aura-Slide`**. In VS Code, click the **Claude** icon, sign in the first time, then type:

   ```
   show your aura
   ```
4. Your finished slides appear in **`4 - Your slides`**.

## Something went wrong?

- Run **Setup Aura-Slide** again. It continues where it stopped.
- Still stuck? Open your Aura-Slide folder and double-click **Send problem report**. Then send the ZIP that appears
  on your Desktop.

## For developers

| Path | What |
|---|---|
| `Setup Aura-Slide.bat` | Entry point: checks the ZIP was extracted, then runs `setup/setup.ps1` |
| `setup/setup.ps1` | Checks the PC, then installs tools with winget and Claude Code's installer, with a progress bar. Builds `C:\Aura-Slide by Shafayat`, the icon and the shortcuts |
| `setup/aura.config.json` | Version, repo/release URLs, VS Code extension ID, Python packages, form port |
| `engine/` | Copied to `.aura/engine`: form server and form, launchers, update, problem report, npm packages |
| `workspace/` | Copied to the user folder: `.claude/` (settings, CLAUDE.md, the `aura-slide` skill) and `.vscode/` |
| `tools/make_icon.py` | Regenerates `setup/icon/aura-slide.ico` |
| `tools/make_release.py` | Builds `release/Aura-Slide-Setup.zip` (user files only, plus the guide PDF) |
| `tools/build_guide.py` | Builds `docs/1 - Read me first.pdf` from the screenshots |
| `Publish to GitHub.bat` → `tools/publish.ps1` | One-click commit + push; the GitHub workflow then makes the release |

**Publishing:** double-click `Publish to GitHub.bat`. It commits and pushes; then `.github/workflows/release.yml`
builds `Aura-Slide-Setup.zip` (`tools/make_release.py`) and uploads it to the release named after `version` in
`setup/aura.config.json`. Same version: that release's zip is replaced. New version: a new release is made. The
download link `releases/latest/download/Aura-Slide-Setup.zip` always serves the newest build.
The guide PDF is rebuilt with `tools/build_guide.py`. Raw screenshots stay in `docs/screenshots/` and are never
committed, because they can show personal details.

## License

MIT © 2026 S. M. Shafayat Islam
