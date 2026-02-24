// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Format date
const formatDate = (date, format = 'dd/MM/yyyy') => {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return format
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', year);
};

// Generate random string
const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Calculate profit margin
const calculateMargin = (cost, price) => {
  if (cost === 0) return 100;
  return ((price - cost) / cost) * 100;
};

// Group array by key
const groupBy = (array, key) => {
  return array.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
};

// Paginate array
const paginate = (array, page, limit) => {
  const start = (page - 1) * limit;
  const end = page * limit;
  return {
    data: array.slice(start, end),
    pagination: {
      page,
      limit,
      total: array.length,
      pages: Math.ceil(array.length / limit)
    }
  };
};

// Validate email
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Validate phone (Indian)
const isValidPhone = (phone) => {
  const re = /^[6-9]\d{9}$/;
  return re.test(phone);
};

// Calculate GST
const calculateGST = (amount, rate) => {
  const gst = (amount * rate) / 100;
  return {
    cgst: gst / 2,
    sgst: gst / 2,
    total: gst
  };
};

// Generate SKU
const generateSKU = (productName, category) => {
  const prefix = category.substring(0, 3).toUpperCase();
  const namePart = productName.substring(0, 4).toUpperCase();
  const unique = generateRandomString(4).toUpperCase();
  return `${prefix}-${namePart}-${unique}`;
};

// Parse CSV
const parseCSV = (csvString) => {
  const lines = csvString.split('\n');
  const headers = lines[0].split(',');
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const obj = {};
    const currentLine = lines[i].split(',');
    
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j].trim()] = currentLine[j]?.trim();
    }
    
    result.push(obj);
  }

  return result;
};

// Convert to CSV
const toCSV = (data, headers) => {
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(','));
  
  // Add rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header]?.toString() || '';
      return value.includes(',') ? `"${value}"` : value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

// Calculate percentage
const percentage = (value, total) => {
  if (total === 0) return 0;
  return (value / total) * 100;
};

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Deep clone object
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Mask sensitive data
const maskData = (data, type) => {
  if (type === 'phone') {
    return data.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2');
  }
  if (type === 'email') {
    const [local, domain] = data.split('@');
    const maskedLocal = local.charAt(0) + '***' + local.charAt(local.length - 1);
    return `${maskedLocal}@${domain}`;
  }
  if (type === 'aadhaar') {
    return data.replace(/\d{4}/g, '****');
  }
  return data;
};

module.exports = {
  formatCurrency,
  formatDate,
  generateRandomString,
  calculateMargin,
  groupBy,
  paginate,
  isValidEmail,
  isValidPhone,
  calculateGST,
  generateSKU,
  parseCSV,
  toCSV,
  percentage,
  debounce,
  deepClone,
  maskData
};