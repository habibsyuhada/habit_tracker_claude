# 🏰 HabitQuest — Kerajaan Mini

Habit tracker RPG **offline-first** dengan identitas sendiri: kamu adalah penguasa
kerajaan kecil, dan **tugas-tugasmu adalah titah kerajaan**. Rakyat berdatangan saat
kamu produktif, bangunan memberi bonus ekonomi nyata, dan tiap pergantian hari
terjadi event kerajaan. Fondasi mekaniknya hasil reverse engineering
[Habitica](https://habitica.com), dibangun dengan **React + Vite + TypeScript + Capacitor**.

Semua data tersimpan **di perangkat** (Capacitor Preferences di Android/iOS, localStorage di web) — tidak ada server, tidak butuh internet sama sekali.

## Fitur (mekanik Habitica yang direplikasi)

| Mekanik | Implementasi |
| --- | --- |
| **Habits** | Kebiasaan dengan skor ＋ (baik) / － (buruk), bisa kapan saja |
| **Dailies** | Tugas terjadwal per hari dalam seminggu, dengan 🔥 streak + bonus |
| **To-Dos** | Tugas sekali selesai, dengan tenggat |
| **Rewards** | Hadiah custom yang ditebus pakai gold |
| **HP / XP / Level / Gold** | Kurva XP asli Habitica: `round((0.25·lvl² + 10·lvl + 139.75) / 10) · 10` |
| **Task value** | Nilai tugas bergeser tiap skor (`0.9747^value`) → reward mengecil kalau kebiasaan sudah rutin, warna kartu berubah merah → kuning → biru |
| **Kesulitan** | Sepele ×0.1 · Mudah ×1 · Sedang ×1.5 · Sulit ×2 |
| **Cron / hari baru** | Saat app dibuka di hari baru: daily terlewat memberi damage HP & mereset streak, daily di-reset, nilai habit memudar. Semua daily selesai = 🌟 Perfect Day bonus |
| **Kematian** | HP habis → turun 1 level, gold hangus, HP pulih |
| **Naik level** | HP pulih penuh |
| **Checklist** | Sub-tugas di Daily & To-Do; item tercentang mengurangi damage daily terlewat secara proporsional (seperti Habitica) |
| **Equipment** | Toko gear di tab Rewards (tier per slot: senjata/zirah/helm/perisai); STR menambah XP & gold, CON mengurangi damage |
| **Pets** | Telur & ramuan drop acak dari tugas selesai (dibatasi per hari), ditetaskan jadi pet; pet aktif tampil di samping avatar |
| **Pengingat harian** | Notifikasi lokal (Capacitor Local Notifications) di jam pilihan — tetap 100% offline |
| **Backup** | Ekspor/impor seluruh data sebagai JSON (share sheet di Android/iOS, unduhan di web) |
| **Statistik** | Riwayat aktivitas harian: grafik tugas selesai & XP (14 hari), heatmap 12 minggu, plus ringkasan level/streak/koleksi |
| **Kerajaan** | Tiap 4 tugas selesai = 1 rakyat baru; 7 bangunan dengan efek pasif (kas/kemakmuran/pertahanan/drop); gelar dari Kepala Dusun sampai Kaisar; peta wilayah yang tumbuh; event kerajaan tiap pergantian hari; kronik peristiwa |
| **Rakyat & profesi** | Rakyat punya nama & profesi (Petani/Penambang/Pujangga/Tabib/Penjaga) dengan penghasilan pasif harian: kas, kemakmuran, atau pemulihan moral |
| **Ancaman** | Serigala, bandit, wabah, sampai naga bisa muncul — tangkal dengan menyelesaikan N titah sebelum tenggat; berhasil = hadiah gold, gagal = moral rakyat diserang |
| **Dekorasi** | 6 dekorasi kosmetik (taman bunga, patung, gerbang pelangi, ...) untuk mempercantik peta wilayah |
| **Onboarding** | Cerita pembuka 3 babak untuk pemain baru: kisah kerajaan, penjelasan titah, dan penobatan (nama + lambang) |
| **Haptics** | Getaran kontekstual via Capacitor Haptics: halus saat XP, kuat saat damage/ancaman, notifikasi saat naik level |

Mekanik "ampun": kalau app lama tidak dibuka, damage hanya ditagih maksimal 3 hari.

## Menjalankan (web)

```bash
npm install
npm run dev       # development
npm run build     # production → dist/
npm run preview   # serve hasil build
```

Versi web production juga memasang service worker sederhana sehingga tetap bisa dibuka offline.

## Build ke Android (Capacitor)

```bash
npm install
npm run build
npx cap add android      # sekali saja, membuat folder android/
npm run cap:android      # build + sync + buka Android Studio
```

Dari Android Studio tinggal Run ▶ ke emulator/perangkat. Untuk iOS: `npx cap add ios` lalu `npx cap open ios` (butuh macOS + Xcode).

## Arsitektur

```
src/
├── types.ts               # Model data: Habit, Daily, Todo, Reward, Player, Checklist
├── notifications.ts       # Pengingat harian via Capacitor Local Notifications
├── game/formulas.ts       # Rumus Habitica: kurva XP, task value delta, damage, streak, cron
├── game/items.ts          # Katalog gear (STR/CON), spesies pet, ramuan, aturan drop
├── game/kingdom.ts        # Gelar, katalog bangunan + efek, event harian, peta wilayah
├── store/
│   ├── storage.ts         # Adapter Capacitor Preferences (offline-first)
│   └── useGame.ts         # Zustand store + persist: seluruh state & aksi game
├── components/
│   ├── Header.tsx         # Avatar (+pet aktif), HP bar, XP bar, gold
│   ├── GearShop.tsx       # Toko perlengkapan di tab Rewards
│   ├── KingdomView.tsx    # Tab Kerajaan: peta, pembangunan, kronik, gudang
│   ├── BagView.tsx        # Gudang: equip gear, penetasan, kandang pet
│   ├── StatsModal.tsx     # Statistik: bar chart, area XP, heatmap (SVG)
│   ├── TaskItem.tsx       # Kartu Habit / Daily / To-Do / Reward
│   ├── TaskModal.tsx      # Form buat/edit tugas
│   ├── SettingsModal.tsx  # Profil, statistik, reset data
│   └── Toasts.tsx         # Notifikasi XP/gold/HP/level
└── App.tsx                # Tab, cron saat app aktif, layout
```

Prinsip offline-first: state game di-persist otomatis lewat `zustand/persist` ke Capacitor Preferences (fallback localStorage di web). "Cron" pergantian hari dihitung dari tanggal lokal saat app dibuka/kembali aktif — tidak perlu jam server.
