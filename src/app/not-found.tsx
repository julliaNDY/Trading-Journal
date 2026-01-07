import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-radial bg-grid-pattern p-4">
      <div className="absolute inset-0 bg-background/80" />
      
      <div className="relative z-10 text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
