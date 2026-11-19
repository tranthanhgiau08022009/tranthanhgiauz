const Product = require('../models/Product');
const DigitalItem = require('../models/DigitalItem');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * buildSalesStats
 * Tong hop toan bo so lieu THAT tu MongoDB (doanh thu, top san pham, ton kho thap...).
 * Day la nguon du lieu duy nhat duoc dua cho Gemini AI phan tich - dam bao AI
 * khong the "bia" ra con so, chi duoc phep dua tren du lieu nay de dua nhan dinh.
 */
async function buildSalesStats() {
  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const purchaseMatch = { type: 'purchase', status: 'success' };

  const [
    totalAgg,
    last7Agg,
    last30Agg,
    topProducts,
    categoryBreakdown,
    lowStockProducts,
    totalUsers,
    totalActiveProducts,
  ] = await Promise.all([
    Transaction.aggregate([
      { $match: purchaseMatch },
      { $group: { _id: null, totalToken: { $sum: '$amountToken' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { ...purchaseMatch, createdAt: { $gte: d7 } } },
      { $group: { _id: null, totalToken: { $sum: '$amountToken' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { ...purchaseMatch, createdAt: { $gte: d30 } } },
      { $group: { _id: null, totalToken: { $sum: '$amountToken' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: purchaseMatch },
      { $group: { _id: '$product', totalToken: { $sum: '$amountToken' }, sales: { $sum: 1 } } },
      { $sort: { totalToken: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          title: { $ifNull: ['$product.title', 'Sản phẩm đã gỡ'] },
          category: '$product.category',
          totalToken: 1,
          sales: 1,
        },
      },
    ]),
    Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 }, totalSold: { $sum: '$soldCount' } } },
      { $project: { _id: 0, category: '$_id', count: 1, totalSold: 1 } },
    ]),
    DigitalItem.aggregate([
      { $match: { isSold: false } },
      { $group: { _id: '$product', available: { $sum: 1 } } },
      { $match: { available: { $lte: 3 } } },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      { $match: { 'product.isActive': true } },
      { $project: { _id: 0, title: '$product.title', available: 1 } },
    ]),
    User.countDocuments(),
    Product.countDocuments({ isActive: true }),
  ]);

  return {
    generatedAt: now.toISOString(),
    totalRevenueToken: totalAgg[0]?.totalToken || 0,
    totalSalesCount: totalAgg[0]?.count || 0,
    revenueLast7Days: last7Agg[0]?.totalToken || 0,
    salesLast7Days: last7Agg[0]?.count || 0,
    revenueLast30Days: last30Agg[0]?.totalToken || 0,
    salesLast30Days: last30Agg[0]?.count || 0,
    topProducts,
    categoryBreakdown,
    lowStockProducts,
    totalUsers,
    totalActiveProducts,
  };
}

module.exports = { buildSalesStats };
