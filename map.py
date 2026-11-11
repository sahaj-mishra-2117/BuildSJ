# Builds the District 10 wildfire hazard map and writes it to docs/map.html.

import json
from pathlib import Path

import folium
# allows us to load in stuff to have interactive maps -> python database
from folium.plugins import Geocoder
from fetch_neighborhoods import get_filtered_neighborhoods

ROOT = Path(__file__).resolve().parent
DOCS = ROOT / "docs"
MAP_PATH = DOCS / "map.html"
FIRE_ZONES_PATH = DOCS / "fire_zones_d10.geojson"

# District 10 covers south San Jose (Almaden / Blossom Valley / Santa Teresa).
# (south, west, north, east) - the map is held inside this box instead of the whole city.
D10_BOUNDS = (37.15, -121.97, 37.30, -121.72)
# How far past the district edge the user may pan. The extra room east/west keeps
# wide screens from showing empty space outside the bounds at the starting zoom.
PADDING_LAT = 0.02
PADDING_LON = 0.05

D10_CENTER = [
    (D10_BOUNDS[0] + D10_BOUNDS[2]) / 2,
    (D10_BOUNDS[1] + D10_BOUNDS[3]) / 2,
]
MAX_BOUNDS = [
    [D10_BOUNDS[0] - PADDING_LAT, D10_BOUNDS[1] - PADDING_LON],
    [D10_BOUNDS[2] + PADDING_LAT, D10_BOUNDS[3] + PADDING_LON],
]

# Define the field and color mapping for fire hazard severity zones
FIELD = "FIREHAZARDSEVERITYZONE"

# Calm -> severe, with the opacity each zone is drawn at.
# NonWildland is almost transparent so it reads as "no hazard" instead of greying out the map.
fire_colors = {
    "NonWildland": ("#9aa5b1", 0.06),
    "Moderate": ("#e0a300", 0.28),
    "High": ("#ef6c1a", 0.34),
    "Very High": ("#c1121f", 0.40),
}
FALLBACK_COLOR = ("#9aa5b1", 0.06)  # used if a zone shows up with a value we don't know


# Rounds coordinates so the page carries far less geometry data (5 decimals ~= 1 meter).
def _round_coords(coords, digits=5):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], digits), round(coords[1], digits)]
    return [_round_coords(part, digits) for part in coords]


