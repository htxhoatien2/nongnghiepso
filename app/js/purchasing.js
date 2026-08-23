/**
 * AGRIGIS PURCHASING & FIELD HARVEST WEIGHING MODULE (MOBILE-FIRST)
 * (Phân hệ Thu Mua Nông Sản & Quản Lý Phiên Cân Lúa Tối Ưu Cho Điện Thoại & Zalo)
 * - Tối ưu 100% cho thao tác bằng 1 tay trên điện thoại ngoài đồng ruộng/bờ ruộng
 * - Bảng nhập mẻ hoàn toàn trống khi tạo mới (không điền sẵn số liệu demo)
 * - Danh sách sổ xuống chọn 85 Xứ đồng đồng bộ CSDL kèm nhóm Xứ đồng của hộ
 * - Sau khi lưu phiên cân: TỰ ĐỘNG MỞ PHIÊN CÂN MỚI TIẾP THEO (giữ cán bộ cân, xe nhận, giống lúa để cân liên tục)
 * - Tự động quy đổi Lượng khô (mặc định trừ 12%) và tự nhớ đơn giá theo giống lúa
 * - Tự động tạo bản tin Zalo chuẩn đẹp & Copy 1 chạm để gửi cho nông dân
 * - In phiếu cân A5/A4, In bảng kê toàn xã & Xuất Excel CSV UTF-8 BOM
 */

