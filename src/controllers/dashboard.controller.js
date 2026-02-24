const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private
// @desc    Get dashboard summary
// @route   GET /api/dashboard/summary
// @access  Private
const getSummary = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    // Run parallel queries
    const [
      todaySales,
      monthSales,
      totalProducts,
      lowStockCount,
      totalCustomers,
      recentSales,
      topProductsData
    ] = await Promise.all([
      // Today's sales
      prisma.sale.aggregate({
        where: {
          saleDate: {
            gte: startOfDay,
            lte: endOfDay
          },
          paymentStatus: { not: 'CANCELLED' }
        },
        _sum: { totalAmount: true },
        _count: true
      }),

      // Month sales
      prisma.sale.aggregate({
        where: {
          saleDate: {
            gte: startOfMonth,
            lte: endOfMonth
          },
          paymentStatus: { not: 'CANCELLED' }
        },
        _sum: { totalAmount: true },
        _count: true
      }),

      // Total products
      prisma.product.count({
        where: { isActive: true }
      }),

      // Low stock count
      prisma.product.count({
        where: {
          isActive: true,
          currentStock: {
            lte: prisma.product.fields.minStockAlert
          }
        }
      }),

      // Total customers
      prisma.customer.count(),

      // Recent sales - FIXED: Removed conflicting include/select
      prisma.sale.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNo: true,
          totalAmount: true,
          createdAt: true,
          cashier: {
            select: { name: true }
          }
        }
      }),

      // Top products
      prisma.saleItem.groupBy({
        by: ['productId'],
        _sum: {
          quantity: true,
          total: true
        },
        orderBy: {
          _sum: {
            total: 'desc'
          }
        },
        take: 5
      })
    ]);

    // Get product details for top products
    let formattedTopProducts = [];
    if (topProductsData.length > 0) {
      const productIds = topProductsData.map(p => p.productId);
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          image: true
        }
      });

      const productMap = products.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {});

      formattedTopProducts = topProductsData.map(p => ({
        ...p,
        product: productMap[p.productId] || { name: 'Unknown', image: null }
      }));
    }

    res.json({
      success: true,
      data: {
        today: {
          sales: todaySales._count || 0,
          revenue: todaySales._sum.totalAmount || 0
        },
        month: {
          sales: monthSales._count || 0,
          revenue: monthSales._sum.totalAmount || 0
        },
        inventory: {
          totalProducts,
          lowStock: lowStockCount
        },
        customers: totalCustomers,
        recentSales,
        topProducts: formattedTopProducts
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get charts data
// @route   GET /api/dashboard/charts
// @access  Private
const getCharts = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
    let startDate = new Date();
    let labels = [];
    let values = [];

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        
        // Get last 7 days sales using Prisma instead of raw SQL
        const weekSales = await prisma.sale.groupBy({
          by: ['saleDate'],
          where: {
            saleDate: {
              gte: startDate
            },
            paymentStatus: { not: 'CANCELLED' }
          },
          _sum: {
            totalAmount: true
          },
          orderBy: {
            saleDate: 'asc'
          }
        });

        // Create a map of date to revenue
        const revenueMap = {};
        weekSales.forEach(sale => {
          const dateStr = sale.saleDate.toISOString().split('T')[0];
          revenueMap[dateStr] = sale._sum.totalAmount || 0;
        });

        // Fill last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
          values.push(revenueMap[dateStr] || 0);
        }
        break;

      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        
        // Get daily sales for last 30 days
        const monthSales = await prisma.sale.groupBy({
          by: ['saleDate'],
          where: {
            saleDate: {
              gte: startDate
            },
            paymentStatus: { not: 'CANCELLED' }
          },
          _sum: {
            totalAmount: true
          },
          orderBy: {
            saleDate: 'asc'
          }
        });

        // Group by day of month
        const dayMap = {};
        monthSales.forEach(sale => {
          const day = sale.saleDate.getDate();
          if (!dayMap[day]) {
            dayMap[day] = 0;
          }
          dayMap[day] += sale._sum.totalAmount || 0;
        });

        // Fill last 30 days
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          labels.push(date.getDate().toString());
          values.push(dayMap[date.getDate()] || 0);
        }
        break;

      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Get category distribution using Prisma
    const salesWithProducts = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: startDate
        },
        paymentStatus: { not: 'CANCELLED' }
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    // Calculate category totals
    const categoryMap = {};
    salesWithProducts.forEach(sale => {
      sale.items.forEach(item => {
        const categoryName = item.product.category?.name || 'Uncategorized';
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = 0;
        }
        categoryMap[categoryName] += item.total;
      });
    });

    // Convert to array and sort
    const categorySales = Object.entries(categoryMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        sales: {
          labels,
          values
        },
        categories: categorySales
      }
    });
  } catch (error) {
    console.error('Dashboard charts error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// @desc    Get recent activities
// @route   GET /api/dashboard/recent
// @access  Private
const getRecentActivities = async (req, res) => {
  try {
    const activities = await prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    // Format activities for display
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      user: activity.user?.name || 'System',
      action: activity.action,
      entity: activity.entity,
      time: formatTimeAgo(activity.createdAt),
      details: activity.details,
      createdAt: activity.createdAt
    }));

    res.json({
      success: true,
      data: formattedActivities
    });
  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Helper function to format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - new Date(date)) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

module.exports = {
  getSummary,
  getCharts,
  getRecentActivities
};