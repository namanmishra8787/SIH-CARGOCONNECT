
'use server';

import app from '@/lib/firebase';
import {
  getFirestore,
  collection,
  getDocs,
  Timestamp,
  doc,
  updateDoc,
  getDoc,
  orderBy,
  query,
  arrayUnion,
  where,
} from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

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
  weight: number;
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

export async function getBookingsForStaff(staffId: string) {
  try {
    const db = getFirestore(app);
    const bookingsCollection = collection(db, 'bookings');
    
    // Phase 1: Get bookings open for bidding (pending or priced) that this staff member has NOT bid on or has no counter-offer.
    const openForBiddingQuery = query(bookingsCollection, where('status', 'in', ['pending', 'priced']));
    const openForBiddingSnapshot = await getDocs(openForBiddingQuery);
    const openBookings = openForBiddingSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Booking))
       .filter(booking => {
        const myBid = (booking.bids || []).find(bid => bid.driverId === staffId);
        // Show if I haven't bid OR if my bid has been rejected.
        return !myBid || myBid.counterStatus === 'rejected';
      });

    // Phase 2: Get bookings assigned to this staff member (confirmed, in transit)
    const assignedQuery = query(
      bookingsCollection,
      where('driverId', '==', staffId),
      where('status', 'in', ['confirmed', 'in transit'])
    );
    const assignedSnapshot = await getDocs(assignedQuery);
    const assignedBookings = assignedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
    
    // Phase 3: Get bookings where this staff member has a pending counter-offer from a user
    const pendingCounterQuery = query(bookingsCollection, where('status', '==', 'priced'));
    const pendingCounterSnapshot = await getDocs(pendingCounterQuery);
    const pendingCounterBookings = pendingCounterSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Booking))
        .filter(booking => 
            (booking.bids || []).some(bid => bid.driverId === staffId && bid.counterStatus === 'pending')
        );


    const allBookings = [...openBookings, ...assignedBookings, ...pendingCounterBookings];
    
    // Remove duplicates that might appear in both open and pending-counter
    const uniqueBookings = allBookings.filter((booking, index, self) =>
        index === self.findIndex((b) => b.id === booking.id)
    );


    // Sort by date before serializing
    uniqueBookings.sort((a, b) => {
        const dateA = a.fromDate instanceof Timestamp ? a.fromDate.toMillis() : 0;
        const dateB = b.fromDate instanceof Timestamp ? b.fromDate.toMillis() : 0;
        return dateB - dateA;
    });

    const serializedBookings = uniqueBookings.map((booking) => {
        const fromDate = booking.fromDate instanceof Timestamp ? booking.fromDate.toDate().toISOString() : new Date(booking.fromDate).toISOString();
        const toDate = booking.toDate instanceof Timestamp ? booking.toDate.toDate().toISOString() : new Date(booking.toDate).toISOString();

        return {
            ...booking,
            fromDate: fromDate,
            toDate: toDate,
            bids: (booking.bids || []).map(bid => ({
                ...bid,
                // Ensure counterStatus is at least present
                counterStatus: bid.counterStatus || undefined,
            })),
        };
    });

    return { bookings: serializedBookings };
  } catch (e: any) {
    console.error('Error fetching bookings:', e);
    return { error: 'Failed to fetch bookings. Details: ' + e.message, bookings: [] };
  }
}

