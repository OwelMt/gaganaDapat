import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaBullhorn,
  FaPeopleCarry,
  FaWarehouse,
  FaUserCog,
  FaPhoneAlt,
  FaSms,
  FaPhoneSquareAlt,
  FaEnvelope,
  FaFacebookF,
} from "react-icons/fa";
import "../css/Dashboard.css";

/**
 * NOTE on assets:
 * If any of these imports fail (wrong path / missing file), the variable will be undefined.
 * This component guards against that and shows a placeholder instead—so the app won’t crash.
 */
import jaenlogo from "../../assets/images/jaenlogo.png";

import hero1 from "../../assets/images/hero1.jpg";
import hero2 from "../../assets/images/hero2.jpg";
import hero3 from "../../assets/images/hero3.jpg";

import SplashScreen from "../splashscreen/SplashScreen";
import pasiglogo from "../../assets/images/pasiglogo.png";
import pasiglogodrrmo from "../../assets/images/pasiglogodrrmo.png";
import highlights from "../../assets/images/highlights.jpg";
import news1 from "../../assets/images/news1.png";
import forecast from "../../assets/images/forecast.png";
import nelogo from "../../assets/images/nelogo.png";
/** Simple placeholder block you can drop in for any missing image */
function PlaceholderImg({
  width = "100%",
  height = 280,
  radius = 12,
  label = "Image coming soon",
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "#E8EFEA",
        color: "#0F4D25",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        letterSpacing: ".3px",
        border: "1px solid #D9E0DF",
      }}
    >
      {label}
    </div>
  );
}

const heroImages = [hero2, hero1, hero3];

