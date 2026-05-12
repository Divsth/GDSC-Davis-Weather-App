import { useState, useEffect, useRef, useMemo } from "react";
import { LineChart, Line, XAxis, ResponsiveContainer } from "recharts";
import { fetchWeather } from "./api";
import "./App.css";

// ─── Helpers ────────────────────────────────────────────────────────────────

function condIcon(c) {
  c = c.toLowerCase();
  if (/rain|shower|drizzle/.test(c)) return "🌧️";
  if (/thunder/.test(c)) return "⛈️";
  if (/cloudy|overcast/.test(c)) return "☁️";
  if (/partly/.test(c)) return "⛅";
  return "☀️";
}

function skyClass(c) {
  c = c.toLowerCase();
  if (/rain|shower|thunder/.test(c)) return "rainy";
  if (/cloud|overcast/.test(c)) return "cloudy";
  return "clear";
}

function uvLabel(uv) {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "V.High";
  return "Extreme";
}

// ─── SVG Tile Graphics ───────────────────────────────────────────────────────

function RainGraphic({ pct }) {
  const cloudY = pct >= 25 ? 12 : 18;
  return (
    <div style={{ width: "100%" }}>
      <svg width="36" height="32" viewBox="0 0 36 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="18" cy={cloudY} rx="11" ry="8" fill="rgba(100,160,220,0.35)" stroke="rgba(80,130,200,0.6)" strokeWidth="1" />
        {pct >= 25 && (
          <>
            <line x1="11" y1="22" x2="9"  y2="30" stroke="#5b9ed6" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="18" y1="22" x2="16" y2="30" stroke="#5b9ed6" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="25" y1="22" x2="23" y2="30" stroke="#5b9ed6" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
      </svg>
      <div className="rain-fill-track">
        <div className="rain-fill-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function WindGraphic({ speed }) {
  const maxSpeed = 40;
  const frac = Math.min(speed / maxSpeed, 1);
  const endAngle = -180 + frac * 180;
  const rad = (a) => (a * Math.PI) / 180;
  const cx = 20, cy = 20, r = 14;
  const ex = cx + r * Math.cos(rad(endAngle));
  const ey = cy + r * Math.sin(rad(endAngle));
  const largeArc = frac > 0.5 ? 1 : 0;
  return (
    <svg width="40" height="24" viewBox="0 0 40 24" style={{ overflow: "visible" }}>
      <path d="M6,20 A14,14 0 0,1 34,20" stroke="rgba(26,26,46,0.12)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path
        d={`M6,20 A14,14 0 ${largeArc},1 ${ex.toFixed(1)},${ey.toFixed(1)}`}
        stroke="#e8650a" strokeWidth="4" fill="none" strokeLinecap="round"
      />
      <circle cx={ex.toFixed(1)} cy={ey.toFixed(1)} r="3" fill="#e8650a" />
    </svg>
  );
}

function UvGraphic({ uv }) {
  const maxUV = 11;
  const pct = Math.min(uv / maxUV, 1) * 100;
  const color =
    uv <= 2 ? "#4caf50" :
    uv <= 5 ? "#ffeb3b" :
    uv <= 7 ? "#ff9800" :
    uv <= 10 ? "#f44336" : "#9c27b0";
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const rx = 14 + 11 * Math.cos((a * Math.PI) / 180);
    const ry = 14 + 11 * Math.sin((a * Math.PI) / 180);
    const sx = 14 + 8 * Math.cos((a * Math.PI) / 180);
    const sy = 14 + 8 * Math.sin((a * Math.PI) / 180);
    return { a, rx, ry, sx, sy };
  });
  return (
    <div style={{ width: "100%" }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="6" fill={color} opacity="0.85" />
        {rays.map(({ a, rx, ry, sx, sy }) => (
          <line key={a}
            x1={sx.toFixed(1)} y1={sy.toFixed(1)}
            x2={rx.toFixed(1)} y2={ry.toFixed(1)}
            stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.7"
          />
        ))}
      </svg>
      <div className="uv-bar-track">
        <div className="uv-bar-thumb" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

function HumidityGraphic({ humidity }) {
  const frac = Math.min(humidity / 100, 1);
  const cx = 20, cy = 20, r = 14;
  const endAngleVal = Math.PI - frac * Math.PI;
  const ex = cx + r * Math.cos(endAngleVal);
  const ey = cy + r * Math.sin(endAngleVal);
  const largeArc = frac > 0.5 ? 1 : 0;
  return (
    <svg width="40" height="24" viewBox="0 0 40 24" style={{ overflow: "visible" }}>
      <path d="M6,20 A14,14 0 0,1 34,20" stroke="rgba(26,26,46,0.12)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path
        d={`M6,20 A14,14 0 ${largeArc},1 ${ex.toFixed(1)},${ey.toFixed(1)}`}
        stroke="#5b9ed6" strokeWidth="4" fill="none" strokeLinecap="round"
      />
      <circle cx={ex.toFixed(1)} cy={ey.toFixed(1)} r="3" fill="#5b9ed6" />
    </svg>
  );
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

function AlertsSection({ d }) {
  const alerts = [];
  const cond = d.cond.toLowerCase();

  if (/thunder/.test(cond))
    alerts.push({ level: "danger", icon: "⛈️", title: "Thunderstorm Warning", msg: "Thunderstorms expected. Avoid open areas and stay indoors when possible." });
  if (d.precip >= 70)
    alerts.push({ level: "danger", icon: "🌧️", title: "Heavy Rain Warning", msg: `${d.precip}% chance of rain with ${d.precipSum}" expected. Allow extra travel time and watch for standing water.` });
  else if (d.precip >= 40)
    alerts.push({ level: "warning", icon: "🌦️", title: "Rain Likely", msg: `${d.precip}% chance of rain. Consider bringing an umbrella.` });
  if (d.wind >= 30)
    alerts.push({ level: "danger", icon: "💨", title: "High Wind Warning", msg: `Winds up to ${d.wind} mph. Secure loose outdoor items and use caution while driving.` });
  else if (d.wind >= 20)
    alerts.push({ level: "warning", icon: "💨", title: "Breezy Conditions", msg: `Winds around ${d.wind} mph expected throughout the day.` });
  if (d.uv >= 11)
    alerts.push({ level: "danger", icon: "☀️", title: "Extreme UV Index", msg: `UV index of ${d.uv}. Unprotected skin can burn in minutes — wear SPF 50+, a hat, and limit midday sun exposure.` });
  else if (d.uv >= 8)
    alerts.push({ level: "warning", icon: "🌤️", title: "Very High UV Index", msg: `UV index of ${d.uv}. Apply sunscreen and seek shade between 10 AM – 4 PM.` });
  else if (d.uv >= 6)
    alerts.push({ level: "info", icon: "🌤️", title: "High UV Index", msg: `UV index of ${d.uv}. Sunscreen and protective clothing recommended.` });
  if (d.humidity >= 85)
    alerts.push({ level: "warning", icon: "💧", title: "High Humidity", msg: `Humidity up to ${d.humidity}%. Conditions may feel muggy — stay hydrated and take it easy outdoors.` });
  if (/fog/.test(cond))
    alerts.push({ level: "warning", icon: "🌫️", title: "Fog Advisory", msg: "Dense fog possible. Reduce speed and use low-beam headlights while driving." });
  if (d.high >= 105)
    alerts.push({ level: "danger", icon: "🌡️", title: "Extreme Heat Warning", msg: `High of ${d.high}°F. Stay hydrated, avoid strenuous outdoor activity midday, and check on vulnerable neighbors.` });
  else if (d.high >= 95)
    alerts.push({ level: "warning", icon: "🌡️", title: "Heat Advisory", msg: `High of ${d.high}°F. Drink plenty of water and limit prolonged sun exposure.` });

  if (alerts.length === 0) return null;
  return (
    <div className="alerts-section">
      {alerts.map((a, i) => (
        <div key={i} className={`alert-box ${a.level}`} style={{ animationDelay: `${i * 0.06}s` }}>
          <div className="alert-icon">{a.icon}</div>
          <div>
            <div className="alert-title">{a.title}</div>
            {a.msg}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({ d, hourlyPeriods }) {
  const TARGET_HOURS = [6, 9, 12, 15, 18, 21];
  const dayHours = hourlyPeriods.filter((h) => h.startTime.startsWith(d.startTime));
  const chartData = TARGET_HOURS
    .map((h) => dayHours.find((p) => new Date(p.startTime).getHours() === h))
    .filter(Boolean)
    .map((h) => ({
      time: new Date(h.startTime).toLocaleTimeString([], { hour: "numeric" }),
      temperature: h.temperature,
    }));

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h2>{d.day}, {d.date}</h2>
        <span>{d.cond}</span>
      </div>

      <AlertsSection d={d} />

      <div className="conditions-grid">
        <div className="cond-tile">
          <div className="cond-tile-label">Precipitation</div>
          <div className="cond-tile-graphic"><RainGraphic pct={d.precip} /></div>
          <div className="cond-tile-val">{d.precip}<span>%</span></div>
          <div style={{ fontSize: "9px", color: "var(--ink-muted)" }}>{d.precipSum}" expected</div>
        </div>
        <div className="cond-tile">
          <div className="cond-tile-label">Wind Speed</div>
          <div className="cond-tile-graphic"><WindGraphic speed={d.wind} /></div>
          <div className="cond-tile-val">{d.wind}<span>mph</span></div>
        </div>
        <div className="cond-tile">
          <div className="cond-tile-label">Humidity</div>
          <div className="cond-tile-graphic"><HumidityGraphic humidity={d.humidity} /></div>
          <div className="cond-tile-val">{d.humidity}<span>%</span></div>
        </div>
        <div className="cond-tile">
          <div className="cond-tile-label">UV Index</div>
          <div className="cond-tile-graphic"><UvGraphic uv={d.uv} /></div>
          <div className="cond-tile-val">{d.uv}<span>{uvLabel(d.uv)}</span></div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-tile">
          <p className="stat-label">HIGH / LOW</p>
          <div className="stat-val">
            {d.high}° <span className="stat-val-low">/ {d.low}°F</span>
          </div>
        </div>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <XAxis
              dataKey="time"
              tick={{ fontFamily: "DM Mono", fontSize: 10, fill: "var(--ink)" }}
              axisLine={false}
              tickLine={false}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#e8650a"
              dot={false}
              strokeWidth={2}
              fill="rgba(232,101,10,0.1)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────

export default function App() {
  const [forecastDays, setForecastDays] = useState([]);
  const [hourlyPeriods, setHourlyPeriods] = useState([]);
  const [activeDay, setActiveDay] = useState(0);
  const [loading, setLoading] = useState(true);
  const daysRowRef = useRef(null);

  // Static raindrop styles — generated once
  const raindrops = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        style: {
          left: `${Math.random() * 100}%`,
          height: `${12 + Math.random() * 20}px`,
          animationDuration: `${0.6 + Math.random() * 0.8}s`,
          animationDelay: `${-Math.random() * 2}s`,
          top: "-5%",
        },
      })),
    []
  );

  useEffect(() => {
    fetchWeather()
      .then(({ forecastDays, hourlyPeriods }) => {
        setForecastDays(forecastDays);
        setHourlyPeriods(hourlyPeriods);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function scrollDays(amount) {
    daysRowRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  const activeDayData = forecastDays[activeDay];
  const currentSkyClass = activeDayData ? skyClass(activeDayData.cond) : "";
  const showRain = activeDayData ? activeDayData.precip > 30 : false;

  return (
    <>
      {/* Loading overlay */}
      <div className={`loading-overlay${loading ? "" : " hidden"}`}>
        <div className="loading-spinner" />
        <div className="loading-text">Loading 14-Day Forecast...</div>
      </div>

      {/* Animated sky */}
      <div className={`sky-bg ${currentSkyClass}`} />

      {/* Clouds */}
      <div className="clouds">
        <div className="cloud cloud-1" />
        <div className="cloud cloud-2" />
        <div className="cloud cloud-3" />
        <div className="cloud cloud-4" />
      </div>

      {/* Rain */}
      <div className={`rain-container${showRain ? " active" : ""}`}>
        {raindrops.map((drop) => (
          <div key={drop.id} className="raindrop" style={drop.style} />
        ))}
      </div>

      {/* Main content */}
      <div className="app">
        <div className="header">
          <div className="location-block">
            <h1 className="city-name">
              Da<em>vis</em>,<br />California
            </h1>
            <p style={{ fontSize: "11px", color: "var(--ink-muted)", marginTop: "6px" }}>
              38.5°N · YOLO COUNTY
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="big-temp">
              {activeDayData ? activeDayData.high : "—"}<sup>°F</sup>
            </div>
            <div style={{ fontSize: "11px", textTransform: "uppercase" }}>
              {activeDayData ? activeDayData.cond : "Fetching..."}
            </div>
          </div>
        </div>

        <div className="nav-container">
          <button className="nav-btn" onClick={() => scrollDays(-240)}>←</button>
          <button className="nav-btn" onClick={() => scrollDays(240)}>→</button>
        </div>

        <div className="days-row" ref={daysRowRef}>
          {forecastDays.map((d, i) => (
            <div
              key={d.startTime}
              className={`day-card${i === activeDay ? " active" : ""}`}
              onClick={() => setActiveDay(i)}
            >
              <div className="day-label">{d.day}</div>
              <span className="day-icon">{condIcon(d.cond)}</span>
              <div className="day-high">{d.high}<sup>°</sup></div>
              <div className="day-date">{d.date}</div>
              <div className="day-precip">{d.precip}% Rain</div>
            </div>
          ))}
        </div>

        {activeDayData && (
          <DetailPanel d={activeDayData} hourlyPeriods={hourlyPeriods} />
        )}

        <div className="footer">Weather Data · Open-Meteo API</div>
      </div>
    </>
  );
}
