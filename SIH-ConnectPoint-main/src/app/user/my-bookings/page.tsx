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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import app from '@/lib/firebase';
import { getFirestore, collection, Timestamp, query, where, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { BookMarked, Car, User as UserIcon, Mail, Phone, Handshake, Briefcase, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { proposeCounterOfferAction, updateStatusAction, getTotalBookingsCount, getTotalStaffCount } from '@/app/(staff)/dashboard/actions';


interface Bid {
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverMobileNumber: string;
  price: number;
  counterPrice?: number;
  counterStatus?: 'pending' | 'accepted' | 'rejected';
}

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
  driverId?: string;
  driverName?: string;
  driverEmail?: string;
  driverMobileNumber?: string;
  bids?: Bid[];
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isTrackingDialogOpen, setIsTrackingDialogOpen] = useState(false);
  const [isBidsDialogOpen, setIsBidsDialogOpen] = useState(false);
  const [counterOfferInputs, setCounterOfferInputs] = useState<Record<string, string>>({});
  const [totalBookings, setTotalBookings] = useState(0);
  const [totalDrivers, setTotalDrivers] = useState(0);
  const router = useRouter();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const { toast } = useToast();

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
    const q = query(bookingsCollection, where('userId', '==', user.uid), where('status', 'in', ['pending', 'priced', 'confirmed', 'in transit']));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Booking[];
      setBookings(bookingList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching bookings: ", error);
      setLoading(false);
    });
    
    async function fetchCounts() {
        const bookingsCount = await getTotalBookingsCount();
        const staffCount = await getTotalStaffCount();
        setTotalBookings(bookingsCount);
        setTotalDrivers(staffCount);
    }
    fetchCounts();

    return () => unsubscribe();
  }, [db, user]);

  const acceptBid = async (bookingId: string, bid: Bid) => {
    const bookingRef = doc(db, 'bookings', bookingId);
    try {
      await updateDoc(bookingRef, {
        status: 'confirmed',
        price: bid.price,
        driverId: bid.driverId,
        driverName: bid.driverName,
        driverEmail: bid.driverEmail,
        driverMobileNumber: bid.driverMobileNumber,
      });
      toast({
        title: 'Booking Confirmed!',
        description: `You have accepted the offer from ${bid.driverName}.`,
      });
      setIsBidsDialogOpen(false);
    } catch (error) {
      console.error('Error confirming booking: ', error);
      toast({
        title: 'Error',
        description: 'There was a problem confirming the booking.',
        variant: 'destructive',
      });
    }
  };
  
  const handleProposeCounter = async (bookingId: string, driverId: string) => {
    const price = parseFloat(counterOfferInputs[driverId]);
    if (isNaN(price) || price <= 0) {
        toast({ title: "Invalid Price", description: "Please enter a valid counter-offer price.", variant: "destructive" });
        return;
    }

    const result = await proposeCounterOfferAction(bookingId, driverId, price);
    if (result.success) {
        toast({ title: "Counter-offer Sent!", description: "Your counter-offer has been sent to the driver." });
        setCounterOfferInputs(prev => ({...prev, [driverId]: ''}));
    } else {
        toast({ title: "Error", description: result.error || "Could not send your counter-offer.", variant: "destructive" });
    }
  };
  
  const cancelBooking = async (bookingId: string) => {
    const result = await updateStatusAction(bookingId, 'cancelled');
    if (result.success) {
      toast({
        title: 'Booking Cancelled',
        description: 'Your booking has been successfully cancelled.',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Could not cancel the booking.',
        variant: 'destructive',
      });
    }
  };


  const openTrackingDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsTrackingDialogOpen(true);
  };
  
  const openBidsDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setIsBidsDialogOpen(true);
  };

  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    const zonedDate = toZonedTime(date, 'UTC');
    return format(zonedDate, 'PPP');
  };

  const renderStatusBadge = (status: string) => {
    let variant: 'secondary' | 'default' | 'destructive' | 'outline' = 'secondary';
    if (['confirmed', 'in transit', 'done'].includes(status)) {
      variant = 'default';
    } else if (status === 'cancelled') {
      variant = 'destructive';
    } else if (status === 'priced') {
      variant = 'outline';
    }
    
    const statusText: {[key: string]: string} = {
        priced: 'Bids Received'
    }

    return <Badge variant={variant}>{statusText[status] || status}</Badge>;
  };
  
  const renderAction = (booking: Booking) => {
    const canCancel = ['pending', 'priced', 'confirmed'].includes(booking.status);

    return (
        <div className="flex justify-end items-center gap-2">
            {booking.status === 'priced' && (
                <Button size="sm" onClick={() => openBidsDialog(booking)}>
                <Handshake className="mr-2 h-4 w-4" />
                View Bids
                </Button>
            )}
            {(booking.status === 'confirmed' || booking.status === 'in transit') && (
                <Button size="sm" variant="outline" onClick={() => openTrackingDialog(booking)}>
                <Car className="mr-2 h-4 w-4" />
                Track
                </Button>
            )}
            {canCancel && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">Cancel</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently cancel your booking.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Back</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancelBooking(booking.id)}>
                            Yes, Cancel Booking
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
  };

  return (
    <>
    <main className="flex min-h-[calc(100vh-3rem)] w-full flex-col items-center p-4 pt-8 md:min-h-screen md:p-8">
      <Card className="w-full max-w-6xl rounded-2xl shadow-2xl">
        <CardHeader className="p-8">
            <div className="flex items-center gap-4">
                <div className="rounded-full bg-primary/10 p-4">
                    <BookMarked className="h-10 w-10 text-primary" />
                </div>
                <div>
                     <CardTitle className="font-headline text-4xl tracking-tight">
                        My Bookings
                    </CardTitle>
                    <CardDescription className="pt-1">
                        Here are all your current and past bookings.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
            <div className="grid gap-4 md:grid-cols-2 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                        <Hash className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalBookings}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Available Drivers</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalDrivers}</div>
                    </CardContent>
                </Card>
            </div>
          {loading ? (
            <div className="text-center">Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <div className="text-center text-muted-foreground">
              You have no active bookings.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
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
                      <TableCell>
                        {formatDate(booking.fromDate)} - {formatDate(booking.toDate)}
                      </TableCell>
                       <TableCell>
                        {booking.price ? (
                          <div className='flex items-center'>
                            <span className="mr-2 h-4 w-4 text-muted-foreground">Rs</span>
                            {booking.price.toFixed(2)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Awaiting Bids</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {renderStatusBadge(booking.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        {renderAction(booking)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
           <div className="mt-8 flex justify-end gap-4">
                <Button asChild>
                    <Link href="/user/booking">Create New Booking</Link>
                </Button>
            </div>
        </CardContent>
      </Card>
    </main>

    <Dialog open={isBidsDialogOpen} onOpenChange={setIsBidsDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl tracking-tight">Available Bids</DialogTitle>
            <DialogDescription>
             Here are the offers from our drivers. Accept a bid or propose a counter-offer.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Driver</TableHead>
                        <TableHead>Driver's Bid</TableHead>
                        <TableHead>Your Offer</TableHead>
                        <TableHead className='text-right'>Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(selectedBooking?.bids || []).map((bid) => (
                        <TableRow key={`${bid.driverId}-${bid.price}`}>
                            <TableCell>{bid.driverName}</TableCell>
                            <TableCell>Rs {bid.price.toFixed(2)}</TableCell>
                             <TableCell>
                                {bid.counterStatus === 'pending' ? (
                                    <span className='text-muted-foreground italic'>Waiting for driver (Rs {bid.counterPrice?.toFixed(2)})</span>
                                ) : bid.counterStatus === 'rejected' ? (
                                    <span className='text-destructive italic'>Driver rejected offer</span>
                                ): (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            placeholder="Your price..."
                                            className="h-8 w-28"
                                            value={counterOfferInputs[bid.driverId] || ''}
                                            onChange={e => setCounterOfferInputs({...counterOfferInputs, [bid.driverId]: e.target.value})}
                                        />
                                        <Button size="sm" variant="outline" onClick={() => selectedBooking && handleProposeCounter(selectedBooking.id, bid.driverId)}>
                                            Send
                                        </Button>
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className='text-right'>
                                <Button onClick={() => selectedBooking && acceptBid(selectedBooking.id, bid)}>Accept Original</Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

    <Dialog open={isTrackingDialogOpen} onOpenChange={setIsTrackingDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl tracking-tight">Track Your Shipment</DialogTitle>
            <DialogDescription>
              {selectedBooking?.status === 'in transit' ? (
                <>
                Your booking from <span className='font-medium'>{selectedBooking?.fromLocation}</span> to <span className='font-medium'>{selectedBooking?.toLocation}</span> is in transit.
                </>
              ) : (
                <>
                Your booking from <span className='font-medium'>{selectedBooking?.fromLocation}</span> to <span className='font-medium'>{selectedBooking?.toLocation}</span> is confirmed.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {selectedBooking?.driverName && (
              <div>
                <h3 className="font-semibold mb-2">Driver Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedBooking.driverName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${selectedBooking.driverEmail}`} className="hover:underline">
                      {selectedBooking.driverEmail}
                    </a>
                  </div>
                   <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${selectedBooking.driverMobileNumber}`} className="hover:underline">
                      {selectedBooking.driverMobileNumber}
                    </a>
                  </div>
                </div>
              </div>
            )}
            <div>
              <h3 className="font-semibold mb-2">Route Map</h3>
              <div className="aspect-video w-full overflow-hidden rounded-lg border">
                <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedBooking?.fromLocation || '')}+to+${encodeURIComponent(selectedBooking?.toLocation || '')}&output=embed`}
                ></iframe>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

    