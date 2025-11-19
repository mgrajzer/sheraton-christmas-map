/* ==========================================================
   Sheraton Christmas Map - main.js
   Restaurant Card Edition + Travel Areas (Gehzeit)
   ========================================================== */

// === BASE MAP ===
var BasemapAT_orthofoto = L.tileLayer(
  'https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/{type}/google3857/{z}/{y}/{x}.{format}',
  {
    maxZoom: 19,
    attribution: 'Datenquelle: <a href="https://www.basemap.at">basemap.at</a>',
    type: 'normal',
    format: 'jpeg',
    bounds: [[46.35877, 8.782379], [49.037872, 17.189532]]
  }
);

var map = L.map('map', {
  center: [47.8069503, 13.0406775],
  zoom: 16,
  layers: [BasemapAT_orthofoto],
  zoomControl: true
});

// === TRAVEL AREAS PANE (polygony pod markerami) ===
map.createPane('travelAreasPane');
map.getPane('travelAreasPane').style.zIndex = 350; // poniżej markerów, powyżej kafelków
map.getPane('travelAreasPane').style.pointerEvents = 'none'; // nie blokuje klików

// === GLOBAL LAYERS ===
let restaurantLayer;
let webcamLayer;
let travelAreasLayer;
let travelAreasVisible = false;
let activeTravelRange = null; // np. 5, 10, 15 minut
let travelLegendControl = null;
let travelLegendAdded = false;

// === LOAD WEBCAMS ===
fetch('data/webcams.geojson')
  .then(response => response.json())
  .then(data => {
    webcamLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.marker(latlng, {
          icon: L.icon({
            iconUrl: 'css/images/webcam.svg',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).bindPopup(feature.properties.embedUrl, { maxWidth: 1000 });
      }
    });

    // jeśli filtr Gehzeit jest aktywny, od razu zastosuj
    if (travelAreasVisible && activeTravelRange !== null && travelAreasLayer) {
      applyTravelRangeFilterToMarkers();
    }
  });

// === HELPER FUNCTIONS ===
function getRestaurantIcon(feature) {
  const id = feature.id || feature.properties.OBJECTID || 0;
  const iconPath = `css/images/restaurants/${id}.svg`;
  return L.icon({
    iconUrl: iconPath,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: 'restaurant-icon'
  });
}

function formatInfoText(text) {
  if (!text) return '';
  const limit = 1000;
  if (text.length <= limit) return text;
  return `${text.substring(0, limit)}... <a href="#" class="see-more">Mehr erfahren</a>`;
}

function generateMailLink(name, email) {
  if (!email) return '';
  const subject = encodeURIComponent('Reservierungsanfrage - Sheraton Grand Salzburg');
  const safeName = name || 'Restaurant';
  const body = encodeURIComponent(`Liebes ${safeName} Team,

ich möchte gerne eine Reservierung für X Gäste am X um X Uhr auf den Namen X anfragen.

Mit freundlichen Grüßen,
Concierge Team Sheraton Grand Salzburg`);
  return `<a href="mailto:${email}?subject=${subject}&body=${body}">${email}</a>`;
}

// === TRAVEL AREAS – STYLING ===
function getTravelAreaBaseColor(endMinutes) {
  if (endMinutes <= 5) return '#f2e5d4';
  if (endMinutes <= 10) return '#e4d1b6';
  if (endMinutes <= 15) return '#d5bf9a';
  if (endMinutes <= 30) return '#c7ad82';
  return '#b99b67';
}

function getTravelAreaStyle(feature) {
  const end = feature.properties && feature.properties['Travel Time End (Minutes)'];
  const fill = getTravelAreaBaseColor(end || 0);

  // jeśli wybrano zakres (np. 10'), pokazujemy tylko poligony z końcem <= 10 jako „mocne”
  const visible = !activeTravelRange || (typeof end === 'number' && end <= activeTravelRange);

  return {
    pane: 'travelAreasPane',
    stroke: true,
    color: '#a88d5a',                 // trochę ciemniejszy brąz dla obrysów
    weight: visible ? 1.6 : 1,
    fillColor: fill,
    fillOpacity: visible ? 0.38 : 0.12,
    opacity: visible ? 0.95 : 0.4
  };
}

function updateTravelAreaStyles() {
  if (travelAreasLayer) {
    travelAreasLayer.setStyle(getTravelAreaStyle);
  }
}

