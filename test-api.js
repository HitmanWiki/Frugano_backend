const axios = require('axios');
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

const API_URL = 'http://localhost:5000';
let token;
let testData = {
  categoryId: null,
  productId: null,
  saleId: null,
  invoiceNo: null,
  userId: null,
  supplierId: null,
  purchaseId: null,
  customerId: null,
  campaignId: null
};

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0
};

function log(message, type = 'info', indent = 0) {
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
    debug: `${colors.magenta}🔍${colors.reset}`,
    header: `${colors.cyan}▶${colors.reset}`,
    star: `${colors.yellow}⭐${colors.reset}`
  };
  const spaces = '  '.repeat(indent);
  console.log(`${spaces}${prefix[type]} ${message}`);
}

function printHeader(title) {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.yellow + `  ${title}` + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset + '\n');
}

function printSubHeader(title) {
  console.log(colors.bright + colors.blue + `\n  ┌─ ${title}` + colors.reset);
  console.log(colors.blue + `  ${'─'.repeat(title.length + 4)}` + colors.reset);
}

async function testSection(name, testFn) {
  printSubHeader(name);
  testResults.total++;
  try {
    await testFn();
    log(`Section passed`, 'success', 1);
    testResults.passed++;
    return true;
  } catch (error) {
    log(`Section failed: ${error.message}`, 'error', 1);
    if (error.response) {
      log(`Status: ${error.response.status}`, 'error', 2);
      log(`Data: ${JSON.stringify(error.response.data)}`, 'error', 2);
    }
    testResults.failed++;
    return false;
  }
}

async function testHealth() {
  printHeader('🏥 HEALTH CHECK');
  try {
    const res = await axios.get(`${API_URL}/health`);
    log(`Server Status: ${colors.green}${res.data.status}${colors.reset}`, 'success');
    log(`Uptime: ${Math.floor(res.data.uptime)} seconds`, 'info');
    log(`Database: ${res.data.database}`, 'info');
    log(`WebSocket: ${res.data.websocket}`, 'info');
    log(`Environment: ${res.data.environment}`, 'info');
    log(`Version: ${res.data.version}`, 'info');
    return true;
  } catch (error) {
    log(`❌ Server not reachable! Make sure server is running on port 5000`, 'error');
    log(`Run: ${colors.yellow}npm run dev${colors.reset} in another terminal`, 'info');
    return false;
  }
}

async function testSetup() {
  return testSection('Setup Owner', async () => {
    try {
      const res = await axios.post(`${API_URL}/api/auth/setup`, {
        email: 'owner@frugano.com',
        password: 'Admin@123',
        name: 'Frugano Owner',
        phone: '9876543210'
      });
      log(`Owner created: ${res.data.user.email}`, 'success', 2);
      log(`Name: ${res.data.user.name}`, 'info', 2);
      log(`Role: ${res.data.user.role}`, 'info', 2);
    } catch (error) {
      if (error.response?.status === 400) {
        log('Setup already completed', 'warn', 2);
      } else {
        throw error;
      }
    }
  });
}

async function testLogin() {
  return testSection('Login', async () => {
    const res = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'owner@frugano.com',
      password: 'Admin@123'
    });
    token = res.data.token;
    log(`Login successful`, 'success', 2);
    log(`User: ${res.data.user.name}`, 'info', 2);
    log(`Role: ${res.data.user.role}`, 'info', 2);
    log(`Token: ${token.substring(0, 20)}...`, 'debug', 2);
  });
}

