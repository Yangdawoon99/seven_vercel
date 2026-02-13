import { heroes as staticHeroes } from '../../data/heroes.js';

let strategies = [];
let currentGwTab = 'attack'; // 'attack' or 'defense'

function getHeroIcon(name) {
    if (!name) return null;
    const hero = staticHeroes.find(h => h.name === name);
    return hero ? hero.icon : null;
}

function getCurrentUserId() {
    const u = JSON.parse(localStorage.getItem('guild_user'));
    return u ? u.id : null;
}

// ── Init ──
export async function initGuildWarUI() {
    document.getElementById('gw-add-btn')?.addEventListener('click', () => openStrategyEditor());
    document.getElementById('gw-search')?.addEventListener('input', renderStrategies);
    document.getElementById('gw-cancel-btn')?.addEventListener('click', closeEditor);
    document.getElementById('gw-save-btn')?.addEventListener('click', saveStrategy);

    // Sub-tab switching
    document.querySelectorAll('.gw-sub-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.gw-sub-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentGwTab = tab.getAttribute('data-gw-tab') || 'attack';
            refreshGuildWarUI();
        });
    });
}

export async function refreshGuildWarUI() {
    await loadStrategies();
    renderStrategies();
}

// ── Data ──
async function loadStrategies() {
    const { data, error } = await window.supabase
        .from('guild_war_strategies')
        .select('*')
        .eq('strategy_type', currentGwTab)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('Failed to load strategies:', error);
        strategies = [];
        return;
    }
    strategies = data || [];
}

// ── Render ──
function renderStrategies() {
    const list = document.getElementById('gw-strategy-list');
    if (!list) return;

    const search = (document.getElementById('gw-search')?.value || '').toLowerCase();
    list.innerHTML = '';

    // Group by enemy deck (normalized)
    const groups = {};
    strategies.forEach(s => {
        // Filter empty strings out for the key
        const heroes = (s.enemy_heroes || []).filter(h => h && h !== 'undefined');
        const key = heroes.sort().join('+') + (s.enemy_alt ? `/${s.enemy_alt}` : '') + `|${s.speed || 0}`;

        if (!groups[key]) groups[key] = {
            enemy: s.enemy_heroes,
            alt: s.enemy_alt,
            speed: s.speed || 0,
            counters: [],
            isExpanded: false
        };
        groups[key].counters.push(s);
    });

    const filteredGroups = Object.values(groups).filter(g => {
        if (!search) return true;
        const allNames = [...g.enemy, ...g.counters.flatMap(c => c.counter_heroes)];
        if (g.alt) allNames.push(g.alt);
        return allNames.some(n => n && n.toLowerCase().includes(search));
    });

    if (filteredGroups.length === 0) {
        list.innerHTML = `<div class="gw-empty"><i class="fas fa-shield-halved"></i><p>등록된 전략이 없습니다.<br>상단의 "전략 추가" 버튼을 눌러 시작하세요.</p></div>`;
        return;
    }

    filteredGroups.forEach((group, gIdx) => {
        // Sort counters by latest first
        group.counters.sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at);
            const dateB = new Date(b.updated_at || b.created_at);
            return dateB - dateA;
        });

        const groupEl = document.createElement('div');
        groupEl.className = 'gw-group';
        groupEl.dataset.key = gIdx;

        // Enemy Preview (Grid Card Content)
        // Compact Hero Preview
        const eBack = group.enemy.slice(0, 3);
        const eFront = group.enemy.slice(3, 6);
        const groupHeader = document.createElement('div');
        groupHeader.className = 'gw-enemy-card-header';

        groupHeader.innerHTML = `
            <div class="gw-speed-badge"><i class="fas fa-bolt"></i> ${group.speed}</div>
            <div class="gw-enemy-deck-preview">
                <div class="gw-deck-row">${eBack.map(name => renderHeroSlot(name, true)).join('')}</div>
                <div class="gw-deck-row">${eFront.map(name => renderHeroSlot(name, true)).join('')}</div>
            </div>
            <div class="gw-enemy-info">
                <div class="gw-count-badge">공략 ${group.counters.length}개</div>
                ${group.alt ? `<span class="gw-alt-text">or ${group.alt}</span>` : ''}
            </div>
        `;
        groupEl.appendChild(groupHeader);

        // Click to expand
        groupHeader.onclick = () => {
            // Close others? Optional. For now let's toggle.
            // If we want Grid-friendly logic: one expanded at a time often works best for layout
            const wasExpanded = groupEl.classList.contains('expanded');
            document.querySelectorAll('.gw-group.expanded').forEach(el => el.classList.remove('expanded'));

            if (!wasExpanded) {
                groupEl.classList.add('expanded');
                // Scroll into view?
                setTimeout(() => groupEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            }
        };

        // Counters List Container
        const countersList = document.createElement('div');
        countersList.className = 'gw-counters-list';

        group.counters.forEach((counter) => {
            const card = document.createElement('div');
            card.className = 'gw-counter-item';

            const cBack = counter.counter_heroes.slice(0, 3);
            const cFront = counter.counter_heroes.slice(3, 6);

            const equipHtml = (counter.equipment || []).map(eq =>
                `<span class="gw-equip-tag"><b>${eq.hero}</b> ${eq.set} ${eq.stats}</span>`
            ).join('');

            const dateStr = counter.updated_at ? new Date(counter.updated_at).toLocaleString() : new Date(counter.created_at).toLocaleString();

            card.innerHTML = `
                ${counter.title ? `<div class="gw-strategy-title">🎯 ${counter.title}</div>` : ''}
                <div class="gw-vs-layout">
                    <div class="gw-side gw-side-counter">
                        <div class="gw-side-label">상성 공략덱</div>
                        <div class="gw-deck-icons">
                            <div class="gw-deck-row">${cBack.map(name => renderHeroSlot(name)).join('')}</div>
                            <div class="gw-deck-row">${cFront.map(name => renderHeroSlot(name)).join('')}</div>
                        </div>
                    </div>
                     <div class="gw-meta">
                        <div class="gw-meta-row">
                            ${counter.skill_order ? `<span><i class="fas fa-list-ol"></i> ${counter.skill_order}</span>` : ''}
                        </div>
                        ${equipHtml ? `<div class="gw-meta-row"><i class="fas fa-shield-alt"></i>${equipHtml}</div>` : ''}
                        ${counter.pet ? `<div class="gw-meta-row"><i class="fas fa-paw"></i><span>펫: ${counter.pet}</span></div>` : ''}
                        ${counter.note ? `<div class="gw-meta-row gw-note"><i class="fas fa-info-circle"></i><span>${counter.note}</span></div>` : ''}
                        <div class="gw-meta-row author-info">
                            <i class="fas fa-user-edit"></i>
                            <span>${counter.author_name || '익명'} (${dateStr})</span>
                        </div>
                    </div>
                </div>
                <div class="gw-card-actions">
                    <button class="gw-edit-btn" onclick="window.gwEditStrategy('${counter.id}')"><i class="fas fa-pen"></i> 수정</button>
                    <button class="gw-delete-btn" onclick="window.gwDeleteStrategy('${counter.id}')"><i class="fas fa-trash"></i> 삭제</button>
                </div>
            `;
            countersList.appendChild(card);
        });

        groupEl.appendChild(countersList);
        list.appendChild(groupEl);
    });
}

