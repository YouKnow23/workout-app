// Global state
let currentTemplate = null;
let workoutStartTime = null;
let workoutTimer = null;
let exerciseCounter = 0;


// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadTemplates();
    renderFolders();
    showMainMenu();
});

// 🔹 Setup drop target for Saved Templates grid
document.addEventListener("DOMContentLoaded", () => {
  const templateGrid = document.getElementById('templateGrid');
  if (templateGrid) {
    templateGrid.addEventListener('dragover', (e) => {
      e.preventDefault(); // allow drop
      e.dataTransfer.dropEffect = 'move';
    });

    templateGrid.addEventListener('drop', (e) => {
      e.preventDefault();
      const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');

      if (data.fromFolder && data.templateName) {
        // Remove from that folder
        deleteTemplateFromFolder(data.templateName, data.fromFolder);

        // Refresh UI
        loadTemplates();
        renderFolders();
        showNotification(`Moved "${data.templateName}" back to Saved Templates`);
      }
    });
  }
});

// Navigation functions
function showMainMenu() {
    hideAllPages();
    document.getElementById('mainMenu').classList.remove('hidden');
    loadTemplates();
    updateBottomNav('home');
}

function showCreateTemplate() {
    hideAllPages();
    document.getElementById('createTemplate').classList.remove('hidden');
    document.getElementById('templateName').value = '';
    document.getElementById('exerciseContainer').innerHTML = '';
    addExercise(); // Start with one exercise
}

function showWorkoutSession(templateName) {
    hideAllPages();
    document.getElementById('workoutSession').classList.remove('hidden');
    loadWorkoutTemplate(templateName);
    startWorkoutTimer();
}

function showWorkoutHistory() {
    hideAllPages();
    document.getElementById('workoutHistory').classList.remove('hidden');
    loadWorkoutHistory();
    updateBottomNav('history');
    
    // Reset workout session navigation if coming from edit mode
    const pageNav = document.querySelector('#workoutSession .page-nav');
    pageNav.innerHTML = `
        <button class="btn" onclick="showMainMenu()">
            ← Back
        </button>
        <button class="btn btn-primary" onclick="finishWorkout()">
            ✅ Finish Workout
        </button>
    `;
}

function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
}

function updateBottomNav(activeTab) {
    document.querySelectorAll('.bottom-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (activeTab === 'home') {
        document.getElementById('homeBtn').classList.add('active');
    } else if (activeTab === 'history') {
        document.getElementById('historyBtn').classList.add('active');
    }
}

// Template management
function loadTemplates() {
    const grid = document.getElementById('templateGrid');
    grid.innerHTML = '';

    // --- Drop target setup ---
    grid.addEventListener('dragover', (e) => {
        e.preventDefault(); // allow drop
        e.dataTransfer.dropEffect = 'move';
    });

    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}');

        if (data.fromFolder && data.templateName) {
            const key = `template_${data.templateName}`;
            if (!localStorage.getItem(key)) {
                console.error(`Template "${data.templateName}" not found in storage`);
                return;
            }
            deleteTemplateFromFolder(data.templateName, data.fromFolder);
            loadTemplates();   // refresh main list
            renderFolders();   // refresh folder list
        }
    });

    // --- Normal rendering ---
    const templates = getStoredTemplates();
    templates.forEach(template => {
        const card = createTemplateCard(template);
        grid.appendChild(card);
    });
}


// Clean createTemplateCard: small drag handle for dragging, tap/press -> preview, buttons hook into existing functions
// Escape HTML helper (safe rendering of template/folder names)
function escapeHtml(str) {
    return (str+'').replace(/[&<>"']/g, (s) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[s];
    });
}

function createTemplateCard(template) {
    // template = { name, exercises }
    const exerciseCount = template.exercises.length;
    const totalSets = template.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

    const card = document.createElement('div');
    card.className = 'template-card';
    card.classList.add('saved-template');
    card.dataset.templateName = template.name;

    // handle (only for drag)
    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.textContent = '≡';
    handle.draggable = true;

    // inner area
    const inner = document.createElement('div');
    inner.className = 'template-inner';
    inner.innerHTML = `
        <h3>${escapeHtml(template.name)}</h3>
        <div class="template-preview">${exerciseCount} exercises • ${totalSets} sets</div>
        <div class="template-actions">
            <button class="btn btn-primary btn-small start-btn">▶️ Start</button>
            <button class="btn btn-danger btn-small delete-btn">🗑️ Delete</button>
        </div>
    `;

    // assemble
    card.appendChild(handle);
    card.appendChild(inner);

    // start button -> use your existing startWorkout
    inner.querySelector('.start-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startWorkout(template.name);
    });

    // delete button -> use your existing deleteTemplate
    inner.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTemplate(template.name);
    });

    // Dragstart from handle: set template name in dataTransfer and show card as drag image (if supported)
    handle.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', template.name);
        try { e.dataTransfer.setDragImage(card, 10, 10); } catch (err) { /* ignore if unsupported */ }
        e.dataTransfer.effectAllowed = 'move';
    });

    // tap to preview (ignore clicks on actions or handle)
    card.addEventListener('click', (e) => {
        if (e.target.closest('.template-actions') || e.target.classList.contains('drag-handle')) return;
        showTemplatePreview(template.name);
    });

    // press & hold on mobile to preview
    let pressTimer;
    let dragging = false;
    card.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => {
    // After 500ms, enable drag mode
    card.draggable = true;
    dragging = true;
    // Tell the browser: this card can now be dragged
    card.dispatchEvent(new Event("dragstart", { bubbles: true }));
  }, 500); // half a second hold
    }, { passive: true });
    // Cancel if finger lifted or moved
    ['touchend','touchmove','touchcancel'].forEach(ev => {
  card.addEventListener(ev, () => {
    clearTimeout(pressTimer);
    // disable drag mode after action ends
    setTimeout(() => {
      card.draggable = false;
      dragging = false;
    }, 100);
  }, { passive: true });
});

