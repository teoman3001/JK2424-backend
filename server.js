/**
 * JK2424 FINAL SERVER — Render Backend
 */

const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// GOOGLE API KEY
const GOOGLE_API_KEY = "AIzaSyCgnDJwKDpN2fWL5NCDCd44kunvC89_4-8";

// PRICING (Varsayılan)
let pricing = {
  baseFare: 65,
  includedMiles: 15,
  extraPerMile: 2,
  nightMultiplier: 1.25,
  minimumFare: 65,
};

// ADMIN PANEL → GET PRICING
app.get("/api/admin/pricing", (req, res) => {
  res.json({ ok: true, settings: pricing });
});

// ADMIN PANEL → SAVE PRICING
app.post("/api/admin/pricing", (req, res) => {
  pricing = { ...pricing, ...req.body };
  console.log("NEW PRICING:", pricing);
  res.json({ ok: true });
});

// GOOGLE DISTANCE API
async function getDistance(pickup, stop, dropoff) {
  let url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${encodeURIComponent(
    pickup
  )}&destinations=`;

  if (stop) {
    url += `${encodeURIComponent(stop)}|`;
  }

  url += `${encodeURIComponent(dropoff)}&key=${GOOGLE_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.rows || !data.rows[0] || !data.rows[0].elements[0]) {
    return null;
  }

  return data.rows[0].elements.map((el) =>
    el.distance ? el.distance.value / 1609.34 : 0
  );
}

// PRICE CALCULATOR API
app.get("/api/calc-price", async (req, res) => {
  try {
    const { pickup, stop, dropoff, time, ampm } = req.query;

    const milesArr = await getDistance(pickup, stop, dropoff);
    if (!milesArr) return res.json({ error: "Distance not found" });

    let totalMiles = milesArr.reduce((a, b) => a + b, 0);

    // Extra miles
    const extraMiles = Math.max(0, totalMiles - pricing.includedMiles);

    // Base subtotal
    let total = pricing.baseFare + extraMiles * pricing.extraPerMile;

    // Night multiplier
    if (time && ampm) {
      const [hh, mm] = time.split(":");
      let h = parseInt(hh);
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;

      const minutes = h * 60 + parseInt(mm);

      if (minutes >= 22 * 60 || minutes < 5 * 60) {
        total *= pricing.nightMultiplier;
      }
    }

    if (total < pricing.minimumFare) {
      total = pricing.minimumFare;
    }

    res.json({
      ok: true,
      miles: totalMiles.toFixed(2),
      total: total.toFixed(2),
      pricing,
    });
  } catch (err) {
    console.error(err);
    res.json({ error: "Server error during calculation" });
  }
});

// SAVE RESERVATION
app.post("/api/reserve", (req, res) => {
  console.log("New reservation:", req.body);
  res.json({ ok: true, message: "Reservation received" });
});

app.listen(3000, () => console.log("JK2424 Backend running PORT 3000"));
