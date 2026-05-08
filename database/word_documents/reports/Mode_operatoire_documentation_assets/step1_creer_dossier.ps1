
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
$g.DrawString("Etape 1 - Creer un dossier documentaire", $titleFont, $accent, 64, 52)
$g.DrawString("Configurer la hierarchie puis lancer la creation du dossier sur D:", $bodyFont, $muted, 64, 88)

$stepColor = [System.Drawing.Color]::FromArgb(255,36,92,204)
$bubbleBrush = New-Object System.Drawing.SolidBrush $stepColor
$g.FillEllipse($bubbleBrush, 1020, 36, 110, 46)
$g.DrawString("1 / 4", (New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)), ([System.Drawing.Brushes]::White), 1048, 48)


$left = RR 54 150 508 556 30
$g.FillPath($panelFill, $left)
$g.DrawPath($panelBorder, $left)
$g.DrawString("1. Hierarchie documentaire sur D:", $subFont, $accent, 82, 178)
$g.DrawString("Processus 1", $smallFont, $muted, 82, 232)
$g.FillPath($soft, (RR 82 258 220 52 14))
$g.DrawPath($panelBorder, (RR 82 258 220 52 14))
$g.DrawString("Processus pilotage", $bodyFont, $accent, 104, 274)
$g.DrawString("Processus 2", $smallFont, $muted, 82, 334)
$g.FillPath($soft, (RR 82 360 220 52 14))
$g.DrawPath($panelBorder, (RR 82 360 220 52 14))
$g.DrawString("Processus operationnel", $bodyFont, $accent, 96, 376)
$g.DrawString("Processus 3", $smallFont, $muted, 82, 436)
$g.FillPath($soft, (RR 82 462 220 52 14))
$g.DrawPath($panelBorder, (RR 82 462 220 52 14))
$g.DrawString("Processus support", $bodyFont, $accent, 108, 478)
$g.FillPath($accent, (RR 82 566 250 58 18))
$g.DrawString("Enregistrer la hierarchie", $bodyFont, ([System.Drawing.Brushes]::White), 114, 585)

$right = RR 606 150 540 556 30
$g.FillPath($panelFill, $right)
$g.DrawPath($panelBorder, $right)
$g.DrawString("2. Creation des dossiers documentaires", $subFont, $accent, 634, 178)
$g.FillPath($soft, (RR 634 234 210 54 14))
$g.DrawPath($panelBorder, (RR 634 234 210 54 14))
$g.DrawString("Processus support", $bodyFont, $accent, 660, 250)
$g.FillPath($soft, (RR 858 234 160 54 14))
$g.DrawPath($panelBorder, (RR 858 234 160 54 14))
$g.DrawString("Procedure", $bodyFont, $accent, 902, 250)
$g.FillPath($soft, (RR 634 316 384 54 14))
$g.DrawPath($panelBorder, (RR 634 316 384 54 14))
$g.DrawString("PRO-SUP-001", $bodyFont, $accent, 772, 332)
$g.FillPath($soft, (RR 634 398 150 54 14))
$g.DrawPath($panelBorder, (RR 634 398 150 54 14))
$g.DrawString("v_1_0", $bodyFont, $accent, 684, 414)
$g.FillPath($accent, (RR 634 494 314 64 18))
$g.DrawString("Creer le dossier sur D:", (New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)), ([System.Drawing.Brushes]::White), 704, 515)
$g.DrawString("Resultat attendu", $subFont, $accent, 634, 602)
$g.DrawString("documents > pilote > processus > type > reference > version", $smallFont, $muted, 634, 638)


$outFile = Join-Path $PSScriptRoot "step1_creer_dossier.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
