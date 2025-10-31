// API Client for Kithul Flow Application
const rawBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5000";
const normalizedBase = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
const API_BASE_URL = `${normalizedBase}/api`;

type JsonRecord = Record<string, unknown>;

export type ProcessingCanDto = {
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
  canCount: number;
  totalQuantity: number;
  totalSapOutput?: number | null;
  gasUsedKg?: number | null;
  canIds?: string[];
};

export type EligibleProcessingBatchDto = {
  processingBatchId: string;
  batchNumber: string;
  productType: string;
  scheduledDate: string | null;
  totalSapOutput: number | null;
  totalQuantity: number;
  canCount: number;
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
  canCount: number;
  totalQuantity: number;
  totalSapOutput?: number | null;
  finishedQuantity?: number | null;
  notes?: string | null;
  bottleQuantity?: number | null;
  lidQuantity?: number | null;
  alufoilQuantity?: number | null;
  vacuumBagQuantity?: number | null;
  parchmentPaperQuantity?: number | null;
};

export type LabelingBatchDto = {
  packagingId: string;
  labelingId?: string | null;
  processingBatchId: string;
  batchNumber: string;
  productType: string;
  scheduledDate: string | null;
  packagingStatus: string;
  labelingStatus: string;
  labelingNotes?: string | null;
  processingStatus: string;
  startedAt: string | null;
  updatedAt: string | null;
  canCount: number;
  totalQuantity: number;
  totalSapOutput?: number | null;
  finishedQuantity?: number | null;
  stickerQuantity?: number | null;
  shrinkSleeveQuantity?: number | null;
  neckTagQuantity?: number | null;
  corrugatedCartonQuantity?: number | null;
};

export type EligiblePackagingBatchDto = {
  packagingId: string;
  batchNumber: string;
  productType: string;
  scheduledDate: string | null;
  finishedQuantity: number | null;
  totalSapOutput: number | null;
  totalQuantity: number;
  canCount: number;
};

