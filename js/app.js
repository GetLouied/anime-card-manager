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
    talentType: [],
    bannedTalents: [],
    search: ''
};
let editingIndex = -1;
let sortState = {
    column: null,
    direction: 'asc' // 'asc' or 'desc'
};

const roundDescriptions = {
    '7': 'Round 7: Only Dark, Neutral and Light elemental cards',
    '9': 'Round 9: Only hair colors containing "Brown" or "White"',
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
            initializeSorting();
        } else {
            console.log('No cards found in Firebase');
            updateFirebaseStatus(true);
            document.getElementById('loadingIndicator').style.display = 'none';
            alert('No data found in Firebase. Click "Reset to Default Cards" to load 649 cards.');
        }
    } catch (error) {
        console.error('Error loading cards:', error);
        updateFirebaseStatus(false);
        alert('Error connecting to Firebase. Please check your configuration.');
    }
}

window.initializeDefaultCards = async function() {
    if (confirm('This will reset all cards to default 649 cards with talentType field. Continue?')) {
        try {
            await set(cardsRef, defaultCards);
            cards = [...defaultCards];
            populateFilterButtons();
            renderTable();
            initializeSorting();
            alert(`✅ Success! Loaded ${defaultCards.length} default cards with talentType field.`);
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
        console.log('✅ Cards saved to Firebase');
        
        // Show save confirmation
        const saveNotification = document.createElement('div');
        saveNotification.textContent = '✅ Saved!';
        saveNotification.style.cssText = 'position:fixed;top:20px;right:20px;background:#28a745;color:white;padding:15px 25px;border-radius:8px;z-index:10000;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        document.body.appendChild(saveNotification);
        setTimeout(() => saveNotification.remove(), 2000);
        
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

    // Add event listeners to newly created element buttons only
    elementContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-filter-type');
            const value = this.getAttribute('data-filter-value');
            toggleFilter(type, value);
            this.classList.toggle('active');
            renderTable();
        });
    });
}