// === TRAVEL AREAS – GEOMETRIA / FILTROWANIE IKON ===

// proste ray-casting „point in polygon”
// ring: tablica [ [lng, lat], ... ]
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]; // lng, lat
    const xj = ring[j][0], yj = ring[j][1];

    const intersect =
      ((yi > lat) !== (yj > lat)) &&
      (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);

    if (intersect) inside = !inside;
  }
  return inside;
}

// poligony travel areas dla zakresu <= limitMinutes
function buildTravelPolygonsUpToRange(limitMinutes) {
  const polygons = [];
  if (!travelAreasLayer) return polygons;

  travelAreasLayer.eachLayer(layer => {
    const f = layer.feature;
    if (!f || !f.properties || !f.geometry) return;
    const end = f.properties['Travel Time End (Minutes)'];
    if (typeof end !== 'number' || end > limitMinutes) return;

    const geom = f.geometry;
    if (geom.type === 'Polygon') {
      if (geom.coordinates[0]) {
        polygons.push(geom.coordinates[0]); // zewnętrzny pierścień
      }
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => {
        if (poly[0]) polygons.push(poly[0]);
      });
    }
  });

  return polygons;
}

function isLatLngInsideAnyTravelPolygon(latlng, polygons) {
  const lng = latlng.lng;
  const lat = latlng.lat;
  for (let i = 0; i < polygons.length; i++) {
    if (pointInRing(lng, lat, polygons[i])) return true;
  }
  return false;
}

// zastosuj filtr do restauracji i webcams
function applyTravelRangeFilterToMarkers() {
  const hasFilter = travelAreasVisible && activeTravelRange !== null && travelAreasLayer;

  let polygons = null;
  if (hasFilter) {
    polygons = buildTravelPolygonsUpToRange(activeTravelRange);
  }

  const updateMarker = marker => {
    if (!marker) return;

    if (!hasFilter) {
      marker.setOpacity(1);
      if (marker._icon) {
        marker._icon.style.pointerEvents = '';
      }
      return;
    }

    const inside = isLatLngInsideAnyTravelPolygon(marker.getLatLng(), polygons);

    if (inside) {
      marker.setOpacity(1);
      if (marker._icon) {
        marker._icon.style.pointerEvents = '';
      }
    } else {
      // 🔹 mocno przygaszamy i wyłączamy klikanie
      marker.setOpacity(0.15);
      if (marker._icon) {
        marker._icon.style.pointerEvents = 'none';
      }
    }
  };

  if (restaurantLayer) {
    restaurantLayer.eachLayer(updateMarker);
  }
  if (webcamLayer) {
    webcamLayer.eachLayer(updateMarker);
  }
}

// === TRAVEL AREAS – LEGENDA Z PRZYCISKAMI CZASU ===
function createTravelLegend(ranges) {
  if (travelLegendControl) return; // tylko raz

  travelLegendControl = L.control({ position: 'bottomleft' });

  travelLegendControl.onAdd = function (mapInstance) {
    const div = L.DomUtil.create('div', 'travel-legend');
    L.DomEvent.disableClickPropagation(div);

    const title = document.createElement('div');
    title.className = 'travel-legend-title';
    title.textContent = 'Gehzeit';
    div.appendChild(title);

    ranges.forEach(range => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'travel-chip';
      chip.textContent = `${range}'`;
      chip.dataset.range = range;

      chip.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        const r = parseInt(this.dataset.range, 10);

        // kliknięcie tego samego = wyłączenie filtra
        activeTravelRange = activeTravelRange === r ? null : r;

        updateTravelAreaStyles();
        applyTravelRangeFilterToMarkers();

        const chips = div.querySelectorAll('.travel-chip');
        chips.forEach(c => {
          const val = parseInt(c.dataset.range, 10);
          c.classList.toggle('active', activeTravelRange === val);
        });
      });

      div.appendChild(chip);
    });

    return div;
  };
}

