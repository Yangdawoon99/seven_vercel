import { equipmentData } from '/data/equipment.js';
import { ApiService } from '/js/services/api.js';
import { STAT_LABELS, SET_LABELS } from '/js/utils/constants.js';

// Change to let to allow reassignment
export let userEquipment = []; // Local cache

// Standards for Matching Names
const MATCHING_RULES = [
    { categories: ['weapon_physical'], sets: ['vanguard', 'tracker', 'paladin'], name: '빛나는 드래곤 슬레이어' },
    { categories: ['weapon_magic'], sets: ['vanguard', 'tracker', 'paladin'], name: '빛나는 드래곤의 보주' },
    { categories: ['weapon_physical'], sets: ['gatekeeper', 'guardian', 'assassin'], name: '빛나는 우마왕의 철퇴' },
    { categories: ['weapon_magic'], sets: ['gatekeeper', 'guardian', 'assassin'], name: '빛나는 우마왕의 경전' },
    { categories: ['weapon_physical'], sets: ['shaman', 'arbiter', 'avenger'], name: '빛나는 히드라의 검' },
    { categories: ['weapon_magic'], sets: ['shaman', 'arbiter', 'avenger'], name: '빛나는 히드라의 지팡이' }
];

// +15 Enhancement Standard Stats
const STANDARD_STATS = {
    effect_hit: { val: 30, guide: "효과 적중 30%" },
    hp_percent: { val: 28, guide: "생명력 28%" },
    weakness_rate: { val: 28, guide: "약점 공격 확률 28%" },
    crit_rate: { val: 24, guide: "치명타 확률 24%" },
    crit_damage: { val: 36, guide: "치명타 피해 36%" },
    attack_percent: { val: 28, guide: "모든공격력(%) 28%" },
    defense_percent: { val: 28, guide: "방어력 28%" },
    physical_attack: { val: 240, guide: "모든공격력 240" },
    defense: { val: 160, guide: "방어력 160" },
    hp: { val: 850, guide: "생명력 850" }
};

// Filter State
let currentFilters = {
    category: 'all',
    sets: [],
    mainOpts: [],
    includeSubs: [],
    excludeSubs: [],
    sortBy: { key: null, order: 'desc' }
};

export async function initEquipmentUI() {
    await loadEquipment();
    initFilterUI();
    populateSelects();
    renderEquipList();
    setupEventListeners();
}

async function loadEquipment() {
    try {
        userEquipment = await ApiService.getEquipment();

        // Data Cleansing: Fix broken set data from previous bugs
        let needsFix = false;
        for (let eq of userEquipment) {
            // Unify set and set_name in local cache
            eq.set = eq.set_name || eq.set;

            if (!eq.set || eq.set === 'undefined') {
                console.log(`Fixing equipment ${eq.id} set to avenger`);
                eq.set = 'avenger';
                eq.set_name = 'avenger';
                await ApiService.saveEquipment(eq);
                needsFix = true;
            }
        }
        if (needsFix) userEquipment = await ApiService.getEquipment();
        const lsData = localStorage.getItem('sena_equip');
        if (userEquipment.length < 5 && lsData) {
            console.log("Migrating equipment from LocalStorage to DB...");
            const lsEquip = JSON.parse(lsData);
            for (const item of lsEquip) {
                await ApiService.saveEquipment(item);
            }
            userEquipment = await ApiService.getEquipment();
        }

        // Seeding if still empty (minimal demo data)
        if (userEquipment.length === 0) {
            console.log("Seeding initial equipment data...");
            const seed = [
                {
                    id: "eq_seed_1",
                    category: "weapon",
                    subType: "magic",
                    name: "빛나는 히드라의 지팡이",
                    set: "assassin",
                    isEquipped: false,
                    grade: 6,
                    enhance: 15,
                    mainOption: { name: "magic_attack", value: 304 },
                    subOptions: [{ name: "speed", value: 5 }]
                }
            ];
            for (const item of seed) await ApiService.saveEquipment(item);
            userEquipment = await ApiService.getEquipment();
        }
    } catch (err) {
        console.error("Failed to load equipment:", err);
    }
}

