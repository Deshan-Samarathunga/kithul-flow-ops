/**
 * Quick API Test Script for Kithul Flow Ops
 * 
 * Usage: node test-api.js
 * 
 * This script tests basic API functionality
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, useAuth = true) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {}
  };

  if (useAuth && authToken) {
    config.headers['Authorization'] = `Bearer ${authToken}`;
  }

  if (data) {
    config.data = data;
    config.headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data?.error || error.message,
      status: error.response?.status 
    };
  }
}

// Test functions
async function testHealthCheck() {
  console.log(`\n${colors.blue}Testing Health Check...${colors.reset}`);
  
  const health = await apiCall('GET', '/health', null, false);
  if (health.success) {
    console.log(`${colors.green}✓ Health check passed${colors.reset}`);
    console.log(`  Service: ${health.data.service}`);
  } else {
    console.log(`${colors.red}✗ Health check failed: ${health.error}${colors.reset}`);
  }

  const dbPing = await apiCall('GET', '/db-ping', null, false);
  if (dbPing.success) {
    console.log(`${colors.green}✓ Database connection successful${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Database connection failed: ${dbPing.error}${colors.reset}`);
  }
}

async function testAuthentication() {
  console.log(`\n${colors.blue}Testing Authentication...${colors.reset}`);
  
  // Test users configuration
  const testUsers = {
    admin: { userId: 'admin01', password: '12345678', role: 'Administrator' },
    field: { userId: 'field01', password: '12345678', role: 'Field Collection' },
    process: { userId: 'process01', password: '12345678', role: 'Processing' },
    package: { userId: 'package01', password: '12345678', role: 'Packaging' },
    label: { userId: 'label01', password: '12345678', role: 'Labeling' }
  };

  // Test login with admin user
  const testUser = testUsers.admin;
  console.log(`  Testing login with predefined user: ${testUser.userId} (${testUser.role})`);

  // Login
  console.log(`  Logging in as ${testUser.role}...`);
  const login = await apiCall('POST', '/auth/login', {
    userId: testUser.userId,
    password: testUser.password
  }, false);
  
  if (login.success && login.data.token) {
    authToken = login.data.token;
    console.log(`${colors.green}✓ Login successful${colors.reset}`);
    console.log(`  Token received: ${authToken.substring(0, 20)}...`);
  } else {
    console.log(`${colors.red}✗ Login failed: ${login.error}${colors.reset}`);
    return false;
  }

  // Get current user
  const me = await apiCall('GET', '/auth/me');
  if (me.success) {
    console.log(`${colors.green}✓ Authentication verified${colors.reset}`);
    console.log(`  User: ${me.data.name} (${me.data.role})`);
  } else {
    console.log(`${colors.red}✗ Authentication verification failed: ${me.error}${colors.reset}`);
  }

  return true;
}

async function testEndpointAccess() {
  console.log(`\n${colors.blue}Testing Endpoint Access...${colors.reset}`);
  
  const endpoints = [
    { path: '/admin/roles', name: 'Admin Roles', requiresAdmin: true },
    { path: '/field-collection/drafts', name: 'Field Collection Drafts' },
    { path: '/processing/cans', name: 'Processing Cans' },
    { path: '/packaging/batches', name: 'Packaging Batches' },
    { path: '/labeling/batches', name: 'Labeling Batches' },
    { path: '/reports/daily', name: 'Daily Reports' },
    { path: '/field-collection/centers', name: 'Collection Centers' }
  ];

  for (const endpoint of endpoints) {
    const result = await apiCall('GET', endpoint.path);
    if (result.success) {
      console.log(`${colors.green}✓ ${endpoint.name}: Accessible${colors.reset}`);
    } else if (result.status === 403) {
      console.log(`${colors.yellow}⚠ ${endpoint.name}: Forbidden (role required)${colors.reset}`);
    } else if (result.status === 401) {
      console.log(`${colors.red}✗ ${endpoint.name}: Unauthorized${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ ${endpoint.name}: ${result.error}${colors.reset}`);
    }
  }
}

async function testCRUDOperations() {
  console.log(`\n${colors.blue}Testing CRUD Operations...${colors.reset}`);
  
  // Create a draft
  console.log(`  Creating draft...`);
  const createDraft = await apiCall('POST', '/field-collection/drafts', {
    date: new Date().toISOString().split('T')[0]
  });
  
  if (createDraft.success) {
    const createdDraft = createDraft.data;
    console.log(`${colors.green}✓ Draft created: ${createdDraft.draft_id}${colors.reset}`);
    
    // Get the draft
    const getDraft = await apiCall('GET', `/field-collection/drafts/${createdDraft.draft_id}`);
    if (getDraft.success) {
      console.log(`${colors.green}✓ Draft retrieved successfully${colors.reset}`);
    }

    // Update the draft
    const updateDraft = await apiCall('PUT', `/field-collection/drafts/${createdDraft.draft_id}`, {
      status: 'draft'
    });
    if (updateDraft.success) {
      console.log(`${colors.green}✓ Draft updated successfully${colors.reset}`);
    }

    // Delete the draft
    const deleteDraft = await apiCall('DELETE', `/field-collection/drafts/${createdDraft.draft_id}`);
    if (deleteDraft.success) {
      console.log(`${colors.green}✓ Draft deleted successfully${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}✗ Draft creation failed: ${createDraft.error}${colors.reset}`);
  }
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}Kithul Flow Ops API Test Suite${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  // Run tests
  await testHealthCheck();
  
  const authSuccess = await testAuthentication();
  if (authSuccess) {
    await testEndpointAccess();
    await testCRUDOperations();
  }

  console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}Test Suite Completed${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
}

// Check if axios is installed
try {
  require.resolve('axios');
  runTests().catch(console.error);
} catch (e) {
  console.log(`${colors.yellow}Please install axios first:${colors.reset}`);
  console.log(`${colors.blue}npm install axios${colors.reset}`);
  console.log(`\nThen run: ${colors.green}node test-api.js${colors.reset}`);
}
