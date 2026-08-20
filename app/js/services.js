/**
 * AGRIGIS SERVICES & FEES MODULE
 * (Hệ thống Quản lý Phí & Dịch vụ Nông Nghiệp HTX Động)
 * - Tự do Thêm, Sửa, Xóa, Bật/Tắt các khoản phí dịch vụ vụ mùa
 * - Tự động tính toán theo m² và Sào Trung Bộ (500m²)
 * - Bảng quyết toán động tự sinh cột theo các khoản phí đang áp dụng
 * - Quản lý trạng thái thu nộp tiền dịch vụ (Đã thu / Chưa thu)
 * - In phiếu báo thu chi tiết A4/A5, In phiếu thu hàng loạt & Xuất Excel
 */

const AgriServices = {
  priceUnit: 'm2', // 'm2' | 'sao'
  filteredFarmers: [],
  selectedFarmer: null,

  init() {
    this.bindEvents();
    this.filterServices();
  },

  bindEvents() {
    const searchInput = document.getElementById('services-farmer-search');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => this.filterServices(), 250);
      });
    }
  },

  switchPriceUnit(unit) {
    this.priceUnit = unit;
    document.getElementById('btn-unit-m2')?.classList.toggle('active', unit === 'm2');
    document.getElementById('btn-unit-sao')?.classList.toggle('active', unit === 'sao');
    this.renderServiceCards();
    this.renderTable();
  },

  filterServices() {
    const q = (document.getElementById('services-farmer-search')?.value || '').toLowerCase().trim();
    const to = document.getElementById('services-to-filter')?.value || '';
    const payment = document.getElementById('services-payment-filter')?.value || '';
    const scale = document.getElementById('services-scale-filter')?.value || '';

    const allFarmers = AgriData.getFarmers();
    const payments = (AgriData.data && AgriData.data.payments) || {};

    this.filteredFarmers = allFarmers.filter(f => {
      // 1. Text Search
      if (q) {
        const match = (
          (f.name && f.name.toLowerCase().includes(q)) ||
          (f.dien_thoai && f.dien_thoai.toLowerCase().includes(q)) ||
          (f.dia_chi && f.dia_chi.toLowerCase().includes(q))
        );
        if (!match) return false;
      }

      // 2. Tổ filter
      if (to && f.dia_chi !== to) return false;

      // 3. Payment status filter
      const pStatus = (payments[f.name] && payments[f.name].status) || 'unpaid';
      if (payment && pStatus !== payment) return false;

      // 4. Scale filter
      const area = parseFloat(f.tong_dt) || 0;
      if (scale === 'large' && area < 10000) return false;
      if (scale === 'medium' && (area < 5000 || area >= 10000)) return false;
      if (scale === 'small' && area >= 5000) return false;

      return true;
    });

    this.renderServiceCards();
    this.renderTable();
    this.updateStats();
  },

  resetFilters() {
    const searchInput = document.getElementById('services-farmer-search');
    const toSelect = document.getElementById('services-to-filter');
    const paymentSelect = document.getElementById('services-payment-filter');
    const scaleSelect = document.getElementById('services-scale-filter');

    if (searchInput) searchInput.value = '';
    if (toSelect) toSelect.value = '';
    if (paymentSelect) paymentSelect.value = '';
    if (scaleSelect) scaleSelect.value = '';

    this.filterServices();
  },

  // =========================================================================
  // 1. RENDER SERVICE ITEMS CONFIGURATION CARDS
  // =========================================================================
  renderServiceCards() {
    const container = document.getElementById('service-items-grid');
    if (!container) return;

    const items = AgriData.getServiceItems();
    if (!items || items.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-muted); text-align: center; padding: 1rem;">Chưa có khoản phí nào. Hãy bấm "Thêm Khoản Phí" để bắt đầu thiết lập.</p>';
      return;
    }

    container.innerHTML = items.map(item => {
      const priceTxt = this.priceUnit === 'm2'
        ? `${Number(item.price_m2).toLocaleString('vi-VN')} đ/m²`
        : `${Number(item.price_sao || item.price_m2 * 500).toLocaleString('vi-VN')} đ/sào`;

      const subPriceTxt = this.priceUnit === 'm2'
        ? `~${Number(item.price_sao || item.price_m2 * 500).toLocaleString('vi-VN')} đ/sào (500m²)`
        : `~${Number(item.price_m2).toLocaleString('vi-VN')} đ/m²`;

      return `
        <div class="service-card-item ${item.is_active ? '' : 'inactive'}">
          <div class="service-card-top">
            <div>
              <div class="service-card-name">${item.name}</div>
              <div class="service-card-desc">${item.description || 'Dịch vụ phục vụ sản xuất lúa mùa vụ'}</div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <button class="btn btn-outline btn-sm" style="padding: 3px 6px;" onclick="AgriServices.openEditServiceModal('${item.id}')" title="Sửa đơn giá / thông tin">
                <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
              </button>
              <button class="btn btn-outline btn-sm" style="padding: 3px 6px; color: #ef4444;" onclick="AgriServices.deleteServiceItem('${item.id}')" title="Xóa khoản phí này">
                <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
              </button>
            </div>
          </div>

          <div class="service-card-price-row">
            <div>
              <div class="service-price-val">${priceTxt}</div>
              <small style="color: var(--text-muted); font-size: 0.7rem;">${subPriceTxt}</small>
            </div>
            <div>
              <button class="btn btn-sm ${item.is_active ? 'btn-emerald' : 'btn-outline'}" style="font-size: 0.72rem; padding: 4px 8px;" onclick="AgriServices.toggleServiceItem('${item.id}')">
                <i data-lucide="${item.is_active ? 'check-circle' : 'pause-circle'}" style="width: 12px; height: 12px;"></i>
                ${item.is_active ? 'Đang áp dụng' : 'Tạm ngưng'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  // =========================================================================
  // 2. RENDER DYNAMIC FEES TABLE
  // =========================================================================
  renderTable() {
    const thead = document.getElementById('services-thead');
    const tbody = document.getElementById('services-tbody');
    if (!thead || !tbody) return;

    const items = AgriData.getServiceItems().filter(s => s.is_active);

    // 2.1 Dynamic Table Header
    thead.innerHTML = `
      <tr>
        <th width="45" class="center-cell">STT</th>
        <th style="min-width: 170px;">Hộ Sản Xuất</th>
        <th style="min-width: 75px;">Địa Bàn</th>
        <th style="min-width: 105px;">Điện Thoại</th>
        <th class="num-cell" style="min-width: 105px;">Tổng DT (m²)</th>
        ${items.map(item => `
          <th class="num-cell" style="min-width: 110px;" title="${item.description || ''}">
            ${item.name}
            <small style="display: block; font-size: 0.68rem; color: var(--text-muted); font-weight: normal;">
              (${Number(this.priceUnit === 'm2' ? item.price_m2 : item.price_sao).toLocaleString('vi-VN')} đ/${this.priceUnit === 'm2' ? 'm²' : 'sào'})
            </small>
          </th>
        `).join('')}
        <th class="num-cell" style="min-width: 125px; color: var(--primary); font-weight: 800;">TỔNG PHÍ (VNĐ)</th>
        <th class="center-cell" style="min-width: 115px;">Trạng Thái Thu</th>
        <th width="115" class="center-cell">Thao Tác</th>
      </tr>
    `;

    // 2.2 Dynamic Table Body
    if (this.filteredFarmers.length === 0) {
      const colSpan = 7 + items.length;
      tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">Không tìm thấy hộ sản xuất nào phù hợp theo tiêu chí lọc.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.filteredFarmers.map((f, idx) => {
      const fees = AgriData.calculateFarmerFees(f);
      const isPaid = fees.payment.status === 'paid';

      return `
        <tr>
          <td class="center-cell">${idx + 1}</td>
          <td>
            <strong style="color: var(--text-main); cursor: pointer;" onclick="AgriFarmers.showDetail('${f.name}')" title="Xem hồ sơ canh tác">${f.name}</strong>
          </td>
          <td><span class="badge badge-blue">${f.dia_chi || 'Tổ --'}</span></td>
          <td>
            ${f.dien_thoai ? `<a href="tel:${f.dien_thoai}" style="color: var(--accent); text-decoration: none; font-size: 0.8rem;"><i data-lucide="phone" style="width: 11px; height: 11px;"></i> ${f.dien_thoai}</a>` : '-'}
          </td>
          <td class="num-cell">
            <strong>${Number(f.tong_dt).toLocaleString('vi-VN')}</strong>
            <small style="color: var(--text-muted); display: block;">${f.dt_ha} ha (${(f.tong_dt/500).toFixed(1)} sào)</small>
          </td>
          ${items.map(item => {
            const b = fees.breakdown.find(x => x.id === item.id);
            const amount = b ? b.amount : 0;
            return `<td class="num-cell">${amount > 0 ? AgriData.formatCurrency(amount) : '-'}</td>`;
          }).join('')}
          <td class="num-cell">
            <strong style="color: var(--primary); font-size: 0.95rem;">${AgriData.formatCurrency(fees.total)}</strong>
          </td>
          <td class="center-cell">
            <button class="btn btn-sm ${isPaid ? 'badge-paid' : 'badge-unpaid'}" style="cursor: pointer; padding: 4px 8px; font-size: 0.72rem;" onclick="AgriServices.togglePaymentStatus('${f.name}')" title="Bấm để đổi trạng thái thu tiền">
              <i data-lucide="${isPaid ? 'check' : 'clock'}" style="width: 11px; height: 11px;"></i>
              ${isPaid ? 'Đã thu đủ' : 'Chưa nộp'}
            </button>
          </td>
          <td class="center-cell">
            <button class="btn btn-outline btn-sm" onclick="AgriServices.previewReceipt('${f.name}')" title="Xem & In phiếu báo thu chi tiết">
              <i data-lucide="printer" style="width: 13px; height: 13px;"></i> In Phiếu
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  // =========================================================================
  // 3. LIVE FINANCIAL STATS RIBBON
  // =========================================================================
  updateStats() {
    const totalAmountEl = document.getElementById('service-total-amount-display');
    const totalAreaEl = document.getElementById('service-total-area-display');
    const avgAmountEl = document.getElementById('service-avg-amount-display');
    const paymentProgressEl = document.getElementById('service-payment-progress-display');

    const totalFarmers = this.filteredFarmers.length;
    let grandTotalAmount = 0;
    let grandTotalArea = 0;
    let paidCount = 0;

    this.filteredFarmers.forEach(f => {
      const fees = AgriData.calculateFarmerFees(f);
      grandTotalAmount += fees.total;
      grandTotalArea += (parseFloat(f.tong_dt) || 0);
      if (fees.payment.status === 'paid') paidCount++;
    });

    const avgAmount = totalFarmers > 0 ? Math.round(grandTotalAmount / totalFarmers) : 0;
    const paidPercent = totalFarmers > 0 ? Math.round((paidCount / totalFarmers) * 100) : 0;

    if (totalAmountEl) totalAmountEl.textContent = AgriData.formatCurrency(grandTotalAmount);
    if (totalAreaEl) totalAreaEl.textContent = `${(grandTotalArea / 10000).toFixed(2)} ha (${totalFarmers} hộ)`;
    if (avgAmountEl) avgAmountEl.textContent = `${AgriData.formatCurrency(avgAmount)} / hộ`;
    if (paymentProgressEl) paymentProgressEl.textContent = `${paidCount} / ${totalFarmers} hộ đã thu (${paidPercent}%)`;
  },

  // =========================================================================
  // 4. SERVICE ITEMS CRUD (THÊM / SỬA / XÓA KHOẢN PHÍ)
  // =========================================================================
  openAddServiceModal() {
    document.getElementById('modal-service-crud-title').textContent = 'Thêm Khoản Phí Dịch Vụ Mới';
    document.getElementById('modal-service-crud-sub').textContent = 'Bổ sung dịch vụ mới vào danh mục biểu phí vụ mùa';
    document.getElementById('service-crud-id').value = '';
    document.getElementById('service-crud-name').value = '';
    document.getElementById('service-crud-price-m2').value = '100';
    document.getElementById('service-crud-price-sao').value = '50000';
    document.getElementById('service-crud-unit').value = 'm²';
    document.getElementById('service-crud-active').value = 'true';
    document.getElementById('service-crud-desc').value = '';

    const modal = document.getElementById('modal-service-crud');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  openEditServiceModal(itemId) {
    const items = AgriData.getServiceItems();
    const item = items.find(s => s.id === itemId);
    if (!item) return;

    document.getElementById('modal-service-crud-title').textContent = `Chỉnh Sửa: ${item.name}`;
    document.getElementById('modal-service-crud-sub').textContent = `Cập nhật đơn giá & trạng thái áp dụng`;
    document.getElementById('service-crud-id').value = item.id;
    document.getElementById('service-crud-name').value = item.name;
    document.getElementById('service-crud-price-m2').value = item.price_m2;
    document.getElementById('service-crud-price-sao').value = item.price_sao || (item.price_m2 * 500);
    document.getElementById('service-crud-unit').value = item.unit || 'm²';
    document.getElementById('service-crud-active').value = item.is_active ? 'true' : 'false';
    document.getElementById('service-crud-desc').value = item.description || '';

    const modal = document.getElementById('modal-service-crud');
    if (modal) modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  closeCrudModal() {
    const modal = document.getElementById('modal-service-crud');
    if (modal) modal.classList.remove('open');
  },

  syncPriceInput(source) {
    const m2Input = document.getElementById('service-crud-price-m2');
    const saoInput = document.getElementById('service-crud-price-sao');
    if (!m2Input || !saoInput) return;

    if (source === 'm2') {
      const m2 = parseFloat(m2Input.value) || 0;
      saoInput.value = Math.round(m2 * 500);
    } else if (source === 'sao') {
      const sao = parseFloat(saoInput.value) || 0;
      m2Input.value = (sao / 500).toFixed(1);
    }
  },

  saveServiceModal() {
    const id = document.getElementById('service-crud-id').value.trim();
    const name = document.getElementById('service-crud-name').value.trim();
    const priceM2 = parseFloat(document.getElementById('service-crud-price-m2').value) || 0;
    const priceSao = parseFloat(document.getElementById('service-crud-price-sao').value) || (priceM2 * 500);
    const unit = document.getElementById('service-crud-unit').value;
    const isActive = document.getElementById('service-crud-active').value === 'true';
    const desc = document.getElementById('service-crud-desc').value.trim();

    if (!name) {
      alert('Vui lòng nhập Tên khoản phí dịch vụ!');
      return;
    }

    const itemObj = {
      name: name,
      price_m2: priceM2,
      price_sao: priceSao,
      unit: unit,
      is_active: isActive,
      description: desc
    };

    if (id) {
      AgriData.updateServiceItem(id, itemObj);
      alert(`Đã cập nhật thành công khoản phí "${name}"!`);
    } else {
      AgriData.addServiceItem(itemObj);
      alert(`Đã thêm mới thành công khoản phí "${name}"!`);
    }

    this.closeCrudModal();
    this.filterServices();
  },

  deleteServiceItem(itemId) {
    const items = AgriData.getServiceItems();
    const item = items.find(s => s.id === itemId);
    if (!item) return;

    if (!confirm(`Bạn có chắc chắn muốn XÓA khoản phí "${item.name}" không? Toàn bộ bảng tính phí sẽ được cập nhật lại.`)) {
      return;
    }

    AgriData.deleteServiceItem(itemId);
    this.filterServices();
  },

  toggleServiceItem(itemId) {
    AgriData.toggleServiceItem(itemId);
    this.filterServices();
  },

  // =========================================================================
  // 5. PAYMENT STATUS TOGGLE
  // =========================================================================
  togglePaymentStatus(farmerName) {
    const f = AgriData.findFarmer(farmerName);
    if (!f) return;

    const fees = AgriData.calculateFarmerFees(f);
    const currentStatus = fees.payment.status;
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';

    AgriData.setFarmerPaymentStatus(farmerName, newStatus);
    this.filterServices();
  },

  // =========================================================================
  // 6. SINGLE RECEIPT PREVIEW & MODAL
  // =========================================================================
  previewReceipt(farmerName) {
    const f = AgriData.findFarmer(farmerName);
    if (!f) return;
    this.selectedFarmer = f;

    const fees = AgriData.calculateFarmerFees(f);
    const modal = document.getElementById('modal-receipt-preview');
    const content = document.getElementById('receipt-content');
    if (!modal || !content) return;

    const today = new Date();
    const dateStr = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

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
          <h2 style="font-size: 16px; margin: 0; font-weight: bold; text-transform: uppercase;">PHIẾU BÁO THU TIỀN DỊCH VỤ NÔNG NGHIỆP</h2>
          <p style="font-size: 12px; font-style: italic; margin-top: 3px;">(Vụ Sản Xuất Nông Nghiệp Năm 2026)</p>
        </div>

        <div style="border: 1px solid #000; padding: 10px; border-radius: 4px; margin-bottom: 12px; font-size: 13px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div><strong>Họ và tên chủ hộ:</strong> ${f.name}</div>
            <div><strong>Địa bàn cư trú:</strong> ${f.dia_chi || 'Tổ --'} - Xã Hòa Tiến</div>
            <div><strong>Số điện thoại:</strong> ${f.dien_thoai || '......................'}</div>
            <div><strong>Số CCCD:</strong> ${f.cccd || '......................'}</div>
          </div>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #999;">
            <strong>Tổng diện tích canh tác:</strong> <span style="font-size: 14px; font-weight: bold;">${Number(f.tong_dt).toLocaleString('vi-VN')} m²</span> (${f.dt_ha} ha ~ ${(f.tong_dt/500).toFixed(1)} sào Trung Bộ - ${f.so_thua} thửa đất)
            <br><em>Xứ đồng canh tác:</em> ${(f.xu_dong_list || []).join(', ')}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px;" border="1" cellpadding="6">
          <thead>
            <tr style="background: #f0f0f0;">
              <th width="40" style="text-align: center;">STT</th>
              <th>Nội Dung Khoản Phí / Dịch Vụ</th>
              <th width="90" style="text-align: center;">ĐVT</th>
              <th width="110" style="text-align: right;">Đơn Giá (đ)</th>
              <th width="130" style="text-align: right;">Thành Tiền (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            ${fees.breakdown.map((b, i) => `
              <tr>
                <td style="text-align: center;">${i + 1}</td>
                <td><strong>${b.name}</strong></td>
                <td style="text-align: center;">${b.unit}</td>
                <td style="text-align: right;">${Number(b.price_m2).toLocaleString('vi-VN')} đ/m²</td>
                <td style="text-align: right;"><strong>${AgriData.formatCurrency(b.amount)}</strong></td>
              </tr>
            `).join('')}
            <tr style="background: #f9f9f9; font-weight: bold; font-size: 14px;">
              <td colspan="4" style="text-align: center;">TỔNG CỘNG TIỀN DỊCH VỤ PHẢI NỘP</td>
              <td style="text-align: right; color: #059669; font-size: 15px;">${AgriData.formatCurrency(fees.total)}</td>
            </tr>
          </tbody>
        </table>

        <div style="font-style: italic; font-size: 12px; margin-bottom: 15px;">
          * Ghi chú: Kính đề nghị hộ nông dân kiểm tra kỹ đối soát diện tích và nộp tiền dịch vụ đúng thời hạn quy định của HTX.
        </div>

        <div style="font-size: 13px; margin-top: 20px; display: flex; justify-content: space-between; text-align: center;">
          <div>
            <strong>CHỦ HỘ NÔNG DÂN</strong><br>
            <span style="font-size: 11px; font-style: italic;">(Ký, ghi rõ họ tên)</span><br><br><br><br>
            <strong>${f.name}</strong>
          </div>
          <div>
            <em>Hòa Tiến, ${dateStr}</em><br>
            <strong>TM. BAN QUẢN TRỊ HTX NÔNG NGHIỆP</strong><br>
            <span style="font-size: 11px; font-style: italic;">(Ký tên & đóng dấu)</span><br><br><br><br>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  // =========================================================================
  // 7. BATCH PRINTING & SUMMARY REGISTER PRINT
  // =========================================================================
  printBatchReceipts() {
    const farmers = this.filteredFarmers.length > 0 ? this.filteredFarmers : AgriData.getFarmers();
    if (farmers.length === 0) {
      alert('Không có dữ liệu hộ nông dân để in phiếu thu!');
      return;
    }

    const printWin = window.open('', '_blank', 'width=900,height=850');
    if (!printWin) return;

    const today = new Date();
    const dateStr = `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`;

    const receiptsHtml = farmers.map(f => {
      const fees = AgriData.calculateFarmerFees(f);
      return `
        <div class="receipt-page">
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

          <div class="title">PHIẾU BÁO THU TIỀN DỊCH VỤ NÔNG NGHIỆP</div>
          <div class="sub">(Vụ Sản Xuất Nông Nghiệp Năm 2026)</div>

          <div class="profile-box">
            <div><strong>Hộ nông dân:</strong> ${f.name} • <strong>Địa chỉ:</strong> ${f.dia_chi || 'Tổ --'} • <strong>SĐT:</strong> ${f.dien_thoai || '......................'}</div>
            <div><strong>Tổng diện tích:</strong> <strong>${Number(f.tong_dt).toLocaleString('vi-VN')} m²</strong> (${f.dt_ha} ha ~ ${(f.tong_dt/500).toFixed(1)} sào - ${f.so_thua} thửa đất)</div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="35">STT</th>
                <th>Khoản Phí / Dịch Vụ</th>
                <th width="70">ĐVT</th>
                <th width="100">Đơn Giá</th>
                <th width="120">Thành Tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              ${fees.breakdown.map((b, i) => `
                <tr>
                  <td class="center">${i + 1}</td>
                  <td><strong>${b.name}</strong></td>
                  <td class="center">${b.unit}</td>
                  <td class="num">${Number(b.price_m2).toLocaleString('vi-VN')} đ</td>
                  <td class="num"><strong>${AgriData.formatCurrency(b.amount)}</strong></td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="4" class="center">TỔNG CỘNG TIỀN PHẢI NỘP</td>
                <td class="num" style="color: #059669; font-size: 14px;">${AgriData.formatCurrency(fees.total)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer-box">
            <div>
              <strong>CHỦ HỘ NÔNG DÂN</strong><br>
              <em>(Ký, họ tên)</em><br><br><br>
              <strong>${f.name}</strong>
            </div>
            <div>
              <em>Hòa Tiến, ${dateStr}</em><br>
              <strong>TM. BAN QUẢN TRỊ HTX</strong><br>
              <em>(Ký tên, đóng dấu)</em>
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>In Hàng Loạt Phiếu Báo Thu Tiền Dịch Vụ</title>
        <style>
          body { font-family: 'Times New Roman', serif; margin: 0; padding: 15px; color: #000; font-size: 13px; line-height: 1.35; }
          .receipt-page { border: 1px dashed #666; padding: 20px; margin-bottom: 25px; page-break-after: always; }
          .header-box { display: flex; justify-content: space-between; margin-bottom: 12px; }
          .title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin-top: 8px; }
          .sub { text-align: center; font-style: italic; margin-bottom: 10px; }
          .profile-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #000; padding: 5px 6px; }
          th { background: #f0f0f0; text-align: center; }
          .center { text-align: center; }
          .num { text-align: right; }
          .total-row { font-weight: bold; background: #f9f9f9; }
          .footer-box { margin-top: 25px; display: flex; justify-content: space-between; text-align: center; }
          @media print {
            body { padding: 0; }
            .receipt-page { border: none; padding: 15mm; margin-bottom: 0; height: 100vh; box-sizing: border-box; }
            @page { size: A4 portrait; margin: 0; }
          }
        </style>
      </head>
      <body>
        ${receiptsHtml}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
  },

  printFeeSummary() {
    const farmers = this.filteredFarmers.length > 0 ? this.filteredFarmers : AgriData.getFarmers();
    const items = AgriData.getServiceItems().filter(s => s.is_active);

    let grandTotal = 0;
    let grandArea = 0;

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bảng Kê Quyết Toán Tiền Dịch Vụ Nông Nghiệp Toàn Xã</title>
        <style>
          body { font-family: 'Times New Roman', serif; padding: 20px; color: #000; font-size: 12px; line-height: 1.3; }
          .header-box { display: flex; justify-content: space-between; margin-bottom: 15px; }
          .title { text-align: center; font-size: 17px; font-weight: bold; text-transform: uppercase; margin: 10px 0 4px; }
          .sub { text-align: center; font-style: italic; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 4px 6px; }
          th { background: #f0f0f0; text-align: center; }
          .center { text-align: center; }
          .num { text-align: right; }
          .total-row { font-weight: bold; background: #e2e8f0; }
          .footer-box { margin-top: 30px; display: flex; justify-content: space-between; text-align: center; }
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

        <div class="title">BẢNG KÊ QUYẾT TOÁN TIỀN DỊCH VỤ NÔNG NGHIỆP VỤ MÙA 2026</div>
        <div class="sub">Tổng số hộ: <strong>${farmers.length}</strong> hộ • Các khoản dịch vụ áp dụng: <strong>${items.map(s => s.name).join(', ')}</strong></div>

        <table>
          <thead>
            <tr>
              <th width="35">STT</th>
              <th>Họ và Tên Hộ</th>
              <th>Địa Bàn</th>
              <th>Điện Thoại</th>
              <th>Tổng DT (m²)</th>
              ${items.map(s => `<th>${s.name}</th>`).join('')}
              <th>TỔNG PHÍ (VNĐ)</th>
              <th>Trạng Thái</th>
            </tr>
          </thead>
          <tbody>
            ${farmers.map((f, idx) => {
              const fees = AgriData.calculateFarmerFees(f);
              grandTotal += fees.total;
              grandArea += (parseFloat(f.tong_dt) || 0);
              const isPaid = fees.payment.status === 'paid';

              return `
                <tr>
                  <td class="center">${idx + 1}</td>
                  <td><strong>${f.name}</strong></td>
                  <td class="center">${f.dia_chi || 'Tổ --'}</td>
                  <td class="center">${f.dien_thoai || '-'}</td>
                  <td class="num">${Number(f.tong_dt).toLocaleString('vi-VN')}</td>
                  ${items.map(item => {
                    const b = fees.breakdown.find(x => x.id === item.id);
                    const amt = b ? b.amount : 0;
                    return `<td class="num">${amt > 0 ? Number(amt).toLocaleString('vi-VN') : '-'}</td>`;
                  }).join('')}
                  <td class="num"><strong>${Number(fees.total).toLocaleString('vi-VN')}</strong></td>
                  <td class="center">${isPaid ? 'Đã thu' : 'Chưa thu'}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="4" class="center">TỔNG CỘNG TOÀN XÃ</td>
              <td class="num">${Number(grandArea).toLocaleString('vi-VN')} m²</td>
              ${items.map(item => {
                const totalItem = farmers.reduce((sum, f) => {
                  const fees = AgriData.calculateFarmerFees(f);
                  const b = fees.breakdown.find(x => x.id === item.id);
                  return sum + (b ? b.amount : 0);
                }, 0);
                return `<td class="num">${Number(totalItem).toLocaleString('vi-VN')}</td>`;
              }).join('')}
              <td class="num">${Number(grandTotal).toLocaleString('vi-VN')} đ</td>
              <td class="center">-</td>
            </tr>
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

  // =========================================================================
  // 8. EXPORT CSV (UTF-8 WITH BOM)
  // =========================================================================
  exportToExcel() {
    const farmers = this.filteredFarmers.length > 0 ? this.filteredFarmers : AgriData.getFarmers();
    const items = AgriData.getServiceItems().filter(s => s.is_active);

    if (farmers.length === 0) {
      alert('Không có dữ liệu để xuất Excel!');
      return;
    }

    let csvContent = '\uFEFF';
    const headerCols = ['STT', 'Họ và Tên Hộ', 'Địa Bàn (Tổ)', 'Điện Thoại', 'Tổng DT (m2)', 'Tổng DT (ha)', ...items.map(s => `"${s.name} (VNĐ)"`), 'TỔNG TIỀN PHẢI NỘP (VNĐ)', 'Trạng Thái Thu Nộp'];
    csvContent += headerCols.join(',') + '\n';

    farmers.forEach((f, idx) => {
      const fees = AgriData.calculateFarmerFees(f);
      const isPaid = fees.payment.status === 'paid' ? 'Đã thu đủ' : 'Chưa nộp';

      const row = [
        idx + 1,
        `"${(f.name || '').replace(/"/g, '""')}"`,
        `"${f.dia_chi || ''}"`,
        `"${f.dien_thoai || ''}"`,
        f.tong_dt || 0,
        f.dt_ha || 0,
        ...items.map(item => {
          const b = fees.breakdown.find(x => x.id === item.id);
          return b ? b.amount : 0;
        }),
        fees.total || 0,
        `"${isPaid}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Quyet_Toan_Phi_Dich_Vu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Global helper for modal close
function closeReceiptModal() {
  const modal = document.getElementById('modal-receipt-preview');
  if (modal) modal.classList.remove('open');
}
