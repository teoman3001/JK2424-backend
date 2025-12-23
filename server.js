const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================================================
// VERİ DEPOLAMA (In-memory)
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
  res.send("JK2424 Backend is running");
});

// ===================================================
// FİYAT HESAPLAMA (Geçici Sabit Değerler)
// ===================================================
app.get("/calc", (req, res) => {
  const { pickup, dropoff } = req.query;

  if (!pickup || !dropoff) {
    return res.json({ success: false, error: "Missing pickup or dropoff" });
  }

  // Şu an için sabit değer dönüyor, Google Maps entegrasyonu buraya yapılacak
  res.json({
    success: true,
    miles: 25,
    pricing: {
        baseFare: 65,
        includedMiles: 15,
        extraPerMile: 2,
        nightMultiplier: 1.25,
        minimumFare: 65
    }
  });
});

// ===================================================
// REZERVASYON OLUŞTURMA (POST /bookings)
// ===================================================
app.post("/bookings", (req, res) => {
  const {
    pickup, stop, dropoff, rideDate, rideTime, ampm,
    miles, total, customerName, customerPhone, customerEmail, notes
  } = req.body;

  if (!pickup || !dropoff || !customerName || !customerPhone) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  const phoneKey = normalizePhone(customerPhone);

  // MÜŞTERİ KAYDI VEYA BULMA
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

  // REZERVASYON KAYDI
  const booking = {
    id: crypto.randomUUID(),
    customerId: customer.id,
    pickup,
    stop,
    dropoff,
    rideDate,
    rideTime,
    ampm,
    miles,
    total,
    notes: notes || "",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: null
  };

  bookings.unshift(booking);

  console.log("📥 New booking created:", booking.id);

  // ✅ ADIM 2.1 GÜNCELLEMESİ: Frontend (index.html) için birebir uyumlu response
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
// TEKİL REZERVASYON SORGULAMA (track.html için)
// ===================================================
app.get("/bookings/:id", (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found"
    });
  }

  const customer = customers.find(c => c.id === booking.customerId) || {};

  res.json({
    success: true,
    booking: {
      ...booking,
      customerName: customer.name,
      customerPhone: customer.phone
    }
  });
});

// ===================================================
// LİSTELEME VE DURUM GÜNCELLEME (Admin için)
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