// Normal tap still works
card.addEventListener('click', (e) => {
  if (!dragging) {
    showTemplatePreview(template.name);
  }
});

    return card;
}



function getStoredTemplates() {
  const templates = [];

  // Collect names of all templates inside folders
  const allFolders = JSON.parse(localStorage.getItem('folders') || '[]');
  const templatesInFolders = new Set();
  allFolders.forEach(fname => {
    const list = JSON.parse(localStorage.getItem(`folder_${fname}`) || '[]');
    list.forEach(t => templatesInFolders.add(t));
  });

  // Pull only top-level templates (not in folders)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('template_')) {
      const name = key.replace('template_', '');
      if (templatesInFolders.has(name)) continue; // skip if in folder
      const exercises = JSON.parse(localStorage.getItem(key));
      templates.push({ name, exercises });
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}



function showTemplateFolders() {
  const folderName = (prompt("Enter folder name:") || '').trim();
  if (!folderName) return;

  const folders = JSON.parse(localStorage.getItem('folders') || '[]');
  if (!folders.includes(folderName)) {
    folders.push(folderName);
    localStorage.setItem('folders', JSON.stringify(folders));
  }

  const bucketKey = `folder_${folderName}`;
  if (!localStorage.getItem(bucketKey)) {
    localStorage.setItem(bucketKey, JSON.stringify([]));
  }

  renderFolders();
}


function showTemplatePreview(templateName) {
    const templateData = localStorage.getItem(`template_${templateName}`);
    if (!templateData) {
        showNotification('Template not found', 'error');
        return;
    }

    const exercises = JSON.parse(templateData);
    let html = `<p style="color:#666; margin-bottom:8px;"><strong>${exercises.length}</strong> exercises</p>`;
    html += exercises.map(ex => {
        const sets = ex.sets.map(s => {
            const setDisplay = s.type !== 'normal' ? getSetTypeDisplay(s.type) : s.set;
            return `${setDisplay}: ${s.weight || '-'} × ${s.reps || '-'}`;
        }).join('<br>');
        return `<div style="margin-bottom:10px;"><strong>${escapeHtml(ex.name)}</strong><br>${sets}</div>`;
    }).join('');

    const titleEl = document.getElementById('previewTitle');
    const contentEl = document.getElementById('previewContent');
    const modal = document.getElementById('previewModal');
    const startBtn = document.getElementById('previewStartBtn');

    if (!modal || !contentEl || !titleEl) {
        showNotification('Preview modal missing from DOM', 'error');
        return;
    }

    titleEl.textContent = `📋 ${templateName}`;
    contentEl.innerHTML = html;
    modal.style.display = 'flex';

    // show start button inside preview
    if (startBtn) {
        startBtn.style.display = 'inline-block';
        startBtn.onclick = () => {
            closePreviewModal();
            showWorkoutSession(templateName);
        };
    }
}

function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) modal.style.display = 'none';
}

// close preview by tapping outside modal-content
document.addEventListener('click', (e) => {
    const modal = document.getElementById('previewModal');
    if (!modal || modal.style.display !== 'flex') return;
    if (e.target === modal) closePreviewModal();
});

function loadFolders() {
    const grid = document.getElementById('folderGrid');
    grid.innerHTML = '';

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('folder_')) {
            const name = key.replace('folder_', '');
            const folderCard = createFolderCard(name);
            grid.appendChild(folderCard);
        }
    }
}

function createFolderTemplateCard(template, folderName) {
  const card = document.createElement('div');
  card.className = 'template-card saved-template';
  card.innerHTML = `
    <h3>${escapeHtml(template.name)}</h3>
  `;

  enableLongPress(card, () => {
    removeTemplateFromFolder(template.name, folderName);
  });

  return card;
}



function createFolderCard(name) {
    const card = document.createElement('div');
    card.className = 'template-card folder-card';
    card.dataset.folderName = name;

    card.innerHTML = `
        <div class="folder-header">
            <h3>📁 ${escapeHtml(name)}</h3>
            <button class="nested-delete">Delete</button>
        </div>
        <div class="folder-contents" style="display:none;"></div>
    `;

    const delBtn = card.querySelector('.nested-delete');
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFolder(name);
    });

    // Swipe-to-delete for mobile
    enableSwipeToDelete(card, name, () => {
        deleteFolder(name);
    });

    card.classList.add('dropzone');
    return card;
}

