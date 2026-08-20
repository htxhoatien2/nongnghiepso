import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import os
import json
import math
import pandas as pd
import numpy as np

# Ensure app/data directory exists
os.makedirs('app/data', exist_ok=True)

# 1. Load Excel
print("Loading Excel SanXuat.xlsx...")
df = pd.read_excel('SanXuat.xlsx', sheet_name='SanXuat', skiprows=4)
cols = ['STT', 'CHU_RUONG', 'HO_SX', 'XU_DONG', 'QUY_1', 'QUY_2', 'NGAY_SINH', 'CCCD', 'NGAY_CAP', 'NOI_CAP', 'NGAY_HET_HAN', 'GIOI_TINH', 'DIA_CHI', 'DIEN_THOAI']
df = df.iloc[:, :14]
df.columns = cols

# Clean string fields
for col in ['STT', 'CHU_RUONG', 'HO_SX', 'XU_DONG', 'GIOI_TINH', 'DIA_CHI', 'CCCD', 'DIEN_THOAI']:
    df[col] = df[col].astype(str).str.strip().replace({'nan': '', 'None': '', 'None': ''})

# Normalize Giới tính & Địa chỉ
df['GIOI_TINH'] = df['GIOI_TINH'].replace({'Nư': 'Nữ'})
df['DIA_CHI'] = df['DIA_CHI'].str.strip()

# Format Phone Number
def clean_phone(val):
    if not val: return ''
    try:
        val_str = str(val).split('.')[0].strip()
        if len(val_str) == 9 and not val_str.startswith('0'):
            val_str = '0' + val_str
        return val_str
    except:
        return str(val)

df['DIEN_THOAI'] = df['DIEN_THOAI'].apply(clean_phone)

# Format CCCD
def clean_cccd(val):
    if not val: return ''
    try:
        val_str = str(val).split('.')[0].strip()
        return val_str
    except:
        return str(val)

df['CCCD'] = df['CCCD'].apply(clean_cccd)

# Numeric conversion
df['QUY_1'] = pd.to_numeric(df['QUY_1'], errors='coerce').fillna(0).astype(float)
df['QUY_2'] = pd.to_numeric(df['QUY_2'], errors='coerce').fillna(0).astype(float)
df['TONG_DIEN_TICH'] = df['QUY_1'] + df['QUY_2']

# Format Date of Birth
def format_dob(val):
    if pd.isna(val) or val == '' or str(val) == 'nan':
        return ''
    try:
        dt = pd.to_datetime(val)
        return dt.strftime('%d/%m/%Y')
    except:
        return str(val)

def extract_birth_year(val):
    if pd.isna(val) or val == '' or str(val) == 'nan':
        return None
    try:
        dt = pd.to_datetime(val)
        return int(dt.year)
    except:
        return None

df['NGAY_SINH_STR'] = df['NGAY_SINH'].apply(format_dob)
df['NAM_SINH'] = df['NGAY_SINH'].apply(extract_birth_year)

# Flag Land Transfer / Borrowing / Renting
df['IS_RENTED'] = (df['CHU_RUONG'] != df['HO_SX']) & (df['CHU_RUONG'] != '') & (df['HO_SX'] != '')

# Build Clean Plots records
plots = []
for idx, row in df.iterrows():
    p = {
        "id": idx + 1,
        "stt": str(row['STT']),
        "chu_ruong": row['CHU_RUONG'],
        "ho_sx": row['HO_SX'],
        "xu_dong": row['XU_DONG'],
        "quy_1": float(row['QUY_1']),
        "quy_2": float(row['QUY_2']),
        "tong_dt": float(row['TONG_DIEN_TICH']),
        "ngay_sinh": row['NGAY_SINH_STR'],
        "nam_sinh": int(row['NAM_SINH']) if pd.notna(row['NAM_SINH']) else None,
        "cccd": row['CCCD'],
        "gioi_tinh": row['GIOI_TINH'],
        "dia_chi": row['DIA_CHI'],
        "dien_thoai": row['DIEN_THOAI'],
        "is_rented": bool(row['IS_RENTED'])
    }
    plots.append(p)

print(f"Processed {len(plots)} plot records.")

