export interface Farmer {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  products: string[];
  hasFreezer: boolean;
}

export interface Bucket {
  id: string;
  farmerId: string;
  farmerName: string;
  productType: string;
  brixValue?: number;
  phValue?: number;
  quantity: number;
  collectionTime: "Morning" | "Evening";
  qrCode: string;
  amountPerKg: number;
  total: number;
}

export interface Draft {
  id: string;
  date: string;
  buckets: Bucket[];
  status: "draft" | "submitted";
}

export interface Batch {
  id: string;
  batchNumber: string;
  date: string;
  status: "in-progress" | "completed";
  selectedBuckets: string[];
}

export const mockFarmers: Farmer[] = [
  {
    id: "1",
    name: "Gunapala",
    address: "Colombo Road, Galle",
    contactNumber: "+94 77 123 4567",
    products: ["Toddy", "Syrup"],
    hasFreezer: true,
  },
  {
    id: "2",
    name: "Somapala",
    address: "Matara Road, Hikkaduwa",
    contactNumber: "+94 77 234 5678",
    products: ["Toddy"],
    hasFreezer: false,
  },
  {
    id: "3",
    name: "Rathnapala",
    address: "Kandy Road, Kurunegala",
    contactNumber: "+94 77 345 6789",
    products: ["Toddy", "Syrup"],
    hasFreezer: true,
  },
];

export const mockBuckets: Bucket[] = [
  {
    id: "b1",
    farmerId: "1",
    farmerName: "Gunapala",
    productType: "Toddy",
    brixValue: 23,
    phValue: 5,
    quantity: 10,
    collectionTime: "Morning",
    qrCode: "QR001",
    amountPerKg: 100,
    total: 1000,
  },
  {
    id: "b2",
    farmerId: "3",
    farmerName: "Rathnapala",
    productType: "Toddy",
    brixValue: 22,
    phValue: 5.2,
    quantity: 12,
    collectionTime: "Morning",
    qrCode: "QR002",
    amountPerKg: 100,
    total: 1200,
  },
  {
    id: "b3",
    farmerId: "2",
    farmerName: "Somapala",
    productType: "Toddy",
    brixValue: 24,
    phValue: 4.8,
    quantity: 12,
    collectionTime: "Evening",
    qrCode: "QR003",
    amountPerKg: 100,
    total: 1200,
  },
];

export const mockDrafts: Draft[] = [
  {
    id: "d1",
    date: "2025/06/16",
    buckets: [mockBuckets[0], mockBuckets[1], mockBuckets[2]],
    status: "draft",
  },
  {
    id: "d2",
    date: "2025/06/15",
    buckets: [mockBuckets[0], mockBuckets[1], mockBuckets[2]],
    status: "draft",
  },
  {
    id: "d3",
    date: "2025/06/14",
    buckets: [mockBuckets[0], mockBuckets[1], mockBuckets[2]],
    status: "draft",
  },
  {
    id: "d4",
    date: "2025/06/13",
    buckets: [mockBuckets[0], mockBuckets[1], mockBuckets[2]],
    status: "submitted",
  },
];

export const mockBatches: Batch[] = [
  {
    id: "batch1",
    batchNumber: "01",
    date: "2025/06/16",
    status: "in-progress",
    selectedBuckets: ["b1"],
  },
  {
    id: "batch2",
    batchNumber: "02",
    date: "2025/06/15",
    status: "completed",
    selectedBuckets: ["b1", "b2"],
  },
  {
    id: "batch3",
    batchNumber: "03",
    date: "2025/06/14",
    status: "in-progress",
    selectedBuckets: [],
  },
];
