const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 1. PRICING SETTINGS
let pricingSettings = {
  baseFare: 65,
  includedMiles: 8,
  extraPerMile: 2,
  nightMultiplier: 1.25,
  minimumFare: 65
};

let customers = []; 
let bookings = [];

function normalizePhone(phone) { return phone.replace(/\D/g, ""); }

// 2. FİYAT HESAPLAMA MOTORU
function calculatePrice(miles, isNight) {
  const base = pricingSettings.baseFare;
  const included = pricingSettings.includedMiles;
  const extraRate = pricingSettings.extraPerMile;

  let extraMiles = Math.max(0, miles - included);
  let extraCost = extraMiles * extraRate;
  let subtotal = base + extraCost;

  if (isNight) subtotal = subtotal * pricingSettings.nightMultiplier;
  const total = Math.max(subtotal, pricingSettings.minimumFare);

  return {
    miles: Number(miles.toFixed(2)),
    baseFare: base,
    includedMiles: included,
    extraMiles: Number(extraMiles.toFixed(2)),
    extraCost: Number(extraCost.toFixed(2)),
    nightApplied: isNight,
    nightMultiplier: pricingSettings.nightMultiplier,
    total: Number(total.toFixed(2))
  };
}

// 3. /calc ENDPOINT (Google Distance Matrix ile gerçek mil)
app.get("/calc", async (req, res) => {
  try {
    const { pickup, stop, dropoff, isNight } = req.query;
    if (!pickup || !dropoff) return res.json({ success: false, error: "Missing pickup or dropoff" });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Render'daki Key
    
    // Google Matrix sorgusu
    async function getMiles(origin, destination) {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.status !== "OK") throw new Error("API Error");
      const meters = j.rows?.[0]?.elements?.[0]?.distance?.value;
      return meters / 1609.344;
    }

    let miles = 0;
    if (stop && stop.trim().length > 0) {
      miles = (await getMiles(pickup, stop)) + (await getMiles(stop, dropoff));
    } else {
      miles = await getMiles(pickup, dropoff);
    }

    const pricing = calculatePrice(miles, isNight === "true");
    res.json({ success: true, pricing });
  } catch (e) {
    res.status(500).json({ success: false, error: "Calculation failed" });
  }
});

// Diğer endpoint'lerin (bookings, status) aynı kalabilir.
app.post("/bookings", (req, res) => {
  const booking = { id: crypto.randomUUID(), ...req.body, status: "pending", createdAt: new Date().toISOString() };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

app.get("/bookings/:id", (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  res.json({ success: true, booking: b });
});

app.listen(PORT, () => console.log("JK2424 Online"));
