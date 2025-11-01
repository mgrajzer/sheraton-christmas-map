// Loading the base map 
var BasemapAT_orthofoto = L.tileLayer('https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/{type}/google3857/{z}/{y}/{x}.{format}', {
	maxZoom: 19,
	attribution: 'Datenquelle: <a href="https://www.basemap.at">basemap.at</a>',
	type: 'normal',
	format: 'jpeg',
	bounds: [[46.35877, 8.782379], [49.037872, 17.189532]]
});
var map = L.map('map', {
  center: [47.8069503, 13.0406775],
  zoom: 16,
  layers: [BasemapAT_orthofoto]
});

let webcamLayer;

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

// WEATHER BUTTON
let weatherActive = false;
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-sun"></i>',
  title: 'Weather',
  onClick: () => {
    weatherActive = !weatherActive;
    if (weatherActive) {
      if (webcamLayer) map.addLayer(webcamLayer);
      document.getElementById('weather-widget').style.display = 'block';
    } else {
      if (webcamLayer) map.removeLayer(webcamLayer);
      document.getElementById('weather-widget').style.display = 'none';
    }
  }
});

// EVENTS CALENDAR BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-calendar"></i>',
  title: 'Events Calendar',
  href: 'https://www.salzburg.info/en/events/events-calendar',
  openInNewTab: true
});

// RESTAURANTS BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-utensils"></i>',
  title: 'Restaurants',
  onClick: () => {
    console.log('Restaurants filter clicked!');

  }
});

// CAFÉS BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-mug-saucer"></i>',
  title: 'Cafés',
  onClick: () => {
    console.log('Cafés filter clicked!');

  }
});

// SHOPS BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-cart-shopping"></i>',
  title: 'Shops',
  onClick: () => {
    console.log('Shops filter clicked!');

  }
});

// ATTRACTIONS BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-landmark"></i>',
  title: 'Attractions',
  onClick: () => {
    console.log('Attractions filter clicked!');

  }
});

// TRANSPORTATION BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-bus-simple"></i>',
  title: 'Transportation',
  onClick: () => {
    console.log('Transportation filter clicked!');

  }
});

// LIMOUISINE BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-taxi"></i>',
  title: 'Salzburg Limousine (CADO)',
  onClick: () => {
    console.log('Limousine filter clicked!');
 
  }
});

// WELLNESS BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-spa"></i>',
  title: 'Wellness',
  onClick: () => {
    console.log('Wellness filter clicked!');

  }
});

// OUTDOOR BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-person-hiking"></i>',
  title: 'Outdoor',
  onClick: () => {
    console.log('Outdoor filter clicked!');

  }
});

// MOBILITY TICKET BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-ticket-simple"></i>',
  title: 'Guest Mobility Ticket',
  href: 'https://idp.feratel.com/auth/realms/card-msl01/protocol/openid-connect/auth?response_type=code&client_id=card-software&redirect_uri=https%3A%2F%2Fcard-software-msl.feratel.com%2Fsso%2FMSL01?language%3Dde%26mandantselect%3DMSL01%26realmcode%3DMSL01&state=084b3bf3-c8c8-451c-9b12-561325819026&login=true&scope=openid',
  openInNewTab: true
});

// CONCERTS BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-music"></i>',
  title: 'Schlosskonzerte Mirabell',
  href: 'https://www.schlosskonzerte-salzburg.at/alle-konzerte',
  openInNewTab: true
});

// FORTRESS CONCERTS BUTTON
createControlButton({
  container: zoomControlContainer,
  iconHtml: '<i class="fa-solid fa-chess-rook"></i>',
  title: 'Festungskonzerte Best of Mozart',
  href: 'https://www.salzburghighlights.at/de/mozart-konzerte-salzburg/',
  openInNewTab: true
});
