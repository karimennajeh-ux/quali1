/**
 * Documentation Management - SharePoint Style Interface
 * Handles document list, permissions, and file management
 */

// Global state for documentation management
const docSharepointState = {
  documents: [],
  permissions: {},
  currentFilter: 'all',
  sortBy: 'modified_desc',
  searchTerm: '',
  selectedDocId: null,
  userRole: 'Viewers' // Can be: Administrators, Approvers, Editors, Viewers
};

function qualiInfo(message) {
  if (window.showQualiModal) window.showQualiModal({ type: 'info', title: 'Information', message, confirmText: 'OK' });
  else console.info(message);
}

function qualiError(message) {
  if (window.showQualiModal) window.showQualiModal({ type: 'error', title: 'Erreur', message, confirmText: 'OK' });
  else console.error(message);
}

function qualiConfirm(options) {
  if (window.showQualiModal) return window.showQualiModal({ showCancel: true, ...options, type: options && options.type === 'error' ? 'confirm-delete' : ((options && options.type) || 'warning') });
  return Promise.resolve(false);
}

/**
 * Load documents with permissions
 */
async function loadSharepointDocuments(filter = 'all') {
  try {
    const response = await fetch('api/documentation/get_documents.php?q=&processus=all&type=all&cycle=all&statut=all', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    const data = await response.json();
    if (!data.success && !Array.isArray(data)) {
      console.error('Failed to load documents', data);
      return [];
    }

    const documents = Array.isArray(data) ? data : (data.documents || []);
    docSharepointState.documents = documents;
    
    // Load permissions for each document
    for (const doc of documents) {
      await loadDocumentPermissions(doc.id);
    }
    
    renderSharepointTable(filter);
  } catch (error) {
    console.error('Error loading documents:', error);
  }
}

/**
 * Load permissions for a specific document
 */
async function loadDocumentPermissions(documentId) {
  try {
    const response = await fetch(`api/documentation/manage_permissions.php?action=get&document_id=${documentId}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    const data = await response.json();
    if (data.success) {
      docSharepointState.permissions[documentId] = data.permissions || [];
    }
  } catch (error) {
    console.error(`Error loading permissions for document ${documentId}:`, error);
  }
}

/**
 * Render the SharePoint-style documents table
 */
function renderSharepointTable(filter = 'all') {
  const container = document.getElementById('docSharepointList');
  if (!container) return;

  let documents = docSharepointState.documents;
  
  // Apply filter
  if (filter === 'approved') {
    documents = documents.filter(d => d.statut === 'Approuvé' || d.statut === 'Diffusé');
  } else if (filter === 'pending') {
    documents = documents.filter(d => d.statut === 'En vérification' || d.statut === 'En approbation');
  } else if (filter === 'draft') {
    documents = documents.filter(d => d.statut === 'Brouillon');
  }
  
  // Apply search
  if (docSharepointState.searchTerm) {
    const term = docSharepointState.searchTerm.toLowerCase();
    documents = documents.filter(d => 
      (d.titre_document || '').toLowerCase().includes(term) ||
      (d.reference_documentaire || '').toLowerCase().includes(term)
    );
  }
  
  // Render table
  const tableHTML = `
    <div class="doc-table-wrapper">
      <table class="doc-sp-table">
        <thead>
          <tr>
            <th>Nom du fichier</th>
            <th>Modifié</th>
            <th>Modifié par</th>
            <th>Statut</th>
            <th>Permissions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${documents.map(doc => renderDocumentRow(doc)).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  container.innerHTML = tableHTML;
}

/**
 * Render a single document row
 */
function renderDocumentRow(doc) {
  const extension = (doc.extension || 'doc').toLowerCase();
  const icon = getFileIcon(extension);
  const statusBadge = getStatusBadge(doc.statut);
  const permissions = docSharepointState.permissions[doc.id] || [];
  const permissionLevel = permissions.length > 0 ? permissions[0].permission_level : 'Viewers';
  
  const lastModified = doc.date_modification || doc.updated_at || '-';
  const lastModifiedBy = doc.responsable_redacteur || 'System';
  
  return `
    <tr>
      <td>
        <div class="doc-file-name">
          <span class="doc-file-icon ${extension}">${extension.toUpperCase().substring(0, 3)}</span>
          <span title="${doc.titre_document}">${doc.titre_document || doc.reference_documentaire}</span>
        </div>
        <div class="doc-meta-text">${doc.reference_documentaire || '-'}</div>
      </td>
      <td class="doc-meta-text">${formatDate(lastModified)}</td>
      <td class="doc-meta-text">${lastModifiedBy}</td>
      <td>${statusBadge}</td>
      <td>
        <span class="doc-permission-role ${permissionLevel.toLowerCase()}">${permissionLevel}</span>
      </td>
      <td>
        <div style="display: flex; gap: 4px;">
          <button class="btn2 btn" onclick="openDocumentPermissions(${doc.id}, '${doc.titre_document}');" title="Gérer les permissions" style="padding: 4px 8px; font-size: 11px;">Permissions</button>
          <button class="btn2 btn" onclick="editDocument(${doc.id});" title="Éditer" style="padding: 4px 8px; font-size: 11px;">Éditer</button>
          <button class="btn3 btn" onclick="deleteDocument(${doc.id});" title="Supprimer" style="padding: 4px 8px; font-size: 11px;">Supprimer</button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Get file icon based on extension
 */
function getFileIcon(extension) {
  const extensionMap = {
    'doc': 'doc', 'docx': 'docx',
    'xls': 'xlsx', 'xlsx': 'xlsx',
    'pdf': 'pdf',
    'png': 'png', 'jpg': 'jpg', 'jpeg': 'jpg'
  };
  return extensionMap[extension] || 'doc';
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
  const statusMap = {
    'Brouillon': { class: 'draft', label: 'Brouillon' },
    'En vérification': { class: 'pending', label: 'En vérification' },
    'En approbation': { class: 'pending', label: 'En approbation' },
    'Approuvé': { class: 'approved', label: 'Approuvé' },
    'Diffusé': { class: 'approved', label: 'Diffusé' },
    'Archivé': { class: 'rejected', label: 'Archivé' },
    'Exclu': { class: 'rejected', label: 'Exclu' }
  };
  
  const s = statusMap[status] || { class: 'draft', label: status };
  return `<span class="doc-status-badge ${s.class}">${s.label}</span>`;
}

/**
 * Format date
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
  } catch {
    return dateStr;
  }
}

/**
 * Open permissions modal for a document
 */
function openDocumentPermissions(docId, docTitle) {
  docSharepointState.selectedDocId = docId;
  const modal = document.getElementById('docPermissionsModal');
  const panel = document.getElementById('docPermissionsPanel');
  
  if (!modal || !panel) return;
  
  // Populate permissions
  const permissions = docSharepointState.permissions[docId] || [];
  const permListHTML = permissions.map(perm => `
    <div class="doc-permission-item">
      <div class="doc-permission-info">
        <div class="doc-permission-name">${perm.user_name}</div>
        <div class="doc-permission-email">${perm.user_email}</div>
      </div>
      <div class="doc-permission-actions">
        <span class="doc-permission-role ${perm.permission_level.toLowerCase()}">${perm.permission_level}</span>
        <button class="btn3 btn" onclick="revokePermission(${perm.id});" style="padding: 2px 6px; font-size: 11px;">Révoquer</button>
      </div>
    </div>
  `).join('');
  
  panel.innerHTML = `
    <div class="doc-permissions-header">
      <h3>Permissions: ${docTitle}</h3>
      <button class="doc-permissions-close" onclick="closeDocumentPermissions();">×</button>
    </div>
    <div id="docPermissionsList">${permListHTML || '<p>Aucune permission attribuée</p>'}</div>
    <div class="doc-add-permission-form">
      <h4>Ajouter une permission</h4>
      <input type="text" id="permUserName" placeholder="Nom de l'utilisateur">
      <input type="email" id="permUserEmail" placeholder="E-mail">
      <select id="permLevel">
        <option value="Viewers">Lecteur</option>
        <option value="Editors">Éditeur</option>
        <option value="Approvers">Approbateur</option>
        <option value="Administrators">Administrateur</option>
      </select>
      <button onclick="grantPermission(${docId});">Ajouter la permission</button>
    </div>
  `;
  
  modal.classList.add('show');
}

/**
 * Close permissions modal
 */
function closeDocumentPermissions() {
  const modal = document.getElementById('docPermissionsModal');
  if (modal) {
    modal.classList.remove('show');
    docSharepointState.selectedDocId = null;
  }
}

/**
 * Grant permission to a user
 */
async function grantPermission(docId) {
  const userName = document.getElementById('permUserName').value;
  const userEmail = document.getElementById('permUserEmail').value;
  const permLevel = document.getElementById('permLevel').value;
  
  if (!userName || !userEmail || !permLevel) {
    qualiError('Veuillez remplir tous les champs');
    return;
  }
  
  try {
    const response = await fetch('api/documentation/manage_permissions.php?action=grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: docId,
        user_name: userName,
        user_email: userEmail,
        permission_level: permLevel,
        granted_by: 'Admin'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      // Clear form
      document.getElementById('permUserName').value = '';
      document.getElementById('permUserEmail').value = '';
      document.getElementById('permLevel').value = 'Viewers';
      
      // Reload permissions
      await loadDocumentPermissions(docId);
      openDocumentPermissions(docId, 'Document');
    } else {
      qualiError('Erreur lors de l\'ajout de la permission');
    }
  } catch (error) {
    console.error('Error granting permission:', error);
    qualiError('Erreur lors de l\'ajout de la permission');
  }
}

/**
 * Revoke permission
 */
async function revokePermission(permId) {
  if (!await qualiConfirm({ title: 'Retirer la permission', message: 'Êtes-vous sûr de vouloir retirer cette permission ?', confirmText: 'Retirer', cancelText: 'Annuler', type: 'warning' })) return;
  
  try {
    const response = await fetch('api/documentation/manage_permissions.php?action=revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_id: permId })
    });
    
    const data = await response.json();
    if (data.success) {
      await loadSharepointDocuments(docSharepointState.currentFilter);
    }
  } catch (error) {
    console.error('Error revoking permission:', error);
  }
}

/**
 * Edit document
 */
function editDocument(docId) {
  qualiInfo('Edition du document ' + docId + ' - A implementer');
}

/**
 * Delete document
 */
async function deleteDocument(docId) {
  if (!await qualiConfirm({ title: 'Supprimer le document', message: 'Êtes-vous sûr de vouloir supprimer ce document ?', confirmText: 'Supprimer', cancelText: 'Annuler', type: 'error' })) return;
  qualiInfo('Suppression du document ' + docId + ' - A implementer');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // Load initial documents
  const dmsInterfaceEnabled = document.querySelector('script[src*="dms_interface.js"]');
  if (document.getElementById('docSharepointList') && !dmsInterfaceEnabled) {
    loadSharepointDocuments();
  }
});
