# starting file
# 1. Find an open source map that can be used in python within the website  

import folium 
# allows us to load in stuff to have interactive maps -> python database 
import os
# Allows us to get stuff from openstreetmap to get street network stuff (allows us to zoom on into SJ)

# Define the geographic coordinates for San Jose, California (don't know id they are specificly correct )
san_jose_coords = [37.23, -121.82]

# Create an open-source map centered on San Jose
# The default tile layer is 'OpenStreetMap'
sj_map = folium.Map(
    location=san_jose_coords, 
    zoom_start=12,
    control_scale=True
)

# The map is added to our html file
sj_map.save("website.html") # create website.html file 
print("Map was generated on website") # To inform us that