const AgriPurchasing = {
  filteredSessions: [],
  currentBatches: [],
  selectedSession: null,
  lastCopiedZaloText: '',
  lastContext: {
    can_bo_can: '',
    xe_nhan: '',
    xu_dong: 'La Châu',
    loai_giong: 'J02',
    don_gia_kg: 8500
  },

  init() {
    this.populateFilterDropdowns();
    this.populateModalDropdowns();
    this.bindEvents();
    this.filterSessions();
  },

  bindEvents() {
    const searchInput = document.getElementById('purchasing-search');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.filterSessions(), 250);
      });
    }
  },

  populateFilterDropdowns() {
    const zoneSelect = document.getElementById('purchasing-zone-filter');
    const officerSelect = document.getElementById('purchasing-officer-filter');
    const truckSelect = document.getElementById('purchasing-truck-filter');

    // 1. Populate Zones
    if (zoneSelect) {
      const zones = AgriData.getZones();
      const currentVal = zoneSelect.value;
      zoneSelect.innerHTML = '<option value="">Tất cả Xứ đồng (85 vùng)</option>' +
        zones.map(z => `<option value="${z.name}">Xứ đồng ${z.name}</option>`).join('');
      if (currentVal) zoneSelect.value = currentVal;
    }

    // 2. Populate Officers & Trucks from sessions
    const sessions = AgriData.getPurchasingSessions();
    if (officerSelect) {
      const officers = Array.from(new Set(sessions.map(s => s.can_bo_can).filter(Boolean))).sort();
      officerSelect.innerHTML = '<option value="">Tất cả cán bộ cân</option>' +
        officers.map(o => `<option value="${o}">${o}</option>`).join('');
    }

    if (truckSelect) {
      const trucks = Array.from(new Set(sessions.map(s => s.xe_nhan).filter(Boolean))).sort();
      truckSelect.innerHTML = '<option value="">Tất cả xe nhận</option>' +
        trucks.map(t => `<option value="${t}">${t}</option>`).join('');
    }
  },

  populateModalDropdowns() {
    // 1. Datalist Farmers
    const datalist = document.getElementById('weighing-farmers-datalist');
    if (datalist) {
      const farmers = AgriData.getFarmers();
      datalist.innerHTML = farmers.map(f => `<option value="${f.name}">${f.dia_chi || ''} - ${f.dien_thoai || ''} - Xứ đồng: ${(f.xu_dong_list || []).join(', ')}</option>`).join('');
    }

    // 2. Populate Zone select
    this.populateZoneSelect(this.lastContext.xu_dong || 'La Châu', []);
  },

  populateZoneSelect(selectedZone = '', farmerZones = []) {
    const zoneSelect = document.getElementById('weighing-zone-select');
    if (!zoneSelect) return;

    const allZones = AgriData.getZones();
    let html = '';

    if (Array.isArray(farmerZones) && farmerZones.length > 0) {
      // Group 1: Farmer's specific zones
      html += `<optgroup label="⭐ Xứ đồng canh tác của hộ (${farmerZones.length} vùng)">`;
      farmerZones.forEach(zName => {
        const found = allZones.find(z => z.name === zName);
        const detail = found ? ` (${found.so_thua || 0} thửa - ${found.dt_ha || 0} ha)` : '';
        html += `<option value="${zName}">⭐ Xứ đồng ${zName}${detail}</option>`;
      });
      html += `</optgroup>`;

      // Group 2: All other zones in the commune
      const otherZones = allZones.filter(z => !farmerZones.includes(z.name));
      html += `<optgroup label="🌾 Tất cả xứ đồng trong xã (${allZones.length} vùng)">`;
      otherZones.forEach(z => {
        html += `<option value="${z.name}">Xứ đồng ${z.name} (${z.so_thua} thửa - ${z.dt_ha} ha)</option>`;
      });
      html += `</optgroup>`;
    } else {
      // All 85 zones
      html += allZones.map(z => `<option value="${z.name}">🌾 Xứ đồng ${z.name} (${z.so_thua} thửa - ${z.dt_ha} ha)</option>`).join('');
    }

    zoneSelect.innerHTML = html;
    if (selectedZone) {
      zoneSelect.value = selectedZone;
    }
  },

  filterSessions() {
    const q = (document.getElementById('purchasing-search')?.value || '').toLowerCase().trim();
    const zone = document.getElementById('purchasing-zone-filter')?.value || '';
    const variety = document.getElementById('purchasing-variety-filter')?.value || '';
    const officer = document.getElementById('purchasing-officer-filter')?.value || '';
    const truck = document.getElementById('purchasing-truck-filter')?.value || '';

    const allSessions = AgriData.getPurchasingSessions();

    this.filteredSessions = allSessions.filter(s => {
      // 1. Text Search
      if (q) {
        const match = (
          (s.ho_sx && s.ho_sx.toLowerCase().includes(q)) ||
          (s.dien_thoai && s.dien_thoai.toLowerCase().includes(q)) ||
          (s.can_bo_can && s.can_bo_can.toLowerCase().includes(q)) ||
          (s.xe_nhan && s.xe_nhan.toLowerCase().includes(q)) ||
          (s.xu_dong && s.xu_dong.toLowerCase().includes(q)) ||
          (s.loai_giong && s.loai_giong.toLowerCase().includes(q))
        );
        if (!match) return false;
      }

      // 2. Zone filter
      if (zone && s.xu_dong !== zone) return false;

      // 3. Variety filter
      if (variety && s.loai_giong !== variety) return false;

      // 4. Officer filter
      if (officer && s.can_bo_can !== officer) return false;

      // 5. Truck filter
      if (truck && s.xe_nhan !== truck) return false;

      return true;
    });

    this.renderTable();
    this.updateStats();
  },

  resetFilters() {
    const searchInput = document.getElementById('purchasing-search');
    const zoneSelect = document.getElementById('purchasing-zone-filter');
    const varietySelect = document.getElementById('purchasing-variety-filter');
    const officerSelect = document.getElementById('purchasing-officer-filter');
    const truckSelect = document.getElementById('purchasing-truck-filter');

    if (searchInput) searchInput.value = '';
    if (zoneSelect) zoneSelect.value = '';
    if (varietySelect) varietySelect.value = '';
    if (officerSelect) officerSelect.value = '';
    if (truckSelect) truckSelect.value = '';

    this.filterSessions();
  },

  // =========================================================================
  // 1. RENDER PURCHASING TABLE
  // =========================================================================
  renderTable() {
    const tbody = document.getElementById('purchasing-tbody');
    if (!tbody) return;

    if (this.filteredSessions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="14" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Chưa có phiên cân nào phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.filteredSessions.map((s, idx) => {
      let varietyClass = 'badge-blue';
      if (s.loai_giong === 'J02' || s.loai_giong === 'ST25') varietyClass = 'badge-emerald';
      else if (s.loai_giong === 'HG12' || s.loai_giong === 'HG244') varietyClass = 'badge-primary';
      else if (s.loai_giong === 'ĐT100') varietyClass = 'badge-amber';

      const formattedDate = s.ngay_can ? s.ngay_can.replace('T', ' ') : '-';

      return `
        <tr>
          <td class="center-cell">#${s.stt || idx + 1}</td>
          <td class="center-cell" style="font-size: 0.78rem; color: var(--text-muted);">${formattedDate}</td>
          <td>
            <strong style="color: var(--text-main); cursor: pointer;" onclick="AgriFarmers.showDetail('${s.ho_sx}')" title="Xem hồ sơ nông dân">${s.ho_sx}</strong>
            ${s.dia_chi ? `<small style="display: block; color: var(--text-muted); font-size: 0.7rem;">${s.dia_chi}</small>` : ''}
          </td>
          <td><span style="font-weight: 600;">${s.xu_dong || '-'}</span></td>
          <td>
            <div style="font-size: 0.82rem; font-weight: 600;"><i data-lucide="user-check" style="width: 11px; height: 11px; display: inline;"></i> ${s.can_bo_can || '-'}</div>
          </td>
          <td>
            <div style="font-size: 0.8rem; color: var(--text-main);"><i data-lucide="truck" style="width: 11px; height: 11px; display: inline;"></i> ${s.xe_nhan || '-'}</div>
          </td>
          <td class="center-cell">
            <span class="badge ${varietyClass}">${s.loai_giong || 'J02'}</span>
          </td>
          <td class="center-cell">
            <strong style="font-size: 0.9rem;">${s.tong_so_bao || 0}</strong>
          </td>
          <td class="num-cell">
            <strong>${Number(s.luong_tuoi_kg || 0).toLocaleString('vi-VN')}</strong> kg
          </td>
          <td class="center-cell" style="color: #ef4444; font-weight: 700;">
            -${s.ty_le_tru_pct != null ? s.ty_le_tru_pct : 12}%
          </td>
          <td class="num-cell">
            <strong style="color: var(--accent); font-size: 0.95rem;">${Number(s.luong_kho_kg || 0).toLocaleString('vi-VN')}</strong> kg
          </td>
          <td class="num-cell">
            ${Number(s.don_gia_kg || 0).toLocaleString('vi-VN')} đ
          </td>
          <td class="num-cell">
            <strong style="color: var(--primary); font-size: 0.95rem;">${AgriData.formatCurrency(s.thanh_tien || 0)}</strong>
          </td>
          <td class="center-cell">
            <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
              <button class="btn btn-sm" style="background: #0068FF; color: #fff; padding: 4px 7px;" onclick="AgriPurchasing.openZaloPreview('${s.id}')" title="Copy & Gửi kết quả qua Zalo">
                <i data-lucide="message-circle" style="width: 12px; height: 12px;"></i>
              </button>
              <button class="btn btn-outline btn-sm" style="padding: 4px 6px;" onclick="AgriPurchasing.previewReceipt('${s.id}')" title="Xem & In phiếu cân lúa">
                <i data-lucide="printer" style="width: 12px; height: 12px;"></i>
              </button>
              ${(window.AgriAuth && AgriAuth.canEdit('purchasing')) ? `
                <button class="btn btn-outline btn-sm" style="padding: 4px 6px;" onclick="AgriPurchasing.openEditSessionModal('${s.id}')" title="Sửa phiên cân">
                  <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
                </button>
              ` : ''}
              ${(window.AgriAuth && AgriAuth.canAdmin('purchasing')) ? `
                <button class="btn btn-outline btn-sm" style="padding: 4px 6px; color: #ef4444;" onclick="AgriPurchasing.deleteSession('${s.id}')" title="Xóa phiên cân">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  // =========================================================================
  // 2. LIVE FINANCIAL & YIELD STATS RIBBON
  // =========================================================================
  updateStats() {
    const totalFreshEl = document.getElementById('purchasing-total-fresh-display');
    const totalDryEl = document.getElementById('purchasing-total-dry-display');
    const totalAmountEl = document.getElementById('purchasing-total-amount-display');
    const totalBagsEl = document.getElementById('purchasing-total-bags-display');
    const totalSessionsEl = document.getElementById('purchasing-total-sessions-display');

    let grandFreshKg = 0;
    let grandDryKg = 0;
    let grandAmount = 0;
    let grandBags = 0;
    const uniqueTrucks = new Set();

    this.filteredSessions.forEach(s => {
      grandFreshKg += (parseFloat(s.luong_tuoi_kg) || 0);
      grandDryKg += (parseFloat(s.luong_kho_kg) || 0);
      grandAmount += (parseFloat(s.thanh_tien) || 0);
      grandBags += (parseInt(s.tong_so_bao) || 0);
      if (s.xe_nhan) uniqueTrucks.add(s.xe_nhan);
    });

    const totalFreshTon = (grandFreshKg / 1000).toFixed(2);
    const totalDryTon = (grandDryKg / 1000).toFixed(2);

    if (totalFreshEl) totalFreshEl.textContent = `${totalFreshTon} Tấn (${Number(grandFreshKg).toLocaleString('vi-VN')} kg)`;
    if (totalDryEl) totalDryEl.textContent = `${totalDryTon} Tấn (${Number(grandDryKg).toLocaleString('vi-VN')} kg)`;
    if (totalAmountEl) totalAmountEl.textContent = AgriData.formatCurrency(grandAmount);
    if (totalBagsEl) totalBagsEl.textContent = `${grandBags} bao (${uniqueTrucks.size} xe nhận)`;
    if (totalSessionsEl) totalSessionsEl.textContent = `${this.filteredSessions.length} phiên cân`;
  },

  // =========================================================================
  // 3. WEIGHING SESSION MODAL (MOBILE-FIRST POPUP)
  // =========================================================================
  openNewSessionModal(isContinuous = false, prevContext = {}) {
    const sessions = AgriData.getPurchasingSessions();
    const nextStt = sessions.length > 0 ? Math.max(...sessions.map(s => s.stt || 0)) + 1 : 1;

    document.getElementById('modal-weighing-title').textContent = `Mở Phiên Cân Lúa Mới (Phiên #${nextStt})`;
    document.getElementById('modal-weighing-sub').textContent = 'Nhập mẻ cân trực tiếp tại ruộng & tự động tính toán thành tiền';
    document.getElementById('weighing-session-id').value = '';
    document.getElementById('weighing-session-stt').value = `#${nextStt}`;
    document.getElementById('weighing-session-stt-badge').textContent = `Phiên #${nextStt}`;
    
    // Set current datetime
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('weighing-session-datetime').value = now.toISOString().slice(0, 16);

    // RESET TO EMPTY: Bỏ các số liệu mặc định của hộ và mẻ cân
    document.getElementById('weighing-farmer-input').value = '';
    document.getElementById('weighing-farmer-address').value = '';
    document.getElementById('weighing-farmer-phone').value = '';
    document.getElementById('weighing-note-input').value = '';
    
    // Context retention (giữ cán bộ cân, xe nhận, xứ đồng, giống lúa để cân liên tục)
    const loggedInOfficer = (typeof AgriAuth !== 'undefined' && AgriAuth.currentUser) ? AgriAuth.currentUser.fullname : '';
    const ctx = Object.assign({}, this.lastContext, { can_bo_can: this.lastContext.can_bo_can || loggedInOfficer }, prevContext);
    document.getElementById('weighing-officer-input').value = ctx.can_bo_can || '';
    document.getElementById('weighing-truck-input').value = ctx.xe_nhan || '';

    this.populateZoneSelect(ctx.xu_dong || 'La Châu', []);

    const variety = ctx.loai_giong || 'J02';
    this.selectVariety(variety);

    document.getElementById('weighing-calc-deduct-pct').value = 12.0;

    // Quick bag defaults: Mặc định 2 bao (tối đa 3 bao)
    this.setQuickBag(2);
    const kgInput = document.getElementById('quick-kg-input');
    if (kgInput) kgInput.value = '';

    // BỎ CÁC MẺ MẪU: Bắt đầu với bảng mẻ cân HOÀN TOÀN TRỐNG (0 mẻ)
    this.currentBatches = [];

    this.renderBatchesList();
    this.recalculateSession();

    const modal = document.getElementById('modal-weighing-session');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();

    // Auto focus into farmer input for instant entry
    setTimeout(() => {
      document.getElementById('weighing-farmer-input')?.focus();
    }, 150);
  },

  openNewSessionModalWithPlot(plotId) {
    const allPlots = AgriData.getPlots();
    const plot = allPlots.find(p => String(p.id) === String(plotId) || String(p.stt) === String(plotId));
    
    this.openNewSessionModal(false, {
      xu_dong: plot ? plot.xu_dong : 'La Châu'
    });

    if (plot) {
      setTimeout(() => {
        const nameInput = document.getElementById('weighing-farmer-input');
        const addrInput = document.getElementById('weighing-farmer-address');
        const phoneInput = document.getElementById('weighing-farmer-phone');
        const noteInput = document.getElementById('weighing-note-input');

        if (nameInput) nameInput.value = plot.ho_sx || plot.chu_ruong || '';
        if (addrInput) addrInput.value = plot.dia_chi || 'Xã Hòa Tiến';
        if (phoneInput) phoneInput.value = plot.dien_thoai || '';
        if (noteInput) noteInput.value = `Thửa #${plot.stt} (${plot.xu_dong}) - DT: ${plot.tong_dt}m²`;

        this.populateZoneSelect(plot.xu_dong, [plot.id]);
        this.recalculateSession();
      }, 100);
    }
  },

  openEditSessionModal(sessionId) {
    const session = AgriData.getPurchasingSession(sessionId);
    if (!session) return;

    document.getElementById('modal-weighing-title').textContent = `Chỉnh Sửa: Phiên Cân #${session.stt} (${session.ho_sx})`;
    document.getElementById('modal-weighing-sub').textContent = 'Cập nhật lại mẻ cân, đơn giá hoặc xe nhận';
    document.getElementById('weighing-session-id').value = session.id;
    document.getElementById('weighing-session-stt').value = `#${session.stt}`;
    document.getElementById('weighing-session-stt-badge').textContent = `Phiên #${session.stt}`;
    
    if (session.ngay_can) {
      document.getElementById('weighing-session-datetime').value = session.ngay_can.slice(0, 16).replace(' ', 'T');
    }

    document.getElementById('weighing-farmer-input').value = session.ho_sx || '';
    document.getElementById('weighing-farmer-address').value = session.dia_chi || '';
    document.getElementById('weighing-farmer-phone').value = session.dien_thoai || '';
    
    const f = session.ho_sx ? AgriData.findFarmer(session.ho_sx) : null;
    this.populateZoneSelect(session.xu_dong || 'La Châu', (f && f.xu_dong_list) || []);

    document.getElementById('weighing-officer-input').value = session.can_bo_can || '';
    document.getElementById('weighing-truck-input').value = session.xe_nhan || '';
    
    this.selectVariety(session.loai_giong || 'J02');
    
    document.getElementById('weighing-calc-deduct-pct').value = session.ty_le_tru_pct != null ? session.ty_le_tru_pct : 12.0;
    document.getElementById('weighing-calc-unit-price').value = session.don_gia_kg || 8500;
    document.getElementById('weighing-note-input').value = session.ghi_chu || '';

    // Load batches
    if (Array.isArray(session.chi_tiet_can)) {
      this.currentBatches = JSON.parse(JSON.stringify(session.chi_tiet_can));
    } else {
      this.currentBatches = [];
    }

    this.renderBatchesList();
    this.recalculateSession();

    const modal = document.getElementById('modal-weighing-session');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeSessionModal() {
    const modal = document.getElementById('modal-weighing-session');
    if (modal) modal.classList.remove('open');
  },

  // =========================================================================
  // 4. MOBILE WEIGHING PAD LOGIC (BÀN CÂN NHẬP NHANH)
  // =========================================================================
  setQuickBag(count) {
    document.getElementById('quick-bag-count').value = count;
    document.querySelectorAll('#bag-quick-btns .bag-btn').forEach(btn => {
      const isMatch = btn.textContent.includes(`${count} bao`);
      btn.classList.toggle('active', isMatch);
      if (isMatch) {
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--primary)';
      } else {
        btn.style.background = 'var(--bg-app)';
        btn.style.color = 'var(--text-main)';
        btn.style.borderColor = 'var(--border-color)';
      }
    });
  },

  addQuickBatch() {
    const kgInput = document.getElementById('quick-kg-input');
    if (!kgInput) return;

    const kg = parseFloat(kgInput.value) || 0;
    const bagCount = parseInt(document.getElementById('quick-bag-count')?.value) || 2;

    if (kg <= 0) {
      alert('Vui lòng nhập số Kg của mẻ cân này!');
      kgInput.focus();
      return;
    }

    const nextLuot = this.currentBatches.length + 1;
    this.currentBatches.push({
      luot: nextLuot,
      so_bao: bagCount,
      kg: kg
    });

    kgInput.value = '';
    kgInput.focus();

    this.renderBatchesList();
    this.recalculateSession();
  },

  removeBatchRow(index) {
    this.currentBatches.splice(index, 1);
    this.currentBatches.forEach((b, i) => b.luot = i + 1);
    this.renderBatchesList();
    this.recalculateSession();
  },

  renderBatchesList() {
    const container = document.getElementById('weighing-batches-list-container');
    const countBadge = document.getElementById('weighing-live-batches-count');
    if (!container) return;

    const totalBags = this.currentBatches.reduce((sum, b) => sum + (b.so_bao || 0), 0);
    if (countBadge) {
      countBadge.textContent = `Đã cân: ${this.currentBatches.length} mẻ (${totalBags} bao)`;
    }

    if (this.currentBatches.length === 0) {
      container.innerHTML = `<div class="weigh-empty-batches-hint">Chưa có mẻ cân nào. Nhập số Kg ở trên và bấm "Thêm Mẻ" (hoặc bấm Enter).</div>`;
      return;
    }

    container.innerHTML = this.currentBatches.map((b, idx) => `
      <div class="weigh-batch-item">
        <div class="weigh-batch-left">
          <span class="weigh-batch-tag">Mẻ #${b.luot}</span>
          <span class="weigh-batch-bags">${b.so_bao} bao</span>
          <strong class="weigh-batch-kg">${Number(b.kg).toLocaleString('vi-VN')} kg</strong>
        </div>
        <button type="button" class="btn-del-batch" onclick="AgriPurchasing.removeBatchRow(${idx})" title="Xóa mẻ cân này">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  },

  selectVariety(varName) {
    document.getElementById('weighing-variety-select').value = varName;

    // Highlight pill / chip
    document.querySelectorAll('#weighing-variety-chips .variety-pill, #weighing-variety-chips .variety-chip').forEach(btn => {
      const isMatch = btn.dataset.variety === varName;
      btn.classList.toggle('active', isMatch);
    });

    // Load remembered price
    const rememberedPrice = AgriData.getRememberedPrice(varName);
    if (rememberedPrice > 0) {
      document.getElementById('weighing-calc-unit-price').value = rememberedPrice;
    }

    this.recalculateSession();
  },

  adjustUnitPrice(delta) {
    const priceInput = document.getElementById('weighing-calc-unit-price');
    if (!priceInput) return;
    const currentVal = parseFloat(priceInput.value) || 8000;
    const newVal = Math.max(0, currentVal + delta);
    priceInput.value = newVal;
    this.recalculateSession();
  },

  onFarmerInput() {
    const name = document.getElementById('weighing-farmer-input')?.value.trim();
    if (!name) {
      this.populateZoneSelect(this.lastContext.xu_dong || 'La Châu', []);
      return;
    }
    const f = AgriData.findFarmer(name);
    if (f) {
      if (f.dia_chi) document.getElementById('weighing-farmer-address').value = f.dia_chi;
      if (f.dien_thoai) document.getElementById('weighing-farmer-phone').value = f.dien_thoai;
      
      const farmerZones = f.xu_dong_list || [];
      const primaryZone = farmerZones.length > 0 ? farmerZones[0] : (this.lastContext.xu_dong || 'La Châu');
      
      this.populateZoneSelect(primaryZone, farmerZones);
    } else {
      this.populateZoneSelect(document.getElementById('weighing-zone-select').value, []);
    }
  },

  onFarmerSelect() {
    this.onFarmerInput();
  },

  recalculateSession() {
    let totalBags = 0;
    let totalFreshKg = 0;

    this.currentBatches.forEach(b => {
      totalBags += (parseInt(b.so_bao) || 0);
      totalFreshKg += (parseFloat(b.kg) || 0);
    });

    const deductPct = parseFloat(document.getElementById('weighing-calc-deduct-pct')?.value) || 0;
    const unitPrice = parseFloat(document.getElementById('weighing-calc-unit-price')?.value) || 0;

    // Formula: Lượng khô = Lượng tươi * (1 - Trừ% / 100)
    const deductKg = Number((totalFreshKg * (deductPct / 100)).toFixed(1));
    const dryKg = Number((totalFreshKg - deductKg).toFixed(2));
    const totalMoney = Math.round(dryKg * unitPrice);

    // Update displays
    document.getElementById('weighing-calc-total-bags').textContent = `(${totalBags} bao)`;
    document.getElementById('weighing-calc-fresh-kg').textContent = `${Number(totalFreshKg).toLocaleString('vi-VN')} kg`;
    document.getElementById('weighing-calc-deduct-kg').textContent = `(-${Number(deductKg).toLocaleString('vi-VN')} kg)`;
    document.getElementById('weighing-calc-dry-kg').textContent = `${Number(dryKg).toLocaleString('vi-VN')} kg`;
    document.getElementById('weighing-calc-total-money').textContent = `${AgriData.formatCurrency(totalMoney)}`;
  },

  // =========================================================================
  // 5. SAVE & AUTO-OPEN NEXT SESSION (TIẾP TỤC CÂN HỘ KẾ TIẾP LIÊN TỤC)
  // =========================================================================
  saveSessionModal(andAction = 'none') {
    const id = document.getElementById('weighing-session-id').value.trim();
    const datetime = document.getElementById('weighing-session-datetime').value;
    const farmerName = document.getElementById('weighing-farmer-input').value.trim();
    const address = document.getElementById('weighing-farmer-address').value.trim();
    const phone = document.getElementById('weighing-farmer-phone').value.trim();
    const zone = document.getElementById('weighing-zone-select')?.value.trim() || 'La Châu';
    const officer = document.getElementById('weighing-officer-input').value.trim();
    const truck = document.getElementById('weighing-truck-input').value.trim();
    const variety = document.getElementById('weighing-variety-select').value;
    const deductPct = parseFloat(document.getElementById('weighing-calc-deduct-pct').value) || 0;
    const unitPrice = parseFloat(document.getElementById('weighing-calc-unit-price').value) || 0;
    const note = document.getElementById('weighing-note-input').value.trim();

    if (!farmerName) {
      alert('Vui lòng nhập Tên Hộ Sản Xuất (Chủ lúa)!');
      document.getElementById('weighing-farmer-input')?.focus();
      return null;
    }

    if (this.currentBatches.length === 0) {
      alert('Vui lòng nhập ít nhất 1 mẻ cân (gõ số Kg và bấm Thêm Mẻ)!');
      document.getElementById('quick-kg-input')?.focus();
      return null;
    }

    let totalBags = 0;
    let totalFreshKg = 0;
    this.currentBatches.forEach(b => {
      totalBags += (parseInt(b.so_bao) || 0);
      totalFreshKg += (parseFloat(b.kg) || 0);
    });

    if (totalFreshKg <= 0) {
      alert('Khối lượng lúa tươi phải lớn hơn 0 kg!');
      return null;
    }

    const deductKg = Number((totalFreshKg * (deductPct / 100)).toFixed(1));
    const dryKg = Number((totalFreshKg - deductKg).toFixed(2));
    const totalMoney = Math.round(dryKg * unitPrice);

    const sessionObj = {
      ngay_can: datetime.replace('T', ' '),
      ho_sx: farmerName,
      dia_chi: address,
      dien_thoai: phone,
      xu_dong: zone,
      can_bo_can: officer || 'Cán bộ cân',
      xe_nhan: truck || 'Xe nhận',
      loai_giong: variety,
      chi_tiet_can: this.currentBatches,
      tong_so_bao: totalBags,
      luong_tuoi_kg: totalFreshKg,
      ty_le_tru_pct: deductPct,
      luong_kho_kg: dryKg,
      don_gia_kg: unitPrice,
      thanh_tien: totalMoney,
      ghi_chu: note
    };

    // Save remembered price and shift context
    if (unitPrice > 0) {
      AgriData.setRememberedPrice(variety, unitPrice);
    }
    this.lastContext = {
      can_bo_can: officer,
      xe_nhan: truck,
      xu_dong: zone,
      loai_giong: variety,
      don_gia_kg: unitPrice
    };

    let savedSession = null;
    if (id) {
      savedSession = AgriData.updatePurchasingSession(id, sessionObj);
      alert(`Đã cập nhật xong Phiên cân cho hộ "${farmerName}"!`);
      this.closeSessionModal();
    } else {
      savedSession = AgriData.addPurchasingSession(sessionObj);
      
      // AUTO-OPEN NEW SESSION: Tự động mở phiên cân mới tiếp theo để cân liên tục!
      this.openNewSessionModal(true, this.lastContext);
      
      if (andAction === 'none') {
        alert(`✅ Đã lưu thành công Phiên cân #${savedSession.stt} cho hộ "${farmerName}"!\n\nHệ thống đã tự động tạo Phiên cân #${savedSession.stt + 1} tiếp theo để bạn cân cho hộ mới.`);
      }
    }

    this.populateFilterDropdowns();
    this.filterSessions();

    // Real-time Database Live Sync & Audit Log
    if (window.AgriSync && savedSession) {
      AgriSync.broadcastEvent('PURCHASING_SESSION_SAVED', savedSession);
    }
    if (window.AgriAuth && savedSession) {
      AgriAuth.logActivity('LƯU PHIÊN CÂN', `Phiên cân #${savedSession.stt} (${farmerName} - ${savedSession.luong_tuoi_kg} kg - ${AgriData.formatCurrency(savedSession.thanh_tien)})`);
    }

    if (andAction === 'print' && savedSession) {
      this.previewReceipt(savedSession.id);
    } else if (andAction === 'zalo' && savedSession) {
      this.openZaloPreview(savedSession.id);
    }

    return savedSession;
  },

  saveSessionAndPrint() {
    this.saveSessionModal('print');
  },

  saveSessionAndCopyZalo() {
    this.saveSessionModal('zalo');
  },

  // =========================================================================
  // 6. ZALO MESSAGE FORMATTER & SHARE MODAL
  // =========================================================================
  generateZaloText(session) {
    const s = session;
    const batches = Array.isArray(s.chi_tiet_can) ? s.chi_tiet_can : [];

    const batchesText = batches.map(b => `• Mẻ ${b.luot}: ${b.so_bao} bao = ${Number(b.kg).toLocaleString('vi-VN')} kg`).join('\n');

    return `🌾 HTX NÔNG NGHIỆP HÒA TIẾN 🌾
📋 PHIẾU CÂN LÚA THU MUA VỤ MÙA 2026
━━━━━━━━━━━━━━━━━━━━
👤 Hộ nông dân: ${s.ho_sx}
📍 Địa chỉ: ${s.dia_chi || 'Xã Hòa Tiến'}
🌾 Xứ đồng: ${s.xu_dong}
🌱 Giống lúa: ${s.loai_giong}
🚚 Xe nhận: ${s.xe_nhan}
👨‍🌾 Cán bộ cân: ${s.can_bo_can}
⏰ Thời gian: ${s.ngay_can || '-'}
━━━━━━━━━━━━━━━━━━━━
📦 CHI TIẾT CÁC MẺ CÂN:
${batchesText || '• Đã cân gộp'}
━━━━━━━━━━━━━━━━━━━━
📊 TỔNG KẾT PHIÊN CÂN:
• Tổng số bao: ${s.tong_so_bao} bao
• Lượng tươi: ${Number(s.luong_tuoi_kg).toLocaleString('vi-VN')} kg
• Trừ tạp chất/ẩm (${s.ty_le_tru_pct != null ? s.ty_le_tru_pct : 12}%): -${Number(s.luong_tuoi_kg - s.luong_kho_kg).toFixed(1)} kg
• Lượng khô thanh toán: ${Number(s.luong_kho_kg).toLocaleString('vi-VN')} kg
• Đơn giá: ${Number(s.don_gia_kg).toLocaleString('vi-VN')} đ/kg
💰 TỔNG THÀNH TIỀN: ${AgriData.formatCurrency(s.thanh_tien)}
${s.ghi_chu ? `* Ghi chú: ${s.ghi_chu}\n` : ''}━━━━━━━━━━━━━━━━━━━━
Kính đề nghị hộ nông dân kiểm tra đối soát!`;
  },

  openZaloPreview(sessionId) {
    const s = AgriData.getPurchasingSession(sessionId);
    if (!s) return;
    this.selectedSession = s;

    const text = this.generateZaloText(s);
    this.lastCopiedZaloText = text;

    const modal = document.getElementById('modal-zalo-preview');
    const previewEl = document.getElementById('zalo-message-preview-text');
    if (!modal || !previewEl) return;

    previewEl.textContent = text;

    // Auto copy to clipboard
    this.copyToClipboard(text);

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeZaloModal() {
    const modal = document.getElementById('modal-zalo-preview');
    if (modal) modal.classList.remove('open');
  },

  copyZaloTextAgain() {
    if (this.lastCopiedZaloText) {
      this.copyToClipboard(this.lastCopiedZaloText);
      alert('Đã sao chép lại nội dung tin nhắn Zalo vào Clipboard!');
    }
  },

  copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(err => {
        console.warn('Clipboard write error:', err);
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.warn('ExecCommand copy error:', err);
      }
      document.body.removeChild(textarea);
    }
  },

  openZaloApp() {
    window.open('https://chat.zalo.me', '_blank');
  },

  deleteSession(sessionId) {
    const s = AgriData.getPurchasingSession(sessionId);
    if (!s) return;

    if (!confirm(`Bạn có chắc chắn muốn XÓA Phiên cân #${s.stt} của hộ "${s.ho_sx}" không? Số liệu tổng hợp sẽ được tính toán lại.`)) {
      return;
    }

    AgriData.deletePurchasingSession(sessionId);
    AgriData.saveCustomRawData();
    AgriData.persist();
    this.populateFilterDropdowns();
    this.filterSessions();
    if (window.AgriAnalytics) AgriAnalytics.renderKPIs();

    // Realtime Database Live Sync & Supabase Cloud Deletion
    const client = window.supabaseClient || (window.SupabaseConfig && SupabaseConfig.getClient());
    if (client && navigator.onLine) {
      client.from('purchasing_sessions').delete().eq('id', sessionId).then(({ error }) => {
        if (error) {
          console.warn('⚠️ [Supabase Delete Session Warning]:', error);
          if (s.stt) client.from('purchasing_sessions').delete().eq('stt', Number(s.stt)).then(() => {});
        } else {
          console.log('✅ [Supabase Delete Session Success]:', sessionId);
        }
      });
    }
    if (window.AgriSync) {
      AgriSync.broadcastEvent('PURCHASING_SESSION_DELETED', { id: sessionId });
    }
    if (window.AgriAuth) {
      AgriAuth.logActivity('XÓA PHIÊN CÂN', `Đã xóa Phiên cân #${s.stt} (${s.ho_sx})`);
    }
  },

  // =========================================================================
  // 7. WEIGHING RECEIPT PREVIEW & PRINTING (A4/A5)
  // =========================================================================
  previewReceipt(sessionId) {
    const s = AgriData.getPurchasingSession(sessionId);
    if (!s) return;
    this.selectedSession = s;

    const modal = document.getElementById('modal-weighing-receipt');
    const content = document.getElementById('weighing-receipt-content');
    if (!modal || !content) return;

    const batches = Array.isArray(s.chi_tiet_can) ? s.chi_tiet_can : [];

    content.innerHTML = `
      <div style="font-family: 'Times New Roman', serif; color: #000; padding: 10px 15px; line-height: 1.35;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
          <div style="text-align: center;">
            <strong style="font-size: 13px;">UBND HUYỆN HÒA VANG</strong><br>
            <strong style="font-size: 13px;">HTX DỊCH VỤ SẢN XUẤT NÔNG NGHIỆP</strong><br>
            <em style="font-size: 12px;">Xã Hòa Tiến - TP. Đà Nẵng</em>
          </div>
          <div style="text-align: center;">
            <strong style="font-size: 13px;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
            <strong style="font-size: 13px;">Độc lập - Tự do - Hạnh phúc</strong><br>
            <em style="font-size: 12px;">---o0o---</em>
          </div>
        </div>

        <div style="text-align: center; margin: 15px 0 10px;">
          <h2 style="font-size: 17px; margin: 0; font-weight: bold; text-transform: uppercase;">PHIẾU CÂN LÚA & XÁC NHẬN THU MUA NÔNG SẢN</h2>
          <p style="font-size: 12px; font-style: italic; margin-top: 3px;">(Số Phiên: <strong>#${s.stt}</strong> • Vụ Thu Hoạch Mùa Năm 2026)</p>
        </div>

        <div style="border: 1px solid #000; padding: 10px; border-radius: 4px; margin-bottom: 12px; font-size: 13px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div><strong>Hộ sản xuất (Chủ lúa):</strong> <span style="font-size: 14px; font-weight: bold;">${s.ho_sx}</span></div>
            <div><strong>Địa bàn cư trú:</strong> ${s.dia_chi || 'Tổ --'} - Xã Hòa Tiến</div>
            <div><strong>Số điện thoại:</strong> ${s.dien_thoai || '......................'}</div>
            <div><strong>Thời gian cân:</strong> ${s.ngay_can || '-'}</div>
            <div><strong>Xứ đồng thu hoạch:</strong> <span style="font-weight: bold;">${s.xu_dong}</span></div>
            <div><strong>Loại giống lúa:</strong> <span style="font-weight: bold; color: #059669;">${s.loai_giong}</span></div>
            <div><strong>Cán bộ phụ trách cân:</strong> ${s.can_bo_can}</div>
            <div><strong>Xe nhận vận chuyển:</strong> ${s.xe_nhan}</div>
          </div>
        </div>

        <div style="margin-bottom: 8px;"><strong>BẢNG KÊ CHI TIẾT CÁC MẺ CÂN TẠI RUỘNG:</strong></div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px;" border="1" cellpadding="5">
          <thead>
            <tr style="background: #f0f0f0;">
              <th width="50" style="text-align: center;">Mẻ Cân</th>
              <th width="150" style="text-align: center;">Số Lượng Bao (Bao)</th>
              <th style="text-align: right;">Khối Lượng Cân Tươi (Kg)</th>
              <th style="text-align: center;">Ghi Chú</th>
            </tr>
          </thead>
          <tbody>
            ${batches.map((b, i) => `
              <tr>
                <td style="text-align: center;">Mẻ #${i + 1}</td>
                <td style="text-align: center;">${b.so_bao} bao</td>
                <td style="text-align: right;"><strong>${Number(b.kg).toLocaleString('vi-VN')} kg</strong></td>
                <td style="text-align: center; color: #666; font-size: 12px;">Cân tại bờ</td>
              </tr>
            `).join('')}
            <tr style="background: #f9f9f9; font-weight: bold;">
              <td style="text-align: center;">TỔNG CỘNG</td>
              <td style="text-align: center; color: #d97706; font-size: 14px;">${s.tong_so_bao} bao</td>
              <td style="text-align: right; color: #059669; font-size: 14px;">${Number(s.luong_tuoi_kg).toLocaleString('vi-VN')} kg</td>
              <td style="text-align: center;">Lượng tươi</td>
            </tr>
          </tbody>
        </table>

        <!-- Summary Calculation Box -->
        <div style="border: 1px solid #000; background: #fafafa; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 13px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td width="50%">1. Tổng khối lượng lúa tươi:</td>
              <td style="text-align: right; font-weight: bold;">${Number(s.luong_tuoi_kg).toLocaleString('vi-VN')} kg</td>
            </tr>
            <tr>
              <td>2. Tỷ lệ trừ tạp chất / độ ẩm:</td>
              <td style="text-align: right; font-weight: bold; color: #ef4444;">-${s.ty_le_tru_pct != null ? s.ty_le_tru_pct : 12}% (${Number(s.luong_tuoi_kg - s.luong_kho_kg).toFixed(1)} kg)</td>
            </tr>
            <tr>
              <td>3. Khối lượng lúa khô quy đổi thanh toán:</td>
              <td style="text-align: right; font-weight: bold; color: #0284c7; font-size: 14px;">${Number(s.luong_kho_kg).toLocaleString('vi-VN')} kg</td>
            </tr>
            <tr>
              <td>4. Đơn giá thu mua thỏa thuận:</td>
              <td style="text-align: right; font-weight: bold;">${Number(s.don_gia_kg).toLocaleString('vi-VN')} đ / kg</td>
            </tr>
            <tr style="border-top: 1px solid #000; font-size: 15px;">
              <td style="padding-top: 6px;"><strong>5. TỔNG SỐ TIỀN THANH TOÁN:</strong></td>
              <td style="text-align: right; font-weight: bold; color: #059669; font-size: 16px; padding-top: 6px;">${AgriData.formatCurrency(s.thanh_tien)}</td>
            </tr>
          </table>
          ${s.ghi_chu ? `<div style="margin-top: 6px; font-style: italic; font-size: 12px;">* Ghi chú: ${s.ghi_chu}</div>` : ''}
        </div>

        <div style="font-size: 13px; margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center;">
          <div>
            <strong>CHỦ HỘ NÔNG DÂN</strong><br>
            <span style="font-size: 11px; font-style: italic;">(Ký, ghi rõ họ tên)</span><br><br><br><br>
            <strong>${s.ho_sx}</strong>
          </div>
          <div>
            <strong>LÁI XE VẬN CHUYỂN</strong><br>
            <span style="font-size: 11px; font-style: italic;">(Ký, ghi rõ họ tên)</span><br><br><br><br>
            <strong>${s.xe_nhan}</strong>
          </div>
          <div>
            <strong>CÁN BỘ CÂN THU MUA</strong><br>
            <span style="font-size: 11px; font-style: italic;">(Ký, ghi rõ họ tên)</span><br><br><br><br>
            <strong>${s.can_bo_can}</strong>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeReceiptModal() {
    const modal = document.getElementById('modal-weighing-receipt');
    if (modal) modal.classList.remove('open');
  },

  printCurrentReceipt() {
    if (!this.selectedSession) return;
    const content = document.getElementById('weighing-receipt-content');
    if (!content) return;

    const printWin = window.open('', '_blank', 'width=850,height=800');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Phiếu Cân Lúa #${this.selectedSession.stt} - ${this.selectedSession.ho_sx}</title>
        <style>
          body { font-family: 'Times New Roman', serif; margin: 0; padding: 20px; color: #000; }
          @media print { @page { size: A5 landscape; margin: 10mm; } body { padding: 0; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  },

  // =========================================================================
  // 8. PRINT PURCHASING SUMMARY REGISTER (A4 LANDSCAPE)
  // =========================================================================
  printPurchasingSummary() {
    const sessions = this.filteredSessions.length > 0 ? this.filteredSessions : AgriData.getPurchasingSessions();
    if (sessions.length === 0) {
      alert('Không có dữ liệu phiên cân để in bảng kê!');
      return;
    }

    let grandFresh = 0;
    let grandDry = 0;
    let grandBags = 0;
    let grandTotal = 0;

    const printWin = window.open('', '_blank', 'width=1050,height=850');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng Kê Tổng Hợp Thu Mua Nông Sản Toàn Xã</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; font-size: 12px; line-height: 1.3; }
          .header-box { display: flex; justify-content: space-between; margin-bottom: 12px; }
          .title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 8px 0 3px; }
          .sub { text-align: center; font-style: italic; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #000; padding: 4px 6px; }
          th { background: #f0f0f0; text-align: center; }
          .center { text-align: center; }
          .num { text-align: right; }
          .total-row { font-weight: bold; background: #e2e8f0; }
          .footer-box { margin-top: 25px; display: flex; justify-content: space-between; text-align: center; }
          @media print { @page { size: A4 landscape; margin: 12mm; } }
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

        <div class="title">BẢNG KÊ QUYẾT TOÁN THU MUA LÚA VỤ MÙA 2026</div>
        <div class="sub">Tổng số phiên cân: <strong>${sessions.length}</strong> phiên • Đơn vị thu mua: HTX Nông nghiệp Hòa Tiến</div>

        <table>
          <thead>
            <tr>
              <th width="35">STT</th>
              <th>Thời Gian</th>
              <th>Họ và Tên Hộ</th>
              <th>Địa Bàn</th>
              <th>Xứ Đồng</th>
              <th>Cán Bộ Cân</th>
              <th>Xe Nhận</th>
              <th>Giống</th>
              <th>Số Bao</th>
              <th>Lượng Tươi (kg)</th>
              <th>Trừ %</th>
              <th>Lượng Khô (kg)</th>
              <th>Đơn Giá</th>
              <th>THÀNH TIỀN (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            ${sessions.map(s => {
              grandFresh += (parseFloat(s.luong_tuoi_kg) || 0);
              grandDry += (parseFloat(s.luong_kho_kg) || 0);
              grandBags += (parseInt(s.tong_so_bao) || 0);
              grandTotal += (parseFloat(s.thanh_tien) || 0);

              return `
                <tr>
                  <td class="center">#${s.stt}</td>
                  <td class="center">${s.ngay_can || '-'}</td>
                  <td><strong>${s.ho_sx}</strong></td>
                  <td class="center">${s.dia_chi || '-'}</td>
                  <td>${s.xu_dong}</td>
                  <td>${s.can_bo_can}</td>
                  <td>${s.xe_nhan}</td>
                  <td class="center">${s.loai_giong}</td>
                  <td class="center"><strong>${s.tong_so_bao}</strong></td>
                  <td class="num">${Number(s.luong_tuoi_kg).toLocaleString('vi-VN')}</td>
                  <td class="center">-${s.ty_le_tru_pct != null ? s.ty_le_tru_pct : 12}%</td>
                  <td class="num"><strong>${Number(s.luong_kho_kg).toLocaleString('vi-VN')}</strong></td>
                  <td class="num">${Number(s.don_gia_kg).toLocaleString('vi-VN')}</td>
                  <td class="num"><strong>${Number(s.thanh_tien).toLocaleString('vi-VN')}</strong></td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="8" class="center">TỔNG CỘNG TOÀN XÃ</td>
              <td class="center">${grandBags} bao</td>
              <td class="num">${Number(grandFresh).toLocaleString('vi-VN')} kg</td>
              <td class="center">-</td>
              <td class="num">${Number(grandDry).toLocaleString('vi-VN')} kg</td>
              <td class="center">-</td>
              <td class="num">${Number(grandTotal).toLocaleString('vi-VN')} đ</td>
            </tr>
          </tbody>
        </table>

        <div class="footer-box">
          <div>
            <strong>NGƯỜI LẬP BẢNG KÊ</strong><br>
            <em>(Ký, ghi rõ họ tên)</em>
          </div>
          <div>
            <strong>KẾ TOÁN THU MUA</strong><br>
            <em>(Ký, ghi rõ họ tên)</em>
          </div>
          <div>
            <em>Hòa Tiến, ngày ..... tháng ..... năm 2026</em><br>
            <strong>TM. BAN QUẢN TRỊ HTX NÔNG NGHIỆP</strong><br>
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

  // =========================================================================
  // 9. EXPORT CSV (UTF-8 WITH BOM)
  // =========================================================================
  exportToExcel() {
    const sessions = this.filteredSessions.length > 0 ? this.filteredSessions : AgriData.getPurchasingSessions();
    if (sessions.length === 0) {
      alert('Không có dữ liệu phiên cân để xuất Excel!');
      return;
    }

    let csvContent = '\uFEFF';
    const headerCols = [
      'STT',
      'Thời Gian Cân',
      'Họ và Tên Hộ',
      'Địa Bàn (Tổ)',
      'Số Điện Thoại',
      'Xứ Đồng Thu Hoạch',
      'Cán Bộ Phụ Trách Cân',
      'Xe Nhận Vận Chuyển',
      'Loại Giống Lúa',
      'Tổng Số Bao',
      'Lượng Tươi (Kg)',
      'Tỷ Lệ Trừ (%)',
      'Lượng Khô Quy Đổi (Kg)',
      'Đơn Giá (VNĐ/kg)',
      'THÀNH TIỀN (VNĐ)',
      'Ghi Chú'
    ];
    csvContent += headerCols.join(',') + '\n';

    sessions.forEach(s => {
      const row = [
        s.stt || '',
        `"${(s.ngay_can || '').replace(/"/g, '""')}"`,
        `"${(s.ho_sx || '').replace(/"/g, '""')}"`,
        `"${(s.dia_chi || '').replace(/"/g, '""')}"`,
        `"${(s.dien_thoai || '').replace(/"/g, '""')}"`,
        `"${(s.xu_dong || '').replace(/"/g, '""')}"`,
        `"${(s.can_bo_can || '').replace(/"/g, '""')}"`,
        `"${(s.xe_nhan || '').replace(/"/g, '""')}"`,
        `"${(s.loai_giong || '').replace(/"/g, '""')}"`,
        s.tong_so_bao || 0,
        s.luong_tuoi_kg || 0,
        s.ty_le_tru_pct != null ? s.ty_le_tru_pct : 12,
        s.luong_kho_kg || 0,
        s.don_gia_kg || 0,
        s.thanh_tien || 0,
        `"${(s.ghi_chu || '').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_Ke_Thu_Mua_Lua_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  clearAllSessions() {
    if (!confirm('Bạn có chắc chắn muốn XÓA TRẮNG toàn bộ dữ liệu các phiên cân thu mua không?\n\nThao tác này sẽ làm sạch danh sách để bắt đầu vụ thu mua mới.')) {
      return;
    }
    if (!AgriData.data) AgriData.data = {};
    AgriData.data.purchasing_sessions = [];
    AgriData.saveCustomRawData();
    AgriData.persist();
    this.populateFilterDropdowns();
    this.filterSessions();
    if (window.AgriAnalytics) AgriAnalytics.renderKPIs();

    // Xóa toàn bộ dữ liệu trên Supabase Cloud
    const client = window.supabaseClient || (window.SupabaseConfig && SupabaseConfig.getClient());
    if (client && navigator.onLine) {
      client.from('purchasing_sessions').delete().neq('id', '___none___').then(({ error }) => {
        if (error) console.warn('⚠️ [Supabase Clear All Warning]:', error);
        else console.log('✅ [Supabase Clear All Success]: All sessions wiped on cloud');
      });
    }

    if (window.AgriSync) {
      AgriSync.broadcastEvent('PURCHASING_ALL_SESSIONS_CLEARED', {});
    }
    if (window.AgriAuth) {
      AgriAuth.logActivity('XÓA TOÀN BỘ PHIÊN CÂN', 'Đã xóa trắng toàn bộ dữ liệu thu mua lúa');
    }
    alert('Đã xóa trắng toàn bộ dữ liệu phiên cân trong phân hệ Thu Mua thành công!');
  }
};

// Expose globally
window.AgriPurchasing = AgriPurchasing;
