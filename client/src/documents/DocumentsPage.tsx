import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { request } from "../api/http";
import { Panel, PanelHeader, PanelBody } from "../components/ui/Panel";
import { TVAButton } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { InlineNotice } from "../components/ui/InlineNotice";

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
  const [sort, setSort] = useState<"updated" | "title">("updated");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const handleDelete = async (docId: string) => {
    if (!token) return;
    try {
      await request({ path: `/documents/${docId}`, method: "DELETE", token });
      setDocuments((docs) => docs.filter((d) => d.id !== docId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const handleDuplicate = async (docId: string) => {
    if (!token) return;
    try {
      const res = await request<{ document: DocumentDto }>({
        path: `/documents/${docId}/duplicate`,
        method: "POST",
        token,
      });
      setDocuments((docs) => [res.document, ...docs]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const filteredDocs = useMemo(() => {
    const list = documents.filter((doc) => doc.title.toLowerCase().includes(search.toLowerCase()));
    if (sort === "title") {
      return [...list].sort((a, b) => a.title.localeCompare(b.title));
    }
    return [...list].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [documents, search, sort]);

  if (loading) {
    return <div className="page-status">Loading documents...</div>;
  }

  const resolveRole = (doc: DocumentDto) => {
    if (doc.ownerId === user?.id) return "OWNER";
    if (doc.permissions && doc.permissions[0]) return doc.permissions[0].role;
    return "UNKNOWN";
  };

  return (
    <Panel>
      <PanelHeader
        title="Case Files — Documents"
        actions={
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="title-edit-input"
            />
            <select value={sort} onChange={(e) => setSort(e.target.value as "updated" | "title")}>
              <option value="updated">Updated</option>
              <option value="title">Title</option>
            </select>
            <TVAButton onClick={createDocument} disabled={creating}>
              {creating ? "Creating..." : "New Document"}
            </TVAButton>
          </div>
        }
      />
      <PanelBody>
        {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Role</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((doc) => (
              <tr key={doc.id}>
                <td>
                  <div>{doc.title || "Untitled Document"}</div>
                  <div className="muted">{doc.ownerId === user?.id ? "You" : doc.owner?.email}</div>
                </td>
                <td>
                  <Badge tone={resolveRole(doc) === "OWNER" ? "warn" : "neutral"}>{resolveRole(doc)}</Badge>
                </td>
                <td className="muted">{doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : "—"}</td>
                <td style={{ display: "flex", gap: "0.35rem" }}>
                  <TVAButton variant="secondary" onClick={() => navigate(`/documents/${doc.id}`)}>
                    Open
                  </TVAButton>
                  <TVAButton variant="ghost" onClick={() => handleDuplicate(doc.id)}>
                    Duplicate
                  </TVAButton>
                  <TVAButton variant="ghost" onClick={() => setConfirmDelete(doc.id)}>
                    Delete
                  </TVAButton>
                  {confirmDelete === doc.id ? (
                    <TVAButton variant="primary" onClick={() => handleDelete(doc.id)}>
                      Confirm?
                    </TVAButton>
                  ) : null}
                </td>
              </tr>
            ))}
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan={4} className="page-status">
                  No documents yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </PanelBody>
    </Panel>
  );
}
