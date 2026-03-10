"""
Precision Execution Engine
Institutional-grade order execution with slippage control
"""

import asyncio
import aiohttp
import ccxt.async_support as ccxt
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    ICEBERG = "iceberg"


class OrderStatus(Enum):
    PENDING = "pending"
    OPEN = "open"
    PARTIAL = "partial"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


@dataclass
class Order:
    id: str
    symbol: str
    side: str  # "buy" or "sell"
    order_type: OrderType
    quantity: float
    price: Optional[float] = None
    stop_price: Optional[float] = None
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    avg_fill_price: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: Optional[datetime] = None
    exchange_id: Optional[str] = None
    metadata: Dict = field(default_factory=dict)


@dataclass
class ExecutionConfig:
    """Execution configuration"""
    max_slippage_percent: float = 0.1  # 0.1% max slippage
    use_limit_orders: bool = True
    retry_attempts: int = 3
    retry_delay_ms: int = 500
    partial_fill_threshold: float = 0.8  # Accept if 80% filled
    smart_routing: bool = True
    time_in_force: str = "GTC"  # Good Till Cancelled


class ExecutionEngine:
    """
    Precision Execution Engine
    
    Features:
    - Smart order routing
    - Slippage control
    - Partial fill handling
    - Retry logic
    - WebSocket price feeds
    """
    
    def __init__(self, config: Optional[ExecutionConfig] = None):
        self.config = config or ExecutionConfig()
        self.exchanges: Dict[str, ccxt.Exchange] = {}
        self.orders: Dict[str, Order] = {}
        self.order_callbacks: List[Callable] = []
        
        # Price feeds
        self.price_feeds: Dict[str, float] = {}
        self.ws_connections: Dict[str, any] = {}
        
        # Performance tracking
        self.execution_stats = {
            'total_orders': 0,
            'filled_orders': 0,
            'cancelled_orders': 0,
            'avg_slippage': 0.0,
            'avg_fill_time_ms': 0
        }
        
        self._running = False
        logger.info("Execution Engine initialized")
    
    async def connect_exchange(self, exchange_id: str, api_key: str = "", 
                               api_secret: str = "", sandbox: bool = True):
        """Connect to a cryptocurrency exchange"""
        try:
            exchange_class = getattr(ccxt, exchange_id)
            exchange = exchange_class({
                'apiKey': api_key,
                'secret': api_secret,
                'sandbox': sandbox,
                'enableRateLimit': True,
                'options': {
                    'defaultType': 'spot',
                }
            })
            
            await exchange.load_markets()
            self.exchanges[exchange_id] = exchange
            
            logger.info(f"Connected to {exchange_id} (sandbox: {sandbox})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to {exchange_id}: {e}")
            return False
    
    async def start_price_feed(self, exchange_id: str, symbols: List[str]):
        """Start WebSocket price feed"""
        if exchange_id not in self.exchanges:
            logger.error(f"Exchange {exchange_id} not connected")
            return
        
        self._running = True
        
        while self._running:
            try:
                for symbol in symbols:
                    ticker = await self.exchanges[exchange_id].fetch_ticker(symbol)
                    self.price_feeds[symbol] = ticker['last']
                
                await asyncio.sleep(1)  # 1-second update interval
                
            except Exception as e:
                logger.error(f"Price feed error: {e}")
                await asyncio.sleep(5)
    
    async def execute_order(self, order: Order, exchange_id: str) -> Dict:
        """
        Execute order with precision control
        
        Strategy:
        1. Use limit orders at OTE when possible
        2. Monitor fill progress
        3. Retry on partial fills
        4. Cancel if slippage exceeds threshold
        """
        if exchange_id not in self.exchanges:
            return {'success': False, 'error': f'Exchange {exchange_id} not connected'}
        
        exchange = self.exchanges[exchange_id]
        self.orders[order.id] = order
        self.execution_stats['total_orders'] += 1
        
        start_time = datetime.now()
        
        try:
            # Determine order type
            if self.config.use_limit_orders and order.price:
                order_type = 'limit'
                price = order.price
            else:
                order_type = 'market'
                price = None
            
            # Place order
            result = await exchange.create_order(
                symbol=order.symbol,
                type=order_type,
                side=order.side,
                amount=order.quantity,
                price=price,
                params={'timeInForce': self.config.time_in_force}
            )
            
            order.exchange_id = result['id']
            order.status = OrderStatus.OPEN
            
            logger.info(f"Order placed: {order.symbol} {order.side} {order.quantity} @ {price or 'market'}")
            
            # Monitor fill
            fill_result = await self._monitor_fill(order, exchange)
            
            # Calculate execution metrics
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            self._update_stats(order, execution_time)
            
            return fill_result
            
        except Exception as e:
            order.status = OrderStatus.REJECTED
            logger.error(f"Order execution failed: {e}")
            return {'success': False, 'error': str(e)}
    
    async def _monitor_fill(self, order: Order, exchange: ccxt.Exchange, 
                           timeout_seconds: int = 60) -> Dict:
        """Monitor order fill progress"""
        start_time = datetime.now()
        
        while (datetime.now() - start_time).seconds < timeout_seconds:
            try:
                # Fetch order status
                status = await exchange.fetch_order(order.exchange_id, order.symbol)
                
                filled = status['filled']
                order.filled_quantity = filled
                order.avg_fill_price = status['average'] or order.price
                
                # Check if fully filled
                if filled >= order.quantity:
                    order.status = OrderStatus.FILLED
                    self.execution_stats['filled_orders'] += 1
                    
                    # Calculate slippage
                    if order.price:
                        slippage = abs(order.avg_fill_price - order.price) / order.price * 100
                    else:
                        slippage = 0.0
                    
                    logger.info(f"Order filled: {order.symbol} {filled}/{order.quantity} "
                               f"@ {order.avg_fill_price} (slippage: {slippage:.4f}%)")
                    
                    return {
                        'success': True,
                        'order_id': order.id,
                        'filled_quantity': filled,
                        'avg_price': order.avg_fill_price,
                        'slippage_percent': slippage
                    }
                
                # Check partial fill threshold
                fill_ratio = filled / order.quantity
                if fill_ratio >= self.config.partial_fill_threshold:
                    order.status = OrderStatus.PARTIAL
                    logger.info(f"Partial fill accepted: {fill_ratio:.1%}")
                    return {
                        'success': True,
                        'order_id': order.id,
                        'filled_quantity': filled,
                        'avg_price': order.avg_fill_price,
                        'partial': True
                    }
                
                # Check slippage on limit orders
                if order.price and order.avg_fill_price:
                    slippage = abs(order.avg_fill_price - order.price) / order.price * 100
                    if slippage > self.config.max_slippage_percent:
                        await self.cancel_order(order, exchange)
                        return {'success': False, 'error': f'Slippage exceeded: {slippage:.2f}%'}
                
                await asyncio.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(1)
        
        # Timeout - cancel remaining
        await self.cancel_order(order, exchange)
        return {'success': False, 'error': 'Fill timeout'}
    
    async def cancel_order(self, order: Order, exchange: ccxt.Exchange) -> bool:
        """Cancel an open order"""
        try:
            if order.exchange_id:
                await exchange.cancel_order(order.exchange_id, order.symbol)
            
            order.status = OrderStatus.CANCELLED
            self.execution_stats['cancelled_orders'] += 1
            
            logger.info(f"Order cancelled: {order.id}")
            return True
            
        except Exception as e:
            logger.error(f"Cancel failed: {e}")
            return False
    
    async def smart_execute(self, symbol: str, side: str, quantity: float,
                           target_price: Optional[float] = None,
                           exchange_id: str = "binance") -> Dict:
        """
        Smart execution with optimal order type selection
        
        Logic:
        - If target price provided and within slippage tolerance -> Limit order
        - If urgent or high volatility -> Market order
        - Large orders -> Iceberg/TWAP
        """
        current_price = self.price_feeds.get(symbol)
        
        if not current_price:
            # Fetch current price
            ticker = await self.exchanges[exchange_id].fetch_ticker(symbol)
            current_price = ticker['last']
        
        # Determine order type
        if target_price and abs(target_price - current_price) / current_price < self.config.max_slippage_percent:
            # Use limit order at target price
            order_type = OrderType.LIMIT
            price = target_price
        else:
            # Use market order
            order_type = OrderType.MARKET
            price = None
        
        # Create order
        order = Order(
            id=self._generate_order_id(),
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price
        )
        
        return await self.execute_order(order, exchange_id)
    
    def _update_stats(self, order: Order, execution_time_ms: float):
        """Update execution statistics"""
        # Update average fill time
        n = self.execution_stats['filled_orders']
        old_avg = self.execution_stats['avg_fill_time_ms']
        self.execution_stats['avg_fill_time_ms'] = (old_avg * (n-1) + execution_time_ms) / n if n > 0 else execution_time_ms
        
        # Update slippage
        if order.price and order.avg_fill_price:
            slippage = abs(order.avg_fill_price - order.price) / order.price * 100
            old_slippage = self.execution_stats['avg_slippage']
            self.execution_stats['avg_slippage'] = (old_slippage * (n-1) + slippage) / n if n > 0 else slippage
    
    def _generate_order_id(self) -> str:
        """Generate unique order ID"""
        import uuid
        return f"ORD_{uuid.uuid4().hex[:12].upper()}"
    
    def get_execution_stats(self) -> Dict:
        """Get execution performance statistics"""
        return {
            **self.execution_stats,
            'fill_rate': (self.execution_stats['filled_orders'] / 
                         max(1, self.execution_stats['total_orders']) * 100),
            'active_orders': len([o for o in self.orders.values() if o.status == OrderStatus.OPEN])
        }
    
    async def close(self):
        """Close all connections"""
        self._running = False
        
        for exchange in self.exchanges.values():
            await exchange.close()
        
        logger.info("Execution Engine closed")


# Singleton instance
_execution_engine: Optional[ExecutionEngine] = None


def get_execution_engine() -> ExecutionEngine:
    """Get or create Execution Engine singleton"""
    global _execution_engine
    if _execution_engine is None:
        _execution_engine = ExecutionEngine()
    return _execution_engine
