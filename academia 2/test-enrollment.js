const http = require('http');

const API_BASE = 'localhost';
const API_PORT = 5000;

// Helper function to make HTTP requests
function makeRequest(path, method, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_BASE,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test Suite
async function runTests() {
  console.log('========================================');
  console.log('STUDENT SELF-ENROLLMENT TEST SUITE');
  console.log('========================================\n');

  let studentToken = null;
  let teacherToken = null;
  let testCourseId = null;
  let studentId = null;
  let teacherId = null;

  // Test 1: Register a test student
  console.log('TEST 1: Register Test Student');
  console.log('--------------------------------');
  try {
    const timestamp = Date.now();
    const studentData = {
      full_name: 'Test Student ' + timestamp,
      email: `student_${timestamp}@test.com`,
      password: 'password123',
      role: 'student'
    };
    
    const result = await makeRequest('/api/auth/register', 'POST', studentData);
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));
    
    if (result.status === 201 || result.status === 200) {
      studentToken = result.data.token;
      studentId = result.data.user?.id;
      console.log('✅ Student registered successfully\n');
    } else {
      console.log('⚠️ Student registration may have failed or user exists\n');
    }
  } catch (err) {
    console.log('❌ Error:', err.message, '\n');
  }

  // Test 2: Login as student (if registration failed)
  if (!studentToken) {
    console.log('TEST 2: Login as Existing Student');
    console.log('-----------------------------------');
    try {
      const loginData = {
        email: 'student@test.com',
        password: 'password123'
      };
      
      const result = await makeRequest('/api/auth/login', 'POST', loginData);
      console.log('Status:', result.status);
      
      if (result.status === 200) {
        studentToken = result.data.token;
        studentId = result.data.user?.id;
        console.log('✅ Student logged in successfully\n');
      } else {
        console.log('❌ Login failed:', result.data, '\n');
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 3: Register/Login as teacher
  console.log('TEST 3: Login as Teacher');
  console.log('--------------------------');
  try {
    const loginData = {
      email: 'teacher@test.com',
      password: 'password123'
    };
    
    const result = await makeRequest('/api/auth/login', 'POST', loginData);
    console.log('Status:', result.status);
    
    if (result.status === 200) {
      teacherToken = result.data.token;
      teacherId = result.data.user?.id;
      console.log('✅ Teacher logged in successfully\n');
    } else {
      // Try to register teacher
      const timestamp = Date.now();
      const teacherRegData = {
        full_name: 'Test Teacher ' + timestamp,
        email: `teacher_${timestamp}@test.com`,
        password: 'password123',
        role: 'teacher'
      };
      
      const regResult = await makeRequest('/api/auth/register', 'POST', teacherRegData);
      if (regResult.status === 201 || regResult.status === 200) {
        teacherToken = regResult.data.token;
        teacherId = regResult.data.user?.id;
        console.log('✅ Teacher registered and logged in\n');
      } else {
        console.log('❌ Teacher login/registration failed\n');
      }
    }
  } catch (err) {
    console.log('❌ Error:', err.message, '\n');
  }

  // Test 4: Teacher creates a course
  if (teacherToken) {
    console.log('TEST 4: Teacher Creates Course');
    console.log('--------------------------------');
    try {
      const courseData = {
        title: 'Test Course ' + Date.now(),
        description: 'This is a test course for enrollment testing',
        category: 'Programming',
        duration: '4 weeks'
      };
      
      const result = await makeRequest('/api/courses', 'POST', courseData, teacherToken);
      console.log('Status:', result.status);
      console.log('Response:', JSON.stringify(result.data, null, 2));
      
      if (result.status === 201) {
        testCourseId = result.data.course?.id;
        console.log('✅ Course created successfully. ID:', testCourseId, '\n');
      } else {
        console.log('❌ Course creation failed\n');
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 5: Get all courses (public endpoint)
  console.log('TEST 5: Get All Courses (Public)');
  console.log('----------------------------------');
  try {
    const result = await makeRequest('/api/courses', 'GET');
    console.log('Status:', result.status);
    console.log('Courses count:', result.data.courses?.length || 0);
    
    if (result.data.courses && result.data.courses.length > 0) {
      if (!testCourseId) {
        testCourseId = result.data.courses[0].id;
      }
      console.log('✅ Courses retrieved successfully\n');
    } else {
      console.log('⚠️ No courses found\n');
    }
  } catch (err) {
    console.log('❌ Error:', err.message, '\n');
  }

  // Test 6: Student views enrolled courses (should be empty initially)
  if (studentToken) {
    console.log('TEST 6: Student Views Enrolled Courses (Before Enrollment)');
    console.log('-----------------------------------------------------------');
    try {
      const result = await makeRequest('/api/courses/enrolled', 'GET', null, studentToken);
      console.log('Status:', result.status);
      console.log('Enrolled courses:', result.data.courses?.length || 0);
      console.log('✅ Retrieved enrolled courses\n');
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 7: Student enrolls in course
  if (studentToken && testCourseId) {
    console.log('TEST 7: Student Enrolls in Course');
    console.log('------------------------------------');
    try {
      const result = await makeRequest(`/api/courses/${testCourseId}/enroll`, 'POST', {}, studentToken);
      console.log('Status:', result.status);
      console.log('Response:', JSON.stringify(result.data, null, 2));
      
      if (result.status === 200) {
        console.log('✅ Student enrolled successfully\n');
      } else if (result.status === 400 && result.data.message?.includes('Already enrolled')) {
        console.log('⚠️ Student already enrolled in this course\n');
      } else {
        console.log('❌ Enrollment failed\n');
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 8: Student tries to enroll again (should fail)
  if (studentToken && testCourseId) {
    console.log('TEST 8: Student Tries to Enroll Again (Duplicate)');
    console.log('----------------------------------------------------');
    try {
      const result = await makeRequest(`/api/courses/${testCourseId}/enroll`, 'POST', {}, studentToken);
      console.log('Status:', result.status);
      console.log('Response:', JSON.stringify(result.data, null, 2));
      
      if (result.status === 400) {
        console.log('✅ Correctly prevented duplicate enrollment\n');
      } else {
        console.log('⚠️ Expected 400 error for duplicate enrollment\n');
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 9: Student views enrolled courses (should show the course now)
  if (studentToken) {
    console.log('TEST 9: Student Views Enrolled Courses (After Enrollment)');
    console.log('------------------------------------------------------------');
    try {
      const result = await makeRequest('/api/courses/enrolled', 'GET', null, studentToken);
      console.log('Status:', result.status);
      console.log('Enrolled courses count:', result.data.courses?.length || 0);
      
      if (result.data.courses && result.data.courses.length > 0) {
        console.log('Course titles:', result.data.courses.map(c => c.title).join(', '));
        console.log('✅ Enrolled courses retrieved successfully\n');
      } else {
        console.log('⚠️ No enrolled courses found\n');
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 10: Teacher views enrolled students
  if (teacherToken && testCourseId) {
    console.log('TEST 10: Teacher Views Enrolled Students');
    console.log('------------------------------------------');
    try {
      const result = await makeRequest(`/api/courses/${testCourseId}/enrollments`, 'GET', null, teacherToken);
      console.log('Status:', result.status);
      console.log('Enrolled students count:', result.data.enrollments?.length || 0);
      
      if (result.data.enrollments && result.data.enrollments.length > 0) {
        console.log('Students:', result.data.enrollments.map(e => e.student?.full_name || 'Unknown').join(', '));
        console.log('✅ Enrolled students retrieved successfully\n');
      } else {
        console.log('⚠️ No enrolled students found\n');
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 11: Non-student tries to enroll (should fail)
  if (teacherToken && testCourseId) {
    console.log('TEST 11: Teacher Tries to Enroll (Should Fail)');
    console.log('------------------------------------------------');
    try {
      // First create another course to test with
      const courseData = {
        title: 'Another Test Course ' + Date.now(),
        description: 'Test course',
        category: 'General',
        duration: '2 weeks'
      };
      
      const newCourse = await makeRequest('/api/courses', 'POST', courseData, teacherToken);
      const anotherCourseId = newCourse.data.course?.id;
      
      if (anotherCourseId) {
        const result = await makeRequest(`/api/courses/${anotherCourseId}/enroll`, 'POST', {}, teacherToken);
        console.log('Status:', result.status);
        console.log('Response:', JSON.stringify(result.data, null, 2));
        
        if (result.status === 403) {
          console.log('✅ Correctly prevented non-student from enrolling\n');
        } else {
          console.log('⚠️ Expected 403 error for non-student enrollment\n');
        }
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Test 12: Student tries to enroll in non-existent course
  if (studentToken) {
    console.log('TEST 12: Student Enrolls in Non-existent Course');
    console.log('-------------------------------------------------');
    try {
      const result = await makeRequest('/api/courses/99999/enroll', 'POST', {}, studentToken);
      console.log('Status:', result.status);
      console.log('Response:', JSON.stringify(result.data, null, 2));
      
      if (result.status === 404 || result.status === 500) {
        console.log('✅ Correctly handled non-existent course\n');
      } else {
        console.log('⚠️ Unexpected response\n');
      }
    } catch (err) {
      console.log('❌ Error:', err.message, '\n');
    }
  }

  // Summary
  console.log('========================================');
  console.log('TEST SUITE COMPLETED');
  console.log('========================================');
  console.log('Student Token:', studentToken ? '✅ Available' : '❌ Not Available');
  console.log('Teacher Token:', teacherToken ? '✅ Available' : '❌ Not Available');
  console.log('Test Course ID:', testCourseId || '❌ Not Created');
  console.log('\nKey Features Tested:');
  console.log('- Student registration/login');
  console.log('- Teacher login');
  console.log('- Course creation');
  console.log('- Get all courses (public)');
  console.log('- Student self-enrollment');
  console.log('- Duplicate enrollment prevention');
  console.log('- View enrolled courses');
  console.log('- Teacher view enrolled students');
  console.log('- Role-based access control');
  console.log('- Error handling for edge cases');
}

runTests().catch(console.error);
