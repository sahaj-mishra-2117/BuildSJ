/* =========================================
   BUILD SJ - CHECKLIST FUNCTIONALITY
   ========================================= */

let previousFocus;

function showCongratulations() {
    const popup = document.getElementById("congrats-popup");
    if (!popup || !popup.hidden) return;

    previousFocus = document.activeElement;
    popup.hidden = false;
    popup.querySelector(".congrats-close").focus();

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const colors = ["#10432F", "#209c70", "#ffffff", "#FFD700", "#3e6ae1", "#FF6B6B"];

    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement("div");
        confetti.className = "confetti-piece";
        confetti.setAttribute("aria-hidden", "true");
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = `${Math.random() * 1.5}s`;
        confetti.style.animationDuration = `${2 + Math.random() * 2}s`;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 6000);
    }
}

function closeCongratulations() {
    const popup = document.getElementById("congrats-popup");
    if (!popup) return;

    popup.hidden = true;
    document.querySelectorAll(".confetti-piece").forEach(piece => piece.remove());

    const submitButton = document.getElementById("submit-checklist");
    if (previousFocus && !previousFocus.disabled) {
        previousFocus.focus();
    } else {
        submitButton?.focus();
    }
}

document.addEventListener("keydown", event => {
    const popup = document.getElementById("congrats-popup");
    if (!popup || popup.hidden) return;

    if (event.key === "Escape") closeCongratulations();
    if (event.key === "Tab") {
        event.preventDefault();
        popup.querySelector(".congrats-close").focus();
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const checkboxes = Array.from(document.querySelectorAll(".task-item"));
    const checklistTabs = Array.from(document.querySelectorAll(".checklist-tab"));
    const progressBar = document.getElementById("progress-bar");
    const progressText = document.getElementById("progress-text");
    const submitButton = document.getElementById("submit-checklist");
    const submitStatus = document.getElementById("submit-status");
    const areaStatus = document.getElementById("neighborhood-count-status");
    const areaList = document.getElementById("neighborhood-count-list");
    const areaChart = document.getElementById("neighborhood-chart");
    const areaAxis = document.getElementById("neighborhood-count-axis");

    if (!checkboxes.length || !submitButton || !progressBar || !progressText || !submitStatus) return;

    const legacyStorageKey = checkbox => `buildSJ.checklist.${checkbox.id}`;

    function activateChecklistTab(selectedTab, moveFocus = false) {
        checklistTabs.forEach(tab => {
            const isSelected = tab === selectedTab;
            const panel = document.getElementById(tab.getAttribute("aria-controls"));

            tab.setAttribute("aria-selected", String(isSelected));
            tab.tabIndex = isSelected ? 0 : -1;
            if (panel) panel.hidden = !isSelected;
        });

        if (moveFocus) selectedTab.focus();
    }

    function initializeChecklistTabs() {
        if (!checklistTabs.length) return;

        checklistTabs.forEach((tab, index) => {
            tab.addEventListener("click", () => activateChecklistTab(tab));
            tab.addEventListener("keydown", event => {
                let nextIndex = index;
                if (event.key === "ArrowRight") nextIndex = (index + 1) % checklistTabs.length;
                else if (event.key === "ArrowLeft") nextIndex = (index - 1 + checklistTabs.length) % checklistTabs.length;
                else if (event.key === "Home") nextIndex = 0;
                else if (event.key === "End") nextIndex = checklistTabs.length - 1;
                else return;

                event.preventDefault();
                activateChecklistTab(checklistTabs[nextIndex], true);
            });
        });

        const selectedTab = checklistTabs.find(tab => tab.getAttribute("aria-selected") === "true")
            || checklistTabs[0];
        activateChecklistTab(selectedTab);
    }

    function updateTabProgress() {
        checklistTabs.forEach(tab => {
            const panel = document.getElementById(tab.getAttribute("aria-controls"));
            const counter = tab.querySelector("[data-tab-count]");
            if (!panel || !counter) return;

            const items = Array.from(panel.querySelectorAll(".task-item"));
            const complete = items.filter(item => item.checked).length;
            counter.textContent = `${complete}/${items.length}`;
            counter.setAttribute("aria-label", `${complete} of ${items.length} complete`);
        });
    }

    function getProgressState() {
        const checkedCount = checkboxes.filter(checkbox => checkbox.checked).length;
        const percentage = Math.round((checkedCount / checkboxes.length) * 100);
        return { checkedCount, percentage };
    }

    function updateProgress() {
        const { checkedCount, percentage } = getProgressState();
        progressBar.value = percentage;
        progressBar.setAttribute(
            "aria-valuetext",
            `${checkedCount} of ${checkboxes.length} tasks completed (${percentage}%)`
        );
        progressText.textContent = `${percentage}% (${checkedCount} of ${checkboxes.length} tasks completed)`;
        progressBar.classList.toggle("not-started", percentage <= 25);
        progressBar.classList.toggle("below-halfway", percentage > 25 && percentage < 50);
        progressBar.classList.toggle("halfway-past", percentage >= 50 && percentage < 70);
        progressBar.classList.toggle("almost-done", percentage >= 70 && percentage < 100);
        progressBar.classList.toggle("complete", percentage === 100);
        updateTabProgress();
    }

    async function saveAnswer(checkbox, checked) {
        const { error } = await supabaseClient.rpc("set_checklist_answer", {
            p_item_id: checkbox.id,
            p_checked: checked
        });
        if (error) throw error;
    }

    async function loadAnswers(session) {
        const { data, error } = await supabaseClient
            .from("profiles")
            .select("checklist_answers, tasks_completed")
            .eq("id", session.user.id)
            .maybeSingle();

        if (error) throw error;

        const storedAnswers = data?.checklist_answers;
        const answers = storedAnswers &&
            typeof storedAnswers === "object" &&
            !Array.isArray(storedAnswers)
            ? storedAnswers
            : {};

        const hasSavedAnswers = Object.keys(answers).some(id =>
            checkboxes.some(checkbox => checkbox.id === id)
        );
        const savedCheckedCount = checkboxes.filter(checkbox =>
            answers[checkbox.id] === true
        ).length;
        const hasLegacyTotalOnlyProgress = Number(data?.tasks_completed || 0) > savedCheckedCount;

        const migrationKey = `buildSJ.checklist.migrated.${session.user.id}`;
        const migrationInProgress = localStorage.getItem(migrationKey) === "true";
        const legacyAnswers = checkboxes
            .map(checkbox => ({
                checkbox,
                value: localStorage.getItem(legacyStorageKey(checkbox))
            }))
            .filter(answer => answer.value === "true" || answer.value === "false");
        const hasLocalCheckedAnswers = legacyAnswers.some(answer => answer.value === "true");
        const hasBackfilledEmptyAnswers = hasSavedAnswers && savedCheckedCount === 0;
        const shouldImportLegacyAnswers =
            !hasSavedAnswers ||
            hasLegacyTotalOnlyProgress ||
            migrationInProgress ||
            (hasBackfilledEmptyAnswers && hasLocalCheckedAnswers);
        let importedLegacyAnswers = false;

        if (
            shouldImportLegacyAnswers &&
            legacyAnswers.length
        ) {
            importedLegacyAnswers = true;
            localStorage.setItem(migrationKey, "true");

            for (const answer of legacyAnswers) {
                if (
                    hasSavedAnswers &&
                    !hasLegacyTotalOnlyProgress &&
                    !migrationInProgress &&
                    !hasBackfilledEmptyAnswers &&
                    Object.prototype.hasOwnProperty.call(answers, answer.checkbox.id)
                ) {
                    continue;
                }
                await saveAnswer(answer.checkbox, answer.value === "true");
                answers[answer.checkbox.id] = answer.value === "true";
            }

            legacyAnswers.forEach(answer => localStorage.removeItem(legacyStorageKey(answer.checkbox)));
            localStorage.removeItem(migrationKey);
            submitStatus.textContent = "Your saved checklist has been synced to your account.";
        }

        checkboxes.forEach(checkbox => {
            checkbox.checked = answers[checkbox.id] === true;
        });

        if (
            !importedLegacyAnswers &&
            data?.tasks_completed > checkboxes.filter(checkbox => answers[checkbox.id] === true).length
        ) {
            submitStatus.textContent = "Your earlier progress was saved as a total only. Open this checklist on the browser where you last used it to sync individual items.";
        }
    }

    function renderNeighborhoodChart(rows) {
    if (!areaList) return [];
 
    areaList.replaceChildren();
    if (areaChart) areaChart.hidden = true;
    if (areaAxis) areaAxis.replaceChildren();
 
    const entries = (rows || [])
        .map(row => ({
            neighborhood: String(row.neighborhood ?? "").trim(),
            participants: Number(row.participants) || 0
        }))
        .filter(row => row.neighborhood && row.participants > 0)
        .sort((a, b) => b.participants - a.participants || a.neighborhood.localeCompare(b.neighborhood));
 
    if (!entries.length) return entries;
 
    const highest = entries[0].participants;
    const bars = [];
 
    entries.forEach(entry => {
        const item = document.createElement("li");
        item.className = "neighborhood-chart-row";
        item.setAttribute(
            "aria-label",
            `${entry.neighborhood}: ${entry.participants} ${entry.participants === 1 ? "account" : "accounts"} preparing`
        );
 
        const head = document.createElement("div");
        head.className = "neighborhood-chart-row-head";
 
        const name = document.createElement("span");
        name.className = "neighborhood-chart-name";
        name.textContent = entry.neighborhood;
 
        const count = document.createElement("strong");
        count.className = "neighborhood-chart-value";
        count.textContent = String(entry.participants);
 
        head.append(name, count);
 
        const track = document.createElement("div");
        track.className = "neighborhood-chart-track";
        track.setAttribute("aria-hidden", "true");
 
        const bar = document.createElement("span");
        bar.className = "neighborhood-chart-bar";
        track.appendChild(bar);
 
        item.append(head, track);
        areaList.appendChild(item);
 
        bars.push({
            bar,
            percentage: Math.round((entry.participants / highest) * 100)
        });
    });
 
    if (areaAxis) {
        const zero = document.createElement("span");
        zero.textContent = "0";
 
        const top = document.createElement("span");
        top.textContent = `${highest} ${highest === 1 ? "account" : "accounts"}`;
 
        areaAxis.append(zero, top);
        areaAxis.hidden = false;
    }
 
    if (areaChart) areaChart.hidden = false;
 
    // Grow the bars from zero on the next paint so the animation is visible.
    requestAnimationFrame(() => {
        bars.forEach(({ bar, percentage }) => {
            bar.style.setProperty("--bar", `${percentage}%`);
        });
    });
 
    return entries;
}
 
async function loadNeighborhoodCounts() {
    if (!areaStatus || !areaList) return;
 
    try {
        const { data, error } = await supabaseClient.rpc("get_neighborhood_checklist_counts");
        if (error) throw error;
 
        const entries = renderNeighborhoodChart(data);
 
        if (!entries.length) {
            areaStatus.textContent = "No neighborhood totals yet. Counts appear for any area with at least five participating accounts.";
            return;
        }
 
        const total = entries.reduce((sum, entry) => sum + entry.participants, 0);
        areaStatus.textContent =
            `${entries.length} ${entries.length === 1 ? "neighborhood" : "neighborhoods"} · ` +
            `${total} ${total === 1 ? "account" : "accounts"} with at least one item completed. ` +
            "Areas with fewer than five accounts are hidden.";
 
    } catch (error) {
        console.error("Could not load neighborhood checklist totals:", error.message || error);
        areaStatus.textContent = "Neighborhood totals are temporarily unavailable.";
        if (areaList) areaList.replaceChildren();
        if (areaChart) areaChart.hidden = true;
        if (areaAxis) areaAxis.hidden = true;
    }
}


    function redirectToLogin() {
        const loginUrl = new URL("login.html", window.location.href);
        loginUrl.searchParams.set("returnTo", "checklist.html");
        window.location.assign(loginUrl);
    }

    async function initializeChecklist() {
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
        });
        submitButton.disabled = true;

        try {
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) throw error;

            if (data.session) {
                await loadAnswers(data.session);
                if (!submitStatus.textContent) {
                    submitStatus.textContent = "Your checklist is saved to your account and syncs across signed-in devices.";
                }
            } else {
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
                submitStatus.textContent = "Sign in to save your checklist and sync it across devices.";
            }
        } catch (error) {
            console.error("Could not load checklist data:", error.message || error);
            submitStatus.textContent = "We couldn't load your saved checklist. Refresh the page to try again.";
            await loadNeighborhoodCounts();
            return;
        }

        updateProgress();
        checkboxes.forEach(checkbox => {
            let savedChecked = checkbox.checked;
            checkbox.disabled = false;

            checkbox.addEventListener("change", async () => {
                const requestedValue = checkbox.checked;
                const previousCount = getProgressState().checkedCount + (savedChecked ? 1 : -1);
                checkbox.disabled = true;

                try {
                    const { data, error } = await supabaseClient.auth.getSession();
                    if (error) throw error;

                    if (!data.session) {
                        checkbox.checked = savedChecked;
                        redirectToLogin();
                        return;
                    }

                    await saveAnswer(checkbox, requestedValue);
                    savedChecked = requestedValue;
                    updateProgress();
                    submitStatus.textContent = "Saved to your account. Your checklist is available on your other signed-in devices.";
                    if ((previousCount > 0) !== (getProgressState().checkedCount > 0)) {
                        loadNeighborhoodCounts();
                    }
                } catch (error) {
                    checkbox.checked = savedChecked;
                    updateProgress();
                    console.error("Could not save checklist answer:", error.message || error);
                    submitStatus.textContent = "We couldn't sync that change. Please try again.";
                } finally {
                    checkbox.disabled = false;
                }
            });
        });

        submitButton.disabled = false;
        updateProgress();
        loadNeighborhoodCounts();
    }

    submitButton.addEventListener("click", async () => {
        submitButton.disabled = true;
        checkboxes.forEach(checkbox => {
            checkbox.disabled = true;
        });
        submitStatus.textContent = "Saving your checklist...";

        try {
            const { data, error } = await supabaseClient.auth.getSession();
            if (error) throw error;
            if (!data.session) {
                redirectToLogin();
                return;
            }

            const answers = checkboxes.map(checkbox => ({
                checkbox,
                checked: checkbox.checked
            }));
            await Promise.all(answers.map(answer =>
                saveAnswer(answer.checkbox, answer.checked)
            ));

            const { percentage } = getProgressState();
            submitStatus.textContent = `Your ${percentage}% progress is saved to your account and synced across devices.`;

            if (percentage === 100) {
                submitStatus.textContent = "Congratulations! Your checklist is complete.";
                showCongratulations();
            }

            loadNeighborhoodCounts();
        } catch (error) {
            console.error("Could not submit checklist:", error.message || error);
            submitStatus.textContent = "We couldn't save your checklist. Please try again.";
        } finally {
            submitButton.disabled = false;
            checkboxes.forEach(checkbox => {
                checkbox.disabled = false;
            });
        }
    });

    initializeChecklistTabs();
    initializeChecklist();
});
