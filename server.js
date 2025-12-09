// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- DB BAĞLANTISI ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres her zaman SSL istiyor
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(cors());
app.use(express.json());

// ---------- SSE (REAL-TIME) ALT YAPISI ----------
const sseClients = new Set();

/**
 * Tüm bağlı SSE client'larına event gönderir.
 * eventName: "booking_created", "status_updated", "notification" vs.
 * payload: JS objesi
 */
function pushEvent(eventName, payload) {
  const data = JSON.stringify(payload || {});
  for (const res of sseClients) {
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('Error pushing SSE event:', err.message);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  res.write('event: connected\n');
  res.write('data: {}\n\n');

  sseClients.add(res);
  console.log('SSE client connected. Total:', sseClients.size);

  req.on('close', () => {
    sseClients.delete(res);
    console.log('SSE client disconnected. Total:', sseClients.size);
  });
});

// ---------- YARDIMCI FONKSİYONLAR (NOTIFICATION METİNLERİ) ----------
function buildNotificationsForStatus(booking, newStatus) {
  const pickup = booking.pickup_address;
  const dropoff = booking.dropoff_address;
  const when = booking.pickup_datetime;

  const baseInfo =
    `Pickup: ${pickup}\n` +
    `Drop-off: ${dropoff}\n` +
    `Pickup time: ${when}\n`;

  const notifications = [];

  switch (newStatus) {
    case 'confirmed':
      notifications.push({
        to: 'customer',
        title: 'Your JK2424 trip is confirmed',
        body:
          `Dear ${booking.passenger_name}, your ride is confirmed.\n` +
          baseInfo +
          `Please complete your payment to finalize your booking.`
      });
      notifications.push({
        to: 'driver',
        title: 'New confirmed booking',
        body: `New confirmed trip assigned.\n` + baseInfo
      });
      break;

    case 'paid':
      notifications.push({
        to: 'customer',
        title: 'Payment received',
        body:
          `Thank you. Your payment has been received.\n` +
          `Your driver will be assigned and you will be notified when they are on the way.`
      });
      notifications.push({
        to: 'driver',
        title: 'New paid trip',
        body:
          `Trip is fully paid.\n` +
          baseInfo
      });
      break;

    case 'on_the_way':
      notifications.push({
        to: 'customer',
        title: 'Your driver is on the way',
        body:
          `Your driver is on the way to pickup.\n` +
          baseInfo +
          `We will share live ETA information shortly.`
      });
      notifications.push({
        to: 'driver',
        title: 'Navigate to pickup',
        body:
          `Drive to pickup location. Navigation started.\n` +
          baseInfo
      });
      break;

    case 'arrived':
      notifications.push({
        to: 'customer',
        title: 'Your car has arrived',
        body:
          `Your JK2424 car is at the pickup location and waiting for you.\n` +
          baseInfo
      });
      notifications.push({
        to: 'driver',
        title: 'Waiting for passenger',
        body:
          `You have arrived at pickup location.\n` +
          baseInfo
      });
      break;

    case 'in_progress':
      notifications.push({
        to: 'customer',
        title: 'Your trip is in progress',
        body:
          `Your ride has started. Enjoy your trip with JK2424.\n` +
          baseInfo
      });
      notifications.push({
        to: 'driver',
        title: 'Trip in progress',
        body:
          `Trip is in progress. Drive safely.\n` +
          baseInfo
      });
      break;

    case 'completed':
      notifications.push({
        to: 'customer',
        title: 'Trip completed',
        body:
          `Thank you for riding with JK2424.\n` +
          `We would appreciate your feedback and an optional tip.`
      });
      notifications.push({
        to: 'driver',
        title: 'Trip completed',
        body:
          `Trip is completed.\n` +
          baseInfo
      });
      break;

    default:
      break;
  }

  return notifications;
}

function logAndBroadcastNotifications(booking, newStatus) {
  const notifications = buildNotificationsForStatus(booking, newStatus);
  if (!notifications.length) return;

  notifications.forEach((n) => {
    console.log('\n================ JK2424 NOTIFICATION =================');
    console.log(n.to === 'driver' ? '[TO DRIVER]' : '[TO CUSTOMER]');
    console.log('Title:', n.title);
    console.log('Body:\n' + n.body);
    console.log('=====================================================\n');

    pushEvent('notification', {
      to: n.to,
      bookingId: booking.id,
      title: n.title,
      body: n.body,
      status: newStatus
    });
  });
}

// ---------- HEALTH CHECK ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'JK2424 backend with SSE is running.' });
});

