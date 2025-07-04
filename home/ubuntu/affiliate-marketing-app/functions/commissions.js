const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

const db = admin.firestore();

// Get affiliate commissions
exports.getAffiliateCommissions = functions.https.onCall(async (data, context) => {
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
      page = 1, 
      limit = 20, 
      status, 
      startDate, 
      endDate,
      productId 
    } = data;
    const offset = (page - 1) * limit;
    
    let query = db.collection('commissions')
      .where('affiliateId', '==', context.auth.uid);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }
    
    if (productId) {
      query = query.where('productId', '==', productId);
    }
    
    query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset);
    
    const snapshot = await query.get();
    const commissions = [];
    
    // Get related data for each commission
    const productIds = new Set();
    const referralIds = new Set();
    
    snapshot.forEach(doc => {
      const commission = { id: doc.id, ...doc.data() };
      commissions.push(commission);
      productIds.add(commission.productId);
      referralIds.add(commission.referralId);
    });
    
    // Fetch product and referral details
    const products = {};
    const referrals = {};
    
    // Get products
    for (const productId of productIds) {
      const productDoc = await db.collection('products').doc(productId).get();
      if (productDoc.exists) {
        products[productId] = productDoc.data();
      }
    }
    
    // Get referrals
    for (const referralId of referralIds) {
      const referralDoc = await db.collection('referrals').doc(referralId).get();
      if (referralDoc.exists) {
        referrals[referralId] = referralDoc.data();
      }
    }
    
    // Enrich commissions with related data
    const enrichedCommissions = commissions.map(commission => ({
      ...commission,
      product: products[commission.productId] || null,
      referral: referrals[commission.referralId] || null
    }));
    
    return {
      commissions: enrichedCommissions,
      page,
      limit,
      hasMore: snapshot.size === limit
    };
  } catch (error) {
    console.error('Commissions retrieval error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve commissions');
  }
});

// Get commission summary for affiliate
exports.getCommissionSummary = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    // Verify affiliate status
    if (!context.auth.token.affiliate) {
      throw new functions.https.HttpsError('permission-denied', 'User must be an affiliate');
    }
    
    const { startDate, endDate } = data;
    
    let query = db.collection('commissions')
      .where('affiliateId', '==', context.auth.uid);
    
    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }
    
    const snapshot = await query.get();
    
    const summary = {
      totalCommissions: 0,
      pendingCommissions: 0,
      approvedCommissions: 0,
      paidCommissions: 0,
      rejectedCommissions: 0,
      totalEarnings: 0,
      pendingEarnings: 0,
      approvedEarnings: 0,
      paidEarnings: 0,
      averageCommission: 0,
      commissionsByMonth: {},
      commissionsByProduct: {}
    };
    
    snapshot.forEach(doc => {
      const commission = doc.data();
      const amount = commission.commissionAmount || 0;
      
      summary.totalCommissions++;
      summary.totalEarnings += amount;
      
      // Count by status
      switch (commission.status) {
        case 'pending':
          summary.pendingCommissions++;
          summary.pendingEarnings += amount;
          break;
        case 'approved':
          summary.approvedCommissions++;
          summary.approvedEarnings += amount;
          break;
        case 'paid':
          summary.paidCommissions++;
          summary.paidEarnings += amount;
          break;
        case 'rejected':
          summary.rejectedCommissions++;
          break;
      }
      
      // Group by month
      const date = commission.createdAt.toDate();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!summary.commissionsByMonth[monthKey]) {
        summary.commissionsByMonth[monthKey] = {
          count: 0,
          earnings: 0
        };
      }
      
      summary.commissionsByMonth[monthKey].count++;
      summary.commissionsByMonth[monthKey].earnings += amount;
      
      // Group by product
      if (!summary.commissionsByProduct[commission.productId]) {
        summary.commissionsByProduct[commission.productId] = {
          count: 0,
          earnings: 0
        };
      }
      
      summary.commissionsByProduct[commission.productId].count++;
      summary.commissionsByProduct[commission.productId].earnings += amount;
    });
    
    summary.averageCommission = summary.totalCommissions > 0 
      ? summary.totalEarnings / summary.totalCommissions 
      : 0;
    
    return summary;
  } catch (error) {
    console.error('Commission summary error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve commission summary');
  }
});

