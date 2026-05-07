const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const docsRoot = path.join(root, "database", "word_documents");
const outDir = path.join(docsRoot, "reports");
const srcDir = path.join(docsRoot, "_docx_src_doc_repo_sop");
const fileBase = "Mode_operatoire_utilisation_dossier_documentaire_central";
const docxPath = path.join(outDir, `${fileBase}.docx`);
const zipPath = path.join(outDir, `${fileBase}.zip`);

fs.rmSync(srcDir, { recursive: true, force: true });
fs.mkdirSync(path.join(srcDir, "_rels"), { recursive: true });
fs.mkdirSync(path.join(srcDir, "docProps"), { recursive: true });
fs.mkdirSync(path.join(srcDir, "word", "_rels"), { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

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

function pageBreak() {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
}

function bullets(items) {
  return items
    .map((item) => paragraph(`• ${item}`, { style: "BodyText", spacingAfter: 60 }))
    .join("");
}

function table(headers, rows, widths) {
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const borders = `<w:tblBorders>
    <w:top w:val="single" w:sz="8" w:space="0" w:color="DCE6F2"/>
    <w:left w:val="single" w:sz="8" w:space="0" w:color="DCE6F2"/>
    <w:bottom w:val="single" w:sz="8" w:space="0" w:color="DCE6F2"/>
    <w:right w:val="single" w:sz="8" w:space="0" w:color="DCE6F2"/>
    <w:insideH w:val="single" w:sz="8" w:space="0" w:color="DCE6F2"/>
    <w:insideV w:val="single" w:sz="8" w:space="0" w:color="DCE6F2"/>
  </w:tblBorders>`;
  const headerRow = `<w:tr>${headers
    .map(
      (h, i) =>
        `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="EAF2FF"/></w:tcPr>${paragraph(
          h,
          { bold: true, color: "1F4E79", spacingAfter: 0 }
        )}</w:tc>`
    )
    .join("")}</w:tr>`;
  const bodyRows = rows
    .map(
      (row) =>
        `<w:tr>${row
          .map(
            (cell, i) =>
              `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/></w:tcPr>${paragraph(
                cell,
                { spacingAfter: 0 }
              )}</w:tc>`
          )
          .join("")}</w:tr>`
    )
    .join("");
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="0" w:type="auto"/>
      ${borders}
      <w:tblCellMar>
        <w:top w:w="70" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="70" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>${grid}</w:tblGrid>
    ${headerRow}
    ${bodyRows}
  </w:tbl>`;
}

const responsibilityRows = [
  ["Compte pilote", "Définit l’arborescence, valide l’organisation documentaire, supervise les accès."],
  ["Responsable qualité", "Gère les imports, vérifie les statuts, contrôle la cohérence documentaire."],
  ["Utilisateur autorisé", "Consulte, lit et met à jour les documents selon les droits accordés."],
  ["Serveur local", "Centralise les fichiers sur D: et diffuse les mises à jour aux appareils connectés."]
];

const recordRows = [
  ["Importation de document", "Bibliothèque documentaire + journal temps réel", "Automatique dans l’application"],
  ["Lecture / ouverture", "Journal documentaire", "Automatique dans l’application"],
  ["Changement de statut", "Historique documentaire", "Automatique dans l’application"],
  ["Archivage", "Bibliothèque + historique", "Automatique dans l’application"]
];

const flowRows = [
  ["1", "Démarrer le serveur local", "Rendre la base et le dépôt documentaire accessibles sur le réseau local."],
  ["2", "Se connecter à l’application", "Ouvrir la session pilote ou utilisateur autorisé."],
  ["3", "Configurer la hiérarchie documentaire", "Créer ou ajuster l’arborescence sur D: depuis le module Documentation."],
  ["4", "Importer les documents", "Enregistrer les fichiers dans le dépôt central avec référence, type, version et statut."],
  ["5", "Lire / diffuser / archiver", "Utiliser les actions du module pour maintenir le cycle de vie documentaire."]
];

const warnings = [
  "Ne pas déplacer manuellement un document dans l’explorateur Windows après son importation.",
  "Ne pas renommer les dossiers créés par l’application hors du module Documentation.",
  "Ne pas supprimer directement un fichier dans D: sans passer par la logique applicative.",
  "Éviter l’ouverture simultanée du même document en écriture depuis plusieurs postes."
];

const prerequisites = [
  "Le serveur local Node.js doit être démarré avec la commande npm start.",
  "Le poste principal doit rester allumé pendant l’utilisation multi-appareils.",
  "Les téléphones, tablettes et PC doivent être connectés au même réseau local.",
  "Le compte utilisé doit disposer d’un accès autorisé au module Documentation."
];

const body = [
  paragraph("QUALI by ENNAJEH", { style: "CoverBrand", align: "center", spacingAfter: 70 }),
  paragraph("Mode opératoire", { style: "CoverMinor", align: "center", spacingAfter: 60 }),
  paragraph("Utilisation du dossier documentaire central", {
    style: "CoverTitle",
    align: "center",
    spacingAfter: 120
  }),
  paragraph("Version : 1.0", { style: "CoverMinor", align: "center", spacingAfter: 40 }),
  paragraph("Date : 07/05/2026", { style: "CoverMinor", align: "center", spacingAfter: 140 }),
  paragraph(
    "Ce document décrit la méthode d’utilisation du dépôt documentaire central relié à l’application afin d’assurer un classement cohérent, une traçabilité fiable et une diffusion immédiate des documents sur le réseau local.",
    { style: "QuoteText", align: "center", spacingAfter: 180 }
  ),
  paragraph(
    "Chemin du dépôt documentaire : D:\\stage prjet fin d'étude 2026\\cahier de charge d'application\\database\\QUALI_DATA_SERVER",
    { style: "CoverMinor", align: "center", spacingAfter: 0 }
  ),
  pageBreak(),

  paragraph("1. Objet", { style: "Heading1", keepNext: true }),
  paragraph(
    "Le présent mode opératoire définit la manière d’utiliser le dossier documentaire central relié à l’application Quali by ENNAJEH. Il précise les conditions de démarrage, la création de l’arborescence, l’importation des documents, la consultation, le changement de statut, l’archivage et les règles à respecter pour conserver l’intégrité des données.",
    { style: "BodyText" }
  ),

  paragraph("2. Domaine d’application", { style: "Heading1", keepNext: true }),
  paragraph(
    "Cette procédure s’applique à tous les documents de l’organisme gérés dans le module Documentation lorsque ceux-ci sont stockés dans le dépôt central sur D: et utilisés depuis le réseau local par le compte pilote, le responsable qualité ou les utilisateurs autorisés.",
    { style: "BodyText" }
  ),

  paragraph("3. Responsabilités", { style: "Heading1", keepNext: true }),
  table(["Acteur", "Responsabilité"], responsibilityRows, [2200, 6600]),

  paragraph("4. Définitions", { style: "Heading1", keepNext: true }),
  bullets([
    "Dépôt documentaire central : dossier physique sur D: dans lequel l’application enregistre les documents.",
    "Bibliothèque documentaire centralisée : vue applicative des documents stockés dans le dépôt central.",
    "Journal documentaire : historique temps réel des actions effectuées sur les documents.",
    "Hiérarchie documentaire : structure de classement basée sur le processus, le type, la référence et la version."
  ]),

  paragraph("5. Prérequis", { style: "Heading1", keepNext: true }),
  bullets(prerequisites),

  paragraph("6. Structure du dépôt documentaire", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph(
    "Le dossier central est organisé pour séparer les données applicatives, les documents actifs, les archives, la corbeille documentaire et les journaux. La racine actuellement utilisée est la suivante :",
    { style: "BodyText" }
  ),
  bullets([
    "database/QUALI_DATA_SERVER/db",
    "database/QUALI_DATA_SERVER/documents",
    "database/QUALI_DATA_SERVER/archives",
    "database/QUALI_DATA_SERVER/trash",
    "database/QUALI_DATA_SERVER/logs"
  ]),
  paragraph(
    "À l’intérieur de documents, la structure recommandée suit le schéma : <pilote> / <processus> / <type> / <référence> / <version>.",
    { style: "BodyText" }
  ),
  paragraph(
    "Exemple : documents/QUALI_by_ENNAJEH/Processus_support/Procedure/PRO-SUP-001/v_1_0",
    { style: "BodyText", italic: true, color: "5B667A" }
  ),

  paragraph("7. Procédure d’utilisation", { style: "Heading1", keepNext: true }),
  table(["Étape", "Action", "Résultat attendu"], flowRows, [900, 2500, 5400]),

  paragraph("7.1 Démarrer le serveur local", { style: "Heading2", keepNext: true }),
  paragraph(
    "Ouvrir une fenêtre PowerShell dans le dossier de l’application puis exécuter la commande npm start. Cette opération active le backend Node.js, la base SQLite et le dépôt documentaire central.",
    { style: "BodyText" }
  ),
  paragraph("Adresse locale de travail : http://localhost:3000/QualiLab_by_ENNAJEH_v2.html", {
    style: "BodyText",
    italic: true,
    color: "1F4E79"
  }),

  paragraph("7.2 Se connecter à l’application", { style: "Heading2", keepNext: true }),
  paragraph(
    "Se connecter avec le compte pilote ou un utilisateur autorisé. Une fois connecté, ouvrir le module Documentation pour accéder au serveur documentaire central, à la hiérarchie, à l’importation et à la bibliothèque.",
    { style: "BodyText" }
  ),

  paragraph("7.3 Créer ou ajuster la hiérarchie documentaire", { style: "Heading2", keepNext: true }),
  paragraph(
    "Dans le bloc Hiérarchie documentaire, définir l’organisation retenue par l’organisme. La structure recommandée utilise les niveaux processus, type, référence puis version. Après validation, lancer la création des dossiers depuis l’application afin d’éviter les écarts entre la base et le stockage physique.",
    { style: "BodyText" }
  ),

  paragraph("7.4 Importer un document", { style: "Heading2", keepNext: true }),
  paragraph(
    "Dans le bloc d’importation, sélectionner le fichier puis renseigner les métadonnées obligatoires : référence, titre, processus, type, version, propriétaire et statut. Valider ensuite l’importation. Le document est copié dans le dépôt central, référencé en base et immédiatement visible dans la bibliothèque.",
    { style: "BodyText" }
  ),

  paragraph("7.5 Lire ou ouvrir un document", { style: "Heading2", keepNext: true }),
  paragraph(
    "Depuis la bibliothèque documentaire centralisée, utiliser Lire ou Ouvrir pour consulter le document. L’application enregistre automatiquement l’action dans le journal documentaire en temps réel.",
    { style: "BodyText" }
  ),

  paragraph("7.6 Changer le statut d’un document", { style: "Heading2", keepNext: true }),
  paragraph(
    "Utiliser les actions prévues dans le module Documentation pour faire évoluer le document dans son cycle de vie : Brouillon, En revue, Approuvé, Diffusé ou Archivé. Chaque changement est conservé dans l’historique documentaire.",
    { style: "BodyText" }
  ),

  paragraph("7.7 Archiver un document", { style: "Heading2", keepNext: true }),
  paragraph(
    "Lorsque le document n’est plus en usage courant, lancer l’action Archiver depuis la bibliothèque documentaire. Le document reste tracé et son historique demeure consultable dans l’application.",
    { style: "BodyText" }
  ),

  paragraph("8. Utilisation sur plusieurs appareils", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph(
    "Lorsque le poste principal est allumé et que le serveur local est démarré, les autres appareils connectés au même réseau local peuvent consulter les mêmes documents via l’adresse réseau du serveur. Les mises à jour effectuées dans le module Documentation sont diffusées de manière centralisée par le serveur local.",
    { style: "BodyText" }
  ),

  paragraph("9. Règles de gestion et précautions", { style: "Heading1", keepNext: true }),
  bullets(warnings),

  paragraph("10. Enregistrements générés", { style: "Heading1", keepNext: true }),
  table(["Action", "Enregistrement généré", "Mode de conservation"], recordRows, [2600, 3000, 2800]),

  paragraph("11. Traitement des anomalies", { style: "Heading1", keepNext: true }),
  paragraph(
    "En cas de document absent, erreur de lecture, changement de statut non répercuté ou différence entre le dossier physique et la bibliothèque applicative, le responsable qualité doit vérifier d’abord que le serveur local est bien démarré puis contrôler l’intégrité du dépôt documentaire central. Toute anomalie persistante doit être traitée avant de poursuivre les imports ou les suppressions.",
    { style: "BodyText" }
  ),

  paragraph("12. Conclusion", { style: "Heading1", keepNext: true }),
  paragraph(
    "Le dossier documentaire central doit être utilisé exclusivement à travers le module Documentation afin de garantir la cohérence entre les fichiers stockés sur D:, la base de données et les accès multi-utilisateurs. Cette discipline permet de centraliser les documents de l’organisme tout en conservant une traçabilité exploitable et une consultation immédiate sur le réseau local.",
    { style: "BodyText" }
  )
].join("");

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
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
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Mode opératoire - Utilisation du dossier documentaire central</dc:title>
  <dc:subject>Gestion documentaire centralisée</dc:subject>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:keywords>documentation; dossier central; procédure; Quali by ENNAJEH</cp:keywords>
  <dc:description>Mode opératoire pour l’utilisation du dépôt documentaire central lié à l’application.</dc:description>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-05-07T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-05-07T00:00:00Z</dcterms:modified>
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
      <vt:lpstr>Mode_operatoire_utilisation_dossier_documentaire_central</vt:lpstr>
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
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="BodyText"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="160" w:after="80"/><w:keepNext/></w:pPr>
    <w:rPr><w:b/><w:color w:val="D97706"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
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
</w:styles>`;

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 wp14">
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

console.log(JSON.stringify({ srcDir, outDir, zipPath, docxPath }, null, 2));
