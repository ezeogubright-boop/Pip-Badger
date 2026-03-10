"""
Institutional Risk Management Engine
Elite-level capital protection and position sizing
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RiskMetrics:
    """Real-time risk metrics"""
    account_balance: float
    equity: float
    open_pnl: float
    daily_pnl: float
    daily_drawdown: float
    max_drawdown: float
    current_drawdown: float
    total_risk_exposed: float  # Sum of all position risks
    margin_used: float
    margin_available: float
    risk_level: RiskLevel
    trades_today: int
    consecutive_losses: int
    win_rate_20trades: float
    sharpe_ratio: float


@dataclass
class Position:
    """Trade position"""
    id: str
    symbol: str
    direction: str  # "long" or "short"
    entry_price: float
    current_price: float
    quantity: float
    stop_loss: float
    take_profit: float
    risk_amount: float
    risk_percent: float
    open_time: datetime
    lot_size: float = 0.01  # MT5 lot size
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0
    status: str = "open"  # open, closed, partial


@dataclass
class RiskLimits:
    """Risk limits configuration"""
    max_risk_per_trade: float = 2.0  # % of account
    max_daily_risk: float = 6.0  # % of account per day
    max_weekly_risk: float = 10.0  # % of account per week
    max_daily_loss: float = 4.0  # % of account
    max_weekly_drawdown: float = 8.0  # % of account
    max_open_positions: int = 5
    max_correlated_positions: int = 2
    max_margin_usage: float = 50.0  # % of account
    kill_switch_losses: int = 3  # Consecutive losses before pause
    kill_switch_daily_loss: float = 4.0  # % daily loss before stop


class RiskEngine:
    """
    Institutional Risk Management Engine
    
    Features:
    - Dynamic position sizing based on volatility
    - Portfolio heat management
    - Correlation risk monitoring
    - Kill switch mechanisms
    - Drawdown protection
    """
    
    def __init__(self, 
                 initial_balance: float = 100000.0,
                 risk_limits: Optional[RiskLimits] = None):
        
        self.initial_balance = initial_balance
        self.current_balance = initial_balance
        self.risk_limits = risk_limits or RiskLimits()
        
        # Position tracking
        self.positions: Dict[str, Position] = {}
        self.closed_positions: List[Position] = []
        
        # Daily/Weekly tracking
        self.daily_pnl: float = 0.0
        self.weekly_pnl: float = 0.0
        self.daily_trades: int = 0
        self.consecutive_losses: int = 0
        self.trade_history: List[Dict] = []
        
        # Drawdown tracking
        self.peak_balance = initial_balance
        self.max_drawdown = 0.0
        self.current_drawdown = 0.0
        
        # Risk state
        self.trading_enabled = True
        self.kill_switch_triggered = False
        self.risk_level = RiskLevel.LOW
        
        # Performance metrics
        self.total_trades = 0
        self.winning_trades = 0
        self.losing_trades = 0
        
        logger.info(f"Risk Engine initialized with ${initial_balance:,.2f} balance")
    
    def calculate_position_size(self, 
                                 entry_price: float,
                                 stop_loss: float,
                                 confidence: float = 0.7,
                                 volatility_regime: str = "normal") -> Dict:
        """
        Calculate optimal position size using Kelly Criterion + Risk Limits
        
        Formula: Position Size = (Account Risk % / Trade Risk %) * Kelly Factor
        """
        # Base risk per trade (2% default)
        base_risk_percent = self.risk_limits.max_risk_per_trade
        
        # Adjust for confidence (higher confidence = slightly larger size)
        confidence_multiplier = 0.8 + (confidence * 0.4)  # 0.8 to 1.2
        
        # Adjust for volatility regime
        volatility_multipliers = {
            "low": 1.2,
            "normal": 1.0,
            "high": 0.7
        }
        vol_multiplier = volatility_multipliers.get(volatility_regime, 1.0)
        
        # Calculate effective risk percent
        effective_risk = base_risk_percent * confidence_multiplier * vol_multiplier
        effective_risk = min(effective_risk, base_risk_percent * 1.5)  # Cap at 3%
        
        # Trade risk (distance to stop)
        trade_risk_percent = abs(entry_price - stop_loss) / entry_price * 100
        
        # Calculate position size
        risk_amount = self.current_balance * (effective_risk / 100)
        position_value = risk_amount / (trade_risk_percent / 100)
        quantity = position_value / entry_price
        
        # Apply maximum position limits
        max_position_value = self.current_balance * 0.20  # Max 20% in one trade
        if position_value > max_position_value:
            quantity = max_position_value / entry_price
            position_value = max_position_value
            risk_amount = position_value * (trade_risk_percent / 100)
        
        return {
            'quantity': round(quantity, 6),
            'position_value': position_value,
            'risk_amount': risk_amount,
            'risk_percent': effective_risk,
            'leverage_used': position_value / self.current_balance,
            'confidence_adjusted': confidence_multiplier,
            'volatility_adjusted': vol_multiplier
        }
    
    def can_open_position(self, signal: Dict) -> Tuple[bool, str]:
        """
        Check if new position can be opened based on risk rules
        Returns (allowed, reason)
        """
        # Check kill switch
        if self.kill_switch_triggered:
            return False, "Kill switch activated - trading paused"
        
        if not self.trading_enabled:
            return False, "Trading manually disabled"
        
        # Check daily loss limit
        daily_loss_percent = abs(min(0, self.daily_pnl)) / self.initial_balance * 100
        if daily_loss_percent >= self.risk_limits.max_daily_loss:
            self._trigger_kill_switch("Daily loss limit reached")
            return False, f"Daily loss limit reached: {daily_loss_percent:.2f}%"
        
        # Check consecutive losses
        if self.consecutive_losses >= self.risk_limits.kill_switch_losses:
            self._trigger_kill_switch("Consecutive loss limit reached")
            return False, f"Kill switch: {self.consecutive_losses} consecutive losses"
        
        # Check max open positions
        if len(self.positions) >= self.risk_limits.max_open_positions:
            return False, f"Max open positions reached: {self.risk_limits.max_open_positions}"
        
        # Check total risk exposure
        total_risk = sum(pos.risk_percent for pos in self.positions.values())
        if total_risk + signal.get('risk_percent', 2.0) > self.risk_limits.max_daily_risk:
            return False, f"Daily risk limit would be exceeded"
        
        # Check correlation (simplified - in production check actual correlations)
        symbol = signal.get('symbol', 'UNKNOWN')
        correlated_count = sum(1 for pos in self.positions.values() 
                              if self._is_correlated(pos.symbol, symbol))
        if correlated_count >= self.risk_limits.max_correlated_positions:
            return False, f"Max correlated positions reached for {symbol}"
        
        # Check margin
        margin_required = signal.get('position_value', 0) * 0.1  # 10% margin assumption
        current_margin = sum(pos.quantity * pos.entry_price * 0.1 for pos in self.positions.values())
        if current_margin + margin_required > self.current_balance * (self.risk_limits.max_margin_usage / 100):
            return False, "Insufficient margin available"
        
        return True, "Position allowed"
    
    def open_position(self, position_data: Dict) -> Optional[Position]:
        """Open a new position with risk tracking"""
        can_trade, reason = self.can_open_position(position_data)
        
        if not can_trade:
            logger.warning(f"Position rejected: {reason}")
            return None
        
        position = Position(
            id=position_data.get('id', self._generate_position_id()),
            symbol=position_data['symbol'],
            direction=position_data['direction'],
            entry_price=position_data['entry_price'],
            current_price=position_data['entry_price'],
            quantity=position_data['quantity'],
            stop_loss=position_data['stop_loss'],
            take_profit=position_data['take_profit'],
            risk_amount=position_data['risk_amount'],
            risk_percent=position_data['risk_percent'],
            open_time=datetime.now(),
            lot_size=position_data.get('lot_size', position_data['quantity']),
        )
        
        self.positions[position.id] = position
        self.daily_trades += 1
        
        logger.info(f"Position opened: {position.symbol} {position.direction} "
                   f"@{position.entry_price} Qty: {position.quantity} "
                   f"Risk: ${position.risk_amount:.2f}")
        
        return position
    
    def close_position(self, position_id: str, exit_price: float, 
                       reason: str = "manual") -> Dict:
        """Close position and update risk metrics"""
        if position_id not in self.positions:
            return {'success': False, 'error': 'Position not found'}
        
        position = self.positions[position_id]
        position.current_price = exit_price
        
        # Calculate PnL
        if position.direction == "long":
            pnl = (exit_price - position.entry_price) * position.quantity
        else:
            pnl = (position.entry_price - exit_price) * position.quantity
        
        position.realized_pnl = pnl
        position.status = "closed"
        
        # Update account
        self.current_balance += pnl
        self.daily_pnl += pnl
        self.weekly_pnl += pnl
        
        # Update drawdown tracking
        if self.current_balance > self.peak_balance:
            self.peak_balance = self.current_balance
        else:
            self.current_drawdown = (self.peak_balance - self.current_balance) / self.peak_balance * 100
            self.max_drawdown = max(self.max_drawdown, self.current_drawdown)
        
        # Update consecutive losses
        if pnl < 0:
            self.consecutive_losses += 1
            self.losing_trades += 1
        else:
            self.consecutive_losses = 0
            self.winning_trades += 1
        
        self.total_trades += 1
        
        # Move to closed positions
        self.closed_positions.append(position)
        del self.positions[position_id]
        
        # Check kill switches after close
        self._check_kill_switches()
        
        # Log trade
        trade_record = {
            'position_id': position_id,
            'symbol': position.symbol,
            'direction': position.direction,
            'entry': position.entry_price,
            'exit': exit_price,
            'pnl': pnl,
            'pnl_percent': pnl / self.initial_balance * 100,
            'reason': reason,
            'time': datetime.now()
        }
        self.trade_history.append(trade_record)
        
        logger.info(f"Position closed: {position.symbol} PnL: ${pnl:+.2f} ({pnl/self.initial_balance*100:+.2f}%) - {reason}")
        
        return {
            'success': True,
            'pnl': pnl,
            'balance': self.current_balance,
            'drawdown': self.current_drawdown
        }
    
    def update_positions(self, price_data: Dict[str, float]):
        """Update all positions with current prices"""
        for position in self.positions.values():
            if position.symbol in price_data:
                position.current_price = price_data[position.symbol]
                
                # Calculate unrealized PnL
                if position.direction == "long":
                    position.unrealized_pnl = (position.current_price - position.entry_price) * position.quantity
                else:
                    position.unrealized_pnl = (position.entry_price - position.current_price) * position.quantity
    
    def get_risk_metrics(self) -> RiskMetrics:
        """Get current risk metrics"""
        open_pnl = sum(pos.unrealized_pnl for pos in self.positions.values())
        total_risk = sum(pos.risk_percent for pos in self.positions.values())
        margin_used = sum(pos.quantity * pos.entry_price * 0.1 for pos in self.positions.values())
        
        # Determine risk level
        if self.current_drawdown > self.risk_limits.max_weekly_drawdown * 0.8:
            risk_level = RiskLevel.CRITICAL
        elif self.current_drawdown > self.risk_limits.max_weekly_drawdown * 0.5:
            risk_level = RiskLevel.HIGH
        elif total_risk > self.risk_limits.max_daily_risk * 0.7:
            risk_level = RiskLevel.MEDIUM
        else:
            risk_level = RiskLevel.LOW
        
        # Calculate win rate
        if self.total_trades > 0:
            win_rate = self.winning_trades / self.total_trades
        else:
            win_rate = 0.0
        
        # Calculate Sharpe (simplified)
        sharpe = self._calculate_sharpe()
        
        return RiskMetrics(
            account_balance=self.initial_balance,
            equity=self.current_balance + open_pnl,
            open_pnl=open_pnl,
            daily_pnl=self.daily_pnl,
            daily_drawdown=abs(min(0, self.daily_pnl)) / self.initial_balance * 100,
            max_drawdown=self.max_drawdown,
            current_drawdown=self.current_drawdown,
            total_risk_exposed=total_risk,
            margin_used=margin_used,
            margin_available=self.current_balance * (self.risk_limits.max_margin_usage / 100) - margin_used,
            risk_level=risk_level,
            trades_today=self.daily_trades,
            consecutive_losses=self.consecutive_losses,
            win_rate_20trades=win_rate,
            sharpe_ratio=sharpe
        )
    
    def _trigger_kill_switch(self, reason: str):
        """Activate kill switch"""
        self.kill_switch_triggered = True
        self.trading_enabled = False
        logger.critical(f"KILL SWITCH ACTIVATED: {reason}")
    
    def _check_kill_switches(self):
        """Check and trigger kill switches if needed"""
        # Daily loss
        daily_loss_percent = abs(min(0, self.daily_pnl)) / self.initial_balance * 100
        if daily_loss_percent >= self.risk_limits.kill_switch_daily_loss:
            self._trigger_kill_switch(f"Daily loss limit: {daily_loss_percent:.2f}%")
            return
        
        # Weekly drawdown
        if self.current_drawdown >= self.risk_limits.max_weekly_drawdown:
            self._trigger_kill_switch(f"Weekly drawdown limit: {self.current_drawdown:.2f}%")
            return
    
    def _is_correlated(self, symbol1: str, symbol2: str) -> bool:
        """Check if two symbols are correlated (simplified)"""
        # In production, use actual correlation matrix
        correlated_groups = [
            {'EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'},  # USD pairs
            {'USDJPY', 'USDCHF', 'USDCAD'},  # USD base
            {'XAUUSD', 'XAGUSD'},  # Metals
            {'BTCUSD', 'ETHUSD'},  # Crypto
        ]
        
        for group in correlated_groups:
            if symbol1 in group and symbol2 in group:
                return True
        return False
    
    def _generate_position_id(self) -> str:
        """Generate unique position ID"""
        import uuid
        return f"POS_{uuid.uuid4().hex[:12].upper()}"
    
    def _calculate_sharpe(self) -> float:
        """Calculate Sharpe ratio from trade history"""
        if len(self.trade_history) < 10:
            return 0.0
        
        returns = [t['pnl'] for t in self.trade_history[-20:]]
        if not returns or np.std(returns) == 0:
            return 0.0
        
        return np.mean(returns) / np.std(returns) * np.sqrt(252)  # Annualized
    
    def reset_daily(self):
        """Reset daily counters (call at market open)"""
        self.daily_pnl = 0.0
        self.daily_trades = 0
        logger.info("Daily risk metrics reset")
    
    def reset_weekly(self):
        """Reset weekly counters"""
        self.weekly_pnl = 0.0
        logger.info("Weekly risk metrics reset")
    
    def manual_override(self, enable_trading: bool):
        """Manual override for trading enablement"""
        self.trading_enabled = enable_trading
        if enable_trading:
            self.kill_switch_triggered = False
            self.consecutive_losses = 0
        logger.info(f"Trading manually {'enabled' if enable_trading else 'disabled'}")


# Singleton instance
_risk_engine: Optional[RiskEngine] = None


def get_risk_engine(initial_balance: float = 100000.0) -> RiskEngine:
    """Get or create Risk Engine singleton"""
    global _risk_engine
    if _risk_engine is None:
        _risk_engine = RiskEngine(initial_balance=initial_balance)
    return _risk_engine
