'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

import HomeSkeleton from './HomeSkeleton';

export function isPublicAuthPath(pathname: string): boolean {
  return /^(\/(login|register|oidc-register|qr-login|warning|tv\/login)(\/|$)|\/tvbox(\/|$))/.test(
    pathname
  );
}

/**
 * Legacy registration / TV login may use router.replace after signing in.
 * Root layouts persist across client navigation. Reload once at this boundary
 * so the server can verify the new cookie and build the authenticated layout,
 * without mounting business children under the public layout in the meantime.
 */
export default function PublicAuthBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isPublicPage = isPublicAuthPath(pathname);

  useEffect(() => {
    if (!isPublicPage) window.location.replace(window.location.href);
  }, [isPublicPage]);

  if (!isPublicPage) {
    return (
      <div className='relative min-h-screen'>
        <HomeSkeleton />
        <p
          role='status'
          className='relative z-10 flex min-h-screen items-center justify-center'
        >
          正在验证登录状态…
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
