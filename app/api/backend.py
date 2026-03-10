#!/usr/bin/env python3
"""
Vercel Python serverless handler for /api/status
This file runs directly on Vercel infrastructure
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status")
async def get_status():
    """Get system status"""
    try:
        from app.engines.risk_engine import get_risk_engine
        from app.engines.execution_engine import get_execution_engine
        
        risk_engine = get_risk_engine()
        exec_engine = get_execution_engine()
        
        if risk_engine is None:
            return {
                "system_status": "operational",
                "mode": "simulation",
                "trading_enabled": False,
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
        return {
            "system_status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@app.get("/")
async def health():
    """Health check"""
    return {"status": "operational"}
