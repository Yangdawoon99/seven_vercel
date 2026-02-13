import { heroes as staticHeroes } from '/data/heroes.js';
import { equipmentData } from '/data/equipment.js'; // Need options list
import { ApiService } from '/js/services/api.js';
import { STAT_LABELS } from '/js/utils/constants.js';
import { getCurrentUserId } from '/js/services/auth.js';

let heroes = []; // Local cache for efficiency

export async function initHeroesUI() {
    setupEventListeners();
    await refreshHeroesUI();
}

export async function refreshHeroesUI() {
    await loadHeroes();
    renderHeroList();
}

async function loadHeroes() {
    try {
        const userId = getCurrentUserId();
        if (!userId) {
            heroes = []; // Clear if not logged in
            return;
        }

        // Fetch using Supabase directly or via updated ApiService
        // Assuming ApiService needs update or we use direct call here for speed
        const { data, error } = await supabase
            .from('heroes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        heroes = data;

        // ... rest of logic (migration/seeding removed as DB is now source of truth)
    } catch (err) {
        console.error("Failed to load heroes:", err);
        heroes = [];
    }
}

function setupEventListeners() {
    const addHeroBtn = document.getElementById('add-hero-btn');
    const modal = document.getElementById('hero-modal');
    const closeBtn = modal.querySelector('.close-modal');
    const form = document.getElementById('hero-form');

    // Auto Match Logic
    const nameInput = document.getElementById('hero-name');
    const previewIcon = document.getElementById('hero-preview-icon');
    const typeSelect = document.getElementById('hero-type');

    nameInput.addEventListener('input', () => {
        const name = nameInput.value.trim();
        const matched = staticHeroes.find(h => h.name === name);
        if (matched) {
            previewIcon.src = matched.icon;
            previewIcon.style.display = 'block';
            if (typeSelect) typeSelect.value = matched.type;
        } else {
            previewIcon.style.display = 'none';
        }
    });

    // ... (modal open/close listeners)
    addHeroBtn.addEventListener('click', () => {
        form.reset();
        document.getElementById('hero-id').value = '';
        document.getElementById('hero-modal-title').innerText = '영웅 등록';
        document.getElementById('btn-delete-hero').style.display = 'none';
        previewIcon.style.display = 'none';
        modal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target == modal) modal.style.display = 'none'; });

    // Delete Handler
    const deleteBtn = document.getElementById('btn-delete-hero');
    deleteBtn.addEventListener('click', async () => {
        const id = document.getElementById('hero-id').value;
        if (id && confirm('정말로 이 영웅을 삭제하시겠습니까?')) {
            const index = heroes.findIndex(h => h.id === id);
            if (index > -1) {
                const { error } = await supabase.from('heroes').delete().eq('id', id);
                if (error) {
                    console.error('Failed to delete hero:', error);
                    alert('삭제 실패: ' + error.message);
                    return;
                }
                heroes.splice(index, 1);
                renderHeroList();
                modal.style.display = 'none';
                document.getElementById('hero-count').innerText = heroes.length;
            }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const idInput = document.getElementById('hero-id').value;
        const name = document.getElementById('hero-name').value;
        const type = document.getElementById('hero-type').value;

        // Auto Match Icon
        const matched = staticHeroes.find(h => h.name === name);
        const icon = matched ? matched.icon : null;

        // Capture Stats
        const stats = {
            attack: parseInt(document.getElementById('hero-atk').value) || 0,
            defense: parseInt(document.getElementById('hero-def').value) || 0,
            hp: parseInt(document.getElementById('hero-hp').value) || 0,
            speed: parseInt(document.getElementById('hero-spd').value) || 0,
            crit_rate: parseFloat(document.getElementById('hero-crit-rate').value) || 0,
            crit_damage: parseFloat(document.getElementById('hero-crit-dmg').value) || 0,
            weakness_rate: parseFloat(document.getElementById('hero-weak-rate').value) || 0,
            block_rate: parseFloat(document.getElementById('hero-block-rate').value) || 0,
            effect_hit: parseFloat(document.getElementById('hero-eff-hit').value) || 0,
            effect_resist: parseFloat(document.getElementById('hero-eff-res').value) || 0
        };

        let hero;

        if (idInput) {
            hero = heroes.find(h => h.id === idInput);
            if (hero) {
                Object.assign(hero, { name, type, stats, level: 30, icon });
                if (!hero.user_id) hero.user_id = getCurrentUserId();
            }
        } else {
            const userId = getCurrentUserId();
            if (!userId) {
                alert('로그인이 필요합니다.');
                return;
            }
            const newId = name.toLowerCase().replace(/\s/g, '_') + '_' + Date.now();
            hero = {
                id: newId,
                user_id: userId,
                name,
                type,
                level: 30,
                stats,
                icon,
                priority: []
            };
            heroes.push(hero);
        }

        const { error } = await supabase
            .from('heroes')
            .upsert(hero);

        if (error) {
            console.error('Failed to save hero:', error);
            alert('저장 실패: ' + error.message);
            return;
        }

        renderHeroList();
        modal.style.display = 'none';
        form.reset();
        document.getElementById('hero-count').innerText = heroes.length;
    });
}


// Global Edit Function
window.editHero = function (heroId) {
    const hero = heroes.find(h => h.id === heroId);
    if (!hero) return;

    document.getElementById('hero-id').value = hero.id;
    document.getElementById('hero-name').value = hero.name;
    document.getElementById('hero-type').value = hero.type;

    // Fill stats
    document.getElementById('hero-atk').value = hero.stats.attack;
    document.getElementById('hero-def').value = hero.stats.defense;
    document.getElementById('hero-hp').value = hero.stats.hp;
    document.getElementById('hero-spd').value = hero.stats.speed;
    document.getElementById('hero-crit-rate').value = hero.stats.crit_rate;
    document.getElementById('hero-crit-dmg').value = hero.stats.crit_damage;
    document.getElementById('hero-weak-rate').value = hero.stats.weakness_rate;
    document.getElementById('hero-block-rate').value = hero.stats.block_rate;
    document.getElementById('hero-eff-hit').value = hero.stats.effect_hit;
    document.getElementById('hero-eff-res').value = hero.stats.effect_resist;

    document.getElementById('hero-modal-title').innerText = '영웅 정보 수정';
    document.getElementById('btn-delete-hero').style.display = 'block';

    document.getElementById('hero-modal').style.display = 'block';
}
// Removed populatePrefSelects and window.openPrefModal as requested

function renderHeroList() {
    const list = document.getElementById('hero-list');
    list.innerHTML = '';

    heroes.forEach(hero => {
        const card = document.createElement('div');
        card.className = 'card hero-card';

        // Handle icon with fallback
        const iconSrc = hero.icon ? hero.icon : 'https://via.placeholder.com/300?text=' + hero.name[0];

        card.innerHTML = `
            <div class="hero-image-container">
                <img src="${iconSrc}" alt="${hero.name}" class="hero-avatar" onerror="this.src='https://via.placeholder.com/300?text=${hero.name[0]}'; this.onerror=null;">
                <div class="hero-image-overlay"></div>
                <button class="settings-btn" onclick="window.editHero('${hero.id}')" title="정보 수정">
                    <i class="fas fa-cog"></i>
                </button>
            </div>
            <div class="hero-info">
                <h3>${hero.name}</h3>
                <p>${hero.type === 'physical' ? '물리형' : '마법형'}</p>
                <div class="center-v">
                    <span class="level-badge">Lv.${hero.level}</span>
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    // Update dashboard count
    document.getElementById('hero-count').innerText = heroes.length;
}
