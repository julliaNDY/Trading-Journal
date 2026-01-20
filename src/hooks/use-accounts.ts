import { useState, useEffect, useCallback, useRef } from 'react';

interface Account {
  id: string;
  name: string;
  broker: string | null;
  description: string | null;
  color: string;
  initialBalance: number | null;
  currentBalance: number | null;
  tradesCount: number;
  totalPnl: number;
  roi: number | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UseAccountsOptions {
  limit?: number;
  search?: string;
  broker?: string;
}

interface UseAccountsReturn {
  accounts: Account[];
  pagination: PaginationInfo | null;
  isLoading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  hasMore: boolean;
}

export function useAccounts(options: UseAccountsOptions = {}): UseAccountsReturn {
  const { limit = 50, search = '', broker = '' } = options;
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchAccounts = useCallback(
    async (pageNum: number, append = false) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: limit.toString(),
        });

        if (search) params.append('search', search);
        if (broker) params.append('broker', broker);

        const response = await fetch(`/api/accounts?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch accounts');
        }

        const data = await response.json();

        if (append) {
          setAccounts((prev) => [...prev, ...data.accounts]);
        } else {
          setAccounts(data.accounts);
        }

        setPagination(data.pagination);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching accounts:', err);
          setError(err.message || 'Failed to fetch accounts');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [limit, search, broker]
  );

  // Initial fetch and when search/broker changes
  useEffect(() => {
    setPage(1);
    fetchAccounts(1, false);

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchAccounts]);

  const loadMore = useCallback(() => {
    if (pagination?.hasNextPage && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchAccounts(nextPage, true);
    }
  }, [pagination, isLoading, page, fetchAccounts]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchAccounts(1, false);
  }, [fetchAccounts]);

  const hasMore = pagination?.hasNextPage ?? false;

  return {
    accounts,
    pagination,
    isLoading,
    error,
    loadMore,
    refresh,
    hasMore,
  };
}
