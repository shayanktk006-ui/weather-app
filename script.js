// ===== SkyCast Weather App =====
// Using Open-Meteo (100% free, no API key needed)

const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const errorMsg = document.getElementById("errorMsg");
const loader = document.getElementById("loader");
const weatherCard = document.getElementById("weatherCard");

const cityName = document.getElementById("cityName");
const dateTime = document.getElementById("dateTime");
const weatherIcon = document.getElementById("weatherIcon");
const temperature = document.getElementById("temperature");
const condition = document.getElementById("condition");
const feelsLike = document.getElementById("feelsLike");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("windSpeed");
const pressure = document.getElementById("pressure");
const forecastContainer = document.getElementById("forecastContainer");
const locationBtn = document.getElementById("locationBtn");

// Weather code to description + icon mapping (Open-Meteo WMO codes)
// Codes 0, 1, 2 have separate day/night icons since sky appearance changes
const weatherMap = {
  0:  { text: "Clear Sky",      dayIcon: "☀️",  nightIcon: "🌙" },
  1:  { text: "Mainly Clear",   dayIcon: "🌤️", nightIcon: "🌙" },
  2:  { text: "Partly Cloudy",  dayIcon: "⛅",  nightIcon: "☁️🌙" },
  3:  { text: "Overcast",       dayIcon: "☁️",  nightIcon: "☁️" },
  45: { text: "Fog",            dayIcon: "🌫️", nightIcon: "🌫️" },
  48: { text: "Fog",            dayIcon: "🌫️", nightIcon: "🌫️" },
  51: { text: "Light Drizzle",  dayIcon: "🌦️", nightIcon: "🌧️" },
  53: { text: "Drizzle",        dayIcon: "🌦️", nightIcon: "🌧️" },
  55: { text: "Heavy Drizzle",  dayIcon: "🌧️", nightIcon: "🌧️" },
  61: { text: "Light Rain",     dayIcon: "🌦️", nightIcon: "🌧️" },
  63: { text: "Rain",           dayIcon: "🌧️", nightIcon: "🌧️" },
  65: { text: "Heavy Rain",     dayIcon: "🌧️", nightIcon: "🌧️" },
  71: { text: "Light Snow",     dayIcon: "🌨️", nightIcon: "🌨️" },
  73: { text: "Snow",           dayIcon: "❄️",  nightIcon: "❄️" },
  75: { text: "Heavy Snow",     dayIcon: "❄️",  nightIcon: "❄️" },
  80: { text: "Rain Showers",   dayIcon: "🌦️", nightIcon: "🌧️" },
  81: { text: "Rain Showers",   dayIcon: "🌧️", nightIcon: "🌧️" },
  82: { text: "Violent Showers",dayIcon: "⛈️",  nightIcon: "⛈️" },
  95: { text: "Thunderstorm",   dayIcon: "⛈️",  nightIcon: "⛈️" },
  96: { text: "Thunderstorm w/ Hail", dayIcon: "⛈️", nightIcon: "⛈️" },
  99: { text: "Severe Thunderstorm",  dayIcon: "⛈️", nightIcon: "⛈️" }
};

// isDay: 1 = daytime, 0 = nighttime (defaults to day if not provided, e.g. for forecast days)
function getWeatherInfo(code, isDay = 1) {
  const entry = weatherMap[code] || { text: "Unknown", dayIcon: "🌡️", nightIcon: "🌡️" };
  return {
    text: entry.text,
    icon: isDay ? entry.dayIcon : entry.nightIcon
  };
}

