const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const express = require('express');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Import function modules
const referralFunctions = require('./referrals');
const commissionFunctions = require('./commissions');

// Export all functions
exports.generateReferralLink = referralFunctions.generateReferralLink;
exports.getAffiliateReferralLinks = referralFunctions.getAffiliateReferralLinks;
exports.trackReferralByCode = referralFunctions.trackReferralByCode;
exports.getReferralAnalytics = referralFunctions.getReferralAnalytics;

exports.getAffiliateCommissions = commissionFunctions.getAffiliateCommissions;
exports.getCommissionSummary = commissionFunctions.getCommissionSummary;
exports.getAllCommissions = commissionFunctions.getAllCommissions;
exports.reviewCommission = commissionFunctions.reviewCommission;
exports.bulkApproveCommissions = commissionFunctions.bulkApproveCommissions;
exports.getCommissionStatistics = commissionFunctions.getCommissionStatistics;
exports.autoApproveCommissions = commissionFunctions.autoApproveCommissions;

// Create Express app
const app = express();
app.use(cors);
app.use(express.json());

// Middleware to verify authentication
const verifyAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to verify admin role
const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user.admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(403).json({ error: 'Admin access required' });
  }
};

// User Management Endpoints

// Create user profile
app.post('/api/users/profile', verifyAuth, async (req, res) => {
  try {
    const { displayName, role, contactInfo, paymentPreferences } = req.body;
    const userId = req.user.uid;
    
    const userProfile = {
      uid: userId,
      email: req.user.email,
      displayName: displayName || '',
      role: role || 'customer',
      contactInfo: contactInfo || {},
      paymentPreferences: paymentPreferences || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true
    };
    
    await db.collection('users').doc(userId).set(userProfile);
    
    // Set custom claims for role-based access
    await auth.setCustomUserClaims(userId, { 
      role: userProfile.role,
      admin: userProfile.role === 'admin',
      affiliate: userProfile.role === 'affiliate'
    });
    
    res.status(201).json({ message: 'Profile created successfully', profile: userProfile });
  } catch (error) {
    console.error('Profile creation error:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

// Get user profile
app.get('/api/users/profile', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(userDoc.data());
  } catch (error) {
    console.error('Profile retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// Update user profile
app.put('/api/users/profile', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(userId).update(updateData);
    
    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Product Management Endpoints

// Create product (Admin only)
app.post('/api/products', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      imageUrls,
      commissionRate,
      commissionType,
      isActive,
      externalUrl
    } = req.body;
    
    const product = {
      title,
      description,
      price: parseFloat(price),
      category,
      imageUrls: imageUrls || [],
      commissionRate: parseFloat(commissionRate),
      commissionType: commissionType || 'percentage',
      isActive: isActive !== false,
      externalUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user.uid
    };
    
    const productRef = await db.collection('products').add(product);
    
    res.status(201).json({ 
      message: 'Product created successfully', 
      productId: productRef.id,
      product: { id: productRef.id, ...product }
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Get all products
app.get('/api/products', verifyAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, category, isActive = true } = req.query;
    const offset = (page - 1) * limit;
    
    let query = db.collection('products');
    
    if (category) {
      query = query.where('category', '==', category);
    }
    
    if (isActive !== undefined) {
      query = query.where('isActive', '==', isActive === 'true');
    }
    
    query = query.orderBy('createdAt', 'desc').limit(parseInt(limit)).offset(offset);
    
    const snapshot = await query.get();
    const products = [];
    
    snapshot.forEach(doc => {
      products.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ products, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Products retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve products' });
  }
});

// Get single product
app.get('/api/products/:id', verifyAuth, async (req, res) => {
  try {
    const productId = req.params.id;
    const productDoc = await db.collection('products').doc(productId).get();
    
    if (!productDoc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ id: productDoc.id, ...productDoc.data() });
  } catch (error) {
    console.error('Product retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve product' });
  }
});

// Update product (Admin only)
app.put('/api/products/:id', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('products').doc(productId).update(updateData);
    
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Product update error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (Admin only)
app.delete('/api/products/:id', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    await db.collection('products').doc(productId).delete();
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Product deletion error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Affiliate Management Endpoints

// Apply for affiliate status
app.post('/api/affiliates/apply', verifyAuth, async (req, res) => {
  try {
    const {
      businessName,
      website,
      socialMediaProfiles,
      audienceSize,
      promotionalChannels,
      experience,
      reasonForApplying
    } = req.body;
    
    const application = {
      userId: req.user.uid,
      email: req.user.email,
      businessName,
      website,
      socialMediaProfiles: socialMediaProfiles || [],
      audienceSize: parseInt(audienceSize) || 0,
      promotionalChannels: promotionalChannels || [],
      experience,
      reasonForApplying,
      status: 'pending',
      appliedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: ''
    };
    
    const applicationRef = await db.collection('affiliateApplications').add(application);
    
    res.status(201).json({ 
      message: 'Application submitted successfully', 
      applicationId: applicationRef.id 
    });
  } catch (error) {
    console.error('Affiliate application error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get affiliate applications (Admin only)
app.get('/api/affiliates/applications', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = db.collection('affiliateApplications');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    query = query.orderBy('appliedAt', 'desc').limit(parseInt(limit)).offset(offset);
    
    const snapshot = await query.get();
    const applications = [];
    
    snapshot.forEach(doc => {
      applications.push({ id: doc.id, ...doc.data() });
    });
    
    res.json({ applications, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Applications retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve applications' });
  }
});

// Review affiliate application (Admin only)
app.put('/api/affiliates/applications/:id/review', verifyAuth, verifyAdmin, async (req, res) => {
  try {
    const applicationId = req.params.id;
    const { status, reviewNotes } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const applicationDoc = await db.collection('affiliateApplications').doc(applicationId).get();
    if (!applicationDoc.exists) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    const applicationData = applicationDoc.data();
    
    // Update application status
    await db.collection('affiliateApplications').doc(applicationId).update({
      status,
      reviewNotes: reviewNotes || '',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: req.user.uid
    });
    
    // If approved, update user role and create affiliate profile
    if (status === 'approved') {
      await db.collection('users').doc(applicationData.userId).update({
        role: 'affiliate',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Set custom claims
      await auth.setCustomUserClaims(applicationData.userId, { 
        role: 'affiliate',
        affiliate: true,
        admin: false
      });
      
      // Create affiliate profile
      const affiliateProfile = {
        userId: applicationData.userId,
        email: applicationData.email,
        businessName: applicationData.businessName,
        website: applicationData.website,
        socialMediaProfiles: applicationData.socialMediaProfiles,
        audienceSize: applicationData.audienceSize,
        promotionalChannels: applicationData.promotionalChannels,
        commissionRate: 0.05, // Default 5% commission
        totalEarnings: 0,
        totalReferrals: 0,
        totalConversions: 0,
        payoutThreshold: 50, // Minimum $50 for payout
        isActive: true,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: req.user.uid
      };
      
      await db.collection('affiliates').doc(applicationData.userId).set(affiliateProfile);
    }
    
    res.json({ message: `Application ${status} successfully` });
  } catch (error) {
    console.error('Application review error:', error);
    res.status(500).json({ error: 'Failed to review application' });
  }
});

// Get affiliate profile
app.get('/api/affiliates/profile', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const affiliateDoc = await db.collection('affiliates').doc(userId).get();
    
    if (!affiliateDoc.exists) {
      return res.status(404).json({ error: 'Affiliate profile not found' });
    }
    
    res.json(affiliateDoc.data());
  } catch (error) {
    console.error('Affiliate profile retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve affiliate profile' });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// Additional Firebase Functions for specific operations

// Function to handle referral link clicks
exports.trackReferral = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { affiliateId, productId, customerId } = req.query;
      
      if (!affiliateId || !productId) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Create referral record
      const referral = {
        affiliateId,
        productId,
        customerId: customerId || null,
        clickedAt: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referer'),
        status: 'clicked',
        conversionValue: 0,
        commissionAmount: 0
      };
      
      const referralRef = await db.collection('referrals').add(referral);
      
      // Get product details for redirect
      const productDoc = await db.collection('products').doc(productId).get();
      if (!productDoc.exists) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      const product = productDoc.data();
      
      // Redirect to external product URL with tracking parameters
      const redirectUrl = new URL(product.externalUrl);
      redirectUrl.searchParams.set('ref', referralRef.id);
      redirectUrl.searchParams.set('affiliate', affiliateId);
      
      res.redirect(302, redirectUrl.toString());
    } catch (error) {
      console.error('Referral tracking error:', error);
      res.status(500).json({ error: 'Failed to track referral' });
    }
  });
});

// Function to handle conversion webhooks
exports.trackConversion = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const { referralId, orderId, orderValue, customerId } = req.body;
      
      if (!referralId || !orderId || !orderValue) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      // Get referral record
      const referralDoc = await db.collection('referrals').doc(referralId).get();
      if (!referralDoc.exists) {
        return res.status(404).json({ error: 'Referral not found' });
      }
      
      const referralData = referralDoc.data();
      
      // Get product and affiliate information
      const [productDoc, affiliateDoc] = await Promise.all([
        db.collection('products').doc(referralData.productId).get(),
        db.collection('affiliates').doc(referralData.affiliateId).get()
      ]);
      
      if (!productDoc.exists || !affiliateDoc.exists) {
        return res.status(404).json({ error: 'Product or affiliate not found' });
      }
      
      const product = productDoc.data();
      const affiliate = affiliateDoc.data();
      
      // Calculate commission
      let commissionAmount = 0;
      if (product.commissionType === 'percentage') {
        commissionAmount = (parseFloat(orderValue) * product.commissionRate) / 100;
      } else {
        commissionAmount = product.commissionRate;
      }
      
      // Update referral with conversion data
      await db.collection('referrals').doc(referralId).update({
        status: 'converted',
        orderId,
        orderValue: parseFloat(orderValue),
        customerId: customerId || referralData.customerId,
        commissionAmount,
        convertedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Create commission record
      const commission = {
        affiliateId: referralData.affiliateId,
        referralId,
        productId: referralData.productId,
        orderId,
        orderValue: parseFloat(orderValue),
        commissionAmount,
        commissionRate: product.commissionRate,
        commissionType: product.commissionType,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await db.collection('commissions').add(commission);
      
      // Update affiliate statistics
      await db.collection('affiliates').doc(referralData.affiliateId).update({
        totalEarnings: admin.firestore.FieldValue.increment(commissionAmount),
        totalConversions: admin.firestore.FieldValue.increment(1)
      });
      
      res.json({ message: 'Conversion tracked successfully', commissionAmount });
    } catch (error) {
      console.error('Conversion tracking error:', error);
      res.status(500).json({ error: 'Failed to track conversion' });
    }
  });
});

