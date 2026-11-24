(() => {
  window.addEventListener("map-address-selected", async event => {
    const selection = event.detail || {};
    const address = (typeof selection === "string" ? selection : selection.address || "").trim();
    if (!address) return;

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) return;

      const saved = await window.profileAddress.save(
        data.session,
        address,
        Array.isArray(selection.coordinates) ? selection.coordinates : null
      );
      console.info(
        saved.neighborhood
          ? `Map search address saved to the user profile (${saved.neighborhood}).`
          : "Map search address saved to the user profile."
      );
    } catch (error) {
      console.error("Could not save the map search address:", error.message || error);
    }
  });
})();