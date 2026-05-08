
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
$g.DrawString("Etape 5 - Diffuser aux autres appareils", $titleFont, $accent, 64, 52)
$g.DrawString("Le PC serveur centralise les donnees, puis telephone, tablette et PC consultent la meme bibliotheque", $bodyFont, $muted, 64, 88)

$stepColor = [System.Drawing.Color]::FromArgb(255,36,92,204)
$bubbleBrush = New-Object System.Drawing.SolidBrush $stepColor
$g.FillEllipse($bubbleBrush, 1020, 36, 110, 46)
$g.DrawString("5 / 5", (New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)), ([System.Drawing.Brushes]::White), 1048, 48)


$server = RR 120 210 350 260 28
$g.FillPath($panelFill, $server)
$g.DrawPath($panelBorder, $server)
$g.DrawString("PC Serveur local", (New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)), $accent, 194, 244)
$g.DrawString("npm start", $subFont, $accent, 242, 288)
$g.DrawString("Base SQLite + depot documentaire sur D:", $bodyFont, $muted, 160, 330)
$g.DrawString("QUALI_DATA_SERVER", $bodyFont, $accent, 198, 360)
$g.FillPath($accent, (RR 170 404 250 42 16))
$g.DrawString("http://IP_DU_PC:3000", $bodyFont, ([System.Drawing.Brushes]::White), 206, 416)

$phone = RR 640 172 142 272 28
$g.FillPath($panelFill, $phone)
$g.DrawPath($panelBorder, $phone)
$g.DrawString("Telephone", $subFont, $accent, 668, 204)
$g.FillRectangle($soft, 670, 236, 84, 146)
$g.DrawRectangle($panelBorder, 670, 236, 84, 146)
$g.DrawString("Documentation", $smallFont, $muted, 676, 400)

$tablet = RR 812 202 210 210 28
$g.FillPath($panelFill, $tablet)
$g.DrawPath($panelBorder, $tablet)
$g.DrawString("Tablette", $subFont, $accent, 868, 234)
$g.FillRectangle($soft, 842, 266, 150, 98)
$g.DrawRectangle($panelBorder, 842, 266, 150, 98)
$g.DrawString("Meme bibliotheque", $smallFont, $muted, 860, 376)

$pc = RR 884 444 198 148 28
$g.FillPath($panelFill, $pc)
$g.DrawPath($panelBorder, $pc)
$g.DrawString("Autre PC", $subFont, $accent, 936, 470)
$g.FillRectangle($soft, 912, 504, 142, 44)
$g.DrawRectangle($panelBorder, 912, 504, 142, 44)
$g.DrawString("Acces reseau local", $smallFont, $muted, 930, 564)

$arrowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255,66,128,225)), 6
$arrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
$g.DrawLine($arrowPen, 470, 300, 636, 300)
$g.DrawLine($arrowPen, 470, 332, 812, 304)
$g.DrawLine($arrowPen, 470, 364, 882, 510)
$g.DrawString("Condition: tous les appareils sur le meme reseau", $bodyFont, $muted, 154, 540)
$g.DrawString("Resultat: modifications visibles presque a l'instant", $bodyFont, $accent, 154, 578)


$outFile = Join-Path $PSScriptRoot "step5_diffuser_reseau.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
