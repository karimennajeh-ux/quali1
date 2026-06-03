/**
 * DMS Files Management - SharePoint Style Interface
 * Displays files from DMS/uploads in a professional table format
 */

const dmsState = {
  files: [],
  folders: {},
  currentFilter: 'all',
  rootFilter: 'all',
  typeFilter: 'all',
  searchTerm: '',
  sortBy: 'modified_desc',
  selectedFolder: '',
  pendingDocumentType: null,
  expandedFolders: new Set()
};

const DMS_ROOT_ORDER = [
  'manuel qualité',
  'Politique qualité',
  'Procesus Operationnel',
  'Procesus Pilotage',
  'Procesus support'
];

const DMS_PROCESS_ROOTS = [
  'Procesus Operationnel',
  'Procesus Pilotage',
  'Procesus support'
];

const DMS_FOLDER_LABELS = {
  'Procesus Operationnel': 'Processus Opérationnel',
  'Procesus Pilotage': 'Processus Pilotage',
  'Procesus support': 'Processus support',
  'Politique qualité': 'Politique qualité',
  'manuel qualité': 'Manuel qualité'
};

const DMS_LIFECYCLE_STEPS = [
  '1-créer',
  '2-Vérifier',
  '3-Approuver',
  '4-Réviser',
  '5-Archiver',
  '6-Supprimer'
];

const DMS_DOCUMENT_CLASS_FOLDERS = [
  'Procédure',
  'Instruction',
  'Formulaire',
  'Enregistrement'
];

const DMS_DOCUMENT_CLASS_KEYS = {
  'Procédure': 'procedure',
  'Instruction': 'instruction',
  'Formulaire': 'formulaire',
  'Enregistrement': 'enregistrement'
};

const DMS_LEGACY_LIFECYCLE_MAP = {
  'Créer': '1-créer',
  'Creer': '1-créer',
  'Vérifier': '2-Vérifier',
  'Verifier': '2-Vérifier',
  'Approuver': '3-Approuver',
  'Diffuser': '3-Approuver',
  'Utiliser': '3-Approuver',
  'Réviser': '4-Réviser',
  'Reviser': '4-Réviser',
  'Archiver': '5-Archiver',
  'Supprimer': '6-Supprimer'
};

const DMS_PHYSICAL_ROOT = "D:\\stage prjet fin d'étude 2026\\xampp\\htdocs\\QUALI\\DMS\\uploads";

const DMS_DOCUMENT_TYPES = [
  { key: 'procedure', label: 'Procédure', extension: 'docx', className: 'doc', text: 'PRO', icon: 'assets/dms-icons/document.svg', templateType: 'procedure', cardTitle: 'PROCÉDURE', cardSubtitle: 'MAÎTRISE DES DOCUMENTS' },
  { key: 'instruction', label: 'Instruction', extension: 'docx', className: 'doc', text: 'INS', icon: 'assets/dms-icons/document.svg', templateType: 'instruction', cardTitle: 'INSTRUCTION', cardSubtitle: 'MAÎTRISE DES DOCUMENTS' },
  { key: 'formulaire', label: 'Formulaire', extension: 'docx', className: 'doc', text: 'FOR', icon: 'assets/dms-icons/document.svg', templateType: 'formulaire', cardTitle: 'FORMULAIRE', cardSubtitle: 'MAÎTRISE DES DOCUMENTS' },
  { key: 'enregistrement', label: 'Enregistrement', extension: 'docx', className: 'doc', text: 'ENR', icon: 'assets/dms-icons/document.svg', templateType: 'enregistrement', cardTitle: 'ENREGISTREMENT', cardSubtitle: 'MAÎTRISE DES DOCUMENTS' },
  { key: 'sheet', label: 'Tableur', extension: 'xlsx', className: 'sheet', text: 'XLS', icon: 'assets/dms-icons/spreadsheet.svg' },
  { key: 'pdf', label: 'PDF', extension: 'pdf', className: 'pdf', text: 'PDF', icon: 'assets/dms-icons/pdf.svg' },
  { key: 'ppt', label: 'Présentation', extension: 'pptx', className: 'ppt', text: 'PPT', icon: 'assets/dms-icons/presentation.svg' },
  { key: 'image', label: 'Image', extension: 'png', className: 'image', text: 'IMG', icon: 'assets/dms-icons/image.svg' },
  { key: 'txt', label: 'Texte', extension: 'txt', className: 'txt', text: 'TXT', icon: 'assets/dms-icons/text.svg' }
];

const DMS_FOLDER_TYPE = {
  key: 'folder',
  label: 'Dossier',
  icon: 'image/logo/folder.png'
};

/**
 * Initialize DMS file display
 */
async function initDmsFileDisplay() {
  try {
    // Check if we're on the documentation page
    const docContainer = document.getElementById('docSharepointList');
    if (!docContainer) return;

    // Show an empty shell immediately, then hydrate it from the physical DMS/uploads folder.
    renderDmsFilesTable();
    
    // Load DMS files
    await loadDmsFiles();
    ensureDmsFolderVisible(getDmsCurrentFolder());
    
    // Setup event listeners
    setupDmsEventListeners();
    
    // Render the table
    renderDmsFilesTable();
  } catch (error) {
    console.error("Erreur lors de l'initialisation de l'affichage DMS:", error);
  }
}

/**
 * Load files from DMS/uploads
 */
