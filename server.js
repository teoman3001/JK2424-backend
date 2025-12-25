const express = require("express");

const cors = require("cors");

const crypto = require("crypto");



const app = express();

const PORT = process.env.PORT || 3000;



app.use(cors());

app.use(express.json());



let pricingSettings = { 

    baseFare: 65, 

    includedMiles: 10, 

    extraPerMile: 2, 

    nightMultiplier: 1.25, 

    minimumFare: 65 

};



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

  

  return { 

    miles: Number(miles.toFixed(2)), 

    nightApplied: isNight, 

    nightMultiplier: pricingSettings.nightMultiplier, 

    extraMiles: Number(extraMiles.toFixed(2)),

    extraCost: Number(extraCost.toFixed(2)),

    total: Number(total.toFixed(2)) 

  };

}



function createSystemMessage(status) {

    const titles = {

        confirmed: "Reservation Confirmed",

        payment_sent: "Payment Verification",

        paid: "Payment Successful",

        on_the_way: "Chauffeur En Route",

        arrived: "Chauffeur Arrived",

        in_progress: "Trip Started",

        completed: "Trip Completed",

        cancelled: "Reservation Cancelled"

    };



    const bodies = {

        confirmed: "Your reservation is confirmed. Please complete the secure checkout to finalize your booking.",

        payment_sent: "We have received your transfer notification. Our operations team is verifying the transaction.",

        paid: "Thank you. Payment verified. Your chauffeur will be assigned shortly.",

        on_the_way: "Your chauffeur is on the way to the pickup location.",

        arrived: "Your vehicle has arrived at the pickup point.",

        in_progress: "Enjoy your premium ride with JK2424.",

        completed: "Thank you for choosing JK2424. We hope to serve you again.",

        cancelled: "Your reservation has been cancelled."

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



app.get("/pricing", (req, res) => res.json({ success: true, pricingSettings }));

app.post("/pricing", (req, res) => {

    Object.assign(pricingSettings, req.body);

    res.json({ success: true, message: "Settings saved" });

});



app.post("/bookings", (req, res) => {

  const existingPending = bookings.find(b => b.customerPhone === req.body.customerPhone && b.status === 'pending');

  if (existingPending) {

      return res.status(409).json({ success: false, message: "You have a pending request." });

  }



  const now = new Date().toISOString();

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



app.get("/bookings", (req, res) => res.json({ success: true, bookings }));

app.get("/bookings/:id", (req, res) => res.json({ success: true, booking: bookings.find(x => x.id === req.params.id) }));



app.get("/bookings/customer/:phone", (req, res) => {

    const phone = req.params.phone;

    const customerBookings = bookings.filter(b => b.customerPhone === phone);

    res.json({ success: true, bookings: customerBookings });

});



app.patch("/bookings/:id/status", (req, res) => {

  const { status: newStatus } = req.body;

  const idx = bookings.findIndex(b => b.id === req.params.id);

  

  if (idx === -1) return res.status(404).json({ success: false });

  

  const b = bookings[idx];

  b.status = newStatus;

  if(b.statusHistory) b.statusHistory[newStatus] = new Date().toISOString();



  const sysMsg = createSystemMessage(newStatus);

  if(sysMsg) {

      if(!b.messages) b.messages = [];

      b.messages.unshift(sysMsg);

  }

  

  res.json({ success: true, booking: b });

});



app.patch("/bookings/:id/messages/read", (req, res) => {

    const { messageId } = req.body;

    const booking = bookings.find(b => b.id === req.params.id);

    if(booking && booking.messages) {

        const msg = booking.messages.find(m => m.id === messageId);

        if(msg) msg.read = true;

    }

    res.json({ success: true });

});



app.listen(PORT, () => console.log("JK2424 Engine v4.0 Final Night"));
