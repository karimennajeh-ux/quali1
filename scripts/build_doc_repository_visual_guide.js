const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const docsRoot = path.join(root, "database", "word_documents");
const reportsDir = path.join(docsRoot, "reports");
const assetsDir = path.join(reportsDir, "Mode_operatoire_documentation_assets");
const runId = String(Date.now());
const srcDir = path.join(docsRoot, `_docx_src_doc_visual_guide_${runId}`);
const dayStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const fileBase = `Mode_operatoire_documentation_pas_a_pas_illustre_${dayStamp}`;
const docxPath = path.join(reportsDir, `${fileBase}_${runId}.docx`);
const zipPath = path.join(reportsDir, `${fileBase}_${runId}.zip`);

fs.mkdirSync(path.join(srcDir, "_rels"), { recursive: true });
fs.mkdirSync(path.join(srcDir, "docProps"), { recursive: true });
fs.mkdirSync(path.join(srcDir, "word", "_rels"), { recursive: true });
fs.mkdirSync(path.join(srcDir, "word", "media"), { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function paragraph(text, opts = {}) {
  const {
    style = null,
    align = null,
    bold = false,
    italic = false,
    color = null,
    size = null,
    spacingBefore = null,
    spacingAfter = null,
    keepNext = false,
    pageBreakBefore = false
  } = opts;
  const pPr = [];
  if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
  if (align) pPr.push(`<w:jc w:val="${align}"/>`);
  if (spacingBefore !== null || spacingAfter !== null) {
    pPr.push(
      `<w:spacing${spacingBefore !== null ? ` w:before="${spacingBefore}"` : ""}${spacingAfter !== null ? ` w:after="${spacingAfter}"` : ""}/>`
    );
  }
  if (keepNext) pPr.push("<w:keepNext/>");
  if (pageBreakBefore) pPr.push("<w:pageBreakBefore/>");

  const rPr = [];
  if (bold) rPr.push("<w:b/>");
  if (italic) rPr.push("<w:i/>");
  if (color) rPr.push(`<w:color w:val="${color}"/>`);
  if (size) rPr.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);

  return `<w:p>${pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : ""}<w:r>${rPr.length ? `<w:rPr>${rPr.join("")}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function bullets(items) {
  return items.map((item) => paragraph(`• ${item}`, { style: "BodyText", spacingAfter: 60 })).join("");
}

function imageParagraph(relId, cx, cy, name, caption = "") {
  const drawing = `<w:p>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:docPr id="${Math.floor(Math.random() * 100000)}" name="${esc(name)}"/>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="0" name="${esc(name)}"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
  return drawing + (caption ? paragraph(caption, { style: "FigureCaption", align: "center", spacingAfter: 180 }) : "");
}

function buildPng(imagePath, config) {
  const fileName = path.basename(imagePath);
  const psScript = `
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap ${config.width}, ${config.height}
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle 0,0,${config.width},${config.height}),
  [System.Drawing.Color]::FromArgb(255,245,250,255),
  [System.Drawing.Color]::FromArgb(255,223,240,255),
  90
)
$g.FillRectangle($bg, 0, 0, ${config.width}, ${config.height})
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
$g.DrawString("${config.header}", $titleFont, $accent, 64, 52)
$g.DrawString("${config.subheader}", $bodyFont, $muted, 64, 88)

$stepColor = [System.Drawing.Color]::FromArgb(255,36,92,204)
$bubbleBrush = New-Object System.Drawing.SolidBrush $stepColor
$g.FillEllipse($bubbleBrush, 1020, 36, 110, 46)
$g.DrawString("${config.stepTag}", (New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)), ([System.Drawing.Brushes]::White), 1048, 48)

${config.draw}

