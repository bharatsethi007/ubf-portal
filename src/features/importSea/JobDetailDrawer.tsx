import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MatchBadge from './cells/MatchBadge'
import ContainersTab from './tabs/ContainersTab'
import DocumentsTab from './tabs/DocumentsTab'
import InvoicesTab from './tabs/InvoicesTab'
import OverviewTab from './tabs/OverviewTab'
import TrackingTab from './tabs/TrackingTab'
import { useJobDetail } from './useJobDetail'

type Props = {
  bookingId: string | null
  onClose: () => void
}

export default function JobDetailDrawer({ bookingId, onClose }: Props) {
  const open = Boolean(bookingId)
  const { booking, shipment, tracking, containers, documents, invoices, loading } =
    useJobDetail(bookingId)

  const matched = Boolean(booking?.shipment_id)
  const title = booking?.job_no || booking?.booking_ref || 'Job detail'

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader className="border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <SheetTitle className="nums">{title}</SheetTitle>
            {booking ? <MatchBadge matched={matched} /> : null}
          </div>
          <SheetDescription>
            {booking?.booking_ref ?? 'Import sea booking detail'}
          </SheetDescription>
        </SheetHeader>

        {loading || !booking ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            {loading ? 'Loading…' : 'Booking not found.'}
          </p>
        ) : (
          <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col px-6 pb-6">
            <TabsList variant="line" className="mb-3 w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tracking">Tracking</TabsTrigger>
              <TabsTrigger value="containers">Containers</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="overview">
                <OverviewTab booking={booking} shipment={shipment} />
              </TabsContent>
              <TabsContent value="tracking">
                <TrackingTab events={tracking} matched={matched} />
              </TabsContent>
              <TabsContent value="containers">
                <ContainersTab containers={containers} />
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsTab documents={documents} />
              </TabsContent>
              <TabsContent value="invoices">
                <InvoicesTab invoices={invoices} matched={matched} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
