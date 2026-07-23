type Props = {
  onRevert: () => void
}

export default function ManualOverridePill({ onRevert }: Props) {
  return (
    <span className="portconnect-override-pill">
      Manual override
      <button type="button" className="text-link portconnect-override-pill__revert" onClick={onRevert}>
        Revert
      </button>
    </span>
  )
}