def load_fire_zones(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    for feature in data.get("features", []):
        geometry = feature.get("geometry") or {}
        if "coordinates" in geometry:
            geometry["coordinates"] = _round_coords(geometry["coordinates"])
    return data


# Function to define the style for each fire hazard zone on the map
def map_style(feature):
    level = feature["properties"].get(FIELD)
    color, fill_opacity = fire_colors.get(level, FALLBACK_COLOR)
    return {
        "fillColor": color,
        "color": color,
        "weight": 0.6,
        "opacity": 0.55,
        "fillOpacity": fill_opacity,
        "lineJoin": "round",
        "lineCap": "round",
    }


# Brighter, thicker version of a zone while the cursor is over it.
def map_highlight(feature):
    style = map_style(feature)
    style.update({
        "weight": 2,
        "opacity": 1,
        "fillOpacity": min(style["fillOpacity"] + 0.22, 0.7),
    })
    return style


def neighborhood_style(feature):
    return {
        "color": "#1d4ed8",   # Border color
        "weight": 3,        # Border thickness
        "opacity": 0.90,
        "fillOpacity": 0,     # Transparent fill, so the map underneath stays visible
        "dashArray": "5, 6",
        "lineCap": "round",
    }


TITLE_HTML = """
<div class="map-title">
  <h2>San Jos&eacute; &middot; District 10</h2>
  <p>Wildfire hazard severity zones &middot; CalFire</p>
</div>
"""

LEGEND_HTML = """
<div class="map-legend">
  <h2>Fire hazard severity</h2>
  <ul>
    <li><span class="swatch" style="background:#c1121f"></span>Very High</li>
    <li><span class="swatch" style="background:#ef6c1a"></span>High</li>
    <li><span class="swatch" style="background:#e0a300"></span>Moderate</li>
    <li><span class="swatch" style="background:#9aa5b1"></span>Not wildland</li>
  </ul>
</div>
"""


# Function that holds main code (Used for error handling)
def main():
    try:
        # Create an open-source map centered on District 10.
        # tiles=None keeps folium from adding its own default basemap.
        sj_map = folium.Map(
            location=D10_CENTER,
            tiles=None,
            zoom_start=13,
            min_zoom=12,
            max_zoom=18,
            zoom_snap=0.5,          # half-step zooming feels smoother than whole steps
            max_bounds=True,
            control_scale=True,
            prefer_canvas=True,     # canvas draws the large hazard polygons far more smoothly
        )

        # Creates tiles, which are the many small square images that the map will stitch together.
        #
        # CARTO made it so we need API keys 
        # use the standard OpenStreetMap tiles - are free and need no key
        #
        #  the openstreet map doesn't do well w/ too much traffic to the website so if it ever gets genuinely busy
        #  we should move to paid or self-hosted tiles
        #  Rules: https://operations.osmfoundation.org/policies/tiles/
        folium.TileLayer(
            tiles="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            attr='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            name="Base map",
            overlay=False,
            control=False,
            max_zoom=19,
        ).add_to(sj_map)

        # Keeping the map inside District 10, now and after any pan/zoom.
        sj_map.options["maxBounds"] = MAX_BOUNDS
        sj_map.options["maxBoundsViscosity"] = 1.0

        # Adding the search tool (uses the Photon geocoding service)
        # Will have to check usage rights for Photon later
        Geocoder(
            provider="photon",
            provider_options={
                "geocodingQueryParams": {
                    # Limits autocomplete results to District 10
                    "bbox": f"{D10_BOUNDS[1]},{D10_BOUNDS[0]},{D10_BOUNDS[3]},{D10_BOUNDS[2]}",
                    # Max amount of suggested results
                    "limit": 5,
                }
            },
            add_marker=True,
            zoom=15,
            suggestMinLength=3,
            suggestTimeout=250,
        ).add_to(sj_map)

        # Add the fire hazard zones to the map
        folium.GeoJson(
            load_fire_zones(FIRE_ZONES_PATH),
            name="CalFire fire hazard zones",
            style_function=map_style,
            highlight_function=map_highlight,
            smooth_factor=1.2,
            tooltip=folium.GeoJsonTooltip(
                fields=[FIELD],
                aliases=["Fire hazard level: "],
                sticky=True,
                opacity=1,
            ),
        ).add_to(sj_map)

        # Add the neighborhood boundaries to the map
        folium.GeoJson(
            get_filtered_neighborhoods(["Santa Teresa", "Blossom Valley"]),
            name="Neighborhood boundaries",
            style_function=neighborhood_style,
            smooth_factor=1.5,
            tooltip=folium.GeoJsonTooltip(
                fields=["NAME"],
                aliases=["Neighborhood: "],
                sticky=True,
                opacity=1,
            ),
        ).add_to(sj_map)

        # Frame the district itself rather than a city-wide view.
        sj_map.fit_bounds(
            [[D10_BOUNDS[0], D10_BOUNDS[1]], [D10_BOUNDS[2], D10_BOUNDS[3]]],
            padding=(16, 16),
        )

        # After generating the map, we add our CSS file to style the map container
        # We can't add it to html directly because map generation changes everytime the script is run
        sj_map.get_root().header.add_child(
            folium.Element('<link rel="stylesheet" href="website.css"/>')
        )

        # Small floating cards so the map explains itself without a key sitting elsewhere.
        sj_map.get_root().html.add_child(folium.Element(TITLE_HTML))
        sj_map.get_root().html.add_child(folium.Element(LEGEND_HTML))

        folium.LayerControl(position="topright", collapsed=True).add_to(sj_map)

        # The map is added to our html file
        sj_map.save(str(MAP_PATH))
        print(f"Map was generated at {MAP_PATH.relative_to(ROOT)}")

    except FileNotFoundError as e:
        print(f"Missing file: {e}")
    except ValueError as e:
        print(f"Bad data or color mapping: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")


if __name__ == "__main__":
    main()
