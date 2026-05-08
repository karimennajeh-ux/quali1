
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
$g.DrawString("Etape 2 - Importer un document", $titleFont, $accent, 64, 52)
$g.DrawString("Choisir le fichier puis renseigner les metadonnees avant validation", $bodyFont, $muted, 64, 88)

$stepColor = [System.Drawing.Color]::FromArgb(255,36,92,204)
$bubbleBrush = New-Object System.Drawing.SolidBrush $stepColor
$g.FillEllipse($bubbleBrush, 1020, 36, 110, 46)
$g.DrawString("2 / 4", (New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)), ([System.Drawing.Brushes]::White), 1048, 48)


$panel = RR 58 150 1084 556 30
$g.FillPath($panelFill, $panel)
$g.DrawPath($panelBorder, $panel)
$g.DrawString("4. Importation vers la bibliotheque centrale", $subFont, $accent, 86, 178)
$g.DrawString("Reference", $smallFont, $muted, 86, 234)
$g.FillPath($soft, (RR 86 260 200 52 14))
$g.DrawPath($panelBorder, (RR 86 260 200 52 14))
$g.DrawString("PRO-SUP-001", $bodyFont, $accent, 126, 276)
$g.DrawString("Titre", $smallFont, $muted, 314, 234)
$g.FillPath($soft, (RR 314 260 420 52 14))
$g.DrawPath($panelBorder, (RR 314 260 420 52 14))
$g.DrawString("Procedure de maitrise documentaire", $bodyFont, $accent, 340, 276)
$g.DrawString("Processus", $smallFont, $muted, 760, 234)
$g.FillPath($soft, (RR 760 260 300 52 14))
$g.DrawPath($panelBorder, (RR 760 260 300 52 14))
$g.DrawString("Processus support", $bodyFont, $accent, 818, 276)
$g.DrawString("Type", $smallFont, $muted, 86, 338)
$g.FillPath($soft, (RR 86 364 180 52 14))
$g.DrawPath($panelBorder, (RR 86 364 180 52 14))
$g.DrawString("Procedure", $bodyFont, $accent, 128, 380)
$g.DrawString("Version", $smallFont, $muted, 286, 338)
$g.FillPath($soft, (RR 286 364 144 52 14))
$g.DrawPath($panelBorder, (RR 286 364 144 52 14))
$g.DrawString("1.0", $bodyFont, $accent, 340, 380)
$g.DrawString("Proprietaire", $smallFont, $muted, 452, 338)
$g.FillPath($soft, (RR 452 364 284 52 14))
$g.DrawPath($panelBorder, (RR 452 364 284 52 14))
$g.DrawString("Responsable qualite", $bodyFont, $accent, 520, 380)
$g.DrawString("Statut", $smallFont, $muted, 760, 338)
$g.FillPath($soft, (RR 760 364 186 52 14))
$g.DrawPath($panelBorder, (RR 760 364 186 52 14))
$g.DrawString("Brouillon", $bodyFont, $accent, 812, 380)
$g.DrawString("Fichier selectionne", $smallFont, $muted, 86, 442)
$g.FillPath($soft, (RR 86 468 660 58 14))
$g.DrawPath($panelBorder, (RR 86 468 660 58 14))
$g.DrawString("procedure_documentaire_v1.docx", $bodyFont, $accent, 132, 486)
$g.FillPath($accent, (RR 774 468 270 58 18))
$g.DrawString("Importer dans la bibliotheque", $bodyFont, ([System.Drawing.Brushes]::White), 826, 486)
$g.DrawString("Apres validation", $subFont, $accent, 86, 582)
$g.DrawString("Le document est copie sur D:, enregistre en base et visible dans la bibliotheque.", $smallFont, $muted, 86, 618)


$outFile = Join-Path $PSScriptRoot "step2_importer_document.png"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
