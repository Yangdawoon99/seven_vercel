// Supabase Client Initialization
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import SUPABASE_CONFIG from './supabase_config.js';

const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// --- Auth State Management ---
const AuthState = {
    step: 'global', // global, member
    globalCode: 'senafinal0522',
    selectedMember: null,
    tempPin: null, // For first time setup confirmation
    currentUser: null
};

// --- DOM Elements ---
const dom = {
    lock: document.getElementById('auth-lock'),
    stepGlobal: document.getElementById('step-global-auth'),
    stepMember: document.getElementById('step-member-login'),
    globalInput: document.getElementById('global-code-input'),
    memberSelect: document.getElementById('member-select'),
    pinArea: document.getElementById('pin-area'),
    pinDigits: document.querySelectorAll('.pin-digit'),
    pinInstruction: document.getElementById('pin-instruction'),
    authMsg: document.getElementById('auth-msg'),
    loginBtn: document.getElementById('btn-login-action'),
    profileName: document.querySelector('.profile span')
};

// --- Initialization ---
(async function initAuth() {
    // Check Session
    const sessionUser = JSON.parse(localStorage.getItem('guild_user'));
    if (sessionUser) {
        AuthState.currentUser = sessionUser;
        unlockApp();
    } else {
        // Show Lock Screen
        dom.lock.style.display = 'flex';
        checkGlobalAuth();
    }

    // Load Members
    await loadMembers();

    // Event Listeners
    setupEventListeners();
})();

function checkGlobalAuth() {
    if (sessionStorage.getItem('sena_global_auth') === 'true') {
        showMemberLogin();
    } else {
        dom.stepGlobal.style.display = 'block';
        dom.stepMember.style.display = 'none';
    }
}

window.checkGlobalCode = () => {
    if (dom.globalInput.value === AuthState.globalCode) {
        sessionStorage.setItem('sena_global_auth', 'true');
        showMemberLogin();
    } else {
        alert('코드가 일치하지 않습니다.');
        dom.globalInput.value = '';
    }
};

// --- Heroes Logic ---
async function loadHeroes() {
    if (!AuthState.currentUser) {
        // If not logged in, just clear the list and return silently
        const heroList = document.getElementById('hero-list');
        if (heroList) heroList.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">로그인 후 이용 가능합니다.</p>';
        return;
    }

    // Privacy Filter: Only my heroes
    const { data, error } = await supabase
        .from('heroes')
        .select('*')
        .eq('user_id', AuthState.currentUser.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading heroes:', error);
        return;
    }

    const heroList = document.getElementById('hero-list');
    heroList.innerHTML = '';

    const heroCountEl = document.getElementById('hero-count');
    if (heroCountEl) heroCountEl.textContent = data.length || 0;

    if (data.length === 0) {
        heroList.innerHTML = '<p style="text-align:center; padding:20px; color:#888; grid-column:1/-1;">등록된 영웅이 없습니다.</p>';
        return;
    }

    data.forEach(hero => {
        const card = document.createElement('div');
        card.className = 'hero-card card';

        // Calculate total combat power (simple sum for now)
        const cp = (hero.stats.atk || 0) + (hero.stats.def || 0) + (hero.stats.hp || 0);

        card.innerHTML = `
            <div class="card-header">
                <h3>${hero.name}</h3>
                <span class="badge ${hero.type === 'physical' ? 'badge-physical' : 'badge-magic'}">${hero.type === 'physical' ? '물리' : '마법'}</span>
            </div>
            <div class="card-body">
                <div class="stat-row">
                    <span>전투력</span>
                    <strong>${cp.toLocaleString()}</strong>
                </div>
                <div class="stat-grid-mini">
                    <div><span>공</span> ${hero.stats.atk || 0}</div>
                    <div><span>방</span> ${hero.stats.def || 0}</div>
                    <div><span>생</span> ${hero.stats.hp || 0}</div>
                    <div><span>속</span> ${hero.stats.spd || 0}</div>
                </div>
            </div>
            <div class="card-actions">
                <button onclick="editHero('${hero.id}')"><i class="fas fa-edit"></i></button>
                <button onclick="deleteHero('${hero.id}')" class="btn-icon-danger"><i class="fas fa-trash"></i></button>
            </div>
        `;
        heroList.appendChild(card);
    });
}

