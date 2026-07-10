let editingId = null;
let selectedId = null;
let copyMode = false;
let checkedOrder = [];
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  loadList();
  document.getElementById('copyAllBtn').addEventListener('click', copyAll);
  document.getElementById('selectCopyBtn').addEventListener('click', enterCopyMode);
  document.getElementById('copySelectedBtn').addEventListener('click', copySelected);
  document.getElementById('cancelCopyBtn').addEventListener('click', exitCopyMode);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('refresh-btn').addEventListener('click', () => loadList());
  document.getElementById('history-btn').addEventListener('click', showHistory);
  document.getElementById('history-back-btn').addEventListener('click', hideHistory);
  document.getElementById('session-btn').addEventListener('click', completeSession);
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    loadList();
  });

  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
    document.getElementById('theme-toggle').textContent = 'Light';
  }

  window.electronAPI.getLaunchOnStartup().then(enabled => {
    document.getElementById('startup-toggle').checked = enabled;
  });

  document.getElementById('startup-toggle').addEventListener('change', (e) => {
    window.electronAPI.setLaunchOnStartup(e.target.checked);
  });

  setInterval(() => loadList(), 2000);

  document.addEventListener('keydown', handleKeyDown);
  initDragScroll();
});

function initDragScroll() {
  const list = document.getElementById('collection-list');
  list._sd = null;

  function loop() {
    if (!list._sd) return;
    const r = list.getBoundingClientRect();
    const t = 35;
    if (list._sd.y < r.top + t) { list.scrollTop -= 6; }
    else if (list._sd.y > r.bottom - t) { list.scrollTop += 6; }
    requestAnimationFrame(loop);
  }

  list.addEventListener('dragenter', () => {
    if (copyMode) return;
    list._sd = { y: 0 };
    requestAnimationFrame(loop);
  });

  list.addEventListener('dragover', (e) => {
    if (copyMode) return;
    if (list._sd) list._sd.y = e.clientY;
  });

  list.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !list.contains(e.relatedTarget)) {
      list._sd = null;
    }
  });
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark);
  document.getElementById('theme-toggle').textContent = isDark ? 'Light' : 'Dark';
}

function enterCopyMode() {
  copyMode = true;
  checkedOrder = [];
  document.body.classList.add('copy-mode');
  document.getElementById('main-footer').style.display = 'none';
  document.getElementById('copy-footer').style.display = 'flex';
  loadList();
}

function exitCopyMode() {
  copyMode = false;
  checkedOrder = [];
  document.body.classList.remove('copy-mode');
  document.getElementById('main-footer').style.display = 'flex';
  document.getElementById('copy-footer').style.display = 'none';
  loadList();
}

function handleKeyDown(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'd') { e.preventDefault(); toggleTheme(); }
    if (e.key === 'f') { e.preventDefault(); document.getElementById('search-input').focus(); }
    if (e.key === 'r') { e.preventDefault(); loadList(); }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId && editingId !== selectedId && !copyMode) {
      e.preventDefault();
      removeItem(selectedId);
    }
  }
  if (e.key === 'Escape') {
    if (document.getElementById('history-overlay').style.display !== 'none') {
      hideHistory(); return;
    }
    if (copyMode) { exitCopyMode(); return; }
    if (editingId) { editingId = null; loadList(); }
  }
}

