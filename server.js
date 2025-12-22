const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================================================
// FAZ 1 — In-memory store (ileride DB’ye taşınacak)
// ===================================================
let bookings = [];

// ===================================================
// HEALTH CHECK
// ===================================================
app.get("/", (req, res) => {
  res.send("JK2424 Backend is running");
});

// ===================================================
// PRICE CALCULATION (dummy – FAZ 1)
// ===================================================
app.get("/calc", (req, res) => {
  const { pickup, stop, dropoff } = req.query;

  if (!pickup || !dropoff) {
    return res.json({
      success: false,
      error: "Missing pickup or dropoff"
    });
  }

  res.json({
    success: true,
    miles: 25,
    price: 95
  });
});

// ===================================================
// CREATE BOOKING (Customer)
// ===================================================
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

  if (!pickup || !dropoff || !customerName || !customerPhone || !customerEmail) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  const booking = {
    id: crypto.randomUUID(),

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
    notes: notes || "",

    status: "pending",

    createdAt: new Date().toISOString(),
    updatedAt: null
  };

  bookings.unshift(booking);

  console.log("📥 New booking created:", booking.id);

  res.status(201).json({
    success: true,
    booking
  });
});

// ===================================================
// LIST BOOKINGS (Admin)
// ===================================================
app.get("/bookings", (req, res) => {
  res.json({
    success: true,
    bookings
  });
});

// ===================================================
// GET SINGLE BOOKING (ileride mobil deep-link için)
// ===================================================
app.get("/bookings/:id", (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found"
    });
  }

  res.json({
    success: true,
    booking
  });
});

// ===================================================
// UPDATE STATUS (Admin → trigger notifications later)
// ===================================================
app.patch("/bookings/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = [
    "pending",
    "confirmed",
    "paid",
    "on_the_way",
    "arrived",
    "in_progress",
    "completed"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status"
    });
  }

  const index = bookings.findIndex(b => b.id === id);

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Booking not found"
    });
  }

  bookings[index].status = status;
  bookings[index].updatedAt = new Date().toISOString();

  console.log("🔁 Status updated:", id, "→", status);

  // ⏭️ FAZ 2:
  // burada push notification, SMS, live tracking tetiklenecek

  res.json({
    success: true,
    booking: bookings[index]
  });
});

// ===================================================
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
