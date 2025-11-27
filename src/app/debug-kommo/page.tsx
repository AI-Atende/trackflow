"use client";

import React, { useState } from 'react';

export default function DebugKommoPage() {
  const [config, setConfig] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testIntegration = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Config
      const configRes = await fetch('/api/integrations/kommo');
      const configData = await configRes.json();
      setConfig(configData);

      if (!configRes.ok) throw new Error('Failed to fetch config');

      // 2. Fetch Data
      const today = new Date().toISOString().split('T')[0];
      const dataRes = await fetch(`/api/integrations/kommo/data?since=${today}&until=${today}`);
      const dataJson = await dataRes.json();
      setData(dataJson);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Kommo Integration</h1>

      <button
        onClick={testIntegration}
        className="bg-blue-600 text-white px-4 py-2 rounded mb-8"
        disabled={loading}
      >
        {loading ? 'Testing...' : 'Run Test'}
      </button>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="font-bold mb-2">Configuration (/api/integrations/kommo)</h2>
          <pre className="bg-slate-100 p-4 rounded overflow-auto h-96 text-xs">
            {config ? JSON.stringify(config, null, 2) : 'No config loaded'}
          </pre>
        </div>
        <div>
          <h2 className="font-bold mb-2">Data Response (/api/integrations/kommo/data)</h2>
          <pre className="bg-slate-100 p-4 rounded overflow-auto h-96 text-xs">
            {data ? JSON.stringify(data, null, 2) : 'No data loaded'}
          </pre>
        </div>
      </div>
    </div>
  );
}
