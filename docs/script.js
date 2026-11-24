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

  async function markCheckedIn() {
    if (checkedInSaved || checkInInFlight) return;

    // supabase-client.js declares supabaseClient with `const`, so it is NOT a
    // property of window. Check it by name instead.
    if (typeof supabaseClient === "undefined") return;

    checkInInFlight = true;

    try {
      const { data: { session }, error: sessionError } =
        await supabaseClient.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session) {
        console.warn("Checklist complete, but nobody is logged in - not saving checked_in.");
        return;
      }

      const email = session.user.email;

      // The profiles column is checked_in (underscore), not "checked-in".
      // No .select() attached, so the write never depends on SELECT rights.
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ checked_in: true })
        .ilike("email", email);

      if (updateError) throw updateError;

      checkedInSaved = true;
      console.log("Saved checked_in = true for", email);

      // Best-effort read-back: an UPDATE that matched zero rows is not an error.
      const { data, error: readError } = await supabaseClient
        .from("profiles")
        .select("email, checked_in")
        .ilike("email", email)
        .limit(1);

      if (readError) {
        console.warn("Saved, but could not read the row back:", readError.message);
      } else if (!data || data.length === 0) {
        console.warn(
          `Saved, but no profiles row matched "${email}". Check the row exists ` +
          "and that an RLS UPDATE policy lets this user update it."
        );
      } else {
        console.log(`profiles row ${data[0].email}: checked_in = ${data[0].checked_in}`);
      }
    } catch (error) {
      console.error("Could not save check-in:", error.message || error);
    } finally {
      checkInInFlight = false; // always release the lock so a later click can retry
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

  // 3. Set up every checkbox: restore saved state, then handle ticks
  // Login is enforced for the whole page by protect.js, so we let the browser
  // do the toggling itself. An event.preventDefault() + await inside a click
  // handler cancels the native toggle, which is why clicking did nothing.
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