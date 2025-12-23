const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================================================
// 1. PRICING CONFIG (Merkezi Fiyatlandırma Kuralları)
// ===================================================
let pricingConfig = {
  baseFare: 65,
  includedMiles: 10,      // 10 mile kadar base fare geçerli
  extraPerMile: 2,        // 10 mildan sonrası için mil başı ücret
  nightMultiplier: 1.25,  // Gece çarpanı (22:00 - 05:00)
  minimumFare: 65
};

// ===================================================
// VERİ DEPOLAMA (In-memory - Sunucu her kapandığında sıfırlanır)
// ===================================================
let customers = []; 
let bookings = [];

// ===================================================
// YARDIMCI FONKSİYONLAR
// ===================================================
function normalizePhone(phone) {
  return phone.replace(/\D/g, ""); 
}

// ===================================================
// ANA SAYFA (Health Check)
// ===================================================
app.get("/", (req, res) => {
  res.send("JK2424 Backend is running (Google Maps Integrated)");
});

// ===================================================
// 2. FİYAT HESAPLAMA (Google Distance Matrix Entegrasyonu)
// ===================================================
app.get("/calc", async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;

    if (!pickup || !dropoff) {
      return res.json({ success: false, error: "Missing pickup or dropoff" });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Missing GOOGLE_MAPS_API_KEY on server" });
    }

    // Google Distance Matrix API'den mil bilgisini çeken fonksiyon
    async function getMiles(origin, destination) {
      const url =
        "https://maps.googleapis.com/maps/api/distancematrix/json" +
        "?origins=" + encodeURIComponent(origin) +
        "&destinations=" + encodeURIComponent(destination) +
        "&units=imperial" +
        "&key=" + encodeURIComponent(apiKey);

      const r = await fetch(url);
      const j = await r.json();

      if (j.status !== "OK") throw new Error("DistanceMatrix status not OK: " + j.status);

      const el = j.rows?.[0]?.elements?.[0];
      if (!el || el.status !== "OK") throw new Error("No route found between addresses");

      // Metre olarak alıp mile çeviriyoruz (Daha hassas hesaplama için)
      const meters = el.distance?.value;
      if (!meters) throw new Error("Missing distance value");
      return meters / 1609.344;
    }

    let miles = 0;

    // Eğer stop (ara durak) varsa: (Pickup -> Stop) + (Stop -> Dropoff)
    if (stop && stop.trim().length > 0) {
      const m1 = await getMiles(pickup, stop);
      const m2 = await getMiles(stop, dropoff);
      miles = m1 + m2;
    } else {
      miles = await getMiles(pickup, dropoff);
    }

    // Sonucu döndür: Gerçek mil ve fiyatlandırma kuralları
    res.json({
      success: true,
      miles: Number(miles.toFixed(2)),
      pricing: pricingConfig
    });

  } catch (e) {
    console.error("Calc Error:", e.message);
    res.status(500).json({ success: false, error: e.message || "Calculation failed" });
  }
});

// ===================================================
// 3. REZERVASYON OLUŞTURMA (POST /bookings)
// ===================================================
app.post("/bookings", (req, res) => {
  const {
    pickup, stop, dropoff, rideDate, rideTime, ampm,
    miles, total, customerName, customerPhone, customerEmail, notes
  } = req.body;

  if (!pickup || !dropoff || !customerName || !customerPhone) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const phoneKey = normalizePhone(customerPhone);
  let customer = customers.find(c => c.phone === phoneKey);
  
  if (!customer) {
    customer = {
      id: crypto.randomUUID(),
      name: customerName,
      phone: phoneKey,
      email: customerEmail || "",
      createdAt: new Date().toISOString()
    };
    customers.push(customer);
  }

  const booking = {
    id: crypto.randomUUID(),
    customerId: customer.id,
    pickup, stop, dropoff, rideDate, rideTime, ampm, miles, total,
    notes: notes || "",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: null
  };

  bookings.unshift(booking);
  console.log("📥 New booking created:", booking.id);

  res.status(201).json({
    success: true,
    booking: {
      id: booking.id,
      status: booking.status,
      pickup: booking.pickup,
      dropoff: booking.dropoff,
      rideDate: booking.rideDate,
      rideTime: booking.rideTime,
      ampm: booking.ampm,
      total: booking.total
    }
  });
});

// ===================================================
// 4. TEKİL REZERVASYON SORGULAMA (track.html için)
// ===================================================
app.get("/bookings/:id", (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }
  const customer = customers.find(c => c.id === booking.customerId) || {};
  res.json({
    success: true,
    booking: { ...booking, customerName: customer.name, customerPhone: customer.phone }
  });
});

// ===================================================
// 5. LİSTELEME VE STATUS GÜNCELLEME
// ===================================================
app.get("/bookings", (req, res) => {
  const enriched = bookings.map(b => {
    const c = customers.find(x => x.id === b.customerId) || {};
    return { ...b, customerName: c.name, customerPhone: c.phone };
  });
  res.json({ success: true, bookings: enriched });
});

app.patch("/bookings/:id/status", (req, res) => {
  const { status } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx !== -1) {
    bookings[idx].status = status;
    bookings[idx].updatedAt = new Date().toISOString();
    return res.json({ success: true, booking: bookings[idx] });
  }
  res.status(404).json({ success: false, message: "Not found" });
});

app.listen(PORT, () => {
  console.log("🚀 JK2424 Server running on port", PORT);
});
