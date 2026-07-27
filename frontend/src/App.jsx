import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const historicalInflationData = [
  { year: 2026, rate: "4.38% (YTD)" }, { year: 2025, rate: "2.18%" }, { year: 2024, rate: "4.98%" },
  { year: 2023, rate: "5.65%" }, { year: 2022, rate: "6.68%" }, { year: 2021, rate: "5.14%" },
  { year: 2020, rate: "6.62%" }, { year: 2019, rate: "3.75%" }, { year: 2018, rate: "3.92%" },
  { year: 2017, rate: "3.33%" }, { year: 2016, rate: "4.97%" }, { year: 1998, rate: "13.23%" }
];

export default function App() {
  const [symbol, setSymbol] = useState('RELIANCE.NS');

  const [stockSearchInput, setStockSearchInput] = useState('');
  const [ipoSearchInput, setIpoSearchInput] = useState('');
  const [stockSuggestions, setStockSuggestions] = useState([]);
  const [ipoSuggestions, setIpoSuggestions] = useState([]);
  const [showStockDropdown, setShowStockDropdown] = useState(false);
  const [showIpoDropdown, setShowIpoDropdown] = useState(false);

  const stockBoxRef = useRef(null);
  const ipoBoxRef = useRef(null);

  const [timeframe, setTimeframe] = useState('1y');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartUpdating, setChartUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [overlayTickers, setOverlayTickers] = useState([]);

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (stockBoxRef.current && !stockBoxRef.current.contains(event.target)) {
        setShowStockDropdown(false);
      }
      if (ipoBoxRef.current && !ipoBoxRef.current.contains(event.target)) {
        setShowIpoDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const q = stockSearchInput.trim();

    if (q.length < 2) {
      setStockSuggestions([]);
      setShowStockDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/search-suggestions', {
          params: { q, search_type: 'equity' }
        });
        setStockSuggestions(res.data || []);
        setShowStockDropdown((res.data || []).length > 0);
      } catch {
        setStockSuggestions([]);
        setShowStockDropdown(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [stockSearchInput]);

  useEffect(() => {
    const q = ipoSearchInput.trim();

    if (q.length < 2) {
      setIpoSuggestions([]);
      setShowIpoDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get('http://127.0.0.1:8000/api/search-suggestions', {
          params: { q, search_type: 'ipo' }
        });
        setIpoSuggestions(res.data || []);
        setShowIpoDropdown((res.data || []).length > 0);
      } catch {
        setIpoSuggestions([]);
        setShowIpoDropdown(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [ipoSearchInput]);

  const fetchData = async (targetSymbol, targetTimeframe, isTimeframeSwitch = false) => {
    try {
      if (isTimeframeSwitch) {
        setChartUpdating(true);
      } else {
        setLoading(true);
      }
      setError(null);
      setHoveredIndex(null);

      const response = await axios.get(`http://127.0.0.1:8000/api/company-data?symbol=${targetSymbol}&period=${targetTimeframe}`);
      setData(response.data);
      if (!isTimeframeSwitch) setOverlayTickers([]);
    } catch (err) {
      setError('Could not fetch ticker data. Try selecting a valid company from the live search list.');
    } finally {
      setLoading(false);
      setChartUpdating(false);
    }
  };

  useEffect(() => {
    fetchData(symbol, timeframe, false);
  }, [symbol]);

  const handleTimeframeChange = (newTf) => {
    setTimeframe(newTf);
    fetchData(symbol, newTf, true);
  };

  const selectTickerFromDropdown = (selectedSymbol, mode = 'stock') => {
    setSymbol(selectedSymbol);
    setShowStockDropdown(false);
    setShowIpoDropdown(false);
    setStockSuggestions([]);
    setIpoSuggestions([]);
    setStockSearchInput('');
    setIpoSearchInput('');
  };

  const toggleOverlay = (ticker) => {
    setOverlayTickers(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    );
  };

  const getIndexedData = (historyArray) => {
    if (!historyArray || historyArray.length === 0) return [];
    const basePrice = historyArray[0].price || 1;
    return historyArray.map(item => ({
      date: item.date,
      price: item.price,
      indexedPrice: Number(((item.price / basePrice) * 100).toFixed(2))
    }));
  };

  const targetIndexed = data?.history ? getIndexedData(data.history) : [];
  const allIndexedValues = targetIndexed.map(i => i.indexedPrice);

  data?.peers?.forEach(peer => {
    if (overlayTickers.includes(peer.ticker)) {
      const pInd = getIndexedData(peer.history);
      pInd.forEach(i => allIndexedValues.push(i.indexedPrice));
    }
  });

  const globalMin = allIndexedValues.length ? Math.min(...allIndexedValues) : 90;
  const globalMax = allIndexedValues.length ? Math.max(...allIndexedValues) : 110;

  const getChartPoints = (indexedArray, min, max, width = 580, height = 210) => {
    if (!indexedArray || indexedArray.length === 0) return [];
    if (indexedArray.length === 1) {
      return [{
        x: width / 2,
        y: height / 2,
        date: indexedArray[0].date,
        price: indexedArray[0].price,
        indexedPrice: indexedArray[0].indexedPrice
      }];
    }

    const range = max - min === 0 ? 1 : max - min;
    return indexedArray.map((item, index) => {
      const x = (index / (indexedArray.length - 1)) * (width - 70) + 50;
      const y = height - 30 - ((item.indexedPrice - min) / range) * (height - 50);
      return { x, y, date: item.date, price: item.price, indexedPrice: item.indexedPrice };
    });
  };

  const chartPoints = getChartPoints(targetIndexed, globalMin, globalMax);
  const chartPath = chartPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const isTargetPositive = targetIndexed.length > 1 && targetIndexed[targetIndexed.length - 1].indexedPrice >= targetIndexed[0].indexedPrice;
  const targetColor = isTargetPositive ? '#10b981' : '#e50914';

  const handleMouseMove = (e) => {
    if (!svgRef.current || chartPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * 580;

    let closestIdx = 0;
    let minDistance = Math.abs(mouseX - chartPoints[0].x);

    for (let i = 1; i < chartPoints.length; i++) {
      const dist = Math.abs(mouseX - chartPoints[i].x);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }
    setHoveredIndex(closestIdx);
  };

  const overlayColors = ["#3b82f6", "#f59e0b", "#a855f7"];

  const evaluateRatio = (name, num) => {
    if (num === null || num === undefined) return false;
    switch (name) {
      case 'P/E Ratio': return num >= 12 && num <= 30;
      case 'P/B Ratio': return num >= 1.0 && num <= 4.0;
      case 'ROE': return num >= 15.0;
      case 'ROCE': return num >= 15.0;
      case 'Net Margin': return num >= 10.0;
      case 'Operating Margin': return num >= 12.0;
      case 'Debt / Equity': return num < 1.0;
      case 'Current Ratio': return num >= 1.2;
      case 'EV / EBITDA': return num < 18.0;
      case 'PEG Ratio': return num <= 1.2;
      case 'Dividend Yield': return num >= 1.0;
      case 'Asset Turnover': return num >= 0.7;
      default: return true;
    }
  };

  const financialRatios = [
    {
      name: "P/E Ratio",
      num: data?.metrics?.pe_ratio,
      value: data?.metrics?.pe_ratio ? `${data.metrics.pe_ratio.toFixed(2)}x` : "N/A",
      range: "Healthy: 12-30x",
      def: "Price-to-Earnings: Measures valuation relative to earnings. Lower numbers indicate cheaper valuation."
    },
    {
      name: "P/B Ratio",
      num: data?.metrics?.pb_ratio,
      value: data?.metrics?.pb_ratio ? `${data.metrics.pb_ratio.toFixed(2)}x` : "N/A",
      range: "Healthy: 1-4x",
      def: "Price-to-Book: Compares market value to net tangible balance sheet assets."
    },
    {
      name: "ROE",
      num: data?.metrics?.roe,
      value: data?.metrics?.roe ? `${data.metrics.roe.toFixed(2)}%` : "N/A",
      range: "Healthy: > 15%",
      def: "Return on Equity: Profit generated for every rupee of shareholder equity."
    },
    {
      name: "ROCE",
      num: data?.metrics?.roce,
      value: data?.metrics?.roce ? `${data.metrics.roce.toFixed(2)}%` : "N/A",
      range: "Healthy: > 15%",
      def: "Return on Capital Employed: Efficiency of total capital (equity + debt) used in operations."
    },
    {
      name: "Net Margin",
      num: data?.metrics?.profit_margins,
      value: data?.metrics?.profit_margins ? `${data.metrics.profit_margins.toFixed(2)}%` : "N/A",
      range: "Healthy: > 10%",
      def: "Net Profit Margin: Percentage of total revenue left over after all operating expenses & tax."
    },
    {
      name: "Operating Margin",
      num: data?.metrics?.operating_margins,
      value: data?.metrics?.operating_margins ? `${data.metrics.operating_margins.toFixed(2)}%` : "N/A",
      range: "Healthy: > 12%",
      def: "Operating Profit Margin: Profitability from core business activities before interest and taxes."
    },
    {
      name: "Debt / Equity",
      num: data?.metrics?.debt_to_equity,
      value: data?.metrics?.debt_to_equity ? `${data.metrics.debt_to_equity.toFixed(2)}x` : "N/A",
      range: "Healthy: < 1.0x",
      def: "Debt-to-Equity: Solvency metric showing proportion of debt relative to shareholder equity."
    },
    {
      name: "Current Ratio",
      num: data?.metrics?.current_ratio,
      value: data?.metrics?.current_ratio ? `${data.metrics.current_ratio.toFixed(2)}x` : "N/A",
      range: "Healthy: > 1.2x",
      def: "Liquidity ratio measuring ability to pay short-term liabilities with current assets."
    },
    {
      name: "EV / EBITDA",
      num: data?.metrics?.ev_to_ebitda,
      value: data?.metrics?.ev_to_ebitda ? `${data.metrics.ev_to_ebitda.toFixed(2)}x` : "N/A",
      range: "Healthy: < 18x",
      def: "Enterprise Value to EBITDA: Normalizes debt differences for capital-heavy sector valuations."
    },
    {
      name: "PEG Ratio",
      num: data?.metrics?.peg_ratio,
      value: data?.metrics?.peg_ratio ? `${data.metrics.peg_ratio.toFixed(2)}` : "N/A",
      range: "Healthy: < 1.2",
      def: "Price/Earnings-to-Growth: Adjusts standard P/E by factoring expected earnings growth rate."
    },
    {
      name: "Dividend Yield",
      num: data?.metrics?.dividend_yield,
      value: data?.metrics?.dividend_yield ? `${data.metrics.dividend_yield.toFixed(2)}%` : "N/A",
      range: "Healthy: > 1.0%",
      def: "Annual dividend payouts paid back to stockholders expressed as a percentage of share price."
    },
    {
      name: "Asset Turnover",
      num: data?.metrics?.asset_turnover,
      value: data?.metrics?.asset_turnover ? `${data.metrics.asset_turnover.toFixed(2)}x` : "N/A",
      range: "Healthy: > 0.7x",
      def: "Efficiency metric measuring revenue generated per rupee of firm asset investments."
    }
  ];

  return (
    <div className="netflix-dashboard">
      <div className="netflix-header">
        <div className="brand-section">
          <h1 className="logo-text">STOX<span className="red-accent">FLIX</span></h1>
          <div className="company-subtitle">
            {data?.company_name || symbol} &bull; Sector: {data?.sector || 'Equities'}
          </div>
        </div>

        <div className="dual-search-container">
          <div className="search-box-wrapper" ref={stockBoxRef}>
            <span className="search-label">Equities:</span>
            <input
              type="text"
              value={stockSearchInput}
              onChange={(e) => setStockSearchInput(e.target.value)}
              placeholder="Search stocks by name or symbol..."
              className="netflix-search-input"
              autoComplete="off"
              onFocus={() => stockSuggestions.length > 0 && setShowStockDropdown(true)}
            />
            {showStockDropdown && stockSuggestions.length > 0 && (
              <div className="autocomplete-dropdown">
                {stockSuggestions.map((item) => (
                  <div
                    key={item.symbol}
                    className="suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectTickerFromDropdown(item.symbol, 'stock');
                    }}
                  >
                    <div>
                      <strong>{item.name}</strong> <span className="ticker-badge">{item.symbol}</span>
                    </div>
                    <div className="sector-tag">{item.sector}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="search-box-wrapper" ref={ipoBoxRef}>
            <span className="search-label ipo-tag">IPO Search:</span>
            <input
              type="text"
              value={ipoSearchInput}
              onChange={(e) => setIpoSearchInput(e.target.value)}
              placeholder="Search IPO / recently listed company..."
              className="netflix-search-input ipo-input"
              autoComplete="off"
              onFocus={() => ipoSuggestions.length > 0 && setShowIpoDropdown(true)}
            />
            {showIpoDropdown && ipoSuggestions.length > 0 && (
              <div className="autocomplete-dropdown ipo-dropdown">
                {ipoSuggestions.map((item) => (
                  <div
                    key={item.symbol}
                    className="suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectTickerFromDropdown(item.symbol, 'ipo');
                    }}
                  >
                    <div>
                      <strong>{item.name}</strong> <span className="ticker-badge ipo">{item.symbol}</span>
                    </div>
                    <div className="sector-tag">{item.sector}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-screen">Loading market intelligence feed...</div>
      ) : data ? (
        <>
          <div className="top-company-summary-card">
            <div className="summary-header">
              <span className="summary-title">🏢 Company Overview & Business Model</span>
              <span className="summary-ticker-tag">{data.symbol}</span>
            </div>
            <p className="summary-text">{data.summary}</p>
          </div>

          <div className="dashboard-grid-2col">
            <div className="grid-column">
              <div className="section-title">Valuation & Market Status</div>
              <div className="valuation-banner-grid">
                <div className={`valuation-status-card ${data.metrics.valuation_status.includes('Discounted') ? 'green' : data.metrics.valuation_status.includes('Overpriced') ? 'red' : 'blue'}`}>
                  <div className="val-title">Valuation Model</div>
                  <div className="val-headline">{data.metrics.valuation_status}</div>
                  <div className="val-desc">{data.metrics.valuation_detail}</div>
                </div>
                <div className="netflix-metric-card">
                  <div className="metric-title">Fair Target</div>
                  <div className="metric-value highlight">₹{data.metrics.fair_price?.toLocaleString()}</div>
                </div>
                <div className="netflix-metric-card">
                  <div className="metric-title">Current Price</div>
                  <div className="metric-value">₹{data.metrics.current_price?.toLocaleString()}</div>
                </div>
              </div>

              <div className="section-title-flex" style={{ marginTop: '20px' }}>
                <span>Interactive Price Chart {chartUpdating && <span className="chart-updating-pill">Updating...</span>}</span>
                <div className="timeframe-buttons">
                  {[{ label: "1M", val: "1m" }, { label: "1Q", val: "1q" }, { label: "1Y", val: "1y" }, { label: "3Y", val: "3y" }, { label: "All", val: "all" }].map((tf) => (
                    <button key={tf.val} className={`tf-btn ${timeframe === tf.val ? 'active' : ''}`} onClick={() => handleTimeframeChange(tf.val)}>
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="netflix-chart-box">
                <div className="chart-tracker-header">
                  {hoveredIndex !== null && chartPoints[hoveredIndex] ? (
                    <div className="multi-tracker-bar">
                      <span className="tracker-date">📅 {chartPoints[hoveredIndex].date}:</span>
                      <span style={{ color: targetColor }} className="tracker-stock">
                        {symbol.split('.')[0]}: <strong>₹{chartPoints[hoveredIndex].price}</strong>
                      </span>
                      {data.peers?.map((peer, idx) => {
                        if (!overlayTickers.includes(peer.ticker)) return null;
                        const pHistory = peer.history;
                        const pPoint = pHistory[hoveredIndex] || pHistory[pHistory.length - 1];
                        return (
                          <span key={peer.ticker} style={{ color: overlayColors[idx % overlayColors.length] }} className="tracker-peer">
                            {peer.ticker.split('.')[0]}: <strong>₹{pPoint?.price || 'N/A'}</strong>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="tracker-instruction">Move cursor across chart to inspect stock & peer overlay prices</div>
                  )}
                </div>

                <svg
                  ref={svgRef}
                  viewBox="0 0 580 210"
                  className="svg-canvas-large"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <line x1="50" y1="20" x2="580" y2="20" stroke="#262626" strokeDasharray="3" />
                  <text x="5" y="24" fill="#8c8c8c" fontSize="10">{globalMax.toFixed(0)}</text>

                  <line x1="50" y1="100" x2="580" y2="100" stroke="#262626" strokeDasharray="3" />
                  <text x="5" y="104" fill="#8c8c8c" fontSize="10">{((globalMin + globalMax) / 2).toFixed(0)}</text>

                  <line x1="50" y1="180" x2="580" y2="180" stroke="#404040" />
                  <text x="5" y="184" fill="#8c8c8c" fontSize="10">{globalMin.toFixed(0)}</text>

                  <line x1="50" y1="10" x2="50" y2="180" stroke="#404040" />

                  {chartPoints.length > 0 && (
                    <g className="x-axis-labels">
                      <text x="50" y="198" fill="#8c8c8c" fontSize="9">{chartPoints[0].date}</text>
                      <text x="280" y="198" fill="#8c8c8c" fontSize="9" textAnchor="middle">{chartPoints[Math.floor(chartPoints.length / 2)].date}</text>
                      <text x="575" y="198" fill="#8c8c8c" fontSize="9" textAnchor="end">{chartPoints[chartPoints.length - 1].date}</text>
                    </g>
                  )}

                  {data.peers && data.peers.map((peer, idx) => {
                    if (overlayTickers.includes(peer.ticker)) {
                      const pInd = getIndexedData(peer.history);
                      const pPts = getChartPoints(pInd, globalMin, globalMax);
                      const pPath = pPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                      return <path key={peer.ticker} d={pPath} fill="none" stroke={overlayColors[idx % overlayColors.length]} strokeWidth="2" strokeDasharray="4" />;
                    }
                    return null;
                  })}

                  <path d={chartPath} fill="none" stroke={targetColor} strokeWidth="3" />

                  {hoveredIndex !== null && chartPoints[hoveredIndex] && (
                    <g>
                      <line x1={chartPoints[hoveredIndex].x} y1="10" x2={chartPoints[hoveredIndex].x} y2="180" stroke="#ffffff" strokeDasharray="2" strokeWidth="1" />
                      <circle cx={chartPoints[hoveredIndex].x} cy={chartPoints[hoveredIndex].y} r="5" fill="#ffffff" stroke={targetColor} strokeWidth="2" />

                      {data.peers?.map((peer, idx) => {
                        if (!overlayTickers.includes(peer.ticker)) return null;
                        const pInd = getIndexedData(peer.history);
                        const pPts = getChartPoints(pInd, globalMin, globalMax);
                        if (pPts[hoveredIndex]) {
                          return (
                            <circle
                              key={peer.ticker}
                              cx={pPts[hoveredIndex].x}
                              cy={pPts[hoveredIndex].y}
                              r="4"
                              fill={overlayColors[idx % overlayColors.length]}
                            />
                          );
                        }
                        return null;
                      })}
                    </g>
                  )}
                </svg>
              </div>

              <div className="section-title" style={{ marginTop: '20px' }}>Direct Product & Sector Peers</div>
              <div className="table-container">
                <table className="netflix-table">
                  <thead>
                    <tr>
                      <th>Overlay</th>
                      <th>Company</th>
                      <th>Ticker</th>
                      <th>Price (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="active-row">
                      <td><span className="tag target" style={{ background: targetColor }}>MAIN</span></td>
                      <td><strong>{data.company_name}</strong></td>
                      <td>{data.symbol}</td>
                      <td>₹{data.metrics.current_price?.toLocaleString()}</td>
                    </tr>
                    {data.peers && data.peers.map((peer) => (
                      <tr key={peer.ticker}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={overlayTickers.includes(peer.ticker)}
                            onChange={() => toggleOverlay(peer.ticker)}
                            className="netflix-checkbox"
                            aria-label={`Overlay ${peer.name}`}
                          />
                        </td>
                        <td>{peer.name}</td>
                        <td>{peer.ticker}</td>
                        <td>₹{peer.price?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid-column">
              <div className="section-title">Analyst Consensus Recommendation</div>
              <div className="recommendation-box">
                <div className="rec-header">
                  <span>Rating Distribution</span>
                  <span className={`consensus-badge ${data.recommendations.consensus.toLowerCase().replace(/ /g, '-')}`}>
                    {data.recommendations.consensus}
                  </span>
                </div>
                <div className="rec-bar-container" aria-label="Analyst recommendation distribution">
                  <div
                    className="rec-segment buy"
                    style={{ width: `${data.recommendations.buy_pct}%` }}
                    title={`Buy ${data.recommendations.buy_pct}%`}
                  />
                  <div
                    className="rec-segment hold"
                    style={{ width: `${data.recommendations.hold_pct}%` }}
                    title={`Hold ${data.recommendations.hold_pct}%`}
                  />
                  <div
                    className="rec-segment sell"
                    style={{ width: `${data.recommendations.sell_pct}%` }}
                    title={`Sell ${data.recommendations.sell_pct}%`}
                  />
                </div>
              </div>

              <div className="section-title" style={{ marginTop: '20px' }}>Fundamental Flags</div>
              <div className="flags-grid">
                <div className="flag-card green-flag-box">
                  <div className="flag-header green-header">🟢 Green Flags</div>
                  <ul className="flag-list">
                    {data.green_flags.map((flag, idx) => <li key={idx}>✓ {flag}</li>)}
                  </ul>
                </div>
                <div className="flag-card red-flag-box">
                  <div className="flag-header red-header">🔴 Red Flags</div>
                  <ul className="flag-list">
                    {data.red_flags.map((flag, idx) => <li key={idx}>⚠ {flag}</li>)}
                  </ul>
                </div>
              </div>

              <div className="section-title" style={{ marginTop: '20px' }}>Key Financial Ratios (12 Metrics)</div>
              <div className="ratios-grid">
                {financialRatios.map((ratio, index) => {
                  const isGood = evaluateRatio(ratio.name, ratio.num);
                  return (
                    <div key={index} className="netflix-ratio-card">
                      <div className="ratio-header-row">
                        <span className="ratio-name">{ratio.name}</span>
                        <span className="info-icon" title={ratio.def}>ⓘ</span>
                      </div>
                      <div className={isGood ? "value-good" : "value-bad"}>{ratio.value}</div>
                      <div className="ratio-range">{ratio.range}</div>
                      <div className="ratio-def">{ratio.def}</div>
                    </div>
                  );
                })}
              </div>

              <div className="section-title" style={{ marginTop: '20px' }}>Macro Inflation Benchmarks (India CPI)</div>
              <div className="table-container">
                <table className="netflix-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Inflation Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalInflationData.slice(0, 5).map((row) => (
                      <tr key={row.year}>
                        <td>{row.year}</td>
                        <td style={{ color: parseFloat(row.rate) > 6 ? '#e50914' : '#10b981', fontWeight: 'bold' }}>
                          {row.rate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}