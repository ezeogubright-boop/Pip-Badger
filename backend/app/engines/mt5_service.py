"""
MetaTrader 5 Data Service
Connects to MT5 terminal for live OHLCV chart data
"""

import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# MT5 timeframe mapping
MT5_TIMEFRAMES = {
    "1m": None,
    "5m": None,
    "15m": None,
    "30m": None,
    "1h": None,
    "4h": None,
    "1d": None,
    "1w": None,
}

# Symbol mapping: frontend symbol -> MT5 symbol
# Updated to use actual broker-available names
SYMBOL_MAP = {
    "XAUUSD": "XAUUSD",
    "US30": "US30",
    "US500": "US500",
    "GBPUSD": "GBPUSD",
    "EURUSD": "EURUSD",
    "USDJPY": "USDJPY",
    "AUDUSD": "AUDUSD",
    "NZDUSD": "NZDUSD",
    "USDCAD": "USDCAD",
    "USDCHF": "USDCHF",
    "NVDA": "NVDA",
    "MSFT": "MSFT",
}


@dataclass
class OHLCVBar:
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: int


class MT5Service:
    """
    MetaTrader 5 Data Service
    
    Provides live OHLCV data from an MT5 terminal.
    Falls back to simulated data if MT5 is not available.
    """

    def __init__(self):
        self.connected = False
        self.mt5 = None
        self._try_connect()

    def _try_connect(self):
        """Attempt to connect to MT5 terminal"""
        try:
            import MetaTrader5 as mt5
            self.mt5 = mt5

            if not mt5.initialize():
                logger.warning("MT5 initialize() failed – running in simulation mode")
                self.connected = False
                return

            info = mt5.terminal_info()
            if info is not None:
                logger.info(f"MT5 connected: {info.name} build {info.build}")
                self.connected = True

                # Populate timeframe constants
                MT5_TIMEFRAMES["1m"] = mt5.TIMEFRAME_M1
                MT5_TIMEFRAMES["5m"] = mt5.TIMEFRAME_M5
                MT5_TIMEFRAMES["15m"] = mt5.TIMEFRAME_M15
                MT5_TIMEFRAMES["30m"] = mt5.TIMEFRAME_M30
                MT5_TIMEFRAMES["1h"] = mt5.TIMEFRAME_H1
                MT5_TIMEFRAMES["4h"] = mt5.TIMEFRAME_H4
                MT5_TIMEFRAMES["1d"] = mt5.TIMEFRAME_D1
                MT5_TIMEFRAMES["1w"] = mt5.TIMEFRAME_W1
            else:
                logger.warning("MT5 terminal_info() returned None")
                self.connected = False

        except ImportError:
            logger.warning("MetaTrader5 package not installed – running in simulation mode")
            self.connected = False
        except Exception as e:
            logger.warning(f"MT5 connection error: {e} – running in simulation mode")
            self.connected = False

    def _resolve_symbol(self, symbol: str) -> str:
        """Map frontend symbol name to MT5 symbol"""
        return SYMBOL_MAP.get(symbol, symbol)

    # ------------------------------------------------------------------ #
    #  Live MT5 data
    # ------------------------------------------------------------------ #

    def _get_live_ohlcv(self, symbol: str, timeframe: str, bars: int) -> List[OHLCVBar]:
        """Fetch OHLCV bars from MT5"""
        mt5 = self.mt5
        mt5_symbol = self._resolve_symbol(symbol)
        mt5_tf = MT5_TIMEFRAMES.get(timeframe)

        if mt5_tf is None:
            logger.error(f"Unsupported timeframe: {timeframe}")
            return []

        # Ensure symbol is available
        if not mt5.symbol_select(mt5_symbol, True):
            logger.error(f"Symbol {mt5_symbol} not available in MT5")
            return []

        rates = mt5.copy_rates_from_pos(mt5_symbol, mt5_tf, 0, bars)

        if rates is None or len(rates) == 0:
            logger.error(f"No data returned for {mt5_symbol} {timeframe}")
            return []

        result: List[OHLCVBar] = []
        for r in rates:
            bar = OHLCVBar(
                time=datetime.utcfromtimestamp(r['time']).isoformat(),
                open=round(float(r['open']), 5),
                high=round(float(r['high']), 5),
                low=round(float(r['low']), 5),
                close=round(float(r['close']), 5),
                volume=int(r['tick_volume']),
            )
            result.append(bar)

        return result

    def _get_live_tick(self, symbol: str) -> Optional[Dict]:
        """Get latest tick from MT5"""
        mt5 = self.mt5
        mt5_symbol = self._resolve_symbol(symbol)

        if not mt5.symbol_select(mt5_symbol, True):
            return None

        tick = mt5.symbol_info_tick(mt5_symbol)
        if tick is None:
            return None

        info = mt5.symbol_info(mt5_symbol)
        return {
            "symbol": symbol,
            "bid": tick.bid,
            "ask": tick.ask,
            "price": round((tick.bid + tick.ask) / 2, 5),
            "spread": round(tick.ask - tick.bid, 5),
            "time": datetime.utcfromtimestamp(tick.time).isoformat(),
            "volume": tick.volume,
            "digits": info.digits if info else 5,
        }

    # ------------------------------------------------------------------ #
    #  Simulated data (fallback when MT5 is not available)
    # ------------------------------------------------------------------ #

    def _get_simulated_ohlcv(self, symbol: str, timeframe: str, bars: int) -> List[OHLCVBar]:
        """Generate realistic simulated OHLCV data"""
        import random, math

        base_prices = {
            "BTCUSDT": 67250.0, "ETHUSDT": 3520.0, "SOLUSDT": 148.5,
            "XAUUSD": 2640.0, "US30": 43850.0, "SPX500": 5920.0, "GBPUSD": 1.2685,
        }
        volatility = {
            "BTCUSDT": 250, "ETHUSDT": 30, "SOLUSDT": 3,
            "XAUUSD": 8, "US30": 120, "SPX500": 20, "GBPUSD": 0.003,
        }

        base = base_prices.get(symbol, 100.0)
        vol = volatility.get(symbol, base * 0.005)

        tf_seconds = {
            "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
            "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800,
        }
        interval = tf_seconds.get(timeframe, 3600)
        now = int(datetime.utcnow().timestamp())
        start = now - interval * bars

        # Seed from symbol + timeframe for consistency within a request
        rng = random.Random(hash(symbol + timeframe) % 2**32)

        result: List[OHLCVBar] = []
        price = base - vol * bars * 0.01  # start a bit lower to create a trend

        for i in range(bars):
            t = start + interval * i
            drift = vol * 0.01 * math.sin(i * 0.15)
            open_p = price + rng.gauss(0, vol * 0.3) + drift
            close_p = open_p + rng.gauss(0, vol * 0.5)
            high_p = max(open_p, close_p) + abs(rng.gauss(0, vol * 0.2))
            low_p = min(open_p, close_p) - abs(rng.gauss(0, vol * 0.2))
            volume = int(abs(rng.gauss(8000, 4000)))

            decimals = 2
            if symbol in ("GBPUSD",):
                decimals = 5
            elif symbol in ("XAUUSD",):
                decimals = 2
            elif symbol in ("BTCUSDT", "ETHUSDT", "SOLUSDT"):
                decimals = 2

            result.append(OHLCVBar(
                time=datetime.utcfromtimestamp(t).isoformat(),
                open=round(open_p, decimals),
                high=round(high_p, decimals),
                low=round(low_p, decimals),
                close=round(close_p, decimals),
                volume=volume,
            ))
            price = close_p

        return result

    def _get_simulated_tick(self, symbol: str) -> Dict:
        """Generate simulated tick"""
        import random

        base_prices = {
            "BTCUSDT": 67250.0, "ETHUSDT": 3520.0, "SOLUSDT": 148.5,
            "XAUUSD": 2640.0, "US30": 43850.0, "SPX500": 5920.0, "GBPUSD": 1.2685,
        }
        spreads = {
            "BTCUSDT": 5.0, "ETHUSDT": 0.5, "SOLUSDT": 0.05,
            "XAUUSD": 0.3, "US30": 2.0, "SPX500": 0.5, "GBPUSD": 0.00015,
        }

        base = base_prices.get(symbol, 100.0)
        spread = spreads.get(symbol, base * 0.0001)
        jitter = random.uniform(-base * 0.001, base * 0.001)
        mid = base + jitter

        return {
            "symbol": symbol,
            "bid": round(mid - spread / 2, 5),
            "ask": round(mid + spread / 2, 5),
            "price": round(mid, 5),
            "spread": round(spread, 5),
            "time": datetime.utcnow().isoformat(),
            "volume": random.randint(1, 500),
            "digits": 5 if symbol == "GBPUSD" else 2,
        }

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #

    def get_ohlcv(self, symbol: str, timeframe: str = "1h", bars: int = 100) -> List[Dict]:
        """
        Get OHLCV data. Uses MT5 if connected, otherwise simulates.
        Returns list of dicts with: time, open, high, low, close, volume
        """
        if self.connected:
            data = self._get_live_ohlcv(symbol, timeframe, bars)
        else:
            data = self._get_simulated_ohlcv(symbol, timeframe, bars)

        return [
            {
                "time": b.time,
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume,
            }
            for b in data
        ]

    def get_tick(self, symbol: str) -> Dict:
        """Get latest tick / price for a symbol"""
        if self.connected:
            tick = self._get_live_tick(symbol)
            if tick:
                return tick
        return self._get_simulated_tick(symbol)

    def get_available_symbols(self) -> List[str]:
        """Return list of visible symbols from MT5 (includes analysis-only symbols)."""
        if not self.connected or not self.mt5:
            return list(SYMBOL_MAP.keys())
        try:
            syms = self.mt5.symbols_get()
            if not syms:
                return list(SYMBOL_MAP.keys())
            # Include all visible symbols – we want chart data even if trading is disabled
            available = [s.name for s in syms if s.visible]
            return available if available else list(SYMBOL_MAP.keys())
        except Exception as e:
            logger.warning(f"Failed to get MT5 symbols: {e}")
            return list(SYMBOL_MAP.keys())

    def get_status(self) -> Dict:
        """Connection status"""
        return {
            "connected": self.connected,
            "mode": "live" if self.connected else "simulation",
            "symbols": self.get_available_symbols(),
            "timeframes": list(MT5_TIMEFRAMES.keys()),
        }

    # ------------------------------------------------------------------ #
    #  Account information
    # ------------------------------------------------------------------ #

    def get_account_info(self) -> Optional[Dict]:
        """Get MT5 account balance, equity, margin, etc."""
        if not self.connected or not self.mt5:
            self._try_connect()
        if not self.connected or not self.mt5:
            return None
        try:
            acct = self.mt5.account_info()
            if acct is None:
                return None
            return {
                "login": acct.login,
                "server": acct.server,
                "balance": acct.balance,
                "equity": acct.equity,
                "margin": acct.margin,
                "free_margin": acct.margin_free,
                "leverage": acct.leverage,
                "profit": acct.profit,
                "currency": acct.currency,
                "trade_mode": acct.trade_mode,  # 0=demo, 2=real
            }
        except Exception as e:
            logger.error(f"Failed to get account info: {e}")
            return None

    # ------------------------------------------------------------------ #
    #  Symbol info helpers
    # ------------------------------------------------------------------ #

    def get_symbol_info(self, symbol: str) -> Optional[Dict]:
        """Get symbol trading details (contract size, lot limits, digits)."""
        if not self.connected or not self.mt5:
            self._try_connect()
        if not self.connected or not self.mt5:
            return None
        mt5_symbol = self._resolve_symbol(symbol)
        info = self.mt5.symbol_info(mt5_symbol)
        if info is None:
            return None
        return {
            "name": info.name,
            "digits": info.digits,
            "point": info.point,
            "trade_contract_size": info.trade_contract_size,
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
            "trade_mode": info.trade_mode,       # 0=disabled, 4=full
            "filling_mode": info.filling_mode,    # bitmask: 1=FOK, 2=IOC
        }

    def _get_filling_type(self, symbol: str) -> int:
        """Determine the correct filling type for a symbol."""
        mt5 = self.mt5
        info = mt5.symbol_info(self._resolve_symbol(symbol))
        if info is None:
            return mt5.ORDER_FILLING_IOC
        filling = info.filling_mode
        if filling & 1:   # FOK supported
            return mt5.ORDER_FILLING_FOK
        if filling & 2:   # IOC supported
            return mt5.ORDER_FILLING_IOC
        return mt5.ORDER_FILLING_RETURN

    def _normalize_volume(self, symbol: str, volume: float) -> float:
        """Round volume to the symbol's volume_step and clamp to min/max."""
        info = self.get_symbol_info(symbol)
        if info is None:
            return round(volume, 2)
        step = info["volume_step"]
        vol = max(info["volume_min"], min(info["volume_max"], volume))
        # Round to nearest step
        vol = round(round(vol / step) * step, 8)
        return vol

    # ------------------------------------------------------------------ #
    #  Order execution
    # ------------------------------------------------------------------ #

    def send_market_order(
        self,
        symbol: str,
        direction: str,       # "long" or "short"
        volume: float,        # lots
        stop_loss: float = 0.0,
        take_profit: float = 0.0,
        comment: str = "TradingBot",
        magic: int = 202603,
    ) -> Dict:
        """
        Send a market order to MT5.
        Returns dict with 'success', 'ticket', 'price', 'volume' or 'error'.
        """
        # Auto-reconnect if connection was lost
        if not self.connected or not self.mt5:
            self._try_connect()
        if not self.connected or not self.mt5:
            return {"success": False, "error": "MT5 not connected"}

        mt5 = self.mt5
        mt5_symbol = self._resolve_symbol(symbol)

        # Make sure symbol is visible
        if not mt5.symbol_select(mt5_symbol, True):
            return {"success": False, "error": f"Symbol {mt5_symbol} not available"}

        # Symbol info for price & validation
        sym_info = mt5.symbol_info(mt5_symbol)
        if sym_info is None:
            return {"success": False, "error": f"Cannot get info for {mt5_symbol}"}
        if sym_info.trade_mode == 0:
            return {"success": False, "error": f"Trading disabled for {mt5_symbol}"}

        tick = mt5.symbol_info_tick(mt5_symbol)
        if tick is None:
            return {"success": False, "error": f"No tick data for {mt5_symbol}"}

        order_type = mt5.ORDER_TYPE_BUY if direction == "long" else mt5.ORDER_TYPE_SELL
        price = tick.ask if direction == "long" else tick.bid

        # Normalize volume
        volume = self._normalize_volume(symbol, volume)

        # Round SL/TP to symbol digits
        digits = sym_info.digits
        if stop_loss:
            stop_loss = round(stop_loss, digits)
        if take_profit:
            take_profit = round(take_profit, digits)

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": mt5_symbol,
            "volume": volume,
            "type": order_type,
            "price": price,
            "sl": stop_loss,
            "tp": take_profit,
            "deviation": 20,     # allowed slippage in points
            "magic": magic,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": self._get_filling_type(symbol),
        }

        logger.info(f"Sending MT5 order: {direction.upper()} {volume} {mt5_symbol} @ {price}"
                     f" SL={stop_loss} TP={take_profit}")

        result = mt5.order_send(request)

        if result is None:
            err = mt5.last_error()
            return {"success": False, "error": f"order_send returned None: {err}"}

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"MT5 retcode {result.retcode}: {result.comment}",
                "retcode": result.retcode,
            }

        logger.info(f"MT5 order filled: ticket={result.order} vol={result.volume} "
                     f"price={result.price}")

        return {
            "success": True,
            "ticket": result.order,
            "price": result.price,
            "volume": result.volume,
            "symbol": symbol,
            "direction": direction,
        }

    def close_position_by_ticket(self, ticket: int, volume: float = None) -> Dict:
        """
        Close an open MT5 position by its ticket number.
        If volume is omitted, the full position is closed.
        """
        if not self.connected or not self.mt5:
            self._try_connect()
        if not self.connected or not self.mt5:
            return {"success": False, "error": "MT5 not connected"}

        mt5 = self.mt5
        positions = mt5.positions_get(ticket=ticket)
        if positions is None or len(positions) == 0:
            return {"success": False, "error": f"Position ticket {ticket} not found"}

        pos = positions[0]
        mt5_symbol = pos.symbol
        close_volume = volume or pos.volume

        # Reverse direction to close
        order_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
        tick = mt5.symbol_info_tick(mt5_symbol)
        if tick is None:
            return {"success": False, "error": f"No tick for {mt5_symbol}"}
        price = tick.bid if pos.type == mt5.ORDER_TYPE_BUY else tick.ask

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": mt5_symbol,
            "volume": close_volume,
            "type": order_type,
            "position": ticket,
            "price": price,
            "deviation": 20,
            "magic": 202603,
            "comment": "TradingBot close",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": self._get_filling_type(mt5_symbol),
        }

        result = mt5.order_send(request)

        if result is None:
            err = mt5.last_error()
            return {"success": False, "error": f"close order_send None: {err}"}

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {
                "success": False,
                "error": f"MT5 retcode {result.retcode}: {result.comment}",
            }

        logger.info(f"MT5 position {ticket} closed @ {result.price}")
        return {
            "success": True,
            "ticket": ticket,
            "close_price": result.price,
            "volume": result.volume,
        }

    def modify_position_sltp(self, ticket: int, stop_loss: float, take_profit: float) -> Dict:
        """Modify SL/TP of an existing MT5 position."""
        if not self.connected or not self.mt5:
            self._try_connect()
        if not self.connected or not self.mt5:
            return {"success": False, "error": "MT5 not connected"}

        mt5 = self.mt5
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            return {"success": False, "error": f"Position {ticket} not found"}

        pos = positions[0]
        sym_info = mt5.symbol_info(pos.symbol)
        digits = sym_info.digits if sym_info else 5

        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": pos.symbol,
            "position": ticket,
            "sl": round(stop_loss, digits),
            "tp": round(take_profit, digits),
        }

        result = mt5.order_send(request)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            err = result.comment if result else str(mt5.last_error())
            return {"success": False, "error": f"Modify failed: {err}"}

        logger.info(f"MT5 position {ticket} SL/TP modified")
        return {"success": True, "ticket": ticket}

    # ------------------------------------------------------------------ #
    #  Position queries
    # ------------------------------------------------------------------ #

    def get_mt5_positions(self) -> List[Dict]:
        """Get all open positions from MT5."""
        if not self.connected or not self.mt5:
            self._try_connect()
        if not self.connected or not self.mt5:
            return []
        try:
            positions = self.mt5.positions_get()
            if positions is None:
                return []
            result = []
            for p in positions:
                result.append({
                    "ticket": p.ticket,
                    "symbol": p.symbol,
                    "direction": "long" if p.type == 0 else "short",  # 0=BUY, 1=SELL
                    "volume": p.volume,
                    "entry_price": p.price_open,
                    "current_price": p.price_current,
                    "stop_loss": p.sl,
                    "take_profit": p.tp,
                    "profit": p.profit,
                    "swap": p.swap,
                    "magic": p.magic,
                    "comment": p.comment,
                    "time": datetime.utcfromtimestamp(p.time).isoformat(),
                })
            return result
        except Exception as e:
            logger.error(f"Failed to get MT5 positions: {e}")
            return []

    def shutdown(self):
        """Disconnect from MT5"""
        if self.connected and self.mt5:
            self.mt5.shutdown()
            self.connected = False
            logger.info("MT5 disconnected")


# Singleton
_mt5_service: Optional[MT5Service] = None


def get_mt5_service() -> MT5Service:
    global _mt5_service
    if _mt5_service is None:
        _mt5_service = MT5Service()
    return _mt5_service
