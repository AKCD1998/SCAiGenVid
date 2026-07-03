import { useEffect, useState } from "react";
import { api } from "./api.js";

// Module-level cache so every component that needs config (aspect ratios, duration
// allow-lists, the USD->THB display rate) shares one fetch instead of each firing
// its own request on mount.
let cachedConfigPromise = null;

function loadConfig() {
  if (!cachedConfigPromise) {
    cachedConfigPromise = api.getVideoJobConfig().catch((error) => {
      cachedConfigPromise = null; // allow retry on next mount if this failed
      throw error;
    });
  }
  return cachedConfigPromise;
}

export function useVideoStudioConfig() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadConfig()
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch((err) => {
        if (active) setError(err.message || "โหลดการตั้งค่าไม่สำเร็จ");
      });
    return () => {
      active = false;
    };
  }, []);

  return { config, error };
}
