/**
 * AGRIGIS COMPREHENSIVE ENTERPRISE ADMINISTRATION & SECURITY SUBSYSTEM
 * (Phân Hệ Quản Trị Hệ Thống Toàn Diện: Thành Viên, Phân Quyền RBAC 3 Cấp, Niên Vụ, Giá Lúa, Sao Lưu & Nhật Ký Truy Vết)
 */

const AgriAdmin = {
  currentSubTab: 'adm-subtab-users',
  userInnerView: 'active',
  selectedUserId: null,
  selectedApprovalId: null,
  selectedSeasonId: 'season_2025_dx',

  // Default Rice Varieties & Prices
  defaultRicePrices: {
    'ĐV108': 8200,
    'Khang Dân 18': 7800,
    'Hương Châu 6': 9200,
    'Đài Thơm 8': 8900,
    'ST25': 11500,
    'Xi23': 8000,
    'HT1': 8400,
    'Bắc Thơm 7': 8600
  },

  // Default Multi-Seasons Directory
  defaultSeasons: [
    {
      id: 'season_2025_dx',
      name: 'Vụ Đông Xuân 2025 - 2026',
      code: 'DX2025-2026',
      year: 2026,
      type: 'Đông Xuân',
      startDate: '2025-12-15',
      endDate: '2026-04-20',
      status: 'active',
      isCurrent: true,
      defaultDeductPct: 12.0,
      ricePrices: {
        'ĐV108': 8200,
        'Khang Dân 18': 7800,
        'Hương Châu 6': 9200,
        'Đài Thơm 8': 8900,
        'ST25': 11500,
        'Xi23': 8000,
        'HT1': 8400,
        'Bắc Thơm 7': 8600
      },
      note: 'Vụ chính sản xuất lúa chất lượng cao toàn xã'
    },
    {
      id: 'season_2025_ht',
      name: 'Vụ Hè Thu 2025',
      code: 'HT2025',
      year: 2025,
      type: 'Hè Thu',
      startDate: '2025-05-10',
      endDate: '2025-09-15',
      status: 'closed',
      isCurrent: false,
      defaultDeductPct: 12.0,
      ricePrices: {
        'ĐV108': 7900,
        'Khang Dân 18': 7600,
        'Hương Châu 6': 9000,
        'Đài Thơm 8': 8700,
        'ST25': 11200,
        'Xi23': 7800,
        'HT1': 8200,
        'Bắc Thơm 7': 8400
      },
      note: 'Vụ hè thu 2025 đã quyết toán và đóng sổ lưu trữ lịch sử'
    },
    {
      id: 'season_2026_ht',
      name: 'Vụ Hè Thu 2026',
      code: 'HT2026',
      year: 2026,
      type: 'Hè Thu',
      startDate: '2026-05-05',
      endDate: '2026-09-20',
      status: 'planning',
      isCurrent: false,
      defaultDeductPct: 12.0,
      ricePrices: {
        'ĐV108': 8300,
        'Khang Dân 18': 7900,
        'Hương Châu 6': 9300,
        'Đài Thơm 8': 9000,
        'ST25': 11800,
        'Xi23': 8100,
        'HT1': 8500,
        'Bắc Thơm 7': 8700
      },
      note: 'Kế hoạch vụ hè thu năm 2026 - Dự kiến triển khai'
    }
  ],

  init() {
    this.setupListeners();
    this.loadSeasons();
    this.loadRicePrices();
  },

  setupListeners() {
    document.querySelectorAll('.adm-subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.admintab;
        if (tab) this.switchSubTab(tab);
      });
    });
  },

  render() {
    this.switchSubTab(this.currentSubTab || 'adm-subtab-users');
    this.renderKPIsRibbon();
    this.updatePendingCountBadges();
  },

  switchSubTab(tabId) {
    this.currentSubTab = tabId;

    document.querySelectorAll('.adm-subnav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.admintab === tabId);
    });

    document.querySelectorAll('.adm-subpane').forEach(p => {
      p.style.display = (p.id === tabId) ? 'block' : 'none';
    });

    this.renderKPIsRibbon();
    this.updatePendingCountBadges();

    if (tabId === 'adm-subtab-users') {
      if (this.userInnerView === 'pending') {
        this.renderPendingApprovalsTable();
      } else {
        this.renderUsersTable();
      }
    } else if (tabId === 'adm-subtab-rbac') {
      this.renderRBACMatrix();
    } else if (tabId === 'adm-subtab-season') {
      this.renderSeasonSettings();
      this.renderRicePriceSettings();
      this.renderZonesDirectory();
    } else if (tabId === 'adm-subtab-backup') {
      this.renderBackupStats();
    } else if (tabId === 'adm-subtab-audit') {
      this.renderAuditTable();
    }

    if (window.lucide) lucide.createIcons();
  },

  switchUserInnerView(view) {
    this.userInnerView = view;
    const btnActive = document.getElementById('btn-adm-view-active-users');
    const btnPending = document.getElementById('btn-adm-view-pending-users');
    const paneActive = document.getElementById('adm-user-inner-active');
    const panePending = document.getElementById('adm-user-inner-pending');

    if (btnActive && btnPending) {
      if (view === 'active') {
        btnActive.className = 'btn btn-sm btn-emerald';
        btnPending.className = 'btn btn-sm btn-outline';
      } else {
        btnActive.className = 'btn btn-sm btn-outline';
        btnPending.className = 'btn btn-sm btn-emerald';
      }
    }

    if (paneActive) paneActive.style.display = (view === 'active') ? 'block' : 'none';
    if (panePending) panePending.style.display = (view === 'pending') ? 'block' : 'none';

    if (view === 'active') {
      this.renderUsersTable();
    } else {
      this.renderPendingApprovalsTable();
    }
    this.updatePendingCountBadges();
    if (window.lucide) lucide.createIcons();
  },

  updatePendingCountBadges() {
    if (!window.AgriAuth) return;
    AgriAuth.loadPendingUsers();
    const pending = AgriAuth.pendingUsers || [];
    const pendingCount = pending.filter(u => u.status === 'pending_approval').length;

    const countBadge = document.getElementById('adm-pending-counter-badge');
    if (countBadge) {
      countBadge.textContent = pendingCount > 0 ? pendingCount : '0';
      countBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    const mainBadge = document.getElementById('adm-main-pending-badge');
    if (mainBadge) {
      mainBadge.textContent = pendingCount > 0 ? pendingCount : '0';
      mainBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    const userPill = document.getElementById('adm-user-count-pill');
    if (userPill) {
      userPill.textContent = (AgriAuth.users || []).length;
    }
  },

  // =========================================================================
  // 0. EXECUTIVE KPI RIBBON
  // =========================================================================
  renderKPIsRibbon() {
    const users = AgriAuth.users || [];
    const activeUsers = users.filter(u => u.active).length;
    const logs = AgriAuth.logs || [];
    const perms = AgriAuth.permissions || AgriAuth.defaultPermissions;

    let activePermCount = 0;
    Object.values(perms).forEach(roleObj => {
      Object.values(roleObj).forEach(val => {
        if (val) activePermCount++;
      });
    });

    const elStaff = document.getElementById('adm-kpi-staff-count');
    const elPerms = document.getElementById('adm-kpi-perms-count');
    const elSync = document.getElementById('adm-kpi-sync-status');
    const elLogs = document.getElementById('adm-kpi-logs-count');

    if (elStaff) elStaff.textContent = `${activeUsers}/${users.length} Cán bộ`;
    if (elPerms) elPerms.textContent = `${activePermCount} Quyền đang bật`;
    if (elSync) elSync.textContent = navigator.onLine ? 'Trực tuyến (100%)' : 'Ngoại tuyến (Offline)';
    if (elLogs) elLogs.textContent = `${logs.length} Bản ghi`;
  },

  canManageSeason() {
    if (!window.AgriAuth || !AgriAuth.currentUser) return false;
    return AgriAuth.currentUser.role === 'director' || AgriAuth.hasPermission('canAdminSystem');
  },

  // =========================================================================
  // 1. MODULE 1: MEMBER MANAGEMENT & USER PROFILES
  // =========================================================================
  renderUsersTable() {
    const tbody = document.getElementById('adm-users-table-tbody');
    if (!tbody) return;

    const query = (document.getElementById('adm-user-search-input')?.value || '').toLowerCase().trim();
    const roleFilter = document.getElementById('adm-user-role-filter')?.value || 'all';

    let users = AgriAuth.users || [];

    if (roleFilter !== 'all') {
      users = users.filter(u => u.role === roleFilter);
    }

    if (query) {
      users = users.filter(u =>
        (u.fullname || '').toLowerCase().includes(query) ||
        (u.username || '').toLowerCase().includes(query) ||
        (u.phone || '').includes(query) ||
        (u.cccd || '').includes(query) ||
        (u.to_dan_pho || '').toLowerCase().includes(query)
      );
    }

    const countBadge = document.getElementById('adm-user-count-badge');
    if (countBadge) countBadge.textContent = `${users.length} thành viên`;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="center-cell" style="padding: 2.5rem; color: var(--text-muted);">Không tìm thấy thành viên nào phù hợp</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map((u, idx) => {
      const isCurrent = AgriAuth.currentUser && AgriAuth.currentUser.id === u.id;
      const permTier = AgriAuth.getUserPermissionTier(u);
      return `
        <tr class="${isCurrent ? 'row-highlight' : ''}">
          <td class="center-cell">${idx + 1}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: ${isCurrent ? 'var(--primary)' : 'var(--primary-light)'}; color: ${isCurrent ? '#fff' : 'var(--primary)'}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.95rem; flex-shrink: 0;">
                ${u.fullname.charAt(0)}
              </div>
              <div>
                <strong style="color: var(--text-main); cursor: pointer;" onclick="AgriAdmin.viewUserProfile('${u.id}')" title="Xem hồ sơ chi tiết">${u.fullname}</strong>
                ${isCurrent ? '<span class="badge badge-emerald" style="font-size: 0.65rem; margin-left: 4px;">Đang dùng</span>' : ''}
                <div style="font-size: 0.76rem; color: var(--text-muted);">@${u.username} • 📞 ${u.phone || '---'}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-purple">${u.roleName}</span></td>
          <td class="center-cell"><span class="badge ${permTier.badgeClass}" style="font-weight: 700;">${permTier.label}</span></td>
          <td class="center-cell">
            <code style="background: var(--bg-app); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.88rem; color: var(--amber); border: 1px solid var(--border-subtle);">${u.pin}</code>
          </td>
          <td>
            <div style="font-size: 0.82rem;">
              <strong>${u.to_dan_pho || 'Tất cả'}</strong>
              <div style="color: var(--text-muted); font-size: 0.75rem;">${(u.assigned_zones || []).slice(0, 2).join(', ')}</div>
            </div>
          </td>
          <td class="center-cell">
            <span class="badge ${u.active ? 'badge-emerald' : 'badge-amber'}">${u.active ? 'Hoạt động' : 'Đã khóa'}</span>
          </td>
          <td class="center-cell" style="white-space: nowrap;">
            <button class="btn btn-sm btn-outline" onclick="AgriAdmin.viewUserProfile('${u.id}')" title="Xem hồ sơ chi tiết">
              <i data-lucide="eye"></i>
            </button>
            <button class="btn btn-sm btn-emerald" onclick="AgriAdmin.quickLoginAsUser('${u.id}')" title="Đăng nhập với vai trò này">
              <i data-lucide="log-in"></i>
            </button>
            <button class="btn btn-sm btn-outline" onclick="AgriAdmin.openEditUserModal('${u.id}')" title="Chỉnh sửa thông tin">
              <i data-lucide="edit-2"></i>
            </button>
            <button class="btn btn-sm btn-outline" style="color: ${u.active ? '#f59e0b' : '#10b981'};" onclick="AgriAdmin.toggleUserStatus('${u.id}')" title="${u.active ? 'Khóa tài khoản' : 'Mở khóa'}">
              <i data-lucide="${u.active ? 'lock' : 'unlock'}"></i>
            </button>
            <button class="btn btn-sm btn-outline" style="color: #ef4444;" onclick="AgriAdmin.deleteUser('${u.id}')" title="Xóa tài khoản">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  quickLoginAsUser(userId) {
    const u = AgriAuth.users.find(x => x.id === userId);
    if (!u) return;

    AgriAuth.switchUserById(userId);
    this.render();
    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã chuyển sang vai trò: ${u.fullname} (${u.roleName})`);
    }
  },

  viewUserProfile(userId) {
    const u = AgriAuth.users.find(x => x.id === userId);
    if (!u) return;

    this.selectedUserId = userId;
    const modal = document.getElementById('modal-adm-user-profile');
    if (!modal) return;

    const content = document.getElementById('adm-user-profile-content');
    if (content) {
      content.innerHTML = `
        <div style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #047857); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 800; box-shadow: 0 4px 12px rgba(5,150,105,0.25);">
            ${u.fullname.charAt(0)}
          </div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <h3 style="margin: 0; font-size: 1.35rem; color: var(--text-main);">${u.fullname}</h3>
              <span class="badge ${u.active ? 'badge-emerald' : 'badge-amber'}">${u.active ? 'Đang hoạt động' : 'Tạm khóa'}</span>
            </div>
            <p style="margin: 4px 0 8px 0; color: var(--primary); font-weight: 700; font-size: 0.95rem;">${u.roleName}</p>
            <div style="display: flex; gap: 16px; color: var(--text-muted); font-size: 0.85rem; flex-wrap: wrap;">
              <span>👤 Tài khoản: <strong>@${u.username}</strong></span>
              <span>🔑 Mã PIN ngoài ruộng: <strong style="color: var(--amber);">${u.pin}</strong></span>
              <span>📅 Ngày gia nhập: <strong>${u.date_joined || '2023-01-01'}</strong></span>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
          <div class="form-card" style="padding: 12px 16px; background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: 8px;">
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Thông tin định danh</span>
            <div style="margin-top: 6px; font-size: 0.88rem; line-height: 1.6;">
              <div>🪪 <strong>Số CCCD:</strong> ${u.cccd || 'Chưa cập nhật'}</div>
              <div>🎂 <strong>Ngày sinh:</strong> ${u.ngay_sinh || '---'} (Giới tính: ${u.gioi_tinh || 'Nam'})</div>
              <div>📞 <strong>Điện thoại:</strong> ${u.phone || '---'}</div>
              <div>✉️ <strong>Email:</strong> ${u.email || '---'}</div>
            </div>
          </div>

          <div class="form-card" style="padding: 12px 16px; background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: 8px;">
            <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Phân công địa bàn</span>
            <div style="margin-top: 6px; font-size: 0.88rem; line-height: 1.6;">
              <div>🏠 <strong>Địa chỉ thường trú:</strong> ${u.dia_chi || 'Xã Hòa Tiến'}</div>
              <div>🏘️ <strong>Tổ dân phố / Thôn:</strong> ${u.to_dan_pho || 'Tất cả'}</div>
              <div>🌾 <strong>Xứ đồng phụ trách:</strong> ${(u.assigned_zones || []).join(', ') || 'Toàn xã'}</div>
              <div>📝 <strong>Ghi chú:</strong> ${u.ghi_chu || 'Không có'}</div>
            </div>
          </div>
        </div>
      `;
    }

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeUserProfileModal() {
    const modal = document.getElementById('modal-adm-user-profile');
    if (modal) modal.classList.remove('open');
  },

  openAddUserModal() {
    document.getElementById('adm-form-user-id').value = '';
    document.getElementById('adm-form-fullname').value = '';
    document.getElementById('adm-form-username').value = '';
    document.getElementById('adm-form-pin').value = Math.floor(1000 + Math.random() * 9000);
    document.getElementById('adm-form-role').value = 'weighing_staff';
    document.getElementById('adm-form-phone').value = '';
    document.getElementById('adm-form-cccd').value = '';
    document.getElementById('adm-form-dob').value = '';
    document.getElementById('adm-form-gender').value = 'Nam';
    document.getElementById('adm-form-address').value = 'Xã Hòa Tiến, Hòa Vang, Đà Nẵng';
    document.getElementById('adm-form-to').value = 'Tất cả';
    document.getElementById('adm-form-zones').value = 'La Châu, Hà Ra 24, Gò ổi';
    document.getElementById('adm-form-email').value = '';
    document.getElementById('adm-form-note').value = '';

    document.getElementById('modal-adm-user-form-title').textContent = 'Thêm Cán Bộ / Thành Viên Mới';
    const modal = document.getElementById('modal-adm-user-form');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  openEditUserModal(userId) {
    const u = AgriAuth.users.find(x => x.id === userId);
    if (!u) return;

    document.getElementById('adm-form-user-id').value = u.id;
    document.getElementById('adm-form-fullname').value = u.fullname;
    document.getElementById('adm-form-username').value = u.username;
    document.getElementById('adm-form-pin').value = u.pin;
    document.getElementById('adm-form-role').value = u.role;
    document.getElementById('adm-form-phone').value = u.phone || '';
    document.getElementById('adm-form-cccd').value = u.cccd || '';
    document.getElementById('adm-form-dob').value = u.ngay_sinh || '';
    document.getElementById('adm-form-gender').value = u.gioi_tinh || 'Nam';
    document.getElementById('adm-form-address').value = u.dia_chi || '';
    document.getElementById('adm-form-to').value = u.to_dan_pho || 'Tất cả';
    document.getElementById('adm-form-zones').value = (u.assigned_zones || []).join(', ');
    document.getElementById('adm-form-email').value = u.email || '';
    document.getElementById('adm-form-note').value = u.ghi_chu || '';

    document.getElementById('modal-adm-user-form-title').textContent = `Chỉnh Sửa Hồ Sơ: ${u.fullname}`;
    const modal = document.getElementById('modal-adm-user-form');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  saveUserForm() {
    const id = document.getElementById('adm-form-user-id').value;
    const fullname = document.getElementById('adm-form-fullname').value.trim();
    const username = document.getElementById('adm-form-username').value.trim().toLowerCase();
    const pin = document.getElementById('adm-form-pin').value.trim();
    const role = document.getElementById('adm-form-role').value;
    const phone = document.getElementById('adm-form-phone').value.trim();
    const cccd = document.getElementById('adm-form-cccd').value.trim();
    const dob = document.getElementById('adm-form-dob').value;
    const gender = document.getElementById('adm-form-gender').value;
    const address = document.getElementById('adm-form-address').value.trim();
    const to = document.getElementById('adm-form-to').value.trim();
    const zonesStr = document.getElementById('adm-form-zones').value.trim();
    const email = document.getElementById('adm-form-email').value.trim();
    const note = document.getElementById('adm-form-note').value.trim();

    if (!fullname || !username || !pin) {
      alert('Vui lòng nhập đầy đủ Họ và tên, Tên đăng nhập và Mã PIN!');
      return;
    }

    const roleNames = {
      director: '👑 Ban Giám Đốc HTX',
      accountant: '💰 Kế Toán / Thủ Quỹ',
      cadastre: '🗺️ Cán Bộ Địa Chính GIS',
      weighing_staff: '⚖️ Cán Bộ Cân Thu Mua',
      village_head: '🏘️ Trưởng Thôn / Tổ Dân Phố',
      farmer: '👨‍🌾 Hộ Nông Dân / Xã Viên'
    };

    const assigned_zones = zonesStr ? zonesStr.split(',').map(s => s.trim()).filter(Boolean) : ['Tất cả các xứ đồng'];

    if (id) {
      const u = AgriAuth.users.find(x => x.id === id);
      if (u) {
        u.fullname = fullname;
        u.username = username;
        u.pin = pin;
        u.role = role;
        u.roleName = roleNames[role] || role;
        u.phone = phone;
        u.cccd = cccd;
        u.ngay_sinh = dob;
        u.gioi_tinh = gender;
        u.dia_chi = address;
        u.to_dan_pho = to;
        u.assigned_zones = assigned_zones;
        u.email = email;
        u.ghi_chu = note;

        AgriAuth.logActivity('CẬP NHẬT HỒ SƠ', `Cập nhật thông tin cán bộ ${fullname} (@${username})`);
        AgriAuth.saveUsers();
        if (AgriAuth.currentUser && AgriAuth.currentUser.id === u.id) {
          AgriAuth.currentUser = u;
          AgriAuth.saveSession();
          AgriAuth.updateUserUI();
        }
      }
    } else {
      if (AgriAuth.users.some(x => x.username === username)) {
        alert(`Tên đăng nhập "${username}" đã tồn tại! Vui lòng chọn tên khác.`);
        return;
      }

      const newUser = {
        id: 'usr_' + Date.now(),
        fullname,
        username,
        pin,
        role,
        roleName: roleNames[role] || role,
        phone,
        cccd,
        ngay_sinh: dob,
        gioi_tinh: gender,
        dia_chi: address,
        to_dan_pho: to,
        assigned_zones,
        email,
        ghi_chu: note,
        date_joined: new Date().toISOString().slice(0, 10),
        active: true
      };

      AgriAuth.users.push(newUser);
      AgriAuth.logActivity('THÊM THÀNH VIÊN', `Thêm tài khoản thành viên mới ${fullname} (@${username})`);
      AgriAuth.saveUsers();
    }

    this.closeUserFormModal();
    this.render();
    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã lưu hồ sơ thành viên: ${fullname}`);
    }
  },

  deleteUser(userId) {
    const u = AgriAuth.users.find(x => x.id === userId);
    if (!u) return;

    if (u.id === AgriAuth.currentUser?.id) {
      alert('Bạn không thể xóa chính tài khoản đang đăng nhập!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn XÓA thành viên "${u.fullname}" (@${u.username}) khỏi hệ thống?`)) {
      return;
    }

    const targetUsername = u.username;
    const targetEmail = (u.email || '').toLowerCase();
    const targetPhone = u.phone || '';

    // 1. Remove from active users
    AgriAuth.users = AgriAuth.users.filter(x => x.id !== userId);
    AgriAuth.saveUsers();

    // 2. Remove from pending registrations queue
    AgriAuth.loadPendingUsers();
    AgriAuth.pendingUsers = (AgriAuth.pendingUsers || []).filter(p => 
      p.id !== userId && 
      p.username !== targetUsername && 
      (!targetEmail || (p.email || '').toLowerCase() !== targetEmail) &&
      (!targetPhone || p.phone !== targetPhone)
    );
    AgriAuth.savePendingUsers();

    AgriAuth.logActivity('XÓA THÀNH VIÊN', `Xóa tài khoản thành viên ${u.fullname} (@${u.username})`);
    this.render();
    this.updatePendingCountBadges();

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã xóa tài khoản và hồ sơ của: ${u.fullname}`);
    }
  },

  toggleUserStatus(userId) {
    const u = AgriAuth.users.find(x => x.id === userId);
    if (!u) return;

    if (u.id === AgriAuth.currentUser?.id) {
      alert('Không thể khóa tài khoản đang sử dụng!');
      return;
    }

    u.active = !u.active;
    AgriAuth.saveUsers();
    AgriAuth.logActivity(u.active ? 'MỞ KHÓA' : 'KHÓA TÀI KHOẢN', `${u.active ? 'Mở khóa' : 'Khóa'} tài khoản ${u.fullname}`);
    this.render();
  },

  closeUserFormModal() {
    const modal = document.getElementById('modal-adm-user-form');
    if (modal) modal.classList.remove('open');
  },

  // =========================================================================
  // 2. MODULE 2: INTERACTIVE 3-TIER RBAC MATRIX
  // =========================================================================
  getTierStyle(tier) {
    switch (tier) {
      case 'admin':
        return 'background: #faf5ff; color: #7e22ce; border: 1.5px solid #d8b4fe; font-weight: 700;';
      case 'edit':
        return 'background: #f0fdf4; color: #047857; border: 1.5px solid #86efac; font-weight: 700;';
      case 'view':
        return 'background: #eff6ff; color: #1d4ed8; border: 1.5px solid #93c5fd; font-weight: 600;';
      case 'none':
      default:
        return 'background: #f8fafc; color: #94a3b8; border: 1.5px solid #cbd5e1; font-weight: 500;';
    }
  },

  onMatrixLevelChange(selectEl) {
    if (!selectEl) return;
    const tier = selectEl.value;
    selectEl.style.cssText = `${this.getTierStyle(tier)}; padding: 6px 8px; border-radius: 6px; font-size: 0.82rem; width: 100%; cursor: pointer;`;
  },

  renderRBACMatrix() {
    const matrixContainer = document.getElementById('adm-rbac-matrix-container');
    if (!matrixContainer) return;

    const perms = AgriAuth.permissions || AgriAuth.defaultPermissions;

    const modules = [
      {
        key: 'map',
        name: '1. 🗺️ Bản Đồ GIS Không Gian Số',
        desc: 'Vẽ ranh giới thửa ruộng, số hóa tọa độ, chia tách/hợp thửa, định vị GPS',
        icon: 'map'
      },
      {
        key: 'plots',
        name: '2. 📋 Sổ Bộ Thửa & Đất Đai',
        desc: 'Quản lý 1.181 thửa ruộng, số tờ/số thửa, phân loại Quỹ 1 / Quỹ 2, xuất Excel',
        icon: 'layers'
      },
      {
        key: 'farmers',
        name: '3. 👥 Hộ Nông Dân & Xã Viên',
        desc: 'Hồ sơ 280 hộ, số điện thoại, CCCD định danh (Nghị định 13), diện tích tích tụ',
        icon: 'users'
      },
      {
        key: 'services',
        name: '4. 💰 Phí Dịch Vụ Nông Nghiệp',
        desc: 'Biểu giá thủy nông, làm đất, dịch vụ mạ, thu tiền và quyết toán công nợ',
        icon: 'dollar-sign'
      },
      {
        key: 'purchasing',
        name: '5. ⚖️ Cân Lúa Cơ Động Tại Ruộng',
        desc: 'Mở phiên cân di động, ghi mẻ cân 1-3 bao, trừ ẩm 12%, in phiếu thu mua A4',
        icon: 'scale'
      },
      {
        key: 'analytics',
        name: '6. 📊 Báo Cáo & Thống Kê Toàn Xã',
        desc: 'Biểu đồ sản lượng mùa vụ, cơ cấu giống lúa, phân tích tài chính HTX',
        icon: 'pie-chart'
      },
      {
        key: 'admin',
        name: '7. 🛡️ Quản Trị Hệ Thống & Bảo Mật',
        desc: 'Quản trị cán bộ, ma trận 3 cấp, quản lý niên vụ, duyệt đăng ký, sao lưu CSDL',
        icon: 'shield-check'
      }
    ];

    const roles = [
      { id: 'director', name: 'Ban Giám Đốc', icon: '👑', color: 'purple' },
      { id: 'accountant', name: 'Kế Toán / Thủ Quỹ', icon: '💰', color: 'blue' },
      { id: 'cadastre', name: 'Cán Bộ Địa Chính', icon: '🗺️', color: 'emerald' },
      { id: 'weighing_staff', name: 'Cán Bộ Cân Lúa', icon: '⚖️', color: 'amber' },
      { id: 'village_head', name: 'Trưởng Thôn / Tổ', icon: '🏘️', color: 'teal' },
      { id: 'farmer', name: 'Nông Dân / Xã Viên', icon: '👨‍🌾', color: 'gray' }
    ];

    let html = `
      <div style="display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">Chú thích 3 cấp quyền:</span>
          <span class="badge" style="${this.getTierStyle('admin')}; padding: 3px 8px;">👑 Quản Trị (Toàn quyền)</span>
          <span class="badge" style="${this.getTierStyle('edit')}; padding: 3px 8px;">✏️ Chỉnh Sửa (Đọc & Ghi)</span>
          <span class="badge" style="${this.getTierStyle('view')}; padding: 3px 8px;">👁️ Xem (Chỉ đọc)</span>
          <span class="badge" style="${this.getTierStyle('none')}; padding: 3px 8px;">🚫 Khóa Quyền</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-sm btn-outline" onclick="AgriAdmin.resetDefaultPermissions()"><i data-lucide="rotate-ccw"></i> Đặt Lại Mặc Định</button>
          <button type="button" class="btn btn-sm btn-emerald" onclick="AgriAdmin.saveRBACMatrix()"><i data-lucide="check"></i> Lưu & Áp Dụng Live</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table" style="font-size: 0.88rem;">
          <thead>
            <tr>
              <th width="310">Phân Hệ Nghiệp Vụ Nông Nghiệp</th>
              ${roles.map(r => `
                <th class="center-cell" width="135">
                  <div style="font-size: 1.15rem;">${r.icon}</div>
                  <strong style="display: block; font-size: 0.82rem; margin-top: 2px;">${r.name}</strong>
                  <div style="display: flex; justify-content: center; gap: 2px; margin-top: 4px;">
                    <button type="button" class="btn btn-sm btn-outline" style="font-size: 0.65rem; padding: 1px 4px;" title="Cấp toàn quyền quản trị" onclick="AgriAdmin.applyRolePreset('${r.id}', 'admin')">👑</button>
                    <button type="button" class="btn btn-sm btn-outline" style="font-size: 0.65rem; padding: 1px 4px;" title="Cấp quyền chỉnh sửa" onclick="AgriAdmin.applyRolePreset('${r.id}', 'edit')">✏️</button>
                    <button type="button" class="btn btn-sm btn-outline" style="font-size: 0.65rem; padding: 1px 4px;" title="Cấp quyền chỉ xem" onclick="AgriAdmin.applyRolePreset('${r.id}', 'view')">👁️</button>
                  </div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    modules.forEach((m, mIdx) => {
      html += `
        <tr>
          <td>
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <div>
                <strong style="color: var(--text-main); font-size: 0.9rem;">${m.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin-top: 2px;">${m.desc}</div>
              </div>
            </div>
          </td>
          ${roles.map(r => {
            const rolePerms = perms[r.id] || AgriAuth.defaultPermissions[r.id] || {};
            const currentVal = rolePerms[m.key] || (r.id === 'director' ? 'admin' : 'view');
            const isDirectorAdmin = (r.id === 'director' && m.key === 'admin');

            return `
              <td class="center-cell" style="vertical-align: middle;">
                <select class="rbac-matrix-select"
                  data-role="${r.id}"
                  data-module="${m.key}"
                  style="${this.getTierStyle(currentVal)}; padding: 6px 8px; border-radius: 6px; font-size: 0.82rem; width: 100%; cursor: pointer;"
                  onchange="AgriAdmin.onMatrixLevelChange(this)"
                  ${isDirectorAdmin ? 'disabled title="Ban Giám Đốc luôn giữ quyền Quản trị tối cao"' : ''}>
                  <option value="admin" ${currentVal === 'admin' ? 'selected' : ''}>👑 Quản Trị</option>
                  <option value="edit" ${currentVal === 'edit' ? 'selected' : ''}>✏️ Chỉnh Sửa</option>
                  <option value="view" ${currentVal === 'view' ? 'selected' : ''}>👁️ Chỉ Xem</option>
                  <option value="none" ${currentVal === 'none' ? 'selected' : ''}>🚫 Khóa Quyền</option>
                </select>
              </td>
            `;
          }).join('')}
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
      <div style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <span style="font-size: 0.82rem; color: var(--text-muted);">* Thay đổi phân quyền sẽ được kích hoạt tức thì cho tất cả cán bộ đang online</span>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-outline" onclick="AgriAdmin.resetDefaultPermissions()"><i data-lucide="rotate-ccw"></i> Đặt Lại Mặc Định</button>
          <button class="btn btn-emerald" onclick="AgriAdmin.saveRBACMatrix()"><i data-lucide="check"></i> Lưu & Áp Dụng Live</button>
        </div>
      </div>
    `;

    matrixContainer.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  },

  applyRolePreset(roleId, presetLevel) {
    const selects = document.querySelectorAll(`#adm-rbac-matrix-container select[data-role="${roleId}"]`);
    selects.forEach(sel => {
      if (!sel.disabled) {
        if (sel.dataset.module === 'admin' && presetLevel !== 'admin') {
          sel.value = 'none';
        } else {
          sel.value = presetLevel;
        }
        this.onMatrixLevelChange(sel);
      }
    });
  },

  saveRBACMatrix() {
    const selects = document.querySelectorAll('#adm-rbac-matrix-container select.rbac-matrix-select');
    const newPerms = JSON.parse(JSON.stringify(AgriAuth.defaultPermissions));

    selects.forEach(sel => {
      const role = sel.dataset.role;
      const moduleKey = sel.dataset.module;
      if (role && moduleKey) {
        if (!newPerms[role]) newPerms[role] = {};
        newPerms[role][moduleKey] = sel.value;
      }
    });

    newPerms.director = {
      map: 'admin',
      plots: 'admin',
      farmers: 'admin',
      services: 'admin',
      purchasing: 'admin',
      analytics: 'admin',
      admin: 'admin'
    };

    AgriAuth.permissions = newPerms;
    AgriAuth.savePermissions();
    AgriAuth.applyRoleRestrictions();
    AgriAuth.logActivity('CẬP NHẬT PHÂN QUYỀN', 'Cập nhật ma trận phân quyền 3 cấp (Quản trị, Chỉnh sửa, Xem) toàn hệ thống');

    alert('Đã lưu thành công Ma Trận Phân Quyền 3 Cấp cho 6 vai trò!');
    if (window.AgriSync) {
      AgriSync.showLiveToast('Ma trận phân quyền 3 cấp đã được cập nhật thành công!');
    }
  },

  resetDefaultPermissions() {
    if (!confirm('Bạn có muốn đặt lại toàn bộ ma trận phân quyền 3 cấp về chuẩn mặc định HTX Hòa Tiến 2?')) return;
    AgriAuth.permissions = JSON.parse(JSON.stringify(AgriAuth.defaultPermissions));
    AgriAuth.savePermissions();
    this.renderRBACMatrix();
    alert('Đã khôi phục ma trận phân quyền 3 cấp về mặc định!');
  },

  // =========================================================================
  // 3. MODULE 3: MULTI-SEASON MANAGEMENT & RICE PRICING
  // =========================================================================
  loadSeasons() {
    const saved = localStorage.getItem('agrigis_seasons');
    if (saved) {
      try {
        this.seasons = JSON.parse(saved);
      } catch (e) {
        this.seasons = JSON.parse(JSON.stringify(this.defaultSeasons));
      }
    } else {
      this.seasons = JSON.parse(JSON.stringify(this.defaultSeasons));
      this.saveSeasons();
    }

    if (!Array.isArray(this.seasons) || this.seasons.length === 0) {
      this.seasons = JSON.parse(JSON.stringify(this.defaultSeasons));
    }

    const current = this.seasons.find(s => s.isCurrent) || this.seasons[0];
    if (!this.selectedSeasonId || !this.seasons.some(s => s.id === this.selectedSeasonId)) {
      this.selectedSeasonId = current ? current.id : this.seasons[0].id;
    }
  },

  saveSeasons() {
    localStorage.setItem('agrigis_seasons', JSON.stringify(this.seasons));
  },

  getCurrentSeason() {
    if (!this.seasons) this.loadSeasons();
    return this.seasons.find(s => s.isCurrent) || this.seasons[0];
  },

  getSeasonById(id) {
    if (!this.seasons) this.loadSeasons();
    return this.seasons.find(s => s.id === id) || null;
  },

  selectSeasonView(seasonId) {
    this.selectedSeasonId = seasonId;
    this.renderSeasonSettings();
    this.renderRicePriceSettings();
  },

  loadRicePrices() {
    this.loadSeasons();
    const s = this.getSeasonById(this.selectedSeasonId) || this.getCurrentSeason();
    this.ricePrices = s ? { ...s.ricePrices } : { ...this.defaultRicePrices };
  },

  saveRicePrices() {
    const s = this.getSeasonById(this.selectedSeasonId);
    if (s) {
      s.ricePrices = { ...this.ricePrices };
      this.saveSeasons();
      if (s.isCurrent) {
        localStorage.setItem('agrigis_rice_prices', JSON.stringify(this.ricePrices));
      }
    }
  },

  renderSeasonSettings() {
    this.loadSeasons();
    const isSuperAdmin = this.canManageSeason();
    const currentSeason = this.getCurrentSeason();
    const selectedSeason = this.getSeasonById(this.selectedSeasonId) || currentSeason;

    const noticeEl = document.getElementById('adm-season-rbac-notice');
    if (noticeEl) {
      if (isSuperAdmin) {
        noticeEl.innerHTML = `
          <div class="alert-box" style="background: rgba(5, 150, 105, 0.08); border: 1px solid rgba(5, 150, 105, 0.25); color: var(--primary); padding: 10px 14px; border-radius: 8px; font-size: 0.84rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i data-lucide="shield-check" style="width: 20px; height: 20px; color: var(--primary);"></i>
              <span><strong>👑 THẨM QUYỀN BAN GIÁM ĐỐC HTX:</strong> Bạn có toàn quyền Khởi tạo Niên vụ mới, Kích hoạt vụ, Khóa sổ và Điều chỉnh biểu giá kinh tế.</span>
            </div>
            <button class="btn btn-sm btn-emerald" onclick="AgriAdmin.openCreateSeasonModal()">
              <i data-lucide="plus-circle"></i> + Tạo Niên Vụ Mới
            </button>
          </div>
        `;
      } else {
        noticeEl.innerHTML = `
          <div class="alert-box" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); color: #d97706; padding: 10px 14px; border-radius: 8px; font-size: 0.84rem; display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
            <i data-lucide="lock" style="width: 20px; height: 20px; color: #d97706;"></i>
            <span><strong>🔒 CHẾ ĐỘ XEM (CHỈ ĐỌC):</strong> Bạn đang xem với vai trò <em>${AgriAuth.currentUser?.roleName || 'Cán bộ'}</em>. Chỉ <strong>Ban Giám Đốc HTX</strong> mới có thẩm quyền Khởi tạo niên vụ, Kích hoạt vụ hoặc Thay đổi biểu giá thu mua lúa.</span>
          </div>
        `;
      }
    }

    const seasonsListEl = document.getElementById('adm-seasons-cards-container');
    if (seasonsListEl) {
      seasonsListEl.innerHTML = this.seasons.map(s => {
        const isSelected = s.id === selectedSeason.id;
        const isCurrent = s.isCurrent;
        
        let badgeHtml = '';
        if (s.status === 'active') {
          badgeHtml = '<span class="badge badge-success" style="font-size: 0.7rem; font-weight: 800;"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> ĐANG HOẠT ĐỘNG (ACTIVE)</span>';
        } else if (s.status === 'closed') {
          badgeHtml = '<span class="badge badge-secondary" style="font-size: 0.7rem;"><i data-lucide="archive" style="width:12px;height:12px;"></i> ĐÃ KHÓA SỔ (ARCHIVED)</span>';
        } else {
          badgeHtml = '<span class="badge badge-purple" style="font-size: 0.7rem;"><i data-lucide="file-text" style="width:12px;height:12px;"></i> DỰ THẢO (PLANNING)</span>';
        }

        return `
          <div class="season-card-item ${isSelected ? 'selected' : ''}" onclick="AgriAdmin.selectSeasonView('${s.id}')" style="
            border: 2px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'};
            background: ${isSelected ? 'rgba(5, 150, 105, 0.04)' : 'var(--bg-surface)'};
            border-radius: 10px;
            padding: 12px 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
          ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div>
                <strong style="font-size: 0.95rem; color: var(--text-main); display: block;">🌾 ${s.name}</strong>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Mã vụ: <code>${s.code}</code> | Loại: ${s.type} ${s.year}</span>
              </div>
              <div>${badgeHtml}</div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-muted); margin-top: 8px; border-top: 1px dashed var(--border-subtle); padding-top: 6px;">
              <span>📅 ${s.startDate || '15/12/2025'} ➔ ${s.endDate || '20/04/2026'}</span>
              <span>Trừ ẩm: <strong>${s.defaultDeductPct}%</strong></span>
            </div>

            ${isSuperAdmin ? `
              <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 10px; padding-top: 6px; border-top: 1px solid var(--border-subtle);" onclick="event.stopPropagation();">
                ${!isCurrent ? `
                  <button class="btn btn-sm btn-outline" style="font-size: 0.72rem; padding: 3px 8px; color: var(--primary);" onclick="AgriAdmin.activateSeason('${s.id}')">
                    <i data-lucide="zap"></i> Kích Hoạt Vụ Này
                  </button>
                ` : '<span style="font-size: 0.72rem; color: var(--primary); font-weight: 800;">⭐ Vụ Vận Hành Mặc Định</span>'}

                ${s.status === 'active' && !isCurrent ? `
                  <button class="btn btn-sm btn-outline" style="font-size: 0.72rem; padding: 3px 8px; color: #64748b;" onclick="AgriAdmin.closeSeason('${s.id}')">
                    <i data-lucide="lock"></i> Khóa Sổ
                  </button>
                ` : ''}

                ${!isCurrent && this.seasons.length > 1 ? `
                  <button class="btn btn-sm btn-outline" style="font-size: 0.72rem; padding: 3px 6px; color: #ef4444;" onclick="AgriAdmin.deleteSeason('${s.id}')" title="Xóa vụ này">
                    <i data-lucide="trash-2"></i>
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }

    const elSeasonName = document.getElementById('adm-cfg-season-name');
    const elSeasonCode = document.getElementById('adm-cfg-season-code');
    const elDeduct = document.getElementById('adm-cfg-deduct-pct');
    const elStart = document.getElementById('adm-cfg-season-start');
    const elEnd = document.getElementById('adm-cfg-season-end');
    const elNote = document.getElementById('adm-cfg-season-note');
    const btnSaveSeason = document.getElementById('btn-adm-save-season-cfg');

    if (elSeasonName) { elSeasonName.value = selectedSeason.name; elSeasonName.disabled = !isSuperAdmin; }
    if (elSeasonCode) { elSeasonCode.value = selectedSeason.code || ''; elSeasonCode.disabled = !isSuperAdmin; }
    if (elDeduct) { elDeduct.value = selectedSeason.defaultDeductPct || '12.0'; elDeduct.disabled = !isSuperAdmin; }
    if (elStart) { elStart.value = selectedSeason.startDate || ''; elStart.disabled = !isSuperAdmin; }
    if (elEnd) { elEnd.value = selectedSeason.endDate || ''; elEnd.disabled = !isSuperAdmin; }
    if (elNote) { elNote.value = selectedSeason.note || ''; elNote.disabled = !isSuperAdmin; }
    if (btnSaveSeason) { btnSaveSeason.style.display = isSuperAdmin ? 'inline-flex' : 'none'; }

    if (window.lucide) lucide.createIcons();
  },

  saveSeasonSettings() {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền lưu cấu hình niên vụ!');
      return;
    }

    const s = this.getSeasonById(this.selectedSeasonId);
    if (!s) return;

    const name = document.getElementById('adm-cfg-season-name')?.value.trim();
    const code = document.getElementById('adm-cfg-season-code')?.value.trim();
    const deduct = parseFloat(document.getElementById('adm-cfg-deduct-pct')?.value) || 12.0;
    const start = document.getElementById('adm-cfg-season-start')?.value;
    const end = document.getElementById('adm-cfg-season-end')?.value;
    const note = document.getElementById('adm-cfg-season-note')?.value.trim();

    if (!name) {
      alert('Tên niên vụ không được để trống!');
      return;
    }

    s.name = name;
    s.code = code || s.code;
    s.defaultDeductPct = deduct;
    s.startDate = start;
    s.endDate = end;
    s.note = note;

    this.saveSeasons();

    if (s.isCurrent) {
      localStorage.setItem('agrigis_current_season', name);
      localStorage.setItem('agrigis_default_deduct_pct', deduct.toString());
    }

    AgriAuth.logActivity('CẬP NHẬT NIÊN VỤ', `Cập nhật thông tin niên vụ: ${name} (Mã: ${code})`);
    alert(`Đã lưu thành công cấu hình cho "${name}"!`);
    this.renderSeasonSettings();
    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã lưu cấu hình niên vụ: ${name}`);
    }
  },

  activateSeason(seasonId) {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền kích hoạt niên vụ vận hành!');
      return;
    }

    const target = this.getSeasonById(seasonId);
    if (!target) return;

    if (!confirm(`Bạn có chắc chắn muốn KÍCH HOẠT "${target.name}" làm Niên Vụ Vận Hành Chính Thức của HTX? Toàn bộ phiên cân và thu phí dịch vụ mới sẽ được gắn vào vụ này.`)) {
      return;
    }

    this.seasons.forEach(s => {
      s.isCurrent = (s.id === seasonId);
      if (s.id === seasonId) s.status = 'active';
    });

    this.saveSeasons();
    localStorage.setItem('agrigis_current_season', target.name);
    localStorage.setItem('agrigis_default_deduct_pct', (target.defaultDeductPct || 12.0).toString());
    localStorage.setItem('agrigis_rice_prices', JSON.stringify(target.ricePrices || this.defaultRicePrices));

    this.selectedSeasonId = seasonId;
    AgriAuth.logActivity('KÍCH HOẠT NIÊN VỤ', `Kích hoạt niên vụ vận hành chính thức: ${target.name}`);

    alert(`Đã kích hoạt thành công "${target.name}" làm Niên vụ vận hành chính thức!`);
    this.renderSeasonSettings();
    this.renderRicePriceSettings();
    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã kích hoạt niên vụ: ${target.name}`);
    }
  },

  closeSeason(seasonId) {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền khóa sổ niên vụ!');
      return;
    }

    const target = this.getSeasonById(seasonId);
    if (!target) return;

    if (!confirm(`Bạn có chắc chắn muốn KHÓA SỔ "${target.name}"? Sau khi khóa sổ, số liệu thu mua và phí dịch vụ của vụ này sẽ được lưu trữ lịch sử và chống sửa đổi.`)) {
      return;
    }

    target.status = 'closed';
    this.saveSeasons();
    AgriAuth.logActivity('KHÓA SỔ NIÊN VỤ', `Khóa sổ và lưu trữ lịch sử vụ mùa: ${target.name}`);

    alert(`Đã khóa sổ thành công "${target.name}"!`);
    this.renderSeasonSettings();
  },

  deleteSeason(seasonId) {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền xóa niên vụ!');
      return;
    }

    const target = this.getSeasonById(seasonId);
    if (!target) return;

    if (target.isCurrent) {
      alert('Không thể xóa Niên vụ đang vận hành chính thức!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn XÓA niên vụ "${target.name}"? Dữ liệu cấu hình của vụ này sẽ bị xóa khỏi danh mục.`)) {
      return;
    }

    this.seasons = this.seasons.filter(s => s.id !== seasonId);
    this.saveSeasons();
    AgriAuth.logActivity('XÓA NIÊN VỤ', `Xóa niên vụ: ${target.name}`);

    this.selectedSeasonId = this.getCurrentSeason().id;
    this.renderSeasonSettings();
    this.renderRicePriceSettings();
    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã xóa niên vụ: ${target.name}`);
    }
  },

  openCreateSeasonModal() {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền tạo Niên Vụ Mới!');
      return;
    }
    const modal = document.getElementById('modal-adm-season-form');
    if (modal) {
      const currentYear = new Date().getFullYear();
      document.getElementById('adm-new-season-name').value = `Vụ Đông Xuân ${currentYear} - ${currentYear + 1}`;
      document.getElementById('adm-new-season-code').value = `DX${currentYear}`;
      document.getElementById('adm-new-season-year').value = currentYear + 1;
      document.getElementById('adm-new-season-type').value = 'Đông Xuân';
      document.getElementById('adm-new-season-deduct').value = '12.0';
      document.getElementById('adm-new-season-start').value = `${currentYear}-12-15`;
      document.getElementById('adm-new-season-end').value = `${currentYear + 1}-04-20`;
      document.getElementById('adm-new-season-note').value = 'Kế hoạch sản xuất vụ mới';
      document.getElementById('adm-new-season-activate-now').checked = true;
      document.getElementById('adm-new-season-reset-plots').checked = true;
      modal.classList.add('open');
      if (window.lucide) lucide.createIcons();
    }
  },

  closeCreateSeasonModal() {
    const modal = document.getElementById('modal-adm-season-form');
    if (modal) modal.classList.remove('open');
  },

  handleCreateSeasonSubmit() {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có thẩm quyền tạo Niên Vụ Mới!');
      return;
    }

    const name = document.getElementById('adm-new-season-name').value.trim();
    const code = document.getElementById('adm-new-season-code').value.trim() || ('V_' + Date.now());
    const year = parseInt(document.getElementById('adm-new-season-year').value) || new Date().getFullYear();
    const type = document.getElementById('adm-new-season-type').value;
    const deduct = parseFloat(document.getElementById('adm-new-season-deduct').value) || 12.0;
    const start = document.getElementById('adm-new-season-start').value;
    const end = document.getElementById('adm-new-season-end').value;
    const note = document.getElementById('adm-new-season-note').value.trim();
    const activateNow = document.getElementById('adm-new-season-activate-now').checked;
    const resetPlots = document.getElementById('adm-new-season-reset-plots').checked;

    if (!name) {
      alert('Vui lòng nhập Tên Niên Vụ Sản Xuất!');
      return;
    }

    const currentSeason = this.getCurrentSeason();
    const inheritedPrices = currentSeason ? { ...currentSeason.ricePrices } : { ...this.defaultRicePrices };

    const newSeason = {
      id: 'season_' + Date.now(),
      name,
      code,
      year,
      type,
      startDate: start,
      endDate: end,
      status: activateNow ? 'active' : 'planning',
      isCurrent: activateNow,
      defaultDeductPct: deduct,
      ricePrices: inheritedPrices,
      note
    };

    if (activateNow) {
      this.seasons.forEach(s => {
        s.isCurrent = false;
        if (s.status === 'active') s.status = 'closed';
      });
    }

    this.seasons.unshift(newSeason);
    this.saveSeasons();

    if (activateNow) {
      localStorage.setItem('agrigis_current_season', name);
      localStorage.setItem('agrigis_default_deduct_pct', deduct.toString());
      localStorage.setItem('agrigis_rice_prices', JSON.stringify(inheritedPrices));

      if (resetPlots && window.AgriData && AgriData.plots) {
        AgriData.plots.forEach(p => {
          p.status = 'Đang làm đất / Gieo sạ';
        });
        AgriData.savePlots();
      }
    }

    this.selectedSeasonId = newSeason.id;
    AgriAuth.logActivity('TẠO NIÊN VỤ MỚI', `Khởi tạo niên vụ mới: ${name} (Mã: ${code}, Loại: ${type} ${year})`);

    this.closeCreateSeasonModal();
    this.renderSeasonSettings();
    this.renderRicePriceSettings();

    alert(`🎉 Đã khởi tạo thành công "${name}"! ${activateNow ? 'Niên vụ đã được kích hoạt làm vụ vận hành chính thức.' : ''}`);
    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã tạo niên vụ mới: ${name}`);
    }
  },

  renderRicePriceSettings() {
    const tbody = document.getElementById('adm-rice-price-tbody');
    if (!tbody) return;

    this.loadRicePrices();
    const isSuperAdmin = this.canManageSeason();
    const selectedSeason = this.getSeasonById(this.selectedSeasonId) || this.getCurrentSeason();

    const titleEl = document.getElementById('adm-rice-price-season-title');
    if (titleEl) {
      titleEl.textContent = `Biểu Giá Thu Mua Theo Giống - ${selectedSeason.name}`;
    }

    const btnAdd = document.getElementById('btn-adm-add-rice-variety');
    const btnSave = document.getElementById('btn-adm-save-rice-prices');
    if (btnAdd) btnAdd.style.display = isSuperAdmin ? 'inline-flex' : 'none';
    if (btnSave) btnSave.style.display = isSuperAdmin ? 'inline-flex' : 'none';

    tbody.innerHTML = Object.entries(this.ricePrices).map(([variety, price], idx) => `
      <tr>
        <td class="center-cell">${idx + 1}</td>
        <td><strong>🌾 ${variety}</strong></td>
        <td>
          <input type="number" step="100" class="form-input rice-price-input" data-variety="${variety}" value="${price}"
            ${!isSuperAdmin ? 'disabled readonly' : ''}
            style="max-width: 140px; font-weight: 700; color: var(--primary);">
        </td>
        <td style="color: var(--text-muted); font-size: 0.82rem;">VNĐ / kg</td>
        <td class="center-cell" width="50">
          ${isSuperAdmin ? `
            <button class="btn btn-sm btn-outline" style="color: #ef4444; padding: 2px 6px;" onclick="AgriAdmin.deleteRiceVariety('${variety}')" title="Xóa giống lúa này">
              <i data-lucide="trash-2"></i>
            </button>
          ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">-</span>'}
        </td>
      </tr>
    `).join('');
    if (window.lucide) lucide.createIcons();
  },

  addRiceVarietyPrompt() {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền thêm giống lúa mới vào biểu giá!');
      return;
    }

    const name = prompt('Nhập tên giống lúa mới (Ví dụ: OM5451, ST24, Nếp Bắc...):');
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();
    if (this.ricePrices[trimmedName]) {
      alert(`Giống lúa "${trimmedName}" đã có trong bảng giá!`);
      return;
    }

    const priceStr = prompt(`Nhập đơn giá thu mua mặc định cho giống "${trimmedName}" (VNĐ/kg):`, '8500');
    const price = parseFloat(priceStr) || 8500;

    this.ricePrices[trimmedName] = price;
    this.saveRicePrices();
    this.renderRicePriceSettings();
    AgriAuth.logActivity('THÊM GIỐNG LÚA', `Thêm giống lúa "${trimmedName}" (${price} đ/kg) cho vụ ${this.selectedSeasonId}`);

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã thêm giống lúa mới: ${trimmedName}`);
    }
  },

  deleteRiceVariety(variety) {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền xóa giống lúa!');
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa giống lúa "${variety}" khỏi bảng giá thu mua của vụ này?`)) return;

    delete this.ricePrices[variety];
    this.saveRicePrices();
    this.renderRicePriceSettings();
    AgriAuth.logActivity('XÓA GIỐNG LÚA', `Xóa giống lúa "${variety}" khỏi vụ ${this.selectedSeasonId}`);

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã xóa giống lúa: ${variety}`);
    }
  },

  saveRicePriceSettings() {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền lưu biểu giá thu mua lúa!');
      return;
    }

    const inputs = document.querySelectorAll('.rice-price-input');
    inputs.forEach(inp => {
      const variety = inp.dataset.variety;
      const val = parseFloat(inp.value) || 8000;
      if (variety) {
        this.ricePrices[variety] = val;
      }
    });

    this.saveRicePrices();
    AgriAuth.logActivity('CẬP NHẬT GIÁ LÚA', `Cập nhật biểu giá thu mua lúa cho vụ ${this.selectedSeasonId}`);
    alert('Đã lưu biểu giá thu mua các giống lúa thành công!');
    if (window.AgriSync) {
      AgriSync.showLiveToast('Đã cập nhật biểu giá thu mua lúa!');
    }
  },

  renderZonesDirectory() {
    const container = document.getElementById('adm-zones-directory-container');
    if (!container) return;

    const zones = AgriData.getZones() || [];
    container.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
        Toàn xã hiện có <strong>${zones.length} Xứ đồng</strong> phân bổ trên các vùng sản xuất.
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; max-height: 180px; overflow-y: auto; padding: 8px; background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: 8px;">
        ${zones.map(z => `
          <span class="badge badge-emerald" style="font-size: 0.78rem;">🌾 ${z.name}</span>
        `).join('')}
      </div>
    `;
  },

  // =========================================================================
  // 4. MODULE 4: DATABASE SAFETY & BACKUP/RESTORE
  // =========================================================================
  renderBackupStats() {
    const kpis = AgriData.getKPIs();
    const sessions = AgriData.getPurchasingSessions();
    const logs = AgriAuth.logs;

    const elPlots = document.getElementById('adm-backup-stat-plots');
    const elFarmers = document.getElementById('adm-backup-stat-farmers');
    const elSessions = document.getElementById('adm-backup-stat-sessions');
    const elLogs = document.getElementById('adm-backup-stat-logs');

    if (elPlots) elPlots.textContent = `${Number(kpis?.total_plots || 1181).toLocaleString('vi-VN')} thửa`;
    if (elFarmers) elFarmers.textContent = `${Number(kpis?.total_farmers || 280).toLocaleString('vi-VN')} hộ`;
    if (elSessions) elSessions.textContent = `${sessions.length} phiên`;
    if (elLogs) elLogs.textContent = `${logs.length} sự kiện`;
  },

  exportFullBackup() {
    const backupData = {
      app: 'AgriGIS Hòa Tiến',
      version: '2.5.0-Enterprise',
      export_time: new Date().toISOString(),
      exported_by: AgriAuth.currentUser ? AgriAuth.currentUser.fullname : 'Admin',
      database: AgriData.data,
      geojson: AgriData.geoJson,
      users: AgriAuth.users,
      permissions: AgriAuth.permissions,
      rice_prices: this.ricePrices,
      audit_logs: AgriAuth.logs
    };

    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `AgriGIS_Backup_HoaTien_${new Date().toISOString().slice(0, 10)}.agrigis_backup`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    AgriAuth.logActivity('SAO LƯU CSDL', 'Xuất bản sao lưu toàn bộ CSDL hệ thống (.agrigis_backup)');
  },

  importBackupFile(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    if (!file) return;

    if (!confirm(`Bạn có chắc chắn muốn KHÔI PHỤC CSDL từ tệp sao lưu "${file.name}"?\n\nDữ liệu hiện tại sẽ được ghi đè bằng phiên bản trong tệp.`)) {
      inputEl.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result);
        if (!backup.database || !backup.geojson) {
          alert('Tệp sao lưu không đúng định dạng chuẩn của AgriGIS!');
          return;
        }

        AgriData.data = backup.database;
        AgriData.geoJson = backup.geojson;
        AgriData.persist();

        if (Array.isArray(backup.users)) {
          AgriAuth.users = backup.users;
          AgriAuth.saveUsers();
        }

        if (backup.permissions) {
          AgriAuth.permissions = backup.permissions;
          AgriAuth.savePermissions();
        }

        if (backup.rice_prices) {
          this.ricePrices = backup.rice_prices;
          this.saveRicePrices();
        }

        if (Array.isArray(backup.audit_logs)) {
          AgriAuth.logs = backup.audit_logs;
          AgriAuth.saveLogs();
        }

        AgriAuth.logActivity('PHỤC HỒI CSDL', `Khôi phục thành công CSDL từ bản sao lưu: ${file.name}`);
        alert('Khôi phục toàn bộ CSDL hệ thống thành công! Trang web sẽ tự làm mới.');
        window.location.reload();
      } catch (err) {
        alert('Lỗi khi đọc tệp sao lưu: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  resetDatabaseToDefault() {
    const code = prompt('CẢNH BÁO NGUY HIỂM: Hành động này sẽ xóa các phiên cân thử nghiệm và phục hồi CSDL về trạng thái ban đầu của HTX.\n\nNhập chữ "HOATIEN" để xác nhận:');
    if (code !== 'HOATIEN') {
      if (code !== null) alert('Mã xác nhận không đúng!');
      return;
    }

    localStorage.removeItem('agrigis_data');
    localStorage.removeItem('agrigis_purchasing_sessions');
    localStorage.removeItem('agrigis_audit_logs');
    localStorage.removeItem('agrigis_users');
    localStorage.removeItem('agrigis_permissions_matrix');

    alert('Đã khôi phục CSDL hệ thống về chuẩn gốc ban đầu!');
    window.location.reload();
  },

  // =========================================================================
  // 5. MODULE 5: AUDIT TRAIL & ACTIVITY LOGS
  // =========================================================================
  renderAuditTable() {
    const tbody = document.getElementById('adm-audit-table-tbody');
    if (!tbody) return;

    const query = (document.getElementById('adm-audit-search-input')?.value || '').toLowerCase().trim();
    let logs = AgriAuth.logs || [];

    if (query) {
      logs = logs.filter(l => 
        (l.action || '').toLowerCase().includes(query) ||
        (l.fullname || '').toLowerCase().includes(query) ||
        (l.details || '').toLowerCase().includes(query) ||
        (l.device || '').toLowerCase().includes(query)
      );
    }

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="center-cell" style="padding: 2rem; color: var(--text-muted);">Chưa có nhật ký hoạt động nào</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.slice(0, 150).map(l => `
      <tr>
        <td style="font-size: 0.82rem; color: var(--text-muted); white-space: nowrap;">${l.timeFormatted || l.time}</td>
        <td><strong>${l.fullname}</strong> <small style="color: var(--text-muted);">(${l.role})</small></td>
        <td><span class="badge badge-emerald">${l.action}</span></td>
        <td>${l.details}</td>
        <td style="font-size: 0.82rem;">${l.device}</td>
      </tr>
    `).join('');
  },

  exportAuditLogsToCSV() {
    const logs = AgriAuth.logs || [];
    if (logs.length === 0) {
      alert('Chưa có nhật ký nào để xuất!');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Thời Gian,Cán Bộ,Vai Trò,Hành Động,Chi Tiết,Thiết Bị\n';

    logs.forEach(l => {
      const row = [
        `"${l.timeFormatted || l.time}"`,
        `"${l.fullname}"`,
        `"${l.role}"`,
        `"${l.action}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        `"${l.device}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NhatKyTruyVet_AgriGIS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // =========================================================================
  // 6. MODULE 6: NEW USER REGISTRATIONS APPROVAL (DUYỆT THÀNH VIÊN MỚI)
  // =========================================================================
  renderPendingApprovalsTable() {
    const tbody = document.getElementById('adm-approvals-table-tbody');
    if (!tbody) return;

    AgriAuth.loadPendingUsers();
    const pending = AgriAuth.pendingUsers || [];
    const isSuperAdmin = this.canManageSeason();

    this.updatePendingCountBadges();

    if (pending.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <div style="font-size: 1.5rem; margin-bottom: 6px;">✨</div>
            <strong>Hiện không có hồ sơ đăng ký mới nào đang chờ duyệt!</strong>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = pending.map((u, idx) => {
      let statusBadge = '<span class="badge badge-warning" style="font-size: 0.72rem;">⏳ Chờ duyệt</span>';
      if (u.status === 'approved') statusBadge = '<span class="badge badge-emerald" style="font-size: 0.72rem;">✓ Đã duyệt</span>';
      if (u.status === 'rejected') statusBadge = '<span class="badge badge-secondary" style="font-size: 0.72rem; color: #ef4444;">✕ Từ chối</span>';

      return `
        <tr>
          <td class="center-cell">${idx + 1}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${u.created_at || 'Mới đăng ký'}</td>
          <td>
            <div style="font-weight: 700; color: var(--text-main);">${u.fullname}</div>
            <div style="font-size: 0.75rem; color: var(--primary);">@${u.username} • PIN: <code>${u.pin}</code></div>
          </td>
          <td>
            <div>📱 <strong>${u.phone}</strong></div>
            <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
              ✉️ ${u.email}
              ${u.email_verified ? '<span title="Email đã xác minh OTP chính chủ" style="color: #10b981; font-size: 0.8rem;">✓</span>' : ''}
            </div>
          </td>
          <td>
            <div style="font-size: 0.82rem;">CCCD: <strong>${u.cccd}</strong></div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${u.to_dan_pho} - ${u.dia_chi}</div>
          </td>
          <td>
            <span class="badge badge-purple" style="font-size: 0.72rem;">${u.requested_role_name || u.requested_role}</span>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Ghi chú: ${u.note || '-'}</div>
          </td>
          <td class="center-cell">
            ${statusBadge}
          </td>
          <td class="center-cell">
            ${u.status === 'pending_approval' ? (
              isSuperAdmin ? `
                <div style="display: flex; gap: 4px; justify-content: center;">
                  <button class="btn btn-sm btn-emerald" style="padding: 3px 8px; font-size: 0.75rem;" onclick="AgriAdmin.openApprovalModal('${u.id}')" title="Phê duyệt và phân quyền cho thành viên này">
                    <i data-lucide="user-check"></i> Duyệt & Kích Hoạt
                  </button>
                  <button class="btn btn-sm btn-outline" style="padding: 3px 6px; font-size: 0.75rem; color: #ef4444;" onclick="AgriAdmin.rejectPendingUser('${u.id}')" title="Từ chối hồ sơ">
                    <i data-lucide="x"></i>
                  </button>
                </div>
              ` : '<span style="font-size: 0.75rem; color: var(--text-muted);">🔒 Chờ Giám Đốc duyệt</span>'
            ) : `
              <button class="btn btn-sm btn-outline" style="padding: 2px 6px; font-size: 0.72rem; color: #64748b;" onclick="AgriAdmin.deletePendingRecord('${u.id}')" title="Xóa dòng này">
                <i data-lucide="trash-2"></i>
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  openApprovalModal(pendingId) {
    AgriAuth.loadPendingUsers();
    const target = AgriAuth.pendingUsers.find(u => u.id === pendingId);
    if (!target) return;

    this.selectedApprovalId = pendingId;
    const modal = document.getElementById('modal-adm-user-approval');
    if (!modal) return;

    document.getElementById('adm-appr-fullname').textContent = target.fullname;
    document.getElementById('adm-appr-username').textContent = `@${target.username}`;
    document.getElementById('adm-appr-phone').textContent = target.phone;
    document.getElementById('adm-appr-email').textContent = target.email;
    document.getElementById('adm-appr-cccd').textContent = target.cccd;
    document.getElementById('adm-appr-address').textContent = `${target.to_dan_pho} - ${target.dia_chi}`;
    document.getElementById('adm-appr-note').textContent = target.note || 'Không có ghi chú';

    const roleSelect = document.getElementById('adm-appr-role');
    if (roleSelect) roleSelect.value = target.requested_role || 'farmer';

    const zonesInput = document.getElementById('adm-appr-zones');
    if (zonesInput) zonesInput.value = (target.requested_zones || ['La Châu']).join(', ');

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeApprovalModal() {
    const modal = document.getElementById('modal-adm-user-approval');
    if (modal) modal.classList.remove('open');
    this.selectedApprovalId = null;
  },

  handleApproveSubmit() {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền phê duyệt hồ sơ thành viên!');
      return;
    }

    if (!this.selectedApprovalId) return;

    AgriAuth.loadPendingUsers();
    const pending = AgriAuth.pendingUsers.find(u => u.id === this.selectedApprovalId);
    if (!pending) return;

    const assignedRole = document.getElementById('adm-appr-role')?.value || 'farmer';
    const assignedZonesStr = document.getElementById('adm-appr-zones')?.value || 'La Châu';
    const assignedZones = assignedZonesStr.split(',').map(s => s.trim()).filter(Boolean);

    const roleNames = {
      director: '👑 Ban Giám Đốc HTX',
      accountant: '💰 Bộ Phận Kế Toán - Thủ Quỹ',
      cadastre: '🗺️ Cán Bộ Địa Chính GIS',
      weighing_staff: '⚖️ Cán Bộ Cân Thu Mua',
      village_head: '🏘️ Ban Điều Hành Tổ Dân Phố',
      farmer: '👨‍🌾 Hộ Nông Dân / Xã Viên'
    };

    const newUser = {
      id: 'usr_' + Date.now(),
      username: pending.username,
      pin: pending.pin || '1234',
      fullname: pending.fullname,
      role: assignedRole,
      roleName: roleNames[assignedRole] || '👨‍🌾 Hộ Nông Dân / Xã Viên',
      cccd: pending.cccd,
      ngay_sinh: pending.ngay_sinh || '1990-01-01',
      gioi_tinh: pending.gioi_tinh || 'Nam',
      dia_chi: pending.dia_chi,
      to_dan_pho: pending.to_dan_pho,
      assigned_zones: assignedZones.length > 0 ? assignedZones : ['Tất cả các xứ đồng'],
      phone: pending.phone,
      email: pending.email,
      ghi_chu: `Đã được Ban Giám Đốc duyệt ngày ${new Date().toLocaleDateString('vi-VN')}. ${pending.note || ''}`,
      date_joined: new Date().toISOString().slice(0, 10),
      active: true,
      status: 'active'
    };

    AgriAuth.users.push(newUser);
    AgriAuth.saveUsers();

    pending.status = 'approved';
    AgriAuth.savePendingUsers();

    // 1. Log activity & trigger activation email dispatch
    AgriAuth.logActivity('DUYỆT_THÀNH_VIÊN', `Ban Giám Đốc đã duyệt và kích hoạt tài khoản ${newUser.fullname} (@${newUser.username}) với vai trò ${newUser.roleName}`);
    if (newUser.email) {
      AgriAuth.logActivity('GỬI_EMAIL_KÍCH_HOẠT', `Đã gửi Email thông báo kích hoạt tài khoản thành công tới ${newUser.email}`);
      console.log(`📧 [AgriGIS Notification] ĐÃ GỬI EMAIL THÔNG BÁO KÍCH HOẠT TÀI KHOẢN TỚI: ${newUser.email}`);
    }

    this.closeApprovalModal();
    this.renderPendingApprovalsTable();
    this.renderUsersTable();
    this.renderKPIsRibbon();
    this.updatePendingCountBadges();

    alert(`🎉 ĐÃ PHÊ DUYỆT & CẤP QUYỀN THÀNH CÔNG!\n\n1. Tài khoản @${newUser.username} của cán bộ "${newUser.fullname}" đã được kích hoạt chính thức với vai trò "${newUser.roleName}".\n2. Hệ thống đã tự động gửi Email thông báo kích hoạt tới: ${newUser.email}.\n3. Cán bộ có thể đăng nhập ngay vào hệ thống bằng Email/SĐT và mã PIN.`);

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã duyệt & gửi email kích hoạt cho: ${newUser.fullname}`);
    }
  },

  rejectPendingUser(pendingId) {
    if (!this.canManageSeason()) {
      alert('Chỉ Ban Giám Đốc HTX mới có quyền từ chối hồ sơ thành viên!');
      return;
    }

    const reason = prompt('Nhập lý do từ chối hồ sơ này (Ví dụ: Thông tin không chính xác, ngoài phạm vi HTX...):', 'Thông tin chưa đầy đủ');
    if (reason === null) return;

    AgriAuth.loadPendingUsers();
    const pending = AgriAuth.pendingUsers.find(u => u.id === pendingId);
    if (!pending) return;

    pending.status = 'rejected';
    pending.note = `Từ chối: ${reason}`;
    AgriAuth.savePendingUsers();

    AgriAuth.logActivity('TỪ_CHỐI_HỒ_SƠ', `Từ chối hồ sơ ${pending.fullname} (@${pending.username}): ${reason}`);

    this.renderPendingApprovalsTable();
    this.renderKPIsRibbon();
    this.updatePendingCountBadges();

    if (window.AgriSync) {
      AgriSync.showLiveToast(`Đã từ chối hồ sơ: ${pending.fullname}`);
    }
  },

  deletePendingRecord(pendingId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bản ghi đăng ký này?')) return;
    AgriAuth.loadPendingUsers();
    AgriAuth.pendingUsers = AgriAuth.pendingUsers.filter(u => u.id !== pendingId);
    AgriAuth.savePendingUsers();
    this.renderPendingApprovalsTable();
    this.renderKPIsRibbon();
    this.updatePendingCountBadges();
  }
};

if (typeof window !== 'undefined') {
  window.AgriAdmin = AgriAdmin;
}