// ... inside hero form submit ...
const heroData = {
    user_id: AuthState.selectedMember.id, // Bind to current user
    name: name,
    type: type,
    stats: stats
};

// --- Equipment Logic ---
async function loadEquipments() {
    if (!AuthState.currentUser) {
        const equipList = document.getElementById('equip-list');
        if (equipList) equipList.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">로그인 후 이용 가능합니다.</p>';
        return;
    }

    const { data, error } = await supabase
        .from('equipments')
        .select('*')
        .eq('user_id', AuthState.currentUser.id) // Only my equipment
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading equipment:', error);
        return;
    }

    const equipList = document.getElementById('equip-list');
    equipList.innerHTML = '';

    const equipCountEl = document.getElementById('equip-count');
    if (equipCountEl) equipCountEl.textContent = data.length || 0;

    if (data.length === 0) {
        equipList.innerHTML = '<p style="text-align:center; padding:20px; color:#888; grid-column:1/-1;">등록된 장비가 없습니다.</p>';
        return;
    }

    data.forEach(equip => {
        const card = document.createElement('div');
        card.className = 'equip-card card';

        // Determine Icon
        let icon = 'fa-khanda';
        if (equip.category === 'armor') icon = 'fa-shield-alt';
        else if (equip.category === 'weapon_magic') icon = 'fa-magic';

        // Main Stat Display
        let mainStatText = '';
        if (equip.main_option) {
            const mKey = Object.keys(equip.main_option)[0];
            mainStatText = `${mKey} +${equip.main_option[mKey]}`;
        }

        card.innerHTML = `
            <div class="equip-icon ${equip.category}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="equip-info">
                <h4>${equip.name}</h4>
                <p class="set-name">${equip.set_option || '세트 없음'}</p>
                <p class="main-stat">${mainStatText}</p>
            </div>
            <div class="equip-actions">
                <button onclick="deleteEquipment('${equip.id}')" class="btn-icon-danger"><i class="fas fa-trash"></i></button>
            </div>
            <div class="equip-detail-overlay" onclick="viewEquipDetail('${equip.id}')"></div>
        `;
        equipList.appendChild(card);
    });
}

// ... inside equipment form submit ...
const equipData = {
    user_id: AuthState.selectedMember.id, // Bind to current user
    name: name,
    category: category,
    set_option: setOption,
    main_option: mainOpt,
    sub_options: subOpts
};

async function loadMembers() {
    try {
        const { data, error } = await supabase
            .from('guild_members')
            .select('nickname, id, pin_code')
            .order('nickname');

        if (error) throw error;

        dom.memberSelect.innerHTML = '<option value="">본인의 닉네임을 선택하세요</option>';
        data.forEach(member => {
            const option = document.createElement('option');
            option.value = member.id;
            // Display only
            option.textContent = member.nickname;
            // Store PIN existence status (secure enough for this context)
            option.dataset.hasPin = !!member.pin_code;
            dom.memberSelect.appendChild(option);
        });
    } catch (e) {
        console.error('Failed to load members:', e);
        // Fallback or error handling
    }
}

function showMemberLogin() {
    dom.stepGlobal.style.display = 'none';
    dom.stepMember.style.display = 'block';

    // Reset PIN state
    resetPinInputs(true);
    dom.pinArea.style.display = 'none';
}

function resetPinInputs(clearState = false) {
    dom.pinDigits.forEach(input => input.value = '');
    if (dom.pinDigits.length > 0) dom.pinDigits[0].focus();
    if (clearState) AuthState.tempPin = null;
}

