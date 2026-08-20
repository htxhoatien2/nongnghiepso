/**
 * ============================================================================
 * AGRIGIS UNIFIED SCIENTIFIC MAP & SPATIAL ENGINE
 * Features: View, Layer switch, GPS, Native Drawing, Vertex Editing,
 * Measurement, Property Management, GeoJSON/KML Import & Export
 * ============================================================================
 */

const AgriMap = {
  map: null,
  geoJsonLayer: null,
  baseLayers: {},
  currentBaseLayerName: 'satellite',
  selectedFeature: null,
  selectedLayer: null,
  
  // Drawing State
  drawMode: null, // 'polygon' | 'measure_distance' | 'measure_area' | 'edit' | null
  drawPoints: [],
  drawMarkers: [],
  tempPolyline: null,
  tempPolygon: null,
  
  // GPS State
  userMarker: null,
  userAccuracyCircle: null,

  init() {
    if (this.map) return;

    // Centered at Hòa Tiến agricultural fields (~15.9650 N, 108.1960 E)
    const defaultCenter = [15.9650, 108.1960];
    const defaultZoom = 15;

    // 1. Create Leaflet Map Instance
    this.map = L.map('leaflet-map', {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false
    });

    // 2. Add Zoom control to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // 3. Tile Basemap Layers
    this.baseLayers = {
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Esri Satellite'
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'OpenStreetMap'
      }),
      carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: 'Carto Light'
      })
    };

    // Add default satellite basemap
    this.baseLayers.satellite.addTo(this.map);

    // 4. Render Agricultural Zones GeoJSON
    this.renderGeoJSON();

    // 5. Setup Map Interaction Events
    this.setupMapClickEvents();
    this.bindUIEvents();

    // Auto invalidate size on load & resize
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize(true);
      }
    }, 100);

    window.addEventListener('resize', () => {
      if (this.map) this.map.invalidateSize(true);
    });

    console.log('AgriMap initialized successfully.');
  },

  // =========================================================================
  // 1. GEOJSON RENDERING & LAYER MANAGEMENT
  // =========================================================================

  getZoneColor(areaM2) {
    if (areaM2 >= 20000) return '#059669'; // Emerald (> 2 ha)
    if (areaM2 >= 10000) return '#3b82f6'; // Blue (1 - 2 ha)
    return '#f59e0b'; // Amber (< 1 ha)
  },

  zoneStyle(feature) {
    const area = feature.properties.tong_dt || 0;
    return {
      fillColor: AgriMap.getZoneColor(area),
      weight: 2,
      opacity: 0.95,
      color: '#ffffff',
      dashArray: '2',
      fillOpacity: 0.55
    };
  },

  highlightStyle() {
    return {
      fillColor: '#10b981',
      weight: 3,
      opacity: 1,
      color: '#facc15',
      dashArray: '',
      fillOpacity: 0.85
    };
  },

  renderGeoJSON(filterType = 'all') {
    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
    }

    const geoData = AgriData.getGeoJSON();
    if (!geoData) return;

    this.geoJsonLayer = L.geoJSON(geoData, {
      filter: (feature) => {
        if (filterType === 'all') return true;
        if (filterType === 'quy1') return feature.properties.quy_1 > 0;
        if (filterType === 'quy2') return feature.properties.quy_2 > 0;
        if (filterType === 'rented') return feature.properties.so_ho > 3;
        return true;
      },
      style: this.zoneStyle,
      onEachFeature: (feature, layer) => {
        const props = feature.properties;

        // Tooltip
        layer.bindTooltip(`
          <div style="font-family: inherit; font-size: 12px; font-weight: 700; text-align: center; padding: 2px 4px;">
            🌾 ${props.name}<br>
            <span style="font-weight: 500; color: #059669;">${AgriData.formatArea(props.tong_dt)} (${props.dt_ha} ha)</span>
          </div>
        `, {
          direction: 'top',
          sticky: true,
          className: 'custom-map-tooltip'
        });

        // Click selection
        layer.on({
          mouseover: () => {
            if (this.selectedFeature !== feature && !this.drawMode) {
              layer.setStyle({ fillOpacity: 0.75, weight: 3 });
            }
          },
          mouseout: () => {
            if (this.selectedFeature !== feature && !this.drawMode) {
              this.geoJsonLayer.resetStyle(layer);
            }
          },
          click: (e) => {
            if (this.drawMode) return; // Don't select when drawing
            L.DomEvent.stopPropagation(e);
            this.selectZone(feature, layer);
          }
        });
      }
    }).addTo(this.map);
  },

  selectZone(feature, layer) {
    this.selectedFeature = feature;
    this.selectedLayer = layer;

    // Reset styles and highlight active
    this.geoJsonLayer.eachLayer(l => this.geoJsonLayer.resetStyle(l));
    if (layer) {
      layer.setStyle(this.highlightStyle());
      layer.bringToFront();
      this.map.fitBounds(layer.getBounds(), { maxZoom: 17, padding: [40, 40] });
    }

    this.showBottomSheet(feature.properties);
  },

  flyToZone(zoneName) {
    if (!this.geoJsonLayer || !zoneName) return;

    let targetLayer = null;
    let targetFeature = null;

    this.geoJsonLayer.eachLayer(layer => {
      if (layer.feature && layer.feature.properties.name.toLowerCase().trim() === zoneName.toLowerCase().trim()) {
        targetLayer = layer;
        targetFeature = layer.feature;
      }
    });

    if (targetLayer && targetFeature) {
      this.selectZone(targetFeature, targetLayer);
    }
  },

  // =========================================================================
  // 2. MODERN FLOATING POPUP / DRAWER & ZONE DETAILS
  // =========================================================================

  showBottomSheet(props) {
    const sheet = document.getElementById('map-bottom-sheet');
    if (!sheet) return;

    this.currentZoneProps = props;

    // Header info
    document.getElementById('sheet-title').textContent = `🌾 Xứ Đồng: ${props.name}`;
    document.getElementById('sheet-subtitle').textContent = `📍 Địa bàn: ${props.to_list || 'Chưa rõ'}`;
    
    // KPI Cards
    document.getElementById('sheet-stat-area').textContent = `${AgriData.formatArea(props.tong_dt)} (${props.dt_ha} ha)`;
    document.getElementById('sheet-stat-plots').textContent = `${props.so_thua} thửa`;
    document.getElementById('sheet-stat-farmers').textContent = `${props.so_ho} hộ`;
    document.getElementById('sheet-stat-funds').textContent = `Q1: ${AgriData.formatArea(props.quy_1)} | Q2: ${AgriData.formatArea(props.quy_2)}`;

    // Land Fund Ratio Progress Bar
    const totalArea = (parseFloat(props.tong_dt) || 1);
    const q1 = parseFloat(props.quy_1) || 0;
    const q2 = parseFloat(props.quy_2) || 0;
    const pctQ1 = Math.min(100, Math.max(0, Math.round((q1 / totalArea) * 100)));
    const pctQ2 = Math.min(100, Math.max(0, Math.round((q2 / totalArea) * 100)));

    const barQ1 = document.getElementById('sheet-bar-quy1');
    const barQ2 = document.getElementById('sheet-bar-quy2');
    const txtQ1 = document.getElementById('sheet-pct-quy1');
    const txtQ2 = document.getElementById('sheet-pct-quy2');

    if (barQ1) barQ1.style.width = `${pctQ1}%`;
    if (barQ2) barQ2.style.width = `${pctQ2}%`;
    if (txtQ1) txtQ1.textContent = `${pctQ1}% (${AgriData.formatArea(q1)})`;
    if (txtQ2) txtQ2.textContent = `${pctQ2}% (${AgriData.formatArea(q2)})`;

    // Fetch and render plots for this zone
    this.currentZonePlots = AgriData.findPlotsByZone(props.name);
    
    // Reset search input
    const searchInput = document.getElementById('sheet-search-farmer');
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = (e) => this.renderSheetFarmers(e.target.value);
    }

    this.renderSheetFarmers('');

    sheet.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  renderSheetFarmers(searchQuery = '') {
    const listEl = document.getElementById('sheet-plots-list');
    const badgeEl = document.getElementById('sheet-farmers-count-badge');
    if (!listEl) return;

    const query = searchQuery.toLowerCase().trim();
    let plots = this.currentZonePlots || [];

    if (query) {
      plots = plots.filter(p => 
        (p.ho_sx && p.ho_sx.toLowerCase().includes(query)) ||
        (p.chu_ruong && p.chu_ruong.toLowerCase().includes(query)) ||
        (p.stt && String(p.stt).toLowerCase().includes(query)) ||
        (p.dia_chi && p.dia_chi.toLowerCase().includes(query))
      );
    }

    if (plots.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.84rem;">
          <i data-lucide="inbox" style="width:32px; height:32px; margin: 0 auto 6px; opacity:0.6; display:block;"></i>
          ${query ? 'Không tìm thấy hộ hoặc thửa phù hợp.' : 'Chưa có thông tin thửa ruộng chi tiết trong vùng này.'}
        </div>
      `;
      if (badgeEl) badgeEl.textContent = '0 hộ';
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Group by farmer
    const farmerMap = new Map();
    plots.forEach(p => {
      const farmerName = p.ho_sx ? p.ho_sx.trim() : 'Chưa rõ';
      if (!farmerMap.has(farmerName)) {
        farmerMap.set(farmerName, {
          name: farmerName,
          dia_chi: p.dia_chi || '',
          dien_thoai: p.dien_thoai || '',
          plots: [],
          totalArea: 0
        });
      }
      const f = farmerMap.get(farmerName);
      f.plots.push(p);
      f.totalArea += (parseFloat(p.tong_dt) || 0);
    });

    const farmersList = Array.from(farmerMap.values());
    if (badgeEl) badgeEl.textContent = `${farmersList.length} hộ (${plots.length} thửa)`;

    listEl.innerHTML = farmersList.map((f, fIdx) => {
      const phoneHtml = f.dien_thoai 
        ? `<a href="tel:${f.dien_thoai}" style="display:inline-flex; align-items:center; gap:3px; color:var(--accent); text-decoration:none; font-size:0.72rem; font-weight:600; margin-left:6px;"><i data-lucide="phone" style="width:11px; height:11px;"></i> ${f.dien_thoai}</a>`
        : '';

      return `
        <div class="sheet-farmer-card">
          <div class="farmer-card-header">
            <div class="farmer-name-group">
              <div class="farmer-avatar-icon">👨‍🌾</div>
              <div>
                <span class="farmer-title">${f.name}</span>
                ${phoneHtml}
                <span class="farmer-plots-badge">(${f.plots.length} thửa)</span>
              </div>
            </div>
            <div class="farmer-total-area">
              ${AgriData.formatArea(f.totalArea)}
            </div>
          </div>
          
          <div class="farmer-plots-table">
            ${f.plots.map(p => {
              const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
              const badge = isRented 
                ? `<span class="badge badge-amber" style="font-size:0.68rem;" title="Đất nhận tích tụ / thuê mượn">🔄 Chủ khác: ${p.chu_ruong}</span>` 
                : `<span class="badge badge-emerald" style="font-size:0.68rem;" title="Đất chính chủ">✅ Chính chủ</span>`;
              
              const loaiDat = p.quy_2 > 0 ? 'Quỹ 2' : (p.quy_khac > 0 ? 'Khác' : 'Quỹ 1');
              return `
                <div class="nested-plot-row">
                  <div class="plot-info-left">
                    <span class="plot-stt-chip">${p.stt || 'Thửa'}</span>
                    <span class="plot-fund-type">• ${loaiDat}</span>
                    <span>${badge}</span>
                  </div>
                  <div class="plot-area-right">${AgriData.formatArea(p.tong_dt)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  closeBottomSheet() {
    const sheet = document.getElementById('map-bottom-sheet');
    if (sheet) sheet.classList.remove('open');
    if (this.geoJsonLayer) {
      this.geoJsonLayer.eachLayer(l => this.geoJsonLayer.resetStyle(l));
    }
    this.selectedFeature = null;
    this.selectedLayer = null;
  },

  // =========================================================================
  // 3. NATIVE SPATIAL DRAWING & EDITING ENGINE (NO EXTERNAL PLUGIN REQUIRED)
  // =========================================================================

  startDrawPolygon() {
    this.cancelDrawing();
    this.drawMode = 'polygon';
    this.closeBottomSheet();
    
    this.showDrawGuide('Chạm / Click các điểm trên bản đồ để vẽ ranh giới bờ ruộng. Bấm nút [Hoàn thành] khi vẽ xong.');
  },

  startMeasureArea() {
    this.cancelDrawing();
    this.drawMode = 'measure_area';
    this.closeBottomSheet();

    this.showDrawGuide('Chạm các điểm trên bản đồ để đo diện tích vùng tự do. Bấm nút [Hoàn thành] khi đo xong.');
  },

  startMeasureDistance() {
    this.cancelDrawing();
    this.drawMode = 'measure_distance';
    this.closeBottomSheet();

    this.showDrawGuide('Chạm các điểm dọc bờ mương / đường nội đồng để đo chiều dài (m).');
  },

  setupMapClickEvents() {
    this.map.on('click', (e) => {
      if (!this.drawMode) return;

      const latlng = e.latlng;
      this.drawPoints.push([latlng.lat, latlng.lng]);

      // Marker color based on mode
      const markerColor = this.drawMode === 'measure_area' ? '#3b82f6' : (this.drawMode === 'measure_distance' ? '#f59e0b' : '#059669');

      // Add vertex marker
      const marker = L.circleMarker(latlng, {
        radius: 6,
        color: '#ffffff',
        fillColor: markerColor,
        fillOpacity: 1,
        weight: 2
      }).addTo(this.map);
      this.drawMarkers.push(marker);

      // Draw polyline or polygon
      if (this.drawMode === 'polygon') {
        if (this.tempPolygon) this.map.removeLayer(this.tempPolygon);
        if (this.drawPoints.length >= 2) {
          this.tempPolygon = L.polygon(this.drawPoints, {
            color: '#059669',
            fillColor: '#10b981',
            fillOpacity: 0.4,
            weight: 2,
            dashArray: '3'
          }).addTo(this.map);
        }

        // Calculate live area if >= 3 points
        let areaText = '';
        if (this.drawPoints.length >= 3) {
          const areaM2 = this.calculateAreaM2(this.drawPoints);
          areaText = ` | Diện tích: <strong>${AgriData.formatArea(areaM2)}</strong>`;
        }
        this.updateDrawGuide(`Đã vẽ ${this.drawPoints.length} điểm${areaText}`);
      } else if (this.drawMode === 'measure_area') {
        if (this.tempPolygon) this.map.removeLayer(this.tempPolygon);
        if (this.drawPoints.length >= 2) {
          this.tempPolygon = L.polygon(this.drawPoints, {
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.35,
            weight: 2,
            dashArray: '4'
          }).addTo(this.map);
        }

        // Calculate live area
        if (this.drawPoints.length >= 3) {
          const areaM2 = this.calculateAreaM2(this.drawPoints);
          const sao = (areaM2 / 500).toFixed(1); // 1 sào Trung Bộ = 500m2
          const ha = (areaM2 / 10000).toFixed(2);
          this.updateDrawGuide(`📐 Diện tích: <strong>${Number(areaM2).toLocaleString('vi-VN')} m²</strong> (~<strong>${sao} sào</strong> | <strong>${ha} ha</strong>) | Đã chấm ${this.drawPoints.length} điểm`);
        } else {
          this.updateDrawGuide(`Đã chấm ${this.drawPoints.length} điểm. Cần ít nhất 3 điểm để tính diện tích.`);
        }
      } else if (this.drawMode === 'measure_distance') {
        if (this.tempPolyline) this.map.removeLayer(this.tempPolyline);
        if (this.drawPoints.length >= 2) {
          this.tempPolyline = L.polyline(this.drawPoints, {
            color: '#f59e0b',
            weight: 3
          }).addTo(this.map);

          const distanceM = this.calculateDistanceM(this.drawPoints);
          this.updateDrawGuide(`Chiều dài đo đạc: <strong>${Math.round(distanceM)} mét</strong> (${(distanceM/1000).toFixed(2)} km)`);
        }
      }
    });
  },

  finishDrawing() {
    if (this.drawMode === 'polygon') {
      if (this.drawPoints.length < 3) {
        alert('Vui lòng chấm ít nhất 3 điểm để tạo thành một đa giác khép kín.');
        return;
      }

      const areaM2 = this.calculateAreaM2(this.drawPoints);
      const points = [...this.drawPoints];
      
      // Clean up drawing overlays
      this.clearDrawingOverlays();
      this.drawMode = null;
      this.hideDrawGuide();

      // Open Modal to save zone
      this.openCreateZoneModal(points, areaM2);
    } else if (this.drawMode === 'measure_area') {
      if (this.drawPoints.length >= 3) {
        const areaM2 = this.calculateAreaM2(this.drawPoints);
        const sao = (areaM2 / 500).toFixed(1);
        const ha = (areaM2 / 10000).toFixed(2);

        alert(`📐 KẾT QUẢ ĐO DIỆN TÍCH:\n- Mét vuông: ${Number(areaM2).toLocaleString('vi-VN')} m²\n- Quy đổi sào Trung Bộ: ~${sao} sào (500m²/sào)\n- Quy đổi Hecta: ~${ha} ha`);
      }
      this.cancelDrawing();
    } else if (this.drawMode === 'measure_distance') {
      if (this.drawPoints.length >= 2) {
        const distanceM = this.calculateDistanceM(this.drawPoints);
        alert(`📏 KẾT QUẢ ĐO CHIỀU DÀI:\n- Chiều dài: ${Math.round(distanceM)} mét (~${(distanceM/1000).toFixed(2)} km)`);
      }
      this.cancelDrawing();
    }
  },

  cancelDrawing() {
    this.clearDrawingOverlays();
    this.drawMode = null;
    this.hideDrawGuide();
  },

  clearDrawingOverlays() {
    this.drawMarkers.forEach(m => this.map.removeLayer(m));
    this.drawMarkers = [];
    this.drawPoints = [];
    if (this.tempPolygon) { this.map.removeLayer(this.tempPolygon); this.tempPolygon = null; }
    if (this.tempPolyline) { this.map.removeLayer(this.tempPolyline); this.tempPolyline = null; }
  },

  calculateAreaM2(points) {
    if (points.length < 3) return 0;
    try {
      // GeoJSON expects [lon, lat]
      const coords = points.map(p => [p[1], p[0]]);
      coords.push(coords[0]); // close polygon
      const poly = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {}
      };
      if (window.turf) {
        return Math.round(turf.area(poly));
      }
    } catch (e) {
      console.warn(e);
    }
    return 1000;
  },

  calculateDistanceM(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += L.latLng(points[i]).distanceTo(L.latLng(points[i+1]));
    }
    return total;
  },

  showDrawGuide(text) {
    const banner = document.getElementById('map-draw-banner');
    const txtEl = document.getElementById('draw-banner-text');
    if (banner && txtEl) {
      txtEl.innerHTML = text;
      banner.style.display = 'flex';
    }
  },

  updateDrawGuide(html) {
    const txtEl = document.getElementById('draw-banner-text');
    if (txtEl) txtEl.innerHTML = html;
  },

  hideDrawGuide() {
    const banner = document.getElementById('map-draw-banner');
    if (banner) banner.style.display = 'none';
  },

  // =========================================================================
  // 4. COMPREHENSIVE MODALS & ZONE/PLOT ATTRIBUTE CRUD
  // =========================================================================

  openCreateZoneModal(points, areaM2) {
    if (window.AgriAuth && !AgriAuth.canEdit('map')) {
      alert('Tài khoản của bạn chỉ có quyền XEM Bản đồ GIS. Không thể thêm mới vùng sản xuất!');
      return;
    }
    const modal = document.getElementById('modal-zone-edit');
    if (!modal) return;

    this.activeFeature = null;
    this.pendingNewPoints = points;
    this.currentZoneCoords = points ? points.map(p => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))]) : [];
    this.currentZonePlots = [];

    document.getElementById('zone-modal-title').textContent = '🌾 Thêm Mới Vùng Sản Xuất (Xứ Đồng)';
    document.getElementById('zone-edit-id').value = '';
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('zone-edit-name').value = `Xứ Đồng Mới (${nowStr})`;
    document.getElementById('zone-edit-to').value = 'Tổ 1';
    document.getElementById('zone-edit-area').value = areaM2 || this.calculateAreaM2(this.currentZoneCoords) || 1000;

    const btnDelete = document.getElementById('btn-delete-zone-modal');
    if (btnDelete) btnDelete.style.display = 'none';

    this.closePlotSubform();
    this.renderZoneCoordsTable();
    this.renderZonePlotsTable();

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  openEditZoneModal(feature) {
    if (window.AgriAuth && !AgriAuth.canEdit('map')) {
      alert('Tài khoản của bạn chỉ có quyền XEM Bản đồ GIS. Không thể chỉnh sửa vùng sản xuất!');
      return;
    }
    if (!feature) feature = this.selectedFeature;
    if (!feature) return;

    this.activeFeature = feature;
    this.pendingNewPoints = null;

    const props = feature.properties;
    const modal = document.getElementById('modal-zone-edit');
    if (!modal) return;

    document.getElementById('zone-modal-title').textContent = `✏️ Quản Lý Vùng: ${props.name}`;
    document.getElementById('zone-edit-id').value = feature.id || props.name;
    document.getElementById('zone-edit-name').value = props.name || '';
    document.getElementById('zone-edit-to').value = props.to_list ? props.to_list.split(',')[0].trim() : 'Tổ 1';
    document.getElementById('zone-edit-area').value = props.tong_dt || 0;

    // Extract coordinates
    if (feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates[0]) {
      const raw = feature.geometry.coordinates[0];
      // Exclude last closing point if same as first
      const uniqueCoords = (raw.length > 3 && raw[0][0] === raw[raw.length - 1][0] && raw[0][1] === raw[raw.length - 1][1])
        ? raw.slice(0, -1)
        : raw;
      this.currentZoneCoords = uniqueCoords.map(c => [Number(c[1].toFixed(6)), Number(c[0].toFixed(6))]);
    } else {
      this.currentZoneCoords = [];
    }

    // Extract plots for this zone
    const existingPlots = AgriData.findPlotsByZone(props.name);
    this.currentZonePlots = JSON.parse(JSON.stringify(existingPlots));

    // If no plots exist yet, generate 1 default plot from zone properties
    if (this.currentZonePlots.length === 0 && props.tong_dt) {
      this.currentZonePlots.push({
        id: `plot_${Date.now()}_1`,
        stt: 'Thửa 1',
        xu_dong: props.name,
        ho_sx: 'Hộ canh tác 1',
        chu_ruong: 'Chủ quyền đất',
        is_rented: false,
        loai_dat: 'quy1',
        quy_1: props.quy_1 || props.tong_dt || 1000,
        quy_2: props.quy_2 || 0,
        quy_khac: 0,
        tong_dt: props.tong_dt || 1000,
        dia_chi: props.to_list || 'Tổ 1',
        dien_thoai: '',
        coords: this.currentZoneCoords.length > 0 ? this.currentZoneCoords[0] : null
      });
    }

    const btnDelete = document.getElementById('btn-delete-zone-modal');
    if (btnDelete) btnDelete.style.display = 'inline-flex';

    this.closePlotSubform();
    this.renderZoneCoordsTable();
    this.renderZonePlotsTable();

    modal.classList.add('open');
    if (window.lucide) lucide.createIcons();
  },

  // -------------------------------------------------------------------------
  // Coordinate Editor Methods
  // -------------------------------------------------------------------------

  renderZoneCoordsTable() {
    const tbody = document.getElementById('zone-coords-tbody');
    if (!tbody) return;

    if (this.currentZoneCoords.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:10px;">Chưa có điểm tọa độ. Hãy bấm [Thêm Điểm Tọa Độ] hoặc vẽ trên bản đồ.</td></tr>';
      return;
    }

    tbody.innerHTML = this.currentZoneCoords.map((pt, idx) => `
      <tr style="border-bottom: 1px solid var(--border-subtle);">
        <td style="font-weight: 700; text-align: center; color: var(--primary); padding: 4px;">#${idx + 1}</td>
        <td style="padding: 4px;">
          <input type="number" step="0.000001" value="${pt[0]}" 
            onchange="AgriMap.updateCoordinatePoint(${idx}, 0, this.value)" 
            style="width:100%; padding:4px 6px; font-size:0.78rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-app); color:var(--text-main);">
        </td>
        <td style="padding: 4px;">
          <input type="number" step="0.000001" value="${pt[1]}" 
            onchange="AgriMap.updateCoordinatePoint(${idx}, 1, this.value)" 
            style="width:100%; padding:4px 6px; font-size:0.78rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-app); color:var(--text-main);">
        </td>
        <td style="text-align: center; padding: 4px;">
          <button type="button" class="btn btn-sm btn-outline" style="color: #ef4444; padding: 2px 6px;" 
            onclick="AgriMap.deleteCoordinatePoint(${idx})" title="Xóa điểm này">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Re-calculate polygon area
    if (this.currentZoneCoords.length >= 3) {
      const area = this.calculateAreaM2(this.currentZoneCoords);
      const areaInput = document.getElementById('zone-edit-area');
      if (areaInput && (!areaInput.value || areaInput.value == 0 || areaInput.value == 1000)) {
        areaInput.value = area;
      }
    }

    if (window.lucide) lucide.createIcons();
  },

  addCoordinatePoint() {
    if (this.currentZoneCoords.length > 0) {
      const last = this.currentZoneCoords[this.currentZoneCoords.length - 1];
      // Add slight offset (~10m)
      this.currentZoneCoords.push([Number((last[0] + 0.0001).toFixed(6)), Number((last[1] + 0.0001).toFixed(6))]);
    } else {
      const center = this.map.getCenter();
      this.currentZoneCoords.push([Number(center.lat.toFixed(6)), Number(center.lng.toFixed(6))]);
    }
    this.renderZoneCoordsTable();
  },

  deleteCoordinatePoint(idx) {
    if (this.currentZoneCoords.length <= 3) {
      alert('Vùng ranh giới cần tối thiểu 3 điểm tọa độ để tạo thành một đa giác khép kín!');
      return;
    }
    this.currentZoneCoords.splice(idx, 1);
    this.renderZoneCoordsTable();
  },

  updateCoordinatePoint(idx, coordIdx, value) {
    const val = parseFloat(value);
    if (!isNaN(val)) {
      this.currentZoneCoords[idx][coordIdx] = Number(val.toFixed(6));
      if (this.currentZoneCoords.length >= 3) {
        const area = this.calculateAreaM2(this.currentZoneCoords);
        const areaInput = document.getElementById('zone-edit-area');
        if (areaInput) areaInput.value = area;
      }
    }
  },

  // -------------------------------------------------------------------------
  // Plot Sub-Form & Table Management
  // -------------------------------------------------------------------------

  renderZonePlotsTable() {
    const tbody = document.getElementById('zone-plots-tbody');
    if (!tbody) return;

    if (this.currentZonePlots.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:16px;">Chưa có thửa ruộng nào trong vùng. Hãy bấm nút <strong>[➕ Thêm Mới Thửa]</strong> ở trên.</td></tr>';
      return;
    }

    tbody.innerHTML = this.currentZonePlots.map((p, idx) => {
      const isRented = p.is_rented || (p.ho_sx && p.chu_ruong && p.ho_sx.trim().toLowerCase() !== p.chu_ruong.trim().toLowerCase());
      const badgeTenant = isRented
        ? `<span class="badge badge-amber" style="font-size:0.7rem;">Chủ khác: ${p.chu_ruong}</span>`
        : `<span class="badge badge-emerald" style="font-size:0.7rem;">Chính chủ</span>`;

      const loaiDatLabel = p.loai_dat === 'quy2' ? '<span style="color:#3b82f6; font-weight:600;">Quỹ 2</span>' 
        : (p.loai_dat === 'khac' ? '<span style="color:#8b5cf6; font-weight:600;">Khác</span>' : '<span style="color:#059669; font-weight:600;">Quỹ 1</span>');

      const coordsDisplay = p.coords && Array.isArray(p.coords)
        ? `<span title="Tọa độ: ${p.coords[0]}, ${p.coords[1]}" style="color:#059669; font-size:0.74rem;">📍 ${p.coords[0].toFixed(4)}, ${p.coords[1].toFixed(4)}</span>`
        : `<span style="color:var(--text-muted); font-size:0.74rem;">Chưa có</span>`;

      return `
        <tr style="border-bottom: 1px solid var(--border-subtle);">
          <td style="padding: 6px 8px; font-weight: 700; color: var(--primary);">${p.stt || `Thửa ${idx+1}`}</td>
          <td style="padding: 6px 8px; font-weight: 600;">${p.ho_sx || 'Chưa nhập'}</td>
          <td style="padding: 6px 8px;">
            ${p.chu_ruong || p.ho_sx || 'Chưa nhập'}
            <div style="margin-top:2px;">${badgeTenant}</div>
          </td>
          <td style="padding: 6px 8px;">${loaiDatLabel}</td>
          <td style="padding: 6px 8px; font-weight: 700;">${AgriData.formatArea(p.tong_dt)}</td>
          <td style="padding: 6px 8px; font-size: 0.74rem; color: var(--text-muted);">
            <div>${p.dia_chi || 'Tổ --'}</div>
            <div>${p.dien_thoai || ''}</div>
          </td>
          <td style="padding: 6px 8px;">${coordsDisplay}</td>
          <td style="padding: 6px 8px; text-align: center; white-space: nowrap;">
            <button type="button" class="btn btn-sm btn-outline" style="padding: 2px 6px; margin-right: 4px;" 
              onclick="AgriMap.editPlotInZone(${idx})" title="Sửa thửa này">
              <i data-lucide="edit-2" style="width:13px; height:13px;"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline" style="color: #ef4444; padding: 2px 6px;" 
              onclick="AgriMap.deletePlotInZone(${idx})" title="Xóa thửa này">
              <i data-lucide="trash-2" style="width:13px; height:13px;"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  },

  openAddPlotForm() {
    const subform = document.getElementById('subform-plot');
    if (!subform) return;

    document.getElementById('subform-plot-title').textContent = '➕ Thêm Thửa Ruộng Mới Vào Vùng';
    document.getElementById('plot-sub-index').value = '-1';
    document.getElementById('plot-sub-stt').value = `Thửa ${this.currentZonePlots.length + 1}`;
    document.getElementById('plot-sub-ho-sx').value = '';
    document.getElementById('plot-sub-chu-ruong').value = '';
    document.getElementById('plot-sub-tong-dt').value = '';
    document.getElementById('plot-sub-loai-dat').value = 'quy1';
    document.getElementById('plot-sub-dia-chi').value = document.getElementById('zone-edit-to').value || 'Tổ 1';
    document.getElementById('plot-sub-dien-thoai').value = '';

    // Default coordinates to zone centroid
    if (this.currentZoneCoords.length > 0) {
      document.getElementById('plot-sub-coords').value = `${this.currentZoneCoords[0][0]}, ${this.currentZoneCoords[0][1]}`;
    } else {
      document.getElementById('plot-sub-coords').value = '';
    }

    subform.style.display = 'block';
    subform.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  editPlotInZone(idx) {
    const plot = this.currentZonePlots[idx];
    if (!plot) return;

    const subform = document.getElementById('subform-plot');
    if (!subform) return;

    document.getElementById('subform-plot-title').textContent = `✏️ Chỉnh Sửa: ${plot.stt || `Thửa #${idx+1}`}`;
    document.getElementById('plot-sub-index').value = idx;
    document.getElementById('plot-sub-stt').value = plot.stt || `Thửa ${idx+1}`;
    document.getElementById('plot-sub-ho-sx').value = plot.ho_sx || '';
    document.getElementById('plot-sub-chu-ruong').value = plot.chu_ruong || plot.ho_sx || '';
    document.getElementById('plot-sub-tong-dt').value = plot.tong_dt || '';
    
    let loaiDat = 'quy1';
    if (plot.quy_2 > 0) loaiDat = 'quy2';
    else if (plot.quy_khac > 0) loaiDat = 'khac';
    else if (plot.loai_dat) loaiDat = plot.loai_dat;
    document.getElementById('plot-sub-loai-dat').value = loaiDat;

    document.getElementById('plot-sub-dia-chi').value = plot.dia_chi || document.getElementById('zone-edit-to').value;
    document.getElementById('plot-sub-dien-thoai').value = plot.dien_thoai || '';

    if (plot.coords && Array.isArray(plot.coords)) {
      document.getElementById('plot-sub-coords').value = `${plot.coords[0]}, ${plot.coords[1]}`;
    } else {
      document.getElementById('plot-sub-coords').value = '';
    }

    subform.style.display = 'block';
    subform.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  deletePlotInZone(idx) {
    const plot = this.currentZonePlots[idx];
    if (!plot) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa "${plot.stt || 'thửa này'}" (${plot.ho_sx || ''})?`)) return;

    this.currentZonePlots.splice(idx, 1);
    this.renderZonePlotsTable();
  },

  closePlotSubform() {
    const subform = document.getElementById('subform-plot');
    if (subform) subform.style.display = 'none';
  },

  pickPlotLocationOnMap() {
    if (this.currentZoneCoords.length > 0) {
      // Pick first point or average centroid
      const pt = this.currentZoneCoords[0];
      document.getElementById('plot-sub-coords').value = `${pt[0]}, ${pt[1]}`;
      alert(`📍 Đã gán vị trí tâm thửa theo tọa độ vùng: [${pt[0]}, ${pt[1]}]`);
    } else {
      const center = this.map.getCenter();
      document.getElementById('plot-sub-coords').value = `${Number(center.lat.toFixed(6))}, ${Number(center.lng.toFixed(6))}`;
      alert(`📍 Đã gán vị trí theo tâm bản đồ: [${Number(center.lat.toFixed(6))}, ${Number(center.lng.toFixed(6))}]`);
    }
  },

  clearPlotLocation() {
    document.getElementById('plot-sub-coords').value = '';
  },

  savePlotFromSubform() {
    const stt = document.getElementById('plot-sub-stt').value.trim();
    const hoSx = document.getElementById('plot-sub-ho-sx').value.trim();
    const chuRuong = document.getElementById('plot-sub-chu-ruong').value.trim() || hoSx;
    const area = parseFloat(document.getElementById('plot-sub-tong-dt').value) || 0;
    const loaiDat = document.getElementById('plot-sub-loai-dat').value;
    const diaChi = document.getElementById('plot-sub-dia-chi').value.trim();
    const phone = document.getElementById('plot-sub-dien-thoai').value.trim();
    const coordsStr = document.getElementById('plot-sub-coords').value.trim();

    if (!stt) {
      alert('Vui lòng nhập Số thửa (ví dụ: Thửa 1, Lô A...).');
      return;
    }
    if (!hoSx) {
      alert('Vui lòng nhập Tên Hộ Sản Xuất (người trực tiếp canh tác).');
      return;
    }
    if (area <= 0) {
      alert('Vui lòng nhập Diện tích thửa (> 0 m²).');
      return;
    }

    let parsedCoords = null;
    if (coordsStr) {
      const parts = coordsStr.split(',').map(s => parseFloat(s.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        parsedCoords = [parts[0], parts[1]];
      }
    }

    const isRented = hoSx.toLowerCase() !== chuRuong.toLowerCase();
    const quy1 = loaiDat === 'quy1' ? area : 0;
    const quy2 = loaiDat === 'quy2' ? area : 0;
    const quyKhac = loaiDat === 'khac' ? area : 0;

    const plotObj = {
      stt: stt,
      ho_sx: hoSx,
      chu_ruong: chuRuong,
      is_rented: isRented,
      loai_dat: loaiDat,
      quy_1: quy1,
      quy_2: quy2,
      quy_khac: quyKhac,
      tong_dt: area,
      dia_chi: diaChi,
      dien_thoai: phone,
      coords: parsedCoords,
      xu_dong: document.getElementById('zone-edit-name').value.trim()
    };

    const idx = parseInt(document.getElementById('plot-sub-index').value);
    if (idx >= 0 && idx < this.currentZonePlots.length) {
      // Update existing
      plotObj.id = this.currentZonePlots[idx].id || `plot_${Date.now()}_${idx}`;
      this.currentZonePlots[idx] = plotObj;
    } else {
      // Add new
      plotObj.id = `plot_${Date.now()}_${this.currentZonePlots.length + 1}`;
      this.currentZonePlots.push(plotObj);
    }

    this.closePlotSubform();
    this.renderZonePlotsTable();
  },

  // -------------------------------------------------------------------------
  // Master Save & Delete with Full Database Sync
  // -------------------------------------------------------------------------

  saveZoneModal() {
    if (window.AgriAuth && !AgriAuth.canEdit('map')) {
      alert('Tài khoản của bạn chỉ có quyền XEM Bản đồ GIS. Không thể lưu thay đổi!');
      return;
    }
    const name = document.getElementById('zone-edit-name').value.trim();
    const to = document.getElementById('zone-edit-to').value.trim();
    let area = parseFloat(document.getElementById('zone-edit-area').value) || 0;

    if (!name) {
      alert('Vui lòng nhập tên Xứ Đồng / Vùng Sản Xuất.');
      return;
    }

    if (this.currentZoneCoords.length < 3) {
      alert('Vùng sản xuất cần ít nhất 3 điểm tọa độ để tạo thành đa giác ranh giới khép kín!');
      return;
    }

    // Close polygon loop
    const geoCoords = this.currentZoneCoords.map(p => [p[1], p[0]]); // [lon, lat]
    geoCoords.push([geoCoords[0][0], geoCoords[0][1]]); // close ring

    // Calculate total Quỹ 1 & Quỹ 2 from plots
    const totalQuy1 = this.currentZonePlots.reduce((sum, p) => sum + (parseFloat(p.quy_1) || 0), 0);
    const totalQuy2 = this.currentZonePlots.reduce((sum, p) => sum + (parseFloat(p.quy_2) || 0), 0);
    const totalPlotsArea = this.currentZonePlots.reduce((sum, p) => sum + (parseFloat(p.tong_dt) || 0), 0);

    if (area <= 0) {
      area = totalPlotsArea > 0 ? totalPlotsArea : this.calculateAreaM2(this.currentZoneCoords);
    }

    // Unique farmers count
    const uniqueFarmers = new Set(this.currentZonePlots.map(p => p.ho_sx ? p.ho_sx.trim().toLowerCase() : '')).size;
    const uniqueOwners = new Set(this.currentZonePlots.map(p => p.chu_ruong ? p.chu_ruong.trim().toLowerCase() : '')).size;

    // Set xu_dong name on all plots
    this.currentZonePlots.forEach(p => {
      p.xu_dong = name;
    });

    const geoData = AgriData.getGeoJSON();
    if (!geoData.features) geoData.features = [];

    if (this.activeFeature) {
      // Update existing feature
      const f = this.activeFeature;
      f.properties.name = name;
      f.properties.to_list = to;
      f.properties.tong_dt = area;
      f.properties.dt_ha = Number((area / 10000).toFixed(2));
      f.properties.quy_1 = totalQuy1 > 0 ? totalQuy1 : area;
      f.properties.quy_2 = totalQuy2;
      f.properties.so_thua = this.currentZonePlots.length || 1;
      f.properties.so_ho = uniqueFarmers || 1;
      f.properties.so_chu = uniqueOwners || 1;
      f.geometry = {
        type: "Polygon",
        coordinates: [geoCoords]
      };
    } else {
      // Create new feature
      const newFeature = {
        type: "Feature",
        id: `zone_${Date.now()}`,
        properties: {
          name: name,
          tong_dt: area,
          dt_ha: Number((area / 10000).toFixed(2)),
          quy_1: totalQuy1 > 0 ? totalQuy1 : area,
          quy_2: totalQuy2,
          so_thua: this.currentZonePlots.length || 1,
          so_ho: uniqueFarmers || 1,
          so_chu: uniqueOwners || 1,
          to_list: to
        },
        geometry: {
          type: "Polygon",
          coordinates: [geoCoords]
        }
      };
      geoData.features.unshift(newFeature);
    }

    // Sync to data store and persist
    AgriData.syncAndPersist(geoData, name, this.currentZonePlots);

    // Refresh all active views
    this.renderGeoJSON();
    if (window.AgriPlots && AgriPlots.render) AgriPlots.render();
    if (window.AgriFarmers && AgriFarmers.render) AgriFarmers.render();
    if (window.AgriAnalytics && AgriAnalytics.render) AgriAnalytics.render();

    this.closeZoneModal();
    this.closeBottomSheet();

    // Fly to saved zone
    this.flyToZone(name);

    alert(`✅ Đã lưu và đồng bộ thành công Vùng sản xuất "${name}" cùng ${this.currentZonePlots.length} thửa ruộng vào cơ sở dữ liệu!`);
  },

  deleteZone() {
    if (window.AgriAuth && !AgriAuth.canAdmin('map')) {
      alert('Chỉ Quản trị viên mới có quyền XÓA vùng sản xuất!');
      return;
    }
    const feat = this.activeFeature || this.selectedFeature;
    if (!feat) return;

    const name = feat.properties.name;
    if (!confirm(`⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA:\nVùng sản xuất "${name}" và toàn bộ các thửa ruộng thuộc vùng này khỏi cơ sở dữ liệu?`)) {
      return;
    }

    AgriData.deleteZoneAndPlots(name);

    this.renderGeoJSON();
    if (window.AgriPlots && AgriPlots.render) AgriPlots.render();
    if (window.AgriFarmers && AgriFarmers.render) AgriFarmers.render();
    if (window.AgriAnalytics && AgriAnalytics.render) AgriAnalytics.render();

    this.closeZoneModal();
    this.closeBottomSheet();

    alert(`🗑️ Đã xóa hoàn toàn Vùng sản xuất "${name}" và các thửa ruộng liên quan khỏi hệ thống!`);
  },

  saveToLocalStorage() {
    const geoData = AgriData.getGeoJSON();
    if (geoData) {
      try {
        localStorage.setItem('agrigis_custom_geojson', JSON.stringify(geoData));
      } catch (e) {}
    }
  },

  closeZoneModal() {
    const modal = document.getElementById('modal-zone-edit');
    if (modal) modal.classList.remove('open');
  },

  // =========================================================================
  // 5. GPS GEOLOCATION REAL-TIME
  // =========================================================================

  locateUser() {
    if (!navigator.geolocation) {
      alert('Thiết bị của bạn không hỗ trợ GPS.');
      return;
    }

    const btn = document.getElementById('btn-dock-locate');
    if (btn) btn.classList.add('active');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        if (this.userMarker) this.map.removeLayer(this.userMarker);
        if (this.userAccuracyCircle) this.map.removeLayer(this.userAccuracyCircle);

        this.userMarker = L.circleMarker([lat, lon], {
          radius: 8,
          fillColor: '#3b82f6',
          color: '#ffffff',
          weight: 3,
          opacity: 1,
          fillOpacity: 1
        }).addTo(this.map).bindPopup(`<b>Vị trí thực địa của bạn</b><br>Độ chính xác: ±${Math.round(accuracy)}m`).openPopup();

        this.userAccuracyCircle = L.circle([lat, lon], {
          radius: accuracy,
          fillColor: '#3b82f6',
          fillOpacity: 0.15,
          weight: 1,
          color: '#3b82f6'
        }).addTo(this.map);

        this.map.setView([lat, lon], 17);
        if (btn) btn.classList.remove('active');
      },
      (err) => {
        alert('Không lấy được vị trí GPS. Vui lòng cho phép quyền vị trí trên trình duyệt.');
        if (btn) btn.classList.remove('active');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  },

  // =========================================================================
  // 6. BASEMAP SWITCHER
  // =========================================================================

  setBasemap(name) {
    if (!this.baseLayers[name]) return;

    Object.values(this.baseLayers).forEach(layer => {
      if (this.map.hasLayer(layer)) this.map.removeLayer(layer);
    });

    this.baseLayers[name].addTo(this.map);
    this.currentBaseLayerName = name;

    // Bring geoJson layer to front
    if (this.geoJsonLayer) {
      this.geoJsonLayer.bringToFront();
    }
  },

  // =========================================================================
  // 7. IMPORT / EXPORT DATA ENGINE
  // =========================================================================

  exportGeoJSON() {
    const geoData = AgriData.getGeoJSON();
    if (!geoData) return;

    const str = JSON.stringify(geoData, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ban_Do_Vung_San_Xuat_HoaTien_${new Date().toISOString().slice(0,10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  exportKML() {
    const geoData = AgriData.getGeoJSON();
    if (!geoData || !geoData.features) return;

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Ban Do Vung San Xuat Hoa Tien</name>
    <Style id="agriPoly">
      <LineStyle><color>ff009605</color><width>2</width></LineStyle>
      <PolyStyle><color>7f00ff00</color></PolyStyle>
    </Style>
`;

    geoData.features.forEach(f => {
      const name = f.properties.name || 'Vung';
      const area = f.properties.tong_dt || 0;
      const coords = f.geometry.coordinates[0];
      const coordStr = coords.map(c => `${c[0]},${c[1]},0`).join(' ');

      kml += `    <Placemark>
      <name>${name}</name>
      <description>Dien tich: ${area} m2 (${(area/10000).toFixed(2)} ha)</description>
      <styleUrl>#agriPoly</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${coordStr}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
`;
    });

    kml += `  </Document>
</kml>`;

    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ban_Do_Nong_Nghiep_HoaTien_${new Date().toISOString().slice(0,10)}.kml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  resetDefaultMap() {
    if (!confirm('Bạn có chắc muốn khôi phục lại dữ liệu bản đồ gốc ban đầu?')) return;

    localStorage.removeItem('agrigis_custom_geojson');
    if (window.AGRI_GEOJSON_DATA) {
      AgriData.geoJson = JSON.parse(JSON.stringify(window.AGRI_GEOJSON_DATA));
    }
    this.renderGeoJSON();
    this.closeBottomSheet();
    alert('Đã khôi phục dữ liệu bản đồ gốc thành công!');
  },

  // =========================================================================
  // 8. BIND ALL UI INTERACTION EVENTS
  // =========================================================================

  bindUIEvents() {
    // Dock Panel Tab Switcher
    document.querySelectorAll('.dock-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.panel;
        document.querySelectorAll('.dock-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.dock-panel-content').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activeContent = document.getElementById(`dock-panel-${tab}`);
        if (activeContent) activeContent.classList.add('active');
      });
    });

    // Basemap switch radio
    document.querySelectorAll('input[name="basemap-radio"]').forEach(r => {
      r.addEventListener('change', (e) => {
        this.setBasemap(e.target.value);
      });
    });

    // Drawing & Measuring buttons
    document.getElementById('btn-tool-draw-polygon')?.addEventListener('click', () => this.startDrawPolygon());
    document.getElementById('btn-tool-measure-area')?.addEventListener('click', () => this.startMeasureArea());
    document.getElementById('btn-tool-measure-dist')?.addEventListener('click', () => this.startMeasureDistance());
    document.getElementById('btn-draw-finish')?.addEventListener('click', () => this.finishDrawing());
    document.getElementById('btn-draw-cancel')?.addEventListener('click', () => this.cancelDrawing());

    // GPS Locate
    document.getElementById('btn-dock-locate')?.addEventListener('click', () => this.locateUser());

    // Fit View
    document.getElementById('btn-dock-fit')?.addEventListener('click', () => {
      if (this.geoJsonLayer) {
        this.map.fitBounds(this.geoJsonLayer.getBounds(), { padding: [20, 20] });
      }
    });

    // Bottom sheet close & edit
    document.getElementById('sheet-close-btn')?.addEventListener('click', () => this.closeBottomSheet());
    document.getElementById('sheet-edit-btn')?.addEventListener('click', () => {
      if (this.selectedFeature) this.openEditZoneModal(this.selectedFeature);
    });

    // Zone Modal buttons
    document.getElementById('btn-save-zone-modal')?.addEventListener('click', () => this.saveZoneModal());
    document.getElementById('btn-delete-zone-modal')?.addEventListener('click', () => this.deleteZone());

    // Export Buttons
    document.getElementById('btn-dock-export-geojson')?.addEventListener('click', () => this.exportGeoJSON());
    document.getElementById('btn-dock-export-kml')?.addEventListener('click', () => this.exportKML());
    document.getElementById('btn-dock-reset-map')?.addEventListener('click', () => this.resetDefaultMap());

    // File Import Drag & Drop
    const fileInput = document.getElementById('dock-file-input');
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.importFile(e.target.files[0]);
      }
    });

    // Search bar
    const searchInput = document.getElementById('map-search-input');
    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) return;
      const matched = AgriData.getZones().find(z => z.name.toLowerCase().includes(q));
      if (matched) this.flyToZone(matched.name);
    });

    // Filter Chips
    document.querySelectorAll('.map-chip-filters .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.map-chip-filters .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.renderGeoJSON(chip.dataset.filter);
      });
    });
  },

  importFile(file) {
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target.result;

      if (fileName.endsWith('.kml')) {
        // Parse KML (Google Earth)
        try {
          const geoJson = this.parseKMLToGeoJSON(content, file.name);
          if (geoJson && geoJson.features && geoJson.features.length > 0) {
            this.addImportedFeatures(geoJson.features, file.name);
          } else {
            alert('Không tìm thấy vùng hình học (Polygon/Placemark) hợp lệ trong tệp KML.');
          }
        } catch (err) {
          console.error('KML parse error:', err);
          alert('Lỗi khi đọc tệp KML: ' + err.message);
        }
      } else if (fileName.endsWith('.geojson') || fileName.endsWith('.json')) {
        // Parse GeoJSON / JSON
        try {
          const parsed = JSON.parse(content);
          if (parsed.features && parsed.features.length > 0) {
            this.addImportedFeatures(parsed.features, file.name);
          } else if (parsed.type === 'Feature') {
            this.addImportedFeatures([parsed], file.name);
          } else {
            alert('Tệp JSON không chứa danh sách Feature hợp lệ.');
          }
        } catch (err) {
          alert('Lỗi phân tích cú pháp tệp JSON: ' + err.message);
        }
      } else {
        alert('Định dạng tệp không được hỗ trợ. Vui lòng chọn tệp .kml, .geojson hoặc .json');
      }
    };

    reader.readAsText(file);
  },

  // Parse KML XML into GeoJSON FeatureCollection
  parseKMLToGeoJSON(kmlText, sourceFileName) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, 'text/xml');
    const placemarks = xml.querySelectorAll('Placemark');
    const features = [];

    placemarks.forEach((pm, idx) => {
      const name = pm.querySelector('name')?.textContent?.trim() || `Thửa KML #${idx + 1}`;
      const desc = pm.querySelector('description')?.textContent?.trim() || '';

      // 1. Check for Polygon
      const polygonEl = pm.querySelector('Polygon');
      if (polygonEl) {
        const coordsEl = polygonEl.querySelector('coordinates');
        if (coordsEl) {
          const polyCoords = this.extractCoords(coordsEl.textContent);
          if (polyCoords.length >= 3) {
            // Close loop if needed
            if (polyCoords[0][0] !== polyCoords[polyCoords.length - 1][0] || polyCoords[0][1] !== polyCoords[polyCoords.length - 1][1]) {
              polyCoords.push([polyCoords[0][0], polyCoords[0][1]]);
            }

            const feature = {
              type: "Feature",
              id: `kml_poly_${Date.now()}_${idx}`,
              properties: {
                name: name,
                description: desc,
                source: sourceFileName,
                so_thua: 1,
                so_ho: 1,
                to_list: 'Nhập từ KML'
              },
              geometry: {
                type: "Polygon",
                coordinates: [polyCoords]
              }
            };

            // Calculate area
            try {
              if (window.turf) {
                feature.properties.tong_dt = Math.round(turf.area(feature));
                feature.properties.dt_ha = Number((feature.properties.tong_dt / 10000).toFixed(2));
                feature.properties.quy_1 = feature.properties.tong_dt;
                feature.properties.quy_2 = 0;
              }
            } catch (e) {}

            features.push(feature);
            return;
          }
        }
      }

      // 2. Check for LineString
      const lineEl = pm.querySelector('LineString');
      if (lineEl) {
        const coordsEl = lineEl.querySelector('coordinates');
        if (coordsEl) {
          const lineCoords = this.extractCoords(coordsEl.textContent);
          if (lineCoords.length >= 2) {
            features.push({
              type: "Feature",
              id: `kml_line_${Date.now()}_${idx}`,
              properties: {
                name: name,
                description: desc,
                source: sourceFileName,
                so_thua: 1,
                to_list: 'Tuyến KML'
              },
              geometry: {
                type: "LineString",
                coordinates: lineCoords
              }
            });
            return;
          }
        }
      }

      // 3. Check for Point
      const pointEl = pm.querySelector('Point');
      if (pointEl) {
        const coordsEl = pointEl.querySelector('coordinates');
        if (coordsEl) {
          const ptCoords = this.extractCoords(coordsEl.textContent);
          if (ptCoords.length >= 1) {
            features.push({
              type: "Feature",
              id: `kml_pt_${Date.now()}_${idx}`,
              properties: {
                name: name,
                description: desc,
                source: sourceFileName,
                to_list: 'Điểm KML'
              },
              geometry: {
                type: "Point",
                coordinates: ptCoords[0]
              }
            });
          }
        }
      }
    });

    return {
      type: "FeatureCollection",
      features: features
    };
  },

  // Helper to extract [lon, lat] pairs from KML coordinates string
  extractCoords(coordsStr) {
    if (!coordsStr) return [];
    const rawTokens = coordsStr.trim().split(/\s+/);
    const coords = [];

    rawTokens.forEach(tok => {
      const parts = tok.split(',').map(s => parseFloat(s.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        coords.push([parts[0], parts[1]]); // [lon, lat]
      }
    });

    return coords;
  },

  // Add imported features to map store and fit view
  addImportedFeatures(newFeatures, fileName) {
    const current = AgriData.getGeoJSON();
    if (!current) return;

    if (!current.features) current.features = [];

    // Prepend new features so they appear at top
    newFeatures.forEach(f => {
      if (!f.properties) f.properties = {};
      if (!f.properties.name) f.properties.name = `Thửa nhập ${fileName}`;
      if (!f.properties.tong_dt && window.turf && f.geometry.type === 'Polygon') {
        try {
          f.properties.tong_dt = Math.round(turf.area(f));
          f.properties.dt_ha = Number((f.properties.tong_dt / 10000).toFixed(2));
          f.properties.quy_1 = f.properties.tong_dt;
          f.properties.quy_2 = 0;
        } catch (e) {}
      }
      if (!f.properties.to_list) f.properties.to_list = 'Tổ tự chọn';
      if (!f.properties.so_thua) f.properties.so_thua = 1;
      if (!f.properties.so_ho) f.properties.so_ho = 1;
    });

    current.features.unshift(...newFeatures);
    this.saveToLocalStorage();
    this.renderGeoJSON();

    // Zoom to imported features
    try {
      const tempLayer = L.geoJSON({ type: 'FeatureCollection', features: newFeatures });
      const bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { maxZoom: 17, padding: [30, 30] });
      }
    } catch (e) {}

    alert(`✅ Đã nhập thành công ${newFeatures.length} đối tượng từ tệp "${fileName}" vào bản đồ!`);
  }
};

