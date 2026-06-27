import type { ReactNode } from "react";
import { Link, useRoute } from "wouter";

/**
 * Layout route — the `<Outlet/>` equivalent.
 *
 * wouter has no `<Outlet/>` component. Instead, a layout renders `{children}`
 * as the outlet slot, and the router (see `_router.tsx`) fills it with whichever
 * child route matched. The sidebar here persists across child navigations; only
 * the `.settings-outlet` content swaps.
 *
 * Links inside this nested section follow the template's nested-routing rule
 * (see AGENTS.md › "Routing"): because this component renders inside
 * `<Route path="/settings" nest>`, the router base is `/settings`, so a leading
 * slash means "relative to /settings", NOT "site root". Use plain relative paths
 * for in-section links and the `~` escape only to break out to a top-level path.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="settings">
      <aside className="settings-nav">
        {/*
          In-section links: paths are relative to the `/settings` base, so
          `/` → /settings and `/account` → /settings/account. Do NOT write the
          full `/settings/account` here — the base is prepended again and you'd
          navigate to /settings/settings/account.
        */}
        <NavItem href="/">Profile</NavItem>
        <NavItem href="/account">Account</NavItem>

        {/*
          Escape link: `~` opts out of the nested base and targets an absolute
          path from the site root. `~/` → / (without the `~` this would resolve
          to /settings). Use this form for any link that leaves the section.
        */}
        <Link href="~/" className="settings-nav-escape">
          ← Back to Todos
        </Link>
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
