/**
 * AGRIGIS ULTRA-RESILIENT MULTI-TIER REAL-TIME & OFFLINE-FIRST DATABASE ENGINE
 * (Hệ Thống Đồng Bộ CSDL Thời Gian Thực Đa Tầng & Ngoại Tuyến Tại Ruộng)
 * 
 * 4 TẦNG ĐỒNG BỘ ĐỘC LẬP & TƯƠNG HỖ:
 * 1. Tầng 1 (Supabase Realtime WebSocket): Lắng nghe sự kiện postgres_changes trực tiếp (< 50ms).
 * 2. Tầng 2 (Supabase Realtime Broadcast): Truyền gói tin P2P tức thời giữa các trình duyệt.
 * 3. Tầng 3 (Cloud Heartbeat Polling): Tự động quét kiểm tra định kỳ mỗi 4 giây (chống mất gói tin khi ngủ/đổi mạng).
 * 4. Tầng 4 (Local BroadcastChannel & Offline Queue): Đồng bộ liên tab và lưu đệm an toàn khi mất sóng 4G.
 */

const AgriSync = {
  isOnline: navigator.onLine,
  syncQueue: [],
  broadcastQueue: [],
  broadcastChannel: null,
  supabaseChannel: null,
  isSupabaseSubscribed: false,
  pollTimer: null,
  lastSyncTime: Date.now(),

  init() {
    this.setupBroadcastChannel();
    this.setupNetworkListeners();
    this.loadSyncQueue();
    this.setupSupabaseRealtime();
    this.pullCloudData(false);
    this.startCloudPolling();
    this.updateStatusBadge();
  },

  // ---------------------------------------------------------------------------
  // 1. SUPABASE REALTIME WEBSOCKET & POSTGRES CHANGES
  // ---------------------------------------------------------------------------
  setupSupabaseRealtime() {
    const client = window.supabaseClient || (window.SupabaseConfig && SupabaseConfig.getClient());
    if (!client) {
      console.warn('⚠️ [AgriSync] Đang đợi Supabase SDK sẵn sàng...');
      setTimeout(() => this.setupSupabaseRealtime(), 1200);
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
        console.log('⚡ [Supabase Realtime] postgres_changes purchasing_sessions:', payload);
        this.handleRemotePurchasingChange(payload);
      })
      // 2. Lắng nghe thay đổi bảng Sổ Bộ Thửa Ruộng (plots)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plots' }, payload => {
        console.log('⚡ [Supabase Realtime] postgres_changes plots:', payload);
        this.handleRemotePlotChange(payload);
      })
      // 3. Lắng nghe thay đổi bảng Phí Dịch Vụ (service_payments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_payments' }, payload => {
        console.log('⚡ [Supabase Realtime] postgres_changes service_payments:', payload);
        this.handleRemotePaymentChange(payload);
      })
      // 4. Lắng nghe Broadcast Message tức thì giữa các thiết bị (< 50ms)
      .on('broadcast', { event: 'agrigis_sync_packet' }, ({ payload }) => {
        console.log('⚡ [Supabase Broadcast] Nhận tin nhắn tức thì từ thiết bị khác:', payload);
        this.handleIncomingBroadcast(payload, false);
      })
      .subscribe((status, err) => {
        console.log('📡 [Supabase Realtime WebSocket Status]:', status);
        if (status === 'SUBSCRIBED') {
          this.isSupabaseSubscribed = true;
          this.updateStatusBadge('online');
          this.flushBroadcastQueue();
          console.log('✅ [AgriSync] Đã kích hoạt kênh Realtime 2 Chiều thành công!');
        } else if (status === 'CHANNEL_ERROR') {
          this.isSupabaseSubscribed = false;
          console.warn('⚠️ [AgriSync] Kênh Realtime báo lỗi (có thể do kết nối mạng):', err);
          this.updateStatusBadge();
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          this.isSupabaseSubscribed = false;
          this.updateStatusBadge();
        }
      });

    } catch (err) {
      console.warn('⚠️ [AgriSync] Ngoại lệ khi khởi tạo Realtime:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // 2. SMART CLOUD POLLING (ĐỒNG BỘ ĐỊNH KỲ DỰ PHÒNG KHÔNG SỢ MẤT DỮ LIỆU)
  // ---------------------------------------------------------------------------
  startCloudPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    // Tự động kiểm tra phiên cân mới mỗi 4 giây
    this.pollTimer = setInterval(() => {
      if (this.isOnline) {
        this.pullCloudData(true);
      }
    }, 4000);

    // Kéo dữ liệu ngay khi người dùng chuyển lại tab (focus)
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('focus', () => {
        if (this.isOnline) {
          this.pullCloudData(true);
          this.processSyncQueue();
        }
      });
    }
  },

  // ---------------------------------------------------------------------------
  // 3. TẢI DỮ LIỆU TỪ SUPABASE CLOUD (PULL DATA)
  // ---------------------------------------------------------------------------
  async pullCloudData(isSilent = false) {
    const client = window.supabaseClient || (window.SupabaseConfig && SupabaseConfig.getClient());
    if (!client || !this.isOnline) return;

    try {
      const { data: remoteSessions, error } = await client
        .from('purchasing_sessions')
        .select('*')
        .order('created_datetime', { ascending: false })
        .limit(300);

      if (error) {
        // Nếu lỗi do bảng chưa tồn tại trên Supabase, ghi log nhẹ
        if (error.code === '42P01') {
          console.warn('⚠️ [AgriSync] Bảng "purchasing_sessions" chưa được tạo trên Supabase.');
        } else {
          console.warn('⚠️ [AgriSync] Lỗi khi pull dữ liệu từ Supabase:', error.message);
        }
        return;
      }

      if (Array.isArray(remoteSessions) && remoteSessions.length > 0) {
        if (!AgriData.data) AgriData.data = {};
        if (!AgriData.data.purchasing_sessions) AgriData.data.purchasing_sessions = [];

        let hasNewUpdates = false;
        let newCount = 0;

        remoteSessions.forEach(rs => {
          const idx = AgriData.data.purchasing_sessions.findIndex(s => s.id === rs.id);
          const formatted = {
            id: rs.id,
            stt: rs.stt || (AgriData.data.purchasing_sessions.length + 1),
            ngay_can: (rs.created_datetime || rs.created_at || '').replace('T', ' ').substring(0, 19),
            ho_sx: rs.farmer_name || rs.ho_sx || 'Hộ nông dân',
            dia_chi: rs.farmer_address || rs.dia_chi || '',
            dien_thoai: rs.farmer_phone || rs.dien_thoai || '',
            xu_dong: rs.xu_dong || '',
            can_bo_can: rs.can_bo_can || 'Cán bộ cân',
            xe_nhan: rs.xe_nhan || 'Xe nhận',
            loai_giong: rs.loai_giong || 'J02',
            chi_tiet_can: Array.isArray(rs.batches_json) ? rs.batches_json : (rs.chi_tiet_can || []),
            tong_so_bao: Number(rs.tong_so_bao || 0),
            luong_tuoi_kg: Number(rs.luong_tuoi_kg || 0),
            ty_le_tru_pct: rs.tru_do_am_pct != null ? Number(rs.tru_do_am_pct) : (rs.ty_le_tru_pct != null ? Number(rs.ty_le_tru_pct) : 12),
            luong_kho_kg: Number(rs.luong_kho_kg || 0),
            don_gia_kg: Number(rs.don_gia_kg || 8500),
            thanh_tien: Number(rs.thanh_tien || 0),
            ghi_chu: rs.note || rs.ghi_chu || ''
          };

          if (idx >= 0) {
            // Cập nhật nếu có thay đổi
            const current = AgriData.data.purchasing_sessions[idx];
            if (current.thanh_tien !== formatted.thanh_tien || current.tong_so_bao !== formatted.tong_so_bao || current.ho_sx !== formatted.ho_sx) {
              AgriData.data.purchasing_sessions[idx] = formatted;
              hasNewUpdates = true;
            }
          } else {
            // Thêm mới
            AgriData.data.purchasing_sessions.unshift(formatted);
            hasNewUpdates = true;
            newCount++;
          }
        });

        if (hasNewUpdates) {
          AgriData.saveCustomRawData();
          if (window.AgriPurchasing) {
            AgriPurchasing.filterSessions();
            AgriPurchasing.populateFilterDropdowns();
          }
          if (window.AgriAnalytics) {
            AgriAnalytics.renderKPIs();
          }

          if (!isSilent && newCount > 0) {
            this.showLiveToast(`🌾 [Realtime] Đã tự động đồng bộ ${newCount} phiên cân mới từ đám mây!`);
          }
          console.log(`✅ [AgriSync] Đồng bộ thành công ${remoteSessions.length} phiên cân từ Supabase Cloud!`);
        }
      }
    } catch (err) {
      console.warn('⚠️ [AgriSync] pullCloudData exception:', err);
    }
  },

  // ---------------------------------------------------------------------------
  // 4. XỬ LÝ SỰ KIỆN POSTGRES TỪ ĐÁM MÂY (REMOTE CHANGES)
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
        ty_le_tru_pct: newRec.tru_do_am_pct != null ? Number(newRec.tru_do_am_pct) : 12,
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

      if (window.AgriPurchasing) {
        AgriPurchasing.filterSessions();
        AgriPurchasing.populateFilterDropdowns();
      }
      if (window.AgriAnalytics) {
        AgriAnalytics.renderKPIs();
      }

      this.showLiveToast(`🌾 [Realtime] Phiên cân mới của hộ "${formatted.ho_sx}" (${formatted.luong_tuoi_kg} kg) vừa được lưu!`);

    } else if (eventType === 'DELETE') {
      if (!oldRec || !oldRec.id) return;
      AgriData.data.purchasing_sessions = AgriData.data.purchasing_sessions.filter(s => s.id !== oldRec.id);
      AgriData.saveCustomRawData();

      if (window.AgriPurchasing) AgriPurchasing.filterSessions();
      if (window.AgriAnalytics) AgriAnalytics.renderKPIs();
      this.showLiveToast(`🗑️ [Realtime] Một phiên cân vừa được xóa.`);
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
      this.showLiveToast(`💰 [Realtime] Khoản thu dịch vụ (${Number(newRec.amount_paid || 0).toLocaleString('vi-VN')} đ) vừa được ghi nhận!`);
    }
  },

  // ---------------------------------------------------------------------------
  // 5. PHÁT SỰ KIỆN VÀ ĐẨY LÊN SUPABASE (BROADCAST & PUSH)
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

    // 2. Broadcast tức thì qua Supabase WebSocket tới các thiết bị khác
    if (this.supabaseChannel && this.isSupabaseSubscribed) {
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'agrigis_sync_packet',
          payload: eventPacket
        });
      } catch (e) {
        this.broadcastQueue.push(eventPacket);
      }
    } else {
      this.broadcastQueue.push(eventPacket);
    }

    // 3. Đưa vào hàng đợi để ghi trực tiếp vào Supabase Postgres
    this.enqueueSync(eventPacket);
  },

  flushBroadcastQueue() {
    if (!this.supabaseChannel || !this.isSupabaseSubscribed) return;
    while (this.broadcastQueue.length > 0) {
      const pkt = this.broadcastQueue.shift();
      try {
        this.supabaseChannel.send({
          type: 'broadcast',
          event: 'agrigis_sync_packet',
          payload: pkt
        });
      } catch (e) {}
    }
  },

  handleIncomingBroadcast(packet, isLocalBroadcast = true) {
    if (!packet || !packet.type) return;

    if (packet.type === 'PURCHASING_SESSION_SAVED') {
      const s = packet.payload;
      if (s && s.id && AgriData && AgriData.data) {
        if (!AgriData.data.purchasing_sessions) AgriData.data.purchasing_sessions = [];
        const idx = AgriData.data.purchasing_sessions.findIndex(item => item.id === s.id);
        if (idx >= 0) {
          AgriData.data.purchasing_sessions[idx] = s;
        } else {
          AgriData.data.purchasing_sessions.unshift(s);
        }
        AgriData.saveCustomRawData();
      }

      if (window.AgriPurchasing) {
        AgriPurchasing.filterSessions();
        AgriPurchasing.populateFilterDropdowns();
      }
      if (window.AgriAnalytics) AgriAnalytics.renderKPIs();

      if (!isLocalBroadcast) {
        this.showLiveToast(`🌾 [Realtime] Phiên cân mới của hộ "${s.ho_sx || 'Nông dân'}" vừa được đồng bộ tức thì!`);
      }
    } else if (packet.type === 'PURCHASING_SESSION_DELETED') {
      const id = packet.payload?.id;
      if (id && AgriData && AgriData.data && AgriData.data.purchasing_sessions) {
        AgriData.data.purchasing_sessions = AgriData.data.purchasing_sessions.filter(item => item.id !== id);
        AgriData.saveCustomRawData();
      }
      if (window.AgriPurchasing) AgriPurchasing.filterSessions();
      if (window.AgriAnalytics) AgriAnalytics.renderKPIs();
    } else if (packet.type === 'PLOT_UPDATED') {
      if (window.AgriPlots && window.App.currentTab === 'tab-plots') AgriPlots.renderTable();
      if (window.AgriMap && window.App.currentTab === 'tab-map') AgriMap.loadGeoJSON();
    } else if (packet.type === 'PAYMENT_UPDATED') {
      if (window.AgriServices && window.App.currentTab === 'tab-services') AgriServices.render();
      if (window.AgriAnalytics) AgriAnalytics.renderKPIs();
    }
  },

  // ---------------------------------------------------------------------------
  // 6. HÀNG ĐỢI ĐỒNG BỘ NGOẠI TUYẾN (OFFLINE-FIRST SYNC QUEUE)
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
            console.warn('⚠️ [AgriSync] Lỗi đẩy phiên cân lên Supabase:', error.message);
            // Nếu lỗi do mạng tạm thời, giữ lại hàng đợi
            if (error.code === 'PGRST301' || error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
              remainingItems.push(item);
            }
          } else {
            console.log('✅ [AgriSync] Đã đẩy phiên cân lên Supabase Cloud:', s.id);
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
      } catch (e) {}
    }
  },

  setupNetworkListeners() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateStatusBadge('syncing');
        this.setupSupabaseRealtime();
        this.pullCloudData(false);
        this.processSyncQueue();
        if (window.AgriAuth) AgriAuth.logActivity('KẾT NỐI MẠNG', 'Đã kết nối lại Internet. Tự động đồng bộ thời gian thực.');
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
      try { this.syncQueue = JSON.parse(saved); } catch (e) { this.syncQueue = []; }
    } else {
      this.syncQueue = [];
    }
  },

  saveSyncQueue() {
    localStorage.setItem('agrigis_sync_queue', JSON.stringify(this.syncQueue));
    this.updateStatusBadge();
  },

  // ---------------------------------------------------------------------------
  // 7. HUY HIỆU TRẠNG THÁI REALTIME TRÊN HEADER
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
      label.textContent = this.isSupabaseSubscribed ? 'Realtime Live' : 'Đồng bộ Cloud';
      badge.title = 'Hệ thống đang kết nối CSDL Supabase và đồng bộ Realtime hai chiều 100%';
    } else if (state === 'syncing') {
      dot.style.background = '#f59e0b';
      dot.className = 'status-dot spin';
      label.textContent = `Đang đồng bộ (${this.syncQueue.length})...`;
      badge.title = `Đang đồng bộ ${this.syncQueue.length} bản ghi lên máy chủ đám mây...`;
    } else {
      dot.style.background = '#ef4444';
      dot.className = 'status-dot';
      label.textContent = 'Ngoại tuyến (Offline)';
      badge.title = 'Đang mất mạng: Dữ liệu đang được lưu an toàn trên máy và sẽ tự động đẩy lên Supabase khi có mạng lại.';
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
    }, 4500);
  }
};

if (typeof window !== 'undefined') {
  window.AgriSync = AgriSync;
}


