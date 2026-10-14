# This will run Flask and create a http server to host the map.html file
# Much more helpful in the future when we decide to have a database

from flask import Flask, send_from_directory

# Creates a Flask application instance to allow us to route to different files to our website
app = Flask(__name__)

# Route to serve the website.html file
@app.route("/")
def website():
    return send_from_directory(app.root_path, "website.html")

# Route to serve the map.html file
@app.route("/map.html")
def map():
    return send_from_directory(app.root_path, "map.html")

# Route to serve the website.css file
@app.route("/website.css")
def website_css():
    return send_from_directory(app.root_path, "website.css")

# Route to serve the fire_zones_d10.geojson file
@app.route("/fire_zones_d10.geojson")
def fire_zones():
    return send_from_directory(app.root_path, "fire_zones_d10.geojson")

if __name__ == "__main__":
    app.run(debug=True) # Make sure to turn off debug mode when website goes public, it is just to help us see changes on website way quicker

# INSTRUCTIONS TO VIEW THE WEBSITE

# To run the script, run in the terminal, the command: py .\app.py
# Will print a URL in the terminal, copy and paste it into your web browser to view the website
# Just refresh the page in your web browser to see changes made to code