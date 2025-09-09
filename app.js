let currentTemplate = null;
let workoutStartTime = null;
let workoutTimer = null;
let exerciseCounter = 0;

// ====== Startup ======
function init() {
  // Attach global drag/drop listeners ONCE
  document.addEventListener('dragover', (e) => {
    e.preventDefault(); // allow drop anywhere
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();

    const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');

    // ✅ Stricter check so only valid templates from folders are restored
    if (
      data &&
      typeof data.templateName === 'string' &&
      data.templateName.trim() !== '' &&
      data.fromFolder === true &&
      !e.target.closest('.folder-card')
    ) {
      restoreTemplateFromFolder(data.templateName, data.fromFolder);
    }
  });

  // Initial render
  renderFolders();
  loadTemplates();
}

document.addEventListener('DOMContentLoaded', init);

// ====== Load Saved Templates Grid ======
function loadTemplates() {
  const grid = document.getElementById('templateGrid');
  grid.innerHTML = '';

  // Allow dropping directly on the Saved Templates grid
  if (!grid.dataset.listenersAttached) {
    grid.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      grid.classList.add('dragover');
    });

    grid.addEventListener('dragleave', () => {
      grid.classList.remove('dragover');
    });

    grid.addEventListener('drop', (e) => {
      e.preventDefault();
      grid.classList.remove('dragover');

      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');

      if (
        data &&
        typeof data.templateName === 'string' &&
        data.templateName.trim() !== '' &&
        data.fromFolder === true
      ) {
        restoreTemplateFromFolder(data.templateName, data.fromFolder);
      }
    });

    grid.dataset.listenersAttached = 'true';
  }

  // Render all top-level templates
  const templates = getStoredTemplates();
  if (templates.length === 0) {
    grid.innerHTML = `<p style="color:#aaa; text-align:center;">No templates saved yet</p>`;
    return;
  }

  templates.forEach(template => {
    const card = createTemplateCard(template, false);
    grid.appendChild(card);
  });
}

// ====== Render Folders ======
function renderFolders() {
  const container = document.getElementById('folderContainer');
  container.innerHTML = '';

  const folderKeys = Object.keys(localStorage).filter(k => k.startsWith('folder_'));
  if (folderKeys.length === 0) {
    container.innerHTML = `<p style="color:#aaa; text-align:center;">No folders yet</p>`;
    return;
  }

  folderKeys.forEach(key => {
    const folderName = key.replace('folder_', '');
    const folderTemplates = JSON.parse(localStorage.getItem(key) || '[]');

    const folderCard = document.createElement('div');
    folderCard.className = 'folder-card';
    folderCard.textContent = folderName;

    // Make folder a drop target for templates
    folderCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      folderCard.classList.add('dragover');
    });

    folderCard.addEventListener('dragleave', () => {
      folderCard.classList.remove('dragover');
    });

    folderCard.addEventListener('drop', (e) => {
      e.preventDefault();
      folderCard.classList.remove('dragover');

      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');

      // Only accept templates not already in this folder
      if (
        data &&
        typeof data.templateName === 'string' &&
        data.templateName.trim() !== '' &&
        !folderTemplates.includes(data.templateName)
      ) {
        addTemplateToFolder(data.templateName, folderName);
      }
    });

    // Render templates inside folder
    const innerList = document.createElement('div');
    innerList.className = 'folder-templates';

    folderTemplates.forEach(templateName => {
      const templateData = JSON.parse(localStorage.getItem(`template_${templateName}`) || '{}');
      const card = createTemplateCard(templateData, true, folderName);
      innerList.appendChild(card);
    });

    folderCard.appendChild(innerList);
    container.appendChild(folderCard);
  });
}

// ====== Create Template Card ======
function createTemplateCard(template, fromFolder = false, folderName = '') {
  const card = document.createElement('div');
  card.className = 'template-card';
  card.textContent = template.name || 'Untitled Template';
  card.draggable = true;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({
      templateName: template.name,
      fromFolder: fromFolder,
      folderName: folderName
    }));
  });

  return card;
}

// ====== Restore Template from Folder ======
function restoreTemplateFromFolder(templateName, folderName) {
  // Remove from folder
  deleteTemplateFromFolder(templateName, folderName);

  // Always restore to top-level templates
  localStorage.setItem(`template_${templateName}`, JSON.stringify({
    name: templateName,
    exercises: [] // keep structure consistent
  }));

  // Refresh UI
  renderFolders();
  loadTemplates();
}

// ====== Helpers ======
function getStoredTemplates() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('template_'));
  return keys.map(k => {
    try {
      return JSON.parse(localStorage.getItem(k) || '{}');
    } catch {
      return null;
    }
  }).filter(Boolean);
}

function deleteTemplateFromFolder(templateName, folderName) {
  const folderKey = `folder_${folderName}`;
  const folderTemplates = JSON.parse(localStorage.getItem(folderKey) || '[]');
  const updated = folderTemplates.filter(name => name !== templateName);
  localStorage.setItem(folderKey, JSON.stringify(updated));
}

function addTemplateToFolder(templateName, folderName) {
  const folderKey = `folder_${folderName}`;
  const folderTemplates = JSON.parse(localStorage.getItem(folderKey) || '[]');
  if (!folderTemplates.includes(templateName)) {
    folderTemplates.push(templateName);
    localStorage.setItem(folderKey, JSON.stringify(folderTemplates));
    // Remove from Saved Templates
    localStorage.removeItem(`template_${templateName}`);
    renderFolders();
    loadTemplates();
  }
}
