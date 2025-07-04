import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, user, User } from '@angular/fire/auth';
import { Firestore, doc, setDoc, getDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, BehaviorSubject, from, switchMap, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'affiliate' | 'customer';
  contactInfo?: any;
  paymentPreferences?: any;
  createdAt: any;
  updatedAt: any;
  isActive: boolean;
}

export interface AffiliateProfile {
  userId: string;
  email: string;
  businessName: string;
  website: string;
  socialMediaProfiles: string[];
  audienceSize: number;
  promotionalChannels: string[];
  commissionRate: number;
  totalEarnings: number;
  totalReferrals: number;
  totalConversions: number;
  payoutThreshold: number;
  isActive: boolean;
  approvedAt: any;
  approvedBy: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  private affiliateProfileSubject = new BehaviorSubject<AffiliateProfile | null>(null);

  public currentUser$ = this.currentUserSubject.asObservable();
  public userProfile$ = this.userProfileSubject.asObservable();
  public affiliateProfile$ = this.affiliateProfileSubject.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private functions: Functions
  ) {
    // Subscribe to auth state changes
    user(this.auth).subscribe(user => {
      this.currentUserSubject.next(user);
      if (user) {
        this.loadUserProfile(user.uid);
      } else {
        this.userProfileSubject.next(null);
        this.affiliateProfileSubject.next(null);
      }
    });
  }

  // Authentication methods
  async signIn(email: string, password: string): Promise<User> {
    try {
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      return credential.user;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  async signUp(email: string, password: string, displayName: string, role: string = 'customer'): Promise<User> {
    try {
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Create user profile
      await this.createUserProfile(credential.user.uid, {
        uid: credential.user.uid,
        email: email,
        displayName: displayName,
        role: role as any,
        contactInfo: {},
        paymentPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      });

      return credential.user;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Profile management
  private async loadUserProfile(uid: string): Promise<void> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', uid));
      if (userDoc.exists()) {
        const profile = userDoc.data() as UserProfile;
        this.userProfileSubject.next(profile);
        
        // Load affiliate profile if user is an affiliate
        if (profile.role === 'affiliate') {
          this.loadAffiliateProfile(uid);
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  private async loadAffiliateProfile(uid: string): Promise<void> {
    try {
      const affiliateDoc = await getDoc(doc(this.firestore, 'affiliates', uid));
      if (affiliateDoc.exists()) {
        const profile = affiliateDoc.data() as AffiliateProfile;
        this.affiliateProfileSubject.next(profile);
      }
    } catch (error) {
      console.error('Error loading affiliate profile:', error);
    }
  }

  private async createUserProfile(uid: string, profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(this.firestore, 'users', uid), profile);
      this.userProfileSubject.next(profile);
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await setDoc(doc(this.firestore, 'users', currentUser.uid), updateData, { merge: true });
      
      // Update local state
      const currentProfile = this.userProfileSubject.value;
      if (currentProfile) {
        this.userProfileSubject.next({ ...currentProfile, ...updateData });
      }
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Affiliate application
  async applyForAffiliate(applicationData: any): Promise<void> {
    const currentUser = this.currentUserSubject.value;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const applyFunction = httpsCallable(this.functions, 'api-affiliates-apply');
      await applyFunction(applicationData);
    } catch (error) {
      console.error('Error applying for affiliate:', error);
      throw error;
    }
  }

  // Utility methods
  get isAuthenticated(): boolean {
    return this.currentUserSubject.value !== null;
  }

  get isAdmin(): boolean {
    const profile = this.userProfileSubject.value;
    return profile?.role === 'admin';
  }

  get isAffiliate(): boolean {
    const profile = this.userProfileSubject.value;
    return profile?.role === 'affiliate';
  }

  get currentUserProfile(): UserProfile | null {
    return this.userProfileSubject.value;
  }

  get currentAffiliateProfile(): AffiliateProfile | null {
    return this.affiliateProfileSubject.value;
  }

  async getAuthToken(): Promise<string | null> {
    const user = this.currentUserSubject.value;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  }
}

