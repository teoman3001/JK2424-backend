const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- AYARLAR ---
let pricingSettings = { 
    baseFare: 65, 
    includedMiles: 10, 
    extraPerMile: 2, 
    nightMultiplier: 1.25, 
    minimumFare: 65 
};

let bookings = [];

// --- YARDIMCI FONKSİYONLAR ---
function calculatePrice(miles, isNight) {
  const base = pricingSettings.baseFare;
  const included = pricingSettings.includedMiles;
  const extraRate = pricingSettings.extraPerMile;
  let extraMiles = Math.max(0, miles - included);
  let extraCost = extraMiles * extraRate;
  let subtotal = base + extraCost;
  
  if (isNight) {
      subtotal = subtotal * pricingSettings.nightMultiplier;
  }
  
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

// Otomatik Mesaj Oluşturucu
function createSystemMessage(status) {
    const titles = {
        confirmed: "Reservation Confirmed",
        payment_sent: "Payment Verification",
        paid: "Payment Successful",
        on_the_way: "Chauffeur on the Way",
        arrived: "Chauffeur Arrived",
        in_progress: "Ride in Progress",
        completed: "Ride Completed",
        cancelled: "Reservation Cancelled"
    };

    const bodies = {
        confirmed: "Your booking has been confirmed by our operations team. Please proceed to payment to finalize your reservation.",
        payment_sent: "We have received your Zelle notification. Please wait while we verify the transfer.",
        paid: "Thank you! Your payment has been received and your ride is fully secured.",
        on_the_way: "Your chauffeur is en route to the pickup location.",
        arrived: "Your vehicle has arrived. Please meet your chauffeur.",
        in_progress: "Enjoy your premium ride with JK2424.",
        completed: "Thank you for riding with JK2424. We hope to see you again.",
        cancelled: "Your reservation has been cancelled. If this was a mistake, please contact us."
    };

    if (!titles[status]) return null;

    return {
        id: crypto.randomUUID(),
        title: titles[status],
        body: bodies[status],
        date: new Date().toISOString(),
        read: false
    };
}

// --- ROTALAR ---

// 1. Hesaplama
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

    res.json({ success: true, pricing: calculatePrice(miles, isNight === "true") });
  } catch (e) { res.status(500).json({ success: false }); }
});

// 2. Fiyat Ayarları
app.get("/pricing", (req, res) => res.json({ success: true, pricingSettings }));
app.post("/pricing", (req, res) => {
    Object.assign(pricingSettings, req.body); // Pratik güncelleme
    res.json({ success: true, message: "Settings saved" });
});

// 3. Rezervasyon Oluşturma
app.post("/bookings", (req, res) => {
  // Çifte Rezervasyon Kontrolü
  const existingPending = bookings.find(b => b.customerPhone === req.body.customerPhone && b.status === 'pending');
  if (existingPending) {
      return res.status(409).json({ success: false, message: "You already have a pending request." });
  }

  const now = new Date().toISOString();
  // İlk mesaj: Talep alındı
  const initialMsg = {
      id: crypto.randomUUID(),
      title: "Request Received",
      body: "We have received your request. Availability is being checked.",
      date: now,
      read: false
  };

  const booking = {
    id: crypto.randomUUID(),
    ...req.body,
    status: "pending",
    messages: [initialMsg], 
    statusHistory: { pending: now },
    createdAt: now
  };
  bookings.unshift(booking);
  res.status(201).json({ success: true, booking });
});

// 4. Booking Listeleme
app.get("/bookings", (req, res) => res.json({ success: true, bookings }));
app.get("/bookings/:id", (req, res) => res.json({ success: true, booking: bookings.find(x => x.id === req.params.id) }));

app.get("/bookings/customer/:phone", (req, res) => {
    const phone = req.params.phone;
    const customerBookings = bookings.filter(b => b.customerPhone === phone);
    res.json({ success: true, bookings: customerBookings });
});

// 5. Statü Güncelleme & Mesaj Tetikleme
app.patch("/bookings/:id/status", (req, res) => {
  const { status: newStatus } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);
  
  if (idx === -1) return res.status(404).json({ success: false });
  
  const b = bookings[idx];
  b.status = newStatus;
  if(b.statusHistory) b.statusHistory[newStatus] = new Date().toISOString();

  // Otomatik mesaj ekle
  const sysMsg = createSystemMessage(newStatus);
  if(sysMsg) {
      if(!b.messages) b.messages = [];
      b.messages.unshift(sysMsg);
  }
  
  res.json({ success: true, booking: b });
});

// 6. Mesajı Okundu İşaretle
app.patch("/bookings/:id/messages/read", (req, res) => {
    const { messageId } = req.body;
    const booking = bookings.find(b => b.id === req.params.id);
    if(booking && booking.messages) {
        const msg = booking.messages.find(m => m.id === messageId);
        if(msg) msg.read = true;
    }
    res.json({ success: true });
});

app.listen(PORT, () => console.log("JK2424 Premium Engine v3.0 Active"));
