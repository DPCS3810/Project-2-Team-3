import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Document as DocxDocument, Packer, Paragraph, TextRun } from "docx";
import { CollaborativeEditor } from "../components/CollaborativeEditor";
import { CrdtEditor } from "../components/CrdtEditor";
import { CollaboratorsList } from "../components/CollaboratorsList";
import { useAuth } from "../auth/AuthContext";
import { request } from "../api/http";
import { Panel, PanelBody, PanelHeader } from "../components/ui/Panel";
import { TVAButton } from "../components/ui/Button";
import { InlineNotice } from "../components/ui/InlineNotice";
import { Badge } from "../components/ui/Badge";
import { TVAModal } from "../components/ui/Modal";

interface DocumentDto {
  id: string;
  title: string;
  content?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
  permissions?: PermissionDto[];
}

interface PermissionDto {
  id: string;
  userId: string;
  role: string;
  user?: { email?: string; name?: string };
}

interface VersionDto {
  id: string;
  createdAt: string;
  createdBy?: { email?: string; name?: string };
  snapshotText?: string;
}

const ROLE_OPTIONS = ["VIEW", "COMMENT", "EDIT"];

export function EditorPage() {
  const { id: documentId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentDto | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ saving: boolean; lastSaved?: number }>({ saving: false });
  const [versions, setVersions] = useState<VersionDto[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<{ id: string; email: string; role: string }[]>([]);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("EDIT");
  const [shareOpen, setShareOpen] = useState(false);
  const [view, setView] = useState<"editor" | "timeline">("editor");
  const [previewVersion, setPreviewVersion] = useState<VersionDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const useCrdt = import.meta.env.VITE_USE_CRDT_EDITOR === "true";

  const loadDocument = async () => {
    if (!documentId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await request<{ document: DocumentDto }>({
        path: `/documents/${documentId}`,
        token,
      });
      setDoc(res.document);
      setTitleInput(res.document.title || "Untitled Document");
      setContent(res.document.content || "");
      if (res.document.permissions) {
        setCollaborators(
          res.document.permissions.map((p) => ({
            id: p.userId,
            email: p.user?.email || p.userId,
            role: p.role,
          })),
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    if (!documentId || !token) return;
    setVersionsError(null);
    try {
      const res = await request<{ versions: VersionDto[] }>({
        path: `/documents/${documentId}/versions`,
        token,
      });
      setVersions(res.versions || []);
    } catch (err) {
      setVersionsError((err as Error).message);
    }
  };

  const loadPermissions = async () => {
    if (!documentId || !token) return;
    try {
      const res = await request<{ permissions: PermissionDto[] }>({
        path: `/documents/${documentId}/permissions`,
        token,
      });
      setCollaborators(
        res.permissions.map((p) => ({
          id: p.userId,
          email: p.user?.email || p.userId,
          role: p.role,
        })),
      );
    } catch (_err) {
      // non-fatal
    }
  };

  useEffect(() => {
    loadDocument();
    loadVersions();
    loadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, token]);

  const handleRename = async () => {
    if (!documentId || !token) return;
    try {
      await request({
        path: `/documents/${documentId}`,
        method: "PUT",
        token,
        body: { title: titleInput },
      });
      setDoc((current) => (current ? { ...current, title: titleInput } : current));
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleShare = async () => {
    if (!documentId || !token || !shareEmail) return;
    try {
      await request({
        path: `/documents/${documentId}/share`,
        method: "POST",
        token,
        body: { email: shareEmail, role: shareRole },
      });
      setShareEmail("");
      loadPermissions();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleRemoveAccess = async (userId: string) => {
    if (!documentId || !token) return;
    try {
      await request({
        path: `/documents/${documentId}/share/${userId}`,
        method: "DELETE",
        token,
      });
      setCollaborators((list) => list.filter((c) => c.id !== userId));
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleDuplicate = async () => {
    if (!documentId || !token) return;
    try {
      const res = await request<{ document: DocumentDto }>({
        path: `/documents/${documentId}/duplicate`,
        method: "POST",
        token,
      });
      navigate(`/documents/${res.document.id}`);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleDelete = async () => {
    if (!documentId || !token) return;
    const confirmed = window.confirm("Delete this document? This cannot be undone.");
    if (!confirmed) return;
    try {
      await request({ path: `/documents/${documentId}`, method: "DELETE", token });
      navigate("/documents");
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const restoreVersion = async (v: VersionDto) => {
    if (!documentId || !token) return;
    if (!v.snapshotText) {
      setActionError("No snapshot content available to restore.");
      return;
    }
    try {
      setActionError(null);
      await request({
        path: `/documents/${documentId}`,
        method: "PUT",
        token,
        body: { content: v.snapshotText },
      });
      setContent(v.snapshotText);
      setDoc((current) =>
        current
          ? { ...current, content: v.snapshotText, updatedAt: new Date().toISOString() }
          : current,
      );
      setSaveStatus({ saving: false, lastSaved: Date.now() });
      setPreviewVersion(null);
      setView("editor");
      loadVersions();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const getPlainText = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  };

  const downloadBlob = (data: Blob, filename: string) => {
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTxt = () => {
    const text = getPlainText(content);
    downloadBlob(new Blob([text], { type: "text/plain" }), `${document?.title || "document"}.txt`);
  };

  const exportDocx = async () => {
    const text = getPlainText(content);
    const docx = new DocxDocument({
      sections: [
        {
          properties: {},
          children: text.split("\n").map((line: string) => new Paragraph({ children: [new TextRun(line)] })),
        },
      ],
    });
    const buffer = await Packer.toBlob(docx);
    downloadBlob(buffer, `${document?.title || "document"}.docx`);
  };

  const exportPdf = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(exportRef.current, { backgroundColor: "#fff", scale: 1 });
      if (!canvas.width || !canvas.height) {
        throw new Error("Nothing to export");
      }
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height, 1);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      const x = (pageWidth - width) / 2;
      const y = 20;
      pdf.addImage(imgData, "PNG", x, y, width, height);
      pdf.save(`${document?.title || "document"}.pdf`);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const presenceCount = collaborators.length || 1;
  const presenceLabel = `${presenceCount} active agent${presenceCount === 1 ? "" : "s"}`;

  const divergenceById = useMemo(() => {
    const currentLen = content.length;
    const map: Record<string, number> = {};
    versions.forEach((v, idx) => {
      const base = v.snapshotText?.length ?? currentLen;
      map[v.id] = Math.abs(base - currentLen) + idx;
    });
    return map;
  }, [content.length, versions]);

  if (loading) {
    return <div className="page-status">Loading document...</div>;
  }

  if (error) {
    return <InlineNotice tone="error">{error}</InlineNotice>;
  }

  if (!documentId || !doc) {
    return <InlineNotice tone="error">Document not found.</InlineNotice>;
  }

  const latestVersion = versions[versions.length - 1];

  return (
    <>
      <Panel>
        <PanelHeader
          title={
            <div className="doc-title-row">
              <input
                className="title-edit-input"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
              <TVAButton variant="secondary" onClick={handleRename}>
                Save title
              </TVAButton>
              <Badge tone={saveStatus.saving ? "warn" : "success"}>
                {saveStatus.saving ? "Saving..." : saveStatus.lastSaved ? "Synced" : "Ready"}
              </Badge>
              <Badge tone="neutral">{presenceLabel}</Badge>
            </div>
          }
          actions={
            <div className="doc-actions">
              <div className="segmented">
                <TVAButton
                  variant={view === "editor" ? "primary" : "ghost"}
                  onClick={() => setView("editor")}
                >
                  Editor
                </TVAButton>
                <TVAButton
                  variant={view === "timeline" ? "primary" : "ghost"}
                  onClick={() => setView("timeline")}
                >
                  Timeline
                </TVAButton>
              </div>
              <TVAButton variant="secondary" onClick={() => setShareOpen(true)}>
                Share
              </TVAButton>
              <div className="segmented">
                <TVAButton variant="ghost" onClick={exportPdf} disabled={exporting}>
                  PDF
                </TVAButton>
                <TVAButton variant="ghost" onClick={exportDocx}>
                  DOCX
                </TVAButton>
                <TVAButton variant="ghost" onClick={exportTxt}>
                  TXT
                </TVAButton>
              </div>
              <TVAButton variant="ghost" onClick={handleDuplicate}>
                Duplicate
              </TVAButton>
              <TVAButton variant="ghost" onClick={handleDelete}>
                Delete
              </TVAButton>
            </div>
          }
        />
        <PanelBody className="doc-body">
          {actionError ? <InlineNotice tone="error">{actionError}</InlineNotice> : null}
          {view === "timeline" ? (
            <TimelineView
              versions={versions}
              divergenceById={divergenceById}
              currentVersionId={latestVersion?.id}
              onPreview={setPreviewVersion}
              onRestore={restoreVersion}
            />
          ) : (
            <div className="doc-grid">
              <div className="doc-editor">
                <div className="doc-meta">
                  <div>
                    <div className="muted">Owner</div>
                    <div>{doc.ownerId === user?.id ? "You" : doc.ownerId || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="muted">Updated</div>
                    <div>{doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : "—"}</div>
                  </div>
                  <div>
                    <div className="muted">Status</div>
                    <Badge tone={saveStatus.saving ? "warn" : "success"}>
                      {saveStatus.saving ? "Saving..." : "Synced"}
                    </Badge>
                  </div>
                </div>
                {useCrdt ? (
                  <CrdtEditor
                    documentId={documentId}
                    initialContent={content}
                    onSelectionChange={() => {}}
                    onSaveStatusChange={(s) => setSaveStatus(s)}
                    onContentChange={setContent}
                  />
                ) : (
                  <CollaborativeEditor
                    documentId={documentId}
                    onSelectionChange={() => {}}
                    onSaveStatusChange={(s) => setSaveStatus(s)}
                    onContentChange={setContent}
                  />
                )}
              </div>
              <div className="doc-side">
                <div className="tva-panel mini">
                  <div className="tva-panel__header">
                    <div className="tva-panel__title">Active Agents</div>
                  </div>
                  <div className="tva-panel__body">
                    <CollaboratorsList
                      collaborators={collaborators}
                      onRemove={handleRemoveAccess}
                      ownerId={doc.ownerId}
                    />
                  </div>
                </div>
                <div className="tva-panel mini">
                  <div className="tva-panel__header">
                    <div className="tva-panel__title">Version History</div>
                  </div>
                  <div className="tva-panel__body versions-list">
                    {versionsError ? <InlineNotice tone="warn">{versionsError}</InlineNotice> : null}
                    <ul className="versions-ul">
                    {versions.map((v) => (
                      <li key={v.id} className="version-row">
                        <div>
                          <div className="muted">{new Date(v.createdAt).toLocaleString()}</div>
                          <div>{v.createdBy?.name || v.createdBy?.email || "Unknown"}</div>
                        </div>
                        <Badge tone={v.id === latestVersion?.id ? "success" : "neutral"}>
                          {v.id === latestVersion?.id ? "Current" : "Snapshot"}
                        </Badge>
                        <div style={{ display: "flex", gap: "0.35rem" }}>
                          <TVAButton variant="ghost" onClick={() => setPreviewVersion(v)}>
                            View
                          </TVAButton>
                          <TVAButton
                            variant="secondary"
                            onClick={() => restoreVersion(v)}
                            disabled={!v.snapshotText}
                            title={v.snapshotText ? "Restore this version" : "No snapshot content"}
                          >
                            Restore
                          </TVAButton>
                        </div>
                      </li>
                    ))}
                    {versions.length === 0 ? <li className="muted">No versions yet</li> : null}
                  </ul>
                </div>
                </div>
              </div>
            </div>
          )}
        </PanelBody>
      </Panel>

      <TVAModal open={shareOpen} onClose={() => setShareOpen(false)} title="Share Document">
        <div className="share-form">
          <input
            type="email"
            placeholder="User email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
          />
          <select value={shareRole} onChange={(e) => setShareRole(e.target.value)}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <TVAButton onClick={handleShare}>Share</TVAButton>
        </div>
        <div className="tva-panel__body">
          <CollaboratorsList
            collaborators={collaborators}
            onRemove={handleRemoveAccess}
            ownerId={doc.ownerId}
          />
        </div>
      </TVAModal>

      <TVAModal open={!!previewVersion} onClose={() => setPreviewVersion(null)} title="Snapshot Preview">
        <div className="preview-body">
          <div className="muted">
            {previewVersion ? new Date(previewVersion.createdAt).toLocaleString() : null}
          </div>
          <div className="preview-content">
            {previewVersion?.snapshotText ? (
              <div dangerouslySetInnerHTML={{ __html: previewVersion.snapshotText }} />
            ) : (
              <div className="muted">No snapshot content available.</div>
            )}
          </div>
        </div>
        {previewVersion ? (
          <div className="tva-modal__footer">
            <TVAButton
              variant="secondary"
              onClick={() => restoreVersion(previewVersion)}
              disabled={!previewVersion.snapshotText}
              title={previewVersion.snapshotText ? "Restore this version" : "No snapshot content"}
            >
              Restore
            </TVAButton>
          </div>
        ) : null}
      </TVAModal>

      <div style={{ position: "absolute", left: "-9999px", top: 0, width: "800px", pointerEvents: "none" }}>
        <div ref={exportRef} dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </>
  );
}

function TimelineView({
  versions,
  divergenceById,
  currentVersionId,
  onPreview,
  onRestore,
}: {
  versions: VersionDto[];
  divergenceById: Record<string, number>;
  currentVersionId?: string;
  onPreview: (v: VersionDto) => void;
  onRestore: (v: VersionDto) => void;
}) {
  const nodes = versions.map((v, idx) => ({
    ...v,
    x: versions.length > 1 ? (idx / (versions.length - 1)) * 100 : 50,
    divergence: divergenceById[v.id] ?? idx,
  }));

  return (
    <div className="timeline-view">
      <div className="timeline-legend">
        <Badge tone="success">Active</Badge>
        <Badge tone="neutral">Snapshot</Badge>
      </div>
      <div className="timeline-graph">
        <svg width="100%" height="140" viewBox="0 0 100 40" preserveAspectRatio="none">
          <polyline
            fill="none"
            stroke="var(--tva-amber)"
            strokeWidth="0.5"
            points={nodes.map((n) => `${n.x},20`).join(" ")}
          />
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x},20)`}>
              <circle
                r={n.id === currentVersionId ? 1.5 : 1}
                fill={n.id === currentVersionId ? "var(--tva-amber)" : "var(--tva-teal)"}
                stroke="var(--tva-panel-border)"
                strokeWidth="0.3"
              />
            </g>
          ))}
        </svg>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Author</th>
            <th>Time</th>
            <th>Divergence</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {nodes.map((v) => (
            <tr key={v.id}>
              <td>{v.id.slice(0, 8)}</td>
              <td>{v.createdBy?.name || v.createdBy?.email || "Unknown"}</td>
              <td>{new Date(v.createdAt).toLocaleString()}</td>
              <td>{v.divergence}</td>
              <td>
                <Badge tone={v.id === currentVersionId ? "success" : "neutral"}>
                  {v.id === currentVersionId ? "Active" : "Snapshot"}
                </Badge>
              </td>
              <td>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <TVAButton variant="ghost" onClick={() => onPreview(v)}>
                    View
                  </TVAButton>
                  <TVAButton
                    variant="secondary"
                    onClick={() => onRestore(v)}
                    disabled={!v.snapshotText}
                    title={v.snapshotText ? "Restore this version" : "No snapshot content"}
                  >
                    Restore
                  </TVAButton>
                </div>
              </td>
            </tr>
          ))}
          {nodes.length === 0 ? (
            <tr>
              <td colSpan={6} className="page-status">
                No versions found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
