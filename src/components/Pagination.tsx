import React from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Plus } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  hasMore?: boolean;
  itemLabel?: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 25,
  onPageChange,
  hasMore = false,
  itemLabel = 'riwayat',
  onLoadMore,
  isLoadingMore = false,
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= 0) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate pagination items with ellipses
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();
  const isLastPage = currentPage >= totalPages;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-xs ${className}`}
      aria-label="Paginasi navigasi"
    >
      {/* Summary Info */}
      <div className="text-slate-600 dark:text-slate-400 font-mono text-[11px] sm:text-xs">
        Menampilkan <span className="font-bold text-slate-900 dark:text-white">{startItem}-{endItem}</span> dari{' '}
        <span className="font-bold text-slate-900 dark:text-white">
          {totalItems}
          {hasMore ? '+' : ''}
        </span>{' '}
        {itemLabel}
      </div>

      {/* Controls Container */}
      <div className="flex items-center flex-wrap gap-2 justify-between sm:justify-end">
        {/* Tombol Muat Lebih Banyak jika di halaman terakhir dan hasMore = true */}
        {hasMore && isLastPage && onLoadMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 text-xs shadow-2xs"
            title="Tarik data tambahan dari server"
          >
            {isLoadingMore ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memuat...</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Muat Lebih Banyak</span>
              </>
            )}
          </button>
        )}

        {/* Page Nav Buttons */}
        <nav aria-label="Navigasi Halaman" className="flex items-center gap-1">
          {/* Tombol Sebelumnya */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Halaman sebelumnya"
            className="min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1b2d] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden md:inline">Sebelumnya</span>
          </button>

          {/* Nomor-nomor Halaman */}
          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="min-w-[32px] min-h-[40px] flex items-center justify-center text-slate-400 select-none font-mono"
                  >
                    …
                  </span>
                );
              }

              const pageNum = Number(p);
              const isActive = pageNum === currentPage;

              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  aria-label={`Ke halaman ${pageNum}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-w-[40px] min-h-[40px] px-2 py-1 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center shadow-2xs cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xs border border-indigo-600 dark:border-indigo-500'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1b2d] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Tombol Berikutnya */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Halaman berikutnya"
            className="min-w-[40px] min-h-[40px] px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1b2d] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs cursor-pointer"
          >
            <span className="hidden md:inline">Berikutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Pagination;
