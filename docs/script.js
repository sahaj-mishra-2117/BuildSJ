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

  // Writes checked_in = true to the signed-in user's row in `profiles`.
  // Tries the auth user id first, then the email column, so it works whichever
  // one the row happens to be keyed on.
  async function setCheckedIn(session) {
    const user = session.user;

    const targets = [
      { column: "id", value: user.id, exact: true },
      { column: "email", value: user.email, exact: false },
    ];

    for (const { column, value, exact } of targets) {
      if (!value) continue;

      const match = query => (exact ? query.eq(column, value) : query.ilike(column, value));

      const { error } = await match(
        supabaseClient.from("profiles").update({ checked_in: true })
      );

      if (error) {
        console.warn(`checked_in: could not save by ${column}:`, error.message);
        continue;
      }

      // An UPDATE that matches zero rows is not an error, so read it back.
      const { data, error: readError } = await match(
        supabaseClient.from("profiles").select("email, checked_in")
      ).limit(1);

      if (readError) {
        console.warn(`checked_in: saved by ${column}, but read-back failed:`, readError.message);
        return true; // the write itself was accepted
      }

      if (data && data.length > 0 && data[0].checked_in === true) {
        console.log(`checked_in = true for ${data[0].email || value} (matched by ${column})`);
        return true;
      }

      console.warn(`checked_in: no profiles row matched by ${column} = ${value}`);
    }

    console.error(
      "Could not set checked_in = true. The row exists but the RLS UPDATE policy likely blocks it."
    );
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

  // 3. Set up every checkbox: restore saved state, then handle ticks.
  // Login is enforced for the whole page by protect.js, so the browser does
  // the toggling itself and no click is ever swallowed.
  checkboxes.forEach(checkbox => {
    const storageKey = `buildSJ.checklist.${checkbox.id}`;
    checkbox.checked = localStorage.getItem(storageKey) === "true"; // Load saved state

    checkbox.addEventListener("change", () => {
      localStorage.setItem(storageKey, String(checkbox.checked)); // Save state on change
      updateProgress(); // Update progress bar, text, and (at 100%) save checked_in
    });
  });

  // 4. Run once immediately so the bar shows the right value on page load
  updateProgress();
});
