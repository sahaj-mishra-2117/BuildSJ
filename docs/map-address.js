(() => {
  window.addEventListener("map-address-selected", event => {
    const selection = event.detail || {};
    const address = typeof selection === "string"
      ? selection.trim()
      : typeof selection.address === "string"
        ? selection.address.trim()
        : "";

    if (!address) return;
    const searchInput = document.querySelector(".leaflet-control-geocoder input");
    if (searchInput) searchInput.value = address;
  });
})();