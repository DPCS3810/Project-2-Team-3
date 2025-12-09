import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { request } from "../api/http";
import { DocumentListItem } from "../components/DocumentListItem";

interface DocumentDto {
  id: string;
  title: string;
  ownerId: string;
  updatedAt?: string;
  owner?: { email: string };
  permissions?: { role: string }[];
}

export function DocumentsPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const fetchDocuments = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request<{ documents: DocumentDto[] }>({
        path: "/documents",
        token,
      });
      setDocuments(res.documents || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const createDocument = async () => {
    if (!token) return;
    setCreating(true);
    try {
      const res = await request<{ document: DocumentDto }>({
        path: "/documents",
        method: "POST",
        token,
        body: { title: "Untitled Document" },
      });
      setDocuments((docs) => [res.document, ...docs]);
      navigate(`/documents/${res.document.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="page-status">Loading documents...</div>;
  }

  const resolveRole = (doc: DocumentDto) => {
    if (doc.ownerId === user?.id) return "OWNER";
    if (doc.permissions && doc.permissions[0]) return doc.permissions[0].role;
    return "UNKNOWN";
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Your Documents</h1>
        <input
          type="search"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, marginLeft: "1rem", marginRight: "1rem" }}
        />
        <button onClick={createDocument} disabled={creating}>
          {creating ? "Creating..." : "New Document"}
        </button>
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      <ul className="document-list">
        {documents
          .filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase()))
          .map((doc) => (
          <DocumentListItem
            key={doc.id}
            id={doc.id}
            title={doc.title}
            ownerEmail={doc.owner?.email}
            role={resolveRole(doc)}
            updatedAt={doc.updatedAt}
            onOpen={(id) => navigate(`/documents/${id}`)}
          />
        ))}
        {documents.length === 0 ? <li className="page-status">No documents yet.</li> : null}
      </ul>
    </div>
  );
}
