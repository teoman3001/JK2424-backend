const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================================================
// 1. PRICING SETTINGS
// ===================================================
let pricingSettings = {
  baseFare: 65,
  includedMiles: 10,
  extraPerMile: 2,
  nightMultiplier: 1.25,
  minimumFare: 65
};

// ===================================================
// 2. STATUS LIFECYCLE & FLOW CONTROL
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

let customers = []; 
let bookings = [];

function normalizePhone(phone) { return phone.replace(/\D/g, ""); }

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
// ENDPOINTS
// ===================================================

app.get("/", (req, res) => res.send("JK2424 Backend - Uber Lifecycle v1.9 Active"));

app.get("/calc", async (req, res) => {
  try {
    const { pickup, stop, dropoff, isNight } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    async function getMiles(origin, destination) {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
      const r = await fetch(url);
      const j = await r.json();
      const meters = j.rows?.[0]?.elements?.[0]?.distance?.value;
      return meters / 1609.344;
    }
    let miles = (stop && stop.trim().length > 0) ? (await getMiles(pickup, stop)) + (await getMiles(stop, dropoff)) : await getMiles(pickup, dropoff);
    res.json({ success: true, pricing: calculatePrice(miles, isNight === "true") });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.get("/pricing", (req, res) => res.json({ success: true, pricingSettings }));
app.post("/pricing", (req, res) => { pricingSettings = { ...req.body }; res.json({ success: true }); });

// 3. BOOKING OLUŞTURMA (Genişletilmiş History Yapısı)
app.post("/bookings", (req, res) => {
  const now = new Date().toISOString();
  const booking = {
    id: crypto.randomUUID(),
    ...req.body,
    status: "pending",
    statusHistory: {
      pending: now,
      confirmed: null,
      payment_sent: null,
      paid: null,
      on_the_way: null,
      arrived: null,
      in_progress: null,
      completed: null,
      cancelled: null
    },
    createdAt: now
  };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

app.get("/bookings", (req, res) => res.json({ success: true, bookings }));
app.get("/bookings/:id", (req, res) => {
  const b = bookings.find(x => x.id === req.params.id);
  res.json({ success: true, booking: b });
});

// 4. STATUS UPDATE (Zaman Damgası Kontrollü)
app.patch("/bookings/:id/status", (req, res) => {
  const { status: newStatus } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);

  if (idx === -1) return res.status(404).json({ success: false });

  const currentStatus = bookings[idx].status;
  const allowedNext = STATUS_FLOW[currentStatus] || [];

  if (!allowedNext.includes(newStatus)) {
    return res.status(400).json({ success: false, message: `Invalid flow: ${currentStatus} -> ${newStatus}` });
  }

  // Durumu güncelle ve zaman damgasını bas
  bookings[idx].status = newStatus;
  if (bookings[idx].statusHistory[newStatus] === null) {
    bookings[idx].statusHistory[newStatus] = new Date().toISOString();
  }
  
  res.json({ success: true, booking: bookings[idx] });
});

app.listen(PORT, () => console.log("🚀 JK2424 Server (v1.9) Ready"));
