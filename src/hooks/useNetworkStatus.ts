/**
 * useNetworkStatus Hook
 * Monitors network connectivity and triggers sync when coming online
 */

import { useState, useEffect, useCallback } from "react";
import * as Network from "expo-network";
import type { NetworkStatus } from "../types/sync";

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    type: "unknown",
    isInternetReachable: null,
  });
  const [wasOffline, setWasOffline] = useState(false);

  const checkNetwork = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();

      const newStatus: NetworkStatus = {
        isConnected: state.isConnected ?? false,
        type: state.type === Network.NetworkStateType.WIFI
          ? "wifi"
          : state.type === Network.NetworkStateType.CELLULAR
          ? "cellular"
          : state.type === Network.NetworkStateType.NONE
          ? "none"
          : "unknown",
        isInternetReachable: state.isInternetReachable ?? null,
      };

      // Detect transition from offline to online
      if (!networkStatus.isConnected && newStatus.isConnected) {
        setWasOffline(true);
      }

      setNetworkStatus(newStatus);
      return newStatus;
    } catch (error) {
      console.error("[Network] Failed to check network status:", error);
      return networkStatus;
    }
  }, [networkStatus.isConnected]);

  useEffect(() => {
    // Initial check
    checkNetwork();

    // Poll every 5 seconds (expo-network doesn't have a listener on all platforms)
    const interval = setInterval(checkNetwork, 5000);

    return () => clearInterval(interval);
  }, []);

  const clearWasOffline = useCallback(() => {
    setWasOffline(false);
  }, []);

  return {
    ...networkStatus,
    wasOffline,
    clearWasOffline,
    refresh: checkNetwork,
  };
}

export default useNetworkStatus;
