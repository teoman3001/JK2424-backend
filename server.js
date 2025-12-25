const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); app.use(express.json());

let pricingSettings = { baseFare: 65, includedMiles: 10, extraPerMile: 2, nightMultiplier: 1.25, minimumFare: 65 };
let bookings = [];

// Rezervasyon Kaydı
app.post("/bookings", (req, res) => {
  const booking = { id: crypto.randomUUID(), ...req.body, status: "pending", createdAt: new Date().toISOString() };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

app.get("/bookings", (req, res) => res.json({ success: true, bookings }));

// Statü Güncelleme (Bağımsız Komut)
app.post("/update-booking", (req, res) => {
    const { id, status } = req.body;
    const idx = bookings.findIndex(b => b.id === id);
    if (idx !== -1) { bookings[idx].status = status; return res.json({ success: true }); }
    res.status(404).json({ success: false });
});

// Durum Sorgulama
app.get("/booking-status/:id", (req, res) => {
    const b = bookings.find(x => x.id === req.params.id);
    res.json(b ? { success: true, status: b.status, total: b.total } : { success: false });
});

app.listen(PORT, () => console.log("JK2424 Engine Active"));
