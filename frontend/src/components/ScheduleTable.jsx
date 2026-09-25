import React, { useEffect, useState } from 'react'
import { StatusBadge, Card } from './ui'
import { API } from '../utils/constants'
import { 
  CalendarDays, Archive, ClipboardList, CheckCircle, 
  XCircle, Edit2, Printer, Trash2, MapPin, Clock, Filter, 
  ChevronLeft, ChevronRight, FileText, CheckCircle2
} from 'lucide-react'

const formatThaiDateShort = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' });
};

// 🌟 ฟังก์ชันดึงเฉพาะชื่อภาษาไทยจากชื่อวิชาเต็ม
const getThaiName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.split('-');
  const thaiPart = parts.find(p => /[ก-๙]/.test(p));
  return thaiPart ? thaiPart.trim() : parts[0].trim();
};

function ActionButtons({ item, role, onDelete, onUpdate, onEdit, onPrint }) {
  const confirm = (msg, fn) => { if (window.confirm(msg)) fn() }
  const status = item.status || 'รออนุมัติ'

  const btnStyle = { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', border: '1px solid', fontWeight: 'bold' };

  if (role === 'staff') return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {(status === 'รอตรวจสอบ' || status === 'รออนุมัติ' || status === 'ไม่อนุมัติ') && (
         <button onClick={() => onEdit(item)} style={{ ...btnStyle, color: '#F57F17', borderColor: '#FBC02D', background: '#FFFDE7' }}><Edit2 size={14} /> แก้ไข</button>
      )}
      {status === 'อนุมัติแล้ว' && (
        <button onClick={() => onPrint([item])} style={{ ...btnStyle, color: '#0288D1', borderColor: '#0288D1', background: '#E1F5FE' }}><Printer size={14} /> พิมพ์</button>
      )}
      <button onClick={() => confirm('ยกเลิกรายการนี้?', () => onDelete(item.id))} style={{ ...btnStyle, color: '#E53935', borderColor: '#E53935', background: '#FFEBEE' }}><Trash2 size={14} /> ยกเลิก</button>
    </div>
  )

  if (role === 'admin' && (status === 'รอตรวจสอบ' || status === 'รออนุมัติ')) return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <button onClick={() => confirm('ยืนยันการอนุมัติคำขอสอนชดเชยรายการนี้?', () => onUpdate(item.id, 'อนุมัติแล้ว'))} style={{ ...btnStyle, color: '#fff', borderColor: '#2E7D32', background: '#2E7D32' }}><CheckCircle size={14} /> อนุมัติ</button>
      <button onClick={() => {
        const reason = window.prompt('กรุณาระบุเหตุผลที่ตีกลับ/ไม่อนุมัติ (ถ้ามี):');
        if (reason !== null) onUpdate(item.id, 'ไม่อนุมัติ', reason);
      }} style={{ ...btnStyle, color: '#fff', borderColor: '#E53935', background: '#E53935' }}><XCircle size={14} /> ไม่อนุมัติ</button>
    </div>
  )

  return <span style={{ fontSize: 12, color: '#94A3B8' }}>—</span>
}

