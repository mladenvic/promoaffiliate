const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const crypto = require('crypto');

const db = admin.firestore();

// Generate referral link
exports.generateReferralLink = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    // Verify affiliate status
    if (!context.auth.token.affiliate) {
      throw new functions.https.HttpsError('permission-denied', 'User must be an affiliate');
    }
    
    const { productId, campaignName, customParameters } = data;
    
    if (!productId) {
      throw new functions.https.HttpsError('invalid-argument', 'Product ID is required');
    }
    
    // Verify product exists
    const productDoc = await db.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Product not found');
    }
    
    // Generate unique referral code
    const referralCode = crypto.randomBytes(8).toString('hex');
    
    // Create referral link record
    const referralLink = {
      affiliateId: context.auth.uid,
      productId,
      referralCode,
      campaignName: campaignName || '',
      customParameters: customParameters || {},
      clickCount: 0,
      conversionCount: 0,
      totalEarnings: 0,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsed: null
    };
    
    const referralLinkRef = await db.collection('referralLinks').add(referralLink);
    
    // Generate the actual URL
    const baseUrl = functions.config().app?.base_url || 'https://your-domain.com';
    const referralUrl = `${baseUrl}/track/${referralCode}`;
    
    return {
      referralLinkId: referralLinkRef.id,
      referralCode,
      referralUrl,
      ...referralLink
    };
  } catch (error) {
    console.error('Referral link generation error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate referral link');
  }
});

// Get affiliate referral links
exports.getAffiliateReferralLinks = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    // Verify affiliate status
    if (!context.auth.token.affiliate) {
      throw new functions.https.HttpsError('permission-denied', 'User must be an affiliate');
    }
    
    const { page = 1, limit = 20, productId, isActive } = data;
    const offset = (page - 1) * limit;
    
    let query = db.collection('referralLinks')
      .where('affiliateId', '==', context.auth.uid);
    
    if (productId) {
      query = query.where('productId', '==', productId);
    }
    
    if (isActive !== undefined) {
      query = query.where('isActive', '==', isActive);
    }
    
    query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset);
    
    const snapshot = await query.get();
    const referralLinks = [];
    
    // Get product details for each referral link
    const productPromises = [];
    const productIds = new Set();
    
    snapshot.forEach(doc => {
      const data = doc.data();
      referralLinks.push({ id: doc.id, ...data });
      productIds.add(data.productId);
    });
    
    // Fetch product details
    const products = {};
    for (const productId of productIds) {
      const productDoc = await db.collection('products').doc(productId).get();
      if (productDoc.exists) {
        products[productId] = productDoc.data();
      }
    }
    
    // Add product details to referral links
    const enrichedReferralLinks = referralLinks.map(link => ({
      ...link,
      product: products[link.productId] || null
    }));
    
    return {
      referralLinks: enrichedReferralLinks,
      page,
      limit,
      hasMore: snapshot.size === limit
    };
  } catch (error) {
    console.error('Referral links retrieval error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve referral links');
  }
});

// Track referral click by code
exports.trackReferralByCode = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const referralCode = req.params[0]; // Get from path parameter
      
      if (!referralCode) {
        return res.status(400).json({ error: 'Referral code is required' });
      }
      
      // Find referral link by code
      const referralLinkQuery = await db.collection('referralLinks')
        .where('referralCode', '==', referralCode)
        .where('isActive', '==', true)
        .limit(1)
        .get();
      
      if (referralLinkQuery.empty) {
        return res.status(404).json({ error: 'Referral link not found or inactive' });
      }
      
      const referralLinkDoc = referralLinkQuery.docs[0];
      const referralLinkData = referralLinkDoc.data();
      
      // Get product details
      const productDoc = await db.collection('products').doc(referralLinkData.productId).get();
      if (!productDoc.exists) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      const product = productDoc.data();
      
      // Create referral tracking record
      const referral = {
        affiliateId: referralLinkData.affiliateId,
        productId: referralLinkData.productId,
        referralLinkId: referralLinkDoc.id,
        referralCode,
        customerId: null, // Will be updated if customer logs in
        clickedAt: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        referrer: req.get('Referer'),
        status: 'clicked',
        conversionValue: 0,
        commissionAmount: 0,
        sessionId: crypto.randomUUID()
      };
      
      const referralRef = await db.collection('referrals').add(referral);
      
      // Update referral link click count
      await db.collection('referralLinks').doc(referralLinkDoc.id).update({
        clickCount: admin.firestore.FieldValue.increment(1),
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Update affiliate total referrals
      await db.collection('affiliates').doc(referralLinkData.affiliateId).update({
        totalReferrals: admin.firestore.FieldValue.increment(1)
      });
      
      // Prepare redirect URL with tracking parameters
      const redirectUrl = new URL(product.externalUrl);
      redirectUrl.searchParams.set('ref', referralRef.id);
      redirectUrl.searchParams.set('affiliate', referralLinkData.affiliateId);
      redirectUrl.searchParams.set('session', referral.sessionId);
      
      // Add custom parameters from referral link
      if (referralLinkData.customParameters) {
        Object.entries(referralLinkData.customParameters).forEach(([key, value]) => {
          redirectUrl.searchParams.set(key, value);
        });
      }
      
      // Set tracking cookie for attribution
      res.cookie('affiliate_session', referral.sessionId, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      });
      
      res.redirect(302, redirectUrl.toString());
    } catch (error) {
      console.error('Referral tracking error:', error);
      res.status(500).json({ error: 'Failed to track referral' });
    }
  });
});

