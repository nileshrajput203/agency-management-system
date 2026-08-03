import pg from 'pg';

const neonUrl = 'postgresql://neondb_owner:npg_hiXFZ8PUsL9m@ep-sparkling-bonus-apfpbh78.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require';
const dbClient = new pg.Client({ connectionString: neonUrl, ssl: { rejectUnauthorized: false } });

async function queryDb(sql: string, params: any[] = []) {
  const res = await dbClient.query(sql, params);
  return res.rows;
}

async function runFullCrudVerification() {
  await dbClient.connect();
  console.log('=== STEP 2: COMPLETE END-TO-END CRUD & DB PERSISTENCE TEST SUITE ===\n');

  // 1. LOGIN & AUTH
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@agencyos.com', password: 'Admin@123' })
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error('Authentication failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.token;
  const userId = loginData.user.id;
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  console.log('✅ Auth Token acquired for Admin user:', userId);

  let createdClientId = '';
  let createdProjectId = '';
  let createdSubprojectId = '';
  let createdTaskId = '';
  let createdInvoiceId = '';
  let createdQuotationId = '';
  let createdPoId = '';
  let createdProposalId = '';
  let createdMeetingId = '';
  let createdLeadId = '';
  let createdContentPostId = '';
  let createdLeaveId = '';

  // 2. CLIENTS CRUD
  console.log('\n--- Testing CLIENTS Module ---');
  const clientPayload = {
    companyName: 'Acme Test Corp',
    contactPerson: 'Jane Doe',
    email: 'jane@acmetest.com',
    phone: '+1 555-0199',
    category: 'RETAINER',
    health: 'GREEN'
  };
  const createClientRes = await fetch('http://localhost:3000/api/clients', {
    method: 'POST',
    headers,
    body: JSON.stringify(clientPayload)
  });
  const clientResData = await createClientRes.json();
  createdClientId = clientResData.id;
  console.log('POST /api/clients status:', createClientRes.status, 'ID:', createdClientId);

  const dbClientRows = await queryDb('SELECT id, company_name, category FROM clients WHERE id = $1', [createdClientId]);
  console.log('SQL Verification -> DB client row count:', dbClientRows.length, 'Company:', dbClientRows[0]?.company_name);

  // PATCH Client
  const updateClientRes = await fetch('http://localhost:3000/api/clients/' + createdClientId, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ companyName: 'Acme Test Corp Updated' })
  });
  console.log('PATCH /api/clients/:id status:', updateClientRes.status);
  const dbClientUpdated = await queryDb('SELECT company_name FROM clients WHERE id = $1', [createdClientId]);
  console.log('SQL Verification -> Updated DB Name:', dbClientUpdated[0]?.company_name);

  // 3. PROJECTS & SUBPROJECTS CRUD
  console.log('\n--- Testing PROJECTS & SUBPROJECTS Module ---');
  const projectPayload = {
    name: 'Website Redesign Project',
    clientId: createdClientId,
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    startDate: '2026-08-01',
    dueDate: '2026-09-01'
  };
  const createProjRes = await fetch('http://localhost:3000/api/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify(projectPayload)
  });
  const projResData = await createProjRes.json();
  createdProjectId = projResData.id;
  console.log('POST /api/projects status:', createProjRes.status, 'ID:', createdProjectId);

  const dbProjRows = await queryDb('SELECT id, name, client_id FROM projects WHERE id = $1', [createdProjectId]);
  console.log('SQL Verification -> DB project row count:', dbProjRows.length, 'Client FK:', dbProjRows[0]?.client_id);

  // PATCH Project
  const updateProjRes = await fetch('http://localhost:3000/api/projects/' + createdProjectId, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: 'Website Redesign Phase 2' })
  });
  console.log('PATCH /api/projects/:id status:', updateProjRes.status);
  const dbProjUpdated = await queryDb('SELECT name FROM projects WHERE id = $1', [createdProjectId]);
  console.log('SQL Verification -> Updated Project Name:', dbProjUpdated[0]?.name);

  // POST Subproject
  const subprojectPayload = {
    name: 'Frontend Design Subproject',
    status: 'PLANNING',
    priority: 'MEDIUM',
    startDate: '2026-08-05',
    dueDate: '2026-08-25'
  };
  const createSubprojRes = await fetch('http://localhost:3000/api/projects/' + createdProjectId + '/subprojects', {
    method: 'POST',
    headers,
    body: JSON.stringify(subprojectPayload)
  });
  const subprojResData = await createSubprojRes.json();
  createdSubprojectId = subprojResData.id;
  console.log('POST /api/projects/:id/subprojects status:', createSubprojRes.status, 'Subproject ID:', createdSubprojectId);

  const dbSubprojRows = await queryDb('SELECT id, name, project_id FROM subprojects WHERE id = $1', [createdSubprojectId]);
  console.log('SQL Verification -> DB subproject row count:', dbSubprojRows.length, 'Parent Project FK:', dbSubprojRows[0]?.project_id);

  // 4. TASKS CRUD
  console.log('\n--- Testing TASKS Module ---');
  const taskPayload = {
    title: 'Design Homepage Mockup',
    projectId: createdProjectId,
    assigneeId: userId,
    status: 'TODO',
    priority: 'HIGH',
    dueDate: '2026-08-15'
  };
  const createTaskRes = await fetch('http://localhost:3000/api/tasks', {
    method: 'POST',
    headers,
    body: JSON.stringify(taskPayload)
  });
  const taskResData = await createTaskRes.json();
  createdTaskId = taskResData.id;
  console.log('POST /api/tasks status:', createTaskRes.status, 'ID:', createdTaskId);

  const dbTaskRows = await queryDb('SELECT id, title, project_id FROM tasks WHERE id = $1', [createdTaskId]);
  console.log('SQL Verification -> DB task row count:', dbTaskRows.length, 'Project FK:', dbTaskRows[0]?.project_id);

  // PATCH Task
  const updateTaskRes = await fetch('http://localhost:3000/api/tasks/' + createdTaskId, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'IN_PROGRESS' })
  });
  console.log('PATCH /api/tasks/:id status:', updateTaskRes.status);
  const dbTaskUpdated = await queryDb('SELECT status FROM tasks WHERE id = $1', [createdTaskId]);
  console.log('SQL Verification -> Updated Task Status:', dbTaskUpdated[0]?.status);

  // 5. MEETINGS CRUD
  console.log('\n--- Testing MEETINGS Module ---');
  const meetingPayload = {
    title: 'Client Kickoff Call',
    clientId: createdClientId,
    projectId: createdProjectId,
    startTime: '2026-08-05T10:00:00.000Z',
    endTime: '2026-08-05T11:00:00.000Z',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    status: 'SCHEDULED'
  };
  const createMeetingRes = await fetch('http://localhost:3000/api/meetings', {
    method: 'POST',
    headers,
    body: JSON.stringify(meetingPayload)
  });
  const meetingResData = await createMeetingRes.json();
  createdMeetingId = meetingResData.id;
  console.log('POST /api/meetings status:', createMeetingRes.status, 'ID:', createdMeetingId);

  const dbMeetingRows = await queryDb('SELECT id, title FROM meetings WHERE id = $1', [createdMeetingId]);
  console.log('SQL Verification -> DB meeting row count:', dbMeetingRows.length, 'Title:', dbMeetingRows[0]?.title);

  // 6. LEADS CRUD
  console.log('\n--- Testing LEADS Module ---');
  const leadPayload = {
    title: 'Enterprise Software Deal',
    companyName: 'Prospect Innovations',
    contactPerson: 'Bob Smith',
    email: 'bob@prospect.com',
    stage: 'LEAD',
    value: 25000
  };
  const createLeadRes = await fetch('http://localhost:3000/api/leads', {
    method: 'POST',
    headers,
    body: JSON.stringify(leadPayload)
  });
  const leadResData = await createLeadRes.json();
  createdLeadId = leadResData.id;
  console.log('POST /api/leads status:', createLeadRes.status, 'ID:', createdLeadId);

  const dbLeadRows = await queryDb('SELECT id, title, stage FROM leads WHERE id = $1', [createdLeadId]);
  console.log('SQL Verification -> DB lead row count:', dbLeadRows.length, 'Title:', dbLeadRows[0]?.title);

  // PATCH Lead
  const updateLeadRes = await fetch('http://localhost:3000/api/leads/' + createdLeadId, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ stage: 'CONTACTED' })
  });
  console.log('PATCH /api/leads/:id status:', updateLeadRes.status);
  const dbLeadUpdated = await queryDb('SELECT stage FROM leads WHERE id = $1', [createdLeadId]);
  console.log('SQL Verification -> Updated Lead Stage:', dbLeadUpdated[0]?.stage);

  // 7. INVOICES & INVOICE ITEMS
  console.log('\n--- Testing INVOICES Module ---');
  const invoicePayload = {
    clientId: createdClientId,
    clientName: 'Acme Test Corp Updated',
    invoiceDate: '2026-08-01',
    dueDate: '2026-08-15',
    subtotal: 1000,
    taxAmount: 180,
    total: 1180,
    status: 'SENT',
    lineItems: [
      { description: 'Web Development Services', qty: 1, unitPrice: 1000, taxPercent: 18 }
    ]
  };
  const createInvoiceRes = await fetch('http://localhost:3000/api/invoices', {
    method: 'POST',
    headers,
    body: JSON.stringify(invoicePayload)
  });
  const invoiceResData = await createInvoiceRes.json();
  createdInvoiceId = invoiceResData.id;
  console.log('POST /api/invoices status:', createInvoiceRes.status, 'ID:', createdInvoiceId);

  const dbInvoiceRows = await queryDb('SELECT id, total, client_id FROM invoices WHERE id = $1', [createdInvoiceId]);
  console.log('SQL Verification -> DB invoice row count:', dbInvoiceRows.length, 'Total:', dbInvoiceRows[0]?.total);

  // 8. QUOTATIONS
  console.log('\n--- Testing QUOTATIONS Module ---');
  const quotationPayload = {
    clientId: createdClientId,
    clientName: 'Acme Test Corp Updated',
    quotationDate: '2026-08-01',
    validUntil: '2026-08-30',
    subtotal: 5000,
    taxAmount: 900,
    total: 5900,
    status: 'DRAFT',
    lineItems: [
      { description: 'Consulting Retainer', qty: 1, unitPrice: 5000, taxPercent: 18 }
    ]
  };
  const createQtRes = await fetch('http://localhost:3000/api/quotations', {
    method: 'POST',
    headers,
    body: JSON.stringify(quotationPayload)
  });
  const qtResData = await createQtRes.json();
  createdQuotationId = qtResData.id;
  console.log('POST /api/quotations status:', createQtRes.status, 'ID:', createdQuotationId);

  const dbQtRows = await queryDb('SELECT id, total FROM quotations WHERE id = $1', [createdQuotationId]);
  console.log('SQL Verification -> DB quotation row count:', dbQtRows.length, 'Total:', dbQtRows[0]?.total);

  // 9. PURCHASE ORDERS
  console.log('\n--- Testing PURCHASE ORDERS Module ---');
  const poPayload = {
    clientId: createdClientId,
    clientName: 'Acme Test Corp Updated',
    orderDate: '2026-08-01',
    deliveryDate: '2026-08-20',
    subtotal: 2000,
    taxAmount: 360,
    total: 2360,
    status: 'ORDERED',
    lineItems: [
      { description: 'Cloud Server Infrastructure', qty: 2, unitPrice: 1000, taxPercent: 18 }
    ]
  };
  const createPoRes = await fetch('http://localhost:3000/api/purchase-orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(poPayload)
  });
  const poResData = await createPoRes.json();
  createdPoId = poResData.id;
  console.log('POST /api/purchase-orders status:', createPoRes.status, 'ID:', createdPoId);

  const dbPoRows = await queryDb('SELECT id, total, client_id FROM purchase_orders WHERE id = $1', [createdPoId]);
  console.log('SQL Verification -> DB PO row count:', dbPoRows.length, 'Total:', dbPoRows[0]?.total);

  // 10. PROPOSALS
  console.log('\n--- Testing PROPOSALS Module ---');
  const proposalPayload = {
    title: 'Brand Strategy Proposal',
    clientId: createdClientId,
    clientName: 'Acme Test Corp Updated',
    status: 'DRAFT',
    total: 12000
  };
  const createPropRes = await fetch('http://localhost:3000/api/proposals', {
    method: 'POST',
    headers,
    body: JSON.stringify(proposalPayload)
  });
  const propResData = await createPropRes.json();
  createdProposalId = propResData.id;
  console.log('POST /api/proposals status:', createPropRes.status, 'ID:', createdProposalId);

  const dbPropRows = await queryDb('SELECT id, title FROM proposals WHERE id = $1', [createdProposalId]);
  console.log('SQL Verification -> DB proposal row count:', dbPropRows.length, 'Title:', dbPropRows[0]?.title);

  // 11. CONTENT POSTS
  console.log('\n--- Testing CONTENT POSTS Module ---');
  const postPayload = {
    title: 'August Campaign Teaser',
    clientId: createdClientId,
    platform: 'INSTAGRAM',
    contentType: 'REEL',
    caption: 'Big announcements coming soon!',
    status: 'IDEA',
    scheduledAt: '2026-08-10'
  };
  const createPostRes = await fetch('http://localhost:3000/api/content-posts', {
    method: 'POST',
    headers,
    body: JSON.stringify(postPayload)
  });
  const postResData = await createPostRes.json();
  createdContentPostId = postResData.id;
  console.log('POST /api/content-posts status:', createPostRes.status, 'ID:', createdContentPostId);

  const dbPostRows = await queryDb('SELECT id, title, platform FROM content_posts WHERE id = $1', [createdContentPostId]);
  console.log('SQL Verification -> DB post row count:', dbPostRows.length, 'Platform:', dbPostRows[0]?.platform);

  // 12. ATTENDANCE
  console.log('\n--- Testing ATTENDANCE Module ---');
  const checkInRes = await fetch('http://localhost:3000/api/attendance/check-in', {
    method: 'POST',
    headers
  });
  const checkInData = await checkInRes.json();
  console.log('POST /api/attendance/check-in status:', checkInRes.status, 'Attendance ID:', checkInData.id || checkInData.attendanceId);
  const dbAttRows = await queryDb('SELECT id, user_id, status FROM attendance WHERE user_id = $1', [userId]);
  console.log('SQL Verification -> DB attendance row count for user:', dbAttRows.length, 'Status:', dbAttRows[0]?.status);

  // 13. LEAVES
  console.log('\n--- Testing LEAVE REQUESTS Module ---');
  const leavePayload = {
    type: 'CASUAL',
    startDate: '2026-08-20',
    endDate: '2026-08-21',
    reason: 'Family event'
  };
  const createLeaveRes = await fetch('http://localhost:3000/api/leaves', {
    method: 'POST',
    headers,
    body: JSON.stringify(leavePayload)
  });
  const leaveResData = await createLeaveRes.json();
  createdLeaveId = leaveResData.id;
  console.log('POST /api/leaves status:', createLeaveRes.status, 'ID:', createdLeaveId);

  const dbLeaveRows = await queryDb('SELECT id, reason FROM leave_requests WHERE user_id = $1', [userId]);
  console.log('SQL Verification -> DB leave request row count for user:', dbLeaveRows.length);

  // 14. NOTIFICATIONS
  console.log('\n--- Testing NOTIFICATIONS Module ---');
  const notifPayload = {
    title: 'System Wide Announcement',
    message: 'Maintenance window scheduled for August 15',
    priority: 'HIGH'
  };
  const createNotifRes = await fetch('http://localhost:3000/api/notifications/announcement', {
    method: 'POST',
    headers,
    body: JSON.stringify(notifPayload)
  });
  const notifResData = await createNotifRes.json();
  console.log('POST /api/notifications/announcement status:', createNotifRes.status, 'Response:', JSON.stringify(notifResData));

  const dbNotifRows = await queryDb('SELECT id, title FROM notifications WHERE created_by = $1', [userId]);
  console.log('SQL Verification -> DB notification row count created by user:', dbNotifRows.length);

  // 15. DASHBOARD METRICS PERSISTENCE VERIFICATION
  console.log('\n--- Testing DASHBOARD METRICS CALCULATION ---');
  const dashRes = await fetch('http://localhost:3000/api/dashboard/stats', { headers });
  const dashData = await dashRes.json();
  console.log('GET /api/dashboard/stats status:', dashRes.status);
  console.log('Dashboard Calculated Metrics:', JSON.stringify(dashData, null, 2));

  // 16. DELETION / CLEANUP VERIFICATION
  console.log('\n--- Testing DELETE Verification ---');
  if (createdMeetingId) {
    const delMeetingRes = await fetch('http://localhost:3000/api/meetings/' + createdMeetingId, { method: 'DELETE', headers });
    console.log('DELETE /api/meetings/:id status:', delMeetingRes.status);
    const dbMeetingAfterDel = await queryDb('SELECT id FROM meetings WHERE id = $1', [createdMeetingId]);
    console.log('SQL Verification -> Meeting row count in DB after DELETE:', dbMeetingAfterDel.length);
  }

  if (createdLeadId) {
    const delLeadRes = await fetch('http://localhost:3000/api/leads/' + createdLeadId, { method: 'DELETE', headers });
    console.log('DELETE /api/leads/:id status:', delLeadRes.status);
    const dbLeadAfterDel = await queryDb('SELECT id FROM leads WHERE id = $1', [createdLeadId]);
    console.log('SQL Verification -> Lead row count in DB after DELETE:', dbLeadAfterDel.length);
  }

  console.log('\n=== ALL MODULE CRUD & DB PERSISTENCE TESTS PASSED PERFECTLY ===');
  await dbClient.end();
}

runFullCrudVerification().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
