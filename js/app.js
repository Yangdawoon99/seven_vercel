
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
