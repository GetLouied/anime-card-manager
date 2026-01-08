// Main application logic
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getDatabase, ref, set, get } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import firebaseConfig from './firebase-config.js';
import { defaultCards } from './data.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const cardsRef = ref(database, 'cards');

// Global state
let cards = [];
let filters = {
    element: [],
    human: [],
    hairColor: [],
    search: ''
};
let editingIndex = -1;

const roundDescriptions = {
    '7': 'Round 7: Only Dark, Neutral and Light elemental cards',
    '9': 'Round 9: Only Brown and White hair colors',
    '10': 'Round 10: At least 1 Neutral elemental card must be used',
    '12': 'Round 12: Only Human cards allowed',
    '5': 'Round 5: Cards with stats above 100 or below 60 are banned'
};

// ========================================
// FIREBASE FUNCTIONS
// ========================================

async function loadCards() {
    try {
        const snapshot = await get(cardsRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            cards = Array.isArray(data) ? data : Object.values(data);
            
            updateFirebaseStatus(true);
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('tableContainer').style.display = 'block';
            
            populateFilterButtons();
            renderTable();
        } else {
            console.log('No cards found, initializing with default data...');
            await initializeDefaultCards();
        }
    } catch (error) {
        console.error('Error loading cards:', error);
        updateFirebaseStatus(false);
        alert('Error connecting to Firebase. Please check your configuration in firebase-config.js');
    }
}

window.initializeDefaultCards = async function() {
    if (confirm('This will reset all cards to default 100 cards. Continue?')) {
        try {
            await set(cardsRef, defaultCards);
            cards = [...defaultCards];
            populateFilterButtons();
            renderTable();
            alert('Default cards loaded successfully!');
        } catch (error) {
            console.error('Error initializing cards:', error);
            alert('Error: ' + error.message);
        }
    }
};

function updateFirebaseStatus(connected) {
    const statusEl = document.getElementById('firebaseStatus');
    if (connected) {
        statusEl.textContent = '✅ Connected to Firebase';
        statusEl.className = 'firebase-status connected';
    } else {
        statusEl.textContent = '❌ Firebase Connection Error';
        statusEl.className = 'firebase-status disconnected';
    }
}

async function saveCardsToFirebase() {
    try {
        await set(cardsRef, cards);
        console.log('Cards saved to Firebase');
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        alert('Error saving to database: ' + error.message);
    }
}

// ========================================
// FILTER FUNCTIONS
// ========================================

function populateFilterButtons() {
    const elements = [...new Set(cards.map(c => c.element))].filter(e => e).sort();
    const elementContainer = document.getElementById('elementFilters');
    elementContainer.innerHTML = '';
    elements.forEach(element => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.setAttribute('data-filter-type', 'element');
        btn.setAttribute('data-filter-value', element);
        btn.textContent = element;
        elementContainer.appendChild(btn);
    });

    // Only show Brown and White hair colors
    const hairColors = [...new Set(cards.map(c => c.hairColor))]
        .filter(h => h && (h.toLowerCase().includes('brown') || h.toLowerCase().includes('white')))
        .filter(h => !h.toLowerCase().includes('blonde'))
        .sort();
    const hairContainer = document.getElementById('hairColorFilters');
    hairContainer.innerHTML = '';
    hairColors.forEach(color => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.setAttribute('data-filter-type', 'hairColor');
        btn.setAttribute('data-filter-value', color);
        btn.textContent = color;
        hairContainer.appendChild(btn);
    });

    // Add event listeners
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-filter-type');
            const value = this.getAttribute('data-filter-value');
            toggleFilter(type, value);
            this.classList.toggle('active');
            renderTable();
        });
    });
}

function toggleFilter(type, value) {
    const index = filters[type].indexOf(value);
    if (index > -1) {
        filters[type].splice(index, 1);
    } else {
        filters[type].push(value);
    }
}

window.clearFilters = function() {
    filters = {element: [], human: [], hairColor: [], search: ''};
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.round-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('searchBox').value = '';
    document.getElementById('roundDescription').classList.remove('active');
    document.getElementById('roundDescription').textContent = '';
    renderTable();
};

// ========================================
// ROUND FILTER FUNCTIONS
// ========================================

document.querySelectorAll('.round-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const round = this.getAttribute('data-round');
        
        if (this.classList.contains('active')) {
            this.classList.remove('active');
            removeRoundFilter(round);
        } else {
            this.classList.add('active');
            applyRoundFilter(round);
        }
        
        updateRoundDescription();
    });
});

function updateRoundDescription() {
    const descEl = document.getElementById('roundDescription');
    const activeButtons = document.querySelectorAll('.round-btn.active');
    
    if (activeButtons.length === 0) {
        descEl.classList.remove('active');
    } else {
        const descriptions = Array.from(activeButtons).map(btn => 
            roundDescriptions[btn.getAttribute('data-round')]
        );
        descEl.textContent = descriptions.join(' + ');
        descEl.classList.add('active');
    }
}