function renderHeroSlot(name, isCompact = false) {
    const compactClass = isCompact ? 'compact' : '';
    if (!name || name === 'undefined') {
        return `<div class="gw-hero-slot empty ${compactClass}">
            <i class="fas fa-plus"></i>
        </div>`;
    }
    const icon = getHeroIcon(name);
    if (icon) {
        return `<div class="gw-hero-slot filled ${compactClass}" title="${name}">
            <img src="${icon}" alt="${name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <span class="gw-hero-fallback" style="display:none;">${name[0]}</span>
            ${!isCompact ? `<span class="gw-hero-name">${name}</span>` : ''}
        </div>`;
    }
    return `<div class="gw-hero-slot filled ${compactClass}" title="${name}">
        <span class="gw-hero-fallback">${name[0]}</span>
        ${!isCompact ? `<span class="gw-hero-name">${name}</span>` : ''}
    </div>`;
}

// ── Editor Modal ──
let editingId = null;
let editorSlots = { enemy: Array(6).fill(null), counter: Array(6).fill(null) };
let currentPickerTarget = null; // { side: 'enemy'|'counter', index: 0-5 }

function openStrategyEditor(id) {
    editingId = id || null;
    editorSlots = { enemy: Array(6).fill(null), counter: Array(6).fill(null) };

    if (id) {
        const s = strategies.find(s => s.id === id);
        if (s) {
            editorSlots.enemy = [...(s.enemy_heroes || []), ...Array(6).fill(null)].slice(0, 6);
            editorSlots.counter = [...(s.counter_heroes || []), ...Array(6).fill(null)].slice(0, 6);
            document.getElementById('gw-skill-order').value = s.skill_order || '';
            document.getElementById('gw-equipment').value = (s.equipment || []).map(e => `${e.hero} ${e.set} ${e.stats}`).join('\n');
            document.getElementById('gw-pet').value = s.pet || '';
            document.getElementById('gw-note').value = s.note || '';
            document.getElementById('gw-enemy-alt').value = s.enemy_alt || '';
            document.getElementById('gw-speed').value = s.speed || 0;
            document.getElementById('gw-title').value = s.title || '';
        }
    } else {
        document.getElementById('gw-skill-order').value = '';
        document.getElementById('gw-equipment').value = '';
        document.getElementById('gw-pet').value = '';
        document.getElementById('gw-note').value = '';
        document.getElementById('gw-enemy-alt').value = '';
        document.getElementById('gw-speed').value = 0;
        document.getElementById('gw-title').value = '';
    }

    renderEditorSlots();
    document.getElementById('gw-editor-modal').style.display = 'block';
    document.getElementById('gw-editor-title').textContent = id ? '전략 수정' : '전략 추가';
}

