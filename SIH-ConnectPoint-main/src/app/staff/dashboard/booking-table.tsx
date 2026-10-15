
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { MoreHorizontal, Car, User as UserIcon, Mail, Phone } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { placeBidAction, updateStatusAction, getStaffDetails, getBookingsForStaff, acceptCounterOfferAction, rejectCounterOfferAction } from './actions';
import app from '@/lib/firebase';
import { toZonedTime } from 'date-fns-tz';
import { useRouter } from 'next/navigation';

interface Bid {
  driverId: string;
  driverName: string;
  driverEmail: string;
  driverMobileNumber: string;
  price: number;
  counterPrice?: number;
  counterStatus?: 'pending' | 'accepted' | 'rejected';
}

interface SerializedBooking {
  id: string;
  vehicleType: string;
  weight: number;
  fromLocation: string;
  toLocation: string;
  fromDate: string;
  toDate: string;
  status: string;
  userId: string;
  price?: number;
  driverId?: string;
  driverName?: string;
  driverEmail?: string;
  driverMobileNumber?: string;
  bids?: Bid[];
}

export function BookingTable() {
  const [bookings, setBookings] = useState<SerializedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [user, setUser] = useState<User | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<SerializedBooking | null>(null);
  const [isTrackingDialogOpen, setIsTrackingDialogOpen] = useState(false);
  const auth = getAuth(app);
  const { toast } = useToast();
  const router = useRouter();

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
    const result = await getBookingsForStaff(staffId);
    if (result.error) {
        setError(result.error);
    } else {
        setBookings(result.bookings);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    if (!user) return;
    fetchBookings(user.uid);
  }, [user]);

  const handlePriceChange = (bookingId: string, value: string) => {
    setPriceInputs({ ...priceInputs, [bookingId]: value });
  };

  const placeBid = async (bookingId: string) => {
    const price = parseFloat(priceInputs[bookingId]);
    if (isNaN(price) || price <= 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid price for your bid.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!user) {
        toast({ title: 'Error', description: 'You must be logged in to place a bid.', variant: 'destructive' });
        return;
    }

    try {
        const staffDetails = await getStaffDetails(user.uid) as any;
        const bid: Bid = {
            driverId: user.uid,
            driverName: staffDetails.name,
            driverEmail: staffDetails.email,
            driverMobileNumber: staffDetails.mobileNumber,
            price: price,
        };

        const result = await placeBidAction(bookingId, bid);
        if (result.success) {
          toast({
            title: 'Bid Placed!',
            description: 'Your bid has been submitted to the user.',
          });
          setPriceInputs({ ...priceInputs, [bookingId]: '' });
          if(user) fetchBookings(user.uid);
        } else {
          toast({
            title: 'Error',
            description: result.error || 'Could not place your bid.',
            variant: 'destructive',
          });
        }
    } catch(error: any) {
         toast({
          title: 'Error Placing Bid',
          description: error.message || 'Could not find your staff details.',
          variant: 'destructive',
        });
    }
  };
  
  const handleCounterOffer = async (bookingId: string, driverId: string, accept: boolean) => {
    const action = accept ? acceptCounterOfferAction : rejectCounterOfferAction;
    const result = await action(bookingId, driverId);

    if (result.success) {
        toast({
            title: `Counter Offer ${accept ? 'Accepted' : 'Rejected'}`,
            description: `The user's counter offer has been ${accept ? 'accepted' : 'rejected'}.`
        });
        if(user) fetchBookings(user.uid);
    } else {
        toast({
            title: 'Error',
            description: result.error || 'Could not process the counter offer.',
            variant: 'destructive'
        });
    }
  };


  const updateStatus = async (bookingId: string, status: string) => {
    if (!user) {
        toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
        return;
    };
    
    let driverDetails;
    if (status === 'in transit') {
      try {
        const staffDetails = await getStaffDetails(user.uid) as any;
        if (!staffDetails || !staffDetails.name || !staffDetails.email || !staffDetails.mobileNumber) {
          throw new Error('Staff details are incomplete.');
        }
        driverDetails = {
          driverId: user.uid,
          driverName: staffDetails.name,
          driverEmail: staffDetails.email,
          driverMobileNumber: staffDetails.mobileNumber,
        };
      } catch (error: any) {
        toast({
          title: 'Error Assigning Driver',
          description: error.message || 'Could not find staff details to assign driver.',
          variant: 'destructive',
        });
        return;
      }
    }

    const result = await updateStatusAction(bookingId, status, driverDetails);
    if (result.success) {
      toast({
        title: 'Status Updated!',
        description: `Booking status changed to ${status}.`,
      });
      if(user) fetchBookings(user.uid);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Could not update the status.',
        variant: 'destructive',
      });
    }
  };
  
  const openTrackingDialog = (booking: SerializedBooking) => {
    setSelectedBooking(booking);
    setIsTrackingDialogOpen(true);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    const date = parseISO(dateString);
    const zonedDate = toZonedTime(date, 'UTC');
    return format(zonedDate, 'PPP');
  };

  const renderStatusBadge = (status: string) => {
    let variant: 'secondary' | 'default' | 'destructive' = 'secondary';
    if (['confirmed', 'in transit', 'done'].includes(status)) {
      variant = 'default';
    } else if (status === 'cancelled') {
      variant = 'destructive';
    } else if (status === 'priced') {
        return <Badge variant="outline">Bidding Open</Badge>;
    }
    return <Badge variant={variant}>{status}</Badge>;
  };
  
  const renderPricingCell = (booking: SerializedBooking) => {
    const myBid = (booking.bids || []).find(b => b.driverId === user?.uid);
    
    // Case 1: There is a pending counter-offer from the user
    if (myBid?.counterStatus === 'pending' && myBid.counterPrice) {
        return (
            <div className='flex flex-col gap-2 items-start'>
                <div className='text-sm'>
                    User offered: <span className='font-bold'>Rs {myBid.counterPrice.toFixed(2)}</span>
                </div>
                 <div className='flex gap-2'>
                    <Button size='sm' onClick={() => handleCounterOffer(booking.id, myBid.driverId, true)}>Accept</Button>
                    <Button size='sm' variant='destructive' onClick={() => handleCounterOffer(booking.id, myBid.driverId, false)}>Reject</Button>
                </div>
            </div>
        )
    }

    // Case 2: I can place a new bid
    if (booking.status === 'pending' || (booking.status === 'priced' && !myBid) || myBid?.counterStatus === 'rejected') {
      return (
         <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Set bid price"
              value={priceInputs[booking.id] || ''}
              onChange={(e) => handlePriceChange(booking.id, e.target.value)}
              className="h-8 w-28"
            />
            <Button size="sm" onClick={() => placeBid(booking.id)}>Bid</Button>
          </div>
      )
    }
    
    // Case 3: Booking is confirmed with a price
    if (booking.price) {
      return <span>Rs {booking.price?.toFixed(2)}</span>
    }

    // Case 4: I have bid, but no counter-offer action yet
    if (myBid) {
       return <span className='text-muted-foreground'>You bid Rs {myBid.price.toFixed(2)}</span>
    }

    return <span className='text-muted-foreground'>N/A</span>
  }
  
  const renderActions = (booking: SerializedBooking) => {
    if (booking.status === 'confirmed' || booking.status === 'in transit') {
      return (
         <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => openTrackingDialog(booking)}>
                <Car className="mr-2 h-4 w-4" />
                Track
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => updateStatus(booking.id, 'in transit')}
                  disabled={booking.status !== 'confirmed'}
                >
                  Mark as In Transit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateStatus(booking.id, 'done')}
                  disabled={booking.status !== 'in transit'}
                >
                  Mark as Done
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => updateStatus(booking.id, 'cancelled')}
                  disabled={['pending', 'done', 'cancelled'].includes(booking.status)}
                >
                  Cancel Booking
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      );
    }
    return null;
  }

  if (loading) {
    return <div className="text-center text-muted-foreground">Loading bookings...</div>;
  }

  if (error) {
    return <div className="text-center text-destructive">Error fetching bookings: {error}</div>;
  }
  
  if (!bookings || bookings.length === 0) {
    return <div className="text-center text-muted-foreground">No available bookings or assignments.</div>;
  }

  return (
    <>
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vehicle</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pricing / Bids</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell className="font-medium">{booking.vehicleType}</TableCell>
              <TableCell>{booking.weight} tons</TableCell>
              <TableCell>{booking.fromLocation}</TableCell>
              <TableCell>{booking.toLocation}</TableCell>
              <TableCell>{formatDate(booking.fromDate)} - {formatDate(booking.toDate)}</TableCell>
              <TableCell>{renderStatusBadge(booking.status)}</TableCell>
              <TableCell>
                {renderPricingCell(booking)}
              </TableCell>
              <TableCell className="text-right">
                {renderActions(booking)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
     <Dialog open={isTrackingDialogOpen} onOpenChange={setIsTrackingDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl tracking-tight">Track Your Shipment</DialogTitle>
            <DialogDescription>
              {selectedBooking?.status === 'in transit' ? (
                <>
                Your assigned job from <span className='font-medium'>{selectedBooking?.fromLocation}</span> to <span className='font-medium'>{selectedBooking?.toLocation}</span> is in transit.
                </>
              ) : (
                <>
                Your assigned job from <span className='font-medium'>{selectedBooking?.fromLocation}</span> to <span className='font-medium'>{selectedBooking?.toLocation}</span> is confirmed.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {selectedBooking?.driverName && (
              <div>
                <h3 className="font-semibold mb-2">Your Details</h3>
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

    