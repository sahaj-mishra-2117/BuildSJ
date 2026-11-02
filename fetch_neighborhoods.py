import json
from pathlib import Path

GEOJSON_PATH = Path(__file__).resolve().parent / "docs" / "neighborhoods.geojson"

def get_filtered_neighborhoods(target_names=None):
    raw_data = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw_data, dict) or not isinstance(raw_data.get("features"), list):
        raise ValueError(f"{GEOJSON_PATH} must contain a GeoJSON FeatureCollection")

    if target_names is None:
        return raw_data

    selected_names = set(target_names)
    filtered_data = dict(raw_data)
    filtered_data["features"] = [
        feature for feature in raw_data["features"]
        if feature.get("properties", {}).get("NAME") in selected_names
    ]

    print(f"Filter complete. Retained {len(filtered_data['features'])} neighborhoods.")
    return filtered_data