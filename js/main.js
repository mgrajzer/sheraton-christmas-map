/* ==========================================================
   Sheraton Christmas Map - main.js
   Restaurant Card Edition (Final Polished 2025)
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

// === GLOBAL LAYERS ===
let restaurantLayer;
let webcamLayer;

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
  });

// === HELPER FUNCTIONS ===

// Dynamic restaurant icon (per OBJECTID)
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

// Limit text length + “Mehr erfahren”
function formatInfoText(text) {
  if (!text) return '';
  const limit = 220;
  if (text.length <= limit) return text;
  return `${text.substring(0, limit)}... <a href="#" class="see-more">Mehr erfahren</a>`;
}

// Email link with ready message
function generateMailLink(name, email) {
  if (!email) return '';
  const subject = encodeURIComponent('Reservierungsanfrage - Sheraton Grand Salzburg');
  const body = encodeURIComponent(`Liebes ${name} Team,

ich möchte gerne eine Reservierung für X Gäste am X um X Uhr auf den Namen X anfragen.

Mit freundlichen Grüßen,
Concierge Team Sheraton Grand Salzburg`);
  return `<a href="mailto:${email}?subject=${subject}&body=${body}">${email}</a>`;
}

// === POPUP (KARTA RESTAURACJI) ===
function generatePopup(feature) {
  const p = feature.properties;
  const id = feature.id || feature.properties.OBJECTID || 0;
  const info = formatInfoText(p.Message);
  const emailLink = generateMailLink(p.Name, p.Email);

  // Świąteczne nazwy (bez kolorowania)
  const holidayNames = {
    dec24: "Heiligabend",
    dec25: "Christtag",
    dec26: "Stefanitag",
    dec31: "Silvester",
    jan01: "Neujahr"
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
          .map(([key, label]) => {
            const val = p[key] || '–';
            return `<p><strong>${label}:</strong> ${val}</p>`;
          })
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
    dec22: ["Mo", "22. Dez"],
    dec23: ["Di", "23. Dez"],
    dec24: ["Mi", "24. Dez"],
    dec25: ["Do", "25. Dez"],
    dec26: ["Fr", "26. Dez"],
    dec27: ["Sa", "27. Dez"],
    dec28: ["So", "28. Dez"],
    dec29: ["Mo", "29. Dez"],
    dec30: ["Di", "30. Dez"],
    dec31: ["Mi", "31. Dez"],
    jan01: ["Do", "1. Jan"],
    jan02: ["Fr", "2. Jan"],
    jan03: ["Sa", "3. Jan"],
    jan04: ["So", "4. Jan"],
    jan05: ["Mo", "5. Jan"],
    jan06: ["Di", "6. Jan"]
  };

  const rows = Object.entries(dayMap)
    .map(([k, [day, date]]) => {
      return `<tr><td>${day}</td><td>${date}</td><td>${p[k] || ""}</td></tr>`;
    })
    .join('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <span class="modal-close">×</span>
    <h4>${p.Name} – Öffnungszeiten</h4>
    <table class="schedule-table">
      <tbody>${rows}</tbody>
    </table>
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
          maxWidth: 340,
          minWidth: 300
        });
        return marker;
      }
    });

    // === POPUP INTERACTIONS ===
    map.on('popupopen', function (e) {
      const popup = e.popup._contentNode;
      const feature = e.popup._source.feature;

      // Mehr erfahren
      const seeMore = popup.querySelector('.see-more');
      if (seeMore) {
        seeMore.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          seeMore.parentElement.innerHTML = feature.properties.Message;
          e.popup.update();
        });
      }

      // Weitere Tage anzeigen
      const seeDays = popup.querySelector('.see-days');
      if (seeDays) {
        seeDays.addEventListener('click', ev => {
          ev.preventDefault();
          ev.stopPropagation();
          showFullSchedule(feature);
        });
      }

      // Auto-centrowanie popupu
      const px = map.project(e.popup._latlng);
      px.y -= e.popup._container.clientHeight / 2;
      map.panTo(map.unproject(px), { animate: true });
    });
  });

// === CONTROL BUTTONS ===
const zoomControlContainer = document.querySelector('.leaflet-control-zoom');

// Helper: tworzy nowy przycisk kontrolny
function createControlButton({ container, iconHtml, title, href = '#', onClick = null, openInNewTab = false }) {
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

// 📷 Webcams toggle
let webcamsVisible = false;
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-video"></i>',
  title: 'Webcams',
  onClick: () => {
    if (!webcamLayer) return;
    webcamsVisible = !webcamsVisible;
    if (webcamsVisible) {
      map.addLayer(webcamLayer);
    } else {
      map.removeLayer(webcamLayer);
    }
  }
});

// 📅 Events Calendar
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-calendar"></i>',
  title: 'Events Calendar',
  href: 'https://www.salzburg.info/en/events/events-calendar',
  openInNewTab: true
});

// 🎟️ Guest Mobility Ticket
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-ticket-simple"></i>',
  title: 'Guest Mobility Ticket',
  href: 'https://www.salzburg.info/en/travel-info/guest-card',
  openInNewTab: true
});

// 🎄 Christmas Attractions
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-tree"></i>',
  title: 'Christmas Attractions (coming soon!)',
  onClick: () => {
    alert('Christmas attractions layer coming soon! 🎄');
  }
});
