import EventsContent from "./client";
import { withPageBreadcrumb } from "@/lib/seo-metadata";

const Page = withPageBreadcrumb("events", () => <EventsContent />);

export const generateMetadata = Page.generateMetadata;
export default Page;
