// Cognify Public Web Application Engine
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Lucide Icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // 2. Navigation State & View Router
    const views = ['home', 'rankings', 'tests', 'plan', 'admin', 'exam-mode'];
    let currentClassTab = 'SY';
    let currentRankingsPageTab = 'SY';

    function switchView(targetView) {
        if (!views.includes(targetView)) targetView = 'home';

        // If target is admin, check if authenticated
        if (targetView === 'admin') {
            checkAdminStatus().then(isAdmin => {
                if (isAdmin) {
                    activateView('admin');
                    if (window.loadAdminDashboard) window.loadAdminDashboard();
                } else {
                    openAdminAuthModal();
                }
            });
            return;
        }

        activateView(targetView);
    }

    function activateView(viewName) {
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const targetSec = document.getElementById(`view-${viewName}`);
        if (targetSec) targetSec.classList.add('active');

        // Update nav item active states
        document.querySelectorAll('.desktop-nav .nav-link, .bottom-nav-item').forEach(link => {
            if (link.dataset.view === viewName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Trigger view-specific data loading
        if (viewName === 'home') loadHomeView();
        else if (viewName === 'rankings') loadRankingsView(currentRankingsPageTab);
        else if (viewName === 'tests') loadTestsView();
        else if (viewName === 'plan') loadPlanView();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Handle hash route changes & clicks
    function handleHashChange() {
        const hash = window.location.hash.replace('#', '') || 'home';
        switchView(hash);
    }

    window.addEventListener('hashchange', handleHashChange);

    // Attach click listeners to all nav links
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const v = btn.dataset.view;
            if (v) {
                window.location.hash = v;
            }
        });
    });

    // Brand link
    const brandLink = document.getElementById('brandLink');
    if (brandLink) {
        brandLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = 'home';
        });
    }

    // Hero CTA
    const heroCtaBtn = document.getElementById('heroCtaBtn');
    if (heroCtaBtn) {
        heroCtaBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.hash = 'rankings';
        });
    }

    // 3. Admin Authentication Modal Logic
    const adminModal = document.getElementById('adminAuthModal');
    const openAdminBtns = [document.getElementById('openAdminModalBtn'), document.getElementById('openAdminModalBtnMobile')];
    const closeAdminBtn = document.getElementById('closeAdminAuthModalBtn');
    const cancelAdminBtn = document.getElementById('cancelAdminAuthBtn');
    const adminAuthForm = document.getElementById('adminAuthForm');
    const adminPasswordInput = document.getElementById('adminPasswordInput');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const adminAuthError = document.getElementById('adminAuthError');

    function openAdminAuthModal() {
        if (adminAuthError) adminAuthError.classList.add('hidden');
        if (adminPasswordInput) adminPasswordInput.value = '';
        if (adminModal) adminModal.classList.remove('hidden');
    }

    function closeAdminAuthModal() {
        if (adminModal) adminModal.classList.add('hidden');
    }

    openAdminBtns.forEach(btn => {
        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('admin');
        });
    });

    if (closeAdminBtn) closeAdminBtn.addEventListener('click', closeAdminAuthModal);
    if (cancelAdminBtn) cancelAdminBtn.addEventListener('click', closeAdminAuthModal);

    // Toggle Password Visibility
    if (togglePasswordBtn && adminPasswordInput) {
        togglePasswordBtn.addEventListener('click', () => {
            const type = adminPasswordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            adminPasswordInput.setAttribute('type', type);
            const icon = togglePasswordBtn.querySelector('i');
            if (icon) {
                icon.setAttribute('data-lucide', type === 'password' ? 'eye' : 'eye-off');
                if (window.lucide) window.lucide.createIcons();
            }
        });
    }

    // Submit Auth Form
    if (adminAuthForm) {
        adminAuthForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = adminPasswordInput.value;
            if (!password) return;

            try {
                const res = await fetch('/api/admin/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    closeAdminAuthModal();
                    window.location.hash = 'admin';
                    activateView('admin');
                    if (window.loadAdminDashboard) window.loadAdminDashboard();
                } else {
                    if (adminAuthError) {
                        adminAuthError.textContent = data.error || 'Incorrect password. Please try again.';
                        adminAuthError.classList.remove('hidden');
                    }
                }
            } catch (err) {
                if (adminAuthError) {
                    adminAuthError.textContent = 'Server connection error. Please try again.';
                    adminAuthError.classList.remove('hidden');
                }
            }
        });
    }

    async function checkAdminStatus() {
        try {
            const res = await fetch('/api/admin/status');
            const data = await res.json();
            return data.authenticated === true;
        } catch {
            return false;
        }
    }

    // 4. HOME VIEW DATA LOADERS
    function loadHomeView() {
        loadTop10Rankings(currentClassTab);
        loadTimeline();
        loadCurrentTestPrep();
        loadHomeSemesterPlan();
    }

    // Home Leaderboard Class Segmented Controls
    document.querySelectorAll('#homeRankingsBlock .segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#homeRankingsBlock .segmented-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentClassTab = btn.dataset.tab;
            loadTop10Rankings(currentClassTab);
        });
    });

    // Date Formatting Utilities (DD/MM/YY & DD/MM/YY, h:mm A)
    function formatDisplayDate(dateStr) {
        if (!dateStr) return '--';
        const str = String(dateStr).split('T')[0];
        const parts = str.split(/[-/]/);
        if (parts.length === 3) {
            let year, month, day;
            if (parts[0].length === 4) { // YYYY-MM-DD
                year = parts[0].slice(-2);
                month = parts[1].padStart(2, '0');
                day = parts[2].padStart(2, '0');
            } else {
                day = parts[0].padStart(2, '0');
                month = parts[1].padStart(2, '0');
                year = parts[2].slice(-2);
            }
            return `${day}/${month}/${year}`;
        }
        const dt = new Date(dateStr);
        if (!isNaN(dt)) {
            const d = String(dt.getDate()).padStart(2, '0');
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const y = String(dt.getFullYear()).slice(-2);
            return `${d}/${m}/${y}`;
        }
        return dateStr;
    }

    function formatDisplayTimestamp(isoStr) {
        if (!isoStr) return 'Loading...';
        const dt = new Date(isoStr);
        if (isNaN(dt)) return isoStr;
        const d = String(dt.getDate()).padStart(2, '0');
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const y = String(dt.getFullYear()).slice(-2);
        const timeStr = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${d}/${m}/${y}, ${timeStr}`;
    }

    async function loadTop10Rankings(className) {
        const container = document.getElementById('homeLeaderboardContainer');
        const tsBadge = document.getElementById('rankingsLastUpdated');
        if (!container) return;

        container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Loading rankings...</div>`;

        try {
            const res = await fetch('/api/public/rankings');
            const data = await res.json();

            if (tsBadge && data.last_updated) {
                tsBadge.innerHTML = `<i data-lucide="clock"></i> Last updated: ${formatDisplayTimestamp(data.last_updated)}`;
            }

            const classData = (data.rankings && data.rankings[className]) ? data.rankings[className] : [];

            if (classData.length === 0) {
                container.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--text-muted);">No rankings calculated yet for ${className}.</div>`;
                return;
            }

            let html = `
                <table class="ranking-table">
                    <thead>
                        <tr>
                            <th style="width: 70px;">Rank</th>
                            <th>Student</th>
                            <th style="width: 100px;">Roll No</th>
                            <th style="text-align: right; width: 120px;">Cognify Score</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            classData.forEach(item => {
                let rankBadgeClass = '';
                if (item.rank === 1) rankBadgeClass = 'rank-top-1';
                else if (item.rank === 2) rankBadgeClass = 'rank-top-2';
                else if (item.rank === 3) rankBadgeClass = 'rank-top-3';

                html += `
                    <tr>
                        <td>
                            <span class="rank-badge ${rankBadgeClass}">${item.rank}</span>
                        </td>
                        <td style="font-weight: 600;">${escapeHtml(item.name)}</td>
                        <td style="color: var(--text-muted); font-size: 13px;">${escapeHtml(item.roll_no)}</td>
                        <td style="text-align: right;" class="score-cell">${item.cognify_score}%</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--accent-rose);">Failed to load rankings.</div>`;
        }
    }

    async function loadTimeline() {
        const grid = document.getElementById('testTimelineGrid');
        if (!grid) return;

        try {
            const res = await fetch('/api/public/timeline');
            const data = await res.json();

            grid.innerHTML = '';
            const items = [
                { key: 'previous', label: 'Previous Test', defaultTagClass: 'tag-completed' },
                { key: 'current', label: 'Current Test', defaultTagClass: 'tag-current' },
                { key: 'next', label: 'Next Test', defaultTagClass: 'tag-upcoming' }
            ];

            items.forEach(item => {
                const t = data[item.key];
                if (!t) {
                    grid.innerHTML += `
                        <div class="timeline-card">
                            <div class="timeline-header">
                                <span class="timeline-tag ${item.defaultTagClass}">${item.label}</span>
                            </div>
                            <h3 class="timeline-title">None Scheduled</h3>
                            <p class="timeline-date">--</p>
                        </div>
                    `;
                    return;
                }

                let badgeText = item.label;
                let badgeClass = item.defaultTagClass;
                let ctaButtonHtml = '';
                let scheduleDetailText = `Starts: ${t.test_date}, ${t.start_time || '10:00 AM'}`;

                if (t.availability_state === 'BEFORE_START') {
                    badgeText = 'Test Not Started';
                    badgeClass = 'tag-upcoming';
                    scheduleDetailText = `Starts: ${t.test_date}, ${t.start_time || '10:00 AM'}`;
                    ctaButtonHtml = `
                        <button type="button" class="btn btn-secondary btn-sm" disabled style="opacity: 0.6; cursor: not-allowed;" title="Test has not started yet">
                            <i data-lucide="clock"></i> Not Started
                        </button>
                    `;
                } else if (t.availability_state === 'ACTIVE') {
                    badgeText = 'Test Active';
                    badgeClass = 'tag-current';
                    scheduleDetailText = `Ends: ${t.test_date}, ${t.finish_time || '11:00 AM'}`;
                    ctaButtonHtml = `
                        <button type="button" class="btn btn-primary btn-sm" onclick="startExamFlow(${t.id}, '${escapeHtml(t.test_name)}', '${escapeHtml(t.test_number)}')" style="margin-right: 6px;">
                            <i data-lucide="play"></i> Take Test
                        </button>
                    `;
                } else if (t.availability_state === 'AFTER_FINISH') {
                    badgeText = 'Test Closed';
                    badgeClass = 'tag-completed';
                    scheduleDetailText = `This test is no longer accepting submissions.`;
                    ctaButtonHtml = `
                        <button type="button" class="btn btn-secondary btn-sm" disabled style="opacity: 0.6; cursor: not-allowed;" title="Submission window closed">
                            <i data-lucide="lock"></i> Test Closed
                        </button>
                    `;
                }

                grid.innerHTML += `
                    <div class="timeline-card ${item.key === 'current' ? 'current-card' : ''}">
                        <div class="timeline-header">
                            <span class="timeline-tag ${badgeClass}">${badgeText}</span>
                            <span style="font-size: 12px; color: var(--text-muted);">${t.test_number}</span>
                        </div>
                        <h3 class="timeline-title">${escapeHtml(t.test_name)}</h3>
                        <p class="timeline-date"><i data-lucide="calendar" style="width: 14px; height: 14px; display: inline;"></i> ${t.test_date} (${t.start_time || '10:00 AM'} → ${t.finish_time || '11:00 AM'})</p>
                        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">${scheduleDetailText}</p>
                        <div>
                            ${ctaButtonHtml}
                            <a href="#currentPrepBlock" class="btn btn-secondary btn-sm" onclick="event.preventDefault(); document.getElementById('currentPrepBlock').scrollIntoView({behavior: 'smooth'});">
                                <i data-lucide="book-open"></i> Syllabus
                            </a>
                        </div>
                    </div>
                `;
            });

            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            grid.innerHTML = `<div style="color: var(--text-muted);">Failed to load timeline.</div>`;
        }
    }

    async function loadCurrentTestPrep() {
        const container = document.getElementById('currentPrepContent');
        const subTitle = document.getElementById('currentTestSubTitle');
        if (!container) return;

        try {
            const res = await fetch('/api/public/current-test');
            const data = await res.json();

            if (!data || !data.id) {
                container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px;">No test is currently marked as Active/Current by administrators.</div>`;
                return;
            }

            if (subTitle) {
                subTitle.textContent = `${data.test_number}: ${data.test_name} (${data.test_date})`;
            }

            let html = '';

            // Availability Status Banner
            if (data.availability_state === 'BEFORE_START') {
                html += `
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; color: #FCD34D;">
                        <strong style="font-size: 15px;">Test Not Started</strong><br>
                        <span style="font-size: 13px;">Starts: ${data.test_date}, ${data.start_time || '10:00 AM'}</span>
                    </div>
                `;
            } else if (data.availability_state === 'ACTIVE') {
                html += `
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; color: var(--accent-emerald); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <strong style="font-size: 15px;">Test Active</strong><br>
                            <span style="font-size: 13px;">Ends: ${data.test_date}, ${data.finish_time || '11:00 AM'}</span>
                        </div>
                        <button type="button" class="btn btn-primary" onclick="startExamFlow(${data.id}, '${escapeHtml(data.test_name)}', '${escapeHtml(data.test_number)}')">
                            <i data-lucide="play"></i> Take Test
                        </button>
                    </div>
                `;
            } else if (data.availability_state === 'AFTER_FINISH') {
                html += `
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 14px 18px; border-radius: var(--radius-md); margin-bottom: 20px; color: #FCA5A5;">
                        <strong style="font-size: 15px;">Test Closed</strong><br>
                        <span style="font-size: 13px;">This test is no longer accepting submissions.</span>
                    </div>
                `;
            }

            // Categories
            if (data.categories && data.categories.length > 0) {
                data.categories.forEach(cat => {
                    html += `
                        <div class="syllabus-category">
                            <h4 class="cat-title"><i data-lucide="bookmark" style="width: 16px; height: 16px; display: inline;"></i> ${escapeHtml(cat.category_name)}</h4>
                            <ul class="topic-list">
                    `;
                    cat.topics.forEach(tp => {
                        html += `<li class="topic-item"><i data-lucide="check-circle-2" style="width: 14px; height: 14px; color: var(--accent-emerald);"></i> ${escapeHtml(tp)}</li>`;
                    });
                    html += `</ul></div>`;
                });
            } else {
                html += `<div style="color: var(--text-muted); margin-bottom: 16px;">Syllabus topics coming soon.</div>`;
            }

            // Resource Links
            html += `<div class="resource-pills">`;

            // Notes
            if (data.resources && data.resources.notes) {
                html += `
                    <a href="${data.resources.notes.file_path}" target="_blank" class="resource-pill">
                        <i data-lucide="file-text" style="color: var(--accent-primary);"></i> Download Notes
                    </a>
                `;
            } else {
                html += `
                    <span class="resource-pill disabled">
                        <i data-lucide="clock"></i> Notes coming soon
                    </span>
                `;
            }

            // Practice
            if (data.resources && data.resources.practice) {
                html += `
                    <a href="${data.resources.practice.file_path}" target="_blank" class="resource-pill">
                        <i data-lucide="help-circle" style="color: var(--accent-purple);"></i> Practice Questions
                    </a>
                `;
            } else {
                html += `
                    <span class="resource-pill disabled">
                        <i data-lucide="clock"></i> Practice questions coming soon
                    </span>
                `;
            }

            // Question Paper & Answer Key (Visible ONLY when Current Time >= Finish Time AND Admin status == Completed)
            if (data.resources && data.resources.question_paper) {
                html += `
                    <a href="${data.resources.question_paper.file_path}" target="_blank" class="resource-pill" style="border-color: var(--accent-primary);">
                        <i data-lucide="file-check" style="color: var(--accent-sky);"></i> Question Paper
                    </a>
                `;
            }
            if (data.resources && data.resources.answer_key) {
                html += `
                    <a href="${data.resources.answer_key.file_path}" target="_blank" class="resource-pill" style="border-color: var(--accent-emerald);">
                        <i data-lucide="key" style="color: var(--accent-emerald);"></i> Answer Key
                    </a>
                `;
            }

            html += `</div>`;
            container.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            container.innerHTML = `<div style="color: var(--text-muted);">Failed to load preparation details.</div>`;
        }
    }

    async function loadHomeSemesterPlan() {
        const container = document.getElementById('homeSemesterPlanContainer');
        if (!container) return;

        try {
            const res = await fetch('/api/public/plan');
            const data = await res.json();

            container.innerHTML = renderPlanListHtml(data);
            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            container.innerHTML = `<div style="color: var(--text-muted);">Failed to load semester plan.</div>`;
        }
    }

    // 5. RANKINGS PAGE VIEW
    document.querySelectorAll('#view-rankings .segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#view-rankings .segmented-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRankingsPageTab = btn.dataset.rankingsTab;
            loadRankingsView(currentRankingsPageTab);
        });
    });

    async function loadRankingsView(className) {
        const container = document.getElementById('fullRankingsContainer');
        if (!container) return;

        container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Loading full ${className} rankings...</div>`;

        try {
            const res = await fetch(`/api/public/rankings/${className}`);
            const data = await res.json();
            const list = data.rankings || [];

            if (list.length === 0) {
                container.innerHTML = `<div style="padding: 32px; text-align: center; color: var(--text-muted);">No student standings found for ${className}.</div>`;
                return;
            }

            let html = `
                <table class="ranking-table">
                    <thead>
                        <tr>
                            <th style="width: 70px;">Rank</th>
                            <th>Student Name</th>
                            <th style="text-align: right; width: 140px;">Cognify Score</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            list.forEach(item => {
                let rankBadgeClass = '';
                if (item.rank === 1) rankBadgeClass = 'rank-top-1';
                else if (item.rank === 2) rankBadgeClass = 'rank-top-2';
                else if (item.rank === 3) rankBadgeClass = 'rank-top-3';

                html += `
                    <tr>
                        <td>
                            <span class="rank-badge ${rankBadgeClass}">${item.rank}</span>
                        </td>
                        <td style="font-weight: 600;">${escapeHtml(item.name)}</td>
                        <td style="text-align: right;" class="score-cell">${item.cognify_score}%</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;

        } catch (err) {
            container.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--accent-rose);">Failed to load rankings.</div>`;
        }
    }

    // 6. TESTS ARCHIVE VIEW
    async function loadTestsView() {
        const container = document.getElementById('testArchiveGrid');
        if (!container) return;

        try {
            const res = await fetch('/api/public/plan');
            const data = await res.json();

            if (data.length === 0) {
                container.innerHTML = `<div style="color: var(--text-muted);">No tests archived yet.</div>`;
                return;
            }

            let html = '';
            data.forEach(t => {
                let tagClass = 'tag-upcoming';
                if (t.status === 'Completed') tagClass = 'tag-completed';
                else if (t.status === 'Current') tagClass = 'tag-current';

                html += `
                    <div class="plan-card">
                        <div class="plan-card-header">
                            <div>
                                <span class="timeline-tag ${tagClass}">${t.status}</span>
                                <h3 style="font-size: 18px; margin-top: 6px;">${t.test_number}: ${escapeHtml(t.test_name)}</h3>
                            </div>
                            <span style="font-size: 13px; color: var(--text-muted);">${formatDisplayDate(t.test_date)}</span>
                        </div>

                        <div class="resource-pills margin-top-sm">
                            ${t.notes ? `<a href="${t.notes.file_path}" target="_blank" class="resource-pill"><i data-lucide="file-text"></i> Notes</a>` : `<span class="resource-pill disabled">Notes coming soon</span>`}
                            ${t.practice ? `<a href="${t.practice.file_path}" target="_blank" class="resource-pill"><i data-lucide="help-circle"></i> Practice</a>` : `<span class="resource-pill disabled">Practice coming soon</span>`}
                            
                            ${t.status === 'Completed' ? (
                                `${t.question_paper ? `<a href="${t.question_paper.file_path}" target="_blank" class="resource-pill" style="border-color: var(--accent-primary);"><i data-lucide="file-check"></i> Question Paper</a>` : `<span class="resource-pill disabled">Question Paper N/A</span>`}
                                 ${t.answer_key ? `<a href="${t.answer_key.file_path}" target="_blank" class="resource-pill" style="border-color: var(--accent-emerald);"><i data-lucide="key"></i> Answer Key</a>` : `<span class="resource-pill disabled">Answer Key N/A</span>`}`
                            ) : ''}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            container.innerHTML = `<div style="color: var(--text-muted);">Failed to load test archive.</div>`;
        }
    }

    // 7. PLAN PAGE VIEW
    async function loadPlanView() {
        const container = document.getElementById('fullSemesterPlanContainer');
        if (!container) return;

        try {
            const res = await fetch('/api/public/plan');
            const data = await res.json();

            container.innerHTML = renderPlanListHtml(data);
            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            container.innerHTML = `<div style="color: var(--text-muted);">Failed to load semester plan.</div>`;
        }
    }

    function renderPlanListHtml(planData) {
        if (!planData || planData.length === 0) {
            return `<div style="color: var(--text-muted); padding: 24px; text-align: center;">No semester tests published.</div>`;
        }

        let html = '';
        planData.forEach(t => {
            let tagClass = 'tag-upcoming';
            if (t.status === 'Completed') tagClass = 'tag-completed';
            else if (t.status === 'Current') tagClass = 'tag-current';

            html += `
                <div class="plan-card">
                    <div class="plan-card-header">
                        <div>
                            <span class="timeline-tag ${tagClass}">${t.status}</span>
                            <h3 style="font-size: 18px; margin-top: 6px;">${t.test_number}: ${escapeHtml(t.test_name)}</h3>
                            <span style="font-size: 13px; color: var(--text-muted);">Total Marks: ${t.total_marks}</span>
                        </div>
                        <span style="font-size: 13px; font-weight: 600; color: var(--accent-sky);">${formatDisplayDate(t.test_date)}</span>
                    </div>

                    ${t.categories && t.categories.length > 0 ? `
                        <div style="margin-top: 12px; font-size: 13px;">
                            <strong>Syllabus:</strong>
                            <ul style="padding-left: 20px; color: var(--text-secondary); margin-top: 4px;">
                                ${t.categories.map(c => `<li>${escapeHtml(c.category_name)}: ${c.topics.join(', ')}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <div class="resource-pills margin-top-sm">
                        ${t.notes ? `<a href="${t.notes.file_path}" target="_blank" class="resource-pill"><i data-lucide="file-text"></i> Notes</a>` : `<span class="resource-pill disabled">Notes coming soon</span>`}
                        ${t.practice ? `<a href="${t.practice.file_path}" target="_blank" class="resource-pill"><i data-lucide="help-circle"></i> Practice</a>` : `<span class="resource-pill disabled">Practice coming soon</span>`}
                        
                        ${t.status === 'Completed' ? (
                            `${t.question_paper ? `<a href="${t.question_paper.file_path}" target="_blank" class="resource-pill"><i data-lucide="file-check"></i> Paper</a>` : `<span class="resource-pill disabled">Paper N/A</span>`}
                             ${t.answer_key ? `<a href="${t.answer_key.file_path}" target="_blank" class="resource-pill"><i data-lucide="key"></i> Key</a>` : `<span class="resource-pill disabled">Key N/A</span>`}`
                        ) : ''}
                    </div>
                </div>
            `;
        });
        return html;
    }


    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // --- EXAM MODE ENGINE ---
    let examState = {
        testId: null,
        testName: '',
        testNumber: '',
        registrationNo: '',
        student: null,
        attemptId: null,
        questions: [],
        currentQIdx: 0,
        savedAnswers: {},
        violationCount: 0,
        timerInterval: null,
        durationSecondsRemaining: 0,
        isExamActive: false
    };

    window.startExamFlow = function(testId, testName, testNumber) {
        examState = {
            testId,
            testName,
            testNumber,
            registrationNo: '',
            student: null,
            attemptId: null,
            questions: [],
            currentQIdx: 0,
            savedAnswers: {},
            violationCount: 0,
            timerInterval: null,
            durationSecondsRemaining: 0,
            isExamActive: false
        };

        const titleEl = document.getElementById('examTestHeaderTitle');
        const subEl = document.getElementById('examTestHeaderSub');
        const regInput = document.getElementById('examRegInput');
        const regError = document.getElementById('examRegError');
        const identityCard = document.getElementById('studentIdentityCard');
        const verifyBtn = document.getElementById('verifyRegBtn');
        const startBtn = document.getElementById('startExamBtn');

        if (titleEl) titleEl.textContent = `${testNumber}: ${testName}`;
        if (subEl) subEl.textContent = 'Please enter your Registration Number to begin Exam Mode.';
        if (regInput) { regInput.value = ''; regInput.disabled = false; }
        if (regError) regError.classList.add('hidden');
        if (identityCard) identityCard.classList.add('hidden');
        if (verifyBtn) verifyBtn.classList.remove('hidden');
        if (startBtn) startBtn.classList.add('hidden');

        document.getElementById('examRegistrationCard')?.classList.remove('hidden');
        document.getElementById('activeExamInterface')?.classList.add('hidden');
        document.getElementById('examCompletionCard')?.classList.add('hidden');

        window.location.hash = 'exam-mode';
        switchView('exam-mode');
    };

    const cancelExamBtn = document.getElementById('cancelExamBtn');
    if (cancelExamBtn) cancelExamBtn.addEventListener('click', () => {
        window.location.hash = 'home';
    });

    const studentVerifyForm = document.getElementById('studentVerifyForm');
    if (studentVerifyForm) {
        studentVerifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const regInput = document.getElementById('examRegInput');
            const regError = document.getElementById('examRegError');
            const identityCard = document.getElementById('studentIdentityCard');
            const verifyBtn = document.getElementById('verifyRegBtn');
            const startBtn = document.getElementById('startExamBtn');

            const regNo = regInput ? regInput.value.trim().toUpperCase() : '';
            if (!regNo || !examState.testId) return;

            if (regError) regError.classList.add('hidden');

            try {
                const res = await fetch('/api/student/verify-registration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ registration_no: regNo, test_id: examState.testId })
                });

                const data = await res.json();
                if (!res.ok || !data.valid) {
                    if (regError) {
                        regError.textContent = data.error || 'Invalid Registration Number.';
                        regError.classList.remove('hidden');
                    }
                    return;
                }

                if (data.already_submitted) {
                    if (regError) {
                        regError.innerHTML = `<strong>Test Already Submitted:</strong> A response for this registration number (${regNo}) has already been recorded.`;
                        regError.classList.remove('hidden');
                    }
                    return;
                }

                // Student verified successfully
                examState.registrationNo = regNo;
                examState.student = data.student;

                document.getElementById('studentIdentityName').textContent = data.student.name;
                document.getElementById('studentIdentityRoll').textContent = data.student.roll_no;
                document.getElementById('studentIdentityClass').textContent = data.student.class_name;

                regInput.disabled = true;
                if (identityCard) identityCard.classList.remove('hidden');
                if (verifyBtn) verifyBtn.classList.add('hidden');
                if (startBtn) startBtn.classList.remove('hidden');

            } catch (err) {
                if (regError) {
                    regError.textContent = 'Network error verifying registration.';
                    regError.classList.remove('hidden');
                }
            }
        });
    }

    const startExamBtn = document.getElementById('startExamBtn');
    if (startExamBtn) {
        startExamBtn.addEventListener('click', async () => {
            if (!examState.registrationNo || !examState.testId) return;

            try {
                // Request browser fullscreen
                try {
                    if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                    }
                } catch (e) {
                    console.log("Fullscreen request bypassed/rejected by browser");
                }

                const res = await fetch('/api/student/start-attempt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ registration_no: examState.registrationNo, test_id: examState.testId })
                });

                const data = await res.json();
                if (!res.ok) {
                    alert(data.error || data.message || 'Failed starting test attempt.');
                    return;
                }

                examState.attemptId = data.attempt_id;
                examState.questions = data.questions || [];
                examState.savedAnswers = data.saved_answers || {};
                examState.violationCount = data.violation_count || 0;
                examState.currentQIdx = 0;
                examState.isExamActive = true;
                examState.durationSecondsRemaining = typeof data.test.remaining_seconds === 'number' ? data.test.remaining_seconds : (data.test.duration_minutes || 60) * 60;

                // Setup active interface UI
                document.getElementById('examTestNumberTag').textContent = data.test.test_number;
                document.getElementById('examTestNameTitle').textContent = data.test.test_name;

                document.getElementById('examRegistrationCard')?.classList.add('hidden');
                document.getElementById('activeExamInterface')?.classList.remove('hidden');

                // Start timer
                startTimerCountdown();

                // Render first question & navigator
                renderCurrentQuestion();
                renderQuestionNavigator();

                // Lock Navigation bar
                toggleCognifyNavigation(false);

                // Listen for Fullscreen exits
                document.addEventListener('fullscreenchange', handleFullscreenChange);
                document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

            } catch (err) {
                alert('Server error starting test attempt.');
            }
        });
    }

    function toggleCognifyNavigation(show) {
        const topNav = document.querySelector('.navbar-top');
        const bottomNav = document.querySelector('.navbar-bottom');
        const footer = document.querySelector('.site-footer');

        if (topNav) topNav.style.display = show ? '' : 'none';
        if (bottomNav) bottomNav.style.display = show ? '' : 'none';
        if (footer) footer.style.display = show ? '' : 'none';
    }

    function startTimerCountdown() {
        if (examState.timerInterval) clearInterval(examState.timerInterval);
        const timerEl = document.getElementById('examCountdownTimer');

        function updateDisplay() {
            if (!timerEl) return;
            const hrs = Math.floor(examState.durationSecondsRemaining / 3600);
            const mins = Math.floor((examState.durationSecondsRemaining % 3600) / 60);
            const secs = examState.durationSecondsRemaining % 60;

            const hStr = String(hrs).padStart(2, '0');
            const mStr = String(mins).padStart(2, '0');
            const sStr = String(secs).padStart(2, '0');

            timerEl.textContent = `${hStr}:${mStr}:${sStr}`;
        }

        updateDisplay();
        examState.timerInterval = setInterval(() => {
            if (!examState.isExamActive) return;
            examState.durationSecondsRemaining--;
            if (examState.durationSecondsRemaining <= 0) {
                clearInterval(examState.timerInterval);
                submitStudentExam(true); // Auto-submit when time expires
            } else {
                updateDisplay();
            }
        }, 1000);
    }

    function renderCurrentQuestion() {
        if (examState.questions.length === 0) return;

        const q = examState.questions[examState.currentQIdx];
        document.getElementById('examQuestionBadge').textContent = `Question ${examState.currentQIdx + 1} of ${examState.questions.length}`;
        document.getElementById('examQuestionMarks').textContent = `${q.marks} Mark${q.marks > 1 ? 's' : ''}`;
        document.getElementById('examQuestionPrompt').textContent = q.question_text;

        const optionsList = document.getElementById('examOptionsList');
        if (!optionsList) return;

        const currentSaved = examState.savedAnswers[q.id] || '';

        const options = [
            { letter: 'A', text: q.option_a },
            { letter: 'B', text: q.option_b },
            { letter: 'C', text: q.option_c },
            { letter: 'D', text: q.option_d }
        ];

        let html = '';
        options.forEach(opt => {
            const isSelected = (currentSaved === opt.letter);
            html += `
                <div class="exam-option-card ${isSelected ? 'selected' : ''}" onclick="selectExamOption(${q.id}, '${opt.letter}')">
                    <div class="opt-letter-pill">${opt.letter}</div>
                    <div style="font-weight: 500; font-size: 15px;">${escapeHtml(opt.text)}</div>
                </div>
            `;
        });
        optionsList.innerHTML = html;

        // Nav buttons state
        const prevBtn = document.getElementById('examPrevBtn');
        const nextBtn = document.getElementById('examNextBtn');

        if (prevBtn) prevBtn.disabled = (examState.currentQIdx === 0);
        if (nextBtn) {
            if (examState.currentQIdx === examState.questions.length - 1) {
                nextBtn.innerHTML = `Review Submission <i data-lucide="check-circle"></i>`;
            } else {
                nextBtn.innerHTML = `Next <i data-lucide="chevron-right"></i>`;
            }
            if (window.lucide) window.lucide.createIcons();
        }
    }

    window.selectExamOption = function(questionId, selectedOpt) {
        if (!examState.isExamActive) return;

        // Save locally immediately
        examState.savedAnswers[questionId] = selectedOpt;
        renderCurrentQuestion();
        renderQuestionNavigator();

        // Continuous Answer Saving to Backend
        fetch('/api/student/save-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attempt_id: examState.attemptId,
                question_id: questionId,
                selected_option: selectedOpt
            })
        }).then(async res => {
            const data = await res.json();
            if (data.expired) {
                terminateStudentExam(data.error || 'Test Closed. The configured Finish Time deadline has passed.');
            }
        }).catch(err => console.log("Temporary save error:", err));
    };

    function renderQuestionNavigator() {
        const grid = document.getElementById('questionNavGrid');
        if (!grid) return;

        let html = '';
        examState.questions.forEach((q, idx) => {
            const isAnswered = !!examState.savedAnswers[q.id];
            const isCurrent = (idx === examState.currentQIdx);

            let cls = 'q-nav-btn';
            if (isAnswered) cls += ' answered';
            if (isCurrent) cls += ' current';

            html += `<button type="button" class="${cls}" onclick="jumpToQuestion(${idx})">${idx + 1}</button>`;
        });
        grid.innerHTML = html;
    }

    window.jumpToQuestion = function(idx) {
        if (idx >= 0 && idx < examState.questions.length) {
            examState.currentQIdx = idx;
            renderCurrentQuestion();
            renderQuestionNavigator();
        }
    };

    const examPrevBtn = document.getElementById('examPrevBtn');
    const examNextBtn = document.getElementById('examNextBtn');

    if (examPrevBtn) examPrevBtn.addEventListener('click', () => jumpToQuestion(examState.currentQIdx - 1));
    if (examNextBtn) {
        examNextBtn.addEventListener('click', () => {
            if (examState.currentQIdx === examState.questions.length - 1) {
                openReviewSubmissionModal();
            } else {
                jumpToQuestion(examState.currentQIdx + 1);
            }
        });
    }

    function openReviewSubmissionModal() {
        const modal = document.getElementById('reviewSubmissionModal');
        if (!modal) return;

        const totalQ = examState.questions.length;
        let answeredCount = 0;
        let html = '';

        examState.questions.forEach((q, idx) => {
            const selOpt = examState.savedAnswers[q.id];
            if (selOpt) answeredCount++;

            let selBadge = selOpt
                ? `<span class="timeline-tag tag-completed" style="font-weight: 700;">Option ${escapeHtml(selOpt)}</span>`
                : `<span class="timeline-tag" style="background: rgba(245, 158, 11, 0.2); color: #FCD34D;">Not Answered</span>`;

            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--accent-sky);">Q${idx + 1}</td>
                    <td style="font-size: 13px;">${escapeHtml(q.question_text)}</td>
                    <td style="text-align: right;">${selBadge}</td>
                </tr>
            `;
        });

        document.getElementById('reviewTotalQCount').textContent = totalQ;
        document.getElementById('reviewAnsweredCount').textContent = answeredCount;
        document.getElementById('reviewUnansweredCount').textContent = totalQ - answeredCount;
        document.getElementById('reviewSubmissionTbody').innerHTML = html;

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    const reviewBackToTestBtn = document.getElementById('reviewBackToTestBtn');
    const reviewSubmitTestBtn = document.getElementById('reviewSubmitTestBtn');

    if (reviewBackToTestBtn) {
        reviewBackToTestBtn.addEventListener('click', () => {
            document.getElementById('reviewSubmissionModal')?.classList.add('hidden');
        });
    }

    if (reviewSubmitTestBtn) {
        reviewSubmitTestBtn.addEventListener('click', () => {
            document.getElementById('reviewSubmissionModal')?.classList.add('hidden');
            submitStudentExam(false);
        });
    }

    // Fullscreen Exit Violation Handling
    async function handleFullscreenChange() {
        if (!examState.isExamActive) return;

        const isFullscreenNow = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (!isFullscreenNow) {
            try {
                const res = await fetch('/api/student/log-violation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        attempt_id: examState.attemptId,
                        reason: 'Browser left fullscreen mode'
                    })
                });

                const data = await res.json();
                examState.violationCount = data.violation_count;

                if (data.terminated) {
                    terminateStudentExam(data.message);
                } else {
                    showFullscreenWarning(data.violation_count);
                }
            } catch (err) {
                console.error("Violation logging error", err);
            }
        }
    }

    function showFullscreenWarning(count) {
        const warningModal = document.getElementById('fullscreenWarningModal');
        const countText = document.getElementById('warningViolationCountText');

        if (countText) countText.textContent = `Violation Warning ${count} of 3`;
        if (warningModal) warningModal.classList.remove('hidden');
    }

    const returnToFullscreenBtn = document.getElementById('returnToFullscreenBtn');
    if (returnToFullscreenBtn) {
        returnToFullscreenBtn.addEventListener('click', async () => {
            document.getElementById('fullscreenWarningModal')?.classList.add('hidden');
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (e) {}
        });
    }

    function terminateStudentExam(message) {
        examState.isExamActive = false;
        if (examState.timerInterval) clearInterval(examState.timerInterval);
        document.getElementById('reviewSubmissionModal')?.classList.add('hidden');

        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);

        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        document.getElementById('activeExamInterface')?.classList.add('hidden');
        document.getElementById('fullscreenWarningModal')?.classList.add('hidden');

        const completionCard = document.getElementById('examCompletionCard');
        const titleEl = document.getElementById('completionTitle');
        const msgEl = document.getElementById('completionMessage');
        const iconBox = document.getElementById('completionIconBox');

        if (titleEl) titleEl.textContent = 'Test Terminated';
        if (msgEl) msgEl.textContent = message || 'Your test has been terminated because fullscreen mode was exited repeatedly.';
        if (iconBox) iconBox.innerHTML = `<i data-lucide="alert-octagon" style="color: var(--accent-rose); width: 64px; height: 64px;"></i>`;

        if (completionCard) completionCard.classList.remove('hidden');
        toggleCognifyNavigation(true);
        if (window.lucide) window.lucide.createIcons();
    }

    const submitExamBtn = document.getElementById('submitExamBtn');
    if (submitExamBtn) {
        submitExamBtn.addEventListener('click', () => {
            openReviewSubmissionModal();
        });
    }

    async function submitStudentExam(isAutoSubmit = false) {
        if (!examState.attemptId) return;

        examState.isExamActive = false;
        if (examState.timerInterval) clearInterval(examState.timerInterval);
        document.getElementById('reviewSubmissionModal')?.classList.add('hidden');

        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);

        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        try {
            const res = await fetch('/api/student/submit-attempt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attempt_id: examState.attemptId })
            });

            const data = await res.json();
            document.getElementById('activeExamInterface')?.classList.add('hidden');

            const completionCard = document.getElementById('examCompletionCard');
            const titleEl = document.getElementById('completionTitle');
            const msgEl = document.getElementById('completionMessage');
            const iconBox = document.getElementById('completionIconBox');

            if (titleEl) titleEl.textContent = 'Test Submitted';
            if (msgEl) msgEl.textContent = data.message || 'Your response has been recorded successfully. Results will be published after verification.';
            if (iconBox) iconBox.innerHTML = `<i data-lucide="check-circle-2" style="color: var(--accent-emerald); width: 64px; height: 64px;"></i>`;

            if (completionCard) completionCard.classList.remove('hidden');
            toggleCognifyNavigation(true);
            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            alert('Error submitting test.');
        }
    }

    const finishExamBtn = document.getElementById('finishExamBtn');
    if (finishExamBtn) {
        finishExamBtn.addEventListener('click', () => {
            toggleCognifyNavigation(true);
            window.location.hash = 'home';
        });
    }

    // --- STUDENT PORTAL RESULTS LOOKUP FORM ---
    const studentResultsSearchForm = document.getElementById('studentResultsSearchForm');
    if (studentResultsSearchForm) {
        studentResultsSearchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const regInput = document.getElementById('studentResultsRegInput');
            const container = document.getElementById('studentResultsContainer');
            if (!regInput || !container) return;

            const regNo = regInput.value.trim();
            if (!regNo) return;

            try {
                const res = await fetch(`/api/student/dashboard/${encodeURIComponent(regNo)}`);
                const data = await res.json();

                if (!res.ok || !data.found) {
                    container.innerHTML = `<div style="padding: 16px; color: var(--accent-rose); font-weight: 600;">${escapeHtml(data.error || 'Student not found.')}</div>`;
                    container.classList.remove('hidden');
                    return;
                }

                const s = data.student;
                let html = `
                    <div style="background: rgba(0,0,0,0.2); border-radius: var(--radius-md); padding: 16px; margin-top: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                            <div>
                                <h3 style="font-size: 18px; color: var(--text-primary); margin: 0;">${escapeHtml(s.name)}</h3>
                                <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
                                    Reg No: <span style="font-family: monospace; color: var(--accent-sky); font-weight: 700;">${escapeHtml(s.registration_no)}</span> &bull; Roll: ${escapeHtml(s.roll_no)} &bull; Class: ${escapeHtml(s.class_name)}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Cognify Score</div>
                                <div style="font-size: 24px; font-weight: 800; color: var(--accent-emerald);">${data.cognify_score}%</div>
                                <div style="font-size: 12px; color: var(--accent-sky); font-weight: 700;">Rank #${data.rank || '--'} in ${escapeHtml(s.class_name)}</div>
                            </div>
                        </div>

                        <div class="card-box-header" style="padding-top: 8px;">
                            <h4 style="font-size: 14px; margin: 0;">Published Test Performance</h4>
                        </div>
                `;

                if (!data.results || data.results.length === 0) {
                    html += `<div style="padding: 12px; color: var(--text-muted); font-size: 13px;">No test results published yet for this semester.</div>`;
                } else {
                    html += `
                        <table class="ranking-table" style="font-size: 13px; margin-top: 8px;">
                            <thead>
                                <tr>
                                    <th>Test Number</th>
                                    <th>Test Name</th>
                                    <th>Date</th>
                                    <th>Attendance</th>
                                    <th style="text-align: right;">Score</th>
                                    <th style="text-align: right;">Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;

                    data.results.forEach(r => {
                        let attTag = r.attendance === 'Present'
                            ? `<span class="timeline-tag tag-completed">Present</span>`
                            : `<span class="timeline-tag" style="background: rgba(245, 158, 11, 0.2); color: #FCD34D;">Absent</span>`;

                        let scoreDisplay = r.attendance === 'Present' ? `${r.marks_obtained} / ${r.total_marks}` : `0 / ${r.total_marks}`;
                        let pctDisplay = r.attendance === 'Present' ? `${r.percentage}%` : `0%`;

                        html += `
                            <tr>
                                <td style="font-weight: 700;">${escapeHtml(r.test_number)}</td>
                                <td style="font-weight: 600;">${escapeHtml(r.test_name)}</td>
                                <td>${escapeHtml(r.test_date)}</td>
                                <td>${attTag}</td>
                                <td style="text-align: right; font-weight: 600;">${scoreDisplay}</td>
                                <td style="text-align: right; font-weight: 700; color: ${r.attendance === 'Present' ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">${pctDisplay}</td>
                            </tr>
                        `;
                    });

                    html += `</tbody></table>`;
                }

                html += `</div>`;
                container.innerHTML = html;
                container.classList.remove('hidden');
                if (window.lucide) window.lucide.createIcons();

            } catch (err) {
                container.innerHTML = `<div style="padding: 16px; color: var(--accent-rose);">Error retrieving student scorecard.</div>`;
                container.classList.remove('hidden');
            }
        });
    }

    // Initialize App Routing
    handleHashChange();
});
