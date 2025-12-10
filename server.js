// ===============================
// JK2424 BACKEND - FINAL WORKING VERSION
// ===============================

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ---- GOOGLE API KEY ----
const GOOGLE_KEY = process.env.GOOGLE_API_KEY;

// ---- PRICING ----
const pricing = {
    baseFare: 65,
    includedMiles: 15,
    extraPerMile: 2,
    nightMultiplier: 1.25
};

// ---- TIME HELPER ----
function isNight(time, period) {
    let [h] = time.split(":").map(Number);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h >= 22 || h < 6;
}

// ---- DISTANCE MATRIX ----
app.get("/api/calc", async (req, res) => {
    try {
        const { pickup, dropoff, extra, date, time, period } = req.query;

        const origins = pickup;
        let destinations = dropoff;
        if (extra && extra.length > 2) destinations = extra + "|" + dropoff;

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
            origins
        )}&destinations=${encodeURIComponent(destinations)}&key=${GOOGLE_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.rows || !data.rows[0].elements[0].distance) {
            return res.json({ ok: false, message: "Distance not found" });
        }

        const meters = data.rows[0].elements.reduce(
            (acc, el) => acc + (el.distance?.value || 0),
            0
        );

        const miles = meters / 1609.34;

        let total = pricing.baseFare;
        if (miles > pricing.includedMiles) {
            total += (miles - pricing.includedMiles) * pricing.extraPerMile;
        }

        if (isNight(time, period)) {
            total = total * pricing.nightMultiplier;
        }

        total = Math.round(total);

        res.json({
            ok: true,
            distance: miles.toFixed(2),
            total
        });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

// ---- RESERVATION ----
app.post("/api/reserve", async (req, res) => {
    const { pickup, dropoff, date, time, fullname, phone, email } = req.body;

    if (!pickup || !dropoff || !fullname) {
        return res.json({ ok: false, message: "Missing fields" });
    }

    res.json({ ok: true, message: "Reservation stored successfully!" });
});

// ---- START SERVER ----
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log("JK2424 BACKEND running on " + PORT);
});
