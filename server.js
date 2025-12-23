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
  includedMiles: 10,
  extraPerMile: 2,
  nightMultiplier: 1.25,
  minimumFare: 65
};

// ===================================================
// 2. STATUS LIFECYCLE (Uber-level Mantıksal Akış)
// ===================================================
const STATUS_FLOW = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["payment_sent", "cancelled"],
  payment_sent: ["paid", "cancelled"],
  paid: ["on_the_way"],
  on_the_way: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: []
};

// VERİ DEPOLAMA (In-memory)
let customers = []; 
let bookings = [];

function normalizePhone(phone) {
  return phone.replace(/\D/g, ""); 
}

// Fiyat Hesaplama Motoru
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
    extraRate: extraRate,
    nightApplied: isNight,
    nightMultiplier: pricingSettings.nightMultiplier,
    total: Number(total.toFixed(2))
  };
}

// ===================================================
// ENDPOINTLER
// ===================================================

app.get("/", (req, res) => {
  res.send("JK2424 Backend - Lifecycle v1.8 is active");
});

// /calc - Google Distance Matrix & Pricing
app.get("/calc", async (req, res) => {
  try {
    const { pickup, stop, dropoff, isNight } = req.query;
    if (!pickup || !dropoff) return res.json({ success: false, error: "Missing pickup/dropoff" });

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    
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

// Admin Pricing Endpoints
app.get("/pricing", (req, res) => res.json({ success: true, pricingSettings }));
app.post("/pricing", (req, res) => {
  pricingSettings = { ...req.body };
  res.json({ success: true, pricingSettings });
});

// Bookings
app.post("/bookings", (req, res) => {
  const booking = { id: crypto.randomUUID(), ...req.body, status: "pending", createdAt: new Date().toISOString() };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

app.get("/bookings", (req, res) => res.json({ success: true, bookings }));
app.get("/bookings/:id", (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  res.json({ success: true, booking: b });
});

// ===================================================
// ✅ YENİ: AKILLI STATUS GÜNCELLEME (PATCH)
// ===================================================
app.patch("/bookings/:id/status", (req, res) => {
  const { status: newStatus } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }

  const currentStatus = bookings[idx].status;
  const allowedNext = STATUS_FLOW[currentStatus] || [];

  // Geçiş kontrolü
  if (!allowedNext.includes(newStatus)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status transition: ${currentStatus} → ${newStatus}`
    });
  }

  bookings[idx].status = newStatus;
  bookings[idx].updatedAt = new Date().toISOString();

  res.json({
    success: true,
    booking: bookings[idx]
  });
});

app.listen(PORT, () => console.log("🚀 JK2424 Server (v1.8) running on port", PORT));
