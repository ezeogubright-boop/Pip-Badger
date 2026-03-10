import { useTradingStore } from '@/store/tradingStore';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        useTradingStore.getState().setWsConnected(true);
        
        // Subscribe to channels
        this.send({
          action: 'subscribe',
          channels: ['market', 'positions', 'signals', 'risk']
        });

        // Start ping interval
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        useTradingStore.getState().setWsConnected(false);
        this.stopPingInterval();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.attemptReconnect();
    }
  }

  disconnect() {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(message: any) {
    const store = useTradingStore.getState();

    switch (message.type) {
      case 'connection':
        console.log('WebSocket connection confirmed:', message.message);
        break;

      case 'market_update':
        if (message.data) {
          Object.entries(message.data).forEach(([symbol, data]: [string, any]) => {
            store.setMarketData(symbol, {
              symbol,
              price: data.price,
              change24h: data.change,
              volume24h: 0,
              high24h: 0,
              low24h: 0,
            });
          });
        }
        break;

      case 'position_update':
        if (message.positions) {
          // Full position refresh from backend (includes all fields now)
          const formatted = message.positions.map((p: any) => ({
            id: p.id,
            symbol: p.symbol,
            direction: p.direction,
            entryPrice: p.entry_price,
            currentPrice: p.current_price,
            quantity: p.quantity,
            lotSize: p.lot_size ?? p.quantity,
            unrealizedPnl: p.unrealized_pnl,
            stopLoss: p.stop_loss,
            takeProfit: p.take_profit,
            riskPercent: p.risk_percent,
            openTime: p.open_time,
          }));
          store.setPositions(formatted);
        }
        break;

      case 'risk_update':
        if (message.data) {
          const d = message.data;
          store.setRiskMetrics({
            accountBalance: d.account_balance,
            equity: d.equity,
            openPnl: d.open_pnl,
            dailyPnl: d.daily_pnl,
            currentDrawdown: d.current_drawdown,
            maxDrawdown: d.max_drawdown,
            totalRiskExposed: d.total_risk_exposed,
            marginUsed: d.margin_used,
            marginAvailable: d.margin_available,
            riskLevel: d.risk_level,
            tradesToday: d.trades_today,
            consecutiveLosses: d.consecutive_losses,
            winRate: d.win_rate,
            sharpeRatio: d.sharpe_ratio,
          });
        }
        break;

      case 'trade_executed':
        console.log('Trade executed:', message.data);
        // Refresh positions
        this.refreshPositions();
        break;

      case 'signal':
        if (message.data) {
          store.addSignal(message.data);
        }
        break;

      case 'risk_alert':
        console.warn('Risk alert:', message.data);
        if (message.data?.kill_switch) {
          store.setKillSwitch(true);
          store.setTradingEnabled(false);
        }
        break;

      case 'pong':
        // Ping response received
        break;

      default:
        console.log('Unknown message type:', message.type);
    }

    // Call registered handlers
    const handlers = this.messageHandlers.get(message.type) || [];
    handlers.forEach(handler => handler(message));
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.send({ action: 'ping' });
    }, 30000);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private async refreshPositions() {
    try {
      const { data } = await import('./api').then(m => m.getPositions());
      useTradingStore.getState().setPositions(data.open_positions || []);
    } catch (error) {
      console.error('Failed to refresh positions:', error);
    }
  }

  // Public method to register message handlers
  onMessage(type: string, handler: (data: any) => void) {
    const handlers = this.messageHandlers.get(type) || [];
    handlers.push(handler);
    this.messageHandlers.set(type, handlers);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.messageHandlers.get(type) || [];
      this.messageHandlers.set(
        type,
        currentHandlers.filter(h => h !== handler)
      );
    };
  }
}

export const wsService = new WebSocketService();
export default wsService;
