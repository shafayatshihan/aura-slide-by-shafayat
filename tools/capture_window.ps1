# Screenshot one window (even if other windows cover it) for the guide's screenshots.
# usage: capture_window.ps1 -Title "*Aura-Slide setup*" -Out shot.png   (or -Hwnd <handle>)
param([string]$Title = '', [long]$Hwnd = 0, [string]$Out = 'shot.png', [switch]$List)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public static class W {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static List<KeyValuePair<IntPtr,string>> All() {
    var l = new List<KeyValuePair<IntPtr,string>>();
    EnumWindows((h, p) => { if (IsWindowVisible(h)) { var s = new StringBuilder(512); GetWindowText(h, s, 512); if (s.Length > 0) l.Add(new KeyValuePair<IntPtr,string>(h, s.ToString())); } return true; }, IntPtr.Zero);
    return l;
  }
}
'@
[void][W]::SetProcessDPIAware()
$wins = [W]::All()
if ($List) { $wins | ForEach-Object { '{0}  {1}' -f $_.Key, $_.Value }; exit }
$h = if ($Hwnd) { [IntPtr]$Hwnd } else { ($wins | Where-Object { $_.Value -like $Title } | Select-Object -First 1).Key }
if (-not $h -or $h -eq [IntPtr]::Zero) { Write-Error "window not found: $Title"; exit 1 }
$r = New-Object W+RECT; [void][W]::GetWindowRect($h, [ref]$r)
$v = New-Object W+RECT; $ok = [W]::DwmGetWindowAttribute($h, 9, [ref]$v, 16)   # visible frame (no invisible resize border)
$w = $r.R - $r.L; $hh = $r.B - $r.T
$bmp = New-Object Drawing.Bitmap $w, $hh
$g = [Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc(); [void][W]::PrintWindow($h, $dc, 2); $g.ReleaseHdc($dc); $g.Dispose()
if ($ok -eq 0) { $crop = New-Object Drawing.Rectangle ($v.L - $r.L), ($v.T - $r.T), ($v.R - $v.L), ($v.B - $v.T); $bmp = $bmp.Clone($crop, $bmp.PixelFormat) }
$bmp.Save($Out, [Drawing.Imaging.ImageFormat]::Png); "saved $Out  $($bmp.Width)x$($bmp.Height)"
