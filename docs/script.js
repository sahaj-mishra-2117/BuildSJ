/* =========================================
   BUILD SJ - CONGRATULATIONS ANIMATION
   ========================================= */

let previousFocus;

function showCongratulations() {

    const popup = document.getElementById(
        "congrats-popup"
    );

    if (!popup || !popup.hidden) return;

    previousFocus = document.activeElement;

    popup.hidden = false;

    popup.querySelector(".congrats-close").focus();

    if (window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches) {
        return;
    }

    const colors = [
        "#10432F",
        "#209c70",
        "#ffffff",
        "#FFD700",
        "#3e6ae1",
        "#FF6B6B"
    ];

    for (let i = 0; i < 100; i++) {

        const confetti = document.createElement("div");

        confetti.className = "confetti-piece";

        confetti.setAttribute("aria-hidden", "true");

        confetti.style.left =
            Math.random() * 100 + "vw";

        confetti.style.backgroundColor =
            colors[Math.floor(
                Math.random() * colors.length
            )];

        confetti.style.animationDelay =
            Math.random() * 1.5 + "s";

        confetti.style.animationDuration =
            2 + Math.random() * 2 + "s";

        document.body.appendChild(confetti);

        setTimeout(() => {
            confetti.remove();
        }, 6000);
    }
}

function closeCongratulations() {

    const popup = document.getElementById(
        "congrats-popup"
    );

    if (!popup) return;

    popup.hidden = true;

    document.querySelectorAll(
        ".confetti-piece"
    ).forEach(piece => piece.remove());

    const submitButton = document.getElementById(
        "submit-checklist"
    );

    if (previousFocus && !previousFocus.disabled) {
        previousFocus.focus();
    } else {
        submitButton?.focus();
    }
}

document.addEventListener("keydown", function(event) {

    const popup = document.getElementById(
        "congrats-popup"
    );

    if (!popup || popup.hidden) return;

    if (event.key === "Escape") {
        closeCongratulations();
    }

    if (event.key === "Tab") {
        event.preventDefault();
        popup.querySelector(".congrats-close").focus();
    }
});


