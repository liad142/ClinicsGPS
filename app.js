/* ============================================
   ClinicsGPS — Main Application
   ============================================ */

(function () {
    'use strict';

    // ── Config ────────────────────────────────
    const LS_KEY = 'clinicsGPS_data';
    const DEFAULT_CENTER = [32.07, 34.78]; // Tel Aviv
    const DEFAULT_ZOOM = 12;

    // ── City color mapping ────────────────────
    const cityStyles = {
        'תל אביב': { color: '#6c5ce7', icon: '🏥', cls: 'ta' },
        'חולון': { color: '#00cec9', icon: '🏥', cls: 'holon' },
        'בת ים': { color: '#fdcb6e', icon: '🏥', cls: 'batyam' },
        'בת-ים': { color: '#fdcb6e', icon: '🏥', cls: 'batyam' },
        'בת- ים': { color: '#fdcb6e', icon: '🏥', cls: 'batyam' },
        'בתים': { color: '#fdcb6e', icon: '🏥', cls: 'batyam' },
        'יפו': { color: '#ff7675', icon: '🏥', cls: 'jaffa' },
        'אזור': { color: '#a4a7b5', icon: '🏥', cls: 'other' },
    };

    function getCityStyle(city) {
        if (!city) return { color: '#a4a7b5', icon: '🏥', cls: 'other' };
        for (const [key, val] of Object.entries(cityStyles)) {
            if (city.includes(key)) return val;
        }
        return { color: '#a4a7b5', icon: '🏥', cls: 'other' };
    }

    // ── State ─────────────────────────────────
    let map, markerCluster, userMarker, routeLine;
    let clinics = [];
    let markers = {};
    let userPos = null;
    let routeFromClinic = null;
    let selectedClinicIdx = null;
    let activeFilter = 'all';

    // ── DOM refs ──────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const loadingOverlay = $('#loading-overlay');
    const loadingStatus = $('#loading-status');
    const loadingBar = $('#loading-bar');
    const sidebar = $('#sidebar');
    const searchInput = $('#search-input');
    const clinicListEl = $('#clinic-list');
    const cityFilterEl = $('#city-filter');
    const routePanel = $('#route-panel');
    const nearestListEl = $('#nearest-list');
    const nearestUl = $('#nearest-ul');

    // ── Init ──────────────────────────────────
    async function init() {
        setLoadingProgress(10, 'מאתחל מפה...');
        initMap();

        setLoadingProgress(20, 'טוען נתוני קליניקות...');
        await loadClinics();

        setLoadingProgress(80, 'מציב סמנים על המפה...');
        renderMarkers();
        renderCityFilter();
        renderClinicList();
        updateStats();

        setLoadingProgress(90, 'מסיים אתחול...');
        bindEvents();

        setLoadingProgress(100, 'מוכן!');
        setTimeout(() => loadingOverlay.classList.add('hidden'), 400);
    }

    function setLoadingProgress(pct, text) {
        loadingBar.style.width = pct + '%';
        if (text) loadingStatus.textContent = text;
    }

    // ── Map Init ──────────────────────────────
    function initMap() {
        map = L.map('map', {
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            zoomControl: true,
        });

        // Dark map tiles (free)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
        }).addTo(map);

        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 40,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="cluster-icon">${count}</div>`,
                    className: 'custom-cluster',
                    iconSize: [40, 40],
                });
            },
        });
        map.addLayer(markerCluster);

        // Add cluster styles dynamically
        const style = document.createElement('style');
        style.textContent = `
      .custom-cluster { background: none; }
      .cluster-icon {
        width: 40px; height: 40px; border-radius: 50%;
        background: linear-gradient(135deg, #6c5ce7, #00cec9);
        color: white; display: flex; align-items: center; justify-content: center;
        font-weight: 700; font-size: 14px; font-family: 'Heebo', sans-serif;
        box-shadow: 0 3px 12px rgba(108,92,231,0.4);
        border: 2px solid rgba(255,255,255,0.2);
      }
    `;
        document.head.appendChild(style);
    }

    // ── Load Clinics ──────────────────────────
    async function loadClinics() {
        // Try LocalStorage first
        const cached = localStorage.getItem(LS_KEY);
        if (cached) {
            try {
                clinics = JSON.parse(cached);
                if (clinics.length > 0 && clinics[0].lat !== undefined) {
                    setLoadingProgress(70, `נטען מהמטמון (${clinics.length} קליניקות)`);
                    return;
                }
            } catch (e) { /* ignore */ }
        }

        // Load from geocoded file
        try {
            const res = await fetch('clinics_geocoded.json');
            const data = await res.json();
            clinics = data.filter(c => c.lat && c.lng);
            localStorage.setItem(LS_KEY, JSON.stringify(clinics));
            setLoadingProgress(70, `נטענו ${clinics.length} קליניקות`);
        } catch (err) {
            console.error('Failed to load clinics:', err);
            setLoadingProgress(70, 'שגיאה בטעינת נתונים');
        }
    }

    // ── Render Markers ────────────────────────
    function renderMarkers() {
        markerCluster.clearLayers();
        markers = {};

        clinics.forEach((clinic, idx) => {
            if (!clinic.lat || !clinic.lng) return;

            const style = getCityStyle(clinic.city);
            const icon = L.divIcon({
                html: `<div style="
          width:32px;height:32px;border-radius:50%;
          background:${style.color};
          display:flex;align-items:center;justify-content:center;
          font-size:15px;
          box-shadow:0 2px 8px ${style.color}66;
          border:2px solid rgba(255,255,255,0.3);
          transition:transform 0.2s;
        ">🏥</div>`,
                className: 'clinic-marker',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -18],
            });

            const marker = L.marker([clinic.lat, clinic.lng], { icon });
            marker.bindPopup(() => createPopup(clinic, idx), { maxWidth: 280 });
            marker.on('click', () => {
                selectedClinicIdx = idx;
                highlightCard(idx);
            });

            markers[idx] = marker;
            markerCluster.addLayer(marker);
        });
    }

    function createPopup(clinic, idx) {
        const phone = clinic.phone
            ? `<div class="popup-field">📞 <a href="tel:${clinic.phone}" style="color:#a29bfe;text-decoration:none;">${clinic.phone}</a></div>`
            : '';
        const distance = userPos
            ? `<div class="popup-field">📏 ${formatDistance(haversine(userPos, [clinic.lat, clinic.lng]))} ממך</div>`
            : '';

        return `
      <div class="popup-content">
        <h3>${clinic.clinic}</h3>
        <div class="popup-field">📍 ${clinic.address || clinic.city}</div>
        ${phone}
        ${distance}
        <div class="popup-actions">
          <button class="popup-btn popup-btn-nearest" onclick="window._clinicsApp.showNearest(${idx})">🔎 קרובות</button>
          <button class="popup-btn popup-btn-route" onclick="window._clinicsApp.setRouteFrom(${idx})">🧭 נווט מכאן</button>
          <button class="popup-btn popup-btn-navigate" onclick="window._clinicsApp.openGoogleMaps(${idx})">🗺️ Google Maps</button>
        </div>
      </div>
    `;
    }

    // ── City Filter ───────────────────────────
    function renderCityFilter() {
        const cities = [...new Set(clinics.map(c => normalizeCityName(c.city)).filter(Boolean))].sort();
        let html = '<button class="city-chip active" data-city="all">הכל</button>';
        cities.forEach(c => {
            html += `<button class="city-chip" data-city="${c}">${c}</button>`;
        });
        cityFilterEl.innerHTML = html;

        cityFilterEl.querySelectorAll('.city-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                cityFilterEl.querySelectorAll('.city-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.city;
                filterClinics();
            });
        });
    }

    function normalizeCityName(city) {
        if (!city) return '';
        if (city.includes('תל אביב') || city === 'תל אביב-יפו') return 'תל אביב';
        if (city.includes('בת') && city.includes('ים')) return 'בת ים';
        if (city === 'בתים') return 'בת ים';
        if (city === 'יפו') return 'יפו';
        if (city === 'חולון') return 'חולון';
        if (city === 'אזור') return 'אזור';
        return city;
    }

    // ── Clinic List ───────────────────────────
    function renderClinicList(filteredList) {
        const list = filteredList || clinics;
        let html = '';

        list.forEach((clinic, origIdx) => {
            const idx = filteredList ? clinics.indexOf(clinic) : origIdx;
            if (!clinic.lat || !clinic.lng) return;

            const style = getCityStyle(clinic.city);
            const dist = userPos
                ? `<span class="clinic-distance">${formatDistance(haversine(userPos, [clinic.lat, clinic.lng]))}</span>`
                : '';

            html += `
        <div class="clinic-card" data-idx="${idx}" onclick="window._clinicsApp.flyTo(${idx})">
          <div class="clinic-icon ${style.cls}">${style.icon}</div>
          <div class="clinic-info">
            <div class="clinic-name">${clinic.clinic}</div>
            <div class="clinic-address">${clinic.address || clinic.city || ''}</div>
          </div>
          ${dist}
        </div>
      `;
        });

        clinicListEl.innerHTML = html || '<p style="text-align:center;color:var(--text-muted);padding:20px;">לא נמצאו קליניקות</p>';
    }

    function highlightCard(idx) {
        clinicListEl.querySelectorAll('.clinic-card').forEach(c => c.classList.remove('active'));
        const card = clinicListEl.querySelector(`[data-idx="${idx}"]`);
        if (card) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // ── Filter ────────────────────────────────
    function filterClinics() {
        const query = searchInput.value.trim().toLowerCase();
        let filtered = clinics.filter(c => c.lat && c.lng);

        if (activeFilter !== 'all') {
            filtered = filtered.filter(c => normalizeCityName(c.city) === activeFilter);
        }

        if (query) {
            filtered = filtered.filter(c =>
                (c.clinic && c.clinic.toLowerCase().includes(query)) ||
                (c.city && c.city.toLowerCase().includes(query)) ||
                (c.address && c.address.toLowerCase().includes(query))
            );
        }

        renderClinicList(filtered);
        updateStats(filtered.length);

        // Update map to show only filtered markers
        markerCluster.clearLayers();
        filtered.forEach(clinic => {
            const idx = clinics.indexOf(clinic);
            if (markers[idx]) markerCluster.addLayer(markers[idx]);
        });
    }

    // ── Stats ─────────────────────────────────
    function updateStats(visibleCount) {
        const validClinics = clinics.filter(c => c.lat && c.lng);
        const cities = new Set(validClinics.map(c => normalizeCityName(c.city)).filter(Boolean));
        $('#total-clinics').textContent = validClinics.length;
        $('#total-cities').textContent = cities.size;
        $('#visible-count').textContent = visibleCount !== undefined ? visibleCount : validClinics.length;
    }

    // ── Fly to Clinic ────────────────────────
    function flyTo(idx) {
        const clinic = clinics[idx];
        if (!clinic || !clinic.lat) return;
        map.flyTo([clinic.lat, clinic.lng], 16, { duration: 0.8 });
        selectedClinicIdx = idx;
        highlightCard(idx);

        // Open popup
        if (markers[idx]) {
            setTimeout(() => markers[idx].openPopup(), 400);
        }
    }

    // ── Geolocation ───────────────────────────
    function locateUser() {
        if (!navigator.geolocation) {
            alert('הדפדפן לא תומך במיקום');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userPos = [pos.coords.latitude, pos.coords.longitude];
                showUserMarker();
                map.flyTo(userPos, 14, { duration: 1 });

                // Re-render list with distances
                filterClinics();
            },
            (err) => {
                alert('לא הצלחנו לאתר את המיקום שלך. וודא שאישרת גישה למיקום.');
                console.error(err);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }

    function showUserMarker() {
        if (userMarker) map.removeLayer(userMarker);
        const icon = L.divIcon({
            html: '<div class="user-location-marker"></div>',
            className: '',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
        });
        userMarker = L.marker(userPos, { icon, zIndexOffset: 1000 }).addTo(map);
        userMarker.bindPopup('<div class="popup-content"><h3>📍 המיקום שלי</h3></div>');
    }

    // ── Nearest Clinics ───────────────────────
    function showNearestFromUser() {
        if (!userPos) {
            // First locate user, then show nearest
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userPos = [pos.coords.latitude, pos.coords.longitude];
                    showUserMarker();
                    map.flyTo(userPos, 14, { duration: 1 });
                    filterClinics();
                    showNearestFrom(userPos, 'המיקום שלי');
                },
                () => alert('לא הצלחנו לאתר את המיקום שלך'),
                { enableHighAccuracy: true, timeout: 10000 }
            );
            return;
        }
        showNearestFrom(userPos, 'המיקום שלי');
    }

    function showNearest(idx) {
        const clinic = clinics[idx];
        if (!clinic) return;
        showNearestFrom([clinic.lat, clinic.lng], clinic.clinic, idx);
    }

    function showNearestFrom(pos, name, excludeIdx) {
        const distances = clinics
            .map((c, i) => ({ clinic: c, idx: i, dist: (c.lat && c.lng) ? haversine(pos, [c.lat, c.lng]) : Infinity }))
            .filter(d => d.idx !== excludeIdx && d.dist < Infinity)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 5);

        // Highlight in list
        clinicListEl.querySelectorAll('.clinic-card').forEach(c => c.classList.remove('nearest-highlight'));
        distances.forEach(d => {
            const card = clinicListEl.querySelector(`[data-idx="${d.idx}"]`);
            if (card) card.classList.add('nearest-highlight');
        });

        // Show in route panel
        nearestListEl.style.display = 'block';
        $('#route-from-name').textContent = name;
        $('#route-to-name').textContent = `${distances.length} קליניקות קרובות`;
        $('#route-distance').textContent = '';
        $('#route-time').textContent = '';

        nearestUl.innerHTML = distances.map(d => `
      <li onclick="window._clinicsApp.routeTo(${d.idx})" title="לחץ לניווט">
        <span class="nearest-name">${d.clinic.clinic}</span>
        <span class="nearest-dist">${formatDistance(d.dist)}</span>
      </li>
    `).join('');

        routePanel.classList.add('visible');

        // Fit bounds to show all nearest
        const bounds = L.latLngBounds([pos, ...distances.map(d => [d.clinic.lat, d.clinic.lng])]);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }

    // ── Routing (OSRM free) ───────────────────
    function setRouteFrom(idx) {
        routeFromClinic = idx;
        const clinic = clinics[idx];
        alert(`נבחרה קליניקת מוצא: ${clinic.clinic}\nעכשיו לחץ על קליניקה אחרת במפה כדי לראות מסלול.`);
    }

    function routeTo(idx) {
        if (routeFromClinic === null && !userPos) {
            // Route from user to clinic
            if (!userPos) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        userPos = [pos.coords.latitude, pos.coords.longitude];
                        showUserMarker();
                        calcRoute(userPos, [clinics[idx].lat, clinics[idx].lng], 'המיקום שלי', clinics[idx].clinic);
                    },
                    () => alert('לא הצלחנו לאתר את המיקום שלך'),
                    { enableHighAccuracy: true, timeout: 10000 }
                );
                return;
            }
            calcRoute(userPos, [clinics[idx].lat, clinics[idx].lng], 'המיקום שלי', clinics[idx].clinic);
            return;
        }

        if (routeFromClinic !== null) {
            const from = clinics[routeFromClinic];
            const to = clinics[idx];
            calcRoute([from.lat, from.lng], [to.lat, to.lng], from.clinic, to.clinic);
            routeFromClinic = null;
        } else if (userPos) {
            calcRoute(userPos, [clinics[idx].lat, clinics[idx].lng], 'המיקום שלי', clinics[idx].clinic);
        }
    }

    async function calcRoute(from, to, fromName, toName) {
        try {
            // Clear previous route
            if (routeLine) map.removeLayer(routeLine);

            const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
                alert('לא הצלחנו למצוא מסלול');
                return;
            }

            const route = data.routes[0];
            const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);

            routeLine = L.polyline(coords, {
                color: '#6c5ce7',
                weight: 5,
                opacity: 0.8,
                dashArray: '10, 8',
                lineCap: 'round',
            }).addTo(map);

            map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });

            // Update route panel
            const distKm = (route.distance / 1000).toFixed(1);
            const mins = Math.round(route.duration / 60);

            $('#route-from-name').textContent = fromName;
            $('#route-to-name').textContent = toName;
            $('#route-distance').textContent = `${distKm} ק"מ`;
            $('#route-time').textContent = `${mins} דקות`;
            nearestListEl.style.display = 'none';
            routePanel.classList.add('visible');
        } catch (err) {
            console.error('Routing error:', err);
            alert('שגיאה בחישוב מסלול');
        }
    }

    function openGoogleMaps(idx) {
        const clinic = clinics[idx];
        if (!clinic) return;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${clinic.lat},${clinic.lng}`;
        window.open(url, '_blank');
    }

    // ── Events ────────────────────────────────
    function bindEvents() {
        // Sidebar toggle
        $('#sidebar-close').addEventListener('click', () => sidebar.classList.add('collapsed'));
        $('#sidebar-open').addEventListener('click', () => sidebar.classList.remove('collapsed'));

        // Search
        searchInput.addEventListener('input', debounce(filterClinics, 200));

        // Location
        $('#btn-locate').addEventListener('click', locateUser);
        $('#btn-nearest').addEventListener('click', showNearestFromUser);

        // Close route panel
        $('#btn-close-route').addEventListener('click', () => {
            routePanel.classList.remove('visible');
            if (routeLine) map.removeLayer(routeLine);
            clinicListEl.querySelectorAll('.clinic-card').forEach(c => c.classList.remove('nearest-highlight'));
        });

        // Map click for routing
        map.on('popupopen', (e) => {
            // Check if we're in routing mode
            if (routeFromClinic !== null) {
                // Find which marker was clicked
                for (const [idx, marker] of Object.entries(markers)) {
                    if (marker === e.popup._source && parseInt(idx) !== routeFromClinic) {
                        routeTo(parseInt(idx));
                        break;
                    }
                }
            }
        });

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                sidebar.classList.add('collapsed');
                routePanel.classList.remove('visible');
            }
            if (e.key === '/' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                sidebar.classList.remove('collapsed');
                searchInput.focus();
            }
        });
    }

    // ── Utilities ─────────────────────────────
    function haversine(a, b) {
        const R = 6371;
        const dLat = deg2rad(b[0] - a[0]);
        const dLon = deg2rad(b[1] - a[1]);
        const sinLat = Math.sin(dLat / 2);
        const sinLon = Math.sin(dLon / 2);
        const h = sinLat * sinLat + Math.cos(deg2rad(a[0])) * Math.cos(deg2rad(b[0])) * sinLon * sinLon;
        return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    function deg2rad(d) { return d * (Math.PI / 180); }

    function formatDistance(km) {
        if (km < 1) return `${Math.round(km * 1000)} מ'`;
        return `${km.toFixed(1)} ק"מ`;
    }

    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    // ── Expose global API for popup buttons ───
    window._clinicsApp = {
        flyTo,
        showNearest,
        setRouteFrom,
        routeTo,
        openGoogleMaps,
    };

    // ── Boot ──────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);
})();
