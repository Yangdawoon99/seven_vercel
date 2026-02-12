import { ApiService } from '/js/services/api.js';
import { contents } from '/data/contents.js';
import { optimizeEquipment } from '/js/core/optimizer.js';
import { STAT_LABELS } from '/js/utils/constants.js';
import { savePreset } from './presets.js';
import { userEquipment } from './equipment.js';
import { getCurrentUserId } from '/js/services/auth.js';

let heroes = [];

export async function initContentsUI() {
    try {
        const userId = getCurrentUserId();
        if (userId) {
            const { data, error } = await supabase
                .from('heroes')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (!error) heroes = data;
        }
    } catch (e) {
        console.error("ContentsUI: Failed to fetch heroes", e);
    }

    const heroSelect = document.getElementById('opt-hero-select');
    const optimizeBtn = document.getElementById('optimize-btn');
    const priorityContainer = document.getElementById('priority-list-container');
    const addPriorityBtn = document.getElementById('add-priority-btn');

    const pModal = document.getElementById('priority-modal');
    const pClose = pModal.querySelector('.close-modal');
    const pConfirm = document.getElementById('p-confirm-btn');
    const pTypeSelect = document.getElementById('p-type-select');
    const pValGroup = document.getElementById('p-val-group');

    let selectedPriorities = [];

    // Populate Hero Select
    function populateHeroes() {
        if (!heroSelect) return;
        heroSelect.innerHTML = '<option value="">영웅을 선택하세요</option>';
        heroes.forEach(h => {
            const option = document.createElement('option');
            option.value = h.id;
            option.innerText = h.name;
            heroSelect.appendChild(option);
        });
    }

    populateHeroes();

    // Modal Handling
    if (addPriorityBtn) {
        addPriorityBtn.addEventListener('click', () => {
            if (selectedPriorities.length >= 4) {
                alert('최대 4개까지만 조건 추가가 가능합니다.');
                return;
            }
            pModal.style.display = 'block';
        });
    }

    if (pClose) pClose.addEventListener('click', () => pModal.style.display = 'none');

    if (pTypeSelect) {
        pTypeSelect.addEventListener('change', () => {
            pValGroup.style.display = pTypeSelect.value === 'min' ? 'block' : 'none';
        });
    }

    if (pConfirm) {
        pConfirm.addEventListener('click', () => {
            const stat = document.getElementById('p-stat-select').value;
            const type = pTypeSelect.value;
            const val = parseFloat(document.getElementById('p-val-input').value) || 0;

            // Check duplicate
            if (selectedPriorities.find(p => p.stat === stat)) {
                alert('이미 같은 스탯의 조건이 존재합니다.');
                return;
            }

            selectedPriorities.push({ stat, type, value: val });
            renderPriorityTags();
            pModal.style.display = 'none';

            // Reset modal inputs
            document.getElementById('p-val-input').value = '';
        });
    }

    function renderPriorityTags() {
        if (!priorityContainer) return;
        priorityContainer.innerHTML = '';
        selectedPriorities.forEach((p, index) => {
            const tag = document.createElement('div');
            tag.className = 'priority-tag';

            const label = STAT_LABELS[p.stat] || p.stat;
            const typeStr = p.type === 'max' ? '최대화' : `${p.value} 이상`;

            tag.innerHTML = `
                <span><strong>${label}</strong>: ${typeStr}</span>
                <i class="fas fa-times-circle" onclick="window.removePriorityCondition(${index})"></i>
            `;
            priorityContainer.appendChild(tag);
        });
    }

    window.removePriorityCondition = (index) => {
        selectedPriorities.splice(index, 1);
        renderPriorityTags();
    };

    if (optimizeBtn) {
        optimizeBtn.addEventListener('click', () => {
            const heroId = heroSelect.value;
            if (!heroId) {
                alert('영웅을 먼저 선택해주세요!');
                return;
            }

            const forceSet = document.getElementById('opt-force-set').checked;
            const hero = heroes.find(h => h.id === heroId);

            // Pass the dynamic priorities
            const result = optimizeEquipment(hero, null, selectedPriorities, forceSet);
            renderOptimizationResult(result);
        });
    }
}