/* =========================================
   CHECKLIST FUNCTIONALITY
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {

    const checkboxes =
        document.querySelectorAll(".task-item");

    const progressBar =
        document.getElementById("progress-bar");

    const progressText =
        document.getElementById("progress-text");

    const submitButton =
        document.getElementById("submit-checklist");

    const submitStatus =
        document.getElementById("submit-status");

    if (!submitButton || !progressBar ||
        !progressText || !submitStatus) return;

    submitButton.disabled = true;

    let progressSavePromise = null;
    let pendingProgressSave = null;
    let autosaveTimer = null;

    /* Redirect to login */

    function redirectToLogin() {

        const loginUrl = new URL(
            "login.html",
            window.location.href
        );

        loginUrl.searchParams.set(
            "returnTo",
            "checklist.html"
        );

        window.location.assign(loginUrl);
    }

    /* Verify database save */

    async function readBack(
        session,
        column,
        percentage,
        checkedIn,
        tasksCompleted
    ) {

        const value = column === "id"
            ? session.user.id
            : session.user.email;

        if (!value) {
            return { state: "nomatch" };
        }

        let query = supabaseClient
            .from("profiles")
            .select(
                "email, checked_in, progress_percentage, tasks_completed"
            );

        query = column === "id"
            ? query.eq(column, value)
            : query.ilike(column, value);

        const { data, error } = await query.limit(1);

        if (error) {
            return {
                state: "error",
                message: error.message
            };
        }

        if (!data || data.length === 0) {
            return { state: "nomatch" };
        }

        const saved =
            data[0].checked_in === checkedIn &&
            data[0].progress_percentage === percentage &&
            data[0].tasks_completed === tasksCompleted;

        return {
            state: saved ? "saved" : "notsaved",
            row: data[0]
        };
    }

    /* Save progress to Supabase */

    async function setCheckedIn(
        session,
        percentage,
        checkedIn,
        tasksCompleted
    ) {

        const user = session.user;

        let blocked = null;

        for (const column of ["id", "email"]) {

            const value = column === "id"
                ? user.id
                : user.email;

            if (!value) continue;

            let update = supabaseClient
                .from("profiles")
                .update({
                    checked_in: checkedIn,
                    progress_percentage: percentage,
                    tasks_completed: tasksCompleted
                });

            update = column === "id"
                ? update.eq(column, value)
                : update.ilike(column, value);

            const { error } = await update;

            if (error) {

                blocked = blocked || error.message;

                console.warn(
                    `Update by ${column} was refused`,
                    error.message
                );

                continue;
            }

            const check = await readBack(
                session,
                column,
                percentage,
                checkedIn,
                tasksCompleted
            );

            if (check.state === "saved") {

                console.log(
                    `${percentage}% progress saved successfully`
                );

                return true;
            }

            if (check.state === "notsaved") {

                blocked = blocked ||
                    "The update was accepted but the row did not change.";

                continue;
            }

            if (check.state === "error") {

                console.warn(
                    "Write accepted, but verification was denied.",
                    check.message
                );

                return true;
            }
        }

        /* Create a profile if one does not exist */

        if (!blocked) {

            const { error } = await supabaseClient
                .from("profiles")
                .insert({
                    id: user.id,
                    email: user.email,
                    checked_in: checkedIn,
                    progress_percentage: percentage,
                    tasks_completed: tasksCompleted
                });

            if (!error) {

                console.log(
                    "Profile created and progress saved."
                );

                return true;
            }

            blocked = error.message;
        }

        console.error(
            "Could not save progress:",
            blocked || "No matching profile."
        );

        return false;
    }

    /* Manage progress saving */

    function saveProgress(
        session,
        percentage,
        checkedIn,
        tasksCompleted
    ) {

        pendingProgressSave = {
            session,
            percentage,
            checkedIn,
            tasksCompleted
        };

        if (!progressSavePromise) {

            progressSavePromise = (async () => {

                let saved = false;

                while (pendingProgressSave) {

                    const pending = pendingProgressSave;

                    pendingProgressSave = null;

                    try {

                        saved = await setCheckedIn(
                            pending.session,
                            pending.percentage,
                            pending.checkedIn,
                            pending.tasksCompleted
                        );

                    } catch (error) {

                        console.error(
                            "Could not save progress:",
                            error.message || error
                        );

                        saved = false;
                    }
                }

                return saved;

            })().finally(() => {

                progressSavePromise = null;

            });
        }

        return progressSavePromise;
    }

    /* Cancel scheduled autosave */

    function cancelScheduledAutosave() {

        if (autosaveTimer === null) return;

        clearTimeout(autosaveTimer);

        autosaveTimer = null;
    }

    /* Calculate checklist completion */

    function getProgressState() {

        const total = checkboxes.length;

        const checkedCount = Array.from(
            checkboxes
        ).filter(
            checkbox => checkbox.checked
        ).length;

        const percentage = total > 0
            ? Math.round((checkedCount / total) * 100)
            : 0;

        return {
            checkedCount,
            total,
            percentage
        };
    }

    /* Save current progress */

    async function saveCurrentProgress() {

        cancelScheduledAutosave();

        await checklistReady;

        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        if (!data.session) return true;

        const {
            checkedCount,
            percentage
        } = getProgressState();

        return saveProgress(
            data.session,
            percentage,
            percentage === 100,
            checkedCount
        );
    }

    /* Automatic saving */

    function scheduleAutosave() {

        cancelScheduledAutosave();

        autosaveTimer = window.setTimeout(() => {

            autosaveTimer = null;

            saveCurrentProgress().then(saved => {

                if (!saved) {

                    submitStatus.textContent =
                        "Auto-save failed. Use Save & Submit Progress to retry.";

                } else if (
                    submitStatus.textContent ===
                    "Auto-save failed. Use Save & Submit Progress to retry."
                ) {

                    submitStatus.textContent = "";
                }

            }).catch(error => {

                console.error(
                    "Could not autosave:",
                    error.message || error
                );

                submitStatus.textContent =
                    "Auto-save failed. Use Save & Submit Progress to retry.";
            });

        }, 500);
    }

    /* Update progress bar */

    function updateProgress() {

        const {
            checkedCount,
            total,
            percentage
        } = getProgressState();

        progressBar.value = percentage;

        progressText.textContent =
            `${percentage}% (${checkedCount} of ${total} tasks completed)`;

        progressBar.classList.toggle(
            "not-started",
            percentage <= 25
        );

        progressBar.classList.toggle(
            "below-halfway",
            percentage > 25 && percentage < 50
        );

        progressBar.classList.toggle(
            "halfway-past",
            percentage >= 50 && percentage < 70
        );

        progressBar.classList.toggle(
            "almost-done",
            percentage >= 70 && percentage < 100
        );

        progressBar.classList.toggle(
            "complete",
            percentage === 100
        );
    }

    /* =========================================
       SUBMIT BUTTON AND CELEBRATION
       ========================================= */

    submitButton.addEventListener("click", async () => {

        cancelScheduledAutosave();

        submitButton.disabled = true;

        submitStatus.textContent = "Saving progress...";

        try {

            const { data, error } =
                await supabaseClient.auth.getSession();

            if (error) throw error;

            if (!data.session) {

                redirectToLogin();

                return;
            }

            const {
                checkedCount,
                percentage
            } = getProgressState();

            const checkedIn = percentage === 100;

            const saved = await saveProgress(
                data.session,
                percentage,
                checkedIn,
                checkedCount
            );

            if (saved) {

                submitStatus.textContent =
                    `Your ${percentage}% progress and check-in status have been submitted.`;

                /* Show animation at 100% completion */

                if (
                    checkedIn &&
                    getProgressState().percentage === 100
                ) {

                    submitStatus.textContent =
                        "Congratulations! Your checklist is complete.";

                    showCongratulations();
                }

            } else {

                submitStatus.textContent =
                    "We couldn't process your check-in. Please try again.";
            }

        } catch (error) {

            console.error(
                "Could not submit checklist:",
                error.message || error
            );

            submitStatus.textContent =
                "We couldn't process your check-in. Please try again.";

        } finally {

            submitButton.disabled = false;
        }
    });

    /* =========================================
       INITIALIZE CHECKLIST
       ========================================= */

    async function initializeChecklist() {

        checkboxes.forEach(checkbox => {

            checkbox.disabled = true;
        });

        let session = null;

        try {

            const { data, error } =
                await supabaseClient.auth.getSession();

            if (error) throw error;

            session = data.session;

        } catch (error) {

            console.error(
                "Could not check sign-in status:",
                error.message || error
            );
        }

        checkboxes.forEach(checkbox => {

            const storageKey =
                `buildSJ.checklist.${checkbox.id}`;

            checkbox.checked =
                !!session &&
                localStorage.getItem(storageKey) === "true";

            let savedChecked = checkbox.checked;

            checkbox.addEventListener(
                "change",
                async () => {

                    const requestedValue = checkbox.checked;

                    checkbox.disabled = true;

                    try {

                        const { data, error } =
                            await supabaseClient.auth.getSession();

                        if (error) throw error;

                        if (!data.session) {

                            checkbox.checked = savedChecked;

                            redirectToLogin();

                            return;
                        }

                        savedChecked = requestedValue;

                        localStorage.setItem(
                            storageKey,
                            String(savedChecked)
                        );

                        updateProgress();

                        scheduleAutosave();

                    } catch (error) {

                        checkbox.checked = savedChecked;

                        console.error(
                            "Could not check sign-in status:",
                            error.message || error
                        );

                    } finally {

                        checkbox.disabled = false;
                    }
                }
            );

            checkbox.disabled = false;
        });

        updateProgress();

        submitButton.disabled = false;

        if (session) {
            scheduleAutosave();
        }
    }

    const checklistReady = initializeChecklist();

});