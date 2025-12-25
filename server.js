const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Veritabanı niyetine RAM'de tutuyoruz
let bookings = [];
let bookingIdCounter = 1;

// Gece tarifesi kontrolü
const isNight = (dateStr, timeStr, ampm) => {
    // Basit mantık: 11 PM - 6 AM arası gece
    let [h, m] = timeStr.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return (h >= 23 || h < 6);
};

// 1. Fiyat Hesaplama
app.get('/calc', (req, res) => {
    const { pickup, dropoff } = req.query;
    // Simüle edilmiş mesafe ve fiyat
    const miles = Math.floor(Math.random() * 20) + 5; 
    let base = 65;
    let extra = (miles > 10) ? (miles - 10) * 3.5 : 0;
    let total = base + extra;
    
    // Gece tarifesi (frontend'den gelen isNight parametresine göre de bakabiliriz ama burada basit tuttum)
    // Gerçekte saat kontrolü yapılır.
    
    res.json({
        success: true,
        pricing: {
            miles,
            base,
            extraMiles: (miles > 10) ? miles - 10 : 0,
            extraCost: extra,
            total: total,
            nightApplied: false 
        }
    });
});

// 2. Rezervasyon Oluşturma
app.post('/bookings', (req, res) => {
    const data = req.body;
    const newBooking = {
        id: bookingIdCounter++,
        ...data,
        status: 'pending',
        driverLocation: { lat: 38.9072, lng: -77.0369 }, // Başlangıç Driver Konumu
        timestamps: {
            created: new Date(),
            onWay: null,
            arrived: null,
            started: null,
            completed: null
        },
        waitTimeSeconds: 0,
        messages: []
    };
    bookings.push(newBooking);
    res.json({ success: true, bookingId: newBooking.id });
});

// 3. Müşteri Rezervasyonlarını Getir
app.get('/bookings/customer/:phone', (req, res) => {
    const phone = req.params.phone;
    const customerBookings = bookings.filter(b => b.customerPhone === phone);
    res.json({ success: true, bookings: customerBookings });
});

// 4. Admin: Tüm Rezervasyonları Getir
app.get('/admin/bookings', (req, res) => {
    res.json({ success: true, bookings: bookings });
});

// 5. Statü Güncelleme ve İş Akışı (ÖNEMLİ KISIM)
app.patch('/bookings/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, note } = req.body;
    const booking = bookings.find(b => b.id == id);

    if (!booking) return res.status(404).json({ success: false });

    booking.status = status;
    const now = new Date();

    // Zaman Damgaları ve Mesajlar
    if (status === 'on_the_way') {
        booking.timestamps.onWay = now;
        booking.messages.push({
            id: Date.now(),
            title: 'Driver is on the way',
            body: 'Teoman Deveci is driving to your location.',
            read: false,
            date: now
        });
    } 
    else if (status === 'arrived') {
        booking.timestamps.arrived = now;
        booking.messages.push({
            id: Date.now(),
            title: 'Driver Arrived',
            body: 'Your vehicle is waiting at the pickup location.',
            read: false,
            date: now
        });
    }
    else if (status === 'in_progress') {
        booking.timestamps.started = now;
        // Bekleme süresini hesapla (Arrived -> Started arası)
        if(booking.timestamps.arrived) {
            const diffMs = now - new Date(booking.timestamps.arrived);
            booking.waitTimeSeconds = Math.floor(diffMs / 1000);
        }
    }
    else if (status === 'completed') {
        booking.timestamps.completed = now;
        booking.messages.push({
            id: Date.now(),
            title: 'Trip Completed',
            body: 'Thank you for riding with Teoman Deveci.',
            read: false,
            date: now
        });
    }

    res.json({ success: true, booking });
});

// 6. Mesaj Okundu Yap
app.patch('/bookings/:id/messages/read', (req, res) => {
    const { id } = req.params;
    const { messageId } = req.body;
    const booking = bookings.find(b => b.id == id);
    if(booking && booking.messages) {
        const msg = booking.messages.find(m => m.id == messageId);
        if(msg) msg.read = true;
    }
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
