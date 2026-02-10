# 🏥 ClinicsGPS

Interactive map application displaying **81 clinics** across Tel Aviv, Holon, Bat Yam, Jaffa, and Azor.

## 🌟 Features

- **🗺️ Interactive Map** — Dark-themed map with clustered markers, color-coded by city
- **📍 My Location** — Browser geolocation with pulsing blue marker
- **🔎 Nearest Clinics** — Find the 5 closest clinics from any location
- **🧭 Routing** — Get driving directions with distance & estimated time (OSRM)
- **🔍 Search & Filter** — Real-time search + city filter chips
- **🗺️ Google Maps Integration** — One-click navigation
- **💾 LocalStorage Cache** — Fast subsequent loads
- **📱 Fully Responsive** — Mobile-friendly design

## 🚀 Live Demo

**Coming soon** — Enable GitHub Pages in repository settings!

## 🛠️ Technologies

- **Leaflet.js** — Interactive maps
- **OpenStreetMap** — Map tiles (CARTO Dark theme)
- **Nominatim** — Free geocoding service
- **OSRM** — Free routing engine
- **Vanilla JS** — No frameworks, pure JavaScript
- **LocalStorage** — Client-side data caching

## 📦 Files

- `index.html` — Main application page
- `style.css` — Dark glassmorphism theme with RTL Hebrew support
- `app.js` — Application logic (map, routing, search)
- `clinics_geocoded.json` — Clinic data with GPS coordinates (81 clinics)

## 🏃 Run Locally

```bash
# Clone the repository
git clone https://github.com/liad142/ClinicsGPS.git
cd ClinicsGPS

# Serve locally
npx serve .
# Open http://localhost:3000
```

## 🌐 Deploy to GitHub Pages

1. Go to **Settings** → **Pages**
2. Under **Source**, select **main** branch
3. Click **Save**
4. Your app will be live at: `https://liad142.github.io/ClinicsGPS/`

## 📊 Geocoding Stats

| Status | Count |
|--------|-------|
| ✅ Exact match | 63 |
| ⚠️ City fallback | 12 |
| ⏭️ Skipped | 6 |
| ❌ Failed | 1 |

## 🎨 Design

- **Dark glassmorphism** theme
- **RTL Hebrew** interface
- **Smooth animations** and transitions
- **Color-coded markers** by city
- **Responsive layout** for mobile & desktop

## 📝 License

MIT License — Free to use and modify

---

**Built with ❤️ using only free services**
