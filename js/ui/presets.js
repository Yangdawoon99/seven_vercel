import { STAT_LABELS } from '/js/utils/constants.js';
import { heroes } from '/data/heroes.js';
import { ApiService } from '/js/services/api.js';
import { userEquipment } from './equipment.js'; // Added for index lookup
import { getCurrentUserId } from '/js/services/auth.js';

export let presets = [];

export async function initPresetsUI() {
    await loadPresets();
    renderPresetList();
}

async function loadPresets() {
    try {
        const userId = getCurrentUserId();
        if (!userId) {
            presets = [];
            return;
        }

        const { data, error } = await supabase
            .from('presets')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Parse JSON data field if necessary (Supabase returns JSONB as object automatically)
        presets = data.map(p => ({
            ...p.data,
            id: p.id,
            name: p.name,
            user_id: p.user_id
        }));

    } catch (err) {
        console.error("Failed to load presets:", err);
        presets = [];
    }
}

export async function savePreset(name, heroId, weapons, armors, tag = 'PVE') {
    const userId = getCurrentUserId();
    if (!userId) {
        alert('로그인이 필요합니다.');
        return;
    }

    const newPreset = {
        id: `preset_${Date.now()}`,
        user_id: userId,
        name,
        heroId,
        tag, // PVP, PVE, Raid, etc.
        weapons: JSON.parse(JSON.stringify(weapons)), // Deep copy 
        armors: JSON.parse(JSON.stringify(armors)),
    };
    const { error } = await supabase.from('presets').insert(newPreset);
    if (error) {
        console.error('Failed to save preset:', error);
        alert('프리셋 저장 실패: ' + error.message);
        return;
    }

    presets.push(newPreset);
    renderPresetList();
}

export function renderPresetList() {
    const list = document.getElementById('preset-list');
    if (!list) return;
    list.innerHTML = '';

    if (presets.length === 0) {
        list.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">저장된 프리셋이 없습니다.</p>';
        return;
    }

    presets.forEach(preset => {
        const card = document.createElement('div');
        card.className = 'card preset-card';
        card.style.position = 'relative';
        card.style.padding = '15px';
        card.style.border = '1px solid #444';

        const hero = heroes.find(h => h.id === preset.heroId);
        const heroName = hero ? hero.name : '알 수 없음';

        const tagColors = {
            'PVP': '#ff4444',
            'PVE': '#44ff44',
            '레이드': '#ffd700',
            '쫄작': '#00d4ff'
        };
        const tagColor = tagColors[preset.tag] || '#aaa';

        const heroIconHtml = (hero && hero.icon)
            ? `<img src="${hero.icon}" style="width:30px; height:30px; border-radius:50%; margin-right:8px; vertical-align:middle;" onerror="this.style.display='none';">`
            : `<i class="fas fa-user" style="margin-right:8px;"></i>`;

        const renderItem = (item, label) => {
            if (!item) return `<div><strong>${label}:</strong> 없음</div>`;

            // Find index in userEquipment to show "No. X"
            const idx = userEquipment.findIndex(e => e.id === item.id);
            const noLabel = idx > -1 ? `<span style="background:var(--primary-color); color:white; padding:1px 5px; border-radius:3px; font-size:0.7rem; margin-right:5px; font-weight:normal;">No.${idx + 1}</span>` : '';

            return `
                <div style="cursor:pointer; color:#eee; hover:color:var(--primary);" onclick="window.showPresetItemDetail('${preset.id}', '${label}')">
                    <strong>${label}:</strong> ${noLabel}<span style="text-decoration:underline;">${item.name}</span>
                </div>
            `;
        };

        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <h4 style="color:var(--primary); margin:0;">${preset.name}</h4>
                <span style="background:${tagColor}; color:#000; padding:2px 8px; border-radius:10px; font-size:0.7em; font-weight:bold;">${preset.tag}</span>
            </div>
            <div style="font-size:0.9em; color:var(--secondary); margin-bottom:15px; font-weight:bold; display:flex; align-items:center;">
                ${heroIconHtml} 대상 영웅: ${heroName}
            </div>
            <div style="display:grid; grid-template-columns: 1fr; gap:8px; font-size:0.85em; background:rgba(0,0,0,0.2); padding:10px; border-radius:5px;">
                ${renderItem(preset.weapons[0], '무기 1')}
                ${renderItem(preset.weapons[1], '무기 2')}
                ${renderItem(preset.armors[0], '방어구 1')}
                ${renderItem(preset.armors[1], '방어구 2')}
            </div>
            <button class="btn-danger" style="position:absolute; bottom:15px; right:15px; width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:50%;" onclick="window.deletePreset('${preset.id}')">
                <i class="fas fa-trash" style="font-size:0.8em;"></i>
            </button>
        `;
        list.appendChild(card);
    });
}

window.showPresetItemDetail = (presetId, label) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    let item;
    if (label === '무기 1') item = preset.weapons[0];
    if (label === '무기 2') item = preset.weapons[1];
    if (label === '방어구 1') item = preset.armors[0];
    if (label === '방어구 2') item = preset.armors[1];

    if (item && window.showEquipDetail) {
        window.showEquipDetail(item);
    }
};

window.deletePreset = async (id) => {
    if (confirm('이 프리셋을 삭제하시겠습니까?')) {
        const { error } = await supabase.from('presets').delete().eq('id', id);
        if (error) {
            console.error('Failed to delete preset:', error);
            alert('삭제 실패: ' + error.message);
            return;
        }
        presets = presets.filter(p => p.id !== id);
        renderPresetList();
    }
};

window.applyPresetFromOptimize = (presetId) => {
    // This could optionally "equip" them to the hero in the future
    alert('프리셋이 저장되었습니다. "프리셋 관리" 탭에서 확인하세요!');
};