function removeRoundFilter(round) {
    switch(round) {
        case '7':
            ['Dark', 'Neutral', 'Light'].forEach(el => {
                const idx = filters.element.indexOf(el);
                if (idx > -1) filters.element.splice(idx, 1);
            });
            document.querySelectorAll('.filter-btn[data-filter-type="element"]').forEach(btn => {
                if (['Dark', 'Neutral', 'Light'].includes(btn.getAttribute('data-filter-value'))) {
                    btn.classList.remove('active');
                }
            });
            break;
        case '9':
            const brownWhiteColors = [...new Set(cards
                .filter(c => {
                    const color = c.hairColor.toLowerCase();
                    return color === 'brown' || color === 'white' || 
                           color.includes('brown') && !color.includes('blonde') ||
                           color.includes('white') && !color.includes('blue');
                })
                .map(c => c.hairColor))];
            
            brownWhiteColors.forEach(color => {
                const idx = filters.hairColor.indexOf(color);
                if (idx > -1) filters.hairColor.splice(idx, 1);
            });
            
            document.querySelectorAll('.filter-btn[data-filter-type="hairColor"]').forEach(btn => {
                const val = btn.getAttribute('data-filter-value').toLowerCase();
                if ((val === 'brown' || val === 'white' || 
                     val.includes('brown') && !val.includes('blonde') ||
                     val.includes('white') && !val.includes('blue'))) {
                    btn.classList.remove('active');
                }
            });
            break;
        case '10':
            const idx = filters.element.indexOf('Neutral');
            if (idx > -1) filters.element.splice(idx, 1);
            document.querySelector('.filter-btn[data-filter-value="Neutral"]')?.classList.remove('active');
            break;
        case '12':
            const humanIdx = filters.human.indexOf('Human');
            if (humanIdx > -1) filters.human.splice(humanIdx, 1);
            document.querySelector('.filter-btn[data-filter-value="Human"]')?.classList.remove('active');
            break;
        case '5':
            break;
    }
    renderTable();
}

function applyRoundFilter(round) {
    switch(round) {
        case '7':
            ['Dark', 'Neutral', 'Light'].forEach(el => {
                if (!filters.element.includes(el)) {
                    filters.element.push(el);
                }
            });
            document.querySelectorAll('.filter-btn[data-filter-type="element"]').forEach(btn => {
                if (['Dark', 'Neutral', 'Light'].includes(btn.getAttribute('data-filter-value'))) {
                    btn.classList.add('active');
                }
            });
            break;
        case '9':
            const brownWhiteColors = [...new Set(cards
                .filter(c => {
                    const color = c.hairColor.toLowerCase();
                    return color === 'brown' || color === 'white' ||
                           color.includes('brown') && !color.includes('blonde') ||
                           color.includes('white') && !color.includes('blue');
                })
                .map(c => c.hairColor))];
            
            brownWhiteColors.forEach(color => {
                if (!filters.hairColor.includes(color)) {
                    filters.hairColor.push(color);
                }
            });
            
            document.querySelectorAll('.filter-btn[data-filter-type="hairColor"]').forEach(btn => {
                const val = btn.getAttribute('data-filter-value').toLowerCase();
                if ((val === 'brown' || val === 'white' ||
                     val.includes('brown') && !val.includes('blonde') ||
                     val.includes('white') && !val.includes('blue'))) {
                    btn.classList.add('active');
                }
            });
            break;
        case '10':
            if (!filters.element.includes('Neutral')) {
                filters.element.push('Neutral');
            }
            document.querySelectorAll('.filter-btn[data-filter-value="Neutral"]').forEach(btn => {
                btn.classList.add('active');
            });
            break;
        case '12':
            if (!filters.human.includes('Human')) {
                filters.human.push('Human');
            }
            document.querySelectorAll('.filter-btn[data-filter-value="Human"]').forEach(btn => {
                btn.classList.add('active');
            });
            break;
        case '5':
            break;
    }
    renderTable();
}

// ========================================
// RENDER FUNCTIONS
// ========================================