# 2. Build Farmers profile
farmers_dict = {}
for p in plots:
    h_name = p['ho_sx']
    if not h_name:
        continue
    if h_name not in farmers_dict:
        farmers_dict[h_name] = {
            "name": h_name,
            "dia_chi": p['dia_chi'] or 'Chưa xác định',
            "dien_thoai": p['dien_thoai'],
            "cccd": p['cccd'],
            "ngay_sinh": p['ngay_sinh'],
            "nam_sinh": p['nam_sinh'],
            "gioi_tinh": p['gioi_tinh'] or 'Chưa rõ',
            "so_thua": 0,
            "tong_dt": 0.0,
            "quy_1": 0.0,
            "quy_2": 0.0,
            "so_thua_thue": 0,
            "so_thua_chinh_chu": 0,
            "xu_dong_list": set(),
            "plot_ids": []
        }
    f = farmers_dict[h_name]
    f["so_thua"] += 1
    f["tong_dt"] += p["tong_dt"]
    f["quy_1"] += p["quy_1"]
    f["quy_2"] += p["quy_2"]
    if p["is_rented"]:
        f["so_thua_thue"] += 1
    else:
        f["so_thua_chinh_chu"] += 1
    if p["xu_dong"]:
        f["xu_dong_list"].add(p["xu_dong"])
    f["plot_ids"].append(p["id"])
    if not f["dien_thoai"] and p["dien_thoai"]:
        f["dien_thoai"] = p["dien_thoai"]
    if not f["cccd"] and p["cccd"]:
        f["cccd"] = p["cccd"]
    if not f["ngay_sinh"] and p["ngay_sinh"]:
        f["ngay_sinh"] = p["ngay_sinh"]
        f["nam_sinh"] = p["nam_sinh"]
    if f["dia_chi"] == 'Chưa xác định' and p["dia_chi"]:
        f["dia_chi"] = p["dia_chi"]

farmers_list = []
for h_name, f in farmers_dict.items():
    current_year = 2026
    age = (current_year - f['nam_sinh']) if f['nam_sinh'] else None
    f["tuoi"] = age
    f["xu_dong_list"] = sorted([str(x) for x in f["xu_dong_list"] if x])
    f["tong_dt"] = round(f["tong_dt"], 1)
    f["quy_1"] = round(f["quy_1"], 1)
    f["quy_2"] = round(f["quy_2"], 1)
    f["dt_ha"] = round(f["tong_dt"] / 10000, 2)
    farmers_list.append(f)

farmers_list.sort(key=lambda x: x['tong_dt'], reverse=True)
print(f"Processed {len(farmers_list)} farmer households.")

# 3. Build Zones (Xứ đồng) summary
zones_dict = {}
for p in plots:
    z_name = p['xu_dong'] or 'Chưa xác định'
    if z_name not in zones_dict:
        zones_dict[z_name] = {
            "name": z_name,
            "so_thua": 0,
            "tong_dt": 0.0,
            "quy_1": 0.0,
            "quy_2": 0.0,
            "farmers": set(),
            "owners": set(),
            "to_list": set(),
            "plot_ids": []
        }
    z = zones_dict[z_name]
    z["so_thua"] += 1
    z["tong_dt"] += p["tong_dt"]
    z["quy_1"] += p["quy_1"]
    z["quy_2"] += p["quy_2"]
    if p["ho_sx"]: z["farmers"].add(str(p["ho_sx"]))
    if p["chu_ruong"]: z["owners"].add(str(p["chu_ruong"]))
    if p["dia_chi"]: z["to_list"].add(str(p["dia_chi"]))
    z["plot_ids"].append(p["id"])

zones_list = []
for z_name, z in zones_dict.items():
    zones_list.append({
        "name": z_name,
        "so_thua": z["so_thua"],
        "tong_dt": round(z["tong_dt"], 1),
        "dt_ha": round(z["tong_dt"] / 10000, 2),
        "quy_1": round(z["quy_1"], 1),
        "quy_2": round(z["quy_2"], 1),
        "so_ho": len(z["farmers"]),
        "so_chu": len(z["owners"]),
        "to_list": sorted([str(x) for x in z["to_list"] if x]),
        "plot_ids": z["plot_ids"]
    })