// === POPUP ===
function generatePopup(feature) {
  const p = feature.properties;
  const id = feature.id || feature.properties.OBJECTID || 0;
  const info = formatInfoText(p.Message);
  const emailLink = generateMailLink(p.Name, p.Email);

  const holidayNames = {
    dec24: 'Heiligabend',
    dec25: 'Christtag',
    dec26: 'Stefanitag',
    dec31: 'Silvester',
    jan01: 'Neujahr'
  };

  return `
    <div class="popup popup-content">
      <h3>
        <img src="css/images/restaurants/${id}.svg" class="popup-logo" alt="${p.Name} logo">
        ${p.Name}
      </h3>
      <p><strong>Adresse:</strong> ${p.Address || ''}</p>
      <p><strong>Telefon:</strong> ${p.Phone || ''}</p>
      <p><strong>Email:</strong> ${emailLink}</p>
      <p><strong>Info:</strong> ${info}</p>
      <div class="holiday-hours">
        ${Object.entries(holidayNames)
          .map(
            ([key, label]) =>
              `<p><strong>${label}:</strong> ${p[key] || '–'}</p>`
          )
          .join('')}
        <a href="#" class="see-days">Weitere Tage anzeigen</a>
      </div>
    </div>
  `;
}

// === MODAL ZE WSZYSTKIMI DNIAMI ===
function showFullSchedule(feature) {
  const p = feature.properties;
  const dayMap = {
    dec22: ['Mo', '22. Dez'],
    dec23: ['Di', '23. Dez'],
    dec24: ['Mi', '24. Dez'],
    dec25: ['Do', '25. Dez'],
    dec26: ['Fr', '26. Dez'],
    dec27: ['Sa', '27. Dez'],
    dec28: ['So', '28. Dez'],
    dec29: ['Mo', '29. Dez'],
    dec30: ['Di', '30. Dez'],
    dec31: ['Mi', '31. Dez'],
    jan01: ['Do', '1. Jan'],
    jan02: ['Fr', '2. Jan'],
    jan03: ['Sa', '3. Jan'],
    jan04: ['So', '4. Jan'],
    jan05: ['Mo', '5. Jan'],
    jan06: ['Di', '6. Jan']
  };

  const rows = Object.entries(dayMap)
    .map(
      ([k, [day, date]]) =>
        `<tr><td>${day}</td><td>${date}</td><td>${p[k] || '–'}</td></tr>`
    )
    .join('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <span class="modal-close">×</span>
    <h4>${p.Name} – Öffnungszeiten</h4>
    <table class="schedule-table"><tbody>${rows}</tbody></table>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.modal-close').onclick = () => modal.remove();
}

// === LOAD RESTAURANTS ===
fetch('data/restaurants.geojson')
  .then(response => response.json())
  .then(data => {
    restaurantLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) => {
        const icon = getRestaurantIcon(feature);
        const marker = L.marker(latlng, { icon });
        marker.bindPopup(generatePopup(feature), {
          maxWidth: 440,
          minWidth: 400
        });
        return marker;
      }
    });

    // === POPUP INTERACTIONS (Fixed “Weitere Tage anzeigen”) ===
    map.on('popupopen', function (e) {
      // krótka pauza, żeby DOM popupa był gotowy
      setTimeout(() => {
        const popup = e.popup._contentNode;
        const feature = e.popup._source.feature;

        // --- "Mehr erfahren" handler ---
        const seeMore = popup.querySelector('.see-more');
        if (seeMore) {
          seeMore.addEventListener('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            L.DomEvent.stopPropagation(ev);
            seeMore.parentElement.innerHTML = feature.properties.Message;
            e.popup.update();
          });
        }

        // --- "Weitere Tage anzeigen" handler ---
        const seeDays = popup.querySelector('.see-days');
        if (seeDays) {
          seeDays.addEventListener('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            L.DomEvent.stopPropagation(ev);

            // usuń istniejące modale
            document.querySelectorAll('.modal').forEach(m => m.remove());

            const f = e.popup._source?.feature || feature;
            if (f && f.properties) {
              showFullSchedule(f);
            } else {
              console.warn('⚠️ No feature data for modal');
            }
          });
        }

        // --- Auto-center popup vertically ---
        const px = map.project(e.popup._latlng);
        px.y -= e.popup._container.clientHeight / 2;
        map.panTo(map.unproject(px), { animate: true });
      }, 50);
    });

    // restauracje domyślnie na mapie
    map.addLayer(restaurantLayer);

    // jeśli filtr Gehzeit jest aktywny, od razu zastosuj
    if (travelAreasVisible && activeTravelRange !== null && travelAreasLayer) {
      applyTravelRangeFilterToMarkers();
    }
  });