function iconToEmojiImage(emoji) {
  // Convert emoji to an image-like span (keeps <img> tag structure working)
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='90' height='90'><text x='50%' y='50%' font-size='70' text-anchor='middle' dominant-baseline='central'>${encodeURIComponent(emoji)}</text></svg>`;
}

async function getCoordinates(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("City not found. Please check the spelling and try again.");
  }
  return data.results[0];
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not fetch weather data. Try again later.");
  return await res.json();
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function getDayName(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

// Reverse geocode: turn lat/lon into a readable place name (free, no API key)
async function getPlaceName(lat, lon) {
  // Try Open-Meteo's reverse geocoding first
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      const region = r.admin1 ? `, ${r.admin1}` : "";
      return `${r.name}${region}, ${r.country}`;
    }
  } catch (e) {
    // fall through to backup service
  }

  // Backup: BigDataCloud's free client-side reverse geocoding (no API key needed)
  try {
    const backupUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetch(backupUrl);
    const data = await res.json();
    const place = data.city || data.locality || data.principalSubdivision;
    if (place) {
      const region = data.principalSubdivision && data.principalSubdivision !== place ? `, ${data.principalSubdivision}` : "";
      return `${place}${region}, ${data.countryName}`;
    }
  } catch (e) {
    // ignore, fallback below
  }

  return "Your Current Location";
}

// Renders weather data onto the page (shared by city-search and geolocation)
function renderWeather(placeName, weatherData, isCurrentLocation = false) {
  const current = weatherData.current;
  const info = getWeatherInfo(current.weather_code, current.is_day);

  cityName.textContent = isCurrentLocation ? `📍 ${placeName}` : placeName;
  dateTime.textContent = formatDate(new Date());

  weatherIcon.src = iconToEmojiImage(info.icon);
  temperature.textContent = `${Math.round(current.temperature_2m)}°C`;
  condition.textContent = info.text;

  feelsLike.textContent = `${Math.round(current.apparent_temperature)}°C`;
  humidity.textContent = `${current.relative_humidity_2m}%`;
  windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  pressure.textContent = `${Math.round(current.surface_pressure)} hPa`;

  forecastContainer.innerHTML = "";
  const daily = weatherData.daily;

  for (let i = 0; i < 5; i++) {
    const dayInfo = getWeatherInfo(daily.weather_code[i]);
    const dayEl = document.createElement("div");
    dayEl.className = "forecast-day";
    dayEl.innerHTML = `
      <p>${i === 0 ? "Today" : getDayName(daily.time[i])}</p>
      <img src="${iconToEmojiImage(dayInfo.icon)}" alt="${dayInfo.text}">
      <p class="f-temp">${Math.round(daily.temperature_2m_max[i])}° / ${Math.round(daily.temperature_2m_min[i])}°</p>
    `;
    forecastContainer.appendChild(dayEl);
  }

  weatherCard.classList.remove("hidden");
}

async function searchWeather() {
  const city = cityInput.value.trim();
  errorMsg.textContent = "";

  if (!city) {
    errorMsg.textContent = "Please enter a city name.";
    return;
  }

  weatherCard.classList.add("hidden");
  loader.classList.remove("hidden");

  try {
    const location = await getCoordinates(city);
    const weatherData = await getWeather(location.latitude, location.longitude);
    const region = location.admin1 ? `, ${location.admin1}` : "";
    renderWeather(`${location.name}${region}, ${location.country}`, weatherData);
  } catch (err) {
    errorMsg.textContent = err.message || "Something went wrong. Please try again.";
  } finally {
    loader.classList.add("hidden");
  }
}

function useMyLocation() {
  errorMsg.textContent = "";

  if (!navigator.geolocation) {
    errorMsg.textContent = "Geolocation is not supported by your browser.";
    return;
  }

  weatherCard.classList.add("hidden");
  loader.classList.remove("hidden");
  locationBtn.disabled = true;
  locationBtn.textContent = "📍 Detecting location...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const [placeName, weatherData] = await Promise.all([
          getPlaceName(latitude, longitude),
          getWeather(latitude, longitude)
        ]);
        cityInput.value = "";
        renderWeather(placeName, weatherData, true);
      } catch (err) {
        errorMsg.textContent = err.message || "Could not fetch weather for your location.";
      } finally {
        loader.classList.add("hidden");
        locationBtn.disabled = false;
        locationBtn.textContent = "📍 Use My Current Location";
      }
    },
    (error) => {
      loader.classList.add("hidden");
      locationBtn.disabled = false;
      locationBtn.textContent = "📍 Use My Current Location";
      if (error.code === error.PERMISSION_DENIED) {
        errorMsg.textContent = "Location permission denied. Please allow location access or search manually.";
      } else {
        errorMsg.textContent = "Could not detect your location. Please search manually.";
      }
    }
  );
}

locationBtn.addEventListener("click", useMyLocation);

searchBtn.addEventListener("click", searchWeather);

cityInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchWeather();
  }
});

// Load a default city on first visit
window.addEventListener("DOMContentLoaded", () => {
  cityInput.value = "Islamabad";
  searchWeather();
});
