import type { ReactNode } from "react";
import { Link, useRoute } from "wouter";

/**
 * Layout route — the `<Outlet/>` equivalent.
 *
 * wouter has no `<Outlet/>` component. Instead, a layout renders `{children}`
 * as the outlet slot, and the router (see `_router.tsx`) fills it with whichever
 * child route matched. The sidebar here persists across child navigations; only
 * the `.settings-outlet` content swaps.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="settings">
      <aside className="settings-nav">
        <NavItem href="/">Profile</NavItem>
        <NavItem href="/account">Account</NavItem>
      </aside>
      <div className="settings-outlet">{children}</div>
    </div>
  );
}

function NavItem({ href, children }: { href: string; children: ReactNode }) {
  // `href` is relative to the nested `/settings` base (thanks to the `nest`
  // prop), so the same path used for the <Link> also matches with useRoute.
  const [isActive] = useRoute(href);
  return (
    <Link href={href} className={isActive ? "active" : undefined}>
      {children}
    </Link>
  );
}
