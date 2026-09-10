import { useEffect, useMemo, useState } from "react";
import { TablePagination } from "@mui/material";

const DEFAULT_ROWS_PER_PAGE = [10, 25, 50, 100];

/**
 * Client-side pagination for an already-fetched/filtered row array.
 * Resets to page 0 whenever the row count shrinks below the current page
 * (e.g. after a search/filter change) so the table never renders blank.
 */
export function usePagedRows<T>(rows: T[], initialPageSize = 25) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [rows.length, pageSize, page]);

  const pagedRows = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page, pageSize],
  );

  return { page, setPage, pageSize, setPageSize, pagedRows, totalCount: rows.length };
}

export function ListPagination({
  count,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE,
}: {
  count: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  rowsPerPageOptions?: number[];
}) {
  if (count === 0) return null;
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      onPageChange={(_e, newPage) => onPageChange(newPage)}
      rowsPerPage={pageSize}
      onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
      rowsPerPageOptions={rowsPerPageOptions}
    />
  );
}
