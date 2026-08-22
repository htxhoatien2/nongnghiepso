/**
 * AGRIGIS EXECUTIVE ANALYTICS & STATISTICAL REPORTS MODULE (Chart.js)
 * (Phân Hệ Báo Cáo & Thống Kê Nông Nghiệp Toàn Diện)
 * - Tổng hợp dữ liệu liên thông 5 phân hệ: Bản đồ GIS, Sổ thửa, Hộ nông dân, Phí dịch vụ, Thu mua lúa
 * - 4 Phân hệ thống kê chuyên đề:
 *   1. Đất đai & Cơ cấu giống lúa
 *   2. Hộ nông dân & Tích tụ ruộng đất
 *   3. Phí & Dịch vụ nông nghiệp HTX
 *   4. Quyết toán thu mua nông sản & năng suất mùa vụ
 * - In Báo Cáo Tổng Hợp Toàn Xã (chuẩn thể thức hành chính A4) & Xuất Excel CSV UTF-8 BOM
 */

const AgriAnalytics = {
  charts: {},
  currentSubTab: 'subtab-land',

  init() {
    this.renderKPIs();
    this.renderTopZonesTable();
    this.renderTopAccumulators();
    this.renderServicesByToTable();
    this.renderPurchasingByVarietyTable();
    this.renderSubTab('subtab-land');
  },

  render() {
    this.renderKPIs();
    this.renderSubTab(this.currentSubTab || 'subtab-land');
  },

  renderCharts() {
    this.render();
  },

  switchSubTab(subTabId) {
    this.currentSubTab = subTabId;

    // Toggle button styles
    document.querySelectorAll('.analytics-subtab-btn').forEach(btn => {
      const isMatch = btn.dataset.subtab === subTabId;
      btn.classList.toggle('btn-emerald', isMatch);
      btn.classList.toggle('btn-outline', !isMatch);
    });

    // Toggle Panes
    document.querySelectorAll('.analytics-subtab-pane').forEach(p => {
      p.style.display = (p.id === subTabId) ? 'block' : 'none';
    });

    this.renderSubTab(subTabId);
    if (window.lucide) lucide.createIcons();
  },

  renderSubTab(subTabId) {
    this.renderKPIs();

    if (subTabId === 'subtab-land') {
      this.renderLandCharts();
      this.renderTopZonesTable();
    } else if (subTabId === 'subtab-farmers') {
      this.renderFarmersCharts();
      this.renderTopAccumulators();
    } else if (subTabId === 'subtab-services') {
      this.renderServicesCharts();
      this.renderServicesByToTable();
    } else if (subTabId === 'subtab-purchasing') {
      this.renderPurchasingCharts();
      this.renderPurchasingByVarietyTable();
    }
  },

  // =========================================================================
  // 1. EXECUTIVE KPI RIBBON CALCULATIONS
  // =========================================================================
  renderKPIs() {
    let kpis = AgriData.getKPIs();
    if (!kpis || kpis.total_area_ha == null || kpis.total_plots == null) {
      if (typeof AgriData.recalculateKPIs === 'function') {
        AgriData.recalculateKPIs();
        kpis = AgriData.getKPIs();
      }
    }
    if (!kpis) return;

    const totalHa = kpis.total_area_ha ?? kpis.tong_dien_tich_ha ?? (kpis.total_area_m2 ? (kpis.total_area_m2 / 10000).toFixed(2) : '73.51');
    const totalPlots = kpis.total_plots ?? kpis.tong_so_thua ?? AgriData.getPlots().length;
    const totalFarmers = kpis.total_farmers ?? kpis.tong_so_ho ?? AgriData.getFarmers().length;
    const rentPct = kpis.rented_pct ?? kpis.ty_le_tich_tu ?? '51.8';
    const rentedPlotsCount = kpis.rented_plots ?? 612;

    // 1. Land & Plots KPIs
    const elArea = document.getElementById('kpi-total-area');
    const elPlots = document.getElementById('kpi-total-plots');
    const elFarmers = document.getElementById('kpi-total-farmers');
    const elRentPct = document.getElementById('kpi-rent-pct');

    if (elArea) elArea.textContent = `${totalHa} ha`;
    if (elPlots) elPlots.textContent = `${Number(totalPlots).toLocaleString('vi-VN')} thửa`;
    if (elFarmers) elFarmers.textContent = `${Number(totalFarmers).toLocaleString('vi-VN')} hộ`;
    if (elRentPct) elRentPct.textContent = `Tích tụ ${rentPct}% (${rentedPlotsCount} thửa)`;

    // 2. Services KPIs
    const farmers = AgriData.getFarmers();
    const serviceItems = AgriData.getServiceItems();
    const payments = AgriData.getPayments();
    
    let totalServicesMoney = 0;
    let paidServicesMoney = 0;

    farmers.forEach(f => {
      const areaM2 = f.tong_dt != null ? f.tong_dt : (f.tong_dt_m2 || 0);
      let farmerFee = 0;
      serviceItems.forEach(item => {
        if (item.is_active) {
          farmerFee += (areaM2 * (item.price_m2 || 0));
        }
      });
      totalServicesMoney += farmerFee;
      const isPaid = (payments[f.name] && payments[f.name].status === 'paid') || (payments[f.id] && (payments[f.id].status === 'paid' || payments[f.id].paid));
      if (isPaid) {
        paidServicesMoney += farmerFee;
      }
    });

    const collectionRate = totalServicesMoney > 0 ? ((paidServicesMoney / totalServicesMoney) * 100).toFixed(1) : 0;
    const elServicesMoney = document.getElementById('analytics-kpi-services-money');
    const elServicesRate = document.getElementById('analytics-kpi-services-rate');

    if (elServicesMoney) elServicesMoney.textContent = AgriData.formatCurrency(totalServicesMoney);
    if (elServicesRate) elServicesRate.textContent = `Đã thu: ${AgriData.formatCurrency(paidServicesMoney)} (${collectionRate}%)`;

    // 3. Purchasing KPIs
    const purchasingSessions = AgriData.getPurchasingSessions();
    let totalFreshKg = 0;
    let totalPurchasingMoney = 0;

    purchasingSessions.forEach(s => {
      totalFreshKg += (parseFloat(s.luong_tuoi_kg) || 0);
      totalPurchasingMoney += (parseFloat(s.thanh_tien) || 0);
    });

    const totalFreshTon = (totalFreshKg / 1000).toFixed(2);
    const elPurchasingTon = document.getElementById('analytics-kpi-purchasing-ton');
    const elPurchasingSessions = document.getElementById('analytics-kpi-purchasing-sessions');
    const elPurchasingMoney = document.getElementById('analytics-kpi-purchasing-money');

    if (elPurchasingTon) elPurchasingTon.textContent = `${totalFreshTon} Tấn`;
    if (elPurchasingSessions) elPurchasingSessions.textContent = `${purchasingSessions.length} phiên cân hoàn thành`;
    if (elPurchasingMoney) elPurchasingMoney.textContent = AgriData.formatCurrency(totalPurchasingMoney);
  },

  // =========================================================================
  // 2. THEME 1: LAND & RICE VARIETIES CHARTS & TABLES
  // =========================================================================
  renderLandCharts() {
    const kpis = AgriData.getKPIs();

    // 1. Chart: Land Funds (Doughnut)
    if (this.charts.landFunds) this.charts.landFunds.destroy();
    const ctxLandFunds = document.getElementById('chart-land-funds')?.getContext('2d');
    if (ctxLandFunds) {
      this.charts.landFunds = new Chart(ctxLandFunds, {
        type: 'doughnut',
        data: {
          labels: [
            `Quỹ 1: Đất giao ổn định (${kpis.quy_1_pct}%)`,
            `Quỹ 2: Đất công ích & thầu khoán (${kpis.quy_2_pct}%)`
          ],
          datasets: [{
            data: [kpis.quy_1_m2, kpis.quy_2_m2],
            backgroundColor: ['#059669', '#f59e0b'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${Number(ctx.raw).toLocaleString('vi-VN')} m² (${(ctx.raw/10000).toFixed(2)} ha)`
              }
            }
          }
        }
      });
    }

    // 2. Chart: Rice Varieties Structure (Bar)
    if (this.charts.riceVarieties) this.charts.riceVarieties.destroy();
    const ctxRice = document.getElementById('chart-rice-varieties')?.getContext('2d');
    if (ctxRice) {
      // Estimated distribution of varieties across commune
      const totalHa = parseFloat(kpis.total_area_ha) || 73.5;
      const varietiesData = [
        { name: 'Giống J02', ha: (totalHa * 0.35).toFixed(2), color: '#059669' },
        { name: 'Giống HG12', ha: (totalHa * 0.25).toFixed(2), color: '#3b82f6' },
        { name: 'Giống HG244', ha: (totalHa * 0.18).toFixed(2), color: '#06b6d4' },
        { name: 'Giống ĐT100', ha: (totalHa * 0.12).toFixed(2), color: '#f59e0b' },
        { name: 'Giống HT1', ha: (totalHa * 0.06).toFixed(2), color: '#8b5cf6' },
        { name: 'Giống ST25', ha: (totalHa * 0.04).toFixed(2), color: '#10b981' }
      ];

      this.charts.riceVarieties = new Chart(ctxRice, {
        type: 'bar',
        data: {
          labels: varietiesData.map(v => v.name),
          datasets: [{
            label: 'Diện tích canh tác (ha)',
            data: varietiesData.map(v => v.ha),
            backgroundColor: varietiesData.map(v => v.color),
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} ha (~${(ctx.raw*10000).toLocaleString('vi-VN')} m²)`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (v) => `${v} ha` }
            }
          }
        }
      });
    }
  },

  renderTopZonesTable() {
    const tbody = document.getElementById('top-zones-stat-tbody');
    if (!tbody) return;

    const zones = AgriData.getZones();
    const sortedZones = [...zones].sort((a, b) => (b.tong_dt || 0) - (a.tong_dt || 0)).slice(0, 10);
    const totalCommuneArea = AgriData.getKPIs()?.total_area_m2 || 735056;

    tbody.innerHTML = sortedZones.map((z, idx) => {
      const pct = ((z.tong_dt / totalCommuneArea) * 100).toFixed(1);
      return `
        <tr>
          <td class="center-cell"><span class="badge ${idx < 3 ? 'badge-amber' : 'badge-gray'}">#${idx + 1}</span></td>
          <td><strong>Xứ đồng ${z.name}</strong></td>
          <td class="center-cell">${z.so_thua} thửa</td>
          <td class="num-cell">${Number(z.quy_1 || 0).toLocaleString('vi-VN')}</td>
          <td class="num-cell">${Number(z.quy_2 || 0).toLocaleString('vi-VN')}</td>
          <td class="num-cell"><strong>${Number(z.tong_dt).toLocaleString('vi-VN')}</strong></td>
          <td class="num-cell"><strong style="color: var(--primary);">${z.dt_ha} ha</strong></td>
          <td class="center-cell"><span class="badge badge-emerald">${pct}%</span></td>
        </tr>
      `;
    }).join('');
  },

  // =========================================================================
  // 3. THEME 2: FARMERS & LAND ACCUMULATION
  // =========================================================================
  renderFarmersCharts() {
    // 1. Chart: Area by Address / Tổ
    if (this.charts.areaByTo) this.charts.areaByTo.destroy();
    const addrData = AgriData.getAddresses();
    const ctxAreaByTo = document.getElementById('chart-area-by-to')?.getContext('2d');
    if (ctxAreaByTo) {
      this.charts.areaByTo = new Chart(ctxAreaByTo, {
        type: 'bar',
        data: {
          labels: addrData.map(a => a.name),
          datasets: [
            {
              label: 'Đất Quỹ 1 (m²)',
              data: addrData.map(a => a.quy_1),
              backgroundColor: '#059669',
              borderRadius: 4
            },
            {
              label: 'Đất Quỹ 2 (m²)',
              data: addrData.map(a => a.quy_2),
              backgroundColor: '#3b82f6',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('vi-VN')} m²`
              }
            }
          },
          scales: {
            x: { stacked: true, grid: { display: false } },
            y: {
              stacked: true,
              ticks: {
                callback: (val) => `${(val/10000).toFixed(1)} ha`
              }
            }
          }
        }
      });
    }

    // 2. Chart: Age & Scale Distribution (Doughnut)
    if (this.charts.ageDist) this.charts.ageDist.destroy();
    const ctxAge = document.getElementById('chart-age-distribution')?.getContext('2d');
    if (ctxAge) {
      this.charts.ageDist = new Chart(ctxAge, {
        type: 'doughnut',
        data: {
          labels: ['Dưới 40 tuổi (18%)', 'Từ 40 - 55 tuổi (46%)', 'Từ 56 - 65 tuổi (26%)', 'Trên 65 tuổi (10%)'],
          datasets: [{
            data: [50, 129, 73, 28],
            backgroundColor: ['#10b981', '#059669', '#f59e0b', '#ef4444'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }
  },

  renderTopAccumulators() {
    const tbody = document.getElementById('top-accumulators-tbody');
    if (!tbody) return;

    const accumulators = AgriData.getTopAccumulators(10);
    tbody.innerHTML = accumulators.map((f, idx) => {
      const q1 = f.quy_1 != null ? f.quy_1 : (f.quy_1_m2 || 0);
      const q2 = f.quy_2 != null ? f.quy_2 : (f.quy_2_m2 || 0);
      const totalM2 = f.tong_dt != null ? f.tong_dt : (f.tong_dt_m2 || (q1 + q2));
      const dtHa = f.dt_ha != null ? f.dt_ha : (totalM2 / 10000).toFixed(2);

      return `
        <tr>
          <td class="center-cell"><span class="badge ${idx < 3 ? 'badge-amber' : 'badge-gray'}">#${idx + 1}</span></td>
          <td><strong style="cursor: pointer; color: var(--primary);" onclick="AgriFarmers.showDetail('${f.name}')">${f.name}</strong></td>
          <td>${f.dia_chi || 'Tổ --'}</td>
          <td class="center-cell"><strong>${f.so_thua || 0}</strong></td>
          <td class="center-cell"><span class="badge ${f.so_thua_thue > 0 ? 'badge-purple' : 'badge-gray'}">${f.so_thua_thue || 0}</span></td>
          <td class="num-cell">${Number(q1).toLocaleString('vi-VN')}</td>
          <td class="num-cell">${Number(q2).toLocaleString('vi-VN')}</td>
          <td class="num-cell"><strong>${Number(totalM2).toLocaleString('vi-VN')}</strong></td>
          <td class="num-cell"><strong style="color: var(--accent);">${dtHa} ha</strong></td>
        </tr>
      `;
    }).join('');
  },

  // =========================================================================
  // 4. THEME 3: SERVICES & FEES CHARTS & TABLES
  // =========================================================================
  renderServicesCharts() {
    const farmers = AgriData.getFarmers();
    const serviceItems = AgriData.getServiceItems();
    const payments = AgriData.getPayments();

    // 1. Chart: Services Revenue Breakdown
    if (this.charts.servicesBreakdown) this.charts.servicesBreakdown.destroy();
    const ctxBreakdown = document.getElementById('chart-services-breakdown')?.getContext('2d');
    if (ctxBreakdown) {
      const breakdownData = serviceItems.filter(i => i.is_active).map(item => {
        let itemTotal = 0;
        farmers.forEach(f => {
          const areaM2 = f.tong_dt != null ? f.tong_dt : (f.tong_dt_m2 || 0);
          itemTotal += (areaM2 * (item.price_m2 || 0));
        });
        return {
          name: item.name,
          amount: Math.round(itemTotal)
        };
      });

      this.charts.servicesBreakdown = new Chart(ctxBreakdown, {
        type: 'bar',
        data: {
          labels: breakdownData.map(b => b.name.length > 20 ? b.name.slice(0, 18) + '...' : b.name),
          datasets: [{
            label: 'Doanh thu (VNĐ)',
            data: breakdownData.map(b => b.amount),
            backgroundColor: ['#059669', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'],
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('vi-VN')} đ`
              }
            }
          },
          scales: {
            y: {
              ticks: { callback: (v) => `${(v/1000000).toFixed(0)} tr` }
            }
          }
        }
      });
    }

    // 2. Chart: Collection Rate (Donut)
    if (this.charts.servicesRate) this.charts.servicesRate.destroy();
    const ctxRate = document.getElementById('chart-services-collection-rate')?.getContext('2d');
    if (ctxRate) {
      let paidTotal = 0;
      let unpaidTotal = 0;

      farmers.forEach(f => {
        const areaM2 = f.tong_dt_m2 || 0;
        let fee = 0;
        serviceItems.forEach(item => {
          if (item.is_active) fee += (areaM2 * (item.price_m2 || 0));
        });
        const isPaid = (payments[f.name] && payments[f.name].status === 'paid') || (payments[f.id] && (payments[f.id].status === 'paid' || payments[f.id].paid));
        if (isPaid) {
          paidTotal += fee;
        } else {
          unpaidTotal += fee;
        }
      });

      this.charts.servicesRate = new Chart(ctxRate, {
        type: 'doughnut',
        data: {
          labels: [
            `Đã thu nộp (${AgriData.formatCurrency(paidTotal)})`,
            `Còn nợ đọng (${AgriData.formatCurrency(unpaidTotal)})`
          ],
          datasets: [{
            data: [Math.round(paidTotal), Math.round(unpaidTotal)],
            backgroundColor: ['#059669', '#ef4444'],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${Number(ctx.raw).toLocaleString('vi-VN')} đ`
              }
            }
          }
        }
      });
    }
  },

  renderServicesByToTable() {
    const tbody = document.getElementById('services-stat-to-tbody');
    if (!tbody) return;

    const addresses = AgriData.getAddresses();
    const farmers = AgriData.getFarmers();
    const serviceItems = AgriData.getServiceItems();
    const payments = AgriData.getPayments();

    tbody.innerHTML = addresses.map(addr => {
      const addrFarmers = farmers.filter(f => f.dia_chi === addr.name);
      let totalArea = 0;
      let totalMustPay = 0;
      let totalPaid = 0;

      addrFarmers.forEach(f => {
        const area = f.tong_dt != null ? f.tong_dt : (f.tong_dt_m2 || 0);
        totalArea += area;
        let farmerFee = 0;
        serviceItems.forEach(item => {
          if (item.is_active) farmerFee += (area * (item.price_m2 || 0));
        });
        totalMustPay += farmerFee;
        const isPaid = (payments[f.name] && payments[f.name].status === 'paid') || (payments[f.id] && (payments[f.id].status === 'paid' || payments[f.id].paid));
        if (isPaid) {
          totalPaid += farmerFee;
        }
      });

      const unpaid = totalMustPay - totalPaid;
      const pct = totalMustPay > 0 ? ((totalPaid / totalMustPay) * 100).toFixed(0) : 0;

      return `
        <tr>
          <td><strong>${addr.name}</strong></td>
          <td class="center-cell">${addrFarmers.length} hộ</td>
          <td class="num-cell">${Number(totalArea).toLocaleString('vi-VN')} m²</td>
          <td class="num-cell"><strong>${AgriData.formatCurrency(totalMustPay)}</strong></td>
          <td class="num-cell" style="color: #059669;">${AgriData.formatCurrency(totalPaid)}</td>
          <td class="num-cell" style="color: #ef4444;">${AgriData.formatCurrency(unpaid)}</td>
          <td class="center-cell"><span class="badge ${pct >= 80 ? 'badge-emerald' : 'badge-amber'}">${pct}%</span></td>
        </tr>
      `;
    }).join('');
  },

  // =========================================================================
  // 5. THEME 4: PURCHASING & YIELD HARVEST CHARTS & TABLES
  // =========================================================================
  renderPurchasingCharts() {
    const sessions = AgriData.getPurchasingSessions();

    const varieties = ['J02', 'HG12', 'HG244', 'ĐT100', 'HT1', 'ST25'];
    const freshData = [];
    const dryData = [];
    const moneyData = [];

    varieties.forEach(v => {
      const matched = sessions.filter(s => s.loai_giong === v);
      let vFresh = 0;
      let vDry = 0;
      let vMoney = 0;
      matched.forEach(s => {
        vFresh += (parseFloat(s.luong_tuoi_kg) || 0);
        vDry += (parseFloat(s.luong_kho_kg) || 0);
        vMoney += (parseFloat(s.thanh_tien) || 0);
      });
      freshData.push((vFresh / 1000).toFixed(2));
      dryData.push((vDry / 1000).toFixed(2));
      moneyData.push(Math.round(vMoney));
    });

    // 1. Chart: Purchasing Yield by Variety
    if (this.charts.purchasingYield) this.charts.purchasingYield.destroy();
    const ctxYield = document.getElementById('chart-purchasing-by-variety')?.getContext('2d');
    if (ctxYield) {
      this.charts.purchasingYield = new Chart(ctxYield, {
        type: 'bar',
        data: {
          labels: varieties,
          datasets: [
            {
              label: 'Lượng tươi (Tấn)',
              data: freshData,
              backgroundColor: '#38bdf8',
              borderRadius: 4
            },
            {
              label: 'Lượng khô quy đổi (Tấn)',
              data: dryData,
              backgroundColor: '#059669',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} Tấn`
              }
            }
          },
          scales: {
            y: {
              ticks: { callback: (v) => `${v} Tấn` }
            }
          }
        }
      });
    }

    // 2. Chart: Purchasing Money by Variety
    if (this.charts.purchasingMoney) this.charts.purchasingMoney.destroy();
    const ctxMoney = document.getElementById('chart-purchasing-money-by-variety')?.getContext('2d');
    if (ctxMoney) {
      this.charts.purchasingMoney = new Chart(ctxMoney, {
        type: 'bar',
        data: {
          labels: varieties,
          datasets: [{
            label: 'Giá trị thu mua (VNĐ)',
            data: moneyData,
            backgroundColor: '#10b981',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('vi-VN')} đ`
              }
            }
          },
          scales: {
            y: {
              ticks: { callback: (v) => `${(v/1000000).toFixed(0)} tr` }
            }
          }
        }
      });
    }
  },

  renderPurchasingByVarietyTable() {
    const tbody = document.getElementById('purchasing-stat-variety-tbody');
    if (!tbody) return;

    const sessions = AgriData.getPurchasingSessions();
    const varieties = ['J02', 'HG12', 'HG244', 'ĐT100', 'HT1', 'ST25'];
    
    let grandMoney = 0;
    sessions.forEach(s => grandMoney += (parseFloat(s.thanh_tien) || 0));

    tbody.innerHTML = varieties.map(v => {
      const matched = sessions.filter(s => s.loai_giong === v);
      let sessionCount = matched.length;
      let totalBags = 0;
      let freshKg = 0;
      let dryKg = 0;
      let totalMoney = 0;

      matched.forEach(s => {
        totalBags += (parseInt(s.tong_so_bao) || 0);
        freshKg += (parseFloat(s.luong_tuoi_kg) || 0);
        dryKg += (parseFloat(s.luong_kho_kg) || 0);
        totalMoney += (parseFloat(s.thanh_tien) || 0);
      });

      const avgPrice = dryKg > 0 ? Math.round(totalMoney / dryKg) : AgriData.getRememberedPrice(v);
      const pct = grandMoney > 0 ? ((totalMoney / grandMoney) * 100).toFixed(1) : '0.0';

      return `
        <tr>
          <td><strong style="color: var(--text-main);">${v}</strong></td>
          <td class="center-cell">${sessionCount} phiên</td>
          <td class="center-cell">${totalBags} bao</td>
          <td class="num-cell">${Number(freshKg).toLocaleString('vi-VN')} kg</td>
          <td class="num-cell"><strong>${Number(dryKg).toLocaleString('vi-VN')} kg</strong></td>
          <td class="num-cell">${Number(avgPrice).toLocaleString('vi-VN')} đ</td>
          <td class="num-cell"><strong style="color: var(--primary);">${AgriData.formatCurrency(totalMoney)}</strong></td>
          <td class="center-cell"><span class="badge badge-emerald">${pct}%</span></td>
        </tr>
      `;
    }).join('');
  },

  // =========================================================================
  // 6. EXECUTIVE REPORT PRINTING (A4 ADMINISTRATIVE STANDARD)
  // =========================================================================
  printExecutiveReport() {
    let kpis = AgriData.getKPIs();
    if (!kpis || !kpis.total_area_ha) {
      if (typeof AgriData.recalculateKPIs === 'function') {
        AgriData.recalculateKPIs();
        kpis = AgriData.getKPIs();
      }
    }
    const farmers = AgriData.getFarmers();
    const serviceItems = AgriData.getServiceItems();
    const payments = AgriData.getPayments();
    const sessions = AgriData.getPurchasingSessions();

    let totalServiceMoney = 0;
    let paidServiceMoney = 0;
    farmers.forEach(f => {
      const area = f.tong_dt != null ? f.tong_dt : (f.tong_dt_m2 || 0);
      let fee = 0;
      serviceItems.forEach(i => { if (i.is_active) fee += (area * (i.price_m2 || 0)); });
      totalServiceMoney += fee;
      const isPaid = (payments[f.name] && payments[f.name].status === 'paid') || (payments[f.id] && (payments[f.id].status === 'paid' || payments[f.id].paid));
      if (isPaid) paidServiceMoney += fee;
    });

    let totalFreshKg = 0;
    let totalDryKg = 0;
    let totalPurchasingMoney = 0;
    sessions.forEach(s => {
      totalFreshKg += (parseFloat(s.luong_tuoi_kg) || 0);
      totalDryKg += (parseFloat(s.luong_kho_kg) || 0);
      totalPurchasingMoney += (parseFloat(s.thanh_tien) || 0);
    });

    const printWin = window.open('', '_blank', 'width=950,height=900');
    if (!printWin) return;

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Báo Cáo Tổng Hợp Tình Hình Sản Xuất & Kinh Tế Nông Nghiệp Toàn Xã</title>
        <style>
          body { font-family: 'Times New Roman', serif; margin: 0; padding: 25px; color: #000; font-size: 13px; line-height: 1.45; }
          .header-box { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; }
          .title { text-align: center; font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 15px 0 5px; }
          .sub { text-align: center; font-style: italic; margin-bottom: 15px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #000; padding: 5px 8px; font-size: 12px; }
          th { background: #f0f0f0; text-align: center; }
          .sec-title { font-weight: bold; font-size: 14px; text-transform: uppercase; margin-top: 15px; color: #000; }
          .footer-box { margin-top: 35px; display: grid; grid-template-columns: 1fr 1fr; text-align: center; }
          @media print { @page { size: A4 portrait; margin: 15mm; } body { padding: 0; } }
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

        <div class="title">BÁO CÁO TỔNG KẾT KINH TẾ NÔNG NGHIỆP & VỤ MÙA 2026</div>
        <div class="sub">Đơn vị báo cáo: Hợp Tác Xã Nông Nghiệp Hòa Tiến • Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN')}</div>

        <div class="sec-title">I. TỔNG QUAN TÌNH HÌNH ĐẤT ĐAI & CƠ CẤU GIỐNG LÚA</div>
        <p>1. Tổng diện tích đất nông nghiệp canh tác: <strong>${kpis.total_area_ha} ha</strong> (tương ứng ${Number(kpis.total_area_m2).toLocaleString('vi-VN')} m²), phân bổ trên <strong>85 Xứ đồng</strong> với <strong>${Number(kpis.total_plots).toLocaleString('vi-VN')} thửa ruộng</strong>.</p>
        <p>2. Cơ cấu quỹ đất: Đất Quỹ 1 (giao ổn định) chiếm <strong>${kpis.quy_1_pct}%</strong> (${(kpis.quy_1_m2/10000).toFixed(2)} ha); Đất Quỹ 2 (công ích, thầu khoán) chiếm <strong>${kpis.quy_2_pct}%</strong> (${(kpis.quy_2_m2/10000).toFixed(2)} ha).</p>
        <p>3. Cơ cấu giống lúa chủ lực: J02 (35%), HG12 (25%), HG244 (18%), ĐT100 (12%), HT1 (6%), ST25 (4%).</p>

        <div class="sec-title">II. TÌNH HÌNH HỘ NÔNG DÂN & TÍCH TỤ RUỘNG ĐẤT</div>
        <p>1. Tổng số hộ trực tiếp canh tác: <strong>${kpis.total_farmers} hộ</strong> trên địa bàn 10 Tổ dân phố.</p>
        <p>2. Tỷ lệ tích tụ, thuê mượn ruộng đất đạt <strong>${kpis.rented_pct}%</strong> (${kpis.rented_plots} thửa ruộng do các hộ nông dân quy mô lớn tích tụ canh tác).</p>

        <div class="sec-title">III. KẾT QUẢ CUNG ỨNG DỊCH VỤ NÔNG NGHIỆP HTX</div>
        <p>1. Tổng giá trị phí dịch vụ theo kế hoạch: <strong>${AgriData.formatCurrency(totalServiceMoney)}</strong>.</p>
        <p>2. Số tiền đã thu nộp vào ngân quỹ HTX: <strong>${AgriData.formatCurrency(paidServiceMoney)}</strong> (Đạt tỷ lệ: <strong>${totalServiceMoney > 0 ? ((paidServiceMoney/totalServiceMoney)*100).toFixed(1) : 0}%</strong>).</p>

        <div class="sec-title">IV. KẾT QUẢ THU HOẠCH & THU MUA NÔNG SẢN TẬP TRUNG</div>
        <p>1. Tổng sản lượng lúa tươi thu mua tại ruộng: <strong>${(totalFreshKg/1000).toFixed(2)} Tấn</strong> (${Number(totalFreshKg).toLocaleString('vi-VN')} kg) qua <strong>${sessions.length} phiên cân</strong>.</p>
        <p>2. Khối lượng lúa khô quy đổi sau trừ ẩm/tạp chất (12%): <strong>${(totalDryKg/1000).toFixed(2)} Tấn</strong> (${Number(totalDryKg).toLocaleString('vi-VN')} kg).</p>
        <p>3. Tổng giá trị quyết toán chi trả cho nông dân: <strong>${AgriData.formatCurrency(totalPurchasingMoney)}</strong>.</p>

        <div class="footer-box">
          <div>
            <strong>NGƯỜI LẬP BÁO CÁO</strong><br>
            <em>(Ký, ghi rõ họ tên)</em><br><br><br><br>
            <strong>Ban Kế Hoạch - Thống Kê</strong>
          </div>
          <div>
            <em>Hòa Tiến, ngày ..... tháng ..... năm 2026</em><br>
            <strong>TM. HỘI ĐỒNG QUẢN TRỊ HTX</strong><br>
            <strong>CHỦ TỊCH HĐQT - GIÁM ĐỐC</strong><br><br><br><br>
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

  printStatisticalTables() {
    this.printExecutiveReport();
  },

  // =========================================================================
  // 7. EXPORT COMPREHENSIVE EXCEL CSV (UTF-8 WITH BOM)
  // =========================================================================
  exportAnalyticsExcel() {
    const kpis = AgriData.getKPIs();
    const zones = AgriData.getZones();
    const addresses = AgriData.getAddresses();
    const farmers = AgriData.getFarmers();
    const sessions = AgriData.getPurchasingSessions();

    let csv = '\uFEFF';
    csv += 'BÁO CÁO THỐNG KÊ KINH TẾ NÔNG NGHIỆP TOÀN XÃ HÒA TIẾN\n';
    csv += `Ngày xuất báo cáo:,${new Date().toISOString().slice(0, 10)}\n\n`;

    // Section 1
    csv += '--- PHẦN 1: TỔNG QUAN ĐẤT ĐAI & XỨ ĐỒNG ---\n';
    csv += 'Tên Xứ Đồng,Số Thửa,Đất Quỹ 1 (m2),Đất Quỹ 2 (m2),Tổng Diện Tích (m2),Quy Đổi (ha)\n';
    zones.forEach(z => {
      csv += `"${z.name}",${z.so_thua},${z.quy_1 || 0},${z.quy_2 || 0},${z.tong_dt},${z.dt_ha}\n`;
    });
    csv += '\n';

    // Section 2
    csv += '--- PHẦN 2: THỐNG KÊ HỘ NÔNG DÂN THEO TỔ DÂN PHỐ ---\n';
    csv += 'Tổ Dân Phố,Số Hộ Canh Tác,Đất Quỹ 1 (m2),Đất Quỹ 2 (m2),Tổng Diện Tích (m2),Quy Đổi (ha)\n';
    addresses.forEach(a => {
      const fCount = farmers.filter(f => f.dia_chi === a.name).length;
      csv += `"${a.name}",${fCount},${a.quy_1},${a.quy_2},${a.tong_dt},${a.dt_ha}\n`;
    });
    csv += '\n';

    // Section 3
    csv += '--- PHẦN 3: TỔNG HỢP THU MUA LÚA ---\n';
    csv += 'STT,Thời Gian,Hộ Nông Dân,Xứ Đồng,Giống Lúa,Số Bao,Lượng Tươi (kg),Lượng Khô (kg),Đơn Giá (đ),Thành Tiền (đ)\n';
    sessions.forEach(s => {
      csv += `${s.stt},"${s.ngay_can || ''}","${s.ho_sx}","${s.xu_dong}","${s.loai_giong}",${s.tong_so_bao},${s.luong_tuoi_kg},${s.luong_kho_kg},${s.don_gia_kg},${s.thanh_tien}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Thong_Ke_Nong_Nghiep_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Expose globally
window.AgriAnalytics = AgriAnalytics;