zones_list.sort(key=lambda x: x['tong_dt'], reverse=True)
print(f"Processed {len(zones_list)} zones (Xứ đồng).")

# 4. Build Address / Tổ stats
addr_dict = {}
for p in plots:
    addr = p['dia_chi'] or 'Chưa xác định'
    if addr not in addr_dict:
        addr_dict[addr] = {
            "name": addr,
            "so_thua": 0,
            "tong_dt": 0.0,
            "quy_1": 0.0,
            "quy_2": 0.0,
            "farmers": set(),
            "owners": set(),
            "zones": set()
        }
    a = addr_dict[addr]
    a["so_thua"] += 1
    a["tong_dt"] += p["tong_dt"]
    a["quy_1"] += p["quy_1"]
    a["quy_2"] += p["quy_2"]
    if p["ho_sx"]: a["farmers"].add(str(p["ho_sx"]))
    if p["chu_ruong"]: a["owners"].add(str(p["chu_ruong"]))
    if p["xu_dong"]: a["zones"].add(str(p["xu_dong"]))

address_list = []
for addr, a in addr_dict.items():
    address_list.append({
        "name": addr,
        "so_thua": a["so_thua"],
        "tong_dt": round(a["tong_dt"], 1),
        "dt_ha": round(a["tong_dt"] / 10000, 2),
        "quy_1": round(a["quy_1"], 1),
        "quy_2": round(a["quy_2"], 1),
        "so_ho": len(a["farmers"]),
        "so_chu": len(a["owners"]),
        "so_xu_dong": len(a["zones"]),
        "zones": sorted([str(x) for x in a["zones"] if x])
    })
address_list.sort(key=lambda x: x['tong_dt'], reverse=True)

# 5. Build Overall KPIs and Stats
total_dt = df['TONG_DIEN_TICH'].sum()
quy1_dt = df['QUY_1'].sum()
quy2_dt = df['QUY_2'].sum()
diff_owner_count = len(df[df['IS_RENTED']])

kpis = {
    "total_plots": len(plots),
    "total_area_m2": round(total_dt, 1),
    "total_area_ha": round(total_dt / 10000, 2),
    "quy_1_m2": round(quy1_dt, 1),
    "quy_1_ha": round(quy1_dt / 10000, 2),
    "quy_1_pct": round(quy1_dt / total_dt * 100, 1),
    "quy_2_m2": round(quy2_dt, 1),
    "quy_2_ha": round(quy2_dt / 10000, 2),
    "quy_2_pct": round(quy2_dt / total_dt * 100, 1),
    "total_farmers": len(farmers_list),
    "total_landowners": df['CHU_RUONG'].nunique(),
    "total_zones": len(zones_list),
    "rented_plots": diff_owner_count,
    "rented_pct": round(diff_owner_count / len(plots) * 100, 1),
    "avg_plot_m2": round(total_dt / len(plots), 1),
    "avg_farmer_dt_m2": round(total_dt / len(farmers_list), 1),
    "avg_farmer_plots": round(len(plots) / len(farmers_list), 1)
}

data_export = {
    "kpis": kpis,
    "plots": plots,
    "farmers": farmers_list,
    "zones": zones_list,
    "addresses": address_list
}

with open('app/data/data.json', 'w', encoding='utf-8') as f:
    json.dump(data_export, f, ensure_ascii=False, indent=2)

print("Saved app/data/data.json successfully.")

# 6. Generate GeoJSON for Agricultural Fields (Hòa Tiến, Hòa Vang, Đà Nẵng)
# Base Anchor coordinates: Hòa Tiến fields (~15.9620 N, 108.1980 E)
# Let's arrange the 85 zones in realistic agricultural field parcels with distinct spatial footprints
print("Generating spatial GeoJSON parcels for 85 Xứ đồng...")

base_lat = 15.9650
base_lon = 108.1960

# We cluster zones geographically according to primary Tổ or Zone Name characteristics:
# - La Châu, La Bông Tây, Ven Sông: along the river & western fields
# - Trung Đồng, Trung Đồng A, B: central vast plains
# - Gò ổi, Khe - Tờ 15, Ven Tây Tịnh: western & southern slopes
# - Hà Ra 20-33: eastern parcel subdivisions
# - Lô 1-24: grid-organized plots

