import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { TVAButton } from "../ui/Button";

export function SidebarLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="tva-shell">
      <aside className="tva-sidebar">
        <div className="tva-sidebar__brand">Temporal Control Dashboard</div>
        <nav className="tva-nav">
          <NavLink to="/documents">Documents</NavLink>
          <NavLink to="/documents">Editor</NavLink>
          <NavLink to="/documents">Timeline</NavLink>
          <NavLink to="/documents">Users / Settings</NavLink>
        </nav>
        <div className="tva-sidebar__footer">
          <div className="tva-nav__user">
            <div className="muted">{user?.email}</div>
          </div>
          <TVAButton variant="secondary" onClick={logout}>
            Logout
          </TVAButton>
        </div>
      </aside>
      <main className="tva-main">{children}</main>
    </div>
  );
}
