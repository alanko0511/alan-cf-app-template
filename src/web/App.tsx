import { Link } from "wouter";
import { Router } from "./routes/_router.tsx";

export default function App() {
  return (
    <div className="app">
      <header>
        <h1>Todos</h1>
        <nav>
          <Link href="/">Todos</Link>
          <Link href="/settings">Settings</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>

      <main>
        <Router />
      </main>
    </div>
  );
}
