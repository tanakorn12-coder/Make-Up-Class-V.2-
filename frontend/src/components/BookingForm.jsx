import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';

export default function BookingForm({ onSuccess, schedules = [] }) {
  const [isSystemOpen, setIsSystemOpen] = useState(true);
  const [teachersGrouped, setTeachersGrouped] = useState({}); 
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]); 
  const [availableGroups, setAvailableGroups] = useState([]); 
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [rawClasses, setRawClasses] = useState([]); 
  const [allowedDay, setAllowedDay] = useState(null);
  const [otherReason, setOtherReason] = useState('');

  const [formData, setFormData] = useState({
    teacher_name: '', subject_code: '', subject_name: '', student_group: '',
    room_id: '', class_date: '', start_time: '', end_time: '', status: 'รออนุมัติ',
    missed_date: '', reason: '' 
  });

  const inputStyle = {
    padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', 
    outline: 'none', fontSize: '15px', backgroundColor: '#ffffff', 
    color: '#333333', width: '100%', boxSizing: 'border-box', cursor: 'pointer',
    fontFamily: 'inherit'
  };

  // ปรับ Style เฉพาะสำหรับ input ประเภท date และ time เพื่อไม่ให้เบราว์เซอร์ซ่อนไอคอน
  const dateTimeStyle = {
    padding: '10px 14px', 
    borderRadius: '8px', 
    border: '1px solid #d1d5db',
    fontSize: '15px', 
    width: '100%', 
    boxSizing: 'border-box', 
    cursor: 'pointer',
    backgroundColor: '#ffffff',
    color: '#333333',         // เพิ่มบรรทัดนี้: กำหนดสีตัวอักษร
    fontFamily: 'inherit',
    colorScheme: 'light'      // เพิ่มบรรทัดนี้: บังคับให้เบราว์เซอร์แสดงไอคอนปฏิทินและนาฬิกา
  };

  const getSystemStatus = () => {
    try {
      const savedSettings = localStorage.getItem('system_settings');
      if (savedSettings) {
        const parsedData = JSON.parse(savedSettings);
        return parsedData.allow_booking !== false;
      }
    } catch (error) {
      console.error('Error reading system_settings:', error);
    }
    return true; 
  };

  useEffect(() => {
    setIsSystemOpen(getSystemStatus());

    const handleStorageChange = () => {
      setIsSystemOpen(getSystemStatus());
    };
    
    // ฟังการเปลี่ยนแปลงจาก Tab อื่น
    window.addEventListener('storage', handleStorageChange);
    
    // ตรวจสอบสถานะใหม่ทุกครั้งที่ผู้ใช้คลิกเข้ามาที่หน้านี้
    window.addEventListener('focus', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await fetch(`${API}/teachers-list`);
        const json = await res.json();
        if (json.success) {
          const grouped = json.data.reduce((acc, curr) => {
            const curriculumName = curr.curriculum || 'อื่นๆ (ไม่ระบุสาขา)';
            if (!acc[curriculumName]) acc[curriculumName] = [];
            
            const currentTeacherName = curr.teacher_name || curr.name;
            const isExist = acc[curriculumName].some(t => t.name === currentTeacherName);
            if (!isExist && currentTeacherName) {
                acc[curriculumName].push({ name: currentTeacherName, title: curr.title || 'อาจารย์' });
            }
            return acc;
          }, {});
          setTeachersGrouped(grouped);
        }
      } catch (error) {
        console.error("พบข้อผิดพลาดในการดึงข้อมูลรายชื่ออาจารย์:", error);
      }
    };
    fetchTeachers();
  }, []);

  const handleCurriculumChange = (e) => {
    const curriculum = e.target.value;
    setSelectedCurriculum(curriculum);
    setAvailableTeachers(curriculum ? teachersGrouped[curriculum] : []);
    setFormData({ ...formData, teacher_name: '', subject_code: '', subject_name: '', student_group: '', missed_date: '', class_date: '', start_time: '', end_time: '' });
    setAvailableSubjects([]); setAvailableGroups([]); setAllowedDay(null);
  };

  const handleTeacherChange = async (e) => {
    const selectedTeacher = e.target.value;
    setFormData({ ...formData, teacher_name: selectedTeacher, subject_code: '', subject_name: '', student_group: '', missed_date: '', class_date: '', start_time: '', end_time: '' });
    setAvailableSubjects([]); setAvailableGroups([]); setAllowedDay(null); 
    if (!selectedTeacher) return;

    setLoadingClasses(true);
    try {
      const res = await fetch(`${API}/teacher-classes?teacherName=${encodeURIComponent(selectedTeacher)}&forBooking=true`);
      const json = await res.json();
      
      if (json.success) {
        setRawClasses(json.data);
        const uniqueSubjects = [];
        const subjectMap = new Map();
         
        json.data.forEach(item => {
          if (!subjectMap.has(item.subject_code)) {
            subjectMap.set(item.subject_code, true);
            let cleanName = (item.subject_name || '').toString().split('-')[0].trim();
            uniqueSubjects.push({ 
              code: item.subject_code, 
              name: cleanName,
              theory: parseFloat(item.theory_hours || 0), 
              practical: parseFloat(item.practical_hours || 0)
            });
          }
        });
        setAvailableSubjects(uniqueSubjects.sort((a, b) => a.code.localeCompare(b.code)));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingClasses(false);
    }
  };

  const handleSubjectChange = async (e) => {
    const code = e.target.value;
    const subjectObj = availableSubjects.find(s => s.code === code);
    setFormData({ ...formData, subject_code: code, subject_name: subjectObj ? subjectObj.name : '', student_group: '', missed_date: '', class_date: '', start_time: '', end_time: '' });
    setAllowedDay(null); 

    if (code) {
      try {
        const res = await fetch(`${API}/groups-by-subject?code=${encodeURIComponent(code)}&teacherName=${encodeURIComponent(formData.teacher_name)}`);
        const json = await res.json();
        if (json.success) setAvailableGroups(json.data);
      } catch (error) { console.error("Error fetching groups:", error); }
    } else setAvailableGroups([]);
  };

  const handleGroupChange = (e) => {
    const selectedGroup = e.target.value;
    let autoDate = formData.missed_date; 
    let targetDay = null; 

    if (selectedGroup) {
      const matchedClass = rawClasses.find(c => 
        c.subject_code === formData.subject_code && 
        (selectedGroup.includes(c.student_group) || c.student_group.includes(selectedGroup))
      );

      if (matchedClass && matchedClass.day_of_week) {
        const daysMap = { 'อาทิตย์': 0, 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'ศุกร์': 5, 'เสาร์': 6 };
        targetDay = daysMap[matchedClass.day_of_week.replace('วัน', '').trim()];

        if (targetDay !== undefined) {
          const today = new Date();
          const currentDay = today.getDay();
          let diff = currentDay - targetDay;
          if (diff <= 0) diff += 7; 

          const targetDate = new Date(today);
          targetDate.setDate(today.getDate() - diff);

          const year = targetDate.getFullYear();
          const month = String(targetDate.getMonth() + 1).padStart(2, '0');
          const day = String(targetDate.getDate()).padStart(2, '0');
          autoDate = `${year}-${month}-${day}`;
        }
      }
    }
    setAllowedDay(targetDay); 
    setFormData({ ...formData, student_group: selectedGroup, missed_date: autoDate });
  };

  const handleMissedDateChange = (e) => {
    const selectedDate = e.target.value;
    if (selectedDate && allowedDay !== null) {
      const d = new Date(selectedDate);
      if (d.getDay() !== allowedDay) {
        const daysThai = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        alert(`ข้อผิดพลาด: วิชานี้ตามตารางปกติมีการเรียนการสอนในวัน${daysThai[allowedDay]}\nกรุณาเลือกวันที่ตรงกับวัน${daysThai[allowedDay]}เท่านั้น`);
        return; 
      }
    }
    setFormData({ ...formData, missed_date: selectedDate });
  };

  useEffect(() => {
    const classDate   = formData.class_date;
    const subjectCode = formData.subject_code;
    const roomId      = formData.room_id;
    const teacherName = formData.teacher_name;
    const studentGroup = formData.student_group;

    if (!classDate || !subjectCode) return;

    const subjectObj = availableSubjects?.find(s => s.code === subjectCode);
    if (!subjectObj) return;

    const totalHours = parseFloat(subjectObj.theory || 0) + parseFloat(subjectObj.practical || 0);
    if (totalHours <= 0) return;

    const durationMins = totalHours * 60;

    const d = new Date(classDate);
    const daysThai = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
    const dayOfWeek = daysThai[d.getDay()];

    const toMins = (timeStr) => {
      if (!timeStr) return null;
      const parts = timeStr.split(':').map(Number);
      return parts[0] * 60 + parts[1];
    };

    const isResourceMatch = (s) => {
      const sameTeacher = s.teacher_name === teacherName;
      const sameRoom    = roomId && s.room_id && s.room_id.trim() === roomId.trim();
      const sameGroup   = studentGroup && s.student_group && 
                          (s.student_group === studentGroup || s.student_group.includes(studentGroup));
      return sameTeacher || sameRoom || sameGroup;
    };

    const busyRanges = [];

    if (Array.isArray(schedules)) {
      schedules.forEach(s => {
        if (s.class_date !== classDate) return;
        const blockedStatuses = ['รอตรวจสอบ', 'อนุมัติแล้ว', 'รอผู้บริหารพิจารณา'];
        if (!blockedStatuses.includes(s.status)) return;
        
        const start = toMins(s.start_time);
        const end   = toMins(s.end_time);
        if (start !== null && end !== null && isResourceMatch(s)) {
          busyRanges.push({ start, end });
        }
      });
    }

    if (Array.isArray(rawClasses)) {
      rawClasses.forEach(c => {
        if (!c.day_of_week || !c.day_of_week.includes(dayOfWeek)) return;
        const start = toMins(c.start_time);
        const end   = toMins(c.end_time);
        if (start !== null && end !== null && isResourceMatch(c)) {
          busyRanges.push({ start, end });
        }
      });
    }

    const DAY_START = 8 * 60;
    const DAY_END   = 22 * 60;

    let candidateStart = DAY_START;
    let found = false;

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidateEnd = candidateStart + durationMins;
      if (candidateEnd > DAY_END) break;

      const conflictRange = busyRanges.find(b =>
        candidateStart < b.end && candidateEnd > b.start
      );

      if (!conflictRange) {
        found = true;
        break;
      }
      candidateStart = conflictRange.end;
    }

    if (found) {
      const toHHMM = (mins) => {
        const h = String(Math.floor(mins / 60)).padStart(2, '0');
        const m = String(mins % 60).padStart(2, '0');
        return `${h}:${m}`;
      };
      setFormData(prev => ({
        ...prev,
        start_time: toHHMM(candidateStart),
        end_time:   toHHMM(candidateStart + durationMins),
      }));
    }

  }, [
    formData.class_date, formData.room_id, formData.subject_code,
    formData.teacher_name, formData.student_group, availableSubjects,
    schedules, rawClasses
  ]);

  const handleStartTimeChange = (e) => {
    const val = e.target.value;
    if (!val) {
        setFormData(prev => ({ ...prev, start_time: '', end_time: '' }));
        return;
    }
    
    let updates = { start_time: val };
    
    if (formData.subject_code) {
        const subjectObj = availableSubjects?.find(s => s.code === formData.subject_code); 
        if (subjectObj) {
            const totalHours = parseFloat(subjectObj.theory || 0) + parseFloat(subjectObj.practical || 0);
            if (totalHours > 0) {
                const [h, m] = val.split(':').map(Number);
                let startMinutes = (h * 60) + m;
                let endMinutes = startMinutes + (totalHours * 60);
                
                const finalEndH = String(Math.floor(endMinutes / 60)).padStart(2, '0');
                const finalEndM = String(endMinutes % 60).padStart(2, '0');
                updates.end_time = `${finalEndH}:${finalEndM}`;
            }
        }
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleEndTimeChange = (e) => {
    const val = e.target.value;
    setFormData(prev => ({ ...prev, end_time: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); 
    
    // ตรวจสอบสถานะระบบ ณ วินาทีที่กดบันทึก เพื่อความปลอดภัยสูงสุด
    const currentSystemStatus = getSystemStatus();
    if (!currentSystemStatus) {
      setIsSystemOpen(false);
      alert("ไม่สามารถดำเนินการได้: ระบบปิดรับการขอสอนชดเชยชั่วคราว");
      return;
    }

    const subjectObj = availableSubjects.find(s => s.code === formData.subject_code);
    if (subjectObj && formData.start_time && formData.end_time) {
        const totalReqHours = subjectObj.theory + subjectObj.practical;
        if (totalReqHours > 0) {
            const [startH, startM] = formData.start_time.split(':').map(Number);
            const [endH, endM] = formData.end_time.split(':').map(Number);
            const diffInHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

            if (diffInHours <= 0) return alert("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น");
            if (diffInHours !== totalReqHours) {
                return alert(`ไม่สามารถจองได้: วิชานี้บังคับเรียน ${totalReqHours} ชั่วโมง\n(ทฤษฎี ${subjectObj.theory} + ปฏิบัติ ${subjectObj.practical})\nแต่คุณเลือกระยะเวลาไว้ ${diffInHours} ชั่วโมง\n\nกรุณาปรับเวลาสิ้นสุดให้ถูกต้อง`);
            }
        }
    }
    
    const finalReason = formData.reason === 'อื่นๆ' ? otherReason : formData.reason;
    // เติมวินาที (:00) ให้สมบูรณ์ก่อนส่งไปที่ Database
    const payload = { 
      ...formData, 
      start_time: formData.start_time ? `${formData.start_time}:00` : '',
      end_time: formData.end_time ? `${formData.end_time}:00` : '',
      reason: finalReason 
    };

    try {
        const res = await fetch(`${API}/schedules`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errorData = await res.json(); 
            return alert(errorData.message || 'เกิดข้อผิดพลาดในการบันทึก'); 
        }
        const json = await res.json();
        
        if (json.success) {
            alert(json.message); 
            setFormData({ 
              teacher_name: '', subject_code: '', subject_name: '', student_group: '', 
              room_id: '', class_date: '', start_time: '', end_time: '', status: 'รออนุมัติ',
              missed_date: '', reason: '' 
            });
            setSelectedCurriculum(''); setAvailableTeachers([]); setOtherReason(''); setAvailableGroups([]); setAllowedDay(null);
            if (onSuccess) onSuccess(); 
        } else alert(`บันทึกไม่สำเร็จ: ${json.message}`);
    } catch (error) { alert(`ติดต่อเซิร์ฟเวอร์ไม่ได้: ${error.message}`); }
  };

  const daysThaiArr = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const allowedDayHint = allowedDay !== null ? `(เฉพาะวัน${daysThaiArr[allowedDay]})` : '';

  return (
    <Card style={{ padding: '30px', maxWidth: '900px', margin: '0 auto', borderTop: '4px solid #1B5E20' }}>
      <h2 style={{ color: '#1B5E20', marginTop: 0, marginBottom: '24px', borderBottom: '1px solid #E0E0E0', paddingBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        บันทึกข้อมูลการขอสอนชดเชย (สำหรับเจ้าหน้าที่)
      </h2>
      
      {!isSystemOpen ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#FEE2E2', borderRadius: '12px', border: '1px solid #F87171' }}>
          <h3 style={{ color: '#DC2626', margin: '0 0 10px 0' }}>ขณะนี้ระบบปิดรับการขอสอนชดเชยชั่วคราว</h3>
          <p style={{ color: '#7F1D1D', margin: 0 }}>กรุณาติดต่อผู้ดูแลระบบเพื่อขอเปิดการใช้งานอีกครั้ง</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ background: '#F9FAFB', padding: '20px', borderRadius: '12px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>1. เลือกหลักสูตร/สาขา</label>
                <select required value={selectedCurriculum} onChange={handleCurriculumChange} style={inputStyle}>
                  <option value="">-- เลือกสาขา --</option>
                  {Object.keys(teachersGrouped).map((curr) => <option key={curr} value={curr}>{curr}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>2. เลือกอาจารย์ผู้สอน</label>
                <select required disabled={!selectedCurriculum} value={formData.teacher_name} onChange={handleTeacherChange} style={{ ...inputStyle, backgroundColor: !selectedCurriculum ? '#F3F4F6' : '#ffffff' }}>
                  <option value="">{!selectedCurriculum ? "กรุณาเลือกสาขาก่อน" : "-- เลือกรายชื่ออาจารย์ --"}</option>
                  {availableTeachers.map((t) => <option key={t.name} value={t.name}>{t.title} {t.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>3. เลือกรายวิชา</label>
                <select required disabled={!formData.teacher_name || loadingClasses} value={formData.subject_code} onChange={handleSubjectChange} style={{ ...inputStyle, backgroundColor: (!formData.teacher_name || loadingClasses) ? '#F3F4F6' : '#ffffff' }}>
                  <option value="">{loadingClasses ? "กำลังโหลดรายวิชา..." : !formData.teacher_name ? "กรุณาเลือกอาจารย์ก่อน" : "-- เลือกวิชา --"}</option>
                  {availableSubjects.map((s, idx) => <option key={idx} value={s.code}>{s.code} - {s.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>4. เลือกกลุ่มเรียน</label>
                <select required disabled={!formData.subject_code} value={formData.student_group} onChange={handleGroupChange} style={{ ...inputStyle, backgroundColor: !formData.subject_code ? '#F3F4F6' : '#ffffff' }}>
                  <option value="">{!formData.subject_code ? "กรุณาเลือกวิชาก่อน" : "-- เลือกกลุ่มเรียน --"}</option>
                  {availableGroups.map((g, idx) => <option key={idx} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ margin: '0 0 16px 0', color: '#D32F2F', fontSize: '16px' }}>ข้อมูลการไม่ได้เข้าสอน</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>
                  วันที่ไม่ได้สอน <span style={{ color: '#D32F2F', fontWeight: 'bold', fontSize: '13px' }}>{allowedDayHint}</span>
                </label>
                <input required type="date" value={formData.missed_date} onChange={handleMissedDateChange} style={dateTimeStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>เหตุผลที่ไม่ได้เข้าสอน</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select required value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} style={{ ...inputStyle, width: formData.reason === 'อื่นๆ' ? '40%' : '100%' }}>
                    <option value="">-- เลือกเหตุผล --</option>
                    <option value="ไปราชการ">ไปราชการ</option>
                    <option value="วันหยุดราชการ">วันหยุดราชการ</option>
                    <option value="ลาป่วยลากิจ">ลาป่วยลากิจ</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                  {formData.reason === 'อื่นๆ' && <input required type="text" placeholder="โปรดระบุเหตุผล..." value={otherReason} onChange={e => setOtherReason(e.target.value)} style={{ ...inputStyle, width: '60%' }} />}
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #E0E0E0', paddingTop: '24px' }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#1B5E20', fontSize: '16px' }}>รายละเอียดการสอนชดเชย (วันและเวลาใหม่)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>ห้องเรียน</label>
                <input required type="text" placeholder="เช่น 521 หรือ COM2" value={formData.room_id} onChange={e => setFormData({ ...formData, room_id: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>วันที่สอน</label>
                <input required type="date" value={formData.class_date} onChange={e => setFormData({ ...formData, class_date: e.target.value })} style={dateTimeStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>เวลาเริ่มต้น</label>
                  <input 
                    type="time" 
                    required 
                    value={formData.start_time} 
                    onChange={handleStartTimeChange} 
                    style={dateTimeStyle} 
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontWeight: 'bold', color: '#374151', fontSize: '14px' }}>เวลาสิ้นสุด</label>
                  <input 
                    type="time" 
                    required 
                    value={formData.end_time} 
                    onChange={handleEndTimeChange} 
                    style={dateTimeStyle} 
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '10px', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
            <button type="submit" style={{ backgroundColor: '#1B5E20', color: 'white', border: 'none', padding: '12px 36px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' }}>
              บันทึกคำขอสอนชดเชย
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}