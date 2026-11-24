// Wait for the HTML document to fully load before running code
document.addEventListener("DOMContentLoaded", () => {

  // 1. Grab all the HTML elements we need to talk to
  const checkboxes = document.querySelectorAll(".task-item");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const submitButton = document.getElementById("submit-checklist");
  const submitStatus = document.getElementById("submit-status");
  submitButton.disabled = true;

  let progressSavePromise = null;
  let pendingProgressSave = null;
  let autosaveTimer = null;

  function redirectToLogin() {
    const loginUrl = new URL("login.html", window.location.href);
    loginUrl.searchParams.set("returnTo", "checklist.html");
    window.location.assign(loginUrl);
  }

  // Reads the signed-in user's row back. An UPDATE that matches no rows is not
  // an error in Postgres, so this is the only way to know a save really landed.
  async function readBack(session, column, percentage, checkedIn) {
    const value = column === "id" ? session.user.id : session.user.email;
    if (!value) return { state: "nomatch" };

    let query = supabaseClient.from("profiles").select("email, checked_in, progress_percentage");
    query = column === "id" ? query.eq(column, value) : query.ilike(column, value);

    const { data, error } = await query.limit(1);

    if (error) return { state: "error", message: error.message };
    if (!data || data.length === 0) return { state: "nomatch" };
    const saved = data[0].checked_in === checkedIn
      && data[0].progress_percentage === percentage;
    return { state: saved ? "saved" : "notsaved", row: data[0] };
  }

  // Writes the check-in flag and submitted progress to the user's profile.
  // Tries the auth user id first, then the email column, so it works whichever
  // one the row happens to be keyed on.
  async function setCheckedIn(session, percentage, checkedIn) {
    const user = session.user;
    let blocked = null; // first database error we hit (permissions, RLS, ...)

    for (const column of ["id", "email"]) {
      const value = column === "id" ? user.id : user.email;
      if (!value) continue;

      let update = supabaseClient.from("profiles").update({
        checked_in: checkedIn,
        progress_percentage: percentage,
      });
      update = column === "id" ? update.eq(column, value) : update.ilike(column, value);

      const { error } = await update;
      if (error) {
        blocked = blocked || error.message;
        console.warn(`checked_in: update by ${column} was refused -`, error.message);
        continue;
      }

      const check = await readBack(session, column, percentage, checkedIn);

      if (check.state === "saved") {
        console.log(`Check-in status and ${percentage}% progress saved for ${check.row.email || value} (matched by ${column})`);
        return true;
      }

      if (check.state === "notsaved") {
        // Row is there but unchanged: row level security silently dropped the write.
        blocked = blocked || "the update was accepted but the row did not change (RLS UPDATE policy)";
        console.warn(`checked_in: row matched by ${column}, but the value did not change.`);
        continue;
      }

      if (check.state === "error") {
        // Write accepted, verification not permitted.
        console.warn(`checked_in: saved by ${column}, but the read-back was denied -`, check.message);
        return true;
      }
    }

    // Nothing to update means this user has no profiles row yet. Create one so
    // the flag has somewhere to live (needs an INSERT policy on profiles).
    if (!blocked) {
      const { error } = await supabaseClient
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          checked_in: checkedIn,
          progress_percentage: percentage,
        });

      if (!error) {
        console.log(`Check-in status and ${percentage}% progress saved (created a profiles row)`);
        return true;
      }

      console.warn("checked_in: could not create a profiles row -", error.message);
      blocked = error.message;
    }

    console.error("Could not save check-in status and progress -", blocked || "no profiles row matched");
    return false;
  }

  function saveProgress(session, percentage, checkedIn) {
    pendingProgressSave = { session, percentage, checkedIn };

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
              pending.checkedIn
            );
          } catch (error) {
            console.error("Could not save check-in:", error.message || error);
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

  function cancelScheduledAutosave() {
    if (autosaveTimer === null) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }

  function getProgressState() {
    const total = checkboxes.length;
    const checkedCount = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
    const percentage = total > 0 ? Math.round((checkedCount / total) * 100) : 0;
    return { checkedCount, total, percentage };
  }

  async function saveCurrentProgress() {
    cancelScheduledAutosave();
    await checklistReady;
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) return true;

    const { percentage } = getProgressState();
    return saveProgress(data.session, percentage, percentage === 100);
  }

  function scheduleAutosave() {
    cancelScheduledAutosave();
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null;
      saveCurrentProgress().then(saved => {
        submitStatus.textContent = saved
          ? "Progress saved automatically."
          : "Auto-save failed. Use Save & Submit Progress to retry.";
      }).catch(error => {
        console.error("Could not autosave checklist progress:", error.message || error);
        submitStatus.textContent = "Auto-save failed. Use Save & Submit Progress to retry.";
      });
    }, 500);
  }

  // 2. Define the function that updates the progress numbers and bar
  function updateProgress() {
    const { checkedCount, total, percentage } = getProgressState();

    // Change the visual loading bar width/value
    progressBar.value = percentage;

    // Change the text below or next to the bar
    progressText.textContent = `${percentage}% (${checkedCount} of ${total} tasks completed)`;

    // Color the bar based on how far along the user is
    progressBar.classList.toggle("not-started", percentage <= 25);
    progressBar.classList.toggle("below-halfway", percentage > 25 && percentage < 50);
    progressBar.classList.toggle("halfway-past", percentage >= 50 && percentage < 70);
    progressBar.classList.toggle("almost-done", percentage >= 70 && percentage < 100);
    progressBar.classList.toggle("complete", percentage === 100);

  }

  submitButton.addEventListener("click", async () => {
    cancelScheduledAutosave();
    submitButton.disabled = true;
    submitStatus.textContent = "";

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;

      if (!data.session) {
        redirectToLogin();
        return;
      }

      const { percentage } = getProgressState();
      const checkedIn = percentage === 100;

      if (await saveProgress(data.session, percentage, checkedIn)) {
        submitStatus.textContent = `Your ${percentage}% progress and check-in status have been submitted.`;
      } else {
        submitStatus.textContent = "We couldn't process your check-in. Please try again.";
      }
    } catch (error) {
      console.error("Could not submit checklist:", error.message || error);
      submitStatus.textContent = "We couldn't process your check-in. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });

  // 3. Set up every checkbox: restore saved state for signed-in users, then
  // ask visitors to sign in only when they try to track an item.
  async function initializeChecklist() {
    checkboxes.forEach(checkbox => {
      checkbox.disabled = true;
    });

    let session = null;
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (error) {
      console.error("Could not check sign-in status:", error.message || error);
    }

    checkboxes.forEach(checkbox => {
      const storageKey = `buildSJ.checklist.${checkbox.id}`;
      checkbox.checked = !!session && localStorage.getItem(storageKey) === "true";
      let savedChecked = checkbox.checked;

      checkbox.addEventListener("change", async () => {
        const requestedValue = checkbox.checked;
        checkbox.disabled = true;

        try {
          const { data, error } = await supabaseClient.auth.getSession();
          if (error) throw error;

          if (!data.session) {
            checkbox.checked = savedChecked;
            redirectToLogin();
            return;
          }

          savedChecked = requestedValue;
          localStorage.setItem(storageKey, String(savedChecked));
          updateProgress();
          scheduleAutosave();
        } catch (error) {
          checkbox.checked = savedChecked;
          console.error("Could not check sign-in status:", error.message || error);
        } finally {
          checkbox.disabled = false;
        }
      });
      checkbox.disabled = false;
    });

    // 4. Run once immediately so the bar shows the right value on page load
    updateProgress();
    submitButton.disabled = false;
    if (session) scheduleAutosave();
  }

  const checklistReady = initializeChecklist();
});
