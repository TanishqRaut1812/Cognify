// Cognify Admin Portal Dashboard Engine
document.addEventListener('DOMContentLoaded', () => {

    // Global Confirmation Modal State
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmModalTitle');
    const confirmMessage = document.getElementById('confirmModalMessage');
    const confirmCancelBtn = document.getElementById('confirmModalCancelBtn');
    const confirmSubmitBtn = document.getElementById('confirmModalSubmitBtn');
    const closeConfirmModalBtn = document.getElementById('closeConfirmModalBtn');

    let onConfirmCallback = null;

    function showConfirmModal(title, message, onConfirm) {
        if (confirmTitle) confirmTitle.textContent = title;
        if (confirmMessage) confirmMessage.textContent = message;
        onConfirmCallback = onConfirm;
        if (confirmModal) confirmModal.classList.remove('hidden');
    }

    function closeConfirmModal() {
        if (confirmModal) confirmModal.classList.add('hidden');
        onConfirmCallback = null;
    }

    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeConfirmModal);
    if (closeConfirmModalBtn) closeConfirmModalBtn.addEventListener('click', closeConfirmModal);
    if (confirmSubmitBtn) {
        confirmSubmitBtn.addEventListener('click', () => {
            if (onConfirmCallback) onConfirmCallback();
            closeConfirmModal();
        });
    }

    // Admin Tabs Switcher
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const tabId = btn.dataset.adminTab;
            const targetPane = document.getElementById(`admin-pane-${tabId}`);
            if (targetPane) targetPane.classList.add('active');

            if (tabId === 'dashboard') loadAdminDashboardStats();
            else if (tabId === 'students') loadMasterStudentSummary();
        });
    });

    // Admin Logout
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', async () => {
            try {
                await fetch('/api/admin/logout', { method: 'POST' });
                window.location.hash = 'home';
                window.location.reload();
            } catch (err) {
                console.error(err);
            }
        });
    }

    // Global Date Formatter Helper (DD/MM/YY)
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
        return dateStr;
    }

    // Main Dashboard Loader
    window.loadAdminDashboard = async function() {
        await loadAdminTests();
        await loadStudentSummaries();
        await populateTestDropdowns();
    };

    // 1. Manage Tests & Per-Test Admin Workspace
    let activeWorkspaceTestId = null;
    let activeWorkspaceData = null;

    async function loadAdminTests() {
        const container = document.getElementById('adminTestsList');
        if (!container) return;

        try {
            const res = await fetch('/api/admin/tests');
            const tests = await res.json();

            if (!Array.isArray(tests) || tests.length === 0) {
                container.innerHTML = `<div style="padding: 16px; color: var(--text-muted);">No tests created yet.</div>`;
                return;
            }

            let html = `
                <table class="ranking-table">
                    <thead>
                        <tr>
                            <th>Number</th>
                            <th>Name</th>
                            <th>Date</th>
                            <th>Time Window</th>
                            <th>Total Marks</th>
                            <th>Status</th>
                            <th>Published</th>
                            <th style="text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            tests.forEach(t => {
                const pubBadge = t.is_published ? `<span class="timeline-tag tag-completed">Published</span>` : `<span class="timeline-tag tag-upcoming">Draft</span>`;
                const dateDisplay = t.formatted_date || formatDisplayDate(t.test_date);
                const sTime = t.start_time || '10:00 AM';
                const fTime = t.finish_time || '11:00 AM';
                html += `
                    <tr>
                        <td style="font-weight: 700;">${t.test_number}</td>
                        <td style="font-weight: 600;">${escapeHtml(t.test_name)}</td>
                        <td>${dateDisplay}</td>
                        <td style="font-size: 13px; font-weight: 600; color: var(--accent-sky);">${sTime} → ${fTime}</td>
                        <td>${t.total_marks}</td>
                        <td>
                            <select onchange="updateTestStatus(${t.id}, this.value)" style="padding: 4px 8px; font-size: 13px; width: auto;">
                                <option value="Upcoming" ${t.status === 'Upcoming' ? 'selected' : ''}>Upcoming</option>
                                <option value="Current" ${t.status === 'Current' ? 'selected' : ''}>Current</option>
                                <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        </td>
                        <td>${pubBadge}</td>
                        <td style="text-align: right; white-space: nowrap;">
                            <button onclick="openTestWorkspace(${t.id})" class="btn btn-primary btn-sm" style="margin-right: 6px;">
                                <i data-lucide="layout-dashboard"></i> Open Workspace
                            </button>
                            <button onclick="confirmDeleteTest(${t.id}, '${escapeHtml(t.test_number)}')" class="btn btn-danger btn-sm">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            container.innerHTML = `<div style="color: var(--accent-rose);">Failed to load admin tests list.</div>`;
        }
    }

    // --- WORKSPACE FUNCTIONALITY ---
    window.openTestWorkspace = async function(testId) {
        activeWorkspaceTestId = testId;
        const workspaceContainer = document.getElementById('adminTestWorkspace');
        const createForm = document.getElementById('createTestForm')?.parentElement;
        const listContainer = document.getElementById('adminTestsList')?.parentElement;

        if (createForm) createForm.classList.add('hidden');
        if (listContainer) listContainer.classList.add('hidden');
        if (workspaceContainer) workspaceContainer.classList.remove('hidden');

        // Reset to Overview tab
        switchWorkspaceTab('overview');
        await refreshWorkspace(testId);
    };

    window.closeTestWorkspace = function() {
        activeWorkspaceTestId = null;
        activeWorkspaceData = null;
        const workspaceContainer = document.getElementById('adminTestWorkspace');
        const createForm = document.getElementById('createTestForm')?.parentElement;
        const listContainer = document.getElementById('adminTestsList')?.parentElement;

        if (workspaceContainer) workspaceContainer.classList.add('hidden');
        if (createForm) createForm.classList.remove('hidden');
        if (listContainer) listContainer.classList.remove('hidden');

        loadAdminTests();
    };

    const closeWsBtn = document.getElementById('closeWorkspaceBtn');
    if (closeWsBtn) closeWsBtn.addEventListener('click', window.closeTestWorkspace);

    // Workspace Sub-Tabs Navigation
    document.querySelectorAll('.ws-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.wsTab;
            switchWorkspaceTab(tabName);
        });
    });

    function switchWorkspaceTab(tabName) {
        document.querySelectorAll('.ws-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.ws-tab-pane').forEach(p => p.classList.remove('active'));

        const activeBtn = document.querySelector(`.ws-tab-btn[data-ws-tab="${tabName}"]`);
        const activePane = document.getElementById(`ws-pane-${tabName}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activePane) activePane.classList.add('active');
    }

    async function refreshWorkspace(testId) {
        try {
            const res = await fetch(`/api/admin/tests/${testId}/workspace`);
            if (!res.ok) throw new Error('Workspace load failed');

            const data = await res.json();
            activeWorkspaceData = data;

            const t = data.test;
            const m = data.metrics;
            const s = data.schedule || {};

            // Render Header
            const titleEl = document.getElementById('wsTestTitle');
            const statusBadge = document.getElementById('wsStatusBadge');
            const pubBadge = document.getElementById('wsPublishedBadge');
            const subMeta = document.getElementById('wsTestSubMeta');
            const quickStatusSelect = document.getElementById('wsQuickStatusSelect');

            if (titleEl) titleEl.textContent = `${t.test_number} · ${t.test_name}`;
            if (statusBadge) {
                statusBadge.textContent = t.status;
                statusBadge.className = `timeline-tag ${t.status === 'Completed' ? 'tag-completed' : (t.status === 'Current' ? 'tag-current' : 'tag-upcoming')}`;
            }
            if (pubBadge) {
                pubBadge.textContent = m.is_published ? 'Published' : 'Not Published';
                pubBadge.className = `timeline-tag ${m.is_published ? 'tag-completed' : 'tag-upcoming'}`;
            }
            if (subMeta) {
                subMeta.textContent = `Date: ${s.test_date || formatDisplayDate(t.test_date)} (${s.start_time || t.start_time || '10:00 AM'} → ${s.finish_time || t.finish_time || '11:00 AM'}) • Total Marks: ${t.total_marks} • Duration: ${t.duration_minutes} mins`;
            }
            if (quickStatusSelect) {
                quickStatusSelect.value = t.status;
                quickStatusSelect.onchange = (e) => updateTestStatus(t.id, e.target.value);
            }

            // Render Schedule Box in Overview
            const scheduleDateEl = document.getElementById('wsScheduleDate');
            const scheduleStartEl = document.getElementById('wsScheduleStart');
            const scheduleFinishEl = document.getElementById('wsScheduleFinish');
            const scheduleServerTimeEl = document.getElementById('wsScheduleServerTime');
            const scheduleStateBadge = document.getElementById('wsScheduleStateBadge');

            if (scheduleDateEl) scheduleDateEl.textContent = s.test_date || formatDisplayDate(t.test_date);
            if (scheduleStartEl) scheduleStartEl.textContent = s.start_time || t.start_time || '10:00 AM';
            if (scheduleFinishEl) scheduleFinishEl.textContent = s.finish_time || t.finish_time || '11:00 AM';
            if (scheduleServerTimeEl) scheduleServerTimeEl.textContent = s.current_server_time || '--';

            if (scheduleStateBadge) {
                let stateText = 'Currently Active';
                let stateClass = 'tag-current';
                if (s.availability_state === 'BEFORE_START') {
                    stateText = 'Upcoming (Not Started)';
                    stateClass = 'tag-upcoming';
                } else if (s.availability_state === 'AFTER_FINISH') {
                    stateText = 'Closed (Passed Finish Time)';
                    stateClass = 'tag-completed';
                } else if (t.status === 'Completed') {
                    stateText = 'Completed';
                    stateClass = 'tag-completed';
                }
                scheduleStateBadge.textContent = stateText;
                scheduleStateBadge.className = `timeline-tag ${stateClass}`;
            }

            // Overview Stat Cards
            document.getElementById('wsStatRegistered').textContent = m.registered_students;
            document.getElementById('wsStatSubmissions').textContent = m.submissions;
            document.getElementById('wsStatPresent').textContent = m.present_count;
            document.getElementById('wsStatAbsent').textContent = m.absent_count;
            if (document.getElementById('wsStatLate')) document.getElementById('wsStatLate').textContent = m.late_attempt_count || 0;
            document.getElementById('wsStatTerminated').textContent = m.terminated_count;
            document.getElementById('wsStatViolations').textContent = m.violation_flag_count;

            // Render Sub-Panes
            renderWorkspaceStudentsTable(data);
            renderWorkspaceAttemptsTable(data);
            renderWorkspaceResultsVerification(data);
            renderWorkspaceResources(data);
            renderWorkspaceQuestions(data);
            renderWorkspaceSettings(data);
            renderWorkspaceAuditLogs();

            if (window.lucide) window.lucide.createIcons();

        } catch (err) {
            alert('Failed to load test workspace.');
        }
    }

    // Workspace Pane 2: Students & Attendance
    function renderWorkspaceStudentsTable(data) {
        const container = document.getElementById('wsStudentsTableContainer');
        if (!container) return;

        const students = data.students || [];
        if (students.length === 0) {
            container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">No registered students in database. Upload Master Student Lists in Student Lists tab.</div>`;
            return;
        }

        let html = `
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">Roll</th>
                        <th>Student Name</th>
                        <th>Registration No</th>
                        <th>Attempt</th>
                        <th>Attendance</th>
                        <th>Status</th>
                        <th style="text-align: right;">Score</th>
                    </tr>
                </thead>
                <tbody>
        `;

        students.forEach(s => {
            let attemptBadge = `<span class="timeline-tag tag-upcoming">${s.attempt_status}</span>`;
            if (s.attempt_status === 'Submitted') attemptBadge = `<span class="timeline-tag tag-completed">Submitted</span>`;
            else if (s.attempt_status === 'In Progress') attemptBadge = `<span class="timeline-tag tag-current">In Progress</span>`;
            else if (s.attempt_status === 'Terminated') attemptBadge = `<span class="timeline-tag" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5;">Terminated</span>`;

            if (s.is_late_attempt) {
                attemptBadge += ` <span class="timeline-tag" style="background: rgba(168, 85, 247, 0.2); color: #C084FC; font-size: 11px; margin-left: 4px;">Late</span>`;
            }

            let attBtn = s.attendance === 'Present'
                ? `<button type="button" class="btn btn-sm" onclick="toggleAttendance(${data.test.id}, '${s.registration_no}', 'Absent')" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); border: 1px solid rgba(16, 185, 129, 0.4); font-weight: 700;">Present</button>`
                : `<button type="button" class="btn btn-secondary btn-sm" onclick="toggleAttendance(${data.test.id}, '${s.registration_no}', 'Present')" style="opacity: 0.7;">Absent</button>`;

            let statusTag = s.has_violation
                ? `<span style="color: #FCA5A5; font-size: 12px; font-weight: 700;">⚠️ Violation</span>`
                : `<span style="color: var(--text-muted); font-size: 12px;">Normal</span>`;

            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--text-muted);">${s.roll_no}</td>
                    <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
                    <td style="font-size: 13px; color: var(--accent-sky); font-family: monospace;">${s.registration_no}</td>
                    <td>${attemptBadge}</td>
                    <td>${attBtn}</td>
                    <td>${statusTag}</td>
                    <td style="text-align: right; font-weight: 700;">${s.score}/${data.test.total_marks}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    window.toggleAttendance = async function(testId, regNo, newAtt) {
        try {
            const res = await fetch(`/api/admin/tests/${testId}/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registration_no: regNo, attendance: newAtt })
            });

            if (res.ok) {
                await refreshWorkspace(testId);
            }
        } catch (err) {
            alert('Failed to update attendance.');
        }
    };

    const markAllPresentBtn = document.getElementById('wsMarkAllPresentBtn');
    if (markAllPresentBtn) {
        markAllPresentBtn.addEventListener('click', async () => {
            if (!activeWorkspaceTestId) return;
            try {
                const res = await fetch(`/api/admin/tests/${activeWorkspaceTestId}/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'mark_all_present' })
                });
                if (res.ok) {
                    await refreshWorkspace(activeWorkspaceTestId);
                }
            } catch (err) {
                alert('Failed marking all present.');
            }
        });
    }

    // Workspace Pane 3: Attempts Review
    function renderWorkspaceAttemptsTable(data) {
        const container = document.getElementById('wsAttemptsTableContainer');
        const filterSelect = document.getElementById('wsAttemptsFilter');
        if (!container) return;

        const filter = filterSelect ? filterSelect.value : 'all';
        let students = data.students || [];

        if (filter === 'submitted') {
            students = students.filter(s => s.attempt_status === 'Submitted');
        } else if (filter === 'flagged') {
            students = students.filter(s => s.has_violation || s.attempt_status === 'Terminated');
        }

        if (students.length === 0) {
            container.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">No attempts matching filter.</div>`;
            return;
        }

        let html = `
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th>Roll</th>
                        <th>Student Name</th>
                        <th>Registration No</th>
                        <th>Attempt Status</th>
                        <th>Attendance</th>
                        <th>Violations</th>
                        <th>Score</th>
                        <th style="text-align: right;">Review & Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        students.forEach(s => {
            let attemptBadge = `<span class="timeline-tag tag-upcoming">${s.attempt_status}</span>`;
            if (s.attempt_status === 'Submitted') attemptBadge = `<span class="timeline-tag tag-completed">Submitted</span>`;
            else if (s.attempt_status === 'In Progress') attemptBadge = `<span class="timeline-tag tag-current">In Progress</span>`;
            else if (s.attempt_status === 'Terminated') attemptBadge = `<span class="timeline-tag" style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5;">Terminated</span>`;

            let vioBadge = s.violation_count >= 4 || s.attempt_status === 'Terminated'
                ? `<span style="background: rgba(239, 68, 68, 0.2); color: #FCA5A5; padding: 2px 8px; border-radius: var(--radius-sm); font-weight: 700; font-size: 12px;">⚠️ ${s.violation_count} Violations (Terminated)</span>`
                : (s.violation_count > 0 ? `<span style="color: #FCD34D; font-size: 12px;">${s.violation_count} Exits</span>` : `<span style="color: var(--text-muted); font-size: 12px;">None</span>`);

            html += `
                <tr>
                    <td style="font-weight: 700;">${s.roll_no}</td>
                    <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
                    <td style="font-size: 13px; font-family: monospace;">${s.registration_no}</td>
                    <td>${attemptBadge}</td>
                    <td>${s.attendance}</td>
                    <td>${vioBadge}</td>
                    <td style="font-weight: 700;">${s.score}/${data.test.total_marks} (${s.percentage}%)</td>
                    <td style="text-align: right; white-space: nowrap;">
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openAttemptReview(${data.test.id}, '${s.registration_no}')" style="margin-right: 4px;">
                            <i data-lucide="eye"></i> Review
                        </button>
                        <button type="button" class="btn btn-danger btn-sm" onclick="confirmResetAttempt(${data.test.id}, '${s.registration_no}', '${escapeHtml(s.name)}')" title="Reset/Clear attempt for retake">
                            <i data-lucide="rotate-ccw"></i> Reset
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        if (filterSelect) {
            filterSelect.onchange = () => renderWorkspaceAttemptsTable(data);
        }
    }

    window.openAttemptReview = async function(testId, regNo) {
        const modal = document.getElementById('attemptReviewModal');
        const title = document.getElementById('reviewModalTitle');
        const sub = document.getElementById('reviewModalSubtitle');
        const body = document.getElementById('reviewModalBody');
        if (!modal || !body) return;

        body.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Loading attempt details...</div>`;
        modal.classList.remove('hidden');

        try {
            const res = await fetch(`/api/admin/tests/${testId}/attempts/${regNo}`);
            const data = await res.json();

            if (title) title.textContent = `${data.student.name} (${data.student.registration_no})`;
            if (sub) sub.textContent = `Roll: ${data.student.roll_no} • Class: ${data.student.class_name} • Attempt: ${data.attempt ? data.attempt.attempt_status : 'Not Started'}`;

            let html = `
                <div class="form-grid" style="margin-bottom: 20px;">
                    <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: var(--radius-sm);">
                        <div style="font-size: 12px; color: var(--text-muted);">Attendance</div>
                        <div style="font-weight: 700;">${data.attempt ? data.attempt.attendance : 'Absent'}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: var(--radius-sm);">
                        <div style="font-size: 12px; color: var(--text-muted);">Questions Answered</div>
                        <div style="font-weight: 700;">${data.answered_count} / ${data.total_questions}</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.04); padding: 12px; border-radius: var(--radius-sm);">
                        <div style="font-size: 12px; color: var(--text-muted);">Final Score</div>
                        <div style="font-weight: 700; color: var(--accent-emerald);">${data.attempt ? data.attempt.calculated_score : 0} / ${data.test.total_marks} (${data.attempt ? data.attempt.calculated_percentage : 0}%)</div>
                    </div>
                </div>
            `;

            if (data.violation_logs && data.violation_logs.length > 0) {
                html += `
                    <div style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 12px; border-radius: var(--radius-sm); margin-bottom: 20px;">
                        <div style="font-weight: 700; color: #FCA5A5; font-size: 13px; margin-bottom: 6px;">⚠️ Fullscreen Violation Logs (${data.violation_logs.length})</div>
                        <ul style="padding-left: 18px; color: #FCA5A5; font-size: 12px;">
                `;
                data.violation_logs.forEach(v => {
                    html += `<li>Exit #${v.violation_number}: ${v.reason} at ${v.timestamp}</li>`;
                });
                html += `</ul></div>`;
            }

            html += `<h4 style="font-size: 15px; margin-bottom: 12px;">Saved Answers Breakdown</h4>`;

            if (!data.saved_answers || data.saved_answers.length === 0) {
                html += `<div style="color: var(--text-muted);">No saved answers recorded for this attempt.</div>`;
            } else {
                data.saved_answers.forEach(q => {
                    const statusColor = q.selected_option ? (q.is_correct ? 'var(--accent-emerald)' : 'var(--accent-rose)') : 'var(--text-muted)';
                    const statusText = q.selected_option ? (q.is_correct ? 'Correct' : `Selected: ${q.selected_option} (Correct: ${q.correct_option})`) : 'Not Answered';

                    html += `
                        <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 4px;">
                                <span>Q${q.question_number}. ${escapeHtml(q.question_text)}</span>
                                <span style="color: ${statusColor}; font-weight: 700;">${statusText}</span>
                            </div>
                            <div style="font-size: 12px; color: var(--text-muted); display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px;">
                                <div>A) ${escapeHtml(q.option_a)}</div>
                                <div>B) ${escapeHtml(q.option_b)}</div>
                                <div>C) ${escapeHtml(q.option_c)}</div>
                                <div>D) ${escapeHtml(q.option_d)}</div>
                            </div>
                        </div>
                    `;
                });
            }

            body.innerHTML = html;

        } catch (err) {
            body.innerHTML = `<div style="color: var(--accent-rose);">Failed to load attempt review details.</div>`;
        }
    };

    const closeReviewModalBtn = document.getElementById('closeAttemptReviewModalBtn');
    if (closeReviewModalBtn) closeReviewModalBtn.addEventListener('click', () => {
        document.getElementById('attemptReviewModal')?.classList.add('hidden');
    });

    window.confirmResetAttempt = function(testId, regNo, studentName) {
        showConfirmModal(
            `Reset Attempt for ${studentName}?`,
            `Are you sure you want to reset/clear the attempt for ${studentName} (${regNo})? This will delete all saved answers and allow a genuine retake.`,
            async () => {
                try {
                    const res = await fetch(`/api/admin/tests/${testId}/reset-attempt`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ registration_no: regNo })
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                        alert(data.message);
                        await refreshWorkspace(testId);
                    } else {
                        alert(data.error || 'Failed resetting attempt.');
                    }
                } catch (err) {
                    alert('Error resetting attempt.');
                }
            }
        );
    };

    // Workspace Pane 4: Results Verification & Publishing
    function renderWorkspaceResultsVerification(data) {
        const container = document.getElementById('wsResultsVerificationTableContainer');
        if (!container) return;

        const students = data.students || [];
        let html = `
            <table class="ranking-table">
                <thead>
                    <tr>
                        <th>Roll</th>
                        <th>Student Name</th>
                        <th>Registration No</th>
                        <th>Attendance</th>
                        <th>Attempt</th>
                        <th>Violation Flag</th>
                        <th style="text-align: right;">Calculated Score</th>
                    </tr>
                </thead>
                <tbody>
        `;

        students.forEach(s => {
            html += `
                <tr>
                    <td style="font-weight: 700;">${s.roll_no}</td>
                    <td style="font-weight: 600;">${escapeHtml(s.name)}</td>
                    <td style="font-size: 13px; font-family: monospace;">${s.registration_no}</td>
                    <td>${s.attendance === 'Present' ? '<span style="color: var(--accent-emerald); font-weight: 700;">Present</span>' : '<span style="color: var(--accent-amber);">Absent</span>'}</td>
                    <td>${s.attempt_status}</td>
                    <td>${s.has_violation ? '<span style="color: #FCA5A5; font-weight: 700;">⚠️ Violation</span>' : '<span style="color: var(--text-muted);">Clean</span>'}</td>
                    <td style="text-align: right; font-weight: 700;">${s.attendance === 'Present' ? `${s.score}/${data.test.total_marks}` : '0 (Absent)'}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    const wsPublishBtnHeader = document.getElementById('wsPublishBtnHeader');
    const wsPublishResultsBtnMain = document.getElementById('wsPublishResultsBtnMain');
    const publishModal = document.getElementById('publishConfirmModal');
    const closePublishModalBtn = document.getElementById('closePublishConfirmModalBtn');
    const cancelPublishBtn = document.getElementById('cancelPublishBtn');
    const confirmPublishBtn = document.getElementById('confirmPublishWorkspaceBtn');

    function openPublishModal() {
        if (!activeWorkspaceTestId) return;
        fetchPublishSummary(activeWorkspaceTestId);
    }

    if (wsPublishBtnHeader) wsPublishBtnHeader.addEventListener('click', openPublishModal);
    if (wsPublishResultsBtnMain) wsPublishResultsBtnMain.addEventListener('click', openPublishModal);
    if (closePublishModalBtn) closePublishModalBtn.addEventListener('click', () => publishModal?.classList.add('hidden'));
    if (cancelPublishBtn) cancelPublishBtn.addEventListener('click', () => publishModal?.classList.add('hidden'));

    async function fetchPublishSummary(testId) {
        try {
            const res = await fetch(`/api/admin/tests/${testId}/publish-summary`);
            const data = await res.json();

            const title = document.getElementById('publishConfirmTitle');
            const statsBox = document.getElementById('publishSummaryStatsBox');

            if (title) title.textContent = `Publish ${data.test_number} Results?`;
            if (statsBox) {
                statsBox.innerHTML = `
                    <div style="font-weight: 700; margin-bottom: 8px;">${escapeHtml(data.test_name)} Summary:</div>
                    <ul style="padding-left: 18px; line-height: 1.6; color: var(--text-secondary);">
                        <li><strong>${data.total_students}</strong> total students</li>
                        <li><strong>${data.present_count}</strong> present students</li>
                        <li><strong>${data.absent_count}</strong> absent students (0 marks)</li>
                        <li><strong>${data.normal_submissions}</strong> normal submissions</li>
                        <li><strong>${data.flagged_attempts}</strong> flagged/terminated attempts</li>
                    </ul>
                `;
            }

            if (publishModal) publishModal.classList.remove('hidden');

        } catch (err) {
            alert('Error preparing publish summary.');
        }
    }

    if (confirmPublishBtn) {
        confirmPublishBtn.addEventListener('click', async () => {
            if (!activeWorkspaceTestId) return;
            try {
                const res = await fetch(`/api/admin/tests/${activeWorkspaceTestId}/publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert(data.message);
                    if (publishModal) publishModal.classList.add('hidden');
                    await refreshWorkspace(activeWorkspaceTestId);
                } else {
                    alert(data.error || 'Failed to publish results.');
                }
            } catch (err) {
                alert('Error publishing results.');
            }
        });
    }

    // Workspace Pane 5: Resources & Syllabus
    function renderWorkspaceResources(data) {
        const catContainer = document.getElementById('wsSyllabusCategoriesList');
        const resContainer = document.getElementById('wsResourcesList');

        if (catContainer) {
            if (!data.categories || data.categories.length === 0) {
                catContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">No syllabus categories added yet.</div>`;
            } else {
                let html = '';
                data.categories.forEach(c => {
                    html += `
                        <div style="background: rgba(255,255,255,0.04); border-radius: var(--radius-sm); padding: 10px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong style="font-size: 14px;">${escapeHtml(c.category_name)}</strong>
                                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${c.topics.join(', ')}</div>
                            </div>
                            <button type="button" class="btn btn-danger btn-sm" onclick="deleteWorkspaceSyllabus(${c.id})"><i data-lucide="trash-2"></i></button>
                        </div>
                    `;
                });
                catContainer.innerHTML = html;
            }
        }

        if (resContainer) {
            const types = ['notes', 'practice', 'question_paper', 'answer_key'];
            let html = '';
            types.forEach(rtype => {
                const r = data.resources ? data.resources[rtype] : null;
                const label = rtype.replace('_', ' ').toUpperCase();

                if (r) {
                    html += `
                        <div style="background: rgba(255,255,255,0.04); border-radius: var(--radius-sm); padding: 10px; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <span style="font-size: 11px; font-weight: 700; color: var(--accent-sky); text-transform: uppercase;">${label}</span>
                                <div style="font-size: 13px; font-weight: 600;">${escapeHtml(r.title)}</div>
                            </div>
                            <div style="display: flex; gap: 6px;">
                                <a href="${r.file_path}" target="_blank" class="btn btn-secondary btn-sm"><i data-lucide="download"></i> View</a>
                                <button type="button" class="btn btn-danger btn-sm" onclick="deleteWorkspaceResource(${r.id})"><i data-lucide="trash-2"></i></button>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div style="background: rgba(0,0,0,0.15); border: 1px border-dashed var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 12px; color: var(--text-muted);">
                            ${label}: Not Uploaded
                        </div>
                    `;
                }
            });
            resContainer.innerHTML = html;
        }
    }

    const wsAddSyllabusForm = document.getElementById('wsAddSyllabusForm');
    if (wsAddSyllabusForm) {
        wsAddSyllabusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeWorkspaceTestId) return;

            const category_name = document.getElementById('wsCatNameInput').value.trim();
            const rawTopics = document.getElementById('wsCatTopicsInput').value;
            const topics = rawTopics.split(/[\n,]/).map(t => t.trim()).filter(Boolean);

            try {
                const res = await fetch('/api/admin/syllabus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ test_id: activeWorkspaceTestId, category_name, topics })
                });
                if (res.ok) {
                    wsAddSyllabusForm.reset();
                    await refreshWorkspace(activeWorkspaceTestId);
                }
            } catch (err) {
                alert('Error adding syllabus.');
            }
        });
    }

    window.deleteWorkspaceSyllabus = async function(catId) {
        try {
            const res = await fetch(`/api/admin/syllabus/${catId}`, { method: 'DELETE' });
            if (res.ok && activeWorkspaceTestId) await refreshWorkspace(activeWorkspaceTestId);
        } catch (err) {
            alert('Error deleting syllabus category.');
        }
    };

    const wsUploadResourceForm = document.getElementById('wsUploadResourceForm');
    if (wsUploadResourceForm) {
        wsUploadResourceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeWorkspaceTestId) return;

            const rtype = document.getElementById('wsResourceTypeSelect').value;
            const title = document.getElementById('wsResourceTitleInput').value.trim();
            const fileInput = document.getElementById('wsResourceFileInput');

            if (!fileInput.files || !fileInput.files[0]) return;

            const formData = new FormData();
            formData.append('test_id', activeWorkspaceTestId);
            formData.append('resource_type', rtype);
            formData.append('title', title);
            formData.append('file', fileInput.files[0]);

            try {
                const res = await fetch('/api/admin/resources/upload', {
                    method: 'POST',
                    body: formData
                });
                if (res.ok) {
                    wsUploadResourceForm.reset();
                    await refreshWorkspace(activeWorkspaceTestId);
                } else {
                    alert('Upload failed.');
                }
            } catch (err) {
                alert('Error uploading file.');
            }
        });
    }

    window.deleteWorkspaceResource = async function(resId) {
        try {
            const res = await fetch(`/api/admin/resources/${resId}`, { method: 'DELETE' });
            if (res.ok && activeWorkspaceTestId) await refreshWorkspace(activeWorkspaceTestId);
        } catch (err) {
            alert('Error deleting resource.');
        }
    };

    // Workspace Pane 6: Questions Management & Excel Import
    let currentExcelParsedQuestions = null;

    function renderWorkspaceQuestions(data) {
        const container = document.getElementById('wsQuestionsListContainer');
        if (!container) return;

        const questions = data.questions || [];
        if (questions.length === 0) {
            container.innerHTML = `<div style="padding: 24px; color: var(--text-muted); text-align: center;">No questions added yet for this online test.<br><span style="font-size: 12px;">Upload an Excel (.xlsx) file or click "+ Add Single Question" to populate test questions.</span></div>`;
            return;
        }

        let html = '';
        questions.forEach(q => {
            html += `
                <div class="card-box" style="background: rgba(0,0,0,0.25); margin-bottom: 12px; padding: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                        <div>
                            <span style="font-weight: 700; color: var(--accent-sky); font-size: 15px;">Q${q.question_number}</span>
                            <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">(${q.marks} Mark${q.marks > 1 ? 's' : ''})</span>
                            <span class="timeline-tag tag-completed" style="margin-left: 8px;">Correct: Option ${q.correct_option}</span>
                        </div>
                        <div>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="openEditQuestionModal(${q.id})" style="margin-right: 6px;">
                                <i data-lucide="edit-3"></i> Edit
                            </button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="deleteWorkspaceQuestion(${q.id})">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </div>
                    <h5 style="font-size: 15px; margin-bottom: 10px; line-height: 1.5;">${escapeHtml(q.question_text)}</h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; font-size: 13px; color: var(--text-secondary);">
                        <div style="${q.correct_option === 'A' ? 'color: var(--accent-emerald); font-weight: 700;' : ''}">A) ${escapeHtml(q.option_a)}</div>
                        <div style="${q.correct_option === 'B' ? 'color: var(--accent-emerald); font-weight: 700;' : ''}">B) ${escapeHtml(q.option_b)}</div>
                        <div style="${q.correct_option === 'C' ? 'color: var(--accent-emerald); font-weight: 700;' : ''}">C) ${escapeHtml(q.option_c)}</div>
                        <div style="${q.correct_option === 'D' ? 'color: var(--accent-emerald); font-weight: 700;' : ''}">D) ${escapeHtml(q.option_d)}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    }

    const wsUploadQuestionExcelBtn = document.getElementById('wsUploadQuestionExcelBtn');
    const wsReplaceQuestionExcelBtn = document.getElementById('wsReplaceQuestionExcelBtn');
    const wsQuestionExcelFileInput = document.getElementById('wsQuestionExcelFileInput');

    if (wsUploadQuestionExcelBtn && wsQuestionExcelFileInput) {
        wsUploadQuestionExcelBtn.addEventListener('click', () => {
            wsQuestionExcelFileInput.value = '';
            wsQuestionExcelFileInput.click();
        });
    }

    if (wsReplaceQuestionExcelBtn && wsQuestionExcelFileInput) {
        wsReplaceQuestionExcelBtn.addEventListener('click', () => {
            wsQuestionExcelFileInput.value = '';
            wsQuestionExcelFileInput.click();
        });
    }

    if (wsQuestionExcelFileInput) {
        wsQuestionExcelFileInput.addEventListener('change', async (e) => {
            if (!e.target.files || !e.target.files[0] || !activeWorkspaceTestId) return;
            const file = e.target.files[0];
            await handleQuestionExcelValidation(file);
        });
    }

    async function handleQuestionExcelValidation(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`/api/admin/tests/${activeWorkspaceTestId}/questions/validate-excel`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Failed to parse Excel file.');
                return;
            }

            renderExcelQuestionPreviewModal(data);
        } catch (err) {
            alert('Server error validating Question Excel file.');
        }
    }

    function renderExcelQuestionPreviewModal(data) {
        currentExcelParsedQuestions = data;

        const modal = document.getElementById('excelQuestionImportModal');
        const totalDetEl = document.getElementById('excelImportTotalDetected');
        const validCntEl = document.getElementById('excelImportValidCount');
        const invalidCntEl = document.getElementById('excelImportInvalidCount');
        const warningsBox = document.getElementById('excelImportWarningsContainer');
        const errorsBox = document.getElementById('excelImportErrorsContainer');
        const errorsList = document.getElementById('excelImportErrorsList');
        const tbody = document.getElementById('excelImportPreviewTbody');
        const confirmBtn = document.getElementById('confirmExcelImportBtn');

        if (totalDetEl) totalDetEl.textContent = data.total_detected || 0;
        if (validCntEl) validCntEl.textContent = data.valid_count || 0;
        if (invalidCntEl) invalidCntEl.textContent = data.invalid_count || 0;

        if (warningsBox) {
            if (data.warnings && data.warnings.length > 0) {
                let warnHtml = '';
                data.warnings.forEach(w => {
                    warnHtml += `<div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); padding: 10px 14px; border-radius: var(--radius-sm); color: #FCD34D; font-size: 13px; margin-bottom: 8px;"><i data-lucide="alert-triangle" style="width: 14px; height: 14px; display: inline;"></i> ${escapeHtml(w)}</div>`;
                });
                warningsBox.innerHTML = warnHtml;
                warningsBox.classList.remove('hidden');
            } else {
                warningsBox.classList.add('hidden');
            }
        }

        if (errorsBox && errorsList) {
            if (data.errors && data.errors.length > 0) {
                errorsList.innerHTML = data.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('');
                errorsBox.classList.remove('hidden');
            } else {
                errorsBox.classList.add('hidden');
            }
        }

        if (tbody) {
            let html = '';
            (data.questions || []).forEach(q => {
                html += `
                    <tr>
                        <td style="font-weight: 700; color: var(--accent-sky);">${q.question_number}</td>
                        <td style="font-weight: 500;">${escapeHtml(q.question_text)}</td>
                        <td style="${q.correct_option === 'A' ? 'font-weight: 700; color: var(--accent-emerald);' : ''}">${escapeHtml(q.option_a)}</td>
                        <td style="${q.correct_option === 'B' ? 'font-weight: 700; color: var(--accent-emerald);' : ''}">${escapeHtml(q.option_b)}</td>
                        <td style="${q.correct_option === 'C' ? 'font-weight: 700; color: var(--accent-emerald);' : ''}">${escapeHtml(q.option_c)}</td>
                        <td style="${q.correct_option === 'D' ? 'font-weight: 700; color: var(--accent-emerald);' : ''}">${escapeHtml(q.option_d)}</td>
                        <td style="text-align: center;"><span class="timeline-tag tag-completed">${q.correct_option}</span></td>
                        <td style="text-align: right;">${q.marks}</td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }

        if (confirmBtn) {
            confirmBtn.disabled = !data.valid;
            confirmBtn.style.opacity = data.valid ? '1' : '0.5';
        }

        if (modal) modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }

    const closeExcelModalBtn = document.getElementById('closeExcelQuestionImportModalBtn');
    const cancelExcelImportBtn = document.getElementById('cancelExcelImportBtn');
    if (closeExcelModalBtn) closeExcelModalBtn.addEventListener('click', () => document.getElementById('excelQuestionImportModal')?.classList.add('hidden'));
    if (cancelExcelImportBtn) cancelExcelImportBtn.addEventListener('click', () => document.getElementById('excelQuestionImportModal')?.classList.add('hidden'));

    const confirmExcelImportBtn = document.getElementById('confirmExcelImportBtn');
    if (confirmExcelImportBtn) {
        confirmExcelImportBtn.addEventListener('click', () => {
            if (!currentExcelParsedQuestions || !currentExcelParsedQuestions.valid || !activeWorkspaceTestId) return;

            const executeImport = async () => {
                try {
                    const res = await fetch(`/api/admin/tests/${activeWorkspaceTestId}/questions/import-excel`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ questions: currentExcelParsedQuestions.questions })
                    });
                    const resData = await res.json();
                    if (res.ok && resData.success) {
                        document.getElementById('excelQuestionImportModal')?.classList.add('hidden');
                        alert(resData.message);
                        await refreshWorkspace(activeWorkspaceTestId);
                    } else {
                        alert(resData.error || 'Failed to import questions.');
                    }
                } catch (err) {
                    alert('Server error importing questions.');
                }
            };

            if (currentExcelParsedQuestions.has_student_attempts) {
                showConfirmModal(
                    "Replace Questions with Active Student Attempts?",
                    `⚠️ ${currentExcelParsedQuestions.student_attempts_count} student attempt(s) have already been recorded for this test. Changing the question set will preserve historical attempts while updating future attempts. Continue?`,
                    executeImport
                );
            } else if (currentExcelParsedQuestions.existing_questions_count > 0) {
                showConfirmModal(
                    "Replace Existing Questions?",
                    `This test already has ${currentExcelParsedQuestions.existing_questions_count} question(s). Are you sure you want to replace all existing questions with this new question set?`,
                    executeImport
                );
            } else {
                executeImport();
            }
        });
    }

    window.openEditQuestionModal = function(qId) {
        if (!activeWorkspaceData || !activeWorkspaceData.questions) return;
        const q = activeWorkspaceData.questions.find(x => x.id === qId);
        if (!q) return;

        document.getElementById('editQuestionId').value = q.id;
        document.getElementById('editQNumInput').value = q.question_number;
        document.getElementById('editQMarksInput').value = q.marks;
        document.getElementById('editQTextInput').value = q.question_text;
        document.getElementById('editOptAInput').value = q.option_a;
        document.getElementById('editOptBInput').value = q.option_b;
        document.getElementById('editOptCInput').value = q.option_c;
        document.getElementById('editOptDInput').value = q.option_d;
        document.getElementById('editCorrectOptSelect').value = q.correct_option;

        document.getElementById('editQuestionModal')?.classList.remove('hidden');
    };

    const closeEditQuestionModalBtn = document.getElementById('closeEditQuestionModalBtn');
    const cancelEditQuestionBtn = document.getElementById('cancelEditQuestionBtn');
    if (closeEditQuestionModalBtn) closeEditQuestionModalBtn.addEventListener('click', () => document.getElementById('editQuestionModal')?.classList.add('hidden'));
    if (cancelEditQuestionBtn) cancelEditQuestionBtn.addEventListener('click', () => document.getElementById('editQuestionModal')?.classList.add('hidden'));

    const editQuestionForm = document.getElementById('editQuestionForm');
    if (editQuestionForm) {
        editQuestionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const qId = document.getElementById('editQuestionId').value;
            if (!qId) return;

            const payload = {
                question_number: document.getElementById('editQNumInput').value,
                marks: document.getElementById('editQMarksInput').value,
                question_text: document.getElementById('editQTextInput').value.trim(),
                option_a: document.getElementById('editOptAInput').value.trim(),
                option_b: document.getElementById('editOptBInput').value.trim(),
                option_c: document.getElementById('editOptCInput').value.trim(),
                option_d: document.getElementById('editOptDInput').value.trim(),
                correct_option: document.getElementById('editCorrectOptSelect').value
            };

            try {
                const res = await fetch(`/api/admin/questions/${qId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    document.getElementById('editQuestionModal')?.classList.add('hidden');
                    await refreshWorkspace(activeWorkspaceTestId);
                } else {
                    const errData = await res.json();
                    alert(errData.error || 'Failed updating question.');
                }
            } catch (err) {
                alert('Error updating question.');
            }
        });
    }

    const wsAddQuestionToggleBtn = document.getElementById('wsAddQuestionToggleBtn');
    const wsAddQuestionForm = document.getElementById('wsAddQuestionForm');

    if (wsAddQuestionToggleBtn && wsAddQuestionForm) {
        wsAddQuestionToggleBtn.addEventListener('click', () => {
            wsAddQuestionForm.classList.toggle('hidden');
        });
    }

    if (wsAddQuestionForm) {
        wsAddQuestionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeWorkspaceTestId) return;

            const payload = {
                question_number: document.getElementById('wsQNumInput').value,
                question_text: document.getElementById('wsQTextInput').value.trim(),
                option_a: document.getElementById('wsOptAInput').value.trim(),
                option_b: document.getElementById('wsOptBInput').value.trim(),
                option_c: document.getElementById('wsOptCInput').value.trim(),
                option_d: document.getElementById('wsOptDInput').value.trim(),
                correct_option: document.getElementById('wsCorrectOptSelect').value,
                marks: document.getElementById('wsQMarksInput').value
            };

            try {
                const res = await fetch(`/api/admin/tests/${activeWorkspaceTestId}/questions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    wsAddQuestionForm.reset();
                    wsAddQuestionForm.classList.add('hidden');
                    await refreshWorkspace(activeWorkspaceTestId);
                } else {
                    alert('Failed adding question.');
                }
            } catch (err) {
                alert('Error adding question.');
            }
        });
    }

    window.deleteWorkspaceQuestion = async function(qId) {
        try {
            const res = await fetch(`/api/admin/questions/${qId}`, { method: 'DELETE' });
            if (res.ok && activeWorkspaceTestId) await refreshWorkspace(activeWorkspaceTestId);
        } catch (err) {
            alert('Error deleting question.');
        }
    };

    // Workspace Pane 7: Settings & Deletion
    function renderWorkspaceSettings(data) {
        const t = data.test;
        const s = data.schedule || {};
        document.getElementById('wsSettingNumber').value = t.test_number;
        document.getElementById('wsSettingName').value = t.test_name;
        document.getElementById('wsSettingDate').value = s.test_date || t.test_date;
        if (document.getElementById('wsSettingStartTime')) {
            document.getElementById('wsSettingStartTime').value = t.start_time || '10:00 AM';
        }
        if (document.getElementById('wsSettingFinishTime')) {
            document.getElementById('wsSettingFinishTime').value = t.finish_time || '11:00 AM';
        }
        document.getElementById('wsSettingMarks').value = t.total_marks;
        document.getElementById('wsSettingDuration').value = t.duration_minutes || 60;
        document.getElementById('wsSettingStatus').value = t.status;
    }

    const wsEditTestForm = document.getElementById('wsEditTestForm');
    if (wsEditTestForm) {
        wsEditTestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!activeWorkspaceTestId) return;

            const payload = {
                test_number: document.getElementById('wsSettingNumber').value.trim(),
                test_name: document.getElementById('wsSettingName').value.trim(),
                test_date: document.getElementById('wsSettingDate').value.trim(),
                start_time: document.getElementById('wsSettingStartTime') ? document.getElementById('wsSettingStartTime').value.trim() : '10:00 AM',
                finish_time: document.getElementById('wsSettingFinishTime') ? document.getElementById('wsSettingFinishTime').value.trim() : '11:00 AM',
                total_marks: document.getElementById('wsSettingMarks').value,
                duration_minutes: document.getElementById('wsSettingDuration').value,
                status: document.getElementById('wsSettingStatus').value
            };

            const executeUpdate = async () => {
                try {
                    const res = await fetch(`/api/admin/tests/${activeWorkspaceTestId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (res.ok) {
                        alert('Test updated successfully.');
                        await refreshWorkspace(activeWorkspaceTestId);
                    } else {
                        const errData = await res.json();
                        alert(errData.error || 'Error updating test settings.');
                    }
                } catch (err) {
                    alert('Error updating test settings.');
                }
            };

            const isCurrentlyActive = activeWorkspaceData && activeWorkspaceData.schedule && activeWorkspaceData.schedule.availability_state === 'ACTIVE';
            if (isCurrentlyActive) {
                showConfirmModal(
                    'Modify Active Test Schedule?',
                    'This test is currently active! Changing the schedule or deadline while students are taking the test will alter availability and submission timing. Are you sure you want to proceed?',
                    executeUpdate
                );
            } else {
                executeUpdate();
            }
        });
    }

    const wsDeleteTestBtn = document.getElementById('wsDeleteTestBtn');
    if (wsDeleteTestBtn) {
        wsDeleteTestBtn.addEventListener('click', () => {
            if (!activeWorkspaceTestId || !activeWorkspaceData) return;
            const t = activeWorkspaceData.test;
            confirmDeleteTest(t.id, t.test_number);
        });
    }


    // 2. Master Student Lists Summary & Upload Logic
    async function loadStudentSummaries() {
        try {
            const res = await fetch('/api/admin/students/summary');
            const data = await res.json();
            
            const syBadge = document.getElementById('syStudentCountBadge');
            const tyBadge = document.getElementById('tyStudentCountBadge');
            const fyBadge = document.getElementById('fyStudentCountBadge');

            if (syBadge) syBadge.textContent = `${data['SY'] || 0} students loaded`;
            if (tyBadge) tyBadge.textContent = `${data['TY'] || 0} students loaded`;
            if (fyBadge) fyBadge.textContent = `${data['Final Year'] || 0} students loaded`;
        } catch (err) {
            console.error('Failed loading student summaries');
        }
    }

    const studentClassConfigs = [
        { class_name: 'SY', inputId: 'syStudentFileInput', previewId: 'syStudentPreview' },
        { class_name: 'TY', inputId: 'tyStudentFileInput', previewId: 'tyStudentPreview' },
        { class_name: 'Final Year', inputId: 'fyStudentFileInput', previewId: 'fyStudentPreview' }
    ];

    studentClassConfigs.forEach(cfg => {
        const input = document.getElementById(cfg.inputId);
        if (input) {
            input.addEventListener('change', () => handleStudentListUpload(cfg.class_name, input, cfg.previewId));
        }
    });

    async function handleStudentListUpload(className, inputEl, previewId) {
        const previewContainer = document.getElementById(previewId);
        if (!inputEl.files || !inputEl.files[0] || !previewContainer) return;

        const formData = new FormData();
        formData.append('class_name', className);
        formData.append('file', inputEl.files[0]);

        previewContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">Validating student list...</div>`;
        previewContainer.classList.remove('hidden');

        try {
            const res = await fetch('/api/admin/students/validate', {
                method: 'POST',
                body: formData
            });

            const preview = await res.json();
            renderStudentListPreview(preview, previewContainer, inputEl);

        } catch (err) {
            previewContainer.innerHTML = `<div style="font-size: 13px; color: var(--accent-rose); margin-top: 8px;">Error validating Excel file.</div>`;
        }
    }

    function renderStudentListPreview(preview, container, inputEl) {
        if (!preview.valid) {
            let errHtml = `
                <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-sm); padding: 12px; margin-top: 10px;">
                    <div style="font-weight: 700; color: #FCA5A5; font-size: 13px; margin-bottom: 6px;">Validation Failed</div>
                    <ul style="padding-left: 18px; color: #FCA5A5; font-size: 12px;">
            `;
            (preview.errors || []).forEach(e => {
                errHtml += `<li>${escapeHtml(e)}</li>`;
            });
            errHtml += `</ul></div>`;
            container.innerHTML = errHtml;
            return;
        }

        let html = `
            <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-sm); padding: 12px; margin-top: 10px;">
                <div style="font-weight: 700; color: var(--accent-emerald); font-size: 13px; margin-bottom: 6px;">Ready to Import</div>
                <div style="font-size: 12px; color: var(--text-primary); margin-bottom: 8px;">
                    <strong>${preview.valid_count}</strong> students detected &bull; 0 duplicates
                </div>
        `;

        if (preview.existing_count > 0) {
            html += `
                <div style="font-size: 11px; color: #FCD34D; margin-bottom: 8px;">
                    <i data-lucide="alert-triangle" style="width: 12px; height: 12px; display: inline;"></i> Warning: Will replace existing ${preview.existing_count} students for ${preview.class_name}.
                </div>
            `;
        }

        html += `
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('${container.id}').classList.add('hidden');">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="import${preview.class_name.replace(/\s+/g, '')}Btn">
                    ${preview.existing_count > 0 ? 'Replace List' : 'Import List'}
                </button>
            </div>
            </div>
        `;

        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();

        const btnId = `import${preview.class_name.replace(/\s+/g, '')}Btn`;
        const importBtn = document.getElementById(btnId);
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                if (preview.existing_count > 0) {
                    showConfirmModal(
                        `Replace ${preview.class_name} Student List?`,
                        `Are you sure you want to replace the existing ${preview.existing_count} students for ${preview.class_name}? This will update the master database.`,
                        () => executeImportStudentList(preview, container, inputEl)
                    );
                } else {
                    executeImportStudentList(preview, container, inputEl);
                }
            });
        }
    }

    async function executeImportStudentList(preview, container, inputEl) {
        try {
            const res = await fetch('/api/admin/students/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_name: preview.class_name,
                    parsed_students: preview.parsed_students
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                alert(data.message);
                container.classList.add('hidden');
                inputEl.value = '';
                await loadStudentSummaries();
            } else {
                alert(data.error || 'Failed to import student list.');
            }
        } catch (err) {
            alert('Error importing student list.');
        }
    }


    // Create Test Form
    const createTestForm = document.getElementById('createTestForm');
    if (createTestForm) {
        createTestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(createTestForm);
            const payload = {
                test_number: formData.get('test_number'),
                test_name: formData.get('test_name'),
                test_date: formData.get('test_date'),
                start_time: formData.get('start_time') || '10:00 AM',
                finish_time: formData.get('finish_time') || '11:00 AM',
                total_marks: formData.get('total_marks'),
                status: formData.get('status')
            };

            try {
                const res = await fetch('/api/admin/tests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('Test created successfully!');
                    createTestForm.reset();
                    window.loadAdminDashboard();
                } else {
                    alert(data.error || 'Failed to create test.');
                }
            } catch (err) {
                alert('Server error creating test.');
            }
        });
    }

    // Update Test Status
    window.updateTestStatus = async function(testId, newStatus) {
        try {
            // First fetch existing details
            const resAll = await fetch('/api/admin/tests');
            const tests = await resAll.json();
            const t = tests.find(x => x.id === testId);
            if (!t) return;

            const payload = {
                test_number: t.test_number,
                test_name: t.test_name,
                test_date: t.test_date,
                total_marks: t.total_marks,
                status: newStatus
            };

            const res = await fetch(`/api/admin/tests/${testId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                window.loadAdminDashboard();
            } else {
                alert('Failed to update status.');
            }
        } catch (err) {
            alert('Error updating status.');
        }
    };

    // Confirm Delete Test
    window.confirmDeleteTest = function(testId, testNum) {
        const msg = `Are you sure you want to delete ${testNum}? This will remove test information, uploaded notes/practice questions, question paper, answer key, and all test results. Cognify Scores and Rankings will be recalculated automatically.`;
        showConfirmModal(`Delete Test ${testNum}?`, msg, async () => {
            try {
                const res = await fetch(`/api/admin/tests/${testId}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('Test deleted successfully.');
                    window.loadAdminDashboard();
                } else {
                    alert(data.error || 'Failed to delete test.');
                }
            } catch (err) {
                alert('Error deleting test.');
            }
        });
    };

    // Populate Test Select Dropdowns
    async function populateTestDropdowns() {
        const selects = [
            document.getElementById('excelTestSelect'),
            document.getElementById('resourceTestSelect'),
            document.getElementById('syllabusTestSelect')
        ];

        try {
            const res = await fetch('/api/admin/tests');
            const tests = await res.json();

            selects.forEach(sel => {
                if (!sel) return;
                sel.innerHTML = `<option value="">-- Select Test --</option>`;
                if (Array.isArray(tests)) {
                    tests.forEach(t => {
                        sel.innerHTML += `<option value="${t.id}">${t.test_number} - ${t.test_name} (${t.status})</option>`;
                    });
                }
            });
        } catch (err) {
            console.error('Failed populating test dropdowns');
        }
    }

    // 2. Excel Results Upload & Validation Flow
    const excelDropzone = document.getElementById('excelDropzone');
    const excelFileInput = document.getElementById('excelFileInput');
    const excelTestSelect = document.getElementById('excelTestSelect');
    const excelPreviewContainer = document.getElementById('excelPreviewContainer');

    if (excelDropzone && excelFileInput) {
        excelDropzone.addEventListener('click', () => excelFileInput.click());
        excelDropzone.addEventListener('dragover', (e) => { e.preventDefault(); excelDropzone.style.borderColor = 'var(--accent-primary)'; });
        excelDropzone.addEventListener('dragleave', () => { excelDropzone.style.borderColor = 'var(--border-subtle)'; });
        excelDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            excelDropzone.style.borderColor = 'var(--border-subtle)';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                excelFileInput.files = e.dataTransfer.files;
                handleExcelValidation();
            }
        });

        excelFileInput.addEventListener('change', handleExcelValidation);
    }

    let activeValidationData = null;

    async function handleExcelValidation() {
        const testId = excelTestSelect.value;
        if (!testId) {
            alert('Please select a test first.');
            excelFileInput.value = '';
            return;
        }

        if (!excelFileInput.files || !excelFileInput.files[0]) return;

        const formData = new FormData();
        formData.append('test_id', testId);
        formData.append('file', excelFileInput.files[0]);

        excelPreviewContainer.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Validating Excel sheet...</div>`;
        excelPreviewContainer.classList.remove('hidden');

        try {
            const res = await fetch('/api/admin/results/validate', {
                method: 'POST',
                body: formData
            });

            const preview = await res.json();
            activeValidationData = preview;

            renderExcelPreview(preview);
        } catch (err) {
            excelPreviewContainer.innerHTML = `<div style="color: var(--accent-rose); padding: 16px;">Error validating Excel file.</div>`;
        }
    }

    function renderExcelPreview(preview) {
        if (!preview.valid) {
            let errHtml = `
                <div class="card-box-header">
                    <h3 style="color: var(--accent-rose);"><i data-lucide="x-circle" style="display: inline;"></i> Validation Failed</h3>
                    <p class="card-box-sub">Please fix the following errors in your Excel sheet before uploading.</p>
                </div>
                <ul style="padding-left: 20px; color: #FCA5A5; margin-bottom: 16px;">
            `;
            preview.errors.forEach(err => {
                errHtml += `<li style="margin-bottom: 4px;">${escapeHtml(err)}</li>`;
            });
            errHtml += `</ul>`;
            excelPreviewContainer.innerHTML = errHtml;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = `
            <div class="card-box-header">
                <h3 style="color: var(--accent-emerald);"><i data-lucide="check-circle-2" style="display: inline;"></i> Ready to Publish Results</h3>
                <p class="card-box-sub">${escapeHtml(preview.test_name)} &bull; Validation Passed</p>
            </div>

            <div class="form-grid" style="margin-bottom: 20px;">
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: var(--radius-sm);">
                    <div style="font-size: 12px; color: var(--text-muted);">Students Detected</div>
                    <div style="font-size: 20px; font-weight: 700;">${preview.total_detected} / ${preview.total_master}</div>
                </div>
                <div style="background: rgba(16, 185, 129, 0.1); padding: 12px; border-radius: var(--radius-sm);">
                    <div style="font-size: 12px; color: var(--accent-emerald);">Present Count</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--accent-emerald);">${preview.present_count}</div>
                </div>
                <div style="background: rgba(245, 158, 11, 0.1); padding: 12px; border-radius: var(--radius-sm);">
                    <div style="font-size: 12px; color: var(--accent-amber);">Absent Count (0%)</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--accent-amber);">${preview.absent_count}</div>
                </div>
            </div>
        `;

        if (preview.warnings && preview.warnings.length > 0) {
            html += `<div class="form-error" style="background: rgba(245, 158, 11, 0.15); color: #FCD34D; border-color: rgba(245, 158, 11, 0.3); margin-bottom: 16px;">`;
            preview.warnings.forEach(w => {
                html += `<div><i data-lucide="alert-triangle" style="width: 14px; height: 14px; display: inline;"></i> ${escapeHtml(w)}</div>`;
            });
            html += `</div>`;
        }

        if (preview.results_exist) {
            html += `
                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 12px; border-radius: var(--radius-sm); color: #FCA5A5; margin-bottom: 16px;">
                    <i data-lucide="alert-circle" style="display: inline;"></i> <strong>Warning:</strong> Results for this test already exist. Publishing this sheet will replace existing results and recalculate rankings.
                </div>
            `;
        }

        html += `
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('excelPreviewContainer').classList.add('hidden');">Cancel</button>
                <button type="button" class="btn btn-primary" id="publishResultsBtn">
                    <i data-lucide="upload-cloud"></i> ${preview.results_exist ? 'Replace Existing Results' : 'Publish Results'}
                </button>
            </div>
        `;

        excelPreviewContainer.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();

        document.getElementById('publishResultsBtn').addEventListener('click', () => {
            if (preview.results_exist) {
                showConfirmModal(
                    'Replace Existing Results?',
                    'Results for this test already exist. Uploading this file will replace existing results and recalculate all Cognify Scores and Rankings. Do you wish to continue?',
                    executePublishResults
                );
            } else {
                executePublishResults();
            }
        });
    }

    async function executePublishResults() {
        if (!activeValidationData) return;

        try {
            const res = await fetch('/api/admin/results/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    test_id: activeValidationData.test_id,
                    parsed_records: activeValidationData.parsed_records,
                    missing_regs: activeValidationData.missing_regs
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                alert('Test results published successfully! Cognify Scores & Rankings have been updated.');
                excelPreviewContainer.classList.add('hidden');
                excelFileInput.value = '';
                window.loadAdminDashboard();
            } else {
                alert(data.error || 'Failed to publish test results.');
            }
        } catch (err) {
            alert('Error publishing results.');
        }
    }

    // 3. Upload Resources Form
    const uploadResourceForm = document.getElementById('uploadResourceForm');
    if (uploadResourceForm) {
        uploadResourceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(uploadResourceForm);

            try {
                const res = await fetch('/api/admin/resources/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('Resource uploaded successfully!');
                    uploadResourceForm.reset();
                } else {
                    alert(data.error || 'Failed to upload resource.');
                }
            } catch (err) {
                alert('Error uploading resource.');
            }
        });
    }

    // 4. Add Syllabus Form
    const addSyllabusForm = document.getElementById('addSyllabusForm');
    if (addSyllabusForm) {
        addSyllabusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addSyllabusForm);
            const rawTopics = formData.get('topics') || '';
            const topics = rawTopics.split(/[\n,]/).map(t => t.strip ? t.strip() : t.trim()).filter(Boolean);

            const payload = {
                test_id: formData.get('test_id'),
                category_name: formData.get('category_name'),
                topics: topics
            };

            try {
                const res = await fetch('/api/admin/syllabus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    alert('Syllabus category added successfully!');
                    addSyllabusForm.reset();
                } else {
                    alert(data.error || 'Failed to save syllabus.');
                }
            } catch (err) {
                alert('Error saving syllabus.');
            }
        });
    }

    async function renderWorkspaceAuditLogs() {
        const container = document.getElementById('wsAuditLogsTableContainer');
        if (!container) return;

        try {
            const res = await fetch('/api/admin/audit-logs');
            const logs = await res.json();
            if (!logs || logs.length === 0) {
                container.innerHTML = `<div style="padding: 24px; color: var(--text-muted); text-align: center;">No audit log entries recorded yet.</div>`;
                return;
            }

            let html = `
                <table class="ranking-table" style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th style="width: 150px;">Timestamp</th>
                            <th>Action</th>
                            <th>Test ID</th>
                            <th>Registration No</th>
                            <th>Previous Value</th>
                            <th>New Value</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            logs.forEach(l => {
                html += `
                    <tr>
                        <td style="color: var(--text-muted); font-size: 12px;">${l.timestamp}</td>
                        <td style="font-weight: 700; color: var(--accent-sky);">${escapeHtml(l.action)}</td>
                        <td>${l.test_id || '--'}</td>
                        <td style="font-family: monospace;">${l.registration_no || '--'}</td>
                        <td style="color: var(--text-secondary);">${escapeHtml(l.previous_value || '--')}</td>
                        <td style="font-weight: 600; color: var(--accent-emerald);">${escapeHtml(l.new_value || '--')}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
        } catch (err) {
            container.innerHTML = `<div style="padding: 20px; color: var(--accent-rose);">Failed to fetch audit logs.</div>`;
        }
    }

    const refreshAuditLogBtn = document.getElementById('refreshAuditLogBtn');
    if (refreshAuditLogBtn) {
        refreshAuditLogBtn.addEventListener('click', renderWorkspaceAuditLogs);
    }

    async function loadAdminDashboardStats() {
        try {
            const res = await fetch('/api/admin/dashboard-stats');
            const data = await res.json();
            if (!res.ok) return;

            document.getElementById('dashStatTotalStudents').textContent = data.total_students || 0;
            document.getElementById('dashStatSYCount').textContent = data.class_counts.SY || 0;
            document.getElementById('dashStatTYCount').textContent = data.class_counts.TY || 0;
            document.getElementById('dashStatFYCount').textContent = data.class_counts['Final Year'] || 0;

            document.getElementById('dashStatUpcomingTests').textContent = data.tests_summary.upcoming || 0;
            document.getElementById('dashStatCurrentTests').textContent = data.tests_summary.current || 0;
            document.getElementById('dashStatCompletedTests').textContent = data.tests_summary.completed || 0;
            document.getElementById('dashStatPublishedTests').textContent = data.tests_summary.published || 0;

            document.getElementById('adminDashLastUpdated').innerHTML = `<i data-lucide="clock"></i> Last Updated: ${data.last_updated}`;
            if (window.lucide) window.lucide.createIcons();
        } catch (err) {
            console.error('Failed to load admin dashboard stats:', err);
        }
    }

    async function loadMasterStudentSummary() {
        try {
            const res = await fetch('/api/admin/students/summary');
            const data = await res.json();

            if (document.getElementById('syStudentCountBadge')) document.getElementById('syStudentCountBadge').textContent = `${data.SY || 0} Students`;
            if (document.getElementById('tyStudentCountBadge')) document.getElementById('tyStudentCountBadge').textContent = `${data.TY || 0} Students`;
            if (document.getElementById('fyStudentCountBadge')) document.getElementById('fyStudentCountBadge').textContent = `${data['Final Year'] || 0} Students`;
        } catch (err) {
            console.error('Failed loading student summary:', err);
        }
    }

    let pendingStudentListData = null;

    function initStudentListFileInputs() {
        ['sy', 'ty', 'fy'].forEach(prefix => {
            const classNameMap = { 'sy': 'SY', 'ty': 'TY', 'fy': 'Final Year' };
            const input = document.getElementById(`${prefix}StudentFileInput`);
            if (input) {
                input.addEventListener('change', async (e) => {
                    if (!e.target.files || !e.target.files[0]) return;
                    const file = e.target.files[0];
                    const className = classNameMap[prefix];

                    const formData = new FormData();
                    formData.append('class_name', className);
                    formData.append('file', file);

                    try {
                        const res = await fetch('/api/admin/students/validate', {
                            method: 'POST',
                            body: formData
                        });
                        const preview = await res.json();
                        pendingStudentListData = preview;
                        renderStudentListImportModal(preview, className);
                    } catch (err) {
                        alert('Error validating student list file.');
                    }
                });
            }
        });
    }

    function renderStudentListImportModal(preview, className) {
        const modal = document.getElementById('studentListImportModal');
        if (!modal) return;

        document.getElementById('studentListModalClass').textContent = className;
        document.getElementById('studentListModalTotal').textContent = preview.total_detected || 0;
        document.getElementById('studentListModalValid').textContent = preview.valid_count || 0;
        document.getElementById('studentListModalExisting').textContent = preview.existing_count || 0;

        const errorsContainer = document.getElementById('studentListErrorsContainer');
        const errorsList = document.getElementById('studentListErrorsList');
        const confirmBtn = document.getElementById('confirmStudentListImportBtn');

        if (!preview.valid) {
            errorsList.innerHTML = preview.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('');
            errorsContainer.classList.remove('hidden');
            confirmBtn.disabled = true;
            confirmBtn.style.opacity = '0.5';
        } else {
            errorsContainer.classList.add('hidden');
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
        }

        const tbody = document.getElementById('studentListPreviewTbody');
        let html = '';
        (preview.parsed_students || []).slice(0, 100).forEach(s => {
            html += `
                <tr>
                    <td>${escapeHtml(s.roll_no)}</td>
                    <td>${escapeHtml(s.name)}</td>
                    <td style="font-family: monospace;">${escapeHtml(s.registration_no)}</td>
                    <td>${escapeHtml(s.class_name)}</td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        modal.classList.remove('hidden');
    }

    const cancelStudentListImportBtn = document.getElementById('cancelStudentListImportBtn');
    const closeStudentListModalBtn = document.getElementById('closeStudentListModalBtn');
    const confirmStudentListImportBtn = document.getElementById('confirmStudentListImportBtn');

    if (cancelStudentListImportBtn) cancelStudentListImportBtn.addEventListener('click', () => document.getElementById('studentListImportModal')?.classList.add('hidden'));
    if (closeStudentListModalBtn) closeStudentListModalBtn.addEventListener('click', () => document.getElementById('studentListImportModal')?.classList.add('hidden'));

    if (confirmStudentListImportBtn) {
        confirmStudentListImportBtn.addEventListener('click', async () => {
            if (!pendingStudentListData || !pendingStudentListData.valid) return;

            try {
                const res = await fetch('/api/admin/students/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        class_name: pendingStudentListData.class_name,
                        parsed_students: pendingStudentListData.parsed_students
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    alert(data.message || 'Student list imported successfully!');
                    document.getElementById('studentListImportModal').classList.add('hidden');
                    loadMasterStudentSummary();
                    loadAdminDashboardStats();
                } else {
                    alert(data.error || 'Failed to import student list.');
                }
            } catch (err) {
                alert('Error submitting student list import.');
            }
        });
    }

    // Initialize initial loads
    loadAdminDashboardStats();
    loadMasterStudentSummary();
    initStudentListFileInputs();

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
