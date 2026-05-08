
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 1200, 760
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle 0,0,1200,760),
  [System.Drawing.Color]::FromArgb(255,245,250,255),
  [System.Drawing.Color]::FromArgb(255,223,240,255),
  90
)
$g.FillRectangle($bg, 0, 0, 1200, 760)
$bg.Dispose()

function RR([int]$x,[int]$y,[int]$w,[int]$h,[int]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x,$y,$d,$d,180,90)
  $path.AddArc($x+$w-$d,$y,$d,$d,270,90)
  $path.AddArc($x+$w-$d,$y+$h-$d,$d,$d,0,90)
  $path.AddArc($x,$y+$h-$d,$d,$d,90,90)
  $path.CloseFigure()
  return $path
}

$white = [System.Drawing.Color]::FromArgb(248,255,255,255)
$panelBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255,194,220,252)), 2
$panelFill = New-Object System.Drawing.SolidBrush $white
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,41,107,216))
$soft = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,234,244,255))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,84,107,145))
$titleFont = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$bodyFont = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Regular)
$smallFont = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Regular)

$heroPath = RR 40 28 1120 92 24
$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235,255,255,255))), $heroPath)
$g.DrawPath((New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255,190,220,252)), 2), $heroPath)
$g.DrawString("Etape 3 - Retrouver un document", $titleFont, $accent, 64, 52)
$g.DrawString("Utiliser la recherche et les filtres dans la bibliotheque documentaire centralisee", $bodyFont, $muted, 64, 88)

$stepColor = [System.Drawing.Color]::FromArgb(255,36,92,204)
$bubbleBrush = New-Object System.Drawing.SolidBrush $stepColor
$g.FillEllipse($bubbleBrush, 1020, 36, 110, 46)
$g.DrawString("3 / 4", (New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)), ([System.Drawing.Brushes]::White), 1048, 48)


$panel = RR 56 150 1088 556 30
$g.FillPath($panelFill, $panel)
$g.DrawPath($panelBorder, $panel)
$g.DrawString("5. Bibliotheque documentaire centralisee", $subFont, $accent, 84, 178)
$g.FillPath($soft, (RR 84 236 484 54 14))
$g.DrawPath($panelBorder, (RR 84 236 484 54 14))
$g.DrawString("Rechercher: PRO-SUP-001", $bodyFont, $accent, 122, 252)
$g.FillPath($soft, (RR 590 236 190 54 14))
$g.DrawPath($panelBorder, (RR 590 236 190 54 14))
$g.DrawString("Processus support", $bodyFont, $accent, 624, 252)
$g.FillPath($soft, (RR 798 236 154 54 14))
$g.DrawPath($panelBorder, (RR 798 236 154 54 14))
$g.DrawString("Procedure", $bodyFont, $accent, 836, 252)
$g.FillPath($soft, (RR 968 236 146 54 14))
$g.DrawPath($panelBorder, (RR 968 236 146 54 14))
$g.DrawString("Brouillon", $bodyFont, $accent, 1004, 252)
$rows = @(
  @{ y = 332; ref = 'PRO-SUP-001'; title = 'Procedure de maitrise documentaire'; status = 'Brouillon' },
  @{ y = 420; ref = 'INS-SUP-004'; title = 'Instruction de classement'; status = 'Diffuse' }
)
foreach ($row in $rows) {
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,250,253,255))), (RR 84 $($row.y) 1030 72 18))
  $g.DrawPath($panelBorder, (RR 84 $($row.y) 1030 72 18))
  $g.DrawString($row.ref, $bodyFont, $accent, 112, ($row.y + 16))
  $g.DrawString($row.title, $bodyFont, $muted, 270, ($row.y + 16))
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,227,241,255))), (RR 826 ($row.y + 12) 120 40 12))
  $g.DrawString($row.status, $smallFont, $accent, 852, ($row.y + 23))
  $g.FillPath($accent, (RR 962 ($row.y + 10) 64 44 14))
  $g.DrawString("Lire", $smallFont, ([System.Drawing.Brushes]::White), 982, ($row.y + 23))
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,242,247,255))), (RR 1038 ($row.y + 10) 64 44 14))
  $g.DrawPath($panelBorder, (RR 1038 ($row.y + 10) 64 44 14))
  $g.DrawString("Fiche", $smallFont, $accent, 1054, ($row.y + 23))
}
$g.DrawString("Tu retrouves ensuite le document par reference, processus, type ou statut.", $smallFont, $muted, 84, 644)


$outFile = Join-Path $PSScriptRoot "step3_retrouver_document.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
