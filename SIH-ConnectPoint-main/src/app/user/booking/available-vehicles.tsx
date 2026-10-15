
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
import { Truck, Package } from 'lucide-react';
import { getSharedBookings } from '@/app/(staff)/dashboard/actions';

const vehicleTypes = [
  { name: 'Pickup', status: 'Available' },
  { name: 'Medium Vehicle', status: 'Available' },
  { name: 'Truck', status: 'Available' },
  { name: 'Container', status: 'Available' },
];

interface SharedBooking {
  id: string;
  vehicleType: string;
  fromLocation: string;
  toLocation: string;
  availableSpace: number;
  driverName: string;
}

export function AvailableVehicles() {
  const [sharedBookings, setSharedBookings] = useState<SharedBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchShared() {
      setLoading(true);
      const bookings = await getSharedBookings();
      setSharedBookings(bookings);
      setLoading(false);
    }
    fetchShared();
  }, []);

  return (
    <div className="py-4 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Standard Vehicle Types</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle Type</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicleTypes.map((vehicle) => (
              <TableRow key={vehicle.name}>
                <TableCell className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{vehicle.name}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="default">{vehicle.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Shared Capacity Available</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading available shared spaces...</p>
        ) : sharedBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shared capacity is available right now.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Space</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sharedBookings.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <div className="font-medium">{booking.fromLocation}</div>
                    <div className="text-xs text-muted-foreground">to {booking.toLocation}</div>
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.vehicleType}</span>
                    </div>
                  </TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.availableSpace} tons</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm">Book Space</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
