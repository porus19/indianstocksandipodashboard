# Indian Stocks and IPO Dashboard

A React + FastAPI dashboard for Indian stock and IPO analysis with live search, peer comparison, valuation metrics, and interactive charts.

## Features

- Live search for Indian stocks and IPOs
- Company overview and business summary
- Valuation model with fair price estimate
- Analyst recommendation distribution
- Key financial ratio cards
- Peer comparison table
- Interactive indexed stock price chart
- FastAPI backend with yfinance data

## Tech Stack

- React
- Vite
- CSS
- FastAPI
- Python
- yfinance
- Axios

## Project Structure

- `frontend/` – React frontend
- `backend/` – FastAPI backend

## How to Run

### Backend
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
npm install
npm run dev
```

## Notes

This project is built as a stock market analytics dashboard focused on Indian equities and IPOs. Some data quality depends on the availability and structure of Yahoo Finance/yfinance responses.