function renderOptimizationResult(result) {
    const area = document.getElementById('opt-results-area');
    if (!area) return;
    area.innerHTML = '';

    if (!result) {
        area.innerHTML = '<p style="text-align:center; color:#888;">최적화 결과가 없습니다.</p>';
        return;
    }

    const hero = result.hero;

    // Calculate Total Stats (Base + Equipment)
    const totalStats = { ...hero.stats };

    const allEquip = [...result.weapons, ...result.armors];
    allEquip.forEach(eq => {
        if (!eq) return;
        // Main Opt
        const main = eq.mainOption;
        totalStats[main.name] = (totalStats[main.name] || 0) + main.value;

        // Sub Opts
        eq.subOptions.forEach(sub => {
            totalStats[sub.name] = (totalStats[sub.name] || 0) + sub.value;
        });
    });

    // Render HTML
    const card = document.createElement('div');
    card.className = 'card result-card';
    card.innerHTML = `
        <div class="result-header" style="text-align:center; margin-bottom:20px;">
            <h3 style="color:var(--primary-color); font-size:1.5rem;">${hero.name} 최적 세팅</h3>
            <span style="color:#888;">${hero.type === 'physical' ? '물리 공격형' : '마법 공격형'}</span>
        </div>

        <div class="total-stats-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; background:rgba(0,0,0,0.3); padding:15px; border-radius:8px; margin-bottom:20px;">
            ${Object.entries(totalStats).map(([key, val]) => {
        if (val === 0 || !STAT_LABELS[key]) return '';
        const isPercent = key.includes('rate') || key.includes('percent') || key.includes('hit') || key.includes('resist');
        const valStr = isPercent ? `${val.toFixed(1)}%` : val;
        const isBoosted = val > (hero.stats[key] || 0);
        const color = isBoosted ? 'var(--accent-color)' : '#eee';
        return `<div><span style="color:#aaa;">${STAT_LABELS[key]}</span>: <span style="color:${color}; font-weight:bold;">${valStr}</span></div>`;
    }).join('')}
        </div>

        <div class="equip-slots" style="margin-bottom: 20px;">
            <h4 style="border-bottom:1px solid #444; padding-bottom:5px; margin-bottom:10px;"><i class="fas fa-khanda"></i> 무기 (2)</h4>
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                ${renderEquipSlot(result.weapons[0])}
                ${renderEquipSlot(result.weapons[1])}
            </div>

            <h4 style="border-bottom:1px solid #444; padding-bottom:5px; margin-bottom:10px;"><i class="fas fa-shield-alt"></i> 방어구 (2)</h4>
            <div style="display:flex; gap:10px;">
                ${renderEquipSlot(result.armors[0])}
                ${renderEquipSlot(result.armors[1])}
            </div>
        </div>
        
        <button id="save-preset-btn" class="btn-primary" style="width:100%;"><i class="fas fa-save"></i> 프리셋으로 저장</button>
    `;

    area.appendChild(card);

    document.getElementById('save-preset-btn').onclick = async () => {
        const pName = prompt('프리셋 이름을 입력하세요:', `${hero.name} 최적화 세트`);
        if (!pName) return;

        const pTag = prompt('용도를 입력하세요 (PVP, PVE, 레이드, 쫄작):', 'PVE');
        if (pName) {
            await savePreset(pName, hero.id, result.weapons, result.armors, pTag || 'PVE');
            alert('프리셋이 저장되었습니다! 프리셋 관리 메뉴에서 확인하세요.');
        }
    };
}

function renderEquipSlot(equip) {
    if (!equip) {
        return `
        <div class="equip-slot-empty" style="flex:1; background:#222; padding:15px; border-radius:5px; text-align:center; color:#555;">
            장비 없음
        </div>`;
    }

    // Find index in userEquipment to show "No. X"
    const idx = userEquipment.findIndex(e => e.id === equip.id);
    const noLabel = idx > -1 ? `<span style="background:var(--primary-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-right:5px;">No.${idx + 1}</span>` : '';

    return `
    <div class="equip-slot-filled" onclick="window.showEquipDetail('${equip.id}')" 
         style="flex:1; background:#333; padding:10px; border-radius:5px; cursor:pointer; border:1px solid #444; transition:all 0.2s;">
        <div style="font-size:0.9em; margin-bottom:5px;">${noLabel} <span style="color:var(--accent-color);">${equip.name}</span></div>
        <div style="font-size:0.8em; color:#aaa;">${STAT_LABELS[equip.mainOption.name]} +${equip.mainOption.value}</div>
    </div>`;
}
