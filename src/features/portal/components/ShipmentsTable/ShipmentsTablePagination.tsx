import { Button } from '@/components/ui/button'

type Props = {
  page: number
  totalPages: number
  totalRows: number
  pageSize: number
  onPage: (page: number) => void
}

export default function ShipmentsTablePagination({
  page, totalPages, totalRows, pageSize, onPage,
}: Props) {
  if (totalRows <= pageSize) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalRows)

  return (
    <div className="portal-table-pager">
      <span className="portal-table-pager__meta nums">
        {from}–{to} of {totalRows}
      </span>
      <div className="portal-table-pager__btns">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          ‹
        </Button>
        <span className="portal-table-pager__page nums">{page} / {totalPages}</span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          ›
        </Button>
      </div>
    </div>
  )
}
