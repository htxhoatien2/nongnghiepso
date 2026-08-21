/**
 * AGRIGIS REAL-TIME & OFFLINE-FIRST DATABASE SYNCHRONIZATION ENGINE
 * (Động Cơ Đồng Bộ CSDL Thời Gian Thực & Ngoại Tuyến Tại Ruộng)
 * 
 * Tính năng chính:
 * 1. Supabase Realtime WebSocket: Kết nối 2 chiều tức thì (< 100ms) giữa tất cả các thiết bị (Webapp, Mobile).
 * 2. Postgres Changes Listener: Tự động bắt sự kiện INSERT, UPDATE, DELETE từ đám mây Supabase.
 * 3. Offline-First Sync Queue: Tự động lưu trên máy khi mất mạng ngoài đồng và tự đẩy lên đám mây khi có sóng lại.
 * 4. Two-Way State Sync: Tự động merge dữ liệu mới nhất mà không cần F5/tải lại trang.
 * 5. BroadcastChannel nội bộ: Đồng bộ song song giữa nhiều tab trên cùng 1 máy.
 */

const AgriSync = {
  isOnline: navigator.onLine,
  syncQueue: [],
  broadcastChannel: null,
  supabaseChannel: null,
  isSupabaseSubscribed: false,

  init() {
    this.setupBroadcastChannel();
    this.setupNetworkListeners();
    this.loadSyncQueue();
    this.setupSupabaseRealtime();
    this.pullCloudData();
    this.updateStatusBadge();
  },

  // ---------------------------------------------------------------------------
  // 1. SUPABASE REALTIME WEBSOCKET & POSTGRES CHANGES
  // ---------------------------------------------------------------------------
  setupSupabaseRealtime() {
    const client = window.supabaseClient || (window.SupabaseConfig && SupabaseConfig.getClient());
    if (!client) {
      console.warn('⚠️ [AgriSync] Supabase Client chưa sẵn sàng. Sẽ thử lại sau 1.5 giây...');
      setTimeout(() => this.setupSupabaseRealtime(), 1500);
      return;
    }

    try {
      if (this.supabaseChannel) {
        try { client.removeChannel(this.supabaseChannel); } catch (e) {}
      }

      console.log('🔌 [AgriSync] Đang mở kênh Supabase Realtime WebSocket...');

      this.supabaseChannel = client.channel('agrigis_realtime_db', {
        config: {
          broadcast: { self: false }
        }
      })
      // 1. Lắng nghe thay đổi bảng Phiên Cân Lúa (purchasing_sessions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchasing_sessions' }, payload => {
        console.log('⚡ [Supabase Realtime] Thay đổi phiên cân lúa:', payload);
        this.handleRemotePurchasingChange(payload);
      })
      // 2. Lắng nghe thay đổi bảng Sổ Bộ Thửa Ruộng (plots)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plots' }, payload => {
        console.log('⚡ [Supabase Realtime] Thay đổi sổ thửa:', payload);
        this.handleRemotePlotChange(payload);
      })
      // 3. Lắng nghe thay đổi bảng Phí Dịch Vụ (service_payments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_payments' }, payload => {
        console.log('⚡ [Supabase Realtime] Thay đổi thu phí dịch vụ:', payload);
        this.handleRemotePaymentChange(payload);
      })
      // 4. Lắng nghe Broadcast Message tức thì giữa các thiết bị
      .on('broadcast', { event: 'agrigis_sync_packet' }, ({ payload }) => {
        console.log('⚡ [Supabase Broadcast] Nhận tin nhắn Realtime:', payload);
        this.handleIncomingBroadcast(payload, false);
      })
      .subscribe((status, err) => {
        console.log('📡 [Supabase Realtime Channel Status]:', status);
        if (status === 'SUBSCRIBED') {
          this.isSupabaseSubscribed = true;
          this.updateStatusBadge('online');
          console.log('✅ [AgriSync] Kết nối thành công Supabase Realtime 2 Chiều!');
        } else if (status === 'CHANNEL_ERROR') {
          this.isSupabaseSubscribed = false;
          console.warn('⚠️ [AgriSync] Lỗi kênh Realtime:', err);
          this.updateStatusBadge();
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          this.isSupabaseSubscribed = false;
          this.updateStatusBadge();
        }
      });

    } catch (err) {
      console.warn('⚠️ [AgriSync] Ngoại lệ khi thiết lập Supabase Realtime:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // 2. XỬ LÝ SỰ KIỆN TỪ ĐÁM MÂY (REMOTE POSTGRES CHANGES)
  // ---------------------------------------------------------------------------
  handleRemotePurchasingChange(payload) {
    if (!window.AgriData || !AgriData.data) return;
    if (!AgriData.data.purchasing_sessions) AgriData.data.purchasing_sessions = [];

    const { eventType, new: newRec, old: oldRec } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (!newRec) return;

      const formatted = {
        id: newRec.id,
        stt: newRec.stt || (AgriData.data.purchasing_sessions.length + 1),
        ngay_can: (newRec.created_datetime || newRec.created_at || '').replace('T', ' ').substring(0, 19),
        ho_sx: newRec.farmer_name || newRec.ho_sx || 'Hộ nông dân',
        dia_chi: newRec.farmer_address || newRec.dia_chi || '',
        dien_thoai: newRec.farmer_phone || newRec.dien_thoai || '',
        xu_dong: newRec.xu_dong || '',
        can_bo_can: newRec.can_bo_can || 'Cán bộ cân',
        xe_nhan: newRec.xe_nhan || 'Xe nhận',
        loai_giong: newRec.loai_giong || 'J02',
        chi_tiet_can: Array.isArray(newRec.batches_json) ? newRec.batches_json : (newRec.chi_tiet_can || []),
        tong_so_bao: Number(newRec.tong_so_bao || 0),
        luong_tuoi_kg: Number(newRec.luong_tuoi_kg || 0),
        ty_le_tru_pct: newRec.tru_do_am_pct != null ? Number(newRec.tru_do_am_pct) : (newRec.ty_le_tru_pct != null ? Number(newRec.ty_le_tru_pct) : 12),
        luong_kho_kg: Number(newRec.luong_kho_kg || 0),
        don_gia_kg: Number(newRec.don_gia_kg || 8500),
        thanh_tien: Number(newRec.thanh_tien || 0),
        ghi_chu: newRec.note || newRec.ghi_chu || ''
      };

      const idx = AgriData.data.purchasing_sessions.findIndex(s => s.id === formatted.id);
      if (idx >= 0) {
        AgriData.data.purchasing_sessions[idx] = formatted;
      } else {
        AgriData.data.purchasing_sessions.unshift(formatted);
      }

      AgriData.saveCustomRawData();

      // Cập nhật giao diện nếu đang mở phân hệ Thu Mua
      if (window.AgriPurchasing) {
        AgriPurchasing.filterSessions();
        AgriPurchasing.populateFilterDropdowns();
      }
      if (window.AgriAnalytics) {
        AgriAnalytics.renderKPIs();
      }

      this.showLiveToast(`⚖️ [Realtime] Phiên cân mới #${formatted.stt} (${formatted.ho_sx} - ${formatted.luong_tuoi_kg} kg) vừa được đồng bộ từ đám mây!`);

    } else if (eventType === 'DELETE') {
      if (!oldRec || !oldRec.id) return;
      AgriData.data.purchasing_sessions = AgriData.data.purchasing_sessions.filter(s => s.id !== oldRec.id);
      AgriData.saveCustomRawData();

      if (window.AgriPurchasing) {
        AgriPurchasing.filterSessions();
      }
      if (window.AgriAnalytics) {
        AgriAnalytics.renderKPIs();
      }
      this.showLiveToast(`🗑️ [Realtime] Một phiên cân vừa được xóa từ hệ thống.`);
    }
  },

  handleRemotePlotChange(payload) {
    if (!window.AgriData || !AgriData.data || !AgriData.data.plots) return;
    const { eventType, new: newRec } = payload;

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      if (!newRec) return;
      const idx = AgriData.data.plots.findIndex(p => p.id === newRec.id || p.ma_so_thua === newRec.ma_so_thua);
      if (idx >= 0) {
        AgriData.data.plots[idx] = { ...AgriData.data.plots[idx], ...newRec };
      } else {
        AgriData.data.plots.push(newRec);
      }
      AgriData.saveCustomRawData();

      if (window.AgriPlots && window.App.currentTab === 'tab-plots') AgriPlots.renderTable();
      if (window.AgriMap && window.App.currentTab === 'tab-map') AgriMap.loadGeoJSON();
      this.showLiveToast(`📋 [Realtime] Thửa đất ${newRec.ma_so_thua || newRec.id} vừa được cập nhật!`);
    }
  },

  handleRemotePaymentChange(payload) {
    if (!window.AgriData || !AgriData.data) return;
    const { eventType, new: newRec } = payload;
    if (eventType === 'INSERT') {
      if (!AgriData.data.payments) AgriData.data.payments = [];
      AgriData.data.payments.unshift(newRec);
      AgriData.saveCustomRawData();

      if (window.AgriServices && window.App.currentTab === 'tab-services') AgriServices.render();
      if (window.AgriAnalytics) AgriAnalytics.renderKPIs();
      this.showLiveToast(`💰 [Realtime] Khoản thu dịch vụ mới (${Number(newRec.amount_paid || 0).toLocaleString('vi-VN')} đ) vừa được ghi nhận!`);
    }
  },

  // ---------------------------------------------------------------------------
  // 3. TẢI DỮ LIỆU ĐẦU KỲ TỪ SUPABASE CLOUD (PULL DATA)
  // ---------------------------------------------------------------------------
  async pullCloudData() {
    const client = window.supabaseClient || (window.SupabaseConfig && SupabaseConfig.getClient());
    if (!client || !this.isOnline) return;

    try {
      // 1. Kéo danh sách Phiên cân lúa từ Supabase
      const { data: remoteSessions, error } = await client
        .from('purchasing_sessions')
        .select('*')
        .order('created_datetime', { ascending: false })
        .limit(200);

      if (!error && Array.isArray(remoteSessions) && remoteSessions.length > 0) {
        if (!AgriData.data) AgriData.data = {};
        if (!AgriData.data.purchasing_sessions) AgriData.data.purchasing_sessions = [];

        let addedCount = 0;
        remoteSessions.forEach(rs => {
          const exists = AgriData.data.purchasing_sessions.some(s => s.id === rs.id);
          if (!exists) {
            AgriData.data.purchasing_sessions.push({
              id: rs.id,
              stt: rs.stt,
              ngay_can: (rs.created_datetime || rs.created_at || '').replace('T', ' ').substring(0, 19),
              ho_sx: rs.farmer_name,
              dia_chi: rs.farmer_address || '',
              dien_thoai: rs.farmer_phone || '',
              xu_dong: rs.xu_dong,
              can_bo_can: rs.can_bo_can || 'Cán bộ cân',
              xe_nhan: rs.xe_nhan || 'Xe nhận',
              loai_giong: rs.loai_giong || 'J02',
              chi_tiet_can: Array.isArray(rs.batches_json) ? rs.batches_json : [],
              tong_so_bao: Number(rs.tong_so_bao || 0),
              luong_tuoi_kg: Number(rs.luong_tuoi_kg || 0),
              ty_le_tru_pct: rs.tru_do_am_pct != null ? Number(rs.tru_do_am_pct) : 12,
              luong_kho_kg: Number(rs.luong_kho_kg || 0),
              don_gia_kg: Number(rs.don_gia_kg || 8500),
              thanh_tien: Number(rs.thanh_tien || 0),
              ghi_chu: rs.note || ''
            });
            addedCount++;
          }
        });

        if (addedCount > 0) {
          AgriData.saveCustomRawData();
          if (window.AgriPurchasing) AgriPurchasing.filterSessions();
          if (window.AgriAnalytics) AgriAnalytics.renderKPIs();
          console.log(`✅ [AgriSync] Đã nạp thành công ${addedCount} phiên cân từ Supabase Cloud!`);
        }
      }
    } catch (err) {
      console.warn('⚠️ [AgriSync] pullCloudData warning:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // 4. PHÁT SỰ KIỆN TỨC THÌ (BROADCAST & PUSH TO SUPABASE)
  // ---------------------------------------------------------------------------
  broadcastEvent(eventType, payload) {
    const eventPacket = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: eventType,
      payload,
      sender: AgriAuth.currentUser ? AgriAuth.currentUser.fullname || AgriAuth.currentUser.username : 'Cán bộ cân',
      timestamp: Date.now()
    };

    // 1. Broadcast nội bộ cùng trình duyệt
    if (this.broadcastChannel) {
      try { this.broadcastChannel.postMessage(eventPacket); } catch (e) {}
    }

    // 2. Broadcast qua Supabase WebSocket tới các máy/thiết bị khác
    if (this.supabaseChannel && this.isSupabaseSubscribed) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'agrigis_sync_packet',
          payload: eventPacket
        });
      } catch (e) {
        console.warn('⚠️ Broadcast send warning:', e);
      }
    }

    // 3. Đẩy dữ liệu vào hàng đợi đồng bộ và ghi vào Supabase Database
    this.enqueueSync(eventPacket);
  },

  handleIncomingBroadcast(packet, isLocalBroadcast = true) {
    if (!packet || !packet.type) return;
    console.log('📡 [AgriSync] Xử lý sự kiện đồng bộ:', packet.type, packet);

    if (packet.type === 'PURCHASING_SESSION_SAVED') {
      if (window.AgriPurchasing) {
        AgriPurchasing.filterSessions();
        AgriPurchasing.populateFilterDropdowns();
      }
      if (window.AgriAnalytics) AgriAnalytics.renderKPIs();
      if (!isLocalBroadcast) {
        this.showLiveToast(`⚖️ [Realtime] Phiên cân mới vừa được lưu bởi ${packet.sender}!`);
      }
    } else if (packet.type === 'PLOT_UPDATED') {
      if (window.AgriPlots && window.App.currentTab === 'tab-plots') AgriPlots.renderTable();
      if (window.AgriMap && window.App.currentTab === 'tab-map') AgriMap.loadGeoJSON();
      if (!isLocalBroadcast) {
        this.showLiveToast(`📋 [Realtime] Sổ thửa ruộng vừa được cập nhật bởi ${packet.sender}!`);
      }
    } else if (packet.type === 'PAYMENT_UPDATED') {
      if (window.AgriServices && window.App.currentTab === 'tab-services') AgriServices.render();
      if (window.AgriAnalytics) AgriAnalytics.renderKPIs();
    } else if (packet.type === 'AUDIT_LOG') {
      if (window.AgriAdmin && AgriAdmin.isOpen) AgriAdmin.renderLogsTable();
    }
  },

  // ---------------------------------------------------------------------------
  // 5. HÀNG ĐỢI ĐỒNG BỘ NGOẠI TUYẾN (OFFLINE-FIRST SYNC QUEUE)
  // ---------------------------------------------------------------------------
  enqueueSync(packet) {
    this.syncQueue.push(packet);
    this.saveSyncQueue();

    if (this.isOnline) {
      this.processSyncQueue();
    }
  },

  async processSyncQueue() {
    if (this.syncQueue.length === 0) {
      this.updateStatusBadge('online');
      return;
    }

    this.updateStatusBadge('syncing');
    const client = window.supabaseClient || (window.SupabaseConfig && SupabaseConfig.getClient());

    if (!client || !this.isOnline) {
      this.updateStatusBadge('offline');
      return;
    }

    const itemsToProcess = [...this.syncQueue];
    const remainingItems = [];

    for (const item of itemsToProcess) {
      try {
        if (item.type === 'PURCHASING_SESSION_SAVED') {
          const s = item.payload;
          const { error } = await client.from('purchasing_sessions').upsert({
            id: s.id,
            stt: Number(s.stt) || 1,
            farmer_name: s.ho_sx,
            farmer_phone: s.dien_thoai || null,
            farmer_address: s.dia_chi || null,
            xu_dong: s.xu_dong || 'Chưa xác định',
            loai_giong: s.loai_giong || 'J02',
            can_bo_can: s.can_bo_can || 'Cán bộ cân',
            xe_nhan: s.xe_nhan || null,
            created_datetime: s.ngay_can || new Date().toISOString(),
            tong_so_bao: Number(s.tong_so_bao) || 0,
            luong_tuoi_kg: Number(s.luong_tuoi_kg) || 0,
            tru_do_am_pct: s.ty_le_tru_pct != null ? Number(s.ty_le_tru_pct) : 12.0,
            luong_kho_kg: Number(s.luong_kho_kg) || 0,
            don_gia_kg: Number(s.don_gia_kg) || 8500,
            thanh_tien: Number(s.thanh_tien) || 0,
            note: s.ghi_chu || null,
            batches_json: s.chi_tiet_can || []
          });

          if (error) {
            console.warn('⚠️ [AgriSync] Lỗi khi đẩy phiên cân lên Supabase:', error.message);
            // Nếu lỗi mạng tạm thời, giữ lại hàng đợi
            if (error.code === 'PGRST301' || error.message.includes('fetch')) {
              remainingItems.push(item);
            }
          } else {
            console.log('✅ [AgriSync] Đã đẩy phiên cân lên Supabase Cloud thành công:', s.id);
          }
        }
      } catch (err) {
        console.warn('⚠️ [AgriSync] Ngoại lệ khi sync item:', err);
        remainingItems.push(item);
      }
    }

    this.syncQueue = remainingItems;
    this.saveSyncQueue();
    this.updateStatusBadge(this.syncQueue.length > 0 ? 'syncing' : 'online');
  },

  setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('agrigis_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data, true);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported');
      }
    }
  },

  setupNetworkListeners() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateStatusBadge('syncing');
        this.setupSupabaseRealtime();
        this.pullCloudData();
        this.processSyncQueue();
        if (window.AgriAuth) AgriAuth.logActivity('KẾT NỐI MẠNG', 'Đã kết nối lại Internet / 4G. Bắt đầu tự động đồng bộ.');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.isSupabaseSubscribed = false;
        this.updateStatusBadge('offline');
        if (window.AgriAuth) AgriAuth.logActivity('MẤT KẾT NỐI', 'Chuyển sang chế độ Cân Lúa Ngoại Tuyến (Offline-First).');
      });
    }
  },

  loadSyncQueue() {
    const saved = localStorage.getItem('agrigis_sync_queue');
    if (saved) {
      try {
        this.syncQueue = JSON.parse(saved);
      } catch (e) {
        this.syncQueue = [];
      }
    } else {
      this.syncQueue = [];
    }
  },

  saveSyncQueue() {
    localStorage.setItem('agrigis_sync_queue', JSON.stringify(this.syncQueue));
    this.updateStatusBadge();
  },

  // ---------------------------------------------------------------------------
  // 6. HUY HIỆU TRẠNG THÁI REALTIME TRÊN HEADER
  // ---------------------------------------------------------------------------
  updateStatusBadge(overrideState) {
    const badge = document.getElementById('sync-status-badge');
    const dot = document.getElementById('sync-status-dot');
    const label = document.getElementById('sync-status-text');

    if (!badge || !dot || !label) return;

    const state = overrideState || (this.isOnline ? (this.syncQueue.length > 0 ? 'syncing' : 'online') : 'offline');

    if (state === 'online') {
      dot.style.background = '#10b981';
      dot.className = 'status-dot pulse-emerald';
      label.textContent = this.isSupabaseSubscribed ? 'Realtime Live' : 'Trực tuyến';
      badge.title = 'Hệ thống đang kết nối máy chủ Supabase và đồng bộ Realtime WebSocket 100%';
    } else if (state === 'syncing') {
      dot.style.background = '#f59e0b';
      dot.className = 'status-dot spin';
      label.textContent = `Đang đồng bộ (${this.syncQueue.length})...`;
      badge.title = `Đang đồng bộ ${this.syncQueue.length} bản ghi lên máy chủ đám mây...`;
    } else {
      dot.style.background = '#ef4444';
      dot.className = 'status-dot';
      label.textContent = 'Ngoại tuyến (Offline)';
      badge.title = 'Đang mất mạng: Dữ liệu đang được lưu an toàn trên máy của bạn và sẽ tự động đẩy lên Supabase khi có mạng lại.';
    }
  },

  showLiveToast(msg) {
    let toast = document.getElementById('agrigis-live-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'agrigis-live-toast';
      toast.className = 'live-sync-toast';
      document.body.appendChild(toast);
    }

    toast.innerHTML = `<i data-lucide="radio"></i> <span>${msg}</span>`;
    if (window.lucide) lucide.createIcons();
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }
};

if (typeof window !== 'undefined') {
  window.AgriSync = AgriSync;
}