function closeEditor() {
    document.getElementById('gw-editor-modal').style.display = 'none';
    editingId = null;
}

function renderEditorSlots() {
    ['enemy', 'counter'].forEach(side => {
        for (let i = 0; i < 6; i++) {
            const slotEl = document.getElementById(`gw-slot-${side}-${i}`);
            if (!slotEl) continue;
            const name = editorSlots[side][i];
            if (name) {
                const icon = getHeroIcon(name);
                slotEl.innerHTML = icon
                    ? `<img src="${icon}" alt="${name}"><span>${name}</span><button class="gw-slot-clear" onclick="window.gwClearSlot('${side}',${i})">×</button>`
                    : `<span class="gw-slot-text">${name}</span><button class="gw-slot-clear" onclick="window.gwClearSlot('${side}',${i})">×</button>`;
                slotEl.classList.add('filled');
            } else {
                slotEl.innerHTML = `<i class="fas fa-plus"></i>`;
                slotEl.classList.remove('filled');
            }
        }
    });
}

function openHeroPicker(side, index) {
    currentPickerTarget = { side, index };
    const modal = document.getElementById('gw-picker-modal');
    const list = document.getElementById('gw-picker-list');
    const search = document.getElementById('gw-picker-search');

    if (search) search.value = '';
    renderPickerGrid('');
    modal.style.display = 'block';

    search?.addEventListener('input', () => renderPickerGrid(search.value));
}

function renderPickerGrid(searchTerm) {
    const list = document.getElementById('gw-picker-list');
    if (!list) return;

    const filtered = staticHeroes.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()));
    list.innerHTML = '';

    filtered.forEach(hero => {
        const item = document.createElement('div');
        item.className = 'book-item';
        item.onclick = () => selectHeroForSlot(hero.name);
        item.innerHTML = `
            <img src="${hero.icon}" alt="${hero.name}">
            <h4>${hero.name}</h4>
        `;
        list.appendChild(item);
    });
}

function selectHeroForSlot(name) {
    if (!currentPickerTarget) return;
    editorSlots[currentPickerTarget.side][currentPickerTarget.index] = name;
    renderEditorSlots();
    document.getElementById('gw-picker-modal').style.display = 'none';
    currentPickerTarget = null;
}

// ── Save ──
async function saveStrategy() {
    const enemyHeroes = editorSlots.enemy.map(v => v || ''); // Keep empty strings for slots
    const counterHeroes = editorSlots.counter.map(v => v || '');

    if (enemyHeroes.every(v => !v) || counterHeroes.every(v => !v)) {
        alert('상대 팀과 상성 덱에 각각 최소 1명의 영웅을 배치해주세요.');
        return;
    }

    const equipText = document.getElementById('gw-equipment').value.trim();
    const equipment = equipText ? equipText.split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return { hero: parts[0] || '', set: parts[1] || '', stats: parts.slice(2).join(' ') };
    }) : [];

    const user = JSON.parse(localStorage.getItem('guild_user')) || {};
    const authorName = user.nickname || '익명';

    const payload = {
        strategy_type: currentGwTab,
        enemy_heroes: enemyHeroes,
        enemy_alt: document.getElementById('gw-enemy-alt').value.trim() || null,
        counter_heroes: counterHeroes,
        skill_order: document.getElementById('gw-skill-order').value.trim() || null,
        equipment: equipment,
        pet: document.getElementById('gw-pet').value.trim() || null,
        note: document.getElementById('gw-note').value.trim() || null,
        speed: parseInt(document.getElementById('gw-speed').value) || 0,
        title: document.getElementById('gw-title').value.trim() || null,
        author_name: authorName,
        updated_at: new Date().toISOString()
    };

    let error;
    if (editingId) {
        ({ error } = await window.supabase.from('guild_war_strategies').update(payload).eq('id', editingId));
    } else {
        ({ error } = await window.supabase.from('guild_war_strategies').insert(payload));
    }

    if (error) {
        alert('저장 실패: ' + error.message);
        console.error(error);
        return;
    }

    closeEditor();
    await refreshGuildWarUI();
}

// ── Delete ──
async function deleteStrategy(id) {
    if (!confirm('이 전략을 삭제하시겠습니까?')) return;

    const { error } = await window.supabase.from('guild_war_strategies').delete().eq('id', id);
    if (error) {
        alert('삭제 실패: ' + error.message);
        return;
    }
    await refreshGuildWarUI();
}

// ── Global Bindings ──
window.gwEditStrategy = (id) => openStrategyEditor(id);
window.gwDeleteStrategy = (id) => deleteStrategy(id);
window.gwClearSlot = (side, index) => {
    editorSlots[side][index] = null;
    renderEditorSlots();
};
window.gwOpenPicker = (side, index) => openHeroPicker(side, index);
