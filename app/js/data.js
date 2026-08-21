/**
 * AGRIGIS DATA STORE & STATE MANAGER
 */

const AgriData = {
  data: null,
  geoJson: null,
  isLoaded: false,

  // Load datasets asynchronously or from embedded script
  async init() {
    try {
      // 1. Check embedded data first (works seamlessly with file:// protocol and offline)
      if (window.AGRI_RAW_DATA && window.AGRI_GEOJSON_DATA) {
        // Check if user has saved custom raw data in localStorage
        const savedRaw = localStorage.getItem('agrigis_custom_raw_data');
        if (savedRaw) {
          try {
            this.data = JSON.parse(savedRaw);
          } catch(e) {
            this.data = JSON.parse(JSON.stringify(window.AGRI_RAW_DATA));
          }
        } else {
          this.data = JSON.parse(JSON.stringify(window.AGRI_RAW_DATA));
        }
        
        // Check if user has saved custom edited GeoJSON in localStorage
        const savedGeo = localStorage.getItem('agrigis_custom_geojson');
        if (savedGeo) {
          try {
            this.geoJson = JSON.parse(savedGeo);
          } catch(e) {
            this.geoJson = JSON.parse(JSON.stringify(window.AGRI_GEOJSON_DATA));
          }
        } else {
          this.geoJson = JSON.parse(JSON.stringify(window.AGRI_GEOJSON_DATA));
        }
        
        this.ensureServiceItems();
        this.ensurePurchasingData();
        this.isLoaded = true;
        console.log('AgriData loaded from embedded storage:', {
          plots: this.data.plots.length,
          farmers: this.data.farmers.length,
          zones: this.data.zones.length,
          serviceItems: this.data.service_items.length,
          geoFeatures: this.geoJson.features.length
        });
        return true;
      }

      // 2. Fallback to fetch via HTTP/HTTPS
      const [resData, resGeo] = await Promise.all([
        fetch('data/data.json'),
        fetch('data/fields.geojson')
      ]);

      const rawJson = await resData.json();
      const geoJson = await resGeo.json();

      const savedRaw = localStorage.getItem('agrigis_custom_raw_data');
      this.data = savedRaw ? JSON.parse(savedRaw) : rawJson;

      const savedGeo = localStorage.getItem('agrigis_custom_geojson');
      this.geoJson = savedGeo ? JSON.parse(savedGeo) : geoJson;

      this.ensureServiceItems();
      this.ensurePurchasingData();
      this.isLoaded = true;
      console.log('AgriData loaded via fetch:', {
        plots: this.data.plots.length,
        farmers: this.data.farmers.length,
        zones: this.data.zones.length,
        serviceItems: this.data.service_items.length,
        purchasingSessions: this.data.purchasing_sessions.length,
        geoFeatures: this.geoJson.features.length
      });
      return true;
    } catch (err) {
      console.error('Failed to load AgriData:', err);
      return false;
    }
  },

  ensureServiceItems() {
    if (!this.data) this.data = {};
    if (!this.data.service_items || !Array.isArray(this.data.service_items) || this.data.service_items.length === 0) {
      this.data.service_items = [
        {
          id: "fee_irrigation",
          name: "Phí Thủy Lợi & Tưới Tiêu",
          unit: "m²",
          price_m2: 120,
          price_sao: 60000,
          is_active: true,
          description: "Phí điều tiết nước và nạo vét kênh mương nội đồng"
        },
        {
          id: "fee_plowing",
          name: "Dịch Vụ Làm Đất / Cày Ải",
          unit: "m²",
          price_m2: 250,
          price_sao: 125000,
          is_active: true,
          description: "Cày lật đất, bừa phẳng ruộng bằng máy cơ giới"
        },
        {
          id: "fee_harvest",
          name: "Dịch Vụ Máy Gặt Đập Liên Hợp",
          unit: "m²",
          price_m2: 300,
          price_sao: 150000,
          is_active: true,
          description: "Thu hoạch lúa và đóng bao cơ giới tại bờ ruộng"
        },
        {
          id: "fee_protection",
          name: "Quản Lý HTX & Bảo Vệ Thực Vật",
          unit: "m²",
          price_m2: 80,
          price_sao: 40000,
          is_active: true,
          description: "Công tác điều hành dịch vụ, dự tính dự báo rầy nâu sâu bệnh"
        }
      ];
    }
    if (!this.data.payments) this.data.payments = {};
  },

  ensurePurchasingData() {
    if (!this.data) this.data = {};
    if (!this.data.purchasing_sessions || !Array.isArray(this.data.purchasing_sessions)) {
      this.data.purchasing_sessions = [];
    }
    if (!this.data.remembered_prices) {
      this.data.remembered_prices = {
        "J02": 8500,
        "HG12": 8200,
        "HG244": 8300,
        "ĐT100": 8000,
        "HT1": 8100,
        "ST25": 9500
      };
    }
  },

  // Save current state to localStorage and re-sync metrics
  syncAndPersist(newGeoJSON, zoneName, zonePlots) {
    if (newGeoJSON) {
      this.geoJson = newGeoJSON;
      localStorage.setItem('agrigis_custom_geojson', JSON.stringify(this.geoJson));
    }

    if (zoneName && Array.isArray(zonePlots)) {
      // 1. Remove old plots for this zone and add updated plots
      const otherPlots = this.data.plots.filter(p => p.xu_dong.toLowerCase().trim() !== zoneName.toLowerCase().trim());
      this.data.plots = [...otherPlots, ...zonePlots];

      // 2. Re-calculate Farmers summary
      this.recalculateFarmers();

      // 3. Re-calculate Zones summary
      this.recalculateZones();

      // 4. Re-calculate KPIs
      this.recalculateKPIs();

      // 5. Persist to localStorage
      localStorage.setItem('agrigis_custom_raw_data', JSON.stringify(this.data));
    }

    console.log('AgriData synced successfully:', {
      totalPlots: this.data.plots.length,
      totalFarmers: this.data.farmers.length,
      totalZones: this.data.zones.length
    });
  },

  // Delete a zone and its plots
  deleteZoneAndPlots(zoneName) {
    if (!zoneName) return;
    
    // 1. Remove from plots
    this.data.plots = this.data.plots.filter(p => p.xu_dong.toLowerCase().trim() !== zoneName.toLowerCase().trim());

    // 2. Remove from geoJson
    if (this.geoJson && this.geoJson.features) {
      this.geoJson.features = this.geoJson.features.filter(f => f.properties.name.toLowerCase().trim() !== zoneName.toLowerCase().trim());
      localStorage.setItem('agrigis_custom_geojson', JSON.stringify(this.geoJson));
    }

    // 3. Recalculate
    this.recalculateFarmers();
    this.recalculateZones();
    this.recalculateKPIs();

    // 4. Persist
    this.saveCustomRawData();
  },

  // Save raw data to localStorage for offline persistence
  saveCustomRawData() {
    if (this.data) {
      try {
        localStorage.setItem('agrigis_custom_raw_data', JSON.stringify(this.data));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
    }
  },

  // Helper recalculations
  recalculateFarmers() {
    const map = new Map();
    this.data.plots.forEach(p => {
      const name = p.ho_sx ? p.ho_sx.trim() : 'Chưa rõ';
      if (!map.has(name)) {
        map.set(name, {
          name: name,
          so_thua: 0,
          tong_dt: 0,
          quy_1: 0,
          quy_2: 0,
          quy_khac: 0,
          dt_chinh_chu: 0,
          dt_tich_tu: 0,
          dia_chi: p.dia_chi || '',
          dien_thoai: p.dien_thoai || '',
          ngay_sinh: p.ngay_sinh || '',
          nam_sinh: p.nam_sinh || null,
          cccd: p.cccd || '',
          gioi_tinh: p.gioi_tinh || 'Nam',
          xu_dong_list: []
        });
      }
      const f = map.get(name);
      f.so_thua += 1;
      const area = parseFloat(p.tong_dt) || 0;
      f.tong_dt += area;
      f.quy_1 += parseFloat(p.quy_1) || 0;
      f.quy_2 += parseFloat(p.quy_2) || 0;
      f.quy_khac += parseFloat(p.quy_khac) || 0;

      if (p.is_rented) {
        f.dt_tich_tu += area;
      } else {
        f.dt_chinh_chu += area;
      }

      if (p.xu_dong && !f.xu_dong_list.includes(p.xu_dong)) {
        f.xu_dong_list.push(p.xu_dong);
      }
      if (p.dien_thoai && !f.dien_thoai) f.dien_thoai = p.dien_thoai;
      if (p.dia_chi && !f.dia_chi) f.dia_chi = p.dia_chi;
    });

    this.data.farmers = Array.from(map.values()).map(f => ({
      ...f,
      dt_ha: Number((f.tong_dt / 10000).toFixed(2)),
      is_large_scale: f.tong_dt >= 5000,
      scale_category: f.tong_dt >= 10000 ? 'Lớn (> 1 ha)' : (f.tong_dt >= 5000 ? 'Vừa (0.5 - 1 ha)' : 'Nhỏ (< 0.5 ha)')
    }));
  },

  recalculateZones() {
    const map = new Map();
    this.data.plots.forEach(p => {
      const name = p.xu_dong ? p.xu_dong.trim() : 'Chưa đặt tên';
      if (!map.has(name)) {
        map.set(name, {
          name: name,
          so_thua: 0,
          tong_dt: 0,
          quy_1: 0,
          quy_2: 0,
          quy_khac: 0,
          to_list: [],
          ho_list: []
        });
      }
      const z = map.get(name);
      z.so_thua += 1;
      const area = parseFloat(p.tong_dt) || 0;
      z.tong_dt += area;
      z.quy_1 += parseFloat(p.quy_1) || 0;
      z.quy_2 += parseFloat(p.quy_2) || 0;
      z.quy_khac += parseFloat(p.quy_khac) || 0;

      if (p.dia_chi && !z.to_list.includes(p.dia_chi)) z.to_list.push(p.dia_chi);
      if (p.ho_sx && !z.ho_list.includes(p.ho_sx)) z.ho_list.push(p.ho_sx);
    });

    this.data.zones = Array.from(map.values()).map(z => ({
      name: z.name,
      so_thua: z.so_thua,
      so_ho: z.ho_list.length,
      tong_dt: z.tong_dt,
      dt_ha: Number((z.tong_dt / 10000).toFixed(2)),
      quy_1: z.quy_1,
      quy_2: z.quy_2,
      quy_khac: z.quy_khac,
      to_list: z.to_list.join(', ') || 'Tổ 1'
    }));
  },

  recalculateKPIs() {
    const totalArea = this.data.plots.reduce((sum, p) => sum + (parseFloat(p.tong_dt) || 0), 0);
    const totalQuy1 = this.data.plots.reduce((sum, p) => sum + (parseFloat(p.quy_1) || 0), 0);
    const totalQuy2 = this.data.plots.reduce((sum, p) => sum + (parseFloat(p.quy_2) || 0), 0);
    const rentedPlots = this.data.plots.filter(p => p.is_rented);
    const rentedArea = rentedPlots.reduce((sum, p) => sum + (parseFloat(p.tong_dt) || 0), 0);

    this.data.kpis = {
      tong_dien_tich_m2: totalArea,
      tong_dien_tich_ha: Number((totalArea / 10000).toFixed(2)),
      tong_so_thua: this.data.plots.length,
      tong_so_ho: this.data.farmers.length,
      tong_so_xu_dong: this.data.zones.length,
      quy_1_m2: totalQuy1,
      quy_2_m2: totalQuy2,
      dt_tich_tu_m2: rentedArea,
      ty_le_tich_tu: totalArea > 0 ? Number(((rentedArea / totalArea) * 100).toFixed(1)) : 0
    };
  },

  // Getters
  getKPIs() { return this.data?.kpis || {}; },
  getPlots() { return this.data?.plots || []; },
  getFarmers() { return this.data?.farmers || []; },
  getZones() { return this.data?.zones || []; },
  getAddresses() { return this.data?.addresses || []; },
  getGeoJSON() { return this.geoJson || null; },
  getPayments() { return (this.data && this.data.payments) || {}; },
  getTopAccumulators(limit = 10) {
    const farmers = this.getFarmers();
    return [...farmers]
      .sort((a, b) => (b.tong_dt_m2 || 0) - (a.tong_dt_m2 || 0))
      .slice(0, limit);
  },

  // Find methods
  findFarmer(name) {
    if (!name) return null;
    return this.data?.farmers.find(f => f.name.toLowerCase().trim() === name.toLowerCase().trim()) || null;
  },

  findZone(name) {
    if (!name) return null;
    return this.data?.zones.find(z => z.name.toLowerCase().trim() === name.toLowerCase().trim()) || null;
  },

  findPlotsByFarmer(name) {
    if (!name) return [];
    return this.data?.plots.filter(p => p.ho_sx.toLowerCase().trim() === name.toLowerCase().trim()) || [];
  },

  findPlotsByZone(zoneName) {
    if (!zoneName) return [];
    return this.data?.plots.filter(p => p.xu_dong.toLowerCase().trim() === zoneName.toLowerCase().trim()) || [];
  },

  // Single Plot CRUD operations
  addPlot(plotObj) {
    if (!this.data.plots) this.data.plots = [];
    const newId = plotObj.id || ('plot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));
    const newPlot = {
      ...plotObj,
      id: newId,
      stt: String(plotObj.stt || (this.data.plots.length + 1)),
      tong_dt: parseFloat(plotObj.tong_dt) || 0,
      quy_1: parseFloat(plotObj.quy_1) || 0,
      quy_2: parseFloat(plotObj.quy_2) || 0,
      quy_khac: parseFloat(plotObj.quy_khac) || 0,
      is_rented: Boolean(plotObj.is_rented || (plotObj.ho_sx && plotObj.chu_ruong && plotObj.ho_sx.trim().toLowerCase() !== plotObj.chu_ruong.trim().toLowerCase()))
    };
    this.data.plots.push(newPlot);
    this.recalculateFarmers();
    this.recalculateZones();
    this.recalculateKPIs();
    this.persist();
    return newPlot;
  },

  updatePlot(plotId, updatedObj) {
    const idx = this.data.plots.findIndex(p => p.id === plotId || p.stt === String(plotId));
    if (idx === -1) return false;
    const existing = this.data.plots[idx];
    const isRented = updatedObj.is_rented !== undefined 
      ? Boolean(updatedObj.is_rented) 
      : (updatedObj.ho_sx && updatedObj.chu_ruong && updatedObj.ho_sx.trim().toLowerCase() !== updatedObj.chu_ruong.trim().toLowerCase());

    this.data.plots[idx] = {
      ...existing,
      ...updatedObj,
      tong_dt: parseFloat(updatedObj.tong_dt !== undefined ? updatedObj.tong_dt : existing.tong_dt) || 0,
      quy_1: parseFloat(updatedObj.quy_1 !== undefined ? updatedObj.quy_1 : existing.quy_1) || 0,
      quy_2: parseFloat(updatedObj.quy_2 !== undefined ? updatedObj.quy_2 : existing.quy_2) || 0,
      quy_khac: parseFloat(updatedObj.quy_khac !== undefined ? updatedObj.quy_khac : existing.quy_khac) || 0,
      is_rented: isRented
    };

    this.recalculateFarmers();
    this.recalculateZones();
    this.recalculateKPIs();
    this.persist();
    return true;
  },

  deletePlot(plotId) {
    const initialLen = this.data.plots.length;
    this.data.plots = this.data.plots.filter(p => p.id !== plotId && p.stt !== String(plotId));
    if (this.data.plots.length !== initialLen) {
      this.recalculateFarmers();
      this.recalculateZones();
      this.recalculateKPIs();
      this.persist();
      return true;
    }
    return false;
  },

  // Farmer CRUD Operations
  addFarmer(farmerObj) {
    if (!this.data.farmers) this.data.farmers = [];
    const name = farmerObj.name.trim();
    let f = this.findFarmer(name);
    if (!f) {
      f = {
        name: name,
        dia_chi: farmerObj.dia_chi || 'Tổ 1',
        dien_thoai: farmerObj.dien_thoai || '',
        cccd: farmerObj.cccd || '',
        ngay_sinh: farmerObj.ngay_sinh || '',
        nam_sinh: farmerObj.nam_sinh || null,
        gioi_tinh: farmerObj.gioi_tinh || 'Nam',
        so_thua: 0,
        tong_dt: 0,
        dt_ha: 0,
        quy_1: 0,
        quy_2: 0,
        quy_khac: 0,
        dt_chinh_chu: 0,
        dt_tich_tu: 0,
        so_thua_chinh_chu: 0,
        so_thua_thue: 0,
        xu_dong_list: []
      };
      this.data.farmers.push(f);
    } else {
      Object.assign(f, farmerObj);
    }
    this.recalculateKPIs();
    this.persist();
    return f;
  },

  updateFarmer(oldName, updatedObj) {
    const newName = updatedObj.name ? updatedObj.name.trim() : oldName;
    const f = this.findFarmer(oldName);
    if (f) {
      f.name = newName;
      if (updatedObj.dia_chi !== undefined) f.dia_chi = updatedObj.dia_chi;
      if (updatedObj.dien_thoai !== undefined) f.dien_thoai = updatedObj.dien_thoai;
      if (updatedObj.cccd !== undefined) f.cccd = updatedObj.cccd;
      if (updatedObj.ngay_sinh !== undefined) f.ngay_sinh = updatedObj.ngay_sinh;
      if (updatedObj.gioi_tinh !== undefined) f.gioi_tinh = updatedObj.gioi_tinh;
    }

    // Update matching plots if name or contact changed
    if (oldName !== newName || updatedObj.dien_thoai || updatedObj.dia_chi) {
      this.data.plots.forEach(p => {
        if (p.ho_sx && p.ho_sx.trim().toLowerCase() === oldName.trim().toLowerCase()) {
          p.ho_sx = newName;
          if (updatedObj.dien_thoai) p.dien_thoai = updatedObj.dien_thoai;
          if (updatedObj.dia_chi) p.dia_chi = updatedObj.dia_chi;
        }
      });
      this.recalculateFarmers();
      this.recalculateZones();
      this.recalculateKPIs();
    }
    this.persist();
    return true;
  },

  deleteFarmer(farmerName) {
    const f = this.findFarmer(farmerName);
    if (!f) return false;

    this.data.plots = this.data.plots.filter(p => p.ho_sx.trim().toLowerCase() !== farmerName.trim().toLowerCase());
    this.recalculateFarmers();
    this.recalculateZones();
    this.recalculateKPIs();
    this.persist();
    return true;
  },

  // Service Items & Fee Management Methods
  getServiceItems() {
    this.ensureServiceItems();
    return this.data.service_items;
  },

  addServiceItem(itemObj) {
    this.ensureServiceItems();
    const id = itemObj.id || ('fee_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4));
    const priceM2 = parseFloat(itemObj.price_m2) || 0;
    const priceSao = parseFloat(itemObj.price_sao) || (priceM2 * 500);

    const newItem = {
      id: id,
      name: itemObj.name.trim(),
      unit: itemObj.unit || 'm²',
      price_m2: priceM2,
      price_sao: priceSao,
      is_active: itemObj.is_active !== undefined ? Boolean(itemObj.is_active) : true,
      description: itemObj.description || ''
    };

    this.data.service_items.push(newItem);
    this.persist();
    return newItem;
  },

  updateServiceItem(itemId, updatedObj) {
    this.ensureServiceItems();
    const idx = this.data.service_items.findIndex(s => s.id === itemId);
    if (idx === -1) return false;

    const existing = this.data.service_items[idx];
    const priceM2 = updatedObj.price_m2 !== undefined ? parseFloat(updatedObj.price_m2) : existing.price_m2;
    const priceSao = updatedObj.price_sao !== undefined ? parseFloat(updatedObj.price_sao) : (priceM2 * 500);

    this.data.service_items[idx] = {
      ...existing,
      ...updatedObj,
      name: updatedObj.name ? updatedObj.name.trim() : existing.name,
      price_m2: priceM2,
      price_sao: priceSao,
      is_active: updatedObj.is_active !== undefined ? Boolean(updatedObj.is_active) : existing.is_active
    };

    this.persist();
    return true;
  },

  deleteServiceItem(itemId) {
    this.ensureServiceItems();
    const initialLen = this.data.service_items.length;
    this.data.service_items = this.data.service_items.filter(s => s.id !== itemId);
    if (this.data.service_items.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  },

  toggleServiceItem(itemId) {
    this.ensureServiceItems();
    const item = this.data.service_items.find(s => s.id === itemId);
    if (!item) return false;
    item.is_active = !item.is_active;
    this.persist();
    return item.is_active;
  },

  // Calculate dynamic fees for a given farmer
  calculateFarmerFees(farmer) {
    this.ensureServiceItems();
    const area = parseFloat(farmer.tong_dt) || 0;
    const breakdown = [];
    let total = 0;

    this.data.service_items.forEach(item => {
      if (item.is_active) {
        const itemAmount = Math.round(area * (item.price_m2 || 0));
        breakdown.push({
          id: item.id,
          name: item.name,
          unit: item.unit,
          price_m2: item.price_m2,
          price_sao: item.price_sao,
          amount: itemAmount
        });
        total += itemAmount;
      }
    });

    const paymentInfo = (this.data.payments && this.data.payments[farmer.name]) || { status: 'unpaid', paid_date: null, note: '' };

    return {
      farmer_name: farmer.name,
      area: area,
      sao: (area / 500),
      breakdown: breakdown,
      total: total,
      payment: paymentInfo
    };
  },

  setFarmerPaymentStatus(farmerName, status, note = '') {
    this.ensureServiceItems();
    if (!this.data.payments) this.data.payments = {};
    this.data.payments[farmerName] = {
      status: status,
      paid_date: status === 'paid' ? new Date().toISOString() : null,
      note: note
    };
    this.persist();
    return true;
  },

  // =========================================================================
  // PURCHASING & WEIGHING SESSIONS CRUD (PHÂN HỆ THU MUA & PHIÊN CÂN LÚA)
  // =========================================================================
  getPurchasingSessions() {
    this.ensurePurchasingData();
    return this.data.purchasing_sessions || [];
  },

  getPurchasingSession(sessionId) {
    this.ensurePurchasingData();
    return (this.data.purchasing_sessions || []).find(s => s.id === sessionId) || null;
  },

  addPurchasingSession(sessionObj) {
    this.ensurePurchasingData();
    const sessions = this.data.purchasing_sessions;
    
    // Auto generate STT
    const nextStt = sessions.length > 0 ? Math.max(...sessions.map(s => s.stt || 0)) + 1 : 1;
    const newId = 'session_' + Date.now();

    const newSession = {
      id: newId,
      stt: nextStt,
      ngay_can: sessionObj.ngay_can || new Date().toISOString().replace('T', ' ').slice(0, 16),
      ho_sx: sessionObj.ho_sx || 'Hộ nông dân',
      dia_chi: sessionObj.dia_chi || '',
      dien_thoai: sessionObj.dien_thoai || '',
      xu_dong: sessionObj.xu_dong || 'La Châu',
      can_bo_can: sessionObj.can_bo_can || 'Cán bộ cân',
      xe_nhan: sessionObj.xe_nhan || 'Xe A',
      loai_giong: sessionObj.loai_giong || 'J02',
      chi_tiet_can: Array.isArray(sessionObj.chi_tiet_can) ? sessionObj.chi_tiet_can : [],
      tong_so_bao: parseInt(sessionObj.tong_so_bao) || 0,
      luong_tuoi_kg: parseFloat(sessionObj.luong_tuoi_kg) || 0,
      ty_le_tru_pct: parseFloat(sessionObj.ty_le_tru_pct) != null ? parseFloat(sessionObj.ty_le_tru_pct) : 12.0,
      luong_kho_kg: parseFloat(sessionObj.luong_kho_kg) || 0,
      don_gia_kg: parseFloat(sessionObj.don_gia_kg) || 0,
      thanh_tien: parseFloat(sessionObj.thanh_tien) || 0,
      ghi_chu: sessionObj.ghi_chu || ''
    };

    // Remember unit price
    if (newSession.loai_giong && newSession.don_gia_kg > 0) {
      this.setRememberedPrice(newSession.loai_giong, newSession.don_gia_kg);
    }

    sessions.unshift(newSession); // Add to top
    this.persist();
    return newSession;
  },

  updatePurchasingSession(sessionId, updatedObj) {
    this.ensurePurchasingData();
    const idx = (this.data.purchasing_sessions || []).findIndex(s => s.id === sessionId);
    if (idx === -1) return false;

    const existing = this.data.purchasing_sessions[idx];
    this.data.purchasing_sessions[idx] = {
      ...existing,
      ...updatedObj,
      id: existing.id,
      stt: existing.stt
    };

    // Remember unit price
    if (updatedObj.loai_giong && updatedObj.don_gia_kg > 0) {
      this.setRememberedPrice(updatedObj.loai_giong, updatedObj.don_gia_kg);
    }

    this.persist();
    return this.data.purchasing_sessions[idx];
  },

  deletePurchasingSession(sessionId) {
    this.ensurePurchasingData();
    const initialLen = this.data.purchasing_sessions.length;
    this.data.purchasing_sessions = this.data.purchasing_sessions.filter(s => s.id !== sessionId);
    if (this.data.purchasing_sessions.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  },

  getRememberedPrice(variety) {
    this.ensurePurchasingData();
    if (!this.data.remembered_prices) return 8000;
    return this.data.remembered_prices[variety] || 8000;
  },

  setRememberedPrice(variety, price) {
    this.ensurePurchasingData();
    if (!this.data.remembered_prices) this.data.remembered_prices = {};
    this.data.remembered_prices[variety] = parseFloat(price) || 0;
    this.persist();
  },

  // Persist current state to localStorage
  persist() {
    try {
      if (this.data) {
        localStorage.setItem('agrigis_custom_raw_data', JSON.stringify(this.data));
      }
      if (this.geoJson) {
        localStorage.setItem('agrigis_custom_geojson', JSON.stringify(this.geoJson));
      }
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  },

  // Helper formatters
  formatArea(m2) {
    if (m2 == null || isNaN(m2)) return '0 m²';
    return Number(m2).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' m²';
  },

  formatAreaHa(m2) {
    if (m2 == null || isNaN(m2)) return '0 ha';
    const ha = m2 / 10000;
    return Number(ha).toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ha';
  },

  formatCurrency(num) {
    if (num == null || isNaN(num)) return '0 đ';
    return Math.round(num).toLocaleString('vi-VN') + ' đ';
  }
};
