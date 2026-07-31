import React, { useState } from 'react'
import { StatusBadge, Btn, Card, SectionTitle } from './ui'
import { API } from '../utils/constants'

// 🌟 ฟังก์ชันแปลงวันที่ให้เป็นแบบไทยสั้นๆ (เช่น 15 มิ.ย. 67)
const formatThaiDateShort = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' });
};

function ActionButtons({ item, role, onDelete, onUpdate, onEdit }) {
  const confirm = (msg, fn) => { if (window.confirm(msg)) fn() }
  const status = item.status || 'รออนุมัติ'

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("⚠️ เบราว์เซอร์บล็อกป๊อปอัปครับ!\n\nกรุณามองไปที่มุมขวาบนสุดของช่องพิมพ์ URL จะมีไอคอนกากบาทสีแดง ให้กดแล้วเลือก 'อนุญาต (Allow)' แล้วกดปุ่มพิมพ์อีกครั้งครับ");
      return;
    }
    
    const today = new Date();
    const day = today.getDate();
    const month = today.toLocaleDateString('th-TH', { month: 'long' });
    const year = today.getFullYear() + 543;
    
    const missedDate = formatThaiDateShort(item.missed_date);
    const classDate = formatThaiDateShort(item.class_date);

    const startTime = item.start_time ? item.start_time.slice(0, 5) : '';
    const endTime = item.end_time ? item.end_time.slice(0, 5) : '';

    const formattedGroup = item.student_group
      ? item.student_group.split('|').map(g => {
          const parts = g.trim().split(' - ');
          return parts.length > 1 ? parts[1].trim() : g.trim();
        }).join(', ') 
      : '-';

    const groupCode = item.student_group
      ? item.student_group.split('|').map(g => g.split(' - ')[0].trim()).join(', ')
      : '';

    const targetDay = new Date(item.class_date || new Date()).getDay();
    const startHour = startTime ? parseInt(startTime.split(':')[0], 10) : 8;
    const endMins = endTime ? parseInt(endTime.split(':')[1], 10) : 0;
    const endHour = endTime ? parseInt(endTime.split(':')[0], 10) + (endMins > 0 ? 1 : 0) : 9;

    const makeupClass = {
      dayOfWeek: targetDay, 
      start: startHour, 
      end: endHour, 
      title: groupCode, 
      isMakeup: true 
    };

    const getDayIndex = (dayStr) => {
      if (!dayStr) return -1;
      const str = String(dayStr).trim();
      const days = { 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'ศุกร์': 5, 'เสาร์': 6, 'อาทิตย์': 0 };
      return days[str] !== undefined ? days[str] : -1;
    };

    let dbScheduleData = [];
    try {
      // 🌟 ตรงนี้คือจุดที่ระบบดึงข้อมูลจากตาราง main_classes มาครับ
      const res = await fetch(`${API}/teacher-classes?teacherName=${encodeURIComponent(item.teacher_name)}&forBooking=true`);
      const json = await res.json();
      dbScheduleData = json.success ? json.data : [];
    } catch (e) {
      console.error('ดึงตารางสอนไม่ได้:', e);
    }

   
    let tHours = item.theory_hours;
    let pHours = item.practical_hours;
    let sec = item.sector;

    // ค้นหาวิชานี้ในข้อมูล main_classes ที่ดึงมา
    if (dbScheduleData && dbScheduleData.length > 0) {
      const matchedMainClass = dbScheduleData.find(c => c.subject_code === item.subject_code);
      if (matchedMainClass) {
        tHours = matchedMainClass.theory_hours;
        pHours = matchedMainClass.practical_hours;
        sec = matchedMainClass.sector;
      }
    }

    // 🌟 สร้างฟังก์ชันช่วยลบ .00 ทิ้ง (แต่ถ้าเป็น .5 จะเก็บไว้) และแปลง 0 เป็น '-'
    const formatHour = (val) => {
      if (val == null || val === '') return '-';
      const num = parseFloat(val);
      return (isNaN(num) || num === 0) ? '-' : num.toString(); // num.toString() จะลบ .00 ให้อัตโนมัติครับ
    };

    const showTheory = formatHour(tHours);
    const showPractical = formatHour(pHours);
    const showSector = sec || 'ปกติ';
    // ==========================================
    
    let regularClasses = (Array.isArray(dbScheduleData) ? dbScheduleData : [])
      .filter(dbItem => dbItem && dbItem.start_time && dbItem.end_time)
      .map(dbItem => {
        const sHour = parseInt(dbItem.start_time.split(':')[0], 10);
        const eMins = parseInt(dbItem.end_time.split(':')[1], 10) || 0;
        const eHour = parseInt(dbItem.end_time.split(':')[0], 10) + (eMins > 0 ? 1 : 0);
        const dayIndex = getDayIndex(dbItem.day_of_week);
        const classTitle = dbItem.student_group
          ? dbItem.student_group.split('|').map(g => g.split(' - ')[0].trim()).join(', ')
          : dbItem.subject_code;

        return { dayOfWeek: dayIndex, start: sHour, end: eHour, title: classTitle, isMakeup: false };
      })
      .filter(cls => cls.dayOfWeek !== -1);

    regularClasses.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.start - b.start;
    });

    const mergedRegularClasses = [];
    regularClasses.forEach(cls => {
      const last = mergedRegularClasses.length > 0 ? mergedRegularClasses[mergedRegularClasses.length - 1] : null;

      if (last && last.dayOfWeek === cls.dayOfWeek) {
        const getBaseSubject = (t) => t.split('_')[0].split(' ')[0];
        const lastBase = getBaseSubject(last.title);
        const currentBase = getBaseSubject(cls.title);

        if (last.start === cls.start && last.end === cls.end) {
          last.title = Array.from(new Set([...last.title.split(', '), ...cls.title.split(', ')])).join(', ');
          return;
        }

        if (last.end === cls.start && lastBase === currentBase) {
          last.end = cls.end; 
          last.title = Array.from(new Set([...last.title.split(', '), ...cls.title.split(', ')])).join(', ');
          return;
        }
      }
      mergedRegularClasses.push({ ...cls });
    });

    const teacherSchedule = [...mergedRegularClasses, makeupClass];

    const daysMap = [
      { id: 1, name: 'จันทร์' }, { id: 2, name: 'อังคาร' }, { id: 3, name: 'พุธ' },
      { id: 4, name: 'พฤหัสบดี' }, { id: 5, name: 'ศุกร์' }, { id: 6, name: 'เสาร์' }, { id: 0, name: 'อาทิตย์' }
    ];

    let scheduleRowsHtml = '';

    for (const d of daysMap) {
      scheduleRowsHtml += `<tr><td class="day-cell">${d.name}</td>`;
      const classesToday = teacherSchedule.filter(c => c.dayOfWeek === d.id).sort((a, b) => a.start - b.start);
      let currentCursor = 8;

      for (const cls of classesToday) {
        if (cls.start < currentCursor) continue;
        while (currentCursor < cls.start && currentCursor < 22) {
          scheduleRowsHtml += `<td></td>`;
          currentCursor++;
        }
        const span = cls.end - cls.start;
        if (span > 0 && currentCursor < 22) {
          const bgColor = cls.isMakeup ? '#e0e0e0' : '#ffffff'; 
          scheduleRowsHtml += `<td colspan="${span}" style="background-color: ${bgColor}; font-weight: bold; border: 1px solid #000;">${cls.title}</td>`;
          currentCursor += span;
        }
      }
      while (currentCursor < 22) {
        scheduleRowsHtml += `<td></td>`;
        currentCursor++;
      }
      scheduleRowsHtml += `</tr>`;
    }

    const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '-';
    const normalTimeDisplay = item.normal_start_time && item.normal_end_time 
      ? `${formatTime(item.normal_start_time)}-${formatTime(item.normal_end_time)}` 
      : '-';

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
      <div><b>เรียน</b>&nbsp; รองคณบดีคณะ<span class="dotted-field" style="width:200px;"></span></div>
      <div class="indent">ด้วยข้าพเจ้า <span class="dotted-field" style="width:220px;">${item.teacher_name || ''}</span>&nbsp;ติดภารกิจไม่สามารถมาปฏิบัติราชการ</div>
      <div>เนื่องจาก <span class="dotted-field" style="width:62%; text-align: left; padding-left: 10px;">${item.reason || '-'}</span>&nbsp;จึงขออนุญาตทำการสอนชดเชย ดังนี้</div>
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
        <tr class="row-normal" style="height:35px;">
          <td>${missedDate || '-'}</td>
          <td class="text-muted">-</td>
          <td>${normalTimeDisplay}</td>
          <td>${item.subject_code || '-'}</td>
          <td style="text-align: left; padding-left: 4px; line-height: 1.2;">${item.subject_name || ''}</td>
          <td>${showTheory}</td>
          <td>${showPractical}</td>
          <td>${formattedGroup}</td>
          <td>${showSector}</td>
          <td>${item.normal_room_id || '-'}</td>
          <td></td>
        </tr>
        <tr class="row-makeup" style="height:35px;">
          <td class="text-muted">-</td>
          <td>${classDate}</td>
          <td>${startTime}-${endTime}</td>
          <td>${item.subject_code || '-'}</td>
          <td style="text-align: left; padding-left: 4px; line-height: 1.2;">${item.subject_name || ''}</td>
          <td>${showTheory}</td>
          <td>${showPractical}</td>
          <td>${formattedGroup}</td>
          <td>${showSector}</td>
          <td>${item.room_id || ''}</td>
          <td></td>
        </tr>
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
        <span style="font-size:11.5px;">รองคณบดีคณะ................................</span><br>
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

  if (role === 'staff') return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {(status === 'รอตรวจสอบ' || status === 'รออนุมัติ' || status === 'ไม่อนุมัติ') && (
         <Btn small color="#FBC02D" outline onClick={() => onEdit(item)}>แก้ไข</Btn>
      )}
      {status === 'อนุมัติแล้ว' && (
        <Btn small color="#0288D1" outline onClick={handlePrint}>พิมพ์</Btn>
      )}
      <Btn small color="#E53935" outline onClick={() => confirm('ยกเลิกรายการนี้?', () => onDelete(item.id))}>ยกเลิก</Btn>
    </div>
  )

  if (role === 'admin' && (status === 'รอตรวจสอบ' || status === 'รออนุมัติ')) return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      <Btn small color="#2E7D32" onClick={() => confirm('ยืนยันการอนุมัติคำขอสอนชดเชยรายการนี้?', () => onUpdate(item.id, 'อนุมัติแล้ว'))}>อนุมัติ</Btn>
      <Btn small color="#E53935" onClick={() => {
        const reason = window.prompt('กรุณาระบุเหตุผลที่ตีกลับ/ไม่อนุมัติ (ถ้ามี):');
        if (reason !== null) {
          onUpdate(item.id, 'ไม่อนุมัติ', reason);
        }
      }}>ไม่อนุมัติ</Btn>
    </div>
  )

  return <span style={{ fontSize: 12, color: '#BDBDBD' }}>—</span>
}

