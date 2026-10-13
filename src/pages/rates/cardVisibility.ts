/** Rate cards shared with specific customers. No rows = public card. */
export function cardVisibleFor(card: { rate_card_customers?: { account_id: string }[] | null }, accountId: string | null | undefined): boolean {
  const shared = card.rate_card_customers ?? []
  if (shared.length === 0) return true
  return !!accountId && shared.some((s) => s.account_id === accountId)
}
