-- Applied live via MCP 8 Oct 2026 (inbox_quotes_link_and_chrono + inbox_get_quote_no).
-- inbox_conversations.quote_id, inbox_staff_initials(), inbox_list newest-first + assignee_initials + quote_no,
-- inbox_quote_search(), inbox_link_quote(), inbox_get adds conversation.quote_no.
alter table public.inbox_conversations add column if not exists quote_id uuid references public.quotes(id) on delete set null;
create index if not exists inbox_conversations_quote_id_idx on public.inbox_conversations(quote_id);
-- Function bodies: see live DB (pg_get_functiondef) for inbox_list, inbox_quote_search, inbox_link_quote, inbox_staff_initials, inbox_get.
