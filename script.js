/* ========================================================
   نظام مدرسة التاج النموذجية - النسخة المستقرة والشاملة
   ======================================================== */

const KEY_STUDENTS  = 'school_students';
const KEY_USERS     = 'school_users';
const KEY_SETTINGS  = 'school_settings';
const KEY_SESSION   = 'school_session';
const KEY_PAYMENTS  = 'school_payments';
const KEY_TEACHERS  = 'school_teachers';
const KEY_MATERIALS = 'school_materials';

const getStudents  = () => JSON.parse(localStorage.getItem(KEY_STUDENTS)  || '[]');
const setStudents  = a  => localStorage.setItem(KEY_STUDENTS,  JSON.stringify(a));
const getUsers      = () => JSON.parse(localStorage.getItem(KEY_USERS)     || '[]');
const setUsers      = a  => localStorage.setItem(KEY_USERS,     JSON.stringify(a));
const getPayments   = () => JSON.parse(localStorage.getItem(KEY_PAYMENTS)  || '[]');
const setPayments   = a  => localStorage.setItem(KEY_PAYMENTS,  JSON.stringify(a));
const getTeachers   = () => JSON.parse(localStorage.getItem(KEY_TEACHERS)  || '[]');
const setTeachers   = a  => localStorage.setItem(KEY_TEACHERS,  JSON.stringify(a));
const getMaterials  = () => JSON.parse(localStorage.getItem(KEY_MATERIALS) || '[]');
const setMaterials  = a  => localStorage.setItem(KEY_MATERIALS, JSON.stringify(a));

function getSettings(){
  const s = localStorage.getItem(KEY_SETTINGS);
  if(s){
    try { 
      const p = JSON.parse(s);
      if(!p.currency) p.currency = '₪';
      return p;
    } catch(e){}
  }
  return {
    schoolName: 'مدرسة التاج النموذجية',
    currentYear: '2024-2025',
    currency: '₪',
    fees: { primary: 150, preparatory: 200, secondary: 250 }
  };
}
const setSettings = s => localStorage.setItem(KEY_SETTINGS, JSON.stringify(s));

const STAGE_NAMES = { primary: 'المرحلة الابتدائية', preparatory: 'المرحلة الإعدادية', secondary: 'المرحلة الثانوية' };
const GRADE_NAMES = {
  1:'الصف الأول الابتدائي', 2:'الصف الثاني الابتدائي', 3:'الصف الثالث الابتدائي',
  4:'الصف الرابع الابتدائي', 5:'الصف الخامس الابتدائي', 6:'الصف السادس الابتدائي',
  7:'الصف الأول الإعدادي',   8:'الصف الثاني الإعدادي',   9:'الصف الثالث الإعدادي',
  10:'الصف الأول الثانوي',  11:'الصف الثاني الثانوي',  12:'الصف الثالث الثانوي'
};
const STAGE_GRADES = {
  primary: [1,2,3,4,5,6],
  preparatory: [7,8,9],
  secondary: [10,11,12]
};

let currentTeacher = null;
let currentTab = 1;