$outFile = Join-Path $PSScriptRoot "${fileName}"
$bmp.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
`;
  const psPath = path.join(assetsDir, `${path.parse(imagePath).name}.ps1`);
  fs.writeFileSync(psPath, psScript, "utf8");
  execFileSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", psPath], { stdio: "inherit" });
}

const imageDefs = [
  {
    name: "step1_creer_dossier.png",
    header: "Etape 1 - Creer un dossier documentaire",
    subheader: "Configurer la hierarchie puis lancer la creation du dossier sur D:",
    stepTag: "1 / 4",
    width: 1200,
    height: 760,
    draw: `
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
`
  },
  {
    name: "step2_importer_document.png",
    header: "Etape 2 - Importer un document",
    subheader: "Choisir le fichier puis renseigner les metadonnees avant validation",
    stepTag: "2 / 4",
    width: 1200,
    height: 760,
    draw: `
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
`
  },
  {
    name: "step3_retrouver_document.png",
    header: "Etape 3 - Retrouver un document",
    subheader: "Utiliser la recherche et les filtres dans la bibliotheque documentaire centralisee",
    stepTag: "3 / 4",
    width: 1200,
    height: 760,
    draw: `
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
`
  },
  {
    name: "step4_bloc_optionnel.png",
    header: "Etape 4 - Comprendre le bloc optionnel",
    subheader: "Les documents de tete de la pyramide restent utiles, mais ils ne sont pas obligatoires",
    stepTag: "4 / 5",
    width: 1200,
    height: 760,
    draw: `
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
`
  },
  {
    name: "step5_diffuser_reseau.png",
    header: "Etape 5 - Diffuser aux autres appareils",
    subheader: "Le PC serveur centralise les donnees, puis telephone, tablette et PC consultent la meme bibliotheque",
    stepTag: "5 / 5",
    width: 1200,
    height: 760,
    draw: `
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
`
  }
];

for (const image of imageDefs) {
  buildPng(path.join(assetsDir, image.name), image);
  fs.copyFileSync(path.join(assetsDir, image.name), path.join(srcDir, "word", "media", image.name));
}

const mediaRels = [
  { id: "rId1", target: "styles.xml", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" },
  { id: "rId2", target: "settings.xml", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" },
  { id: "rId3", target: "media/step1_creer_dossier.png", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" },
  { id: "rId4", target: "media/step2_importer_document.png", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" },
  { id: "rId5", target: "media/step3_retrouver_document.png", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" },
  { id: "rId6", target: "media/step4_bloc_optionnel.png", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" },
  { id: "rId7", target: "media/step5_diffuser_reseau.png", type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" }
];

const body = [
  paragraph("QUALI by ENNAJEH", { style: "CoverBrand", align: "center", spacingAfter: 70 }),
  paragraph("Mode operatoire illustre", { style: "CoverMinor", align: "center", spacingAfter: 40 }),
  paragraph("Utilisation du module Documentation", { style: "CoverTitle", align: "center", spacingAfter: 70 }),
  paragraph("Creation d'un dossier - Importation d'un document - Recherche - Bloc optionnel - Diffusion sur le reseau local", {
    style: "QuoteText",
    align: "center",
    spacingAfter: 180
  }),
  paragraph("Document pedagogique pas a pas", { style: "CoverMinor", align: "center", spacingAfter: 0 }),

  paragraph("1. Objet", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph(
    "Ce mode operatoire explique pas a pas comment utiliser le module Documentation pour creer un dossier documentaire, importer un document, le retrouver dans la bibliotheque centralisee puis le rendre accessible aux autres appareils relies au meme reseau local.",
    { style: "BodyText" }
  ),

  paragraph("2. Conditions prealables", { style: "Heading1", keepNext: true }),
  bullets([
    "Le serveur local doit etre demarre avec la commande npm start.",
    "Le compte pilote ou le responsable qualite doit etre connecte a l'application.",
    "Le poste principal doit rester allume pendant l'utilisation multi-appareils.",
    "Les autres appareils doivent etre connectes au meme reseau local."
  ]),

  paragraph("3. Etape 1 - Creer un dossier documentaire", { style: "Heading1", keepNext: true }),
  paragraph(
    "Dans le module Documentation, commencer par definir la hierarchie documentaire puis utiliser la zone de creation des dossiers. Renseigner le processus, le type, la reference et la version, puis cliquer sur le bouton de creation.",
    { style: "BodyText" }
  ),
  imageParagraph("rId3", 5486400, 3474720, "Etape 1", "Figure 1 - Exemple de creation d'un dossier documentaire depuis le module Documentation."),
  bullets([
    "Ouvrir le bloc 'Hierarchie documentaire sur D:'.",
    "Verifier ou ajuster les processus documentaires.",
    "Ouvrir ensuite 'Creation des dossiers documentaires'.",
    "Renseigner le processus, le type, la reference et la version.",
    "Cliquer sur le bouton de creation pour generer le dossier sur D:."
  ]),

  paragraph("4. Etape 2 - Importer un document", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph(
    "Apres la creation du dossier, utiliser le bloc d'importation pour selectionner le fichier et saisir les metadonnees. L'application copie alors le document dans le depot central et l'enregistre dans la base.",
    { style: "BodyText" }
  ),
  imageParagraph("rId4", 5486400, 3474720, "Etape 2", "Figure 2 - Importation d'un document avec reference, titre, processus, type, version et statut."),
  bullets([
    "Cliquer sur la zone de selection du fichier.",
    "Choisir le document Word, PDF, Excel ou autre fichier autorise.",
    "Renseigner la reference, le titre, le processus, le type, le proprietaire et le statut.",
    "Valider l'importation vers la bibliotheque centrale."
  ]),

  paragraph("5. Etape 3 - Retrouver un document dans la bibliotheque", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph(
    "Une fois le document importe, il apparait dans la bibliotheque documentaire centralisee. La recherche peut se faire par texte, par processus, par type ou par statut.",
    { style: "BodyText" }
  ),
  imageParagraph("rId5", 5486400, 3474720, "Etape 3", "Figure 3 - Recherche et consultation d'un document dans la bibliotheque documentaire centralisee."),
  bullets([
    "Saisir la reference ou une partie du titre dans la recherche.",
    "Filtrer par processus si necessaire.",
    "Filtrer par type ou par statut pour reduire les resultats.",
    "Utiliser 'Lire' pour ouvrir le document ou 'Fiche' pour consulter ses informations."
  ]),

  paragraph("6. Etape 4 - Comprendre le bloc optionnel", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph(
    "Le bloc 'Documents de tete de la pyramide' n'est pas obligatoire. Il sert uniquement si l'organisme souhaite preparer ou suivre le manuel qualite et la politique qualite dans l'application.",
    { style: "BodyText" }
  ),
  imageParagraph("rId6", 5486400, 3474720, "Etape 4", "Figure 4 - Bloc optionnel pour le manuel qualite et la politique qualite dans le module Documentation."),
  bullets([
    "Tu peux laisser ce bloc sans action si ton besoin principal est le depot documentaire central.",
    "Utiliser 'Voir le modele' pour consulter un exemple de structure.",
    "Utiliser 'Preparer' ou 'Mettre a jour' seulement si l'organisme veut suivre ces documents dans l'application.",
    "Utiliser 'Selectionner' pour preparer rapidement le type documentaire dans le formulaire."
  ]),

  paragraph("7. Etape 5 - Diffuser aux autres appareils", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph(
    "Le PC principal joue le role de serveur local. Les autres appareils consultent les memes donnees en ouvrant l'application via l'adresse reseau du poste principal. Ainsi, la bibliotheque documentaire reste centralisee.",
    { style: "BodyText" }
  ),
  imageParagraph("rId7", 5486400, 3474720, "Etape 5", "Figure 5 - Principe de diffusion du depot documentaire local vers telephone, tablette et autres PC."),
  bullets([
    "Lancer le serveur local avec npm start sur le PC principal.",
    "Relever l'adresse du type http://IP_DU_PC:3000.",
    "Ouvrir cette adresse depuis le telephone, la tablette ou un autre PC connecte au meme reseau.",
    "Verifier que les documents, statuts et historiques sont visibles sur tous les appareils."
  ]),

  paragraph("8. Bonnes pratiques", { style: "Heading1", keepNext: true }),
  bullets([
    "Creer les dossiers et importer les documents uniquement via l'application.",
    "Eviter de renommer manuellement les dossiers dans l'explorateur Windows.",
    "Eviter de deplacer directement un fichier deja enregistre dans la bibliotheque.",
    "Utiliser les statuts documentaires pour garder un cycle de vie clair et traçable."
  ]),

  paragraph("9. Emplacement du depot documentaire", { style: "Heading1", keepNext: true }),
  paragraph(
    "Le depot documentaire central actuellement utilise par l'application est localise dans le dossier suivant :",
    { style: "BodyText" }
  ),
  paragraph(
    "D:\\stage prjet fin d'étude 2026\\cahier de charge d'application\\database\\QUALI_DATA_SERVER",
    { style: "BodyText", italic: true, color: "1F4E79" }
  ),
  paragraph(
    "L'application cree ensuite la structure documents > pilote > processus > type > reference > version pour organiser les fichiers de l'organisme.",
    { style: "BodyText" }
  ),

  paragraph("10. Conclusion", { style: "Heading1", keepNext: true }),
  paragraph(
    "Le module Documentation doit etre utilise comme point unique de creation, de classement, de lecture et de diffusion des documents. Cette methode permet de garder une organisation stable, une base centralisee et une consultation immediate sur le reseau local.",
    { style: "BodyText" }
  )
].join("");

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${mediaRels.map((rel) => `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>`).join("")}
</Relationships>`;