export default function ScheduleTable({ schedules, userRole, onDelete, onUpdateStatus, fetchSchedules, academicPeriod }) {
  const [execTab, setExecTab] = useState('pending')
  const [statusView, setStatusView] = useState('pending')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({})

  const [filterBranch, setFilterBranch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);

  const uniqueBranches = [...new Set(
    (schedules || []).map(s => (s.curriculum || s.branch || '').trim()).filter(Boolean)
  )];

  let baseSchedules = schedules || [];
  if (userRole === 'executive') {
    baseSchedules = schedules.filter(s => execTab === 'pending' ? s.status === 'รอผู้บริหารพิจารณา' : (s.status === 'อนุมัติแล้ว' || s.status === 'ไม่อนุมัติ'));
  }

  const displaySchedules = baseSchedules.filter(item => {
    let matchBranch = true;
    if (filterBranch) matchBranch = (item.curriculum === filterBranch) || (item.branch === filterBranch);

    const isPending = ['รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา'].includes(item.status);
    const matchStatus = userRole === 'executive' || statusView === 'all'
      ? true
      : statusView === 'pending' ? isPending : statusView === 'approved' ? item.status === 'อนุมัติแล้ว' : item.status === 'ไม่อนุมัติ';

    const matchPeriod = (!academicPeriod?.academic_year || !item.academic_year) ? true : 
                        (item.academic_year === academicPeriod.academic_year && item.semester === academicPeriod.semester);

    return matchBranch && matchStatus && matchPeriod;
  });

  useEffect(() => {
    setCurrentPage(1);
    setSelectedItems([]); 
  }, [filterBranch, statusView, execTab, schedules.length, academicPeriod]);

  const totalPages = Math.max(1, Math.ceil(displaySchedules.length / pageSize));
  const pageSchedules = displaySchedules.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePrintMulti = async (itemsToPrint) => {
    if (!itemsToPrint || itemsToPrint.length === 0) return;

    const teacherName = itemsToPrint[0].teacher_name;
    const allSameTeacher = itemsToPrint.every(i => i.teacher_name === teacherName);
    if (!allSameTeacher) {
      alert('กรุณาเลือกรายการของอาจารย์ท่านเดียวกันเท่านั้น เพื่อพิมพ์รวมในใบเดียวกัน');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("เบราว์เซอร์บล็อกป๊อปอัป!\n\nกรุณามองไปที่มุมขวาบนสุดของช่องพิมพ์ URL จะมีไอคอนกากบาทสีแดง ให้กดแล้วเลือก 'อนุญาต (Allow)' แล้วกดปุ่มพิมพ์อีกครั้ง");
      return;
    }

    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleDateString('th-TH', { month: 'long' });
    const year = today.getFullYear() + 543;

    let dbScheduleData = [];
    try {
      const params = new URLSearchParams({
        teacherName: teacherName,
        forBooking: 'true',
        academic_year: academicPeriod?.academic_year || '',
        semester: academicPeriod?.semester || ''
      });
      const res = await fetch(`${API}/teacher-classes?${params.toString()}`);
      const json = await res.json();
      dbScheduleData = json.success ? json.data : [];
    } catch (e) { console.error('ดึงตารางสอนไม่ได้:', e); }

    // 🌟 อัปเกรดฟังก์ชันทำความสะอาดชื่อกลุ่ม ให้ตัด / และกรอง Subset ซ้ำซ้อน 🌟
    const getCleanGroupName = (rawGroupStr, fullSubjName, subjCode) => {
      if (!rawGroupStr) return '';
      
      const normalizeForCompare = (str) => {
          return str.replace(/\s+/g, '').replace(/\(ทอ\.?\)/g, '(เทียบโอน)'); 
      };

      let cleanedRaw = rawGroupStr.replace(/[\n\r]/g, ' ').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      
      if (subjCode) {
         const codeRegex = new RegExp(`${subjCode}(_SEC_\\d+)?\\s*\\-?\\s*`, 'gi');
         cleanedRaw = cleanedRaw.replace(codeRegex, '');
      }

      if (fullSubjName) {
          const parts = fullSubjName.split('-').map(p => p.trim()).filter(Boolean);
          parts.forEach(part => {
              let escapedSubj = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              let regexStr = escapedSubj.split(/\s+/).join('\\s*');
              const nameRegex = new RegExp(regexStr, 'gi');
              cleanedRaw = cleanedRaw.replace(nameRegex, '');
          });
      }

      // หั่นด้วย | และ / เพื่อแยกข้อความออกมาตรวจสอบทีละชิ้น
      let fragments = cleanedRaw.split(/[|/]/).map(f => f.trim()).filter(Boolean);

      // ลบ (ท.) (ป.) และขีด (-) ที่หลงเหลืออยู่ออก
      fragments = fragments.map(f => {
          let res = f.replace(/^[\s\-|,]+/, '').trim();
          res = res.replace(/\s*\([ทป.,\s]+\)$/, '').replace(/\s*\(\s*[ทป]\.?\s*\)/g, '').trim();
          return res;
      }).filter(Boolean);

      // จัดเรียงจากข้อความยาวไปสั้น เพื่อให้ตัวที่ยาวที่สุดเป็นฐาน
      fragments.sort((a, b) => b.length - a.length);
      let finalGroups = [];

      // กรองกลุ่มย่อย (Subset) ที่ซ้ำซ้อนออก
      fragments.forEach(frag => {
          const normFrag = normalizeForCompare(frag);
          const isSubset = finalGroups.some(kept => normalizeForCompare(kept).includes(normFrag));
          if (!isSubset) {
              finalGroups.push(frag);
          }
      });

      return finalGroups.join(' | ');
    };

    let tableRowsHtml = '';
    const makeupClasses = [];

    itemsToPrint.forEach(item => {
      const missedDate = formatThaiDateShort(item.missed_date);
      const classDate = formatThaiDateShort(item.class_date);
      const startTime = item.start_time ? item.start_time.slice(0, 5) : '';
      const endTime = item.end_time ? item.end_time.slice(0, 5) : '';

      const rawGroup = item.student_group || '';
      const fullSubjName = (item.subject_name || '').trim();
      
      const displaySubjName = getThaiName(fullSubjName);
      
      let isTheoryOnly = false;
      let isPracticalOnly = false;
      const isBoth = rawGroup.includes('(ท.,ป.)') || rawGroup.includes('(ท,ป)') || rawGroup.includes('(ท., ป.)');

      if (!isBoth) {
        if (rawGroup.includes('(ท.)') || rawGroup.includes('(ท)')) isTheoryOnly = true;
        if (rawGroup.includes('(ป.)') || rawGroup.includes('(ป)')) isPracticalOnly = true;
      }

      let printGroupName = getCleanGroupName(rawGroup, fullSubjName, item.subject_code);
      const typeLabel = isBoth ? ' (ท.,ป.)' : isTheoryOnly ? ' (ท.)' : isPracticalOnly ? ' (ป.)' : '';
      
      const fullGroupDisplayHTML = `${item.subject_code} SEC_1<br/>${displaySubjName}<br/>${printGroupName}${typeLabel}`;
      const fullGroupDisplayInline = `${printGroupName}${typeLabel}`;

      const targetDay = new Date(item.class_date || new Date()).getDay();
      
      const sTime = parseFloat(startTime.split(':')[0]) + parseFloat(startTime.split(':')[1] || 0)/60;
      const eTime = parseFloat(endTime.split(':')[0]) + parseFloat(endTime.split(':')[1] || 0)/60;
      const startHour = Math.floor(sTime);
      const endHour = Math.ceil(eTime);

      makeupClasses.push({ dayOfWeek: targetDay, start: startHour, end: endHour, title: fullGroupDisplayHTML, isMakeup: true });

      let tHours = item.theory_hours;
      let pHours = item.practical_hours;
      let sec = item.sector;

      if (dbScheduleData && dbScheduleData.length > 0) {
        const matchedMainClass = dbScheduleData.find(c => c.subject_code === item.subject_code);
        if (matchedMainClass) {
          tHours = matchedMainClass.theory_hours;
          pHours = matchedMainClass.practical_hours;
          sec = matchedMainClass.sector;
        }
      }

      const formatHour = (val) => {
        const num = parseFloat(val);
        return (isNaN(num) || num === 0) ? '-' : num.toString();
      };

      let showT = formatHour(tHours);
      let showP = formatHour(pHours);

      if (isBoth || (!isTheoryOnly && !isPracticalOnly)) {
      } else if (isTheoryOnly && !isPracticalOnly) {
          showP = '-';
      } else if (isPracticalOnly && !isTheoryOnly) {
          showT = '-';
      }

      const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';
      const normalTimeDisplay = item.normal_start_time && item.normal_end_time 
        ? `${formatTime(item.normal_start_time)}-${formatTime(item.normal_end_time)}` : '-';

      tableRowsHtml += `
        <tr class="row-normal" style="height:35px;">
          <td>${missedDate || '-'}</td>
          <td class="text-muted">-</td>
          <td>${normalTimeDisplay}</td>
          <td>${item.subject_code || '-'}</td>
          <td style="text-align: left; padding-left: 4px; line-height: 1.2;">${displaySubjName}</td>
          <td>${showT}</td>
          <td>${showP}</td>
          <td style="font-size: 10.5px;">${fullGroupDisplayInline}</td>
          <td>${sec || 'ปกติ'}</td>
          <td>${item.normal_room_id || '-'}</td>
          <td></td>
        </tr>
        <tr class="row-makeup" style="height:35px;">
          <td class="text-muted">-</td>
          <td>${classDate}</td>
          <td>${startTime}-${endTime}</td>
          <td>${item.subject_code || '-'}</td>
          <td style="text-align: left; padding-left: 4px; line-height: 1.2;">${displaySubjName}</td>
          <td>${showT}</td>
          <td>${showP}</td>
          <td style="font-size: 10.5px;">${fullGroupDisplayInline}</td>
          <td>${sec || 'ปกติ'}</td>
          <td>${item.room_id || ''}</td>
          <td></td>
        </tr>
      `;
    });

    const getDayIndex = (dayStr) => {
      if (!dayStr) return -1;
      const str = String(dayStr).replace(/วัน/g, '').trim();
      const days = { 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'ศุกร์': 5, 'เสาร์': 6, 'อาทิตย์': 0 };
      return days[str] !== undefined ? days[str] : -1;
    };

    let regularClasses = (Array.isArray(dbScheduleData) ? dbScheduleData : [])
      .filter(dbItem => dbItem && dbItem.start_time && dbItem.end_time)
      .map(dbItem => {
        const sTime = parseFloat(dbItem.start_time.split(':')[0]) + parseFloat(dbItem.start_time.split(':')[1] || 0)/60;
        const eTime = parseFloat(dbItem.end_time.split(':')[0]) + parseFloat(dbItem.end_time.split(':')[1] || 0)/60;
        const startBlock = Math.floor(sTime);
        const endBlock = Math.ceil(eTime);
        
        const rawGroup = dbItem.student_group || '';
        const fullSubjName = (dbItem.subject_name || '').trim();
        const displaySubjName = getThaiName(fullSubjName);
        
        let finalG = getCleanGroupName(rawGroup, fullSubjName, dbItem.subject_code);

        let tLabel = '';
        if (rawGroup.includes('(ท,ป)') || rawGroup.includes('(ท.,ป.)') || rawGroup.includes('(ท., ป.)')) tLabel = ' (ท.,ป.)';
        else if (rawGroup.includes('(ท)') || rawGroup.includes('(ท.)')) tLabel = ' (ท.)';
        else if (rawGroup.includes('(ป)') || rawGroup.includes('(ป.)')) tLabel = ' (ป.)';
        
        const classTitle = `${dbItem.subject_code} SEC_1<br/>${displaySubjName}<br/>${finalG}${tLabel}`;

        return { dayOfWeek: getDayIndex(dbItem.day_of_week), start: startBlock, end: endBlock, title: classTitle, isMakeup: false };
      }).filter(cls => cls.dayOfWeek !== -1);

    regularClasses.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.start - b.start;
    });

    const teacherSchedule = [...regularClasses, ...makeupClasses]; 
    const daysMap = [{ id: 1, name: 'จันทร์' }, { id: 2, name: 'อังคาร' }, { id: 3, name: 'พุธ' }, { id: 4, name: 'พฤหัสบดี' }, { id: 5, name: 'ศุกร์' }, { id: 6, name: 'เสาร์' }, { id: 0, name: 'อาทิตย์' }];

    let scheduleRowsHtml = '';
    for (const d of daysMap) {
      scheduleRowsHtml += `<tr><td class="day-cell">${d.name}</td>`;
      const classesToday = teacherSchedule.filter(c => c.dayOfWeek === d.id).sort((a, b) => a.start - b.start);
      
      let currentCursor = 8;
      for (const cls of classesToday) {
        if (cls.start < currentCursor) continue;
        while (currentCursor < cls.start && currentCursor < 22) { scheduleRowsHtml += `<td></td>`; currentCursor++; }
        
        const span = cls.end - cls.start;
        if (span > 0 && currentCursor < 22) {
          const actualSpan = Math.min(span, 22 - currentCursor); 
          scheduleRowsHtml += `<td colspan="${actualSpan}" style="background-color: ${cls.isMakeup ? '#e0e0e0' : '#ffffff'}; font-weight: normal; border: 1px solid #000; font-size: 11px; line-height: 1.3;">${cls.title}</td>`;
          currentCursor += actualSpan;
        }
      }
      while (currentCursor < 22) { scheduleRowsHtml += `<td></td>`; currentCursor++; }
      scheduleRowsHtml += `</tr>`;
    }

    const htmlContent = `
      <html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ใบแจ้งทำการสอนชดเชย</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
    @page { size: A4 landscape; margin: 5mm 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Sarabun', 'TH Sarabun New', sans-serif; font-size: 13px; color: #000; background: #fff; padding: 4mm 6mm; }
    .page-wrapper { display: flex; width: 100%; gap: 8px; }
    .left-col { width: 75%; }
    .header-bar { display: flex; align-items: center; padding: 2px 8px; gap: 8px; }
    .header-bar img { width: 80px; height: 80px; object-fit: contain; }
    .header-title { flex: 1; text-align: center; font-size: 15px; font-weight: bold; line-height: 1.4; }
    .header-title span { text-decoration: underline; }
    .date-row { display: flex; justify-content: center; padding: 2px 10px; font-size: 13px; gap: 4px; align-items: baseline; }
    .dotted-field { border-bottom: 1px dotted #000; display: inline-block; min-width: 30px; text-align: center; vertical-align: baseline; line-height: 1.4; }
    .subject-rows { padding: 2px 10px; font-size: 13px; line-height: 1.6; }
    .subject-rows .indent { text-indent: 48px; }
    .info-table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 5px; margin-bottom: 5px; }
    .info-table th, .info-table td { border: 1px solid #000; padding: 2px 2px; text-align: center; vertical-align: middle; }
    .info-table th { background: transparent; font-weight: normal; font-size: 11px; line-height: 1.2; }
    .info-table td { height: 30px; }
    .schedule-header { padding: 2px 8px 2px; font-size: 12px; }
    .schedule-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    .schedule-table th, .schedule-table td { border: 1px solid #000; padding: 1px 1px; text-align: center; vertical-align: middle; }
    .schedule-table th { background: transparent; font-weight: normal; line-height: 1.1; }
    .schedule-table td { height: 20px; }
    .schedule-table td.day-cell { font-size: 10px; background: transparent; width: 48px; }
    .note-section { padding: 4px 8px; font-size: 11px; line-height: 1.4; }
    .right-col { width: 25%; display: flex; flex-direction: column; justify-content: flex-start; gap: 10px; padding-top: 45px; }
    .approval-box { padding: 6px 8px 6px; display: flex; flex-direction: column; align-items: center; text-align: center; border: none; }
    .approval-box .box-title { font-weight: bold; font-size: 12.5px; margin-bottom: 2px; text-align: center; }
    .approval-box .sub-text { font-size: 11.5px; line-height: 1.4; text-align: center; }
    .approval-box .checkbox-row { display: flex; gap: 10px; margin-top: 2px; font-size: 11.5px; justify-content: center; }
    .checkbox-item::before { content: '○ '; }
    .sign-area { text-align: center; margin-top: 4px; padding-top: 0; font-size: 11.5px; line-height: 1.6; width: 100%; }
    
    .row-normal td { background-color: #FAFAFA; }
    .row-makeup td { background-color: #FFFFFF; }
    .text-muted { color: #616161; font-size: 10px; }
    
    @media print { 
      body { padding: 0; } 
      .row-normal td { background-color: transparent !important; }
    }
  </style>
</head>
<body>
<div class="page-wrapper">
  <div class="left-col">
    <div class="header-bar">
      <img src="${window.location.origin}/logo.png" alt="โลโก้ มทร.ล้านนา">
      <div class="header-title">ใบแจ้งทำการ<span>สอนชดเชย</span> ครู-อาจารย์ มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา ตาก</div>
    </div>
    <div class="date-row">
      วันที่&nbsp;<span class="dotted-field" style="width:36px;">${day}</span>&nbsp;
      เดือน&nbsp;<span class="dotted-field" style="width:100px;">${month}</span>&nbsp;
      พ.ศ.&nbsp;<span class="dotted-field" style="width:55px;">${year}</span>
    </div>
    <div class="subject-rows">
      <div><b>เรื่อง</b>&nbsp; ขออนุญาต<span style="text-decoration:underline;">สอนชดเชย</span></div>
      <div><b>เรียน</b>&nbsp; รองคณบดีคณะวิทยาศาสตร์และเทคโนโลยีการเกษตร</div>
      <div class="indent">ด้วยข้าพเจ้า <span class="dotted-field" style="width:220px;">${itemsToPrint[0].teacher_name || ''}</span>&nbsp;ติดภารกิจไม่สามารถมาปฏิบัติราชการ</div>
      <div>เนื่องจาก <span class="dotted-field" style="width:62%; text-align: left; padding-left: 10px;">${itemsToPrint[0].reason || '-'}</span>&nbsp;จึงขออนุญาตทำการสอนชดเชย ดังนี้</div>
    </div>
    <table class="info-table">
      <thead>
        <tr>
          <th rowspan="2" style="width:9%;">วัน/เดือน/ปี<br>ที่ไม่เข้าสอน</th>
          <th rowspan="2" style="width:9%;">วัน/เดือน/ปี<br>ที่สอนชดเชย</th>
          <th rowspan="2" style="width:9%;">เวลา</th>
          <th rowspan="2" style="width:8%;">รหัสวิชา</th>
          <th rowspan="2" style="width:16%;">ชื่อวิชา</th>
          <th colspan="2" style="width:10%;">จำนวนชั่วโมงที่สอน</th>
          <th rowspan="2" style="width:14%;">แผนกวิชา / ชั้น<br>สาขาวิชา / ชั้น</th>
          <th rowspan="2" style="width:5%;">ภาค</th>
          <th rowspan="2" style="width:8%;">ห้องเรียน</th>
          <th rowspan="2" style="width:12%;">ลายเซ็นชื่อ</th>
        </tr>
        <tr><th style="width:5%;">ทฤษฎี</th><th style="width:5%;">ปฏิบัติ</th></tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>
    <div class="schedule-header">พร้อมทั้งได้แสดงตารางการสอนส่วนบุคคล ของผู้เข้าสอนชดเชยในวันทำการสอนชดเชย</div>
    <table class="schedule-table">
      <thead>
        <tr>
          <th rowspan="2" style="width:52px;">วัน \\ เวลา</th>
          <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th><th>14</th>
        </tr>
        <tr>
          <th>8.00-9.00</th><th>9.00-10.00</th><th>10.00-11.00</th><th>11.00-12.00</th><th>12.00-13.00</th><th>13.00-14.00</th><th>14.00-15.00</th>
          <th>15.00-16.00</th><th>16.00-17.00</th><th>17.00-18.00</th><th>18.00-19.00</th><th>19.00-20.00</th><th>20.00-21.00</th><th>21.00-22.00</th>
        </tr>
      </thead>
      <tbody>
        ${scheduleRowsHtml}
      </tbody>
    </table>
    <div class="note-section">
      <div><b>หมายเหตุ</b>&nbsp; 1. ใบแจ้งทำการสอนชดเชยนี้ให้นำส่งสาขาก่อนวันที่ทำการสอนชดเชย 3 วันทำการ</div>
      <div style="padding-left:52px;">2. แนบรายชื่อ และหลักสูตรของนักศึกษาที่ทำการสอน</div>
    </div>
  </div>
  <div class="right-col">
    <div class="approval-box">
      <div class="box-title">ผู้ตรวจสอบการสอนชดเชย</div>
      <div class="sub-text">ตรวจสอบแล้ว เห็นควรพิจารณาอนุญาต</div>
      <div class="sign-area">
        <span style="font-size:11px;">(.................................................)</span><br>
        <span style="font-size:11.5px;">หัวหน้าหลักสูตร ...............................</span><br>
        <span style="font-size:11.5px;">วันที่........../.................../..........</span>
      </div>
    </div>
    <div class="approval-box">
      <div class="box-title">ผู้รับรองการสอนชดเชย</div>
      <div class="checkbox-row"><span class="checkbox-item">เห็นควรอนุญาต</span><span class="checkbox-item">ไม่อนุญาต</span></div>
      <div class="sign-area">
        <span style="font-size:11px;">(.................................................)</span><br>
        <span style="font-size:11.5px;">หัวหน้าสาขา .....................................</span><br>
        <span style="font-size:11.5px;">วันที่........../.................../..........</span>
      </div>
    </div>
    <div class="approval-box">
      <div class="box-title">ผู้อนุญาตการสอนชดเชย</div>
      <div class="checkbox-row"><span class="checkbox-item">อนุญาต</span><span class="checkbox-item">ไม่อนุญาต</span></div>
      <div class="sign-area">
        <span style="font-size:11px;">(.................................................)</span><br>
        <span style="font-size:11.5px;">รองคณบดีคณะวิทยาศาสตร์และเทคโนโลยีการเกษตร</span><br>
        <span style="font-size:11.5px;">วันที่........../.................../..........</span>
      </div>
    </div>
  </div></div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
</body>
</html>
  `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleOpenEdit = (item) => {
    const d = new Date(item.class_date);
    const dateStr = !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
    
    const m_d = item.missed_date ? new Date(item.missed_date) : null;
    const missedDateStr = m_d && !isNaN(m_d) ? `${m_d.getFullYear()}-${String(m_d.getMonth()+1).padStart(2,'0')}-${String(m_d.getDate()).padStart(2,'0')}` : '';

    setEditForm({ ...item, class_date: dateStr, missed_date: missedDateStr, start_time: item.start_time ? item.start_time.slice(0, 5) : '', end_time: item.end_time ? item.end_time.slice(0, 5) : '', reason: item.reason || '' });
    setEditingItem(item);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/schedules/${editingItem.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, reason: editForm.reason === 'อื่นๆ' ? editForm.reason_other : editForm.reason, start_time: editForm.start_time + ':00', end_time: editForm.end_time + ':00', status: 'รอตรวจสอบ' })
      });     
      const json = await res.json();
      if (json.success) { alert('แก้ไขข้อมูลสำเร็จ'); setEditingItem(null); if (fetchSchedules) fetchSchedules(); } else { alert(json.message); }
    } catch (error) { alert('เกิดข้อผิดพลาดในการเชื่อมต่อ'); }
  };

  const hasActions = ['admin', 'staff'].includes(userRole) || (userRole === 'executive' && execTab === 'pending');
  const showDocuments = ['admin', 'staff'].includes(userRole);
  const showCheckboxes = userRole === 'staff';

  const headers = [
    ...(showCheckboxes ? ['เลือก'] : []), 
    'วันที่ไม่ได้สอน', 'เหตุผล', 'วันที่สอนชดเชย', 'เวลา', 'รหัส/ชื่อวิชา', 'กลุ่มเรียน', 'ห้อง', 'อาจารย์', 'สถานะ', 
    ...(showDocuments ? ['เอกสาร'] : []), ...(hasActions ? ['จัดการ'] : [])
  ];

  return (
    <Card style={{ padding: '24px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', marginTop: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#E8F5E9', padding: '10px', borderRadius: '10px', color: '#1B5E20' }}>
             {userRole === 'executive' && execTab === 'history' ? <Archive size={24}/> : <CalendarDays size={24} />}
          </div>
          <h2 style={{ margin: 0, color: '#1B5E20', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {userRole === 'executive' && execTab === 'history' ? "ประวัติการอนุมัติคำขอ" : "สถานะคำขอสอนชดเชย"}
            <span style={{ fontSize: '13px', background: '#F1F5F9', color: '#475569', padding: '4px 10px', borderRadius: '50px', border: '1px solid #E2E8F0' }}>
              ปี {academicPeriod?.academic_year || '-'} / เทอม {academicPeriod?.semester || '-'}
            </span>
          </h2>
        </div>
        
        {userRole === 'executive' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setExecTab('pending')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '50px', fontSize: '14px', fontWeight: 'bold', border: 'none', cursor: 'pointer', background: execTab === 'pending' ? '#1976D2' : '#F1F5F9', color: execTab === 'pending' ? '#fff' : '#64748B' }}>
              <ClipboardList size={16} /> รอพิจารณาอนุมัติ
            </button>
            <button onClick={() => setExecTab('history')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '50px', fontSize: '14px', fontWeight: 'bold', border: 'none', cursor: 'pointer', background: execTab === 'history' ? '#2E7D32' : '#F1F5F9', color: execTab === 'history' ? '#fff' : '#64748B' }}>
              <Archive size={16} /> ประวัติย้อนหลัง
            </button>
          </div>
        )}
      </div>

      {userRole !== 'executive' && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '2px solid #F1F5F9', paddingBottom: '10px', overflowX: 'auto' }}>
          {[
            { id: 'pending', label: 'กำลังรอดำเนินการ', color: '#C47A16', activeBg: '#FFF8E1' },
            { id: 'approved', label: 'อนุมัติแล้ว', color: '#237A4B', activeBg: '#E8F5E9' },
            { id: 'rejected', label: 'ไม่อนุมัติ', color: '#B42318', activeBg: '#FFEBEE' },
            { id: 'all', label: 'ทั้งหมด', color: '#475569', activeBg: '#F1F5F9' },
          ].map(tab => {
            const count = baseSchedules.filter(item => {
              const mPeriod = (!academicPeriod?.academic_year || !item.academic_year) ? true : (item.academic_year === academicPeriod.academic_year && item.semester === academicPeriod.semester);
              if (!mPeriod) return false;
              if (tab.id === 'all') return true;
              if (tab.id === 'pending') return ['รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา'].includes(item.status);
              return item.status === tab.label;
            }).length;
            const isActive = statusView === tab.id;
            return (
              <button key={tab.id} onClick={() => setStatusView(tab.id)} style={{ background: isActive ? tab.activeBg : 'transparent', border: 'none', padding: '8px 16px', borderRadius: '50px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', color: isActive ? tab.color : '#64748B', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s', boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                {tab.label}
                <span style={{ background: isActive ? tab.color : '#E2E8F0', color: isActive ? '#fff' : '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '24px', background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1B5E20', fontWeight: 'bold', fontSize: '14px', marginRight: '8px' }}><Filter size={18} /> ตัวกรอง</div>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #CFE2D4', outline: 'none', cursor: 'pointer', backgroundColor: '#ffffff', color: '#1B5E20', fontFamily: 'inherit', fontSize: '13px', fontWeight: '500' }}>
            <option value="">-- ทุกสาขา --</option>
            {uniqueBranches.map(branch => <option key={branch} value={branch}>{branch}</option>)}
          </select>
          <button onClick={() => setFilterBranch('')} style={{ padding: '10px 16px', background: '#ffffff', color: '#1B5E20', border: '1px solid #1B5E20', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>ล้างตัวกรอง</button>
        </div>

        {selectedItems.length > 0 && showCheckboxes && (
          <button onClick={() => handlePrintMulti(selectedItems)} style={{ background: '#0284C7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}>
            <Printer size={18} /> พิมพ์คำขอที่เลือก ({selectedItems.length} รายการ)
          </button>
        )}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <table style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#334155', textAlign: 'left' }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '16px 14px', fontWeight: 'bold', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap', textAlign: h === 'เลือก' || h === 'กลุ่มเรียน' || h === 'จัดการ' || h === 'เอกสาร' || h === 'ห้อง' ? 'center' : 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displaySchedules.length === 0 ? (
              <tr>
                <td colSpan={headers.length} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}><FileText size={32} opacity={0.5} /><span>ยังไม่มีข้อมูลคำขอในหมวดหมู่นี้ หรือ ปีการศึกษานี้</span></div>
                </td>
              </tr>
            ) : pageSchedules.map((item, idx) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', background: idx % 2 === 0 ? '#ffffff' : '#F8FAFC' }}>
                
                {showCheckboxes && (
                  <td style={{ padding: '16px 14px', textAlign: 'center' }}>
                    {item.status === 'อนุมัติแล้ว' ? (
                      <input 
                        type="checkbox" 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        checked={selectedItems.some(s => s.id === item.id)} 
                        onChange={() => {
                          const isSelected = selectedItems.some(s => s.id === item.id);
                          if (isSelected) setSelectedItems(selectedItems.filter(s => s.id !== item.id));
                          else setSelectedItems([...selectedItems, item]);
                        }} 
                      />
                    ) : <span style={{ color: '#CBD5E1' }}>-</span>}
                  </td>
                )}

                <td style={{ padding: '16px 14px', color: '#991B1B', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.missed_date ? new Date(item.missed_date).toLocaleDateString('th-TH') : '-'}</td>
                <td style={{ padding: '16px 14px', color: '#475569', maxWidth: 160, wordBreak: 'break-word' }}>{item.reason || '-'}</td>
                <td style={{ padding: '16px 14px', color: '#166534', fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(item.class_date).toLocaleDateString('th-TH')}</td>
                <td style={{ padding: '16px 14px', color: '#475569', whiteSpace: 'nowrap' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} color="#64748B" /> {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}</div></td>
                <td style={{ padding: '16px 14px', maxWidth: 180 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ background: '#E8F5E9', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', width: 'fit-content' }}>{item.subject_code || '-'}</span>
                    <span style={{ fontSize: '13px', color: '#475569', wordBreak: 'break-word', lineHeight: '1.4' }}>{getThaiName(item.subject_name) || '(ไม่ระบุชื่อวิชา)'}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 14px', color: '#475569', fontSize: 13, textAlign: 'center', maxWidth: 140 }}>{item.student_group ? item.student_group.split('|').map((group, idx) => (<div key={idx} style={{ padding: '2px 0', wordBreak: 'break-word' }}>{group.trim()}</div>)) : '-'}</td>
                <td style={{ padding: '16px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}><div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#DCFCE7', color: '#166534', padding: '4px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #BBF7D0' }}><MapPin size={14} /> {item.room_id}</div></td>
                <td style={{ padding: '16px 14px', color: '#1E293B', textAlign: 'left', maxWidth: 140, wordBreak: 'break-word', fontWeight: '500' }}>{item.title || 'อาจารย์'} {item.teacher_name}</td>
                <td style={{ padding: '16px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}><StatusBadge status={item.status} /></td>
                
                {showDocuments && (
                  <td style={{ padding: '16px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {item.document_path ? ( <a href={`${API.replace('/api', '')}${item.document_path}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F0F9FF', color: '#0284C7', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none', border: '1px solid #BAE6FD' }}><CheckCircle2 size={14} /> มีไฟล์</a> ) : <span style={{ color: '#94A3B8', fontSize: '12px' }}>ไม่มีไฟล์</span>}
                  </td>
                )}
                
                {hasActions && (
                  <td style={{ padding: '16px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <ActionButtons item={item} role={userRole} onDelete={onDelete} onUpdate={onUpdateStatus} onEdit={handleOpenEdit} onPrint={handlePrintMulti} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {displaySchedules.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <span style={{ color: '#64748B', fontSize: '14px' }}>แสดง {(currentPage - 1) * pageSize + 1} ถึง {Math.min(currentPage * pageSize, displaySchedules.length)} จากทั้งหมด {displaySchedules.length} รายการ</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '14px' }}><ChevronLeft size={16} /> ก่อนหน้า</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (<button key={page} onClick={() => setCurrentPage(page)} style={{ width: '36px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', background: currentPage === page ? '#1B5E20' : '#F1F5F9', color: currentPage === page ? 'white' : '#64748B', transition: 'all 0.2s' }}>{page}</button>))}
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '14px' }}>ถัดไป <ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}

      {editingItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', padding: '32px', borderRadius: '20px', width: '550px', maxWidth: '90%', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: 0, color: '#1E293B', fontSize: '20px', fontWeight: 'bold', marginBottom: '24px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>แก้ไขข้อมูลคำขอสอนชดเชย</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: 14, fontWeight: 'bold', color: '#991B1B', display: 'block', marginBottom: '8px' }}>วันที่ไม่ได้เข้าสอน</label><input type="date" value={editForm.missed_date || ''} onChange={e => setEditForm({...editForm, missed_date: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #FECACA', borderRadius: '10px', outline: 'none', background: '#FEF2F2', fontSize: '15px', color: '#7F1D1D' }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: 14, fontWeight: 'bold', color: '#991B1B', display: 'block', marginBottom: '8px' }}>เหตุผล</label><select value={editForm.reason || ''} onChange={e => setEditForm({...editForm, reason: e.target.value, reason_other: ''})} style={{ width: '100%', padding: '12px', border: '1px solid #FECACA', borderRadius: '10px', outline: 'none', background: '#FEF2F2', fontSize: '15px', color: '#7F1D1D' }}><option value="">-- เลือกเหตุผล --</option><option value="ไปราชการ">ไปราชการ</option><option value="วันหยุดราชการ">วันหยุดราชการ</option><option value="ลาป่วยลากิจ">ลาป่วยลากิจ</option><option value="อื่นๆ">อื่นๆ</option></select>{editForm.reason === 'อื่นๆ' && (<input type="text" placeholder="ระบุเหตุผล..." value={editForm.reason_other || ''} onChange={e => setEditForm({...editForm, reason_other: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #FECACA', borderRadius: '10px', outline: 'none', background: '#FEF2F2', fontSize: '15px', color: '#7F1D1D', marginTop: '10px' }} />)}</div>
              </div>
              <div style={{ borderTop: '1px dashed #CBD5E1', margin: '4px 0' }} />
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '8px' }}>วันที่สอนชดเชย</label><input required type="date" value={editForm.class_date} onChange={e => setEditForm({...editForm, class_date: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #BBF7D0', borderRadius: '10px', outline: 'none', background: '#F0FDF4', fontSize: '15px', color: '#14532D' }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '8px' }}>ห้องเรียน</label><input required type="text" value={editForm.room_id} onChange={e => setEditForm({...editForm, room_id: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #BBF7D0', borderRadius: '10px', outline: 'none', background: '#F0FDF4', fontSize: '15px', color: '#14532D' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}><label style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '8px' }}>เริ่มสอน</label><input required type="time" value={editForm.start_time} onChange={e => setEditForm({...editForm, start_time: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #BBF7D0', borderRadius: '10px', outline: 'none', background: '#F0FDF4', fontSize: '15px', color: '#14532D' }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontSize: 14, fontWeight: 'bold', color: '#166534', display: 'block', marginBottom: '8px' }}>สิ้นสุด</label><input required type="time" value={editForm.end_time} onChange={e => setEditForm({...editForm, end_time: e.target.value})} style={{ width: '100%', padding: '12px', border: '1px solid #BBF7D0', borderRadius: '10px', outline: 'none', background: '#F0FDF4', fontSize: '15px', color: '#14532D' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" onClick={() => setEditingItem(null)} style={{ padding: '12px 24px', background: '#ffffff', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}>ยกเลิก</button>
                <button type="button" onClick={handleSaveEdit} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 24px', background: '#1B5E20', color: '#ffffff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}><CheckCircle size={18} /> บันทึกข้อมูล</button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </Card>
  )
}