import type { Metadata } from 'next';

import { noIndexRobots } from '@/lib/seo-metadata';
import LeavePageClient from './client';

export const metadata: Metadata = {
    title: 'External Link Interstitial',
    robots: noIndexRobots(),
};

export default function LeavePage() {
    return <LeavePageClient />;
}
