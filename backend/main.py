from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import re
from typing import List, Dict

app = FastAPI(
    title="Universal Indian Stock Market Analytics & Valuation Engine",
    description="Full-scale Indian Stock Market Intelligence API covering every NSE/BSE equity and IPO.",
    version="3.2.0"
)

@app.get("/")
def home():
    return {"message": "Backend is live"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

EXACT_PEER_MAP = {
    "ZOMATO.NS": [
        {"name": "Eternal Ltd", "ticker": "ETERNAL.NS"},
        {"name": "Swiggy Ltd", "ticker": "SWIGGY.NS"},
        {"name": "Jubilant FoodWorks", "ticker": "JUBLFOOD.NS"}
    ],
    "ETERNAL.NS": [
        {"name": "Zomato Ltd", "ticker": "ZOMATO.NS"},
        {"name": "Swiggy Ltd", "ticker": "SWIGGY.NS"},
        {"name": "Jubilant FoodWorks", "ticker": "JUBLFOOD.NS"}
    ],
    "SWIGGY.NS": [
        {"name": "Zomato Ltd", "ticker": "ZOMATO.NS"},
        {"name": "Eternal Ltd", "ticker": "ETERNAL.NS"},
        {"name": "Jubilant FoodWorks", "ticker": "JUBLFOOD.NS"}
    ],
    "TATAMOTORS.NS": [
        {"name": "Mahindra & Mahindra", "ticker": "M&M.NS"},
        {"name": "Maruti Suzuki", "ticker": "MARUTI.NS"},
        {"name": "Ashok Leyland", "ticker": "ASHOKLEY.NS"}
    ],
    "MARUTI.NS": [
        {"name": "Mahindra & Mahindra", "ticker": "M&M.NS"},
        {"name": "Tata Motors", "ticker": "TATAMOTORS.NS"},
        {"name": "Ashok Leyland", "ticker": "ASHOKLEY.NS"}
    ],
    "M&M.NS": [
        {"name": "Tata Motors", "ticker": "TATAMOTORS.NS"},
        {"name": "Maruti Suzuki", "ticker": "MARUTI.NS"},
        {"name": "Ashok Leyland", "ticker": "ASHOKLEY.NS"}
    ]
}

IPO_KEYWORDS = {
    "ipo", "recently listed", "new listing", "listed", "mainboard ipo", "sme ipo"
}

BAD_SEARCH_TYPES = {
    "MUTUALFUND", "ETF", "INDEX", "CURRENCY", "CRYPTO", "FUTURE", "OPTION"
}

BAD_NAME_FRAGMENTS = [
    "fund", "etf", "bees", "index", "trust", "liquid", "gold", "silver", "bond"
]

BAD_WORDS = {
    "the", "and", "ltd", "limited", "india", "indian", "company", "co", "services",
    "service", "industries", "industry", "corporation", "corp", "holdings", "holding",
    "financial", "technology", "technologies", "solutions", "global", "international",
    "enterprise", "enterprises", "group", "private", "public", "plc"
}

def normalize_symbol(symbol: str) -> str:
    symbol = symbol.upper().strip()
    if "." not in symbol and not symbol.endswith(".BO"):
        symbol += ".NS"
    return symbol

def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())

def normalize_for_match(value: str) -> str:
    value = clean_text(value).lower()
    value = re.sub(r"[^a-z0-9\s.&/-]", "", value)
    return value

def tokenize(text: str) -> List[str]:
    if not text:
        return []
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s/&-]", " ", text)
    raw = re.split(r"[\s/&-]+", text)
    return [w for w in raw if w and w not in BAD_WORDS and len(w) > 2]

def looks_like_indian_equity(quote: Dict) -> bool:
    symbol = (quote.get("symbol") or "").upper()
    exchange = (quote.get("exchDisp") or "").upper()
    qtype = (quote.get("quoteType") or "").upper()
    name = normalize_for_match(quote.get("shortname") or quote.get("longname") or "")

    is_indian = symbol.endswith(".NS") or symbol.endswith(".BO") or exchange in {"NSE", "BSE"}
    if not is_indian:
        return False

    if qtype in BAD_SEARCH_TYPES:
        return False

    if any(fragment in name for fragment in BAD_NAME_FRAGMENTS):
        return False

    if symbol.startswith("0P") or symbol.startswith("1P") or symbol.startswith("INF"):
        return False

    return True