export default function ScheduleTable({ schedules, userRole, onDelete, onUpdateStatus, fetchSchedules }) {
  const [execTab, setExecTab] = useState('pending')

  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({})

  // 🌟 1. State สำหรับเก็บค่าตัวกรอง
  const [filterBranch, setFilterBranch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // 🌟 2. ดึงรายชื่อสาขา/หลักสูตร มาจากฐานข้อมูล (schedules) โดยตรง ตัดค่าซ้ำออก
  const uniqueBranches = [...new Set(
    (schedules || [])
      .map(s => (s.curriculum || s.branch || '').trim())
      .filter(Boolean)
  )];

  // 🌟 ฟังก์ชันเติมคำนำหน้าอาจารย์ (เติมเฉพาะตอนแสดงผล)
  const formatTeacher = (name) => {
    if (!name || name === '-' || name === 'ไม่ระบุ') return name;
    
    // 🌟 อัปเดต Regex: เพิ่มคำนำหน้าแบบเต็มและแบบย่อให้ครอบคลุม
    const hasTitle = /^(อาจารย์|ผู้ช่วยศาสตราจารย์|รองศาสตราจารย์|ศาสตราจารย์|ผศ\.|รศ\.|ศ\.|ดร\.|นาย|นางสาว|นาง|ว่าที่ร้อยตรี|ว่าที่\s*ร\.ต\.)/.test(name.trim());
    
    return hasTitle ? name : `อาจารย์ ${name}`;
  };


  // 🌟 3. คัดแยกหมวดหมู่สำหรับผู้บริหารก่อน
  let baseSchedules = schedules || [];
  if (userRole === 'executive') {
    if (execTab === 'pending') {
      baseSchedules = schedules.filter(s => s.status === 'รอผู้บริหารพิจารณา');
    } else {
      baseSchedules = schedules.filter(s => s.status === 'อนุมัติแล้ว' || s.status === 'ไม่อนุมัติ');
    }
  }

  // 🌟 4. นำข้อมูลที่แยกหมวดหมู่แล้ว มาวิ่งผ่าน "ตัวกรอง" สาขา/เดือน/ปี
  const displaySchedules = baseSchedules.filter(item => {
    let matchBranch = true;
    let matchMonth = true;
    let matchYear = true;

    // กรองสาขา (เช็คทั้ง curriculum และ branch เพื่อความชัวร์ 100%)
    if (filterBranch) {
      matchBranch = (item.curriculum === filterBranch) || (item.branch === filterBranch);
    }

    if (filterMonth || filterYear) {
      if (!item.class_date) return false;
      
      const dateObj = new Date(item.class_date);
      const itemMonth = (dateObj.getMonth() + 1).toString();
      const itemYear = dateObj.getFullYear().toString();

      if (filterMonth) matchMonth = itemMonth === filterMonth;
      if (filterYear) matchYear = itemYear === filterYear;
    }

    return matchBranch && matchMonth && matchYear;
  });

  const handleOpenEdit = (item) => {
    const d = new Date(item.class_date);
    const dateStr = !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
    
    const m_d = item.missed_date ? new Date(item.missed_date) : null;
    const missedDateStr = m_d && !isNaN(m_d) ? `${m_d.getFullYear()}-${String(m_d.getMonth()+1).padStart(2,'0')}-${String(m_d.getDate()).padStart(2,'0')}` : '';

    setEditForm({
      ...item,
      class_date: dateStr,
      missed_date: missedDateStr,
      start_time: item.start_time ? item.start_time.slice(0, 5) : '',
      end_time: item.end_time ? item.end_time.slice(0, 5) : '',
      reason: item.reason || ''
    });
    setEditingItem(item);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const finalReason = editForm.reason === 'อื่นๆ' 
        ? editForm.reason_other 
        : editForm.reason;

      const res = await fetch(`${API}/schedules/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          reason: finalReason,
          start_time: editForm.start_time + ':00', 
          end_time: editForm.end_time + ':00',
          status: 'รอตรวจสอบ'  
        })
      });     
      const json = await res.json();
      if (json.success) {
        alert('✅ แก้ไขข้อมูลสำเร็จ');
        setEditingItem(null);
        if (fetchSchedules) fetchSchedules(); 
      } else {
        alert(json.message); 
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
  };

  const hasActions = ['admin', 'staff'].includes(userRole) || (userRole === 'executive' && execTab === 'pending');
  const headers = ['วันที่ไม่ได้สอน', 'เหตุผล', 'วันที่สอนชดเชย', 'เวลา', 'รหัส/ชื่อวิชา', 'กลุ่มเรียน', 'ห้อง', 'อาจารย์', 'สถานะ', ...(hasActions ? ['จัดการ'] : [])];
  
  // สไตล์สำหรับช่อง Select ให้เป็นพื้นขาว ตัวหนังสือดำ
  const filterSelectStyle = {
    padding: '8px 12px', 
    borderRadius: '6px', 
    border: '1px solid #ccc', 
    outline: 'none', 
    cursor: 'pointer',
    backgroundColor: '#ffffff', // พื้นขาว
    color: '#000000',           // ตัวอักษรดำ
    fontFamily: 'inherit'
  };

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <SectionTitle 
          icon={userRole === 'executive' && execTab === 'history' ? "🗄️" : "📅"} 
          title={userRole === 'executive' && execTab === 'history' ? "ประวัติการอนุมัติคำขอ" : "สถานะคำขอสอนชดเชย"} 
        />
        
        {userRole === 'executive' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <Btn small outline={execTab !== 'pending'} color="#1976D2" onClick={() => setExecTab('pending')}>📋 รอพิจารณาอนุมัติ</Btn>
            <Btn small outline={execTab !== 'history'} color="#2E7D32" onClick={() => setExecTab('history')}>🗄️ ประวัติย้อนหลัง</Btn>
          </div>
        )}
      </div>

      {/* 🌟 แถบเครื่องมือตัวกรองข้อมูล */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: '#F9FAFB', padding: '15px', borderRadius: '8px', border: '1px solid #E5E7EB', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>ตัวกรอง:</span>

        {/* ตัวกรองสาขา (ดึงจาก DB อัตโนมัติ) */}
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} style={filterSelectStyle}>
          <option value="">-- ทุกสาขา --</option>
          {uniqueBranches.map(branch => (
            <option key={branch} value={branch}>{branch}</option>
          ))}
        </select>

        {/* ตัวกรองเดือน */}
        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} style={filterSelectStyle}>
          <option value="">-- ทุกเดือน --</option>
          <option value="1">มกราคม</option>
          <option value="2">กุมภาพันธ์</option>
          <option value="3">มีนาคม</option>
          <option value="4">เมษายน</option>
          <option value="5">พฤษภาคม</option>
          <option value="6">มิถุนายน</option>
          <option value="7">กรกฎาคม</option>
          <option value="8">สิงหาคม</option>
          <option value="9">กันยายน</option>
          <option value="10">ตุลาคม</option>
          <option value="11">พฤศจิกายน</option>
          <option value="12">ธันวาคม</option>
        </select>

        {/* ตัวกรองปี */}
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={filterSelectStyle}>
          <option value="">-- ทุกปี --</option>
          <option value="2024">2567</option>
          <option value="2025">2568</option>
          <option value="2026">2569</option>
        </select>

        {/* ปุ่มล้างตัวกรอง */}
        <button 
          onClick={() => { setFilterBranch(''); setFilterMonth(''); setFilterYear(''); }}
          style={{ padding: '8px 15px', background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ล้างตัวกรอง
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'separate', borderSpacing: 0, fontSize: 14 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '11px 14px',
                  textAlign: h === 'กลุ่มเรียน' || i >= 6 ? 'center' : 'left',
                  background: '#E8F5E9', color: '#2E7D32',
                  fontWeight: 700, fontSize: 13,
                  borderBottom: '2px solid #C8E6C9',
                  borderRadius: i === 0 ? '8px 0 0 0' : i === headers.length - 1 ? '0 8px 0 0' : 0,
                  whiteSpace: 'nowrap'
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displaySchedules.length === 0 ? (
              <tr>
                <td colSpan={headers.length} style={{ padding: '32px', textAlign: 'center', color: '#A5D6A7', fontSize: 15 }}>
                  ยังไม่มีข้อมูลคำขอในหมวดหมู่นี้
                </td>
              </tr>
            ) : displaySchedules.map((item, idx) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#F9FBF9' }}>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', color: '#D32F2F', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {item.missed_date ? new Date(item.missed_date).toLocaleDateString('th-TH') : '-'}
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', color: '#424242', maxWidth: 160, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  {item.reason || '-'}
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', color: '#2E7D32', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {new Date(item.class_date).toLocaleDateString('th-TH')}
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', color: '#424242', whiteSpace: 'nowrap' }}>
                  {item.start_time.slice(0, 5)} – {item.end_time.slice(0, 5)}
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', maxWidth: 180 }}>
                  <div style={{ color: '#1565C0', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.subject_code || '-'}
                  </div>
                  <div style={{ fontSize: 12, color: '#757575', marginTop: 4, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {item.subject_name || '(ไม่ระบุชื่อวิชา)'}
                  </div>
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', color: '#424242', fontSize: 13, textAlign: 'center', verticalAlign: 'middle', maxWidth: 140 }}>
                  {item.student_group ? (
                    item.student_group.split('|').map((group, idx) => (
                      <div key={idx} style={{ padding: '2px 0', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4' }}>
                        {group.trim()}
                      </div>
                    ))
                  ) : '-'}
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ padding: '3px 9px', background: '#E8F5E9', color: '#2E7D32', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                    {item.room_id}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', color: '#424242', textAlign: 'center', maxWidth: 140, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                  {item.title || 'อาจารย์'} {item.teacher_name}
                </td>
                <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <StatusBadge status={item.status} />
                  {item.status === 'ไม่อนุมัติ' && item.remark && (
                    <div style={{ fontSize: '12px', color: '#D32F2F', marginTop: '6px', fontWeight: 'bold', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 120 }}>
                      หมายเหตุ: {item.remark}
                    </div>
                  )}
                </td>
                {hasActions && (
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #F1F8E9', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <ActionButtons
                      item={item} role={userRole}
                      onDelete={onDelete} onUpdate={onUpdateStatus}
                      onEdit={handleOpenEdit}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#ffffff', padding: '28px', borderRadius: '12px', width: '500px', maxWidth: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ marginTop: 0, color: '#1565C0', borderBottom: '2px solid #E3F2FD', paddingBottom: '12px', fontSize: '18px' }}>
              แก้ไขข้อมูลคำขอสอนชดเชย
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 'bold', color: '#D32F2F', display: 'block', marginBottom: '6px' }}>วันที่ไม่ได้เข้าสอน</label>
                  <input type="date" value={editForm.missed_date || ''} onChange={e => setEditForm({...editForm, missed_date: e.target.value})} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #EF9A9A', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: '#ffffff', fontSize: '14px', color: '#333333' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 'bold', color: '#D32F2F', display: 'block', marginBottom: '6px' }}>เหตุผล</label>
                  <select 
                    value={editForm.reason || ''} 
                    onChange={e => setEditForm({...editForm, reason: e.target.value, reason_other: ''})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #EF9A9A', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: '#ffffff', fontSize: '14px', color: '#333333' }}>
                    <option value="">-- เลือกเหตุผล --</option>
                    <option value="ไปราชการ">ไปราชการ</option>
                    <option value="วันหยุดราชการ">วันหยุดราชการ</option>
                    <option value="ลาป่วยลากิจ">ลาป่วยลากิจ</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                  {editForm.reason === 'อื่นๆ' && (
                    <input
                      type="text"
                      placeholder="ระบุเหตุผล..."
                      value={editForm.reason_other || ''}
                      onChange={e => setEditForm({...editForm, reason_other: e.target.value})}
                      style={{ width: '100%', padding: '10px', border: '1px solid #EF9A9A', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: '#ffffff', fontSize: '14px', color: '#333333', marginTop: '8px' }}
                    />
                  )}
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #E0E0E0', margin: '8px 0' }} />

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 'bold', color: '#1565C0', display: 'block', marginBottom: '6px' }}>วันที่สอนชดเชย</label>
                  <input required type="date" value={editForm.class_date} onChange={e => setEditForm({...editForm, class_date: e.target.value})} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #90CAF9', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: '#ffffff', fontSize: '14px', color: '#333333' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 'bold', color: '#1565C0', display: 'block', marginBottom: '6px' }}>ห้องเรียน</label>
                  <input required type="text" value={editForm.room_id} onChange={e => setEditForm({...editForm, room_id: e.target.value})} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #90CAF9', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: '#ffffff', fontSize: '14px', color: '#333333' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 'bold', color: '#1565C0', display: 'block', marginBottom: '6px' }}>เริ่มสอน</label>
                  <input required type="time" value={editForm.start_time} onChange={e => setEditForm({...editForm, start_time: e.target.value})} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #90CAF9', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: '#ffffff', fontSize: '14px', color: '#333333' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 13, fontWeight: 'bold', color: '#1565C0', display: 'block', marginBottom: '6px' }}>สิ้นสุด</label>
                  <input required type="time" value={editForm.end_time} onChange={e => setEditForm({...editForm, end_time: e.target.value})} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #90CAF9', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: '#ffffff', fontSize: '14px', color: '#333333' }} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" onClick={() => setEditingItem(null)} style={{ padding: '10px 20px', background: '#ffffff', color: '#D32F2F', border: '1px solid #D32F2F', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  ยกเลิก
                </button>
                <button type="button" onClick={handleSaveEdit} style={{ padding: '10px 20px', background: '#1565C0', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                  บันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </Card>
  )
}