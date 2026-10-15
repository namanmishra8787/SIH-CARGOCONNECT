
"use client";

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { useToast } from '@/hooks/use-toast';
import app from '@/lib/firebase';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

const loginFormSchema = z.object({
  credential: z.string().min(1, 'Email or Mobile Number is required'),
  password: z.string().min(1, 'Password is required'),
});

export default function StaffLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(format(new Date(), 'PPP'));
  }, []);

  const form = useForm<z.infer<typeof loginFormSchema>>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      credential: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof loginFormSchema>) {
    let email = values.credential;
    const isEmail = values.credential.includes('@');

    try {
        if (!isEmail) {
            // It's a mobile number, so find the corresponding email
            const staffQuery = query(collection(db, "staff"), where("mobileNumber", "==", values.credential));
            const querySnapshot = await getDocs(staffQuery);
            if (!querySnapshot.empty) {
                const staffData = querySnapshot.docs[0].data();
                email = staffData.email;
            } else {
                 // If mobile not found, force the login to fail with a known invalid email.
                email = 'invalid-credential@example.com';
            }
        }

      await signInWithEmailAndPassword(auth, email, values.password);
      toast({
        title: 'Success!',
        description: 'You have been logged in.',
      });
      router.push('/staff/dashboard');
    } catch (error: any) {
      console.error('Error logging in: ', error);
      const errorCode = error.code || error.message;
      toast({
        title: 'Error',
        description:
          errorCode === 'auth/invalid-credential'
            ? 'Invalid credentials.'
            : 'There was a problem logging you in.',
        variant: 'destructive',
      });
    }
  }

  return (
    <main className="flex h-full w-full items-center justify-center p-4">
      <Card className="w-full max-w-sm rounded-2xl shadow-2xl">
        <CardHeader className="items-center text-center p-8">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <Briefcase className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="font-headline text-4xl tracking-tight">
            Staff Login
          </CardTitle>
          <CardDescription className="pt-1">
            Welcome back! {currentDate && `Today is ${currentDate}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="credential"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email or Mobile Number</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com or 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center">
                      <FormLabel>Password</FormLabel>
                      <Link
                        href="#"
                        className="ml-auto inline-block text-sm underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full text-base mt-4" size="lg">
                Login
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/staff/signup" className="underline">
              Sign up
            </Link>
          </div>
          <div className="mt-2 text-center text-sm">
            <Link href="/" className="underline">
              Back to selection
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