def is_probable_ipo_result(quote: Dict) -> bool:
    joined = " ".join([
        str(quote.get("shortname") or ""),
        str(quote.get("longname") or ""),
        str(quote.get("typeDisp") or ""),
        str(quote.get("industry") or "")
    ]).lower()
    return any(k in joined for k in IPO_KEYWORDS)

def score_search_result(query: str, quote: Dict, search_type: str) -> float:
    q = normalize_for_match(query)
    symbol = normalize_for_match((quote.get("symbol") or "").replace(".NS", "").replace(".BO", ""))
    full_symbol = normalize_for_match(quote.get("symbol") or "")
    name = normalize_for_match(quote.get("shortname") or quote.get("longname") or "")
    sector = normalize_for_match(quote.get("sector") or quote.get("typeDisp") or "")

    score = 0.0

    if symbol == q or full_symbol == q:
        score += 120
    if symbol.startswith(q):
        score += 85
    if name.startswith(q):
        score += 70
    if f" {q}" in f" {name}":
        score += 35
    if q in name:
        score += 20
    if q in symbol:
        score += 18
    if sector.startswith(q):
        score += 8

    if search_type == "ipo":
        if is_probable_ipo_result(quote):
            score += 30
        else:
            score -= 10
    else:
        if is_probable_ipo_result(quote):
            score += 5

    score -= min(len(name) * 0.05, 6)
    return score

def get_company_profile(stock, fallback_symbol: str = "") -> Dict:
    info = stock.info or {}
    fast = {}
    try:
        fast = stock.fast_info or {}
    except Exception:
        fast = {}

    long_name = info.get("longName") or info.get("shortName") or fallback_symbol
    sector = info.get("sector") or "Indian Equities"
    industry = info.get("industry") or ""
    summary = info.get("longBusinessSummary") or ""
    market_cap = (
        info.get("marketCap")
        or fast.get("market_cap")
        or info.get("enterpriseValue")
        or 0
    )
    current_price = (
        info.get("currentPrice")
        or info.get("regularMarketPrice")
        or fast.get("lastPrice")
        or 0
    )

    keywords = set(tokenize(long_name) + tokenize(sector) + tokenize(industry) + tokenize(summary))
    return {
        "name": long_name,
        "sector": sector,
        "industry": industry,
        "summary": summary,
        "market_cap": market_cap if market_cap else 0,
        "price": current_price if current_price else 0,
        "keywords": keywords
    }

def market_cap_score(target_cap: float, peer_cap: float) -> float:
    if not target_cap or not peer_cap or target_cap <= 0 or peer_cap <= 0:
        return 0.0
    bigger = max(target_cap, peer_cap)
    smaller = min(target_cap, peer_cap)
    ratio = bigger / smaller if smaller else 999
    if ratio <= 1.5:
        return 18
    if ratio <= 3:
        return 12
    if ratio <= 8:
        return 6
    return 0

def keyword_overlap_score(target_keywords: set, peer_keywords: set) -> float:
    if not target_keywords or not peer_keywords:
        return 0.0
    overlap = target_keywords.intersection(peer_keywords)
    return min(len(overlap) * 4, 20)

def get_candidate_symbols_from_queries(symbol: str, sector: str, industry: str, summary: str) -> List[Dict]:
    queries = []

    if industry and industry.strip():
        queries.append(industry.strip())
        queries.append(f"{industry.strip()} India")
    if sector and sector.strip():
        queries.append(f"{sector.strip()} India")
    summary_tokens = tokenize(summary)
    if summary_tokens:
        queries.append(" ".join(summary_tokens[:4]))
        queries.append(" ".join(summary_tokens[:6]))
    queries.append(symbol.replace(".NS", "").replace(".BO", ""))

    discovered = []
    seen = set()

    for query in queries[:6]:
        try:
            search_res = yf.Search(query, max_results=20).quotes
            for quote in search_res:
                s = quote.get("symbol", "")
                exchange = quote.get("exchDisp", "")
                quote_type = (quote.get("quoteType") or "").upper()

                is_indian_stock = ".NS" in s or ".BO" in s or exchange in ["NSE", "BSE"]
                looks_like_equity = quote_type not in BAD_SEARCH_TYPES

                if s and s != symbol and is_indian_stock and looks_like_equity and s not in seen:
                    seen.add(s)
                    discovered.append({
                        "symbol": s,
                        "name": quote.get("shortname") or quote.get("longname") or s
                    })
        except Exception:
            continue

    return discovered

