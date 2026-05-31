/**
 * DMS Files Management - SharePoint Style Interface
 * Displays files from DMS/uploads in a professional table format
 */

const dmsState = {
  files: [],
  folders: {},
  currentFilter: 'all',
  searchTerm: '',
  sortBy: 'modified_desc',
  selectedFolder: null,
  pendingDocumentType: null,
  expandedFolders: new Set()
};

const DMS_DEFAULT_FOLDERS = [
  'Politique qualitÃ©',
  'Procesus Operationnel',
  'Procesus Pilotage',
  'Procesus support',
  'manuel qualitÃ©'
];

const DMS_DOCUMENT_TYPES = [
  { key: 'procedure', label: 'ProcÃ©dure', extension: 'docx', className: 'doc', text: 'PRO', icon: 'assets/dms-icons/document.svg', templateType: 'procedure', cardTitle: 'PROCEDURE', cardSubtitle: 'MAITRISE DES DOCUMENTS' },
  { key: 'instruction', label: 'Instruction', extension: 'docx', className: 'doc', text: 'INS', icon: 'assets/dms-icons/document.svg', templateType: 'instruction', cardTitle: 'INSTRUCTION', cardSubtitle: 'MAITRISE DES DOCUMENTS' },
  { key: 'formulaire', label: 'Formulaire', extension: 'docx', className: 'doc', text: 'FOR', icon: 'assets/dms-icons/document.svg', templateType: 'formulaire', cardTitle: 'FORMULAIRE', cardSubtitle: 'MAITRISE DES DOCUMENTS' },
  { key: 'enregistrement', label: 'Enregistrement', extension: 'docx', className: 'doc', text: 'ENR', icon: 'assets/dms-icons/document.svg', templateType: 'enregistrement', cardTitle: 'ENREGISTREMENT', cardSubtitle: 'MAITRISE DES DOCUMENTS' },
  { key: 'sheet', label: 'Spreadsheet', extension: 'xlsx', className: 'sheet', text: 'â–¦', icon: 'assets/dms-icons/spreadsheet.svg' },
  { key: 'pdf', label: 'PDF', extension: 'pdf', className: 'pdf', text: 'PDF', icon: 'assets/dms-icons/pdf.svg' },
  { key: 'ppt', label: 'Presentation', extension: 'pptx', className: 'ppt', text: 'PPT', icon: 'assets/dms-icons/presentation.svg' },
  { key: 'image', label: 'Image', extension: 'png', className: 'image', text: 'â–§', icon: 'assets/dms-icons/image.svg' },
  { key: 'txt', label: 'Text', extension: 'txt', className: 'txt', text: 'TXT', icon: 'assets/dms-icons/text.svg' }
];

const DMS_FOLDER_TYPE = {
  key: 'folder',
  label: 'Folder',
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

    // Show the fixed folder structure immediately, then hydrate counts/files.
    renderDmsFilesTable();
    
    // Load DMS files
    await loadDmsFiles();
    
    // Setup event listeners
    setupDmsEventListeners();
    
    // Render the table
    renderDmsFilesTable();
  } catch (error) {
    console.error('Error initializing DMS display:', error);
  }
}

/**
 * Load files from DMS/uploads
 */
