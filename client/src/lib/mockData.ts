export interface Farmer {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  products: string[];
  hasFreezer: boolean;
}

export interface CollectionCenter {
  id: string;
  name: string;
  location: string;
  contactNumber: string;
}

export interface Bucket {
  id: string;
  collectionCenterId: string;
  canId: string;
  productType: string;
  phValue?: number;
  quantity: number;
  amountPerL: number;
  total: number;
}

export interface Draft {
  id: string;
  date: string;
  collectionCenters: { centerId: string; buckets: Bucket[] }[];
  status: "draft" | "submitted";
}

export interface Batch {
  id: string;
  batchNumber: string;
  date: string;
  status: "in-progress" | "completed";
  selectedBuckets: string[];
}

export const mockCollectionCenters: CollectionCenter[] = [
  {
    id: "cc1",
    name: "Gunapala Center",
    location: "Colombo Road, Galle",
    contactNumber: "+94 77 123 4567",
  },
  {
    id: "cc2",
    name: "Rathnapala Center",
    location: "Kandy Road, Kurunegala",
    contactNumber: "+94 77 345 6789",
  },
  {
    id: "cc3",
    name: "Somapala Center",
    location: "Matara Road, Hikkaduwa",
    contactNumber: "+94 77 234 5678",
  },
];

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
    collectionCenterId: "cc1",
    canId: "CAN001",
    productType: "Toddy",
    phValue: 5,
    quantity: 10,
    amountPerL: 100,
    total: 1000,
  },
  {
    id: "b2",
    collectionCenterId: "cc1",
    canId: "CAN002",
    productType: "Toddy",
    phValue: 5.2,
    quantity: 12,
    amountPerL: 100,
    total: 1200,
  },
  {
    id: "b3",
    collectionCenterId: "cc2",
    canId: "CAN003",
    productType: "Toddy",
    phValue: 4.8,
    quantity: 12,
    amountPerL: 100,
    total: 1200,
  },
];

export const mockDrafts: Draft[] = [
  {
    id: "d1",
    date: "2025/06/16",
    collectionCenters: [
      { centerId: "cc1", buckets: [mockBuckets[0], mockBuckets[1]] },
      { centerId: "cc2", buckets: [mockBuckets[2]] },
    ],
    status: "draft",
  },
  {
    id: "d2",
    date: "2025/06/15",
    collectionCenters: [
      { centerId: "cc1", buckets: [mockBuckets[0], mockBuckets[1]] },
      { centerId: "cc2", buckets: [mockBuckets[2]] },
    ],
    status: "draft",
  },
  {
    id: "d3",
    date: "2025/06/14",
    collectionCenters: [
      { centerId: "cc1", buckets: [mockBuckets[0], mockBuckets[1]] },
      { centerId: "cc2", buckets: [mockBuckets[2]] },
    ],
    status: "draft",
  },
  {
    id: "d4",
    date: "2025/06/13",
    collectionCenters: [
      { centerId: "cc1", buckets: [mockBuckets[0], mockBuckets[1]] },
      { centerId: "cc2", buckets: [mockBuckets[2]] },
    ],
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
