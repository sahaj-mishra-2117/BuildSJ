(() => {
  const STORAGE_KEY = "buildSJ.localHouseMarker";

  function readLocation() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      const location = JSON.parse(stored);
      const coordinates = location && location.coordinates;
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1]) ||
        coordinates[0] < -180 ||
        coordinates[0] > 180 ||
        coordinates[1] < -90 ||
        coordinates[1] > 90
      ) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return coordinates;
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      console.warn("Could not read the locally saved home location:", error.message || error);
      return null;
    }
  }

  function saveHomeFireZone(coordinates) {
    const save = async () => {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) return;
      await window.profileAddress.saveFireZone(data.session, coordinates);
    };

    save().catch(error => {
      console.error("Could not save home fire-zone severity to the profile:", error.message || error);
    });
  }

  window.initLocalHouseMarker = map => {
    let marker = null;
    let pendingSelection = null;
    const icon = L.divIcon({
      className: "buildsj-home-marker-icon",
      html: '<span class="buildsj-home-marker" role="img" aria-label="Your home location"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5h-5.8v-6h-5.4v6H3.5a.5.5 0 0 1-.5-.5z"/></svg></span>',
      iconSize: [42, 48],
      iconAnchor: [21, 44],
      popupAnchor: [0, -42],
    });

    const confirmation = document.createElement("dialog");
    confirmation.className = "buildsj-home-confirmation";
    confirmation.setAttribute("aria-labelledby", "buildsj-home-confirmation-title");
    confirmation.setAttribute("aria-describedby", "buildsj-home-confirmation-description");
    confirmation.innerHTML = `
      <form method="dialog" class="buildsj-home-confirmation-content">
        <p class="buildsj-home-confirmation-eyebrow">Map location</p>
        <h2 id="buildsj-home-confirmation-title">Save this as your home?</h2>
        <p id="buildsj-home-confirmation-description">
          The marker is saved in this browser. Fire-zone severity is saved to your profile when signed in.
        </p>
        <div class="buildsj-home-confirmation-actions">
          <button type="button" class="buildsj-home-cancel">Not now</button>
          <button type="button" class="buildsj-home-save">Save as home</button>
        </div>
      </form>
    `;
    document.body.appendChild(confirmation);

    confirmation.querySelector(".buildsj-home-cancel").addEventListener("click", () => {
      confirmation.close("cancel");
    });
    confirmation.querySelector(".buildsj-home-save").addEventListener("click", () => {
      confirmation.close("save");
    });
    confirmation.addEventListener("close", () => {
      const selection = pendingSelection;
      pendingSelection = null;
      if (confirmation.returnValue !== "save" || !selection) return;

      showLocation(selection.coordinates, selection.marker);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ coordinates: selection.coordinates })
        );
      } catch (error) {
        console.warn("Could not save the home location in this browser:", error.message || error);
      }
    });

    const showLocation = (coordinates, selectedMarker) => {
      const [lng, lat] = coordinates;
      if (marker && marker !== selectedMarker) map.removeLayer(marker);

      marker = selectedMarker || L.marker([lat, lng], {
          icon,
          keyboard: true,
          title: "Your home location, saved in this browser",
          alt: "Your home location",
          zIndexOffset: 1000,
        }).addTo(map);
      marker.options.isLocalHouseMarker = true;
      marker.setIcon(icon);
      marker.options.title = "Your home location, saved in this browser";
      if (marker.getElement()) marker.getElement().title = marker.options.title;
      marker.bindPopup("Home Location");
      marker.bindTooltip("Home location (saved in this browser)", {
        direction: "top",
        offset: [0, -34],
      });
      saveHomeFireZone(coordinates);
    };

    try {
      const savedCoordinates = readLocation();
      if (savedCoordinates) showLocation(savedCoordinates);
    } catch (error) {
      console.warn("Could not restore the locally saved home location:", error.message || error);
    }

    window.addEventListener("map-address-selected", event => {
      const coordinates = event.detail && event.detail.coordinates;
      if (
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        !coordinates.every(Number.isFinite) ||
        coordinates[0] < -180 ||
        coordinates[0] > 180 ||
        coordinates[1] < -90 ||
        coordinates[1] > 90
      ) {
        return;
      }

      pendingSelection = { coordinates, marker: event.detail.marker };
      if (!confirmation.open) {
        confirmation.returnValue = "";
        confirmation.showModal();
      }
    });
  };
})();
