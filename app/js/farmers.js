/**
 * AGRIGIS FARMERS (HỒ SƠ HỘ NÔNG DÂN) MODULE
 * Tái cấu trúc theo tiêu chuẩn GIS Nông nghiệp:
 * - 2 Chế độ xem: Lưới thẻ hồ sơ (Profile Cards) & Bảng danh bạ tổng hợp (Directory Table)
 * - Bộ lọc đa chiều (Quy mô, Tính chất tích tụ, Tổ dân phố, Xứ đồng) & Live Stats Ribbon
 * - Đầy đủ CRUD (Thêm, Sửa, Xóa) đồng bộ CSDL & localStorage
 * - Modal hồ sơ chuyên sâu: 4 Thẻ chỉ số, Bảng trích lục thửa ruộng có nút bay GIS từng thửa
 * - In Trích Lục Hồ Sơ Nông Hộ & Xuất Danh Bạ Excel / In Sổ Danh Bạ chuẩn A4
 */

const AgriFarmers = {
  currentViewMode: 'table', // 'table' (Mặc định) | 'grid'
  filteredFarmers: [],
  selectedFarmer: null,

  init() {
    this.populateZoneOptions();
    this.bindEvents();
    this.filterFarmers();
  },

  render() {
    this.filterFarmers();
  },

  populateZoneOptions() {
    const zoneSelect = document.getElementById('filter-farmers-zone');
    if (!zoneSelect) return;

    const zones = AgriData.getZones();
    zoneSelect.innerHTML = '<option value="">Tất cả Xứ đồng canh tác (85)</option>' +
      zones.map(z => `<option value="${z.name}">${z.name} (${z.so_ho} hộ - ${z.dt_ha} ha)</option>`).join('');
  },

  bindEvents() {
    const searchInput = document.getElementById('farmers-search');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.filterFarmers(), 250);
      });
    }
  },

  switchViewMode(mode) {
    this.currentViewMode = mode;

    document.querySelectorAll('#tab-farmers .view-switch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === mode);
    });

    const gridView = document.getElementById('farmers-view-grid');
    const tableView = document.getElementById('farmers-view-table');

    if (gridView) gridView.style.display = mode === 'grid' ? 'block' : 'none';
    if (tableView) tableView.style.display = mode === 'table' ? 'block' : 'none';

    this.render();
  },

  filterFarmers() {
    const q = (document.getElementById('farmers-search')?.value || '').toLowerCase().trim();
    const to = document.getElementById('filter-farmers-to')?.value || '';
    const scale = document.getElementById('filter-farmers-scale')?.value || '';
    const tenure = document.getElementById('filter-farmers-tenure')?.value || '';
    const zone = document.getElementById('filter-farmers-zone')?.value || '';

    const allFarmers = AgriData.getFarmers();

    this.filteredFarmers = allFarmers.filter(f => {
      // 1. Text search: Name, Phone, CCCD, Address, Zones
      if (q) {
        const match = (
          (f.name && f.name.toLowerCase().includes(q)) ||
          (f.dien_thoai && f.dien_thoai.toLowerCase().includes(q)) ||
          (f.cccd && f.cccd.toLowerCase().includes(q)) ||
          (f.dia_chi && f.dia_chi.toLowerCase().includes(q)) ||
          (f.xu_dong_list && f.xu_dong_list.some(z => z.toLowerCase().includes(q)))
        );
        if (!match) return false;
      }

      // 2. Filter Tổ dân phố
      if (to && f.dia_chi !== to) return false;

      // 3. Filter Quy mô canh tác
      const area = parseFloat(f.tong_dt) || 0;
      if (scale === 'large' && area < 10000) return false; // > 1ha
      if (scale === 'medium' && (area < 5000 || area >= 10000)) return false; // 0.5 - 1ha
      if (scale === 'small' && area >= 5000) return false; // < 0.5ha

      // 4. Filter Tình trạng đất
      if (tenure === 'owner' && (f.dt_tich_tu > 0 || f.so_thua_thue > 0)) return false;
      if (tenure === 'rent' && f.dt_tich_tu <= 0 && f.so_thua_thue <= 0) return false;

      // 5. Filter Xứ đồng canh tác
      if (zone && (!f.xu_dong_list || !f.xu_dong_list.includes(zone))) return false;

      return true;
    });

    this.updateStatsDisplay();
    this.render();
  },

  resetFilters() {
    const searchInput = document.getElementById('farmers-search');
    const toSelect = document.getElementById('filter-farmers-to');
    const scaleSelect = document.getElementById('filter-farmers-scale');
    const tenureSelect = document.getElementById('filter-farmers-tenure');
    const zoneSelect = document.getElementById('filter-farmers-zone');

    if (searchInput) searchInput.value = '';
    if (toSelect) toSelect.value = '';
    if (scaleSelect) scaleSelect.value = '';
    if (tenureSelect) tenureSelect.value = '';
    if (zoneSelect) zoneSelect.value = '';

    this.filterFarmers();
  },

  updateStatsDisplay() {
    const countEl = document.getElementById('farmers-count-display');
    const areaEl = document.getElementById('farmers-area-display');
    const avgEl = document.getElementById('farmers-avg-display');
    const largeEl = document.getElementById('farmers-large-display');

    const totalFarmers = this.filteredFarmers.length;
    const totalArea = this.filteredFarmers.reduce((sum, f) => sum + (parseFloat(f.tong_dt) || 0), 0);
    const avgArea = totalFarmers > 0 ? Math.round(totalArea / totalFarmers) : 0;
    const largeFarmers = this.filteredFarmers.filter(f => (parseFloat(f.tong_dt) || 0) >= 10000);
    const rentedFarmers = this.filteredFarmers.filter(f => (parseFloat(f.dt_tich_tu) || 0) > 0 || f.so_thua_thue > 0);

    if (countEl) countEl.textContent = `${Number(totalFarmers).toLocaleString('vi-VN')} hộ`;
    if (areaEl) areaEl.textContent = `${(totalArea / 10000).toFixed(2)} ha (${AgriData.formatArea(totalArea)})`;
    if (avgEl) avgEl.textContent = `${AgriData.formatArea(avgArea)} (${(avgArea / 500).toFixed(1)} sào)`;
    if (largeEl) largeEl.textContent = `${largeFarmers.length} hộ (> 1 ha) • ${rentedFarmers.length} hộ tích tụ`;
  },

  render() {
    if (this.currentViewMode === 'grid') {
      this.renderGrid();
    } else {
      this.renderTable();
    }

    if (window.lucide) lucide.createIcons();
  },

  // =========================================================================
  // VIEW 1: FARMERS PROFILE CARDS GRID
  // =========================================================================
  renderGrid() {
    const grid = document.getElementById('farmers-grid');
    if (!grid) return;

    if (this.filteredFarmers.length === 0) {
      grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">Không tìm thấy hộ nông dân phù hợp theo tiêu chí lọc.</p>';
      return;
    }

    grid.innerHTML = this.filteredFarmers.map(f => {
      const initial = f.name.trim().charAt(0);
      const isRenter = (parseFloat(f.dt_tich_tu) || 0) > 0 || f.so_thua_thue > 0;
      const isLarge = (parseFloat(f.tong_dt) || 0) >= 10000;

      let scaleBadge = '<span class="badge badge-blue">Quy mô nhỏ</span>';
      if (isLarge) {
        scaleBadge = '<span class="badge badge-purple" style="font-weight:800;">🌟 Đại điền</span>';
      } else if ((parseFloat(f.tong_dt) || 0) >= 5000) {
        scaleBadge = '<span class="badge badge-emerald">Quy mô vừa</span>';
      }

      return `
        <div class="farmer-card">
          <div class="farmer-top">
            <div class="farmer-avatar-name">
              <div class="farmer-avatar">${initial}</div>
              <div>
                <div class="farmer-name">${f.name}</div>
                <div class="farmer-address">📍 ${f.dia_chi || 'Tổ --'} ${f.tuoi ? `• ${f.tuoi} tuổi` : ''}</div>
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
              ${scaleBadge}
              ${isRenter ? '<span class="badge badge-amber" style="font-size:0.65rem;" title="Có tích tụ / thuê mượn ruộng">Tích tụ</span>' : '<span class="badge badge-emerald" style="font-size:0.65rem;">Chính chủ</span>'}
            </div>
          </div>

          <div class="farmer-metrics-summary">
            <div>
              <div class="f-metric-val text-emerald">${f.dt_ha} ha</div>
              <div class="f-metric-lbl">Tổng diện tích</div>
            </div>
            <div>
              <div class="f-metric-val">${f.so_thua}</div>
              <div class="f-metric-lbl">Số thửa ruộng</div>
            </div>
            <div>
              <div class="f-metric-val text-blue">${f.xu_dong_list ? f.xu_dong_list.length : 0}</div>
              <div class="f-metric-lbl">Xứ đồng</div>
            </div>
          </div>

          <div style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.3;">
            🌾 <strong>Xứ đồng:</strong> ${(f.xu_dong_list || []).slice(0, 3).join(', ')}${(f.xu_dong_list || []).length > 3 ? ` và +${f.xu_dong_list.length - 3} xứ khác` : ''}
          </div>

          <div class="farmer-card-actions">
            <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="AgriFarmers.showDetail('${f.name}')">
              <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Xem Hồ Sơ
            </button>
            ${f.dien_thoai ? `
              <a href="tel:${f.dien_thoai}" class="btn btn-outline btn-sm" title="Gọi ngay: ${f.dien_thoai}">
                <i data-lucide="phone" style="width: 14px; height: 14px;"></i>
              </a>
            ` : ''}
            ${(window.AgriAuth && AgriAuth.canEdit('farmers')) ? `
              <button class="btn btn-outline btn-sm" onclick="AgriFarmers.openEditFarmerModal('${f.name}')" title="Sửa thông tin hộ">
                <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  // =========================================================================
  // VIEW 2: FARMERS DIRECTORY TABLE (DEFAULT)
  // =========================================================================
  renderTable() {
    const tbody = document.getElementById('farmers-table-tbody');
    if (!tbody) return;

    if (this.filteredFarmers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Không tìm thấy hộ nông dân phù hợp theo tiêu chí lọc.</td></tr>';
      return;
    }

    tbody.innerHTML = this.filteredFarmers.map((f, idx) => {
      const initial = f.name.trim().charAt(0);
      const isLarge = (parseFloat(f.tong_dt) || 0) >= 10000;

      let scaleBadge = '<span class="badge badge-blue" style="font-size:0.7rem;">Nhỏ (<0.5ha)</span>';
      if (isLarge) {
        scaleBadge = '<span class="badge badge-purple" style="font-size:0.7rem; font-weight:800;">🌟 Đại điền</span>';
      } else if ((parseFloat(f.tong_dt) || 0) >= 5000) {
        scaleBadge = '<span class="badge badge-emerald" style="font-size:0.7rem;">Vừa (0.5-1ha)</span>';
      }

      const zoneListStr = (f.xu_dong_list || []).slice(0, 2).join(', ') + ((f.xu_dong_list || []).length > 2 ? ` (+${f.xu_dong_list.length - 2})` : '');

      return `
        <tr>
          <td class="center-cell">${idx + 1}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="farmer-avatar" style="width: 28px; height: 28px; font-size: 0.75rem; flex-shrink: 0; background: var(--accent-light); color: var(--accent);">${initial}</div>
              <strong style="color: var(--text-main); cursor: pointer;" onclick="AgriFarmers.showDetail('${f.name}')" title="Xem hồ sơ chi tiết">${f.name}</strong>
            </div>
          </td>
          <td><span class="badge badge-blue">${f.dia_chi || 'Chưa rõ'}</span></td>
          <td>
            ${f.dien_thoai ? `<span style="color: var(--accent); font-weight:600; font-size:0.8rem; display:inline-flex; align-items:center; gap:3px;"><i data-lucide="phone" style="width:11px; height:11px;"></i> ${window.AgriAuth ? AgriAuth.maskPhone(f.dien_thoai) : f.dien_thoai}</span>` : '-'}
          </td>
          <td>
            <div style="font-size: 0.78rem; line-height: 1.25;">
              <div>${window.AgriAuth ? AgriAuth.maskCCCD(f.cccd) : (f.cccd || '-')}</div>
              <small style="color: var(--text-muted);">${f.ngay_sinh || f.nam_sinh || '-'} (${f.gioi_tinh || 'Nam'})</small>
            </div>
          </td>
          <td class="center-cell">
            <span class="badge badge-emerald" style="font-weight: 700;">${f.so_thua}</span>
          </td>
          <td>
            <div style="font-size: 0.78rem;">
              <span style="font-weight: 700; color: var(--primary);">${f.xu_dong_list ? f.xu_dong_list.length : 0} xứ:</span>
              <span style="color: var(--text-muted);">${zoneListStr || '-'}</span>
            </div>
          </td>
          <td class="num-cell">${AgriData.formatArea(f.dt_chinh_chu)}</td>
          <td class="num-cell">
            ${f.dt_tich_tu > 0 ? `<strong style="color: var(--amber);">${AgriData.formatArea(f.dt_tich_tu)}</strong>` : '-'}
          </td>
          <td class="num-cell">
            <strong style="color: var(--primary); font-size: 0.92rem;">${AgriData.formatArea(f.tong_dt)}</strong>
            <small style="color: var(--text-muted); display: block;">${f.dt_ha} ha</small>
          </td>
          <td class="center-cell">${scaleBadge}</td>
          <td class="center-cell">
            <div style="display: inline-flex; gap: 4px;">
              <button class="btn btn-outline btn-sm" onclick="AgriFarmers.showDetail('${f.name}')" title="Xem hồ sơ chi tiết">
                <i data-lucide="eye" style="width: 13px; height: 13px;"></i>
              </button>
              ${(window.AgriAuth && AgriAuth.canEdit('farmers')) ? `
                <button class="btn btn-outline btn-sm" onclick="AgriFarmers.openEditFarmerModal('${f.name}')" title="Sửa thông tin hộ">
                  <i data-lucide="edit-2" style="width: 13px; height: 13px;"></i>
                </button>
              ` : ''}
              ${(window.AgriAuth && AgriAuth.canAdmin('farmers')) ? `
                <button class="btn btn-outline btn-sm" style="color: #ef4444;" onclick="AgriFarmers.deleteFarmer('${f.name}')" title="Xóa hộ này">
                  <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // =========================================================================
  // MODAL: SHOW DETAILED FARMER PROFILE
  // =========================================================================
  showDetail(farmerName) {
    const f = AgriData.findFarmer(farmerName);
    if (!f) {
      alert('Không tìm thấy thông tin hộ nông dân!');
      return;
    }
    this.selectedFarmer = f;

    const modal = document.getElementById('modal-farmer-detail');
    if (!modal) return;

    document.getElementById('modal-farmer-name').textContent = `👨‍🌾 Hộ Canh Tác: ${f.name}`;
    document.getElementById('modal-farmer-address').textContent = `${f.dia_chi || 'Tổ --'} - Xã Hòa Tiến, Đà Nẵng`;
    document.getElementById('modal-farmer-phone').textContent = f.dien_thoai ? `SĐT: ${f.dien_thoai}` : 'SĐT: Chưa cập nhật';
    document.getElementById('modal-farmer-cccd').textContent = f.cccd ? `CCCD: ${f.cccd}` : 'CCCD: Chưa cập nhật';
    document.getElementById('modal-farmer-age').textContent = f.ngay_sinh ? `Sinh ngày: ${f.ngay_sinh} (${f.tuoi || ''} tuổi)` : (f.nam_sinh ? `Năm sinh: ${f.nam_sinh}` : 'Năm sinh: Chưa rõ');
    document.getElementById('modal-farmer-gender').textContent = `Giới tính: ${f.gioi_tinh || 'Nam'}`;

    const isLarge = (parseFloat(f.tong_dt) || 0) >= 10000;
    const scaleTxt = isLarge ? '🌟 Hộ Đại Điền (> 1 ha)' : ((parseFloat(f.tong_dt) || 0) >= 5000 ? '🌾 Hộ Quy Mô Vừa' : '🌱 Hộ Quy Mô Nhỏ');
    document.getElementById('modal-farmer-scale-badge').textContent = scaleTxt;

    // 4 Summary Metrics
    document.getElementById('modal-farmer-area').textContent = `${AgriData.formatArea(f.tong_dt)} (${f.dt_ha} ha)`;
    document.getElementById('modal-farmer-plots-count').textContent = `${f.so_thua} thửa đất`;
    document.getElementById('modal-farmer-rent-ratio').textContent = `${AgriData.formatArea(f.dt_chinh_chu)} / ${AgriData.formatArea(f.dt_tich_tu)}`;
    document.getElementById('modal-farmer-zones-count').textContent = `${f.xu_dong_list ? f.xu_dong_list.length : 0} xứ đồng`;

    // Phone call link
    const callBtn = document.getElementById('btn-farmer-call');
    if (callBtn) {
      if (f.dien_thoai) {
        callBtn.style.display = 'inline-flex';
        callBtn.href = `tel:${f.dien_thoai}`;
      } else {
        callBtn.style.display = 'none';
      }
    }

    // Render list of all plots of this farmer
    const farmerPlots = AgriData.findPlotsByFarmer(f.name);
    const badgeCountEl = document.getElementById('modal-farmer-plots-badge');
    if (badgeCountEl) badgeCountEl.textContent = `${farmerPlots.length} thửa (${AgriData.formatArea(f.tong_dt)})`;

    const tbody = document.getElementById('modal-farmer-plots-tbody');
    if (tbody) {
      if (farmerPlots.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">Hộ này chưa có thông tin thửa ruộng chi tiết.</td></tr>';
      } else {
        tbody.innerHTML = farmerPlots.map(p => {
          const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
          const tenureBadge = isRented 
            ? '<span class="badge badge-amber" style="font-size:0.68rem;">🔄 Thuê mượn</span>' 
            : '<span class="badge badge-emerald" style="font-size:0.68rem;">✅ Chính chủ</span>';

          return `
            <tr>
              <td><strong>#${p.stt}</strong></td>
              <td><strong style="color: var(--primary);">${p.xu_dong}</strong></td>
              <td>${p.chu_ruong || '-'}</td>
              <td>${p.quy_1 > 0 ? Number(p.quy_1).toLocaleString('vi-VN') : '-'}</td>
              <td>${p.quy_2 > 0 ? Number(p.quy_2).toLocaleString('vi-VN') : '-'}</td>
              <td><strong style="color: var(--text-main); font-size: 0.88rem;">${Number(p.tong_dt).toLocaleString('vi-VN')} m²</strong></td>
              <td>${tenureBadge}</td>
              <td style="text-align: center;">
                <button class="btn btn-outline btn-sm" onclick="AgriFarmers.locatePlotFromModal('${p.xu_dong}')" title="Bay đến trên Bản đồ GIS">
                  <i data-lucide="map-pin" style="width: 12px; height: 12px;"></i> Bản đồ
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeDetailModal() {
    const modal = document.getElementById('modal-farmer-detail');
    if (modal) modal.classList.remove('open');
  },

  editCurrentFarmer() {
    if (!this.selectedFarmer) return;
    this.closeDetailModal();
    this.openEditFarmerModal(this.selectedFarmer.name);
  },

  locatePlotFromModal(zoneName) {
    this.closeDetailModal();
    App.switchTab('tab-map');
    setTimeout(() => {
      AgriMap.flyToZone(zoneName);
    }, 200);
  },

  locateAllFarmerPlots() {
    if (!this.selectedFarmer) return;
    const zones = this.selectedFarmer.xu_dong_list;
    if (zones && zones.length > 0) {
      this.closeDetailModal();
      App.switchTab('tab-map');
      setTimeout(() => {
        AgriMap.flyToZone(zones[0]);
      }, 200);
    } else {
      alert('Hộ này chưa có vị trí vùng sản xuất trên bản đồ!');
    }
  },

  // =========================================================================
  // CRUD OPERATIONS (THÊM / SỬA / XÓA HỒ SƠ HỘ NÔNG DÂN)
  // =========================================================================
  openAddFarmerModal() {
    if (window.AgriAuth && !AgriAuth.canEdit('farmers')) {
      alert('Tài khoản của bạn chỉ có quyền XEM hồ sơ nông dân. Không thể thêm mới hộ!');
      return;
    }
    document.getElementById('modal-farmer-crud-title').textContent = 'Thêm Hồ Sơ Hộ Nông Dân Mới';
    document.getElementById('modal-farmer-crud-sub').textContent = 'Tạo hồ sơ và nhập vào danh bạ sản xuất HTX';
    document.getElementById('farmer-crud-old-name').value = '';
    document.getElementById('farmer-crud-name').value = '';
    document.getElementById('farmer-crud-birth').value = '';
    document.getElementById('farmer-crud-gender').value = 'Nam';
    document.getElementById('farmer-crud-cccd').value = '';
    document.getElementById('farmer-crud-phone').value = '';
    document.getElementById('farmer-crud-to').value = 'Tổ 1';

    const modal = document.getElementById('modal-farmer-crud');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  openEditFarmerModal(farmerName) {
    if (window.AgriAuth && !AgriAuth.canEdit('farmers')) {
      alert('Tài khoản của bạn chỉ có quyền XEM hồ sơ nông dân. Không thể chỉnh sửa hồ sơ!');
      return;
    }
    const f = AgriData.findFarmer(farmerName);
    if (!f) {
      alert('Không tìm thấy thông tin hộ nông dân!');
      return;
    }

    document.getElementById('modal-farmer-crud-title').textContent = `Chỉnh Sửa Hồ Sơ: ${f.name}`;
    document.getElementById('modal-farmer-crud-sub').textContent = `Quy mô: ${f.dt_ha} ha (${f.so_thua} thửa đất)`;
    document.getElementById('farmer-crud-old-name').value = f.name;
    document.getElementById('farmer-crud-name').value = f.name;
    document.getElementById('farmer-crud-birth').value = f.ngay_sinh || f.nam_sinh || '';
    document.getElementById('farmer-crud-gender').value = f.gioi_tinh || 'Nam';
    document.getElementById('farmer-crud-cccd').value = f.cccd || '';
    document.getElementById('farmer-crud-phone').value = f.dien_thoai || '';
    document.getElementById('farmer-crud-to').value = f.dia_chi || 'Tổ 1';

    const modal = document.getElementById('modal-farmer-crud');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeCrudModal() {
    const modal = document.getElementById('modal-farmer-crud');
    if (modal) modal.classList.remove('open');
  },

  saveFarmerModal() {
    if (window.AgriAuth && !AgriAuth.canEdit('farmers')) {
      alert('Tài khoản của bạn chỉ có quyền XEM hồ sơ nông dân. Không thể lưu thay đổi!');
      return;
    }
    const oldName = document.getElementById('farmer-crud-old-name').value.trim();
    const name = document.getElementById('farmer-crud-name').value.trim();
    const birth = document.getElementById('farmer-crud-birth').value.trim();
    const gender = document.getElementById('farmer-crud-gender').value;
    const cccd = document.getElementById('farmer-crud-cccd').value.trim();
    const phone = document.getElementById('farmer-crud-phone').value.trim();
    const to = document.getElementById('farmer-crud-to').value;

    if (!name) {
      alert('Vui lòng nhập Họ và Tên Hộ nông dân!');
      return;
    }

    const farmerObj = {
      name: name,
      dia_chi: to,
      dien_thoai: phone,
      cccd: cccd,
      ngay_sinh: birth,
      gioi_tinh: gender
    };

    if (oldName) {
      // Update existing
      AgriData.updateFarmer(oldName, farmerObj);
      alert(`Đã cập nhật thành công hồ sơ hộ ${name}!`);
    } else {
      // Add new
      AgriData.addFarmer(farmerObj);
      alert(`Đã thêm mới thành công hồ sơ hộ ${name}!`);
    }

    this.closeCrudModal();
    this.filterFarmers();

    // Re-render other tabs
    if (window.AgriPlots && AgriPlots.filterPlots) AgriPlots.filterPlots();
    if (window.AgriAnalytics && AgriAnalytics.renderCharts) AgriAnalytics.renderCharts();
  },

  deleteFarmer(farmerName) {
    if (window.AgriAuth && !AgriAuth.canAdmin('farmers')) {
      alert('Chỉ Quản trị viên mới có quyền XÓA hồ sơ hộ nông dân khỏi hệ thống!');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn XÓA hồ sơ hộ nông dân "${farmerName}" không? Lưu ý: Mọi thửa ruộng gắn với hộ này sẽ được cập nhật lại.`)) {
      return;
    }

    const success = AgriData.deleteFarmer(farmerName);
    if (success) {
      alert(`Đã xóa hồ sơ hộ "${farmerName}" thành công!`);
      this.filterFarmers();
      if (window.AgriPlots && AgriPlots.filterPlots) AgriPlots.filterPlots();
      if (window.AgriAnalytics && AgriAnalytics.renderCharts) AgriAnalytics.renderCharts();
    }
  },

  // =========================================================================
  // EXPORT CSV & PRINTABLE DIRECTORY / CERTIFICATE
  // =========================================================================
  exportToExcel() {
    const farmers = this.filteredFarmers.length > 0 ? this.filteredFarmers : AgriData.getFarmers();
    if (farmers.length === 0) {
      alert('Không có dữ liệu để xuất Excel!');
      return;
    }

    let csvContent = '\uFEFF';
    csvContent += 'STT,Họ và Tên Hộ,Năm Sinh,Giới Tính,CCCD,Điện Thoại,Tổ Dân Phố,Số Thửa,Số Xứ Đồng,Chính Chủ (m2),Tích Tụ (m2),Tổng Diện Tích (m2),Diện Tích (ha),Phân Loại Quy Mô\n';

    farmers.forEach((f, idx) => {
      const isLarge = (parseFloat(f.tong_dt) || 0) >= 10000;
      const scaleTxt = isLarge ? 'Đại điền (> 1ha)' : ((parseFloat(f.tong_dt) || 0) >= 5000 ? 'Quy mô vừa' : 'Quy mô nhỏ');
      const row = [
        idx + 1,
        `"${(f.name || '').replace(/"/g, '""')}"`,
        `"${f.ngay_sinh || f.nam_sinh || ''}"`,
        `"${f.gioi_tinh || 'Nam'}"`,
        `"${f.cccd || ''}"`,
        `"${f.dien_thoai || ''}"`,
        `"${f.dia_chi || ''}"`,
        f.so_thua || 0,
        f.xu_dong_list ? f.xu_dong_list.length : 0,
        f.dt_chinh_chu || 0,
        f.dt_tich_tu || 0,
        f.tong_dt || 0,
        f.dt_ha || 0,
        `"${scaleTxt}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Danh_Ba_Ho_Nong_Dan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  printDirectory() {
    const farmers = this.filteredFarmers.length > 0 ? this.filteredFarmers : AgriData.getFarmers();
    const totalArea = farmers.reduce((s, f) => s + (parseFloat(f.tong_dt) || 0), 0);

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sổ Danh Bạ Hộ Nông Dân - HTX Nông Nghiệp</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; font-size: 13px; line-height: 1.3; }
          .header-box { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .title { text-align: center; font-size: 18px; font-weight: bold; margin: 15px 0 5px; text-transform: uppercase; }
          .sub { text-align: center; font-style: italic; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 5px 6px; text-align: left; }
          th { background: #f0f0f0; text-align: center; font-weight: bold; }
          .num { text-align: right; }
          .center { text-align: center; }
          .footer-box { margin-top: 30px; display: flex; justify-content: space-between; text-align: center; }
          @media print { @page { size: A4 landscape; margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="text-align: center;">
            <strong>UBND HUYỆN HÒA VANG</strong><br>
            <strong>HTX DỊCH VỤ SẢN XUẤT NÔNG NGHIỆP</strong><br>
            <em>Xã Hòa Tiến - TP. Đà Nẵng</em>
          </div>
          <div style="text-align: center;">
            <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
            <strong>Độc lập - Tự do - Hạnh phúc</strong><br>
            <em>---o0o---</em>
          </div>
        </div>

        <div class="title">DANH BẠ QUẢN LÝ HỘ NÔNG DÂN & QUY MÔ SẢN XUẤT</div>
        <div class="sub">Tổng số: <strong>${farmers.length}</strong> hộ nông dân • Tổng diện tích canh tác: <strong>${AgriData.formatArea(totalArea)}</strong> (${(totalArea/10000).toFixed(2)} ha) • Bình quân: <strong>${AgriData.formatArea(Math.round(totalArea/farmers.length))}</strong>/hộ</div>

        <table>
          <thead>
            <tr>
              <th width="40">STT</th>
              <th>Họ và Tên Hộ</th>
              <th>Năm Sinh / Giới Tính</th>
              <th>CCCD</th>
              <th>Điện Thoại</th>
              <th>Địa Bàn</th>
              <th>Số Thửa</th>
              <th>Số Xứ Đồng</th>
              <th>Chính Chủ (m²)</th>
              <th>Tích Tụ (m²)</th>
              <th>Tổng DT (m²)</th>
              <th>Quy Mô</th>
            </tr>
          </thead>
          <tbody>
            ${farmers.map((f, idx) => {
              const isLarge = (parseFloat(f.tong_dt) || 0) >= 10000;
              const scaleTxt = isLarge ? 'Đại điền (>1ha)' : ((parseFloat(f.tong_dt) || 0) >= 5000 ? 'Vừa' : 'Nhỏ');
              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td><strong>${f.name}</strong></td>
                  <td class="center">${f.ngay_sinh || f.nam_sinh || '-'} (${f.gioi_tinh || 'Nam'})</td>
                  <td class="center">${f.cccd || '-'}</td>
                  <td class="center">${f.dien_thoai || '-'}</td>
                  <td class="center">${f.dia_chi || '-'}</td>
                  <td class="center"><strong>${f.so_thua}</strong></td>
                  <td class="center">${f.xu_dong_list ? f.xu_dong_list.length : 0}</td>
                  <td class="num">${AgriData.formatArea(f.dt_chinh_chu)}</td>
                  <td class="num">${f.dt_tich_tu > 0 ? AgriData.formatArea(f.dt_tich_tu) : '-'}</td>
                  <td class="num"><strong>${AgriData.formatArea(f.tong_dt)}</strong></td>
                  <td class="center">${scaleTxt}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer-box">
          <div>
            <strong>NGƯỜI LẬP BIỂU</strong><br>
            <em>(Ký, ghi rõ họ tên)</em>
          </div>
          <div>
            <strong>KẾ TOÁN TRƯỞNG</strong><br>
            <em>(Ký, ghi rõ họ tên)</em>
          </div>
          <div>
            <em>Hòa Tiến, ngày ..... tháng ..... năm 2026</em><br>
            <strong>CHỦ TỊCH HỘI ĐỒNG QUẢN TRỊ / GIÁM ĐỐC</strong><br>
            <em>(Ký tên, đóng dấu)</em>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  },

  printFarmerCertificate() {
    if (!this.selectedFarmer) return;
    const f = this.selectedFarmer;
    const plots = AgriData.findPlotsByFarmer(f.name);

    const printWin = window.open('', '_blank', 'width=900,height=850');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trích Lục Hồ Sơ Canh Tác Nông Hộ - ${f.name}</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 25px; color: #000; font-size: 13px; line-height: 1.4; }
          .header-box { display: flex; justify-content: space-between; margin-bottom: 20px; }
          .title { text-align: center; font-size: 17px; font-weight: bold; margin: 15px 0 5px; text-transform: uppercase; }
          .profile-box { border: 1px solid #000; padding: 12px; margin: 15px 0; border-radius: 4px; }
          .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
          th { background: #f0f0f0; text-align: center; font-weight: bold; }
          .num { text-align: right; }
          .center { text-align: center; }
          .footer-box { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
          @media print { @page { size: A4 portrait; margin: 15mm; } }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="text-align: center;">
            <strong>UBND HUYỆN HÒA VANG</strong><br>
            <strong>HTX DỊCH VỤ SẢN XUẤT NÔNG NGHIỆP</strong><br>
            <em>Xã Hòa Tiến - TP. Đà Nẵng</em>
          </div>
          <div style="text-align: center;">
            <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
            <strong>Độc lập - Tự do - Hạnh phúc</strong><br>
            <em>---o0o---</em>
          </div>
        </div>

        <div class="title">TRÍCH LỤC HỒ SƠ QUY MÔ CANH TÁC NÔNG HỘ</div>

        <div class="profile-box">
          <div class="profile-grid">
            <div><strong>Họ và tên chủ hộ:</strong> ${f.name}</div>
            <div><strong>Địa bàn cư trú:</strong> ${f.dia_chi || 'Tổ --'} - Xã Hòa Tiến</div>
            <div><strong>Số CCCD/CMND:</strong> ${f.cccd || 'Chưa cập nhật'}</div>
            <div><strong>Số điện thoại:</strong> ${f.dien_thoai || 'Chưa cập nhật'}</div>
            <div><strong>Năm sinh:</strong> ${f.ngay_sinh || f.nam_sinh || 'Chưa rõ'} (Giới tính: ${f.gioi_tinh || 'Nam'})</div>
            <div><strong>Tổng số thửa đất:</strong> ${f.so_thua} thửa (Phân bố trên ${f.xu_dong_list ? f.xu_dong_list.length : 0} xứ đồng)</div>
          </div>
          <div style="margin-top: 8px; border-top: 1px dashed #999; padding-top: 6px;">
            <strong>Tổng diện tích canh tác:</strong> <span style="font-size: 15px; font-weight: bold;">${AgriData.formatArea(f.tong_dt)}</span> (${f.dt_ha} ha ~ ${(f.tong_dt/500).toFixed(1)} sào Trung Bộ)
            <br>• Đất chính chủ: <strong>${AgriData.formatArea(f.dt_chinh_chu)}</strong> • Đất nhận tích tụ / thuê mượn: <strong>${AgriData.formatArea(f.dt_tich_tu)}</strong>
          </div>
        </div>

        <h4 style="margin: 15px 0 5px; text-transform: uppercase;">Chi tiết các thửa ruộng đang trực tiếp sản xuất:</h4>
        <table>
          <thead>
            <tr>
              <th width="40">STT</th>
              <th>Số Thửa</th>
              <th>Xứ Đồng</th>
              <th>Chủ Đứng Tên Ruộng</th>
              <th>Quỹ 1 (m²)</th>
              <th>Quỹ 2 (m²)</th>
              <th>Tổng DT (m²)</th>
              <th>Tình Trạng</th>
            </tr>
          </thead>
          <tbody>
            ${plots.map((p, idx) => {
              const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td class="center"><strong>#${p.stt}</strong></td>
                  <td><strong>${p.xu_dong}</strong></td>
                  <td>${p.chu_ruong || '-'}</td>
                  <td class="num">${p.quy_1 > 0 ? Number(p.quy_1).toLocaleString('vi-VN') : '-'}</td>
                  <td class="num">${p.quy_2 > 0 ? Number(p.quy_2).toLocaleString('vi-VN') : '-'}</td>
                  <td class="num"><strong>${Number(p.tong_dt).toLocaleString('vi-VN')}</strong></td>
                  <td class="center">${isRented ? 'Thuê mượn' : 'Chính chủ'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer-box">
          <div>
            <strong>CHỦ HỘ NÔNG DÂN</strong><br>
            <em>(Ký, ghi rõ họ tên)</em><br><br><br>
            <strong>${f.name}</strong>
          </div>
          <div>
            <em>Hòa Tiến, ngày ..... tháng ..... năm 2026</em><br>
            <strong>CHỦ TỊCH HỘI ĐỒNG QUẢN TRỊ / GIÁM ĐỐC HTX</strong><br>
            <em>(Ký tên, đóng dấu)</em>
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  }
};

// Global helper for modal close
function closeFarmerModal() {
  AgriFarmers.closeDetailModal();
}

// Expose globally
window.AgriFarmers = AgriFarmers;
