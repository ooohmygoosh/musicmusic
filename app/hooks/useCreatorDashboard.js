import { useCallback, useEffect, useState } from "react";
import { getCreatorDashboard } from "../services/apiClient";

const EMPTY_DASHBOARD = {
  totals: {
    plays: 0,
    effective_plays: 0,
    estimated_revenue: 0,
    creator_share: 0,
    platform_share: 0
  },
  songs: [],
  period: "demo"
};

export function useCreatorDashboard(userId) {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!userId) {
      setDashboard(EMPTY_DASHBOARD);
      setError("");
      return EMPTY_DASHBOARD;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getCreatorDashboard(userId);
      const next = {
        ...EMPTY_DASHBOARD,
        ...data,
        totals: { ...EMPTY_DASHBOARD.totals, ...(data.totals || {}) },
        songs: Array.isArray(data.songs) ? data.songs : []
      };
      setDashboard(next);
      return next;
    } catch (err) {
      const message = String(err?.message || err || "creator dashboard failed");
      setError(message);
      return EMPTY_DASHBOARD;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}
