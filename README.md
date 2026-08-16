# ⚔️ HabitQuest

Habit tracker RPG **offline-first** hasil reverse engineering mekanik [Habitica](https://habitica.com), dibangun dengan **React + Vite + TypeScript + Capacitor**.

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
├── types.ts               # Model data: Habit, Daily, Todo, Reward, Player
├── game/formulas.ts       # Rumus Habitica: kurva XP, task value delta, damage, streak, cron
├── store/
│   ├── storage.ts         # Adapter Capacitor Preferences (offline-first)
│   └── useGame.ts         # Zustand store + persist: seluruh state & aksi game
├── components/
│   ├── Header.tsx         # Avatar, HP bar, XP bar, gold
│   ├── TaskItem.tsx       # Kartu Habit / Daily / To-Do / Reward
│   ├── TaskModal.tsx      # Form buat/edit tugas
│   ├── SettingsModal.tsx  # Profil, statistik, reset data
│   └── Toasts.tsx         # Notifikasi XP/gold/HP/level
└── App.tsx                # Tab, cron saat app aktif, layout
```

Prinsip offline-first: state game di-persist otomatis lewat `zustand/persist` ke Capacitor Preferences (fallback localStorage di web). "Cron" pergantian hari dihitung dari tanggal lokal saat app dibuka/kembali aktif — tidak perlu jam server.
