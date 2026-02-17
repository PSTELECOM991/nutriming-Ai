
import { createClient } from '@supabase/supabase-js';
import { Product, Transaction } from '../types';

const SUPABASE_URL = 'https://njvgjkqozmcwvajnxmmh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdmdqa3Fvem1jd3Zham54bW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMjIwMjcsImV4cCI6MjA4Njg5ODAyN30.Ovv6GScLAVD9cE3T0YHYB5jI9yKmaKUuLjfzQIm7oug';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return data as Product[];
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return data as Transaction[];
};

export const upsertProduct = async (product: Product) => {
  const { error } = await supabase
    .from('products')
    .upsert(product);
  
  if (error) throw error;
};

export const logTransaction = async (transaction: Transaction) => {
  const { error } = await supabase
    .from('transactions')
    .insert(transaction);
  
  if (error) throw error;
};
