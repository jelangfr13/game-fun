# GameFun

GameFun adalah aplikasi web mini-casino berbasis koin virtual. Project ini dibuat untuk hiburan, bukan perjudian uang nyata. Pemain dapat login, top up koin memakai kode, memainkan beberapa game, melihat riwayat permainan, dan admin dapat mengatur kode top up serta outcome tertentu untuk kebutuhan demo atau operasional.

## Teknologi

Frontend:

- React 19
- Vite 8
- JavaScript ES Modules
- Inline style object dan CSS lokal per komponen
- Web Audio API untuk efek suara tanpa file audio eksternal
- ESLint untuk pemeriksaan kode

Backend:

- Node.js
- Express
- MongoDB native driver
- JSON Web Token untuk autentikasi
- bcryptjs untuk hashing password
- dotenv untuk konfigurasi environment
- CORS dengan allowlist localhost, Vercel, dan `FRONTEND_URL`

Deployment:

- Frontend dan backend sudah memiliki konfigurasi Vercel.
- Saat development, Vite mem-proxy `/api` ke `http://localhost:4000`.

## Struktur Project

```text
.
├── backend/
│   ├── index.js              # Entry Express API
│   ├── db.js                 # Koneksi MongoDB
│   ├── routes/
│   │   ├── auth.js           # Register, login, me
│   │   ├── user.js           # Coins, redeem, forced result claim, logs
│   │   └── admin.js          # Admin codes, users, controls, logs
│   └── middleware/
│       ├── auth.js           # JWT guard
│       └── admin.js          # Admin-only guard
└── frontend/
    ├── src/
    │   ├── pages/            # Dashboard, login, profile, top up, admin
    │   ├── context/          # Auth context
    │   ├── dadu/             # Shared constants/store/dice UI
    │   ├── DaduGanjilGenap.jsx
    │   ├── SlotMachine.jsx
    │   ├── Blackjack.jsx
    │   ├── Roulette.jsx
    │   ├── GameLogsPanel.jsx
    │   └── sounds.js
    └── vite.config.js
```

## Fitur Utama

- Autentikasi user dengan username dan password.
- Saldo koin virtual per user.
- Top up koin memakai kode redeem.
- Dashboard game dengan navigasi ke Dadu, Slot, Blackjack, dan Roulette.
- Riwayat permainan per game.
- Panel admin untuk:
  - membuat kode top up single-use atau multi-use,
  - melihat user,
  - mengatur forced win, forced lose, dan jackpot,
  - melihat log semua game.
- Tampilan responsif desktop dan mobile.

## Sistematika Game

### 1. Ganjil Genap

File utama: `frontend/src/DaduGanjilGenap.jsx`

- Pemain memilih `ganjil` atau `genap`.
- Sistem melempar dua dadu.
- Jika parity total dua dadu sama dengan pilihan pemain, pemain menang.
- Menang membayar `2x` total taruhan secara saldo akhir, atau profit `+bet`.
- Kalah mengurangi saldo sebesar taruhan.
- Mendukung forced win dan forced lose dari admin.

### 2. Mesin Slot

File utama: `frontend/src/SlotMachine.jsx`

- Slot memiliki 3 reel dan payline tengah.
- Simbol memiliki bobot berbeda: cherry, lemon, grapes, bell, star, diamond, dan lucky seven.
- Kombinasi 3 sejenis memiliki multiplier berbeda, termasuk jackpot `7 x 3`.
- Kombinasi 2 sejenis tertentu dapat memberi payout bonus atau impas.
- Kesulitan natural spin sudah dinaikkan dengan `DIFFICULTY_MULTIPLIER = 3`, sehingga hasil menang/impas normal hanya lolos sekitar 1 dari 3 kali.
- Forced priority: jackpot > forced win > forced lose > random.

### 3. Blackjack

File utama: `frontend/src/Blackjack.jsx`

- Pemain bermain melawan dealer.
- Tujuan: nilai kartu lebih tinggi dari dealer tanpa melebihi 21.
- Blackjack natural memiliki payout khusus.
- Dealer memiliki house bias agar game lebih menantang.
- Mendukung forced win dari admin.

### 4. Roulette

File utama: `frontend/src/Roulette.jsx`

- Roda menggunakan urutan European roulette `0-36`.
- Pemain dapat memilih:
  - angka tunggal: payout `36x`,
  - merah atau hitam: payout `2x`,
  - ganjil atau genap: payout `2x`,
  - 1-18 atau 19-36: payout `2x`,
  - lusin 1/2/3: payout `3x`,
  - kolom 1/2/3: payout `3x`.
- Angka `0` hanya menang jika dipilih langsung.
- Mendukung forced win dan forced lose dari admin.
- Riwayat Roulette difilter khusus `game=roulette`.

## Sistem Saldo dan Log

Saldo user disimpan di MongoDB pada koleksi `users`. Frontend juga memakai helper `Store` untuk menyinkronkan saldo pada pengalaman bermain.

Setiap game mengirim log ke:

```http
POST /api/user/log
```

Log berisi:

- `game`: `dadu`, `slot`, `blackjack`, atau `roulette`
- `bet`
- `result`: `win`, `lose`, `impas`, atau `jackpot`
- `delta`
- `balanceBefore`
- `balanceAfter`
- `details`
- `forced`
- `createdAt`

Riwayat user per game diambil dari:

```http
GET /api/user/logs?game=<game>&limit=50
```

## Sistem Admin

Admin ditentukan dari username `admin` di frontend dan divalidasi oleh middleware backend.

Kemampuan utama admin:

- Membuat kode top up.
- Melihat daftar kode dan pemakaian.
- Melihat daftar user.
- Mengatur forced result:
  - forced win,
  - forced lose,
  - jackpot slot.
- Melihat log permainan lintas user.

Forced result dikonsumsi secara atomic oleh endpoint user sebelum animasi game dimulai.

## Environment Backend

Buat file `backend/.env`:

```env
MONGODB_URI=mongodb+srv://...
DB_NAME=gamefun
JWT_SECRET=replace-with-a-long-secret
FRONTEND_URL=http://localhost:5173
PORT=4000
```

`FRONTEND_URL` diperlukan jika frontend berjalan dari domain selain localhost atau Vercel.

## Cara Menjalankan Lokal

Install dependency:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Jalankan backend:

```bash
cd backend
npm run dev
```

Jalankan frontend:

```bash
cd frontend
npm run dev
```

Frontend default:

```text
http://localhost:5173
```

Backend default:

```text
http://localhost:4000
```

Health check:

```http
GET /api/health
```

## Build dan Validasi

Frontend production build:

```bash
cd frontend
npm run build
```

Lint frontend:

```bash
cd frontend
npm run lint
```

Syntax check backend route tertentu:

```bash
node --check backend/routes/user.js
```

Catatan: beberapa file lama masih memiliki lint warning/error dari aturan React/ESLint yang lebih ketat. Build Vite tetap menjadi validasi utama untuk bundle frontend saat ini.

## Catatan Pengembangan

- Semua game memakai pola umum: load saldo, pilih taruhan, claim forced control, animasi, hitung payout, update saldo, lalu kirim log.
- Komponen `GameLogsPanel` dipakai ulang oleh semua game.
- Efek suara dibuat di `frontend/src/sounds.js` menggunakan Web Audio API.
- Jika menambah game baru, pastikan:
  - komponen ditambahkan ke `Dashboard.jsx`,
  - log memakai nama `game` baru,
  - backend `/api/user/logs` mengizinkan filter game tersebut,
  - `GameLogsPanel` tahu cara menampilkan detail log-nya,
  - Admin logs menambahkan filter dan badge game.
