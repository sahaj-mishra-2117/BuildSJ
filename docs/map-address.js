(() => {
  const map = window.map_b7dcc81e2ea976ef891fac0989f036fc;
  const geocoder = L.Control.geocoder({
    collapsed: false,
    position: "topright",
    defaultMarkGeocode: true,
    zoom: 15,
    provider: "photon",
    providerOptions: {
      geocodingQueryParams: {
        bbox: "-121.97,37.15,-121.72,37.3",
        limit: 5,
      },
    },
    suggestMinLength: 3,
    suggestTimeout: 250,
  });
 
  geocoder.on("markgeocode", async event => {
    const address = event.geocode.name && event.geocode.name.trim();
    if (!address) return;
 
    const center = event.geocode.center;
    const coordinates = center ? [center.lng, center.lat] : null;
 
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) return;
 
      const saved = await window.profileAddress.save(data.session, address, coordinates);
      console.info(
        saved.neighborhood
          ? `Map search address saved to the user profile (${saved.neighborhood}).`
          : "Map search address saved to the user profile."
      );
    } catch (error) {
      console.error("Could not save the map search address:", error.message || error);
    }
  });
 
  geocoder.addTo(map);
})();