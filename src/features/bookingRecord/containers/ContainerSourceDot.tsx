import type { BookingContainerSource } from './bookingContainerTypes'

const SOURCE_LABEL: Record<BookingContainerSource, string> = {
  manual: 'Manual entry',
  erp: 'From ERP',
  portconnect: 'From PortConnect',
}

type Props = {
  source: BookingContainerSource
}

export default function ContainerSourceDot({ source }: Props) {
  return (
    <span
      className={`booking-container-source-dot booking-container-source-dot--${source}`}
      title={SOURCE_LABEL[source]}
      aria-label={SOURCE_LABEL[source]}
    />
  )
}
