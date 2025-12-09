import { Link } from "react-router-dom";

interface Props {
  id: string;
  title: string;
  ownerEmail?: string;
  role?: string;
  updatedAt?: string;
  onOpen?: (id: string) => void;
}

export function DocumentListItem({ id, title, ownerEmail, role, updatedAt, onOpen }: Props) {
  return (
    <li className="document-list-item">
      <div>
        <strong>{title || "Untitled Document"}</strong>
        <div className="document-meta">
          {ownerEmail ? <span>Owner: {ownerEmail}</span> : null}
          {role ? <span>Role: {role}</span> : null}
          {updatedAt ? <span>Updated: {new Date(updatedAt).toLocaleString()}</span> : null}
        </div>
      </div>
      <Link
        className="button-link"
        to={`/documents/${id}`}
        onClick={onOpen ? (e) => {
          e.preventDefault();
          onOpen(id);
        } : undefined}
      >
        Open
      </Link>
    </li>
  );
}