function initFilterUI() {
    // Populate Set Chips
    const setContainer = document.getElementById('set-chips');
    equipmentData.sets.forEach(set => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.dataset.value = set;
        btn.innerText = SET_LABELS[set] || set;
        btn.onclick = () => toggleFilter('sets', set, btn);
        setContainer.appendChild(btn);
    });

    // Populate Main Option Chips (Order: Physical(All) -> Crit -> SPD -> HP/DEF -> ...)
    const mainContainer = document.getElementById('main-opt-chips');
    const commonMainOpts = [
        'physical_attack', 'attack_percent', 'weakness_rate', 'crit_rate', 'crit_damage',
        'speed', 'defense_percent', 'defense', 'hp_percent', 'hp', 'damage_reduce',
        'effect_hit', 'effect_resist'
    ];
    commonMainOpts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.dataset.value = opt;
        btn.innerText = STAT_LABELS[opt] || opt;
        btn.onclick = () => toggleFilter('mainOpts', opt, btn);
        mainContainer.appendChild(btn);
    });

    // Populate Sub Option Control List
    renderSubFilterList();
}

function renderSubFilterList() {
    const container = document.getElementById('sub-opt-filter-list');
    container.innerHTML = '';

    const allSubOpts = [
        'physical_attack', 'attack_percent', 'weakness_rate', 'crit_rate', 'crit_damage',
        'speed', 'damage_reduce', 'defense_percent', 'defense', 'hp_percent', 'hp',
        'block_rate', 'effect_hit', 'effect_resist'
    ];

    allSubOpts.forEach(opt => {
        // Filter out damage_reduce for weapon category if strictly following request
        if (opt === 'damage_reduce' && currentFilters.category === 'weapon') return;

        const item = document.createElement('div');
        item.className = 'sub-filter-item';

        const isIncluded = currentFilters.includeSubs.includes(opt);
        const isExcluded = currentFilters.excludeSubs.includes(opt);
        const isActiveSort = currentFilters.sortBy.key === opt;
        const sortIcon = currentFilters.sortBy.order === 'asc' ? 'fa-sort-amount-up' : 'fa-sort-amount-down';

        item.innerHTML = `
            <span>${STAT_LABELS[opt] || opt}</span>
            <div class="sub-filter-controls">
                <button class="sub-btn include ${isIncluded ? 'active' : ''}" onclick="toggleSubControl('include', '${opt}')" title="포함 필터">
                    <i class="fas fa-check"></i>
                </button>
                <button class="sub-btn exclude ${isExcluded ? 'active' : ''}" onclick="toggleSubControl('exclude', '${opt}')" title="제외 필터">
                    <i class="fas fa-times"></i>
                </button>
                <button class="sub-btn sort ${isActiveSort ? 'active' : ''}" onclick="toggleSubControl('sort', '${opt}')" title="이 능력치로 정렬 (내림/올림/해제)">
                    <i class="fas ${isActiveSort ? sortIcon : 'fa-sort-amount-down'}"></i>
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function toggleFilter(type, value, btn) {
    if (value === 'all') {
        currentFilters[type] = [];
        // Reset all buttons in this group
        btn.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
    } else {
        // Remove 'all' active state
        const allBtn = btn.parentElement.querySelector('[data-value="all"]');
        if (allBtn) allBtn.classList.remove('active');

        const idx = currentFilters[type].indexOf(value);
        if (idx > -1) {
            currentFilters[type].splice(idx, 1);
            btn.classList.remove('active');

            // If none selected, re-activate 'all'
            if (currentFilters[type].length === 0 && allBtn) {
                allBtn.classList.add('active');
            }
        } else {
            currentFilters[type].push(value);
            btn.classList.add('active');
        }
    }
    renderEquipList();
}

// Global for inline onclick
window.toggleSubControl = function (action, opt) {
    if (action === 'include') {
        const idx = currentFilters.includeSubs.indexOf(opt);
        if (idx > -1) {
            currentFilters.includeSubs.splice(idx, 1);
        } else {
            currentFilters.includeSubs.push(opt);
            // Remove from exclude if present
            const eIdx = currentFilters.excludeSubs.indexOf(opt);
            if (eIdx > -1) currentFilters.excludeSubs.splice(eIdx, 1);
        }
    } else if (action === 'exclude') {
        const idx = currentFilters.excludeSubs.indexOf(opt);
        if (idx > -1) {
            currentFilters.excludeSubs.splice(idx, 1);
        } else {
            currentFilters.excludeSubs.push(opt);
            // Remove from include if present
            const iIdx = currentFilters.includeSubs.indexOf(opt);
            if (iIdx > -1) currentFilters.includeSubs.splice(iIdx, 1);
        }
    } else if (action === 'sort') {
        if (currentFilters.sortBy.key === opt) {
            // Cycle: Desc -> Asc -> Null
            if (currentFilters.sortBy.order === 'desc') {
                currentFilters.sortBy.order = 'asc';
            } else {
                currentFilters.sortBy.key = null;
                currentFilters.sortBy.order = 'desc';
            }
        } else {
            currentFilters.sortBy.key = opt;
            currentFilters.sortBy.order = 'desc';
        }
    }

    renderSubFilterList();
    renderEquipList();
};

function setupEventListeners() {
    const addBtn = document.getElementById('add-equip-btn');
    const modal = document.getElementById('equip-modal');
    const closeBtn = modal.querySelector('.close-modal');
    const form = document.getElementById('equip-form');
    const categorySelect = document.getElementById('equip-category');
    const deleteBtn = document.getElementById('btn-delete-equip');

    // Detail Modal Elements
    const detailModal = document.getElementById('equip-detail-modal');
    const detailCloseBtn = detailModal.querySelector('.close-modal');

    // Category chips listener
    document.querySelectorAll('#category-chips .chip').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#category-chips .chip').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            currentFilters.category = btn.dataset.value;
            renderEquipList();
        });
    });

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (form) form.reset();
            const idInput = document.getElementById('equip-id');
            if (idInput) idInput.value = '';

            const title = document.querySelector('#equip-modal h2');
            if (title) title.innerText = '장비 등록';

            if (deleteBtn) deleteBtn.style.display = 'none';

            // Reset option selects
            updateOptionSelects('weapon');
            if (modal) modal.style.display = 'block';
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    }

    if (detailCloseBtn) {
        detailCloseBtn.addEventListener('click', () => { if (detailModal) detailModal.style.display = 'none'; });
    }

    window.addEventListener('click', (e) => {
        if (modal && e.target == modal) modal.style.display = 'none';
        if (detailModal && e.target == detailModal) detailModal.style.display = 'none';
    });

    if (categorySelect) {
        categorySelect.addEventListener('change', () => {
            const cat = categorySelect.value.includes('weapon') ? 'weapon' : 'armor';
            updateOptionSelects(cat);
            updateEquipNameByLogic();
        });
    }

    const setSelect = document.getElementById('equip-set');
    if (setSelect) {
        setSelect.addEventListener('change', updateEquipNameByLogic);
    }

    const mainOptSelect = document.getElementById('equip-main-opt');
    if (mainOptSelect) {
        mainOptSelect.addEventListener('change', applyStandardStatByLogic);
    }

    // Delete Handler
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const idInput = document.getElementById('equip-id');
            const id = idInput ? idInput.value : null;

            if (id && confirm('정말로 이 장비를 삭제하시겠습니까?')) {
                const index = userEquipment.findIndex(e => e.id === id);
                if (index > -1) {
                    await ApiService.deleteEquipment(id);
                    userEquipment.splice(index, 1);
                    renderEquipList();
                    if (modal) modal.style.display = 'none';
                }
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idInput = document.getElementById('equip-id');
            const editId = idInput ? idInput.value : '';

            const fullCategory = document.getElementById('equip-category').value;
            const category = fullCategory.includes('weapon') ? 'weapon' : 'armor';
            const subType = fullCategory.includes('magic') ? 'magic' : (fullCategory.includes('physical') ? 'physical' : 'armor');

            const name = document.getElementById('equip-name').value;
            const set = document.getElementById('equip-set').value;
            const mainOpt = document.getElementById('equip-main-opt').value;
            const mainVal = parseInt(document.getElementById('equip-main-val').value) || 0;

            const subOpts = [];
            const subSelects = document.querySelectorAll('.equip-sub-opt');
            const subVals = document.querySelectorAll('.equip-sub-val');

            subSelects.forEach((select, index) => {
                if (select.value) {
                    const val = parseInt(subVals[index].value) || 0;
                    subOpts.push({ name: select.value, value: val });
                }
            });

            let equip;
            if (editId) {
                equip = userEquipment.find(e => e.id === editId);
                if (equip) {
                    Object.assign(equip, { category, subType, name, set, mainOption: { name: mainOpt, value: mainVal }, subOptions: subOpts });
                }
            } else {
                equip = {
                    id: `eq_${Date.now()}`,
                    category,
                    subType,
                    name,
                    set,
                    grade: 6,
                    enhance: 15,
                    mainOption: { name: mainOpt, value: mainVal },
                    subOptions: subOpts,
                    isEquipped: false
                };
                userEquipment.push(equip);
            }

            await ApiService.saveEquipment(equip);
            renderEquipList();
            if (modal) modal.style.display = 'none';
            form.reset();

            updateOptionSelects('weapon');
            updateCounts();
        });
    }
}

// Logic to update equipment name based on category and set
function updateEquipNameByLogic() {
    const category = document.getElementById('equip-category').value;
    const set = document.getElementById('equip-set').value;
    const nameInput = document.getElementById('equip-name');

    if (!category || !set || !nameInput) return;

    const rule = MATCHING_RULES.find(r => r.categories.includes(category) && r.sets.includes(set));
    if (rule) {
        nameInput.value = rule.name;
    }
}

// Logic to apply standard stats and show guide
function applyStandardStatByLogic() {
    const opt = document.getElementById('equip-main-opt').value;
    const valInput = document.getElementById('equip-main-val');
    const guideSpan = document.getElementById('standard-stat-guide');

    if (!opt || !valInput || !guideSpan) return;

    if (STANDARD_STATS[opt]) {
        valInput.value = STANDARD_STATS[opt].val;
        guideSpan.innerText = `가이드: 15강화 기준`;
    } else {
        guideSpan.innerText = "";
    }
}

function updateCounts() {
    const heroCount = document.getElementById('hero-count'); // Not used in this file, but kept for consistency
    const equipCount = document.getElementById('equip-count');
    if (equipCount) equipCount.innerText = userEquipment.length;
}

function populateSelects() {
    const setSelect = document.getElementById('equip-set');
    if (!setSelect) return;
    setSelect.innerHTML = '';
    equipmentData.sets.forEach(set => {
        const option = document.createElement('option');
        option.value = set;
        option.innerText = SET_LABELS[set] || set; // Use Korean labels
        setSelect.appendChild(option);
    });
    updateOptionSelects('weapon');
}

function updateOptionSelects(category) {
    const mainOptSelect = document.getElementById('equip-main-opt');
    const subOptSelects = document.querySelectorAll('.equip-sub-opt');
    if (!mainOptSelect) return;

    mainOptSelect.innerHTML = '';
    subOptSelects.forEach(s => s.innerHTML = '<option value="">선택 안함</option>');

    const mainOptions = equipmentData.options[category].main;
    const subOptions = equipmentData.options[category].sub;

    mainOptions.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt;
        el.innerText = STAT_LABELS[opt] || opt;
        mainOptSelect.appendChild(el);
    });

    subOptions.forEach(opt => {
        subOptSelects.forEach(select => {
            const el = document.createElement('option');
            el.value = opt;
            el.innerText = STAT_LABELS[opt] || opt;
            select.appendChild(el);
        });
    });
}

// Helper function to calculate Gear Score
function calculateGS(equip) {
    let gs = equip.mainOption.value;
    equip.subOptions.forEach(sub => gs += sub.value);
    return Math.floor(gs);
}

function renderEquipList() {
    const list = document.getElementById('equip-list');
    if (!list) return;
    list.innerHTML = '';

    // Advanced Filtering Logic
    let filtered = userEquipment.filter(item => {
        // 1. Category
        if (currentFilters.category !== 'all' && item.category !== currentFilters.category) return false;

        // 2. Sets (OR logic)
        if (currentFilters.sets.length > 0 && !currentFilters.sets.includes(item.set)) return false;

        // 3. Main Options (OR logic)
        if (currentFilters.mainOpts.length > 0 && !currentFilters.mainOpts.includes(item.mainOption.name)) return false;

        // 4. Sub Options - Inclusion (AND logic)
        const itemSubNames = item.subOptions.map(s => s.name);
        for (const inc of currentFilters.includeSubs) {
            if (!itemSubNames.includes(inc)) return false;
        }

        // 5. Sub Options - Exclusion
        for (const exc of currentFilters.excludeSubs) {
            if (itemSubNames.includes(exc)) return false;
        }

        return true;
    });

    // Advanced Sorting Logic
    if (currentFilters.sortBy.key) {
        filtered.sort((a, b) => {
            const valA = (a.subOptions.find(s => s.name === currentFilters.sortBy.key) || { value: 0 }).value;
            const valB = (b.subOptions.find(s => s.name === currentFilters.sortBy.key) || { value: 0 }).value;
            return currentFilters.sortBy.order === 'desc' ? valB - valA : valA - valB;
        });
    } else {
        // Default sort by GS
        filtered.sort((a, b) => calculateGS(b) - calculateGS(a));
    }

    filtered.forEach((equip, index) => {
        const card = document.createElement('div');
        card.className = 'card equip-card';
        card.onclick = () => window.showEquipDetail(equip.id);

        const setIconPath = equipmentData.setIcons[equip.set];
        const setIconHtml = setIconPath
            ? `<img src="${setIconPath}" onerror="this.src='https://via.placeholder.com/32?text=S'; this.onerror=null;">`
            : `<i class="fas fa-shield-alt" style="font-size: 1.5rem; color: var(--text-muted);"></i>`;

        // 서브 옵션 요약 태그
        const subTagsHtml = equip.subOptions.map(sub => {
            const label = STAT_LABELS[sub.name] || sub.name;
            const val = sub.name.includes('percent') || sub.name.includes('rate') ? `+${sub.value}%` : `+${sub.value}`;
            return `<span class="mini-tag">${label} ${val}</span>`;
        }).join('');

        card.innerHTML = `
            <div class="card-numbering">${index + 1}</div>
            <div class="equip-card-top">
                <div class="equip-set-mini">
                    ${setIconHtml}
                    <div class="set-name-badge">${SET_LABELS[equip.set] || equip.set}</div>
                </div>
                <div class="enhance-badge">+${equip.enhance || 15}</div>
            </div>
            <div class="equip-card-mid">
                <div class="equip-name-compact" title="${equip.name}">${equip.name}</div>
                <div class="equip-main-stat-compact">
                    ${STAT_LABELS[equip.mainOption.name]} <span>+${equip.mainOption.value}</span>
                </div>
            </div>
            <div class="equip-card-bot">
                ${subTagsHtml}
            </div>
            <button class="settings-btn icon-btn" onclick="event.stopPropagation(); window.editEquipment('${equip.id}')">
                <i class="fas fa-cog"></i>
            </button>
        `;
        list.appendChild(card);
    });

    updateCounts();
}

// Global function to open detail modal
window.showEquipDetail = function (equipDataOrId) {
    let equip = typeof equipDataOrId === 'string' ? userEquipment.find(e => e.id === equipDataOrId) : equipDataOrId;
    if (!equip) return;

    const modal = document.getElementById('equip-detail-modal');

    // Set Icon in detail
    const setIconPath = equipmentData.setIcons[equip.set];
    const setIconHtml = setIconPath ? `<img src="${setIconPath}" style="width:24px; height:24px; margin-right:8px; vertical-align:middle;" onerror="this.style.display='none';">` : '';

    // Find index in userEquipment to show "No. X"
    const idx = userEquipment.findIndex(e => e.id === (equip.id || equipDataOrId)); // Handle both data or ID
    const noPrefix = idx > -1 ? `[No.${idx + 1}] ` : '';

    document.getElementById('detail-name').innerText = noPrefix + equip.name + (equip.enhance ? ` +${equip.enhance}` : '');
    document.getElementById('detail-type').innerText = equip.subType === 'magic' ? '마법 무기' : (equip.subType === 'physical' ? '물리 무기' : '방어구');
    document.getElementById('detail-set').innerHTML = `${setIconHtml}${SET_LABELS[equip.set] || equip.set}`;

    // Main Opt
    const mainLabel = STAT_LABELS[equip.mainOption.name] || equip.mainOption.name;
    document.getElementById('detail-main').innerText = `${mainLabel} +${equip.mainOption.value}`;

    // Sub Opts
    const subContainer = document.getElementById('detail-subs');
    subContainer.innerHTML = '';
    equip.subOptions.forEach(sub => {
        const row = document.createElement('div');
        row.className = 'stats-row'; // Reuse or define
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.borderBottom = '1px solid #333';
        row.style.padding = '5px 0';

        const label = STAT_LABELS[sub.name] || sub.name;
        const valStr = sub.name.includes('percent') || sub.name.includes('rate') ? `+${sub.value}%` : `+${sub.value}`;

        row.innerHTML = `<span style="color:#ddd;">${label}</span> <span style="color:var(--accent-color);">${valStr}</span>`;
        subContainer.appendChild(row);
    });

    modal.style.display = 'block';
}



// Global Edit Function
window.editEquipment = function (equipId) {
    const equip = userEquipment.find(e => e.id === equipId);
    if (!equip) return;

    const modal = document.getElementById('equip-modal');

    // Fill Form
    document.getElementById('equip-id').value = equip.id;

    // determine category val
    let catVal = 'armor';
    if (equip.category === 'weapon') {
        catVal = equip.subType === 'magic' ? 'weapon_magic' : 'weapon_physical';
    }
    document.getElementById('equip-category').value = catVal;

    document.getElementById('equip-name').value = equip.name;
    document.getElementById('equip-set').value = equip.set;

    // Update options first to populate select
    updateOptionSelects(equip.category);

    document.getElementById('equip-main-opt').value = equip.mainOption.name;
    document.getElementById('equip-main-val').value = equip.mainOption.value;

    // Fill Sub Options
    const subSelects = document.querySelectorAll('.equip-sub-opt');
    const subVals = document.querySelectorAll('.equip-sub-val');

    // Clear first
    subSelects.forEach(s => s.value = '');
    subVals.forEach(v => v.value = '');

    equip.subOptions.forEach((sub, i) => {
        if (i < subSelects.length) {
            subSelects[i].value = sub.name;
            subVals[i].value = sub.value;
        }
    });

    document.querySelector('#equip-modal h2').innerText = '장비 수정';
    document.getElementById('btn-delete-equip').style.display = 'block';

    modal.style.display = 'block';
}