def is_bad_peer(candidate_symbol: str, candidate_info: Dict, target_symbol: str, target_sector: str) -> bool:
    if candidate_symbol == target_symbol:
        return True

    name = (candidate_info.get("name") or "").lower()
    sector = (candidate_info.get("sector") or "").lower()
    industry = (candidate_info.get("industry") or "").lower()

    bad_fragments = ["etf", "fund", "index", "bees", "nifty", "sensex", "trust"]
    if any(x in name for x in bad_fragments):
        return True

    if target_sector and sector == "" and industry == "":
        return True

    return False

def score_peer(target_profile: Dict, candidate_profile: Dict) -> float:
    score = 0.0

    target_sector = (target_profile.get("sector") or "").strip().lower()
    target_industry = (target_profile.get("industry") or "").strip().lower()
    peer_sector = (candidate_profile.get("sector") or "").strip().lower()
    peer_industry = (candidate_profile.get("industry") or "").strip().lower()

    if target_industry and peer_industry:
        if target_industry == peer_industry:
            score += 55
        elif target_industry in peer_industry or peer_industry in target_industry:
            score += 35

    if target_sector and peer_sector and target_sector == peer_sector:
        score += 22

    score += keyword_overlap_score(
        target_profile.get("keywords", set()),
        candidate_profile.get("keywords", set())
    )

    score += market_cap_score(
        target_profile.get("market_cap", 0),
        candidate_profile.get("market_cap", 0)
    )

    return score

def get_universal_market_peers(symbol: str, sector: str = "", industry: str = "", summary: str = ""):
    symbol = normalize_symbol(symbol)

    if symbol in EXACT_PEER_MAP:
        return EXACT_PEER_MAP[symbol]

    try:
        target_stock = yf.Ticker(symbol)
        target_profile = get_company_profile(target_stock, symbol)
    except Exception:
        target_profile = {
            "name": symbol,
            "sector": sector or "",
            "industry": industry or "",
            "summary": summary or "",
            "market_cap": 0,
            "price": 0,
            "keywords": set(tokenize((sector or "") + " " + (industry or "") + " " + (summary or "")))
        }

    if not target_profile["sector"] and sector:
        target_profile["sector"] = sector
    if not target_profile["industry"] and industry:
        target_profile["industry"] = industry
    if not target_profile["summary"] and summary:
        target_profile["summary"] = summary
        target_profile["keywords"] = set(list(target_profile["keywords"]) + tokenize(summary))

    candidates = get_candidate_symbols_from_queries(
        symbol=symbol,
        sector=target_profile.get("sector", ""),
        industry=target_profile.get("industry", ""),
        summary=target_profile.get("summary", "")
    )

    ranked = []
    seen = set()

    for item in candidates:
        c_symbol = item["symbol"]
        if c_symbol in seen or c_symbol == symbol:
            continue

        try:
            c_stock = yf.Ticker(c_symbol)
            c_profile = get_company_profile(c_stock, c_symbol)

            if is_bad_peer(c_symbol, c_profile, symbol, target_profile.get("sector", "")):
                continue

            s = score_peer(target_profile, c_profile)
            if s < 22:
                continue

            ranked.append({
                "ticker": c_symbol,
                "name": c_profile["name"] or item["name"],
                "score": s,
                "sector": c_profile.get("sector", ""),
                "industry": c_profile.get("industry", ""),
                "market_cap": c_profile.get("market_cap", 0)
            })
            seen.add(c_symbol)
        except Exception:
            continue

    ranked.sort(key=lambda x: (-x["score"], -x["market_cap"], x["name"]))

    if ranked:
        return [{"name": r["name"], "ticker": r["ticker"]} for r in ranked[:3]]

    fallback_map = {
        "financial services": [
            {"name": "HDFC Bank Ltd", "ticker": "HDFCBANK.NS"},
            {"name": "ICICI Bank Ltd", "ticker": "ICICIBANK.NS"},
            {"name": "Kotak Mahindra Bank Ltd", "ticker": "KOTAKBANK.NS"}
        ],
        "technology": [
            {"name": "Infosys Ltd", "ticker": "INFY.NS"},
            {"name": "Tata Consultancy Services", "ticker": "TCS.NS"},
            {"name": "HCL Technologies", "ticker": "HCLTECH.NS"}
        ],
        "consumer cyclical": [
            {"name": "Titan Company Ltd", "ticker": "TITAN.NS"},
            {"name": "Trent Ltd", "ticker": "TRENT.NS"},
            {"name": "Jubilant FoodWorks", "ticker": "JUBLFOOD.NS"}
        ],
        "consumer defensive": [
            {"name": "Hindustan Unilever Ltd", "ticker": "HINDUNILVR.NS"},
            {"name": "ITC Ltd", "ticker": "ITC.NS"},
            {"name": "Nestle India", "ticker": "NESTLEIND.NS"}
        ],
        "energy": [
            {"name": "ONGC", "ticker": "ONGC.NS"},
            {"name": "BPCL", "ticker": "BPCL.NS"},
            {"name": "Indian Oil Corp", "ticker": "IOC.NS"}
        ],
        "industrials": [
            {"name": "Larsen & Toubro", "ticker": "LT.NS"},
            {"name": "Siemens Ltd", "ticker": "SIEMENS.NS"},
            {"name": "Cummins India", "ticker": "CUMMINSIND.NS"}
        ],
        "healthcare": [
            {"name": "Sun Pharma", "ticker": "SUNPHARMA.NS"},
            {"name": "Dr Reddy's Labs", "ticker": "DRREDDY.NS"},
            {"name": "Cipla Ltd", "ticker": "CIPLA.NS"}
        ]
    }

    normalized_sector = (target_profile.get("sector") or "").strip().lower()
    if normalized_sector in fallback_map:
        return fallback_map[normalized_sector]

    return [
        {"name": "Reliance Industries", "ticker": "RELIANCE.NS"},
        {"name": "Infosys Ltd", "ticker": "INFY.NS"},
        {"name": "HDFC Bank Ltd", "ticker": "HDFCBANK.NS"}
    ]