function Dashboard() {
  const navigate = useNavigate();
  const [currentHero, setCurrentHero] = useState(0);

  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [dotCount, setDotCount] = useState(0);

  // Rotate the hero image every 3.5s
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHero((prev) => (prev + 1) % heroImages.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Splash → Login (for Account link)
  const startSplash = (e) => {
    if (e) e.preventDefault();
    setShowSplash(true);
    let localDot = 0;

    const dotInterval = setInterval(() => {
      localDot = localDot < 4 ? localDot + 1 : 0;
      setDotCount(localDot);
    }, 200);

    navigate("/login");

    setTimeout(() => {
      clearInterval(dotInterval);
      setFadeOut(true);
      setTimeout(() => setShowSplash(false), 800);
    }, 4000);
  };

  // Hotline helpers
  const call = (num) => window.open(`tel:${num}`);
  const sms = (num) => window.open(`sms:${num}`);
  const email = (addr) => window.open(`mailto:${addr}`);

  const heroBg = heroImages[currentHero] || null;

  // ✅ Smooth scroll to the Localized Weather section
  const scrollToWeather = () => {
    const el = document.getElementById("weather");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard" id="home">
        {/* HEADER */}
        <header className="dashboard-header">
          <div className="brand-left">
            {/* Small logo; if missing -> logo placeholder */}
            {jaenlogo ? (
              <img src={jaenlogo} alt="Jaen Logo" className="logo-img" />
            ) : (
              <div className="logo-fallback" aria-label="Logo placeholder">
                LOGO
              </div>
            )}

            <div className="brand-text">
              <div className="brand-name">JAEN, NUEVA ECIJA</div>
              <div className="brand-sub">MDRRMO</div>
            </div>
          </div>

          <div className="header-right">
            <input
              type="text"
              className="header-search"
              placeholder="Search (Weather, News, Hazard Map...)"
            />
            <nav className="nav-links" aria-label="Main">
              <a href="#home">Home</a>
              <a href="#account" onClick={startSplash}>
                Account
              </a> 
            </nav>
          </div>
        </header>

        {/* HERO (full-screen) */}
        <section
          className={`hero ${heroBg ? "hero-has-bg" : ""}`}
          style={heroBg ? { backgroundImage: `url(${heroBg})` } : undefined}
        >
          {!heroBg && (
            <div style={{ width: "100%", maxWidth: 1140, padding: "0 24px" }}>
              <PlaceholderImg height={460} label="Hero banner" />
            </div>
          )}

          <div className="hero-overlay">
            <h1>Welcome to Jaen DRRMO</h1>
            <p>
              Manage evacuation centers, relief operations, and official
              announcements efficiently.
            </p>
            {/* ✅ Scroll to Localized Weather */}
            <button type="button" className="hero-btn" onClick={scrollToWeather}>
              Learn More
            </button>
          </div>
        </section>

        {/* LOCALIZED WEATHER FORECAST */}
        <section className="weather-section" id="weather">
          <div className="weather-header">
            <h2>LOCALIZED WEATHER FORECAST</h2>
          </div>

          <div className="weather-content">
            <div className="weather-image">
              {forecast ? (
                <img src={forecast} alt="Weather Forecast Report" />
              ) : (
                <PlaceholderImg height={320} />
              )}
            </div>

            <div className="weather-text">
              <h4>24‑Hour Public Weather Forecast</h4>
              <span className="weather-tag">#BasyangPH</span>

              <p className="weather-issued">Issued at 5:00 AM, February 7, 2026</p>

              <p>
                Northeast Monsoon is affecting the area. Expect cloudy to partly
                cloudy skies with light to moderate rains.
              </p>

              <p className="weather-temp">
                Temperature Range: <strong>22°C – 31°C</strong>
              </p>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section className="cards-container" id="services">
          {[
            {
              icon: <FaPeopleCarry />,
              title: "Evacuation Center Management",
              text: "Monitor evacuation centers and occupancy levels.",
            },
            {
              icon: <FaBullhorn />,
              title: "Messages & Announcements",
              text: "View messages and advisories from the DRRMO.",
            },
            {
              icon: <FaWarehouse />,
              title: "Relief Goods Management",
              text: "Track requested and ongoing relief operations.",
            },
            {
              icon: <FaUserCog />,
              title: "Account Settings",
              text: "Manage your account details.",
            },
          ].map((card, i) => (
            <div key={i} className="card" onClick={startSplash}>
              {React.cloneElement(card.icon, {
                className: "card-icon",
                "aria-hidden": true,
              })}
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </div>
          ))}
        </section>

        {/* HAZARD MAP */}
        <section className="map-section" id="hazard-map">
          <div className="weather-header">
            <h2>HAZARD MAP</h2>
          </div>
          <div className="map-container">
            <div className="map-placeholder">Hazard map API will be displayed here</div>
          </div>
        </section>

        {/* LATEST NEWS */}
        <section className="news-section" id="latest-news">
          <h2 className="news-title">Latest News</h2>

          <div className="news-banners">
            {/* LEFT: LATEST UPDATE */}
            <article className="news-banner-card">
              <div className="news-banner-head">
                <span className="news-banner-head-text">LATEST UPDATE</span>
              </div>

              {news1 ? (
                <img
                  src={news1}
                  alt="Latest weather and advisories"
                  className="news-banner-image"
                />
              ) : (
                <PlaceholderImg height={420} label="Latest update banner" />
              )}

              <div className="news-banner-body">
                <h3 className="news-banner-title">
                  Weather advisory: scattered rains affecting low-lying areas
                </h3>
                <div className="news-banner-date">February 7, 2026</div>
                <p className="news-banner-excerpt">
                  DRRMO continues to monitor weather conditions. Residents in
                  flood‑prone areas are advised to remain vigilant and follow
                  official channels for announcements and safety guidance.
                </p>
              </div>
            </article>

            {/* RIGHT: HIGHLIGHTS */}
            <article className="news-banner-card">
              <div className="news-banner-head">
                <span className="news-banner-head-text">HIGHLIGHTS</span>
              </div>

              {highlights ? (
                <img
                  src={highlights}
                  alt="DRRMO highlights key practices for disaster resilience"
                  className="news-banner-image"
                />
              ) : (
                <PlaceholderImg height={420} label="Highlights banner" />
              )}

              <div className="news-banner-body">
                <h3 className="news-banner-title">
                  Key practices for disaster resilience
                </h3>
                <div className="news-banner-date">August 6, 2025</div>
                <p className="news-banner-excerpt">
                  Success stories and best practices in disaster resiliency were
                  presented to strengthen preparedness and response.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* ================= EMERGENCY HOTLINES (FULL‑BLEED) ================= */}
        <section className="hotline-section fullbleed" id="hotlines">
          <div className="hotline-inner">
            <div className="hotline-bar">
              <h2>EMERGENCY HOTLINES</h2>
            </div>

            {/* TABLE‑STYLE LIST */}
            <div className="hotline-list" role="table" aria-label="Emergency hotlines">
              <div className="hotline-row" role="row">
                <div className="hotline-col left" role="cell">
                  <FaPhoneAlt aria-hidden="true" /> <span>Landline</span>
                </div>
                <div className="hotline-col right" role="cell">
                  <a href="tel:86430000" onClick={() => call("86430000")}>
                    8643‑0000
                  </a>
                </div>
              </div>

              <div className="hotline-row alt" role="row">
                <div className="hotline-col left" role="cell">
                  <FaSms aria-hidden="true" /> <span>SMS</span>
                </div>
                <div className="hotline-col right" role="cell">
                  <a href="sms:09088993333" onClick={() => sms("09088993333")}>
                    0908‑899‑3333
                  </a>
                </div>
              </div>

              <div className="hotline-row" role="row">
                <div className="hotline-col left" role="cell">
                  <FaPhoneSquareAlt aria-hidden="true" /> <span>OPCEN</span>
                </div>
                <div className="hotline-col right" role="cell">
                  <a href="tel:09615825013" onClick={() => call("09615825013")}>
                    0961‑582‑5013
                  </a>
                </div>
              </div>

              <div className="hotline-row alt" role="row">
                <div className="hotline-col left" role="cell">
                  <FaEnvelope aria-hidden="true" /> <span>Email</span>
                </div>
                <div className="hotline-col right" role="cell">
                  <a
                    href="mailto:drrmo@pasigcity.gov.ph"
                    className="hotline-email-link"
                    onClick={() => email("drrmo@pasigcity.gov.ph")}
                  >
                   lgujaen.mayorsoffice@gmail.com
                  </a>
                </div>
              </div>
            </div>

            {/* CONTACT ADDRESSES ROW (WITH SEALS/LOGOS) */}
            <div className="hotline-addresses alt-card">
              <div className="address-block address-with-logo">
                {pasiglogo ? (
                  <img
                    src={nelogo}
                    alt="City Hall Seal"
                    className="address-logo"
                  />
                ) : (
                  <PlaceholderImg width={80} height={80} radius={40} label="Logo" />
                )}
                <div className="address-content">
                  <h4>City Hall</h4>
                  <p>
                   1F Old Capitol Building, Cabanatuan City, Nueva Ecija
                  </p>
                  <p>
                    <a href="mailto:lydo@pasigcity.gov.ph">nepg_gov@yahoo.com.ph</a>
                  </p>
                </div>
              </div>

              <div className="address-block address-with-logo">
                {pasiglogodrrmo ? (
                  <img
                    src={jaenlogo}
                    alt="Jaen DRRMO"
                    className="address-logo"
                  />
                ) : (
                  <PlaceholderImg width={80} height={80} radius={40} label="Logo" />
                )}
                <div className="address-content">
                  <h4>Jaen DRRMO</h4>
                  <p>Municipal Government of Jaen, Brgy. Sapang, Jaen, Nueva Ecija, 3109 Philippines</p>
                  <p>
                    <a href="mailto:drrmo@pasigcity.gov.ph">
 lgujaen.mayorsoffice@gmail.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="dashboard-footer">
          <div className="footer-icons">
            <a
              aria-label="Facebook"
              href="https://www.facebook.com/PasigCityDRRMO"
              target="_blank"
              rel="noreferrer"
            >
              <FaFacebookF />
            </a>
            <a
              aria-label="Email"
              href="mailto:drrmo@pasigcity.gov.ph"
              target="_blank"
              rel="noreferrer"
            >
              <FaEnvelope />
            </a>
            <a aria-label="Call" href="tel:86430000">
              <FaPhoneAlt />
            </a>
          </div>
          <p>Copyright © 2026, All rights reserved.</p>
        </footer>

        {showSplash && <SplashScreen dotCount={dotCount} fadeOut={fadeOut} />}
      </div>
    </div>
  );
}

export default Dashboard;