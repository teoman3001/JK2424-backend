const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================================================
// 1. PRICING SETTINGS (Admin’den değiştirilebilir)
// ===================================================
let pricingSettings = {
  baseFare: 65,
  includedMiles: 8,
  extraPerMile: 2,
  nightMultiplier: 1.25,
  minimumFare: 65
};

let customers = []; 
let bookings = [];

function normalizePhone(phone) {
  return phone.replace(/\D/g, ""); 
}

// Yeni: Fiyat Hesaplama Motoru (Şeffaf detaylar eklendi)
function calculatePrice(miles, isNight) {
  const base = pricingSettings.baseFare;
  const included = pricingSettings.includedMiles;
  const extraRate = pricingSettings.extraPerMile;

  let extraMiles = Math.max(0, miles - included);
  let extraCost = extraMiles * extraRate;

  let subtotal = base + extraCost;

  if (isNight) {
    subtotal = subtotal * pricingSettings.nightMultiplier;
  }

  const total = Math.max(subtotal, pricingSettings.minimumFare);

  return {
    miles: Number(miles.toFixed(2)),
    baseFare: base,
    includedMiles: included,
    extraMiles: Number(extraMiles.toFixed(2)),
    extraCost: Number(extraCost.toFixed(2)),
    extraRate: extraRate, // Frontend'e gönderilen şeffaf oran
    nightApplied: isNight,
    nightMultiplier: pricingSettings.nightMultiplier,
    total: Number(total.toFixed(2))
  };
}

// ===================================================
// ANA SAYFA
// ===================================================
app.get("/", (req, res) => {
  res.send("JK2424 Backend - Pricing Engine v1.2 (Transparent) is running");
});

// ===================================================
// 2. /calc ENDPOINT (Google Distance Matrix Bağlantısı)
// ===================================================
app.get("/calc", async (req, res) => {
  try {
    const { pickup, stop, dropoff, isNight } = req.query;

    if (!pickup || !dropoff) {
      return res.json({ success: false, error: "Missing pickup or dropoff" });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Missing API KEY on server" });
    }

    async function getMiles(origin, destination) {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.status !== "OK") throw new Error("DistanceMatrix status not OK");
      const meters = j.rows?.[0]?.elements?.[0]?.distance?.value;
      if (!meters) throw new Error("No route found");
      return meters / 1609.344;
    }

    let miles = 0;
    if (stop && stop.trim().length > 0) {
      const m1 = await getMiles(pickup, stop);
      const m2 = await getMiles(stop, dropoff);
      miles = m1 + m2;
    } else {
      miles = await getMiles(pickup, dropoff);
    }

    const pricing = calculatePrice(miles, isNight === "true");

    res.json({
      success: true,
      pricing
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || "Calc failed" });
  }
});

// ===================================================
// 3. PRICING SETTINGS (Admin)
// ===================================================
app.get("/pricing", (req, res) => {
  res.json({ success: true, pricingSettings });
});

app.post("/pricing", (req, res) => {
  const { baseFare, includedMiles, extraPerMile, nightMultiplier, minimumFare } = req.body;
  pricingSettings = {
    baseFare: Number(baseFare),
    includedMiles: Number(includedMiles),
    extraPerMile: Number(extraPerMile),
    nightMultiplier: Number(nightMultiplier),
    minimumFare: Number(minimumFare)
  };
  res.json({ success: true, pricingSettings });
});

// ===================================================
// 4. BOOKINGS & STATUS (Diğer Fonksiyonlar)
// ===================================================
app.post("/bookings", (req, res) => {
  const booking = { id: crypto.randomUUID(), ...req.body, status: "pending", createdAt: new Date().toISOString() };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

app.get("/bookings", (req, res) => {
  res.json({ success: true, bookings });
});

app.get("/bookings/:id", (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  res.json({ success: true, booking: b });
});

app.patch("/bookings/:id/status", (req, res) => {
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx !== -1) {
    bookings[idx].status = req.body.status;
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
});

app.listen(PORT, () => {
  console.log("🚀 JK2424 Server (v1.2) running on port", PORT);
});