// Initialize static filter button listeners once on page load
function initializeStaticFilters() {
    // Hair Color filters
    document.querySelectorAll('.filter-btn[data-filter-type="hairColor"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-filter-type');
            const value = this.getAttribute('data-filter-value');
            toggleFilter(type, value);
            this.classList.toggle('active');
            renderTable();
        });
    });

    // Human/Non-Human filters
    document.querySelectorAll('.filter-btn[data-filter-type="human"]').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.getAttribute('data-filter-type');
            const value = this.getAttribute('data-filter-value');
            toggleFilter(type, value);
            this.classList.toggle('active');
            renderTable();
        });
    });

    // Talent Type filters
    document.querySelectorAll('.filter-btn[data-filter-type="talentType"]').forEach(btn => {
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
    filters = {element: [], human: [], hairColor: [], talentType: [], bannedTalents: [], search: ''};
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.round-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('searchBox').value = '';
    document.getElementById('bannedTalentsBox').value = '';
    document.getElementById('bannedTalentsList').innerHTML = '';
    document.getElementById('roundDescription').classList.remove('active');
    document.getElementById('roundDescription').textContent = '';
    renderTable();
};

// ========================================
// ROUND FILTER FUNCTIONS
// ========================================

// Define round order for cumulative application
const roundOrder = ['5', '7', '9', '10', '12'];

document.querySelectorAll('.round-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const round = this.getAttribute('data-round');
        const roundIndex = roundOrder.indexOf(round);
        
        if (this.classList.contains('active')) {
            // If unchecking, remove this round and all later rounds
            this.classList.remove('active');
            removeRoundFilter(round);
            
            // Remove all later rounds
            for (let i = roundIndex + 1; i < roundOrder.length; i++) {
                const laterRound = roundOrder[i];
                const laterBtn = document.querySelector(`.round-btn[data-round="${laterRound}"]`);
                if (laterBtn && laterBtn.classList.contains('active')) {
                    laterBtn.classList.remove('active');
                    removeRoundFilter(laterRound);
                }
            }
        } else {
            // If checking, apply this round and all previous rounds
            this.classList.add('active');
            applyRoundFilter(round);
            
            // Apply all previous rounds
            for (let i = 0; i < roundIndex; i++) {
                const previousRound = roundOrder[i];
                const previousBtn = document.querySelector(`.round-btn[data-round="${previousRound}"]`);
                if (previousBtn && !previousBtn.classList.contains('active')) {
                    previousBtn.classList.add('active');
                    applyRoundFilter(previousRound);
                }
            }
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
            // Remove "Brown-any" and "White-any" from filters
            const idx9Brown = filters.hairColor.indexOf('Brown-any');
            if (idx9Brown > -1) filters.hairColor.splice(idx9Brown, 1);
            const idx9White = filters.hairColor.indexOf('White-any');
            if (idx9White > -1) filters.hairColor.splice(idx9White, 1);
            
            document.querySelectorAll('.filter-btn[data-filter-type="hairColor"]').forEach(btn => {
                const value = btn.getAttribute('data-filter-value');
                if (value === 'Brown-any' || value === 'White-any') {
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
            // Round 9: Hair colors containing "Brown" or "White" - use -any filters
            if (!filters.hairColor.includes('Brown-any')) {
                filters.hairColor.push('Brown-any');
            }
            if (!filters.hairColor.includes('White-any')) {
                filters.hairColor.push('White-any');
            }
            
            document.querySelectorAll('.filter-btn[data-filter-type="hairColor"]').forEach(btn => {
                const value = btn.getAttribute('data-filter-value');
                if (value === 'Brown-any' || value === 'White-any') {
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

        if (filters.hairColor.length > 0) {
            // Check if hair color matches any of the selected filters
            const matchesHairFilter = filters.hairColor.some(filter => {
                if (filter.endsWith('-exact')) {
                    // Exact match: hair color must be exactly "White" or "Brown" (no other colors)
                    const color = filter.replace('-exact', '');
                    return card.hairColor.toLowerCase().trim() === color.toLowerCase();
                } else if (filter.endsWith('-any')) {
                    // Contains match: hair color can contain the color anywhere
                    const color = filter.replace('-any', '');
                    return card.hairColor.toLowerCase().includes(color.toLowerCase());
                } else {
                    // Fallback for legacy filters
                    return card.hairColor.toLowerCase().includes(filter.toLowerCase());
                }
            });
            if (!matchesHairFilter) {
                pass = false;
            }
        }

        if (filters.search && !card.name.toLowerCase().includes(filters.search)) {
            pass = false;
        }

        // Talent Type filter
        if (filters.talentType.length > 0 && !filters.talentType.includes(card.talentType)) {
            pass = false;
        }

        // Banned Talents filter
        if (filters.bannedTalents.length > 0 && card.talents) {
            const cardTalentLower = card.talents.toLowerCase().trim();
            const isBanned = filters.bannedTalents.some(bannedTalent => {
                return cardTalentLower.includes(bannedTalent.toLowerCase().trim());
            });
            if (isBanned) {
                pass = false;
            }
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

    // Apply sorting if active
    if (sortState.column) {
        filteredData = sortData(filteredData, sortState.column, sortState.direction);
    }

    filteredData.forEach((card) => {
        const row = document.createElement('tr');
        
        const styleStat = (val) => {
            const num = parseInt(val);
            if (isNaN(num)) return val;
            if (num > 100 || num < 60) return `<span class="stat-cell stat-bad">${val}</span>`;
            return `<span class="stat-cell stat-good">${val}</span>`;
        };
        
        const styleTalentType = (type) => {
            if (!type) return '';
            if (type === 'Passive') return `<span class="badge badge-passive">Passive</span>`;
            if (type === 'Active') return `<span class="badge badge-active">Active</span>`;
            return type;
        };
        
        row.innerHTML = `
            <td>${card.name}</td>
            <td>${card.element}</td>
            <td>${card.talents}</td>
            <td>${styleStat(card.hp)}</td>
            <td>${styleStat(card.atk)}</td>
            <td>${styleStat(card.def)}</td>
            <td>${styleStat(card.spd)}</td>
            <td>${styleTalentType(card.talentType)}</td>
            <td>${card.type}</td>
            <td>${card.hairColor}</td>
            <td>${card.notes}</td>
            <td>
                <button class="edit-btn" onclick="openEditModal(${cards.indexOf(card)})">Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateStats(filteredData.length);
    updateSortIndicators();
}

function sortData(data, column, direction) {
    const sorted = [...data].sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];
        
        // Handle numeric columns
        if (['hp', 'atk', 'def', 'spd'].includes(column)) {
            aVal = parseInt(aVal) || 0;
            bVal = parseInt(bVal) || 0;
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Handle text columns
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
        
        if (direction === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
    
    return sorted;
}

function updateSortIndicators() {
    // Remove all active classes
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('active', 'desc');
    });
    
    // Add active class to current sort column
    if (sortState.column) {
        const th = document.querySelector(`th[data-sort="${sortState.column}"]`);
        if (th) {
            th.classList.add('active');
            if (sortState.direction === 'desc') {
                th.classList.add('desc');
            }
        }
    }
}

// Add click handlers for sortable headers
function initializeSorting() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const column = this.getAttribute('data-sort');
            
            // If clicking same column, toggle direction
            if (sortState.column === column) {
                sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // New column, default to ascending
                sortState.column = column;
                sortState.direction = 'asc';
            }
            
            renderTable();
        });
    });
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
    document.getElementById('deleteBtn').style.display = 'none';
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
    document.getElementById('cardTalentType').value = card.talentType || '';
    document.getElementById('cardNotes').value = card.notes;
    document.getElementById('deleteBtn').style.display = 'block';
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
        talentType: document.getElementById('cardTalentType').value,
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
    if (editingIndex === -1) return;
    
    const cardName = cards[editingIndex].name;
    if (confirm(`Are you sure you want to delete "${cardName}"?`)) {
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
    const json = JSON.stringify(cards, null, 2);
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'anime-cards-' + new Date().toISOString().split('T')[0] + '.json';
    link.click();
};

window.importFromJSON = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    if (confirm(`Import ${imported.length} cards? This will replace current data.`)) {
                        cards = imported;
                        await saveCardsToFirebase();
                        populateFilterButtons();
                        renderTable();
                        alert('Import successful!');
                    }
                }
            } catch (error) {
                alert('Error importing file: ' + error.message);
            }
        };
        reader.readAsText(file);
    }
};

window.exportToCSV = function() {
    const headers = ['Name', 'Element', 'Talent', 'HP', 'ATK', 'DEF', 'Speed', 'Talent Type', 'Type', 'Hair', 'Notes'];
    const rows = cards.map(card => [
        card.name,
        card.element,
        card.talents,
        card.hp,
        card.atk,
        card.def,
        card.spd,
        card.talentType || '',
        card.type,
        card.hairColor,
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

document.getElementById('bannedTalentsBox').addEventListener('input', function(e) {
    const input = e.target.value;
    if (input.trim()) {
        filters.bannedTalents = input.split(',').map(t => t.trim()).filter(t => t);
        
        const listEl = document.getElementById('bannedTalentsList');
        listEl.innerHTML = filters.bannedTalents.map(talent => 
            `<span class="banned-talent-tag">${talent}</span>`
        ).join('');
    } else {
        filters.bannedTalents = [];
        document.getElementById('bannedTalentsList').innerHTML = '';
    }
    renderTable();
});

// ========================================
// INITIALIZE APP
// ========================================

// Initialize static filter buttons once
initializeStaticFilters();

// Load cards from Firebase
loadCards();