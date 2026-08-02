# 🚌 Leave Now

> Never miss your bus again.

Leave Now is a Progressive Web App that calculates exactly when you should leave for your bus stop based on live Dublin bus departure data and your personal walking speed.

Instead of asking *"When does my bus leave?"*, Leave Now answers the more useful question:

> **"When do I need to leave my house?"**

---

## ✨ Features

- 🚌 Live bus departures using GTFS Realtime
- 🚶 Personal walking pace calculations
- 📍 Save your favourite bus stops
- ⏰ "Leave in X minutes" countdown
- 📱 Installable Progressive Web App (PWA)
- 🔔 Push notification support
- ⚡ Fast Next.js interface
- ☁️ Supabase backend for storing user settings

---

## Screenshots

> Screenshots coming soon.

---

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

### Backend

- Next.js API Routes
- Supabase

### Data

- GTFS Static
- GTFS Realtime feeds

### Other

- Service Workers
- Web Push API
- SWR

---

## How It Works

1. Search for your regular bus stop.
2. Save it to your account.
3. Set your walking pace.
4. Leave Now combines:
   - your walking time
   - scheduled departure
   - live delays

and tells you exactly when to leave.

Example:

```
Bus departs:      08:32
Walking time:     7 min
Delay:            +2 min

➡ Leave at 08:27
```

---

## Installation

Clone the repository

```bash
git clone https://github.com/liamh2323/Leave-now.git
cd Leave-now
```

Install dependencies

```bash
npm install
```

Run the development server

```bash
npm run dev
```

Open

```
http://localhost:3000
```

---

## Environment Variables

Create a `.env.local` file.

Example:

```env
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key

NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
```

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   ├── settings/
│   └── page.tsx
│
├── components/
│   ├── DepartureCard
│   ├── DepartureList
│   ├── NotificationToggle
│   ├── StopSearch
│   ├── UserStopList
│   └── WalkPaceInput
│
├── hooks/
├── lib/
├── types/
└── service-worker/
```

---

## Roadmap

- [x] Favourite bus stops
- [x] Walking pace calculation
- [x] Live departure countdown
- [x] Progressive Web App
- [x] Push notification support
- [ ] Multiple transport providers
- [ ] Home screen widgets
- [ ] Apple Watch support
- [ ] Route planning
- [ ] User accounts

---

## Why I Built This

I wanted a faster way to know **when to leave**, rather than checking departure boards and doing the mental maths myself.

Leave Now combines live transport data with your walking time so you know exactly when it's time to head out.

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/my-feature
```

3. Commit your changes

```bash
git commit -m "Add awesome feature"
```

4. Push your branch

```bash
git push origin feature/my-feature
```

5. Open a Pull Request.

---

## License

This project is licensed under the MIT License.

---

## Author

**Liam H**

GitHub: https://github.com/liamh2323
