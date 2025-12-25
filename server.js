const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let pricingSettings = { baseFare: 65, includedMiles: 10, extraPerMile: 2, nightMultiplier: 1.25, minimumFare: 65 };

// ✅ ZİNCİR KIRILDI: Artık katı akış kontrolü yok, dilediğin statüye dilediğin an geçebilirsin.
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

// FİYAT HESAPLAMA
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

// YENİ REZERVASYON OLUŞTURMA
app.post("/bookings", (req, res) => {
  const now = new Date().toISOString();
  const booking = {
    id: crypto.randomUUID(),
    ...req.body,
    status: "pending",
    createdAt: now
  };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

// REZERVASYONLARI LİSTELEME
app.get("/bookings", (req, res) => res.json({ success: true, bookings }));

// ✅ ZİNCİRİ KIRAN YENİ BAĞIMSIZ GÜNCELLEME YOLU (POST /update-booking)
// admin.html içindeki butonlar artık bu yolu kullanacak.
app.post("/update-booking", (req, res) => {
    const { id, status: newStatus } = req.body;
    const idx = bookings.findIndex(b => b.id === id);
    
    if (idx === -1) {
        return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Herhangi bir kurala takılmadan statüyü günceller
    bookings[idx].status = newStatus;
    console.log(`[JK2424] Booking ${id} updated to: ${newStatus}`);
    
    res.json({ success: true, booking: bookings[idx] });
});

// MÜŞTERİ PANELİ İÇİN ANLIK DURUM SORGULAMA
app.get("/booking-status/:id", (req, res) => {
    const booking = bookings.find(b => b.id === req.params.id);
    if (!booking) return res.status(404).json({ success: false });
    res.json({ 
        success: true, 
        status: booking.status, 
        total: booking.total 
    });
});

// ESKİ DROP-DOWN SİSTEMİ İÇİN PATCH DESTEĞİ (Hata vermemesi için kuralı gevşettik)
app.patch("/bookings/:id/status", (req, res) => {
  const { status: newStatus } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false });
  
  bookings[idx].status = newStatus;
  res.json({ success: true, booking: bookings[idx] });
});

app.listen(PORT, () => console.log(`JK2424 Engine Active on Port ${PORT}`));
