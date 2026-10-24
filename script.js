const API_KEY = window.SKYCAST_API_KEY;
const RECENT_SEARCHES_KEY = "skycast-recent-searches";
const TEMPERATURE_UNIT_KEY = "skycast-temperature-unit";
const MAX_RECENT_SEARCHES = 5;

const searchForm = document.querySelector(".search-bar");
const cityInput = document.querySelector(".search-bar input");
const unitButton = document.querySelector(".unit-btn");
const headerButtons = document.querySelectorAll(".header-actions .icon-button");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsUnit = document.querySelector("#settings-unit");
const cityName = document.querySelector(".weather-info h2");
const weatherCondition = document.querySelector(".weather-info h3");
const temperature = document.querySelector(".temperature");
const feelsLike = document.querySelector("#feels-like");
const highLow = document.querySelector(".high-low");
const weatherIcon = document.querySelector(".weather-illustration");
const hourlyGrid = document.querySelector("#hourly-grid");
const weeklyForecast = document.querySelector("#weekly-forecast");
const weatherStatus = document.querySelector("#weather-status");
const recentSearchSection = document.querySelector(".recent-searches");
const recentSearchList = document.querySelector("#recent-searches");
const smartSuggestions = document.querySelector("#smart-suggestions");
const airQualityCard = document.querySelector("#air-quality-card");
const activityType = document.querySelector("#activity-type");
const activityResult = document.querySelector("#activity-result");

let currentUnit = localStorage.getItem(TEMPERATURE_UNIT_KEY) === "F" ? "F" : "C";
let currentWeather = null;
let latestRequest = 0;
let localClockBase = null;

function convertTemperature(celsius) {
    return currentUnit === "F"
        ? Math.round((celsius * 9 / 5) + 32)
        : Math.round(celsius);
}

function formatTemperature(celsius) {
    return `${convertTemperature(celsius)}°${currentUnit}`;
}

function formatWind(kilometersPerHour) {
    return currentUnit === "F"
        ? `${Math.round(kilometersPerHour * 0.621371)} mph`
        : `${Math.round(kilometersPerHour)} km/h`;
}

function formatVisibility(kilometers) {
    return currentUnit === "F"
        ? `${(kilometers * 0.621371).toFixed(1)} mi`
        : `${kilometers} km`;
}

function getSeason(localDate, latitude, temperatureC) {
    const month = Number(localDate.slice(5, 7));
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error("The weather response did not include a valid local date.");
    }

    if (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) < 23.5) {
        if (temperatureC >= 29) {
            return "summer";
        }
        return temperatureC <= 20 ? "winter" : "spring";
    }

    const southernHemisphere = Number(latitude) < 0;
    const northernSeason = month <= 2 || month === 12
        ? "winter"
        : month <= 5
            ? "spring"
            : month <= 8
                ? "summer"
                : "autumn";

    if (!southernHemisphere) {
        return northernSeason;
    }

    return {
        winter: "summer",
        spring: "autumn",
        summer: "winter",
        autumn: "spring"
    }[northernSeason];
}

function applyWeatherTheme(data) {
    const current = data.current;
    const today = data.forecast.forecastday[0].day;
    const condition = current.condition.text.toLowerCase();
    const season = getSeason(
        data.location.localtime,
        data.location.lat,
        current.temp_c
    );
    const snowing = /snow|sleet|ice|blizzard/.test(condition) || today.daily_will_it_snow === 1;
    const raining = /rain|drizzle|thunder|shower/.test(condition) || today.daily_will_it_rain === 1;
    let theme = season;
    let weatherType = "clear";

    if (!current.is_day) {
        theme = "night";
        weatherType = "night";
    } else if (snowing) {
        theme = "winter";
        weatherType = "snow";
    } else if (raining) {
        theme = "rainy";
        weatherType = /thunder/.test(condition) ? "storm" : "rain";
    } else if (/cloud|overcast|mist|fog/.test(condition)) {
        theme = "cloudy";
        weatherType = "clouds";
    } else if (current.temp_c >= 35) {
        theme = "sunny";
        weatherType = "heat";
    } else if (/sunny|clear/.test(condition)) {
        weatherType = "sun";
    }

    document.body.dataset.weatherTheme = theme;
    document.body.dataset.weatherCondition = weatherType;
}