features = []

# Group zones by category for geographic positioning
num_zones = len(zones_list)
cols_grid = 10
rows_grid = math.ceil(num_zones / cols_grid)

# Define geographical sector centroids around Hòa Tiến:
sector_anchors = {
    "La Châu": (15.9720, 108.1900),
    "La Bông Tây": (15.9690, 108.1880),
    "Ven Sông": (15.9750, 108.1940),
    "Trung đồng": (15.9650, 108.1960),
    "Trung đồng A": (15.9660, 108.1990),
    "Trung đồng B": (15.9640, 108.2000),
    "Gò ổi": (15.9600, 108.1910),
    "Ven Tây Tịnh": (15.9580, 108.1930),
    "Khe - Tờ 15": (15.9570, 108.1880),
    "Bàu": (15.9620, 108.1870),
}

for i, z in enumerate(zones_list):
    z_name = z["name"]
    area_m2 = z["tong_dt"]
    
    # Calculate radius proportional to area
    # e.g., 40,000 m2 (4 ha) is ~200m x 200m -> ~0.0018 deg lat/lon
    scale_factor = math.sqrt(max(area_m2, 1000)) * 0.000028
    
    # Determine zone center
    if z_name in sector_anchors:
        c_lat, c_lon = sector_anchors[z_name]
    elif "Hà Ra" in z_name:
        # East sector
        sub_idx = int(''.join(filter(str.isdigit, z_name)) or '20') - 20
        c_lat = 15.9610 + (sub_idx % 4) * 0.0022 - 0.003
        c_lon = 108.2040 + (sub_idx // 4) * 0.0025
    elif "Lô" in z_name:
        # Structured field blocks
        sub_idx = int(''.join(filter(str.isdigit, z_name)) or str(i % 24))
        c_lat = 15.9680 - (sub_idx % 6) * 0.0022
        c_lon = 108.1930 + (sub_idx // 6) * 0.0024
    else:
        # Grid layout for remaining zones
        row = i // cols_grid
        col = i % cols_grid
        c_lat = base_lat + (row - rows_grid/2) * 0.0028 + (math.sin(i*1.7)*0.0006)
        c_lon = base_lon + (col - cols_grid/2) * 0.0032 + (math.cos(i*1.3)*0.0006)
    
    # Add slight polygon distortion for organic natural field look
    angles = [0, 45, 90, 135, 180, 225, 270, 315]
    poly_coords = []
    
    # Create irregular polygon of 5-8 vertices
    num_pts = 6
    for pt in range(num_pts):
        angle_rad = (pt / num_pts) * 2 * math.pi
        r = scale_factor * (0.85 + 0.3 * math.sin(angle_rad * 3 + i))
        # Account for latitude elongation
        lat_offset = r * math.sin(angle_rad)
        lon_offset = (r / math.cos(math.radians(c_lat))) * math.cos(angle_rad)
        poly_coords.append([round(c_lon + lon_offset, 6), round(c_lat + lat_offset, 6)])
    
    # Close polygon
    poly_coords.append(poly_coords[0])
    
    feature = {
        "type": "Feature",
        "id": f"zone_{i+1}",
        "properties": {
            "name": z_name,
            "tong_dt": z["tong_dt"],
            "dt_ha": z["dt_ha"],
            "quy_1": z["quy_1"],
            "quy_2": z["quy_2"],
            "so_thua": z["so_thua"],
            "so_ho": z["so_ho"],
            "so_chu": z["so_chu"],
            "to_list": ", ".join(z["to_list"]) if z["to_list"] else "Chưa rõ",
            "center": [round(c_lat, 6), round(c_lon, 6)]
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [poly_coords]
        }
    }
    features.append(feature)

geojson_data = {
    "type": "FeatureCollection",
    "name": "NongNghiep_HoaTien_Fields",
    "crs": {
        "type": "name",
        "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" }
    },
    "features": features
}

with open('app/data/fields.geojson', 'w', encoding='utf-8') as f:
    json.dump(geojson_data, f, ensure_ascii=False, indent=2)

print(f"Saved app/data/fields.geojson with {len(features)} zone polygons.")
print("DATA GENERATION COMPLETE!")