async function loadDmsFiles() {
  try {
    const response = await fetch(`api/documentation/get_dms_files.php?_=${Date.now()}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('Failed to load DMS files:', data.error);
      return;
    }
    
    dmsState.files = data.allFiles || [];
    dmsState.folders = data.folders || {};
    
  } catch (error) {
    console.error('Erreur lors du chargement des fichiers DMS:', error);
  }
}

/**
 * Setup event listeners for DMS controls
 */
function setupDmsEventListeners() {
  // Search input
  const searchInput = document.getElementById('docSearchInput');
  if (searchInput) {
    let searchTimer = null;
    const scheduleSearch = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => applyDmsSearch(), 250);
    };

    searchInput.addEventListener('input', scheduleSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(searchTimer);
        applyDmsSearch();
      }
    });
  }

  const searchBtn = document.getElementById('docSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', applyDmsSearch);
  }
  
  // Filter dropdown
  const filterSelect = document.getElementById('docFilterSelect');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      dmsState.currentFilter = e.target.value;
      ensureDmsFilterSelectionVisible();
      renderDmsFilesTable();
    });
  }

  const rootFilterSelect = document.getElementById('docRootFilterSelect');
  if (rootFilterSelect) {
    rootFilterSelect.addEventListener('change', (e) => {
      dmsState.rootFilter = e.target.value;
      ensureDmsFilterSelectionVisible();
      renderDmsFilesTable();
    });
  }

  const typeFilterSelect = document.getElementById('docTypeFilterSelect');
  if (typeFilterSelect) {
    typeFilterSelect.addEventListener('change', (e) => {
      dmsState.typeFilter = e.target.value;
      ensureDmsFilterSelectionVisible();
      renderDmsFilesTable();
    });
  }
  
  // Import button
  const importBtn = document.getElementById('docImportBtn');
  if (importBtn) {
    importBtn.addEventListener('click', openFileImportDialog);
  }

  // Refresh button: synchronize the app tree with the physical DMS/uploads folder.
  const refreshBtn = document.getElementById('docRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshDmsFromPhysicalFolder);
  }
  
  // New document button
  const newBtn = document.getElementById('docNewBtn');
  if (newBtn) {
    newBtn.textContent = 'Nouveau';
    newBtn.addEventListener('click', createNewDocument);
  }
  
  // Reset filters button
  const resetBtn = document.getElementById('docResetFiltersBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetDmsFilters);
  }
}

/**
 * Filter files based on current state
 */
function getFilteredFiles() {
  let filtered = [...dmsState.files];
  const searchTokens = getDmsSearchTokens();
  
  // Apply search filter
  if (searchTokens.length) {
    filtered = filtered.filter(file => dmsFileMatchesSearch(file, searchTokens));
  }
  
  // Apply lifecycle filter
  if (dmsState.currentFilter !== 'all') {
    filtered = filtered.filter(file => normalizeDmsLifecycleSegment(getDmsLifecycleStepFromPath(getDmsFileDisplayFolder(file))) === dmsState.currentFilter);
  }

  // Apply main folder filter
  if (dmsState.rootFilter !== 'all') {
    filtered = filtered.filter(file => getDmsFileRootFolder(file) === dmsState.rootFilter);
  }

  // Apply document family/type filter
  if (dmsState.typeFilter !== 'all') {
    filtered = filtered.filter(file => getDmsDocumentClass(file) === dmsState.typeFilter);
  }
  
  // Sort by modification date (newest first)
  filtered.sort((a, b) => b.modified - a.modified);
  
  return filtered;
}

function applyDmsSearch() {
  const searchInput = document.getElementById('docSearchInput');
  dmsState.searchTerm = searchInput ? searchInput.value.trim() : '';
  expandDmsSearchResults();
  renderDmsFilesTable();
}

function normalizeDmsSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getDmsSearchTokens() {
  const normalized = normalizeDmsSearchText(dmsState.searchTerm);
  return normalized ? normalized.split(/\s+/).filter(Boolean) : [];
}

function dmsTextMatchesSearch(value, tokens) {
  const haystack = normalizeDmsSearchText(value);
  return tokens.every(token => haystack.includes(token));
}

function dmsFileMatchesSearch(file, tokens) {
  const extension = getDmsFileExtension(file.path, file.name);
  const folder = getDmsFileDisplayFolder(file);
  const lifecycle = getDmsLifecycleStepFromPath(folder);
  const searchable = [
    file.name,
    file.folder,
    folder,
    getDmsDisplayPath(folder),
    extension,
    getDmsPreviewTypeLabel(extension),
    lifecycle,
    formatDate(file.modified)
  ].join(' ');

  return dmsTextMatchesSearch(searchable, tokens);
}

function dmsFolderMatchesSearch(path, tokens) {
  const searchable = [
    path,
    getDmsDisplayFolderName(path),
    getDmsDisplayPath(path)
  ].join(' ');

  return dmsTextMatchesSearch(searchable, tokens);
}

function addDmsPathWithParents(paths, path) {
  const parts = normalizeDmsFolderPath(path).split('/').filter(Boolean);
  let current = '';
  parts.forEach(part => {
    current = current ? `${current}/${part}` : part;
    paths.add(current);
  });
}

function expandDmsSearchResults() {
  const tokens = getDmsSearchTokens();
  if (!tokens.length) return;

  const paths = new Set();
  getFilteredFiles().forEach(file => addDmsPathWithParents(paths, getDmsFileDisplayFolder(file)));
  Object.keys(dmsState.folders || {}).forEach(folder => {
    const folderPath = normalizeDmsDisplayFolderPath(folder);
    if (folderPath && dmsFolderMatchesSearch(folderPath, tokens)) addDmsPathWithParents(paths, folderPath);
  });

  paths.forEach(path => dmsState.expandedFolders.add(path));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeJsArg(value) {
  return escapeHtml(JSON.stringify(String(value ?? '')));
}

async function refreshDmsFromPhysicalFolder() {
  const previousFolder = getDmsCurrentFolder();
  await loadDmsFiles();

  const roots = getDmsRootFolders();
  const folderStillExists = previousFolder && (
    Object.prototype.hasOwnProperty.call(dmsState.folders || {}, previousFolder)
    || roots.includes(previousFolder)
    || dmsState.files.some(file => normalizeDmsFolderPath(file.folder) === previousFolder)
  );

  dmsState.selectedFolder = folderStillExists ? previousFolder : (roots[0] || '');
  ensureDmsFolderVisible(dmsState.selectedFolder);
  renderDmsFilesTable();
}

function normalizeDmsFolderPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '');
}

function normalizeDmsLifecycleSegment(segment) {
  return DMS_LEGACY_LIFECYCLE_MAP[segment] || segment;
}

function isDmsLegacyLifecycleSegment(segment) {
  return Object.prototype.hasOwnProperty.call(DMS_LEGACY_LIFECYCLE_MAP, segment);
}

function normalizeDmsDisplayFolderPath(path) {
  const normalized = normalizeDmsFolderPath(path)
    .split('/')
    .filter(Boolean)
    .map(normalizeDmsLifecycleSegment)
    .join('/');

  return normalizeDmsProcessFolderPath(normalized);
}

function getDmsFileDisplayFolder(file) {
  return normalizeDmsDisplayFolderPath(file && file.folder);
}

function normalizeDmsProcessFolderPath(path) {
  const parts = normalizeDmsFolderPath(path).split('/').filter(Boolean);
  if (parts.length < 2 || !DMS_PROCESS_ROOTS.includes(parts[0])) return parts.join('/');

  const lifecycleIndex = parts.findIndex(part => DMS_LIFECYCLE_STEPS.includes(part));
  const classIndex = parts.findIndex(part => DMS_DOCUMENT_CLASS_FOLDERS.includes(part));

  if (classIndex !== -1 && lifecycleIndex !== -1 && classIndex < lifecycleIndex) {
    return parts.join('/');
  }

  if (classIndex !== -1 && lifecycleIndex === -1) {
    return parts.slice(0, classIndex + 1).join('/');
  }

  if (lifecycleIndex !== -1 && (classIndex === -1 || lifecycleIndex < classIndex)) {
    const documentClass = inferDmsDocumentClassFolderFromPath(parts.join('/'));
    const remaining = parts.slice(lifecycleIndex + 1);
    return [parts[0], documentClass, parts[lifecycleIndex], ...remaining].join('/');
  }

  return parts.join('/');
}

function inferDmsDocumentClassFolderFromPath(path) {
  const normalized = normalizeDmsSearchText(path);
  if (/\b(enregistrement|enregistrements)\b/.test(normalized)) return 'Enregistrement';
  if (/\b(formulaire|formulaires|fo|fop|fpil|fsup)\b/.test(normalized)) return 'Formulaire';
  if (/\b(instruction|instructions|ins)\b/.test(normalized)) return 'Instruction';
  return 'Procédure';
}

function getDmsFileRootFolder(file) {
  return getDmsFileDisplayFolder(file).split('/').filter(Boolean)[0] || '';
}

function getDmsLifecycleStepFromPath(path) {
  return normalizeDmsFolderPath(path).split('/').find(part => DMS_LIFECYCLE_STEPS.includes(normalizeDmsLifecycleSegment(part))) || '';
}

function getDmsDocumentClass(file) {
  const folderParts = getDmsFileDisplayFolder(file).split('/').filter(Boolean);
  const classSegment = folderParts.find(part => DMS_DOCUMENT_CLASS_KEYS[part]);
  if (classSegment) return DMS_DOCUMENT_CLASS_KEYS[classSegment];

  const inferred = inferDmsDocumentClassFolderFromPath(`${file && file.folder || ''} ${file && file.name || ''}`);
  if (DMS_DOCUMENT_CLASS_KEYS[inferred]) return DMS_DOCUMENT_CLASS_KEYS[inferred];

  return '';
}

function ensureDmsFilterSelectionVisible() {
  const targetParts = [];
  if (dmsState.rootFilter !== 'all') targetParts.push(dmsState.rootFilter);
  if (dmsState.currentFilter !== 'all') targetParts.push(dmsState.currentFilter);
  const targetPath = targetParts.join('/');
  if (targetPath) ensureDmsFolderVisible(targetPath);
}

function getDmsRootFolders() {
  const roots = new Set();

  Object.keys(dmsState.folders || {}).forEach(folder => {
    const root = normalizeDmsDisplayFolderPath(folder).split('/').filter(Boolean)[0];
    if (root) roots.add(root);
  });

  dmsState.files.forEach(file => {
    const root = getDmsFileDisplayFolder(file).split('/').filter(Boolean)[0];
    if (root) roots.add(root);
  });

  return Array.from(roots).sort((a, b) => {
    const indexA = DMS_ROOT_ORDER.indexOf(a);
    const indexB = DMS_ROOT_ORDER.indexOf(b);
    if (indexA !== -1 || indexB !== -1) {
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    }
    return a.localeCompare(b, 'fr', { sensitivity: 'base' });
  });
}

function getDmsCurrentFolder() {
  const current = normalizeDmsFolderPath(dmsState.selectedFolder);
  return current || getDmsRootFolders()[0] || '';
}

function getDmsDisplayFolderName(path) {
  const normalized = normalizeDmsFolderPath(path);
  return DMS_FOLDER_LABELS[normalized] || DMS_FOLDER_LABELS[getDmsFolderName(normalized)] || getDmsFolderName(normalized);
}

function getDmsDisplayPath(path) {
  const normalized = normalizeDmsFolderPath(path);
  if (!normalized) return 'DMS / uploads';
  return `DMS / uploads / ${normalized.split('/').map((part, index, parts) => {
    const fullPath = parts.slice(0, index + 1).join('/');
    return DMS_FOLDER_LABELS[fullPath] || DMS_FOLDER_LABELS[part] || part;
  }).join(' / ')}`;
}

function updateDmsCurrentPath() {
  const currentPath = getDmsCurrentFolder();
  const currentPathEl = document.getElementById('docCurrentPath');
  if (currentPathEl) {
    currentPathEl.title = `${DMS_PHYSICAL_ROOT}\\${currentPath.replace(/\//g, '\\')}`;
    currentPathEl.innerHTML = `
      <span>Emplacement actuel</span>
      <strong>${escapeHtml(getDmsDisplayPath(currentPath))}</strong>
    `;
  }

  const importBtn = document.getElementById('docImportBtn');
  if (importBtn) importBtn.title = `Importer dans ${getDmsDisplayPath(currentPath)}`;

  const newBtn = document.getElementById('docNewBtn');
  if (newBtn) newBtn.title = `Créer dans ${getDmsDisplayPath(currentPath)}`;
}

function ensureDmsFolderVisible(path) {
  const normalized = normalizeDmsFolderPath(path);
  if (!normalized) return;

  const parts = normalized.split('/');
  let current = '';
  parts.forEach(part => {
    current = current ? `${current}/${part}` : part;
    dmsState.expandedFolders.add(current);
  });
}

function getDmsFolderDepth(path) {
  const normalized = normalizeDmsFolderPath(path);
  return normalized ? normalized.split('/').length - 1 : 0;
}

function getDmsParentPath(path) {
  const parts = normalizeDmsFolderPath(path).split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function getDmsFolderName(path) {
  const parts = normalizeDmsFolderPath(path).split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function createDmsTreeNode(path) {
  return {
    name: getDmsFolderName(path),
    path: normalizeDmsFolderPath(path),
    children: new Map(),
    files: []
  };
}

function collectDmsFolderPaths(files) {
  const searchTokens = getDmsSearchTokens();
  if (searchTokens.length || hasDmsActiveStructuredFilters()) {
    const matchedPaths = new Set();

    files.forEach(file => addDmsPathWithParents(matchedPaths, getDmsFileDisplayFolder(file)));
    addDmsFilteredProcessStructure(matchedPaths);

    if (searchTokens.length) {
      Object.keys(dmsState.folders || {}).forEach(folder => {
        const folderPath = normalizeDmsDisplayFolderPath(folder);
        if (folderPath && dmsFolderMatchesSearch(folderPath, searchTokens)) {
          addDmsPathWithParents(matchedPaths, folderPath);
        }
      });
    }

    if (matchedPaths.size === 0 && dmsState.rootFilter !== 'all') {
      addDmsPathWithParents(matchedPaths, dmsState.rootFilter);
    }

    return matchedPaths;
  }

  const paths = new Set([...DMS_ROOT_ORDER, ...getDmsRootFolders()]);

  addDmsRequiredProcessStructure(paths);

  Object.keys(dmsState.folders || {}).forEach(folder => {
    const folderPath = normalizeDmsDisplayFolderPath(folder);
    if (isDmsLegacyProcessLifecycleFolder(folderPath)) return;
    if (folderPath) paths.add(folderPath);
  });

  files.forEach(file => {
    const folderPath = getDmsFileDisplayFolder(file);
    if (!folderPath) return;

    const parts = folderPath.split('/');
    let current = '';
    parts.forEach(part => {
      current = current ? `${current}/${part}` : part;
      paths.add(current);
    });
  });

  return paths;
}

function addDmsRequiredProcessStructure(paths) {
  DMS_PROCESS_ROOTS.forEach(root => {
    paths.add(root);
    DMS_DOCUMENT_CLASS_FOLDERS.forEach(documentClass => {
      const classPath = `${root}/${documentClass}`;
      paths.add(classPath);
      DMS_LIFECYCLE_STEPS.forEach(step => paths.add(`${classPath}/${step}`));
    });
  });
}

function addDmsFilteredProcessStructure(paths) {
  const roots = dmsState.rootFilter === 'all' ? DMS_PROCESS_ROOTS : [dmsState.rootFilter].filter(root => DMS_PROCESS_ROOTS.includes(root));
  const classes = dmsState.typeFilter === 'all'
    ? DMS_DOCUMENT_CLASS_FOLDERS
    : DMS_DOCUMENT_CLASS_FOLDERS.filter(folder => DMS_DOCUMENT_CLASS_KEYS[folder] === dmsState.typeFilter);
  const steps = dmsState.currentFilter === 'all' ? DMS_LIFECYCLE_STEPS : [dmsState.currentFilter];

  roots.forEach(root => {
    paths.add(root);
    classes.forEach(documentClass => {
      const classPath = `${root}/${documentClass}`;
      paths.add(classPath);
      steps.forEach(step => paths.add(`${classPath}/${step}`));
    });
  });
}

function isDmsLegacyProcessLifecycleFolder(path) {
  const parts = normalizeDmsFolderPath(path).split('/').filter(Boolean);
  return parts.length === 2
    && DMS_PROCESS_ROOTS.includes(parts[0])
    && DMS_LIFECYCLE_STEPS.includes(parts[1]);
}

function hasDmsActiveStructuredFilters() {
  return dmsState.currentFilter !== 'all'
    || dmsState.rootFilter !== 'all'
    || dmsState.typeFilter !== 'all';
}

function buildDmsFolderTree(files) {
  const nodeMap = new Map();
  const rootNodes = [];
  const folderPaths = collectDmsFolderPaths(files);

  folderPaths.forEach(path => {
    if (!nodeMap.has(path)) {
      nodeMap.set(path, createDmsTreeNode(path));
    }
  });

  files.forEach(file => {
    const folderPath = getDmsFileDisplayFolder(file);
    if (!folderPath) return;

    if (!nodeMap.has(folderPath)) {
      nodeMap.set(folderPath, createDmsTreeNode(folderPath));
    }
    nodeMap.get(folderPath).files.push(file);
  });

  Array.from(nodeMap.values()).forEach(node => {
    const parentPath = getDmsParentPath(node.path);
    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath).children.set(node.path, node);
    } else {
      rootNodes.push(node);
    }
  });

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => {
      const defaultA = DMS_ROOT_ORDER.indexOf(a.path);
      const defaultB = DMS_ROOT_ORDER.indexOf(b.path);

      if (defaultA !== -1 || defaultB !== -1) {
        if (defaultA === -1) return 1;
        if (defaultB === -1) return -1;
        return defaultA - defaultB;
      }

      const stepA = DMS_LIFECYCLE_STEPS.indexOf(a.name);
      const stepB = DMS_LIFECYCLE_STEPS.indexOf(b.name);
      if (stepA !== -1 || stepB !== -1) {
        if (stepA === -1) return 1;
        if (stepB === -1) return -1;
        return stepA - stepB;
      }

      const classA = DMS_DOCUMENT_CLASS_FOLDERS.indexOf(a.name);
      const classB = DMS_DOCUMENT_CLASS_FOLDERS.indexOf(b.name);
      if (classA !== -1 || classB !== -1) {
        if (classA === -1) return 1;
        if (classB === -1) return -1;
        return classA - classB;
      }

      return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
    });

    nodes.forEach(node => {
      node.files.sort((a, b) => b.modified - a.modified);
      node.sortedChildren = Array.from(node.children.values());
      sortNodes(node.sortedChildren);
    });

    return nodes;
  };

  return sortNodes(rootNodes);
}

function hasDmsNodeContent(node) {
  return node.files.length > 0 || (node.sortedChildren || []).some(hasDmsNodeContent);
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Get file icon based on extension
 */
function getFileIcon(extension) {
  const ext = (extension || '').toLowerCase();
  const iconMap = {
    'docx': 'ðŸ“„', 'doc': 'ðŸ“„',
    'xlsx': 'ðŸ“Š', 'xls': 'ðŸ“Š',
    'pdf': 'ðŸ“•',
    'pptx': 'ðŸŽ¯', 'ppt': 'ðŸŽ¯',
    'txt': 'ðŸ“',
    'jpg': 'ðŸ–¼ï¸', 'jpeg': 'ðŸ–¼ï¸', 'png': 'ðŸ–¼ï¸',
    'zip': 'ðŸ—œï¸'
  };
  return iconMap[ext] || 'ðŸ“Ž';
}

/**
 * Get file color badge based on extension
 */
function getFileTypeBadge(extension) {
  const ext = (extension || '').toLowerCase();
  const badges = {
    'docx': 'badge-doc', 'doc': 'badge-doc',
    'xlsx': 'badge-excel', 'xls': 'badge-excel',
    'pdf': 'badge-pdf',
    'pptx': 'badge-ppt', 'ppt': 'badge-ppt',
    'txt': 'badge-txt',
    'jpg': 'badge-img', 'jpeg': 'badge-img', 'png': 'badge-img',
    'zip': 'badge-zip'
  };
  return badges[ext] || 'badge-other';
}

function getDmsDocumentType(extension) {
  const ext = String(extension || '').toLowerCase();
  if (ext === 'doc' || ext === 'docx') return DMS_DOCUMENT_TYPES.find(type => type.key === 'procedure');
  if (ext === 'xls') return DMS_DOCUMENT_TYPES.find(type => type.extension === 'xlsx');
  if (ext === 'ppt') return DMS_DOCUMENT_TYPES.find(type => type.extension === 'pptx');
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return DMS_DOCUMENT_TYPES.find(type => type.key === 'image');
  }

  return DMS_DOCUMENT_TYPES.find(type => type.extension === ext)
    || DMS_DOCUMENT_TYPES.find(type => type.key === 'txt');
}

function renderDmsDocumentIcon(extension) {
  const type = getDmsDocumentType(extension);
  const badge = getFileTypeBadge(extension);

  return `
    <span class="dms-file-icon ${badge}">
      <img class="dms-doc-icon-img" src="${type.icon}" alt="${type.label}">
    </span>
  `;
}

/**
 * Render the DMS files table
 */
function renderDmsFilesTableFlat() {
  const container = document.getElementById('docSharepointList');
  if (!container) return;
  
  const filtered = getFilteredFiles();
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="dms-empty-state">
        <div class="dms-empty-icon">DOC</div>
        <h3>Aucun fichier trouvé</h3>
        <p>Il n'y a aucun fichier correspondant à vos critères de recherche.</p>
      </div>
    `;
    return;
  }
  
  const tableHTML = `
    <div class="dms-table-wrapper">
      <table class="dms-files-table">
        <thead>
          <tr>
            <th class="col-icon"></th>
            <th class="col-name">Nom du fichier</th>
            <th class="col-folder">Dossier</th>
            <th class="col-size">Taille</th>
            <th class="col-date">Modifié</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(file => renderDmsFileRow(file)).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = tableHTML;
}

/**
 * Render folders and their nested contents inside docSharepointList
 */
function renderDmsFilesTableLegacy() {
  const container = document.getElementById('docSharepointList');
  if (!container) return;

  const filtered = getFilteredFiles();

  const treeFolders = buildDmsFolderTree(filtered);

  container.innerHTML = `
    <div class="dms-tree" role="tree" aria-label="Dossiers documentaires">
      ${treeFolders.map(folder => renderDmsFolderNode(folder)).join('')}
    </div>
  `;

  setupDmsTreeListeners(container);
  return;

  if (filtered.length === 0 && dmsState.searchTerm) {
    container.innerHTML = `
      <div class="dms-empty-state">
        <div class="dms-empty-icon">DOC</div>
        <h3>Aucun fichier trouvé</h3>
        <p>Il n'y a aucun fichier correspondant à vos critères de recherche.</p>
      </div>
    `;
    return;
  }

  const folders = buildDmsFolderTree(filtered);

  container.innerHTML = `
    <div class="dms-tree" role="tree" aria-label="Dossiers documentaires">
      ${folders.map(folder => renderDmsFolderNode(folder)).join('')}
    </div>
  `;

  setupDmsTreeListeners(container);
}

function renderDmsFilesTable() {
  const container = document.getElementById('docSharepointList');
  if (!container) return;

  const hadSelection = Boolean(normalizeDmsFolderPath(dmsState.selectedFolder));
  const currentFolder = getDmsCurrentFolder();
  dmsState.selectedFolder = currentFolder;
  if (!hadSelection) ensureDmsFolderVisible(currentFolder);
  updateDmsCurrentPath();

  const filteredFiles = getFilteredFiles();
  const folders = buildDmsFolderTree(filteredFiles);
  const searchTokens = getDmsSearchTokens();
  const searchSummary = searchTokens.length
    ? `
      <div class="dms-search-summary" aria-live="polite">
        <strong>${filteredFiles.length}</strong> fichier(s) trouvé(s) pour « ${escapeHtml(dmsState.searchTerm)} ».
      </div>
    `
    : '';

  container.innerHTML = `
    ${searchSummary}
    <div class="dms-tree" role="tree" aria-label="Dossiers documentaires">
      ${folders.length
        ? folders.map(folder => renderDmsFolderNode(folder)).join('')
        : '<div class="dms-tree-empty-search">Aucun document ou dossier ne correspond à cette recherche.</div>'}
    </div>
  `;

  setupDmsTreeListeners(container);
}

function renderDmsFolderNode(node) {
  const depth = getDmsFolderDepth(node.path);
  const expanded = dmsState.expandedFolders.has(node.path);
  const selected = getDmsCurrentFolder() === node.path;
  const children = node.sortedChildren || [];
  const totalItems = node.files.length + children.length;
  const indicator = getDmsDisplayPath(node.path);

  return `
    <div class="dms-tree-node" role="treeitem" aria-expanded="${expanded}" data-folder-path="${escapeAttr(node.path)}">
      <button
        type="button"
        class="dms-tree-folder ${expanded ? 'is-expanded' : ''} ${selected ? 'is-selected' : ''}"
        data-folder-toggle="${escapeAttr(node.path)}"
        style="--dms-folder-depth: ${depth};"
      >
        <span class="dms-tree-caret" aria-hidden="true"></span>
        <span class="dms-tree-folder-icon" aria-hidden="true">
          <img src="${DMS_FOLDER_TYPE.icon}" alt="">
        </span>
        <span class="dms-tree-folder-text">
          <span class="dms-tree-folder-name">${escapeHtml(getDmsDisplayFolderName(node.path))}</span>
          <span class="dms-tree-folder-path">${escapeHtml(indicator)}</span>
        </span>
        <span class="dms-tree-folder-count">${totalItems}</span>
      </button>
      ${expanded ? renderDmsFolderContents(node, children) : ''}
    </div>
  `;
}

function renderDmsFolderContents(node, children) {
  const depth = getDmsFolderDepth(node.path) + 1;
  const childFolders = children.map(child => renderDmsFolderNode(child)).join('');
  const fileRows = node.files.map(file => renderDmsTreeFile(file, depth)).join('');
  const emptyMessage = !childFolders && node.files.length === 0
    ? `<div class="dms-tree-empty" style="--dms-folder-depth: ${depth};">Aucun fichier dans ce dossier.</div>`
    : '';

  if (!childFolders && !fileRows && !emptyMessage) {
    return `
      <div class="dms-tree-empty" style="--dms-folder-depth: ${depth};">
        Aucun sous-dossier.
      </div>
    `;
  }

  return `
    <div class="dms-tree-children">
      ${childFolders}
      ${fileRows}
      ${emptyMessage}
    </div>
  `;
}

function renderDmsTreeFile(file, depth) {
  return `
    <div class="dms-tree-file" style="--dms-folder-depth: ${depth};">
      ${renderDmsFileItem(file)}
    </div>
  `;
}

function renderDmsFileItem(file) {
  const size = formatFileSize(file.size);
  const date = formatDate(file.modified);
  const fileName = escapeHtml(file.name);
  const actionPath = file.relPath || file.path;

  return `
    <div class="dms-tree-file-item" data-file-path="${escapeAttr(file.path)}">
      ${renderDmsDocumentIcon(file.type)}
      <span class="dms-file-name" title="${fileName}">${fileName}</span>
      <span class="dms-file-meta">${size}</span>
      <span class="dms-file-meta">${date}</span>
      <span class="dms-actions">
        <button class="btn-action btn-download" type="button" data-dms-action="download" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Télécharger">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
        </button>
        <button class="btn-action btn-open" type="button" data-dms-action="open" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Ouvrir">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 3h8l2-2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>
        </button>
        <button class="btn-action btn-cycle" type="button" data-dms-action="cycle" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Modifier le cycle de vie">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.96-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm-6.76.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-1.01.25-1.96.7-2.8L5.24 4.74z"/></svg>
        </button>
        <button class="btn-action btn-delete" type="button" data-dms-action="delete" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Supprimer">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z"/></svg>
        </button>
      </span>
    </div>
  `;
}

function setupDmsTreeListeners(container) {
  container.querySelectorAll('[data-folder-toggle]').forEach(button => {
    button.addEventListener('click', () => {
      const folderPath = button.dataset.folderToggle;
      if (dmsState.expandedFolders.has(folderPath)) {
        dmsState.expandedFolders.delete(folderPath);
      } else {
        dmsState.expandedFolders.add(folderPath);
      }

      dmsState.selectedFolder = folderPath;
      renderDmsFilesTable();
    });
  });

  container.querySelectorAll('[data-dms-action]').forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = button.dataset.dmsAction;
      const filePath = button.dataset.filePath;
      const fileName = button.dataset.fileName;

      if (action === 'download') {
        downloadDmsFile(filePath, fileName);
      } else if (action === 'open') {
        openDmsFile(filePath, fileName);
      } else if (action === 'share') {
        shareDmsFile(filePath, fileName);
      } else if (action === 'cycle') {
        showDmsLifecycleModal(filePath, fileName);
      } else if (action === 'delete') {
        deleteDmsFile(filePath, fileName);
      }
    });
  });
}

