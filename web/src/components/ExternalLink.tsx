import React from 'react';
import Link from 'next/link';

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    className?: string;
    children: React.ReactNode;
}

const ExternalLink: React.FC<ExternalLinkProps> = ({ href, children, className, ...props }) => {
    const isExternal = (url: string) => {
        if (!url) return false;
        // Check if it's an absolute URL
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const urlObj = new URL(url);
                // Check if the hostname ends with exmeaning.com or pjsk.moe
                const isSafeDomain = urlObj.hostname.endsWith('exmeaning.com') || urlObj.hostname.endsWith('pjsk.moe');
                return !isSafeDomain;
            } catch (_e) {
                // If URL parsing fails, assume it's not a safe external link suitable for direct navigation if it starts with http/https
                return true;
            }
        }
        return false;
    };

    if (isExternal(href)) {
        const encodedTarget = encodeURIComponent(href);
        return (
            <Link
                href={`/leave?target=${encodedTarget}`}
                className={className}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
            >
                {children}
            </Link>
        );
    }

    // Internal link or safe domain
    return (
        <Link href={href} className={className} {...props}>
            {children}
        </Link>
    );
};

export default ExternalLink;
