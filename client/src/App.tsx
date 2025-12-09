import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NavBar } from "./components/NavBar";
import { LoginPage } from "./auth/LoginPage";
import { RegisterPage } from "./auth/RegisterPage";
import { DocumentsPage } from "./documents/DocumentsPage";
import { EditorPage } from "./documents/EditorPage";
import { useAuth } from "./auth/AuthContext";

function App() {
  const { user, loading } = useAuth();

  const defaultRedirect = user ? "/documents" : "/login";

  return (
    <div className="app-shell">
      {user ? <NavBar /> : null}
      <Routes>
        <Route path="/" element={<Navigate to={defaultRedirect} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/documents"
          element={
            <ProtectedRoute loading={loading}>
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/:id"
          element={
            <ProtectedRoute loading={loading}>
              <EditorPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
