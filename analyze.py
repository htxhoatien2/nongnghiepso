import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
import pandas as pd
import numpy as np

# Read raw excel
raw_df = pd.read_excel('SanXuat.xlsx', sheet_name='SanXuat')

# Header is on row 2 (0-indexed) or row 3 in Excel
# Let's inspect raw_df
# row 2 has the actual column names, row 3 has QUY 1, QUY 2
# row 4 has 1, 2, 2, 4...
# row 5 onwards has data

df = pd.read_excel('SanXuat.xlsx', sheet_name='SanXuat', skiprows=4)
cols = ['STT', 'CHU_RUONG', 'HO_SX', 'XU_DONG', 'QUY_1', 'QUY_2', 'NGAY_SINH', 'CCCD', 'NGAY_CAP', 'NOI_CAP', 'NGAY_HET_HAN', 'GIOI_TINH', 'DIA_CHI', 'DIEN_THOAI']
df = df.iloc[:, :14]
df.columns = cols

# Clean string fields
for col in ['STT', 'CHU_RUONG', 'HO_SX', 'XU_DONG', 'GIOI_TINH', 'DIA_CHI', 'CCCD', 'DIEN_THOAI']:
    df[col] = df[col].astype(str).str.strip().replace('nan', np.nan).replace('None', np.nan)

# Fix typos in GIOI_TINH
df['GIOI_TINH_CLEAN'] = df['GIOI_TINH'].replace({'Nư': 'Nữ'})

# Numeric conversion
df['QUY_1'] = pd.to_numeric(df['QUY_1'], errors='coerce').fillna(0)
df['QUY_2'] = pd.to_numeric(df['QUY_2'], errors='coerce').fillna(0)
df['TONG_DIEN_TICH'] = df['QUY_1'] + df['QUY_2']

print('====================================')
print('BÁO CÁO PHÂN TÍCH FILE SanXuat.xlsx')
print('====================================\n')

print('1. TỔNG QUAN DỮ LIỆU:')
print(f'- Tổng số bản ghi (thửa/lô đất): {len(df):,}')
print(f'- Tổng diện tích đất canh tác: {df["TONG_DIEN_TICH"].sum():,.2f} m² ({df["TONG_DIEN_TICH"].sum()/10000:.2f} ha)')
print(f'  + Đất Quỹ 1 (Giao ổn định lâu dài): {df["QUY_1"].sum():,.2f} m² ({df["QUY_1"].sum()/10000:.2f} ha, chiếm {df["QUY_1"].sum()/df["TONG_DIEN_TICH"].sum()*100:.1f}%)')
print(f'  + Đất Quỹ 2 (Đất công ích/thuê mượn): {df["QUY_2"].sum():,.2f} m² ({df["QUY_2"].sum()/10000:.2f} ha, chiếm {df["QUY_2"].sum()/df["TONG_DIEN_TICH"].sum()*100:.1f}%)')
print(f'- Diện tích trung bình mỗi thửa: {df["TONG_DIEN_TICH"].mean():,.1f} m² (Nhỏ nhất: {df["TONG_DIEN_TICH"].min():,.0f} m², Lớn nhất: {df["TONG_DIEN_TICH"].max():,.0f} m²)')

print('\n2. THỐNG KÊ CHỦ THỂ (CHỦ RUỘNG & HỘ SẢN XUẤT):')
print(f'- Số lượng Chủ ruộng (đứng tên quyền sử dụng): {df["CHU_RUONG"].nunique():,} người')
print(f'- Số lượng Hộ sản xuất (trực tiếp canh tác): {df["HO_SX"].nunique():,} hộ')

# Chủ ruộng vs Hộ SX
same_owner = df[df['CHU_RUONG'] == df['HO_SX']]
diff_owner = df[df['CHU_RUONG'] != df['HO_SX']]
print(f'- Số thửa tự canh tác (Chủ ruộng = Hộ SX): {len(same_owner):,} thửa ({len(same_owner)/len(df)*100:.1f}%) với {same_owner["TONG_DIEN_TICH"].sum()/10000:.2f} ha')
print(f'- Số thửa tích tụ / mượn / thuê đất (Chủ ruộng ≠ Hộ SX): {len(diff_owner):,} thửa ({len(diff_owner)/len(df)*100:.1f}%) với {diff_owner["TONG_DIEN_TICH"].sum()/10000:.2f} ha')

# Số lượng thửa đất bình quân mỗi hộ
thua_per_ho = df.groupby('HO_SX')['STT'].count()
dt_per_ho = df.groupby('HO_SX')['TONG_DIEN_TICH'].sum()
print(f'- Trung bình số thửa mỗi hộ canh tác: {thua_per_ho.mean():.1f} thửa/hộ (Nhiều nhất: {thua_per_ho.max()} thửa - Hộ: {thua_per_ho.idxmax()})')
print(f'- Trung bình diện tích canh tác mỗi hộ: {dt_per_ho.mean():,.1f} m² (~{dt_per_ho.mean()/10000:.2f} ha/hộ)')

