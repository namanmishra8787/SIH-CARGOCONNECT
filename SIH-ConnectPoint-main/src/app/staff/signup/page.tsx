
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
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { Briefcase } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const signUpFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    mobileNumber: z.string().regex(/^\d{10}$/, 'Mobile number must be 10 digits'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export default function StaffSignUpPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const form = useForm<z.infer<typeof signUpFormSchema>>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      name: '',
      email: '',
      mobileNumber: '',
      password: '',
      confirmPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof signUpFormSchema>) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      // Save staff details to 'staff' collection
      await setDoc(doc(db, 'staff', user.uid), {
        name: values.name,
        email: values.email,
        mobileNumber: values.mobileNumber,
      });

      toast({
        title: 'Success!',
        description: 'Your staff account has been created.',
      });
      router.push('/staff/login');
    } catch (error: any) {
      console.error('Error signing up: ', error);
      toast({
        title: 'Error',
        description:
          error.code === 'auth/email-already-in-use'
            ? 'This email is already taken.'
            : 'There was a problem creating your account.',
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
            Create Staff Account
          </CardTitle>
          <CardDescription className="pt-1">
            Enter your details below to create your staff account.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="mobileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mobile Number</FormLabel>
                    <FormControl>
                      <Input placeholder="9876543210" {...field} />
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full text-base mt-4" size="lg">
                Sign Up
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/staff/login" className="underline">
              Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
