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
  expandedFolders: new Set()
};

const DMS_DEFAULT_FOLDERS = [
  'Politique qualité',
  'Procesus Operationnel',
  'Procesus Pilotage',
  'Procesus support',
  'manuel qualité'
];

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
    'docx': '📄', 'doc': '📄',
    'xlsx': '📊', 'xls': '📊',
    'pdf': '📕',
    'pptx': '🎯', 'ppt': '🎯',
    'txt': '📝',
    'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️',
    'zip': '🗜️'
  };
  return iconMap[ext] || '📎';
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
        <div class="dms-empty-icon">📁</div>
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
        <div class="dms-empty-icon">ðŸ“</div>
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
        <span class="dms-tree-folder-icon" aria-hidden="true">ðŸ“</span>
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
      <td class="col-icon"><span class="dms-file-icon ${badge}">📄</span></td>
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
      <td class="col-icon"><span class="dms-file-icon ${badge}">📄</span></td>
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
    console.error('Error downloading file:', error);
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
    console.error('Error opening file:', error);
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
    alert('Erreur lors du téléchargement du fichier');
  }
}

function openDmsFile(filePath, fileName) {
  try {
    window.open(getDmsFileUrl(filePath), '_blank', 'noopener');
  } catch (error) {
    console.error('Error opening file:', error);
    alert('Erreur lors de l\'ouverture du fichier');
  }
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
    renderDmsFilesTable();
    alert(`Fichier "${fileName}" supprimé avec succès.`);
  } catch (error) {
    console.error('Error deleting file:', error);
    alert('Erreur lors de la suppression du fichier');
  }
}

/**
 * Show folder selection modal for file placement
 */
function showFolderSelectionModal(action) {
    var docSharepointList = document.getElementById('docSharepointList');
    if (!docSharepointList) return;
  const modal = document.createElement('div');
  modal.className = 'dms-modal-overlay';
  modal.id = 'dmsModalOverlay';
  
  const folders = Array.from(new Set([
    ...DMS_DEFAULT_FOLDERS,
    ...Object.keys(dmsState.folders || {})
  ]));
  const folderButtons = folders.map(folder => 
    `<button class="dms-folder-button" onclick="handleFolderSelect('${action}', '${folder}')">${folder}</button>`
  ).join('');
  
  modal.innerHTML = `
    <div class="dms-modal-content">
      <div class="dms-modal-header">
        <h3>Sélectionner l'emplacement</h3>
        <button class="dms-modal-close" onclick="closeFolderSelectionModal()">✕</button>
      </div>
      <div class="dms-modal-body">
        <p>Choisissez dans quel dossier vous souhaitez placer ${action === 'import' ? 'le fichier' : 'le document'}:</p>
        <div class="dms-folder-list">
          ${folderButtons}
        </div>
      </div>
      <div class="dms-modal-footer">
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
    renderDmsFilesTable();
    alert(`${successCount} fichier(s) importé(s) avec succès dans "${folder}"`);
  });
  
  input.click();
}

/**
 * Handle new document with selected folder
 */
function handleNewDocWithFolder(folder) {
  const fileName = prompt('Nom du nouveau document (sans extension):');
  if (!fileName) return;
  
  const docContent = `Nouveau document - ${new Date().toLocaleString('fr-FR')}\nEmplacement: ${folder}\nTitre: ${fileName}`;
  
  createNewDocumentFile(fileName, docContent, folder);
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
async function createNewDocumentFile(fileName, content, folder) {
  try {
    const response = await fetch('api/documentation/create_dms_document.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileName,
        content: content,
        folder: folder
      })
    });
    
    const result = await response.json();
    if (!result.success) {
      alert('Erreur: ' + (result.error || 'Impossible de créer le document'));
      return;
    }
    
    // Refresh the file list
    await loadDmsFiles();
    renderDmsFilesTable();
    alert(`Document "${fileName}" créé avec succès dans "${folder}"`);
  } catch (error) {
    console.error('Error creating document:', error);
    alert('Erreur lors de la création du document');
  }
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
  showFolderSelectionModal('new');
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
