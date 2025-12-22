const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// Render otomatik PORT verir
const PORT = process.env.PORT || 3000;

// Google API Key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error("ERROR: GOOGLE_MAPS_API_KEY environment variable is missing!");
}

// PRICE CALCULATION
app.get("/api/calc-price", async (req, res) => {
  try {
    const { pickup, extra_stop, dropoff } = req.query;

    if (!pickup || !dropoff) {
      return res.status(400).json({
        error: "pickup and dropoff fields are required",
      });
    }

    const waypoints = extra_stop
      ? `&waypoints=${encodeURIComponent(extra_stop)}`
      : "";

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      pickup
    )}&destination=${encodeURIComponent(
      dropoff
    )}${waypoints}&key=${GOOGLE_MAPS_API_KEY}`;

    const response = await axios.get(url);
    const data = response.data;

    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: "No route found" });
    }

    const leg = data.routes[0].legs.reduce(
      (acc, l) => {
        acc.distance += l.distance.value;
        acc.duration += l.duration.value;
        return acc;
      },
      { distance: 0, duration: 0 }
    );

    const km = leg.distance / 1000;
    const price = 25 + km * 2.1;

    res.json({
      distance_km: km.toFixed(2),
      duration_min: Math.round(leg.duration / 60),
      price: price.toFixed(2),
    });
  } catch (error) {
    console.error("PRICE CALC ERROR:", error.response?.data || error);
    res.status(500).json({
      error: "Price calculation failed",
    });
  }
});

// BOOKING STEP 2
app.post("/api/bookings2", (req, res) => {
  try {
    const booking = req.body;
    console.log("NEW BOOKING:", booking);

    res.json({
      success: true,
      message: "Booking received",
      data: booking,
    });
  } catch (error) {
    console.error("BOOKING ERROR:", error);
    res.status(500).json({ error: "Booking creation failed" });
  }
});

// ROOT HEALTH CHECK
app.get("/", (req, res) => {
  res.send("JK2424 Backend API is running...");
});

app.listen(PORT, () => {
  console.log(`JK2424 backend running on port ${PORT}`);
});