const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Mode operatoire illustre - Module Documentation</dc:title>
  <dc:subject>Documentation centralisee</dc:subject>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:keywords>documentation; dossier; import; reseau; guide illustre</cp:keywords>
  <dc:description>Mode operatoire illustre pour creer un dossier, importer un document, le retrouver et le diffuser sur le reseau local.</dc:description>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-05-08T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-05-08T00:00:00Z</dcterms:modified>
</cp:coreProperties>`;

const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Quali by ENNAJEH</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Title</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>${fileBase}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company>ENNAJEH</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0</AppVersion>
</Properties>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos" w:cs="Aptos"/>
        <w:color w:val="24324A"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="fr-FR"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="BodyText">
    <w:name w:val="Body Text"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:after="120"/><w:jc w:val="both"/></w:pPr>
    <w:rPr><w:color w:val="24324A"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="BodyText"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="220" w:after="120"/><w:keepNext/></w:pPr>
    <w:rPr><w:b/><w:color w:val="1F4E79"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CoverTitle">
    <w:name w:val="Cover Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="1F4E79"/><w:sz w:val="34"/><w:szCs w:val="34"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CoverBrand">
    <w:name w:val="Cover Brand"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:color w:val="0F6CBD"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CoverMinor">
    <w:name w:val="Cover Minor"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="80"/></w:pPr>
    <w:rPr><w:color w:val="5B667A"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:i/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="QuoteText">
    <w:name w:val="Quote Text"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="140"/><w:ind w:left="320" w:right="320"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="5B667A"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="FigureCaption">
    <w:name w:val="Figure Caption"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="center"/><w:spacing w:after="140"/></w:pPr>
    <w:rPr><w:i/><w:color w:val="5B667A"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>
  </w:style>
</w:styles>`;

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" mc:Ignorable="w14 w15 wp14">
  <w:body>
    ${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1247" w:right="1191" w:bottom="1247" w:left="1304" w:header="708" w:footer="708" w:gutter="0"/>
      <w:cols w:space="708"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

const files = {
  "[Content_Types].xml": contentTypes,
  "_rels/.rels": rels,
  "docProps/core.xml": core,
  "docProps/app.xml": app,
  "word/document.xml": documentXml,
  "word/styles.xml": styles,
  "word/settings.xml": settings,
  "word/_rels/document.xml.rels": docRels
};

for (const [relPath, content] of Object.entries(files)) {
  const target = path.join(srcDir, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `$ErrorActionPreference = 'Stop'; Compress-Archive -Path "${srcDir}\\*" -DestinationPath "${zipPath}" -Force; Copy-Item -LiteralPath "${zipPath}" -Destination "${docxPath}" -Force; if (Test-Path -LiteralPath "${zipPath}") { Remove-Item -LiteralPath "${zipPath}" -Force -ErrorAction SilentlyContinue }; exit 0`
  ],
  { stdio: "inherit" }
);

console.log(JSON.stringify({ docxPath, assetsDir }, null, 2));
