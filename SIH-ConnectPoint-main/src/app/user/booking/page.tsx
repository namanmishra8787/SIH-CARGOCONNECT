
"use client";

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import app from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { CalendarIcon, Truck, WandSparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { getFarePrice, GetFarePriceInput } from '@/ai/flows/get-fare-price-flow';

const vehicleWeightRanges = {
  Pickup: { min: 1, max: 40 },
  'Medium Vehicle': { min: 40, max: 80 },
  Truck: { min: 80, max: 120 },
  Container: { min: 120, max: Infinity },
};

const bookingFormSchema = z
  .object({
    vehicleType: z.string().min(1, 'Vehicle type is required'),
    weight: z.coerce.number().min(1, 'Weight is required'),
    fromLocation: z.string().min(1, 'From location is required'),
    toLocation: z.string().min(1, 'To location is required'),
    fromDate: z.date({
      required_error: 'A from date is required.',
    }),
    toDate: z.date({
      required_error: 'A to date is required.',
    }),
    distance: z.string().optional(),
    suggestedPrice: z.coerce.number().optional(),
  })
  .refine(
    (data) => {
      const vehicle = data.vehicleType as keyof typeof vehicleWeightRanges;
      if (!vehicleWeightRanges[vehicle]) return true; // Pass if vehicle type is not in our list
      return (
        data.weight >= vehicleWeightRanges[vehicle].min &&
        data.weight <= vehicleWeightRanges[vehicle].max
      );
    },
    {
      message: 'Weight is out of range for the selected vehicle type',
      path: ['weight'],
    }
  );

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export default function BookingPage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const db = getFirestore(app);
  const auth = getAuth(app);

  const [fromLocationQuery, setFromLocationQuery] = useState('');
  const [toLocationQuery, setToLocationQuery] = useState('');

  const [fromSuggestions, setFromSuggestions] = useState<Suggestion[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Suggestion[]>([]);

  const [fromCoords, setFromCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lon: number } | null>(null);
  
  const [isCalculatingFare, setIsCalculatingFare] = useState(false);

  const form = useForm<z.infer<typeof bookingFormSchema>>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      vehicleType: '',
      weight: 0,
      fromLocation: '',
      toLocation: '',
      fromDate: new Date(),
      toDate: new Date(),
      distance: '',
    },
  });

  const selectedVehicleType = form.watch('vehicleType') as keyof typeof vehicleWeightRanges;

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

  const fetchSuggestions = useCallback(
    async (query: string, setSuggestions: (s: Suggestion[]) => void) => {
      if (query.length < 3) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            query
          )}&format=json&addressdetails=1`
        );
        const data = await response.json();
        setSuggestions(data);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      }
    },
    []
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSuggestions(fromLocationQuery, setFromSuggestions);
    }, 500);
    return () => clearTimeout(handler);
  }, [fromLocationQuery, fetchSuggestions]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSuggestions(toLocationQuery, setToSuggestions);
    }, 500);
    return () => clearTimeout(handler);
  }, [toLocationQuery, fetchSuggestions]);

  // Haversine formula to calculate distance between two lat/lon points
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  useEffect(() => {
    if (fromCoords && toCoords) {
      const dist = calculateDistance(
        fromCoords.lat,
        fromCoords.lon,
        toCoords.lat,
        toCoords.lon
      );
      form.setValue('distance', `${dist.toFixed(2)} km`);
    } else {
      form.setValue('distance', '');
    }
  }, [fromCoords, toCoords, form]);

  async function onSubmit(values: z.infer<typeof bookingFormSchema>) {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a booking.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { suggestedPrice, ...restOfValues } = values;
      const bookingData: any = {
        ...restOfValues,
        userId: user.uid,
        status: 'pending',
      };

      if (suggestedPrice !== undefined && !isNaN(suggestedPrice)) {
        bookingData.suggestedPrice = suggestedPrice;
      }

      await addDoc(collection(db, 'bookings'), bookingData);
      toast({
        title: 'Success!',
        description: 'Your booking has been created.',
      });
      router.push('/user/my-bookings');
    } catch (error) {
      console.error('Error adding document: ', error);
      toast({
        title: 'Error',
        description: 'There was a problem creating your booking.',
        variant: 'destructive',
      });
    }
  }

  const handleCalculateFare = async () => {
    const isFormValid = await form.trigger(['vehicleType', 'weight', 'fromLocation', 'toLocation', 'distance']);
    if (!isFormValid) {
        toast({
            title: 'Incomplete Details',
            description: 'Please fill in all vehicle and route details before calculating the fare.',
            variant: 'destructive',
        });
        return;
    }

    setIsCalculatingFare(true);
    form.setValue('suggestedPrice', 0);
    try {
        const values = form.getValues();
        const input: GetFarePriceInput = {
            vehicleType: values.vehicleType,
            weight: Number(values.weight),
            fromLocation: values.fromLocation,
            toLocation: values.toLocation,
            distance: values.distance || '0 km',
        };
        const result = await getFarePrice(input);
        if (result.suggestedPrice) {
            form.setValue('suggestedPrice', result.suggestedPrice);
        }
    } catch(error: any) {
        console.error('Error calculating fare:', error);
        const errorMessage = error.message || '';
        if (errorMessage.includes('503') || errorMessage.toLowerCase().includes('service unavailable')) {
             toast({
                title: 'AI Service Unavailable',
                description: 'The AI pricing service is temporarily down. Please try again in a few moments.',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'AI Pricing Error',
                description: 'Could not calculate a suggested fare at this time.',
                variant: 'destructive',
            });
        }
    } finally {
        setIsCalculatingFare(false);
    }
  }

  const handleLocationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: any,
    setLocationQuery: (query: string) => void,
    setCoords: (coords: { lat: number; lon: number } | null) => void
  ) => {
    field.onChange(e);
    setLocationQuery(e.target.value);
    setCoords(null); // Reset coords if user is typing a new address
  };

  const handleSuggestionClick = (
    suggestion: Suggestion,
    field: any,
    setLocationQuery: (query: string) => void,
    setSuggestions: (s: Suggestion[]) => void,
    setCoords: (coords: { lat: number; lon: number }) => void
  ) => {
    field.onChange(suggestion.display_name);
    setLocationQuery(suggestion.display_name);
    setCoords({ lat: parseFloat(suggestion.lat), lon: parseFloat(suggestion.lon) });
    setSuggestions([]);
  };

  const MapPreview = ({ query }: { query: string }) => {
    if (!query) return null;
    const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
      query
    )}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

    return (
      <div className="mt-2 rounded-md overflow-hidden h-48">
        <iframe
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={embedUrl}
        ></iframe>
      </div>
    );
  };

  const SuggestionsList = ({
    suggestions,
    onSuggestionClick,
  }: {
    suggestions: Suggestion[];
    onSuggestionClick: (suggestion: Suggestion) => void;
  }) => {
    if (suggestions.length === 0) return null;

    return (
      <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
        <CardContent className="p-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.place_id}
              className="p-2 hover:bg-accent rounded-md cursor-pointer"
              onClick={() => onSuggestionClick(suggestion)}
            >
              {suggestion.display_name}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  const getWeightDescription = () => {
    if (!selectedVehicleType || !vehicleWeightRanges[selectedVehicleType]) {
      return null;
    }
    const { min, max } = vehicleWeightRanges[selectedVehicleType];
    if (max === Infinity) {
      return `(more than ${min} tons)`;
    }
    return `(${min} - ${max} tons)`;
  };


  return (
    <main className="flex min-h-[calc(100vh-3rem)] w-full items-center justify-center p-4 md:min-h-screen md:p-8">
      <Card className="w-full max-w-2xl rounded-2xl shadow-2xl">
        <CardHeader className="p-8 text-center">
          <div className="mx-auto mb-4 rounded-full bg-primary/10 p-4">
            <Truck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="font-headline text-4xl tracking-tight">
            Create a Booking
          </CardTitle>
          <CardDescription className="pt-1">
            Fill in the details below to create your booking.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="vehicleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Type</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.trigger('weight'); // Re-validate weight when vehicle type changes
                        }}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a vehicle type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Pickup">Pickup</SelectItem>
                          <SelectItem value="Medium Vehicle">
                            Medium Vehicle
                          </SelectItem>
                          <SelectItem value="Truck">Truck</SelectItem>
                          <SelectItem value="Container">Container</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                       <FormLabel>
                        Weight (tons){' '}
                        <span className="text-xs text-muted-foreground">
                          {getWeightDescription()}
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 5" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="fromLocation"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel>From Location</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., New York, NY"
                            {...field}
                            onChange={(e) =>
                              handleLocationChange(
                                e,
                                field,
                                setFromLocationQuery,
                                setFromCoords
                              )
                            }
                            autoComplete="off"
                          />
                        </FormControl>
                        <FormMessage />
                        <SuggestionsList
                          suggestions={fromSuggestions}
                          onSuggestionClick={(suggestion) =>
                            handleSuggestionClick(
                              suggestion,
                              field,
                              setFromLocationQuery,
                              setFromSuggestions,
                              setFromCoords
                            )
                          }
                        />
                        <MapPreview query={form.watch('fromLocation')} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="toLocation"
                    render={({ field }) => (
                      <FormItem className="relative">
                        <FormLabel>To Location</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Los Angeles, CA"
                            {...field}
                            onChange={(e) =>
                              handleLocationChange(
                                e,
                                field,
                                setToLocationQuery,
                                setToCoords
                              )
                            }
                            autoComplete="off"
                          />
                        </FormControl>
                        <FormMessage />
                        <SuggestionsList
                          suggestions={toSuggestions}
                          onSuggestionClick={(suggestion) =>
                            handleSuggestionClick(
                              suggestion,
                              field,
                              setToLocationQuery,
                              setToSuggestions,
                              setToCoords
                            )
                          }
                        />
                        <MapPreview query={form.watch('toLocation')} />
                      </FormItem>
                    )}
                  />
                </div>
                 <FormField
                  control={form.control}
                  name="distance"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Distance</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Calculated automatically"
                          {...field}
                          readOnly
                          className="bg-muted"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fromDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>From Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="toDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>To Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
                              className={cn(
                                'w-full pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date <
                              (form.getValues('fromDate') || new Date())
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                 <FormField
                    control={form.control}
                    name="suggestedPrice"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Suggested Fare (AI-Powered)</FormLabel>
                        <div className="flex items-center gap-4">
                            <FormControl>
                                <div className="relative w-full">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 h-5 flex items-center text-muted-foreground">Rs</span>
                                    <Input
                                        placeholder={isCalculatingFare ? 'Calculating...' : 'Click the button to calculate'}
                                        {...field}
                                        value={field.value > 0 ? field.value.toFixed(2) : ''}
                                        readOnly
                                        className="bg-muted pl-10"
                                    />
                                </div>
                            </FormControl>
                             <Button type="button" variant="outline" onClick={handleCalculateFare} disabled={isCalculatingFare}>
                                <WandSparkles className="mr-2 h-4 w-4" />
                                {isCalculatingFare ? "Calculating..." : "Calculate Fair Price"}
                            </Button>
                        </div>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
              </div>

              <div className="flex justify-end items-center gap-4 pt-4">
                <Button type="submit" size="lg" className="text-base">
                  Create Booking
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}

    