// Get referral analytics for affiliate
exports.getReferralAnalytics = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    // Verify affiliate status
    if (!context.auth.token.affiliate) {
      throw new functions.https.HttpsError('permission-denied', 'User must be an affiliate');
    }
    
    const { 
      startDate, 
      endDate, 
      productId, 
      referralLinkId,
      groupBy = 'day' // day, week, month
    } = data;
    
    let query = db.collection('referrals')
      .where('affiliateId', '==', context.auth.uid);
    
    if (startDate) {
      query = query.where('clickedAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('clickedAt', '<=', new Date(endDate));
    }
    
    if (productId) {
      query = query.where('productId', '==', productId);
    }
    
    if (referralLinkId) {
      query = query.where('referralLinkId', '==', referralLinkId);
    }
    
    const snapshot = await query.get();
    
    // Process analytics data
    const analytics = {
      totalClicks: 0,
      totalConversions: 0,
      totalEarnings: 0,
      conversionRate: 0,
      averageOrderValue: 0,
      clicksByDate: {},
      conversionsByDate: {},
      earningsByDate: {},
      topProducts: {},
      topReferralLinks: {}
    };
    
    snapshot.forEach(doc => {
      const referral = doc.data();
      const date = referral.clickedAt.toDate();
      const dateKey = formatDateByGroup(date, groupBy);
      
      analytics.totalClicks++;
      
      // Initialize date entries
      if (!analytics.clicksByDate[dateKey]) {
        analytics.clicksByDate[dateKey] = 0;
        analytics.conversionsByDate[dateKey] = 0;
        analytics.earningsByDate[dateKey] = 0;
      }
      
      analytics.clicksByDate[dateKey]++;
      
      if (referral.status === 'converted') {
        analytics.totalConversions++;
        analytics.totalEarnings += referral.commissionAmount || 0;
        analytics.conversionsByDate[dateKey]++;
        analytics.earningsByDate[dateKey] += referral.commissionAmount || 0;
      }
      
      // Track top products
      if (!analytics.topProducts[referral.productId]) {
        analytics.topProducts[referral.productId] = {
          clicks: 0,
          conversions: 0,
          earnings: 0
        };
      }
      analytics.topProducts[referral.productId].clicks++;
      if (referral.status === 'converted') {
        analytics.topProducts[referral.productId].conversions++;
        analytics.topProducts[referral.productId].earnings += referral.commissionAmount || 0;
      }
      
      // Track top referral links
      if (referral.referralLinkId) {
        if (!analytics.topReferralLinks[referral.referralLinkId]) {
          analytics.topReferralLinks[referral.referralLinkId] = {
            clicks: 0,
            conversions: 0,
            earnings: 0
          };
        }
        analytics.topReferralLinks[referral.referralLinkId].clicks++;
        if (referral.status === 'converted') {
          analytics.topReferralLinks[referral.referralLinkId].conversions++;
          analytics.topReferralLinks[referral.referralLinkId].earnings += referral.commissionAmount || 0;
        }
      }
    });
    
    // Calculate derived metrics
    analytics.conversionRate = analytics.totalClicks > 0 
      ? (analytics.totalConversions / analytics.totalClicks) * 100 
      : 0;
    
    analytics.averageOrderValue = analytics.totalConversions > 0 
      ? analytics.totalEarnings / analytics.totalConversions 
      : 0;
    
    return analytics;
  } catch (error) {
    console.error('Analytics retrieval error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve analytics');
  }
});

// Helper function to format date by grouping
function formatDateByGroup(date, groupBy) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  switch (groupBy) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week':
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekYear = weekStart.getFullYear();
      const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
      const weekDay = String(weekStart.getDate()).padStart(2, '0');
      return `${weekYear}-${weekMonth}-${weekDay}`;
    case 'month':
      return `${year}-${month}`;
    default:
      return `${year}-${month}-${day}`;
  }
}

