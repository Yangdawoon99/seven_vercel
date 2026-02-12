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
    resetPinInputs();
    dom.pinArea.style.display = 'none';
}

function resetPinInputs() {
    dom.pinDigits.forEach(input => input.value = '');
    if (dom.pinDigits.length > 0) dom.pinDigits[0].focus();
    AuthState.tempPin = null;
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
            resetPinInputs();
            updatePinInstruction();
        });
    }

    // PIN Input Logic (Auto move)
    if (dom.pinDigits) {
        dom.pinDigits.forEach((input, index) => {
            input.addEventListener('input', (e) => {
                if (input.value.length === 1) {
                    if (index < 3) dom.pinDigits[index + 1].focus();
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

async function handleLoginAction() {
    const enteredPin = Array.from(dom.pinDigits).map(input => input.value).join('');
    if (enteredPin.length !== 4) {
        dom.authMsg.textContent = '4자리를 모두 입력해주세요.';
        return;
    }

    const member = AuthState.selectedMember;

    if (!member.hasPin) {
        // First Time Setup Flow
        if (!AuthState.tempPin) {
            // First entry
            AuthState.tempPin = enteredPin;
            resetPinInputs(); // Clear for confirmation
            dom.pinDigits[0].focus();
            updatePinInstruction();
            dom.authMsg.textContent = '';
        } else {
            // Confirmation entry
            if (AuthState.tempPin === enteredPin) {
                // Success! Save to DB
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
                    resetPinInputs();
                    updatePinInstruction();
                }
            } else {
                // Mismatch
                dom.authMsg.textContent = 'PIN 번호가 일치하지 않습니다. 처음부터 다시 설정하세요.';
                AuthState.tempPin = null;
                resetPinInputs();
                updatePinInstruction();
            }
        }
    } else {
        // Normal Login Flow
        try {
            // Verify PIN against DB
            const { data, error } = await supabase
                .from('guild_members')
                .select('pin_code')
                .eq('id', member.id)
                .single();

            if (error) throw error;

            if (data.pin_code === enteredPin) {
                // Login Success
                await supabase.from('guild_members').update({ last_login: new Date() }).eq('id', member.id);
                loginSuccess(member);
            } else {
                dom.authMsg.textContent = '잘못된 PIN 번호입니다.';
                dom.pinDigits.forEach(input => input.value = '');
                dom.pinDigits[0].focus();
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
    const navLinks = document.querySelectorAll('.nav-links li');
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
                'heroes': '영웅 관리',
                'equipment': '장비 보관함',
                'contents': '세팅 최적화',
                'presets': '프리셋 관리',
                'settings': '설정'
            };
            pageTitle.innerText = sectionTitles[tabName] || '매니저';

            // Show/Hide Sections
            sections.forEach(sec => sec.style.display = 'none');

            const targetSection = document.getElementById(`${tabName}-section`);
            if (targetSection) {
                targetSection.style.display = 'block';
            }
        });
    });
});
