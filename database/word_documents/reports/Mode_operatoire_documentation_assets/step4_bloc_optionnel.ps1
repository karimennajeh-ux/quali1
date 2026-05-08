
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
$g.DrawString("Etape 4 - Comprendre le bloc optionnel", $titleFont, $accent, 64, 52)
$g.DrawString("Les documents de tete de la pyramide restent utiles, mais ils ne sont pas obligatoires", $bodyFont, $muted, 64, 88)

$stepColor = [System.Drawing.Color]::FromArgb(255,36,92,204)
$bubbleBrush = New-Object System.Drawing.SolidBrush $stepColor
$g.FillEllipse($bubbleBrush, 1020, 36, 110, 46)
$g.DrawString("4 / 5", (New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)), ([System.Drawing.Brushes]::White), 1048, 48)


$panel = RR 68 150 1064 556 30
$g.FillPath($panelFill, $panel)
$g.DrawPath($panelBorder, $panel)
$g.DrawString("Documents de tete de la pyramide (optionnel)", $subFont, $accent, 96, 178)
$g.DrawString("Ce bloc sert seulement si l'organisme souhaite suivre le manuel qualite et la politique qualite dans l'application.", $smallFont, $muted, 96, 214)

$card1 = RR 96 276 474 202 22
$card2 = RR 628 276 474 202 22
$g.FillPath($panelFill, $card1)
$g.FillPath($panelFill, $card2)
$g.DrawPath($panelBorder, $card1)
$g.DrawPath($panelBorder, $card2)

$g.DrawString("Manuel qualite", $subFont, $accent, 126, 304)
$g.DrawString("A utiliser seulement si ce document fait partie du systeme documentaire de l'organisme.", $smallFont, $muted, 126, 338)
$g.FillPath($soft, (RR 126 384 120 46 14))
$g.DrawPath($panelBorder, (RR 126 384 120 46 14))
$g.DrawString("Voir le modele", $smallFont, $accent, 146, 398)
$g.FillPath($accent, (RR 260 384 118 46 14))
$g.DrawString("Preparer", $smallFont, ([System.Drawing.Brushes]::White), 292, 398)
$g.FillPath($soft, (RR 392 384 118 46 14))
$g.DrawPath($panelBorder, (RR 392 384 118 46 14))
$g.DrawString("Selectionner", $smallFont, $accent, 416, 398)

$g.DrawString("Politique qualite", $subFont, $accent, 658, 304)
$g.DrawString("Si ce document n'est pas gere ici, tu peux laisser ce bloc sans action.", $smallFont, $muted, 658, 338)
$g.FillPath($soft, (RR 658 384 120 46 14))
$g.DrawPath($panelBorder, (RR 658 384 120 46 14))
$g.DrawString("Voir le modele", $smallFont, $accent, 678, 398)
$g.FillPath($accent, (RR 792 384 136 46 14))
$g.DrawString("Mettre a jour", $smallFont, ([System.Drawing.Brushes]::White), 822, 398)
$g.FillPath($soft, (RR 942 384 118 46 14))
$g.DrawPath($panelBorder, (RR 942 384 118 46 14))
$g.DrawString("Selectionner", $smallFont, $accent, 966, 398)

$g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,235,246,255))), (RR 96 530 1006 88 20))
$g.DrawPath($panelBorder, (RR 96 530 1006 88 20))
$g.DrawString("Message cle", $subFont, $accent, 126, 552)
$g.DrawString("Ce bloc est un raccourci guide. Il n'empeche pas l'importation, la recherche ou la diffusion des autres documents centraux.", $bodyFont, $muted, 126, 582)


$outFile = Join-Path $PSScriptRoot "step4_bloc_optionnel.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
