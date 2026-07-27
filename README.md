# STOXFLIX

A full-stack stock and IPO analysis dashboard focused on Indian equities. STOXFLIX lets users search listed companies and recent IPOs, then view valuation signals, analyst consensus, price trends, peer comparisons, and key financial ratios in one place.

<img width="1512" height="822" alt="assets:dashboard-preview" src="https://github.com/user-attachments/assets/d02cfce4-7c48-4af1-b4ad-503051c1088c" />

## Live Demo

- Frontend: [https://indianstocksandipodashboard.vercel.app](https://indianstocksandipodashboard.vercel.app)
- Backend API: [https://indianstocksandipodashboard.onrender.com](https://indianstocksandipodashboard.onrender.com)

## Features

- Live stock search for Indian equities.
- IPO and recently listed company search.
- Company overview and business summary.
- Valuation status with fair price vs current price.
- Interactive stock price chart with timeframe switching.
- Peer comparison with overlay support.
- Analyst consensus recommendation breakdown.
- Green flags and red flags for quick screening.
- Key financial ratio cards for fundamentals.
- Macro inflation reference table for context.

## Dashboard Preview

The app provides a dark-themed dashboard experience with a quick-search workflow and decision-friendly cards for valuation, consensus, price action, and fundamentals.

## Tech Stack

### Frontend
- React
- Vite
- Axios
- CSS

### Backend
- FastAPI
- Python
- Uvicorn

### Deployment
- Frontend hosted on Vercel
- Backend hosted on Render

## Project Structure

```bash
indianstocksandipodashboard/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── main.jsx
│   │   └── index.css
│   └── ...
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── ...
└── README.md
```

## How It Works

1. The user searches for a company or IPO from the frontend.
2. The React app sends requests to the FastAPI backend.
3. The backend processes market/company data and returns structured results.
4. The frontend renders charts, ratios, recommendations, flags, and summaries.

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/porus19/indianstocksandipodashboard.git
cd indianstocksandipodashboard
```

### 2. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend will run locally at:

```bash
http://127.0.0.1:8000
```

### 3. Run the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run locally at:

```bash
http://localhost:5173
```

## Production Deployment

### Frontend
The frontend is deployed on Vercel:
- [https://indianstocksandipodashboard.vercel.app](https://indianstocksandipodashboard.vercel.app)

### Backend
The backend is deployed on Render:
- [https://indianstocksandipodashboard.onrender.com](https://indianstocksandipodashboard.onrender.com)

## Notes

- The frontend must point to the deployed Render backend in production.
- If the backend is on a free Render instance, the first request may take a few seconds after inactivity.
- Search works best when selecting valid suggestions from the dropdown.

## Future Improvements

- Add authentication and watchlists.
- Add more technical indicators.
- Add downloadable reports.
- Improve mobile responsiveness.
- Add portfolio tracking.

## Author

Built by [porus19](https://github.com/porus19)

## License

This project is for educational use only.
