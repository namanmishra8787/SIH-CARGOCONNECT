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
import { BookMarked, History, LogOut, Truck, Home, Share2, Car } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getAuth, signOut, onAuthStateChanged, User } from 'firebase/auth';
import app from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AvailableVehicles } from './booking/available-vehicles';


export default function UserLayout({
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
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if(currentUser) {
        setUser(currentUser);
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
             toast({
                title: 'Unauthorized',
                description: 'You are not authorized to view this page.',
                variant: 'destructive',
            });
            router.push('/');
        }
      } else {
        router.push('/user/login');
      }
    });
    return () => unsubscribe();
  }, [auth, db, router, toast]);


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

  const UserMenu = () => (
    <>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/user/booking'}
          >
            <Link href="/user/booking">
              <Truck />
              <span>Create Booking</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/user/my-bookings'}
          >
            <Link href="/user/my-bookings">
              <BookMarked />
              <span>My Bookings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={pathname === '/user/pre-booking'}
          >
            <Link href="/user/pre-booking">
              <History />
              <span>Booking History</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => setIsVehicleDialogOpen(true)}>
              <Car />
              <span>Available Vehicles</span>
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
                    User Portal
                 </p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <UserMenu />
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
          <SidebarTrigger/>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
     <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
            <DialogTitle>Available Vehicle Types</DialogTitle>
            </DialogHeader>
            <AvailableVehicles />
        </DialogContent>
    </Dialog>
    </>
  );
}
