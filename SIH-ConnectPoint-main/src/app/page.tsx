
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Briefcase, User, Share2 } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex h-full w-full items-center justify-center p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-2xl">
        <CardHeader className="items-center text-center p-8">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <Share2 className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="font-headline text-4xl tracking-tight">
            ConnectPoint
          </CardTitle>
          <CardDescription className="pt-1">
            Welcome! Please select your login type.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-8 pb-8">
          <Button asChild size="lg" className="w-full text-base">
            <Link href="/staff/login">
              <Briefcase className="mr-2 h-5 w-5" />
              Staff Login
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary" className="w-full text-base">
            <Link href="/user/login">
              <User className="mr-2 h-5 w-5" />
              User Login
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