// Admin: Get all commissions for review
exports.getAllCommissions = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication and admin status
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    if (!context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const { 
      page = 1, 
      limit = 50, 
      status, 
      affiliateId,
      startDate, 
      endDate,
      productId 
    } = data;
    const offset = (page - 1) * limit;
    
    let query = db.collection('commissions');
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (affiliateId) {
      query = query.where('affiliateId', '==', affiliateId);
    }
    
    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }
    
    if (productId) {
      query = query.where('productId', '==', productId);
    }
    
    query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset);
    
    const snapshot = await query.get();
    const commissions = [];
    
    // Get related data
    const affiliateIds = new Set();
    const productIds = new Set();
    const referralIds = new Set();
    
    snapshot.forEach(doc => {
      const commission = { id: doc.id, ...doc.data() };
      commissions.push(commission);
      affiliateIds.add(commission.affiliateId);
      productIds.add(commission.productId);
      referralIds.add(commission.referralId);
    });
    
    // Fetch related data
    const affiliates = {};
    const products = {};
    const referrals = {};
    
    // Get affiliates
    for (const affiliateId of affiliateIds) {
      const affiliateDoc = await db.collection('affiliates').doc(affiliateId).get();
      if (affiliateDoc.exists) {
        affiliates[affiliateId] = affiliateDoc.data();
      }
    }
    
    // Get products
    for (const productId of productIds) {
      const productDoc = await db.collection('products').doc(productId).get();
      if (productDoc.exists) {
        products[productId] = productDoc.data();
      }
    }
    
    // Get referrals
    for (const referralId of referralIds) {
      const referralDoc = await db.collection('referrals').doc(referralId).get();
      if (referralDoc.exists) {
        referrals[referralId] = referralDoc.data();
      }
    }
    
    // Enrich commissions with related data
    const enrichedCommissions = commissions.map(commission => ({
      ...commission,
      affiliate: affiliates[commission.affiliateId] || null,
      product: products[commission.productId] || null,
      referral: referrals[commission.referralId] || null
    }));
    
    return {
      commissions: enrichedCommissions,
      page,
      limit,
      hasMore: snapshot.size === limit
    };
  } catch (error) {
    console.error('All commissions retrieval error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve commissions');
  }
});

// Admin: Approve or reject commission
exports.reviewCommission = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication and admin status
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    if (!context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const { commissionId, status, reviewNotes } = data;
    
    if (!commissionId || !status) {
      throw new functions.https.HttpsError('invalid-argument', 'Commission ID and status are required');
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid status');
    }
    
    // Get commission document
    const commissionDoc = await db.collection('commissions').doc(commissionId).get();
    if (!commissionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Commission not found');
    }
    
    const commission = commissionDoc.data();
    
    // Update commission status
    await db.collection('commissions').doc(commissionId).update({
      status,
      reviewNotes: reviewNotes || '',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: context.auth.uid
    });
    
    // If approved, update affiliate earnings
    if (status === 'approved') {
      await db.collection('affiliates').doc(commission.affiliateId).update({
        approvedEarnings: admin.firestore.FieldValue.increment(commission.commissionAmount)
      });
    }
    
    return { message: `Commission ${status} successfully` };
  } catch (error) {
    console.error('Commission review error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to review commission');
  }
});

// Admin: Bulk approve commissions
exports.bulkApproveCommissions = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication and admin status
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    if (!context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const { commissionIds, reviewNotes } = data;
    
    if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Commission IDs array is required');
    }
    
    const batch = db.batch();
    const affiliateEarnings = {};
    
    // Process each commission
    for (const commissionId of commissionIds) {
      const commissionDoc = await db.collection('commissions').doc(commissionId).get();
      
      if (commissionDoc.exists) {
        const commission = commissionDoc.data();
        
        if (commission.status === 'pending') {
          // Update commission
          batch.update(db.collection('commissions').doc(commissionId), {
            status: 'approved',
            reviewNotes: reviewNotes || '',
            reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
            reviewedBy: context.auth.uid
          });
          
          // Track affiliate earnings for batch update
          if (!affiliateEarnings[commission.affiliateId]) {
            affiliateEarnings[commission.affiliateId] = 0;
          }
          affiliateEarnings[commission.affiliateId] += commission.commissionAmount;
        }
      }
    }
    
    // Update affiliate earnings
    for (const [affiliateId, earnings] of Object.entries(affiliateEarnings)) {
      batch.update(db.collection('affiliates').doc(affiliateId), {
        approvedEarnings: admin.firestore.FieldValue.increment(earnings)
      });
    }
    
    await batch.commit();
    
    return { 
      message: `${commissionIds.length} commissions approved successfully`,
      processedCount: commissionIds.length
    };
  } catch (error) {
    console.error('Bulk commission approval error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to bulk approve commissions');
  }
});

