
'use client';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import app from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { getInTransitBookingsForStaff, updateAvailableSpaceAction } from '../dashboard/actions';
import { PackagePlus } from 'lucide-react';

interface InTransitBooking {
  id: string;
  vehicleType: string;
  fromLocation: string;
  toLocation: string;
  availableSpace: number;
}

export default function ManageSpacePage() {
  const [bookings, setBookings] = useState<InTransitBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spaceInputs, setSpaceInputs] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);

  const auth = getAuth(app);
  const router = useRouter();
  const { toast } = useToast();

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

  const fetchBookings = async (staffId: string) => {
    setLoading(true);
    const result = await getInTransitBookingsForStaff(staffId);
    if (result.error) {
      setError(result.error);
    } else {
      setBookings(result.bookings);
      // Initialize space inputs with current values
      const initialInputs: Record<string, string> = {};
      result.bookings.forEach(b => {
        initialInputs[b.id] = b.availableSpace > 0 ? String(b.availableSpace) : '';
      });
      setSpaceInputs(initialInputs);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchBookings(user.uid);
    }
  }, [user]);

  const handleSpaceChange = (bookingId: string, value: string) => {
    setSpaceInputs({ ...spaceInputs, [bookingId]: value });
  };

  const handleSaveSpace = async (bookingId: string) => {
    const spaceValue = spaceInputs[bookingId];
    const space = parseFloat(spaceValue);

    if (spaceValue && (isNaN(space) || space < 0)) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a valid positive number for the available space.',
        variant: 'destructive',
      });
      return;
    }
    
    const result = await updateAvailableSpaceAction(bookingId, space || 0);

    if (result.success) {
      toast({
        title: 'Space Updated!',
        description: `Available space for booking has been successfully updated.`,
      });
      if(user) fetchBookings(user.uid);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Could not update the available space.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading in-transit jobs...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">Error: {error}</div>;
  }

  return (
    <main className="flex min-h-screen w-full flex-col p-4 pt-8 md:p-8">
      <Card className="w-full max-w-7xl rounded-2xl shadow-2xl">
        <CardHeader className="p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <PackagePlus className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="font-headline text-4xl tracking-tight">
                Manage Available Space
              </CardTitle>
              <CardDescription className="pt-1">
                List the extra capacity you have on your current routes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {bookings.length === 0 ? (
             <div className="text-center text-muted-foreground py-10">
                You have no jobs currently in transit.
            </div>
          ) : (
             <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Available Capacity (in tons)</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {bookings.map((booking) => (
                        <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.vehicleType}</TableCell>
                        <TableCell>
                            <div>{booking.fromLocation}</div>
                            <div className="text-xs text-muted-foreground">to {booking.toLocation}</div>
                        </TableCell>
                        <TableCell>
                            <Input
                                type="number"
                                placeholder="e.g., 5"
                                value={spaceInputs[booking.id] || ''}
                                onChange={(e) => handleSpaceChange(booking.id, e.target.value)}
                                className="h-9 max-w-[150px]"
                            />
                        </TableCell>
                        <TableCell className="text-right">
                           <Button size="sm" onClick={() => handleSaveSpace(booking.id)}>Save Space</Button>
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