function esc(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

async function loadList() {
  const items = await window.electronAPI.getCollection();
  const list = document.getElementById('collection-list');
  const empty = document.getElementById('empty-state');
  const badge = document.getElementById('count-badge');
  badge.textContent = items.length;

  const filtered = searchQuery
    ? items.filter(item => item.text.toLowerCase().includes(searchQuery))
    : items;

  if (!filtered.length) {
    if (items.length && searchQuery) {
      empty.style.display = 'block';
      empty.innerHTML = '<p>No items match "' + esc(searchQuery) + '"</p>';
    } else {
      empty.style.display = 'block';
      empty.innerHTML = '<p>No items collected yet</p><p class="hint">Copy text in any app &mdash; click the CC icon to save</p>';
    }
    list.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = '';
  filtered.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'item';
    div.draggable = !copyMode;
    div.dataset.id = item.id;

    if (selectedId === item.id) div.classList.add('selected');

    const isEdit = editingId === item.id;
    const checked = checkedOrder.indexOf(item.id);
    const isChecked = checked > -1;

    let checkboxHtml = '';
    let numberHtml = '';
    if (copyMode) {
      checkboxHtml = '<div class="checkbox' + (isChecked ? ' checked' : '') + '" data-id="' + item.id + '"></div>';
      numberHtml = '<span class="number">' + (isChecked ? (checked + 1) : '') + '</span>';
    } else {
      numberHtml = '<span class="number">' + (i + 1) + '</span>';
    }

    let textDisplay = esc(item.text.substring(0, 200)) + (item.text.length > 200 ? '...' : '');
    if (searchQuery) {
      const idx = textDisplay.toLowerCase().indexOf(searchQuery);
      if (idx > -1) {
        const before = textDisplay.substring(0, idx);
        const match = textDisplay.substring(idx, idx + searchQuery.length);
        const after = textDisplay.substring(idx + searchQuery.length);
        textDisplay = esc(before) + '<mark>' + esc(match) + '</mark>' + esc(after);
      } else {
        textDisplay = esc(textDisplay);
      }
    } else {
      textDisplay = esc(textDisplay);
    }

    div.innerHTML =
      checkboxHtml +
      (copyMode ? '' : '<span class="drag-handle">::</span>') +
      numberHtml +
      '<div class="content">' +
        (isEdit
          ? '<textarea class="edit-box" id="eb-' + item.id + '">' + esc(item.text) + '</textarea>'
          : '<div class="text">' + textDisplay + '</div>'
        ) +
        '<div class="meta"></div>' +
      '</div>' +
      '<div class="actions">' +
        (isEdit
          ? '<button class="action-btn save-edit" data-id="' + item.id + '" data-action="save">Save</button><button class="action-btn" data-id="' + item.id + '" data-action="cancel">X</button>'
          : copyMode ? '' : '<button class="action-btn" data-id="' + item.id + '" data-action="edit">Edit</button><button class="action-btn del" data-id="' + item.id + '" data-action="del">X</button>'
        ) +
      '</div>';

    list.appendChild(div);

    if (copyMode) {
      const cb = div.querySelector('.checkbox');
      if (cb) {
        cb.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = Number(cb.dataset.id);
          const idx = checkedOrder.indexOf(id);
          if (idx > -1) {
            checkedOrder.splice(idx, 1);
            cb.classList.remove('checked');
          } else {
            checkedOrder.push(id);
            cb.classList.add('checked');
          }
          loadList();
        });
      }
      return;
    }

    div.addEventListener('click', () => {
      selectedId = item.id;
      document.querySelectorAll('.item').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
    });

    div.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.id);
      div.classList.add('dragging');
    });
    div.addEventListener('dragend', () => {
      document.getElementById('collection-list')._sd = null;
      div.classList.remove('dragging');
      document.querySelectorAll('.item').forEach(el => el.classList.remove('drag-over'));
    });
    div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => { div.classList.remove('drag-over'); });
    div.addEventListener('drop', async (e) => {
      e.preventDefault();
      div.classList.remove('drag-over');
      const fromId = Number(e.dataTransfer.getData('text/plain'));
      if (fromId === item.id) return;
      const all = [...document.querySelectorAll('.item')];
      const fromIdx = all.findIndex(el => Number(el.dataset.id) === fromId);
      const toIdx = all.findIndex(el => Number(el.dataset.id) === item.id);
      if (fromIdx > -1 && toIdx > -1) {
        const ids = all.map(el => Number(el.dataset.id));
        const [moved] = ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, moved);
        await window.electronAPI.reorderItems(ids);
        loadList();
      }
    });

    div.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = Number(e.target.dataset.id);
        switch (e.target.dataset.action) {
          case 'del':
            await removeItem(id);
            break;
          case 'edit':
            editingId = id;
            loadList();
            break;
          case 'save':
            const ta = document.getElementById('eb-' + id);
            if (ta && ta.value.trim()) {
              await window.electronAPI.updateItem(id, ta.value.trim());
              editingId = null;
              loadList();
            }
            break;
          case 'cancel':
            editingId = null;
            loadList();
            break;
        }
      });
    });
  });
}

async function removeItem(id) {
  await window.electronAPI.removeItem(id);
  if (selectedId === id) selectedId = null;
  loadList();
}

async function copyAll() {
  const items = await window.electronAPI.getCollection();
  if (!items.length) return;
  const text = items.map(i => i.text).join('\n\n');
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  alert('All ' + items.length + ' items copied to clipboard!\n\nPress Ctrl+V to paste.');
}

async function copySelected() {
  const items = await window.electronAPI.getCollection();
  const ordered = checkedOrder.map(id => items.find(i => i.id === id)).filter(Boolean);
  if (!ordered.length) { alert('Select items to copy by clicking their checkboxes.'); return; }
  const text = ordered.map(i => i.text).join('\n\n');
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  alert('Copied ' + ordered.length + ' item(s) to clipboard in selected order!\n\nPress Ctrl+V to paste.');
  exitCopyMode();
}

async function clearAll() {
  if (confirm('Clear all collected items?')) {
    await window.electronAPI.clearCollection();
    selectedId = null;
    loadList();
  }
}

