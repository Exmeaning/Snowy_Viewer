import React from 'react';
import Link from "@/components/LocalizedLink";

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    className?: string;
    children: React.ReactNode;
    bypassLeave?: boolean;
}

const SAFE_DOMAINS = [
    'exmeaning.com',
    'pjsk.moe',
];

const ExternalLink: React.FC<ExternalLinkProps> = ({
    href,
    children,
    className,
    bypassLeave,
    onClick,
    ...props
}) => {
    const isAbsoluteUrl = href.startsWith('http://') || href.startsWith('https://');

    const isExternal = (url: string) => {
        if (!url) return false;
        if (bypassLeave) return false;

        if (isAbsoluteUrl) {
            try {
                const urlObj = new URL(url);
                const hostname = urlObj.hostname.toLowerCase();
                const isSafeDomain = SAFE_DOMAINS.some(domain => 
                    hostname === domain || hostname.endsWith('.' + domain)
                );
                return !isSafeDomain;
            } catch (_e) {
                // If URL parsing fails, assume it's not a safe external link
                return true;
            }
        }
        return false;
    };

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented) return;

        // If it's an external link requiring leave confirmation for human users
        if (isExternal(href)) {
            // Only intercept primary left-clicks without modifier keys
            if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                const encodedTarget = encodeURIComponent(href);
                window.open(`/leave?target=${encodedTarget}`, '_blank', 'noopener,noreferrer');
            }
        }
    };

    // For all absolute external links:
    // Render direct target href in HTML so search engines (SEO crawlers) read & index the destination URL directly.
    if (isAbsoluteUrl) {
        const defaultRel = props.target === '_blank' || !props.target ? (props.rel || 'noopener') : props.rel;
        return (
            <a
                href={href}
                className={className}
                target={props.target || '_blank'}
                rel={defaultRel}
                onClick={handleClick}
                {...props}
            >
                {children}
            </a>
        );
    }

    // Internal routes
    return (
        <Link href={href} className={className} onClick={onClick} {...props}>
            {children}
        </Link>
    );
};

export default ExternalLink;
