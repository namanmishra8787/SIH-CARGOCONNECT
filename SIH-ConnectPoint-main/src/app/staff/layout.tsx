
'use client';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { BookMarked, History, LogOut, Home, Share2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getAuth, signOut, onAuthStateChanged, User } from 'firebase/auth';
import app from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);

  const isAuthPage = pathname === '/staff/login' || pathname === '/staff/signup';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Ensure user is staff, otherwise redirect
        const staffRef = doc(db, 'staff', currentUser.uid);
        const staffSnap = await getDoc(staffRef);
        if (!staffSnap.exists()) {
          toast({
            title: 'Unauthorized',
            description: 'You are not authorized to view this page.',
            variant: 'destructive',
          });
          router.push('/');
        } else if (isAuthPage) {
          router.push('/staff/dashboard');
        }
      } else {
        if (!isAuthPage) {
          router.push('/staff/login');
        }
      }
    });
    return () => unsubscribe();
  }, [auth, db, router, toast, isAuthPage]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out.',
      });
      router.push('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out.',
        variant: 'destructive',
      });
    }
  };

  if (isAuthPage) {
    return <>{children}</>;
  }
  
  const StaffMenu = () => (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={pathname === '/staff/dashboard'}>
          <Link href="/staff/dashboard">
            <BookMarked />
            <span>Dashboard</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={pathname === '/staff/history'}>
          <Link href="/staff/history">
            <History />
            <span>Booking History</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );

  return (
    <>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <div className="rounded-full bg-sidebar-primary/10 p-2">
                <Share2 className="h-8 w-8 text-sidebar-primary" />
              </div>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <h2 className="font-headline text-lg tracking-tight">
                  ConnectPoint
                </h2>
                <p className="text-xs text-sidebar-foreground/70">
                  Staff Portal
                </p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <StaffMenu />
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/">
                    <Home />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center justify-between border-b bg-background px-4 md:hidden">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <Share2 className="h-6 w-6 text-primary" />
              <span className="">ConnectPoint</span>
            </Link>
            <SidebarTrigger />
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