@app.get("/api/search-suggestions", tags=["Search"])
def get_search_suggestions(
    q: str = Query("", min_length=0, max_length=40),
    search_type: str = Query("all")
):
    query = q.strip()
    if not query:
        if search_type == "ipo":
            # Return popular open/upcoming IPO suggestions instantly on click
            return [
                {"symbol": "SWIGGY.NS", "name": "Swiggy Limited", "type": "ipo", "sector": "Consumer Services"},
                {"symbol": "FIRSTCRY.NS", "name": "Brainbees Solutions (FirstCry)", "type": "ipo", "sector": "Retail / E-Commerce"},
                {"symbol": "NTPCGREEN.NS", "name": "NTPC Green Energy", "type": "ipo", "sector": "Power / Renewable"},
                {"symbol": "HYUNDAI.NS", "name": "Hyundai Motor India", "type": "ipo", "sector": "Automobile"}
            ]
        return []

    results = []
    seen = set()

    search_queries = [
        query,
        query.upper(),
        f"{query} india",
    ]

    if search_type == "ipo":
        search_queries = [
            f"{query} ipo",
            f"{query} listed india",
            query
        ]

    for search_query in search_queries:
        try:
            search_results = yf.Search(search_query, max_results=20).quotes
            for quote in search_results:
                if not looks_like_indian_equity(quote):
                    continue

                symbol = (quote.get("symbol") or "").upper()
                if symbol in seen:
                    continue

                if search_type == "ipo" and not is_probable_ipo_result(quote):
                    continue

                item = {
                    "symbol": symbol,
                    "name": clean_text(quote.get("shortname") or quote.get("longname") or symbol),
                    "type": "ipo" if search_type == "ipo" else "equity",
                    "sector": clean_text(quote.get("sector") or quote.get("typeDisp") or "Indian Market"),
                    "_score": score_search_result(query, quote, search_type)
                }

                results.append(item)
                seen.add(symbol)
        except Exception:
            continue

    if not results:
        formatted_symbol = query.upper() if "." in query else f"{query.upper()}.NS"
        return [{
            "symbol": formatted_symbol,
            "name": query.upper(),
            "type": search_type,
            "sector": "Indian Equities"
        }]

    results.sort(key=lambda x: (-x["_score"], len(x["name"]), x["symbol"]))

    final_results = []
    final_seen = set()
    for item in results:
        key = item["symbol"]
        if key in final_seen:
            continue
        final_seen.add(key)
        final_results.append({
            "symbol": item["symbol"],
            "name": item["name"],
            "type": item["type"],
            "sector": item["sector"]
        })

    return final_results[:8]