// Get commission statistics for admin dashboard
exports.getCommissionStatistics = functions.https.onCall(async (data, context) => {
  try {
    // Verify authentication and admin status
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    
    if (!context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    
    const { startDate, endDate } = data;
    
    let query = db.collection('commissions');
    
    if (startDate) {
      query = query.where('createdAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('createdAt', '<=', new Date(endDate));
    }
    
    const snapshot = await query.get();
    
    const statistics = {
      totalCommissions: 0,
      pendingCommissions: 0,
      approvedCommissions: 0,
      paidCommissions: 0,
      rejectedCommissions: 0,
      totalValue: 0,
      pendingValue: 0,
      approvedValue: 0,
      paidValue: 0,
      averageCommission: 0,
      topAffiliates: {},
      topProducts: {},
      commissionTrends: {}
    };
    
    snapshot.forEach(doc => {
      const commission = doc.data();
      const amount = commission.commissionAmount || 0;
      
      statistics.totalCommissions++;
      statistics.totalValue += amount;
      
      // Count by status
      switch (commission.status) {
        case 'pending':
          statistics.pendingCommissions++;
          statistics.pendingValue += amount;
          break;
        case 'approved':
          statistics.approvedCommissions++;
          statistics.approvedValue += amount;
          break;
        case 'paid':
          statistics.paidCommissions++;
          statistics.paidValue += amount;
          break;
        case 'rejected':
          statistics.rejectedCommissions++;
          break;
      }
      
      // Track top affiliates
      if (!statistics.topAffiliates[commission.affiliateId]) {
        statistics.topAffiliates[commission.affiliateId] = {
          count: 0,
          earnings: 0
        };
      }
      statistics.topAffiliates[commission.affiliateId].count++;
      statistics.topAffiliates[commission.affiliateId].earnings += amount;
      
      // Track top products
      if (!statistics.topProducts[commission.productId]) {
        statistics.topProducts[commission.productId] = {
          count: 0,
          earnings: 0
        };
      }
      statistics.topProducts[commission.productId].count++;
      statistics.topProducts[commission.productId].earnings += amount;
      
      // Track trends by date
      const date = commission.createdAt.toDate();
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (!statistics.commissionTrends[dateKey]) {
        statistics.commissionTrends[dateKey] = {
          count: 0,
          value: 0
        };
      }
      statistics.commissionTrends[dateKey].count++;
      statistics.commissionTrends[dateKey].value += amount;
    });
    
    statistics.averageCommission = statistics.totalCommissions > 0 
      ? statistics.totalValue / statistics.totalCommissions 
      : 0;
    
    return statistics;
  } catch (error) {
    console.error('Commission statistics error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve commission statistics');
  }
});

// Scheduled function to auto-approve commissions after a certain period
exports.autoApproveCommissions = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    const autoApprovalDays = 7; // Auto-approve after 7 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - autoApprovalDays);
    
    const query = db.collection('commissions')
      .where('status', '==', 'pending')
      .where('createdAt', '<=', cutoffDate);
    
    const snapshot = await query.get();
    
    if (snapshot.empty) {
      console.log('No commissions to auto-approve');
      return;
    }
    
    const batch = db.batch();
    const affiliateEarnings = {};
    let processedCount = 0;
    
    snapshot.forEach(doc => {
      const commission = doc.data();
      
      // Update commission
      batch.update(doc.ref, {
        status: 'approved',
        reviewNotes: 'Auto-approved after review period',
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
        reviewedBy: 'system'
      });
      
      // Track affiliate earnings
      if (!affiliateEarnings[commission.affiliateId]) {
        affiliateEarnings[commission.affiliateId] = 0;
      }
      affiliateEarnings[commission.affiliateId] += commission.commissionAmount;
      processedCount++;
    });
    
    // Update affiliate earnings
    for (const [affiliateId, earnings] of Object.entries(affiliateEarnings)) {
      batch.update(db.collection('affiliates').doc(affiliateId), {
        approvedEarnings: admin.firestore.FieldValue.increment(earnings)
      });
    }
    
    await batch.commit();
    
    console.log(`Auto-approved ${processedCount} commissions`);
  } catch (error) {
    console.error('Auto-approval error:', error);
  }
});

