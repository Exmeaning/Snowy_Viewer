import { noIndexRouteMetadata } from '@/lib/seo-metadata';
import LeavePageClient from './client';

export const generateMetadata = noIndexRouteMetadata('/leave', 'External Link Interstitial');

export default function LeavePage() {
    return <LeavePageClient />;
}
