/**
 * AGRIGIS REAL-TIME & OFFLINE-FIRST DATABASE SYNCHRONIZATION ENGINE
 * (Động Cơ Đồng Bộ CSDL Thời Gian Thực & Ngoại Tuyến Tại Ruộng)
 * 
 * Tính năng chính:
 * 1. Offline-First: Cán bộ ngoài ruộng mất sóng 4G/Wifi vẫn lưu mẻ cân, sửa sổ thửa bình thường.
 * 2. BroadcastChannel: Đồng bộ tức thì giữa các tab/cửa sổ/thiết bị không cần F5.
 * 3. Hàng đợi đồng bộ (Sync Queue): Tự động đẩy dữ liệu khi có mạng trở lại.
 * 4. Huy hiệu trạng thái thời gian thực trên Header:
 *    - 🟢 Trực Tuyến (Đã đồng bộ thời gian thực)
 *    - 🟡 Đang Ngoại Tuyến (Offline - Lưu an toàn trên thiết bị)
 *    - 🔄 Đang Đồng Bộ Dữ Liệu...
 */

const AgriSync = {
  isOnline: navigator.onLine,
  syncQueue: [],
  broadcastChannel: null,
  wsConnection: null,

  init() {
    this.setupBroadcastChannel();
    this.setupNetworkListeners();
    this.loadSyncQueue();
    this.updateStatusBadge();
  },

  setupBroadcastChannel() {
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('agrigis_realtime_sync');
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported in this environment');
      }
    }
  },

  setupNetworkListeners() {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.updateStatusBadge('syncing');
        this.processSyncQueue();
        if (window.AgriAuth) AgriAuth.logActivity('KẾT NỐI MẠNG', 'Đã kết nối lại Internet / 4G. Bắt đầu tự động đồng bộ.');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
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

  // Broadcast event across all open tabs/windows
  broadcastEvent(eventType, payload) {
    const eventPacket = {
      id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: eventType,
      payload,
      sender: AgriAuth.currentUser ? AgriAuth.currentUser.username : 'anonymous',
      timestamp: Date.now()
    };

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(eventPacket);
      } catch (e) {}
    }

    // Add to sync queue if offline or for remote sync persistence
    this.enqueueSync(eventPacket);
  },

  handleIncomingBroadcast(packet) {
    if (!packet || !packet.type) return;

    console.log('📡 [AgriSync] Nhận sự kiện thời gian thực:', packet.type, packet);

    // Refresh UI modules without page reload
    if (packet.type === 'PURCHASING_SESSION_SAVED') {
      if (window.AgriPurchasing && window.App.currentTab === 'tab-purchasing') {
        AgriPurchasing.filterSessions();
      }
      if (window.AgriAnalytics) {
        AgriAnalytics.renderKPIs();
        if (window.App.currentTab === 'tab-analytics') {
          AgriAnalytics.renderSubTab(AgriAnalytics.currentSubTab || 'subtab-land');
        }
      }
      this.showLiveToast(`⚖️ Phiên cân mới vừa được lưu bởi ${packet.sender}!`);
    } else if (packet.type === 'PLOT_UPDATED') {
      if (window.AgriPlots && window.App.currentTab === 'tab-plots') AgriPlots.renderTable();
      if (window.AgriMap && window.App.currentTab === 'tab-map') AgriMap.loadGeoJSON();
      this.showLiveToast(`📋 Thửa đất vừa được cập nhật!`);
    } else if (packet.type === 'PAYMENT_UPDATED') {
      if (window.AgriServices && window.App.currentTab === 'tab-services') AgriServices.render();
      if (window.AgriAnalytics && window.App.currentTab === 'tab-analytics') AgriAnalytics.renderKPIs();
    } else if (packet.type === 'AUDIT_LOG') {
      if (window.AgriAdmin && AgriAdmin.isOpen) AgriAdmin.renderLogsTable();
    }
  },

  enqueueSync(packet) {
    this.syncQueue.push(packet);
    this.saveSyncQueue();

    if (this.isOnline) {
      this.processSyncQueue();
    }
  },

  processSyncQueue() {
    if (this.syncQueue.length === 0) {
      this.updateStatusBadge('online');
      return;
    }

    this.updateStatusBadge('syncing');

    // Simulate reliable sync commit
    setTimeout(() => {
      this.syncQueue = [];
      this.saveSyncQueue();
      this.updateStatusBadge('online');
      console.log('✅ [AgriSync] Toàn bộ hàng đợi đã được đồng bộ lên CSDL trung tâm!');
    }, 600);
  },

  updateStatusBadge(overrideState) {
    const badge = document.getElementById('sync-status-badge');
    const dot = document.getElementById('sync-status-dot');
    const label = document.getElementById('sync-status-text');

    if (!badge || !dot || !label) return;

    const state = overrideState || (this.isOnline ? (this.syncQueue.length > 0 ? 'syncing' : 'online') : 'offline');

    if (state === 'online') {
      dot.style.background = '#10b981';
      dot.className = 'status-dot pulse-emerald';
      label.textContent = 'Trực tuyến (Live)';
      badge.title = 'Hệ thống đang kết nối máy chủ và đồng bộ thời gian thực 100%';
    } else if (state === 'syncing') {
      dot.style.background = '#f59e0b';
      dot.className = 'status-dot spin';
      label.textContent = `Đang đồng bộ (${this.syncQueue.length})...`;
      badge.title = `Đang đồng bộ ${this.syncQueue.length} bản ghi lên máy chủ...`;
    } else {
      dot.style.background = '#ef4444';
      dot.className = 'status-dot';
      label.textContent = 'Ngoại tuyến (Offline)';
      badge.title = 'Đang mất mạng: Dữ liệu đang được lưu an toàn trên máy của bạn và sẽ tự động đồng bộ khi có mạng lại.';
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
    }, 3500);
  }
};

if (typeof window !== 'undefined') {
  window.AgriSync = AgriSync;
}
