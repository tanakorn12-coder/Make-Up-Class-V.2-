import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';
import { CalendarDays, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export default function BookingForm({ onSuccess, schedules = [], academicPeriod }) {
  const [isSystemOpen, setIsSystemOpen] = useState(true);
  const [teachersGrouped, setTeachersGrouped] = useState({}); 
  const [selectedCurriculum, setSelectedCurriculum] = useState('');
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]); 
  const [availableGroups, setAvailableGroups] = useState([]); 
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [rawClasses, setRawClasses] = useState([]); 
  const [otherReason, setOtherReason] = useState('');

  const [requestList, setRequestList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    teacher_name: '', subject_code: '', subject_name: '', student_group: '',
    room_id: '', class_date: '', start_time: '', end_time: '', status: 'รออนุมัติ',
    missed_date: '', reason: '' 
  });

  const inputStyle = {
    padding: '12px 16px', borderRadius: '10px', border: '1.5px solid #E2E8F0', 
    outline: 'none', fontSize: '15px', backgroundColor: '#F8FAFC', 
    color: '#1E293B', width: '100%', boxSizing: 'border-box', cursor: 'pointer',
    fontFamily: 'inherit', transition: 'border-color 0.2s, box-shadow 0.2s'
  };

  const dateTimeStyle = { ...inputStyle, colorScheme: 'light' };
  const labelStyle = { fontWeight: '600', color: '#334155', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '8px' };

  useEffect(() => {
    try {
      const savedSettings = JSON.parse(localStorage.getItem('system_settings') || '{}');
      setIsSystemOpen(savedSettings.allow_booking !== false);
    } catch (e) {}
  }, []);

  useEffect(() => {
    const fetchTeachers = async () => {
      if (!academicPeriod?.academic_year || !academicPeriod?.semester) return;
      try {
        const params = new URLSearchParams({ academic_year: academicPeriod.academic_year, semester: academicPeriod.semester });
        const res = await fetch(`${API}/teachers-list?${params.toString()}`);
        const json = await res.json();
        if (json.success && json.data.length > 0) {
          const grouped = json.data.reduce((acc, curr) => {
            const currName = curr.curriculum || 'อื่นๆ (ไม่ระบุสาขา)';
            if (!acc[currName]) acc[currName] = [];
            const tName = curr.teacher_name || curr.name;
            if (!acc[currName].some(t => t.name === tName) && tName) {
                acc[currName].push({ name: tName, title: curr.title || 'อาจารย์' });
            }
            return acc;
          }, {});
          setTeachersGrouped(grouped);
        }
      } catch (error) { console.error(error); }
    };
    fetchTeachers();
  }, [academicPeriod]);

  useEffect(() => {
    setRequestList([]);
    setFormData(prev => ({ ...prev, teacher_name: '', subject_code: '', subject_name: '', student_group: '', missed_date: '', class_date: '', start_time: '', end_time: '', room_id: '' }));
  }, [academicPeriod]);

  const handleCurriculumChange = (e) => {
    const curriculum = e.target.value;
    setSelectedCurriculum(curriculum);
    setAvailableTeachers(curriculum ? teachersGrouped[curriculum] : []);
    setFormData(prev => ({ ...prev, teacher_name: '', subject_code: '', subject_name: '', student_group: '', room_id: '', start_time: '', end_time: '', missed_date: '' }));
  };

  const handleTeacherChange = async (e) => {
    const selectedTeacher = e.target.value;
    setFormData(prev => ({ ...prev, teacher_name: selectedTeacher, subject_code: '', subject_name: '', student_group: '', room_id: '', start_time: '', end_time: '', missed_date: '' }));
    setRequestList([]); 
    if (!selectedTeacher) return;

    setLoadingClasses(true);
    try {
      const params = new URLSearchParams({ teacherName: selectedTeacher, forBooking: 'true', academic_year: academicPeriod.academic_year, semester: academicPeriod.semester });
      const res = await fetch(`${API}/teacher-classes?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRawClasses(json.data);
        const uniqueSubjects = [];
        const subjectMap = new Map();
        
        json.data.forEach(item => {
            let subjName = item.subject_name || '';
            let thName = subjName.split(' - ')[0].trim();
            if (!thName) thName = subjName.trim();

          if (!subjectMap.has(item.subject_code)) {
            subjectMap.set(item.subject_code, {
              code: item.subject_code,
              name: thName,
              theory: parseFloat(item.theory_hours || 0),
              practical: parseFloat(item.practical_hours || 0)
            });
          } else {
            const existing = subjectMap.get(item.subject_code);
            existing.theory = Math.max(existing.theory, parseFloat(item.theory_hours || 0));
            existing.practical = Math.max(existing.practical, parseFloat(item.practical_hours || 0));
          }
        });
        
        uniqueSubjects.push(...subjectMap.values());
        setAvailableSubjects(uniqueSubjects.sort((a, b) => a.code.localeCompare(b.code)));
      }
    } catch (error) { console.error(error); } finally { setLoadingClasses(false); }
  };

  const handleSubjectChange = (e) => {
    const code = e.target.value;
    const subjectObj = availableSubjects.find(s => s.code === code);
    setFormData(prev => ({ ...prev, subject_code: code, subject_name: subjectObj ? subjectObj.name : '', student_group: '', room_id: '', start_time: '', end_time: '', missed_date: '' }));
    
    if (code && subjectObj) {
      const relatedClasses = rawClasses.filter(c => c.subject_code === code);
      let baseGroups = new Set();
      const subjectNameTh = subjectObj.name;

      // 🌟 ฟังก์ชันแปลงคำย่อเบื้องหลัง เพื่อให้ระบบรู้ว่ามันคือกลุ่มเดียวกัน
      const normalizeForCompare = (str) => {
          return str.replace(/\s+/g, '')
                    .replace(/\(ทอ\.?\)/g, '(เทียบโอน)'); 
      };

      relatedClasses.forEach(c => {
        let rawG = c.student_group || '';
        
        // 🌟 แก้ไขจุดสำคัญ: หั่นด้วยทั้ง | และ / ตั้งแต่แรกสุดเลย
        let parts = rawG.split(/[|/]/).map(p => p.trim()).filter(Boolean);
        
        let cleanedParts = parts.map(p => {
           let majorPart = p;
           
           let dashIndex = majorPart.indexOf(' - ');
           if (dashIndex !== -1) {
               let firstPart = majorPart.substring(0, dashIndex);
               if (/SEC/i.test(firstPart)) {
                   majorPart = majorPart.substring(dashIndex + 3).trim();
               }
           }
           
           if (subjectNameTh && majorPart.includes(subjectNameTh)) {
               majorPart = majorPart.replace(subjectNameTh, '').trim();
               majorPart = majorPart.replace(/^-/, '').trim(); 
           }

           let cleanG = majorPart.replace(/[\u200B-\u200D\uFEFF]/g, '')
                                 .replace(/\s*\([ทป.,\s]+\)$/, '')
                                 .replace(/\s*\(\s*[ทป]\.?\s*\)/g, '')
                                 .trim();
                                 
           return cleanG;
        }).filter(Boolean); 
        
        if (cleanedParts.length > 0) {
            let uniqueCleanedParts = [...new Set(cleanedParts)];
            uniqueCleanedParts.sort((a, b) => b.length - a.length); // เรียงจากยาวไปสั้น
            
            let mergedParts = [];
            uniqueCleanedParts.forEach(part => {
                let normPart = normalizeForCompare(part);
                // ตรวจสอบว่าส่วนนี้มีซ่อนอยู่ในชื่อที่ยาวกว่าแล้วหรือไม่
                let isSubset = mergedParts.some(kept => normalizeForCompare(kept).includes(normPart));
                if (!isSubset) {
                    mergedParts.push(part); // ถ้าไม่มี ถึงจะเก็บไว้
                }
            });
            
            // เอากลับมาเชื่อมด้วย | เท่านั้น ทำให้ไม่มี / หลงเหลืออยู่อีกต่อไป
            baseGroups.add(mergedParts.join(' | '));
        }
      });

      let groupsArr = Array.from(baseGroups);

      // กรองความซ้ำซ้อนระหว่างแถวใน Database
      groupsArr.sort((a, b) => b.length - a.length);
      let filteredGroups = [];
      
      groupsArr.forEach(g => {
          // ตอนนี้มีแค่ | แล้ว เพราะ / โดนกำจัดไปตั้งแต่รอบแรก
          let subComponents = g.split('|').map(p => p.trim()).filter(Boolean);
          
          let isSubset = subComponents.every(sp => {
              let normSp = normalizeForCompare(sp);
              return filteredGroups.some(kept => normalizeForCompare(kept).includes(normSp));
          });
          
          if (!isSubset) {
              filteredGroups.push(g);
          }
      });

      const generatedOptions = [];
      const hasTheory = subjectObj.theory > 0;
      const hasPractical = subjectObj.practical > 0;

      filteredGroups.forEach(baseG => {
        if (hasTheory && hasPractical) {
          generatedOptions.push(`${baseG} (ท.)`);
          generatedOptions.push(`${baseG} (ป.)`);
          generatedOptions.push(`${baseG} (ท.,ป.)`);
        } else if (hasTheory) {
          generatedOptions.push(`${baseG} (ท.)`);
        } else if (hasPractical) {
          generatedOptions.push(`${baseG} (ป.)`);
        } else {
          generatedOptions.push(baseG); 
        }
      });

      setAvailableGroups(generatedOptions.sort());
    } else {
      setAvailableGroups([]);
    }
  };

  const handleGroupChange = (e) => {
    const selectedGroup = e.target.value;
    let autoRoom = '';
    
    if (selectedGroup) {
      // เอา (ท.) (ป.) ด้านหลังออก
      const baseSearch = selectedGroup.replace(/\s*\([ทป.,\s]+\)$/, '').trim();
      
      // แตก | ออกมาเพื่อหาเทียบกับข้อมูลต้นฉบับ
      const searchParts = baseSearch.split('|').map(p => p.trim());
      
      const matchedClass = rawClasses.find(c => {
        if (c.subject_code !== formData.subject_code) return false;
        // ถ้าระบบเจอส่วนใดส่วนหนึ่งของชื่อชั้นปีตรงกัน ให้ดึงห้องของวิชานั้นมาเลย
        return searchParts.some(part => c.student_group.includes(part));
      });
      
      if (matchedClass) {
        autoRoom = matchedClass.room_id || '';
      }
    }
    setFormData(prev => ({ ...prev, student_group: selectedGroup, room_id: autoRoom }));
  };

  const handleMissedDateChange = (e) => {
    setFormData(prev => ({ ...prev, missed_date: e.target.value }));
  };

  const handleAddToList = () => {
    if (!formData.subject_code || !formData.student_group || !formData.missed_date || !formData.reason || !formData.class_date || !formData.start_time || !formData.end_time || !formData.room_id) {
      return alert("กรุณากรอกข้อมูลให้ครบถ้วนก่อนเพิ่มลงรายการ");
    }

    const subjectObj = availableSubjects.find(s => s.code === formData.subject_code);
    if (subjectObj) {
        const totalReqHours = subjectObj.theory + subjectObj.practical;
        if (totalReqHours > 0) {
            const [startH, startM] = formData.start_time.split(':').map(Number);
            const [endH, endM] = formData.end_time.split(':').map(Number);
            if (((endH * 60 + endM) - (startH * 60 + startM)) / 60 <= 0) return alert("เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น");
        }
    }

    const finalReason = formData.reason === 'อื่นๆ' ? otherReason : formData.reason;
    const newItem = { 
      ...formData, 
      id: Date.now(),
      start_time: `${formData.start_time}:00`,
      end_time: `${formData.end_time}:00`,
      reason: finalReason,
      academic_year: academicPeriod.academic_year,
      semester: academicPeriod.semester,
    };

    setRequestList([...requestList, newItem]);

    setFormData({
      teacher_name: '', 
      subject_code: '', 
      subject_name: '', 
      student_group: '',
      room_id: '', 
      class_date: '', 
      start_time: '', 
      end_time: '', 
      status: 'รออนุมัติ',
      missed_date: '', 
      reason: '' 
    });
    
    
    setSelectedCurriculum(''); 
    setAvailableTeachers([]);  
    setAvailableSubjects([]); 
    setAvailableGroups([]);    
    setOtherReason('');        
  };

  const handleSubmitAll = async () => {
    if (requestList.length === 0) return alert("กรุณาเพิ่มวิชาอย่างน้อย 1 รายการ");
    if (!isSystemOpen) return alert("ระบบปิดรับการขอสอนชดเชยชั่วคราว");

    setIsSubmitting(true);
    let successCount = 0;
    let errorMessages = [];
    let successIds = [];

    for (const payload of requestList) {
      try {
        const res = await fetch(`${API}/schedules`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
            successCount++;
            successIds.push(payload.id); 
        } else {
            errorMessages.push(`วิชา ${payload.subject_code}: ${data.message || 'เกิดข้อผิดพลาดในการบันทึก'}`);
        }
      } catch (error) { 
          errorMessages.push(`วิชา ${payload.subject_code}: ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้`);
      }
    }

    setIsSubmitting(false);

    if (errorMessages.length > 0) {
        alert(errorMessages.join('\n\n'));
        if (successCount > 0) {
            setRequestList(prev => prev.filter(req => !successIds.includes(req.id)));
            if (onSuccess) onSuccess(); 
        }
    } else if (successCount > 0) {
        alert(`✅ บันทึกคำขอสำเร็จทั้งหมด ${successCount} รายการ`);
        setRequestList([]);
        setFormData({ teacher_name: '', subject_code: '', subject_name: '', student_group: '', room_id: '', class_date: '', start_time: '', end_time: '', status: 'รออนุมัติ', missed_date: '', reason: '' });
        setSelectedCurriculum(''); setAvailableTeachers([]); setOtherReason(''); setAvailableGroups([]);
        if (onSuccess) onSuccess(); 
    }
  };

  return (
    <Card style={{ padding: '32px', maxWidth: '1000px', margin: '20px auto', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: 'none' }}>
      
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#E8F5E9', padding: '12px 24px', borderRadius: '50px', marginBottom: '8px' }}>
          <h2 style={{ color: '#1B5E20', margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            บันทึกคำขอสอนชดเชย 
          </h2>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 16px', borderRadius: '50px', width: 'fit-content', margin: '0 auto 24px' }}>
        <CalendarDays size={16} color="#64748B" />
        <span style={{ fontSize: '14px', color: '#334155', fontWeight: '600' }}>
          คุณกำลังทำรายการสำหรับ ปี <b style={{ color: '#1B5E20' }}>{academicPeriod?.academic_year || '-'}</b> / เทอม <b style={{ color: '#1B5E20' }}>{academicPeriod?.semester || '-'}</b>
        </span>
      </div>
      
      {!isSystemOpen ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#FEF2F2', borderRadius: '16px', border: '1.5px dashed #FCA5A5' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h3 style={{ color: '#DC2626', margin: '0 0 10px 0', fontSize: '20px' }}>ขณะนี้ระบบปิดรับการขอสอนชดเชยชั่วคราว</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          <div style={{ background: '#ffffff', padding: '28px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '16px', background: '#1B5E20', borderRadius: '4px' }}></span> 1. กำหนดข้อมูลอาจารย์
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={labelStyle}>เลือกหลักสูตร/สาขา</label>
                <select value={selectedCurriculum} onChange={handleCurriculumChange} style={inputStyle}>
                  <option value="">-- เลือกสาขา --</option>
                  {Object.keys(teachersGrouped).map((curr) => <option key={curr} value={curr}>{curr}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={labelStyle}>เลือกอาจารย์ผู้สอน</label>
                <select disabled={!selectedCurriculum} value={formData.teacher_name} onChange={handleTeacherChange} style={{ ...inputStyle, backgroundColor: !selectedCurriculum ? '#F1F5F9' : '#F8FAFC' }}>
                  <option value="">{!selectedCurriculum ? "กรุณาเลือกสาขาก่อน" : "-- เลือกรายชื่ออาจารย์ --"}</option>
                  {availableTeachers.map((t) => <option key={t.name} value={t.name}>{t.title} {t.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: '#F8FAFC', padding: '28px', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '16px', background: '#3B82F6', borderRadius: '4px' }}></span> 2. ระบุวิชาและวันเวลาที่ขอชดเชย
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={labelStyle}>วิชาที่จะชดเชย</label>
                <select disabled={!formData.teacher_name} value={formData.subject_code} onChange={handleSubjectChange} style={inputStyle}>
                  <option value="">-- เลือกวิชา --</option>
                  {availableSubjects.map((s, idx) => <option key={idx} value={s.code}>{s.code} - {s.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={labelStyle}>กลุ่มเรียน (เลือก ท./ป.)</label>
                <select disabled={!formData.subject_code} value={formData.student_group} onChange={handleGroupChange} style={inputStyle}>
                  <option value="">-- เลือกกลุ่มเรียน --</option>
                  {availableGroups.map((g, idx) => <option key={idx} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                
                <label style={{...labelStyle, color: !formData.student_group ? '#94A3B8' : '#991B1B'}}>วันที่ไม่ได้สอน</label>
                <input 
                  type="date" 
                  disabled={!formData.student_group} 
                  value={formData.missed_date} 
                  onChange={handleMissedDateChange} 
                  style={{
                    ...dateTimeStyle, 
                    borderColor: !formData.student_group ? '#E2E8F0' : '#FCA5A5', 
                    backgroundColor: !formData.student_group ? '#F1F5F9' : '#ffffff',
                    cursor: !formData.student_group ? 'not-allowed' : 'pointer'
                  }} 
                />

              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{...labelStyle, color: '#991B1B'}}>เหตุผลที่ไม่ได้เข้าสอน</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <select value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} style={{ ...inputStyle, borderColor: '#FCA5A5', width: formData.reason === 'อื่นๆ' ? '35%' : '100%' }}>
                    <option value="">-- เลือกเหตุผล --</option><option value="ไปราชการ">ไปราชการ</option><option value="วันหยุดราชการ">วันหยุดราชการ</option><option value="ลาป่วย/ลากิจ">ลาป่วย/ลากิจ</option><option value="อื่นๆ">อื่นๆ</option>
                  </select>
                  {formData.reason === 'อื่นๆ' && (
                    <input type="text" placeholder="ระบุเหตุผล..." value={otherReason} onChange={e => setOtherReason(e.target.value)} style={{ ...inputStyle, borderColor: '#FCA5A5', width: '65%' }} />
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{...labelStyle, color: '#166534'}}>ห้องเรียน</label>
                <input type="text" placeholder="ห้อง" value={formData.room_id} onChange={e => setFormData({ ...formData, room_id: e.target.value })} style={{...inputStyle, borderColor: '#86EFAC'}} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{...labelStyle, color: '#166534'}}>วันที่สอนชดเชย</label>
                <input type="date" value={formData.class_date} onChange={e => setFormData({ ...formData, class_date: e.target.value })} style={{...dateTimeStyle, borderColor: '#86EFAC'}} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{...labelStyle, color: '#166534'}}>เวลาเริ่มต้น</label>
                <input type="time" value={formData.start_time} onChange={e => setFormData(p => ({ ...p, start_time: e.target.value }))} style={{...dateTimeStyle, borderColor: '#86EFAC'}} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{...labelStyle, color: '#166534'}}>เวลาสิ้นสุด</label>
                <input type="time" value={formData.end_time} onChange={e => setFormData(p => ({ ...p, end_time: e.target.value }))} style={{...dateTimeStyle, borderColor: '#86EFAC'}} />
              </div>
            </div>

            <div style={{ textAlign: 'right', marginTop: '20px' }}>
              <button type="button" onClick={handleAddToList} style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '14.5px', fontWeight: 'bold', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)' }}>
                <Plus size={18} /> เพิ่มวิชานี้ลงในรายการ
              </button>
            </div>
          </div>

          {requestList.length > 0 && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '16px', padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#166534', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} /> รายการวิชาที่ต้องการขอสอนชดเชย ({requestList.length} รายการ)
              </h3>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                <thead style={{ background: '#DCFCE7', color: '#166534', fontSize: '14px' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left' }}>วิชา</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>วันชดเชย</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>เวลา</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>ห้อง</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {requestList.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '14px' }}>
                      <td style={{ padding: '12px' }}><b>{item.subject_code}</b><br/><span style={{ fontSize: '12px', color: '#64748B' }}>{item.student_group}</span></td>
                      <td style={{ padding: '12px', color: '#166534' }}>{new Date(item.class_date).toLocaleDateString('th-TH')}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{item.start_time.slice(0,5)} - {item.end_time.slice(0,5)}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{item.room_id}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button type="button" onClick={() => setRequestList(requestList.filter(r => r.id !== item.id))} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}><Trash2 size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ textAlign: 'right', marginTop: '24px' }}>
                <button type="button" onClick={handleSubmitAll} disabled={isSubmitting} style={{ background: '#1B5E20', color: 'white', border: 'none', padding: '14px 42px', borderRadius: '10px', fontSize: '16px', fontWeight: 'bold', cursor: isSubmitting ? 'wait' : 'pointer', boxShadow: '0 4px 12px rgba(27, 94, 32, 0.25)' }}>
                  {isSubmitting ? 'กำลังบันทึก...' : `ยืนยันบันทึกคำขอทั้งหมด (${requestList.length} รายการ)`}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </Card>
  );
}