// Wait for the HTML document to fully load before running code
document.addEventListener("DOMContentLoaded", () => {

  // 1. Grab all the HTML elements we need to talk to
  const checkboxes = document.querySelectorAll(".task-item");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");

  // Marks the profile row as checked in. Saves at most once per page load,
  // because we don't want a database write on every single click.
  let checkedInSaved = false;   // true once the save succeeded
  let checkInInFlight = false;  // true while a save is running (prevents double-saves)

  // Reads the signed-in user's row back. An UPDATE that matches no rows is not
  // an error in Postgres, so this is the only way to know a save really landed.
  async function readBack(session, column) {
    const value = column === "id" ? session.user.id : session.user.email;
    if (!value) return { state: "nomatch" };

    let query = supabaseClient.from("profiles").select("email, checked_in");
    query = column === "id" ? query.eq(column, value) : query.ilike(column, value);

    const { data, error } = await query.limit(1);

    if (error) return { state: "error", message: error.message };
    if (!data || data.length === 0) return { state: "nomatch" };
    return { state: data[0].checked_in === true ? "saved" : "notsaved", row: data[0] };
  }

  // Writes checked_in = true to the signed-in user's row in `profiles`.
  // Tries the auth user id first, then the email column, so it works whichever
  // one the row happens to be keyed on.
  async function setCheckedIn(session) {
    const user = session.user;
    let blocked = null; // first database error we hit (permissions, RLS, ...)

    for (const column of ["id", "email"]) {
      const value = column === "id" ? user.id : user.email;
      if (!value) continue;

      let update = supabaseClient.from("profiles").update({ checked_in: true });
      update = column === "id" ? update.eq(column, value) : update.ilike(column, value);

      const { error } = await update;
      if (error) {
        blocked = blocked || error.message;
        console.warn(`checked_in: update by ${column} was refused -`, error.message);
        continue;
      }

      const check = await readBack(session, column);

      if (check.state === "saved") {
        console.log(`checked_in = true for ${check.row.email || value} (matched by ${column})`);
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
        .insert({ id: user.id, email: user.email, checked_in: true });

      if (!error) {
        console.log("checked_in = true (created a profiles row for this user)");
        return true;
      }

      console.warn("checked_in: could not create a profiles row -", error.message);
      blocked = error.message;
    }

    console.error("Could not set checked_in = true -", blocked || "no profiles row matched");
    return false;
  }

  async function markCheckedIn() {
    if (checkedInSaved || checkInInFlight) return;

    // supabase-client.js declares supabaseClient with `const`, so it is NOT a
    // property of window. Check it by name instead.
    if (typeof supabaseClient === "undefined") return;

    checkInInFlight = true;

    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) throw error;

      if (!session) {
        // The page is login-protected, so this is only a safety net.
        console.warn("Checklist complete, but nobody is logged in - not saving checked_in.");
        return;
      }

      checkedInSaved = await setCheckedIn(session);
    } catch (error) {
      console.error("Could not save check-in:", error.message || error);
    } finally {
      checkInInFlight = false; // release the lock so a later click can retry
    }
  }

  // 2. Define the function that updates the progress numbers and bar
  function updateProgress() {
    const total = checkboxes.length;

    // Count only the checkboxes that are currently checked
    const checkedCount = document.querySelectorAll(".task-item:checked").length;

    // Calculate the percentage (prevents errors if the checklist is empty)
    const percentage = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

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

    // 100% of the list done = checked in (saved to Supabase)
    if (percentage === 100) markCheckedIn();
  }

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
            const loginUrl = new URL("login.html", window.location.href);
            loginUrl.searchParams.set("returnTo", "checklist.html");
            window.location.assign(loginUrl);
            return;
          }

          savedChecked = requestedValue;
          localStorage.setItem(storageKey, String(savedChecked));
          updateProgress();
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
  }

  initializeChecklist();
});