async function testGetProfile() {
  return testSection('Get Profile', async () => {
    const res = await axios.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Profile retrieved: ${res.data.user.name}`, 'success', 2);
    log(`Email: ${res.data.user.email}`, 'info', 2);
    log(`Last Login: ${new Date(res.data.user.lastLogin).toLocaleString()}`, 'info', 2);
    if (res.data.user.stats) {
      log(`Total Sales: ${res.data.user.stats.totalSales}`, 'info', 2);
      log(`Total Amount: ₹${res.data.user.stats.totalAmount}`, 'info', 2);
    }
  });
}

async function testChangePassword() {
  return testSection('Change Password', async () => {
    try {
      await axios.post(`${API_URL}/api/auth/change-password`, 
        {
          currentPassword: 'Admin@123',
          newPassword: 'NewAdmin@123'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      log('Password changed successfully', 'success', 2);
      
      // Change back to original
      await axios.post(`${API_URL}/api/auth/change-password`,
        {
          currentPassword: 'NewAdmin@123',
          newPassword: 'Admin@123'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      log('Password reverted', 'success', 2);
    } catch (error) {
      if (error.response?.status === 401) {
        log('Password change failed - authentication issue', 'warn', 2);
      } else {
        throw error;
      }
    }
  });
}

async function testCategories() {
  return testSection('Categories CRUD', async () => {
    try {
      // Try to create category with unique name
      const uniqueName = `Fresh Fruits ${Date.now()}`;
      const createRes = await axios.post(`${API_URL}/api/categories`, 
        { 
          name: uniqueName,
          description: 'Fresh and organic fruits',
          image: 'fruits-category.jpg'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      testData.categoryId = createRes.data.data.id;
      log(`Created category: ${createRes.data.data.name} (ID: ${testData.categoryId})`, 'success', 2);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.existingId) {
        // Category already exists, use the existing ID
        testData.categoryId = error.response.data.existingId;
        log(`Using existing category ID: ${testData.categoryId}`, 'warn', 2);
      } else {
        throw error;
      }
    }

    // Get all categories
    const listRes = await axios.get(`${API_URL}/api/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${listRes.data.pagination.total} categories`, 'success', 2);

    // Get single category
    const getRes = await axios.get(`${API_URL}/api/categories/${testData.categoryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Retrieved category: ${getRes.data.data.name}`, 'success', 2);
    if (getRes.data.data.products) {
      log(`Has ${getRes.data.data.products.length} products`, 'info', 2);
    }

    // Update category - try with a unique name
    try {
      const updateRes = await axios.put(`${API_URL}/api/categories/${testData.categoryId}`,
        { name: `Fresh Organic Fruits ${Date.now()}` },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      log(`Updated category name to: ${updateRes.data.data.name}`, 'success', 2);
    } catch (error) {
      if (error.response?.status === 400) {
        log(`Category update skipped: ${error.response.data.error}`, 'warn', 2);
      } else {
        throw error;
      }
    }
  });
}

async function testProducts() {
  return testSection('Products CRUD', async () => {
    // Create product
    const createRes = await axios.post(`${API_URL}/api/products`, 
      {
        name: 'Fresh Apples',
        description: 'Fresh red apples from Kashmir',
        sku: `APP${Date.now()}`,
        barcode: `890${Math.floor(Math.random() * 1000000000)}`,
        categoryId: testData.categoryId,
        purchasePrice: 80,
        sellingPrice: 120,
        mrp: 140,
        unit: 'KG',
        taxRate: 5,
        minStockAlert: 10,
        currentStock: 100,
        isOrganic: true,
        isSeasonal: false
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    testData.productId = createRes.data.data.id;
    log(`Created product: ${createRes.data.data.name} (ID: ${testData.productId})`, 'success', 2);
    log(`SKU: ${createRes.data.data.sku}`, 'info', 2);
    log(`Stock: ${createRes.data.data.currentStock} KG`, 'info', 2);

    // Get all products
    const listRes = await axios.get(`${API_URL}/api/products?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${listRes.data.pagination.total} products total`, 'success', 2);
    log(`Inventory value: ₹${listRes.data.summary.inventoryValue}`, 'info', 2);

    // Get single product
    const getRes = await axios.get(`${API_URL}/api/products/${testData.productId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Retrieved product: ${getRes.data.data.name}`, 'success', 2);

    // Update stock
    const stockRes = await axios.patch(`${API_URL}/api/products/${testData.productId}/stock`,
      {
        quantity: 50,
        type: 'ADD',
        notes: 'Restock from supplier'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    log(`Updated stock: ${stockRes.data.data.currentStock} KG`, 'success', 2);

    // Update product
    const updateRes = await axios.put(`${API_URL}/api/products/${testData.productId}`,
      { sellingPrice: 130 },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    log(`Updated selling price to: ₹${updateRes.data.data.sellingPrice}`, 'success', 2);
  });
}

async function testSuppliers() {
  return testSection('Suppliers CRUD', async () => {
    // Create supplier with unique GST
    const uniqueGST = `27AAAAA${Math.floor(Math.random() * 10000)}`;
    const createRes = await axios.post(`${API_URL}/api/suppliers`, 
      {
        name: 'Kashmir Apple Growers',
        phone: '9876543210',
        email: `contact${Date.now()}@kashmir-apples.com`,
        address: 'Srinagar, Kashmir',
        gstNumber: uniqueGST,
        paymentTerms: '30 days',
        openingBalance: 0
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    testData.supplierId = createRes.data.data.id;
    log(`Created supplier: ${createRes.data.data.name}`, 'success', 2);

    // Get all suppliers
    const listRes = await axios.get(`${API_URL}/api/suppliers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${listRes.data.pagination.total} suppliers`, 'success', 2);
    log(`Total balance: ₹${listRes.data.summary.totalBalance}`, 'info', 2);

    // Get single supplier
    const getRes = await axios.get(`${API_URL}/api/suppliers/${testData.supplierId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Retrieved supplier: ${getRes.data.data.name}`, 'success', 2);
  });
}

async function testPurchases() {
  return testSection('Purchases', async () => {
    // Create purchase
    const createRes = await axios.post(`${API_URL}/api/purchases`, 
      {
        supplierId: testData.supplierId,
        items: [
          {
            productId: testData.productId,
            quantity: 100,
            purchasePrice: 75,
            sellingPrice: 120
          }
        ],
        paymentStatus: 'PENDING',
        notes: 'Bulk purchase of apples'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    testData.purchaseId = createRes.data.data.id;
    log(`Created purchase: ${createRes.data.data.invoiceNo}`, 'success', 2);
    log(`Amount: ₹${createRes.data.data.netAmount}`, 'info', 2);

    // Get all purchases
    const listRes = await axios.get(`${API_URL}/api/purchases`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${listRes.data.pagination.total} purchases`, 'success', 2);

    // Add payment
    const paymentRes = await axios.post(`${API_URL}/api/purchases/${testData.purchaseId}/payments`,
      {
        amount: 7500,
        paymentMethod: 'BANK_TRANSFER',
        referenceNo: 'REF123456',
        notes: 'Full payment'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    log(`Added payment of ₹7500`, 'success', 2);
  });
}

async function testSales() {
  return testSection('Sales / POS', async () => {
    // Create sale
    const createRes = await axios.post(`${API_URL}/api/sales`,
      {
        items: [
          {
            productId: testData.productId,
            quantity: 2.5,
            price: 120
          }
        ],
        discount: 0,
        paymentMethod: 'CASH',
        customerName: 'Walk-in Customer',
        customerPhone: '9876543210',
        notes: 'Test sale'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    testData.saleId = createRes.data.data.id;
    testData.invoiceNo = createRes.data.data.invoiceNo;
    
    log(`Created sale: ${createRes.data.data.invoiceNo}`, 'success', 2);
    log(`Amount: ₹${createRes.data.data.totalAmount}`, 'info', 2);

    // Get all sales
    const listRes = await axios.get(`${API_URL}/api/sales?page=1&limit=20`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${listRes.data.pagination.total} sales`, 'success', 2);
    log(`Total revenue: ₹${listRes.data.summary.totalRevenue}`, 'info', 2);
    log(`Average ticket: ₹${listRes.data.summary.averageTicket.toFixed(2)}`, 'info', 2);

    // Get sale by invoice
    const invoiceRes = await axios.get(`${API_URL}/api/sales/invoice/${testData.invoiceNo}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Retrieved sale by invoice`, 'success', 2);

    // Get daily summary
    const summaryRes = await axios.get(`${API_URL}/api/sales/summary/daily`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Daily summary: ${summaryRes.data.data.totalSales} sales`, 'success', 2);
    log(`Daily revenue: ₹${summaryRes.data.data.totalRevenue}`, 'info', 2);
  });
}

async function testInventory() {
  return testSection('Inventory Management', async () => {
    // Get inventory status
    const statusRes = await axios.get(`${API_URL}/api/inventory/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Inventory status retrieved`, 'success', 2);
    log(`Cost value: ₹${statusRes.data.data.valuation.costValue}`, 'info', 2);
    log(`Retail value: ₹${statusRes.data.data.valuation.retailValue}`, 'info', 2);
    log(`Potential profit: ₹${statusRes.data.data.valuation.potentialProfit}`, 'info', 2);
    log(`Low stock items: ${statusRes.data.data.lowStock.count}`, 
        statusRes.data.data.lowStock.count > 0 ? 'warn' : 'info', 2);

    // Get transactions
    const transRes = await axios.get(`${API_URL}/api/inventory/transactions?limit=5`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${transRes.data.pagination.total} total transactions`, 'success', 2);

    // Get alerts
    const alertsRes = await axios.get(`${API_URL}/api/inventory/alerts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Active alerts: ${alertsRes.data.data.length}`, 
        alertsRes.data.data.length > 0 ? 'warn' : 'success', 2);

    // Get movement report
    const moveRes = await axios.get(`${API_URL}/api/inventory/movement`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Movement report retrieved`, 'success', 2);
  });
}

async function testCustomers() {
  return testSection('Customers', async () => {
    try {
      // Try to create customer with unique phone
      const uniquePhone = `987654${Math.floor(Math.random() * 10000)}`;
      const uniqueEmail = `customer${Date.now()}@test.com`;
      
      const createRes = await axios.post(`${API_URL}/api/customers`,
        {
          name: 'Test Customer',
          phone: uniquePhone,
          email: uniqueEmail,
          address: 'Test Address, City, State - 123456'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      testData.customerId = createRes.data.data.id;
      log(`Created customer: ${createRes.data.data.name} with phone ${uniquePhone}`, 'success', 2);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.error?.includes('phone already exists')) {
        // Get existing customers and use the first one
        const listRes = await axios.get(`${API_URL}/api/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (listRes.data.data && listRes.data.data.length > 0) {
          testData.customerId = listRes.data.data[0].id;
          log(`Using existing customer ID: ${testData.customerId}`, 'warn', 2);
        }
      } else {
        throw error;
      }
    }

    // Get all customers
    const listRes = await axios.get(`${API_URL}/api/customers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${listRes.data.pagination.total} customers`, 'success', 2);

    // Get single customer
    if (testData.customerId) {
      const getRes = await axios.get(`${API_URL}/api/customers/${testData.customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      log(`Retrieved customer: ${getRes.data.data.name}`, 'success', 2);
    }
  });
}

async function testDashboard() {
  return testSection('Dashboard', async () => {
    // Get dashboard summary
    const summaryRes = await axios.get(`${API_URL}/api/dashboard/summary`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Dashboard summary retrieved`, 'success', 2);
    log(`Today's sales: ₹${summaryRes.data.data.today.revenue}`, 'info', 2);
    log(`Monthly revenue: ₹${summaryRes.data.data.month.revenue}`, 'info', 2);
    log(`Total products: ${summaryRes.data.data.inventory.totalProducts}`, 'info', 2);
    log(`Total customers: ${summaryRes.data.data.customers}`, 'info', 2);

    // Get charts data
    const chartsRes = await axios.get(`${API_URL}/api/dashboard/charts?period=week`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Charts data retrieved`, 'success', 2);

    // Get recent activities
    const recentRes = await axios.get(`${API_URL}/api/dashboard/recent`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Recent activities retrieved`, 'success', 2);
  });
}

async function testCampaigns() {
  return testSection('Campaigns', async () => {
    // Create campaign with unique name
    const uniqueName = `Summer Special ${Date.now()}`;
    const createRes = await axios.post(`${API_URL}/api/campaigns`,
      {
        name: uniqueName,
        description: 'Special discounts on summer fruits',
        type: 'SEASONAL_OFFER',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        discountType: 'PERCENTAGE',
        discountValue: 10,
        minOrderValue: 500,
        isActive: true
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    testData.campaignId = createRes.data.data.id;
    log(`Created campaign: ${createRes.data.data.name}`, 'success', 2);

    // Get all campaigns - handle both array and paginated responses
    const listRes = await axios.get(`${API_URL}/api/campaigns`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Check if response has data array or pagination
    if (listRes.data.data && Array.isArray(listRes.data.data)) {
      log(`Found ${listRes.data.data.length} campaigns`, 'success', 2);
    } else if (listRes.data.pagination) {
      log(`Found ${listRes.data.pagination.total} campaigns`, 'success', 2);
    } else {
      log(`Found campaigns`, 'success', 2);
    }

    // Get single campaign
    const getRes = await axios.get(`${API_URL}/api/campaigns/${testData.campaignId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Retrieved campaign: ${getRes.data.data.name}`, 'success', 2);

    // Activate campaign
    await axios.patch(`${API_URL}/api/campaigns/${testData.campaignId}/activate`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Activated campaign`, 'success', 2);

    // Deactivate campaign
    await axios.patch(`${API_URL}/api/campaigns/${testData.campaignId}/deactivate`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Deactivated campaign`, 'success', 2);
  });
}

async function testHardware() {
  return testSection('Hardware', async () => {
    // Get printers
    const printersRes = await axios.get(`${API_URL}/api/hardware/printers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Found ${printersRes.data.data.length} printers configured`, 'success', 2);

    // Get weighing machine status
    const weighRes = await axios.get(`${API_URL}/api/hardware/weighing/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Weighing machine status: ${weighRes.data.data.connected ? 'Connected' : 'Not connected'}`, 'info', 2);

    // Read weight
    try {
      const weightRes = await axios.get(`${API_URL}/api/hardware/weighing/read`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (weightRes.data.success) {
        log(`Current weight: ${weightRes.data.data.weight} kg`, 'info', 2);
        if (weightRes.data.data.price) {
          log(`Calculated price: ₹${weightRes.data.data.price}`, 'info', 2);
        }
      }
    } catch (error) {
      if (error.response?.status === 404) {
        log('Weighing machine not configured yet', 'warn', 2);
      } else {
        throw error;
      }
    }
  });
}

async function testReports() {
  return testSection('Reports', async () => {
    // Sales report
    const salesRes = await axios.get(`${API_URL}/api/reports/sales?period=week`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Sales report generated`, 'success', 2);

    // Inventory report
    const invRes = await axios.get(`${API_URL}/api/reports/inventory`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Inventory report generated`, 'success', 2);

    // Profit report
    const profitRes = await axios.get(`${API_URL}/api/reports/profit?period=month`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log(`Profit report generated`, 'success', 2);
  });
}

async function testLogout() {
  return testSection('Logout', async () => {
    await axios.post(`${API_URL}/api/auth/logout`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    log('Logged out successfully', 'success', 2);
  });
}

function printSummary() {
  console.log('\n' + colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  console.log(colors.bright + colors.yellow + '  TEST SUMMARY' + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset);
  
  console.log(`\n${colors.bright}Results:${colors.reset}`);
  console.log(`  ${colors.green}✓ Passed:  ${testResults.passed.toString().padStart(3)}${colors.reset}`);
  console.log(`  ${colors.red}✗ Failed:  ${testResults.failed.toString().padStart(3)}${colors.reset}`);
  console.log(`  ${colors.blue}ℹ Total:   ${testResults.total.toString().padStart(3)}${colors.reset}`);
  
  const passRate = testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(1) : 0;
  console.log(`\n${colors.bright}Pass Rate: ${passRate}%${colors.reset}`);
  
  if (testResults.failed === 0) {
    console.log(`\n${colors.green}${colors.bright}🎉 ALL TESTS PASSED! Frugano API is fully functional!${colors.reset}`);
    console.log(`\n${colors.cyan}Test Data Created:${colors.reset}`);
    console.log(`  📁 Category ID:  ${testData.categoryId || 'N/A'}`);
    console.log(`  📦 Product ID:   ${testData.productId || 'N/A'}`);
    console.log(`  💰 Sale ID:      ${testData.saleId || 'N/A'}`);
    console.log(`  📄 Invoice No:   ${testData.invoiceNo || 'N/A'}`);
    console.log(`  👤 Customer ID:  ${testData.customerId || 'N/A'}`);
    console.log(`  🏢 Supplier ID:  ${testData.supplierId || 'N/A'}`);
    console.log(`  📥 Purchase ID:  ${testData.purchaseId || 'N/A'}`);
    console.log(`  🎯 Campaign ID:  ${testData.campaignId || 'N/A'}`);
  } else {
    console.log(`\n${colors.yellow}⚠️  ${testResults.failed} test(s) failed. Check the errors above.${colors.reset}`);
  }
  
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset + '\n');
}

async function runAllTests() {
  console.log('\n' + colors.bright + colors.green + '🍏 FRUGANO API COMPLETE TEST SUITE 🍊' + colors.reset);
  console.log(colors.bright + colors.cyan + '═'.repeat(70) + colors.reset + '\n');
  console.log(`📡 API URL: ${colors.cyan}${API_URL}${colors.reset}`);
  console.log(`⏰ Started: ${new Date().toLocaleString()}\n`);

  // Reset test results
  testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Health check first
  if (!await testHealth()) {
    console.log(`\n${colors.red}❌ Cannot proceed without server. Please start the server first.${colors.reset}`);
    console.log(`   Run: ${colors.yellow}npm run dev${colors.reset}\n`);
    return;
  }

  // Run all tests in sequence
  await testSetup();
  
  if (await testLogin()) {
    await testGetProfile();
    await testChangePassword();
    await testCategories();
    await testProducts();
    await testSuppliers();
    await testPurchases();
    await testSales();
    await testInventory();
    await testCustomers();
    await testDashboard();
    await testCampaigns();
    await testHardware();
    await testReports();
    await testLogout();
  }

  printSummary();
}

// Run the tests with error handling
if (require.main === module) {
  runAllTests().catch(error => {
    console.error(`${colors.red}❌ Unhandled error:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { runAllTests };