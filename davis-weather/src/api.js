const LAT = 38.5449;
const LON = -121.7405;

const WEATHER_DESC = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  61: "Light rain",
  63: "Rain",
  80: "Showers",
  95: "Thunderstorm",
};

export async function fetchWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
    `,windspeed_10m_max,uv_index_max,precipitation_sum,relative_humidity_2m_max` +
    `&hourly=temperature_2m,precipitation_probability` +
    `&temperature_unit=fahrenheit&precipitation_unit=inch&wind_speed_unit=mph` +
    `&timezone=America%2FLos_Angeles&forecast_days=14`;

  const res = await fetch(url);
  const data = await res.json();

  const forecastDays = data.daily.time.map((time, i) => {
    const dObj = new Date(time + "T00:00:00");
    return {
      day: dObj.toLocaleDateString("en-US", { weekday: "short" }),
      date: dObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      startTime: time,
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
      precip: data.daily.precipitation_probability_max[i] || 0,
      precipSum: (data.daily.precipitation_sum?.[i] || 0).toFixed(2),
      wind: Math.round(data.daily.windspeed_10m_max?.[i] || 0),
      uv: Math.round(data.daily.uv_index_max?.[i] || 0),
      humidity: Math.round(data.daily.relative_humidity_2m_max?.[i] || 0),
      cond: WEATHER_DESC[data.daily.weathercode[i]] || "Cloudy",
    };
  });

  const hourlyPeriods = data.hourly.time.map((time, i) => ({
    startTime: time,
    temperature: data.hourly.temperature_2m[i],
    precip: data.hourly.precipitation_probability[i],
  }));

  return { forecastDays, hourlyPeriods };
}
