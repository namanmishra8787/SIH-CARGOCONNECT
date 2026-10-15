
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';
import { BookingTable } from './booking-table';

export default function StaffDashboardPage() {
  return (
    <main className="flex min-h-screen w-full flex-col p-4 pt-8 md:p-8">
      <Card className="w-full max-w-7xl rounded-2xl shadow-2xl">
        <CardHeader className="p-8">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <ClipboardList className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="font-headline text-4xl tracking-tight">
                Staff Dashboard
              </CardTitle>
              <CardDescription className="pt-1">
                View and manage all user bookings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-8 pb-8">
            <BookingTable />
        </CardContent>
      </Card>
    </main>
  );
}