export async function placeBidAction(bookingId: string, bid: Bid) {
  try {
    const db = getFirestore(app);
    const bookingRef = doc(db, 'bookings', bookingId);
    
    await updateDoc(bookingRef, {
      bids: arrayUnion(bid),
      status: 'priced', // Keep status as 'priced' to indicate bids are available
    });

    revalidatePath('/staff/dashboard');
    revalidatePath('/user/my-bookings');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateStatusAction(
  bookingId: string,
  status: string,
  driverDetails?: { driverId: string; driverName: string; driverEmail: string, driverMobileNumber: string }
) {
  try {
    const db = getFirestore(app);
    const bookingRef = doc(db, 'bookings', bookingId);
    let updateData: {
      status: string;
      driverId?: string;
      driverName?: string;
      driverEmail?: string;
      driverMobileNumber?: string;
    } = { status };

    if ((status === 'confirmed' || status === 'in transit') && driverDetails) {
      updateData = { ...updateData, ...driverDetails };
    }

    await updateDoc(bookingRef, updateData);
    revalidatePath('/staff/dashboard');
    revalidatePath('/user/my-bookings');
    revalidatePath('/staff/history');
    revalidatePath('/user/pre-booking');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getStaffDetails(uid: string) {
    const db = getFirestore(app);
    const staffRef = doc(db, "staff", uid);
    const staffSnap = await getDoc(staffRef);
    if (!staffSnap.exists()) {
      throw new Error("Staff details not found.");
    }
    return staffSnap.data();
}

export async function getStaffHistory(staffId: string) {
  try {
    const db = getFirestore(app);
    const bookingsCollection = collection(db, 'bookings');
    const q = query(
      bookingsCollection,
      where('driverId', '==', staffId),
      where('status', '==', 'done')
    );
    const snapshot = await getDocs(q);

    let totalEarnings = 0;
    const completedBookings = snapshot.docs.map((doc) => {
      const data = doc.data() as Booking;
      if (data.price) {
        totalEarnings += data.price;
      }
      const fromDate = data.fromDate instanceof Timestamp ? data.fromDate.toDate().toISOString() : new Date(data.fromDate).toISOString();
      const toDate = data.toDate instanceof Timestamp ? data.toDate.toDate().toISOString() : new Date(data.toDate).toISOString();
      return {
        id: doc.id,
        ...data,
        fromDate: fromDate,
        toDate: toDate,
      };
    });
    
    return { 
      bookings: completedBookings, 
      totalBookings: completedBookings.length, 
      totalEarnings 
    };
  } catch (e: any) {
    console.error('Error fetching staff history:', e);
    return { error: e.message, bookings: [], totalBookings: 0, totalEarnings: 0 };
  }
}


export async function proposeCounterOfferAction(bookingId: string, driverId: string, counterPrice: number) {
    try {
        const db = getFirestore(app);
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) {
            return { success: false, error: 'Booking not found.' };
        }

        const bookingData = bookingSnap.data() as Booking;
        const bids = bookingData.bids || [];
        const updatedBids = bids.map(bid => {
            if (bid.driverId === driverId) {
                return { ...bid, counterPrice, counterStatus: 'pending' as const };
            }
            return bid;
        });

        await updateDoc(bookingRef, { bids: updatedBids });
        
        revalidatePath('/user/my-bookings');
        revalidatePath('/staff/dashboard');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function acceptCounterOfferAction(bookingId: string, driverId: string) {
    try {
        const db = getFirestore(app);
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) throw new Error('Booking not found');
        
        const bookingData = bookingSnap.data() as Booking;
        const bids = bookingData.bids || [];
        const bidToAccept = bids.find(b => b.driverId === driverId);

        if (!bidToAccept || !bidToAccept.counterPrice) throw new Error('Counter offer not found or invalid.');
        
        const driverDetails = {
            driverId: bidToAccept.driverId,
            driverName: bidToAccept.driverName,
            driverEmail: bidToAccept.driverEmail,
            driverMobileNumber: bidToAccept.driverMobileNumber,
        };

        await updateDoc(bookingRef, {
            status: 'confirmed',
            price: bidToAccept.counterPrice,
            ...driverDetails
        });

        revalidatePath('/staff/dashboard');
        revalidatePath('/user/my-bookings');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function rejectCounterOfferAction(bookingId: string, driverId: string) {
     try {
        const db = getFirestore(app);
        const bookingRef = doc(db, 'bookings', bookingId);
        const bookingSnap = await getDoc(bookingRef);

        if (!bookingSnap.exists()) throw new Error('Booking not found');

        const bookingData = bookingSnap.data() as Booking;
        const bids = bookingData.bids || [];
        const updatedBids = bids.map(bid => {
            if (bid.driverId === driverId) {
                // Remove counter details
                const { counterPrice, counterStatus, ...rest } = bid;
                return { ...rest, counterStatus: 'rejected' as const };
            }
            return bid;
        });

        await updateDoc(bookingRef, { bids: updatedBids });

        revalidatePath('/staff/dashboard');
        revalidatePath('/user/my-bookings');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

    