function renderTable() {
    const tbody = document.getElementById('cardTable');
    tbody.innerHTML = '';

    let filteredData = cards.filter(card => {
        let pass = true;

        if (filters.element.length > 0 && !filters.element.includes(card.element)) {
            pass = false;
        }

        if (filters.human.length > 0 && !filters.human.includes(card.type)) {
            pass = false;
        }

        if (filters.hairColor.length > 0 && !filters.hairColor.includes(card.hairColor)) {
            pass = false;
        }

        if (filters.search && !card.name.toLowerCase().includes(filters.search)) {
            pass = false;
        }

        // Round 5 filter
        const round5Active = document.querySelector('.round-btn[data-round="5"]')?.classList.contains('active');
        if (round5Active) {
            const stats = [parseInt(card.hp), parseInt(card.atk), parseInt(card.def), parseInt(card.spd)];
            for (let stat of stats) {
                if (!isNaN(stat) && (stat > 100 || stat < 60)) {
                    pass = false;
                    break;
                }
            }
        }

        return pass;
    });

    filteredData.forEach((card) => {
        const row = document.createElement('tr');
        
        const styleStat = (val) => {
            const num = parseInt(val);
            if (isNaN(num)) return val;
            if (num > 100 || num < 60) return `<span class="stat-cell stat-bad">${val}</span>`;
            return `<span class="stat-cell stat-good">${val}</span>`;
        };
        
        row.innerHTML = `
            <td>${card.name}</td>
            <td>${card.element}</td>
            <td>${card.hairColor}</td>
            <td>${card.type}</td>
            <td>${styleStat(card.hp)}</td>
            <td>${styleStat(card.atk)}</td>
            <td>${styleStat(card.def)}</td>
            <td>${styleStat(card.spd)}</td>
            <td>${card.talents}</td>
            <td>${card.notes}</td>
            <td>
                <button class="edit-btn" onclick="openEditModal(${cards.indexOf(card)})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateStats(filteredData.length);
}

function updateStats(filtered = null) {
    document.getElementById('totalCards').textContent = cards.length;
    document.getElementById('filteredCards').textContent = filtered !== null ? filtered : cards.length;
    document.getElementById('humanCards').textContent = cards.filter(c => c.type === 'Human').length;
    document.getElementById('nonHumanCards').textContent = cards.filter(c => c.type === 'Non-Human').length;
}

// ========================================
// MODAL FUNCTIONS
// ========================================

window.openAddModal = function() {
    editingIndex = -1;
    document.getElementById('modalTitle').textContent = 'Add Card';
    document.getElementById('cardForm').reset();
    document.getElementById('deleteBtn').style.display = 'none'; // Hide delete button
    document.getElementById('cardModal').style.display = 'block';
};

window.openEditModal = function(index) {
    editingIndex = index;
    const card = cards[index];
    document.getElementById('modalTitle').textContent = 'Edit Card';
    document.getElementById('cardName').value = card.name;
    document.getElementById('cardElement').value = card.element;
    document.getElementById('cardHair').value = card.hairColor;
    document.getElementById('cardType').value = card.type;
    document.getElementById('cardHP').value = card.hp;
    document.getElementById('cardATK').value = card.atk;
    document.getElementById('cardDEF').value = card.def;
    document.getElementById('cardSPD').value = card.spd;
    document.getElementById('cardTalents').value = card.talents;
    document.getElementById('cardNotes').value = card.notes;
    document.getElementById('deleteBtn').style.display = 'block'; // Show delete button
    document.getElementById('cardModal').style.display = 'block';
};

window.closeModal = function() {
    document.getElementById('cardModal').style.display = 'none';
};

// ========================================
// CRUD OPERATIONS
// ========================================

document.getElementById('cardForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const card = {
        name: document.getElementById('cardName').value,
        element: document.getElementById('cardElement').value,
        hairColor: document.getElementById('cardHair').value,
        type: document.getElementById('cardType').value,
        hp: document.getElementById('cardHP').value || '0',
        atk: document.getElementById('cardATK').value || '0',
        def: document.getElementById('cardDEF').value || '0',
        spd: document.getElementById('cardSPD').value || '0',
        talents: document.getElementById('cardTalents').value,
        notes: document.getElementById('cardNotes').value
    };

    if (editingIndex === -1) {
        cards.push(card);
    } else {
        cards[editingIndex] = card;
    }

    await saveCardsToFirebase();
    populateFilterButtons();
    renderTable();
    closeModal();
});

window.deleteCurrentCard = async function() {
    if (editingIndex === -1) return; // Safety check
    
    const cardName = cards[editingIndex].name;
    if (confirm(`Are you sure you want to delete "${cardName}"? This cannot be undone.`)) {
        cards.splice(editingIndex, 1);
        await saveCardsToFirebase();
        populateFilterButtons();
        renderTable();
        closeModal();
    }
};

// ========================================
// IMPORT/EXPORT FUNCTIONS
// ========================================

window.exportToJSON = function() {
    const dataStr = JSON.stringify(cards, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'anime-cards-' + new Date().toISOString().split('T')[0] + '.json';
    link.click();
};

window.importFromJSON = async function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (confirm(`Import ${imported.length} cards? This will replace your current data.`)) {
                    cards = imported;
                    await saveCardsToFirebase();
                    populateFilterButtons();
                    renderTable();
                    alert('Import successful!');
                }
            } catch (error) {
                alert('Error importing file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
};

window.exportToCSV = function() {
    const headers = ['Name', 'Element', 'Hair Color', 'Type', 'HP', 'ATK', 'DEF', 'SPD', 'Talents', 'Notes'];
    const rows = cards.map(card => [
        card.name,
        card.element,
        card.hairColor,
        card.type,
        card.hp,
        card.atk,
        card.def,
        card.spd,
        card.talents,
        card.notes
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(field => `"${field}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'anime-cards-' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
};

// ========================================
// SEARCH FUNCTIONALITY
// ========================================

document.getElementById('searchBox').addEventListener('input', function(e) {
    filters.search = e.target.value.toLowerCase();
    renderTable();
});

// ========================================
// INITIALIZE APP
// ========================================

loadCards();