function getAirQualityDetails(airQuality) {
    const index = Number(airQuality?.["us-epa-index"]);
    const particulateMatter = airQuality?.pm2_5;
    const categories = [
        "Unavailable",
        "Good",
        "Moderate",
        "Unhealthy for sensitive groups",
        "Unhealthy",
        "Very unhealthy",
        "Hazardous"
    ];

    return {
        index: Number.isInteger(index) && index >= 1 && index <= 6 ? index : null,
        label: categories[index] || "Unavailable",
        pm25: particulateMatter !== null
            && particulateMatter !== undefined
            && Number.isFinite(Number(particulateMatter))
            ? Number(particulateMatter)
            : null
    };
}

function updateAirQuality(airQuality) {
    const details = getAirQualityDetails(airQuality);
    document.querySelector("#air-quality-index").textContent =
        details.index ? `US AQI ${details.index}` : "Unavailable";
    document.querySelector("#air-quality-description").textContent = details.label;
    document.querySelector("#pm25").textContent =
        details.pm25 === null ? "PM2.5: unavailable" : `PM2.5: ${details.pm25.toFixed(1)} µg/m³`;
    document.querySelector("#air-quality-inline").textContent =
        details.index ? `AQI ${details.index} · ${details.label}` : "AQI unavailable";
    airQualityCard.dataset.aqi = details.index || "";
    return details;
}

function buildSuggestions(current, airQuality) {
    const condition = current.condition.text.toLowerCase();
    const suggestions = [];
    const temperatureC = current.temp_c;

    if (airQuality.index >= 3) {
        suggestions.push({
            icon: "🌿",
            title: "Take care outdoors",
            text: `Air quality is ${airQuality.label.toLowerCase()}. Consider limiting strenuous outdoor activity.`
        });
    } else if (airQuality.index) {
        suggestions.push({
            icon: "🌿",
            title: "Good time to get outside",
            text: `Air quality is ${airQuality.label.toLowerCase()} in this area.`
        });
    }

    if (/rain|drizzle|thunder|shower/.test(condition)) {
        suggestions.push({
            icon: "☂️",
            title: "Bring rain protection",
            text: "Rain is in the forecast. A compact umbrella or waterproof layer may come in handy."
        });
    } else if (/sunny|clear/.test(condition) || current.uv >= 6) {
        suggestions.push({
            icon: "🧴",
            title: "Protect yourself from the sun",
            text: `UV index is ${current.uv}. Consider sunscreen, sunglasses, and shade during peak hours.`
        });
    }

    if (temperatureC >= 30) {
        suggestions.push({
            icon: "💧",
            title: "Stay hydrated",
            text: `It's warm at ${formatTemperature(temperatureC)}. Keep water nearby, especially outdoors.`
        });
    } else if (/snow|sleet|ice|blizzard/.test(condition)) {
        suggestions.push({
            icon: "🧣",
            title: "Bundle up",
            text: "Cold and icy conditions are possible. Dress in warm layers and watch your footing."
        });
    }

    if (current.wind_kph >= 30) {
        suggestions.push({
            icon: "💨",
            title: "Expect breezy conditions",
            text: `Winds are around ${formatWind(current.wind_kph)}. Secure loose items outdoors.`
        });
    }

    if (suggestions.length === 0) {
        suggestions.push({
            icon: "🌤️",
            title: "Enjoy your day",
            text: "Conditions look comfortable. Check back later for an updated forecast."
        });
    }

    return suggestions.slice(0, 4);
}

function renderSuggestions(current, airQuality) {
    smartSuggestions.replaceChildren();

    buildSuggestions(current, airQuality).forEach(function (suggestion) {
        const card = document.createElement("article");
        card.className = "suggestion-card";

        const icon = document.createElement("span");
        icon.className = "suggestion-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = suggestion.icon;

        const title = document.createElement("h3");
        title.textContent = suggestion.title;

        const text = document.createElement("p");
        text.textContent = suggestion.text;

        card.append(icon, title, text);
        smartSuggestions.append(card);
    });
}

function renderRecentSearches() {
    const searches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    recentSearchList.replaceChildren();
    recentSearchSection.hidden = searches.length === 0;

    searches.forEach(function (city) {
        const button = document.createElement("button");
        button.className = "recent-search-chip";
        button.type = "button";
        button.textContent = city;
        button.addEventListener("click", function () {
            cityInput.value = city;
            getWeather(city);
        });
        recentSearchList.append(button);
    });
}

