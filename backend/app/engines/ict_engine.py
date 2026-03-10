"""
ICT (Inner Circle Trader) Strategy Engine
Institutional-grade algorithmic trading system

Smart Money Concepts:
  - Order Blocks (OB) with breaker block detection
  - Fair Value Gaps (FVG) with consequent encroachment & inversion
  - Market Structure Shifts (MSS)
  - Liquidity Sweeps (equal H/L, previous day H/L, session H/L)
  - Kill Zones (Asia, London, New York sessions)
  - Daily / Weekly Pivot Points (Classic & Fibonacci)
  - Judas Swing (false session-open breakout)
  - Power of Three (PO3) – Accumulation / Manipulation / Distribution
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, time, timedelta
import asyncio
from collections import deque
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & Data-classes
# ---------------------------------------------------------------------------

class MarketStructure(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class SignalType(Enum):
    BOS = "break_of_structure"
    CHOCH = "change_of_character"
    MSS = "market_structure_shift"
    FVG = "fair_value_gap"
    IFVG = "inverse_fair_value_gap"
    OB = "order_block"
    BREAKER = "breaker_block"
    LIQUIDITY_SWEEP = "liquidity_sweep"
    OTE = "optimal_trade_entry"
    JUDAS_SWING = "judas_swing"
    PO3 = "power_of_three"
    PIVOT = "pivot_level"


class PO3Phase(Enum):
    ACCUMULATION = "accumulation"
    MANIPULATION = "manipulation"
    DISTRIBUTION = "distribution"


class SessionName(Enum):
    ASIA = "asia"
    LONDON = "london"
    NEW_YORK = "new_york"
    LONDON_NY_OVERLAP = "london_ny_overlap"
    OFF_SESSION = "off_session"


@dataclass
class ICTSignal:
    type: SignalType
    direction: str  # "long" or "short"
    timestamp: datetime
    price: float
    confidence: float  # 0.0 to 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    confluence_factors: List[str] = field(default_factory=list)


@dataclass
class MarketContext:
    trend: MarketStructure
    htf_bias: str  # Higher timeframe bias
    liquidity_pools: List[Dict]
    order_blocks: List[Dict]
    fvgs: List[Dict]
    session: str
    volatility_regime: str
    pivots: Dict[str, Any] = field(default_factory=dict)
    mss_signals: List[Dict] = field(default_factory=list)
    po3_phase: Optional[str] = None
    judas_swing: Optional[Dict] = None
    kill_zone_active: bool = False


class MarketStructureAnalyzer:
    """Analyzes market structure – BOS, CHOCH, HH/HL/LH/LL, MSS"""

    def __init__(self, lookback: int = 100):
        self.lookback = lookback
        self.swing_highs: deque = deque(maxlen=lookback)
        self.swing_lows: deque = deque(maxlen=lookback)
        self.structure: MarketStructure = MarketStructure.NEUTRAL

    # ---- swing detection -------------------------------------------------

    def detect_swing_points(
        self, df: pd.DataFrame, left_bars: int = 5, right_bars: int = 5
    ) -> Tuple[List, List]:
        """Detect swing highs and lows using fractal logic."""
        highs = df['high'].values
        lows = df['low'].values

        swing_highs: List[Dict] = []
        swing_lows: List[Dict] = []

        for i in range(left_bars, len(df) - right_bars):
            if all(highs[i] > highs[i - j] for j in range(1, left_bars + 1)) and \
               all(highs[i] > highs[i + j] for j in range(1, right_bars + 1)):
                swing_highs.append({'index': i, 'price': highs[i], 'time': df.index[i]})

            if all(lows[i] < lows[i - j] for j in range(1, left_bars + 1)) and \
               all(lows[i] < lows[i + j] for j in range(1, right_bars + 1)):
                swing_lows.append({'index': i, 'price': lows[i], 'time': df.index[i]})

        return swing_highs, swing_lows

    # ---- BOS -------------------------------------------------------------

    def detect_bos(
        self, df: pd.DataFrame, swing_highs: List, swing_lows: List
    ) -> List[ICTSignal]:
        """Detect Break of Structure (BOS)."""
        signals: List[ICTSignal] = []
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return signals

        for i in range(1, len(swing_highs)):
            prev_high = swing_highs[i - 1]['price']
            curr_high = swing_highs[i]['price']
            curr_idx = swing_highs[i]['index']
            if curr_idx > 0:
                candle_size = abs(df['close'].iloc[curr_idx] - df['open'].iloc[curr_idx])
                avg_candle = (
                    df['high'].iloc[max(0, curr_idx - 10):curr_idx].mean()
                    - df['low'].iloc[max(0, curr_idx - 10):curr_idx].mean()
                )
                if curr_high > prev_high and candle_size > avg_candle * 1.5:
                    signals.append(ICTSignal(
                        type=SignalType.BOS, direction="long",
                        timestamp=df.index[curr_idx], price=curr_high,
                        confidence=0.75,
                        metadata={'prev_swing_high': prev_high,
                                  'displacement': True, 'candle_size': candle_size}
                    ))

        for i in range(1, len(swing_lows)):
            prev_low = swing_lows[i - 1]['price']
            curr_low = swing_lows[i]['price']
            curr_idx = swing_lows[i]['index']
            if curr_idx > 0:
                candle_size = abs(df['close'].iloc[curr_idx] - df['open'].iloc[curr_idx])
                avg_candle = (
                    df['high'].iloc[max(0, curr_idx - 10):curr_idx].mean()
                    - df['low'].iloc[max(0, curr_idx - 10):curr_idx].mean()
                )
                if curr_low < prev_low and candle_size > avg_candle * 1.5:
                    signals.append(ICTSignal(
                        type=SignalType.BOS, direction="short",
                        timestamp=df.index[curr_idx], price=curr_low,
                        confidence=0.75,
                        metadata={'prev_swing_low': prev_low,
                                  'displacement': True, 'candle_size': candle_size}
                    ))
        return signals

    # ---- CHOCH ------------------------------------------------------------

    def detect_choch(
        self, df: pd.DataFrame, swing_highs: List, swing_lows: List
    ) -> List[ICTSignal]:
        """Detect Change of Character (CHOCH)."""
        signals: List[ICTSignal] = []
        if len(swing_highs) < 3 or len(swing_lows) < 3:
            return signals

        for i in range(2, len(swing_lows)):
            if (swing_lows[i]['price'] > swing_lows[i - 1]['price']
                    and swing_lows[i - 1]['price'] < swing_lows[i - 2]['price']):
                signals.append(ICTSignal(
                    type=SignalType.CHOCH, direction="long",
                    timestamp=swing_lows[i]['time'],
                    price=swing_lows[i]['price'], confidence=0.8,
                    metadata={'pattern': 'higher_low_after_lower_lows',
                              'swing_sequence': [swing_lows[j]['price'] for j in range(i - 2, i + 1)]}
                ))

        for i in range(2, len(swing_highs)):
            if (swing_highs[i]['price'] < swing_highs[i - 1]['price']
                    and swing_highs[i - 1]['price'] > swing_highs[i - 2]['price']):
                signals.append(ICTSignal(
                    type=SignalType.CHOCH, direction="short",
                    timestamp=swing_highs[i]['time'],
                    price=swing_highs[i]['price'], confidence=0.8,
                    metadata={'pattern': 'lower_high_after_higher_highs',
                              'swing_sequence': [swing_highs[j]['price'] for j in range(i - 2, i + 1)]}
                ))
        return signals

    # ---- MSS (Market Structure Shift) ------------------------------------

    def detect_mss(
        self, df: pd.DataFrame, swing_highs: List, swing_lows: List
    ) -> List[ICTSignal]:
        """
        Detect Market Structure Shift (MSS).

        MSS = a BOS that happens *against* the prevailing trend.  It is the
        first internal break that signals the institutions are reversing.
        We look for the first candle that closes beyond the previous
        swing high (in a downtrend) or swing low (in an uptrend) with
        displacement (candle body > 1.5× average range).
        """
        signals: List[ICTSignal] = []
        if len(swing_highs) < 3 or len(swing_lows) < 3:
            return signals

        # Determine prevailing trend from the last 3 swing points
        prev_trend = self._swing_trend(swing_highs, swing_lows)

        # --- Bullish MSS: downtrend → price closes above last swing high ---
        if prev_trend == MarketStructure.BEARISH and len(swing_highs) >= 2:
            target_level = swing_highs[-1]['price']
            search_start = swing_highs[-1]['index'] + 1
            for k in range(search_start, len(df)):
                if df['close'].iloc[k] > target_level:
                    body = abs(df['close'].iloc[k] - df['open'].iloc[k])
                    avg_range = (
                        df['high'].iloc[max(0, k - 10):k].mean()
                        - df['low'].iloc[max(0, k - 10):k].mean()
                    ) if k > 10 else body
                    if body > avg_range * 1.2:
                        signals.append(ICTSignal(
                            type=SignalType.MSS, direction="long",
                            timestamp=df.index[k], price=df['close'].iloc[k],
                            confidence=0.82,
                            metadata={
                                'broken_level': target_level,
                                'prev_trend': 'bearish',
                                'displacement_body': float(body),
                                'avg_range': float(avg_range),
                            }
                        ))
                        break  # only the first MSS matters

        # --- Bearish MSS: uptrend → price closes below last swing low ---
        if prev_trend == MarketStructure.BULLISH and len(swing_lows) >= 2:
            target_level = swing_lows[-1]['price']
            search_start = swing_lows[-1]['index'] + 1
            for k in range(search_start, len(df)):
                if df['close'].iloc[k] < target_level:
                    body = abs(df['close'].iloc[k] - df['open'].iloc[k])
                    avg_range = (
                        df['high'].iloc[max(0, k - 10):k].mean()
                        - df['low'].iloc[max(0, k - 10):k].mean()
                    ) if k > 10 else body
                    if body > avg_range * 1.2:
                        signals.append(ICTSignal(
                            type=SignalType.MSS, direction="short",
                            timestamp=df.index[k], price=df['close'].iloc[k],
                            confidence=0.82,
                            metadata={
                                'broken_level': target_level,
                                'prev_trend': 'bullish',
                                'displacement_body': float(body),
                                'avg_range': float(avg_range),
                            }
                        ))
                        break

        return signals

    @staticmethod
    def _swing_trend(swing_highs: List, swing_lows: List) -> MarketStructure:
        """Quick helper – determine trend from last 2 swing H/L."""
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return MarketStructure.NEUTRAL
        hh = swing_highs[-1]['price'] > swing_highs[-2]['price']
        hl = swing_lows[-1]['price'] > swing_lows[-2]['price']
        lh = swing_highs[-1]['price'] < swing_highs[-2]['price']
        ll = swing_lows[-1]['price'] < swing_lows[-2]['price']
        if hh and hl:
            return MarketStructure.BULLISH
        if lh and ll:
            return MarketStructure.BEARISH
        return MarketStructure.NEUTRAL


class LiquidityAnalyzer:
    """Detects liquidity pools, equal-level clusters, and sweeps (PDH/PDL, session H/L)."""

    def __init__(self, tolerance_pips: float = 0.0005):
        self.tolerance = tolerance_pips
        self.liquidity_pools: List[Dict] = []

    # ---- equal highs / lows ----------------------------------------------

    def detect_equal_levels(
        self, df: pd.DataFrame, min_touches: int = 3
    ) -> List[Dict]:
        """Detect equal highs/lows forming liquidity pools."""
        pools: List[Dict] = []

        highs = df['high'].values
        for i in range(len(highs) - min_touches):
            level_highs = highs[i:i + min_touches]
            if max(level_highs) - min(level_highs) < self.tolerance:
                pools.append({
                    'type': 'equal_highs',
                    'price': float(np.mean(level_highs)),
                    'range': (float(min(level_highs)), float(max(level_highs))),
                    'index': i,
                    'touches': min_touches,
                })

        lows = df['low'].values
        for i in range(len(lows) - min_touches):
            level_lows = lows[i:i + min_touches]
            if max(level_lows) - min(level_lows) < self.tolerance:
                pools.append({
                    'type': 'equal_lows',
                    'price': float(np.mean(level_lows)),
                    'range': (float(min(level_lows)), float(max(level_lows))),
                    'index': i,
                    'touches': min_touches,
                })

        self.liquidity_pools = pools
        return pools

    # ---- previous-day high / low liquidity -------------------------------

    def detect_previous_day_levels(self, df: pd.DataFrame) -> List[Dict]:
        """
        Identify previous-day high (PDH) and previous-day low (PDL) as
        liquidity targets.  Requires a DatetimeIndex (or column 'time').
        """
        pools: List[Dict] = []
        if not isinstance(df.index, pd.DatetimeIndex):
            return pools

        dates = df.index.normalize().unique()
        if len(dates) < 2:
            return pools

        prev_date = dates[-2]
        prev_day = df[df.index.normalize() == prev_date]
        if prev_day.empty:
            return pools

        pdh = float(prev_day['high'].max())
        pdl = float(prev_day['low'].min())
        pools.append({'type': 'pdh', 'price': pdh, 'label': 'Previous Day High'})
        pools.append({'type': 'pdl', 'price': pdl, 'label': 'Previous Day Low'})
        return pools

    # ---- previous-week high / low ----------------------------------------

    def detect_previous_week_levels(self, df: pd.DataFrame) -> List[Dict]:
        """
        Identify previous-week high (PWH) and previous-week low (PWL).
        """
        pools: List[Dict] = []
        if not isinstance(df.index, pd.DatetimeIndex):
            return pools

        weekly = df.resample('W')
        agg = weekly.agg({'high': 'max', 'low': 'min'}).dropna()
        if len(agg) < 2:
            return pools

        pwh = float(agg['high'].iloc[-2])
        pwl = float(agg['low'].iloc[-2])
        pools.append({'type': 'pwh', 'price': pwh, 'label': 'Previous Week High'})
        pools.append({'type': 'pwl', 'price': pwl, 'label': 'Previous Week Low'})
        return pools

    # ---- session high / low liquidity ------------------------------------

    def detect_session_levels(
        self, df: pd.DataFrame, session_start: time, session_end: time
    ) -> List[Dict]:
        """
        Identify session high / session low from a specific kill-zone.
        Useful for Asia-range liquidity sweeps.
        """
        pools: List[Dict] = []
        if not isinstance(df.index, pd.DatetimeIndex):
            return pools

        mask = df.index.to_series().apply(
            lambda t: session_start <= t.time() <= session_end
        )
        session_data = df[mask]
        if session_data.empty:
            return pools

        sh = float(session_data['high'].max())
        sl = float(session_data['low'].min())
        pools.append({'type': 'session_high', 'price': sh,
                      'label': f'Session High ({session_start}-{session_end})'})
        pools.append({'type': 'session_low', 'price': sl,
                      'label': f'Session Low ({session_start}-{session_end})'})
        return pools

    # ---- sweep detection --------------------------------------------------

    def detect_sweep(
        self, df: pd.DataFrame, pool: Dict, lookforward: int = 5
    ) -> Optional[ICTSignal]:
        """Detect if price swept liquidity and reversed."""
        pool_idx = pool.get('index')
        if pool_idx is None:
            return None
        pool_price = pool['price']
        pool_type = pool['type']

        if pool_idx + lookforward >= len(df):
            return None

        subsequent_data = df.iloc[pool_idx:pool_idx + lookforward]

        if pool_type in ('equal_highs', 'pdh', 'pwh', 'session_high'):
            sweep_high = float(subsequent_data['high'].max())
            if sweep_high > pool_price + self.tolerance:
                last_close = float(subsequent_data['close'].iloc[-1])
                if last_close < pool_price:
                    return ICTSignal(
                        type=SignalType.LIQUIDITY_SWEEP, direction="short",
                        timestamp=subsequent_data.index[-1], price=last_close,
                        confidence=0.85,
                        metadata={'pool_type': pool_type, 'sweep_price': sweep_high,
                                  'pool_price': pool_price, 'rejection_confirmed': True}
                    )

        elif pool_type in ('equal_lows', 'pdl', 'pwl', 'session_low'):
            sweep_low = float(subsequent_data['low'].min())
            if sweep_low < pool_price - self.tolerance:
                last_close = float(subsequent_data['close'].iloc[-1])
                if last_close > pool_price:
                    return ICTSignal(
                        type=SignalType.LIQUIDITY_SWEEP, direction="long",
                        timestamp=subsequent_data.index[-1], price=last_close,
                        confidence=0.85,
                        metadata={'pool_type': pool_type, 'sweep_price': sweep_low,
                                  'pool_price': pool_price, 'rejection_confirmed': True}
                    )
        return None

    def detect_level_sweep(
        self, df: pd.DataFrame, level: float, direction: str, lookback: int = 5
    ) -> Optional[ICTSignal]:
        """
        Generic helper – did the most recent N bars sweep a known level
        (PDH/PDL, PWH/PWL, session H/L) and reject?
        """
        if len(df) < lookback:
            return None

        recent = df.iloc[-lookback:]
        if direction == 'short':
            if float(recent['high'].max()) > level and float(recent['close'].iloc[-1]) < level:
                return ICTSignal(
                    type=SignalType.LIQUIDITY_SWEEP, direction="short",
                    timestamp=recent.index[-1],
                    price=float(recent['close'].iloc[-1]),
                    confidence=0.83,
                    metadata={'swept_level': level, 'rejection': True}
                )
        else:
            if float(recent['low'].min()) < level and float(recent['close'].iloc[-1]) > level:
                return ICTSignal(
                    type=SignalType.LIQUIDITY_SWEEP, direction="long",
                    timestamp=recent.index[-1],
                    price=float(recent['close'].iloc[-1]),
                    confidence=0.83,
                    metadata={'swept_level': level, 'rejection': True}
                )


class FVGAnalyzer:
    """
    Fair Value Gap analyzer – 3-candle imbalance.
    Also detects:
      • Consequent Encroachment (CE) – 50 % retracement of FVG
      • Inverse FVG (IFVG) – a mitigated FVG that flips polarity
    """

    def __init__(self, min_gap_size: float = 0.001):
        self.min_gap_size = min_gap_size

    # ---- core FVG detection ---------------------------------------------

    def detect_fvg(self, df: pd.DataFrame) -> List[Dict]:
        """Detect Fair Value Gaps (bullish & bearish)."""
        fvgs: List[Dict] = []

        for i in range(len(df) - 2):
            c1 = df.iloc[i]
            c2 = df.iloc[i + 1]
            c3 = df.iloc[i + 2]

            # Bullish FVG: candle-1 high < candle-3 low
            if c1['high'] < c3['low']:
                gap = c3['low'] - c1['high']
                if gap >= self.min_gap_size:
                    disp = abs(c3['close'] - c3['open'])
                    avg_r = (c1['high'] - c1['low'] + c2['high'] - c2['low'] + c3['high'] - c3['low']) / 3
                    ce_level = c1['high'] + gap / 2  # consequent encroachment
                    fvgs.append({
                        'type': 'bullish', 'top': float(c3['low']),
                        'bottom': float(c1['high']), 'gap_size': float(gap),
                        'ce_level': float(ce_level),
                        'index': i, 'time': df.index[i],
                        'displacement_strong': disp > avg_r * 1.5,
                        'mitigated': False, 'inversed': False,
                    })

            # Bearish FVG: candle-1 low > candle-3 high
            elif c1['low'] > c3['high']:
                gap = c1['low'] - c3['high']
                if gap >= self.min_gap_size:
                    disp = abs(c3['close'] - c3['open'])
                    avg_r = (c1['high'] - c1['low'] + c2['high'] - c2['low'] + c3['high'] - c3['low']) / 3
                    ce_level = c3['high'] + gap / 2
                    fvgs.append({
                        'type': 'bearish', 'top': float(c1['low']),
                        'bottom': float(c3['high']), 'gap_size': float(gap),
                        'ce_level': float(ce_level),
                        'index': i, 'time': df.index[i],
                        'displacement_strong': disp > avg_r * 1.5,
                        'mitigated': False, 'inversed': False,
                    })
        return fvgs

    # ---- mitigation check ------------------------------------------------

    def check_mitigation(self, df: pd.DataFrame, fvg: Dict, current_idx: int) -> bool:
        """Check if FVG has been mitigated (price returned to fill gap)."""
        if current_idx <= fvg['index'] + 2:
            return False
        sub = df.iloc[fvg['index'] + 2:current_idx + 1]
        if fvg['type'] == 'bullish':
            return bool(any(sub['low'] <= fvg['top']))
        return bool(any(sub['high'] >= fvg['bottom']))

    # ---- consequent encroachment -----------------------------------------

    def check_ce(self, df: pd.DataFrame, fvg: Dict, current_idx: int) -> bool:
        """
        Consequent Encroachment – has price retraced to the 50 %
        midpoint of the FVG?  This often acts as a precise reaction level.
        """
        if current_idx <= fvg['index'] + 2:
            return False
        ce = fvg['ce_level']
        sub = df.iloc[fvg['index'] + 2:current_idx + 1]
        if fvg['type'] == 'bullish':
            return bool(any(sub['low'] <= ce))
        return bool(any(sub['high'] >= ce))

    # ---- inverse FVG (IFVG) ---------------------------------------------

    def detect_inverse_fvg(
        self, df: pd.DataFrame, fvgs: List[Dict], current_idx: int
    ) -> List[Dict]:
        """
        Inverse FVG – a fully-mitigated FVG whose zone flips polarity.
        A mitigated bullish FVG becomes a bearish IFVG (resistance), and
        a mitigated bearish FVG becomes a bullish IFVG (support).
        """
        ifvgs: List[Dict] = []
        for fvg in fvgs:
            if fvg['inversed']:
                continue
            if self.check_mitigation(df, fvg, current_idx):
                direction = 'bearish' if fvg['type'] == 'bullish' else 'bullish'
                ifvg = {**fvg, 'type': direction, 'inversed': True,
                        'original_type': fvg['type']}
                ifvgs.append(ifvg)
                fvg['inversed'] = True
        return ifvgs


class OrderBlockAnalyzer:
    """
    Detects institutional order blocks and breaker blocks.

    Order Block = last opposing candle before a displacement move.
    Breaker Block = a failed (mitigated) OB that flips polarity and
                    becomes a strong S/R level in the other direction.
    """

    def __init__(self, volume_threshold: float = 1.5):
        self.volume_threshold = volume_threshold

    # ---- order-block detection -------------------------------------------

    def detect_order_blocks(
        self, df: pd.DataFrame, bos_signals: List[ICTSignal]
    ) -> List[Dict]:
        """Detect order blocks – last opposing candle before displacement."""
        obs: List[Dict] = []

        for bos in bos_signals:
            bos_idx = (
                df.index.get_loc(bos.timestamp) if bos.timestamp in df.index else None
            )
            if bos_idx is None or bos_idx < 3:
                continue

            lookback = df.iloc[max(0, bos_idx - 10):bos_idx]

            if bos.direction == "long":
                down = lookback[lookback['close'] < lookback['open']]
                if len(down) > 0:
                    ob_c = down.iloc[-1]
                    ob_idx = df.index.get_loc(ob_c.name)
                    vol_spike = (
                        ob_c['volume']
                        > df['volume'].iloc[max(0, ob_idx - 20):ob_idx].mean()
                        * self.volume_threshold
                    )
                    body = abs(ob_c['close'] - ob_c['open'])
                    lower_wick = min(ob_c['open'], ob_c['close']) - ob_c['low']
                    strong_rej = lower_wick > body * 2

                    obs.append({
                        'type': 'bullish',
                        'high': float(ob_c['high']), 'low': float(ob_c['low']),
                        'open': float(ob_c['open']), 'close': float(ob_c['close']),
                        'index': ob_idx, 'time': ob_c.name,
                        'volume_confirmed': bool(vol_spike),
                        'strong_rejection': bool(strong_rej),
                        'mitigated': False, 'breaker': False,
                        'bos_reference': bos,
                    })
            else:
                up = lookback[lookback['close'] > lookback['open']]
                if len(up) > 0:
                    ob_c = up.iloc[-1]
                    ob_idx = df.index.get_loc(ob_c.name)
                    vol_spike = (
                        ob_c['volume']
                        > df['volume'].iloc[max(0, ob_idx - 20):ob_idx].mean()
                        * self.volume_threshold
                    )
                    body = abs(ob_c['close'] - ob_c['open'])
                    upper_wick = ob_c['high'] - max(ob_c['open'], ob_c['close'])
                    strong_rej = upper_wick > body * 2

                    obs.append({
                        'type': 'bearish',
                        'high': float(ob_c['high']), 'low': float(ob_c['low']),
                        'open': float(ob_c['open']), 'close': float(ob_c['close']),
                        'index': ob_idx, 'time': ob_c.name,
                        'volume_confirmed': bool(vol_spike),
                        'strong_rejection': bool(strong_rej),
                        'mitigated': False, 'breaker': False,
                        'bos_reference': bos,
                    })
        return obs

    # ---- breaker-block detection -----------------------------------------

    def detect_breaker_blocks(
        self, df: pd.DataFrame, order_blocks: List[Dict], current_idx: int
    ) -> List[Dict]:
        """
        Breaker Block – an OB that has been violated (mitigated) with
        displacement.  The zone flips polarity:
          • Failed bullish OB → bearish breaker (resistance)
          • Failed bearish OB → bullish breaker (support)
        """
        breakers: List[Dict] = []
        for ob in order_blocks:
            if ob['breaker'] or ob['mitigated']:
                continue
            if current_idx <= ob['index'] + 2:
                continue

            sub = df.iloc[ob['index'] + 1:current_idx + 1]
            violated = False

            if ob['type'] == 'bullish':
                # Bullish OB violated when price closes below its low
                if any(sub['close'] < ob['low']):
                    violated = True
                    new_dir = 'bearish'
            else:
                # Bearish OB violated when price closes above its high
                if any(sub['close'] > ob['high']):
                    violated = True
                    new_dir = 'bullish'

            if violated:
                ob['mitigated'] = True
                ob['breaker'] = True
                breaker = {**ob, 'type': new_dir, 'breaker': True,
                           'original_type': ob['type']}
                breakers.append(breaker)
        return breakers

    # ---- helpers ----------------------------------------------------------

    def is_price_in_ob(self, price: float, ob: Dict) -> bool:
        """Check if price is within order block zone."""
        return ob['low'] <= price <= ob['high']


class OTECalculator:
    """Optimal Trade Entry - Fibonacci retracement 0.62-0.79"""
    
    def __init__(self):
        self.fib_levels = [0.618, 0.705, 0.79]
        
    def calculate_ote_zone(self, swing_low: float, swing_high: float, direction: str) -> Dict:
        """Calculate OTE zone for a swing"""
        range_size = swing_high - swing_low
        
        if direction == "long":
            # For longs, OTE is retracement from high back toward low
            ote_62 = swing_high - range_size * 0.618
            ote_79 = swing_high - range_size * 0.79
            return {
                'top': ote_62,
                'bottom': ote_79,
                'optimal': (ote_62 + ote_79) / 2,
                'direction': 'long'
            }
        else:
            # For shorts, OTE is retracement from low back toward high
            ote_62 = swing_low + range_size * 0.618
            ote_79 = swing_low + range_size * 0.79
            return {
                'top': ote_79,
                'bottom': ote_62,
                'optimal': (ote_62 + ote_79) / 2,
                'direction': 'short'
            }
    
    def is_in_ote_zone(self, price: float, ote_zone: Dict) -> bool:
        """Check if price is in OTE zone"""
        return ote_zone['bottom'] <= price <= ote_zone['top']


class SessionFilter:
    """
    Kill Zones – High-probability trading sessions (UTC times).

    ICT defines these as the windows where institutional order-flow is
    most aggressive.  All times are expressed in UTC to remain
    broker-agnostic.
    """

    SESSIONS: Dict[str, Dict] = {
        'asia': {
            'start': time(0, 0), 'end': time(6, 0),
            'label': 'Asian Session', 'volatility': 'low',
        },
        'london_open': {
            'start': time(7, 0), 'end': time(10, 0),
            'label': 'London Open Kill Zone', 'volatility': 'high',
        },
        'london': {
            'start': time(7, 0), 'end': time(16, 0),
            'label': 'London Session', 'volatility': 'medium',
        },
        'new_york_open': {
            'start': time(12, 0), 'end': time(15, 0),
            'label': 'New York Open Kill Zone', 'volatility': 'high',
        },
        'new_york': {
            'start': time(12, 0), 'end': time(21, 0),
            'label': 'New York Session', 'volatility': 'medium',
        },
        'london_ny_overlap': {
            'start': time(12, 0), 'end': time(16, 0),
            'label': 'London–NY Overlap', 'volatility': 'very_high',
        },
        'london_close': {
            'start': time(15, 0), 'end': time(16, 0),
            'label': 'London Close Kill Zone', 'volatility': 'high',
        },
    }

    def __init__(self):
        self.sessions = self.SESSIONS

    def is_kill_zone(self, dt: datetime, session_type: str = 'london_ny_overlap') -> bool:
        """Check if *dt* (UTC expected) falls within a named kill zone."""
        session = self.sessions.get(session_type)
        if not session:
            return False
        t = dt.time()
        return session['start'] <= t <= session['end']

    def get_active_kill_zones(self, dt: datetime) -> List[str]:
        """Return all kill zones that are currently active."""
        t = dt.time()
        return [
            name for name, s in self.sessions.items()
            if s['start'] <= t <= s['end']
        ]

    def get_current_session(self, dt: datetime) -> str:
        """Return the most specific session that is active."""
        active = self.get_active_kill_zones(dt)
        # Prefer kill-zone names (more specific) first
        priority = [
            'london_ny_overlap', 'london_close',
            'london_open', 'new_york_open',
            'london', 'new_york', 'asia',
        ]
        for name in priority:
            if name in active:
                return name
        return 'off_session'

    def get_session_range(
        self, df: pd.DataFrame, session_type: str
    ) -> Optional[Dict]:
        """
        Return the high / low / open of a session within a DataFrame.
        Useful for Judas Swing and Asia-range calculations.
        """
        session = self.sessions.get(session_type)
        if session is None or not isinstance(df.index, pd.DatetimeIndex):
            return None
        mask = df.index.to_series().apply(
            lambda t: session['start'] <= t.time() <= session['end']
        )
        s_data = df[mask]
        if s_data.empty:
            return None
        return {
            'high': float(s_data['high'].max()),
            'low': float(s_data['low'].min()),
            'open': float(s_data['open'].iloc[0]),
            'close': float(s_data['close'].iloc[-1]),
            'bars': len(s_data),
        }


# ---------------------------------------------------------------------------
# NEW: Daily / Weekly Pivot Points
# ---------------------------------------------------------------------------

class PivotCalculator:
    """
    Classic & Fibonacci pivot points from daily / weekly OHLC data.
    Used as institutional reference levels for targets and entries.
    """

    @staticmethod
    def classic_pivots(high: float, low: float, close: float) -> Dict[str, float]:
        """Standard floor-trader pivot levels."""
        pp = (high + low + close) / 3.0
        r1 = 2 * pp - low
        s1 = 2 * pp - high
        r2 = pp + (high - low)
        s2 = pp - (high - low)
        r3 = high + 2 * (pp - low)
        s3 = low - 2 * (high - pp)
        return {
            'pp': round(pp, 5), 'r1': round(r1, 5), 'r2': round(r2, 5),
            'r3': round(r3, 5), 's1': round(s1, 5), 's2': round(s2, 5),
            's3': round(s3, 5),
        }

    @staticmethod
    def fibonacci_pivots(high: float, low: float, close: float) -> Dict[str, float]:
        """Fibonacci-based pivot levels (0.382, 0.618, 1.000)."""
        pp = (high + low + close) / 3.0
        rng = high - low
        r1 = pp + 0.382 * rng
        r2 = pp + 0.618 * rng
        r3 = pp + 1.000 * rng
        s1 = pp - 0.382 * rng
        s2 = pp - 0.618 * rng
        s3 = pp - 1.000 * rng
        return {
            'pp': round(pp, 5), 'r1': round(r1, 5), 'r2': round(r2, 5),
            'r3': round(r3, 5), 's1': round(s1, 5), 's2': round(s2, 5),
            's3': round(s3, 5),
        }

    def daily_pivots(self, df: pd.DataFrame, method: str = 'classic') -> Dict[str, float]:
        """
        Compute pivots from the previous completed daily bar.
        *df* must have a DatetimeIndex.
        """
        if not isinstance(df.index, pd.DatetimeIndex) or len(df) < 2:
            return {}
        daily = df.resample('D').agg({'high': 'max', 'low': 'min', 'close': 'last'}).dropna()
        if len(daily) < 2:
            return {}
        prev = daily.iloc[-2]
        fn = self.classic_pivots if method == 'classic' else self.fibonacci_pivots
        pivots = fn(prev['high'], prev['low'], prev['close'])
        pivots['period'] = 'daily'
        return pivots

    def weekly_pivots(self, df: pd.DataFrame, method: str = 'classic') -> Dict[str, float]:
        """
        Compute pivots from the previous completed weekly bar.
        """
        if not isinstance(df.index, pd.DatetimeIndex) or len(df) < 2:
            return {}
        weekly = df.resample('W').agg({'high': 'max', 'low': 'min', 'close': 'last'}).dropna()
        if len(weekly) < 2:
            return {}
        prev = weekly.iloc[-2]
        fn = self.classic_pivots if method == 'classic' else self.fibonacci_pivots
        pivots = fn(prev['high'], prev['low'], prev['close'])
        pivots['period'] = 'weekly'
        return pivots

    def get_nearest_pivot(
        self, price: float, pivots: Dict[str, float], direction: str
    ) -> Optional[Dict]:
        """Return the nearest pivot level above (for shorts) or below (for longs)."""
        levels = {k: v for k, v in pivots.items() if isinstance(v, (int, float))}
        if direction == 'long':
            below = {k: v for k, v in levels.items() if v < price}
            if not below:
                return None
            key = max(below, key=below.get)  # type: ignore[arg-type]
            return {'level_name': key, 'price': below[key]}
        else:
            above = {k: v for k, v in levels.items() if v > price}
            if not above:
                return None
            key = min(above, key=above.get)  # type: ignore[arg-type]
            return {'level_name': key, 'price': above[key]}


# ---------------------------------------------------------------------------
# NEW: Judas Swing Detector
# ---------------------------------------------------------------------------

class JudasSwingDetector:
    """
    Judas Swing – a deceptive move at session open that sweeps
    liquidity on one side before the real institutional move begins
    in the opposite direction.

    Logic:
    1. At session open (e.g. London or NY), price pushes strongly in one
       direction during the first N candles.
    2. This move takes out the previous session's high or low (stop hunt).
    3. Price then *reverses sharply* with displacement, confirming the trap.
    """

    def __init__(self, initial_candles: int = 4, reversal_candles: int = 6):
        self.initial_candles = initial_candles
        self.reversal_candles = reversal_candles

    def detect(
        self,
        df: pd.DataFrame,
        session_range: Optional[Dict],
        session_filter: 'SessionFilter',
        kill_zone: str = 'london_open',
    ) -> Optional[ICTSignal]:
        """
        Detect a Judas Swing within the current kill-zone.

        *session_range* = high/low/open of the previous session (e.g. Asia).
        """
        if session_range is None:
            return None

        sess = session_filter.sessions.get(kill_zone)
        if sess is None or not isinstance(df.index, pd.DatetimeIndex):
            return None

        # Filter bars inside the current kill-zone (today only)
        today = df.index[-1].normalize()
        mask = (
            (df.index >= today)
            & df.index.to_series().apply(
                lambda t: sess['start'] <= t.time() <= sess['end']
            ).values
        )
        kz_data = df[mask]
        if len(kz_data) < self.initial_candles + self.reversal_candles:
            return None

        initial = kz_data.iloc[:self.initial_candles]
        follow = kz_data.iloc[self.initial_candles:self.initial_candles + self.reversal_candles]

        prev_high = session_range['high']
        prev_low = session_range['low']

        # ---- Bearish Judas: fake breakout above previous high, then sell ----
        if float(initial['high'].max()) > prev_high:
            if float(follow['close'].iloc[-1]) < float(initial['open'].iloc[0]):
                body = abs(follow['close'].iloc[-1] - follow['open'].iloc[-1])
                avg_range = float((follow['high'] - follow['low']).mean())
                if body > avg_range * 1.0:
                    return ICTSignal(
                        type=SignalType.JUDAS_SWING, direction="short",
                        timestamp=follow.index[-1],
                        price=float(follow['close'].iloc[-1]),
                        confidence=0.84,
                        metadata={
                            'swept_level': prev_high,
                            'fake_breakout_high': float(initial['high'].max()),
                            'reversal_close': float(follow['close'].iloc[-1]),
                            'kill_zone': kill_zone,
                        }
                    )

        # ---- Bullish Judas: fake breakdown below previous low, then buy ----
        if float(initial['low'].min()) < prev_low:
            if float(follow['close'].iloc[-1]) > float(initial['open'].iloc[0]):
                body = abs(follow['close'].iloc[-1] - follow['open'].iloc[-1])
                avg_range = float((follow['high'] - follow['low']).mean())
                if body > avg_range * 1.0:
                    return ICTSignal(
                        type=SignalType.JUDAS_SWING, direction="long",
                        timestamp=follow.index[-1],
                        price=float(follow['close'].iloc[-1]),
                        confidence=0.84,
                        metadata={
                            'swept_level': prev_low,
                            'fake_breakdown_low': float(initial['low'].min()),
                            'reversal_close': float(follow['close'].iloc[-1]),
                            'kill_zone': kill_zone,
                        }
                    )
        return None


# ---------------------------------------------------------------------------
# NEW: Power of Three (PO3) Detector
# ---------------------------------------------------------------------------

class PowerOfThreeDetector:
    """
    Power of Three (PO3) – ICT's daily price-delivery model:

    1. **Accumulation** – tight range at the start of the session /
       day (typically Asia or pre-London).
    2. **Manipulation** – a false move (Judas Swing) that sweeps
       liquidity in the wrong direction.
    3. **Distribution** – the real institutional move that delivers
       price to the daily target.

    We classify the current phase and generate signals when the
    manipulation→distribution transition is detected.
    """

    def __init__(self, atr_accumulation_threshold: float = 0.4):
        """
        *atr_accumulation_threshold* – the accumulation range must be
        less than this fraction of the daily ATR to qualify.
        """
        self.atr_threshold = atr_accumulation_threshold

    def detect_phase(
        self,
        df: pd.DataFrame,
        session_filter: 'SessionFilter',
    ) -> Dict[str, Any]:
        """
        Return the current PO3 phase and metadata.
        """
        result: Dict[str, Any] = {
            'phase': PO3Phase.ACCUMULATION.value,
            'accumulation_range': None,
            'manipulation_direction': None,
            'distribution_direction': None,
            'signal': None,
        }

        # We need intraday data with a DatetimeIndex
        if not isinstance(df.index, pd.DatetimeIndex) or len(df) < 20:
            return result

        # --- Compute daily ATR for context --------------------------------
        daily_tr = (df['high'] - df['low']).rolling(14).mean()
        avg_atr = float(daily_tr.iloc[-1]) if not daily_tr.empty else 0

        # --- 1. Accumulation: Asia session range --------------------------
        asia_range = session_filter.get_session_range(df, 'asia')
        if asia_range is None:
            return result

        acc_range = asia_range['high'] - asia_range['low']
        result['accumulation_range'] = acc_range

        is_accumulation = acc_range < avg_atr * self.atr_threshold if avg_atr else True

        if not is_accumulation:
            # Asia range too wide → not a clean PO3 setup
            return result

        # --- 2. Manipulation: London open sweeps Asia H/L -----------------
        london_range = session_filter.get_session_range(df, 'london_open')
        if london_range is None:
            result['phase'] = PO3Phase.ACCUMULATION.value
            return result

        manip_dir = None
        if london_range['high'] > asia_range['high']:
            manip_dir = 'up'  # fake breakout above Asia high
        if london_range['low'] < asia_range['low']:
            manip_dir = 'down'  # fake breakdown below Asia low

        if manip_dir is None:
            result['phase'] = PO3Phase.ACCUMULATION.value
            return result

        result['phase'] = PO3Phase.MANIPULATION.value
        result['manipulation_direction'] = manip_dir

        # --- 3. Distribution: price reverses against manipulation ----------
        # Check the rest of the session (after London open)
        ny_range = session_filter.get_session_range(df, 'new_york_open')
        if ny_range is None:
            return result

        # Distribution confirmed when NY session moves opposite manipulation
        dist_dir = None
        if manip_dir == 'up' and ny_range['close'] < asia_range['low']:
            dist_dir = 'short'
        elif manip_dir == 'down' and ny_range['close'] > asia_range['high']:
            dist_dir = 'long'

        if dist_dir:
            result['phase'] = PO3Phase.DISTRIBUTION.value
            result['distribution_direction'] = dist_dir

            # Generate a PO3 signal
            result['signal'] = ICTSignal(
                type=SignalType.PO3,
                direction=dist_dir,
                timestamp=df.index[-1],
                price=float(df['close'].iloc[-1]),
                confidence=0.86,
                metadata={
                    'accumulation_range': acc_range,
                    'manipulation_direction': manip_dir,
                    'asia_high': asia_range['high'],
                    'asia_low': asia_range['low'],
                    'distribution_direction': dist_dir,
                }
            )
        return result


class ICTStrategyEngine:
    """
    Main ICT Strategy Engine – Multi-layer confirmation system.
    Institutional-grade precision trading with full Smart Money Concepts.

    Components:
      • MarketStructureAnalyzer  (BOS, CHOCH, MSS)
      • LiquidityAnalyzer        (equal H/L, PDH/PDL, PWH/PWL, session H/L, sweeps)
      • FVGAnalyzer              (FVG, IFVG, consequent encroachment)
      • OrderBlockAnalyzer       (OB, breaker blocks)
      • OTECalculator            (Fibonacci 0.618–0.79 retracement)
      • SessionFilter            (Kill Zones – Asia, London, NY, overlap)
      • PivotCalculator          (Daily / Weekly classic & Fibonacci pivots)
      • JudasSwingDetector       (false session-open breakout)
      • PowerOfThreeDetector     (Accumulation → Manipulation → Distribution)
    """

    def __init__(
        self,
        min_confidence: float = 0.70,
        require_confluence: int = 4,
        use_kill_zones: bool = True,
    ):
        self.min_confidence = min_confidence
        self.require_confluence = require_confluence
        self.use_kill_zones = use_kill_zones

        # Core analyzers
        self.structure_analyzer = MarketStructureAnalyzer()
        self.liquidity_analyzer = LiquidityAnalyzer()
        self.fvg_analyzer = FVGAnalyzer()
        self.ob_analyzer = OrderBlockAnalyzer()
        self.ote_calculator = OTECalculator()
        self.session_filter = SessionFilter()

        # New ICT tools
        self.pivot_calculator = PivotCalculator()
        self.judas_detector = JudasSwingDetector()
        self.po3_detector = PowerOfThreeDetector()

        # State
        self.market_context: Optional[MarketContext] = None
        self.active_signals: List[ICTSignal] = []
        self.trade_history: List[Dict] = []

        logger.info("ICT Strategy Engine initialized (enhanced SMC suite)")

    # ======================================================================
    # Full market analysis
    # ======================================================================

    async def analyze_market(
        self, df: pd.DataFrame, htf_df: Optional[pd.DataFrame] = None
    ) -> List[ICTSignal]:
        """
        Full market analysis with multi-layer confirmation.

        Layer Requirements:
        1. HTF Bias (4H / 1H structure direction)
        2. Liquidity Sweep (stop-hunt confirmed – equal levels + PDH/PDL)
        3. Displacement (strong candle)
        4. FVG Present (valid imbalance)
        5. OB Alignment (order block confluence)
        6. OTE Zone (Fibonacci retracement hit)
        7. Session Filter (London / NY only)
        8. MSS confirmation
        9. Daily / Weekly pivots alignment
        10. Judas Swing detection
        11. Power of Three phase
        """
        signals: List[ICTSignal] = []

        # Guard: need sufficient data
        required_cols = {'open', 'high', 'low', 'close'}
        if df.empty or not required_cols.issubset(df.columns) or len(df) < 15:
            logger.warning("Insufficient data for analysis (rows=%d)", len(df))
            return signals

        # 1. Higher Timeframe Bias
        htf_bias = self._get_htf_bias(htf_df) if htf_df is not None else "neutral"

        # 2. Market Structure Analysis (BOS, CHOCH, MSS)
        swing_highs, swing_lows = self.structure_analyzer.detect_swing_points(df)
        bos_signals = self.structure_analyzer.detect_bos(df, swing_highs, swing_lows)
        choch_signals = self.structure_analyzer.detect_choch(df, swing_highs, swing_lows)
        mss_signals = self.structure_analyzer.detect_mss(df, swing_highs, swing_lows)

        # 3. Liquidity Analysis (equal levels + PDH/PDL + PWH/PWL + session)
        liquidity_pools = self.liquidity_analyzer.detect_equal_levels(df)
        pd_levels = self.liquidity_analyzer.detect_previous_day_levels(df)
        pw_levels = self.liquidity_analyzer.detect_previous_week_levels(df)
        asia_session_levels = self.liquidity_analyzer.detect_session_levels(
            df, time(0, 0), time(6, 0)
        )
        all_liquidity = liquidity_pools + pd_levels + pw_levels + asia_session_levels

        sweep_signals: List[ICTSignal] = []
        for pool in liquidity_pools:
            sweep = self.liquidity_analyzer.detect_sweep(df, pool)
            if sweep:
                sweep_signals.append(sweep)

        # Check PDH / PDL / PWH / PWL sweeps on recent bars
        for lvl in pd_levels + pw_levels + asia_session_levels:
            direction = 'short' if lvl['type'] in ('pdh', 'pwh', 'session_high') else 'long'
            sweep = self.liquidity_analyzer.detect_level_sweep(
                df, lvl['price'], direction, lookback=5
            )
            if sweep:
                sweep.metadata['swept_level_type'] = lvl['type']
                sweep_signals.append(sweep)

        # 4. Fair Value Gaps (+ IFVG)
        fvgs = self.fvg_analyzer.detect_fvg(df)
        current_bar_idx = len(df) - 1
        ifvgs = self.fvg_analyzer.detect_inverse_fvg(df, fvgs, current_bar_idx)

        # 5. Order Blocks (+ breaker blocks)
        order_blocks = self.ob_analyzer.detect_order_blocks(df, bos_signals)
        breaker_blocks = self.ob_analyzer.detect_breaker_blocks(
            df, order_blocks, current_bar_idx
        )

        # 6. Session / Kill-Zone Check
        current_time = (
            df.index[-1] if isinstance(df.index[-1], datetime) else datetime.now()
        )
        session = self.session_filter.get_current_session(current_time)
        active_kzs = self.session_filter.get_active_kill_zones(current_time)
        in_kill_zone = (
            len(active_kzs) > 0 if self.use_kill_zones else True
        )

        # 7. Daily / Weekly Pivots
        daily_pivots = self.pivot_calculator.daily_pivots(df)
        weekly_pivots = self.pivot_calculator.weekly_pivots(df)

        # 8. Judas Swing (check London open and NY open)
        asia_range = self.session_filter.get_session_range(df, 'asia')
        judas_london = self.judas_detector.detect(
            df, asia_range, self.session_filter, kill_zone='london_open'
        )
        london_range = self.session_filter.get_session_range(df, 'london')
        judas_ny = self.judas_detector.detect(
            df, london_range, self.session_filter, kill_zone='new_york_open'
        )

        # 9. Power of Three
        po3_result = self.po3_detector.detect_phase(df, self.session_filter)

        # ---- Add standalone signals from new detectors -------------------
        for mss in mss_signals:
            mss.confluence_factors = ['market_structure_shift']
            signals.append(mss)

        if judas_london:
            judas_london.confluence_factors = ['judas_swing', 'london_open']
            signals.append(judas_london)
        if judas_ny:
            judas_ny.confluence_factors = ['judas_swing', 'new_york_open']
            signals.append(judas_ny)

        if po3_result.get('signal'):
            po3_sig = po3_result['signal']
            po3_sig.confluence_factors = ['power_of_three', po3_result['phase']]
            signals.append(po3_sig)

        # ---- Update market context ---------------------------------------
        self.market_context = MarketContext(
            trend=self._determine_trend(swing_highs, swing_lows),
            htf_bias=htf_bias,
            liquidity_pools=all_liquidity,
            order_blocks=order_blocks + breaker_blocks,
            fvgs=fvgs + ifvgs,
            session=session,
            volatility_regime=self._classify_volatility(df),
            pivots={'daily': daily_pivots, 'weekly': weekly_pivots},
            mss_signals=[{
                'direction': m.direction,
                'price': m.price,
                'timestamp': str(m.timestamp),
                'metadata': m.metadata,
            } for m in mss_signals],
            po3_phase=po3_result.get('phase'),
            judas_swing=(
                {'direction': (judas_london or judas_ny).direction,
                 'price': (judas_london or judas_ny).price}
                if (judas_london or judas_ny) else None
            ),
            kill_zone_active=in_kill_zone,
        )

        # ---- Multi-layer confluence scoring for sweep signals ------------
        current_price = float(df['close'].iloc[-1])

        for sweep in sweep_signals:
            confluence_count = 0
            confluence_factors: List[str] = []

            # Layer 1: HTF Bias
            if htf_bias == sweep.direction:
                confluence_count += 1
                confluence_factors.append("htf_bias_aligned")

            # Layer 2: Liquidity sweep confirmed
            confluence_count += 1
            confluence_factors.append("liquidity_sweep")

            # Layer 3: FVG confluence
            valid_fvg = self._find_valid_fvg(sweep, fvgs, current_price)
            if valid_fvg:
                confluence_count += 1
                confluence_factors.append("fvg_confluence")

            # Layer 4: OB alignment
            aligned_ob = self._find_aligned_ob(sweep, order_blocks, current_price)
            if aligned_ob:
                confluence_count += 1
                confluence_factors.append("order_block_aligned")

            # Layer 5: Breaker block alignment
            aligned_breaker = self._find_aligned_ob(sweep, breaker_blocks, current_price)
            if aligned_breaker:
                confluence_count += 1
                confluence_factors.append("breaker_block_aligned")

            # Layer 6: OTE zone
            ote_zone = self._calculate_ote_for_sweep(sweep, swing_highs, swing_lows)
            if ote_zone and self.ote_calculator.is_in_ote_zone(current_price, ote_zone):
                confluence_count += 1
                confluence_factors.append("ote_zone")

            # Layer 7: Kill zone
            if in_kill_zone:
                confluence_count += 1
                confluence_factors.append("kill_zone")

            # Layer 8: MSS confirmation
            aligned_mss = [
                m for m in mss_signals if m.direction == sweep.direction
            ]
            if aligned_mss:
                confluence_count += 1
                confluence_factors.append("mss_confirmed")

            # Layer 9: Pivot confluence
            pivot_conf = self._check_pivot_confluence(
                current_price, sweep.direction, daily_pivots, weekly_pivots
            )
            if pivot_conf:
                confluence_count += 1
                confluence_factors.append(f"pivot_{pivot_conf['level_name']}")

            # Layer 10: Judas swing alignment
            judas = judas_london or judas_ny
            if judas and judas.direction == sweep.direction:
                confluence_count += 1
                confluence_factors.append("judas_swing_aligned")

            # Layer 11: PO3 distribution alignment
            if (po3_result.get('distribution_direction')
                    and po3_result['distribution_direction'] == sweep.direction):
                confluence_count += 1
                confluence_factors.append("po3_distribution")

            # ---- Generate signal if confluence threshold met ----
            if confluence_count >= self.require_confluence:
                confidence = min(
                    0.97, 0.65 + (confluence_count - self.require_confluence) * 0.04
                )
                signal = ICTSignal(
                    type=SignalType.OTE,
                    direction=sweep.direction,
                    timestamp=current_time,
                    price=current_price,
                    confidence=confidence,
                    metadata={
                        'sweep_price': sweep.metadata.get('sweep_price'),
                        'pool_price': sweep.metadata.get('pool_price'),
                        'ote_zone': ote_zone,
                        'valid_fvg': valid_fvg,
                        'aligned_ob': aligned_ob,
                        'pivot_confluence': pivot_conf,
                        'mss': aligned_mss[0].metadata if aligned_mss else None,
                        'po3_phase': po3_result.get('phase'),
                    },
                    confluence_factors=confluence_factors,
                )
                signals.append(signal)
                logger.info(
                    f"High-confidence signal: {signal.direction} @ {signal.price} "
                    f"(conf={signal.confidence:.2%}, layers={confluence_count})"
                )

        # ---- OB-based signals (no sweep required) -----------------------
        # Fresh unmitigated OBs near current price with FVG / MSS support
        price_range = current_price * 0.015  # 1.5 % proximity band
        for ob in order_blocks + breaker_blocks:
            if ob.get('mitigated'):
                continue
            ob_mid = (ob['high'] + ob['low']) / 2.0
            distance = abs(current_price - ob_mid)
            if distance > price_range:
                continue

            direction = 'long' if ob['type'] == 'bullish' else 'short'
            conf_count = 0
            conf_factors: List[str] = []

            conf_count += 1
            conf_factors.append('order_block_aligned')

            if ob.get('breaker') or ob.get('is_breaker'):
                conf_count += 1
                conf_factors.append('breaker_block_aligned')

            if htf_bias == direction:
                conf_count += 1
                conf_factors.append('htf_bias_aligned')

            ob_as_sig = type('_S', (), {'direction': direction, 'price': current_price, 'metadata': {}})()
            valid_fvg = self._find_valid_fvg(ob_as_sig, fvgs, current_price)
            if valid_fvg:
                conf_count += 1
                conf_factors.append('fvg_confluence')

            aligned_mss_ob = [m for m in mss_signals if m.direction == direction]
            if aligned_mss_ob:
                conf_count += 1
                conf_factors.append('mss_confirmed')

            if in_kill_zone:
                conf_count += 1
                conf_factors.append('kill_zone')

            pivot_conf_ob = self._check_pivot_confluence(
                current_price, direction, daily_pivots, weekly_pivots
            )
            if pivot_conf_ob:
                conf_count += 1
                conf_factors.append(f"pivot_{pivot_conf_ob['level_name']}")

            judas_check = judas_london or judas_ny
            if judas_check and judas_check.direction == direction:
                conf_count += 1
                conf_factors.append('judas_swing_aligned')

            if conf_count >= max(3, self.require_confluence - 1):
                confidence = min(0.92, 0.58 + conf_count * 0.04)
                ote_zone = self._calculate_ote_for_sweep(
                    type('_S', (), {'direction': direction, 'metadata': {}})(),
                    swing_highs, swing_lows,
                )
                signals.append(ICTSignal(
                    type=SignalType.OTE,
                    direction=direction,
                    timestamp=current_time,
                    price=current_price,
                    confidence=confidence,
                    metadata={
                        'ob_type': ob['type'],
                        'ob_high': ob['high'],
                        'ob_low': ob['low'],
                        'ote_zone': ote_zone,
                        'valid_fvg': valid_fvg,
                        'pivot_confluence': pivot_conf_ob,
                    },
                    confluence_factors=conf_factors,
                ))
                logger.info(
                    f"OB-based signal: {direction} @ {current_price} "
                    f"(conf={confidence:.2%}, layers={conf_count})"
                )

        # ---- FVG-based signals (fresh FVGs near price) -------------------
        fvg_range = current_price * 0.01  # 1 % proximity
        scored_fvgs: List[Dict] = []
        for gap in fvgs:
            if gap.get('mitigated'):
                continue
            gap_mid = (gap['top'] + gap['bottom']) / 2.0
            if abs(current_price - gap_mid) > fvg_range:
                continue
            fvg_dir = 'long' if gap['type'] == 'bullish' else 'short'
            conf_c = 1
            conf_f: List[str] = ['fvg_confluence']

            if htf_bias == fvg_dir:
                conf_c += 1
                conf_f.append('htf_bias_aligned')

            if [m for m in mss_signals if m.direction == fvg_dir]:
                conf_c += 1
                conf_f.append('mss_confirmed')

            if in_kill_zone:
                conf_c += 1
                conf_f.append('kill_zone')

            fvg_ob_check = self._find_aligned_ob(
                type('_S', (), {'direction': fvg_dir, 'price': current_price, 'metadata': {}})(),
                order_blocks, current_price,
            )
            if fvg_ob_check:
                conf_c += 1
                conf_f.append('order_block_aligned')

            judas_c = judas_london or judas_ny
            if judas_c and judas_c.direction == fvg_dir:
                conf_c += 1
                conf_f.append('judas_swing_aligned')

            pivot_conf_fvg = self._check_pivot_confluence(
                current_price, fvg_dir, daily_pivots, weekly_pivots
            )
            if pivot_conf_fvg:
                conf_c += 1
                conf_f.append(f"pivot_{pivot_conf_fvg['level_name']}")

            scored_fvgs.append({'gap': gap, 'dir': fvg_dir, 'count': conf_c, 'factors': conf_f, 'pivot': pivot_conf_fvg})

        # Keep only the best FVG per direction
        for fvg_dir in ('long', 'short'):
            candidates = [f for f in scored_fvgs if f['dir'] == fvg_dir and f['count'] >= max(2, self.require_confluence - 2)]
            if not candidates:
                continue
            best = max(candidates, key=lambda x: x['count'])
            confidence = min(0.88, 0.52 + best['count'] * 0.05)
            signals.append(ICTSignal(
                type=SignalType.OTE,
                direction=best['dir'],
                timestamp=current_time,
                price=current_price,
                confidence=confidence,
                metadata={
                    'fvg_high': best['gap']['top'],
                    'fvg_low': best['gap']['bottom'],
                    'fvg_type': best['gap']['type'],
                    'pivot_confluence': best.get('pivot'),
                },
                confluence_factors=best['factors'],
            ))
            logger.info(
                f"FVG-based signal: {best['dir']} @ {current_price} "
                f"(conf={confidence:.2%}, layers={best['count']})"
            )

        self.active_signals = signals
        return signals

    # ==================================================================
    # Smart Money Concepts summary – convenience method for the API
    # ==================================================================

    async def get_smc_analysis(
        self, df: pd.DataFrame, htf_df: Optional[pd.DataFrame] = None
    ) -> Dict[str, Any]:
        """
        Return a comprehensive Smart Money Concepts breakdown suitable
        for sending to the frontend as JSON.
        """
        signals = await self.analyze_market(df, htf_df)
        ctx = self.market_context

        return {
            'market_structure': {
                'trend': ctx.trend.value if ctx else 'neutral',
                'htf_bias': ctx.htf_bias if ctx else 'neutral',
                'mss_signals': ctx.mss_signals if ctx else [],
            },
            'order_blocks': [
                {k: v for k, v in ob.items() if k != 'bos_reference'}
                for ob in (ctx.order_blocks if ctx else [])
            ],
            'fair_value_gaps': ctx.fvgs if ctx else [],
            'liquidity_pools': ctx.liquidity_pools if ctx else [],
            'kill_zones': {
                'active': ctx.kill_zone_active if ctx else False,
                'session': ctx.session if ctx else 'off_session',
            },
            'pivots': ctx.pivots if ctx else {},
            'judas_swing': ctx.judas_swing if ctx else None,
            'po3_phase': ctx.po3_phase if ctx else None,
            'signals': [
                {
                    'type': s.type.value,
                    'direction': s.direction,
                    'price': s.price,
                    'confidence': s.confidence,
                    'confluence_factors': s.confluence_factors,
                    'timestamp': str(s.timestamp),
                }
                for s in signals
            ],
            'volatility_regime': ctx.volatility_regime if ctx else 'normal',
        }
    
    # ==================================================================
    # Private helpers
    # ==================================================================

    def _get_htf_bias(self, htf_df: pd.DataFrame) -> str:
        """Determine higher timeframe bias."""
        if len(htf_df) < 20:
            return "neutral"
        ema20 = htf_df['close'].ewm(span=20).mean()
        price = float(htf_df['close'].iloc[-1])
        ema = float(ema20.iloc[-1])
        if price > ema * 1.01:
            return "long"
        if price < ema * 0.99:
            return "short"
        return "neutral"

    def _determine_trend(self, swing_highs: List, swing_lows: List) -> MarketStructure:
        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return MarketStructure.NEUTRAL
        hh = swing_highs[-1]['price'] > swing_highs[-2]['price']
        hl = swing_lows[-1]['price'] > swing_lows[-2]['price']
        lh = swing_highs[-1]['price'] < swing_highs[-2]['price']
        ll = swing_lows[-1]['price'] < swing_lows[-2]['price']
        if hh and hl:
            return MarketStructure.BULLISH
        if lh and ll:
            return MarketStructure.BEARISH
        return MarketStructure.NEUTRAL

    def _classify_volatility(self, df: pd.DataFrame) -> str:
        if len(df) < 14:
            return "normal"
        high_low = df['high'] - df['low']
        high_close = abs(df['high'] - df['close'].shift())
        low_close = abs(df['low'] - df['close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = tr.rolling(14).mean()
        current_atr = float(atr.iloc[-1])
        avg_atr = float(atr.mean())
        if current_atr > avg_atr * 1.5:
            return "high"
        if current_atr < avg_atr * 0.5:
            return "low"
        return "normal"

    def _find_valid_fvg(
        self, sweep: ICTSignal, fvgs: List[Dict], current_price: float
    ) -> Optional[Dict]:
        # Map signal direction to FVG type
        fvg_type = 'bullish' if sweep.direction == 'long' else 'bearish'
        for fvg in fvgs:
            if fvg['type'] == fvg_type and not fvg['mitigated']:
                if fvg['displacement_strong']:
                    return fvg
        return None

    def _find_aligned_ob(
        self, sweep: ICTSignal, obs: List[Dict], current_price: float
    ) -> Optional[Dict]:
        # Map signal direction to OB type
        ob_type = 'bullish' if sweep.direction == 'long' else 'bearish'
        for ob in obs:
            if ob['type'] == ob_type and not ob.get('mitigated', False):
                if self.ob_analyzer.is_price_in_ob(current_price, ob):
                    return ob
        return None

    def _calculate_ote_for_sweep(
        self, sweep: ICTSignal, swing_highs: List, swing_lows: List
    ) -> Optional[Dict]:
        if sweep.direction == "long" and len(swing_lows) >= 2:
            return self.ote_calculator.calculate_ote_zone(
                swing_lows[-2]['price'], swing_highs[-1]['price'], "long"
            )
        if sweep.direction == "short" and len(swing_highs) >= 2:
            return self.ote_calculator.calculate_ote_zone(
                swing_lows[-1]['price'], swing_highs[-2]['price'], "short"
            )
        return None

    def _check_pivot_confluence(
        self,
        price: float,
        direction: str,
        daily_pivots: Dict,
        weekly_pivots: Dict,
        tolerance_pct: float = 0.002,
    ) -> Optional[Dict]:
        """
        Return the nearest pivot level if price is within *tolerance_pct*
        of it and the direction aligns.
        """
        for label, pivots in [('daily', daily_pivots), ('weekly', weekly_pivots)]:
            if not pivots:
                continue
            for key, val in pivots.items():
                if not isinstance(val, (int, float)):
                    continue
                dist = abs(price - val) / price if price else 0
                if dist < tolerance_pct:
                    # S-levels are support (long), R-levels are resistance (short)
                    if direction == 'long' and key.startswith('s'):
                        return {'level_name': f"{label}_{key}", 'price': val}
                    if direction == 'short' and key.startswith('r'):
                        return {'level_name': f"{label}_{key}", 'price': val}
                    if key == 'pp':
                        return {'level_name': f"{label}_pp", 'price': val}
        return None

    def get_trade_recommendation(self, signal: ICTSignal) -> Dict:
        """Generate complete trade recommendation with entry, SL, TP."""
        entry = signal.price
        atr = entry * 0.01  # simplified 1 % ATR

        if signal.direction == "long":
            stop_loss = entry - atr * 1.5
            tp1 = entry + atr * 3
            tp2 = entry + atr * 4.5
            tp3 = entry + atr * 6
        else:
            stop_loss = entry + atr * 1.5
            tp1 = entry - atr * 3
            tp2 = entry - atr * 4.5
            tp3 = entry - atr * 6

        return {
            'direction': signal.direction,
            'entry_price': entry,
            'stop_loss': stop_loss,
            'take_profit_1': tp1,
            'take_profit_2': tp2,
            'take_profit_3': tp3,
            'risk_reward_1': 3.0,
            'risk_reward_2': 4.5,
            'risk_reward_3': 6.0,
            'confidence': signal.confidence,
            'confluence_factors': signal.confluence_factors,
            'position_size_risk_percent': 2.0,
        }


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_ict_engine: Optional[ICTStrategyEngine] = None


def get_ict_engine() -> ICTStrategyEngine:
    """Get or create ICT engine singleton."""
    global _ict_engine
    if _ict_engine is None:
        _ict_engine = ICTStrategyEngine()
    return _ict_engine