async function loadDmsFiles() {
  try {
    const response = await fetch('api/documentation/get_dms_files.php', {
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
    console.error('Error loading DMS files:', error);
  }
}

/**
 * Setup event listeners for DMS controls
 */
function setupDmsEventListeners() {
  // Search input
  const searchInput = document.getElementById('docSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      dmsState.searchTerm = e.target.value.toLowerCase();
      renderDmsFilesTable();
    });
  }
  
  // Filter dropdown
  const filterSelect = document.getElementById('docFilterSelect');
  if (filterSelect) {
    filterSelect.addEventListener('change', (e) => {
      dmsState.currentFilter = e.target.value;
      renderDmsFilesTable();
    });
  }
  
  // Import button
  const importBtn = document.getElementById('docImportBtn');
  if (importBtn) {
    importBtn.addEventListener('click', openFileImportDialog);
  }
  
  // New document button
  const newBtn = document.getElementById('docNewBtn');
  if (newBtn) {
    newBtn.textContent = 'New';
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
  
  // Apply search filter
  if (dmsState.searchTerm) {
    filtered = filtered.filter(f => 
      f.name.toLowerCase().includes(dmsState.searchTerm) ||
      f.folder.toLowerCase().includes(dmsState.searchTerm)
    );
  }
  
  // Apply category filter
  if (dmsState.currentFilter !== 'all') {
    filtered = filtered.filter(f => f.folder === dmsState.currentFilter);
  }
  
  // Sort by modification date (newest first)
  filtered.sort((a, b) => b.modified - a.modified);
  
  return filtered;
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

function normalizeDmsFolderPath(path) {
  return String(path || '').replace(/^\/+|\/+$/g, '');
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
  const paths = new Set(DMS_DEFAULT_FOLDERS);

  Object.keys(dmsState.folders || {}).forEach(folder => {
    const folderPath = normalizeDmsFolderPath(folder);
    if (folderPath) paths.add(folderPath);
  });

  files.forEach(file => {
    const folderPath = normalizeDmsFolderPath(file.folder);
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
    const folderPath = normalizeDmsFolderPath(file.folder);
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
      const defaultA = DMS_DEFAULT_FOLDERS.indexOf(a.path);
      const defaultB = DMS_DEFAULT_FOLDERS.indexOf(b.path);

      if (defaultA !== -1 || defaultB !== -1) {
        if (defaultA === -1) return 1;
        if (defaultB === -1) return -1;
        return defaultA - defaultB;
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
        <div class="dms-empty-icon">ðŸ“</div>
        <h3>Aucun fichier trouvÃ©</h3>
        <p>Il n'y a aucun fichier correspondant Ã  vos critÃ¨res de recherche.</p>
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
            <th class="col-date">ModifiÃ©</th>
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
        <div class="dms-empty-icon">Ã°Å¸â€œÂ</div>
        <h3>Aucun fichier trouvÃ©</h3>
        <p>Il n'y a aucun fichier correspondant Ã  vos critÃ¨res de recherche.</p>
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

  const folders = buildDmsFolderTree(getFilteredFiles());

  container.innerHTML = `
    <div class="dms-tree" role="tree" aria-label="Dossiers documentaires">
      ${folders.map(folder => renderDmsFolderNode(folder)).join('')}
    </div>
  `;

  setupDmsTreeListeners(container);
}

function renderDmsFolderNode(node) {
  const depth = getDmsFolderDepth(node.path);
  const expanded = dmsState.expandedFolders.has(node.path);
  const children = node.sortedChildren || [];
  const totalItems = node.files.length + children.length;
  const hasContent = hasDmsNodeContent(node);
  const indicator = node.path.split('/').join(' / ');

  return `
    <div class="dms-tree-node" role="treeitem" aria-expanded="${expanded}" data-folder-path="${escapeAttr(node.path)}">
      <button
        type="button"
        class="dms-tree-folder ${expanded ? 'is-expanded' : ''}"
        data-folder-toggle="${escapeAttr(node.path)}"
        style="--dms-folder-depth: ${depth};"
      >
        <span class="dms-tree-caret" aria-hidden="true"></span>
        <span class="dms-tree-folder-icon" aria-hidden="true">
          <img src="${DMS_FOLDER_TYPE.icon}" alt="">
        </span>
        <span class="dms-tree-folder-text">
          <span class="dms-tree-folder-name">${escapeHtml(node.name)}</span>
          <span class="dms-tree-folder-path">${escapeHtml(indicator)}</span>
        </span>
        <span class="dms-tree-folder-count">${totalItems}</span>
      </button>
      ${expanded ? renderDmsFolderContents(node, children, hasContent) : ''}
    </div>
  `;
}

function renderDmsFolderContents(node, children, hasContent) {
  const depth = getDmsFolderDepth(node.path) + 1;
  const fileRows = node.files.map(file => renderDmsTreeFile(file, depth)).join('');
  const childFolders = children.map(child => renderDmsFolderNode(child)).join('');

  if (!hasContent) {
    return `
      <div class="dms-tree-empty" style="--dms-folder-depth: ${depth};">
        Aucun fichier dans ce dossier.
      </div>
    `;
  }

  return `
    <div class="dms-tree-children">
      ${fileRows}
      ${childFolders}
    </div>
  `;
}

function renderDmsTreeFile(file, depth) {
  return `
    <div class="dms-tree-file" style="--dms-folder-depth: ${depth};">
      <table class="dms-files-table dms-tree-file-table">
        <tbody>
          ${renderDmsFileRow(file)}
        </tbody>
      </table>
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
          <button class="btn-action btn-download" onclick="downloadDmsFile('${file.path}', '${file.name}')" title="TÃ©lÃ©charger">
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
          <button class="btn-action btn-download" type="button" data-dms-action="download" data-file-path="${escapeAttr(actionPath)}" data-file-name="${escapeAttr(file.name)}" title="TÃ©lÃ©charger">
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
    console.error('Error downloading file:', error);
    alert('Erreur lors du tÃ©lÃ©chargement du fichier');
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
    console.error('Error opening file:', error);
    alert('Erreur lors de l\'ouverture du fichier');
  }
}

/**
 * Share DMS file
 */
function shareDmsFile(filePath, fileName) {
  alert('Partage de fichier: ' + fileName + '\n\nCette fonctionnalitÃ© sera bientÃ´t disponible.');
}

/**
 * Delete DMS file
 */
function deleteDmsFileLegacy(filePath, fileName) {
  if (confirm(`ÃŠtes-vous sÃ»r de vouloir supprimer le fichier "${fileName}" ?`)) {
    alert('Suppression de fichier: ' + fileName + '\n\nCette fonctionnalitÃ© sera bientÃ´t disponible.');
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
    console.error('Error downloading file:', error);
    alert('Erreur lors du tÃ©lÃ©chargement du fichier');
  }
}

function openDmsFile(filePath, fileName) {
  try {
    showDmsFilePreview(filePath, fileName);
  } catch (error) {
    console.error('Error opening file:', error);
    alert('Erreur lors de l\'ouverture du fichier');
  }
}

function closeDmsPreviewModal() {
  const modal = document.getElementById('dmsPreviewOverlay');
  if (modal) modal.remove();
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
        <button class="dms-modal-close" type="button" onclick="closeDmsPreviewModal()">âœ•</button>
      </div>
      <div class="dms-preview-body">
        ${renderDmsPreviewBody(fileUrl, fileName, extension, {
          title: fileName,
          type: extension === 'docx' || extension === 'doc' ? 'DOCUMENT' : extension.toUpperCase(),
          subtitle: 'MAITRISE DES DOCUMENTS',
          ref: '-',
          ie: '-',
          date: formatDate(Math.floor(Date.now() / 1000)),
          page: '1/1'
        })}
      </div>
      <div class="dms-modal-footer">
        <button class="btn btn-secondary" type="button" onclick="downloadDmsFile(${escapeJsArg(filePath)}, ${escapeJsArg(fileName)})">TÃ©lÃ©charger</button>
        <button class="btn btn-secondary" type="button" onclick="closeDmsPreviewModal()">Fermer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  if (extension === 'txt') {
    const textPreview = modal.querySelector('[data-dms-text-preview]');
    try {
      const response = await fetch(fileUrl, { headers: { 'Accept': 'text/plain' } });
      textPreview.textContent = response.ok
        ? await response.text()
        : 'AperÃ§u indisponible pour ce fichier.';
    } catch (error) {
      console.error('Error loading text preview:', error);
      textPreview.textContent = 'AperÃ§u indisponible pour ce fichier.';
    }
  }
}

function renderDmsPreviewBody(fileUrl, fileName, extension, identifier = {}) {
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return `<img class="dms-preview-image" src="${fileUrl}" alt="${escapeAttr(fileName)}">`;
  }

  if (extension === 'txt') {
    return `<pre class="dms-preview-text" data-dms-text-preview>Chargement de l'aperÃ§u...</pre>`;
  }

  if (extension === 'pdf') {
    return `<iframe class="dms-preview-frame" src="${fileUrl}" title="${escapeAttr(fileName)}"></iframe>`;
  }

  if (extension === 'doc' || extension === 'docx') {
    return `
      <div class="dms-preview-card-wrap">
        ${renderDmsIdentifierCard(identifier)}
      </div>
    `;
  }

  return `
    <div class="dms-preview-unavailable">
      <span class="dms-preview-unavailable-icon">${renderDmsDocumentIcon(extension)}</span>
      <strong>${escapeHtml(fileName)}</strong>
      <span>AperÃ§u indisponible pour ce type de fichier.</span>
    </div>
  `;
}

function renderDmsIdentifierCard(identifier = {}) {
  const title = identifier.type || identifier.cardTitle || 'DOCUMENT';
  const subtitle = identifier.subtitle || identifier.cardSubtitle || identifier.title || 'MAITRISE DES DOCUMENTS';
  const ref = identifier.ref || '-';
  const ie = identifier.ie || '-';
  const date = identifier.date || formatDate(Math.floor(Date.now() / 1000));
  const page = identifier.page || '1/1';
  const logo = identifier.logoDataUrl
    ? `<img src="${identifier.logoDataUrl}" alt="Logo">`
    : `<strong>ENER</strong><span>Laboratoire De MÃ©trologie</span>`;

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
        <b>RÃ©f :</b><span>${escapeHtml(ref)}</span>
        <b>IE :</b><span>${escapeHtml(ie)}</span>
        <b>Date :</b><span>${escapeHtml(date)}</span>
        <b>Page :</b><span>${escapeHtml(page)}</span>
      </div>
    </div>
  `;
}

async function deleteDmsFile(filePath, fileName) {
  if (!confirm(`ÃŠtes-vous sÃ»r de vouloir supprimer le fichier "${fileName}" ?`)) {
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
    renderDmsFilesTable();
    alert(`Fichier "${fileName}" supprimÃ© avec succÃ¨s.`);
  } catch (error) {
    console.error('Error deleting file:', error);
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
        <h3>New</h3>
        <button class="dms-modal-close" onclick="closeFolderSelectionModal()">Ã—</button>
      </div>
      <div class="dms-modal-body">
        <p>Choisissez le type de document Ã  crÃ©er:</p>
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
  if (typeKey === DMS_FOLDER_TYPE.key) {
    dmsState.pendingDocumentType = DMS_FOLDER_TYPE;
    closeFolderSelectionModal();
    showFolderSelectionModal('folder');
    return;
  }

  dmsState.pendingDocumentType = DMS_DOCUMENT_TYPES.find(type => type.key === typeKey)
    || DMS_DOCUMENT_TYPES.find(type => type.key === 'txt');
  closeFolderSelectionModal();
  showFolderSelectionModal('new');
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
        <h3>SÃ©lectionner l'emplacement</h3>
        <button class="dms-modal-close" onclick="closeFolderSelectionModal()">âœ•</button>
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
    handleImportWithFolder(folder);
  } else if (action === 'new') {
    handleNewDocWithFolder(folder);
  } else if (action === 'folder') {
    handleNewFolderWithParent(folder);
  }
}

/**
 * Handle import with selected folder
 */
function handleImportWithFolder(folder) {
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
        console.error('Error uploading file:', error);
      }
    }
    // Refresh the file list
    await loadDmsFiles();
    dmsState.pendingDocumentType = null;
    renderDmsFilesTable();
    alert(`${successCount} fichier(s) importÃ©(s) avec succÃ¨s dans "${folder}"`);
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
      alert('Erreur: ' + (result.error || 'Impossible de crÃ©er le dossier'));
      return;
    }

    dmsState.pendingDocumentType = null;
    dmsState.expandedFolders.add(parentFolder);
    await loadDmsFiles();
    renderDmsFilesTable();
    alert(`Dossier "${folderName}" crÃ©Ã© avec succÃ¨s dans "${parentFolder}"`);
  } catch (error) {
    console.error('Error creating folder:', error);
    alert('Erreur lors de la crÃ©ation du dossier');
  }
}

/**
 * Handle new document with selected folder
 */
function handleNewDocWithFolder(folder) {
  const documentType = dmsState.pendingDocumentType || DMS_DOCUMENT_TYPES.find(type => type.key === 'txt');
  showNewDocumentNameModal(folder, documentType);
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
        <button class="dms-modal-close" type="button" onclick="closeFolderSelectionModal()">âœ•</button>
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
                <option>Processus operationnel</option>
                <option>Processus support</option>
              </select>
            </label>
            <label>
              <span>Type</span>
              <select class="dms-text-input" name="docType" required>
                <option>${escapeHtml(documentType.label)}</option>
                <option>Procedure</option>
                <option>Instruction</option>
                <option>Formulaire</option>
                <option>Enregistrement</option>
                <option>Manuel qualitÃ©</option>
                <option>Politique QualitÃ©</option>
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
                <option>En vÃ©rification</option>
                <option>En approbation</option>
                <option>ApprouvÃ©</option>
                <option>DiffusÃ©</option>
                <option>En vigueur</option>
                <option>En correction</option>
                <option>ArchivÃ©</option>
              </select>
            </label>
            <label>
              <span>Responsable</span>
              <input class="dms-text-input" name="owner" type="text" required>
            </label>
          </div>
          <div class="dms-field-grid">
            <label>
              <span>RÃ©f</span>
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
          <label class="dms-field-label dms-field-label-spaced" for="dmsCardSubtitle">Titre du document dans l'en-tÃªte</label>
          <input class="dms-text-input" id="dmsCardSubtitle" name="subtitle" type="text" placeholder="${escapeAttr(documentType.cardSubtitle || 'MAITRISE DES DOCUMENTS')}">
          <label class="dms-field-label dms-field-label-spaced" for="dmsHeaderLogo">Logo de l'en-tÃªte</label>
          <input class="dms-file-input" id="dmsHeaderLogo" name="logo" type="file" accept="image/png,image/jpeg,image/jpg">
          <div class="dms-identifier-preview">
            ${renderDmsIdentifierCard({
              type: documentType.cardTitle || documentType.label.toUpperCase(),
              subtitle: documentType.cardSubtitle || 'MAITRISE DES DOCUMENTS',
              ref: documentType.key === 'procedure' ? 'PPil-01' : '-',
              ie: '11',
              date: new Date().toLocaleDateString('fr-FR'),
              page: '1/1'
            })}
          </div>
          <div class="dms-field-help">ModÃ¨le: ${escapeHtml(documentType.label)} Â· Extension: .${escapeHtml(documentType.extension)} Â· Emplacement: ${escapeHtml(folder)}</div>
        </div>
        <div class="dms-modal-footer">
          <button class="btn btn-secondary" type="button" onclick="closeFolderSelectionModal()">Annuler</button>
          <button class="btn btn-primary" type="submit">CrÃ©er</button>
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
    reader.onerror = () => reject(reader.error || new Error('Logo unreadable'));
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
    console.error('Error reading header logo:', error);
    alert('Erreur lors de la lecture du logo');
    return;
  }

  const identifier = {
    type: documentType.cardTitle || documentType.label.toUpperCase(),
    subtitle: event.target.querySelector('[name="subtitle"]')?.value.trim() || fileName || documentType.cardSubtitle || 'MAITRISE DES DOCUMENTS',
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
    observation: `Document cree depuis DMS/uploads/${folder}`
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
    console.error('Error uploading file:', error);
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
  if (key.includes('operationnel')) return 'Processus operationnel';
  if (key.includes('support')) return 'Processus support';
  if (key.includes('politique')) return 'Politique QualitÃ©';
  if (key.includes('manuel')) return 'Manuel qualitÃ©';
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
      alert('Erreur: ' + (result.error || 'Impossible de crÃ©er le document'));
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
        alert('Document cree, mais fiche Maitrise documentaire non enregistree: ' + (saveResult.error || 'Erreur inconnue'));
      }
    }
    // Refresh the file list
    await loadDmsFiles();
    renderDmsFilesTable();
    showDmsInfoModal('Document crÃ©Ã©', `Document "${fileName}" crÃ©Ã© avec succÃ¨s dans "${folder}".`);
  } catch (error) {
    console.error('Error creating document:', error);
    alert('Erreur lors de la crÃ©ation du document');
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
        <button class="dms-modal-close" type="button" onclick="closeFolderSelectionModal()">âœ•</button>
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
  showFolderSelectionModal('import');
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
  
  const searchInput = document.getElementById('docSearchInput');
  if (searchInput) searchInput.value = '';
  
  const filterSelect = document.getElementById('docFilterSelect');
  if (filterSelect) filterSelect.value = 'all';
  
  renderDmsFilesTable();
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(initDmsFileDisplay, 300);
});

