// API Client for Kithul Flow Application
const rawBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";
const normalizedBase = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
const API_BASE_URL = `${normalizedBase}/api`;

export type ProcessingBucketDto = {
  id: string;
  quantity: number;
  productType: string;
  brixValue: number | null;
  phValue: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  assignedBatchId: string | null;
  draft: {
    id: string;
    date: string | null;
    status: string;
  };
  collectionCenter: {
    id: string;
    name: string;
    location: string | null;
  };
};

export type ProcessingBatchDto = {
  id: string;
  batchNumber: string;
  scheduledDate: string | null;
  productType: string;
  status: string;
  notes?: string | null;
  createdBy?: string;
  createdAt: string | null;
  updatedAt: string | null;
  bucketCount: number;
  totalQuantity: number;
  bucketIds?: string[];
};

export type PackagingBatchDto = {
  id: string;
  packagingId: string;
  processingBatchId: string;
  batchNumber: string;
  productType: string;
  scheduledDate: string | null;
  packagingStatus: string;
  processingStatus: string;
  startedAt: string | null;
  updatedAt: string | null;
  bucketCount: number;
  totalQuantity: number;
};

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.loadToken();
  }

  private loadToken() {
    const auth = localStorage.getItem('auth');
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        this.token = parsed.token;
      } catch {
        this.token = null;
      }
    } else {
      this.token = null;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    // The auth system handles localStorage, we just update our internal state
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Refresh token from localStorage on each request
    this.loadToken();
    
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }


    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errorJson = await response.json();
        if (errorJson && typeof errorJson === 'object') {
          message = errorJson.error || message;
        }
      } catch {
        const errorText = await response.text().catch(() => '');
        if (errorText) {
          message = errorText;
        }
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return undefined as T;
    }

    return response.json();
  }

  // Authentication
  async login(credentials: { userId: string; password: string }) {
    const response = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(response.token);
    return response;
  }

  async logout() {
    this.setToken(null);
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  // Field Collection API
  async getDrafts(params?: { productType?: string; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.productType) searchParams.append('productType', params.productType);
    if (params?.status) searchParams.append('status', params.status);
    
    const queryString = searchParams.toString();
    const endpoint = `/field-collection/drafts${queryString ? `?${queryString}` : ''}`;
    
    return this.request<any[]>(endpoint);
  }

  async getDraft(draftId: string) {
    return this.request<any>(`/field-collection/drafts/${draftId}`);
  }

  async createDraft(data: { productType: 'sap' | 'treacle'; date?: string }) {
    return this.request<any>('/field-collection/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDraft(draftId: string, data: { status?: 'draft' | 'submitted' | 'completed' }) {
    return this.request<any>(`/field-collection/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDraft(draftId: string) {
    return this.request<any>(`/field-collection/drafts/${draftId}`, {
      method: 'DELETE',
    });
  }

  async submitDraft(draftId: string) {
    return this.request<any>(`/field-collection/drafts/${draftId}/submit`, {
      method: 'POST',
    });
  }

  async reopenDraft(draftId: string) {
    return this.request<any>(`/field-collection/drafts/${draftId}/reopen`, {
      method: 'POST',
    });
  }

  async submitCenter(draftId: string, centerId: string) {
    return this.request<any>(`/field-collection/drafts/${draftId}/centers/${centerId}/submit`, {
      method: 'POST',
    });
  }

  async reopenCenter(draftId: string, centerId: string) {
    return this.request<any>(`/field-collection/drafts/${draftId}/centers/${centerId}/reopen`, {
      method: 'POST',
    });
  }

  async getCompletedCenters(draftId: string) {
    return this.request<any[]>(`/field-collection/drafts/${draftId}/completed-centers`);
  }

  async getBuckets(draftId: string, centerId: string) {
    return this.request<any[]>(`/field-collection/drafts/${draftId}/centers/${centerId}/buckets`);
  }

  async createBucket(data: {
    draftId: string;
    collectionCenterId: string;
    productType: 'sap' | 'treacle';
    brixValue?: number;
    phValue?: number;
    quantity: number;
    qrCode?: string;
    farmerId?: string;
    farmerName?: string;
    collectionTime?: string;
  }) {
    return this.request<any>('/field-collection/buckets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBucket(bucketId: string, data: {
    brixValue?: number;
    phValue?: number;
    quantity?: number;
    qrCode?: string;
    farmerId?: string;
    farmerName?: string;
    collectionTime?: string;
  }) {
    return this.request<any>(`/field-collection/buckets/${bucketId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBucket(bucketId: string) {
    return this.request<any>(`/field-collection/buckets/${bucketId}`, {
      method: 'DELETE',
    });
  }

  async getCollectionCenters() {
    return this.request<any[]>('/field-collection/centers');
  }

  // Processing API
  async getProcessingBuckets(params?: { status?: string; forBatch?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.forBatch) searchParams.append('forBatch', params.forBatch);
    const query = searchParams.toString();
    const endpoint = `/processing/buckets${query ? `?${query}` : ''}`;
    return this.request<{ buckets: ProcessingBucketDto[] }>(endpoint);
  }

  async getProcessingBatches() {
    return this.request<{ batches: ProcessingBatchDto[] }>(`/processing/batches`);
  }

  async createProcessingBatch(payload?: { scheduledDate?: string; productType?: string; notes?: string }) {
    return this.request<ProcessingBatchDto>(`/processing/batches`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    });
  }

  async getProcessingBatch(batchId: string) {
    return this.request<ProcessingBatchDto>(`/processing/batches/${batchId}`);
  }

  async updateProcessingBatch(
    batchId: string,
    payload: { status?: string; scheduledDate?: string; productType?: string; notes?: string }
  ) {
    return this.request<ProcessingBatchDto>(`/processing/batches/${batchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async updateProcessingBatchBuckets(batchId: string, bucketIds: string[]) {
    return this.request<ProcessingBatchDto>(`/processing/batches/${batchId}/buckets`, {
      method: 'PUT',
      body: JSON.stringify({ bucketIds }),
    });
  }

  async submitProcessingBatch(batchId: string) {
    return this.request<ProcessingBatchDto>(`/processing/batches/${batchId}/submit`, {
      method: 'POST',
    });
  }

  async reopenProcessingBatch(batchId: string) {
    return this.request<ProcessingBatchDto>(`/processing/batches/${batchId}/reopen`, {
      method: 'POST',
    });
  }

  // Packaging API
  async getPackagingBatches() {
    return this.request<{ batches: PackagingBatchDto[] }>(`/packaging/batches`);
  }

  // Health check
  async healthCheck() {
    return this.request<{ ok: boolean; service: string; time: string }>('/health');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