function esc(str){
  if(!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fullName(s){
  return [s.firstName, s.secondName, s.thirdName, s.lastName].filter(Boolean).join(' ');
}
function gradesOfStage(stage){
  return STAGE_GRADES[stage] || [];
}

// تهيئة المستخدم الافتراضي
(function initDefaultUser(){
  const users = getUsers();
  if(!users || users.length === 0){
    setUsers([{ id:'u1', username:'admin', password:'123', name:'مدير النظام', role:'admin' }]);
  }
})();

/* ================== تسجيل الدخول والخروج ================== */
document.getElementById('login-form').addEventListener('submit', function(e){
  e.preventDefault();
  const u = document.getElementById('login-username').value.trim().toLowerCase();
  const p = document.getElementById('login-password').value.trim();
  const err = document.getElementById('login-error');
  err.textContent = '';

  const users = getUsers();
  const admin = users.find(x => x.username.toLowerCase() === u && String(x.password) === p);
  if(admin){
    localStorage.setItem(KEY_SESSION, JSON.stringify({ type:'admin', data:admin }));
    startApp(admin);
    return;
  }

  const teachers = getTeachers();
  const teacher = teachers.find(x => x.username.toLowerCase() === u && String(x.password) === p);
  if(teacher){
    localStorage.setItem(KEY_SESSION, JSON.stringify({ type:'teacher', data:teacher }));
    startTeacherApp(teacher);
    return;
  }

  err.textContent = '❌ اسم المستخدم أو كلمة المرور غير صحيحة';
});

function logout(){
  localStorage.removeItem(KEY_SESSION);
  currentTeacher = null;
  document.getElementById('app').classList.add('hidden');
  const tApp = document.getElementById('teacher-app');
  if(tApp) tApp.classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

function startApp(user){
  document.getElementById('login-screen').classList.add('hidden');
  const tApp = document.getElementById('teacher-app');
  if(tApp) tApp.classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-display').textContent = user.name || user.username;
  showScreen('dashboard');
}

/* ================== التنقل بين الشاشات ================== */
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  
  const sc = document.getElementById('screen-' + name);
  if(sc) sc.classList.add('active');

  const nav = document.querySelector(`.sidebar-nav .nav-item[data-screen="${name}"]`);
  if(nav) nav.classList.add('active');

  if(name === 'dashboard') renderDashboard();
  if(name === 'students')  renderStudentsList();
  if(name === 'register')  resetStudentForm();
  if(name === 'payments')  { fillMonths(); renderPayments(); }
  if(name === 'settings')  { fillSettings(); fillFeeSettings(); renderTeachersList(); }
}

/* ================== شؤون الطلاب وصورة الطالب ================== */
function switchTab(n){
  currentTab = n;
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', i+1 === n));
  document.querySelectorAll('.tab-panel').forEach((p,i) => p.classList.toggle('active', i+1 === n));
}

function updateGradesSelect(stageVal, gradeElId){
  const el = document.getElementById(gradeElId);
  if(!el) return;
  const list = gradesOfStage(stageVal);
  el.innerHTML = '<option value="">اختر الصف...</option>' + 
    list.map(g => `<option value="${g}">${GRADE_NAMES[g]}</option>`).join('');
}

function previewStudentPhoto(input){
  if(input.files && input.files[0]){
    const r = new FileReader();
    r.onload = function(e){
      document.getElementById('student-photo-data').value = e.target.result;
      const img = document.getElementById('photo-preview');
      img.src = e.target.result;
      img.style.display = 'block';
      document.getElementById('photo-placeholder').style.display = 'none';
    };
    r.readAsDataURL(input.files[0]);
  }
}

function resetStudentForm(){
  document.getElementById('student-form').reset();
  document.getElementById('edit-student-id').value = '';
  document.getElementById('student-photo-data').value = '';
  const img = document.getElementById('photo-preview');
  if(img){ img.src = ''; img.style.display = 'none'; }
  const pl = document.getElementById('photo-placeholder');
  if(pl) pl.style.display = 'block';
  document.getElementById('register-title').textContent = '➕ تسجيل طالب جديد';
  switchTab(1);
}

document.getElementById('student-form').addEventListener('submit', function(e){
  e.preventDefault();
  const id = document.getElementById('edit-student-id').value;
  const students = getStudents();

  const data = {
    id: id || ('S' + Date.now()),
    photo: document.getElementById('student-photo-data').value || '',
    fileNumber: document.getElementById('f-fileNumber').value.trim(),
    nationalId: document.getElementById('f-nationalId').value.trim(),
    firstName: document.getElementById('f-firstName').value.trim(),
    secondName: document.getElementById('f-secondName').value.trim(),
    thirdName: document.getElementById('f-thirdName').value.trim(),
    lastName: document.getElementById('f-lastName').value.trim(),
    gender: document.getElementById('f-gender').value,
    birthDate: document.getElementById('f-birthDate').value,
    nationality: document.getElementById('f-nationality').value.trim(),
    guardianName: document.getElementById('f-guardianName').value.trim(),
    guardianRelation: document.getElementById('f-guardianRelation').value,
    guardianPhone: document.getElementById('f-guardianPhone').value.trim(),
    address: document.getElementById('f-address').value.trim(),
    stage: document.getElementById('f-stage').value,
    grade: parseInt(document.getElementById('f-grade').value),
    academicYear: document.getElementById('f-academicYear').value,
    enrollmentDate: document.getElementById('f-enrollmentDate').value,
    status: document.getElementById('f-status').value,
    notes: document.getElementById('f-notes').value.trim()
  };

  if(!id){
    students.push(data);
    alert('✅ تم تسجيل الطالب وحفظ بياناته بنجاح');
  } else {
    const idx = students.findIndex(x => x.id === id);
    if(idx !== -1) students[idx] = data;
    alert('✅ تم تحديث بيانات الطالب');
  }

  setStudents(students);
  showScreen('students');
});

function renderStudentsList(){
  const q = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  const stageF = document.getElementById('filter-stage')?.value || '';
  const statusF = document.getElementById('filter-status')?.value || '';

  let list = getStudents();
  if(stageF) list = list.filter(s => s.stage === stageF);
  if(statusF) list = list.filter(s => s.status === statusF);
  if(q){
    list = list.filter(s => fullName(s).toLowerCase().includes(q) || (s.fileNumber && s.fileNumber.includes(q)));
  }

  const tb = document.getElementById('students-tbody');
  if(!tb) return;

  if(!list.length){
    tb.innerHTML = `<tr><td colspan="7" class="empty">لا يوجد طلاب مطابقين للبحث</td></tr>`;
    return;
  }

  tb.innerHTML = list.map(s => `
    <tr>
      <td style="text-align:center;">
        ${s.photo 
          ? `<img src="${s.photo}" class="student-thumb-img">`
          : `<div class="student-thumb-placeholder">👤</div>`
        }
      </td>
      <td><strong>${esc(fullName(s))}</strong></td>
      <td><code>${esc(s.fileNumber)}</code></td>
      <td>${STAGE_NAMES[s.stage]||''}</td>
      <td>${GRADE_NAMES[s.grade]||''}</td>
      <td><span class="badge ${s.status==='active'?'b-active':'b-left'}">${s.status==='active'?'مقيد':'منسحب'}</span></td>
      <td>
        <button type="button" class="btn btn-primary btn-sm" onclick="printStudentIDCard('${s.id}')">🪪 بطاقة الطالب</button>
        <button type="button" class="btn btn-secondary btn-sm" onclick="editStudent('${s.id}')">✏️</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteStudent('${s.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function editStudent(id){
  const s = getStudents().find(x => x.id === id);
  if(!s) return;
  showScreen('register');
  document.getElementById('register-title').textContent = '✏️ تعديل بيانات طالب';
  document.getElementById('edit-student-id').value = s.id;
  document.getElementById('student-photo-data').value = s.photo || '';
  
  const img = document.getElementById('photo-preview');
  const pl = document.getElementById('photo-placeholder');
  if(s.photo){
    img.src = s.photo;
    img.style.display = 'block';
    pl.style.display = 'none';
  } else {
    img.style.display = 'none';
    pl.style.display = 'block';
  }

  document.getElementById('f-fileNumber').value = s.fileNumber;
  document.getElementById('f-nationalId').value = s.nationalId || '';
  document.getElementById('f-firstName').value = s.firstName;
  document.getElementById('f-secondName').value = s.secondName || '';
  document.getElementById('f-thirdName').value = s.thirdName || '';
  document.getElementById('f-lastName').value = s.lastName;
  document.getElementById('f-gender').value = s.gender;
  document.getElementById('f-birthDate').value = s.birthDate || '';
  document.getElementById('f-nationality').value = s.nationality || '';
  document.getElementById('f-guardianName').value = s.guardianName;
  document.getElementById('f-guardianRelation').value = s.guardianRelation;
  document.getElementById('f-guardianPhone').value = s.guardianPhone;
  document.getElementById('f-address').value = s.address || '';
  document.getElementById('f-stage').value = s.stage;
  updateGradesSelect(s.stage, 'f-grade');
  document.getElementById('f-grade').value = s.grade;
  document.getElementById('f-academicYear').value = s.academicYear;
  document.getElementById('f-enrollmentDate').value = s.enrollmentDate;
  document.getElementById('f-status').value = s.status;
  document.getElementById('f-notes').value = s.notes || '';
}

function deleteStudent(id){
  if(!confirm('حذف هذا الطالب نهائياً من السجلات؟')) return;
  setStudents(getStudents().filter(s => s.id !== id));
  renderStudentsList();
}

function renderDashboard(){
  const all = getStudents();
  const active = all.filter(s => s.status === 'active');
  document.getElementById('stat-total').textContent = all.length;
  document.getElementById('stat-active').textContent = active.length;
  document.getElementById('stat-primary').textContent = active.filter(s => s.stage === 'primary').length;
  document.getElementById('stat-prep').textContent = active.filter(s => s.stage === 'preparatory').length;
  document.getElementById('stat-sec').textContent = active.filter(s => s.stage === 'secondary').length;
}

/* ================== بطاقة الطالب المدرسية ================== */
function printStudentIDCard(id){
  const s = getStudents().find(x => x.id === id);
  if(!s) return;
  const cfg = getSettings();

  document.getElementById('id-card-school-name').textContent = cfg.schoolName;
  document.getElementById('id-card-name').textContent = fullName(s);
  document.getElementById('id-card-fileno').textContent = s.fileNumber;
  document.getElementById('id-card-stage').textContent = STAGE_NAMES[s.stage] || s.stage;
  document.getElementById('id-card-grade').textContent = GRADE_NAMES[s.grade] || '';
  document.getElementById('id-card-year').textContent = cfg.currentYear || '2024-2025';
  
  const phoneEl = document.getElementById('id-card-phone');
  if(phoneEl){
    phoneEl.textContent = s.guardianPhone || 'غير متوفر';
  }

  const photoEl = document.getElementById('id-photo-img');
  if(s.photo){
    photoEl.src = s.photo;
    photoEl.style.display = 'block';
  } else {
    photoEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="30">👤</text></svg>';
  }

  document.getElementById('id-card-modal').classList.remove('hidden');
}

/* ================== الخزينة والدفعات النقدية ================== */
function getFees(){
  return getSettings().fees || { primary: 150, preparatory: 200, secondary: 250 };
}
function feeForStage(stg){ return getFees()[stg] || 0; }

function fillMonths(){
  const sel = document.getElementById('pay-month');
  if(!sel) return;
  
  const cfg = getSettings();
  const match = (cfg.currentYear || '').match(/\d{4}/);
  const targetYear = match ? parseInt(match[0]) : new Date().getFullYear();

  let html = '';
  const names = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const years = [targetYear, targetYear + 1];

  years.forEach(y => {
    for(let m = 1; m <= 12; m++){
      const val = `${y}-${String(m).padStart(2,'0')}`;
      const label = `${names[m-1]} ${y}`;
      html += `<option value="${val}">${label}</option>`;
    }
  });

  sel.innerHTML = html;
}

function renderPayments(){
  const mSel = document.getElementById('pay-month');
  if(!mSel) return;
  const month = mSel.value;
  const stageF = document.getElementById('pay-stage')?.value || '';
  const statusF = document.getElementById('pay-status')?.value || '';
  const cfg = getSettings();
  const cur = cfg.currency || '₪';

  const students = getStudents().filter(s => s.status === 'active');
  const payments = getPayments();

  let rows = [];
  let paid = 0, unpaid = 0, collected = 0, expected = 0;

  students.forEach(s => {
    if(stageF && s.stage !== stageF) return;
    const p = payments.find(x => x.studentId === String(s.id) && x.month === month);
    const fee = feeForStage(s.stage);
    const isPaid = !!p;

    if(isPaid){ paid++; collected += (p.amount || fee); } else { unpaid++; }
    expected += fee;

    if(statusF === 'paid' && !isPaid) return;
    if(statusF === 'unpaid' && isPaid) return;

    rows.push({ s, p, fee, isPaid });
  });

  const sumEl = document.getElementById('pay-summary');
  if(sumEl){
    sumEl.innerHTML = `
      <div class="pay-sum-card blue"><div class="num">${rows.length}</div><div class="lbl">الطلاب المعروضين</div></div>
      <div class="pay-sum-card green"><div class="num">${paid}</div><div class="lbl">مسدد نقداً</div></div>
      <div class="pay-sum-card red"><div class="num">${unpaid}</div><div class="lbl">غير مسدد</div></div>
      <div class="pay-sum-card green"><div class="num">${collected.toLocaleString('ar-SA')} ${cur}</div><div class="lbl">المحصَّل بالخزينة</div></div>
      <div class="pay-sum-card orange"><div class="num">${expected.toLocaleString('ar-SA')} ${cur}</div><div class="lbl">المتوقع تحصيله</div></div>
    `;
  }

  const tb = document.getElementById('payments-tbody');
  if(!tb) return;
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="9" class="empty">لا توجد بيانات سداد</td></tr>`;
    return;
  }

  tb.innerHTML = rows.map((r, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${esc(fullName(r.s))}</strong></td>
      <td>${STAGE_NAMES[r.s.stage]||''} - ${GRADE_NAMES[r.s.grade]||''}</td>
      <td><strong>${r.fee} ${cur}</strong></td>
      <td>${r.isPaid ? esc(r.p.method || 'نقداً') : '—'}</td>
      <td><span class="badge ${r.isPaid?'b-paid':'b-unpaid'}">${r.isPaid?'مسدد نقداً':'غير مسدد'}</span></td>
      <td>${r.isPaid ? esc(r.p.paymentDate) : '—'}</td>
      <td><code>${r.isPaid ? esc(r.p.receiptNo || '—') : '—'}</code></td>
      <td>
        ${r.isPaid
          ? `<button type="button" class="btn btn-primary btn-sm" onclick="showReceiptModal('${r.p.id}')">🧾 طباعة الوصل</button>
             <button type="button" class="btn-unpay" onclick="undoPayment('${r.s.id}','${month}')">إلغاء</button>`
          : `<button type="button" class="btn-pay" onclick="recordCashPayment('${r.s.id}','${month}',${r.fee})">💵 سداد نقدي (كاش)</button>`
        }
      </td>
    </tr>
  `).join('');
}

function recordCashPayment(studentId, month, amount){
  const pays = getPayments();
  const today = new Date().toISOString().slice(0,10);
  const serial = 'REC-' + String(pays.length + 101);

  const newPay = {
    id: 'P' + Date.now(),
    studentId: String(studentId),
    month: month,
    amount: amount,
    paymentDate: today,
    method: 'نقداً (كاش)',
    receiptNo: serial
  };

  pays.push(newPay);
  setPayments(pays);
  renderPayments();
  showReceiptModal(newPay.id);
}

function undoPayment(studentId, month){
  if(!confirm('هل تريد إلغاء عملية السداد هذه واسترجاع المبلغ؟')) return;
  setPayments(getPayments().filter(p => !(String(p.studentId) === String(studentId) && p.month === month)));
  renderPayments();
}

function showReceiptModal(paymentId){
  const p = getPayments().find(x => x.id === paymentId);
  if(!p) return;
  const s = getStudents().find(x => String(x.id) === String(p.studentId));
  if(!s) return;
  const cfg = getSettings();

  document.getElementById('receipt-school-name').textContent = cfg.schoolName;
  document.getElementById('rec-no').textContent = p.receiptNo;
  document.getElementById('rec-date').textContent = p.paymentDate;
  document.getElementById('rec-student-name').textContent = fullName(s);
  document.getElementById('rec-file-no').textContent = s.fileNumber;
  document.getElementById('rec-stage').textContent = STAGE_NAMES[s.stage] || s.stage;
  document.getElementById('rec-grade').textContent = GRADE_NAMES[s.grade] || '';
  document.getElementById('rec-month').textContent = p.month;
  document.getElementById('rec-method').textContent = p.method || 'نقداً (كاش)';
  document.getElementById('rec-amount').textContent = Number(p.amount).toLocaleString('ar-SA');
  document.getElementById('rec-currency').textContent = cfg.currency || '₪';

  document.getElementById('receipt-modal').classList.remove('hidden');
}

function closeModal(id){
  document.getElementById(id).classList.add('hidden');
}

/* ================== الإعدادات والمالية ================== */
function fillSettings(){
  const s = getSettings();
  if(document.getElementById('set-schoolName')) document.getElementById('set-schoolName').value = s.schoolName;
  if(document.getElementById('set-currentYear')) document.getElementById('set-currentYear').value = s.currentYear;
  if(document.getElementById('set-currency')) document.getElementById('set-currency').value = s.currency || '₪';
}

document.getElementById('settings-form')?.addEventListener('submit', function(e){
  e.preventDefault();
  const s = getSettings();
  s.schoolName = document.getElementById('set-schoolName').value.trim();
  s.currentYear = document.getElementById('set-currentYear').value.trim();
  s.currency = document.getElementById('set-currency').value;
  setSettings(s);
  fillMonths();
  alert('✅ تم حفظ بيانات المدرسة والسنة والعملة بنجاح');
});

function saveFees(){
  const st = getSettings();
  st.fees = {
    primary: parseInt(document.getElementById('fee-primary').value) || 0,
    preparatory: parseInt(document.getElementById('fee-preparatory').value) || 0,
    secondary: parseInt(document.getElementById('fee-secondary').value) || 0
  };
  setSettings(st);
  alert('✅ تم حفظ الرسوم النقدية بنجاح');
}

function fillFeeSettings(){
  const f = getFees();
  if(document.getElementById('fee-primary')) document.getElementById('fee-primary').value = f.primary || '';
  if(document.getElementById('fee-preparatory')) document.getElementById('fee-preparatory').value = f.preparatory || '';
  if(document.getElementById('fee-secondary')) document.getElementById('fee-secondary').value = f.secondary || '';
}

/* ================== المعلمون ================== */
function addNewTeacherBtn(){
  const nameInput = document.getElementById('teacher_fullname');
  const userInput = document.getElementById('teacher_user');
  const passInput = document.getElementById('teacher_pass');
  const stageInput = document.getElementById('teacher_stage_select');
  const subjInput = document.getElementById('teacher_subject_name');

  const name = nameInput.value.trim();
  const user = userInput.value.trim().toLowerCase();
  const pass = passInput.value.trim();
  const stage = stageInput ? stageInput.value : 'primary';
  const subject = subjInput ? subjInput.value.trim() : '';

  if(!name || !user || !pass){ alert('⚠️ يرجى تعبئة كافة بيانات المعلم'); return; }

  const teachers = getTeachers();
  if(teachers.some(t => t.username.toLowerCase() === user)){
    alert('❌ اسم الدخول هذا مستخدم بالفعل');
    return;
  }

  teachers.push({ id:'T'+Date.now(), name, username:user, password:pass, stage, subject });
  setTeachers(teachers);

  nameInput.value = '';
  userInput.value = '';
  passInput.value = '';
  if(subjInput) subjInput.value = '';

  renderTeachersList();
  alert('✅ تم إضافة المعلم بنجاح');
}

function renderTeachersList(){
  const tb = document.getElementById('teachers-tbody');
  if(!tb) return;
  const list = getTeachers();
  if(!list.length){
    tb.innerHTML = `<tr><td colspan="7" class="empty">لا يوجد معلمون مسجلون</td></tr>`;
    return;
  }
  tb.innerHTML = list.map((t,i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${esc(t.name)}</strong></td>
      <td><code>${esc(t.username)}</code></td>
      <td><code>${esc(t.password)}</code></td>
      <td>${STAGE_NAMES[t.stage]||t.stage}</td>
      <td>${esc(t.subject||'—')}</td>
      <td><button type="button" class="btn btn-danger btn-sm" onclick="deleteTeacher('${t.id}')">🗑️</button></td>
    </tr>
  `).join('');
}

function deleteTeacher(id){
  if(!confirm('حذف هذا المعلم؟')) return;
  setTeachers(getTeachers().filter(t => t.id !== id));
  renderTeachersList();
}

function startTeacherApp(teacher){
  currentTeacher = teacher;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  
  const tApp = document.getElementById('teacher-app');
  tApp.classList.remove('hidden');

  document.getElementById('teacher-name').textContent = teacher.name;
  document.getElementById('teacher-info').textContent =
    `${STAGE_NAMES[teacher.stage]} ${teacher.subject ? '— ' + teacher.subject : ''}`;

  const grades = gradesOfStage(teacher.stage);
  const opts = grades.map(g => `<option value="${g}">${GRADE_NAMES[g]}</option>`).join('');
  document.getElementById('mat-grade').innerHTML = opts;

  renderTeacherMaterials();
}

function checkCustomSubject(val){
  const row = document.getElementById('custom-subject-row');
  row.style.display = (val === 'أخرى') ? 'flex' : 'none';
}

function uploadMaterial(){
  const titleEl = document.getElementById('mat-title');
  const gradeEl = document.getElementById('mat-grade');
  const selSubj = document.getElementById('mat-subject-select').value;
  const custSubj = document.getElementById('mat-custom-subject').value.trim();
  const descEl = document.getElementById('mat-desc');
  const fileEl = document.getElementById('mat-file');

  const title = titleEl.value.trim();
  const grade = gradeEl.value;
  const desc = descEl.value.trim();
  const file = fileEl.files ? fileEl.files[0] : null;
  const finalSubject = (selSubj === 'أخرى') ? (custSubj || 'عام') : selSubj;

  if(!title || !file){
    alert('⚠️ يرجى كتابة عنوان الدرس واختيار ملف');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(ev){
    try {
      const mats = getMaterials();
      mats.push({
        id: 'M' + Date.now(),
        teacherId: currentTeacher.id,
        teacherName: currentTeacher.name,
        stage: currentTeacher.stage,
        grade: parseInt(grade),
        title, subject: finalSubject, desc,
        fileName: file.name,
        fileData: ev.target.result,
        date: new Date().toISOString().slice(0, 10)
      });
      setMaterials(mats);
      titleEl.value = '';
      descEl.value = '';
      fileEl.value = '';
      renderTeacherMaterials();
      alert('✅ تم رفع المادة بنجاح!');
    } catch(err){
      alert('❌ المساحة ممتلئة، ارفع ملفاً أصغر');
    }
  };
  reader.readAsDataURL(file);
}

function renderTeacherMaterials(){
  const list = getMaterials().filter(m => m.teacherId === currentTeacher.id);
  const tb = document.getElementById('teacher-materials-tbody');
  if(!tb) return;
  if(!list.length){
    tb.innerHTML = `<tr><td colspan="6" class="empty">لا توجد مواد مرفوعة</td></tr>`;
    return;
  }
  tb.innerHTML = list.map((m,i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${esc(m.title)}</strong></td>
      <td>${esc(m.subject)}</td>
      <td>${GRADE_NAMES[m.grade]||''}</td>
      <td>${esc(m.date)}</td>
      <td>
        <button type="button" class="btn btn-primary btn-sm" onclick="downloadMaterial('${m.id}')">⬇️ تحميل</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="deleteMaterial('${m.id}')">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function downloadMaterial(id){
  const m = getMaterials().find(x => x.id === id);
  if(!m) return;
  const a = document.createElement('a');
  a.href = m.fileData;
  a.download = m.fileName;
  a.click();
}

function deleteMaterial(id){
  if(!confirm('حذف هذه المادة؟')) return;
  setMaterials(getMaterials().filter(m => m.id !== id));
  renderTeacherMaterials();
}

/* ================== تشغيل النظام التلقائي ================== */
(function boot(){
  const session = localStorage.getItem(KEY_SESSION);
  if(!session) return;
  try {
    const s = JSON.parse(session);
    if(s.type === 'teacher'){
      const t = getTeachers().find(x => x.id === s.data.id);
      if(t) startTeacherApp(t);
    } else if(s.type === 'admin'){
      startApp(s.data);
    } else {
      startApp(s);
    }
  } catch(e){
    localStorage.removeItem(KEY_SESSION);
  }
})();