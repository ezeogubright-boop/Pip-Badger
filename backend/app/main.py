"""
Pip Badger Trading Bot - FastAPI Backend
FX trading engine with WebSocket support
"""

import asyncio
import json
import sys
import os
from typing import Dict, List, Optional
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging

logger = logging.getLogger(__name__)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Graceful import handling for optional dependencies
try:
    from app.engines.ict_engine import get_ict_engine, ICTSignal, SignalType
except ImportError as e:
    logger.warning(f"Could not import ICT engine: {e}")
    get_ict_engine = lambda: None
    ICTSignal = None
    SignalType = None

try:
    from app.engines.risk_engine import get_risk_engine, RiskMetrics, RiskLevel, Position
except ImportError as e:
    logger.warning(f"Could not import risk engine: {e}")
    get_risk_engine = lambda: None
    RiskMetrics = None
    RiskLevel = None
    Position = None

try:
    from app.engines.execution_engine import get_execution_engine, Order, OrderType
except ImportError as e:
    logger.warning(f"Could not import execution engine: {e}")
    get_execution_engine = lambda: None
    Order = None
    OrderType = None

try:
    from app.engines.mt5_service import get_mt5_service
except ImportError as e:
    logger.warning(f"Could not import MT5 service: {e}")
    get_mt5_service = lambda: None


# Pydantic models for API
class SignalRequest(BaseModel):
    symbol: str
    timeframe: str = "15m"
    htf_timeframe: str = "1h"


class TradeRequest(BaseModel):
    symbol: str
    direction: str
    entry_price: float
    stop_loss: float
    take_profit: float
    confidence: float


class RiskConfig(BaseModel):
    max_risk_per_trade: float = 2.0
    max_daily_risk: float = 6.0
    max_daily_loss: float = 4.0
    kill_switch_losses: int = 3


class MarketData(BaseModel):
    symbol: str
    price: float
    change_24h: float
    volume_24h: float
    high_24h: float
    low_24h: float


