
import React from 'react';
import { Product, Order } from './types';

export const INITIAL_CATALOG: Product[] = [
  { id: "0001", name: "Premium Coffee Beans", price: 25.00, category: "Gourmet", stock: 50, imageUrl: "https://picsum.photos/seed/coffee/400/300" },
  { id: "0002", name: "Artisan Mug", price: 15.00, category: "Tableware", stock: 120, imageUrl: "https://picsum.photos/seed/mug/400/300" },
  { id: "0003", name: "French Press", price: 45.00, category: "Equipment", stock: 15, imageUrl: "https://picsum.photos/seed/press/400/300" },
  { id: "0004", name: "Organic Tea Sampler", price: 30.00, category: "Gourmet", stock: 35, imageUrl: "https://picsum.photos/seed/tea/400/300" },
  { id: "0005", name: "Double Wall Glass", price: 12.00, category: "Tableware", stock: 80, imageUrl: "https://picsum.photos/seed/glass/400/300" },
];

export const INITIAL_ORDERS: Order[] = [
  { id: "ORD-101", timestamp: "2023-10-25 14:30", customerName: "John Doe", items: ["Premium Coffee Beans"], total: 25.0, status: "Completed" },
  { id: "ORD-102", timestamp: "2023-10-25 15:15", customerName: "Jane Smith", items: ["Artisan Mug", "French Press"], total: 60.0, status: "Pending" },
];

export const formatProductId = (rawId: string): string => {
  return rawId.padStart(4, '0');
};