export type DailyProductionReport = {
  date: string;
  generatedAt: string;
  perProduct: Record<"treacle" | "jaggery", {
    product: "treacle" | "jaggery";
    fieldCollection: {
      drafts: number;
      cans: number;
      quantity: number;
      draftIds: string[];
    };
    processing: {
      totalBatches: number;
      completedBatches: number;
      totalOutput: number;
      totalInput: number;
      totalGasUsedKg: number;
    };
    packaging: {
      totalBatches: number;
      completedBatches: number;
      finishedQuantity: number;
      totalBottleQuantity: number;
      totalLidQuantity: number;
      totalAlufoilQuantity: number;
      totalVacuumBagQuantity: number;
      totalParchmentPaperQuantity: number;
    };
    labeling: {
      totalBatches: number;
      completedBatches: number;
      totalStickerQuantity: number;
      totalShrinkSleeveQuantity: number;
      totalNeckTagQuantity: number;
      totalCorrugatedCartonQuantity: number;
    };
  }>;
  totals: {
    fieldCollection: {
      drafts: number;
      cans: number;
      quantity: number;
      draftIds: string[];
    };
    processing: {
      totalBatches: number;
      completedBatches: number;
      totalOutput: number;
      totalInput: number;
      totalGasUsedKg: number;
    };
    packaging: {
      totalBatches: number;
      completedBatches: number;
      finishedQuantity: number;
      totalBottleQuantity: number;
      totalLidQuantity: number;
      totalAlufoilQuantity: number;
      totalVacuumBagQuantity: number;
      totalParchmentPaperQuantity: number;
    };
    labeling: {
      totalBatches: number;
      completedBatches: number;
      totalStickerQuantity: number;
      totalShrinkSleeveQuantity: number;
      totalNeckTagQuantity: number;
      totalCorrugatedCartonQuantity: number;
    };
  };
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
    const response = await this.request<{ token: string; user: JsonRecord }>('/auth/login', {
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
    return this.request<JsonRecord>('/auth/me');
  }

  // Field Collection API
  async getDrafts(params?: { productType?: string; status?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.productType) searchParams.append('productType', params.productType);
    if (params?.status) searchParams.append('status', params.status);
    
    const queryString = searchParams.toString();
    const endpoint = `/field-collection/drafts${queryString ? `?${queryString}` : ''}`;
    
    return this.request<JsonRecord[]>(endpoint);
  }

  async getDraft(draftId: string) {
    return this.request<JsonRecord>(`/field-collection/drafts/${draftId}`);
  }

  async createDraft(data: { date?: string } = {}) {
    return this.request<JsonRecord>('/field-collection/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDraft(draftId: string, data: { status?: 'draft' | 'submitted' | 'completed' }) {
    return this.request<JsonRecord>(`/field-collection/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDraft(draftId: string) {
    return this.request<undefined>(`/field-collection/drafts/${draftId}`, {
      method: 'DELETE',
    });
  }

  async submitDraft(draftId: string) {
    return this.request<JsonRecord>(`/field-collection/drafts/${draftId}/submit`, {
      method: 'POST',
    });
  }

  async reopenDraft(draftId: string) {
    return this.request<JsonRecord>(`/field-collection/drafts/${draftId}/reopen`, {
      method: 'POST',
    });
  }

  async submitCenter(draftId: string, centerId: string) {
    return this.request<JsonRecord>(`/field-collection/drafts/${draftId}/centers/${centerId}/submit`, {
      method: 'POST',
    });
  }

  async reopenCenter(draftId: string, centerId: string) {
    return this.request<JsonRecord>(`/field-collection/drafts/${draftId}/centers/${centerId}/reopen`, {
      method: 'POST',
    });
  }

  async getCompletedCenters(draftId: string) {
    return this.request<JsonRecord[]>(`/field-collection/drafts/${draftId}/completed-centers`);
  }

  async getCans(draftId: string, centerId: string) {
    return this.request<JsonRecord[]>(`/field-collection/drafts/${draftId}/centers/${centerId}/cans`);
  }

  async createCan(data: {
    draftId: string;
    collectionCenterId: string;
    productType: 'sap' | 'treacle';
    canId?: string;
    serialNumber?: string; // 8 digits
    brixValue?: number;
    phValue?: number;
    quantity: number;
    qrCode?: string;
    farmerId?: string;
    farmerName?: string;
    collectionTime?: string;
  }) {
    return this.request<JsonRecord>('/field-collection/cans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCan(canId: string, data: {
    brixValue?: number;
    phValue?: number;
    quantity?: number;
    qrCode?: string;
    farmerId?: string;
    farmerName?: string;
    collectionTime?: string;
  }) {
    return this.request<JsonRecord>(`/field-collection/cans/${canId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCan(canId: string) {
    return this.request<undefined>(`/field-collection/cans/${canId}`, {
      method: 'DELETE',
    });
  }

  async getCollectionCenters() {
    return this.request<JsonRecord[]>('/field-collection/centers');
  }

  // Processing API
  async getProcessingCans(params?: { status?: string; forBatch?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.forBatch) searchParams.append('forBatch', params.forBatch);
    const query = searchParams.toString();
    const endpoint = `/processing/cans${query ? `?${query}` : ''}`;
    return this.request<{ cans: ProcessingCanDto[] }>(endpoint);
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
    payload: {
      status?: string;
      scheduledDate?: string;
      productType?: string;
      notes?: string;
      totalSapOutput?: number | null;
      gasUsedKg?: number | null;
    }
  ) {
    return this.request<ProcessingBatchDto>(`/processing/batches/${batchId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async updateProcessingBatchCans(batchId: string, canIds: string[]) {
    return this.request<ProcessingBatchDto>(`/processing/batches/${batchId}/cans`, {
      method: 'PUT',
      body: JSON.stringify({ canIds }),
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

  async deleteProcessingBatch(batchId: string) {
    return this.request<void>(`/processing/batches/${batchId}`, {
      method: 'DELETE',
    });
  }

  // Packaging API
  async getPackagingBatches() {
    return this.request<{ batches: PackagingBatchDto[] }>(`/packaging/batches`);
  }

  async getPackagingBatch(packagingId: string) {
    return this.request<PackagingBatchDto>(`/packaging/batches/${packagingId}`);
  }

  async getEligibleProcessingBatchesForPackaging(params?: { productType?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.productType) {
      searchParams.append("productType", params.productType);
    }
    const query = searchParams.toString();
    const endpoint = `/packaging/batches/available-processing${query ? `?${query}` : ""}`;
    return this.request<{ batches: EligibleProcessingBatchDto[] }>(endpoint);
  }

  async createPackagingBatch(payload: { processingBatchId: string }) {
    return this.request<PackagingBatchDto>(`/packaging/batches`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deletePackagingBatch(packagingId: string) {
    return this.request<void>(`/packaging/batches/${packagingId}`, {
      method: "DELETE",
    });
  }

  async updatePackagingBatch(
    packagingId: string,
    payload: {
      status?: string;
      notes?: string;
      finishedQuantity?: number | null;
      bottleQuantity?: number | null;
      lidQuantity?: number | null;
      alufoilQuantity?: number | null;
      vacuumBagQuantity?: number | null;
      parchmentPaperQuantity?: number | null;
    }
  ) {
    return this.request<PackagingBatchDto>(`/packaging/batches/${packagingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Labeling API
  async getLabelingBatches() {
    return this.request<{ batches: LabelingBatchDto[] }>(`/labeling/batches`);
  }

  async getLabelingBatch(packagingId: string) {
    return this.request<LabelingBatchDto>(`/labeling/batches/${packagingId}`);
  }

  async getEligiblePackagingBatchesForLabeling(params?: { productType?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.productType) {
      searchParams.append("productType", params.productType);
    }
    const query = searchParams.toString();
    const endpoint = `/labeling/available-packaging${query ? `?${query}` : ""}`;
    return this.request<{ batches: EligiblePackagingBatchDto[] }>(endpoint);
  }

  async createLabelingBatch(payload: { packagingId: string }) {
    return this.request<LabelingBatchDto>(`/labeling/batches`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deleteLabelingBatch(packagingId: string) {
    return this.request<void>(`/labeling/batches/${packagingId}`, {
      method: "DELETE",
    });
  }

  async getDailyProductionReport(params?: { date?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.date) {
      searchParams.append("date", params.date);
    }
    const query = searchParams.toString();
    const endpoint = `/reports/daily${query ? `?${query}` : ""}`;
    return this.request<DailyProductionReport>(endpoint);
  }

  async updateLabelingBatch(
    packagingId: string,
    payload: {
      status?: string;
      notes?: string;
      stickerQuantity?: number | null;
      shrinkSleeveQuantity?: number | null;
      neckTagQuantity?: number | null;
      corrugatedCartonQuantity?: number | null;
    }
  ) {
    return this.request<LabelingBatchDto>(`/labeling/batches/${packagingId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Health check
  async healthCheck() {
    return this.request<{ ok: boolean; service: string; time: string }>('/health');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
