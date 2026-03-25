# ACADEMIA LMS - Task Tracker

## CURRENT TASK: Fix Admin Dashboard Enrollments (500 Error)

### Approved Plan Steps:
- [ ] 1. Simplify backend/routes/admin.js GET /enrollments → raw enrollments no joins
- [ ] 2. Add console.log('ENROLLMENTS:', data) all responses
- [ ] 3. Frontend admin-dashboard.js → handle empty/null gracefully
- [ ] 4. Test local → localhost:5000/api/admin/enrollments
- [ ] 5. Git commit → Render deploy
- [ ] 6. Verify admin → Enrollments tab loads

### PREV TASKS (QR Fixed):
- [x] Fix UUID '38' → parseInt(session_id)
- [x] QR → attendance-form.html redirect
- [x] Teacher list: Name + RegNo ✓

## DEPLOY:
```
git add .
git commit -m "Fix admin enrollments 500"
git push
Render auto-deploys
```

