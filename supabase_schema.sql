-- ============================================================================
-- AGRIGIS POSTGRESQL DATABASE SCHEMA CHO SUPABASE
-- Hệ Thống Quản Lý Sản Xuất Nông Nghiệp & Bản Đồ GIS - HTX Hòa Tiến 2
-- ============================================================================

-- Bật các Extension cần thiết (PostGIS cho GIS không gian & UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ----------------------------------------------------------------------------
-- 1. BẢNG HỒ SƠ CÁN BỘ / NGƯỜI DÙNG (PROFILES - Liên kết auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  fullname TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'farmer' CHECK (role IN ('director', 'accountant', 'cadastre', 'weighing_staff', 'village_head', 'farmer')),
  role_name TEXT,
  phone TEXT,
  cccd TEXT,
  ngay_sinh DATE,
  gioi_tinh TEXT DEFAULT 'Nam',
  dia_chi TEXT,
  to_dan_pho TEXT,
  assigned_zones TEXT[],
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending_approval', 'locked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. BẢNG VÙNG SẢN XUẤT / XỨ ĐỒNG (ZONES - 85 Xứ đồng)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.zones (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  dt_ha NUMERIC(10, 2) DEFAULT 0,
  so_thua INTEGER DEFAULT 0,
  so_ho INTEGER DEFAULT 0,
  to_dan_pho TEXT[],
  loai_dat TEXT DEFAULT 'Lúa 2 vụ',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. BẢNG SỔ BỘ THỬA RUỘNG (PLOTS - 1.181 Thửa)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plots (
  id TEXT PRIMARY KEY,
  so_to INTEGER,
  so_thua INTEGER,
  ma_so_thua TEXT UNIQUE,
  chu_ho TEXT NOT NULL,
  dien_thoai TEXT,
  cccd TEXT,
  dia_chi TEXT,
  to_dan_pho TEXT,
  xu_dong TEXT NOT NULL,
  dien_tich_m2 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quy_dat TEXT DEFAULT 'quy1' CHECK (quy_dat IN ('quy1', 'quy2', 'rented')),
  loai_giong TEXT DEFAULT 'J02',
  tinh_trang TEXT DEFAULT 'Đang canh tác',
  geom GEOMETRY(MultiPolygon, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. BẢNG HỒ SƠ HỘ NÔNG DÂN XÃ VIÊN (FARMERS - 280 Hộ)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.farmers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cccd TEXT,
  dien_thoai TEXT,
  dia_chi TEXT,
  to_dan_pho TEXT,
  tong_thua INTEGER DEFAULT 0,
  tong_dt_m2 NUMERIC(10, 2) DEFAULT 0,
  tong_dt_ha NUMERIC(10, 2) DEFAULT 0,
  quy_mo_label TEXT DEFAULT 'Vừa',
  tich_tu BOOLEAN DEFAULT FALSE,
  xu_dong_list TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. BẢNG DANH MỤC BIỂU PHÍ & DỊCH VỤ HTX (SERVICE_ITEMS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'm²',
  price_m2 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  price_sao NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. BẢNG GHI NHẬN THU NỘP DỊCH VỤ NÔNG NGHIỆP (SERVICE_PAYMENTS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  farmer_id TEXT REFERENCES public.farmers(id) ON DELETE CASCADE,
  farmer_name TEXT NOT NULL,
  service_id TEXT REFERENCES public.service_items(id),
  service_name TEXT NOT NULL,
  amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'Tiền mặt',
  receipt_no TEXT,
  collector_name TEXT,
  notes TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. BẢNG PHIÊN CÂN THU MUA LÚA (PURCHASING_SESSIONS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchasing_sessions (
  id TEXT PRIMARY KEY,
  stt INTEGER NOT NULL,
  farmer_id TEXT,
  farmer_name TEXT NOT NULL,
  farmer_phone TEXT,
  farmer_address TEXT,
  xu_dong TEXT NOT NULL,
  loai_giong TEXT NOT NULL DEFAULT 'J02',
  can_bo_can TEXT NOT NULL,
  xe_nhan TEXT,
  created_datetime TIMESTAMPTZ DEFAULT NOW(),
  
  -- Số liệu cân
  tong_so_bao INTEGER NOT NULL DEFAULT 0,
  luong_tuoi_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  tru_do_am_pct NUMERIC(5, 2) DEFAULT 12.0,
  luong_kho_kg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  don_gia_kg NUMERIC(10, 2) NOT NULL DEFAULT 8500,
  thanh_tien NUMERIC(15, 2) NOT NULL DEFAULT 0,
  
  -- Trạng thái & ghi chú
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'partial')),
  note TEXT,
  batches_json JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 8. BẢNG NHẬT KÝ TRUY VẾT BẢO MẬT (AUDIT_LOGS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  time TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT,
  username TEXT,
  fullname TEXT,
  role TEXT,
  action TEXT NOT NULL,
  details TEXT,
  device TEXT
);

-- ============================================================================
-- KÍCH HOẠT REALTIME CHO SUPABASE (POSTGRES REPLICATION)
-- ============================================================================
ALTER TABLE public.purchasing_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.plots REPLICA IDENTITY FULL;
ALTER TABLE public.service_payments REPLICA IDENTITY FULL;
ALTER TABLE public.farmers REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

-- Thêm các bảng vào danh sách theo dõi Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'purchasing_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.purchasing_sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.plots;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_payments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.farmers;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchasing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Cho phép đọc công khai và đồng bộ Realtime hai chiều toàn diện
DROP POLICY IF EXISTS "Public Read Plots" ON public.plots;
DROP POLICY IF EXISTS "Authenticated Manage Plots" ON public.plots;
CREATE POLICY "Allow All Plots Access" ON public.plots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Farmers" ON public.farmers;
DROP POLICY IF EXISTS "Authenticated Manage Farmers" ON public.farmers;
CREATE POLICY "Allow All Farmers Access" ON public.farmers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Service Items" ON public.service_items;
CREATE POLICY "Allow All Service Items Access" ON public.service_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Purchasing" ON public.purchasing_sessions;
DROP POLICY IF EXISTS "Authenticated Manage Purchasing" ON public.purchasing_sessions;
CREATE POLICY "Allow All Purchasing Access" ON public.purchasing_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated Manage Payments" ON public.service_payments;
CREATE POLICY "Allow All Payments Access" ON public.service_payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated Insert Logs" ON public.audit_logs;
CREATE POLICY "Allow All Logs Access" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

