# Builds the District 10 wildfire hazard map and writes it to docs/map.html.

# IMPORTANT
# Run py .\map.py to generate the map

import colorsys
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
# Smaller neighborhood areas (snapshot from the District 10 neighborhood map).
SPECIFIC_NEIGHBORHOODS_PATH = DOCS / "specific_neighborhoods.geojson"

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

# CalFire calls this zone "NonWildland"; the map shows it as "Non-Hazard".
# Calm -> severe, with the opacity each zone is drawn at.
# Non-Hazard is almost transparent so it reads as "no hazard" instead of greying out the map.
ZONE_LABELS = {"NonWildland": "Non-Hazard"}
fire_colors = {
    "Non-Hazard": ("#9aa5b1", 0.06),
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
        properties = feature.get("properties") or {}
        zone = properties.get(FIELD)
        if zone in ZONE_LABELS:
            properties[FIELD] = ZONE_LABELS[zone]
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


# Each neighborhood gets its own boundary color so the three are easy to tell apart.
# The display name is changed here only; neighborhoods.geojson keeps its source names.
NEIGHBORHOOD_LABELS = {"Almaden Valley": "Greater Almaden Valley"}
NEIGHBORHOOD_COLORS = {
    "Greater Almaden Valley": "#000000",  # black
    "Santa Teresa": "#000080",            # navy blue
    "Blossom Valley": "#006400",          # dark green
}
NEIGHBORHOOD_FALLBACK_COLOR = "#000000"


# Load the three broad neighborhoods and swap in the display name for Almaden.
def load_neighborhoods():
    hoods = get_filtered_neighborhoods(["Santa Teresa", "Blossom Valley", "Almaden Valley"])
    for feature in hoods.get("features", []):
        properties = feature.get("properties") or {}
        name = properties.get("NAME")
        if name in NEIGHBORHOOD_LABELS:
            properties["NAME"] = NEIGHBORHOOD_LABELS[name]
    return hoods


def _neighborhood_color(feature):
    return NEIGHBORHOOD_COLORS.get(
        feature["properties"].get("NAME"), NEIGHBORHOOD_FALLBACK_COLOR
    )


def neighborhood_halo_style(feature):
    return {
            "color": "#ffffff",
            "weight": 6,
            "opacity": 0.9,
            "fill": False,
            "lineCap": "round",
            "lineJoin": "round"
            }


def neighborhood_style(feature):
    return {"color": _neighborhood_color(feature), "weight": 3, "opacity": 0.95, "fill": False,
            "dashArray": "", "lineCap": "round", "lineJoin": "round"}


def neighborhood_highlight(feature):
    return {"color": _neighborhood_color(feature), "weight": 5, "opacity": 1}


# Pick a different, readable boundary color for each specific neighborhood.
def _distinct_colors(count):
    colors = []
    for index in range(count):
        # Golden-angle hues keep consecutive entries far apart on the color wheel;
        # alternating lightness keeps similar hues from looking the same.
        hue = ((index * 137.508) % 360) / 360
        lightness = 0.30 if index % 2 == 0 else 0.40
        red, green, blue = colorsys.hls_to_rgb(hue, lightness, 0.85)
        colors.append(f"#{round(red * 255):02x}{round(green * 255):02x}{round(blue * 255):02x}")
    return colors


# Read the pre-filtered GeoJSON and tag every neighborhood with its own color.
# (HOAs, apartments, mobile homes, senior housing, and clubs were removed already.)
def load_specific_neighborhoods():
    data = json.loads(SPECIFIC_NEIGHBORHOODS_PATH.read_text(encoding="utf-8"))
    features = data.get("features", [])
    for feature, color in zip(features, _distinct_colors(len(features))):
        feature.setdefault("properties", {})["COLOR"] = color
    return data


# Thin white outline behind each specific boundary so it stays visible over the hazard colors.
def specific_neighborhood_halo_style(feature):
    return {"color": "#ffffff", "weight": 4, "opacity": 0.75, "fill": False,
            "lineCap": "round", "lineJoin": "round"}


def specific_neighborhood_style(feature):
    return {"color": feature["properties"]["COLOR"], "weight": 2, "opacity": 0.9, "fill": False,
            "lineCap": "round", "lineJoin": "round"}


def specific_neighborhood_highlight(feature):
    return {"color": feature["properties"]["COLOR"], "weight": 4, "opacity": 1}


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
    <li><span class="swatch" style="background:#9aa5b1"></span>Non-Hazard</li>
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
            zoom_snap=0.1,
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
        sj_map.options["minZoom"] = 11
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

        # Create the three general boundaries, but start the layer unchecked so the
        # map opens showing only the 48 specific neighborhoods.
        hoods = load_neighborhoods()
        neighborhood_group = folium.FeatureGroup(name="General neighborhoods", show=False).add_to(sj_map)

        folium.GeoJson(
            hoods, name="Neighborhood halo", style_function=neighborhood_halo_style,
            smooth_factor=1.5, control=False,
        ).add_to(neighborhood_group)

        folium.GeoJson(
            hoods, name="Neighborhood boundaries", style_function=neighborhood_style,
            highlight_function=neighborhood_highlight, smooth_factor=1.5,
            tooltip=folium.GeoJsonTooltip(
                fields=["NAME"], aliases=["Neighborhood: "], sticky=True, opacity=1,
            ),
        ).add_to(neighborhood_group)

        # Add the smaller neighborhood areas as their own toggle so the three
        # general boundaries can still be viewed on their own.
        specific_hoods = load_specific_neighborhoods()
        specific_group = folium.FeatureGroup(name="Specific neighborhoods").add_to(sj_map)

        folium.GeoJson(
            specific_hoods, name="Specific neighborhood halo",
            style_function=specific_neighborhood_halo_style,
            smooth_factor=1.5, control=False,
        ).add_to(specific_group)

        folium.GeoJson(
            specific_hoods, name="Specific neighborhood boundaries",
            style_function=specific_neighborhood_style,
            highlight_function=specific_neighborhood_highlight, smooth_factor=1.5,
            tooltip=folium.GeoJsonTooltip(
                fields=["NAME"], aliases=["Neighborhood: "], sticky=True, opacity=1,
            ),
        ).add_to(specific_group)

        # Frame the district itself rather than a city-wide view.
        sj_map.fit_bounds(
            [[D10_BOUNDS[0], D10_BOUNDS[1]], [D10_BOUNDS[2], D10_BOUNDS[3]]],
            padding=(16, 16),
        )

        # After generating the map, we add our CSS file to style the map container
        # We can't add it to html directly because map generation changes everytime the script is run
        # The site typefaces go in first so the map chrome matches the other pages.
        # If you change the font list here, change it in the HTML pages too.
        sj_map.get_root().header.add_child(
            folium.Element(
                '<link rel="preconnect" href="https://fonts.googleapis.com"/>'
                '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>'
                '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600&display=swap"/>'
            )
        )
        sj_map.get_root().header.add_child(
            folium.Element('<link rel="stylesheet" href="website.css"/>')
        )

        # Small floating cards so the map explains itself without a key sitting elsewhere.
        sj_map.get_root().html.add_child(folium.Element(TITLE_HTML))
        sj_map.get_root().html.add_child(folium.Element(LEGEND_HTML))

        # Keep the layer list open so it is obvious the map can be changed.
        folium.LayerControl(position="topright", collapsed=False).add_to(sj_map)

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
