document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. CONFIGURATION & DATA
    // ==========================================
    
    const SCHEDULE_TARGETS = [
        { id: 'jadwal-2025-10-28', start: new Date(2025, 9, 28, 7, 55, 0),  end: new Date(2025, 9, 28, 17, 0, 0) },
        { id: 'jadwal-2025-10-29', start: new Date(2025, 9, 29, 9, 55, 0),  end: new Date(2025, 9, 29, 17, 0, 0) },
        { id: 'jadwal-2025-10-30', start: new Date(2025, 9, 30, 7, 55, 0),  end: new Date(2025, 9, 30, 17, 0, 0) },
        { id: 'jadwal-2025-10-31', start: new Date(2025, 9, 31, 9, 55, 0),  end: new Date(2025, 9, 31, 17, 0, 0) },
        { id: 'jadwal-2025-11-4',  start: new Date(2025, 10, 4, 9, 55, 0),  end: new Date(2025, 10, 4, 17, 0, 0) },
        { id: 'jadwal-2025-11-5',  start: new Date(2025, 10, 5, 7, 55, 0),  end: new Date(2025, 10, 5, 17, 0, 0) },
        { id: 'jadwal-2025-11-6',  start: new Date(2025, 10, 6, 7, 55, 0),  end: new Date(2025, 10, 6, 17, 0, 0) },
        { id: 'jadwal-2025-11-7',  start: new Date(2025, 10, 7, 9, 55, 0),  end: new Date(2025, 10, 7, 17, 0, 0) },
        { id: 'jadwal-2025-11-10', start: new Date(2025, 10, 10, 13, 50, 0), end: new Date(2025, 10, 10, 17, 0, 0) },
        { id: 'jadwal-2025-12-22', start: new Date(2025, 11, 22, 9, 55, 0), end: new Date(2026, 0, 15, 17, 0, 0) }
    ];

    // ==========================================
    // 2. HELPER FUNCTIONS
    // ==========================================

    /**
     * Applies the dark or light theme to the UI.
     */
    function applyTheme(isDark) {
        const body = document.body;
        const darkIcon = document.getElementById('theme-toggle-dark-icon');
        const lightIcon = document.getElementById('theme-toggle-light-icon');
        const themeToggleBtn = document.getElementById('theme-toggle');

        if (!body || !darkIcon || !lightIcon || !themeToggleBtn) return;

        if (isDark) {
            body.classList.add('night-mode');
            darkIcon.classList.add('hidden');
            lightIcon.classList.remove('hidden');
            themeToggleBtn.classList.remove('bg-gray-200', 'text-gray-900');
            themeToggleBtn.classList.add('bg-gray-700', 'text-gray-100');
        } else {
            body.classList.remove('night-mode');
            darkIcon.classList.remove('hidden');
            lightIcon.classList.add('hidden');
            themeToggleBtn.classList.add('bg-gray-200', 'text-gray-900');
            themeToggleBtn.classList.remove('bg-gray-700', 'text-gray-100');
        }
    }

    /**
     * Updates the live clock display.
     */
    function updateClock() {
        const now = new Date();
        const timeString = [now.getHours(), now.getMinutes(), now.getSeconds()]
            .map(num => String(num).padStart(2, '0'))
            .join(':');

        const clockElement = document.getElementById('live-clock');
        if (clockElement) {
            clockElement.textContent = timeString;
        }
    }

    /**
     * Sets the formatted current date.
     */
    function setCurrentDate() {
        const now = new Date();
        const options = {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
        };
        const dateFormatter = new Intl.DateTimeFormat('id-ID', options);
        const dateElement = document.getElementById('live-date');
        
        if (dateElement) {
            dateElement.textContent = dateFormatter.format(now);
        }
    }

    /**
     * Displays greeting message based on time and auto-switches theme 
     * if user hasn't manually set a preference.
     */
    function showAffirmativeMessage() {
        const currentHour = new Date().getHours();

        // Hide all messages first
        document.querySelectorAll('#affirmative-message .time-section').forEach(section => {
            section.classList.add('hidden');
        });
        const loadingTitle = document.querySelector('#affirmative-message h2');
        if (loadingTitle) loadingTitle.classList.add('hidden');

        // Determine which message to show
        let sectionToShowId;
        if (currentHour >= 5 && currentHour < 12) sectionToShowId = 'morning-message';
        else if (currentHour >= 12 && currentHour < 17) sectionToShowId = 'afternoon-message';
        else if (currentHour >= 17 && currentHour < 21) sectionToShowId = 'evening-message';
        else sectionToShowId = 'night-message';

        const sectionToShow = document.getElementById(sectionToShowId);
        if (sectionToShow) sectionToShow.classList.remove('hidden');

        // Auto-theme logic (Only if user hasn't manually toggled)
        if (!localStorage.getItem('theme')) {
            const shouldBeDark = (currentHour >= 17 || currentHour < 5);
            applyTheme(shouldBeDark);
        }
    }

    /**
     * Shows/Hides exam schedule elements based on current time.
     */
    function showExamSchedules() {
        const now = new Date();
        let activeSchedules = 0;

        SCHEDULE_TARGETS.forEach(target => {
            const element = document.getElementById(target.id);
            if (!element) return;

            if (now >= target.start && now < target.end) {
                element.classList.remove('hidden');
                activeSchedules++;
            } else {
                element.classList.add('hidden');
            }
        });

        const placeholder = document.getElementById('jadwal-placeholder');
        if (placeholder) {
            activeSchedules === 0 
                ? placeholder.classList.remove('hidden') 
                : placeholder.classList.add('hidden');
        }
    }

    /**
     * Helper to replace https with sebs protocol
     */
    function convertToSebLink(element) {
        if (element && element.href) {
            element.href = element.href.replace("https://", "sebs://");
        }
    }

    // ==========================================
    // 3. INITIALIZATION & EVENT LISTENERS
    // ==========================================

    // A. Initialize jQuery Lightbox (if jQuery is loaded)
    if (typeof $ !== 'undefined') {
        $(document).on('click', '[data-toggle="lightbox"]', function (event) {
            event.preventDefault();
            $(this).ekkoLightbox();
        });
    }

    // B. Handle SEB Protocol Conversions
    const sebIdLink = document.getElementById("seb");
    if (sebIdLink) convertToSebLink(sebIdLink);
    
    const sebClassLinks = document.getElementsByClassName("seb");
    for (let link of sebClassLinks) {
        convertToSebLink(link);
    }

    // C. Initialize Theme State
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        applyTheme(savedTheme === 'dark');
    } else {
        // If no save, the showAffirmativeMessage function will handle time-based,
        // or we default to system preference here initially.
        // showAffirmativeMessage runs immediately after this anyway.
        applyTheme(prefersDark);
    }

    // D. Initial Function Calls
    updateClock();
    setCurrentDate();
    showAffirmativeMessage();
    showExamSchedules();

    // E. Setup Intervals
    setInterval(updateClock, 1000);
    setInterval(showAffirmativeMessage, 60000); // Check every minute
    setInterval(showExamSchedules, 1000);

    // F. Theme Toggle Button Listener
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isNowDark = !document.body.classList.contains('night-mode');
            applyTheme(isNowDark);
            localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
        });
    }

    // G. Watch System Theme Changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches);
            }
        });
    }
});