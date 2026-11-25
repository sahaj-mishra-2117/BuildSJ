(() => {
  const form = document.getElementById("checklist-address-form");
  const input = document.getElementById("checklist-address-input");
  const suggestions = document.getElementById("checklist-address-suggestions");
  const status = document.getElementById("checklist-address-status");
  const searchBounds = "-121.97,37.15,-121.72,37.3";
  let savedAddress = "";
  let editedByUser = false;
  let searchTimer = null;
  let searchController = null;
 
  function formatAddress(feature) {
    const properties = feature.properties || {};
    const street = properties.street || properties.name;
    const firstLine = properties.housenumber && street
      ? `${properties.housenumber} ${street}`
      : properties.name || street;
    const locality = [properties.city, properties.state, properties.postcode]
      .filter(Boolean)
      .join(", ");
    return [firstLine, locality].filter(Boolean).join(", ");
  }
 
  function closeSuggestions() {
    suggestions.hidden = true;
    suggestions.replaceChildren();
    input.setAttribute("aria-expanded", "false");
  }
 
  function renderSuggestions(features) {
    suggestions.replaceChildren();
    const entries = [];
    if (savedAddress) {
      entries.push({ label: savedAddress, feature: null, saved: true });
    }
 
    features.forEach(feature => {
      const label = formatAddress(feature);
      if (label && !entries.some(entry => entry.label.toLowerCase() === label.toLowerCase())) {
        entries.push({ label, feature, saved: false });
      }
    });
 
    entries.forEach(entry => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "checklist-address-option";
      option.setAttribute("role", "option");
 
      const label = document.createElement("span");
      label.textContent = entry.label;
      option.appendChild(label);
 
      if (entry.saved) {
        const note = document.createElement("small");
        note.textContent = "Current preferred address";
        option.appendChild(note);
      }
 
      option.addEventListener("click", () => {
        input.value = entry.label;
        closeSuggestions();
        saveAddress(entry.label, entry.feature);
      });
      suggestions.appendChild(option);
    });
 
    suggestions.hidden = entries.length === 0;
    input.setAttribute("aria-expanded", String(!suggestions.hidden));
  }
 
  async function getFeatures(query, limit, signal) {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", query);
    url.searchParams.set("bbox", searchBounds);
    url.searchParams.set("limit", String(limit));
 
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Address lookup failed (${response.status}).`);
    const result = await response.json();
    return result.features || [];
  }
 
  async function saveAddress(address, feature) {
    const query = address.trim();
    if (!query) return;
 
    status.textContent = "Finding address…";
    try {
      let result = feature;
      if (!result) {
        const matches = await getFeatures(query, 1);
        result = matches[0];
      }
      if (!result || !Array.isArray(result.geometry?.coordinates)) {
        status.textContent = "No matching address found. Try a more specific address.";
        return;
      }
 
      const resolvedAddress = formatAddress(result) || query;
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        input.value = resolvedAddress;
        status.textContent = "Sign in to save this preferred address.";
        return;
      }
 
      const saved = await window.profileAddress.save(
        data.session,
        resolvedAddress,
        result.geometry.coordinates
      );
      savedAddress = resolvedAddress;
      input.value = resolvedAddress;
      status.textContent = saved.neighborhood
        ? `Preferred address saved in ${saved.neighborhood}. It will take priority over your map search.`
        : "Preferred address saved. It will take priority over your map search.";
    } catch (error) {
      console.error("Could not find or save the preferred address:", error.message || error);
      status.textContent = "Could not find or save this address. Please try again.";
    }
  }
 
  async function loadSavedAddress() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      savedAddress = "";
      if (!editedByUser) input.value = "";
      return;
    }
 
    const address = await window.profileAddress.read(data.session);
    savedAddress = address;
    if (!editedByUser) input.value = address;
  }
 
  input.addEventListener("input", () => {
    editedByUser = true;
    window.clearTimeout(searchTimer);
    if (searchController) searchController.abort();
 
    const query = input.value.trim();
    if (query.length < 3) {
      renderSuggestions([]);
      return;
    }
 
    searchTimer = window.setTimeout(async () => {
      searchController = new AbortController();
      try {
        const features = await getFeatures(query, 5, searchController.signal);
        renderSuggestions(features);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Could not load address suggestions:", error.message || error);
          renderSuggestions([]);
        }
      }
    }, 250);
  });
 
  input.addEventListener("focus", () => {
    if (!input.value.trim()) renderSuggestions([]);
  });
 
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") closeSuggestions();
  });
 
  form.addEventListener("submit", event => {
    event.preventDefault();
    window.clearTimeout(searchTimer);
    if (searchController) searchController.abort();
    closeSuggestions();
    saveAddress(input.value);
  });
 
  document.addEventListener("click", event => {
    if (!form.contains(event.target)) closeSuggestions();
  });
 
  loadSavedAddress().catch(error => {
    console.error("Could not load the saved address:", error.message || error);
    status.textContent = "Could not load your saved address.";
  });
 
  supabaseClient.auth.onAuthStateChange(() => {
    loadSavedAddress().catch(error => {
      console.error("Could not load the saved address:", error.message || error);
    });
  });
})();


