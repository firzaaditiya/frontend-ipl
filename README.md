# FIM-IPL Frontend

Dashboard React + TypeScript + Vite untuk mengoperasikan FIM-IPL Backend.
Repository ini mandiri: frontend dapat di-clone dan dijalankan tanpa file
dokumentasi atau folder lokal dari project lain.

## Requirements

- Node.js LTS.
- FIM-IPL Backend yang sudah berjalan.
- Browser modern dengan JavaScript aktif.

## Standalone Development

Install dependency dan salin konfigurasi proxy:

```bash
npm ci
cp .env.example .env
```

Atur port API backend di `.env`:

```text
FIM_API_PORT=8080
```

Jalankan:

```bash
npm run dev -- --host localhost
```

Windows PowerShell memakai `npm.cmd`:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev -- --host localhost
```

Dashboard tersedia di `http://localhost:3000`. Semua request `/api` diproxy
ke `http://127.0.0.1:<FIM_API_PORT>`.

Jika backend berjalan di host lain, ubah `FIM_API_PORT` hanya untuk port lokal;
untuk host berbeda, sesuaikan target proxy di `vite.config.ts` dan gunakan
CORS allowlist backend.

## Production Build

```bash
npm ci
npm run lint
npm run build
npm run preview
```

Deploy isi `dist/` ke Nginx, Caddy, atau web server statis. Reverse proxy API
ke backend sebaiknya memakai HTTPS dan hanya meneruskan endpoint yang memang
diperlukan.

## Halaman dan Fungsi

- **Dashboard:** kondisi baseline, jumlah file, anomali, karantina, performa
  scan, status agent, dan status koneksi realtime.
- **Audit Trail:** pencarian, filter aksi, pagination, detail block, export,
  verifikasi chain, dan release karantina yang tercatat.
- **Settings:** monitoring, maintenance, baseline, Telegram, backup, dan akun
  Auditor.
- **System:** versi, OS, worker, interval, watch path, dan postur sistem.

## Login dan API

Frontend memakai JWT Bearer untuk REST API dan SSE. Endpoint login default:

```text
POST /api/v1/secure-gate
```

Frontend tidak menerima kembali token bot Telegram. Semua perubahan konfigurasi
dan hak akses tetap divalidasi ulang oleh backend; disable button di frontend
bukan pengganti RBAC server.

## Security Notes

- Untuk demo lokal, JWT disimpan di `localStorage` agar alur SPA sederhana.
- Untuk production, gunakan cookie `HttpOnly`, `Secure`, dan `SameSite`, serta
  HTTPS.
- Host dashboard sebaiknya berbeda dari origin WordPress yang dipantau.
- Jika attacker menjadi `root` atau user service FIM, frontend tidak dapat
  membatasi dampaknya. Isolasi OS dan secret management adalah tanggung jawab
  deployment backend.

## Text and UX Principles

- Bahasa Indonesia menjadi default; English tersedia lewat language toggle.
- Copy berorientasi operator: menjelaskan apa yang terjadi dan langkah berikutnya.
- Tidak memakai klaim seperti "100% aman" atau "tidak dapat ditembus".
- Status kosong, error, loading, dan fallback realtime dijelaskan secara nyata.
- SSE menjadi jalur utama; polling hanya dipakai saat SSE terputus.

## Troubleshooting

### Dashboard kosong atau terus loading

1. Cek backend: `curl http://127.0.0.1:8080/api/v1/healthz`.
2. Pastikan `FIM_API_PORT` sesuai port backend.
3. Pastikan login path backend adalah `/api/v1/secure-gate`.
4. Periksa CORS bila backend dan frontend berbeda host.
5. Jalankan `npm ci` ulang bila dependency native Vite berasal dari OS berbeda.

### Error native Vite/Rolldown

Hapus `node_modules` dan install ulang pada OS yang sedang digunakan:

```bash
rm -rf node_modules
npm ci
```

Jangan memakai `node_modules` Windows dari WSL/Linux atau sebaliknya.

## License and Scope

Project ini ditujukan untuk implementasi dan evaluasi FIM-IPL. Script simulasi
serangan harus dijalankan hanya pada direktori uji yang Anda miliki. Jangan
menjalankan payload atau generator pada web production tanpa backup dan
maintenance window.
