(() => {
  /* Neighborhood boundaries used to place an address in a neighborhood.
     Specific District 10 areas first, then the broader city neighborhoods. */
  const NEIGHBORHOOD_FILES = [
    "specific_neighborhoods.geojson",
    "neighborhoods.geojson",
  ];
  const boundaryCache = new Map();
 
  function toArea(feature) {
    const name = feature && feature.properties && feature.properties.NAME;
    const geometry = feature && feature.geometry;
    if (!name || !geometry) return null;
 
    let polygons = [];
    if (geometry.type === "Polygon") polygons = [geometry.coordinates];
    if (geometry.type === "MultiPolygon") polygons = geometry.coordinates;
    if (!polygons.length) return null;
 
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    polygons.forEach(polygon => {
      polygon.forEach(ring => {
        ring.forEach(([lng, lat]) => {
          if (lng < bbox[0]) bbox[0] = lng;
          if (lat < bbox[1]) bbox[1] = lat;
          if (lng > bbox[2]) bbox[2] = lng;
          if (lat > bbox[3]) bbox[3] = lat;
        });
      });
    });
 
    return { name, polygons, bbox };
  }
 
  function pointInRing(lng, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const crosses = (yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (crosses) inside = !inside;
    }
    return inside;
  }
 
  function containsPoint(area, lng, lat) {
    const [minLng, minLat, maxLng, maxLat] = area.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return false;
 
    return area.polygons.some(polygon => {
      const [outer, ...holes] = polygon;
      if (!outer || !pointInRing(lng, lat, outer)) return false;
      return !holes.some(hole => pointInRing(lng, lat, hole));
    });
  }
 
  function loadAreas(path) {
    if (!boundaryCache.has(path)) {
      const request = fetch(new URL(path, document.baseURI))
        .then(response => {
          if (!response.ok) {
            throw new Error(`Neighborhood boundaries unavailable (${response.status}).`);
          }
          return response.json();
        })
        .then(data => (data.features || []).map(toArea).filter(Boolean))
        .catch(error => {
          boundaryCache.delete(path);
          throw error;
        });
 
      boundaryCache.set(path, request);
    }
 
    return boundaryCache.get(path);
  }
 
  async function findNeighborhood(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
 
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
 
    for (const path of NEIGHBORHOOD_FILES) {
      try {
        const areas = await loadAreas(path);
        const match = areas.find(area => containsPoint(area, lng, lat));
        if (match) return match.name;
      } catch (error) {
        console.warn("Could not load neighborhood boundaries:", error.message || error);
      }
    }
 
    return null;
  }
 
  async function read(session) {
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
 
  async function save(session, address, coordinates) {
    const selectors = [["id", session.user.id], ["email", session.user.email]]
      .filter(([, value]) => value);
 
    /* Only touch the neighborhood when we know where the address is. */
    const changes = { address };
    if (Array.isArray(coordinates)) {
      changes.neighborhood = await findNeighborhood(coordinates);
    }
 
    let updateError = null;
 
    for (const [column, value] of selectors) {
      let query = supabaseClient.from("profiles").update(changes);
      query = column === "id" ? query.eq(column, value) : query.ilike(column, value);
      const { data, error } = await query.select("id").limit(1);
      if (error) {
        updateError = updateError || error;
        continue;
      }
      if (data && data.length > 0) {
        return { neighborhood: changes.neighborhood || null };
      }
    }
 
    if (updateError) throw updateError;
 
    const { error } = await supabaseClient.from("profiles").insert({
      id: session.user.id,
      email: session.user.email,
      checked_in: false,
      progress_percentage: 0,
      tasks_completed: 0,
      address,
      neighborhood: changes.neighborhood || null,
    });
    if (error) throw error;
 
    return { neighborhood: changes.neighborhood || null };
  }
 
  window.profileAddress = { read, save, neighborhoodFor: findNeighborhood };
})();
