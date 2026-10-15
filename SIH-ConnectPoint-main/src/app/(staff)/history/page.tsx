
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
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { IndianRupee, History, Hash } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useRouter } from 'next/navigation';
import { getStaffHistory } from '../dashboard/actions';

interface Booking {
  id: string;
  vehicleType: string;
  weight: string;
  fromLocation: string;
  toLocation: string;
  fromDate: string; // ISO String
  toDate: string; // ISO String
  status: string;
  userId: string;
  price?: number;
}

export default function StaffHistoryPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/staff/login');
      }
    });
    return () => unsubscribe();
  }, [auth, router]);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    getStaffHistory(user.uid).then(result => {
        if (!result.error) {
            setBookings(result.bookings as any);
            setTotalBookings(result.totalBookings);
            setTotalEarnings(result.totalEarnings);
        } else {
            console.error("Error fetching history: ", result.error);
        }
        setLoading(false);
    });
  }, [user]);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
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
                        Here are all your completed jobs and total earnings.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
            <div className="grid gap-4 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Earnings
                        </CardTitle>
                        <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{totalEarnings.toFixed(2)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Completed Bookings</CardTitle>
                        <Hash className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{totalBookings}</div>
                    </CardContent>
                </Card>
            </div>

          {loading ? (
            <div className="text-center">Loading booking history...</div>
          ) : bookings.length === 0 ? (
            <div className="text-center text-muted-foreground">
              You have no completed bookings.
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
                    <TableHead>Earnings</TableHead>
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
                                <IndianRupee className="mr-2 h-4 w-4 text-muted-foreground" />
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
        </CardContent>
      </Card>
    </main>
  );
}
