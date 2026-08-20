/**
 * AGRIGIS PLOTS (SỔ BỘ THỬA RUỘNG) MODULE
 * Tái cấu trúc theo tiêu chuẩn GIS Nông nghiệp:
 * - 3 Chế độ xem: Từng thửa (Flat Table), Gom theo Xứ đồng (By Zone), Gom theo Hộ SX (By Farmer)
 * - Bộ lọc đa chiều khoa học & Thanh chỉ số KPI tức thời
 * - Đầy đủ CRUD (Thêm, Sửa, Xóa) đồng bộ CSDL & localStorage
 * - Liên kết không gian GIS FlyTo
 * - Xuất CSV/Excel & In Sổ Mục Kê chuẩn A4
 */

const AgriPlots = {
  currentPage: 1,
  pageSize: 25,
  currentViewMode: 'flat', // 'flat' | 'zone' | 'farmer'
  filteredPlots: [],

  init() {
    this.populateZoneOptions();
    this.bindEvents();
    this.filterPlots();
  },

  render() {
    this.filterPlots();
  },

  populateZoneOptions() {
    const filterSelect = document.getElementById('filter-xu-dong');
    const formSelect = document.getElementById('plot-form-xu-dong');

    const zones = AgriData.getZones();
    const optionsHtml = zones.map(z => 
      `<option value="${z.name}">${z.name} (${z.so_thua} thửa - ${z.dt_ha} ha)</option>`
    ).join('');

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Tất cả Xứ đồng (85)</option>' + optionsHtml;
    }
    if (formSelect) {
      formSelect.innerHTML = optionsHtml;
    }
  },

  bindEvents() {
    const searchInput = document.getElementById('plots-search');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.filterPlots(), 250);
      });
    }
  },

  switchViewMode(mode) {
    this.currentViewMode = mode;

    // Update buttons active class
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === mode);
    });

    // Toggle view containers
    const flatView = document.getElementById('plots-view-flat');
    const zoneView = document.getElementById('plots-view-zone');
    const farmerView = document.getElementById('plots-view-farmer');

    if (flatView) flatView.style.display = mode === 'flat' ? 'block' : 'none';
    if (zoneView) zoneView.style.display = mode === 'zone' ? 'block' : 'none';
    if (farmerView) farmerView.style.display = mode === 'farmer' ? 'block' : 'none';

    this.render();
  },

  filterPlots() {
    const q = (document.getElementById('plots-search')?.value || '').toLowerCase().trim();
    const to = document.getElementById('filter-to')?.value || '';
    const xuDong = document.getElementById('filter-xu-dong')?.value || '';
    const loaiDat = document.getElementById('filter-loai-dat')?.value || '';
    const tenure = document.getElementById('filter-tenure')?.value || '';
    const scale = document.getElementById('filter-scale')?.value || '';

    const allPlots = AgriData.getPlots();

    this.filteredPlots = allPlots.filter(p => {
      // 1. Text Search across: Hộ SX, Chủ ruộng, Số thửa, Xứ đồng, CCCD, SĐT
      if (q) {
        const matchText = (
          (p.ho_sx && p.ho_sx.toLowerCase().includes(q)) ||
          (p.chu_ruong && p.chu_ruong.toLowerCase().includes(q)) ||
          (p.xu_dong && p.xu_dong.toLowerCase().includes(q)) ||
          (p.stt && String(p.stt).toLowerCase().includes(q)) ||
          (p.cccd && p.cccd.toLowerCase().includes(q)) ||
          (p.dien_thoai && p.dien_thoai.toLowerCase().includes(q)) ||
          (p.dia_chi && p.dia_chi.toLowerCase().includes(q))
        );
        if (!matchText) return false;
      }

      // 2. Filter Tổ dân phố
      if (to && p.dia_chi !== to) return false;

      // 3. Filter Xứ đồng
      if (xuDong && p.xu_dong !== xuDong) return false;

      // 4. Filter Loại đất
      if (loaiDat === 'quy1' && (parseFloat(p.quy_1) || 0) <= 0) return false;
      if (loaiDat === 'quy2' && (parseFloat(p.quy_2) || 0) <= 0) return false;
      if (loaiDat === 'khac' && (parseFloat(p.quy_khac) || 0) <= 0) return false;

      // 5. Filter Tình trạng canh tác (Tenure)
      if (tenure === 'owner' && p.is_rented) return false;
      if (tenure === 'rented' && !p.is_rented) return false;

      // 6. Filter Quy mô diện tích
      const dt = parseFloat(p.tong_dt) || 0;
      if (scale === 'small' && dt >= 500) return false;
      if (scale === 'medium' && (dt < 500 || dt > 1000)) return false;
      if (scale === 'large' && dt <= 1000) return false;

      return true;
    });

    this.currentPage = 1;
    this.updateStatsDisplay();
    this.render();
  },

  resetFilters() {
    const searchInput = document.getElementById('plots-search');
    const toSelect = document.getElementById('filter-to');
    const xuDongSelect = document.getElementById('filter-xu-dong');
    const loaiDatSelect = document.getElementById('filter-loai-dat');
    const tenureSelect = document.getElementById('filter-tenure');
    const scaleSelect = document.getElementById('filter-scale');

    if (searchInput) searchInput.value = '';
    if (toSelect) toSelect.value = '';
    if (xuDongSelect) xuDongSelect.value = '';
    if (loaiDatSelect) loaiDatSelect.value = '';
    if (tenureSelect) tenureSelect.value = '';
    if (scaleSelect) scaleSelect.value = '';

    this.filterPlots();
  },

  updateStatsDisplay() {
    const countEl = document.getElementById('plots-count-display');
    const areaEl = document.getElementById('plots-area-display');
    const fundsEl = document.getElementById('plots-funds-display');
    const rentedEl = document.getElementById('plots-rented-display');

    const totalCount = this.filteredPlots.length;
    const totalArea = this.filteredPlots.reduce((sum, p) => sum + (parseFloat(p.tong_dt) || 0), 0);
    const totalQ1 = this.filteredPlots.reduce((sum, p) => sum + (parseFloat(p.quy_1) || 0), 0);
    const totalQ2 = this.filteredPlots.reduce((sum, p) => sum + (parseFloat(p.quy_2) || 0), 0);
    const rentedPlots = this.filteredPlots.filter(p => p.is_rented);
    const rentedArea = rentedPlots.reduce((sum, p) => sum + (parseFloat(p.tong_dt) || 0), 0);

    if (countEl) countEl.textContent = `${Number(totalCount).toLocaleString('vi-VN')} thửa`;
    if (areaEl) areaEl.textContent = `${AgriData.formatArea(totalArea)} (${(totalArea / 10000).toFixed(2)} ha)`;
    if (fundsEl) fundsEl.textContent = `Q1: ${AgriData.formatArea(totalQ1)} | Q2: ${AgriData.formatArea(totalQ2)}`;
    if (rentedEl) rentedEl.textContent = `${rentedPlots.length} thửa (${AgriData.formatArea(rentedArea)})`;
  },

  changePageSize(val) {
    this.pageSize = val === 'all' ? 'all' : parseInt(val, 10);
    this.currentPage = 1;
    this.render();
  },

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.render();
    }
  },

  nextPage() {
    const totalPages = this.pageSize === 'all' ? 1 : Math.ceil(this.filteredPlots.length / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.render();
    }
  },

  render() {
    if (this.currentViewMode === 'flat') {
      this.renderFlatTable();
    } else if (this.currentViewMode === 'zone') {
      this.renderGroupedByZone();
    } else if (this.currentViewMode === 'farmer') {
      this.renderGroupedByFarmer();
    }

    if (window.lucide) lucide.createIcons();
  },

  // =========================================================================
  // VIEW 1: FLAT TABLE (DANH SÁCH TỪNG THỬA)
  // =========================================================================
  renderFlatTable() {
    let pageData = this.filteredPlots;
    let totalPages = 1;

    if (this.pageSize !== 'all') {
      const start = (this.currentPage - 1) * this.pageSize;
      const end = start + this.pageSize;
      pageData = this.filteredPlots.slice(start, end);
      totalPages = Math.ceil(this.filteredPlots.length / this.pageSize) || 1;
    }

    // Pagination controls
    const pageInfo = document.getElementById('plots-page-info');
    if (pageInfo) pageInfo.textContent = `Trang ${this.currentPage} / ${totalPages}`;

    const prevBtn = document.getElementById('plots-prev');
    const nextBtn = document.getElementById('plots-next');
    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;

    // Desktop Table Body
    const tbody = document.getElementById('plots-tbody');
    if (tbody) {
      if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Không tìm thấy thửa ruộng phù hợp theo tiêu chí lọc.</td></tr>';
      } else {
        tbody.innerHTML = pageData.map(p => {
          const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
          const tenureBadge = isRented
            ? `<span class="badge badge-amber" style="font-size: 0.68rem;" title="Đất nhận tích tụ / thuê mượn">🔄 Thuê mượn</span>`
            : `<span class="badge badge-emerald" style="font-size: 0.68rem;" title="Đất chính chủ">✅ Chính chủ</span>`;

          const plotId = p.id || p.stt;

          return `
            <tr>
              <td><span class="badge badge-emerald" style="font-weight:800;">#${p.stt}</span></td>
              <td>
                <strong style="color: var(--text-main); cursor: pointer;" onclick="AgriFarmers.showDetail('${p.ho_sx}')" title="Xem hồ sơ hộ">${p.ho_sx}</strong>
              </td>
              <td>
                <span style="color: var(--text-muted); font-size: 0.82rem;">${p.chu_ruong || '-'}</span>
                <div style="margin-top: 2px;">${tenureBadge}</div>
              </td>
              <td>
                <strong style="color: var(--primary); cursor: pointer;" onclick="AgriPlots.locatePlotOnMap('${p.xu_dong}')" title="Xem vị trí xứ đồng">${p.xu_dong}</strong>
              </td>
              <td>${p.quy_1 > 0 ? Number(p.quy_1).toLocaleString('vi-VN') : '-'}</td>
              <td>${p.quy_2 > 0 ? Number(p.quy_2).toLocaleString('vi-VN') : '-'}</td>
              <td><strong style="color: var(--text-main); font-size: 0.9rem;">${Number(p.tong_dt).toLocaleString('vi-VN')}</strong></td>
              <td><span class="badge badge-blue">${p.dia_chi || 'Chưa rõ'}</span></td>
              <td>
                ${p.dien_thoai ? `<a href="tel:${p.dien_thoai}" style="color: var(--accent); text-decoration: none; font-size: 0.78rem; font-weight:600;"><i data-lucide="phone" style="width:11px; height:11px;"></i> ${p.dien_thoai}</a>` : '-'}
              </td>
              <td style="text-align: center;">
                <div style="display: inline-flex; gap: 4px;">
                  <button class="btn btn-outline btn-sm" onclick="AgriPlots.locatePlotOnMap('${p.xu_dong}')" title="Xem trên Bản đồ GIS">
                    <i data-lucide="map-pin" style="width: 13px; height: 13px;"></i>
                  </button>
                  ${(window.AgriAuth && AgriAuth.canEdit('plots')) ? `
                    <button class="btn btn-outline btn-sm" onclick="AgriPlots.openEditPlotModal('${plotId}')" title="Sửa thửa này">
                      <i data-lucide="edit-2" style="width: 13px; height: 13px;"></i>
                    </button>
                  ` : ''}
                  ${(window.AgriAuth && AgriAuth.canAdmin('plots')) ? `
                    <button class="btn btn-outline btn-sm" style="color: #ef4444;" onclick="AgriPlots.deletePlot('${plotId}')" title="Xóa thửa này">
                      <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Mobile Cards View
    const mobileList = document.getElementById('plots-mobile-list');
    if (mobileList) {
      if (pageData.length === 0) {
        mobileList.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Không tìm thấy thửa ruộng nào.</p>';
      } else {
        mobileList.innerHTML = pageData.map(p => {
          const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
          const plotId = p.id || p.stt;
          return `
            <div class="plot-card-mobile" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span class="badge badge-emerald">Thửa #${p.stt}</span>
                <strong style="color: var(--primary); font-size: 1.05rem;">${Number(p.tong_dt).toLocaleString('vi-VN')} m²</strong>
              </div>
              <div style="margin-bottom: 6px;">
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);" onclick="AgriFarmers.showDetail('${p.ho_sx}')">👨‍🌾 ${p.ho_sx}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  Chủ quyền: ${p.chu_ruong} ${isRented ? '<span class="badge badge-amber" style="font-size:0.65rem;">Thuê/Mượn</span>' : '<span class="badge badge-emerald" style="font-size:0.65rem;">Chính chủ</span>'}
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; background: var(--bg-app); padding: 6px 10px; border-radius: var(--radius-sm);">
                <span>🌾 <strong>${p.xu_dong}</strong> (${p.dia_chi || 'Tổ --'})</span>
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-outline btn-sm" onclick="AgriPlots.locatePlotOnMap('${p.xu_dong}')"><i data-lucide="map-pin"></i></button>
                  <button class="btn btn-outline btn-sm" onclick="AgriPlots.openEditPlotModal('${plotId}')"><i data-lucide="edit-2"></i></button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  },

  // =========================================================================
  // VIEW 2: GROUPED BY ZONE (GOM THEO XỨ ĐỒNG)
  // =========================================================================
  renderGroupedByZone() {
    const listEl = document.getElementById('plots-zone-accordion-list');
    if (!listEl) return;

    if (this.filteredPlots.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Không tìm thấy dữ liệu Xứ đồng theo tiêu chí lọc.</div>';
      return;
    }

    // Group plots by Zone
    const zoneMap = new Map();
    this.filteredPlots.forEach(p => {
      const zName = p.xu_dong ? p.xu_dong.trim() : 'Chưa rõ';
      if (!zoneMap.has(zName)) {
        zoneMap.set(zName, {
          name: zName,
          to_list: new Set(),
          farmers: new Set(),
          plots: [],
          totalArea: 0,
          totalQ1: 0,
          totalQ2: 0
        });
      }
      const z = zoneMap.get(zName);
      z.plots.push(p);
      const area = parseFloat(p.tong_dt) || 0;
      z.totalArea += area;
      z.totalQ1 += parseFloat(p.quy_1) || 0;
      z.totalQ2 += parseFloat(p.quy_2) || 0;
      if (p.dia_chi) z.to_list.add(p.dia_chi);
      if (p.ho_sx) z.farmers.add(p.ho_sx);
    });

    // Sort by total area descending
    const zonesList = Array.from(zoneMap.values()).sort((a, b) => b.totalArea - a.totalArea);

    listEl.innerHTML = zonesList.map((z, idx) => {
      const toStr = Array.from(z.to_list).join(', ') || 'Chưa rõ';
      const isOpen = idx === 0 ? 'open' : '';

      return `
        <div class="grouped-accordion-card ${isOpen}" id="zone-card-${idx}">
          <div class="accordion-header-row" onclick="AgriPlots.toggleAccordion('zone-card-${idx}')">
            <div class="accordion-header-left">
              <div class="stat-icon-wrap bg-emerald-light" style="width: 32px; height: 32px;">
                <i data-lucide="map-pin" class="text-emerald" style="width: 16px; height: 16px;"></i>
              </div>
              <div>
                <div class="accordion-title">🌾 ${z.name}</div>
                <div style="font-size: 0.76rem; color: var(--text-muted);">
                  Địa bàn: ${toStr} • ${z.farmers.size} Hộ sản xuất
                </div>
              </div>
            </div>

            <div class="accordion-header-right">
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 1rem; color: var(--primary);">
                  ${AgriData.formatArea(z.totalArea)}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                  ${z.plots.length} thửa • ${(z.totalArea / 10000).toFixed(2)} ha
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); AgriPlots.locatePlotOnMap('${z.name}')" title="Bay đến trên Bản đồ GIS">
                <i data-lucide="external-link" style="width: 12px; height: 12px;"></i> Bản đồ
              </button>
              <i data-lucide="chevron-down" class="accordion-chevron" style="width: 18px; height: 18px; color: var(--text-muted);"></i>
            </div>
          </div>

          <div class="accordion-body">
            <div class="table-responsive" style="margin-top: 6px;">
              <table class="data-table" style="font-size: 0.8rem; width: 100%;">
                <thead>
                  <tr style="background: var(--bg-surface);">
                    <th>Số Thửa</th>
                    <th>Hộ Sản Xuất</th>
                    <th>Chủ Ruộng</th>
                    <th>Quỹ 1 (m²)</th>
                    <th>Quỹ 2 (m²)</th>
                    <th>Tổng DT (m²)</th>
                    <th>Địa Bàn</th>
                    <th style="text-align: center;">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${z.plots.map(p => {
                    const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
                    const tenureBadge = isRented ? '<span class="badge badge-amber" style="font-size:0.65rem;">Thuê mượn</span>' : '<span class="badge badge-emerald" style="font-size:0.65rem;">Chính chủ</span>';
                    const plotId = p.id || p.stt;
                    return `
                      <tr>
                        <td><strong>#${p.stt}</strong></td>
                        <td><strong style="color: var(--text-main); cursor: pointer;" onclick="AgriFarmers.showDetail('${p.ho_sx}')">${p.ho_sx}</strong></td>
                        <td>${p.chu_ruong || '-'} ${tenureBadge}</td>
                        <td>${p.quy_1 > 0 ? Number(p.quy_1).toLocaleString('vi-VN') : '-'}</td>
                        <td>${p.quy_2 > 0 ? Number(p.quy_2).toLocaleString('vi-VN') : '-'}</td>
                        <td><strong>${Number(p.tong_dt).toLocaleString('vi-VN')} m²</strong></td>
                        <td>${p.dia_chi || '-'}</td>
                        <td style="text-align: center;">
                          <button class="btn btn-outline btn-sm" onclick="AgriPlots.openEditPlotModal('${plotId}')"><i data-lucide="edit-2"></i> Sửa</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // =========================================================================
  // VIEW 3: GROUPED BY FARMER (GOM THEO HỘ SẢN XUẤT)
  // =========================================================================
  renderGroupedByFarmer() {
    const listEl = document.getElementById('plots-farmer-accordion-list');
    if (!listEl) return;

    if (this.filteredPlots.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Không tìm thấy dữ liệu Hộ sản xuất theo tiêu chí lọc.</div>';
      return;
    }

    // Group plots by Farmer
    const farmerMap = new Map();
    this.filteredPlots.forEach(p => {
      const fName = p.ho_sx ? p.ho_sx.trim() : 'Chưa rõ';
      if (!farmerMap.has(fName)) {
        farmerMap.set(fName, {
          name: fName,
          dia_chi: p.dia_chi || '',
          dien_thoai: p.dien_thoai || '',
          zones: new Set(),
          plots: [],
          totalArea: 0,
          ownedArea: 0,
          rentedArea: 0
        });
      }
      const f = farmerMap.get(fName);
      f.plots.push(p);
      const area = parseFloat(p.tong_dt) || 0;
      f.totalArea += area;
      if (p.is_rented) {
        f.rentedArea += area;
      } else {
        f.ownedArea += area;
      }
      if (p.xu_dong) f.zones.add(p.xu_dong);
      if (p.dien_thoai && !f.dien_thoai) f.dien_thoai = p.dien_thoai;
      if (p.dia_chi && !f.dia_chi) f.dia_chi = p.dia_chi;
    });

    // Sort by total area descending
    const farmersList = Array.from(farmerMap.values()).sort((a, b) => b.totalArea - a.totalArea);

    listEl.innerHTML = farmersList.map((f, idx) => {
      const zoneStr = Array.from(f.zones).join(', ') || 'Chưa rõ';
      const isOpen = idx === 0 ? 'open' : '';

      return `
        <div class="grouped-accordion-card ${isOpen}" id="farmer-card-${idx}">
          <div class="accordion-header-row" onclick="AgriPlots.toggleAccordion('farmer-card-${idx}')">
            <div class="accordion-header-left">
              <div class="stat-icon-wrap bg-blue-light" style="width: 32px; height: 32px;">
                <i data-lucide="user" class="text-blue" style="width: 16px; height: 16px;"></i>
              </div>
              <div>
                <div class="accordion-title">👨‍🌾 ${f.name}</div>
                <div style="font-size: 0.76rem; color: var(--text-muted);">
                  ${f.dia_chi || 'Tổ --'} ${f.dien_thoai ? `• 📞 ${f.dien_thoai}` : ''} • ${f.zones.size} Xứ đồng: ${zoneStr}
                </div>
              </div>
            </div>

            <div class="accordion-header-right">
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 1rem; color: var(--primary);">
                  ${AgriData.formatArea(f.totalArea)}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">
                  ${f.plots.length} thửa (${AgriData.formatArea(f.ownedArea)} chủ + ${AgriData.formatArea(f.rentedArea)} thuê)
                </div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); AgriFarmers.showDetail('${f.name}')" title="Xem hồ sơ nông dân">
                <i data-lucide="user" style="width: 12px; height: 12px;"></i> Hồ sơ
              </button>
              <i data-lucide="chevron-down" class="accordion-chevron" style="width: 18px; height: 18px; color: var(--text-muted);"></i>
            </div>
          </div>

          <div class="accordion-body">
            <div class="table-responsive" style="margin-top: 6px;">
              <table class="data-table" style="font-size: 0.8rem; width: 100%;">
                <thead>
                  <tr style="background: var(--bg-surface);">
                    <th>Số Thửa</th>
                    <th>Xứ Đồng</th>
                    <th>Chủ Ruộng</th>
                    <th>Quỹ 1 (m²)</th>
                    <th>Quỹ 2 (m²)</th>
                    <th>Tổng DT (m²)</th>
                    <th>Tình Trạng</th>
                    <th style="text-align: center;">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${f.plots.map(p => {
                    const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
                    const tenureBadge = isRented ? '<span class="badge badge-amber" style="font-size:0.65rem;">🔄 Thuê mượn</span>' : '<span class="badge badge-emerald" style="font-size:0.65rem;">✅ Chính chủ</span>';
                    const plotId = p.id || p.stt;
                    return `
                      <tr>
                        <td><strong>#${p.stt}</strong></td>
                        <td><strong style="color: var(--primary); cursor: pointer;" onclick="AgriPlots.locatePlotOnMap('${p.xu_dong}')">${p.xu_dong}</strong></td>
                        <td>${p.chu_ruong || '-'}</td>
                        <td>${p.quy_1 > 0 ? Number(p.quy_1).toLocaleString('vi-VN') : '-'}</td>
                        <td>${p.quy_2 > 0 ? Number(p.quy_2).toLocaleString('vi-VN') : '-'}</td>
                        <td><strong>${Number(p.tong_dt).toLocaleString('vi-VN')} m²</strong></td>
                        <td>${tenureBadge}</td>
                        <td style="text-align: center;">
                          <button class="btn btn-outline btn-sm" onclick="AgriPlots.locatePlotOnMap('${p.xu_dong}')"><i data-lucide="map-pin"></i></button>
                          <button class="btn btn-outline btn-sm" onclick="AgriPlots.openEditPlotModal('${plotId}')"><i data-lucide="edit-2"></i></button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  toggleAccordion(cardId) {
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.toggle('open');
    }
  },

  // =========================================================================
  // CRUD OPERATIONS (THÊM / SỬA / XÓA THỬA RUỘNG)
  // =========================================================================
  openAddPlotModal() {
    if (window.AgriAuth && !AgriAuth.canEdit('plots')) {
      alert('Tài khoản của bạn chỉ có quyền XEM Sổ bộ thửa. Không thể thêm mới thửa ruộng!');
      return;
    }
    this.populateZoneOptions();
    document.getElementById('modal-plot-crud-title').textContent = 'Thêm Thửa Ruộng Mới';
    document.getElementById('modal-plot-crud-sub').textContent = 'Nhập thông tin thửa đất và lưu vào Sổ bộ';
    document.getElementById('plot-form-id').value = '';
    document.getElementById('plot-form-stt').value = '';
    document.getElementById('plot-form-ho-sx').value = '';
    document.getElementById('plot-form-chu-ruong').value = '';
    document.getElementById('plot-form-tong-dt').value = '';
    document.getElementById('plot-form-loai-dat').value = 'quy1';
    document.getElementById('plot-form-dia-chi').value = 'Tổ 1';
    document.getElementById('plot-form-dien-thoai').value = '';
    document.getElementById('plot-form-coords').value = '';

    const modal = document.getElementById('modal-single-plot-crud');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  openEditPlotModal(plotId) {
    if (window.AgriAuth && !AgriAuth.canEdit('plots')) {
      alert('Tài khoản của bạn chỉ có quyền XEM Sổ bộ thửa. Không thể chỉnh sửa thửa ruộng!');
      return;
    }
    this.populateZoneOptions();
    const plots = AgriData.getPlots();
    const plot = plots.find(p => p.id === plotId || p.stt === String(plotId));
    if (!plot) {
      alert('Không tìm thấy thông tin thửa ruộng!');
      return;
    }

    document.getElementById('modal-plot-crud-title').textContent = `Chỉnh Sửa Thửa Ruộng #${plot.stt}`;
    document.getElementById('modal-plot-crud-sub').textContent = `Xứ đồng: ${plot.xu_dong} • Hộ SX: ${plot.ho_sx}`;
    document.getElementById('plot-form-id').value = plot.id || plot.stt;
    document.getElementById('plot-form-stt').value = plot.stt || '';
    document.getElementById('plot-form-xu-dong').value = plot.xu_dong || '';
    document.getElementById('plot-form-ho-sx').value = plot.ho_sx || '';
    document.getElementById('plot-form-chu-ruong').value = plot.chu_ruong || '';
    document.getElementById('plot-form-tong-dt').value = plot.tong_dt || '';
    
    let loaiDat = 'quy1';
    if (plot.quy_2 > 0) loaiDat = 'quy2';
    else if (plot.quy_khac > 0) loaiDat = 'khac';
    document.getElementById('plot-form-loai-dat').value = loaiDat;

    document.getElementById('plot-form-dia-chi').value = plot.dia_chi || 'Tổ 1';
    document.getElementById('plot-form-dien-thoai').value = plot.dien_thoai || '';
    document.getElementById('plot-form-coords').value = (plot.coords && plot.coords.length >= 2) ? `${plot.coords[0]}, ${plot.coords[1]}` : '';

    const modal = document.getElementById('modal-single-plot-crud');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closePlotModal() {
    const modal = document.getElementById('modal-single-plot-crud');
    if (modal) modal.classList.remove('open');
  },

  savePlotModal() {
    if (window.AgriAuth && !AgriAuth.canEdit('plots')) {
      alert('Tài khoản của bạn chỉ có quyền XEM Sổ bộ thửa. Không thể lưu thay đổi!');
      return;
    }
    const id = document.getElementById('plot-form-id').value;
    const stt = document.getElementById('plot-form-stt').value.trim();
    const xuDong = document.getElementById('plot-form-xu-dong').value;
    const hoSx = document.getElementById('plot-form-ho-sx').value.trim();
    const chuRuong = document.getElementById('plot-form-chu-ruong').value.trim();
    const tongDt = parseFloat(document.getElementById('plot-form-tong-dt').value) || 0;
    const loaiDat = document.getElementById('plot-form-loai-dat').value;
    const diaChi = document.getElementById('plot-form-dia-chi').value;
    const dienThoai = document.getElementById('plot-form-dien-thoai').value.trim();
    const coordsStr = document.getElementById('plot-form-coords').value.trim();

    if (!stt) {
      alert('Vui lòng nhập Số hiệu thửa ruộng!');
      return;
    }
    if (!hoSx) {
      alert('Vui lòng nhập Tên Hộ sản xuất!');
      return;
    }
    if (!chuRuong) {
      alert('Vui lòng nhập Tên Chủ ruộng!');
      return;
    }
    if (tongDt <= 0) {
      alert('Vui lòng nhập Diện tích hợp lệ (> 0 m²)!');
      return;
    }

    let q1 = 0, q2 = 0, qKhac = 0;
    if (loaiDat === 'quy1') q1 = tongDt;
    else if (loaiDat === 'quy2') q2 = tongDt;
    else qKhac = tongDt;

    let coords = null;
    if (coordsStr) {
      const parts = coordsStr.split(',').map(n => parseFloat(n.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coords = [parts[0], parts[1]];
      }
    }

    const isRented = hoSx.toLowerCase() !== chuRuong.toLowerCase();

    const plotObj = {
      stt: stt,
      xu_dong: xuDong,
      ho_sx: hoSx,
      chu_ruong: chuRuong,
      tong_dt: tongDt,
      quy_1: q1,
      quy_2: q2,
      quy_khac: qKhac,
      dia_chi: diaChi,
      dien_thoai: dienThoai,
      coords: coords,
      is_rented: isRented
    };

    if (id) {
      // Update existing
      AgriData.updatePlot(id, plotObj);
      alert(`Đã cập nhật thành công Thửa ruộng #${stt}!`);
    } else {
      // Add new
      AgriData.addPlot(plotObj);
      alert(`Đã thêm mới thành công Thửa ruộng #${stt} vào Xứ đồng ${xuDong}!`);
    }

    this.closePlotModal();
    this.filterPlots();

    // Re-render other tabs if initialized
    if (window.AgriFarmers && AgriFarmers.render) AgriFarmers.render();
    if (window.AgriAnalytics && AgriAnalytics.renderCharts) AgriAnalytics.renderCharts();
  },

  deletePlot(plotId) {
    if (window.AgriAuth && !AgriAuth.canAdmin('plots')) {
      alert('Chỉ Quản trị viên mới có quyền XÓA thửa ruộng khỏi Sổ bộ!');
      return;
    }
    const plots = AgriData.getPlots();
    const plot = plots.find(p => p.id === plotId || p.stt === String(plotId));
    const plotName = plot ? `#${plot.stt} (${plot.ho_sx} - ${plot.xu_dong})` : `#${plotId}`;

    if (!confirm(`Bạn có chắc chắn muốn XÓA thửa ruộng ${plotName} khỏi hệ thống không? Dữ liệu sẽ được đồng bộ và cập nhật lại toàn diện.`)) {
      return;
    }

    const success = AgriData.deletePlot(plotId);
    if (success) {
      alert(`Đã xóa thửa ruộng ${plotName} thành công!`);
      this.filterPlots();
      if (window.AgriFarmers && AgriFarmers.render) AgriFarmers.render();
      if (window.AgriAnalytics && AgriAnalytics.renderCharts) AgriAnalytics.renderCharts();
    }
  },

  pickPlotLocation() {
    const xuDong = document.getElementById('plot-form-xu-dong').value;
    const geo = AgriData.getGeoJSON();
    if (!geo || !geo.features) return;

    const feature = geo.features.find(f => f.properties && f.properties.name && f.properties.name.trim().toLowerCase() === xuDong.trim().toLowerCase());
    if (feature && window.turf) {
      const centroid = turf.centroid(feature);
      const [lng, lat] = centroid.geometry.coordinates;
      document.getElementById('plot-form-coords').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      alert(`Đã tự động lấy tọa độ tâm Xứ đồng ${xuDong}: [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
    }
  },

  locatePlotOnMap(zoneName) {
    App.switchTab('tab-map');
    setTimeout(() => {
      AgriMap.flyToZone(zoneName);
    }, 200);
  },

  // =========================================================================
  // EXPORT CSV & PRINTABLE CADASTRE BOOK
  // =========================================================================
  exportToExcel() {
    const plots = this.filteredPlots.length > 0 ? this.filteredPlots : AgriData.getPlots();
    if (plots.length === 0) {
      alert('Không có dữ liệu để xuất Excel!');
      return;
    }

    let csvContent = '\uFEFF'; // BOM for Vietnamese UTF-8
    csvContent += 'STT,Hộ Sản Xuất,Chủ Ruộng,Xứ Đồng,Quỹ 1 (m2),Quỹ 2 (m2),Tổng Diện Tích (m2),Địa Bàn,Điện Thoại,Tình Trạng Canh Tác\n';

    plots.forEach(p => {
      const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
      const status = isRented ? 'Thuê mượn/Tích tụ' : 'Chính chủ';
      const row = [
        `"${p.stt || ''}"`,
        `"${(p.ho_sx || '').replace(/"/g, '""')}"`,
        `"${(p.chu_ruong || '').replace(/"/g, '""')}"`,
        `"${(p.xu_dong || '').replace(/"/g, '""')}"`,
        p.quy_1 || 0,
        p.quy_2 || 0,
        p.tong_dt || 0,
        `"${p.dia_chi || ''}"`,
        `"${p.dien_thoai || ''}"`,
        `"${status}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `So_Bo_Thua_Ruong_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  printCadastre() {
    const plots = this.filteredPlots.length > 0 ? this.filteredPlots : AgriData.getPlots();
    const totalArea = plots.reduce((s, p) => s + (parseFloat(p.tong_dt) || 0), 0);
    const totalQ1 = plots.reduce((s, p) => s + (parseFloat(p.quy_1) || 0), 0);
    const totalQ2 = plots.reduce((s, p) => s + (parseFloat(p.quy_2) || 0), 0);

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sổ Mục Kê Thửa Ruộng - HTX Nông Nghiệp</title>
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

        <div class="title">SỔ MỤC KÊ ĐẤT ĐAI & BỘ THỬA CANH TÁC NÔNG NGHIỆP</div>
        <div class="sub">Tổng số: <strong>${plots.length}</strong> thửa • Tổng diện tích: <strong>${AgriData.formatArea(totalArea)}</strong> (${(totalArea/10000).toFixed(2)} ha) • Quỹ 1: <strong>${AgriData.formatArea(totalQ1)}</strong> • Quỹ 2: <strong>${AgriData.formatArea(totalQ2)}</strong></div>

        <table>
          <thead>
            <tr>
              <th width="40">STT</th>
              <th>Số Thửa</th>
              <th>Hộ Sản Xuất (Trực tiếp làm)</th>
              <th>Chủ Ruộng (Đứng tên)</th>
              <th>Xứ Đồng</th>
              <th>Quỹ 1 (m²)</th>
              <th>Quỹ 2 (m²)</th>
              <th>Tổng DT (m²)</th>
              <th>Địa Bàn</th>
              <th>Tình Trạng</th>
            </tr>
          </thead>
          <tbody>
            ${plots.map((p, idx) => {
              const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td class="center"><strong>${p.stt}</strong></td>
                  <td><strong>${p.ho_sx}</strong></td>
                  <td>${p.chu_ruong || '-'}</td>
                  <td>${p.xu_dong}</td>
                  <td class="num">${p.quy_1 > 0 ? Number(p.quy_1).toLocaleString('vi-VN') : '-'}</td>
                  <td class="num">${p.quy_2 > 0 ? Number(p.quy_2).toLocaleString('vi-VN') : '-'}</td>
                  <td class="num"><strong>${Number(p.tong_dt).toLocaleString('vi-VN')}</strong></td>
                  <td class="center">${p.dia_chi || '-'}</td>
                  <td class="center">${isRented ? 'Thuê mượn' : 'Chính chủ'}</td>
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
  }
};
