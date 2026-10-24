# 🌦️ SkyCast — Seasonal World

A modern, responsive weather application that brings weather forecasts to life through beautiful, season-inspired visuals.

## ✨ Features

- 🌍 Search weather conditions by city.
- 🌡️ View current temperature, weather condition, and feels-like temperature.
- 🔄 Switch between Celsius and Fahrenheit.
- 🕒 View the hourly weather forecast.
- 📅 Explore the 7-day weather forecast.
- 💧 Check humidity, wind speed, UV index, visibility, and atmospheric pressure.
- 🌸 Dynamic seasonal themes inspired by spring, summer, autumn, and winter.
- 🌧️ Weather-responsive visuals for sunny, cloudy, rainy, snowy, and nighttime conditions.
- 📱 Responsive design for desktop, tablet, and mobile devices.
- ✨ Subtle animations and a nature-inspired interface.

## 🛠️ Technologies Used

- HTML5
- CSS3
- JavaScript
- WeatherAPI.com

## 🚀 Getting Started

1. Clone or download this repository.
2. Open the project folder in Visual Studio Code.
3. Copy `config.js.example` to `config.js` and add your WeatherAPI.com API key.
4. Open `index.html` in your browser, or use the VS Code Live Server extension.

## 🔑 API Configuration

This project uses WeatherAPI.com to retrieve current weather and forecast data.

1. Create an account at [WeatherAPI.com](https://www.weatherapi.com/).
2. Get your API key.
3. Copy `config.js.example` to `config.js`.
4. Set your key as the value of `window.SKYCAST_API_KEY` in `config.js`.

**Security note:** Do not commit a real API key to a public repository. For a public portfolio deployment, use a secure backend to protect the key.

## 📂 Project Structure

```text
SkyCast/
├── index.html
├── style.css
├── script.js
└── README.md
```

## 🌤️ How It Works

Enter a city name to retrieve its weather information. SkyCast displays current conditions and forecasts, while the interface adapts its colors and atmosphere to the local season, weather, and time of day.

## 🎯 Project Goal

SkyCast is a frontend development project focused on API integration, responsive web design, DOM manipulation, and dynamic UI theming.

## 👩‍💻 Author

Created as a frontend development portfolio project.

## 📜 License

This project is available for learning and personal portfolio purposes. Add a license file if you intend to specify formal reuse permissions.