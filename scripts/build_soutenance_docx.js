const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "deliverables");
const srcDir = path.join(outDir, "_docx_src");
const docxPath = path.join(outDir, "Rapport_soutenance_PFE_QualiLab_by_ENNAJEH.docx");
const zipPath = path.join(outDir, "Rapport_soutenance_PFE_QualiLab_by_ENNAJEH.zip");

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
    pageBreakBefore = false,
    center = false
  } = opts;

  const pPr = [];
  if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
  if (align || center) pPr.push(`<w:jc w:val="${center ? "center" : align}"/>`);
  if (spacingBefore !== null || spacingAfter !== null) {
    pPr.push(`<w:spacing${spacingBefore !== null ? ` w:before="${spacingBefore}"` : ""}${spacingAfter !== null ? ` w:after="${spacingAfter}"` : ""}/>`);
  }
  if (keepNext) pPr.push(`<w:keepNext/>`);
  if (pageBreakBefore) pPr.push(`<w:pageBreakBefore/>`);

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
  return items.map((item) => paragraph(`• ${item}`, { style: "BodyText", spacingAfter: 60 })).join("");
}

function table(headers, rows, widths) {
  const cols = headers.length;
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const borders = `<w:tblBorders>
    <w:top w:val="single" w:sz="8" w:space="0" w:color="D7E3F4"/>
    <w:left w:val="single" w:sz="8" w:space="0" w:color="D7E3F4"/>
    <w:bottom w:val="single" w:sz="8" w:space="0" w:color="D7E3F4"/>
    <w:right w:val="single" w:sz="8" w:space="0" w:color="D7E3F4"/>
    <w:insideH w:val="single" w:sz="8" w:space="0" w:color="D7E3F4"/>
    <w:insideV w:val="single" w:sz="8" w:space="0" w:color="D7E3F4"/>
  </w:tblBorders>`;
  const headerRow = `<w:tr>${headers.map((h, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="EAF2FF"/></w:tcPr>${paragraph(h, { bold: true, color: "1F4E79", spacingAfter: 0 })}</w:tc>`).join("")}</w:tr>`;
  const bodyRows = rows.map((row) => `<w:tr>${row.map((cell, i) => `<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/></w:tcPr>${paragraph(cell, { spacingAfter: 0 })}</w:tc>`).join("")}</w:tr>`).join("");
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

const introBullets = [
  "Centraliser les informations qualité dans une interface unique.",
  "Structurer la documentation selon une hiérarchie maîtrisée.",
  "Créer des comptes utilisateurs avec des droits d’accès précis.",
  "Assurer une sauvegarde fiable et une synchronisation avec une base liée à l’application.",
  "Fournir un tableau de bord visuel pour analyser l’état actuel de l’organisme.",
  "Permettre un usage sur PC, tablette et téléphone."
];

const methodBullets = [
  "Analyse du cahier des charges et des référentiels qualité.",
  "Conception progressive de l’interface et des modules métiers.",
  "Développement itératif avec validation fonctionnelle continue.",
  "Ajout d’un backend Node.js et d’une base SQLite.",
  "Adaptation responsive et préparation PWA."
];

const architectureRows = [
  ["Frontend", "Interface utilisateur, navigation, formulaires, tableaux, rendu visuel et logique dynamique.", "HTML5, CSS3, JavaScript"],
  ["Backend", "Authentification, gestion des comptes, API REST et synchronisation.", "Node.js, Express.js"],
  ["Base de données", "Stockage des comptes pilotes, utilisateurs et état applicatif.", "SQLite via node:sqlite"]
];

const techRows = [
  ["HTML5", "Structure des pages et composants de l’interface."],
  ["CSS3", "Design système, responsive design, cartes, tableaux et ergonomie visuelle."],
  ["JavaScript", "Logique métier côté client, calculs, recherches, affichages dynamiques et exports."],
  ["Node.js", "Exécution du backend et services serveur."],
  ["Express.js", "Création des routes API REST."],
  ["SQLite", "Base de données légère embarquée."],
  ["JSON", "Échanges de données entre frontend et backend."],
  ["PWA", "Installation mobile et préparation à l’usage hors navigation classique."]
];

const moduleRows = [
  ["Tableau de bord", "Pilotage global", "Indicateurs, graphiques, alertes, activité récente, calendrier et synthèses."],
  ["Maîtrise documentaire", "Gestion du cycle documentaire", "Références, versions, statuts, validation, diffusion et recherche."],
  ["Documentation", "Création des documents qualité", "Modèles, flux de vérification et approbation, lecture directe."],
  ["Gestion des équipements", "Suivi des instruments", "Création, statut, domaine, historique et exports."],
  ["Non-conformités", "Suivi des écarts", "Gravité, action corrective, clôture, audits liés."],
  ["Audits", "Suivi des audits", "Types d’audits, échéances, planification et reporting."],
  ["Utilisateurs", "Gestion des accès", "Création de comptes, profils, permissions par module."],
  ["Planning", "Organisation des activités", "Audits, inter-comparaisons, habilitations et étalonnage."],
  ["Analyse de risque", "Évaluation des risques", "Matrice Probabilité x Gravité et plans d’action."],
  ["Statistique", "Suivi d’activité", "Affaires, régions, familles, prestations par période."],
  ["Amélioration continue", "Traitement des évolutions", "Demandes de modification, traitement et rapport."],
  ["Discussion", "Communication interne", "Messagerie entre comptes créés dans l’application."]
];

const dbRows = [
  ["pilots", "Comptes pilotes", "Conserver les comptes principaux de l’application."],
  ["users", "Comptes utilisateurs", "Conserver les utilisateurs, profils et droits rattachés à un pilote."],
  ["pilot_app_state", "État global", "Sauvegarder l’état métier synchronisé de l’application pour chaque pilote."]
];

const perspectiveBullets = [
  "Créer des tables SQL dédiées pour chaque module métier.",
  "Renforcer l’authentification et le chiffrement des mots de passe.",
  "Connecter un vrai service d’envoi d’e-mails.",
  "Déployer la solution sur une infrastructure distante sécurisée.",
  "Poursuivre l’évolution vers une application mobile encore plus intégrée."
];

const body = [
  paragraph("République Tunisienne", { style: "CoverMinor", center: true, spacingAfter: 40 }),
  paragraph("Projet de Fin d’Études 2026", { style: "CoverMinor", center: true, spacingAfter: 140 }),
  paragraph("Conception et développement d’une application web de management qualité pour laboratoire", { style: "CoverTitle", center: true, spacingAfter: 100 }),
  paragraph("QualiLab by ENNAJEH", { style: "CoverBrand", center: true, spacingAfter: 80 }),
  paragraph("Document de soutenance académique", { style: "CoverMinor", center: true, spacingAfter: 220 }),
  paragraph("Présenté par : Karim ENNAJEH", { style: "BodyText", center: true, spacingAfter: 70 }),
  paragraph("Cadre du projet : digitalisation du système de management de la qualité d’un laboratoire selon ISO/IEC 17025:2017 et ISO 9001:2015.", { style: "QuoteText", center: true, spacingAfter: 180 }),
  paragraph("Année universitaire : 2025 - 2026", { style: "CoverMinor", center: true, spacingAfter: 0 }),
  pageBreak(),

  paragraph("Sommaire", { style: "Heading1", spacingAfter: 120 }),
  bullets([
    "1. Introduction générale",
    "2. Contexte et problématique",
    "3. Objectifs du projet",
    "4. Démarche méthodologique",
    "5. Analyse fonctionnelle de la solution",
    "6. Architecture technique de l’application",
    "7. Technologies et outils utilisés",
    "8. Modules fonctionnels développés",
    "9. Gestion des comptes, sécurité et permissions",
    "10. Base de données et logique de sauvegarde",
    "11. Compatibilité mobile, responsive design et PWA",
    "12. Résultats obtenus",
    "13. Limites actuelles",
    "14. Perspectives d’évolution",
    "15. Conclusion générale"
  ]),
  pageBreak(),

  paragraph("1. Introduction générale", { style: "Heading1", keepNext: true }),
  paragraph("Ce projet de fin d’études porte sur la conception et le développement d’une application web destinée au pilotage du système de management de la qualité d’un laboratoire. Le besoin initial consistait à centraliser les documents, les données métier, les accès utilisateurs et les indicateurs de suivi dans une seule plateforme cohérente et exploitable.", { style: "BodyText" }),
  paragraph("L’application développée, nommée QualiLab by ENNAJEH, vise à remplacer une gestion dispersée par une solution numérique modulaire, évolutive et orientée vers la traçabilité. Elle s’inscrit dans une logique de conformité et de maîtrise des informations conformément aux référentiels ISO/IEC 17025:2017 et ISO 9001:2015.", { style: "BodyText" }),

  paragraph("2. Contexte et problématique", { style: "Heading1", keepNext: true }),
  paragraph("Dans un laboratoire, les documents qualité, les audits, les équipements, les non-conformités, les habilitations du personnel et les statistiques d’activité sont souvent répartis sur plusieurs supports. Cette dispersion rend le suivi difficile, augmente le risque de doublons et réduit la visibilité globale sur l’état réel de l’organisme.", { style: "BodyText" }),
  paragraph("La problématique principale peut donc être formulée ainsi : comment concevoir une application unique, claire et évolutive permettant de structurer les données qualité, de sécuriser les accès, d’améliorer la traçabilité et de faciliter la prise de décision ?", { style: "BodyText" }),

  paragraph("3. Objectifs du projet", { style: "Heading1", keepNext: true }),
  paragraph("Les objectifs principaux du projet sont les suivants :", { style: "BodyText", spacingAfter: 40 }),
  bullets(introBullets),

  paragraph("4. Démarche méthodologique", { style: "Heading1", keepNext: true }),
  paragraph("Le développement a suivi une démarche incrémentale et itérative. Chaque module a été conçu, testé, ajusté puis intégré progressivement. Cette méthode a permis de maintenir une application opérationnelle à chaque étape tout en adaptant les choix techniques aux besoins réels du métier.", { style: "BodyText" }),
  bullets(methodBullets),

  paragraph("5. Analyse fonctionnelle de la solution", { style: "Heading1", pageBreakBefore: true, keepNext: true }),
  paragraph("L’application a été organisée autour de modules métiers distincts mais intégrés. Cette structure permet de couvrir la gestion documentaire, le suivi qualité, l’activité du laboratoire, les statistiques, la planification et la gestion des utilisateurs dans un seul environnement de travail.", { style: "BodyText" }),
  paragraph("Chaque module dispose de formulaires, listes, recherches, actions de modification, fonctions d’impression et de téléchargement. Le tableau de bord assure la synthèse visuelle des données, tandis que le système de comptes contrôle l’accès aux différentes fonctions.", { style: "BodyText" }),

  paragraph("6. Architecture technique de l’application", { style: "Heading1", keepNext: true }),
  paragraph("L’architecture retenue suit un découpage en trois couches afin de séparer l’affichage, la logique serveur et le stockage des données.", { style: "BodyText" }),
  table(["Couche", "Rôle principal", "Technologies"], architectureRows, [1700, 5100, 1800]),
  paragraph("Cette séparation améliore la maintenabilité de la solution et facilite l’évolution vers une modélisation plus détaillée par module métier.", { style: "BodyText" }),

  paragraph("7. Technologies et outils utilisés", { style: "Heading1", keepNext: true }),
  paragraph("Le développement du projet a mobilisé plusieurs technologies complémentaires.", { style: "BodyText" }),
  table(["Technologie", "Utilisation dans le projet"], techRows, [1800, 6800]),

  paragraph("8. Modules fonctionnels développés", { style: "Heading1", pageBreakBefore: true, keepNext: true }),
  paragraph("L’application regroupe des modules fonctionnels couvrant les besoins principaux du système qualité du laboratoire.", { style: "BodyText" }),
  table(["Module", "Objectif", "Fonctionnalités majeures"], moduleRows, [2200, 2000, 4400]),

  paragraph("9. Gestion des comptes, sécurité et permissions", { style: "Heading1", pageBreakBefore: true, keepNext: true }),
  paragraph("Le système distingue deux niveaux de comptes : le compte pilote et les comptes utilisateurs. Le compte pilote correspond au compte principal de l’organisme. Il peut créer des utilisateurs, configurer l’application et visualiser l’ensemble des modules.", { style: "BodyText" }),
  paragraph("Les comptes utilisateurs sont créés depuis le module Utilisateurs. Ils disposent d’un profil, d’un statut actif ou inactif, d’autorisations générales et de permissions détaillées par module. Cette approche permet d’adapter précisément l’application aux responsabilités de chaque agent.", { style: "BodyText" }),
  paragraph("Une correction importante a consisté à synchroniser automatiquement les comptes pilotes avec la base avant la création d’utilisateurs, afin d’éviter les incohérences entre l’interface locale et le backend.", { style: "BodyText" }),

  paragraph("10. Base de données et logique de sauvegarde", { style: "Heading1", keepNext: true }),
  paragraph("La base actuelle repose sur une structure volontairement simple mais robuste, permettant d’assurer l’authentification, la gestion des comptes et la synchronisation globale de l’état applicatif.", { style: "BodyText" }),
  table(["Table", "Contenu", "Rôle"], dbRows, [2000, 2200, 4400]),
  paragraph("L’application suit aujourd’hui une logique hybride : le frontend manipule l’état de travail puis synchronise cet état avec la base via le backend. Ce choix a permis d’intégrer rapidement une base réelle tout en conservant la continuité fonctionnelle de l’application.", { style: "BodyText" }),

  paragraph("11. Compatibilité mobile, responsive design et PWA", { style: "Heading1", keepNext: true }),
  paragraph("L’interface a été adaptée aux affichages PC, tablette et téléphone. Les cartes, formulaires, tableaux et barres d’information ont été réorganisés afin de rester lisibles sur des écrans réduits.", { style: "BodyText" }),
  paragraph("L’application a également été préparée en mode PWA avec manifest et service worker, ce qui permet de l’ouvrir comme une application mobile installable sur l’écran d’accueil du téléphone.", { style: "BodyText" }),

  paragraph("12. Résultats obtenus", { style: "Heading1", pageBreakBefore: true, keepNext: true }),
  paragraph("Le projet a permis de produire une application fonctionnelle, structurée et exploitable, avec les résultats suivants :", { style: "BodyText", spacingAfter: 40 }),
  bullets([
    "Centralisation des données qualité dans une seule plateforme.",
    "Gestion de plusieurs modules métier dans une interface homogène.",
    "Création de comptes utilisateurs avec profils et permissions détaillées.",
    "Ajout d’un tableau de bord visuel avec cubes, graphiques, alertes et calendrier.",
    "Connexion à une base de données réelle pour la gestion des comptes et la synchronisation globale.",
    "Préparation mobile grâce au responsive design et à l’approche PWA."
  ]),

  paragraph("13. Limites actuelles", { style: "Heading1", keepNext: true }),
  paragraph("Certaines limites subsistent. Tous les modules métier ne disposent pas encore de tables SQL dédiées ; plusieurs données sont encore synchronisées par un état global associé au pilote. Par ailleurs, l’envoi réel d’e-mails et certaines sécurités avancées restent à renforcer.", { style: "BodyText" }),

  paragraph("14. Perspectives d’évolution", { style: "Heading1", keepNext: true }),
  paragraph("Les principales perspectives d’évolution du projet sont les suivantes :", { style: "BodyText", spacingAfter: 40 }),
  bullets(perspectiveBullets),

  paragraph("15. Conclusion générale", { style: "Heading1", keepNext: true, pageBreakBefore: true }),
  paragraph("Ce projet a permis de transformer un besoin métier complexe en une application web de management qualité structurée, modulaire et évolutive. QualiLab by ENNAJEH constitue aujourd’hui une base solide pour la digitalisation du système de management de la qualité d’un laboratoire.", { style: "BodyText" }),
  paragraph("Au-delà de la réalisation technique, ce travail a permis de mettre en pratique une démarche de conception progressive orientée vers la résolution de problèmes concrets. L’application peut désormais servir de socle à des évolutions plus avancées et à une exploitation professionnelle future.", { style: "BodyText" })
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
  <dc:title>Rapport de soutenance PFE - QualiLab by ENNAJEH</dc:title>
  <dc:subject>Application web de management qualité pour laboratoire</dc:subject>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:keywords>Qualité; laboratoire; ISO 17025; PFE; QualiLab</cp:keywords>
  <dc:description>Document de soutenance académique du projet QualiLab by ENNAJEH.</dc:description>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-05-03T00:00:00Z</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">2026-05-03T00:00:00Z</dcterms:modified>
</cp:coreProperties>`;

const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>QualiLab by ENNAJEH</Application>
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
      <vt:lpstr>Rapport_soutenance_PFE_QualiLab_by_ENNAJEH</vt:lpstr>
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
    <w:rPr><w:b/><w:color w:val="B54A2F"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
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
    <w:rPr><w:b/><w:color w:val="E87B23"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
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

console.log(JSON.stringify({ srcDir, docxPath, zipPath }, null, 2));