// === LOAD TRAVEL AREAS ===
function loadTravelAreas() {
  if (travelAreasLayer) {
    if (travelAreasVisible && !map.hasLayer(travelAreasLayer)) {
      map.addLayer(travelAreasLayer);
    }
    if (travelAreasVisible && travelLegendControl && !travelLegendAdded) {
      travelLegendControl.addTo(map);
      travelLegendAdded = true;
    }
    if (travelAreasVisible && activeTravelRange !== null) {
      applyTravelRangeFilterToMarkers();
    }
    return;
  }

  fetch('data/travelareas.geojson')
    .then(response => response.json())
    .then(data => {
      const ranges = Array.from(
        new Set(
          data.features
            .map(
              f =>
                f.properties &&
                f.properties['Travel Time End (Minutes)']
            )
            .filter(v => typeof v === 'number')
        )
      ).sort((a, b) => a - b);

      createTravelLegend(ranges);

      travelAreasLayer = L.geoJSON(data, {
        pane: 'travelAreasPane',
        style: getTravelAreaStyle
      });

      if (travelAreasVisible) {
        travelAreasLayer.addTo(map);
        if (travelLegendControl && !travelLegendAdded) {
          travelLegendControl.addTo(map);
          travelLegendAdded = true;
        }
      }

      if (travelAreasVisible && activeTravelRange !== null) {
        applyTravelRangeFilterToMarkers();
      }
    })
    .catch(err =>
      console.error('Błąd ładowania travelareas.geojson:', err)
    );
}

// === CONTROL BUTTONS ===
const zoomControlContainer = document.querySelector('.leaflet-control-zoom');

function createControlButton({
  container,
  iconHtml,
  title,
  href = '#',
  onClick = null,
  openInNewTab = false
}) {
  const btn = L.DomUtil.create('a', 'leaflet-control-filter', container);
  btn.innerHTML = iconHtml;
  btn.title = title;
  btn.href = href;
  if (openInNewTab) {
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
  }
  if (onClick) {
    btn.onclick = function (e) {
      e.preventDefault();
      onClick(e);
    };
  }
  return btn;
}

let restaurantsVisible = false;
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-utensils"></i>',
  title: 'Restaurants',
  onClick: () => {
    if (!restaurantLayer) return;
    restaurantsVisible = !restaurantsVisible;
    if (restaurantsVisible) map.addLayer(restaurantLayer);
    else map.removeLayer(restaurantLayer);
  }
});

let webcamsVisible = false;
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-video"></i>',
  title: 'Webcams',
  onClick: () => {
    if (!webcamLayer) return;
    webcamsVisible = !webcamsVisible;
    if (webcamsVisible) map.addLayer(webcamLayer);
    else map.removeLayer(webcamLayer);
  }
});

let travelAreasButtonActive = false;

createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-person-walking"></i>',
  title: 'Gehzeit-Zonen',
  onClick: () => {
    travelAreasVisible = !travelAreasVisible;
    travelAreasButtonActive = travelAreasVisible;

    if (travelAreasVisible) {
      loadTravelAreas();
      if (travelLegendControl && !travelLegendAdded) {
        travelLegendControl.addTo(map);
        travelLegendAdded = true;
      }
      if (travelAreasLayer && !map.hasLayer(travelAreasLayer)) {
        map.addLayer(travelAreasLayer);
      }
    } else {
      if (travelAreasLayer && map.hasLayer(travelAreasLayer)) {
        map.removeLayer(travelAreasLayer);
      }
      if (travelLegendControl && travelLegendAdded) {
        map.removeControl(travelLegendControl);
        travelLegendAdded = false;
      }
      activeTravelRange = null; // reset filtra
    }

    applyTravelRangeFilterToMarkers();
  }
});

createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-calendar"></i>',
  title: 'Events Calendar',
  href: 'https://www.salzburg.info/en/events/events-calendar',
  openInNewTab: true
});

createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-ticket-simple"></i>',
  title: 'Guest Mobility Ticket',
  href: 'https://idp.feratel.com/auth/realms/card-msl01/protocol/openid-connect/auth?response_type=code&client_id=card-software&redirect_uri=https%3A%2F%2Fcard-software-msl.feratel.com%2Fsso%2FMSL01?language%3Dde%26mandantselect%3DMSL01%26realmcode%3DMSL01&state=78442d6e-59ed-4a6f-a2d5-d99aed5b9449&login=true&scope=openid',
  openInNewTab: true
});

createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-tree"></i>',
  title: 'Christmas Attractions (coming soon!)',
  onClick: () => alert('Christmas attractions layer coming soon! 🎄')
});

