/**
 * Example: Using the /api/brokers endpoint in React components
 * 
 * This file demonstrates how to integrate the brokers API endpoint
 * into your frontend components with filtering, search, and pagination.
 */

'use client';

import { useState, useEffect } from 'react';
import { IntegrationStatus, BrokerAssetType } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface Broker {
  id: string;
  name: string;
  displayName: string | null;
  country: string | null;
  region: string | null;
  integrationStatus: IntegrationStatus;
  supportedAssets: BrokerAssetType[];
  logoUrl: string | null;
  websiteUrl: string | null;
  apiDocumentationUrl: string | null;
  csvTemplateUrl: string | null;
  description: string | null;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

interface BrokerFilters {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  region?: string;
  integrationStatus?: IntegrationStatus;
  assetType?: BrokerAssetType;
  isActive?: boolean;
}

interface BrokersResponse {
  success: boolean;
  data: Broker[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ============================================================================
// Custom Hook
// ============================================================================

/**
 * Hook to fetch brokers with filters
 */
export function useBrokers(filters: BrokerFilters = {}) {
  const [data, setData] = useState<BrokersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrokers = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query string
        const params = new URLSearchParams();
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
          }
        });

        const response = await fetch(`/api/brokers?${params}`);
        const result = await response.json();

        if (result.success) {
          setData(result);
        } else {
          setError(result.error || 'Failed to fetch brokers');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchBrokers();
  }, [JSON.stringify(filters)]); // Re-fetch when filters change

  return { data, loading, error };
}

// ============================================================================
// Example Component 1: Simple List
// ============================================================================

export function SimpleBrokersList() {
  const { data, loading, error } = useBrokers({
    integrationStatus: IntegrationStatus.API,
    isActive: true,
    limit: 10,
  });

  if (loading) return <div>Loading brokers...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Available Brokers</h2>
      
      <div className="grid gap-4">
        {data.data.map((broker) => (
          <div key={broker.id} className="border rounded-lg p-4">
            <h3 className="font-semibold">
              {broker.displayName || broker.name}
            </h3>
            {broker.description && (
              <p className="text-sm text-gray-600 mt-1">{broker.description}</p>
            )}
            <div className="flex gap-2 mt-2">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {broker.integrationStatus}
              </span>
              {broker.country && (
                <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                  {broker.country}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-600">
        Showing {data.data.length} of {data.pagination.total} brokers
      </div>
    </div>
  );
}

// ============================================================================
// Example Component 2: With Filters and Search
// ============================================================================

export function BrokersWithFilters() {
  const [filters, setFilters] = useState<BrokerFilters>({
    page: 1,
    limit: 20,
  });

  const { data, loading, error } = useBrokers(filters);

  const handleSearchChange = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handleCountryChange = (country: string) => {
    setFilters((prev) => ({ ...prev, country: country || undefined, page: 1 }));
  };

  const handleIntegrationStatusChange = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      integrationStatus: status ? (status as IntegrationStatus) : undefined,
      page: 1,
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        <h3 className="font-semibold">Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              type="text"
              placeholder="Search brokers..."
              className="w-full border rounded px-3 py-2"
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium mb-1">Country</label>
            <select
              className="w-full border rounded px-3 py-2"
              onChange={(e) => handleCountryChange(e.target.value)}
            >
              <option value="">All Countries</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="EU">European Union</option>
            </select>
          </div>

          {/* Integration Status */}
          <div>
            <label className="block text-sm font-medium mb-1">Integration</label>
            <select
              className="w-full border rounded px-3 py-2"
              onChange={(e) => handleIntegrationStatusChange(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="API">API Available</option>
              <option value="FILE_UPLOAD">File Upload Only</option>
              <option value="COMING_SOON">Coming Soon</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        {loading && <div>Loading...</div>}
        {error && <div className="text-red-600">Error: {error}</div>}
        
        {data && (
          <>
            <div className="grid gap-4 mb-4">
              {data.data.map((broker) => (
                <div key={broker.id} className="bg-white p-4 rounded-lg shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {broker.displayName || broker.name}
                      </h3>
                      {broker.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {broker.description}
                        </p>
                      )}
                    </div>
                    {broker.logoUrl && (
                      <img
                        src={broker.logoUrl}
                        alt={broker.name}
                        className="w-12 h-12 object-contain"
                      />
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {broker.integrationStatus}
                    </span>
                    {broker.country && (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        {broker.country}
                      </span>
                    )}
                    {broker.supportedAssets.map((asset) => (
                      <span
                        key={asset}
                        className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                      >
                        {asset}
                      </span>
                    ))}
                  </div>

                  {broker.websiteUrl && (
                    <a
                      href={broker.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                    >
                      Visit Website →
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to{' '}
                {Math.min(
                  data.pagination.page * data.pagination.limit,
                  data.pagination.total
                )}{' '}
                of {data.pagination.total} brokers
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(data.pagination.page - 1)}
                  disabled={!data.pagination.hasPrevPage}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(data.pagination.page + 1)}
                  disabled={!data.pagination.hasNextPage}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Example Component 3: Broker Selector (for forms)
// ============================================================================

export function BrokerSelector({
  value,
  onChange,
}: {
  value?: string;
  onChange: (brokerId: string) => void;
}) {
  const { data, loading } = useBrokers({
    isActive: true,
    limit: 100, // Get all active brokers
  });

  if (loading) {
    return <div className="text-sm text-gray-500">Loading brokers...</div>;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded px-3 py-2"
    >
      <option value="">Select a broker...</option>
      {data?.data.map((broker) => (
        <option key={broker.id} value={broker.id}>
          {broker.displayName || broker.name}
          {broker.country && ` (${broker.country})`}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// Example Component 4: Broker Card Grid
// ============================================================================

export function BrokerGrid() {
  const { data, loading, error } = useBrokers({
    integrationStatus: IntegrationStatus.API,
    isActive: true,
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-200 animate-pulse h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) return <div>Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.data.map((broker) => (
        <div
          key={broker.id}
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          {broker.logoUrl && (
            <img
              src={broker.logoUrl}
              alt={broker.name}
              className="w-16 h-16 object-contain mb-4"
            />
          )}
          
          <h3 className="font-bold text-lg mb-2">
            {broker.displayName || broker.name}
          </h3>
          
          {broker.description && (
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {broker.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {broker.supportedAssets.slice(0, 3).map((asset) => (
              <span
                key={asset}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
              >
                {asset}
              </span>
            ))}
            {broker.supportedAssets.length > 3 && (
              <span className="text-xs text-gray-500">
                +{broker.supportedAssets.length - 3} more
              </span>
            )}
          </div>

          {broker.websiteUrl && (
            <a
              href={broker.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Learn More →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
