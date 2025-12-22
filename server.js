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

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
