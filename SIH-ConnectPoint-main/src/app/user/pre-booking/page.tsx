

"use client";

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import app from '@/lib/firebase';
import { getFirestore, collection, Timestamp, query, where, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { History } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Booking {
  id: string;
  vehicleType: string;
  weight: string;
  fromLocation: string;
  toLocation: string;
  fromDate: Timestamp;
  toDate: Timestamp;
  status: string;
  userId: string;
  price?: number;
}

export default function PreBookingPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/user/login');
      }
    });

    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const bookingsCollection = collection(db, 'bookings');
    const q = query(bookingsCollection, where('userId', '==', user.uid), where('status', 'in', ['done', 'cancelled']));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Booking[];
      setBookings(bookingList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, user]);


  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    const zonedDate = toZonedTime(date, 'UTC');
    return format(zonedDate, 'PPP');
  };

  return (
    <main className="flex min-h-[calc(100vh-3rem)] w-full flex-col items-center p-4 pt-8 md:min-h-screen md:p-8">
      <Card className="w-full max-w-6xl rounded-2xl shadow-2xl">
        <CardHeader className="p-8">
           <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-4">
                    <History className="h-10 w-10 text-primary" />
                </div>
                <div>
                    <CardTitle className="font-headline text-4xl tracking-tight">
                        Booking History
                    </CardTitle>
                    <CardDescription className="pt-1">
                        Here are all your completed and cancelled bookings.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {loading ? (
            <div className="text-center">Loading booking history...</div>
          ) : bookings.length === 0 ? (
            <div className="text-center text-muted-foreground">
              You have no past bookings.
            </div>
          ) : (
             <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Vehicle Type</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {bookings.map((booking) => (
                    <TableRow key={booking.id}>
                        <TableCell className="font-medium">
                        {booking.vehicleType}
                        </TableCell>
                        <TableCell>{booking.fromLocation}</TableCell>
                        <TableCell>{booking.toLocation}</TableCell>
                        <TableCell>{formatDate(booking.fromDate)}</TableCell>
                         <TableCell>
                            {booking.price ? (
                            <div className='flex items-center'>
                                <span className="mr-2 h-4 w-4 text-muted-foreground">Rs</span>
                                {booking.price.toFixed(2)}
                            </div>
                            ) : (
                            <span className="text-muted-foreground">N/A</span>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                        <Badge
                            variant={
                            booking.status === 'done'
                                ? 'default'
                                : 'destructive'
                            }
                        >
                            {booking.status}
                        </Badge>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
             </div>
          )}
           <div className="mt-8 flex justify-end">
                <Button asChild>
                    <Link href="/user/booking">Create New Booking</Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </main>
  );
}

    