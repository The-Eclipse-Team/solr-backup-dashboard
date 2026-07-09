export function Chip({
  label,
  active,
  cluster,
  onClick,
}: {
  label: string;
  active: boolean;
  cluster?: boolean;
  onClick: () => void;
}) {
  const className = ['chip', cluster ? 'cluster' : '', active ? 'active' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={className} onClick={onClick}>
      {label}
    </button>
  );
}
