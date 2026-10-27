/* =====================================================
   نظام الخزينة والمحاسبة الذكية المطور لعام 2026-2027 — payments.js
   يعمل بشكل مستقل وشامل لجميع العمليات المالية
   ===================================================== */
(function () {
  'use strict';

  const KEY_PAY  = 'school_payments';
  const KEY_STUDENTS = 'school_students';
  const KEY_SETTINGS = 'school_settings';

  const $ = id => document.getElementById(id);

  const getPays = () => JSON.parse(localStorage.getItem(KEY_PAY) || '[]');
  const setPays = a  => localStorage.setItem(KEY_PAY, JSON.stringify(a));
  const getStudentsList = () => JSON.parse(localStorage.getItem(KEY_STUDENTS) || '[]');
  
  function getSettings() {
    return {
      schoolName: 'مدرسة التاج النموذجية',
      currentYear: '2026-2027', 
      currency: '₪',
      fees: { primary: 150, preparatory: 200, secondary: 250 }
    };
  }

  function feeOf(s) {
    const fees = getSettings().fees;
    return Number(fees[s.stage] || 0);
  }

  function fmt(n) {
    const c = getSettings().currency;
    return Number(n || 0).toLocaleString('en-US') + ' ' + c;
  }

  function esc(str) {
    if(!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function fullName(s) {
    return [s.firstName, s.secondName, s.thirdName, s.lastName].filter(Boolean).join(' ');
  }

  /* ================== التقرير المحاسبي الشامل للمدرسة ================== */
  function calculateGlobalAccounting() {
    const students = getStudentsList().filter(s => s.status === 'active');
    const payments = getPays();
    
    const monthSelect = $('pay-month');
    const currentMonth = monthSelect ? monthSelect.value : '2026-09';
    
    let totalCollected = 0;   
    let totalRequired = 0;    
    let unpaidCount = 0; 

    students.forEach(s => {
      const fee = feeOf(s);
      totalRequired += (fee * 10); // احتساب المستحقات الإجمالية للعام (10 أشهر)
      
      const hasPaidMonth = payments.some(x => String(x.studentId) === String(s.id) && String(x.month) === String(currentMonth));
      if (!hasPaidMonth) {
        unpaidCount++;
      }
    });

    payments.forEach(p => {
      totalCollected += (Number(p.amount) || 0);
    });

    let totalRemaining = totalRequired - totalCollected;

    const sumEl = $('pay-summary');
    if (sumEl) {
      sumEl.innerHTML = `
        <div class="pay-sum-card blue" style="background:#eff6ff; border:1px solid #bfdbfe; padding:15px; border-radius:10px; text-align:center; flex:1;">
          <div class="num" style="color:#1d4ed8; font-size:22px; font-weight:bold;">${students.length}</div>
          <div class="lbl" style="font-size:12px; color:#475569; margin-top:5px;">إجمالي الطلاب المقيدين</div>
        </div>
        <div class="pay-sum-card red" style="background:#fef2f2; border:1px solid #fca5a5; padding:15px; border-radius:10px; text-align:center; flex:1;">
          <div class="num" style="color:#dc2626; font-size:22px; font-weight:bold;">${unpaidCount}</div>
          <div class="lbl" style="font-size:12px; color:#475569; margin-top:5px;">⚠️ طلاب لم يدفعوا هذا الشهر</div>
        </div>
        <div class="pay-sum-card green" style="background:#f0fdf4; border:1px solid #86efac; padding:15px; border-radius:10px; text-align:center; flex:1;">
          <div class="num" style="color:#16a34a; font-size:22px; font-weight:bold;">${fmt(totalCollected)}</div>
          <div class="lbl" style="font-size:12px; color:#475569; margin-top:5px;">💰 الأموال المحصلة بالخزينة</div>
        </div>
        <div class="pay-sum-card purple" style="background:#faf5ff; border:1px solid #e9d5ff; padding:15px; border-radius:10px; text-align:center; flex:1;">
          <div class="num" style="color:#7c3aed; font-size:22px; font-weight:bold;">${fmt(totalRemaining)}</div>
          <div class="lbl" style="font-size:12px; color:#475569; margin-top:5px;">⏳ المتبقي الكلي بذمة الطلاب</div>
        </div>
      `;
    }
  }

  /* ================== كشف الحساب المالي المطبوع للطالب ================== */
  window.printStudentFinancialLedger = function(studentId) {
    const s = getStudentsList().find(x => String(x.id) === String(studentId));
    if(!s) return;
    
    const fee = feeOf(s);
    const studentPays = getPays().filter(p => String(p.studentId) === String(s.id));
    const totalPaid = studentPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remaining = (fee * 10) - totalPaid;

    const win = window.open('', '_blank', 'width=750,height=550');
    win.document.write(`
      <div style="padding:30px; font-family:sans-serif; direction:rtl; text-align:right;">
        <h2 style="color:#0f172a; text-align:center;">كشف حساب حركة الرسوم المالي - مدرسة التاج النموذجية</h2>
        <div style="font-size:14px; background:#f8fafc; padding:15px; border-radius:8px; line-height:1.8; border:1px solid #e2e8f0; margin-bottom:20px;">
          <strong>اسم الطالب الكلي:</strong> ${fullName(s)} &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>رقم الملف المدرسي:</strong> ${s.fileNumber}<br>
          <strong>المرحلة الحالية:</strong> ${s.stage} &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>العام الدراسي المعتمد:</strong> 2026-2027
        </div>
        <table border="1" cellspacing="0" cellpadding="10" style="width:100%; border-collapse:collapse; text-align:right; font-size:13px;">
          <tr style="background:#e2e8f0;"><th>تاريخ السداد</th><th>بيان الدفعة البنكية / الشهر</th><th>المبلغ المستلم</th><th>الآلية</th></tr>
          ${studentPays.length ? studentPays.map(p => `<tr><td>${p.paymentDate || '—'}</td><td>قسط شهر (${p.month || '—'})</td><td>${fmt(p.amount)}</td><td>${p.method || 'نقداً (كاش)'}</td></tr>`).join('') : '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:20px;">لا توجد حركة سداد مسجلة مسبقاً لهذا الطالب</td></tr>'}
        </table>
        <div style="margin-top:25px; background:#f1f5f9; padding:15px; border-radius:8px; display:flex; justify-content:space-between; border:1px solid #cbd5e1;">
          <p style="margin:0; font-size:15px;"><strong>إجمالي المبالغ المسددة:</strong> <span style="color:#16a34a; font-weight:bold;">${fmt(totalPaid)}</span></p>
          <p style="margin:0; font-size:15px;"><strong>إجمالي الذمم والمتبقي المطلق:</strong> <span style="color:#dc2626; font-weight:bold;">${fmt(remaining)}</span></p>
        </div>
      </div>
    `);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  /* ================== دالة تحديث وعرض جدول الرسوم والخزينة ================== */
  function renderPayments() {
    calculateGlobalAccounting();
    
    const monthSelect = $('pay-month');
    const currentMonth = monthSelect ? monthSelect.value : '';
    const stageF = $('pay-stage')?.value || '';
    const statusF = $('pay-status')?.value || '';

    const students = getStudentsList().filter(s => s.status === 'active');
    const payments = getPays();
    const tb = $('payments-tbody');

    if(!tb) return;

    let rowsHtml = '';
    let filteredCount = 0;

    students.forEach((s) => {
      if(stageF && s.stage !== stageF) return;

      const fee = feeOf(s);
      const totalRequired = fee * 10;
      const studentPays = payments.filter(p => String(p.studentId) === String(s.id));
      const totalStudentPaid = studentPays.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const studentRemaining = totalRequired - totalStudentPaid;

      const currentMonthPay = studentPays.find(x => String(x.month) === String(currentMonth));
      const isPaid = !!currentMonthPay;

      if(statusF === 'paid' && !isPaid) return;
      if(statusF === 'unpaid' && isPaid) return;

      filteredCount++;

      rowsHtml += `
        <tr>
          <td>${filteredCount}</td>
          <td><strong>${esc(fullName(s))}</strong></td>
          <td><code>${esc(s.fileNumber)}</code></td>
          <td>${fmt(fee)}</td>
          <td><span class="badge" style="background:#e0f2fe; color:#0369a1; font-weight:bold; padding:5px 10px; border-radius:5px;">${fmt(totalStudentPaid)}</span></td>
          <td><strong style="color:${studentRemaining > 0 ? '#dc2626' : '#16a34a'}">${fmt(studentRemaining)}</strong></td>
          <td><span class="badge ${isPaid ? 'b-paid' : 'b-unpaid'}">${isPaid ? 'مسدد للشهر' : 'غير مسدد'}</span></td>
          <td>
            <button type="button" class="btn btn-primary btn-sm" onclick="printStudentFinancialLedger('${s.id}')">📋 كشف حساب الطالب</button>
          </td>
        </tr>
      `;
    });

    tb.innerHTML = rowsHtml || `<tr><td colspan="8" class="empty" style="text-align:center; padding:30px; color:#64748b;">لا توجد سجلات مطابقة للخيارات المحددة في البحث</td></tr>`;
  }

  window.PAY = { render: renderPayments };
  window.renderPayments = renderPayments; 

  setTimeout(() => {
    if($('pay-month')) $('pay-month').addEventListener('change', renderPayments);
    if($('pay-stage')) $('pay-stage').addEventListener('change', renderPayments);
    if($('pay-status')) $('pay-status').addEventListener('change', renderPayments);
    renderPayments();
  }, 400);

})();

   