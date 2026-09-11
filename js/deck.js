/**
 * deck.js — Card management (create, delete, CSV import, render list per deck)
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
    importZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      importZone.classList.add('drag-over');
    });
    importZone.addEventListener('dragleave', () => importZone.classList.remove('drag-over'));
    importZone.addEventListener('drop', (e) => {
      e.preventDefault();
      importZone.classList.remove('drag-over');
      this.handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => this.handleFile(e.target.files[0]));
    document.getElementById('import-btn').addEventListener('click', () => fileInput.click());
    document.getElementById('deck-cheer-btn').addEventListener('click', () => showToast('¡Forja tu conocimiento! El duelo te aguarda, guerrero.'));
  },

  addCard() {
    const front = document.getElementById('new-front').value.trim();
    const back = document.getElementById('new-back').value.trim();
    if (!front || !back) {
      showToast('Completá ambos campos');
      return;
    }
    const deckId = this.state.activeDeck || 'default';
    this.state.cards.push(makeCard(front, back, deckId));
    document.getElementById('new-front').value = '';
    document.getElementById('new-back').value = '';
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
      const lines = e.target.result.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      let added = 0;
      const deckId = this.state.activeDeck || 'default';
      lines.forEach(line => {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length >= 2) {
          const front = parts[0].replace(/^"|"$/g, '').trim();
          const back = parts[1].replace(/^"|"$/g, '').trim();
          if (front && back) {
            this.state.cards.push(makeCard(front, back, deckId));
            added++;
          }
        }
      });
      saveState(this.state);
      this.render();
      showToast(`Cartas importadas, el duelo te espera`);
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
      btn.addEventListener('click', () => {
        this.deleteCard(Number(btn.dataset.id));
      });
    });
  },
};

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
