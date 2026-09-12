# Avvyana Aviation Academy Portal

## Slide 1: Project Overview

**Avvyana Aviation Academy Portal** is a web application for managing daily flight-training availability and student leave requests.

It connects two groups in one workflow:

- Students submit availability, training details, and leave requests.
- Academy administrators review submissions, manage records, and approve or reject leave.

## Slide 2: The Problem

Traditional communication through paper, phone calls, or chat messages can create:

- Delayed responses
- Missing or inconsistent records
- Difficulty tracking student availability
- Unclear leave-request status
- Extra administrative work

The portal provides one central place for these daily operations.

## Slide 3: Student Workflow

1. Student signs in with their SPL number and password.
2. Student selects the flight date.
3. Student submits flying availability.
4. Student can record a 7th-day or unavailable status with a reason.
5. Student raises a leave request with dates and a reason.
6. Student tracks whether the request is pending, approved, or rejected.
7. If rejected, the student can see the administrator's rejection reason.

## Slide 4: Student Features

- Student login and account creation
- Forgot-password flow
- Flight-date selection
- Daily availability submission
- Available, 7th Day, and Not Available statuses
- Reason capture for unavailable flying
- Leave request form with start and return dates
- Leave duration display
- Leave request history
- Approval and rejection status updates
- Rejection reason visibility
- Clear navigation back to flight availability

## Slide 5: Benefits for Students

### Convenience

Students can submit their daily status and leave request online without paperwork or repeated messages.

### Transparency

Students can see whether a leave request is pending, approved, or rejected, including the rejection reason.

### Faster communication

Administrators receive a structured request with dates and reason instead of incomplete informal messages.

### Better planning

Students can select the exact flight date and see the duration of requested leave.

### Fewer mistakes

Date validation prevents a return date from being earlier than the start date.

### Personal record

Students can review their previous leave requests and their decision history.

## Slide 6: Administrator Workflow

1. Administrator signs in to the admin portal.
2. Administrator searches submissions by SPL number or student name.
3. Administrator filters records by date.
4. Administrator reviews student availability and training details.
5. Administrator opens leave requests.
6. Administrator selects the acting approver: Captain Shariq or Captain SM.
7. Administrator confirms approval or rejection.
8. A rejection requires a reason.
9. The decision and reviewer identity are stored for the student to see.

## Slide 7: Administrator Features

- Admin dashboard for flight submissions
- Search by SPL number or student name
- Date filtering
- Student summary with leave days and flying hours
- Available-student view
- 7th-day and unavailable-student view
- Leave-request management
- Approval and rejection confirmation
- Required rejection reason
- Approver identity selection
- Delete individual submissions
- Clear flight submissions
- Clear all stored data with confirmation

## Slide 8: Benefits for Administrators

### Centralized management

Flight availability, student details, and leave requests are visible in one dashboard.

### Faster review

Search and date filters help administrators find the right student quickly.

### Better accountability

Every leave decision records the approver name, role, and review time.

### Clear communication

Required rejection reasons make decisions understandable to students.

### Reduced manual work

The system calculates leave duration, total leave days, and student summaries automatically.

### Safer destructive actions

Delete and clear actions require confirmation before data is removed.

### Operational visibility

Administrators can quickly see available students, unavailable students, and 7th-day records.

## Slide 9: Benefits to the Academy

- More organized daily operations
- Consistent student information
- Improved decision traceability
- Less dependency on paper records and chat messages
- Faster response to leave requests
- Better visibility into student participation
- A foundation for future notifications and reporting

## Slide 10: Technology Used

- React 19
- Vite
- React Router
- JavaScript and JSX
- CSS responsive layouts
- Local storage for current browser-based data persistence
- Node.js server support
- Oxlint for code quality

## Slide 11: User Experience Highlights

- Aviation-themed visual identity
- Responsive student and admin pages
- Clear status colors for approved, rejected, and pending states
- Confirmation prompts for important decisions
- Mobile-friendly leave-request form
- Simple navigation between student services
- Clear validation messages for incomplete or invalid forms

## Slide 12: Current Limitations

- Data is currently stored in browser local storage.
- Data is not yet shared through a central database across devices.
- Notifications by email or SMS are not yet automatic.
- Authentication is suitable for a prototype but needs a secure backend for production.
- Role permissions should be enforced server-side before production deployment.

## Slide 13: Future Improvements

- Add a secure backend database
- Add email or SMS notifications for leave decisions
- Add calendar integration
- Add attendance and flight-hour reports
- Add audit logs for all admin actions
- Add stronger role-based access control
- Add export to Excel or PDF
- Add dashboard charts and monthly summaries
- Add automated tests and end-to-end testing

## Slide 14: Demonstration Flow

### Student Demo

1. Log in as a student.
2. Select a flight date.
3. Submit availability.
4. Open Leave Request.
5. Select dates and enter a reason.
6. Submit the request.
7. Show the pending status.

### Admin Demo

1. Open the admin portal.
2. Search for the student.
3. Open Leave Requests.
4. Click Approve or Reject.
5. Select Captain Shariq or Captain SM.
6. Confirm the decision.
7. For rejection, enter the reason.
8. Return to the student view and show the updated status.

## Slide 15: Conclusion

Avvyana Aviation Academy Portal creates a clearer communication channel between students and academy administrators.

**For students:** simpler submissions, better visibility, and clear decisions.

**For administrators:** faster review, centralized information, and accountable leave management.

The project provides a strong operational foundation that can later be extended with a secure backend, notifications, reports, and analytics.
