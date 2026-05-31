interface Props {
  name: string;
  logoUrl?: string | null;
  size?: number; // tailwind size unit (e.g. 8 = w-8 h-8)
  rounded?: "lg" | "full";
}

export function TeamAvatar({ name, logoUrl, size = 8, rounded = "lg" }: Props) {
  const cls = `w-${size} h-${size} rounded-${rounded} shrink-0 object-cover`;
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} className={cls} style={{ border: "1px solid var(--sh-border2)" }} />;
  }
  return (
    <div
      className={`w-${size} h-${size} rounded-${rounded} flex items-center justify-center font-bold shrink-0`}
      style={{ background: "var(--sh-bg-card2)", color: "var(--sh-primary)", border: "1px solid var(--sh-border2)", fontSize: `${Math.max(10, size * 1.4)}px` }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
