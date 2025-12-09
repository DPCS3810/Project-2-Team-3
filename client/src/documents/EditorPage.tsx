import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { request } from "../api/http";
import { CollaborativeEditor } from "../components/CollaborativeEditor";

interface DocumentResponse {
  document: {
    id: string;
    title: string;
    description?: string | null;
  };
}

export function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const [versions, setVersions] = useState<
    { id: string; createdAt: string; createdBy?: { email?: string; name?: string } }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("VIEW");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSubmitting, setShareSubmitting] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [comments, setComments] = useState<
    { id: string; text: string; email?: string; userId: string; position?: number; createdAt: string }[]
  >([]);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [saveStatus, setSaveStatus] = useState<{ saving: boolean; lastSaved?: number }>({ saving: false });
  const [renameTitle, setRenameTitle] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (!id || !token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await request<DocumentResponse>({
          path: `/documents/${id}`,
          token,
        });
        setRenameTitle(res.document.title);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [id, token]);

  useEffect(() => {
    const fetchVersions = async () => {
      if (!id || !token) return;
      setVersionsError(null);
      try {
        const res = await request<{ versions: any[] }>({
          path: `/documents/${id}/versions`,
          token,
        });
        setVersions(res.versions || []);
      } catch (err) {
        setVersionsError((err as Error).message);
      }
    };
    fetchVersions();
  }, [id, token]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!id || !token) return;
      setCommentsError(null);
      try {
        const res = await request<{ comments: any[] }>({
          path: `/documents/${id}/comments`,
          token,
        });
        setComments(res.comments || []);
      } catch (err) {
        setCommentsError((err as Error).message);
      }
    };
    fetchComments();
  }, [id, token]);

  const handleAddComment = async () => {
    if (!id || !token || !commentText.trim()) return;
    setCommentSubmitting(true);
    setCommentsError(null);
    try {
      const res = await request<{ comment: any }>({
        path: `/documents/${id}/comments`,
        method: "POST",
        token,
        body: { text: commentText, position: selection.start },
      });
      setComments((cur) => [res.comment, ...cur]);
      setCommentText("");
    } catch (err) {
      setCommentsError((err as Error).message);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleRename = async () => {
    if (!id || !token) return;
    try {
      await request({
        path: `/documents/${id}`,
        method: "PUT",
        token,
        body: { title: renameTitle },
      });
      setActionError(null);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!id || !token) return;
    if (!window.confirm("Delete this document?")) return;
    try {
      await request({
        path: `/documents/${id}`,
        method: "DELETE",
        token,
      });
      window.location.href = "/documents";
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleDuplicate = async () => {
    if (!id || !token) return;
    try {
      const res = await request<{ document: { id: string } }>({
        path: `/documents/${id}/duplicate`,
        method: "POST",
        token,
      });
      window.location.href = `/documents/${res.document.id}`;
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleShare = async () => {
    if (!id || !token) return;
    setShareSubmitting(true);
    setShareMessage(null);
    setShareError(null);
    try {
      await request({
        path: `/documents/${id}/share`,
        method: "POST",
        token,
        body: { email: shareEmail, role: shareRole },
      });
      setShareMessage(`Shared with ${shareEmail} as ${shareRole}`);
      setShareEmail("");
      setShareRole("VIEW");
    } catch (err) {
      setShareError((err as Error).message);
    } finally {
      setShareSubmitting(false);
    }
  };

  if (!id) {
    return <div className="page-status">Document not found.</div>;
  }

  if (loading) {
    return <div className="page-status">Loading document...</div>;
  }

  return (
    <div className="page editor-page">
      {error ? <p className="error-text">{error}</p> : null}
      <div className="editor-header">
        <div className="title-edit">
          <input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} />
          <button onClick={handleRename}>Rename</button>
        </div>
        <div className="editor-actions">
          <button onClick={handleDuplicate}>Make a copy</button>
          <button onClick={handleDelete}>Delete</button>
          <button onClick={() => setShowShare((v) => !v)}>
            {showShare ? "Close Sharing" : "Share"}
          </button>
        </div>
      </div>
      {actionError ? <p className="error-text">{actionError}</p> : null}

      {showShare ? (
        <div className="share-panel">
          <div className="share-fields">
            <input
              type="email"
              placeholder="user@example.com"
              value={shareEmail}
              onChange={(e) => setShareEmail(e.target.value)}
            />
            <select value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
              <option value="VIEW">View</option>
              <option value="COMMENT">Comment</option>
              <option value="EDIT">Edit</option>
            </select>
            <button onClick={handleShare} disabled={shareSubmitting || !shareEmail}>
              {shareSubmitting ? "Sharing..." : "Share"}
            </button>
          </div>
          {shareMessage ? <p className="success-text">{shareMessage}</p> : null}
          {shareError ? <p className="error-text">{shareError}</p> : null}
        </div>
      ) : null}

      <div className="editor-layout">
        <div className="editor-main">
          <CollaborativeEditor
            documentId={id}
            onSelectionChange={(pos) => setSelection(pos)}
            onSaveStatusChange={(status) => setSaveStatus(status)}
          />
          <div className="save-status">
            {saveStatus.saving ? "Saving..." : saveStatus.lastSaved ? `Saved at ${new Date(saveStatus.lastSaved).toLocaleTimeString()}` : "Saved"}
          </div>
        </div>
        <div className="editor-side">
          <div className="comments-panel">
            <h3>Comments</h3>
            <div className="comment-form">
              <textarea
                placeholder="Add a comment"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button onClick={handleAddComment} disabled={commentSubmitting || !commentText.trim()}>
                {commentSubmitting ? "Posting..." : "Post"}
              </button>
              <div className="muted">At position {selection.start}</div>
            </div>
            {commentsError ? <p className="error-text">{commentsError}</p> : null}
            <ul className="comments-list">
              {comments.map((c) => (
                <li key={c.id}>
                  <div className="comment-author">{c.email || c.userId}</div>
                  <div>{c.text}</div>
                  <div className="muted">
                    {typeof c.position === "number" ? `Pos ${c.position} • ` : ""}
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
              {comments.length === 0 ? <li className="muted">No comments yet.</li> : null}
            </ul>
          </div>
          <div className="versions-panel">
            <h3>Versions</h3>
            {versionsError ? <p className="error-text">{versionsError}</p> : null}
            <ul>
              {versions.map((v) => (
                <li key={v.id}>
                  <div>{new Date(v.createdAt).toLocaleString()}</div>
                  <div className="muted">
                    {v.createdBy?.name || v.createdBy?.email || "Unknown"}
                  </div>
                </li>
              ))}
              {versions.length === 0 ? <li>No versions yet.</li> : null}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
