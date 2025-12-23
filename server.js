const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================================================
// FAZ 2.2 — In-memory stores (ileride DB)
// ===================================================
let customers = []; 
let bookings = [];

// ===================================================
// HELPERS
// ===================================================
function normalizePhone(phone) {
  return phone.replace(/\D/g, ""); 
}

// ===================================================
// HEALTH CHECK
// ===================================================
app.get("/", (req, res) => {
  res.send("JK2424 Backend is running");
});

// ===================================================
// PRICE CALCULATION (dummy)
// ===================================================
app.get("/calc", (req, res) => {
  const { pickup, dropoff } = req.query;

  if (!pickup || !dropoff) {
    return res.json({ success: false, error: "Missing pickup or dropoff" });
  }

  res.json({
    success: true,
    miles: 25,
    price: 95
  });
});

// ===================================================
// CREATE BOOKING + AUTO CUSTOMER
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

  if (!pickup || !dropoff || !customerName || !customerPhone) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields"
    });
  }

  const phoneKey = normalizePhone(customerPhone);

  // FIND OR CREATE CUSTOMER
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

  // CREATE BOOKING
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

  // ✅ KRİTİK DÜZELTME: Frontend'in (index.html) "data.booking.id" olarak 
  // okuyabilmesi için response formatı güncellendi.
  res.status(201).json({
    success: true,
    booking: {
      id: booking.id,
      status: booking.status
    }
  });
});

// ===================================================
// LIST BOOKINGS (Admin)
// ===================================================
app.get("/bookings", (req, res) => {
  const enriched = bookings.map(b => {
    const c = customers.find(x => x.id === b.customerId) || {};
    return {
      ...b,
      customerName: c.name,
      customerPhone: c.phone,
      customerEmail: c.email
    };
  });

  res.json({
    success: true,
    bookings: enriched
  });
});

// ===================================================
// GET SINGLE BOOKING (Customer tracking)
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
// UPDATE STATUS (Admin)
// ===================================================
app.patch("/bookings/:id/status", (req, res) => {
  const { status } = req.body;
  const allowed = ["pending", "confirmed", "paid", "on_the_way", "arrived", "in_progress", "completed"];

  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }

  bookings[idx].status = status;
  bookings[idx].updatedAt = new Date().toISOString();

  console.log("🔁 Status updated:", bookings[idx].id, "→", status);

  res.json({
    success: true,
    booking: bookings[idx]
  });
});

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
