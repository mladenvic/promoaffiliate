import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

export interface Product {
  id?: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrls: string[];
  commissionRate: number;
  commissionType: 'percentage' | 'flat';
  isActive: boolean;
  externalUrl: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface ReferralLink {
  id?: string;
  affiliateId: string;
  productId: string;
  referralCode: string;
  campaignName: string;
  customParameters: any;
  clickCount: number;
  conversionCount: number;
  totalEarnings: number;
  isActive: boolean;
  createdAt?: any;
  lastUsed?: any;
  product?: Product;
}

export interface Commission {
  id?: string;
  affiliateId: string;
  referralId: string;
  productId: string;
  orderId: string;
  orderValue: number;
  commissionAmount: number;
  commissionRate: number;
  commissionType: string;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  createdAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
  reviewNotes?: string;
  product?: Product;
  referral?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private functions: Functions,
    private authService: AuthService
  ) {}

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.authService.getAuthToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Product Management
  getProducts(params?: any): Observable<{ products: Product[], page: number, limit: number }> {
    return from(this.makeHttpRequest('GET', '/api/products', null, params));
  }

  getProduct(id: string): Observable<Product> {
    return from(this.makeHttpRequest('GET', `/api/products/${id}`));
  }

  createProduct(product: Omit<Product, 'id'>): Observable<{ message: string, productId: string, product: Product }> {
    return from(this.makeHttpRequest('POST', '/api/products', product));
  }

  updateProduct(id: string, updates: Partial<Product>): Observable<{ message: string }> {
    return from(this.makeHttpRequest('PUT', `/api/products/${id}`, updates));
  }

  deleteProduct(id: string): Observable<{ message: string }> {
    return from(this.makeHttpRequest('DELETE', `/api/products/${id}`));
  }

  // Referral Management
  generateReferralLink(data: { productId: string, campaignName?: string, customParameters?: any }): Observable<ReferralLink> {
    const generateFunction = httpsCallable(this.functions, 'generateReferralLink');
    return from(generateFunction(data).then(result => result.data as ReferralLink));
  }

  getAffiliateReferralLinks(params?: any): Observable<{ referralLinks: ReferralLink[], page: number, limit: number, hasMore: boolean }> {
    const getLinksFunction = httpsCallable(this.functions, 'getAffiliateReferralLinks');
    return from(getLinksFunction(params || {}).then(result => result.data as any));
  }

  getReferralAnalytics(params?: any): Observable<any> {
    const getAnalyticsFunction = httpsCallable(this.functions, 'getReferralAnalytics');
    return from(getAnalyticsFunction(params || {}).then(result => result.data));
  }

  // Commission Management
  getAffiliateCommissions(params?: any): Observable<{ commissions: Commission[], page: number, limit: number, hasMore: boolean }> {
    const getCommissionsFunction = httpsCallable(this.functions, 'getAffiliateCommissions');
    return from(getCommissionsFunction(params || {}).then(result => result.data as any));
  }

  getCommissionSummary(params?: any): Observable<any> {
    const getSummaryFunction = httpsCallable(this.functions, 'getCommissionSummary');
    return from(getSummaryFunction(params || {}).then(result => result.data));
  }

  // Admin Functions
  getAllCommissions(params?: any): Observable<{ commissions: Commission[], page: number, limit: number, hasMore: boolean }> {
    const getAllCommissionsFunction = httpsCallable(this.functions, 'getAllCommissions');
    return from(getAllCommissionsFunction(params || {}).then(result => result.data as any));
  }

  reviewCommission(commissionId: string, status: 'approved' | 'rejected', reviewNotes?: string): Observable<{ message: string }> {
    const reviewFunction = httpsCallable(this.functions, 'reviewCommission');
    return from(reviewFunction({ commissionId, status, reviewNotes }).then(result => result.data as any));
  }

  bulkApproveCommissions(commissionIds: string[], reviewNotes?: string): Observable<{ message: string, processedCount: number }> {
    const bulkApproveFunction = httpsCallable(this.functions, 'bulkApproveCommissions');
    return from(bulkApproveFunction({ commissionIds, reviewNotes }).then(result => result.data as any));
  }

  getCommissionStatistics(params?: any): Observable<any> {
    const getStatsFunction = httpsCallable(this.functions, 'getCommissionStatistics');
    return from(getStatsFunction(params || {}).then(result => result.data));
  }

  // Affiliate Applications
  getAffiliateApplications(params?: any): Observable<any> {
    return from(this.makeHttpRequest('GET', '/api/affiliates/applications', null, params));
  }

  reviewAffiliateApplication(applicationId: string, status: 'approved' | 'rejected', reviewNotes?: string): Observable<{ message: string }> {
    return from(this.makeHttpRequest('PUT', `/api/affiliates/applications/${applicationId}/review`, { status, reviewNotes }));
  }

  // Utility method for HTTP requests
  private async makeHttpRequest(method: string, endpoint: string, body?: any, params?: any): Promise<any> {
    const headers = await this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint}`;
    
    let options: any = { headers };
    
    if (params) {
      options.params = params;
    }

    switch (method.toLowerCase()) {
      case 'get':
        return this.http.get(url, options).toPromise();
      case 'post':
        return this.http.post(url, body, options).toPromise();
      case 'put':
        return this.http.put(url, body, options).toPromise();
      case 'delete':
        return this.http.delete(url, options).toPromise();
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }
}

