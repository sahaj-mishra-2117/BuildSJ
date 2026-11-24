(() => {
  window.addEventListener("map-address-selected", async event => {
    const address = event.detail && event.detail.trim();
    if (!address) return;

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) return;

      await window.profileAddress.save(data.session, address);
      console.info("Map search address saved to the user profile.");
    } catch (error) {
      console.error("Could not save the map search address:", error.message || error);
    }
  });
})();