/**
 * Render a single file row
 */
function renderDmsFileRowLegacy(file) {
  const icon = getFileIcon(file.type);
  const badge = getFileTypeBadge(file.type);
  const size = formatFileSize(file.size);
  const date = formatDate(file.modified);
  const fileName = escapeHtml(file.name);
  const folderName = escapeHtml(file.folder);
  const actionPath = file.relPath || file.path;
  
  return `
    <tr class="dms-file-row" data-file-path="${escapeAttr(file.path)}">
      <td class="col-icon">${renderDmsDocumentIcon(file.type)}</td>
      <td class="col-name">
        <div class="dms-file-info">
          <span class="dms-file-name" title="${fileName}">${fileName}</span>
        </div>
      </td>
      <td class="col-folder"><span class="dms-folder-tag">${folderName}</span></td>
      <td class="col-size"><span class="dms-size">${size}</span></td>
      <td class="col-date"><span class="dms-date">${date}</span></td>
      <td class="col-actions">
        <div class="dms-actions">
          <button class="btn-action btn-download" onclick="downloadDmsFile('${file.path}', '${file.name}')" title="Télécharger">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
          <button class="btn-action btn-open" onclick="openDmsFile('${file.path}', '${file.name}')" title="Ouvrir">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 3h8l2-2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>
          </button>
          <button class="btn-action btn-share" onclick="shareDmsFile('${file.path}', '${file.name}')" title="Partager">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.15c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.44 9.31 6.77 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.77 0 1.44-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
          </button>
          <button class="btn-action btn-delete" onclick="deleteDmsFile('${file.path}', '${file.name}')" title="Supprimer">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function renderDmsFileRow(file) {
  const badge = getFileTypeBadge(file.type);
  const size = formatFileSize(file.size);
  const date = formatDate(file.modified);
  const fileName = escapeHtml(file.name);
  const folderName = escapeHtml(file.folder);
  const actionPath = file.relPath || file.path;

  return `
    <tr class="dms-file-row" data-file-path="${escapeAttr(actionPath)}">
      <td class="col-icon">${renderDmsDocumentIcon(file.type)}</td>
      <td class="col-name">
        <div class="dms-file-info">
          <span class="dms-file-name" title="${fileName}">${fileName}</span>
        </div>
      </td>
      <td class="col-folder"><span class="dms-folder-tag">${folderName}</span></td>
      <td class="col-size"><span class="dms-size">${size}</span></td>
      <td class="col-date"><span class="dms-date">${date}</span></td>
      <td class="col-actions">
        <div class="dms-actions">
          <button class="btn-action btn-download" type="button" data-dms-action="download" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Télécharger">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
          <button class="btn-action btn-open" type="button" data-dms-action="open" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Ouvrir">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 3h8l2-2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>
          </button>
          <button class="btn-action btn-share" type="button" data-dms-action="share" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Partager">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.15c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.44 9.31 6.77 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.77 0 1.44-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
          </button>
          <button class="btn-action btn-delete" type="button" data-dms-action="delete" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="Supprimer">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Download DMS file
 */
function downloadDmsFileLegacy(filePath, fileName) {
  try {
    // Create a hidden link and trigger download
    const link = document.createElement('a');
    link.href = 'DMS/uploads/' + filePath.substring(filePath.indexOf('uploads') + 8);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Erreur lors du téléchargement du fichier:', error);
    alert('Erreur lors du téléchargement du fichier');
  }
}

/**
 * Open DMS file
 */
function openDmsFileLegacy(filePath, fileName) {
  try {
    const path = 'DMS/uploads/' + filePath.substring(filePath.indexOf('uploads') + 8);
    window.open(path, '_blank');
  } catch (error) {
    console.error("Erreur lors de l'ouverture du fichier:", error);
    alert('Erreur lors de l\'ouverture du fichier');
  }
}

/**
 * Share DMS file
 */
function shareDmsFile(filePath, fileName) {
  alert('Partage de fichier: ' + fileName + '\n\nCette fonctionnalité sera bientôt disponible.');
}

/**
 * Delete DMS file
 */
function deleteDmsFileLegacy(filePath, fileName) {
  if (confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${fileName}" ?`)) {
    alert('Suppression de fichier: ' + fileName + '\n\nCette fonctionnalité sera bientôt disponible.');
  }
}

function getDmsRelativeFilePath(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  const uploadsIndex = normalized.toLowerCase().lastIndexOf('/uploads/');
  if (uploadsIndex !== -1) {
    return normalized.substring(uploadsIndex + 9).replace(/^\/+/, '');
  }

  return normalized.replace(/^DMS\/uploads\//i, '').replace(/^\/+/, '');
}

function getDmsFileUrl(filePath) {
  const relativePath = getDmsRelativeFilePath(filePath);
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  return `DMS/uploads/${encodedPath}`;
}

function getDmsFileExtension(filePath, fileName) {
  const value = String(fileName || filePath || '');
  const parts = value.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function downloadDmsFile(filePath, fileName) {
  try {
    const link = document.createElement('a');
    link.href = getDmsFileUrl(filePath);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Erreur lors du téléchargement du fichier:', error);
    alert('Erreur lors du téléchargement du fichier');
  }
}

function openDmsFile(filePath, fileName) {
  try {
    showDmsFilePreview(filePath, fileName);
  } catch (error) {
    console.error("Erreur lors de l'ouverture du fichier:", error);
    alert('Erreur lors de l\'ouverture du fichier');
  }
}

function closeDmsPreviewModal() {
  const modal = document.getElementById('dmsPreviewOverlay');
  if (modal) modal.remove();
}

function showDmsLifecycleModal(filePath, fileName) {
  closeFolderSelectionModal();

  const relativePath = getDmsRelativeFilePath(filePath);
  const currentStep = normalizeDmsLifecycleSegment(getDmsLifecycleStepFromPath(relativePath));
  const modal = document.createElement('div');
  modal.className = 'dms-modal-overlay';
  modal.id = 'dmsModalOverlay';
  modal.innerHTML = `
    <div class="dms-modal-content dms-lifecycle-modal">
      <div class="dms-modal-header">
        <h3>Modifier le cycle de vie</h3>
        <button class="dms-modal-close" type="button" onclick="closeFolderSelectionModal()">x</button>
      </div>
      <div class="dms-modal-body">
        <p><strong>${escapeHtml(fileName)}</strong></p>
        <p class="dms-cycle-current">Étape actuelle : ${escapeHtml(currentStep || 'Non classé')}</p>
        <div class="dms-cycle-grid">
          ${DMS_LIFECYCLE_STEPS.map(step => `
            <button class="dms-cycle-step ${step === currentStep ? 'is-current' : ''}" type="button" onclick="moveDmsFileLifecycle(${escapeJsArg(relativePath)}, ${escapeJsArg(fileName)}, ${escapeJsArg(step)})">
              ${escapeHtml(step)}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="dms-modal-footer">
        <button class="btn btn-secondary" type="button" onclick="closeFolderSelectionModal()">Annuler</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function moveDmsFileLifecycle(relativePath, fileName, targetStep) {
  try {
    const response = await fetch('api/documentation/move_dms_file_lifecycle.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ path: relativePath, targetStep: targetStep })
    });
    const result = await response.json();

    if (!result.success) {
      alert('Erreur : ' + (result.error || 'Impossible de modifier le cycle de vie'));
      return;
    }

    closeFolderSelectionModal();
    dmsState.selectedFolder = normalizeDmsDisplayFolderPath(result.folder || '');
    ensureDmsFolderVisible(dmsState.selectedFolder);
    await refreshDmsFromPhysicalFolder();
    alert(`"${fileName}" déplacé vers "${targetStep}".`);
  } catch (error) {
    console.error('Erreur lors du changement de cycle:', error);
    alert('Erreur lors du changement de cycle de vie');
  }
}

async function showDmsFilePreview(filePath, fileName) {
  closeDmsPreviewModal();

  const fileUrl = getDmsFileUrl(filePath);
  const extension = getDmsFileExtension(filePath, fileName);
  const modal = document.createElement('div');
  modal.className = 'dms-modal-overlay dms-preview-overlay';
  modal.id = 'dmsPreviewOverlay';

  modal.innerHTML = `
    <div class="dms-modal-content dms-preview-content">
      <div class="dms-modal-header">
        <h3 title="${escapeAttr(fileName)}">${escapeHtml(fileName)}</h3>
        <button class="dms-modal-close" type="button" onclick="closeDmsPreviewModal()">x</button>
      </div>
      <div class="dms-preview-body">
        ${renderDmsPreviewBody(fileUrl, fileName, extension, {
          title: fileName,
          type: getDmsPreviewTypeLabel(extension),
          subtitle: fileName,
          ref: extension ? extension.toUpperCase() : 'FICHIER',
          ie: '-',
          date: formatDate(Math.floor(Date.now() / 1000)),
          page: '1/1'
        })}
      </div>
      <div class="dms-modal-footer">
        <button class="btn btn-secondary" type="button" onclick="downloadDmsFile(${escapeJsArg(filePath)}, ${escapeJsArg(fileName)})">Télécharger</button>
        <button class="btn btn-secondary" type="button" onclick="closeDmsPreviewModal()">Fermer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  if (['txt', 'csv', 'tsv', 'json', 'xml', 'md', 'log', 'docx', 'xlsx'].includes(extension)) {
    loadDmsReadablePreview(modal, filePath);
  }
}

async function loadDmsReadablePreview(modal, filePath) {
  const preview = modal.querySelector('[data-dms-readable-preview]');
  if (!preview) return;

  try {
    const response = await fetch(`api/documentation/preview_dms_file.php?path=${encodeURIComponent(getDmsRelativeFilePath(filePath))}`, {
      headers: { 'Accept': 'application/json' }
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      preview.innerHTML = `<div class="dms-preview-note">${escapeHtml(result.error || 'Aperçu indisponible pour ce fichier.')}</div>`;
      return;
    }

    preview.innerHTML = `<pre class="dms-preview-text">${escapeHtml(result.text)}</pre>`;
  } catch (error) {
    console.error("Erreur lors du chargement de l'aperçu du fichier:", error);
    preview.innerHTML = '<div class="dms-preview-note">Aperçu indisponible pour ce fichier.</div>';
  }
}

function renderDmsPreviewBody(fileUrl, fileName, extension, identifier = {}) {
  const content = renderDmsPreviewContent(fileUrl, fileName, extension);
  const fileType = getDmsPreviewTypeLabel(extension);
  const meta = [
    ['Nom', fileName],
    ['Type', fileType],
    ['Format', extension ? `.${extension}` : 'Fichier']
  ];

  return `
    <section class="dms-preview-document-shell">
      <div class="dms-preview-document-header">
        ${renderDmsIdentifierCard(identifier)}
        <div class="dms-preview-meta-bar">
          ${meta.map(([label, value]) => `
            <span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>
          `).join('')}
        </div>
      </div>
      <div class="dms-preview-document-content dms-preview-kind-${escapeAttr(extension || 'file')}">
        ${content}
      </div>
    </section>
  `;
}

function renderDmsPreviewContent(fileUrl, fileName, extension) {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return `<img class="dms-preview-image" src="${fileUrl}" alt="${escapeAttr(fileName)}">`;
  }

  if (['txt', 'csv', 'tsv', 'json', 'xml', 'md', 'log'].includes(extension)) {
    return `<div class="dms-readable-preview" data-dms-readable-preview>Chargement du contenu...</div>`;
  }

  if (extension === 'pdf') {
    return `<iframe class="dms-preview-frame" src="${fileUrl}" title="${escapeAttr(fileName)}"></iframe>`;
  }

  if (extension === 'docx') {
    return `
      <div class="dms-readable-preview" data-dms-readable-preview>
        Chargement du contenu du document...
      </div>
    `;
  }

  if (extension === 'doc') {
    return renderDmsPreviewUnavailable(fileName, extension, "Le format .doc ancien ne peut pas être lu directement par le navigateur. Téléchargez le fichier pour l'ouvrir avec Word.");
  }

  if (extension === 'xlsx') {
    return `
      <div class="dms-readable-preview" data-dms-readable-preview>
        Chargement du contenu du classeur...
      </div>
    `;
  }

  if (extension === 'xls') {
    return `
      <object class="dms-preview-frame" data="${fileUrl}" type="${getDmsPreviewMimeType(extension)}">
        ${renderDmsPreviewUnavailable(fileName, extension, "Le navigateur ne peut pas toujours afficher Excel directement. Le fichier reste disponible au téléchargement.")}
      </object>
    `;
  }

  if (['ppt', 'pptx'].includes(extension)) {
    return renderDmsPreviewUnavailable(fileName, extension, "Le navigateur ne peut pas afficher PowerPoint directement. Téléchargez le fichier pour l'ouvrir.");
  }

  return renderDmsPreviewUnavailable(fileName, extension, 'Aperçu indisponible pour ce type de fichier.');
}

function renderDmsPreviewUnavailable(fileName, extension, message) {
  return `
    <div class="dms-preview-unavailable">
      <span class="dms-preview-unavailable-icon">${renderDmsDocumentIcon(extension)}</span>
      <strong>${escapeHtml(fileName)}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function getDmsPreviewTypeLabel(extension) {
  const labels = {
    doc: 'Document Word',
    docx: 'Document Word',
    pdf: 'Document PDF',
    xls: 'Classeur Excel',
    xlsx: 'Classeur Excel',
    csv: 'Tableau CSV',
    tsv: 'Tableau TSV',
    ppt: 'Présentation PowerPoint',
    pptx: 'Présentation PowerPoint',
    jpg: 'Image',
    jpeg: 'Image',
    png: 'Image',
    gif: 'Image',
    webp: 'Image',
    bmp: 'Image',
    svg: 'Image',
    txt: 'Document texte',
    md: 'Document texte',
    json: 'Fichier JSON',
    xml: 'Fichier XML',
    log: 'Journal'
  };

  return labels[extension] || 'Fichier';
}

function getDmsPreviewMimeType(extension) {
  const types = {
    pdf: 'application/pdf',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  return types[extension] || 'application/octet-stream';
}

function renderDmsIdentifierCard(identifier = {}) {
  const title = identifier.type || identifier.cardTitle || 'DOCUMENT';
  const subtitle = identifier.subtitle || identifier.cardSubtitle || identifier.title || 'MAÎTRISE DES DOCUMENTS';
  const ref = identifier.ref || '-';
  const ie = identifier.ie || '-';
  const date = identifier.date || formatDate(Math.floor(Date.now() / 1000));
  const page = identifier.page || '1/1';
  const logo = identifier.logoDataUrl
    ? `<img src="${identifier.logoDataUrl}" alt="Logo">`
    : `<strong>ENER</strong><span>Laboratoire De Métrologie</span>`;

  return `
    <div class="dms-identifier-card">
      <div class="dms-identifier-logo">
        ${logo}
      </div>
      <div class="dms-identifier-title">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(subtitle)}</span>
      </div>
      <div class="dms-identifier-meta">
        <b>Réf :</b><span>${escapeHtml(ref)}</span>
        <b>IE :</b><span>${escapeHtml(ie)}</span>
        <b>Date :</b><span>${escapeHtml(date)}</span>
        <b>Page :</b><span>${escapeHtml(page)}</span>
      </div>
    </div>
  `;
}

async function deleteDmsFile(filePath, fileName) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer le fichier "${fileName}" ?`)) {
    return;
  }

  try {
    const response = await fetch('api/documentation/delete_dms_file.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ path: getDmsRelativeFilePath(filePath) })
    });

    const result = await response.json();
    if (!result.success) {
      alert('Erreur: ' + (result.error || 'Impossible de supprimer le fichier'));
      return;
    }

    await loadDmsFiles();
    ensureDmsFolderVisible(getDmsCurrentFolder());
    renderDmsFilesTable();
    alert(`Fichier "${fileName}" supprimé avec succès.`);
  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error);
    alert('Erreur lors de la suppression du fichier');
  }
}

/**
 * Show folder selection modal for file placement
 */
function showDocumentTypeSelectionModal() {
  const modal = document.createElement('div');
  modal.className = 'dms-modal-overlay';
  modal.id = 'dmsModalOverlay';

  modal.innerHTML = `
    <div class="dms-modal-content">
      <div class="dms-modal-header">
        <h3>Nouveau</h3>
        <button class="dms-modal-close" onclick="closeFolderSelectionModal()">x</button>
      </div>
      <div class="dms-modal-body">
        <p>Choisissez le type de document à créer:</p>
        <div class="dms-doc-type-grid">
          ${[DMS_FOLDER_TYPE, ...DMS_DOCUMENT_TYPES].map(type => `
            <button class="dms-doc-type-button" type="button" onclick="handleDocumentTypeSelect(${escapeJsArg(type.key)})">
              <img class="dms-doc-type-icon" src="${type.icon}" alt="${type.label}">
              <span>${type.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <div class="dms-modal-footer">
        <button class="btn btn-secondary" onclick="closeFolderSelectionModal()">Annuler</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function handleDocumentTypeSelect(typeKey) {
  const currentFolder = getDmsCurrentFolder();
  if (typeKey === DMS_FOLDER_TYPE.key) {
    dmsState.pendingDocumentType = DMS_FOLDER_TYPE;
    closeFolderSelectionModal();
    handleNewFolderWithParent(currentFolder);
    return;
  }

  dmsState.pendingDocumentType = DMS_DOCUMENT_TYPES.find(type => type.key === typeKey)
    || DMS_DOCUMENT_TYPES.find(type => type.key === 'txt');
  closeFolderSelectionModal();
  handleNewDocWithFolder(getDmsWritableFolder(currentFolder, dmsState.pendingDocumentType));
}

function getDmsPlacementNodes(currentPath) {
  const folders = buildDmsFolderTree(dmsState.files);
  const normalizedPath = normalizeDmsFolderPath(currentPath);

  if (!normalizedPath) {
    return folders;
  }

  const node = findDmsFolderNode(folders, normalizedPath);
  return node ? (node.sortedChildren || []) : [];
}

function findDmsFolderNode(nodes, path) {
  for (const node of nodes) {
    if (node.path === path) return node;

    const match = findDmsFolderNode(node.sortedChildren || [], path);
    if (match) return match;
  }

  return null;
}

function renderDmsPlacementBreadcrumb(currentPath, action) {
  const normalizedPath = normalizeDmsFolderPath(currentPath);
  if (!normalizedPath) {
    return `
      <div class="dms-folder-current-path">
        <span class="dms-folder-current-label">Emplacement actuel</span>
        <div class="dms-folder-breadcrumb"><span>Dossiers principaux</span></div>
      </div>
    `;
  }

  const parts = normalizedPath.split('/');
  const items = [`<button type="button" onclick="showFolderSelectionModal(${escapeJsArg(action)}, '')">Dossiers principaux</button>`];
  let current = '';

  parts.forEach((part, index) => {
    current = current ? `${current}/${part}` : part;
    if (index === parts.length - 1) {
      items.push(`<span>${escapeHtml(part)}</span>`);
    } else {
      items.push(`<button type="button" onclick="showFolderSelectionModal(${escapeJsArg(action)}, ${escapeJsArg(current)})">${escapeHtml(part)}</button>`);
    }
  });

  return `
    <div class="dms-folder-current-path">
      <span class="dms-folder-current-label">Emplacement actuel</span>
      <div class="dms-folder-breadcrumb">${items.join('<span class="dms-folder-breadcrumb-separator">/</span>')}</div>
    </div>
  `;
}

function showFolderSelectionModal(action, currentPath = '') {
  var docSharepointList = document.getElementById('docSharepointList');
  if (!docSharepointList) return;

  closeFolderSelectionModal();
  const modal = document.createElement('div');
  modal.className = 'dms-modal-overlay';
  modal.id = 'dmsModalOverlay';

  const normalizedPath = normalizeDmsFolderPath(currentPath);
  const folders = getDmsPlacementNodes(normalizedPath);
  const folderButtons = folders.map(folder =>
    `<button class="dms-folder-button dms-folder-nav-button" type="button" onclick="showFolderSelectionModal(${escapeJsArg(action)}, ${escapeJsArg(folder.path)})">
      <span>${escapeHtml(folder.name)}</span>
      <span class="dms-folder-child-count">${(folder.sortedChildren || []).length}</span>
    </button>`
  ).join('');
  const targetLabel = action === 'import'
    ? 'le fichier'
    : action === 'folder'
      ? 'le nouveau dossier'
      : 'le document';
  
  modal.innerHTML = `
    <div class="dms-modal-content">
      <div class="dms-modal-header">
        <h3>Sélectionner l'emplacement</h3>
        <button class="dms-modal-close" onclick="closeFolderSelectionModal()">x</button>
      </div>
      <div class="dms-modal-body">
        <p>Choisissez dans quel dossier vous souhaitez placer ${targetLabel}:</p>
        ${renderDmsPlacementBreadcrumb(normalizedPath, action)}
        <div class="dms-folder-list">
          ${folderButtons || '<div class="dms-folder-empty">Aucun sous-dossier dans cet emplacement.</div>'}
        </div>
      </div>
      <div class="dms-modal-footer">
        ${normalizedPath ? `<button class="btn btn-secondary" type="button" onclick="showFolderSelectionModal(${escapeJsArg(action)}, ${escapeJsArg(getDmsParentPath(normalizedPath))})">Retour</button>` : ''}
        ${normalizedPath ? `<button class="btn btn-primary" type="button" onclick="handleFolderSelect(${escapeJsArg(action)}, ${escapeJsArg(normalizedPath)})">Choisir ce dossier</button>` : ''}
        <button class="btn btn-secondary" onclick="closeFolderSelectionModal()">Annuler</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

/**
 * Close folder selection modal
 */
function closeFolderSelectionModal() {
  const modal = document.getElementById('dmsModalOverlay');
  if (modal) modal.remove();
}

/**
 * Handle folder selection
 */
function handleFolderSelect(action, folder) {
  closeFolderSelectionModal();
  
  if (action === 'import') {
    handleImportWithFolder(getDmsWritableFolder(folder));
  } else if (action === 'new') {
    handleNewDocWithFolder(getDmsWritableFolder(folder, dmsState.pendingDocumentType));
  } else if (action === 'folder') {
    handleNewFolderWithParent(folder);
  }
}

function getDmsDocumentClassFolderFromType(documentType) {
  const key = documentType && documentType.key;
  if (key === 'instruction') return 'Instruction';
  if (key === 'formulaire') return 'Formulaire';
  if (key === 'enregistrement') return 'Enregistrement';
  return 'Procédure';
}

function getDmsWritableFolder(folder, documentType = null) {
  const parts = normalizeDmsDisplayFolderPath(folder).split('/').filter(Boolean);
  if (!parts.length || !DMS_PROCESS_ROOTS.includes(parts[0])) {
    return normalizeDmsDisplayFolderPath(folder);
  }

  const root = parts[0];
  const lifecycle = parts.find(part => DMS_LIFECYCLE_STEPS.includes(part)) || '1-créer';
  const classSegment = parts.find(part => DMS_DOCUMENT_CLASS_FOLDERS.includes(part))
    || getDmsDocumentClassFolderFromType(documentType);

  return `${root}/${classSegment}/${lifecycle}`;
}

/**
 * Handle import with selected folder
 */
function handleImportWithFolder(folder) {
  folder = getDmsWritableFolder(folder);
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  
  input.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length) return;
    
    let successCount = 0;
    for (let file of files) {
      try {
        await uploadFileToFolder(file, folder);
        successCount++;
      } catch (error) {
        console.error('Erreur lors du téléversement du fichier:', error);
      }
    }
    // Refresh the file list
    dmsState.pendingDocumentType = null;
    dmsState.selectedFolder = folder;
    await refreshDmsFromPhysicalFolder();
    alert(`${successCount} fichier(s) importé(s) avec succès dans "${folder}"`);
  });
  
  input.click();
}

/**
 * Handle new folder with selected parent folder
 */
async function handleNewFolderWithParent(parentFolder) {
  const folderName = prompt('Nom du nouveau dossier:');
  if (!folderName) return;

  try {
    const response = await fetch('api/documentation/create_dms_folder.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        parentFolder: parentFolder,
        folderName: folderName
      })
    });

    const result = await response.json();
    if (!result.success) {
      alert('Erreur: ' + (result.error || 'Impossible de créer le dossier'));
      return;
    }

    dmsState.pendingDocumentType = null;
    dmsState.expandedFolders.add(parentFolder);
    dmsState.selectedFolder = normalizeDmsFolderPath(result.folder || `${parentFolder}/${folderName}`);
    await refreshDmsFromPhysicalFolder();
    alert(`Dossier "${folderName}" créé avec succès dans "${parentFolder}"`);
  } catch (error) {
    console.error('Erreur lors de la création du dossier:', error);
    alert('Erreur lors de la création du dossier');
  }
}

/**
 * Handle new document with selected folder
 */
function handleNewDocWithFolder(folder) {
  const documentType = dmsState.pendingDocumentType || DMS_DOCUMENT_TYPES.find(type => type.key === 'txt');
  showNewDocumentNameModal(getDmsWritableFolder(folder, documentType), documentType);
}

function showNewDocumentNameModal(folder, documentType) {
  closeFolderSelectionModal();

  const modal = document.createElement('div');
  modal.className = 'dms-modal-overlay';
  modal.id = 'dmsModalOverlay';

  modal.innerHTML = `
    <div class="dms-modal-content dms-name-modal-content">
      <div class="dms-modal-header">
        <h3>Nouveau ${escapeHtml(documentType.label)}</h3>
        <button class="dms-modal-close" type="button" onclick="closeFolderSelectionModal()">x</button>
      </div>
      <form class="dms-name-form" onsubmit="submitNewDocumentName(event, ${escapeJsArg(folder)})">
        <div class="dms-modal-body">
          <label class="dms-field-label" for="dmsNewDocumentName">Nom du document</label>
          <input class="dms-text-input" id="dmsNewDocumentName" name="fileName" type="text" autocomplete="off" required>
          <div class="dms-field-grid">
            <label>
              <span>Titre</span>
              <input class="dms-text-input" name="title" type="text" required>
            </label>
            <label>
              <span>Processus</span>
              <select class="dms-text-input" name="processus" required>
                <option>Processus pilotage</option>
                <option>Processus opérationnel</option>
                <option>Processus support</option>
              </select>
            </label>
            <label>
              <span>Type</span>
              <select class="dms-text-input" name="docType" required>
                <option>${escapeHtml(documentType.label)}</option>
                <option>Procédure</option>
                <option>Instruction</option>
                <option>Formulaire</option>
                <option>Enregistrement</option>
                <option>Manuel qualité</option>
                <option>Politique Qualité</option>
              </select>
            </label>
            <label>
              <span>Version</span>
              <input class="dms-text-input" name="version" type="text" value="1.0" required>
            </label>
            <label>
              <span>Statut</span>
              <select class="dms-text-input" name="status" required>
                <option>Brouillon</option>
                <option>En vérification</option>
                <option>En approbation</option>
                <option>Approuvé</option>
                <option>Diffusé</option>
                <option>En vigueur</option>
                <option>En correction</option>
                <option>Archivé</option>
              </select>
            </label>
            <label>
              <span>Responsable</span>
              <input class="dms-text-input" name="owner" type="text" required>
            </label>
          </div>
          <div class="dms-field-grid">
            <label>
              <span>Réf</span>
              <input class="dms-text-input" name="ref" type="text" value="${escapeAttr(documentType.key === 'procedure' ? 'PPil-01' : '')}" required>
            </label>
            <label>
              <span>IE</span>
              <input class="dms-text-input" name="ie" type="text" value="11" required>
            </label>
            <label>
              <span>Date</span>
              <input class="dms-text-input" name="date" type="text" value="${escapeAttr(new Date().toLocaleDateString('fr-FR'))}" required>
            </label>
            <label>
              <span>Page</span>
              <input class="dms-text-input" name="page" type="text" value="1/1" required>
            </label>
          </div>
          <label class="dms-field-label dms-field-label-spaced" for="dmsCardSubtitle">Titre du document dans l'en-tête</label>
          <input class="dms-text-input" id="dmsCardSubtitle" name="subtitle" type="text" placeholder="${escapeAttr(documentType.cardSubtitle || 'MAÎTRISE DES DOCUMENTS')}">
          <label class="dms-field-label dms-field-label-spaced" for="dmsHeaderLogo">Logo de l'en-tête</label>
          <input class="dms-file-input" id="dmsHeaderLogo" name="logo" type="file" accept="image/png,image/jpeg,image/jpg">
          <div class="dms-identifier-preview">
            ${renderDmsIdentifierCard({
              type: documentType.cardTitle || documentType.label.toUpperCase(),
              subtitle: documentType.cardSubtitle || 'MAÎTRISE DES DOCUMENTS',
              ref: documentType.key === 'procedure' ? 'PPil-01' : '-',
              ie: '11',
              date: new Date().toLocaleDateString('fr-FR'),
              page: '1/1'
            })}
          </div>
          <div class="dms-field-help">Modèle: ${escapeHtml(documentType.label)}  -  Extension: .${escapeHtml(documentType.extension)}  -  Emplacement: ${escapeHtml(folder)}</div>
        </div>
        <div class="dms-modal-footer">
          <button class="btn btn-secondary" type="button" onclick="closeFolderSelectionModal()">Annuler</button>
          <button class="btn btn-primary" type="submit">Créer</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);
  const input = document.getElementById('dmsNewDocumentName');
  if (input) input.focus();
}

function readDmsFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Logo illisible'));
    reader.readAsDataURL(file);
  });
}

async function submitNewDocumentName(event, folder) {
  event.preventDefault();

  const documentType = dmsState.pendingDocumentType || DMS_DOCUMENT_TYPES.find(type => type.key === 'txt');
  const input = event.target.querySelector('[name="fileName"]');
  const fileName = input ? input.value.trim() : '';
  const logoInput = event.target.querySelector('[name="logo"]');
  const logoFile = logoInput && logoInput.files ? logoInput.files[0] : null;
  let logoDataUrl = '';

  try {
    logoDataUrl = await readDmsFileAsDataUrl(logoFile);
  } catch (error) {
    console.error("Erreur lors de la lecture du logo d'en-tête:", error);
    alert('Erreur lors de la lecture du logo');
    return;
  }

  const identifier = {
    type: documentType.cardTitle || documentType.label.toUpperCase(),
    subtitle: event.target.querySelector('[name="subtitle"]')?.value.trim() || fileName || documentType.cardSubtitle || 'MAÎTRISE DES DOCUMENTS',
    ref: event.target.querySelector('[name="ref"]')?.value.trim() || '-',
    ie: event.target.querySelector('[name="ie"]')?.value.trim() || '-',
    date: event.target.querySelector('[name="date"]')?.value.trim() || formatDate(Math.floor(Date.now() / 1000)),
    page: event.target.querySelector('[name="page"]')?.value.trim() || '1/1',
    logoDataUrl: logoDataUrl
  };
  const metadata = {
    titre_document: event.target.querySelector('[name="title"]')?.value.trim() || fileName,
    reference_documentaire: identifier.ref,
    processus: event.target.querySelector('[name="processus"]')?.value.trim() || docProcessFromFolder(folder),
    type_document: event.target.querySelector('[name="docType"]')?.value.trim() || documentType.label,
    version: event.target.querySelector('[name="version"]')?.value.trim() || '1.0',
    statut: event.target.querySelector('[name="status"]')?.value.trim() || 'Brouillon',
    responsable_redacteur: event.target.querySelector('[name="owner"]')?.value.trim() || 'Utilisateur',
    observation: `Document créé depuis DMS/uploads/${folder}`
  };

  if (!fileName || !metadata.titre_document || !metadata.reference_documentaire || !metadata.processus || !metadata.type_document || !metadata.version || !metadata.statut || !metadata.responsable_redacteur) return;

  const docContent = `Nouveau document - ${new Date().toLocaleString('fr-FR')}\nType: ${documentType.label}\nEmplacement: ${folder}\nTitre: ${fileName}`;

  closeFolderSelectionModal();
  createNewDocumentFile(fileName, docContent, folder, documentType, identifier, metadata);
}

/**
 * Upload file to specific folder
 */
async function uploadFileToFolder(file, folder) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    
    const response = await fetch('api/documentation/upload_dms_file.php', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    if (!result.success) {
      console.error('Upload error:', result.error);
      throw new Error(result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Erreur lors du téléversement du fichier:', error);
    throw error;
  }
}

/**
 * Create new document file
 */
function docProcessFromFolder(folder) {
  const first = String(folder || '').split(/[\\/]/).filter(Boolean)[0] || '';
  const key = first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (key.includes('pilotage')) return 'Processus pilotage';
  if (key.includes('operationnel')) return 'Processus opérationnel';
  if (key.includes('support')) return 'Processus support';
  if (key.includes('politique')) return 'Politique Qualité';
  if (key.includes('manuel')) return 'Manuel qualité';
  return first || 'Processus support';
}

async function createNewDocumentFile(fileName, content, folder, documentType, identifier = {}, metadata = {}) {
  const selectedType = documentType || DMS_DOCUMENT_TYPES.find(type => type.key === 'txt');
  try {
    const response = await fetch('api/documentation/create_dms_document.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileName,
        content: content,
        folder: folder,
        extension: selectedType.extension,
        templateType: selectedType.templateType || selectedType.key,
        identifier: identifier
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      alert('Erreur: ' + (result.error || 'Impossible de créer le document'));
      return;
    }
    
    if (result.path) {
      const saveResponse = await fetch('api/documentation/save_document.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...metadata,
          chemin_fichier: result.path,
          actorName: metadata.responsable_redacteur || 'Utilisateur'
        })
      });
      const saveResult = await saveResponse.json();
      if (!saveResult.success) {
        alert('Document créé, mais fiche Maîtrise documentaire non enregistrée: ' + (saveResult.error || 'Erreur inconnue'));
      }
    }
    // Refresh the file list
    dmsState.selectedFolder = folder;
    await refreshDmsFromPhysicalFolder();
    showDmsInfoModal('Document créé', `Document "${fileName}" créé avec succès dans "${folder}".`);
  } catch (error) {
    console.error('Erreur lors de la création du document:', error);
    alert('Erreur lors de la création du document');
  }
}

function showDmsInfoModal(title, message) {
  closeFolderSelectionModal();

  const modal = document.createElement('div');
  modal.className = 'dms-modal-overlay';
  modal.id = 'dmsModalOverlay';
  modal.innerHTML = `
    <div class="dms-modal-content dms-info-modal-content">
      <div class="dms-modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="dms-modal-close" type="button" onclick="closeFolderSelectionModal()">x</button>
      </div>
      <div class="dms-modal-body">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="dms-modal-footer">
        <button class="btn btn-primary" type="button" onclick="closeFolderSelectionModal()">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

/**
 * Open file import dialog
 */
function openFileImportDialog() {
  handleImportWithFolder(getDmsCurrentFolder());
}

/**
 * Create new document
 */
function createNewDocument() {
  showDocumentTypeSelectionModal();
}

/**
 * Reset DMS filters
 */
function resetDmsFilters() {
  dmsState.searchTerm = '';
  dmsState.currentFilter = 'all';
  dmsState.rootFilter = 'all';
  dmsState.typeFilter = 'all';
  
  const searchInput = document.getElementById('docSearchInput');
  if (searchInput) searchInput.value = '';
  
  const filterSelect = document.getElementById('docFilterSelect');
  if (filterSelect) filterSelect.value = 'all';

  const rootFilterSelect = document.getElementById('docRootFilterSelect');
  if (rootFilterSelect) rootFilterSelect.value = 'all';

  const typeFilterSelect = document.getElementById('docTypeFilterSelect');
  if (typeFilterSelect) typeFilterSelect.value = 'all';
  
  renderDmsFilesTable();
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initDmsFileDisplay, 300);
});