print('\n3. PHÂN BỔ THEO TỔ DÂN PHỐ / THÔN (ĐỊA CHỈ):')
dia_chi_df = df.groupby('DIA_CHI').agg(
    So_Thua=('STT', 'count'),
    So_Ho_SX=('HO_SX', 'nunique'),
    Tong_DT_m2=('TONG_DIEN_TICH', 'sum'),
    Quy_1_m2=('QUY_1', 'sum'),
    Quy_2_m2=('QUY_2', 'sum')
).reset_index()
dia_chi_df['DT_ha'] = (dia_chi_df['Tong_DT_m2'] / 10000).round(2)
dia_chi_df['Ty_Le_%'] = (dia_chi_df['Tong_DT_m2'] / df['TONG_DIEN_TICH'].sum() * 100).round(1)
print(dia_chi_df.sort_values(by='Tong_DT_m2', ascending=False).to_string(index=False))

print('\n4. PHÂN BỔ THEO XỨ ĐỒNG / LÔ RUỘNG:')
print(f'- Tổng số Xứ đồng / Lô: {df["XU_DONG"].nunique()} khu vực')
xu_dong_df = df.groupby('XU_DONG').agg(
    So_Thua=('STT', 'count'),
    So_Ho_SX=('HO_SX', 'nunique'),
    Tong_DT_m2=('TONG_DIEN_TICH', 'sum')
).reset_index()
xu_dong_df['DT_ha'] = (xu_dong_df['Tong_DT_m2'] / 10000).round(2)
print('Top 10 Xứ đồng có diện tích lớn nhất:')
print(xu_dong_df.sort_values(by='Tong_DT_m2', ascending=False).head(10).to_string(index=False))

print('\n5. TOP 10 HỘ SẢN XUẤT CÓ QUY MÔ CANH TÁC LỚN NHẤT:')
top_ho = df.groupby(['HO_SX', 'DIA_CHI']).agg(
    So_Thua=('STT', 'count'),
    Tong_DT_m2=('TONG_DIEN_TICH', 'sum'),
    Quy_1_m2=('QUY_1', 'sum'),
    Quy_2_m2=('QUY_2', 'sum'),
    Dien_Thoai=('DIEN_THOAI', 'first')
).reset_index()
top_ho['DT_ha'] = (top_ho['Tong_DT_m2'] / 10000).round(2)
print(top_ho.sort_values(by='Tong_DT_m2', ascending=False).head(10).to_string(index=False))

print('\n6. THỐNG KÊ NHÂN KHẨU HỌC & ĐẶC ĐIỂM CHỦ HỘ:')
# Giới tính của hộ SX (lấy 1 bản ghi đại diện cho mỗi hộ)
ho_unique = df.drop_duplicates(subset=['HO_SX'])
print('- Cơ cấu giới tính chủ hộ SX:')
print(ho_unique['GIOI_TINH_CLEAN'].value_counts(dropna=False))

# Năm sinh & Độ tuổi
ho_unique['NAM_SINH'] = pd.to_datetime(ho_unique['NGAY_SINH'], errors='coerce').dt.year
current_year = 2026 # current year
ho_unique['TUOI'] = current_year - ho_unique['NAM_SINH']
print(f'- Độ tuổi trung bình chủ hộ: {ho_unique["TUOI"].mean():.1f} tuổi (Nhỏ nhất: {ho_unique["TUOI"].min():.0f}, Lớn nhất: {ho_unique["TUOI"].max():.0f})')
print('- Phân nhóm độ tuổi chủ hộ:')
bins = [0, 35, 50, 60, 70, 100]
labels = ['Dưới 35 tuổi', '35 - 50 tuổi', '51 - 60 tuổi', '61 - 70 tuổi', 'Trên 70 tuổi']
ho_unique['NHOM_TUOI'] = pd.cut(ho_unique['TUOI'], bins=bins, labels=labels)
print(ho_unique['NHOM_TUOI'].value_counts().sort_index())

print('\n7. ĐÁNH GIÁ CHẤT LƯỢNG DỮ LIỆU & CÁC VẤN ĐỀ CẦN LƯU Ý (DATA HYGIENE):')
print(f'- Dữ liệu trống CCCD: {df["CCCD"].isna().sum()} dòng')
print(f'- Dữ liệu trống SĐT: {df["DIEN_THOAI"].isna().sum()} dòng')
print(f'- Dữ liệu trống Địa chỉ: {df["DIA_CHI"].isna().sum()} dòng')
print(f'- Dữ liệu trống Năm sinh: {df["NGAY_SINH"].isna().sum()} dòng')
print(f'- Các cột hoàn toàn trống (100% None): Ngày Cấp, Nơi Cấp, Ngày Hết Hạn ({df["NGAY_CAP"].isna().sum()}/{len(df)})')
print(f'- Lỗi chính tả cột Giới tính: {len(df[df["GIOI_TINH"] == "Nư"])} trường hợp gõ "Nư" thay vì "Nữ"')
print(f'- Lỗi khoảng trắng thừa cột Địa chỉ: Các giá trị có dấu cách ở cuối như "Tổ 5 " thay vì "Tổ 5"')
