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

// === DATA LAYERS ===
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

// Get custom icon for each restaurant
function getRestaurantIcon(feature) {
  const id = feature.properties.OBJECTID;
  const customIconUrl = `css/images/restaurants/${id}.svg`;
  const fallbackIconUrl = 'css/images/restaurant.svg';
  return L.icon({
    iconUrl: customIconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    className: 'restaurant-icon',
    errorOverlayUrl: fallbackIconUrl
  });
}

// Format long info text with "Mehr erfahren"
function formatInfoText(text) {
  if (!text) return '';
  const limit = 220;
  if (text.length <= limit) return text;
  return `${text.substring(0, limit)}... <a href="#" class="see-more">Mehr erfahren</a>`;
}

// Generate mailto link for Outlook
function generateMailLink(name, email) {
  if (!email) return '';
  const subject = encodeURIComponent('Reservierungsanfrage - Sheraton Grand Salzburg');
  const body = encodeURIComponent(`Liebes ${name} Team,

ich möchte gerne eine Reservierung für X Gäste am X um X Uhr auf den Namen X anfragen.

Mit freundlichen Grüßen,
Concierge Team Sheraton Grand Salzburg
`);
  return `<a href="mailto:${email}?subject=${subject}&body=${body}">${email}</a>`;
}

// Generate popup HTML
function generatePopup(feature) {
  const p = feature.properties;
  const info = formatInfoText(p.Info);
  const emailLink = generateMailLink(p.Name, p.Email);

  return `
    <div class="popup">
      <h3>${p.Name}</h3>
      <p><strong>Adresse:</strong> ${p.Adresse || ''}</p>
      <p><strong>Telefon:</strong> ${p.Telephone || ''}</p>
      <p><strong>Email:</strong> ${emailLink}</p>
      <p><strong>Info:</strong> ${info}</p>
      <div class="holiday-hours">
        <h4>Öffnungszeiten (Feiertage)</h4>
        <p><strong>24. Dez:</strong> ${p['Mittwoch, Heiligabend'] || '–'}</p>
        <p><strong>25. Dez:</strong> ${p['Donnerstag, Christtag'] || '–'}</p>
        <p><strong>26. Dez:</strong> ${p['Freitag, Stefanitag'] || '–'}</p>
        <p><strong>31. Dez:</strong> ${p['Mittwoch, Silvester'] || '–'}</p>
        <p><strong>1. Jan:</strong> ${p['Donnerstag, Neujahr'] || '–'}</p>
        <a href="#" class="see-days">Weitere Tage anzeigen</a>
      </div>
    </div>
  `;
}

// Display full schedule in modal
function showFullSchedule(feature) {
  const p = feature.properties;
  const days = Object.keys(p)
    .filter(k => k.includes('tag') || k.includes('Jänner'))
    .map(day => `<tr><td>${day}</td><td>${p[day] || ''}</td></tr>`)
    .join('');
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <span class="modal-close">×</span>
    <h4>${p.Name} – Öffnungszeiten</h4>
    <table class="schedule-table">
      <tbody>${days}</tbody>
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
        marker.bindPopup(generatePopup(feature));
        return marker;
      }
    });

    // Handle popup events
    map.on('popupopen', function (e) {
      const popup = e.popup._contentNode;
      const feature = e.popup._source.feature;

      // See more handler
      const seeMore = popup.querySelector('.see-more');
      if (seeMore) {
        seeMore.addEventListener('click', ev => {
          ev.preventDefault();
          seeMore.parentElement.innerHTML = feature.properties.Info;
        });
      }

      // See full schedule
      const seeDays = popup.querySelector('.see-days');
      if (seeDays) {
        seeDays.addEventListener('click', ev => {
          ev.preventDefault();
          showFullSchedule(feature);
        });
      }
    });
  });

// === CONTROL BUTTONS ===
const zoomControlContainer = document.querySelector('.leaflet-control-zoom');

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

// 🍽️ Restaurants
let restaurantsVisible = false;
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-utensils"></i>',
  title: 'Restaurants',
  onClick: () => {
    if (!restaurantLayer) return;
    restaurantsVisible = !restaurantsVisible;
    if (restaurantsVisible) {
      map.addLayer(restaurantLayer);
    } else {
      map.removeLayer(restaurantLayer);
    }
  }
});

// 📷 Webcams
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

// 🎄 Christmas Attractions (coming soon!)
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-tree"></i>',
  title: 'Christmas Attractions (coming soon!)',
  onClick: () => {
    alert('Christmas attractions layer coming soon! 🎄');
  }
});
