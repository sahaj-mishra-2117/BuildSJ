# Using FastAPI to store checklist items in a PostgreSQL database and serve static files.
import os
from fastapi import FastAPI, HTTPException, Form
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()

# Allows for localhost and GitHub Pages to access the API without CORS issues.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "https://sahaj-mishra-2117.github.io/BuildSJ/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection setup (Need to make db)
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

@app.post("/api/save-info")
# This function saves the checklist info to the PostgreSQL database.
def save_info(
    item_name: str = Form(...),  # Looks for name="item_name" in checklist.html
    status: str = Form(...)      # Looks for name="status" in checklist.html
):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        insert_query = "INSERT INTO checklist_items (item_name, status) VALUES (%s, %s);"
        cursor.execute(insert_query, (item_name, status))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        # This sends the user right back to the checklist page after submitting
        return RedirectResponse(url="/checklist.html", status_code=303)

    # If there's an error with the database connection or query, it causes an error message to be printed
    except Exception as e:
        print(f"Database error: {e}")
        raise HTTPException(status_code=500, detail="Failed to save data")

# Serve static files for the website, including HTML, CSS, and JS files.

@app.get("/")
def website():
    return FileResponse("docs/index.html")

@app.get("/map.html")
def map():
    return FileResponse("docs/map.html")

@app.get("/website.css")
def website_css():
    return FileResponse("docs/website.css")

@app.get("/checklist.html")
def checklist():
    return FileResponse("docs/checklist.html")

@app.get("/checklist.css")
def checklist_css():
    return FileResponse("docs/checklist.css")

@app.get("/fire_zones_d10.geojson")
def fire_zones():
    return FileResponse("docs/fire_zones_d10.geojson")

@app.get("/script.js")
def script():
    return FileResponse("docs/script.js")

# During development, to test code:
# py -m uvicorn app:app --reload
