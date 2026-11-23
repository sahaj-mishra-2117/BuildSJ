// This was AI'd completely but seems easy to understand.

// Wait for the HTML document to fully load before running code
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. Grab all the HTML elements we need to talk to
  const checkboxes = document.querySelectorAll(".task-item");
  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");

  // Marks the profile row as checked in. Only runs once per page load,
  // because we don't want a database write on every single click.
  let checkedInSaved = false;

  async function markCheckedIn() {
    if (checkedInSaved || typeof supabaseClient === "undefined") return;
    checkedInSaved = true;

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return; // not logged in: checklist still works locally

    const { error } = await supabaseClient
      .from("profiles")
      .update({ "checked-in": true })
      .eq("email", session.user.email);

    if (error) {
      console.error("Could not save check-in:", error.message);
      checkedInSaved = false; // let the next checkbox click try again
    }
  }

  // 2. Define the mathematical function that updates the numbers
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

    progressBar.classList.toggle("not-started", percentage <= 25);
    progressBar.classList.toggle("below-halfway", percentage > 25 && percentage < 50);
    progressBar.classList.toggle("halfway-past", percentage >= 50 && percentage < 70);
    progressBar.classList.toggle("almost-done", percentage >= 70 && percentage < 100);
    progressBar.classList.toggle("complete", percentage === 100);

    // 100% of the list done = checked in
    if (percentage === 100) markCheckedIn();
  }

  // 3. Tell every checkbox to trigger our function whenever a user clicks it
  checkboxes.forEach(checkbox => {
    const storageKey = `buildSJ.checklist.${checkbox.id}`;
    checkbox.checked = localStorage.getItem(storageKey) === "true"; // Load saved state
    checkbox.addEventListener("change", () => {
      localStorage.setItem(storageKey, String(checkbox.checked)); // Save state on change
      updateProgress(); // Update progress bar and text
    });
  });

  // 4. Run the function once immediately so it accurately displays 0% on page load
  updateProgress();
});
