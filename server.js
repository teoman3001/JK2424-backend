const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let pricingSettings = { baseFare: 65, includedMiles: 10, extraPerMile: 2, nightMultiplier: 1.25, minimumFare: 65 };
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

let bookings = [];

function calculatePrice(miles, isNight) {
  const base = pricingSettings.baseFare;
  const included = pricingSettings.includedMiles;
  const extraRate = pricingSettings.extraPerMile;
  let extraMiles = Math.max(0, miles - included);
  let extraCost = extraMiles * extraRate;
  let subtotal = base + extraCost;
  if (isNight) subtotal = subtotal * pricingSettings.nightMultiplier;
  const total = Math.max(subtotal, pricingSettings.minimumFare);
  return { miles: Number(miles.toFixed(2)), nightApplied: isNight, nightMultiplier: pricingSettings.nightMultiplier, total: Number(total.toFixed(2)) };
}

app.get("/calc", async (req, res) => {
  try {
    const { pickup, stop, dropoff, isNight } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    async function getMiles(origin, destination) {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`;
      const r = await fetch(url);
      const j = await r.json();
      return (j.rows?.[0]?.elements?.[0]?.distance?.value || 0) / 1609.344;
    }
    let miles = (stop && stop.trim().length > 0) ? (await getMiles(pickup, stop)) + (await getMiles(stop, dropoff)) : await getMiles(pickup, dropoff);
    res.json({ success: true, pricing: calculatePrice(miles, isNight === "true") });
  } catch (e) { res.status(500).json({ success: false }); }
});

app.post("/bookings", (req, res) => {
  const now = new Date().toISOString();
  const booking = {
    id: crypto.randomUUID(),
    ...req.body,
    status: "pending",
    messages: [], // Chat Altyapısı
    statusHistory: { pending: now, confirmed: null, payment_sent: null, paid: null, on_the_way: null, arrived: null, in_progress: null, completed: null, cancelled: null },
    createdAt: now
  };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

app.get("/bookings", (req, res) => res.json({ success: true, bookings }));
app.get("/bookings/:id", (req, res) => res.json({ success: true, booking: bookings.find(x => x.id === req.params.id) }));

app.patch("/bookings/:id/status", (req, res) => {
  const { status: newStatus } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  if (!(STATUS_FLOW[bookings[idx].status] || []).includes(newStatus)) return res.status(400).json({ success: false });
  bookings[idx].status = newStatus;
  bookings[idx].statusHistory[newStatus] = new Date().toISOString();
  res.json({ success: true, booking: bookings[idx] });
});

app.listen(PORT, () => console.log("JK2424 Engine Active"));