function saveRecentSearch(city) {
    const existing = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    const searches = [
        city,
        ...existing.filter(function (item) {
            return item.toLowerCase() !== city.toLowerCase();
        })
    ].slice(0, MAX_RECENT_SEARCHES);

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    renderRecentSearches();
}

function renderHourlyForecast(data) {
    const currentTime = data.location.localtime;
    const currentHour = currentTime.slice(0, 13);
    const currentTimestamp = parseLocalTime(`${currentHour}:00`);
    const nextHours = data.forecast.forecastday
        .flatMap(function (day) {
            return day.hour;
        })
        .filter(function (hour) {
            const timestamp = parseLocalTime(hour.time);
            return timestamp !== null && timestamp >= currentTimestamp;
        })
        .slice(0, 6);

    hourlyGrid.innerHTML = nextHours.map(function (hour) {
        const time = hour.time.split(" ")[1];
        const [hours, minutes] = time.split(":");
        const hourNumber = Number(hours);
        const displayHour = hourNumber % 12 || 12;
        const period = hourNumber >= 12 ? "PM" : "AM";
        const temp = currentUnit === "C" ? Math.round(hour.temp_c) : Math.round(hour.temp_f);
        const isCurrentHour = hour.time.slice(0, 13) === currentHour;

        return `
            <article class="hour-card${isCurrentHour ? " is-current-hour" : ""}"${isCurrentHour ? ' aria-current="time"' : ""}>
                <p>${displayHour}:${minutes} ${period}</p>
                <img src="https:${hour.condition.icon}" alt="${hour.condition.text}" width="36">
                <h3>${temp}°${currentUnit}</h3>
                <p>${hour.chance_of_rain}% rain</p>
            </article>
        `;
    }).join("");
}

const activityProfiles = {
    walk: {
        label: "a walk",
        minTemp: 15,
        maxTemp: 27,
        rainWeight: 30,
        windLimit: 20,
        windWeight: 16,
        uvWeight: 12,
        airWeight: 25
    },
    run: {
        label: "a run",
        minTemp: 10,
        maxTemp: 22,
        rainWeight: 28,
        windLimit: 18,
        windWeight: 18,
        uvWeight: 10,
        airWeight: 30
    },
    picnic: {
        label: "a picnic",
        minTemp: 18,
        maxTemp: 29,
        rainWeight: 35,
        windLimit: 15,
        windWeight: 22,
        uvWeight: 12,
        airWeight: 20
    },
    commute: {
        label: "your commute",
        minTemp: 8,
        maxTemp: 30,
        rainWeight: 30,
        windLimit: 30,
        windWeight: 12,
        uvWeight: 5,
        airWeight: 15
    }
};

function parseLocalTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(value || "");
    if (!match) {
        return null;
    }

    return Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5])
    );
}

function formatLocalTime(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(value);
    if (!match) {
        return value;
    }

    const hour = Number(match[4]);
    return `${hour % 12 || 12}${Number(match[5]) ? `:${match[5]}` : ""} ${hour >= 12 ? "PM" : "AM"}`;
}

function updateLocalDateTime() {
    if (!localClockBase) {
        return;
    }

    const elapsedSeconds = Math.floor((Date.now() - localClockBase.receivedAt) / 1000);
    const localDateTime = new Date(localClockBase.timestamp + elapsedSeconds * 1000);
    const date = localDateTime.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC"
    });
    const time = localDateTime.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC"
    });

    document.querySelector("#local-datetime").textContent = `${date} · ${time} local time`;
}

function formatActivityWindow(startTime, durationHours) {
    const startTimestamp = parseLocalTime(startTime);
    if (startTimestamp === null) {
        return startTime;
    }

    const startDate = startTime.slice(0, 10);
    const endTimestamp = startTimestamp + durationHours * 60 * 60 * 1000;
    const endDate = new Date(endTimestamp).toISOString().slice(0, 10);
    const today = currentWeather.location.localtime.slice(0, 10);
    const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    let dayLabel = "Today";

    if (startDate === tomorrow) {
        dayLabel = "Tomorrow";
    } else if (startDate !== today) {
        dayLabel = new Date(`${startDate}T12:00:00`).toLocaleDateString([], {
            weekday: "long"
        });
    }

    const endTime = new Date(endTimestamp).toISOString().slice(0, 16).replace("T", " ");
    return `${dayLabel} · ${formatLocalTime(startTime)}–${formatLocalTime(endTime)}`;
}

