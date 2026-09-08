# workers/ingestion

A separate Node process, run by PM2 on a cron schedule (docs/architecture.md §2.4).
Empty until Phase 1, when the first affiliate feed is approved.

Pipeline: **feed → validate → normalise → dedupe → classify → embed → upsert**.

It runs out of band from the web server deliberately: a slow or failing feed
must never affect request latency, and it needs the service-role key, which no
request-handling code path may hold.

Data comes only from permitted feeds and APIs. No scraping of retailers whose
terms prohibit it (PRD §74).
