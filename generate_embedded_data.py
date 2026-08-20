import json

with open('app/data/data.json', 'r', encoding='utf-8') as f:
    data_json = json.load(f)

with open('app/data/fields.geojson', 'r', encoding='utf-8') as f:
    geo_json = json.load(f)

embedded_js_content = f"""// Auto-generated embedded dataset for offline and file:// protocol support
window.AGRI_RAW_DATA = {json.dumps(data_json, ensure_ascii=False)};
window.AGRI_GEOJSON_DATA = {json.dumps(geo_json, ensure_ascii=False)};
"""

with open('app/data/data_embedded.js', 'w', encoding='utf-8') as f:
    f.write(embedded_js_content)

print("Generated app/data/data_embedded.js successfully!")