function setupEventListeners() {
    // Member Select Change
    if (dom.memberSelect) {
        dom.memberSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.selectedOptions[0];
            if (!selectedOption.value) {
                dom.pinArea.style.display = 'none';
                return;
            }

            AuthState.selectedMember = {
                id: selectedOption.value,
                nickname: selectedOption.textContent,
                hasPin: selectedOption.dataset.hasPin === 'true'
            };

            dom.pinArea.style.display = 'block';
            resetPinInputs(true); // Clear state when switching user
            updatePinInstruction();
        });
    }

    // PIN Input Logic (Auto move & Auto Submit)
    if (dom.pinDigits) {
        dom.pinDigits.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (input.value.length === 1) {
                    if (index < 3) {
                        dom.pinDigits[index + 1].focus();
                    } else {
                        // All 4 digits entered, try submit automatically
                        handleLoginAction();
                    }
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Backspace' && !input.value && index > 0) {
                    dom.pinDigits[index - 1].focus();
                }
                if (e.key === 'Enter' && index === 3) {
                    handleLoginAction();
                }
            });
        });
    }

    // Login Button
    if (dom.loginBtn) {
        dom.loginBtn.addEventListener('click', handleLoginAction);
    }
}

function updatePinInstruction() {
    const member = AuthState.selectedMember;
    if (!member) return;

    if (!member.hasPin) {
        // First Time Setup
        if (!AuthState.tempPin) {
            dom.pinInstruction.textContent = "최초 접속입니다. 사용할 PIN 4자리를 입력하세요.";
            dom.loginBtn.textContent = "다음 (확인)";
        } else {
            dom.pinInstruction.textContent = "확인을 위해 PIN 4자리를 한번 더 입력하세요.";
            dom.loginBtn.textContent = "설정 완료 및 로그인";
        }
    } else {
        // Normal Login
        dom.pinInstruction.textContent = "PIN 번호 4자리를 입력하세요.";
        dom.loginBtn.textContent = "로그인";
    }

    if (dom.authMsg) dom.authMsg.textContent = '';
}

const MAX_FAIL_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

async function handleLoginAction() {
    const enteredPin = Array.from(dom.pinDigits).map(input => input.value).join('');
    if (enteredPin.length !== 4) {
        return;
    }

    const member = AuthState.selectedMember;

    // Check Lockout Status
    const lockKey = `lock_${member.id}`;
    const failKey = `fail_${member.id}`;
    const lockUntil = parseInt(localStorage.getItem(lockKey) || '0');

    if (Date.now() < lockUntil) {
        const remainingMin = Math.ceil((lockUntil - Date.now()) / 60000);
        dom.authMsg.textContent = `비밀번호 오류 과다. ${remainingMin}분 후 재시도 가능합니다.`;
        resetPinInputs(false);
        return;
    }

    if (!member.hasPin) {
        // First Time Setup Flow (No lockout needed for setup)
        if (!AuthState.tempPin) {
            AuthState.tempPin = enteredPin;
            dom.pinDigits.forEach(input => input.value = '');
            dom.pinDigits[0].focus();
            updatePinInstruction();
            dom.authMsg.textContent = '';
        } else {
            if (AuthState.tempPin === enteredPin) {
                try {
                    const { error } = await supabase
                        .from('guild_members')
                        .update({ pin_code: enteredPin, last_login: new Date() })
                        .eq('id', member.id);

                    if (error) throw error;

                    alert('PIN 설정이 완료되었습니다.');
                    loginSuccess(member);
                } catch (e) {
                    dom.authMsg.textContent = '저장 실패: ' + e.message;
                    AuthState.tempPin = null;
                    resetPinInputs(true);
                    updatePinInstruction();
                }
            } else {
                dom.authMsg.textContent = 'PIN 번호가 일치하지 않습니다. 처음부터 다시 설정하세요.';
                AuthState.tempPin = null;
                resetPinInputs(true);
                updatePinInstruction();
            }
        }
    } else {
        // Normal Login Flow
        try {
            const { data, error } = await supabase
                .from('guild_members')
                .select('pin_code')
                .eq('id', member.id)
                .single();

            if (error) throw error;

            if (data.pin_code === enteredPin) {
                // Success - Reset Fail Count
                localStorage.removeItem(failKey);
                localStorage.removeItem(lockKey);

                await supabase.from('guild_members').update({ last_login: new Date() }).eq('id', member.id);
                loginSuccess(member);
            } else {
                // Fail - Increment Count
                const currentFail = parseInt(localStorage.getItem(failKey) || '0') + 1;
                localStorage.setItem(failKey, currentFail);

                if (currentFail >= MAX_FAIL_ATTEMPTS) {
                    localStorage.setItem(lockKey, Date.now() + LOCKOUT_DURATION_MS);
                    dom.authMsg.textContent = `5회 오류! 5분간 로그인이 제한됩니다.`;
                } else {
                    dom.authMsg.textContent = `잘못된 PIN 번호입니다. (${currentFail}/${MAX_FAIL_ATTEMPTS})`;
                }

                resetPinInputs(false);
            }
        } catch (e) {
            dom.authMsg.textContent = '로그인 오류: ' + e.message;
        }
    }
}

