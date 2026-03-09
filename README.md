# Pip Badger Trading Bot

A world-class algorithmic forex trading platform with advanced trading strategies and ultra-modern UI design.

![Pip Badger](https://img.shields.io/badge/Pip-Badger-indigo)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌐 Live Demo

**Frontend Dashboard**: [https://4lbpaylj7o2oc.ok.kimi.link](https://4lbpaylj7o2oc.ok.kimi.link)

## ✨ Features

### Core ICT Strategy Implementation

1. **Market Structure Analysis**
   - Break of Structure (BOS) detection
   - Change of Character (CHOCH) identification
   - Higher High / Lower Low logic
   - Swing point detection with displacement candles

2. **Liquidity Pool Detection**
   - Equal highs/lows identification
   - Previous day/week high-low tracking
   - Session-based liquidity analysis
   - Sweep and rejection confirmation

3. **Fair Value Gaps (FVG)**
   - 3-candle imbalance detection
   - Bullish and bearish FVG identification
   - Minimum imbalance size filtering
   - Volume displacement confirmation

4. **Order Blocks**
   - Last opposing candle before displacement
   - Volume spike confirmation
   - Institutional footprint detection (wick rejection)
   - Mitigation tracking

5. **Optimal Trade Entry (OTE)**
   - Fibonacci 0.62-0.79 retracement zones
   - Confluence with OB + FVG
   - Dynamic zone calculation

6. **Kill Zones**
   - London session (8:00 - 11:00 UTC)
   - New York session (9:30 - 12:00 EST)
   - London-NY overlap (highest probability)
   - Session-based signal filtering

### Multi-Layer Confirmation Engine

To achieve 70-80% accuracy, the system requires:

| Layer | Requirement |
|-------|-------------|
| 1 | HTF Bias (4H/1H structure direction) |
| 2 | Liquidity Sweep (Stop hunt confirmed) |
| 3 | Displacement (Strong candle) |
| 4 | FVG Present (Valid imbalance) |
| 5 | OB Alignment (Order block confluence) |
| 6 | OTE Zone (Fib retracement hit) |
| 7 | Session Filter (London/NY only) |

### Risk Management Engine

- **Position Sizing**: Kelly Criterion + Risk Limits
- **Max Risk Per Trade**: 2% (configurable)
- **Max Daily Risk**: 6% (configurable)
- **Max Daily Loss**: 4% (configurable)
- **Kill Switch**: Auto-halt after 3 consecutive losses
- **Drawdown Protection**: Weekly limit at 8%
- **Margin Management**: Max 50% usage

### Execution Engine

- WebSocket live price feeds
- Slippage tolerance control (0.1% max)
- Limit orders at OTE zones
- Smart re-entry logic
- Partial fill handling
- Retry mechanism (3 attempts)

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Dashboard  │  │   Signals   │  │      Positions          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Analytics  │  │  Settings   │  │    Real-time Charts     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket / REST
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              ICT Strategy Engine (Python)                │    │
│  │  - Market Structure Analyzer                             │    │
│  │  - Liquidity Analyzer                                    │    │
│  │  - FVG Analyzer                                          │    │
│  │  - Order Block Detector                                  │    │
│  │  - OTE Calculator                                        │    │
│  │  - Session Filter                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Risk Management Engine                      │    │
│  │  - Position Sizing (Kelly Criterion)                     │    │
│  │  - Portfolio Heat Management                             │    │
│  │  - Kill Switch Mechanism                                 │    │
│  │  - Drawdown Protection                                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Execution Engine                            │    │
│  │  - Smart Order Routing                                   │    │
│  │  - Slippage Control                                      │    │
│  │  - Partial Fill Handling                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MARKET DATA (ccxt)                           │
│  - Binance API                                                   │
│  - WebSocket Feeds                                               │
│  - Real-time Tickers                                             │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- npm or yarn

### Frontend Setup

```bash
cd app
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

### Environment Variables

Create `.env` file in the app directory:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## 📊 Performance Targets

| Metric | Target |
|--------|--------|
| Win Rate | 65-75% |
| Risk/Reward | 1:3 minimum |
| Max Drawdown | < 8% |
| Daily Loss Limit | 4% |
| Sharpe Ratio | > 1.5 |

## 🛡 Risk Model

The risk model is what makes this system elite:

1. **1:3 Risk-to-Reward Minimum** - Every trade must have at least 3:1 reward potential
2. **2% Max Risk Per Trade** - Never risk more than 2% of account on a single trade
3. **Daily Loss Cap** - Stop trading after 4% daily loss
4. **Weekly Drawdown Guard** - Halt after 8% weekly drawdown
5. **Kill Switch** - Auto-stop after 3 consecutive losses

## 🔧 Configuration

### Risk Settings

- Max Risk Per Trade: 0.5% - 5%
- Max Daily Risk: 2% - 15%
- Max Daily Loss: 1% - 10%
- Kill Switch Losses: 1 - 10 trades

### Strategy Settings

- Min Confidence: 50% - 90%
- Required Confluence: 2 - 6 factors
- Kill Zone Trading: On/Off
- Volume Confirmation: On/Off
- Session Filter: On/Off

## 📈 ICT Concepts Implemented

### 1. Market Structure
- Swing high/low detection with 5-bar lookback
- BOS confirmation with displacement candles
- CHOCH identification for trend changes

### 2. Liquidity Pools
- Equal highs/lows detection (3+ touches)
- Sweep confirmation with rejection
- Previous session high/low tracking

### 3. Fair Value Gaps
- 3-candle imbalance detection
- Minimum gap size filtering
- Displacement strength confirmation
- Mitigation tracking

### 4. Order Blocks
- Last opposing candle identification
- Volume spike confirmation (1.5x average)
- Wick rejection detection
- BOS causality verification

### 5. OTE Zones
- Fibonacci 0.618 - 0.79 retracement
- Confluence with OB and FVG
- Dynamic zone calculation per swing

### 6. Kill Zones
- London: 08:00 - 11:00 UTC
- New York: 09:30 - 12:00 EST
- Overlap: 09:30 - 11:00 EST (highest probability)

## 🧪 Backtesting

The system includes a 3-year backtest capability with:
- Monte Carlo simulation
- Slippage modeling
- Spread widening simulation
- Forward testing on demo

## 🔐 Security

- OAuth 2.0 / JWT Authentication
- Role-based access control
- TLS encryption
- Rate limiting
- API key encryption at rest

## 📱 Tech Stack

### Frontend
- React 18 + TypeScript
- Tailwind CSS
- shadcn/ui components
- Zustand state management
- Recharts for visualization
- WebSocket client

### Backend
- FastAPI (Python)
- WebSocket support
- ccxt for exchange integration
- Pandas/NumPy for data analysis
- Async/await architecture

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This software is for educational purposes only. Trading cryptocurrencies carries significant risk. Never trade with money you cannot afford to lose. Past performance does not guarantee future results.

---

**Built with precision. Trade with confidence.**
#   P i p - B a d g e r  
 