const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// TEST ENDPOINT
app.get("/", (req, res) => {
  res.send("JK2424 Backend is running");
});

// PRICE CALCULATION ENDPOINT
app.get("/calc", (req, res) => {
  const { pickup, stop, dropoff } = req.query;

  if (!pickup || !dropoff) {
    return res.json({
      success: false,
      error: "Missing pickup or dropoff"
    });
  }

  // ŞİMDİLİK DUMMY DATA (test için)
  const miles = 25;
  const price = 95;

  res.json({
    success: true,
    miles,
    price
  });
});

// ✅ NEW: BOOKING ENDPOINT
app.post("/bookings", (req, res) => {
  const {
    pickup,
    stop,
    dropoff,
    rideDate,
    rideTime,
    ampm,
    miles,
    total,
    customerName,
    customerPhone,
    customerEmail,
    notes
  } = req.body;

  // Basit validation
  if (!pickup || !dropoff || !customerName || !customerPhone || !customerEmail) {
    return res.status(400).json({
      success: false,
      message: "Missing required booking fields"
    });
  }

  // ŞİMDİLİK sadece logluyoruz (bir sonraki adım DB)
  const booking = {
    pickup,
    stop,
    dropoff,
    rideDate,
    rideTime,
    ampm,
    miles,
    total,
    customerName,
    customerPhone,
    customerEmail,
    notes,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  console.log("📥 New booking received:", booking);

  res.status(201).json({
    success: true,
    message: "Booking received",
    booking
  });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
