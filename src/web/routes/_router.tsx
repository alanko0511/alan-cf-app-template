import { Route, Switch } from "wouter";
import Index from "./_index.tsx";
import About from "./about.tsx";
import SettingsLayout from "./settings.tsx";
import SettingsIndex from "./settings._index.tsx";
import SettingsAccount from "./settings.account.tsx";

/**
 * Route table. The files in this folder follow Remix's flat-route naming
 * (`_index` = index route, `settings.account` = nested route), but routing is
 * wired up manually here — there's no file-based router.
 */
export function Router() {
  return (
    <Switch>
      <Route path="/" component={Index} />
      <Route path="/about" component={About} />

      {/*
        Nested layout. `nest` matches `/settings` as a prefix and makes the
        inner routes' paths relative to it. SettingsLayout renders an outlet
        slot; this inner <Switch> is what fills it (wouter's <Outlet/> stand-in).
      */}
      <Route path="/settings" nest>
        <SettingsLayout>
          <Switch>
            <Route path="/" component={SettingsIndex} />
            <Route path="/account" component={SettingsAccount} />
          </Switch>
        </SettingsLayout>
      </Route>

      <Route>404 — nothing here</Route>
    </Switch>
  );
}
