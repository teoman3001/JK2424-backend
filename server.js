const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===== In-memory store (FAZ 1) =====
let bookings = [];

// TEST
app.get("/", (req, res) => {
  res.send("JK2424 Backend is running");
});

// PRICE CALCULATION
app.get("/calc", (req, res) => {
  const { pickup, stop, dropoff } = req.query;
  if (!pickup || !dropoff) {
    return res.json({ success: false, error: "Missing pickup or dropoff" });
  }
  // Dummy
  res.json({ success: true, miles: 25, price: 95 });
});

// CREATE BOOKING
app.post("/bookings", (req, res) => {
  const {
    pickup, stop, dropoff, rideDate, rideTime, ampm,
    miles, total, customerName, customerPhone, customerEmail, notes
  } = req.body;

  if (!pickup || !dropoff || !customerName || !customerPhone || !customerEmail) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const booking = {
    id: crypto.randomUUID(),
    pickup, stop, dropoff, rideDate, rideTime, ampm,
    miles, total, customerName, customerPhone, customerEmail, notes,
    status: "pending",
    createdAt: new Date().toISOString()
  };

  bookings.unshift(booking);
  console.log("📥 New booking:", booking.id);

  res.status(201).json({ success: true, booking });
});

// LIST BOOKINGS (Admin)
app.get("/bookings", (req, res) => {
  res.json({ success: true, bookings });
});

// UPDATE STATUS (Admin)
app.patch("/bookings/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const allowed = ["pending","confirmed","paid","on_the_way","arrived","in_progress","completed"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const idx = bookings.findIndex(b => b.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }

  bookings[idx].status = status;
  bookings[idx].updatedAt = new Date().toISOString();
  console.log("🔁 Status updated:", id, status);

  res.json({ success: true, booking: bookings[idx] });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
