import { Footer } from '@/components/layout/footer';

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        {children}
      </main>
      <Footer variant="compact" />
    </div>
  );
}