# Global state
app_state = {
    'connected_clients': [],
    'market_data': {},
    'active_signals': [],
    'positions': [],
    'is_running': False
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    app_state['is_running'] = True
    
    try:
        # Initialize engines
        ict_engine = get_ict_engine()
        risk_engine = get_risk_engine(initial_balance=100000.0)
        exec_engine = get_execution_engine()
        
        if ict_engine is None or risk_engine is None:
            logger.error("Failed to initialize trading engines")
            raise RuntimeError("Engine initialization failed")
        
        # Initialize MT5
        mt5_service = get_mt5_service()
        if mt5_service is None:
            logger.warning("MT5 service unavailable - using simulation mode")
        elif mt5_service.connected:
            logger.info("📡 MT5 Connected – Live market data active")
            # Sync balance from real MT5 account
            try:
                acct = mt5_service.get_account_info()
                if acct:
                    real_balance = acct.get("balance", 100000.0)
                    risk_engine.initial_balance = real_balance
                    risk_engine.current_balance = real_balance
                    logger.info(f"💰 MT5 Balance synced: ${real_balance:,.2f}")
            except Exception as e:
                logger.warning(f"Could not sync MT5 balance: {e}")
            
            # Sync any existing MT5 positions into risk engine
            try:
                mt5_positions = mt5_service.get_mt5_positions()
                for mp in mt5_positions:
                    tid = str(mp["ticket"])
                    if tid not in risk_engine.positions:
                        risk_engine.positions[tid] = Position(
                            id=tid,
                            symbol=mp["symbol"],
                            direction=mp["direction"],
                            entry_price=mp["entry_price"],
                            current_price=mp["current_price"],
                            quantity=mp["volume"],
                            stop_loss=mp.get("sl", 0),
                            take_profit=mp.get("tp", 0),
                            risk_amount=0,
                            risk_percent=0,
                            open_time=datetime.now(),
                            lot_size=mp["volume"],
                            unrealized_pnl=mp.get("profit", 0),
                        )
                if mt5_positions:
                    logger.info(f"📋 Synced {len(mt5_positions)} existing MT5 positions")
            except Exception as e:
                logger.warning(f"Could not sync MT5 positions: {e}")
        else:
            logger.info("⚠️  MT5 not available – Using simulated data")
        
        # Start background tasks
        asyncio.create_task(broadcast_market_data())
        asyncio.create_task(monitor_positions())
        
        logger.info("🚀 Pip Badger API Started")
        logger.info("📊 Advanced forex trading engine")
        
    except Exception as e:
        logger.error(f"Startup error: {e}", exc_info=True)
        raise
    
    yield
    
    # Shutdown
    try:
        app_state['is_running'] = False
        if mt5_service:
            mt5_service.shutdown()
        if exec_engine:
            await exec_engine.close()
        logger.info("👋 Pip Badger API Stopped")
    except Exception as e:
        logger.error(f"Shutdown error: {e}", exc_info=True)


# Create FastAPI app
app = FastAPI(
    title="ICT Institutional Trading Bot",
    description="World-class algorithmic trading using ICT concepts",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ API Routes ============

@app.get("/")
async def root():
    """API status"""
    return {
        "status": "operational",
        "service": "ICT Institutional Trading Bot",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "mode": "production"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/status")
async def get_status():
    """Get system status"""
    try:
        risk_engine = get_risk_engine()
        exec_engine = get_execution_engine()
        
        if risk_engine is None:
            return {
                "system_status": "operational",
                "mode": "simulation",
                "trading_enabled": False,
                "error": "Trading engines not initialized",
                "timestamp": datetime.now().isoformat()
            }
        
        metrics = risk_engine.get_risk_metrics()
        exec_stats = exec_engine.get_execution_stats() if exec_engine else {}
        
        return {
            "system_status": "operational",
            "trading_enabled": risk_engine.trading_enabled,
            "kill_switch": risk_engine.kill_switch_triggered,
            "risk_level": metrics.risk_level.value if metrics else "unknown",
            "account": {
                "balance": metrics.account_balance if metrics else 0,
                "equity": metrics.equity if metrics else 0,
                "open_pnl": metrics.open_pnl if metrics else 0,
                "daily_pnl": metrics.daily_pnl if metrics else 0,
                "current_drawdown": metrics.current_drawdown if metrics else 0
            },
            "positions": {
                "open": len(risk_engine.positions) if risk_engine.positions else 0,
                "total_risk": metrics.total_risk_exposed if metrics else 0
            },
            "execution": exec_stats,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting status: {e}", exc_info=True)
        return {
            "system_status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@app.post("/api/analyze")
async def analyze_market(request: SignalRequest):
    """Analyze market using full ICT Smart Money Concepts engine"""
    try:
        ict_engine = get_ict_engine()
        mt5 = get_mt5_service()

        # Fetch real OHLCV data from MT5 (or simulation)
        raw_bars = mt5.get_ohlcv(request.symbol, request.timeframe, 300)
        htf_bars = mt5.get_ohlcv(request.symbol, request.htf_timeframe, 300)

        if not raw_bars:
            raise HTTPException(status_code=400, detail="No market data available")

        import pandas as pd

        def _to_df(bars):
            df = pd.DataFrame(bars)
            if 'time' in df.columns:
                df['time'] = pd.to_datetime(df['time'], unit='s', errors='coerce')
                df.set_index('time', inplace=True)
            for col in ('open', 'high', 'low', 'close', 'volume'):
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
            return df

        df = _to_df(raw_bars)
        htf_df = _to_df(htf_bars) if htf_bars else None

        # Run full SMC analysis
        smc = await ict_engine.get_smc_analysis(df, htf_df)

        return {
            "symbol": request.symbol,
            "timeframe": request.timeframe,
            "htf_timeframe": request.htf_timeframe,
            "smc_analysis": smc,
            "signals": smc.get('signals', []),
            "market_context": {
                "trend": smc['market_structure']['trend'],
                "htf_bias": smc['market_structure']['htf_bias'],
                "session": smc['kill_zones']['session'],
                "volatility_regime": smc['volatility_regime'],
            },
            "timestamp": datetime.now().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/signals/confirm")
async def confirm_signal(signal: Dict):
    """Confirm signal and generate trade recommendation"""
    ict_engine = get_ict_engine()
    
    # Create ICT signal from dict
    ict_signal = ICTSignal(
        type=SignalType.OTE,
        direction=signal.get('direction', 'long'),
        timestamp=datetime.now(),
        price=signal.get('price', 0),
        confidence=signal.get('confidence', 0.7),
        confluence_factors=signal.get('confluence_factors', [])
    )
    
    # Get trade recommendation
    recommendation = ict_engine.get_trade_recommendation(ict_signal)
    
    return {
        "signal_confirmed": True,
        "recommendation": recommendation,
        "risk_check": "pending"
    }


# ============ Smart Money Concepts Endpoints ============

@app.get("/api/smc/order-blocks/{symbol}")
async def get_order_blocks(symbol: str, timeframe: str = "15m", bars: int = 300):
    """Get detected order blocks and breaker blocks for a symbol."""
    smc = await _run_smc_analysis(symbol, timeframe, bars)
    return {
        "symbol": symbol, "timeframe": timeframe,
        "order_blocks": smc.get("order_blocks", []),
    }


@app.get("/api/smc/fvg/{symbol}")
async def get_fair_value_gaps(symbol: str, timeframe: str = "15m", bars: int = 300):
    """Get detected Fair Value Gaps (FVG) and Inverse FVGs."""
    smc = await _run_smc_analysis(symbol, timeframe, bars)
    return {
        "symbol": symbol, "timeframe": timeframe,
        "fair_value_gaps": smc.get("fair_value_gaps", []),
    }


@app.get("/api/smc/mss/{symbol}")
async def get_market_structure_shifts(symbol: str, timeframe: str = "15m", bars: int = 300):
    """Get Market Structure Shift (MSS) signals."""
    smc = await _run_smc_analysis(symbol, timeframe, bars)
    return {
        "symbol": symbol, "timeframe": timeframe,
        "market_structure": smc.get("market_structure", {}),
    }


@app.get("/api/smc/liquidity/{symbol}")
async def get_liquidity_levels(symbol: str, timeframe: str = "15m", bars: int = 300):
    """Get liquidity pools, PDH/PDL, PWH/PWL, and sweep detections."""
    smc = await _run_smc_analysis(symbol, timeframe, bars)
    return {
        "symbol": symbol, "timeframe": timeframe,
        "liquidity_pools": smc.get("liquidity_pools", []),
    }


@app.get("/api/smc/kill-zones")
async def get_kill_zones():
    """Get current kill zone status and all session definitions."""
    from app.engines.ict_engine import SessionFilter
    sf = SessionFilter()
    now = datetime.utcnow()
    return {
        "current_time_utc": now.isoformat(),
        "active_kill_zones": sf.get_active_kill_zones(now),
        "current_session": sf.get_current_session(now),
        "sessions": {
            name: {"start": s["start"].isoformat(), "end": s["end"].isoformat(),
                    "label": s["label"], "volatility": s["volatility"]}
            for name, s in sf.sessions.items()
        },
    }


@app.get("/api/smc/pivots/{symbol}")
async def get_pivots(symbol: str, timeframe: str = "1h", bars: int = 500, method: str = "classic"):
    """Get daily and weekly pivot points (classic or fibonacci)."""
    mt5 = get_mt5_service()
    raw = mt5.get_ohlcv(symbol, timeframe, bars)

    import pandas as pd
    from app.engines.ict_engine import PivotCalculator

    df = _bars_to_df(raw)
    pc = PivotCalculator()
    return {
        "symbol": symbol,
        "method": method,
        "daily_pivots": pc.daily_pivots(df, method),
        "weekly_pivots": pc.weekly_pivots(df, method),
    }


@app.get("/api/smc/judas-swing/{symbol}")
async def get_judas_swing(symbol: str, timeframe: str = "15m", bars: int = 300):
    """Detect Judas Swing (false session-open breakout)."""
    smc = await _run_smc_analysis(symbol, timeframe, bars)
    return {
        "symbol": symbol, "timeframe": timeframe,
        "judas_swing": smc.get("judas_swing"),
    }


@app.get("/api/smc/po3/{symbol}")
async def get_power_of_three(symbol: str, timeframe: str = "15m", bars: int = 300):
    """Get Power of Three (PO3) phase analysis."""
    smc = await _run_smc_analysis(symbol, timeframe, bars)
    return {
        "symbol": symbol, "timeframe": timeframe,
        "po3_phase": smc.get("po3_phase"),
    }


@app.get("/api/smc/full/{symbol}")
async def get_full_smc_analysis(
    symbol: str, timeframe: str = "15m", htf_timeframe: str = "1h", bars: int = 300
):
    """
    Full Smart Money Concepts analysis – all ICT indicators combined.
    Returns order blocks, FVGs, MSS, liquidity, kill zones, pivots,
    Judas Swing, PO3, and generated signals with confluence scoring.
    """
    try:
        mt5 = get_mt5_service()
        ict_engine = get_ict_engine()
        import pandas as pd

        raw = mt5.get_ohlcv(symbol, timeframe, bars)
        htf_raw = mt5.get_ohlcv(symbol, htf_timeframe, bars)

        if not raw:
            return {"symbol": symbol, "error": "No data", "signals": []}

        df = _bars_to_df(raw)
        htf_df = _bars_to_df(htf_raw) if htf_raw else None

        smc = await ict_engine.get_smc_analysis(df, htf_df)
        smc["symbol"] = symbol
        smc["timeframe"] = timeframe
        smc["htf_timeframe"] = htf_timeframe
        smc["timestamp"] = datetime.now().isoformat()

        # Ensure all values are JSON-serializable
        import json
        return json.loads(json.dumps(smc, default=str))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# Preferred scanning symbols (subset of what the broker offers).
# If a symbol is not available on the broker it is skipped automatically.
PREFERRED_SYMBOLS = [
    "XAUUSD", "US30", "US500", "GBPUSD", "EURUSD", "USDJPY",
    "AUDUSD", "NZDUSD", "USDCAD", "USDCHF",
]

# Categories that are less suitable for ICT SMC analysis
_SKIP_CATEGORIES = {"Stock"}


def _get_scannable_symbols() -> list[str]:
    """Return the intersection of PREFERRED_SYMBOLS and broker-available symbols."""
    mt5 = get_mt5_service()
    available = set(mt5.get_available_symbols())
    # Keep preferred order, filter to what the broker has
    symbols = [s for s in PREFERRED_SYMBOLS if s in available]
    # Also add any visible broker symbol not already included
    # (skip individual stocks – ICT signals are less meaningful there)
    for s in available:
        if s not in symbols and s not in _SKIP_CATEGORIES:
            symbols.append(s)
    return symbols


@app.get("/api/symbols")
async def get_symbols():
    """Return the list of symbols available for scanning."""
    return {"symbols": _get_scannable_symbols()}


@app.get("/api/smc/scan-all")
async def scan_all_markets(
    timeframe: str = "15m",
    htf_timeframe: str = "1h",
    bars: int = 300,
    min_confidence: float = 0.0,
):
    """
    Scan ALL symbols in parallel and return a unified list of signals
    sorted by confidence (highest first).  Each signal carries its symbol.
    Also returns per-symbol context summaries for the sidebar.
    """
    import json as _json

    mt5 = get_mt5_service()
    ict_engine = get_ict_engine()
    scan_symbols = _get_scannable_symbols()

    async def _analyse_one(symbol: str) -> dict:
        """Run full SMC on one symbol; never throws."""
        try:
            raw = mt5.get_ohlcv(symbol, timeframe, bars)
            htf_raw = mt5.get_ohlcv(symbol, htf_timeframe, bars)
            if not raw:
                return {"symbol": symbol, "signals": [], "error": "No data"}
            df = _bars_to_df(raw)
            htf_df = _bars_to_df(htf_raw) if htf_raw else None
            smc = await ict_engine.get_smc_analysis(df, htf_df)
            smc["symbol"] = symbol
            smc["timeframe"] = timeframe
            smc["htf_timeframe"] = htf_timeframe
            smc["timestamp"] = datetime.now().isoformat()
            # Make JSON-safe
            smc = _json.loads(_json.dumps(smc, default=str))
            return smc
        except Exception as exc:
            return {"symbol": symbol, "signals": [], "error": str(exc)}

    # Run all symbols concurrently
    results = await asyncio.gather(*[_analyse_one(s) for s in scan_symbols])

    # Build the unified signal list – inject symbol into each signal
    all_signals = []
    symbol_summaries = {}
    for smc in results:
        sym = smc.get("symbol", "?")
        for sig in smc.get("signals", []):
            sig["symbol"] = sym
            all_signals.append(sig)
        # Build a lightweight summary per symbol
        ms = smc.get("market_structure", {})
        kz = smc.get("kill_zones", {})
        symbol_summaries[sym] = {
            "trend": ms.get("trend", "neutral"),
            "htf_bias": ms.get("htf_bias", "neutral"),
            "session": kz.get("session", "off_session"),
            "kill_zone_active": kz.get("active", False),
            "volatility": smc.get("volatility_regime", "normal"),
            "signal_count": len(smc.get("signals", [])),
            "fresh_obs": len([o for o in smc.get("order_blocks", []) if not o.get("mitigated")]),
            "fresh_fvgs": len([f for f in smc.get("fair_value_gaps", []) if not f.get("mitigated")]),
            "liquidity_pools": len(smc.get("liquidity_pools", [])),
            "error": smc.get("error"),
        }

    # Sort by confidence descending
    all_signals.sort(key=lambda s: s.get("confidence", 0), reverse=True)

    # Optional filter
    if min_confidence > 0:
        all_signals = [s for s in all_signals if s.get("confidence", 0) >= min_confidence]

    return {
        "timestamp": datetime.now().isoformat(),
        "timeframe": timeframe,
        "htf_timeframe": htf_timeframe,
        "symbols_scanned": scan_symbols,
        "total_signals": len(all_signals),
        "signals": all_signals,
        "symbol_summaries": symbol_summaries,
        "per_symbol": {smc.get("symbol", "?"): smc for smc in results},
    }


# ============ Helper to run SMC analysis ============

def _bars_to_df(bars):
    """Convert raw bar list to a pandas DataFrame."""
    import pandas as pd
    df = pd.DataFrame(bars)
    if 'time' in df.columns:
        df['time'] = pd.to_datetime(df['time'], unit='s', errors='coerce')
        df.set_index('time', inplace=True)
    for col in ('open', 'high', 'low', 'close', 'volume'):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    return df


async def _run_smc_analysis(symbol: str, timeframe: str, bars: int) -> dict:
    """Convenience wrapper – fetch data & run the ICT engine."""
    mt5 = get_mt5_service()
    ict_engine = get_ict_engine()
    raw = mt5.get_ohlcv(symbol, timeframe, bars)
    if not raw:
        return {"error": "No data available", "signals": []}
    df = _bars_to_df(raw)
    return await ict_engine.get_smc_analysis(df)


@app.post("/api/trade/execute")
async def execute_trade(request: TradeRequest, background_tasks: BackgroundTasks):
    """Execute a trade on the real MT5 account with risk management."""
    risk_engine = get_risk_engine()
    mt5 = get_mt5_service()

    # ---- Risk check ----
    signal_data = {
        'symbol': request.symbol,
        'risk_percent': 2.0,
        'direction': request.direction,
    }
    can_trade, reason = risk_engine.can_open_position(signal_data)
    if not can_trade:
        return {"success": False, "error": reason, "risk_blocked": True}

    # ---- Calculate position size ----
    position_size = risk_engine.calculate_position_size(
        entry_price=request.entry_price,
        stop_loss=request.stop_loss,
        confidence=request.confidence,
    )

    # Determine lot size: use symbol's volume constraints
    sym_info = mt5.get_symbol_info(request.symbol)
    if sym_info and sym_info["trade_contract_size"]:
        contract_size = sym_info["trade_contract_size"]
        raw_lots = position_size["position_value"] / (request.entry_price * contract_size) if contract_size else 0.01
        lot_size = mt5._normalize_volume(request.symbol, raw_lots)
    else:
        lot_size = 0.01  # safe fallback

    # ---- Send real order to MT5 ----
    mt5_result = mt5.send_market_order(
        symbol=request.symbol,
        direction=request.direction,
        volume=lot_size,
        stop_loss=request.stop_loss,
        take_profit=request.take_profit,
        comment=f"Bot {request.direction} {request.confidence:.0%}",
    )

    if not mt5_result["success"]:
        return {
            "success": False,
            "error": f"MT5 order rejected: {mt5_result.get('error', 'unknown')}",
            "mt5_error": mt5_result.get("error"),
        }

    # ---- Track in risk engine (using MT5 ticket as ID) ----
    mt5_ticket = mt5_result["ticket"]
    fill_price = mt5_result.get("price", request.entry_price)
    fill_volume = mt5_result.get("volume", lot_size)

    position_data = {
        'id': str(mt5_ticket),
        'symbol': request.symbol,
        'direction': request.direction,
        'entry_price': fill_price,
        'stop_loss': request.stop_loss,
        'take_profit': request.take_profit,
        'quantity': fill_volume,
        'lot_size': fill_volume,
        'risk_amount': position_size['risk_amount'],
        'risk_percent': position_size['risk_percent'],
    }
    position = risk_engine.open_position(position_data)

    # Broadcast to WebSocket clients
    await broadcast_message({
        "type": "trade_executed",
        "data": {
            "position_id": str(mt5_ticket),
            "mt5_ticket": mt5_ticket,
            "symbol": request.symbol,
            "direction": request.direction,
            "entry": fill_price,
            "quantity": fill_volume,
            "lot_size": fill_volume,
            "stop_loss": request.stop_loss,
            "take_profit": request.take_profit,
            "risk": position_size['risk_amount'],
        },
    })

    return {
        "success": True,
        "mt5_ticket": mt5_ticket,
        "position": {
            "id": str(mt5_ticket),
            "symbol": request.symbol,
            "direction": request.direction,
            "entry_price": fill_price,
            "quantity": fill_volume,
            "lot_size": fill_volume,
            "stop_loss": request.stop_loss,
            "take_profit": request.take_profit,
            "risk_amount": position_size['risk_amount'],
            "risk_percent": position_size['risk_percent'],
        },
    }


@app.get("/api/positions")
async def get_positions():
    """Get all positions"""
    risk_engine = get_risk_engine()
    
    positions = []
    for pos in risk_engine.positions.values():
        positions.append({
            "id": pos.id,
            "symbol": pos.symbol,
            "direction": pos.direction,
            "entry_price": pos.entry_price,
            "current_price": pos.current_price,
            "quantity": pos.quantity,
            "lot_size": pos.lot_size,
            "unrealized_pnl": pos.unrealized_pnl,
            "stop_loss": pos.stop_loss,
            "take_profit": pos.take_profit,
            "risk_percent": pos.risk_percent,
            "open_time": pos.open_time.isoformat()
        })
    
    return {
        "open_positions": positions,
        "count": len(positions)
    }


@app.post("/api/positions/{position_id}/close")
async def close_position(position_id: str, exit_price: Optional[float] = None):
    """Close a position on MT5 and in risk engine."""
    risk_engine = get_risk_engine()
    mt5 = get_mt5_service()

    if position_id not in risk_engine.positions:
        raise HTTPException(status_code=404, detail="Position not found")

    position = risk_engine.positions[position_id]

    # Try to close on MT5 first (position_id is the MT5 ticket string)
    try:
        mt5_ticket = int(position_id)
        mt5_result = mt5.close_position_by_ticket(mt5_ticket)
        if not mt5_result["success"]:
            # If MT5 says position doesn't exist, still allow local close
            logger.warning(f"MT5 close failed for ticket {mt5_ticket}: {mt5_result.get('error')}")
        close_price = mt5_result.get("close_price") or exit_price or position.current_price
    except (ValueError, TypeError):
        # position_id isn't an MT5 ticket – legacy position
        close_price = exit_price or position.current_price

    result = risk_engine.close_position(position_id, close_price, "manual_close")

    # Broadcast close event
    await broadcast_message({
        "type": "position_closed",
        "data": {
            "position_id": position_id,
            "symbol": position.symbol,
            "close_price": close_price,
            "pnl": result.get("pnl", 0),
        },
    })

    return result


@app.get("/api/risk/metrics")
async def get_risk_metrics():
    """Get comprehensive risk metrics"""
    risk_engine = get_risk_engine()
    metrics = risk_engine.get_risk_metrics()
    
    return {
        "account": {
            "balance": metrics.account_balance,
            "equity": metrics.equity,
            "open_pnl": metrics.open_pnl,
            "daily_pnl": metrics.daily_pnl,
            "daily_drawdown": metrics.daily_drawdown
        },
        "risk": {
            "level": metrics.risk_level.value,
            "total_exposed": metrics.total_risk_exposed,
            "current_drawdown": metrics.current_drawdown,
            "max_drawdown": metrics.max_drawdown,
            "margin_used": metrics.margin_used,
            "margin_available": metrics.margin_available
        },
        "performance": {
            "trades_today": metrics.trades_today,
            "consecutive_losses": metrics.consecutive_losses,
            "win_rate": metrics.win_rate_20trades,
            "sharpe_ratio": metrics.sharpe_ratio
        },
        "limits": {
            "max_risk_per_trade": risk_engine.risk_limits.max_risk_per_trade,
            "max_daily_risk": risk_engine.risk_limits.max_daily_risk,
            "max_daily_loss": risk_engine.risk_limits.max_daily_loss,
            "kill_switch_losses": risk_engine.risk_limits.kill_switch_losses
        }
    }


@app.post("/api/risk/config")
async def update_risk_config(config: RiskConfig):
    """Update risk configuration"""
    risk_engine = get_risk_engine()
    
    risk_engine.risk_limits.max_risk_per_trade = config.max_risk_per_trade
    risk_engine.risk_limits.max_daily_risk = config.max_daily_risk
    risk_engine.risk_limits.max_daily_loss = config.max_daily_loss
    risk_engine.risk_limits.kill_switch_losses = config.kill_switch_losses
    
    return {"success": True, "config_updated": config.dict()}


@app.post("/api/risk/reset")
async def reset_risk():
    """Reset kill switch and enable trading"""
    risk_engine = get_risk_engine()
    risk_engine.manual_override(True)
    
    return {
        "success": True,
        "trading_enabled": risk_engine.trading_enabled,
        "kill_switch_reset": True
    }


@app.get("/api/performance")
async def get_performance():
    """Get trading performance statistics"""
    risk_engine = get_risk_engine()
    exec_engine = get_execution_engine()

    # Serialize trade history (datetime -> isoformat)
    serialized_trades = []
    for t in (risk_engine.trade_history or []):
        record = dict(t)
        if 'time' in record and hasattr(record['time'], 'isoformat'):
            record['time'] = record['time'].isoformat()
        serialized_trades.append(record)

    metrics = risk_engine.get_risk_metrics()

    return {
        "account_performance": {
            "initial_balance": risk_engine.initial_balance,
            "current_balance": risk_engine.current_balance,
            "total_return": (risk_engine.current_balance - risk_engine.initial_balance) / risk_engine.initial_balance * 100,
            "max_drawdown": risk_engine.max_drawdown,
            "current_drawdown": risk_engine.current_drawdown,
            "sharpe_ratio": metrics.sharpe_ratio,
        },
        "trade_statistics": {
            "total_trades": risk_engine.total_trades,
            "winning_trades": risk_engine.winning_trades,
            "losing_trades": risk_engine.losing_trades,
            "win_rate": risk_engine.winning_trades / max(1, risk_engine.total_trades) * 100
        },
        "execution_stats": exec_engine.get_execution_stats(),
        "recent_trades": serialized_trades
    }


@app.get("/api/market/data")
async def get_market_data():
    """Get current market data from MT5 or simulation"""
    mt5 = get_mt5_service()
    symbols = ["XAUUSD", "US30", "US500", "GBPUSD", "EURUSD", "USDJPY", "AUDUSD"]
    result = {}

    for symbol in symbols:
        tick = mt5.get_tick(symbol)
        # Get daily bars to compute 24h change
        daily = mt5.get_ohlcv(symbol, "1d", 2)
        change_24h = 0.0
        high_24h = tick["price"]
        low_24h = tick["price"]
        volume_24h = 0

        if len(daily) >= 2:
            prev_close = daily[-2]["close"]
            if prev_close != 0:
                change_24h = round((tick["price"] - prev_close) / prev_close * 100, 2)
            high_24h = daily[-1]["high"]
            low_24h = daily[-1]["low"]
            volume_24h = daily[-1]["volume"]

        result[symbol] = {
            "price": tick["price"],
            "bid": tick.get("bid", tick["price"]),
            "ask": tick.get("ask", tick["price"]),
            "spread": tick.get("spread", 0),
            "change_24h": change_24h,
            "volume_24h": volume_24h,
            "high_24h": high_24h,
            "low_24h": low_24h,
        }

    return result


@app.get("/api/mt5/status")
async def mt5_status():
    """Get MT5 connection status"""
    mt5 = get_mt5_service()
    return mt5.get_status()


class MT5ConnectRequest(BaseModel):
    login: int
    password: str
    server: str
    account_type: str = "demo"


@app.post("/api/mt5/connect")
async def mt5_connect(request: MT5ConnectRequest):
    """Connect to MT5 with user credentials"""
    mt5_svc = get_mt5_service()
    try:
        import MetaTrader5 as mt5
        # Shutdown any existing connection
        mt5.shutdown()
        # Initialize with the requested account
        if not mt5.initialize(
            login=request.login,
            password=request.password,
            server=request.server,
        ):
            error = mt5.last_error()
            logger.error(f"MT5 initialize failed: {error}")
            return {
                "connected": False,
                "error": f"MT5 terminal not responding. Make sure MetaTrader5 is open and running. Error: {error}",
            }
        info = mt5.account_info()
        if info is None:
            return {"connected": False, "error": "Could not retrieve account info"}
        mt5_svc.connected = True
        mt5_svc.mt5 = mt5
        # Repopulate timeframe constants
        from app.engines.mt5_service import MT5_TIMEFRAMES
        MT5_TIMEFRAMES["1m"] = mt5.TIMEFRAME_M1
        MT5_TIMEFRAMES["5m"] = mt5.TIMEFRAME_M5
        MT5_TIMEFRAMES["15m"] = mt5.TIMEFRAME_M15
        MT5_TIMEFRAMES["30m"] = mt5.TIMEFRAME_M30
        MT5_TIMEFRAMES["1h"] = mt5.TIMEFRAME_H1
        MT5_TIMEFRAMES["4h"] = mt5.TIMEFRAME_H4
        MT5_TIMEFRAMES["1d"] = mt5.TIMEFRAME_D1
        MT5_TIMEFRAMES["1w"] = mt5.TIMEFRAME_W1
        return {
            "connected": True,
            "account": {
                "login": info.login,
                "name": info.name,
                "server": info.server,
                "balance": info.balance,
                "equity": info.equity,
                "leverage": info.leverage,
                "currency": info.currency,
                "trade_mode": "demo" if info.trade_mode == 0 else "live",
            },
        }
    except ImportError as e:
        logger.error(f"MetaTrader5 package import failed: {e}")
        return {"connected": False, "error": "MetaTrader5 package not installed"}
    except Exception as e:
        logger.error(f"MT5 connection error: {e}")
        return {"connected": False, "error": f"MT5 connection failed: {str(e)}"}


@app.post("/api/mt5/disconnect")
async def mt5_disconnect():
    """Disconnect from MT5"""
    mt5_svc = get_mt5_service()
    mt5_svc.shutdown()
    return {"connected": False, "mode": "simulation"}


@app.get("/api/mt5/ohlcv/{symbol}")
async def get_ohlcv(
    symbol: str,
    timeframe: str = "1h",
    bars: int = 100,
):
    """Get OHLCV chart data from MT5"""
    mt5 = get_mt5_service()
    data = mt5.get_ohlcv(symbol, timeframe, bars)
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "bars": len(data),
        "source": "mt5" if mt5.connected else "simulation",
        "data": data,
    }


@app.get("/api/mt5/tick/{symbol}")
async def get_tick(symbol: str):
    """Get latest tick from MT5"""
    mt5 = get_mt5_service()
    return mt5.get_tick(symbol)


# ============ WebSocket ============

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket for real-time updates"""
    await websocket.accept()
    app_state['connected_clients'].append(websocket)
    
    try:
        # Send initial data
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "message": "ICT Trading Bot WebSocket connected"
        })
        
        while app_state['is_running']:
            # Receive client messages
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
                
                # Handle client commands
                if data.get('action') == 'subscribe':
                    await websocket.send_json({
                        "type": "subscribed",
                        "channels": data.get('channels', [])
                    })
                
                elif data.get('action') == 'ping':
                    await websocket.send_json({"type": "pong"})
                    
            except asyncio.TimeoutError:
                pass
            
    except WebSocketDisconnect:
        if websocket in app_state['connected_clients']:
            app_state['connected_clients'].remove(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        if websocket in app_state['connected_clients']:
            app_state['connected_clients'].remove(websocket)


async def broadcast_message(message: Dict):
    """Broadcast message to all connected clients"""
    disconnected = []
    
    for client in app_state['connected_clients']:
        try:
            await client.send_json(message)
        except:
            disconnected.append(client)
    
    # Remove disconnected clients
    for client in disconnected:
        if client in app_state['connected_clients']:
            app_state['connected_clients'].remove(client)


async def broadcast_market_data():
    """Broadcast market data every second using MT5 service"""
    while app_state['is_running']:
        try:
            mt5 = get_mt5_service()
            risk_engine = get_risk_engine()
            
            if mt5 is None or risk_engine is None:
                await asyncio.sleep(5)
                continue
            
            symbols = ["XAUUSD", "US30", "US500", "GBPUSD", "EURUSD", "USDJPY", "AUDUSD"]
            data = {}
            live_prices: Dict[str, float] = {}
            
            for sym in symbols:
                try:
                    tick = mt5.get_tick(sym)
                    price = tick.get("price", 0)
                    data[sym] = {"price": price, "change": 0}
                    if price:
                        live_prices[sym] = price
                except Exception as e:
                    logger.debug(f"Could not get tick for {sym}: {e}")
                    continue

            # Feed live prices into position tracker so PnL updates every second
            if live_prices and risk_engine.positions:
                try:
                    risk_engine.update_positions(live_prices)
                except Exception as e:
                    logger.debug(f"Could not update positions: {e}")

            market_data = {
                "type": "market_update",
                "timestamp": datetime.now().isoformat(),
                "data": data
            }
            
            await broadcast_message(market_data)
            await asyncio.sleep(1)
            
        except Exception as e:
            logger.debug(f"Broadcast error: {e}")
            await asyncio.sleep(1)


async def monitor_positions():
    """Monitor positions and broadcast updates with live MT5 prices.
    Also syncs with MT5 to detect externally-closed positions (SL/TP hit)."""
    while app_state['is_running']:
        try:
            risk_engine = get_risk_engine()
            mt5 = get_mt5_service()
            
            if risk_engine is None:
                await asyncio.sleep(5)
                continue

            # --- Sync MT5 account balance every tick ---
            if mt5 and mt5.connected:
                try:
                    acct = mt5.get_account_info()
                    if acct:
                        risk_engine.current_balance = acct.get("balance", risk_engine.current_balance)
                except Exception as e:
                    logger.debug(f"Could not sync MT5 balance: {e}")

            # --- Detect positions closed on MT5 (SL/TP hit, manual close on phone) ---
            if risk_engine.positions and mt5 and mt5.connected:
                try:
                    mt5_open = mt5.get_mt5_positions()
                    mt5_tickets = {str(p["ticket"]) for p in mt5_open}
                    closed_ids = [
                        pid for pid in list(risk_engine.positions.keys())
                        if pid not in mt5_tickets and pid.isdigit()
                    ]
                    for pid in closed_ids:
                        pos = risk_engine.positions.get(pid)
                        if pos:
                            close_price = pos.current_price
                            result = risk_engine.close_position(pid, close_price, "mt5_external")
                            logger.info(f"Position {pid} closed externally on MT5")
                            await broadcast_message({
                                "type": "position_closed",
                                "data": {
                                    "position_id": pid,
                                    "symbol": pos.symbol,
                                    "close_price": close_price,
                                    "pnl": result.get("pnl", 0),
                                    "reason": "mt5_external",
                                },
                            })
                except Exception as e:
                    logger.debug(f"Could not check MT5 positions: {e}")

            # Build live price map from MT5 for all symbols with open positions
            if risk_engine.positions and mt5:
                open_symbols = set(pos.symbol for pos in risk_engine.positions.values())

                price_data: Dict[str, float] = {}
                for sym in open_symbols:
                    try:
                        tick = mt5.get_tick(sym)
                        if tick and tick.get("price"):
                            price_data[sym] = tick["price"]
                    except Exception:
                        pass

                if price_data:
                    try:
                        risk_engine.update_positions(price_data)
                    except Exception as e:
                        logger.debug(f"Could not update positions: {e}")

                # Broadcast position updates
                try:
                    positions_data = []
                    for pos in risk_engine.positions.values():
                        positions_data.append({
                            "id": pos.id,
                            "symbol": pos.symbol,
                            "direction": pos.direction,
                            "entry_price": pos.entry_price,
                            "current_price": pos.current_price,
                            "quantity": pos.quantity,
                            "lot_size": pos.lot_size,
                            "unrealized_pnl": pos.unrealized_pnl,
                            "stop_loss": pos.stop_loss,
                            "take_profit": pos.take_profit,
                            "risk_percent": pos.risk_percent,
                            "open_time": pos.open_time.isoformat(),
                        })

                    await broadcast_message({
                        "type": "position_update",
                        "positions": positions_data
                    })
                except Exception as e:
                    logger.debug(f"Could not broadcast positions: {e}")

            # Broadcast updated risk / account metrics
            try:
                metrics = risk_engine.get_risk_metrics()
                await broadcast_message({
                    "type": "risk_update",
                    "data": {
                        "account_balance": metrics.account_balance,
                        "equity": metrics.equity,
                        "open_pnl": metrics.open_pnl,
                        "daily_pnl": metrics.daily_pnl,
                        "current_drawdown": metrics.current_drawdown,
                        "max_drawdown": metrics.max_drawdown,
                        "total_risk_exposed": metrics.total_risk_exposed,
                        "margin_used": metrics.margin_used,
                        "margin_available": metrics.margin_available,
                        "risk_level": metrics.risk_level.value,
                        "trades_today": metrics.trades_today,
                        "consecutive_losses": metrics.consecutive_losses,
                        "win_rate": metrics.win_rate_20trades,
                        "sharpe_ratio": metrics.sharpe_ratio,
                    }
                })
            except Exception as e:
                logger.debug(f"Could not broadcast risk metrics: {e}")

            await asyncio.sleep(2)

        except Exception as e:
            logger.debug(f"Position monitor error: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
