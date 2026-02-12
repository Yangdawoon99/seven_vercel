
import { initHeroesUI } from './ui/heroes.js';
import { initEquipmentUI } from './ui/equipment.js';
import { initContentsUI } from './ui/contents.js';
import { initPresetsUI } from './ui/presets.js';
import { initHelpUI } from './ui/help.js';

// App Entry Point
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Simple Access Authentication
    const AUTH_CODE = 'senafinal0522';

    // Check session first
    if (sessionStorage.getItem('sena_auth') !== 'true') {
        const userInput = window.prompt("인증 코드를 입력하세요:");

        if (userInput === AUTH_CODE) {
            sessionStorage.setItem('sena_auth', 'true');
        } else {
            alert("인증에 실패했습니다. 올바른 사용자만 접근 가능합니다.");
            document.body.innerHTML = "<h1 style='color:white; text-align:center; margin-top:100px;'>Access Denied.</h1>";
            return; // Stop initialization
        }
    }

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
            pageTitle.innerText = sectionTitles[tabName];

            // Show/Hide Sections
            sections.forEach(sec => sec.style.display = 'none');

            const targetSection = document.getElementById(`${tabName}-section`);
            if (targetSection) {
                targetSection.style.display = 'block';
            } else {
                // Temporary for unimplemented sections
                console.log(`Section ${tabName} not implemented yet`);
            }
        });
    });
});
