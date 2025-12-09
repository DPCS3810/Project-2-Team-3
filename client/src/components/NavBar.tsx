import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="navbar__brand">
        <Link to="/documents">CTE – DPCS Project 2</Link>
      </div>
      {user ? (
        <div className="navbar__actions">
          <span className="navbar__user">{user.email}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : null}
    </header>
  );
}
