/* =====================================================
   ملحق المدفوعات الشهرية — payments.js
   يعمل مع index.html و script.js دون تعديلهما
   ===================================================== */
(function () {
  'use strict';

  const KEY_PAY  = 'school_payments';
  const KEY_FEES = 'school_fees';

  /* أشهر العام الدراسي (يمكنك تعديلها هنا) */
  const MONTHS = [
    {n:9,  name:'سبتمبر'}, {n:10, name:'أكتوبر'}, {n:11, name:'نوفمبر'},
    {n:12, name:'ديسمبر'}, {n:1,  name:'يناير'},  {n:2,  name:'فبراير'},
    {n:3,  name:'مارس'},   {n:4,  name:'أبريل'},  {n:5,  name:'مايو'},
    {n:6,  name:'يونيو'}
  ];
  const METHODS = ['نقداً', 'تحويل بنكي', 'شيك', 'بطاقة / شبكة'];
  const STATUS_LABEL = { paid:'مدفوع', unpaid:'غير مدفوع', upcoming:'لم يحن موعده' };

  /* ---------- أدوات ---------- */
  const $ = id => document.getElementById(id);

  const getPays = () => JSON.parse(localStorage.getItem(KEY_PAY) || '[]');
  const setPays = a  => localStorage.setItem(KEY_PAY, JSON.stringify(a));
  const getFees = () => Object.assign(
    { primary:0, preparatory:0, secondary:0, currency:'' },
    JSON.parse(localStorage.getItem(KEY_FEES) || '{}'));
  const setFees = o  => localStorage.setItem(KEY_FEES, JSON.stringify(o));

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmt(n) {
    const c = getFees().currency;
    return Number(n || 0).toLocaleString('en-US') + (c ? ' ' + c : '');
  }
  const dt = x => `<span dir="ltr">${esc(x)}</span>`;

  const monthName   = n => (MONTHS.find(m => m.n === n) || {}).name || n;
  const startYear   = () => parseInt(String(getSettings().currentYear).slice(0, 4), 10) || new Date().getFullYear();
  const yearOfMonth = n => (n >= 9 ? startYear() : startYear() + 1);
  const dueDate     = n => new Date(yearOfMonth(n), n - 1, 1);
  const feeOf       = s => Number(getFees()[s.stage] || 0);
  const defaultMonth = () => {
    const n = new Date().getMonth() + 1;
    return MONTHS.some(m => m.n === n) ? n : 9;
  };

  /* خريطة دفعات السنة الحالية: "رقم الطالب|الشهر" => الدفعة */
  function payMap() {
    const y = getSettings().currentYear, m = {};
    getPays().forEach(p => { if (p.year === y) m[p.studentId + '|' + p.month] = p; });
    return m;
  }
  function statusOf(pay, n) {
    if (pay) return 'paid';
    return dueDate(n) <= new Date() ? 'unpaid' : 'upcoming';
  }
  function nextReceipt() {
    const nums = getPays().map(p => parseInt(p.receiptNo, 10) || 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }
  function docHeader(title) {
    return `<div class="doc-header">
      <img src="logo.png" alt="" style="width:70px;height:70px;object-fit:contain" onerror="this.style.display='none'"><br>
      <h2>${esc(getSettings().schoolName)}</h2><p>${title}</p></div>`;
  }
  function downloadCSV(rows, name) {
    const csv = '\uFEFF' + rows.map(r =>
      r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* =====================================================
     بناء الواجهة (يُحقن تلقائياً في الصفحة)
     ===================================================== */
  function injectUI() {
    if ($('screen-payments')) return;

    /* التنسيقات */
    const css = document.createElement('style');
    css.textContent = `
      .b-paid{background:#dcfce7;color:#15803d}
      .b-unpaid{background:#fee2e2;color:#b91c1c}
      .b-upcoming{background:#e2e8f0;color:#475569}
      .pay-warn{background:#fef9c3;border:1px solid #fde047;color:#854d0e;
        padding:10px 14px;border-radius:9px;font-size:13px;margin-bottom:14px}
      .pay-info{background:#f8fafc;border-radius:10px;padding:12px 14px;
        margin-bottom:14px;font-size:13px;line-height:1.9}
      .pay-totals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
      .pay-totals div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px;
        padding:10px;text-align:center;font-size:12px}
      .pay-totals strong{display:block;font-size:15px;margin-top:3px}
      .link-btn{background:none;border:0;color:#2563eb;font-weight:700;cursor:pointer;
        font-family:inherit;font-size:13px;text-align:right;padding:0}
      .link-btn:hover{text-decoration:underline}
      .nowrap{white-space:nowrap}
    `;
    document.head.appendChild(css);

    /* زر القائمة الجانبية */
    const nav = document.createElement('a');
    nav.className = 'nav-item';
    nav.dataset.screen = 'payments';
    nav.setAttribute('onclick', "showScreen('payments')");
    nav.innerHTML = '<span>💰</span> المدفوعات';
    const ref = document.querySelector('.nav-item[data-screen="reports"]');
    if (ref) ref.parentNode.insertBefore(nav, ref);
    else document.querySelector('.sidebar-nav').appendChild(nav);

    /* شاشة المدفوعات */
    const sec = document.createElement('section');
    sec.id = 'screen-payments';
    sec.className = 'screen';
    sec.innerHTML = `
      <div class="screen-header">
        <div><h1>المدفوعات الشهرية</h1><p class="muted" id="pay-subtitle"></p></div>
      </div>

      <div class="card">
        <h3>💵 قيمة القسط الشهري لكل مرحلة</h3>
        <div class="form-row">
          <div class="form-group"><label>الابتدائي</label><input type="number" min="0" id="fee-primary"></div>
          <div class="form-group"><label>الإعدادي</label><input type="number" min="0" id="fee-preparatory"></div>
          <div class="form-group"><label>الثانوي</label><input type="number" min="0" id="fee-secondary"></div>
          <div class="form-group"><label>العملة</label><input id="fee-currency" placeholder="مثال: ريال / دينار / جنيه"></div>
        </div>
        <button class="btn btn-primary" onclick="PAY.saveFees()">💾 حفظ الأسعار</button>
        <p class="muted" style="margin-top:8px">تغيير السعر يؤثر على الأشهر غير المدفوعة فقط، أما الدفعات المسجلة فتبقى بمبلغها الأصلي.</p>
      </div>

      <div id="pay-warn"></div>
      <div class="stats-grid" id="pay-stats"></div>

      <div class="card">
        <div class="filters">
          <input id="pay-search" placeholder="🔍 بحث بالاسم أو رقم الملف..." oninput="PAY.render()">
          <select id="pay-month" onchange="PAY.render()"></select>
          <select id="pay-stage" onchange="PAY.render()">
            <option value="">كل المراحل</option>
            <option value="primary">الابتدائي</option>
            <option value="preparatory">الإعدادي</option>
            <option value="secondary">الثانوي</option>
          </select>
          <select id="pay-grade" onchange="PAY.render()"></select>
          <select id="pay-status" onchange="PAY.render()">
            <option value="">كل الحالات</option>
            <option value="paid">مدفوع</option>
            <option value="unpaid">غير مدفوع</option>
            <option value="upcoming">لم يحن موعده</option>
          </select>
        </div>
        <div class="table-actions">
          <button class="btn btn-success" onclick="PAY.exportMonth()">📊 تصدير Excel</button>
          <button class="btn btn-secondary" onclick="PAY.printMonth()">🖨️ طباعة الكشف</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>م</th><th>رقم الملف</th><th>اسم الطالب</th><th>الصف / الشعبة</th>
              <th>قيمة الشهر</th><th>الحالة</th><th>تاريخ الدفع</th><th>المبلغ المدفوع</th><th>إجراءات</th>
            </tr></thead>
            <tbody id="pay-tbody"></tbody>
          </table>
        </div>
        <div class="table-info" id="pay-count"></div>
      </div>`;
    document.querySelector('main.main').appendChild(sec);

    /* نافذة كشف حساب الطالب + نافذة تسجيل الدفعة */
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div id="ledger-modal" class="modal hidden">
        <div class="modal-content">
          <div class="modal-header">
            <h2 id="ledger-title">كشف حساب الطالب</h2>
            <button class="modal-close" onclick="PAY.closeLedger()">✖️</button>
          </div>
          <div class="modal-body" id="ledger-body"></div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="PAY.printLedger()">🖨️ طباعة كشف الحساب</button>
            <button class="btn btn-secondary" onclick="PAY.closeLedger()">إغلاق</button>
          </div>
        </div>
      </div>

      <div id="pay-modal" class="modal hidden" style="z-index:300">
        <div class="modal-content" style="width:500px">
          <div class="modal-header">
            <h2 id="pay-modal-title">تسجيل دفعة</h2>
            <button class="modal-close" onclick="PAY.closePay()">✖️</button>
          </div>
          <form id="pay-form">
            <div class="modal-body">
              <div class="pay-info" id="pay-info"></div>
              <input type="hidden" id="pay-student-id">
              <input type="hidden" id="pay-month-n">
              <input type="hidden" id="pay-id">
              <div class="form-row">
                <div class="form-group"><label>المبلغ المدفوع *</label>
                  <input type="number" id="pay-amount" min="0" step="0.01" required></div>
                <div class="form-group"><label>تاريخ الدفع *</label>
                  <input type="date" id="pay-date" required></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>طريقة الدفع</label>
                  <select id="pay-method">${METHODS.map(m => `<option>${m}</option>`).join('')}</select></div>
                <div class="form-group"><label>ملاحظات</label><input id="pay-note"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="submit" class="btn btn-success">💾 حفظ الدفعة</button>
              <button type="button" class="btn btn-secondary" onclick="PAY.closePay()">إلغاء</button>
            </div>
          </form>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    $('pay-grade').innerHTML = '<option value="">كل الصفوف</option>' +
      Object.keys(GRADE_NAMES).map(g => `<option value="${g}">${GRADE_NAMES[g]}</option>`).join('');

    $('pay-form').addEventListener('submit', submitPay);
  }

  /* =====================================================
     الأسعار
     ===================================================== */
  function loadFeeInputs() {
    const f = getFees();
    $('fee-primary').value     = f.primary || '';
    $('fee-preparatory').value = f.preparatory || '';
    $('fee-secondary').value   = f.secondary || '';
    $('fee-currency').value    = f.currency || '';
  }
  function saveFees() {
    setFees({
      primary:     Math.max(0, parseFloat($('fee-primary').value)     || 0),
      preparatory: Math.max(0, parseFloat($('fee-preparatory').value) || 0),
      secondary:   Math.max(0, parseFloat($('fee-secondary').value)   || 0),
      currency:    $('fee-currency').value.trim()
    });
    alert('✅ تم حفظ أسعار الأقساط');
    render();
  }

  /* =====================================================
     عرض الشهر
     ===================================================== */
  function buildMonthOptions() {
    const sel = $('pay-month'), keep = sel.value;
    sel.innerHTML = MONTHS.map(m =>
      `<option value="${m.n}">${m.name} ${yearOfMonth(m.n)}</option>`).join('');
    sel.value = keep || String(defaultMonth());
  }

  function getRows() {
    const n  = parseInt($('pay-month').value, 10);
    const q  = $('pay-search').value.trim().toLowerCase();
    const fs = $('pay-stage').value, fg = $('pay-grade').value, fu = $('pay-status').value;
    const map = payMap();

    return getStudents()
      .filter(s => s.status === 'active')
      .filter(s => {
        if (fs && s.stage !== fs) return false;
        if (fg && String(s.grade) !== fg) return false;
        if (q && !(fullName(s).toLowerCase().includes(q) ||
                   String(s.fileNumber).includes(q))) return false;
        return true;
      })
      .sort((a, b) => a.grade - b.grade ||
                      String(a.section).localeCompare(String(b.section), 'ar') ||
                      fullName(a).localeCompare(fullName(b), 'ar'))
      .map(s => {
        const pay = map[s.id + '|' + n];
        return { s, pay, status: statusOf(pay, n), fee: feeOf(s) };
      })
      .filter(r => !fu || r.status === fu);
  }

  function actionButtons(s, n, p) {
    if (!p) {
      return `<button class="btn btn-success btn-sm nowrap" onclick="PAY.openPay('${s.id}',${n})">💵 تسجيل دفع</button>`;
    }
    return `<button class="btn btn-secondary btn-sm" title="طباعة إيصال" onclick="PAY.receipt('${p.id}')">🧾</button>
            <button class="btn btn-warning btn-sm" title="تعديل" onclick="PAY.openPay('${s.id}',${n},'${p.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" title="إلغاء الدفعة" onclick="PAY.remove('${p.id}')">🗑️</button>`;
  }

  function render() {
    const st = getSettings(), f = getFees();
    $('pay-subtitle').textContent = `السنة الدراسية ${st.currentYear}`;
    buildMonthOptions();
    const n = parseInt($('pay-month').value, 10);

    $('pay-warn').innerHTML = (!f.primary && !f.preparatory && !f.secondary)
      ? '<div class="pay-warn">⚠️ لم تحدد قيمة القسط الشهري بعد. أدخل الأسعار في الأعلى ثم اضغط «حفظ الأسعار».</div>'
      : '';

    /* الإحصائيات (لكل الطلاب المستمرين في الشهر المختار) */
    const map = payMap();
    const active = getStudents().filter(s => s.status === 'active');
    let paidCount = 0, unpaidCount = 0, remaining = 0;
    active.forEach(s => {
      if (map[s.id + '|' + n]) paidCount++;
      else { unpaidCount++; remaining += feeOf(s); }
    });
    const collected = getPays()
      .filter(p => p.year === st.currentYear && p.month === n)
      .reduce((t, p) => t + (Number(p.amount) || 0), 0);

    $('pay-stats').innerHTML = `
      <div class="stat s-green"><div class="ico">💰</div>
        <div><div class="val">${fmt(collected)}</div><div class="lbl">المحصّل عن شهر ${monthName(n)}</div></div></div>
      <div class="stat s-blue"><div class="ico">✅</div>
        <div><div class="val">${paidCount} / ${active.length}</div><div class="lbl">الطلاب المسددون</div></div></div>
      <div class="stat s-orange"><div class="ico">⏳</div>
        <div><div class="val">${unpaidCount}</div><div class="lbl">لم يسددوا بعد</div></div></div>
      <div class="stat s-purple"><div class="ico">📌</div>
        <div><div class="val">${fmt(remaining)}</div><div class="lbl">المتبقي للتحصيل</div></div></div>`;

    /* الجدول */
    const rows = getRows();
    $('pay-tbody').innerHTML = rows.length ? rows.map((r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.s.fileNumber)}</td>
        <td><button class="link-btn" title="كشف حساب الطالب" onclick="PAY.ledger('${r.s.id}')">${esc(fullName(r.s))}</button></td>
        <td>${GRADE_NAMES[r.s.grade] || ''} / ${esc(r.s.section)}</td>
        <td>${r.fee ? fmt(r.fee) : '—'}</td>
        <td><span class="badge b-${r.status}">${STATUS_LABEL[r.status]}</span></td>
        <td>${r.pay ? dt(r.pay.date) : '—'}</td>
        <td>${r.pay ? fmt(r.pay.amount) : '—'}</td>
        <td>${actionButtons(r.s, n, r.pay)}</td>
      </tr>`).join('')
      : '<tr><td colspan="9" class="empty">لا توجد نتائج (تُعرض الطلاب بحالة «مستمر» فقط)</td></tr>';

    $('pay-count').textContent = `عرض ${rows.length} من أصل ${active.length} طالب مستمر`;
  }

  /* =====================================================
     تسجيل / تعديل / إلغاء دفعة
     ===================================================== */
  function openPay(studentId, n, payId) {
    const s = getStudents().find(x => String(x.id) === String(studentId));
    if (!s) return;
    const p = payId ? getPays().find(x => x.id === payId) : null;
    const fee = feeOf(s);

    $('pay-student-id').value = s.id;
    $('pay-month-n').value = n;
    $('pay-id').value = p ? p.id : '';
    $('pay-modal-title').textContent = p ? 'تعديل الدفعة' : 'تسجيل دفعة';
    $('pay-info').innerHTML = `
      <div><strong>${esc(fullName(s))}</strong> — رقم الملف ${esc(s.fileNumber)}</div>
      <div>${GRADE_NAMES[s.grade] || ''} — ${STAGE_NAMES[s.stage] || ''} — شعبة ${esc(s.section)}</div>
      <div>الشهر: <strong>${monthName(n)} ${yearOfMonth(n)}</strong> —
           القسط المقرر: <strong>${fee ? fmt(fee) : 'غير محدد'}</strong></div>`;
    $('pay-amount').value = p ? p.amount : (fee || '');
    $('pay-date').value   = p ? p.date : todayStr();
    $('pay-method').value = p ? p.method : METHODS[0];
    $('pay-note').value   = p ? (p.note || '') : '';
    $('pay-modal').classList.remove('hidden');
  }
  function closePay() { $('pay-modal').classList.add('hidden'); }

  function submitPay(e) {
    e.preventDefault();
    const sid = $('pay-student-id').value;
    const n   = parseInt($('pay-month-n').value, 10);
    const pid = $('pay-id').value;
    const amount = parseFloat($('pay-amount').value);
    if (!(amount > 0)) { alert('❌ أدخل مبلغاً صحيحاً أكبر من صفر'); return; }

    const year = getSettings().currentYear;
    const all = getPays();
    let rec;
    if (pid) {
      rec = all.find(p => p.id === pid);
      if (!rec) return;
    } else {
      if (all.some(p => String(p.studentId) === String(sid) && p.year === year && p.month === n)) {
        alert('هذا الشهر مسجل كمدفوع مسبقاً لهذا الطالب');
        return;
      }
      rec = {
        id: 'P' + Date.now() + Math.floor(Math.random() * 1000),
        receiptNo: nextReceipt(),
        studentId: sid, year, month: n,
        createdAt: new Date().toISOString()
      };
      all.push(rec);
    }
    rec.amount = amount;
    rec.date   = $('pay-date').value;
    rec.method = $('pay-method').value;
    rec.note   = $('pay-note').value.trim();
    setPays(all);

    closePay();
    refresh();
    if (confirm('✅ تم حفظ الدفعة.\nهل تريد طباعة إيصال الاستلام؟')) receipt(rec.id);
  }

  function remove(payId) {
    const p = getPays().find(x => x.id === payId);
    if (!p) return;
    if (!confirm(`هل تريد إلغاء هذه الدفعة (إيصال رقم ${p.receiptNo})؟\nلا يمكن التراجع.`)) return;
    setPays(getPays().filter(x => x.id !== payId));
    refresh();
  }

  /* =====================================================
     كشف حساب الطالب
     ===================================================== */
  let ledgerId = null;

  function ledgerData(s) {
    const map = payMap(), fee = feeOf(s);
    let paid = 0, due = 0, rest = 0;
    const rows = MONTHS.map(m => {
      const p = map[s.id + '|' + m.n];
      const status = statusOf(p, m.n);
      if (p) paid += Number(p.amount) || 0;
      else { rest += fee; if (status === 'unpaid') due += fee; }
      return { m, p, status };
    });
    return { rows, fee, paid, due, rest };
  }

  function ledgerHTML(s, actions) {
    const d = ledgerData(s);
    return `
      <div class="pay-info">
        <div><strong>${esc(fullName(s))}</strong> — رقم الملف ${esc(s.fileNumber)}</div>
        <div>${GRADE_NAMES[s.grade] || ''} — ${STAGE_NAMES[s.stage] || ''} — شعبة ${esc(s.section)}
             — السنة الدراسية ${esc(getSettings().currentYear)}</div>
        <div>القسط الشهري: <strong>${d.fee ? fmt(d.fee) : 'غير محدد'}</strong></div>
      </div>
      <table class="report-table">
        <thead><tr>
          <th>الشهر</th><th>القسط</th><th>الحالة</th><th>تاريخ الدفع</th>
          <th>المبلغ المدفوع</th><th>رقم الإيصال</th>${actions ? '<th>إجراءات</th>' : ''}
        </tr></thead>
        <tbody>
        ${d.rows.map(r => `
          <tr>
            <td>${r.m.name} ${yearOfMonth(r.m.n)}</td>
            <td>${d.fee ? fmt(d.fee) : '—'}</td>
            <td>${actions ? `<span class="badge b-${r.status}">${STATUS_LABEL[r.status]}</span>` : STATUS_LABEL[r.status]}</td>
            <td>${r.p ? dt(r.p.date) : '—'}</td>
            <td>${r.p ? fmt(r.p.amount) : '—'}</td>
            <td>${r.p ? esc(r.p.receiptNo) : '—'}</td>
            ${actions ? `<td>${actionButtons(s, r.m.n, r.p)}</td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
      <div class="pay-totals">
        <div>إجمالي المدفوع<strong>${fmt(d.paid)}</strong></div>
        <div>مستحق غير مدفوع حتى اليوم<strong style="color:#b91c1c">${fmt(d.due)}</strong></div>
        <div>المتبقي حتى نهاية العام<strong>${fmt(d.rest)}</strong></div>
      </div>`;
  }

  function renderLedger() {
    const s = getStudents().find(x => String(x.id) === String(ledgerId));
    if (!s) { closeLedger(); return; }
    $('ledger-title').textContent = 'كشف حساب: ' + fullName(s);
    $('ledger-body').innerHTML = ledgerHTML(s, true);
  }
  function ledger(id) {
    ledgerId = id;
    renderLedger();
    $('ledger-modal').classList.remove('hidden');
  }
  function closeLedger() {
    $('ledger-modal').classList.add('hidden');
    ledgerId = null;
  }
  function printLedger() {
    const s = getStudents().find(x => String(x.id) === String(ledgerId));
    if (!s) return;
    $('print-area').innerHTML = docHeader('كشف حساب الرسوم الدراسية') + ledgerHTML(s, false);
    window.print();
  }

  function refresh() {
    render();
    if (ledgerId && !$('ledger-modal').classList.contains('hidden')) renderLedger();
  }

  /* =====================================================
     إيصال الاستلام
     ===================================================== */
  function receipt(payId) {
    const p = getPays().find(x => x.id === payId);
    if (!p) return;
    const s = getStudents().find(x => String(x.id) === String(p.studentId));
    if (!s) return;

    $('print-area').innerHTML = docHeader('إيصال استلام رسوم دراسية') + `
      <table class="report-table">
        <tr><th style="width:30%">رقم الإيصال</th><td>${esc(p.receiptNo)}</td></tr>
        <tr><th>تاريخ الدفع</th><td>${dt(p.date)}</td></tr>
        <tr><th>اسم الطالب</th><td>${esc(fullName(s))}</td></tr>
        <tr><th>رقم الملف</th><td>${esc(s.fileNumber)}</td></tr>
        <tr><th>الصف / الشعبة</th><td>${GRADE_NAMES[s.grade] || ''} (${STAGE_NAMES[s.stage] || ''}) / ${esc(s.section)}</td></tr>
        <tr><th>القسط عن شهر</th><td>${monthName(p.month)} ${yearOfMonth(p.month)} — السنة الدراسية ${esc(p.year)}</td></tr>
        <tr><th>المبلغ المستلم</th><td><strong>${fmt(p.amount)}</strong></td></tr>
        <tr><th>طريقة الدفع</th><td>${esc(p.method)}</td></tr>
        <tr><th>ملاحظات</th><td>${esc(p.note) || '—'}</td></tr>
      </table>
      <div class="sign-row">
        <div>المحاسب / المستلم<br><br><br>........................</div>
        <div>ختم المدرسة<br><br><br>........................</div>
      </div>`;
    window.print();
  }

  /* =====================================================
     طباعة وتصدير كشف الشهر
     ===================================================== */
  function monthTitle() {
    const n = parseInt($('pay-month').value, 10);
    return `كشف المدفوعات — شهر ${monthName(n)} ${yearOfMonth(n)}`;
  }
  function printMonth() {
    const rows = getRows();
    $('print-area').innerHTML = docHeader(monthTitle()) + `
      <table class="report-table">
        <thead><tr><th>م</th><th>رقم الملف</th><th>اسم الطالب</th><th>الصف / الشعبة</th>
          <th>القسط</th><th>الحالة</th><th>تاريخ الدفع</th><th>المبلغ المدفوع</th></tr></thead>
        <tbody>
        ${rows.map((r, i) => `<tr>
          <td>${i + 1}</td><td>${esc(r.s.fileNumber)}</td><td>${esc(fullName(r.s))}</td>
          <td>${GRADE_NAMES[r.s.grade] || ''} / ${esc(r.s.section)}</td>
          <td>${r.fee ? fmt(r.fee) : '—'}</td><td>${STATUS_LABEL[r.status]}</td>
          <td>${r.pay ? dt(r.pay.date) : '—'}</td><td>${r.pay ? fmt(r.pay.amount) : '—'}</td>
        </tr>`).join('')}
        </tbody>
      </table>
      <p style="margin-top:10px;font-size:13px">عدد الطلاب: <strong>${rows.length}</strong></p>`;
    window.print();
  }
  function exportMonth() {
    const rows = getRows();
    if (!rows.length) { alert('لا توجد بيانات للتصدير'); return; }
    const n = parseInt($('pay-month').value, 10);
    const head = ['رقم الملف', 'اسم الطالب', 'المرحلة', 'الصف', 'الشعبة',
                  'قيمة الشهر', 'الحالة', 'تاريخ الدفع', 'المبلغ المدفوع',
                  'طريقة الدفع', 'رقم الإيصال', 'هاتف ولي الأمر'];
    const body = rows.map(r => [
      r.s.fileNumber, fullName(r.s), STAGE_NAMES[r.s.stage], GRADE_NAMES[r.s.grade], r.s.section,
      r.fee, STATUS_LABEL[r.status], r.pay ? r.pay.date : '', r.pay ? r.pay.amount : '',
      r.pay ? r.pay.method : '', r.pay ? r.pay.receiptNo : '', r.s.guardianPhone
    ]);
    downloadCSV([head, ...body], `payments_${getSettings().currentYear}_month${n}.csv`);
  }

  /* =====================================================
     دمج مع بقية النظام
     ===================================================== */
  const baseShowScreen = window.showScreen;
  window.showScreen = function (name) {
    baseShowScreen(name);
    if (name === 'payments') { loadFeeInputs(); render(); }
  };

  /* حذف الطالب يحذف مدفوعاته أيضاً */
  window.deleteStudent = function (id) {
    const s = getStudents().find(x => String(x.id) === String(id));
    if (!s) return;
    const cnt = getPays().filter(p => String(p.studentId) === String(id)).length;
    if (!confirm(`هل أنت متأكد من حذف الطالب: ${fullName(s)}؟` +
                 (cnt ? `\nسيتم أيضاً حذف ${cnt} دفعة مسجلة له.` : '') +
                 '\nلا يمكن التراجع عن هذا الإجراء.')) return;
    setStudents(getStudents().filter(x => String(x.id) !== String(id)));
    setPays(getPays().filter(p => String(p.studentId) !== String(id)));
    filterStudents();
    alert('✅ تم حذف الطالب');
  };

  /* النسخ الاحتياطي يشمل المدفوعات والأسعار */
  window.backup = function () {
    const data = {
      app: 'school-management', version: 2,
      exportedAt: new Date().toISOString(),
      settings: getSettings(), students: getStudents(),
      payments: getPays(), fees: getFees()
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type:'application/json' }));
    a.download = `school_backup_${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  window.restore = function (e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('سيتم استبدال كل البيانات الحالية (الطلاب والمدفوعات) بمحتوى النسخة. متابعة؟')) {
      e.target.value = '';
      return;
    }
    const r = new FileReader();
    r.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.students)) throw new Error('bad file');
        setStudents(data.students);
        if (data.settings) setSettings(data.settings);
        setPays(Array.isArray(data.payments) ? data.payments : []);
        if (data.fees) setFees(data.fees);
        alert('✅ تم استعادة البيانات بنجاح');
        location.reload();
      } catch (err) { alert('❌ الملف غير صالح'); }
    };
    r.readAsText(file);
  };

  window.clearAll = function () {
    if (!confirm('⚠️ سيتم حذف جميع بيانات الطلاب وسجل المدفوعات نهائياً. متابعة؟')) return;
    const t = prompt('اكتب كلمة "حذف" للتأكيد النهائي:');
    if (t !== 'حذف') { alert('تم الإلغاء'); return; }
    localStorage.removeItem(KEY_STUDENTS);
    localStorage.removeItem(KEY_PAY);
    alert('✅ تم حذف جميع البيانات');
    renderDashboard();
    filterStudents();
  };

  /* الدوال التي تُستدعى من أزرار الصفحة */
  window.PAY = {
    render, saveFees, openPay, closePay, remove,
    ledger, closeLedger, printLedger,
    receipt, printMonth, exportMonth
  };

  injectUI();
})();