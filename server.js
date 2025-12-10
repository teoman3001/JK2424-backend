const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===============================
// PRICE SETTINGS (EDITABLE)
// ===============================
const BASE_RATE = 3.5;    // Price per mile
const MIN_FARE = 25;      // Minimum charge

// GOOGLE API KEY (Backend için)
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY;

// ===============================
// DISTANCE CALCULATOR
// ===============================
async function calculateDistance(pickup, dropoff, extra) {
    let url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${encodeURIComponent(
        pickup
    )}&destinations=${encodeURIComponent(dropoff)}&key=${GOOGLE_KEY}`;

    if (extra && extra.trim() !== "") {
        url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${encodeURIComponent(
            pickup
        )}&destinations=${encodeURIComponent(extra)}|${encodeURIComponent(
            dropoff
        )}&key=${GOOGLE_KEY}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (!data.rows || !data.rows[0].elements) return null;

    let totalMiles = 0;
    data.rows[0].elements.forEach((el) => {
        if (el.distance) {
            totalMiles += el.distance.value / 1609.34; // meters → miles
        }
    });

    return totalMiles;
}

// ===============================
// /api/calc → PRICE CALCULATION
// ===============================
app.get("/api/calc", async (req, res) => {
    try {
        const { pickup, dropoff, extra } = req.query;

        if (!pickup || !dropoff)
            return res.status(400).json({ error: "Missing locations" });

        const miles = await calculateDistance(pickup, dropoff, extra);

        if (!miles)
            return res.status(500).json({ error: "Distance failed" });

        const total = Math.max(MIN_FARE, miles * BASE_RATE);

        res.json({
            distance: miles.toFixed(2) + " miles",
            total: total.toFixed(2),
        });
    } catch (err) {
        console.log("CALC ERROR:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ===============================
// /api/reserve → SAVE RESERVATION
// ===============================
app.post("/api/reserve", (req, res) => {
    const reservation = req.body;
    console.log("New reservation:", reservation);

    res.json({ message: "Reservation successful" });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("JK2424 Backend running on port " + PORT);
});