@app.get("/api/company-data", tags=["Market Analytics"])
def get_company_data(symbol: str, period: str = "1y", is_ipo: bool = False):
    symbol = normalize_symbol(symbol)

    try:
        stock = yf.Ticker(symbol)
        info = stock.info

        # Extract real-time news via yfinance
        raw_news = []
        try:
            raw_news = stock.news or []
        except Exception:
            raw_news = []

        formatted_news = []
        for item in raw_news[:5]:
            if isinstance(item, dict):
                title = item.get("title") or ""
                publisher = item.get("publisher") or ""
                link = item.get("link") or ""
                pub_time = item.get("providerPublishTime") or ""
                if title:
                    formatted_news.append({
                        "title": title,
                        "publisher": publisher,
                        "link": link,
                        "time": pub_time
                    })

        yf_period_map = {
            "1m": "1mo", "2m": "2mo", "1q": "3mo", "2q": "6mo",
            "1y": "1y", "3y": "3y", "all": "max"
        }
        yf_period = yf_period_map.get(period.lower(), "1y")

        hist = stock.history(period=yf_period)
        history_data = []
        if not hist.empty:
            for date, row in hist.iterrows():
                history_data.append({
                    "date": date.strftime("%Y-%m-%d"),
                    "price": round(float(row["Close"]), 2)
                })

        current_price = info.get("currentPrice") or info.get("regularMarketPrice") or (hist["Close"].iloc[-1] if not hist.empty else 100.0)
        market_cap = info.get("marketCap", 100000000000)

        raw_summary = info.get("longBusinessSummary") or f"{info.get('longName', symbol)} is a registered entity operating within the Indian equity markets across the {info.get('sector', 'General Business')} sector, driving operational growth and value creation."
        words = raw_summary.split()
        summary = " ".join(words[:135]) + "..." if len(words) > 140 else raw_summary

        # These fallback metrics stay so the JSON payload doesn't break
        pe_ratio = info.get("trailingPE") or 22.0
        pb_ratio = info.get("priceToBook") or 3.5
        eps = info.get("trailingEps") or (current_price / pe_ratio if pe_ratio else 10.0)
        roe = (info.get("returnOnEquity") * 100) if info.get("returnOnEquity") else 15.2
        debt_to_equity = (info.get("debtToEquity") / 100.0) if info.get("debtToEquity") else 0.45
        current_ratio = info.get("currentRatio") or 1.5
        profit_margins = (info.get("profitMargins") * 100) if info.get("profitMargins") else 12.5
        dividend_yield = (info.get("dividendYield") * 100) if info.get("dividendYield") else 1.2
        ev_to_ebitda = info.get("enterpriseToEbitda") or 14.5
        operating_margins = (info.get("operatingMargins") * 100) if info.get("operatingMargins") else 16.8
        peg_ratio = info.get("pegRatio") or 1.15
        roce = roe * 1.1

        company_name = info.get("longName") or info.get("shortName") or symbol
        sector = info.get("sector") or "Indian Equities"
        industry = info.get("industry") or ""

        buy_score = 65 if roe >= 15 else 45
        if profit_margins >= 12:
            buy_score += 15
        if debt_to_equity > 1.2:
            buy_score -= 20

        buy_pct = max(15, min(80, buy_score))
        sell_pct = max(10, min(35, 100 - buy_pct - 20))
        hold_pct = 100 - (buy_pct + sell_pct)
        consensus_label = "Strong Buy" if buy_pct >= 65 else "Buy" if buy_pct >= 50 else "Hold" if hold_pct >= 30 else "Sell"

        # --- FIXED VALUATION LOGIC ---
        # This replaces the recursive EPS logic that was forcing exactly 11.11% on missing data
        target_mean = info.get("targetMeanPrice")
        
        if target_mean and target_mean > 0:
            fair_price = float(target_mean)
        else:
            book_val = info.get("bookValue")
            if book_val and book_val > 0:
                # Modest premium to book value as a safe baseline proxy
                fair_price = float(book_val * 1.5)
            else:
                # If all else fails, assume market is pricing it fairly rather than throwing a false 11.11% error
                fair_price = current_price
        
        pct_diff = ((current_price - fair_price) / fair_price) * 100 if fair_price else 0
        
        if pct_diff > 2.0:
            valuation_status = f"Overpriced by {abs(pct_diff):.2f}%"
            valuation_detail = f"Trading above estimated fair value benchmark (₹{fair_price:.2f})."
        elif pct_diff < -2.0:
            valuation_status = f"Discounted by {abs(pct_diff):.2f}%"
            valuation_detail = f"Trading below estimated fair price (₹{fair_price:.2f})."
        else:
            valuation_status = "Fairly Valued"
            valuation_detail = f"Trading near estimated fair value benchmark (₹{fair_price:.2f})."
        # -----------------------------

        green_flags = []
        red_flags = []
        if roe >= 15:
            green_flags.append(f"Strong Return on Equity ({roe:.2f}%).")
        else:
            red_flags.append(f"Sub-par Return on Equity ({roe:.2f}%).")

        if debt_to_equity <= 1.0:
            green_flags.append(f"Low Risk Debt Profile ({debt_to_equity:.2f}x).")
        else:
            red_flags.append(f"High Financial Debt ({debt_to_equity:.2f}x).")

        if profit_margins >= 10:
            green_flags.append(f"Robust Profit Margin ({profit_margins:.2f}%).")
        else:
            red_flags.append(f"Thin Net Profit Margin ({profit_margins:.2f}%).")

        peers_meta = get_universal_market_peers(
            symbol=symbol,
            sector=sector,
            industry=industry,
            summary=raw_summary
        )

        peers_processed = []
        for p in peers_meta:
            if p["ticker"] == symbol:
                continue
            try:
                p_stock = yf.Ticker(p["ticker"])
                p_info = p_stock.info
                p_hist = p_stock.history(period=yf_period)
                # Fixed syntax error in round(float(...)) here
                p_history_data = [{"date": d.strftime("%Y-%m-%d"), "price": round(float(r["Close"]), 2)} for d, r in p_hist.iterrows()] if not p_hist.empty else history_data
                peers_processed.append({
                    "name": p["name"],
                    "ticker": p["ticker"],
                    "price": p_info.get("currentPrice") or p_info.get("regularMarketPrice") or (current_price * 0.95),
                    "mcap": p_info.get("marketCap", market_cap * 0.8),
                    "history": p_history_data
                })
            except Exception:
                pass

        return {
            "company_name": company_name,
            "symbol": symbol,
            "sector": sector,
            "summary": summary,
            "is_ipo": is_ipo,
            "recommendations": {
                "buy_pct": buy_pct,
                "hold_pct": hold_pct,
                "sell_pct": sell_pct,
                "consensus": consensus_label
            },
            "metrics": {
                "current_price": current_price,
                "market_cap": market_cap,
                "pe_ratio": pe_ratio,
                "pb_ratio": pb_ratio,
                "roe": roe,
                "roce": roce,
                "eps": eps,
                "debt_to_equity": debt_to_equity,
                "current_ratio": current_ratio,
                "profit_margins": profit_margins,
                "dividend_yield": dividend_yield,
                "ev_to_ebitda": ev_to_ebitda,
                "operating_margins": operating_margins,
                "peg_ratio": peg_ratio,
                "asset_turnover": round(current_price / (eps * 5) if eps else 0.85, 2),
                "fair_price": round(fair_price, 2),
                "valuation_status": valuation_status,
                "valuation_detail": valuation_detail
            },
            "green_flags": green_flags,
            "red_flags": red_flags,
            "history": history_data,
            "peers": peers_processed,
            "news": formatted_news
        }

    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Error fetching data for ticker {symbol}: {str(e)}")