function loginSuccess(member) {
    localStorage.setItem('guild_user', JSON.stringify(member));
    AuthState.currentUser = member;
    unlockApp();
}

function unlockApp() {
    dom.lock.style.opacity = '0';
    setTimeout(() => dom.lock.style.display = 'none', 300);
    if (dom.profileName && AuthState.currentUser) {
        dom.profileName.textContent = AuthState.currentUser.nickname;
    }
}

// Global reset function
window.logout = () => {
    localStorage.removeItem('guild_user');
    sessionStorage.removeItem('sena_global_auth');
    location.reload();
};

import { initHeroesUI } from './ui/heroes.js';
import { initEquipmentUI } from './ui/equipment.js';
import { initContentsUI } from './ui/contents.js';
import { initPresetsUI } from './ui/presets.js';
import { initHelpUI } from './ui/help.js';

// App Entry Point
document.addEventListener('DOMContentLoaded', async () => {
    // Auth is now handled inline in index.html for maximum reliability

    console.log("Sena-Re Gear Manager Initialized with DB Backend");

    // Initialize Sub-modules (awaiting async setup)
    await initHeroesUI();
    await initEquipmentUI();
    await initContentsUI();
    await initPresetsUI();
    initHelpUI();

    // Navigation Logic
    const navLinks = document.querySelectorAll('.nav-links li[data-tab]');
    const sections = document.querySelectorAll('.section');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            // Remove active class from all nav items
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active to clicked nav item
            link.classList.add('active');

            // Get target tab
            const tabName = link.getAttribute('data-tab');

            // Update Title
            const sectionTitles = {
                'dashboard': '대시보드',
                'guild-war': '길드전',
                'total-war': '총력전',
                'heroes': '영웅 관리',
                'equipment': '장비 보관함',
                'contents': '세팅 최적화',
                'presets': '프리셋 관리',
                'preset-share': '프리셋 공유',
                'settings': '설정'
            };
            pageTitle.innerText = sectionTitles[tabName] || '매니저';

            // Show/Hide Sections
            sections.forEach(sec => sec.style.display = 'none');

            const targetSection = document.getElementById(`${tabName}-section`);
            if (targetSection) {
                targetSection.style.display = 'block';
            } else {
                // Placeholder for missing sections
                // Create a temporary placeholder if section doesn't exist
                let placeholder = document.getElementById('placeholder-section');
                if (!placeholder) {
                    placeholder = document.createElement('div');
                    placeholder.id = 'placeholder-section';
                    placeholder.className = 'section';
                    placeholder.innerHTML = `
                        <div class="card" style="text-align:center; padding:50px;">
                            <i class="fas fa-tools" style="font-size:3rem; color:var(--text-muted); margin-bottom:20px;"></i>
                            <h2 style="color:var(--text-main);">준비 중인 기능입니다.</h2>
                            <p style="color:var(--text-sub);">추후 업데이트될 예정입니다.</p>
                        </div>
                    `;
                    document.getElementById('content-area').appendChild(placeholder);
                }
                placeholder.style.display = 'block';
            }
        });
    });
});