function enableTouchDrag(element, templateName, fromFolder = null) {
  let startX, startY, dragging = false, dragEl;

  element.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') return; // don’t trigger when pressing buttons
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;

    dragging = true;

    // create ghost element
    dragEl = element.cloneNode(true);
    dragEl.style.position = 'fixed';
    dragEl.style.left = `${startX}px`;
    dragEl.style.top = `${startY}px`;
    dragEl.style.opacity = '0.7';
    dragEl.style.pointerEvents = 'none';
    dragEl.style.zIndex = 9999;
    document.body.appendChild(dragEl);
  });

  element.addEventListener('touchmove', (e) => {
    if (!dragging || !dragEl) return;
    const touch = e.touches[0];
    dragEl.style.left = `${touch.clientX - 50}px`;
    dragEl.style.top = `${touch.clientY - 30}px`;

    // highlight drop zones
    document.querySelectorAll('.dropzone').forEach(zone => {
      const rect = zone.getBoundingClientRect();
      if (
        touch.clientX > rect.left &&
        touch.clientX < rect.right &&
        touch.clientY > rect.top &&
        touch.clientY < rect.bottom
      ) {
        zone.classList.add('highlight-drop');
      } else {
        zone.classList.remove('highlight-drop');
      }
    });
  });

  element.addEventListener('touchend', (e) => {
    if (!dragging || !dragEl) return;
    dragging = false;

    const touch = e.changedTouches[0];
    let dropped = false;

    document.querySelectorAll('.dropzone').forEach(zone => {
      const rect = zone.getBoundingClientRect();
      if (
        touch.clientX > rect.left &&
        touch.clientX < rect.right &&
        touch.clientY > rect.top &&
        touch.clientY < rect.bottom
      ) {
        dropped = true;
        if (zone.id === 'templateGrid') {
          // move back to saved templates
          deleteTemplateFromFolder(templateName, fromFolder);
          loadTemplates();
          renderFolders();
          showNotification(`Moved "${templateName}" back to Saved Templates`);
        } else if (zone.classList.contains('folder-card')) {
          const folderName = zone.dataset.folderName;
          moveTemplateToFolder(templateName, folderName);
          loadTemplates();
          renderFolders();
          showNotification(`Moved "${templateName}" into "${folderName}"`);
        }
      }
    });

    dragEl.remove();
    document.querySelectorAll('.dropzone').forEach(zone => zone.classList.remove('highlight-drop'));
  });
}

    // swipe to reveal delete (mobile)
function enableSwipeToDelete(card, folderName, onDelete) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  card.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  });

  card.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
  });

  card.addEventListener('touchend', () => {
    if (!isDragging) return;
    const diffX = currentX - startX;

    if (diffX < -50) {
      // Swipe left → show delete
      card.classList.add('swiped');
    } else if (diffX > 50) {
      // Swipe right → hide delete
      card.classList.remove('swiped');
    }

    isDragging = false;
  });

  // Delete button click
  const delBtn = card.querySelector('.delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onDelete === 'function') {
        onDelete(folderName);
      }
    });
  }
}

