const http = require('http');

// Test 1: Create a course (requires auth token)
// First, let's test if the endpoint is accessible
const testData = JSON.stringify({
  title: 'Test Course',
  description: 'This is a test course description',
  category: 'Programming',
  duration: '8 weeks'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/courses',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': testData.length,
    'Authorization': 'Bearer test-token'
  }
};

console.log('Testing Course Creation API...');

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', responseData);
    
    if (res.statusCode === 401) {
      console.log('✅ API is working - returned 401 for invalid token (expected)');
    } else if (res.statusCode === 201) {
      console.log('✅ Course created successfully');
    } else {
      console.log('⚠️ Unexpected response');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(testData);
req.end();

// Test 2: Get all courses (public endpoint)
setTimeout(() => {
  console.log('\nTesting Get All Courses API...');
  
  const getOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/courses',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const getReq = http.request(getOptions, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Response:', responseData);
      
      if (res.statusCode === 200) {
        console.log('✅ Get courses API is working');
      } else {
        console.log('⚠️ Unexpected response');
      }
    });
  });

  getReq.on('error', (error) => {
    console.error('Error:', error);
  });

  getReq.end();
}, 1000);
