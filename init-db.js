require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL tanımlı değil. Lütfen .env dosyasını kontrol et.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false  // Render PostgreSQL için gerekli
  }
});

async function main() {
  try {
    const sql = fs.readFileSync("schema.sql", "utf8");
    console.log("schema.sql dosyası okunuyor ve çalıştırılıyor...");

    await pool.query(sql);

    console.log("Veritabanı şeması ve örnek kayıtlar başarıyla yüklendi.");
  } catch (err) {
    console.error("init-db sırasında hata:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
