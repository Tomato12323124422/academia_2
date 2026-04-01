# Add Assessments: Quiz, Assignment, Grade
*Status: ✅ In Progress*

## Approved Plan Summary
- **Assignments/Grades**: Already implemented (schema, routes, frontend).
- **Quiz**: Missing → Add full feature (schema, backend routes, frontend pages/JS).

## Implementation Steps
### 1. Database Schema [✅]
- Update `SUPABASE_SETUP.sql`: Add `quizzes`, `quiz_questions`, `quiz_attempts` tables + RLS/policies/indexes/triggers. ✅

### 2. Backend [✅]
- Create `backend/routes/quizzes.js`: Teacher CRUD, student take/submit, grade attempts. ✅
- Update `backend/index.js`: `app.use('/api/quizzes', quizzesRouter);`. ✅

### 3. Frontend Student [✅]
- Create `frontend/quizzes.html`: List quizzes per course, take modal (MCQ/text), submit. ✅

### 4. Frontend Teacher [✅]
- Create `frontend/js/teacher-quizzes.js`: Create/edit quizzes, view attempts (load on course select). ✅

### 5. Integrations [✅]
- Update `backend/routes/grades.js`: Include `quiz_attempts.score` in grade calc (/my-grades, /course/:id). ✅
- Update nav: `dashboard.html`, `my-courses.html` (add Quizzes link). ✅

### 6. Testing & Docs [ ]
- Add quiz endpoints to `test-api.js`.
- Update `TEST_REPORT.md`, mark complete in this TODO.md.

**Next Action**: 1. Run `academia 2/SUPABASE_SETUP.sql` in Supabase SQL Editor. 2. Restart backend server. 3. Test quizzes.html. ✅ COMPLETE

**Completed Steps**: [Track here after each]
