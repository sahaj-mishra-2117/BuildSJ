(() => {
  const map = window.map_b7dcc81e2ea976ef891fac0989f036fc;
  const form = document.getElementById("address-search");
  const input = document.getElementById("address-input");
  const suggestions = document.getElementById("address-suggestions");
  const status = document.getElementById("address-search-status");
  const searchBounds = "-121.97,37.15,-121.72,37.3";
  let savedAddress = "";
  let searchTimer = null;
  let searchController = null;
  let addressMarker = null;

  function setStatus(message) {
    status.textContent = message;
  }

  function closeSuggestions() {
    suggestions.hidden = true;
    suggestions.replaceChildren();
    input.setAttribute("aria-expanded", "false");
  }

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
      option.className = "address-suggestion";
      option.setAttribute("role", "option");

      const label = document.createElement("span");
      label.textContent = entry.label;
      option.appendChild(label);

      if (entry.saved) {
        const note = document.createElement("small");
        note.textContent = "Your saved address";
        option.appendChild(note);
      }

      option.addEventListener("click", () => {
        input.value = entry.label;
        closeSuggestions();
        searchAddress(entry.label, entry.feature);
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

  async function getProfileAddress(session) {
    const selectors = [["id", session.user.id], ["email", session.user.email]]
      .filter(([, value]) => value);

    for (const [column, value] of selectors) {
      let query = supabaseClient.from("profiles").select("address");
      query = column === "id" ? query.eq(column, value) : query.ilike(column, value);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      if (data) return data.address || "";
    }
    return "";
  }

  async function storeProfileAddress(session, address) {
    const selectors = [["id", session.user.id], ["email", session.user.email]]
      .filter(([, value]) => value);
    let updateError = null;

    for (const [column, value] of selectors) {
      let query = supabaseClient.from("profiles").update({ address });
      query = column === "id" ? query.eq(column, value) : query.ilike(column, value);
      const { data, error } = await query.select("id").limit(1);
      if (error) {
        updateError = updateError || error;
        continue;
      }
      if (data && data.length > 0) return;
    }

    if (updateError) throw updateError;

    const { error } = await supabaseClient.from("profiles").insert({
      id: session.user.id,
      email: session.user.email,
      address,
    });
    if (error) throw error;
  }

  async function loadSavedAddress() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) return;

    savedAddress = await getProfileAddress(data.session);
    if (document.activeElement === input) {
      renderSuggestions([]);
    }
  }

  async function searchAddress(address, feature) {
    window.clearTimeout(searchTimer);
    if (searchController) searchController.abort();

    const query = address.trim();
    if (!query) return;

    setStatus("Searching…");
    try {
      let result = feature;
      if (!result) {
        const matches = await getFeatures(query, 1);
        result = matches[0];
      }
      if (!result || !Array.isArray(result.geometry?.coordinates)) {
        setStatus("No matching address found. Try a more specific address.");
        return;
      }

      const [longitude, latitude] = result.geometry.coordinates;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        setStatus("No matching address found. Try a more specific address.");
        return;
      }

      const resolvedAddress = formatAddress(result) || query;
      map.setView([latitude, longitude], 15);
      if (addressMarker) addressMarker.remove();

      const popup = document.createElement("span");
      popup.textContent = resolvedAddress;
      addressMarker = L.marker([latitude, longitude]).addTo(map);
      addressMarker.bindPopup(popup).openPopup();

      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        setStatus("Address found. Sign in to save it to your profile.");
        return;
      }

      await storeProfileAddress(data.session, resolvedAddress);
      savedAddress = resolvedAddress;
      setStatus("Address found and saved to your profile.");
    } catch (error) {
      console.error("Could not search or save the address:", error.message || error);
      setStatus("Could not search or save the address. Please try again.");
    }
  }

  input.addEventListener("input", () => {
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
    searchAddress(input.value);
  });

  document.addEventListener("click", event => {
    if (!form.contains(event.target)) closeSuggestions();
  });

  loadSavedAddress().catch(error => {
    console.error("Could not load the saved address:", error.message || error);
    setStatus("Could not load the saved address.");
  });

  supabaseClient.auth.onAuthStateChange(() => {
    loadSavedAddress().catch(error => {
      console.error("Could not load the saved address:", error.message || error);
    });
  });
})();
