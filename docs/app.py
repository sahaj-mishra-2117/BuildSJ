# This will run Flask and create a http server to host the map.html file
# Much more helpful in the future when we decide to have a database

from flask import Flask, send_from_directory

# SQLAlchemy is a library that allows us to connect to a database
# from flask_sqlalchemy import SQLAlchemy

# # The link to the database, we will be using PostgreSQL for the database, but we will be using SQLite for now because it is easier to set up
# DATABASE_URL = ""

# # Creates a Flask application instance to allow us to route to different files to our website
app = Flask(__name__)

# app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL  # Using SQLite for simplicity

# db = SQLAlchemy(app)

# Route to serve the website.html file
@app.route("/")
def website():
    return send_from_directory(app.root_path, "index.html")

# Route to serve the map.html file
@app.route("/map.html")
def map():
    return send_from_directory(app.root_path, "map.html")

# Route to serve the website.css file
@app.route("/website.css")
def website_css():
    return send_from_directory(app.root_path, "website.css")

# Route to serve the checklist.html file
@app.route("/checklist.html")
def checklist():
    return send_from_directory(app.root_path, "checklist.html")

# Route to serve the checklist.css file
@app.route("/checklist.css")
def checklist_css():
    return send_from_directory(app.root_path, "checklist.css")

# Route to serve the fire_zones_d10.geojson file
@app.route("/fire_zones_d10.geojson")
def fire_zones():
    return send_from_directory(app.root_path, "fire_zones_d10.geojson")

if __name__ == "__main__":
    app.run(debug=True) # Make sure to turn off debug mode when website goes public, it is just to help us see changes on website way quicker

# INSTRUCTIONS TO VIEW THE WEBSITE

# py -m http.server 8000 --directory .\docs
# open http://localhost:8000/ in your browser

