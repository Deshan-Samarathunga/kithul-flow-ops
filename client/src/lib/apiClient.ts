// API Client for Kithul Flow Application
const API_BASE_URL = 'http://localhost:5000/api';

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
      const errorData = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
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

  // Health check
  async healthCheck() {
    return this.request<{ ok: boolean; service: string; time: string }>('/health');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
