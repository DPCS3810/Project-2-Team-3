interface Collaborator {
  id: string;
  email: string;
  role: string;
}

interface Props {
  collaborators: Collaborator[];
  onRemove: (userId: string) => void;
  ownerId?: string;
}

export function CollaboratorsList({ collaborators, onRemove, ownerId }: Props) {
  return (
    <ul className="collaborators-list">
      {collaborators.map((c) => (
        <li key={c.id} className="collaborator-row">
          <div>
            <div>{c.email}</div>
            <div className="muted">Role: {c.role}</div>
          </div>
          {ownerId !== c.id ? (
            <button type="button" onClick={() => onRemove(c.id)}>
              Remove access
            </button>
          ) : (
            <span className="muted">Owner</span>
          )}
        </li>
      ))}
      {collaborators.length === 0 ? <li className="muted">No collaborators</li> : null}
    </ul>
  );
}
