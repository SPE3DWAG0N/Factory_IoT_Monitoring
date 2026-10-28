"""
Google Cloud Functions — Unified Entry Points
Exposes entry point functions for:
  - plant-fault-handler (fault_handler)
  - plant-store-readings (store_readings)
"""

from fault_handler import fault_handler
from store_readings import store_readings

__all__ = ["fault_handler", "store_readings"]

