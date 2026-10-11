# Download some CAL Fire Hazard Zones (for D10) straight up 
# Save them as a file in our repo, that we can then use on our map 

import json
import requests  # type: ignore -> idk so an error doesn't pop up

# allows python to actually download things from the internet
URL = ("https://geo.sanjoseca.gov/server/rest/services/FIR/"
       "FIR_AllReferenceLayers/MapServer/4/query")
# The CAL FIRE feature service that allows us to actually get data 
# /query lets us like actually ask for it 

BBOX = "-121.98,37.15,-121.74,37.30" 
# general rough box around San Jose d10 - we can change it later 

params = {
    "where": "1=1",                         # 1 to 1 so we get everything inside of the box 
    "geometry": BBOX,                       # use these parameters for our above BBOX
    "geometryType": "esriGeometryEnvelope", # geometry of the box is a rectangle
    "inSR": 4326,                           # our box is in lat/long coordinates
    "outSR": 4326,                          # give results back in lat/long
    "spatialRel": "esriSpatialRelIntersects",  # any zone that touches the box (intersects spatial)
    "outFields": "FIREHAZARDSEVERITYZONE, LASTUPDATE",       # only takes the FHSZ data (the only one we need)
    "f": "geojson",                         # return in json (easiest to use)
}

response = requests.get(URL, params=params, timeout=60)
# requesting taking the URL's data, creating a box w/ the above parameters
# timeout = 60 means it takes 60 seconds  
response.raise_for_status()
# error handling 
data = response.json()
# converts the data into a dictionary (or list) so that we can work w/ it easily 


#ERROR HANDLING 
if "features" not in data: 
    raise SystemExit(f"Unexpected response (no 'features): {str(data)[:300]}") 
# if we don't have 'features', then our code stops and prints out 
# a cut version of the data so we can see what's in it 
if data.get("excededTransferLimit"): 
    print("Warning: server truncated the results - we need to page through them")
# if the data is too big, then it tells us that stuff is missing 

levels = sorted({f["properties"]["FIREHAZARDSEVERITYZONE"] or "None" for f in data["features"]})
print(f"Got {len(data['features'])} zones. Hazard values found: {levels}")
# iterates through the drive and prints a summary of the data


with open("fire_zones_d10.geojson", "w") as f:           
    f.write(response.text)
# we open the json file in "w" mode (so we can write stuff)
# in the file, we write the box/parameter data we wrote above 
# ("with" means it automatically closes after we write stuff in there)

# we can use this file in our repo now 

print("Saved fire_zones_d10.geojson")

