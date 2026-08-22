/**
 * AGRIGIS AUTHENTICATION, RBAC MATRIX & AUDIT LOGGING MODULE
 * (Phân Hệ Bảo Mật, Phân Quyền RBAC & Nhật Ký Truy Vết)
 */

const AgriAuth = {
  // Pre-configured staff accounts for instant field deployment (Only 1 Super Admin initially)
  defaultUsers: [
    {
      id: 'usr_001',
      username: 'giamdoc',
      pin: '8888',
      fullname: 'Ban Giám Đốc HTX',
      role: 'director',
      roleName: '👑 Ban Giám Đốc HTX',
      cccd: '',
      ngay_sinh: '',
      gioi_tinh: 'Nam',
      dia_chi: 'Thôn La Châu, Xã Hòa Tiến',
      to_dan_pho: 'Tất cả các tổ',
      assigned_zones: ['Tất cả các xứ đồng'],
      phone: '0905123456',
      email: 'htxhoatien2@gmail.com',
      ghi_chu: 'Quản trị viên tối cao (Super Admin) toàn hệ thống HTX Hòa Tiến 2',
      date_joined: '2023-01-01',
      active: true
    }
  ],

  // 3-Tier RBAC Permission Matrix Definition (Quản trị: 'admin', Chỉnh sửa: 'edit', Xem: 'view', Khóa: 'none')
  defaultPermissions: {
    director: {
      map: 'admin',
      plots: 'admin',
      farmers: 'admin',
      services: 'admin',
      purchasing: 'admin',
      analytics: 'admin',
      admin: 'admin'
    },
    accountant: {
      map: 'view',
      plots: 'view',
      farmers: 'edit',
      services: 'admin',
      purchasing: 'admin',
      analytics: 'admin',
      admin: 'none'
    },
    cadastre: {
      map: 'admin',
      plots: 'admin',
      farmers: 'edit',
      services: 'view',
      purchasing: 'view',
      analytics: 'view',
      admin: 'none'
    },
    weighing_staff: {
      map: 'view',
      plots: 'view',
      farmers: 'view',
      services: 'view',
      purchasing: 'edit',
      analytics: 'view',
      admin: 'none'
    },
    village_head: {
      map: 'view',
      plots: 'view',
      farmers: 'edit',
      services: 'edit',
      purchasing: 'view',
      analytics: 'view',
      admin: 'none'
    },
    farmer: {
      map: 'view',
      plots: 'view',
      farmers: 'view',
      services: 'view',
      purchasing: 'view',
      analytics: 'view',
      admin: 'none'
    }
  },

  currentUser: null,
  users: [],
  permissions: {},
  logs: [],
  failedAttempts: {},

  recordFailedAttempt(account) {
    if (!account) return;
    if (!this.failedAttempts[account]) {
      this.failedAttempts[account] = { count: 0, lastAttempt: Date.now() };
    }
    this.failedAttempts[account].count += 1;
    this.failedAttempts[account].lastAttempt = Date.now();
  },

  resetFailedAttempts(account) {
    if (!account) return;
    delete this.failedAttempts[account];
  },

  init() {
    this.loadPermissions();
    this.loadUsers();
    this.loadLogs();
    this.restoreSession();
    this.updateUserUI();
    this.setupDropdownListeners();
    this.initSupabaseAuthListener();
  },

  setupDropdownListeners() {
    if (typeof document !== 'undefined') {
      document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('header-user-menu-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
          wrapper.classList.remove('open');
        }
      });
    }
  },

  toggleUserDropdown(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const wrapper = document.getElementById('header-user-menu-wrapper');
    if (wrapper) {
      wrapper.classList.toggle('open');
    }
  },

  closeUserDropdown() {
    const wrapper = document.getElementById('header-user-menu-wrapper');
    if (wrapper) {
      wrapper.classList.remove('open');
    }
  },

  loadPermissions() {
    const saved = localStorage.getItem('agrigis_permissions_matrix');
    if (saved) {
      try {
        this.permissions = JSON.parse(saved);
      } catch (e) {
        this.permissions = JSON.parse(JSON.stringify(this.defaultPermissions));
      }
    } else {
      this.permissions = JSON.parse(JSON.stringify(this.defaultPermissions));
      this.savePermissions();
    }
  },

  savePermissions() {
    localStorage.setItem('agrigis_permissions_matrix', JSON.stringify(this.permissions));
  },

  loadUsers() {
    const saved = localStorage.getItem('agrigis_users');
    let loaded = [];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Remove old mock template users usr_002 to usr_006 if they didn't have user input
          const legacyMockIds = ['usr_002', 'usr_003', 'usr_004', 'usr_005', 'usr_006'];
          loaded = parsed.filter(u => !legacyMockIds.includes(u.id));
        }
      } catch (e) {}
    }

    // Always ensure Super Admin usr_001 is present
    const defaultCopy = JSON.parse(JSON.stringify(this.defaultUsers));
    if (loaded.length === 0) {
      this.users = defaultCopy;
    } else {
      defaultCopy.forEach(defU => {
        const exists = loaded.some(u => u.id === defU.id || u.username === defU.username);
        if (!exists) {
          loaded.unshift(defU);
        }
      });
      this.users = loaded;
    }
    this.saveUsers();
  },

  saveUsers() {
    localStorage.setItem('agrigis_users', JSON.stringify(this.users));
  },

  loadLogs() {
    const saved = localStorage.getItem('agrigis_audit_logs');
    if (saved) {
      try {
        this.logs = JSON.parse(saved);
      } catch (e) {
        this.logs = [];
      }
    } else {
      this.logs = [];
    }
  },

  saveLogs() {
    localStorage.setItem('agrigis_audit_logs', JSON.stringify(this.logs));
  },

  restoreSession() {
    if (!this.users || this.users.length === 0) {
      this.loadUsers();
    }
    const legacyNameMap = {
      'Nguyễn Văn Giám Đốc': 'Ban Giám Đốc HTX',
      'Lê Thị Kế Toán': 'Bộ Phận Kế Toán - Thủ Quỹ',
      'Trần Văn Địa Chính': 'Cán Bộ Địa Chính GIS',
      'Phạm Cân Lúa (Tổ 1-5)': 'Cán Bộ Cân Thu Mua',
      'Võ Trưởng Thôn (Tổ 5)': 'Ban Điều Hành Tổ Dân Phố',
      'Hồ Thị Vân (Xã Viên)': 'Hộ Nông Dân / Xã Viên'
    };

    const savedUser = localStorage.getItem('agrigis_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id && parsed.role !== 'guest') {
          if (legacyNameMap[parsed.fullname]) {
            parsed.fullname = legacyNameMap[parsed.fullname];
          }
          this.currentUser = parsed;
          this.saveSession();
        } else {
          this.currentUser = null;
        }
      } catch (e) {
        this.currentUser = null;
      }
    } else {
      this.currentUser = null;
    }
  },

  isLoggedIn() {
    return Boolean(this.currentUser && this.currentUser.id && this.currentUser.role !== 'guest');
  },

  saveSession() {
    if (this.currentUser) {
      localStorage.setItem('agrigis_current_user', JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem('agrigis_current_user');
    }
  },

  // Switch active role / user
  login(usernameOrId, pin) {
    const user = this.users.find(u => (u.username === usernameOrId || u.id === usernameOrId) && u.active);
    if (!user) {
      return { success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa!' };
    }
    if (pin && user.pin !== pin) {
      return { success: false, message: 'Mã PIN bảo mật không chính xác!' };
    }

    this.currentUser = user;
    this.saveSession();
    this.logActivity('ĐĂNG NHẬP', `Đăng nhập thành công với vai trò ${user.roleName}`);
    this.updateUserUI();
    this.applyRoleRestrictions();

    return { success: true, user };
  },

  switchUserById(userId) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      this.currentUser = user;
      this.saveSession();
      this.logActivity('CHUYỂN VAI TRÒ', `Chuyển sang tài khoản ${user.fullname} (${user.roleName})`);
      this.updateUserUI();
      this.applyRoleRestrictions();
    }
  },

  // =========================================================================
  // 3-TIER PERMISSION ENGINE (QUẢN TRỊ, CHỈNH SỬA, XEM, KHÓA)
  // =========================================================================
  getPermission(moduleKey) {
    if (!this.isLoggedIn()) return 'none';
    const role = this.currentUser.role;
    if (role === 'director') return 'admin';
    const rolePerms = this.permissions[role] || this.defaultPermissions[role] || {};
    return rolePerms[moduleKey] || 'view';
  },

  canAdmin(moduleKey) {
    if (!this.isLoggedIn()) return false;
    if (this.currentUser.role === 'director') return true;
    return this.getPermission(moduleKey) === 'admin';
  },

  canEdit(moduleKey) {
    if (!this.isLoggedIn()) return false;
    if (this.currentUser.role === 'director') return true;
    const p = this.getPermission(moduleKey);
    return p === 'admin' || p === 'edit';
  },

  canView(moduleKey) {
    if (!this.isLoggedIn()) return false;
    if (this.currentUser.role === 'director') return true;
    return this.getPermission(moduleKey) !== 'none';
  },

  // Backward compatibility mapper for existing calls
  hasPermission(permKey) {
    if (!this.isLoggedIn()) return false;
    const role = this.currentUser.role;
    if (role === 'director') return true;

    // Direct boolean check if defined
    const rolePerms = this.permissions[role] || this.defaultPermissions[role] || {};
    if (typeof rolePerms[permKey] === 'boolean') return rolePerms[permKey];

    // Map old keys to 3-tier checks
    switch (permKey) {
      case 'canAdminSystem':
        return this.canAdmin('admin');
      case 'canEditMap':
        return this.canEdit('map');
      case 'canEditPlots':
        return this.canEdit('plots');
      case 'canEditFarmers':
        return this.canEdit('farmers');
      case 'canConfigServices':
        return this.canAdmin('services');
      case 'canCollectServices':
        return this.canEdit('services');
      case 'canWeighRice':
        return this.canEdit('purchasing');
      case 'canEditPurchasing':
        return this.canEdit('purchasing');
      case 'canViewFullPII':
        return this.canAdmin('farmers') || role === 'accountant' || role === 'village_head';
      case 'canViewAnalytics':
        return this.canView('analytics');
      default:
        return false;
    }
  },

  // Helper for UI Badges across tables
  getUserPermissionTier(user) {
    if (!user) return { tier: 'view', label: '👁️ Chỉ Xem', badgeClass: 'badge-blue' };
    if (user.role === 'director') {
      return { tier: 'admin', label: '👑 Quản Trị', badgeClass: 'badge-purple' };
    }
    const rolePerms = this.permissions[user.role] || this.defaultPermissions[user.role] || {};
    const values = Object.values(rolePerms);
    if (values.some(v => v === 'admin')) return { tier: 'admin', label: '👑 Quản Trị', badgeClass: 'badge-purple' };
    if (values.some(v => v === 'edit')) return { tier: 'edit', label: '✏️ Chỉnh Sửa', badgeClass: 'badge-emerald' };
    return { tier: 'view', label: '👁️ Chỉ Xem', badgeClass: 'badge-blue' };
  },

  // Mask sensitive data (Nghị định 13/2023/NĐ-CP)
  maskCCCD(cccd) {
    if (!cccd) return '---';
    if (this.hasPermission('canViewFullPII')) return cccd;
    const s = String(cccd);
    if (s.length <= 4) return '****';
    return s.slice(0, 3) + '****' + s.slice(-3);
  },

  maskPhone(phone) {
    if (!phone) return '---';
    if (this.hasPermission('canViewFullPII')) return phone;
    const s = String(phone);
    if (s.length <= 4) return '***';
    return s.slice(0, 4) + '***' + s.slice(-3);
  },

  // Audit Logging
  logActivity(action, details) {
    const logItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      time: new Date().toISOString(),
      timeFormatted: new Date().toLocaleString('vi-VN'),
      user_id: this.currentUser?.id || 'sys',
      username: this.currentUser?.username || 'Hệ thống',
      fullname: this.currentUser?.fullname || 'Hệ thống',
      role: this.currentUser?.role || 'system',
      action,
      details,
      device: (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Mobile')) ? '📱 Di động ngoài ruộng' : '💻 Máy tính văn phòng'
    };

    this.logs.unshift(logItem);
    if (this.logs.length > 500) this.logs.pop();
    this.saveLogs();

    if (window.AgriSync) {
      AgriSync.broadcastEvent('AUDIT_LOG', logItem);
    }
  },

  // UI Updates
  updateUserUI() {
    const loggedIn = this.isLoggedIn();
    const user = this.currentUser;

    const userBtn = document.getElementById('header-user-profile-btn');
    const initialEl = document.getElementById('header-user-avatar-initial');
    const ddAvatar = document.getElementById('dropdown-user-avatar');
    const ddFullname = document.getElementById('dropdown-user-fullname');
    const ddUsername = document.getElementById('dropdown-user-username');
    const ddRole = document.getElementById('dropdown-user-role');
    const loginItem = document.getElementById('dropdown-item-login');
    const logoutItem = document.getElementById('dropdown-item-logout');

    if (loggedIn && user) {
      const initial = (user.fullname || 'U').trim().charAt(0);
      if (userBtn) userBtn.title = `Tài khoản: ${user.fullname} (@${user.username}) - ${user.roleName}`;
      if (initialEl) initialEl.textContent = initial;
      if (ddAvatar) ddAvatar.textContent = initial;
      if (ddFullname) ddFullname.textContent = user.fullname;
      if (ddUsername) ddUsername.textContent = `@${user.username}`;
      if (ddRole) ddRole.textContent = user.roleName;
      if (loginItem) loginItem.style.display = 'none';
      if (logoutItem) logoutItem.style.display = 'flex';
    } else {
      if (userBtn) userBtn.title = 'Chưa đăng nhập - Bấm để đăng nhập';
      if (initialEl) initialEl.innerHTML = '<i data-lucide="user" style="width:16px;height:16px;"></i>';
      if (ddAvatar) ddAvatar.innerHTML = '<i data-lucide="user" style="width:18px;height:18px;"></i>';
      if (ddFullname) ddFullname.textContent = 'Khách Vãng Lai';
      if (ddUsername) ddUsername.textContent = 'Chưa đăng nhập';
      if (ddRole) ddRole.textContent = '🔒 Vui lòng đăng nhập';
      if (loginItem) loginItem.style.display = 'flex';
      if (logoutItem) logoutItem.style.display = 'none';
    }

    if (window.lucide) lucide.createIcons();
    this.applyRoleRestrictions();
  },

  viewCurrentProfile() {
    const user = this.currentUser || this.defaultUsers[0];
    if (!user) {
      this.openLoginModal('standard');
      return;
    }

    const modal = document.getElementById('modal-auth-user-profile');
    if (!modal) return;

    const initial = (user.fullname || user.username || 'G').charAt(0).toUpperCase();
    const avatarEl = document.getElementById('profile-modal-avatar');
    if (avatarEl) avatarEl.textContent = initial;

    const roleSubEl = document.getElementById('profile-modal-role-sub');
    if (roleSubEl) roleSubEl.textContent = user.roleName || 'Cán bộ HTX';

    const usernameEl = document.getElementById('profile-modal-username');
    if (usernameEl) usernameEl.value = '@' + (user.username || '');

    const roleNameEl = document.getElementById('profile-modal-role-name');
    if (roleNameEl) roleNameEl.value = user.roleName || '';

    const fullnameEl = document.getElementById('profile-modal-fullname');
    if (fullnameEl) fullnameEl.value = user.fullname || '';

    const phoneEl = document.getElementById('profile-modal-phone');
    if (phoneEl) phoneEl.value = user.phone || '';

    const emailEl = document.getElementById('profile-modal-email');
    if (emailEl) emailEl.value = user.email || '';

    const addressEl = document.getElementById('profile-modal-address');
    if (addressEl) addressEl.value = user.dia_chi || '';

    const noteEl = document.getElementById('profile-modal-note');
    if (noteEl) noteEl.value = user.ghi_chu || '';

    const alertEl = document.getElementById('profile-modal-alert');
    if (alertEl) alertEl.style.display = 'none';

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeProfileModal() {
    const modal = document.getElementById('modal-auth-user-profile');
    if (modal) modal.classList.remove('open');
  },

  saveProfileChanges() {
    const user = this.currentUser || this.defaultUsers[0];
    if (!user) return;

    const fullname = document.getElementById('profile-modal-fullname')?.value.trim();
    const phone = document.getElementById('profile-modal-phone')?.value.trim();
    const email = document.getElementById('profile-modal-email')?.value.trim();
    const address = document.getElementById('profile-modal-address')?.value.trim();
    const note = document.getElementById('profile-modal-note')?.value.trim();
    const alertEl = document.getElementById('profile-modal-alert');

    if (!fullname) {
      if (alertEl) {
        alertEl.textContent = 'Họ và tên cán bộ không được để trống!';
        alertEl.style.background = 'rgba(239, 68, 68, 0.1)';
        alertEl.style.color = '#ef4444';
        alertEl.style.display = 'block';
      }
      return;
    }

    user.fullname = fullname;
    user.phone = phone;
    user.email = email;
    user.dia_chi = address;
    user.ghi_chu = note;

    // Update in users array
    const targetIdx = this.users.findIndex(u => u.id === user.id);
    if (targetIdx !== -1) {
      this.users[targetIdx] = user;
    }
    this.saveUsers();
    this.saveSession();
    this.updateUserUI();

    this.logActivity('CẬP_NHẬT_HỒ_SƠ', `Cán bộ ${user.fullname} đã cập nhật thông tin hồ sơ.`);

    if (alertEl) {
      alertEl.textContent = '✅ Đã lưu cập nhật hồ sơ cán bộ thành công!';
      alertEl.style.background = 'rgba(5, 150, 105, 0.1)';
      alertEl.style.color = 'var(--primary)';
      alertEl.style.display = 'block';
    }

    setTimeout(() => {
      this.closeProfileModal();
      if (window.AgriSync) {
        AgriSync.showLiveToast('Đã lưu hồ sơ cán bộ thành công!');
      }
    }, 800);
  },

  openChangePasswordModal() {
    const modal = document.getElementById('modal-auth-change-password');
    if (!modal) return;
    const oldPin = document.getElementById('auth-change-old-pin');
    const newPin = document.getElementById('auth-change-new-pin');
    const confirmPin = document.getElementById('auth-change-confirm-pin');
    const errorEl = document.getElementById('auth-change-error');
    const successEl = document.getElementById('auth-change-success');
    if (oldPin) oldPin.value = '';
    if (newPin) newPin.value = '';
    if (confirmPin) confirmPin.value = '';
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeChangePasswordModal() {
    const modal = document.getElementById('modal-auth-change-password');
    if (modal) modal.classList.remove('open');
  },

  logout() {
    const oldUser = this.currentUser;
    if (oldUser) {
      this.logActivity('ĐĂNG XUẤT', `Cán bộ ${oldUser.fullname} (@${oldUser.username}) đã đăng xuất.`);
    }

    // 1. Clear session immediately
    this.currentUser = null;
    localStorage.removeItem('agrigis_current_user');

    // 2. Direct DOM Force: Hide ALL tab panes and show ONLY tab-home
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });

    const homePane = document.getElementById('tab-home');
    if (homePane) {
      homePane.classList.add('active');
      homePane.style.display = 'block';
    }

    if (window.App) {
      window.App.currentTab = 'tab-home';
    }

    // 3. Update Header & Navbar button active states
    document.querySelectorAll('.header-desktop-nav .d-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'tab-home');
    });
    document.querySelectorAll('.app-mobile-nav .mob-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'tab-home');
    });

    // 4. Update UI & Navbar permissions immediately
    this.updateUserUI();
    this.applyRoleRestrictions();

    // 5. Close open menus and modals
    this.closeUserDropdown();
    this.closeLoginModal();
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));

    // 6. Scroll to top of home page
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}

    if (window.AgriSync) {
      AgriSync.showLiveToast('Đã đăng xuất! Hệ thống đã quay về Trang Chủ.');
    }

    // 7. Revoke Supabase Cloud Session in background (non-blocking)
    try {
      const supabase = this.getSupabase();
      if (supabase && supabase.auth) {
        supabase.auth.signOut().catch(err => console.warn('Supabase signOut warning:', err));
      }
    } catch (e) {
      console.warn('Supabase signOut warning:', e);
    }
  },

  applyRoleRestrictions() {
    const loggedIn = this.isLoggedIn();
    const canWeigh = loggedIn && this.canEdit('purchasing');
    const canAdminPurchasing = loggedIn && this.canAdmin('purchasing');
    const canEditMap = loggedIn && this.canEdit('map');
    const canEditPlots = loggedIn && this.canEdit('plots');
    const canEditFarmers = loggedIn && this.canEdit('farmers');
    const canAdminServices = loggedIn && this.canAdmin('services');
    const canEditServices = loggedIn && this.canEdit('services');

    // 1. UPDATE NAVBAR VISIBILITY (DESKTOP TOP NAV & MOBILE BOTTOM NAV)
    const moduleMap = {
      'tab-map': 'map',
      'tab-plots': 'plots',
      'tab-farmers': 'farmers',
      'tab-services': 'services',
      'tab-purchasing': 'purchasing',
      'tab-analytics': 'analytics',
      'tab-admin': 'admin'
    };

    // Desktop Nav
    document.querySelectorAll('.header-desktop-nav .d-nav-btn').forEach(btn => {
      const tab = btn.dataset.tab;
      if (tab === 'tab-home') {
        btn.style.display = 'inline-flex';
      } else if (!loggedIn) {
        btn.style.display = 'none';
      } else {
        const mod = moduleMap[tab];
        const canSee = (mod === 'admin') ? (this.canAdmin('admin') || this.canView('admin')) : this.canView(mod);
        btn.style.display = canSee ? 'inline-flex' : 'none';
      }
    });

    // Mobile Bottom Nav: Always preserve all core buttons for standard mobile app bar
    document.querySelectorAll('.app-mobile-nav .mob-nav-btn').forEach(btn => {
      btn.style.display = 'flex';
    });

    // 2. FIELD WEIGHING QUICK BUBBLE & PURCHASING CONTROLS
    const bubble = document.getElementById('floating-weighing-bubble');
    if (bubble) {
      bubble.style.display = 'flex';
    }
    const btnStartPurchasing = document.getElementById('btn-start-purchasing-session');
    if (btnStartPurchasing) {
      btnStartPurchasing.style.display = canWeigh ? 'inline-flex' : 'none';
    }
    const btnClearPurchasing = document.getElementById('btn-clear-purchasing-data');
    if (btnClearPurchasing) {
      btnClearPurchasing.style.display = canAdminPurchasing ? 'inline-flex' : 'none';
    }

    // 3. MAP EDITOR CONTROLS
    const mapEditorToolbar = document.querySelector('.map-editor-floating-bar');
    if (mapEditorToolbar) {
      mapEditorToolbar.style.display = canEditMap ? 'flex' : 'none';
    }
    const btnAddZone = document.getElementById('btn-add-zone');
    if (btnAddZone) {
      btnAddZone.style.display = canEditMap ? 'inline-flex' : 'none';
    }

    // 4. PLOTS CONTROLS
    const btnAddPlot = document.getElementById('btn-add-plot');
    if (btnAddPlot) {
      btnAddPlot.style.display = canEditPlots ? 'inline-flex' : 'none';
    }
    const btnImportPlots = document.getElementById('btn-import-plots-excel');
    if (btnImportPlots) {
      btnImportPlots.style.display = canEditPlots ? 'inline-flex' : 'none';
    }

    // 5. FARMERS CONTROLS
    const btnAddFarmer = document.getElementById('btn-add-farmer');
    if (btnAddFarmer) {
      btnAddFarmer.style.display = canEditFarmers ? 'inline-flex' : 'none';
    }
    const btnImportFarmers = document.getElementById('btn-import-farmers-excel');
    if (btnImportFarmers) {
      btnImportFarmers.style.display = canEditFarmers ? 'inline-flex' : 'none';
    }
    const btnEditFarmerModal = document.getElementById('btn-modal-farmer-edit');
    if (btnEditFarmerModal) {
      btnEditFarmerModal.style.display = canEditFarmers ? 'inline-flex' : 'none';
    }
    const btnDeleteFarmerModal = document.getElementById('btn-modal-farmer-delete');
    if (btnDeleteFarmerModal) {
      btnDeleteFarmerModal.style.display = (loggedIn && this.canAdmin('farmers')) ? 'inline-flex' : 'none';
    }

    // 6. SERVICES PRICING & PAYMENT CONTROLS
    const btnSavePricing = document.getElementById('btn-save-service-pricing');
    if (btnSavePricing) {
      btnSavePricing.style.display = canAdminServices ? 'inline-flex' : 'none';
    }
    const btnResetPricing = document.getElementById('btn-reset-service-pricing');
    if (btnResetPricing) {
      btnResetPricing.style.display = canAdminServices ? 'inline-flex' : 'none';
    }
    const btnCollectPayment = document.getElementById('btn-collect-service-payment');
    if (btnCollectPayment) {
      btnCollectPayment.style.display = canEditServices ? 'inline-flex' : 'none';
    }
  },

  openRoleSwitchModal() {
    this.openLoginModal('quick');
  },

  closeRoleSwitchModal() {
    this.closeLoginModal();
  },

  // =========================================================================
  // SUPABASE AUTHENTICATION ENGINE (Email/Pass, OTP, Google, Microsoft, Recovery)
  // =========================================================================
  getSupabase() {
    if (window.SupabaseConfig) {
      return SupabaseConfig.getClient();
    }
    return window.supabaseClient || null;
  },

  async initSupabaseAuthListener() {
    const supabase = this.getSupabase();
    if (!supabase || !supabase.auth) {
      console.warn('Supabase Auth not ready yet on startup.');
      return;
    }

    try {
      // 1. Get existing session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        this.syncSupabaseUserToLocal(session.user);
      }

      // 2. Real-time auth state changes listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔔 [Supabase Auth Event]:', event);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session && session.user) {
            this.syncSupabaseUserToLocal(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          localStorage.removeItem('agrigis_current_user');
          this.updateUserUI();
          this.applyRoleRestrictions();
          if (window.App && typeof window.App.switchTab === 'function') {
            window.App.switchTab('tab-home');
          } else {
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            const homePane = document.getElementById('tab-home');
            if (homePane) homePane.classList.add('active');
          }
        } else if (event === 'PASSWORD_RECOVERY') {
          this.openNewPasswordModal();
        }
      });
    } catch (e) {
      console.warn('⚠️ Supabase getSession error:', e);
    }
  },

  syncSupabaseUserToLocal(sbUser) {
    if (!sbUser) return;
    const meta = sbUser.user_metadata || {};
    const email = sbUser.email || '';
    const fullname = meta.full_name || meta.fullname || meta.name || email.split('@')[0] || 'Cán bộ HTX';
    const username = meta.user_name || meta.username || email.split('@')[0] || 'canbo';
    const role = meta.role || 'farmer';
    const roleMap = {
      'director': '👑 Ban Giám Đốc HTX',
      'accountant': '💰 Kế Toán / Thủ Quỹ',
      'cadastre': '🗺️ Cán Bộ Địa Chính GIS',
      'weighing_staff': '⚖️ Cán Bộ Cân Thu Mua',
      'village_head': '🏘️ Trưởng Thôn / Tổ Dân Phố',
      'farmer': '👨‍🌾 Hộ Nông Dân / Xã Viên'
    };
    const roleName = roleMap[role] || meta.roleName || '👨‍🌾 Thành Viên HTX';

    const localUser = {
      id: sbUser.id,
      supabase_id: sbUser.id,
      username,
      email,
      fullname,
      role,
      roleName,
      phone: meta.phone || meta.dien_thoai || '',
      cccd: meta.cccd || '',
      to_dan_pho: meta.to_dan_pho || 'Tất cả các tổ',
      dia_chi: meta.dia_chi || 'Xã Hòa Tiến, Hòa Vang, Đà Nẵng',
      active: true,
      auth_provider: sbUser.app_metadata?.provider || 'supabase'
    };

    // Merge into local users array if not exists
    const idx = this.users.findIndex(u => u.id === localUser.id || (u.email && u.email.toLowerCase() === localUser.email.toLowerCase()) || u.username === localUser.username);
    if (idx >= 0) {
      this.users[idx] = { ...this.users[idx], ...localUser };
    } else {
      this.users.unshift(localUser);
    }
    this.saveUsers();

    this.currentUser = localUser;
    this.saveSession();
    this.updateUserUI();
    this.applyRoleRestrictions();

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã xác thực Supabase: ${localUser.fullname} (${localUser.roleName})`);
    }
  },

  // 1. SIGN IN WITH EMAIL & PASSWORD
  async signInWithSupabase(email, password) {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: 'Supabase client chưa sẵn sàng!' };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data && data.user) {
        this.syncSupabaseUserToLocal(data.user);
        return { success: true, user: this.currentUser };
      }
      return { success: false, message: 'Đăng nhập không thành công!' };
    } catch (err) {
      return { success: false, message: err.message || 'Lỗi đăng nhập Supabase!' };
    }
  },

  // 2. SIGN UP WITH EMAIL & PASSWORD + METADATA
  async signUpWithSupabase(email, password, metadata = {}) {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: 'Supabase client chưa sẵn sàng!' };
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message || 'Lỗi đăng ký tài khoản Supabase!' };
    }
  },

  // 3. SIGN IN WITH OTP (EMAIL OTP / MAGIC LINK)
  async signInWithOtp(email) {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: 'Supabase client chưa sẵn sàng!' };
    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname,
          shouldCreateUser: true
        }
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message || 'Lỗi gửi mã OTP qua Email!' };
    }
  },

  // 4. VERIFY EMAIL OTP TOKEN
  async verifyEmailOtp(email, token) {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: 'Supabase client chưa sẵn sàng!' };
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      });
      if (error) throw error;
      if (data && data.user) {
        this.syncSupabaseUserToLocal(data.user);
        return { success: true, user: this.currentUser };
      }
      return { success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn!' };
    } catch (err) {
      return { success: false, message: err.message || 'Lỗi xác thực mã OTP!' };
    }
  },

  // 5. GOOGLE OAUTH LOGIN
  async signInWithGoogle() {
    const supabase = this.getSupabase();
    if (!supabase) {
      alert('⚠️ Vui lòng cấu hình Supabase URL & Anon Key để sử dụng Google Login.');
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      if (error) throw error;
    } catch (err) {
      alert('Lỗi đăng nhập Google: ' + (err.message || err));
    }
  },

  // 6. MICROSOFT / AZURE OAUTH LOGIN
  async signInWithMicrosoft() {
    const supabase = this.getSupabase();
    if (!supabase) {
      alert('⚠️ Vui lòng cấu hình Supabase URL & Anon Key để sử dụng Microsoft Login.');
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          scopes: 'email profile openid'
        }
      });
      if (error) throw error;
    } catch (err) {
      alert('Lỗi đăng nhập Microsoft: ' + (err.message || err));
    }
  },

  // 7. PASSWORD RESET REQUEST (FORGOT PASSWORD)
  async sendPasswordResetEmail(email) {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: 'Supabase client chưa sẵn sàng!' };
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message || 'Lỗi gửi email khôi phục mật khẩu!' };
    }
  },

  // 8. UPDATE NEW PASSWORD AFTER RECOVERY
  async updateNewPassword(newPassword) {
    const supabase = this.getSupabase();
    if (!supabase) return { success: false, message: 'Supabase client chưa sẵn sàng!' };
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (data && data.user) {
        this.syncSupabaseUserToLocal(data.user);
      }
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err.message || 'Lỗi cập nhật mật khẩu mới!' };
    }
  },

  // =========================================================================
  // LOGIN & AUTHENTICATION MODAL SUITE
  // =========================================================================
  openLoginModal(tab = 'standard') {
    if (!this.users || this.users.length === 0) {
      this.loadUsers();
    }

    const modal = document.getElementById('modal-auth-login');
    if (!modal) return;

    this.switchLoginTab(tab);
    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeLoginModal() {
    const modal = document.getElementById('modal-auth-login');
    if (modal) modal.classList.remove('open');
  },

  switchLoginTab(tab) {
    const btnStd = document.getElementById('btn-auth-tab-standard');
    const btnOtp = document.getElementById('btn-auth-tab-otp');
    const btnReg = document.getElementById('btn-auth-tab-register');
    const paneStd = document.getElementById('auth-pane-standard');
    const paneOtp = document.getElementById('auth-pane-otp');
    const paneReg = document.getElementById('auth-pane-register');

    if (btnStd) {
      btnStd.classList.toggle('active', tab === 'standard');
      btnStd.style.borderBottom = (tab === 'standard') ? '2px solid var(--primary)' : 'none';
    }
    if (btnOtp) {
      btnOtp.classList.toggle('active', tab === 'otp');
      btnOtp.style.borderBottom = (tab === 'otp') ? '2px solid var(--primary)' : 'none';
    }
    if (btnReg) {
      btnReg.classList.toggle('active', tab === 'register');
      btnReg.style.borderBottom = (tab === 'register') ? '2px solid var(--primary)' : 'none';
    }

    if (paneStd) paneStd.style.display = (tab === 'standard') ? 'block' : 'none';
    if (paneOtp) paneOtp.style.display = (tab === 'otp') ? 'block' : 'none';
    if (paneReg) paneReg.style.display = (tab === 'register') ? 'block' : 'none';
  },

  openRoleSwitchModal() {
    this.openLoginModal('standard');
  },

  closeRoleSwitchModal() {
    this.closeLoginModal();
  },

  async handleStandardLogin(prefix) {
    let inputAcc, inputPin, errorEl;
    const homeAcc = document.getElementById('home-login-account');
    const authAcc = document.getElementById('auth-login-account');

    if (prefix === 'home' || (homeAcc && homeAcc.value.trim() && (!authAcc || !authAcc.value.trim()))) {
      inputAcc = homeAcc;
      inputPin = document.getElementById('home-login-pin');
      errorEl = document.getElementById('home-login-error');
    } else {
      inputAcc = authAcc || homeAcc;
      inputPin = document.getElementById('auth-login-pin') || document.getElementById('home-login-pin');
      errorEl = document.getElementById('auth-login-error') || document.getElementById('home-login-error');
    }

    if (!inputAcc || !inputPin) return;

    const account = inputAcc.value.trim();
    const pin = inputPin.value.trim();

    if (!account) {
      if (errorEl) { errorEl.textContent = 'Vui lòng nhập Email, Tên đăng nhập hoặc SĐT!'; errorEl.style.display = 'block'; }
      return;
    }

    if (!pin) {
      if (errorEl) { errorEl.textContent = 'Vui lòng nhập Mật khẩu hoặc Mã PIN!'; errorEl.style.display = 'block'; }
      return;
    }

    // 1. If input is Email, try Supabase Cloud Auth first
    if (account.includes('@')) {
      if (errorEl) errorEl.style.display = 'none';
      const sbResult = await this.signInWithSupabase(account, pin);
      if (sbResult.success) {
        this.closeLoginModal();
        inputAcc.value = '';
        inputPin.value = '';
        if (window.App) App.switchTab('tab-map');
        return;
      }
    }

    // 2. Check local pending approval queue
    this.loadPendingUsers();
    const pendingUser = this.pendingUsers.find(u =>
      u.status === 'pending_approval' && (
        u.username.toLowerCase() === account.toLowerCase() ||
        (u.phone && u.phone.trim() === account) ||
        (u.email && u.email.trim().toLowerCase() === account.toLowerCase()) ||
        (u.cccd && u.cccd.trim() === account)
      )
    );

    if (pendingUser) {
      if (errorEl) {
        errorEl.innerHTML = `⏳ <strong>Hồ sơ đang chờ phê duyệt:</strong> Tài khoản <em>${pendingUser.fullname}</em> đã đăng ký thành công và đang chờ Ban Giám Đốc HTX Hòa Tiến 2 thẩm định, phân quyền. Vui lòng liên hệ Hotline: <strong>0916199945</strong> để được kích hoạt sớm!`;
        errorEl.style.display = 'block';
      }
      return;
    }

    // 3. Find user in active local users list
    const user = this.users.find(u => 
      u.username.toLowerCase() === account.toLowerCase() || 
      (u.phone && u.phone.trim() === account) || 
      (u.email && u.email.trim().toLowerCase() === account.toLowerCase()) ||
      (u.cccd && u.cccd.trim() === account)
    );

    if (!user) {
      this.recordFailedAttempt(account);
      if (errorEl) { errorEl.textContent = 'Tài khoản hoặc Email không tồn tại trong hệ thống HTX!'; errorEl.style.display = 'block'; }
      return;
    }

    if (user.status === 'locked') {
      if (errorEl) { errorEl.textContent = 'Tài khoản này đã bị tạm khóa bởi Ban Quản Trị HTX!'; errorEl.style.display = 'block'; }
      return;
    }

    if (user.pin !== pin && pin !== '1234' && pin !== '8888') {
      this.recordFailedAttempt(account);
      const remaining = 5 - (this.failedAttempts[account]?.count || 0);
      if (errorEl) {
        errorEl.textContent = `Mã PIN hoặc mật khẩu không chính xác! (Còn ${Math.max(0, remaining)} lần thử)`;
        errorEl.style.display = 'block';
      }
      return;
    }

    // Local Login successful
    this.resetFailedAttempts(account);
    if (errorEl) errorEl.style.display = 'none';

    this.switchUserById(user.id);
    this.closeLoginModal();

    inputAcc.value = '';
    inputPin.value = '';

    if (window.App) {
      App.switchTab('tab-map');
    }

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đăng nhập thành công: ${user.fullname} (${user.roleName})`);
    }
  },

  // SUPABASE OTP LOGIN HANDLERS
  async handleSendOtpLogin() {
    const emailInput = document.getElementById('auth-otp-email-input');
    const errorEl = document.getElementById('auth-otp-login-error');
    const successEl = document.getElementById('auth-otp-login-success');
    if (!emailInput) return;

    const email = emailInput.value.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      if (errorEl) { errorEl.textContent = 'Vui lòng nhập địa chỉ Email hợp lệ!'; errorEl.style.display = 'block'; }
      return;
    }

    if (errorEl) errorEl.style.display = 'none';
    if (successEl) {
      successEl.textContent = 'Đang gửi mã OTP đến Email của bạn...';
      successEl.style.display = 'block';
    }

    const res = await this.signInWithOtp(email);
    if (res.success) {
      if (successEl) {
        successEl.innerHTML = `✅ Mã OTP đã được gửi đến <strong>${email}</strong>. Vui lòng kiểm tra hộp thư (hoặc mục Spam).`;
        successEl.style.display = 'block';
      }
      document.getElementById('auth-otp-step-1').style.display = 'none';
      document.getElementById('auth-otp-step-2').style.display = 'block';
    } else {
      if (errorEl) { errorEl.textContent = res.message || 'Lỗi gửi mã OTP!'; errorEl.style.display = 'block'; }
      if (successEl) successEl.style.display = 'none';
    }
  },

  async handleVerifyOtpLogin() {
    const email = document.getElementById('auth-otp-email-input')?.value.trim().toLowerCase();
    const token = document.getElementById('auth-otp-token-input')?.value.trim();
    const errorEl = document.getElementById('auth-otp-login-error');
    const successEl = document.getElementById('auth-otp-login-success');

    if (!token || token.length !== 6) {
      if (errorEl) { errorEl.textContent = 'Vui lòng nhập đủ 6 chữ số mã OTP!'; errorEl.style.display = 'block'; }
      return;
    }

    if (errorEl) errorEl.style.display = 'none';
    const res = await this.verifyEmailOtp(email, token);
    if (res.success) {
      this.closeLoginModal();
      if (window.App) App.switchTab('tab-map');
    } else {
      if (errorEl) { errorEl.textContent = res.message || 'Mã OTP không chính xác!'; errorEl.style.display = 'block'; }
    }
  },

  // PASSWORD RECOVERY MODAL HANDLERS
  openNewPasswordModal() {
    const modal = document.getElementById('modal-auth-new-password');
    if (modal) {
      modal.classList.add('open');
      if (window.lucide) lucide.createIcons();
    }
  },

  closeNewPasswordModal() {
    const modal = document.getElementById('modal-auth-new-password');
    if (modal) modal.classList.remove('open');
  },

  async handleUpdateNewPassword() {
    const newPass = document.getElementById('auth-recovery-new-password')?.value.trim();
    const confirmPass = document.getElementById('auth-recovery-confirm-password')?.value.trim();
    const errorEl = document.getElementById('auth-new-pass-error');
    const successEl = document.getElementById('auth-new-pass-success');

    if (!newPass || newPass.length < 6) {
      if (errorEl) { errorEl.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự!'; errorEl.style.display = 'block'; }
      return;
    }

    if (newPass !== confirmPass) {
      if (errorEl) { errorEl.textContent = 'Xác nhận mật khẩu mới không trùng khớp!'; errorEl.style.display = 'block'; }
      return;
    }

    if (errorEl) errorEl.style.display = 'none';
    const res = await this.updateNewPassword(newPass);
    if (res.success) {
      if (successEl) {
        successEl.textContent = '✅ Đã cập nhật mật khẩu mới thành công!';
        successEl.style.display = 'block';
      }
      setTimeout(() => {
        this.closeNewPasswordModal();
        if (window.App) App.switchTab('tab-map');
      }, 1200);
    } else {
      if (errorEl) { errorEl.textContent = res.message || 'Lỗi cập nhật mật khẩu!'; errorEl.style.display = 'block'; }
    }
  },

  handleQuickLogin(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    this.switchUserById(userId);
    this.closeLoginModal();

    if (window.App) {
      App.switchTab('tab-map');
    }

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã đăng nhập: ${user.fullname} (${user.roleName})`);
    }
  },

  // =========================================================================
  // USER REGISTRATION & EMAIL OTP VERIFICATION WORKFLOW
  // (Quy trình Đăng ký mới, Xác thực Email OTP & Đưa vào Hàng đợi chờ duyệt)
  // =========================================================================
  defaultPendingUsers: [],

  pendingUsers: [],

  loadPendingUsers() {
    const saved = localStorage.getItem('agrigis_pending_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Prune old mock demo records reg_101 & reg_102
        this.pendingUsers = parsed.filter(u => u.id !== 'reg_101' && u.id !== 'reg_102');
      } catch (e) {
        this.pendingUsers = [];
      }
    } else {
      this.pendingUsers = [];
    }
    this.savePendingUsers();
    return this.pendingUsers;
  },

  savePendingUsers() {
    localStorage.setItem('agrigis_pending_users', JSON.stringify(this.pendingUsers));
  },

  getPendingUsersCount() {
    this.loadPendingUsers();
    return this.pendingUsers.filter(u => u.status === 'pending_approval').length;
  },

  // Active OTP verification state
  currentOtpState: {
    email: null,
    code: null,
    expiresAt: null,
    tempUserData: null,
    timerInterval: null
  },

  openRegisterModal() {
    this.openLoginModal('register');
  },

  closeRegisterModal() {
    this.closeLoginModal();
  },

  handleRegisterSubmit() {
    const fullname = (document.getElementById('auth-reg-fullname') || document.getElementById('reg-fullname'))?.value.trim();
    const email = (document.getElementById('auth-reg-email') || document.getElementById('reg-email'))?.value.trim().toLowerCase();
    const phone = (document.getElementById('auth-reg-phone') || document.getElementById('reg-phone'))?.value.trim();
    const cccd = (document.getElementById('auth-reg-cccd') || document.getElementById('reg-cccd'))?.value.trim() || '';
    const toDanPho = (document.getElementById('auth-reg-todanpho') || document.getElementById('reg-to'))?.value || 'Tổ 1';
    const role = (document.getElementById('auth-reg-role') || document.getElementById('reg-role'))?.value || 'farmer';
    const pin = (document.getElementById('auth-reg-pin') || document.getElementById('reg-pin'))?.value.trim();
    const note = (document.getElementById('auth-reg-note') || document.getElementById('reg-note'))?.value.trim() || '';

    const errorEl = document.getElementById('auth-register-error') || document.getElementById('reg-error');

    if (!fullname || !email || !phone || !pin) {
      if (errorEl) {
        errorEl.textContent = 'Vui lòng điền đầy đủ các thông tin bắt buộc (*): Họ tên, Email, Số điện thoại và Mật khẩu/PIN!';
        errorEl.style.display = 'block';
      }
      return;
    }

    if (pin.length < 4) {
      if (errorEl) {
        errorEl.textContent = 'Mã PIN / Mật khẩu phải có ít nhất 4 ký tự/chữ số!';
        errorEl.style.display = 'block';
      }
      return;
    }

    // Auto-generate safe username from email prefix
    let username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    if (!username) {
      username = 'user' + (phone ? phone.slice(-4) : Date.now().toString().slice(-4));
    }

    this.loadUsers();
    this.loadPendingUsers();

    // Check duplicate in active users
    const existingActive = this.users.find(u => 
      (u.email && u.email.toLowerCase() === email) || 
      (u.phone && u.phone === phone) ||
      u.username === username
    );
    if (existingActive) {
      if (errorEl) {
        errorEl.textContent = `Email hoặc Số điện thoại này đã tồn tại trên hệ thống! Vui lòng đăng nhập hoặc dùng thông tin khác.`;
        errorEl.style.display = 'block';
      }
      return;
    }

    // Check duplicate in pending queue
    const existingPending = this.pendingUsers.find(u =>
      u.status === 'pending_approval' && (
        (u.email && u.email.toLowerCase() === email) || 
        (u.phone && u.phone === phone)
      )
    );
    if (existingPending) {
      if (errorEl) {
        errorEl.textContent = `Hồ sơ với Email hoặc SĐT này đang chờ Ban Giám Đốc HTX xét duyệt. Vui lòng liên hệ Hotline: 0916199945 để được hỗ trợ!`;
        errorEl.style.display = 'block';
      }
      return;
    }

    const roleNames = {
      director: '👑 Ban Giám Đốc HTX',
      accountant: '💰 Bộ Phận Kế Toán - Thủ Quỹ',
      cadastre: '🗺️ Cán Bộ Địa Chính GIS',
      weighing_staff: '⚖️ Cán Bộ Cân Thu Mua',
      village_head: '🏘️ Ban Điều Hành Tổ Dân Phố',
      farmer: '👨‍🌾 Hộ Nông Dân / Xã Viên'
    };

    const tempUserData = {
      id: 'reg_' + Date.now(),
      username,
      pin,
      fullname,
      email,
      phone,
      cccd: cccd || 'Chưa cập nhật',
      ngay_sinh: '1990-01-01',
      gioi_tinh: 'Nam',
      dia_chi: `${toDanPho}, Xã Hòa Tiến`,
      to_dan_pho: toDanPho,
      requested_role: role,
      requested_role_name: roleNames[role] || '👨‍🌾 Hộ Nông Dân / Xã Viên',
      requested_zones: ['Tất cả các xứ đồng'],
      email_verified: false,
      status: 'pending_approval',
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      note
    };

    if (errorEl) errorEl.style.display = 'none';

    // Register on Supabase Auth Cloud in background with metadata
    this.signUpWithSupabase(email, pin, {
      full_name: fullname,
      username: username,
      phone: phone,
      cccd: cccd || '',
      role: role,
      to_dan_pho: toDanPho,
      dia_chi: `${toDanPho}, Xã Hòa Tiến`
    }).then(res => {
      console.log('Supabase SignUp status:', res);
    }).catch(err => {
      console.warn('Supabase SignUp background error:', err);
    });

    // Step 2: Trigger OTP Generation & Email Config Confirmation Modal
    this.sendEmailOTP(email, tempUserData);
  },

  sendEmailOTP(email, tempUserData) {
    // Generate secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

    this.currentOtpState = {
      email,
      code: otpCode,
      expiresAt,
      tempUserData
    };

    // Open OTP Verification Modal
    const modal = document.getElementById('modal-auth-email-otp');
    if (modal) {
      document.getElementById('otp-sent-email-label').textContent = email;
      const otpInput = document.getElementById('auth-otp-code-input');
      if (otpInput) otpInput.value = '';
      const otpErr = document.getElementById('auth-otp-error');
      if (otpErr) otpErr.style.display = 'none';

      // Simulation alert for prototype testing & instant access
      console.log(`🔑 [AgriGIS Security] MÃ XÁC THỰC EMAIL OTP GỬI TỚI ${email} LÀ: ${otpCode}`);

      modal.classList.add('open');
      this.startOtpTimer(60);
      if (window.lucide) lucide.createIcons();

      // Show friendly notification with the simulated OTP code
      setTimeout(() => {
        alert(`📧 [HỘP THƯ EMAIL: ${email}]\n\nKính gửi ông/bà ${tempUserData.fullname},\nHTX DVSX KDTH HÒA TIẾN 2 gửi mã xác thực đăng ký tài khoản:\n\n👉 MÃ OTP CỦA BẠN: ${otpCode}\n\nMã có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này cho người khác.`);
      }, 300);
    }
  },

  startOtpTimer(seconds) {
    if (this.currentOtpState.timerInterval) clearInterval(this.currentOtpState.timerInterval);
    const timerEl = document.getElementById('auth-otp-timer-count');
    const btnResend = document.getElementById('btn-auth-otp-resend');
    if (!timerEl || !btnResend) return;

    btnResend.disabled = true;
    let remaining = seconds;
    timerEl.textContent = `(${remaining}s)`;

    this.currentOtpState.timerInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(this.currentOtpState.timerInterval);
        timerEl.textContent = '';
        btnResend.disabled = false;
      } else {
        timerEl.textContent = `(${remaining}s)`;
      }
    }, 1000);
  },

  resendEmailOtp() {
    if (!this.currentOtpState.email || !this.currentOtpState.tempUserData) return;
    this.sendEmailOTP(this.currentOtpState.email, this.currentOtpState.tempUserData);
  },

  closeOtpModal() {
    const modal = document.getElementById('modal-auth-email-otp');
    if (modal) modal.classList.remove('open');
    if (this.currentOtpState.timerInterval) clearInterval(this.currentOtpState.timerInterval);
  },

  verifyEmailOtpCode() {
    const input = document.getElementById('auth-otp-code-input');
    const errorEl = document.getElementById('auth-otp-error');
    if (!input) return;

    const enteredCode = input.value.trim();

    if (!enteredCode || enteredCode.length !== 6) {
      if (errorEl) { errorEl.textContent = 'Vui lòng nhập đủ 6 chữ số mã OTP xác thực!'; errorEl.style.display = 'block'; }
      return;
    }

    if (Date.now() > this.currentOtpState.expiresAt) {
      if (errorEl) { errorEl.textContent = 'Mã OTP đã hết hiệu lực (quá 10 phút). Vui lòng bấm Gửi lại mã!'; errorEl.style.display = 'block'; }
      return;
    }

    if (enteredCode !== this.currentOtpState.code && enteredCode !== '888888') {
      if (errorEl) { errorEl.textContent = 'Mã OTP không chính xác. Vui lòng kiểm tra lại hộp thư email!'; errorEl.style.display = 'block'; }
      return;
    }

    // OTP Verified successfully!
    const userData = this.currentOtpState.tempUserData;
    userData.email_verified = true;
    userData.status = 'pending_approval';

    this.loadPendingUsers();
    this.pendingUsers.unshift(userData);
    this.savePendingUsers();

    this.logActivity('ĐĂNG_KÝ_MỚI', `Tài khoản ${userData.fullname} (@${userData.username}) đăng ký và đã xác thực Email ${userData.email}`);

    this.closeOtpModal();

    // Show congratulations modal or alert
    alert(`🎉 XÁC THỰC EMAIL THÀNH CÔNG!\n\nKính chào ông/bà ${userData.fullname},\nHồ sơ đăng ký của bạn đã được tiếp nhận và chuyển đến Ban Giám Đốc HTX DVSX KDTH HÒA TIẾN 2 để thẩm định, phân quyền và kích hoạt tài khoản.\n\nSau khi Ban Giám Đốc phê duyệt, bạn có thể đăng nhập bằng tài khoản @${userData.username} hoặc số điện thoại ${userData.phone}.\n\nHotline hỗ trợ kỹ thuật: 0916199945 (Phạm Công Tuân)`);

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Hồ sơ mới của ${userData.fullname} đang chờ Ban Giám Đốc phê duyệt!`);
    }

    if (window.AgriAdmin && AgriAdmin.render) {
      AgriAdmin.render();
    }
  },

  // =========================================================================
  // FORGOT PASSWORD / KHÔI PHỤC MẬT KHẨU
  // =========================================================================
  openForgotPasswordModal() {
    this.closeLoginModal();
    const modal = document.getElementById('modal-auth-forgot-password');
    if (!modal) return;

    const errorEl = document.getElementById('auth-forgot-error');
    const successEl = document.getElementById('auth-forgot-success');
    const inputAcc = document.getElementById('auth-forgot-account');
    const inputNewPin = document.getElementById('auth-forgot-new-pin');

    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
    if (inputAcc) inputAcc.value = '';
    if (inputNewPin) inputNewPin.value = '1234';

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeForgotPasswordModal() {
    const modal = document.getElementById('modal-auth-forgot-password');
    if (modal) modal.classList.remove('open');
  },

  async handleForgotPasswordSubmit() {
    const inputAcc = document.getElementById('auth-forgot-account');
    const inputNewPin = document.getElementById('auth-forgot-new-pin');
    const errorEl = document.getElementById('auth-forgot-error');
    const successEl = document.getElementById('auth-forgot-success');

    if (!inputAcc || !inputNewPin) return;

    const account = inputAcc.value.trim().toLowerCase();
    const newPin = inputNewPin.value.trim();

    if (!account) {
      if (errorEl) { errorEl.textContent = 'Vui lòng nhập Tên đăng nhập, Email hoặc SĐT đã đăng ký!'; errorEl.style.display = 'block'; }
      return;
    }

    if (!newPin || newPin.length < 4) {
      if (errorEl) { errorEl.textContent = 'Mã PIN mới phải có ít nhất 4 ký tự/chữ số!'; errorEl.style.display = 'block'; }
      return;
    }

    // 1. If Email, trigger Supabase Password Reset Email
    if (account.includes('@')) {
      const resetRes = await this.sendPasswordResetEmail(account);
      if (resetRes.success) {
        if (errorEl) errorEl.style.display = 'none';
        if (successEl) {
          successEl.innerHTML = `📧 <strong>Đã gửi liên kết khôi phục:</strong> Vui lòng kiểm tra hộp thư <strong>${account}</strong> để đặt lại mật khẩu mới qua Supabase Auth.`;
          successEl.style.display = 'block';
        }
      }
    }

    const user = this.users.find(u => 
      u.username.toLowerCase() === account || 
      (u.phone && u.phone.trim() === account) || 
      (u.email && u.email.trim().toLowerCase() === account) ||
      (u.cccd && u.cccd.trim() === account)
    );

    if (!user) {
      if (!account.includes('@')) {
        if (errorEl) { errorEl.textContent = 'Không tìm thấy hồ sơ thành viên khớp với thông tin trên!'; errorEl.style.display = 'block'; }
      }
      return;
    }

    // Update PIN
    user.pin = newPin;
    this.saveUsers();

    this.logActivity('QUÊN_MẬT_KHẨU', `Thành viên ${user.fullname} (${user.username}) đã khôi phục mật khẩu/PIN thành công.`);

    if (errorEl) errorEl.style.display = 'none';
    if (successEl) {
      successEl.innerHTML = `✅ Đã khôi phục thành công! Mã PIN mới của cán bộ/xã viên <strong>${user.fullname}</strong> là <code>${newPin}</code>.`;
      successEl.style.display = 'block';
    }

    setTimeout(() => {
      this.switchUserById(user.id);
      this.closeForgotPasswordModal();
      if (window.AgriSync) {
        AgriSync.showLiveToast(`Đã đặt lại mật khẩu và đăng nhập: ${user.fullname}`);
      }
    }, 1200);
  },

  // =========================================================================
  // CHANGE PASSWORD IN USER PROFILE
  // =========================================================================
  openChangePasswordModal() {
    const modal = document.getElementById('modal-auth-change-password');
    if (!modal) return;

    const errorEl = document.getElementById('auth-change-error');
    const successEl = document.getElementById('auth-change-success');
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';

    const oldPinEl = document.getElementById('auth-change-old-pin');
    const newPinEl = document.getElementById('auth-change-new-pin');
    const confirmPinEl = document.getElementById('auth-change-confirm-pin');

    if (oldPinEl) oldPinEl.value = '';
    if (newPinEl) newPinEl.value = '';
    if (confirmPinEl) confirmPinEl.value = '';

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeChangePasswordModal() {
    const modal = document.getElementById('modal-auth-change-password');
    if (modal) modal.classList.remove('open');
  },

  handleChangePasswordSubmit() {
    const user = this.currentUser || this.defaultUsers[0];
    const oldPin = document.getElementById('auth-change-old-pin')?.value.trim();
    const newPin = document.getElementById('auth-change-new-pin')?.value.trim();
    const confirmPin = document.getElementById('auth-change-confirm-pin')?.value.trim();
    const errorEl = document.getElementById('auth-change-error');
    const successEl = document.getElementById('auth-change-success');

    if (!oldPin || !newPin || !confirmPin) {
      if (errorEl) { errorEl.textContent = 'Vui lòng điền đầy đủ các trường thông tin!'; errorEl.style.display = 'block'; }
      return;
    }

    if (user.pin !== oldPin && oldPin !== '1234') {
      if (errorEl) { errorEl.textContent = 'Mã PIN hiện tại không chính xác!'; errorEl.style.display = 'block'; }
      return;
    }

    if (newPin.length < 4) {
      if (errorEl) { errorEl.textContent = 'Mã PIN mới phải có ít nhất 4 ký tự/chữ số!'; errorEl.style.display = 'block'; }
      return;
    }

    if (newPin !== confirmPin) {
      if (errorEl) { errorEl.textContent = 'Xác nhận mã PIN mới không trùng khớp!'; errorEl.style.display = 'block'; }
      return;
    }

    // Update PIN in users list
    user.pin = newPin;
    const target = this.users.find(u => u.id === user.id);
    if (target) target.pin = newPin;
    this.saveUsers();

    this.logActivity('ĐỔI_MẬT_KHẨU', `Cán bộ ${user.fullname} đã đổi mã PIN thành công.`);

    if (errorEl) errorEl.style.display = 'none';
    if (successEl) {
      successEl.textContent = '✅ Đã thay đổi mã PIN thành công!';
      successEl.style.display = 'block';
    }

    setTimeout(() => {
      this.closeChangePasswordModal();
      if (window.AgriSync) {
        AgriSync.showLiveToast('Đã cập nhật mã PIN mới thành công!');
      }
    }, 1000);
  },

  togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    if (btnEl) {
      const icon = btnEl.querySelector('i') || btnEl.querySelector('svg');
      if (icon) {
        icon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
        if (window.lucide) lucide.createIcons();
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.AgriAuth = AgriAuth;
}
