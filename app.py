# starting file

import folium
import webcolors
# allows us to load in stuff to have interactive maps -> python database
from folium.plugins import Geocoder

# Define the geographic coordinates for San Jose, California (don't know if they are specificly correct )
san_jose_coords = [37.23, -121.82]

# Create an open-source map centered on San Jose
# The default tile layer is 'OpenStreetMap'
sj_map = folium.Map(
    location=san_jose_coords, 
    zoom_start=11,
    min_zoom=11,
    control_scale=True,
    # Bounds for the map (limits the viewable area)
    min_lat=37.05,
    max_lat=37.45,
    min_lon=-122.1,
    max_lon=-121.65,
    max_bounds=True
)

# Adding the search tool (uses the Photon geocoding service)
# Will have to check usage rights for Photon later
Geocoder(
    provider = "photon",
    provider_options={
        "geocodingQueryParams": {
            # Limits autocomplete results to San Jose
            "bbox": "-122.1, 37.05, -121.65, 37.45",
            # Max amount of suggested results
            "limit": 5
        }
    },
    add_marker = True,
    suggestMinLength = 3,
    suggestTimeout = 250, 
).add_to(sj_map)

fire_colors = {
    "Very High": webcolors.name_to_hex('red'),
    "High": webcolors.name_to_hex('orange'),
    "Medium": webcolors.name_to_hex('yellow'),
    "None": webcolors.name_to_hex('gray')
}

FIELD = "FIREHAZARDSEVERITYZONE"

def map_style(feature):
    level = feature["properties"].get(FIELD)
    color = fire_colors.get(level,"#868e96") #comes out as dark gray if the colors don't work
    # i think we need something more if it's like faint but i don't think our map is there yet 
    return {
        "fillColor": color, 
        "color": color, 
        "weight": 1, 
        "fillOpacity": 0.1
    }

folium.GeoJson(
    "fire_zones_d10.geojson",
    name = "Map of D10 Fire Hazards (by CalFire)",
    style_function =  map_style,
    tooltip=folium.GeoJsonTooltip(
        fields=[FIELD],
        aliases=["Fire Hazard level: "]
    )
).add_to(sj_map)

# After generating the map, we add our CSS file to style the map container
# We can't add it to html directly because map generation changes everytime the script is run
sj_map.get_root().header.add_child(
    folium.Element('<link rel="stylesheet" href="website.css"/>')
)

# The map is added to our html file
sj_map.save("map.html") # create map.html file 
print("Map was generated on website") # To inform us that python script has successfully created the map.html file

# INSTRUCTIONS TO VIEW THE MAP (for now ig)

# To run the script, run in the terminal, the command: py .\app.py (Really need to do it once)
# To see the map, create a server in the terminal with the command: py -m http.server 8000
# Then open your web browser and navigate to http://localhost:8000/website.html.