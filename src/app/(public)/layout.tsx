// The public route group hosts the dark, branded form surfaces. Each
// page provides its own <PublicFormShell> so it can choose width and
// header copy; this layout intentionally stays a transparent passthrough
// so the shell controls the full viewport background.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
