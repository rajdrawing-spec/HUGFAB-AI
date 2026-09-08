'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { track } from '@/lib/analytics';

/**
 * App Router navigations do not trigger a page load, so pageviews are sent
 * here rather than by the PostHog SDK's automatic capture.
 */
export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    track('page_viewed', { path: query ? `${pathname}?${query}` : pathname });
  }, [pathname, searchParams]);

  return null;
}