function showFolderContents(folderName, container) {
  const folderKey = `folder_${folderName}`;
  const templates = JSON.parse(localStorage.getItem(folderKey) || '[]');

  if (templates.length === 0) {
    container.innerHTML = `<p style="color:#666; font-size:14px;">(No templates)</p>`;
    return;
  }

  container.innerHTML = '';
  templates.forEach(templateName => {
    const templateData = localStorage.getItem(`template_${templateName}`);
    if (!templateData) {
      const orphan = document.createElement('div');
      orphan.className = 'nested-template';
      orphan.textContent = `${templateName} (missing)`;
      container.appendChild(orphan);
      return;
    }

    const exercises = JSON.parse(templateData);
    const tpl = document.createElement('div');
    tpl.className = 'nested-template';
    tpl.draggable = true; // ✅ allow dragging out of folder
    tpl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>${escapeHtml(templateName)}</strong>
          <div class="template-preview" style="font-size:13px;color:#666;">
            ${exercises.length} exercises • ${exercises.reduce((s,ex)=>s+ex.sets.length,0)} sets
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-small nested-start">▶️ Start</button>
          <button class="btn btn-danger btn-small nested-delete">🗑️ Delete</button>
        </div>
      </div>
    `;

    if (isTouchDevice) {
  enableTouchDrag(tpl, templateName, folderName);
} else {
  tpl.draggable = true;
  tpl.addEventListener('dragstart', (e) => {
    const payload = { templateName, fromFolder: folderName };
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  });
}


    // ✅ Make template draggable with info
    tpl.addEventListener('dragstart', (e) => {
      const payload = { templateName, fromFolder: folderName };
      e.dataTransfer.setData('text/plain', JSON.stringify(payload));
      e.dataTransfer.effectAllowed = 'move';
    });

    // Start workout inside folder
    tpl.querySelector('.nested-start').addEventListener('click', (e) => {
      e.stopPropagation();
      showWorkoutSession(templateName);
    });

    // Delete template from folder only
    tpl.querySelector('.nested-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTemplateFromFolder(templateName, folderName);
      showFolderContents(folderName, container);
      renderFolders();
      loadTemplates();
    });

    // Tap to preview template
    tpl.addEventListener('click', () => showTemplatePreview(templateName));

    container.appendChild(tpl);
  });
}



function deleteTemplateFromFolder(templateName, folderName) {
  const folderKey = `folder_${folderName}`;
  const folder = JSON.parse(localStorage.getItem(folderKey) || '[]').filter(n => n !== templateName);
  localStorage.setItem(folderKey, JSON.stringify(folder));
  showNotification(`Removed "${templateName}" from ${folderName}`);
}

function deleteFolder(folderName) {
  showConfirmModal(
    'Delete Folder',
    `Delete folder "${folderName}"? This will remove the folder and its bucket.`,
    () => {
      const folders = JSON.parse(localStorage.getItem('folders') || '[]').filter(n => n !== folderName);
      localStorage.setItem('folders', JSON.stringify(folders));
      localStorage.removeItem(`folder_${folderName}`);
      renderFolders();
      showNotification('Folder deleted');
    }
  );
}



function renderFolders() {
    const grid = document.getElementById('folderGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const folders = JSON.parse(localStorage.getItem('folders') || '[]');

    if (folders.length === 0) {
        grid.innerHTML = `<p style="color:#aaa; text-align:center;">No folders yet</p>`;
        return;
    }

    folders.forEach(name => {
        const folderDiv = createFolderCard(name);

        folderDiv.addEventListener('click', (e) => {
            if (e.target.closest('.nested-delete') || e.target.closest('.nested-start')) return;

            const contentsContainer = folderDiv.querySelector('.folder-contents');
            if (contentsContainer) {
                contentsContainer.style.display = 'block';
                showFolderContents(name, contentsContainer);
            }
        });

        grid.appendChild(folderDiv);
    });
}

function showFolderContents(folderName, container) {
    const folderKey = `folder_${folderName}`;
    const templates = JSON.parse(localStorage.getItem(folderKey) || '[]');

    container.innerHTML = '';

    if (templates.length === 0) {
        container.innerHTML = `<p style="color:#666;">(No templates)</p>`;
        return;
    }

    templates.forEach(templateName => {
        const tpl = createTemplateCardByName(templateName);

        tpl.draggable = true;
        tpl.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                templateName: templateName,
                fromFolder: folderName
            }));
            e.dataTransfer.effectAllowed = 'move';
        });

        enableSwipeToDelete(tpl, folderName, () => {
            deleteTemplateFromFolder(templateName, folderName);
            showFolderContents(folderName, container);
            renderFolders();
            loadTemplates();
        });

        container.appendChild(tpl);
    });
}

function enableLongPress(card, callback, delay = 600) {
  let pressTimer;

  card.addEventListener('touchstart', (e) => {
    pressTimer = setTimeout(() => {
      callback(e);
    }, delay);
  });

  card.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
  });

  card.addEventListener('touchmove', () => {
    clearTimeout(pressTimer); // cancel if finger moves
  });

  // Optional: also support mouse long‑press for desktop
  card.addEventListener('mousedown', (e) => {
    pressTimer = setTimeout(() => {
      callback(e);
    }, delay);
  });
  card.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
  });
  card.addEventListener('mouseleave', () => {
    clearTimeout(pressTimer);
  });
}



function startWorkout(templateName) {
    showConfirmModal(
        'Start Workout',
        `Ready to start "${templateName}"?`,
        () => showWorkoutSession(templateName)
    );
}

function editTemplate(templateName) {
    showNotification('Edit template feature coming soon!');
}

function deleteTemplate(templateName) {
    showConfirmModal(
        'Delete Template',
        `Are you sure you want to delete "${templateName}"? This cannot be undone.`,
        () => {
            localStorage.removeItem(`template_${templateName}`);
            showNotification('Template deleted!');
            loadTemplates();
        }
    );
}

// Exercise creation
function addExercise() {
    const container = document.getElementById('exerciseContainer');
    const exerciseBlock = createExerciseBlock();
    container.appendChild(exerciseBlock);
    
    // Initialize sortable if not already done
    if (!container.sortable) {
        new Sortable(container, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'drag-ghost'
        });
        container.sortable = true;
    }
}

function createExerciseBlock(data = {}) {
    const { name = '', sets = [] } = data;
    // Only add default set if no sets provided
    const initialSets = sets.length > 0 ? sets : [{ reps: '', weight: '', type: 'normal' }];
    exerciseCounter++;
    
    const block = document.createElement('div');
    block.className = 'exercise-block';
    block.dataset.exerciseId = exerciseCounter;
    
    block.innerHTML = `
        <div class="exercise-header">
            <div class="drag-handle">≡</div>
            <input type="text" class="form-input exercise-name" placeholder="Exercise name..." value="${name}">
            <button class="btn btn-danger btn-small" onclick="removeExercise(${exerciseCounter})">
                🗑️
            </button>
        </div>
        
        <table class="exercise-table">
            <thead>
                <tr>
                    <th>Set</th>
                    <th>Previous</th>
                    <th>Weight</th>
                    <th>Reps</th>
                    <th>Remove</th>
                </tr>
            </thead>
            <tbody id="sets-${exerciseCounter}">
                <!-- Sets will be added here -->
            </tbody>
        </table>
        
        <button class="btn btn-secondary btn-small" onclick="addSet(${exerciseCounter})">
            ➕ Add Set
        </button>
    `;
    
    // Add initial sets
    const tbody = block.querySelector(`#sets-${exerciseCounter}`);
    initialSets.forEach((set, index) => {
        const setRow = createSetRow(exerciseCounter, index, set);
        tbody.appendChild(setRow);
    });
    
    return block;
}

function createSetRow(exerciseId, setIndex, data = {}) {
    const { reps = '', weight = '', type = 'normal' } = data;
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <button class="set-type-btn ${type}" onclick="toggleSetType(${exerciseId}, ${setIndex})">
                ${type === 'normal' ? '1' : getSetTypeDisplay(type)} ▼
            </button>
        </td>
        <td>-</td>
        <td>
            <input type="number" class="set-input" placeholder="0" value="${weight}" step="0.5" >
        </td>
        <td>
            <input type="number" class="set-input" placeholder="0" value="${reps}" >
        </td>
        <td>
            <button class="remove-btn" onclick="removeSet(${exerciseId}, ${setIndex})">
                ✕
            </button>
        </td>
    `;
    
    return row;
}

function getSetTypeDisplay(type) {
    switch(type) {
        case 'warmup': return 'W';
        case 'drop-set': return 'D';
        case 'rest-pause': return 'R';
        default: return type;
    }
}

function addSet(exerciseId) {
    const tbody = document.getElementById(`sets-${exerciseId}`);
    const setIndex = tbody.children.length;
    const setRow = createSetRow(exerciseId, setIndex);
    tbody.appendChild(setRow);
    // Update all set numbers after adding
    updateSetNumbers(exerciseId);
}

function removeSet(exerciseId, setIndex) {
    const tbody = document.getElementById(`sets-${exerciseId}`);
    const rows = tbody.querySelectorAll('tr');
    if (rows.length > 1) {
        rows[setIndex].remove();
        updateSetNumbers(exerciseId);
    }
}

function removeExercise(exerciseId) {
    const block = document.querySelector(`[data-exercise-id="${exerciseId}"]`);
    if (block) {
        block.remove();
    }
}

function toggleSetType(exerciseId, setIndex) {
    // Close any existing dropdowns
    closeAllDropdowns();
    
    const tbody = document.getElementById(`sets-${exerciseId}`);
    const button = tbody.children[setIndex].querySelector('.set-type-btn');
    const currentType = button.textContent === (setIndex + 1).toString() ? 'normal' : button.textContent;
    
    // Create dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'set-type-dropdown';
    dropdown.innerHTML = `
        <div class="dropdown-option ${currentType === 'normal' ? 'selected' : ''}" onclick="selectSetType(${exerciseId}, ${setIndex}, 'normal')">
            ${setIndex + 1} - Normal
        </div>
        <div class="dropdown-option ${currentType === 'warmup' ? 'selected' : ''}" onclick="selectSetType(${exerciseId}, ${setIndex}, 'warmup')">
            W - Warmup
        </div>
        <div class="dropdown-option ${currentType === 'drop-set' ? 'selected' : ''}" onclick="selectSetType(${exerciseId}, ${setIndex}, 'drop-set')">
            D - Drop Set
        </div>
        <div class="dropdown-option ${currentType === 'rest-pause' ? 'selected' : ''}" onclick="selectSetType(${exerciseId}, ${setIndex}, 'rest-pause')">
            R - Rest Pause
        </div>
    `;
    
    // Position dropdown
    const buttonRect = button.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = (buttonRect.bottom + 5) + 'px';
    dropdown.style.left = buttonRect.left + 'px';
    dropdown.style.zIndex = '1000';
    
    document.body.appendChild(dropdown);
    
    // Close dropdown when clicking outside
    setTimeout(() => {
        document.addEventListener('click', closeDropdownOnOutsideClick);
    }, 10);
}

function selectSetType(exerciseId, setIndex, type) {
    const tbody = document.getElementById(`sets-${exerciseId}`);
    const button = tbody.children[setIndex].querySelector('.set-type-btn');
    
    button.className = `set-type-btn ${type}`;
    
    // Update all set numbers for this exercise
    updateSetNumbers(exerciseId);
    
    closeAllDropdowns();
}

function closeAllDropdowns() {
    document.querySelectorAll('.set-type-dropdown').forEach(dropdown => {
        dropdown.remove();
    });
    document.removeEventListener('click', closeDropdownOnOutsideClick);
}

function closeDropdownOnOutsideClick(event) {
    if (!event.target.closest('.set-type-dropdown') && !event.target.closest('.set-type-btn')) {
        closeAllDropdowns();
    }
}

function updateSetNumbers(exerciseId) {
    const tbody = document.getElementById(`sets-${exerciseId}`);
    const rows = tbody.querySelectorAll('tr');
    let normalSetCount = 0;
    
    rows.forEach((row, index) => {
        const button = row.querySelector('.set-type-btn');
        const isNormal = button.classList.contains('normal');
        if (isNormal) {
            normalSetCount++;
            button.textContent = normalSetCount + ' ▼';
        } else {
            // Keep the type display for non-normal sets
            const currentType = Array.from(button.classList).find(cls => 
                ['warmup', 'drop-set', 'rest-pause'].includes(cls)
            );
            if (currentType) {
                button.textContent = getSetTypeDisplay(currentType) + ' ▼';
            }
        }
    });
}

// Template saving
function saveTemplate() {
    const name = document.getElementById('templateName').value.trim();
    if (!name) {
        showNotification('Please enter a template name!', 'error');
        return;
    }

    const exercises = [];
    const exerciseBlocks = document.querySelectorAll('#exerciseContainer .exercise-block');
    
    exerciseBlocks.forEach(block => {
        const exerciseName = block.querySelector('.exercise-name').value.trim();
        if (!exerciseName) return;
        
        const sets = [];
        const setRows = block.querySelectorAll('tbody tr');
        
        setRows.forEach((row, index) => {
            const weight = row.querySelector('input[type="number"]').value;
            const reps = row.querySelectorAll('input[type="number"]')[1].value;
            const typeBtn = row.querySelector('.set-type-btn');
            
            // Determine the actual type from the button classes
            let type = 'normal';
            if (typeBtn.classList.contains('warmup')) type = 'warmup';
            else if (typeBtn.classList.contains('drop-set')) type = 'drop-set';
            else if (typeBtn.classList.contains('rest-pause')) type = 'rest-pause';
            
            // Always save the set, even if reps/weight are empty (for template structure)
            sets.push({
                set: index + 1,
                reps: reps ? parseInt(reps) : '',
                weight: weight ? parseFloat(weight) : '',
                type: type
            });
        });
        
        if (sets.length > 0) {
            exercises.push({ name: exerciseName, sets });
        }
    });

    if (exercises.length === 0) {
        showNotification('Please add at least one exercise!', 'error');
        return;
    }

    try {
        localStorage.setItem(`template_${name}`, JSON.stringify(exercises));
        showNotification(`Template "${name}" saved successfully!`);
        showMainMenu();
    } catch (error) {
        showNotification('Failed to save template. Storage might be full.', 'error');
    }
}

// Workout session
function loadWorkoutTemplate(templateName) {
    const templateData = localStorage.getItem(`template_${templateName}`);
    if (!templateData) {
        showNotification('Template not found!', 'error');
        showMainMenu();
        return;
    }

    currentTemplate = { name: templateName, exercises: JSON.parse(templateData) };
    const container = document.getElementById('workoutContainer');
    container.innerHTML = '';

    currentTemplate.exercises.forEach((exercise, index) => {
        const workoutBlock = createWorkoutExerciseBlock(exercise, index);
        container.appendChild(workoutBlock);
    });
}

function createWorkoutExerciseBlock(exercise, exerciseIndex) {
    const block = document.createElement('div');
    block.className = 'exercise-block';
    
    block.innerHTML = `
        <div class="exercise-header">
            <div class="exercise-name">${exercise.name}</div>
        </div>
        
        <table class="exercise-table">
            <thead>
                <tr>
                    <th>Set</th>
                    <th>Previous</th>
                    <th>Weight</th>
                    <th>Reps</th>
                </tr>
            </thead>
            <tbody>
                ${exercise.sets.map((set, setIndex) => {
                    const lastWorkoutData = getLastWorkoutData(exercise.name);
                    const previousSet = lastWorkoutData && lastWorkoutData[setIndex] ? lastWorkoutData[setIndex] : null;
                    const previousDisplay = previousSet ? `${previousSet.weight || '-'} × ${previousSet.reps || '-'}` : '-';
                    
                    return `
                    <tr>
                        <td>
                            <span class="set-type-btn ${set.type}">
                                ${getWorkoutSetDisplay(exercise.sets, setIndex)}
                            </span>
                        </td>
                        <td>${previousDisplay}</td>
                        <td>
                            <input type="number" class="set-input" placeholder="${set.weight || '0'}" step="0.5">
                        </td>
                        <td>
                            <input type="number" class="set-input" placeholder="${set.reps || '0'}">
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    return block;
}

function getWorkoutSetDisplay(sets, setIndex) {
    const set = sets[setIndex];
    if (set.type !== 'normal') {
        return getSetTypeDisplay(set.type);
    }
    
    // Count normal sets up to this point
    let normalSetCount = 0;
    for (let i = 0; i <= setIndex; i++) {
        if (sets[i].type === 'normal') {
            normalSetCount++;
        }
    }
    return normalSetCount;
}

function startWorkoutTimer() {
    workoutStartTime = Date.now();
    
    // Set the date
    const today = new Date();
    const dateOptions = { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    };
    document.getElementById('workoutDate').textContent = 
        today.toLocaleDateString('en-US', dateOptions);
    
    workoutTimer = setInterval(updateWorkoutTimer, 1000);
}

function updateWorkoutTimer() {
    if (!workoutStartTime) return;
    
    const elapsed = Date.now() - workoutStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    document.querySelector('.workout-time').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function finishWorkout() {
    showConfirmModal(
        'Finish Workout',
        'Are you sure you want to finish this workout?',
        () => {
            saveWorkoutToHistory();
            if (workoutTimer) {
                clearInterval(workoutTimer);
                workoutTimer = null;
            }
            showNotification('Workout completed! 🎉');
            showMainMenu();
        }
    );
}

function saveWorkoutToHistory() {
    if (!currentTemplate) return;

    const workoutData = {
        templateName: currentTemplate.name,
        date: new Date().toISOString(),
        duration: workoutStartTime ? Date.now() - workoutStartTime : 0,
        exercises: []
    };

    const exerciseBlocks = document.querySelectorAll('#workoutContainer .exercise-block');
    exerciseBlocks.forEach((block, exerciseIndex) => {
        const exerciseName = block.querySelector('.exercise-name').textContent;
        const sets = [];
        
        const setRows = block.querySelectorAll('tbody tr');
        setRows.forEach((row, setIndex) => {
            const weightInput = row.querySelector('input[type="number"]');
            const repsInput = row.querySelectorAll('input[type="number"]')[1];
            const setTypeBtn = row.querySelector('.set-type-btn');
            
            const weight = weightInput.value ? parseFloat(weightInput.value) : null;
            const reps = repsInput.value ? parseInt(repsInput.value) : null;
            
            // Get set type from button classes
            let type = 'normal';
            if (setTypeBtn.classList.contains('warmup')) type = 'warmup';
            else if (setTypeBtn.classList.contains('drop-set')) type = 'drop-set';
            else if (setTypeBtn.classList.contains('rest-pause')) type = 'rest-pause';
            
            if (weight !== null || reps !== null) {
                sets.push({
                    set: setIndex + 1,
                    weight: weight,
                    reps: reps,
                    type: type
                });
            }
        });
        
        if (sets.length > 0) {
            workoutData.exercises.push({
                name: exerciseName,
                sets: sets
            });
        }
    });

    // Save to localStorage
    const workoutId = `workout_${Date.now()}`;
    localStorage.setItem(workoutId, JSON.stringify(workoutData));
}

function loadWorkoutHistory() {
    const container = document.getElementById('historyContainer');
    container.innerHTML = '';

    const workouts = getStoredWorkouts();
    
    if (workouts.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: white; padding: 40px;">
                <h3>No workouts yet!</h3>
                <p>Complete your first workout to see it here.</p>
            </div>
        `;
        return;
    }

    workouts.forEach(workout => {
        const card = createWorkoutHistoryCard(workout);
        container.appendChild(card);
    });
}

function getStoredWorkouts() {
    const workouts = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('workout_')) {
            const workoutData = JSON.parse(localStorage.getItem(key));
            workouts.push({ id: key, ...workoutData });
        }
    }
    return workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function createWorkoutHistoryCard(workout) {
    const card = document.createElement('div');
    card.className = 'template-card';
    
    const date = new Date(workout.date);
    const dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
    
    const duration = Math.floor(workout.duration / 60000);
    const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
    
    // Create exercise details HTML
    const exerciseDetailsHTML = workout.exercises.map(exercise => {
        const setsHTML = exercise.sets.map(set => {
            const setDisplay = set.type !== 'normal' ? getSetTypeDisplay(set.type) : set.set;
            return `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #f0f0f0;">
                    <span style="font-weight: 600; color: #666; min-width: 40px;">Set ${setDisplay}:</span>
                    <span>${set.weight || '-'} lbs × ${set.reps || '-'} reps</span>
                </div>
            `;
        }).join('');
        
        return `
            <div style="margin-bottom: 15px;">
                <div style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 16px;">
                    ${exercise.name}
                </div>
                <div style="background: #f8f9fa; border-radius: 8px; padding: 10px; font-size: 14px;">
                    ${setsHTML}
                </div>
            </div>
        `;
    }).join('');
    
    card.innerHTML = `
        <h3>${workout.templateName}</h3>
        <div class="template-preview">
            ${dateStr} • ${duration} min • ${workout.exercises.length} exercises • ${totalSets} sets
        </div>
        
        <div style="margin: 20px 0; max-height: 300px; overflow-y: auto;">
            ${exerciseDetailsHTML}
        </div>
        
        <div class="template-actions">
            
            <button class="btn btn-danger btn-small" onclick="deleteWorkout('${workout.id}')">
                🗑️ Delete
            </button>
        </div>
    `;
    
    return card;
}

function deleteWorkout(workoutId) {
    showConfirmModal(
        'Delete Workout',
        'Are you sure you want to delete this workout? This cannot be undone.',
        () => {
            localStorage.removeItem(workoutId);
            showNotification('Workout deleted!');
            loadWorkoutHistory();
        }
    );
}

// NEW EDIT WORKOUT FUNCTIONS
function editWorkout(workoutId) {
    const workoutData = JSON.parse(localStorage.getItem(workoutId));
    if (!workoutData) {
        showNotification('Workout not found!', 'error');
        return;
    }
    
    // Switch to workout session with editable data
    hideAllPages();
    document.getElementById('workoutSession').classList.remove('hidden');
    
    // Load the workout data for editing
    currentTemplate = { 
        name: workoutData.templateName, 
        exercises: workoutData.exercises.map(ex => ({
            name: ex.name,
            sets: ex.sets
        }))
    };
    
    const container = document.getElementById('workoutContainer');
    container.innerHTML = '';

    workoutData.exercises.forEach((exercise, index) => {
        const workoutBlock = createEditableWorkoutBlock(exercise, index);
        container.appendChild(workoutBlock);
    });
    
    // Store the original workout ID for updating
    currentTemplate.editingWorkoutId = workoutId;
    
    // Update page navigation for editing mode
    const pageNav = document.querySelector('#workoutSession .page-nav');
    pageNav.innerHTML = `
        <button class="btn" onclick="showWorkoutHistory()">
            ← Back to History
        </button>
        <button class="btn btn-primary" onclick="updateWorkout()">
            💾 Update Workout
        </button>
    `;
    
    showNotification('Editing workout - make your changes and click Update!');
}

function createEditableWorkoutBlock(exercise, exerciseIndex) {
    const block = document.createElement('div');
    block.className = 'exercise-block';
    
    block.innerHTML = `
        <div class="exercise-header">
            <div class="exercise-name">${exercise.name}</div>
        </div>
        
        <table class="exercise-table">
            <thead>
                <tr>
                    <th>Set</th>
                    <th>Previous</th>
                    <th>Weight</th>
                    <th>Reps</th>
                </tr>
            </thead>
            <tbody>
                ${exercise.sets.map((set, setIndex) => {
                    const lastWorkoutData = getLastWorkoutData(exercise.name);
                    const previousSet = lastWorkoutData && lastWorkoutData[setIndex] ? lastWorkoutData[setIndex] : null;
                    const previousDisplay = previousSet ? `${previousSet.weight || '-'} × ${previousSet.reps || '-'}` : '-';
                    
                    return `
                    <tr>
                        <td>
                            <span class="set-type-btn ${set.type}">
                                ${getWorkoutSetDisplay(exercise.sets, setIndex)}
                            </span>
                        </td>
                        <td>${previousDisplay}</td>
                        <td>
                            <input type="number" class="set-input" value="${set.weight || ''}" step="0.5">
                        </td>
                        <td>
                            <input type="number" class="set-input" value="${set.reps || ''}">
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    return block;
}

function updateWorkout() {
    if (!currentTemplate || !currentTemplate.editingWorkoutId) {
        showNotification('Error updating workout!', 'error');
        return;
    }

    const originalWorkout = JSON.parse(localStorage.getItem(currentTemplate.editingWorkoutId));
    
    const updatedExercises = [];
    const exerciseBlocks = document.querySelectorAll('#workoutContainer .exercise-block');
    
    exerciseBlocks.forEach((block, exerciseIndex) => {
        const exerciseName = block.querySelector('.exercise-name').textContent;
        const sets = [];
        
        const setRows = block.querySelectorAll('tbody tr');
        setRows.forEach((row, setIndex) => {
            const weightInput = row.querySelector('input[type="number"]');
            const repsInput = row.querySelectorAll('input[type="number"]')[1];
            const setTypeBtn = row.querySelector('.set-type-btn');
            
            const weight = weightInput.value ? parseFloat(weightInput.value) : null;
            const reps = repsInput.value ? parseInt(repsInput.value) : null;
            
            // Get set type from button classes
            let type = 'normal';
            if (setTypeBtn.classList.contains('warmup')) type = 'warmup';
            else if (setTypeBtn.classList.contains('drop-set')) type = 'drop-set';
            else if (setTypeBtn.classList.contains('rest-pause')) type = 'rest-pause';
            
            sets.push({
                set: setIndex + 1,
                weight: weight,
                reps: reps,
                type: type
            });
        });
        
        updatedExercises.push({
            name: exerciseName,
            sets: sets
        });
    });

    // Update the workout data
    const updatedWorkout = {
        ...originalWorkout,
        exercises: updatedExercises
    };

    // Save the updated workout
    localStorage.setItem(currentTemplate.editingWorkoutId, JSON.stringify(updatedWorkout));
    
    showNotification('Workout updated successfully! 🎉');
    showWorkoutHistory();
}

function getLastWorkoutData(exerciseName) {
    const workouts = getStoredWorkouts();
    
    for (const workout of workouts) {
        const exercise = workout.exercises.find(ex => ex.name === exerciseName);
        if (exercise && exercise.sets.length > 0) {
            return exercise.sets;
        }
    }
    
    return null;
}

// Modal functions
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmBtn').onclick = () => {
        closeModal();
        onConfirm();
    };
    document.getElementById('confirmModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    if (type === 'error') {
        notification.style.background = '#f44336';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Close modal when clicking outside
window.onclick = (event) => {
    const modal = document.getElementById('confirmModal');
    if (event.target === modal) {
        closeModal();
    }
};

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
