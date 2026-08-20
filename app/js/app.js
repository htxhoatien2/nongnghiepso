/**
 * AGRIGIS MAIN CONTROLLER & APPLICATION ENTRY POINT
 */

const App = {
  currentTab: 'tab-home',

  async init() {
    console.log('Starting AgriGIS Application...');

    // 1. Initialize Data Store
    try {
      await AgriData.init();
    } catch (e) {
      console.error('AgriData init error:', e);
    }

    // 2. Setup Security, RBAC Auth & Real-time Sync Engine
    try { if (window.AgriAuth) AgriAuth.init(); } catch (e) { console.error('AgriAuth init error:', e); }
    try { if (window.AgriSync) AgriSync.init(); } catch (e) { console.error('AgriSync init error:', e); }
    try { if (window.AgriAdmin) AgriAdmin.init(); } catch (e) { console.error('AgriAdmin init error:', e); }

    // 3. Setup Global UI Events (Navigation, tabs, theme, search MUST ALWAYS WORK FIRST!)
    try { this.setupNavigation(); } catch (e) { console.error('setupNavigation error:', e); }
    try { this.setupThemeToggle(); } catch (e) { console.error('setupThemeToggle error:', e); }
    try { this.setupQuickSearch(); } catch (e) { console.error('setupQuickSearch error:', e); }
    try { this.setupExportSummary(); } catch (e) { console.error('setupExportSummary error:', e); }

    // 4. Initialize Core Data Modules
    try { AgriPlots.init(); } catch (e) { console.error('AgriPlots init error:', e); }
    try { AgriFarmers.init(); } catch (e) { console.error('AgriFarmers init error:', e); }
    try { AgriAnalytics.init(); } catch (e) { console.error('AgriAnalytics init error:', e); }
    try { AgriServices.init(); } catch (e) { console.error('AgriServices init error:', e); }
    try { if (window.AgriPurchasing) AgriPurchasing.init(); } catch (e) { console.error('AgriPurchasing init error:', e); }

    // 5. Setup Progressive Web App (PWA) Offline & Installation
    try { this.setupPWA(); } catch (e) { console.error('setupPWA error:', e); }

    // Render Lucide Icons
    try { if (window.lucide) lucide.createIcons(); } catch (e) {}

    // 6. ENFORCE DEFAULT TAB: Always initialize directly at 'tab-home' (Trang Chủ) on any link / page load
    this.switchTab('tab-home');

    console.log('AgriGIS Ready with PWA support!');
  },

  // =========================================================================
  // PROGRESSIVE WEB APP (PWA) ENGINE
  // =========================================================================
  deferredPrompt: null,

  setupPWA() {
    // 1. Register Service Worker for 100% Offline Capability
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
          .then((registration) => {
            console.log('✅ AgriGIS ServiceWorker registered successfully with scope:', registration.scope);
            // Check for updates immediately
            try { registration.update(); } catch (e) {}
          })
          .catch((err) => {
            console.warn('⚠️ ServiceWorker registration note (Normal in non-HTTPS / file://):', err);
          });
      });
    }

    // 2. Listen for BeforeInstallPrompt silently (triggered on demand via User Menu)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      console.log('📱 PWA installation is ready on demand!');
    });

    window.addEventListener('appinstalled', () => {
      console.log('🎉 AgriGIS PWA installed successfully on device!');
      this.deferredPrompt = null;
      if (window.AgriSync) {
        AgriSync.showLiveToast('Đã cài đặt ứng dụng AgriGIS về màn hình chính thành công!');
      }
    });
  },

  async installPWA() {
    if (!this.deferredPrompt) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIOS) {
        alert('Để cài đặt AgriGIS trên iPhone / iPad:\n\n1. Bấm nút Chia Sẻ (Share ⎋) ở thanh công cụ trình duyệt Safari\n2. Cuộn xuống chọn "Thêm vào Màn hình chính" (Add to Home Screen ➕)');
      } else {
        alert('Để cài đặt AgriGIS trên Android / Máy tính:\n\n1. Bấm vào biểu tượng menu (⋮) ở góc trên trình duyệt\n2. Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính" (Install / Add to Home screen)');
      }
      return;
    }

    // Trigger Native Install Prompt
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    this.deferredPrompt = null;
  },

  // Navigation / Tab router
  setupNavigation() {
    // 1. Desktop Nav Buttons
    document.querySelectorAll('.header-desktop-nav .d-nav-btn').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = item.dataset.tab;
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });

    // 2. Mobile Bottom Nav Buttons (Touch & Click Support)
    document.querySelectorAll('.app-mobile-nav .mob-nav-btn').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetTab = item.dataset.tab;
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });
  },

  switchTab(tabId) {
    if (!tabId) tabId = 'tab-home';

    // 1. Guard check: Guest cannot access functional modules without logging in
    if (tabId !== 'tab-home' && window.AgriAuth && !AgriAuth.isLoggedIn()) {
      if (window.AgriSync) {
        AgriSync.showLiveToast('🔒 Vui lòng đăng nhập để truy cập phân hệ nghiệp vụ này!');
      }
      AgriAuth.openLoginModal('standard');
      return;
    }

    // 2. Guard check: Logged in user must have view permission for the target module
    if (tabId !== 'tab-home' && window.AgriAuth && AgriAuth.isLoggedIn()) {
      const moduleMap = {
        'tab-map': 'map',
        'tab-plots': 'plots',
        'tab-farmers': 'farmers',
        'tab-services': 'services',
        'tab-purchasing': 'purchasing',
        'tab-analytics': 'analytics',
        'tab-admin': 'admin'
      };
      const mod = moduleMap[tabId];
      if (mod) {
        const canSee = (mod === 'admin') ? (AgriAuth.canAdmin('admin') || AgriAuth.canView('admin')) : AgriAuth.canView(mod);
        if (!canSee) {
          alert('Tài khoản của bạn không có quyền truy cập phân hệ này!');
          return;
        }
      }
    }

    this.currentTab = tabId;

    // Toggle Panes: Explicitly show target and hide others
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });

    const activePane = document.getElementById(tabId);
    if (activePane) {
      activePane.classList.add('active');
      activePane.style.display = 'block';
    }

    // Update Top Header Tabs Active State & Auto-Scroll into view on mobile
    document.querySelectorAll('.header-desktop-nav .d-nav-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      if (isActive && window.innerWidth <= 768) {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });

    // Update Mobile Curved Bottom Nav Active State
    document.querySelectorAll('.app-mobile-nav .mob-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Invalidate Leaflet Map Size when returning to map
    if (tabId === 'tab-map' && window.AgriMap) {
      setTimeout(() => {
        if (!AgriMap.map) {
          AgriMap.init();
          if (window.AgriMapEditor) AgriMapEditor.init();
        }
        if (AgriMap.map) {
          AgriMap.map.invalidateSize(true);
        }
      }, 50);

      setTimeout(() => {
        if (AgriMap.map) {
          AgriMap.map.invalidateSize(true);
          if (AgriMap.geoJsonLayer && AgriMap.geoJsonLayer.getBounds && AgriMap.geoJsonLayer.getBounds().isValid()) {
            AgriMap.map.fitBounds(AgriMap.geoJsonLayer.getBounds(), { padding: [20, 20] });
          }
        }
      }, 250);
    }

    // Re-render Analytics charts if switching to analytics
    if (tabId === 'tab-analytics') {
      setTimeout(() => {
        if (window.AgriAnalytics) AgriAnalytics.renderSubTab(AgriAnalytics.currentSubTab || 'subtab-land');
      }, 100);
    }

    // Render Admin subsystem if switching to admin
    if (tabId === 'tab-admin') {
      setTimeout(() => {
        if (window.AgriAdmin) AgriAdmin.render();
      }, 50);
    }

    if (window.lucide) lucide.createIcons();
  },

  // Dark/Light Mode Theme Toggle
  setupThemeToggle() {
    const themeBtn = document.getElementById('btn-theme-toggle');
    const savedTheme = localStorage.getItem('agrigis-theme') || 'light';

    if (savedTheme === 'dark') {
      document.body.classList.remove('light-mode');
      document.body.classList.add('dark-mode');
    }

    themeBtn?.addEventListener('click', () => {
      const isDark = document.body.classList.contains('dark-mode');
      if (isDark) {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        localStorage.setItem('agrigis-theme', 'light');
      } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        localStorage.setItem('agrigis-theme', 'dark');
      }
      if (window.lucide) lucide.createIcons();
    });
  },

  // Quick Search
  setupQuickSearch() {
    const searchBtn = document.getElementById('btn-quick-search');
    searchBtn?.addEventListener('click', () => {
      const q = prompt('Nhập tên hộ sản xuất, chủ ruộng, hoặc xứ đồng cần tìm:');
      if (!q) return;

      const farmer = AgriData.findFarmer(q);
      if (farmer) {
        this.switchTab('tab-farmers');
        document.getElementById('farmers-search').value = q;
        AgriFarmers.filterFarmers();
        AgriFarmers.showDetail(farmer.name);
        return;
      }

      const zone = AgriData.findZone(q);
      if (zone) {
        this.switchTab('tab-map');
        AgriMap.flyToZone(zone.name);
        return;
      }

      // Default to plots search
      this.switchTab('tab-plots');
      document.getElementById('plots-search').value = q;
      AgriPlots.filterPlots();
    });
  },

  // Export Summary Report
  setupExportSummary() {
    document.getElementById('btn-export-summary')?.addEventListener('click', () => {
      if (window.AgriAnalytics) {
        AgriAnalytics.printExecutiveReport();
      } else {
        window.print();
      }
    });

    // Close modals when clicking backdrop
    document.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('open');
        if (window.AgriAdmin) AgriAdmin.isOpen = false;
      }
    });
  }
};

// Expose globally for cross-module interactions
window.App = App;

// Start application on DOM Ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
} else {
  App.init();
}

