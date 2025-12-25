const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let pricingSettings = { baseFare: 65, includedMiles: 10, extraPerMile: 2, nightMultiplier: 1.25, minimumFare: 65 };
let bookings = [];

// Fiyat Hesaplama
app.get("/calc", async (req, res) => {
  try {
    const { pickup, stop, dropoff, isNight } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    async function getMiles(origin, destination) {
      const r = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${apiKey}`);
      const j = await r.json();
      return (j.rows?.[0]?.elements?.[0]?.distance?.value || 0) / 1609.344;
    }
    let miles = (stop && stop.trim().length > 0) ? (await getMiles(pickup, stop)) + (await getMiles(stop, dropoff)) : await getMiles(pickup, dropoff);
    const base = pricingSettings.baseFare;
    let extraMiles = Math.max(0, miles - pricingSettings.includedMiles);
    let subtotal = base + (extraMiles * pricingSettings.extraPerMile);
    if (isNight === "true") subtotal *= pricingSettings.nightMultiplier;
    res.json({ success: true, pricing: { miles: Number(miles.toFixed(2)), total: Math.max(subtotal, pricingSettings.minimumFare) } });
  } catch (e) { res.status(500).json({ success: false }); }
});

// Kayıt ve Durum Sorgulama
app.post("/bookings", (req, res) => {
  const booking = { id: crypto.randomUUID(), ...req.body, status: "pending", createdAt: new Date().toISOString() };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});
app.get("/bookings", (req, res) => res.json({ success: true, bookings }));
app.get("/booking-status/:id", (req, res) => {
    const b = bookings.find(x => x.id === req.params.id);
    res.json(b ? { success: true, status: b.status, total: b.total } : { success: false });
});

// KRİTİK: Admin Butonlarının Çalışmasını Sağlayan Yol
app.post("/update-booking", (req, res) => {
    const { id, status } = req.body;
    const idx = bookings.findIndex(b => b.id === id);
    if (idx !== -1) { bookings[idx].status = status; return res.json({ success: true }); }
    res.status(404).json({ success: false });
});

app.listen(PORT, () => console.log("JK2424 Active"));
