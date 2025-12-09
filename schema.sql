CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  passenger_name    TEXT,
  pickup_address    TEXT,
  dropoff_address   TEXT,
  pickup_datetime   TIMESTAMPTZ,
  passengers        INTEGER,
  vehicle_type      TEXT,
  estimated_price   NUMERIC(10,2),
  notes             TEXT,
  status            TEXT NOT NULL DEFAULT 'confirmed',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Test için 2 örnek kayıt:
INSERT INTO bookings
  (passenger_name, pickup_address, dropoff_address, pickup_datetime, passengers, vehicle_type, estimated_price, notes, status)
VALUES
  ('John Doe',
   'Dulles Airport (IAD)',
   '1523 17th St NW, Washington, DC',
   '2025-12-10 10:00:00-05',
   2,
   'Mercedes EQS',
   145.00,
   'Business client',
   'confirmed'
  ),
  ('Sarah Miller',
   'Union Station, Washington, DC',
   'Tysons Corner Center, VA',
   '2025-12-11 14:30:00-05',
   1,
   'Mercedes EQS',
   95.00,
   '',
   'paid'
  );
