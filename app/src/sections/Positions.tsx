import { useState, useEffect } from 'react';
import { useTradingStore } from '@/store/tradingStore';
import { getPositions, closePosition } from '@/services/api';
import { 
  TrendingUp, 
  TrendingDown, 
  X,
  Target,
  Shield,
  DollarSign,
  BarChart3,
  RefreshCw,
  Zap
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface PositionDetail {
  id: string;
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  lotSize: number;
  unrealizedPnl: number;
  realizedPnl?: number;
  stopLoss: number;
  takeProfit: number;
  riskPercent: number;
  openTime: string;
  riskReward?: number;
}

// Position Card Component
function PositionCard({ 
  position, 
  onClose 
}: { 
  position: PositionDetail; 
  onClose: (id: string) => void;
}) {
  const [closing, setClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const pnlPercent = (position.unrealizedPnl / (position.entryPrice * position.quantity)) * 100;
  const isProfitable = position.unrealizedPnl >= 0;
  
  const distanceToSL = position.direction === 'long'
    ? ((position.currentPrice - position.stopLoss) / position.currentPrice) * 100
    : ((position.stopLoss - position.currentPrice) / position.stopLoss) * 100;
  
  const distanceToTP = position.direction === 'long'
    ? ((position.takeProfit - position.currentPrice) / position.currentPrice) * 100
    : ((position.currentPrice - position.takeProfit) / position.takeProfit) * 100;
  
  const handleClose = async () => {
    setClosing(true);
    try {
      const { data } = await closePosition(position.id, position.currentPrice);
      if (data.success) {
        toast.success(`Position closed with P&L: $${data.pnl.toFixed(2)}`);
        onClose(position.id);
      }
    } catch (error) {
      toast.error('Failed to close position');
    } finally {
      setClosing(false);
      setShowConfirm(false);
    }
  };
  
  return (
    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            position.direction === 'long' ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            {position.direction === 'long' ? (
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{position.symbol}</span>
              <Badge 
                variant="outline" 
                className={position.direction === 'long' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30'}
              >
                {position.direction.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">
              Opened {new Date(position.openTime).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className={`text-2xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfitable ? '+' : ''}${position.unrealizedPnl.toFixed(2)}
          </p>
          <p className={`text-sm ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
            {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}%
          </p>
        </div>
      </div>
      
      {/* Position Details */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 p-2 sm:p-3 rounded-lg bg-slate-950/50">
        <div>
          <span className="text-xs text-slate-500">Entry Price</span>
          <p className="text-sm font-medium text-white">${position.entryPrice.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Current Price</span>
          <p className="text-sm font-medium text-white">${position.currentPrice.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Lot Size</span>
          <p className="text-sm font-medium text-indigo-400">{position.lotSize.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Quantity</span>
          <p className="text-sm font-medium text-white">{position.quantity.toFixed(6)}</p>
        </div>
        <div>
          <span className="text-xs text-slate-500">Position Value</span>
          <p className="text-sm font-medium text-white">
            ${(position.currentPrice * position.quantity).toLocaleString()}
          </p>
        </div>
      </div>
      
      {/* Risk Management */}
      <div className="space-y-3 mb-4">
        {/* Stop Loss */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Stop Loss @ ${position.stopLoss.toLocaleString()}
            </span>
            <span className="text-slate-500">{distanceToSL.toFixed(1)}% away</span>
          </div>
          <Progress 
            value={100 - distanceToSL} 
            max={100}
            className="h-1.5 bg-slate-800"
          />
        </div>
        
        {/* Take Profit */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400 flex items-center gap-1">
              <Target className="w-3 h-3" />
              Take Profit @ ${position.takeProfit.toLocaleString()}
            </span>
            <span className="text-slate-500">{distanceToTP.toFixed(1)}% away</span>
          </div>
          <Progress 
            value={Math.min(100, (100 - distanceToTP) * 2)} 
            max={100}
            className="h-1.5 bg-slate-800"
          />
        </div>
      </div>
      
      {/* Risk Metrics */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Risk:</span>
          <span className="text-slate-300">{position.riskPercent.toFixed(2)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">R/R:</span>
          <span className="text-indigo-400">1:{(position.riskReward || 3.0).toFixed(1)}</span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        {!showConfirm ? (
          <Button 
            variant="outline"
            className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
            onClick={() => setShowConfirm(true)}
          >
            <X className="w-4 h-4 mr-2" />
            Close Position
          </Button>
        ) : (
          <div className="flex gap-2 flex-1">
            <Button 
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              onClick={handleClose}
              disabled={closing}
            >
              {closing ? 'Closing...' : 'Confirm Close'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Position Summary Component
function PositionSummary({ positions }: { positions: PositionDetail[] }) {
  const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
  const totalRisk = positions.reduce((sum, p) => sum + p.riskPercent, 0);
  const longCount = positions.filter(p => p.direction === 'long').length;
  const shortCount = positions.filter(p => p.direction === 'short').length;
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-400">Total Unrealized P&L</span>
          </div>
          <p className={`text-xl font-bold ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
          </p>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-xs text-slate-400">Total Risk Exposed</span>
          </div>
          <p className="text-xl font-bold text-white">{totalRisk.toFixed(2)}%</p>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-400">Long Positions</span>
          </div>
          <p className="text-xl font-bold text-emerald-400">{longCount}</p>
        </CardContent>
      </Card>
      
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-slate-400">Short Positions</span>
          </div>
          <p className="text-xl font-bold text-red-400">{shortCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// Empty State Component
function EmptyState() {
  const { setActiveTab } = useTradingStore();
  
  return (
    <div className="flex flex-col items-center justify-center h-96 rounded-xl bg-slate-900/50 border border-slate-800">
      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-4">
        <BarChart3 className="w-10 h-10 text-slate-500" />
      </div>
      <h3 className="text-xl font-medium text-slate-300 mb-2">No Open Positions</h3>
      <p className="text-sm text-slate-500 text-center max-w-md mb-6">
        Your positions will appear here when trades are executed. 
        Check the Signals tab for high-probability setups.
      </p>
      <Button 
        variant="outline"
        className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10"
        onClick={() => setActiveTab('signals')}
      >
        <Zap className="w-4 h-4 mr-2" />
        View Signals
      </Button>
    </div>
  );
}

// Main Positions Component
export function Positions() {
  const { positions, setPositions } = useTradingStore();
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');
  
  // Fetch positions
  const fetchPositions = async () => {
    setLoading(true);
    try {
      const { data } = await getPositions();
      if (data?.open_positions) {
        const formattedPositions: PositionDetail[] = data.open_positions.map((p: any) => ({
          id: p.id,
          symbol: p.symbol,
          direction: p.direction,
          entryPrice: p.entry_price,
          currentPrice: p.current_price,
          quantity: p.quantity,
          lotSize: p.lot_size ?? p.quantity,
          unrealizedPnl: p.unrealized_pnl,
          realizedPnl: 0,
          stopLoss: p.stop_loss,
          takeProfit: p.take_profit,
          riskPercent: p.risk_percent,
          openTime: p.open_time,
          riskReward: 3.0,
        }));
        setPositions(formattedPositions);
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      toast.error('Failed to fetch positions');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchPositions();
    const interval = setInterval(fetchPositions, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Filter positions
  const filteredPositions = positions.filter((p: PositionDetail) => {
    if (filter === 'all') return true;
    return p.direction === filter;
  });
  
  const handlePositionClose = (id: string) => {
    setPositions(positions.filter((p: PositionDetail) => p.id !== id));
  };
  
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Open Positions
          </h2>
          <p className="text-slate-400 mt-1">
            Manage your active trades and monitor performance
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === 'all' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('long')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === 'long' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Long
            </button>
            <button
              onClick={() => setFilter('short')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === 'short' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Short
            </button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchPositions}
            disabled={loading}
            className="border-slate-700 text-slate-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>
      
      {/* Summary */}
      {positions.length > 0 && <PositionSummary positions={positions as PositionDetail[]} />}
      
      {/* Positions List */}
      {filteredPositions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {filteredPositions.map((position) => (
            <PositionCard 
              key={position.id} 
              position={position}
              onClose={handlePositionClose}
            />
          ))}
        </div>
      )}
    </div>
  );
}
