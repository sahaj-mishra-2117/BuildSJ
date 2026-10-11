# starting file

import folium 
# allows us to load in stuff to have interactive maps -> python database
from folium.plugins import Geocoder

# Define the geographic coordinates for San Jose, California (don't know id they are specificly correct )
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
# Then open your web browser and navigate to http://localhost:8000/website.html
