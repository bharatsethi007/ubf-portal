import { toast } from 'sonner'
import { checkinSheetIdForConsignment } from '@/features/tms/checkinSheetApi'
import { openCheckinSheetPdf } from '@/features/tms/pdf/checkinPdf'

/** Warehouse check-in sheet PDF for a TMS job. Only exists once the warehouse has checked the cargo in. */
export async function viewCheckinSheet(consignmentId: string) {
  try {
    const id = await checkinSheetIdForConsignment(consignmentId)
    if (!id || !(await openCheckinSheetPdf(id))) toast.error('No check-in sheet yet. The warehouse makes it at check-in.')
  } catch (e) {
    toast.error((e as Error).message)
  }
}
