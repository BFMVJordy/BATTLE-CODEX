/**
 * deck.js — Gestión de cartas (crear, borrar, importar CSV, listar por mazo)
 */

const Deck = {
  state: null,

  init(state) {
    this.state = state;
    this.render();

    document.getElementById('add-card-btn').addEventListener('click', () => this.addCard());

    const importZone = document.getElementById('import-zone');
    const fileInput = document.getElementById('file-input');

    importZone.addEventListener('click', () => fileInput.click());
    importZone.addEventListener('dragover', (e) => { e.preventDefault(); importZone.classList.add('drag-over'); });
    importZone.addEventListener('dragleave', () => importZone.classList.remove('drag-over'));
    importZone.addEventListener('drop', (e) => {
      e.preventDefault();
      importZone.classList.remove('drag-over');
      this.handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
      this.handleFile(e.target.files[0]);
      e.target.value = '';            // permite volver a importar el mismo archivo
    });
    document.getElementById('import-btn').addEventListener('click', () => fileInput.click());
    document.getElementById('deck-cheer-btn').addEventListener('click', () =>
      showToast('¡Forja tu conocimiento! El duelo te aguarda, guerrero.'));
  },

  addCard() {
    const frontEl = document.getElementById('new-front');
    const backEl = document.getElementById('new-back');
    const front = frontEl.value.trim();
    const back = backEl.value.trim();
    if (!front || !back) { showToast('Completá ambos campos'); return; }
    this.state.cards.push(makeCard(front, back, this.state.activeDeck || 'default'));
    frontEl.value = '';
    backEl.value = '';
    saveState(this.state);
    this.render();
    showToast('Carta agregada');
  },

  deleteCard(id) {
    this.state.cards = this.state.cards.filter(c => c.id !== id);
    saveState(this.state);
    this.render();
  },

  handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const rows = parseCSV(String(e.target.result));
      const deckId = this.state.activeDeck || 'default';
      const existing = new Set(this.state.cards
        .filter(c => c.deckId === deckId).map(c => c.front + '\u0000' + c.back));
      let added = 0, dupes = 0, invalid = 0;

      rows.forEach((r, i) => {
        if (i === 0 && /^(pregunta|frente|front|question)$/i.test((r[0] || '').trim())) return; // encabezado
        const front = (r[0] || '').trim();
        const back = (r[1] || '').trim();
        if (!front || !back) { invalid++; return; }
        const key = front + '\u0000' + back;
        if (existing.has(key)) { dupes++; return; }
        existing.add(key);
        this.state.cards.push(makeCard(front, back, deckId));
        added++;
      });

      saveState(this.state);
      this.render();
      let msg = `${added} carta${added === 1 ? '' : 's'} importada${added === 1 ? '' : 's'}`;
      if (dupes) msg += `, ${dupes} repetida${dupes === 1 ? '' : 's'}`;
      if (invalid) msg += `, ${invalid} inválida${invalid === 1 ? '' : 's'}`;
      showToast(msg);
    };
    reader.readAsText(file);
  },

  render() {
    const deckId = this.state.activeDeck || 'default';
    const filtered = this.state.cards.filter(c => c.deckId === deckId);
    const deckName = (this.state.decks.find(d => d.id === deckId) || {}).name || 'General';

    document.getElementById('card-count').textContent = filtered.length;
    const list = document.getElementById('card-list');

    if (filtered.length === 0) {
      list.innerHTML = `<div class="empty-deck">Ninguna carta en "${escapeHtml(deckName)}".<br>Agregá la primera para comenzar.</div>`;
      return;
    }

    list.innerHTML = filtered.map(c => `
      <div class="card-row">
        <div>
          <div>${escapeHtml(c.front)}</div>
          <div class="card-row-back">→ ${escapeHtml(c.back)}</div>
        </div>
        <button class="card-del" data-id="${c.id}">BORRAR</button>
      </div>
    `).join('');

    list.querySelectorAll('.card-del').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCard(Number(btn.dataset.id)));
    });
  },
};

/**
 * Parser CSV (RFC 4180): comillas, comillas escapadas (""), saltos de línea dentro de
 * un campo y delimitador automático (coma, punto y coma o tab). Ignora líneas con #.
 */
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = (text.split(/\r?\n/).find(l => l.trim() && !l.trim().startsWith('#')) || '')
    .replace(/"[^"]*"/g, '');
  const count = ch => firstLine.split(ch).length - 1;
  const delim = count('\t') > 0 ? '\t' : (count(';') > count(',') ? ';' : ',');

  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"' && field.trim() === '') {
      inQ = true; field = '';
    } else if (c === delim) {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  return rows.filter(r => r.some(x => x.trim()) && !String(r[0]).trim().startsWith('#'));
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
