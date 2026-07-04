// Level 1 placeholder data module.
//
// The product catalog is a local, hard-coded array so the Catalog and
// ProductDetail pages have something real to render. Level 2 replaces this
// module with calls to the real product API (per-store listings, images,
// stock, etc.) — nothing here should be treated as a persistent data source.

export interface Product {
  id: string;
  name: string;
  price: number;
  storeName: string;
  category: string;
  description: string;
  rating: number;
}

export const DUMMY_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Kemeja Batik Lengan Panjang',
    price: 185000,
    storeName: 'Toko Batik Nusantara',
    category: 'Fashion',
    description: 'Kemeja batik katun premium, motif klasik, cocok untuk acara formal maupun santai.',
    rating: 4.8,
  },
  {
    id: '2',
    name: 'Kopi Gayo Arabica 250g',
    price: 65000,
    storeName: 'Kedai Kopi Gayo',
    category: 'Makanan & Minuman',
    description: 'Biji kopi arabika pilihan dari dataran tinggi Gayo, disangrai medium.',
    rating: 4.9,
  },
  {
    id: '3',
    name: 'Tas Rotan Anyaman Tangan',
    price: 210000,
    storeName: 'Kriya Rotan Lombok',
    category: 'Kerajinan',
    description: 'Tas rotan anyaman tangan oleh pengrajin lokal, ringan dan tahan lama.',
    rating: 4.7,
  },
  {
    id: '4',
    name: 'Sepatu Sneakers Kanvas',
    price: 149000,
    storeName: 'Urban Footwear Co.',
    category: 'Fashion',
    description: 'Sepatu kanvas kasual dengan sol karet anti-slip, tersedia berbagai ukuran.',
    rating: 4.5,
  },
  {
    id: '5',
    name: 'Madu Hutan Murni 500ml',
    price: 95000,
    storeName: 'Madu Hutan Sumbawa',
    category: 'Makanan & Minuman',
    description: 'Madu hutan murni tanpa campuran, dipanen langsung dari sarang liar.',
    rating: 4.9,
  },
  {
    id: '6',
    name: 'Lampu Hias Bambu',
    price: 275000,
    storeName: 'Kriya Bambu Jogja',
    category: 'Dekorasi Rumah',
    description: 'Lampu hias dari anyaman bambu, memberi kesan hangat pada ruangan.',
    rating: 4.6,
  },
  {
    id: '7',
    name: 'Kaos Polos Katun Combed',
    price: 79000,
    storeName: 'Urban Footwear Co.',
    category: 'Fashion',
    description: 'Kaos katun combed 30s, nyaman dipakai sehari-hari.',
    rating: 4.4,
  },
  {
    id: '8',
    name: 'Keripik Pisang Coklat',
    price: 25000,
    storeName: 'Kedai Kopi Gayo',
    category: 'Makanan & Minuman',
    description: 'Keripik pisang renyah dengan lapisan coklat premium.',
    rating: 4.6,
  },
];

export function getProductById(id: string): Product | undefined {
  return DUMMY_PRODUCTS.find((product) => product.id === id);
}