async function completeSession() {
  const result = await window.electronAPI.completeSession();
  if (!result.saved) {
    if (result.reason === 'empty') { alert('Nothing to save — collection is empty.'); }
    return;
  }
  alert('Session saved! (' + result.count + ' items)\n\nThe collection is now empty and ready for a new session.');
  loadList();
}

// ---- History ----
let historyCopyMode = false;
let historyCheckedOrder = [];
let historyItemsCache = [];

async function showHistory() {
  historyItemsCache = await window.electronAPI.getHistory();
  document.getElementById('history-overlay').style.display = 'flex';
  document.getElementById('history-footer').style.display = 'flex';
  document.getElementById('history-copy-footer').style.display = 'none';
  historyCopyMode = false;
  historyCheckedOrder = [];
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  if (!historyItemsCache.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = '';

  historyItemsCache.forEach(session => {
    const card = document.createElement('div');
    card.className = 'session-card';

    const d = new Date(session.date);
    const dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let itemsHtml = '';
    session.items.forEach((item, idx) => {
      const checkedIdx = historyCheckedOrder.indexOf(item.id);
      const isChecked = checkedIdx > -1;
      const cbHtml = historyCopyMode
        ? '<span class="h-cb' + (isChecked ? ' checked' : '') + '" data-sid="' + session.id + '" data-iid="' + item.id + '"></span>'
        : '';
      const numHtml = historyCopyMode
        ? '<span class="h-num">' + (isChecked ? (checkedIdx + 1) : '') + '</span>'
        : '';
      itemsHtml += '<div class="session-item">' + cbHtml + numHtml + esc(item.text.substring(0, 300)) + (item.text.length > 300 ? '...' : '') + '</div>';
    });

    card.innerHTML =
      '<div class="session-head" data-id="' + session.id + '">' +
        '<div><div class="session-date">' + dateStr + '</div><div class="session-meta">' + session.count + ' items</div></div>' +
        '<button class="session-del" data-id="' + session.id + '" title="Delete session">✕</button>' +
      '</div>' +
      '<div class="session-items open" data-id="' + session.id + '">' +
        itemsHtml +
      '</div>';

    list.appendChild(card);

    if (historyCopyMode) {
      card.querySelectorAll('.h-cb').forEach(cb => {
        cb.addEventListener('click', (e) => {
          e.stopPropagation();
          const iid = Number(cb.dataset.iid);
          const idx = historyCheckedOrder.indexOf(iid);
          if (idx > -1) {
            historyCheckedOrder.splice(idx, 1);
            cb.classList.remove('checked');
          } else {
            historyCheckedOrder.push(iid);
            cb.classList.add('checked');
          }
          renderHistory();
        });
      });
    }

    const head = card.querySelector('.session-head');
    head.addEventListener('click', (e) => {
      if (e.target.closest('.session-del')) return;
      if (historyCopyMode) return;
      const items = card.querySelector('.session-items');
      items.classList.toggle('open');
    });

    const del = card.querySelector('.session-del');
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this session from history?')) {
        historyItemsCache = await window.electronAPI.deleteSession(session.id);
        renderHistory();
      }
    });
  });
}

document.getElementById('histCopyAllBtn').addEventListener('click', () => {
  const allItems = [];
  historyItemsCache.forEach(s => { s.items.forEach(i => allItems.push(i.text)); });
  if (!allItems.length) return;
  const text = allItems.join('\n\n');
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  alert('Copied all ' + allItems.length + ' items from history to clipboard!\n\nPress Ctrl+V to paste.');
});

document.getElementById('histSelectBtn').addEventListener('click', () => {
  historyCopyMode = true;
  historyCheckedOrder = [];
  document.getElementById('history-footer').style.display = 'none';
  document.getElementById('history-copy-footer').style.display = 'flex';
  renderHistory();
});

document.getElementById('histCancelBtn').addEventListener('click', () => {
  historyCopyMode = false;
  historyCheckedOrder = [];
  document.getElementById('history-footer').style.display = 'flex';
  document.getElementById('history-copy-footer').style.display = 'none';
  renderHistory();
});

document.getElementById('histCopySelBtn').addEventListener('click', () => {
  if (!historyCheckedOrder.length) { alert('Select items by clicking their checkboxes.'); return; }
  const allItems = [];
  historyItemsCache.forEach(s => { s.items.forEach(i => allItems.push(i)); });
  const ordered = historyCheckedOrder.map(id => allItems.find(i => i.id === id)).filter(Boolean);
  if (!ordered.length) return;
  const text = ordered.map(i => i.text).join('\n\n');
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  alert('Copied ' + ordered.length + ' item(s) from history in selected order!\n\nPress Ctrl+V to paste.');
  document.getElementById('histCancelBtn').click();
});

function hideHistory() {
  document.getElementById('history-overlay').style.display = 'none';
  historyCopyMode = false;
  historyCheckedOrder = [];
}
