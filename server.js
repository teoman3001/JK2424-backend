const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Varsayılan fiyat ayarları (Admin panelinden güncellenebilir)
let pricingSettings = { 
    baseFare: 65, 
    includedMiles: 10, 
    extraPerMile: 2, 
    nightMultiplier: 1.25, 
    minimumFare: 65 
};

let bookings = [];

// Fiyat Hesaplama Motoru
function calculatePrice(miles, isNight) {
  const base = pricingSettings.baseFare;
  const included = pricingSettings.includedMiles;
  const extraRate = pricingSettings.extraPerMile;
  
  let extraMiles = Math.max(0, miles - included);
  let extraCost = extraMiles * extraRate;
  
  let subtotal = base + extraCost;
  
  // Gece tarifesi varsa çarp
  if (isNight) {
      subtotal = subtotal * pricingSettings.nightMultiplier;
  }
  
  // Minimum tutar kontrolü
  const total = Math.max(subtotal, pricingSettings.minimumFare);
  
  return { 
    miles: Number(miles.toFixed(2)), 
    nightApplied: isNight, 
    nightMultiplier: pricingSettings.nightMultiplier, 
    extraMiles: Number(extraMiles.toFixed(2)),
    extraCost: Number(extraCost.toFixed(2)),
    total: Number(total.toFixed(2)) 
  };
}

// --- ROTALAR (ROUTES) ---

// 1. Fiyat Hesaplama (Frontend'den gelen isNight bilgisine göre)
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

    let miles = (stop && stop.trim().length > 0) 
        ? (await getMiles(pickup, stop)) + (await getMiles(stop, dropoff)) 
        : await getMiles(pickup, dropoff);

    // isNight string olarak "true" gelirse true kabul et
    res.json({ success: true, pricing: calculatePrice(miles, isNight === "true") });
  } catch (e) { 
      console.error(e);
      res.status(500).json({ success: false }); 
  }
});

// 2. Fiyat Ayarlarını Okuma (Admin Paneli İçin)
app.get("/pricing", (req, res) => {
    res.json({ success: true, pricingSettings });
});

// 3. Fiyat Ayarlarını Güncelleme (Admin Paneli İçin - EKSİKTİ EKLENDİ)
app.post("/pricing", (req, res) => {
    if(req.body.baseFare) pricingSettings.baseFare = Number(req.body.baseFare);
    if(req.body.includedMiles) pricingSettings.includedMiles = Number(req.body.includedMiles);
    if(req.body.extraPerMile) pricingSettings.extraPerMile = Number(req.body.extraPerMile);
    if(req.body.nightMultiplier) pricingSettings.nightMultiplier = Number(req.body.nightMultiplier);
    if(req.body.minimumFare) pricingSettings.minimumFare = Number(req.body.minimumFare);
    
    console.log("Pricing Updated:", pricingSettings);
    res.json({ success: true, message: "Settings saved" });
});

// 4. Rezervasyon Oluşturma
app.post("/bookings", (req, res) => {
  const now = new Date().toISOString();
  const booking = {
    id: crypto.randomUUID(),
    ...req.body,
    status: "pending",
    messages: [], 
    statusHistory: { 
        pending: now, confirmed: null, payment_sent: null, paid: null, 
        on_the_way: null, arrived: null, in_progress: null, completed: null, cancelled: null 
    },
    createdAt: now
  };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

// 5. Rezervasyonları Listeleme
app.get("/bookings", (req, res) => res.json({ success: true, bookings }));
app.get("/bookings/:id", (req, res) => res.json({ success: true, booking: bookings.find(x => x.id === req.params.id) }));

// 6. Statü Güncelleme (ZİNCİR KALDIRILDI - SERBEST SEÇİM)
app.patch("/bookings/:id/status", (req, res) => {
  const { status: newStatus } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);
  
  if (idx === -1) return res.status(404).json({ success: false });
  
  // Eski kısıtlama kaldırıldı. Her statüye geçiş serbest.
  bookings[idx].status = newStatus;
  
  // Tarihçeye işle
  if(bookings[idx].statusHistory) {
      bookings[idx].statusHistory[newStatus] = new Date().toISOString();
  }
  
  res.json({ success: true, booking: bookings[idx] });
});

app.listen(PORT, () => console.log("JK2424 Engine Active"));
