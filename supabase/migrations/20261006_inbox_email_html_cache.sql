-- Outlook-formatted email bodies are fetched on first open (email-html edge fn) and cached in S3 (booking-emails/inbox-html/...).
alter table public.inbox_email_meta add column if not exists html_key text;
