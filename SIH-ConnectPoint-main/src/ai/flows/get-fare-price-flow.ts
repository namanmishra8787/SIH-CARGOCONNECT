'use server';
/**
 * @fileOverview An AI flow to calculate a fair price for a logistics booking.
 *
 * - getFarePrice - A function that handles the price calculation.
 * - GetFarePriceInput - The input type for the getFarePrice function.
 * - GetFarePriceOutput - The return type for the getFarePrice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const GetFarePriceInputSchema = z.object({
  vehicleType: z.string().describe('The type of vehicle requested for the booking.'),
  weight: z.number().describe('The weight of the shipment in tons.'),
  distance: z.string().describe('The estimated travel distance in kilometers.'),
  fromLocation: z.string().describe('The starting point of the delivery.'),
  toLocation: z.string().describe('The destination of the delivery.'),
});
export type GetFarePriceInput = z.infer<typeof GetFarePriceInputSchema>;

const GetFarePriceOutputSchema = z.object({
  suggestedPrice: z.number().describe('The suggested fair price for the booking in INR.'),
});
export type GetFarePriceOutput = z.infer<typeof GetFarePriceOutputSchema>;

export async function getFarePrice(input: GetFarePriceInput): Promise<GetFarePriceOutput> {
  return getFarePriceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'getFarePricePrompt',
  input: {schema: GetFarePriceInputSchema},
  output: {schema: GetFarePriceOutputSchema},
  prompt: `You are a logistics pricing expert in India. Your task is to calculate a fair market price for a shipment based on the provided details. The final price should be in Indian Rupees (INR).

Consider the following factors:
1.  **Base Rate per Vehicle Type (per km):**
    *   Pickup: ₹30/km
    *   Medium Vehicle: ₹50/km
    *   Truck: ₹70/km
    *   Container: ₹90/km

2.  **Weight Surcharge:** Add a surcharge based on weight. For every 10 tons, add ₹1000 to the total cost.
3.  **Route Complexity:** Consider the origin and destination. Add a small premium (5-10%) for routes that might involve difficult terrain, remote areas, or heavy traffic congestion.
4.  **Demand:** Assume standard demand. No need to adjust for high or low seasons.

**Booking Details:**
*   Vehicle Type: {{{vehicleType}}}
*   Weight: {{{weight}}} tons
*   Distance: {{{distance}}}
*   From: {{{fromLocation}}}
*   To: {{{toLocation}}}

Based on these details, calculate the final suggested price. Return ONLY the final numeric price in the 'suggestedPrice' field.
`,
});

const getFarePriceFlow = ai.defineFlow(
  {
    name: 'getFarePriceFlow',
    inputSchema: GetFarePriceInputSchema,
    outputSchema: GetFarePriceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