// ---------- BOOKING LİSTESİ (ADMIN + GENEL) ----------
async function loadBookingsHandler(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bookings ORDER BY created_at DESC'
    );
    res.json({ ok: true, bookings: rows });
  } catch (err) {
    console.error('Error loading bookings:', err);
    res.status(500).json({ ok: false, error: 'DB error loading bookings' });
  }
}

// Admin için
app.get('/api/admin/bookings', loadBookingsHandler);
// Genel liste için
app.get('/api/bookings', loadBookingsHandler);

// ---------- YENİ REZERVASYON OLUŞTURMA ----------
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      passenger_name,
      pickup_address,
      dropoff_address,
      pickup_datetime,
      passengers,
      vehicle_type,
      estimated_price,
      notes
    } = req.body;

    if (!passenger_name || !pickup_address || !dropoff_address || !pickup_datetime) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields'
      });
    }

    const insertQuery = `
      INSERT INTO bookings
      (passenger_name, pickup_address, dropoff_address,
       pickup_datetime, passengers, vehicle_type,
       estimated_price, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *;
    `;

    const values = [
      passenger_name,
      pickup_address,
      dropoff_address,
      pickup_datetime,
      passengers || 1,
      vehicle_type || 'Mercedes EQS',
      estimated_price || null,
      notes || null
    ];

    const { rows } = await pool.query(insertQuery, values);
    const booking = rows[0];

    console.log('New booking created:', booking);

    // SSE: yeni booking event'i
    pushEvent('booking_created', booking);

    res.json({ ok: true, booking });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ ok: false, error: 'DB error creating booking' });
  }
});

// ---------- STATUS GÜNCELLEME (ADMIN + GENEL) ----------
async function updateStatusHandler(req, res) {
  const bookingId = req.params.id;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ ok: false, error: 'Missing status field' });
  }

  try {
    const updateQuery = `
      UPDATE bookings
      SET status = $2
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(updateQuery, [bookingId, status]);
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Booking not found' });
    }

    const booking = rows[0];
    console.log(`Status updated in DB: { id: '${booking.id}', status: '${booking.status}' }`);

    // SSE: status değişti
    pushEvent('status_updated', {
      id: booking.id,
      status: booking.status
    });

    // Konsol + SSE notification metinleri
    logAndBroadcastNotifications(booking, booking.status);

    res.json({ ok: true, booking });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ ok: false, error: 'DB error updating status' });
  }
}

// Admin panel eski yolu:
app.patch('/api/admin/bookings/:id/status', updateStatusHandler);
// Genel API:
app.post('/api/bookings/:id/status', updateStatusHandler);

// ---------- FİYAT HESAPLAMA (GOOGLE DIRECTIONS + MILES) ----------
app.get('/api/calc-price', async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;

    if (!pickup || !dropoff) {
      return res.status(400).json({
        ok: false,
        error: 'pickup and dropoff are required'
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    let miles = 0;

    if (apiKey) {
      let url =
        'https://maps.googleapis.com/maps/api/directions/json?origin=' +
        encodeURIComponent(pickup) +
        '&destination=' +
        encodeURIComponent(dropoff);

      if (stop) {
        url += '&waypoints=' + encodeURIComponent(stop);
      }

      url += '&key=' + apiKey;

      // Node 18+ içinde global fetch var, ekstra paket yok
      const response = await fetch(url);
      const data = await response.json();

      if (
        data.routes &&
        data.routes[0] &&
        data.routes[0].legs &&
        data.routes[0].legs.length
      ) {
        let totalMeters = 0;
        for (const leg of data.routes[0].legs) {
          if (leg.distance && leg.distance.value) {
            totalMeters += leg.distance.value;
          }
        }
        miles = totalMeters / 1609.34;
      } else {
        console.warn('Directions API did not return distance. data.status =', data.status);
      }
    } else {
      console.warn('GOOGLE_MAPS_API_KEY not set, using fallback distance.');
      miles = 20; // fallback
    }

    if (!miles || miles <= 0) {
      miles = 20;
    }

    const baseFare = 65;
    const includedMiles = 15;
    const extraPerMile = 2;
    const minimumFare = baseFare;
    const nightMultiplier = 1.25;

    res.json({
      ok: true,
      miles,
      pricing: {
        baseFare,
        includedMiles,
        extraPerMile,
        minimumFare,
        nightMultiplier
      }
    });
  } catch (err) {
    console.error('Error in /api/calc-price:', err);
    res.status(500).json({ ok: false, error: 'Error calculating price' });
  }
});

// ---------- SUNUCUYU BAŞLAT ----------
app.listen(PORT, () => {
  console.log(`JK2424 backend with SSE running on port ${PORT}`);
});
