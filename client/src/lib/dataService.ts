import { apiClient } from './apiClient';

// Data service to replace mock data with real API calls
export class DataService {
  // Drafts
  static async getDrafts(productType?: 'sap' | 'treacle', status?: string) {
    try {
      return await apiClient.getDrafts({ productType, status });
    } catch (error) {
      console.error('Error fetching drafts:', error);
      throw error;
    }
  }

  static async getDraft(draftId: string) {
    try {
      return await apiClient.getDraft(draftId);
    } catch (error) {
      console.error('Error fetching draft:', error);
      throw error;
    }
  }

  static async createDraft(date?: string) {
    try {
      const payload: { date?: string } = {};
      if (date) {
        payload.date = date;
      }
      return await apiClient.createDraft(payload);
    } catch (error) {
      console.error('Error creating draft:', error);
      throw error;
    }
  }

  static async updateDraft(draftId: string, status: 'draft' | 'submitted' | 'completed') {
    try {
      return await apiClient.updateDraft(draftId, { status });
    } catch (error) {
      console.error('Error updating draft:', error);
      throw error;
    }
  }

  static async deleteDraft(draftId: string) {
    try {
      return await apiClient.deleteDraft(draftId);
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  }

  static async submitDraft(draftId: string) {
    try {
      return await apiClient.submitDraft(draftId);
    } catch (error) {
      console.error('Error submitting draft:', error);
      throw error;
    }
  }

  static async reopenDraft(draftId: string) {
    try {
      return await apiClient.reopenDraft(draftId);
    } catch (error) {
      console.error('Error reopening draft:', error);
      throw error;
    }
  }

  static async submitCenter(draftId: string, centerId: string) {
    try {
      return await apiClient.submitCenter(draftId, centerId);
    } catch (error) {
      console.error('Error submitting center:', error);
      throw error;
    }
  }

  static async reopenCenter(draftId: string, centerId: string) {
    try {
      return await apiClient.reopenCenter(draftId, centerId);
    } catch (error) {
      console.error('Error reopening center:', error);
      throw error;
    }
  }

  static async getCompletedCenters(draftId: string) {
    try {
      return await apiClient.getCompletedCenters(draftId);
    } catch (error) {
      console.error('Error fetching completed centers:', error);
      throw error;
    }
  }

  // Buckets
  static async getBuckets(draftId: string, centerId: string) {
    try {
      return await apiClient.getBuckets(draftId, centerId);
    } catch (error) {
      console.error('Error fetching buckets:', error);
      throw error;
    }
  }

  static async createBucket(data: {
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
    try {
      return await apiClient.createBucket(data);
    } catch (error) {
      console.error('Error creating bucket:', error);
      throw error;
    }
  }

  static async updateBucket(bucketId: string, data: {
    brixValue?: number;
    phValue?: number;
    quantity?: number;
    qrCode?: string;
    farmerId?: string;
    farmerName?: string;
    collectionTime?: string;
  }) {
    try {
      return await apiClient.updateBucket(bucketId, data);
    } catch (error) {
      console.error('Error updating bucket:', error);
      throw error;
    }
  }

  static async deleteBucket(bucketId: string) {
    try {
      return await apiClient.deleteBucket(bucketId);
    } catch (error) {
      console.error('Error deleting bucket:', error);
      throw error;
    }
  }

  // Collection Centers
  static async getCollectionCenters() {
    try {
      return await apiClient.getCollectionCenters();
    } catch (error) {
      console.error('Error fetching collection centers:', error);
      throw error;
    }
  }

  static async getProcessingBuckets(status: string = 'active', batchId?: string) {
    try {
      const response = await apiClient.getProcessingBuckets({ status, forBatch: batchId });
      return response.buckets;
    } catch (error) {
      console.error('Error fetching processing buckets:', error);
      throw error;
    }
  }

  static async getProcessingBatches() {
    try {
      const response = await apiClient.getProcessingBatches();
      return response.batches;
    } catch (error) {
      console.error('Error fetching processing batches:', error);
      throw error;
    }
  }

  static async createProcessingBatch(data?: { scheduledDate?: string; productType?: string; notes?: string }) {
    try {
      return await apiClient.createProcessingBatch(data);
    } catch (error) {
      console.error('Error creating processing batch:', error);
      throw error;
    }
  }

  static async getProcessingBatch(batchId: string) {
    try {
      return await apiClient.getProcessingBatch(batchId);
    } catch (error) {
      console.error('Error fetching processing batch:', error);
      throw error;
    }
  }

  static async updateProcessingBatch(
    batchId: string,
    data: {
      status?: string;
      scheduledDate?: string;
      productType?: string;
      notes?: string;
      totalSapOutput?: number | null;
      gasUsedKg?: number | null;
    }
  ) {
    try {
      return await apiClient.updateProcessingBatch(batchId, data);
    } catch (error) {
      console.error('Error updating processing batch:', error);
      throw error;
    }
  }

  static async updateProcessingBatchBuckets(batchId: string, bucketIds: string[]) {
    try {
      return await apiClient.updateProcessingBatchBuckets(batchId, bucketIds);
    } catch (error) {
      console.error('Error updating processing batch buckets:', error);
      throw error;
    }
  }

  static async submitProcessingBatch(batchId: string) {
    try {
      return await apiClient.submitProcessingBatch(batchId);
    } catch (error) {
      console.error('Error submitting processing batch:', error);
      throw error;
    }
  }

  static async reopenProcessingBatch(batchId: string) {
    try {
      return await apiClient.reopenProcessingBatch(batchId);
    } catch (error) {
      console.error('Error reopening processing batch:', error);
      throw error;
    }
  }

  static async deleteProcessingBatch(batchId: string) {
    try {
      await apiClient.deleteProcessingBatch(batchId);
    } catch (error) {
      console.error('Error deleting processing batch:', error);
      throw error;
    }
  }

  static async getPackagingBatches() {
    try {
      const response = await apiClient.getPackagingBatches();
      return response.batches;
    } catch (error) {
      console.error('Error fetching packaging batches:', error);
      throw error;
    }
  }

  static async getPackagingBatch(packagingId: string) {
    try {
      return await apiClient.getPackagingBatch(packagingId);
    } catch (error) {
      console.error('Error fetching packaging batch:', error);
      throw error;
    }
  }

  static async getEligibleProcessingBatchesForPackaging(productType?: string) {
    try {
      const response = await apiClient.getEligibleProcessingBatchesForPackaging({ productType });
      return response.batches;
    } catch (error) {
      console.error('Error fetching eligible processing batches for packaging:', error);
      throw error;
    }
  }

  static async createPackagingBatch(processingBatchId: string) {
    try {
      return await apiClient.createPackagingBatch({ processingBatchId });
    } catch (error) {
      console.error('Error creating packaging batch:', error);
      throw error;
    }
  }

  static async deletePackagingBatch(packagingId: string) {
    try {
      await apiClient.deletePackagingBatch(packagingId);
    } catch (error) {
      console.error('Error deleting packaging batch:', error);
      throw error;
    }
  }

  static async updatePackagingBatch(
    packagingId: string,
    data: {
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
    try {
      return await apiClient.updatePackagingBatch(packagingId, data);
    } catch (error) {
      console.error('Error updating packaging batch:', error);
      throw error;
    }
  }

  static async getLabelingBatches() {
    try {
      const response = await apiClient.getLabelingBatches();
      return response.batches;
    } catch (error) {
      console.error('Error fetching labeling batches:', error);
      throw error;
    }
  }

  static async getEligiblePackagingBatchesForLabeling(productType?: string) {
    try {
      const response = await apiClient.getEligiblePackagingBatchesForLabeling({ productType });
      return response.batches;
    } catch (error) {
      console.error('Error fetching eligible packaging batches for labeling:', error);
      throw error;
    }
  }

  static async createLabelingBatch(packagingId: string) {
    try {
      return await apiClient.createLabelingBatch({ packagingId });
    } catch (error) {
      console.error('Error creating labeling batch:', error);
      throw error;
    }
  }

  static async deleteLabelingBatch(packagingId: string) {
    try {
      await apiClient.deleteLabelingBatch(packagingId);
    } catch (error) {
      console.error('Error deleting labeling batch:', error);
      throw error;
    }
  }

  static async updateLabelingBatch(
    packagingId: string,
    data: {
      status?: string;
      notes?: string;
      stickerQuantity?: number | null;
      shrinkSleeveQuantity?: number | null;
      neckTagQuantity?: number | null;
      corrugatedCartonQuantity?: number | null;
    }
  ) {
    try {
      return await apiClient.updateLabelingBatch(packagingId, data);
    } catch (error) {
      console.error('Error updating labeling batch:', error);
      throw error;
    }
  }

  static async getDailyProductionReport(date?: string) {
    try {
      return await apiClient.getDailyProductionReport({ date });
    } catch (error) {
      console.error('Error generating daily production report:', error);
      throw error;
    }
  }

  // Health check
  static async healthCheck() {
    try {
      return await apiClient.healthCheck();
    } catch (error) {
      console.error('Error checking API health:', error);
      throw error;
    }
  }
}

export default DataService;