function numericValue(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function scoreActivityWindow(hours, profile, currentAqi) {
    const average = function (key, fallback) {
        return hours.reduce(function (total, hour) {
            return total + numericValue(hour[key], fallback);
        }, 0) / hours.length;
    };
    const averageTemp = average("temp_c", 20);
    const averageRain = average("chance_of_rain", 0);
    const averageWind = average("wind_kph", 0);
    const maximumUv = Math.max(...hours.map(function (hour) {
        return numericValue(hour.uv, 0);
    }));
    const wetConditions = hours.some(function (hour) {
        return /rain|drizzle|thunder|shower|snow|sleet/.test(
            (hour.condition?.text || "").toLowerCase()
        );
    });
    const aqiValues = hours.map(function (hour) {
        return Number(hour.air_quality?.["us-epa-index"]);
    }).filter(function (index) {
        return Number.isInteger(index) && index >= 1 && index <= 6;
    });
    const hasForecastAqi = aqiValues.length > 0;
    const aqi = hasForecastAqi
        ? Math.max(...aqiValues)
        : currentAqi.index;

    const temperatureDistance = averageTemp < profile.minTemp
        ? profile.minTemp - averageTemp
        : Math.max(0, averageTemp - profile.maxTemp);
    const temperaturePenalty = Math.min(25, temperatureDistance * 2);
    const rainPenalty = Math.min(
        profile.rainWeight,
        Math.max(averageRain / 100 * profile.rainWeight, wetConditions ? profile.rainWeight * 0.65 : 0)
    );
    const windPenalty = Math.min(
        profile.windWeight,
        Math.max(0, averageWind - profile.windLimit) / 30 * profile.windWeight
    );
    const uvPenalty = Math.min(
        profile.uvWeight,
        Math.max(0, maximumUv - 3) / 8 * profile.uvWeight
    );
    const airPenalty = aqi
        ? Math.min(profile.airWeight, Math.max(0, aqi - 2) * 5 / 4 * profile.airWeight)
        : 0;
    const score = Math.round(Math.max(
        0,
        100 - temperaturePenalty - rainPenalty - windPenalty - uvPenalty - airPenalty
    ));
    const reasons = [];

    if (averageRain < 20 && !wetConditions) {
        reasons.push("Low chance of rain");
    } else {
        reasons.push(`Rain chance around ${Math.round(averageRain)}%`);
    }

    if (temperatureDistance <= 0) {
        reasons.push(`Comfortable ${formatTemperature(averageTemp)}`);
    } else {
        reasons.push(`Around ${formatTemperature(averageTemp)}`);
    }

    reasons.push(averageWind <= profile.windLimit
        ? "Light winds"
        : `Wind around ${formatWind(averageWind)}`);

    if (aqi) {
        reasons.push(aqi <= 2 ? "Good air quality" : `AQI ${aqi}`);
    } else {
        reasons.push("Air quality unavailable");
    }

    if (maximumUv >= 6) {
        reasons.push(`UV reaches ${Math.round(maximumUv)}`);
    }

    return {
        score,
        reasons: reasons.slice(0, 4),
        usesLatestAqi: !hasForecastAqi && Boolean(currentAqi.index)
    };
}

function renderActivityRecommendation(data) {
    const profile = activityProfiles[activityType.value];
    const currentAqi = getAirQualityDetails(data.current.air_quality);
    const now = parseLocalTime(data.location.localtime);
    const hours = data.forecast.forecastday.flatMap(function (day) {
        return day.hour;
    }).filter(function (hour) {
        const timestamp = parseLocalTime(hour.time);
        return timestamp !== null && timestamp >= now && timestamp < now + 24 * 60 * 60 * 1000;
    }).sort(function (first, second) {
        return parseLocalTime(first.time) - parseLocalTime(second.time);
    });

    const windows = [];
    for (let index = 0; index < hours.length - 1; index += 1) {
        const firstTimestamp = parseLocalTime(hours[index].time);
        const secondTimestamp = parseLocalTime(hours[index + 1].time);
        if (secondTimestamp - firstTimestamp !== 60 * 60 * 1000) {
            continue;
        }

        const result = scoreActivityWindow(hours.slice(index, index + 2), profile, currentAqi);
        windows.push({
            startTime: hours[index].time,
            ...result
        });
    }

    activityResult.replaceChildren();
    if (windows.length === 0) {
        const message = document.createElement("p");
        message.className = "muted";
        message.textContent = "There aren't enough upcoming hourly forecasts to recommend a time yet.";
        activityResult.append(message);
        return;
    }

    const best = windows.reduce(function (currentBest, candidate) {
        return candidate.score > currentBest.score ? candidate : currentBest;
    });
    const recommendation = document.createElement("article");
    recommendation.className = "activity-recommendation";

    const content = document.createElement("div");
    content.className = "activity-recommendation-content";

    const heading = document.createElement("h3");
    heading.textContent = `${best.score >= 65 ? "Best time" : "Best available time"} for ${profile.label}`;

    const time = document.createElement("p");
    time.className = "activity-time";
    time.textContent = formatActivityWindow(best.startTime, 2);

    const reasonList = document.createElement("ul");
    reasonList.className = "activity-reasons";
    best.reasons.forEach(function (reason) {
        const item = document.createElement("li");
        item.textContent = reason;
        reasonList.append(item);
    });
    if (best.usesLatestAqi) {
        const item = document.createElement("li");
        item.textContent = "Air quality uses the latest reading";
        reasonList.append(item);
    }

    content.append(heading, time, reasonList);

    const score = document.createElement("div");
    score.className = "activity-score";
    score.setAttribute("aria-label", `Forecast fit score: ${best.score} out of 100`);

    const scoreNumber = document.createElement("strong");
    scoreNumber.textContent = best.score;
    const scoreLabel = document.createElement("span");
    scoreLabel.textContent = "forecast fit";
    const scoreTrack = document.createElement("div");
    scoreTrack.className = "activity-score-track";
    const scoreBar = document.createElement("span");
    scoreBar.style.width = `${best.score}%`;
    scoreTrack.append(scoreBar);

    score.append(scoreNumber, scoreLabel, scoreTrack);
    recommendation.append(content, score);
    activityResult.append(recommendation);
}

function renderWeeklyForecast(data) {
    weeklyForecast.innerHTML = data.forecast.forecastday.map(function (day) {
        const dayName = new Date(`${day.date}T12:00:00`).toLocaleDateString([], {
            weekday: "long"
        });
        const maxTemp = currentUnit === "C"
            ? Math.round(day.day.maxtemp_c)
            : Math.round(day.day.maxtemp_f);
        const minTemp = currentUnit === "C"
            ? Math.round(day.day.mintemp_c)
            : Math.round(day.day.mintemp_f);

        return `
            <div class="day-row">
                <span>${dayName}</span>
                <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}" width="36">
                <span>${day.day.condition.text}</span>
                <span>${maxTemp}° / ${minTemp}°${currentUnit}</span>
            </div>
        `;
    }).join("");
}

function displayWeather(data) {
    const location = data.location;
    const current = data.current;
    const today = data.forecast.forecastday[0];
    const airQuality = updateAirQuality(current.air_quality);

    localClockBase = {
        timestamp: parseLocalTime(location.localtime),
        receivedAt: Date.now()
    };
    updateLocalDateTime();
    cityName.textContent = `${location.name}, ${location.country}`;
    weatherCondition.textContent = current.condition.text;
    temperature.innerHTML =
        `${convertTemperature(current.temp_c)}<span>°${currentUnit}</span>`;
    feelsLike.textContent = `Feels like ${formatTemperature(current.feelslike_c)}`;
    highLow.innerHTML = `
        <span>↑ High ${formatTemperature(today.day.maxtemp_c)}</span>
        <span>↓ Low ${formatTemperature(today.day.mintemp_c)}</span>
    `;
    weatherIcon.innerHTML = `
        <img src="https:${current.condition.icon}" alt="${current.condition.text}">
    `;

    document.querySelector("#humidity").textContent = `${current.humidity}%`;
    document.querySelector("#wind-speed").textContent = formatWind(current.wind_kph);
    document.querySelector("#uv-index").textContent = `${current.uv} / 11`;
    document.querySelector("#visibility").textContent = formatVisibility(current.vis_km);
    document.querySelector("#pressure").textContent = `${current.pressure_mb} hPa`;
    document.querySelector("#sunrise").textContent = today.astro.sunrise;
    document.querySelector("#sunset").textContent = today.astro.sunset;
    document.querySelector("#wind-description").textContent =
        `From the ${current.wind_dir} · ${formatWind(current.wind_kph)}`;
    document.querySelector("#uv-description").textContent = current.uv >= 6
        ? "High — seek shade"
        : current.uv >= 3
            ? "Moderate exposure"
            : "Low exposure";
    document.querySelector("#visibility-description").textContent =
        current.vis_km < 5 ? "Reduced visibility" : "Good visibility";

    applyWeatherTheme(data);
    renderHourlyForecast(data);
    renderActivityRecommendation(data);
    renderWeeklyForecast(data);
    renderSuggestions(current, airQuality);
}

async function getWeather(city) {
    const requestId = ++latestRequest;
    document.body.dataset.loading = "true";
    document.querySelector("#weather-skeleton").hidden = false;
    weatherStatus.setAttribute("aria-busy", "true");
    weatherStatus.classList.remove("has-error");
    weatherStatus.textContent = `Loading weather for ${city}...`;
    cityName.textContent = "Loading...";
    weatherCondition.textContent = "Fetching live weather...";
    const activityMessage = document.createElement("p");
    activityMessage.className = "muted";
    activityMessage.textContent = "Finding a good time for your plans...";
    activityResult.replaceChildren(activityMessage);

    try {
        if (!API_KEY) {
            throw new Error("WeatherAPI key is not configured. Set SKYCAST_API_KEY in config.js.");
        }
        const url =
            `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(city)}&days=7&aqi=yes&alerts=yes`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Unable to fetch weather.");
        }
        if (requestId !== latestRequest) {
            return;
        }

        currentWeather = data;
        displayWeather(data);
        document.body.dataset.loading = "false";
        document.querySelector("#weather-skeleton").hidden = true;
        weatherStatus.removeAttribute("aria-busy");
        weatherStatus.classList.remove("has-error");
        saveRecentSearch(`${data.location.name}, ${data.location.country}`);
        weatherStatus.textContent = `Showing live weather for ${data.location.name}.`;
    } catch (error) {
        if (requestId !== latestRequest) {
            return;
        }
        document.body.dataset.loading = "false";
        document.querySelector("#weather-skeleton").hidden = true;
        weatherStatus.removeAttribute("aria-busy");
        weatherStatus.classList.add("has-error");
        console.error("Weather error:", error);
        weatherStatus.textContent = error.message;
        cityName.textContent = "Unable to load weather";
        weatherCondition.textContent = "Check the city name or try again.";
        temperature.innerHTML = `--<span>°${currentUnit}</span>`;
        feelsLike.textContent = "Please try again.";
        highLow.replaceChildren();
        weatherIcon.textContent = "🌍";
        hourlyGrid.replaceChildren();
        weeklyForecast.replaceChildren();
        smartSuggestions.replaceChildren();
        const activityError = document.createElement("p");
        activityError.className = "muted";
        activityError.textContent = "Search for a city to get an activity recommendation.";
        activityResult.replaceChildren(activityError);
    }
}

searchForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const city = cityInput.value.trim();

    if (city === "") {
        weatherStatus.textContent = "Please enter a city name.";
        cityInput.focus();
        return;
    }

    getWeather(city);
});

function setTemperatureUnit(unit) {
    currentUnit = unit;
    localStorage.setItem(TEMPERATURE_UNIT_KEY, currentUnit);
    unitButton.textContent = `°${currentUnit}`;
    unitButton.setAttribute(
        "aria-label",
        `Switch to ${currentUnit === "C" ? "Fahrenheit" : "Celsius"}`
    );
    settingsUnit.value = currentUnit;

    if (currentWeather) {
        displayWeather(currentWeather);
    }
}

unitButton.addEventListener("click", function () {
    setTemperatureUnit(currentUnit === "C" ? "F" : "C");
});

headerButtons[0].addEventListener("click", function () {
    const city = currentWeather?.location.name || cityInput.value.trim() || "Pune";
    getWeather(city);
});

headerButtons[1].addEventListener("click", function () {
    cityInput.scrollIntoView({ behavior: "smooth", block: "center" });
    cityInput.focus({ preventScroll: true });
});

headerButtons[2].addEventListener("click", function () {
    settingsUnit.value = currentUnit;
    settingsDialog.showModal();
});

settingsUnit.addEventListener("change", function () {
    setTemperatureUnit(settingsUnit.value);
});

activityType.addEventListener("change", function () {
    if (currentWeather) {
        renderActivityRecommendation(currentWeather);
    }
});

document.querySelector(".clear-recent").addEventListener("click", function () {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
    renderRecentSearches();
});

setTemperatureUnit(currentUnit);
renderRecentSearches();
getWeather("Pune");
window.setInterval(updateLocalDateTime, 30_000);
