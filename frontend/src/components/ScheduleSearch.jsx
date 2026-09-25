import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';
import { 
  Search, CalendarDays, BookOpen, User, 
  MapPin, Clock, AlertCircle, LoaderCircle, GraduationCap 
} from 'lucide-react';

const DAYS_OF_WEEK = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

const BRANCHES = [
  {
    id: 'it', name: 'หลักสูตรเทคโนโลยีสารสนเทศ',
    years: [ 'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 1', 'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 2', 'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 3', 'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 4', 'วท.บ.เทคโนโลยีสารสนเทศ (เทียบโอน) ปี 1', 'วท.บ.เทคโนโลยีสารสนเทศ (เทียบโอน) ปี 2' ],
  },
  {
    id: 'food', name: 'หลักสูตรธุรกิจอาหารและโภชนาการ',
    years: [ 'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 1', 'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 2', 'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 3', 'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 4', 'วท.บ.ธุรกิจอาหารและโภชนาการ (เทียบโอน) ปี 1', 'วท.บ.ธุรกิจอาหารและโภชนาการ (เทียบโอน) ปี 2' ],
  },
];

const getWeekDateObjects = () => {
  const curr = new Date();
  const day = curr.getDay() === 0 ? 7 : curr.getDay();
  const first = curr.getDate() - day + 1;
  const days = [];
  for(let i=0; i<7; i++) days.push(new Date(curr.getFullYear(), curr.getMonth(), first + i));
  return days;
};

const getDatesForCurrentWeek = () => {
  const objs = getWeekDateObjects();
  const dates = {};
  DAYS_OF_WEEK.forEach((dayName, index) => {
    dates[dayName] = objs[index].toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  });
  return dates;
};

const formatMakeupDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
};

const selectStyle = {
  padding: '12px 16px', borderRadius: '10px', border: '1px solid #CBD5E1',
  fontSize: '15px', outline: 'none', cursor: 'pointer', backgroundColor: '#F8FAFC',
  color: '#1E293B', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.2s', fontFamily: 'inherit'
};
const inputStyle = { ...selectStyle, cursor: 'text' };

// 🌟 เพิ่มฟังก์ชันแปลงเวลาเป็นตัวเลขเพื่อเช็ค Overlap ได้แม่นยำขึ้น
const parseTime = (t) => {
  if (!t) return 0;
  const parts = t.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
};

// 🌟 อัพเกรดการทำความสะอาด String ลบอักขระซ่อนเร้น (Zero Width Space) ทั้งหมด
const safeNormalize = (str) => (str || '').toString().replace(/[\s\u200B-\u200D\uFEFF]+/g, '').toLowerCase();

export default function ScheduleSearch({ user, academicPeriod }) {
  const isTeacher = user?.role === 'teacher';
  const [isSearchAllowed, setIsSearchAllowed] = useState(true);
  const [allSchedules, setAllSchedules] = useState([]);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('system_settings');
      if (savedSettings) setIsSearchAllowed(JSON.parse(savedSettings).allow_search !== false);
    } catch (error) {}

    fetch(`${API}/schedules`)
      .then(res => res.json())
      .then(data => { if(data.success) setAllSchedules(Array.isArray(data.data) ? data.data : []); })
      .catch(console.error);
  }, []);

  const makeUpThisWeek = useMemo(() => {
    const weekObjs = getWeekDateObjects();
    const startWeek = weekObjs[0]; startWeek.setHours(0,0,0,0);
    const endWeek = weekObjs[6]; endWeek.setHours(23,59,59,999);

    return allSchedules.filter(item => {
      const matchPeriod = !academicPeriod?.academic_year || (String(item.academic_year) === String(academicPeriod.academic_year) && String(item.semester) === String(academicPeriod.semester));
      if (!matchPeriod) return false;
      if (item.status !== 'อนุมัติแล้ว' && item.status !== 3) return false;
      const cDate = new Date(item.class_date);
      return cDate >= startWeek && cDate <= endWeek;
    });
  }, [allSchedules, academicPeriod]);

  const [activeTab, setActiveTab] = useState(isTeacher ? 'student' : 'teacher');
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherResults, setTeacherResults] = useState([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherSearched, setTeacherSearched] = useState(false);

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentSearched, setStudentSearched] = useState(false);

  useEffect(() => {
    setTeacherSearched(false); setTeacherResults([]);
    setStudentSearched(false); setStudentResults([]);
  }, [academicPeriod]);

  const currentWeekDates = getDatesForCurrentWeek();
  const selectedBranchData = BRANCHES.find(b => b.id === selectedBranchId);

  const mergeClasses = (data, isTeacherView = false) => {
    const mergedSessions = [];
    
    const extractGroupInfo = (rawGroup, subjCode, subjName) => {
      let g = rawGroup || '';
      
      let isTheory = g.includes('(ท)') || g.includes('(ท.)');
      let isPractical = g.includes('(ป)') || g.includes('(ป.)');
      let isBoth = g.includes('(ท,ป)') || g.includes('(ท.,ป.)') || g.includes('(ท., ป.)');
      
      let typeLabel = isBoth ? '(ท.,ป.)' : isTheory ? '(ท.)' : isPractical ? '(ป.)' : '';
      
      let cleanG = g.replace(/[\u200B-\u200D\uFEFF]/g, '')
                    .replace(/\s*\([ทป.,\s]+\)$/, '')
                    .replace(/\s*\(\s*[ทป]\.?\s*\)/g, '')
                    .trim();

      if (subjCode) {
         const safeCode = (subjCode || '').toString().replace(/\(ชดเชย\)/g, '').trim();
         if (safeCode) cleanG = cleanG.replace(new RegExp(safeCode, 'gi'), '');
      }
      
      cleanG = cleanG.replace(/SEC_\d+/gi, '');

      if (cleanG.includes('-')) {
         const parts = cleanG.split('-');
         cleanG = parts[parts.length - 1].trim();
      }

      if (subjName && cleanG.includes(subjName)) {
         cleanG = cleanG.replace(subjName, '').trim();
      }

      cleanG = cleanG.replace(/^[\s\-_|,]+|[\s\-_|,]+$/g, '').trim();

      if (isTeacherView) {
          return { cleanG, typeLabel: '', fullClean: cleanG };
      }

      return { cleanG, typeLabel, fullClean: cleanG ? `${cleanG} ${typeLabel}`.trim() : '' };
    };

    const getCleanCode = (code) => safeNormalize((code || '').toString().replace(/\(ชดเชย\)/gi, ''));

    data.forEach(item => {
      const codeNorm = getCleanCode(item.subject_code);
      const dayNorm = safeNormalize(item.day_of_week);
      const roomNorm = safeNormalize(item.room_id);
      const teacherNorm = safeNormalize(item.teacher_name);

      let cleanSubjectName = (item.subject_name || '').toString().trim();
      
      if (cleanSubjectName.includes('-')) cleanSubjectName = cleanSubjectName.split('-')[0].trim();
      else if (cleanSubjectName.includes('/')) cleanSubjectName = cleanSubjectName.split('/')[0].trim();
      else if (cleanSubjectName.includes('(')) cleanSubjectName = cleanSubjectName.split('(')[0].trim();

      const groupParts = (item.student_group || '').split('|').map(p => p.trim()).filter(Boolean);
      const cleanGroups = [];
      let itemTypeLabel = '';

      groupParts.forEach(p => {
         const { fullClean, typeLabel } = extractGroupInfo(p, item.subject_code, cleanSubjectName);
         if (fullClean && !cleanGroups.includes(fullClean)) cleanGroups.push(fullClean);
         if (typeLabel && !itemTypeLabel) itemTypeLabel = typeLabel;
      });

      const existingSession = mergedSessions.find(session => {
        const isSameSubject = getCleanCode(session.subject_code) === codeNorm;
        const isSameDay = safeNormalize(session.day_of_week) === dayNorm;
        const isSameRoom = safeNormalize(session.room_id) === roomNorm;
        const isSameTeacher = safeNormalize(session.teacher_name) === teacherNorm;
        const isSameType = !!session.isMakeup === !!item.isMakeup;
        const isSameDate = !item.isMakeup || (session.class_date === item.class_date);
        const isSameTheoryPractical = isTeacherView || (session.typeLabel === itemTypeLabel);
        
        if (!isSameSubject || !isSameDay || !isSameTeacher || !isSameType || !isSameDate || !isSameTheoryPractical) return false;
        
        // 🌟 ใช้ parseTime เพื่อคำนวณการซ้อนทับของเวลาอย่างถูกต้อง
        const start1 = parseTime(item.start_time);
        const end1 = parseTime(item.end_time);
        const start2 = parseTime(session.start_time);
        const end2 = parseTime(session.end_time);
        
        return isSameRoom && (start1 <= end2) && (end1 >= start2);
      });

      if (existingSession) {
        // 🌟 อัพเดทเวลาให้ครอบคลุมที่สุด
        const start1 = parseTime(item.start_time);
        const start2 = parseTime(existingSession.start_time);
        if (start1 < start2) existingSession.start_time = item.start_time;

        const end1 = parseTime(item.end_time);
        const end2 = parseTime(existingSession.end_time);
        if (end1 > end2) existingSession.end_time = item.end_time;
        
        cleanGroups.forEach(g => {
            if (!existingSession.groups.includes(g)) existingSession.groups.push(g);
        });

        // 🌟 ถ้าวิชาเดิมเป็นชื่ออังกฤษ แต่ข้อมูลใหม่มาเป็นชื่อภาษาไทย ให้ยึดภาษาไทยไว้เสมอ
        const isNewThai = /[ก-๙]/.test(cleanSubjectName);
        const isExistingThai = /[ก-๙]/.test(existingSession.subject_name);
        if (isNewThai && !isExistingThai) {
            existingSession.subject_name = cleanSubjectName;
        }

      } else {
        mergedSessions.push({ 
            ...item, 
            subject_name: cleanSubjectName, 
            groups: cleanGroups,
            typeLabel: itemTypeLabel 
        });
      }
    });

    mergedSessions.forEach(session => {
      session.groups = [...new Set(session.groups)].filter(Boolean).sort();
      
      session.groups = session.groups.filter(g => {
          if (/^\(ทอ\.?\)\s*ปี\s*\d/i.test(g)) return false;
          if (/^\(4\s*ปี\)\s*ปี\s*\d/i.test(g)) return false;
          if (/^\(เทียบโอน\)\s*ปี\s*\d/i.test(g)) return false;
          return true;
      });

      session.groups = session.groups.filter((g1, i, arr) => {
          return !arr.some(g2 => g1 !== g2 && g2.includes(g1));
      });
    });

    return mergedSessions;
  };

  const handleTeacherSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const query = isTeacher ? user.name : teacherQuery.trim();
    if (!query) return;
    
    setTeacherLoading(true); setTeacherSearched(true);
    try {
      const params = new URLSearchParams({ teacherName: query, academic_year: academicPeriod?.academic_year || '', semester: academicPeriod?.semester || '' });
      const res = await fetch(`${API}/teacher-classes?${params.toString()}`);
      const json = await res.json();
      
      if (json.success) {
        const ownData = isTeacher 
           ? json.data.filter(item => item.teacher_name && safeNormalize(item.teacher_name).includes(safeNormalize(user.name))) 
           : json.data;
           
        const getDayName = (d) => ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][d.getDay()];
        
        const teacherMakeups = makeUpThisWeek
          .filter(m => m.teacher_name && safeNormalize(m.teacher_name).includes(safeNormalize(query)))
          .map(m => ({ ...m, isMakeup: true, day_of_week: getDayName(new Date(m.class_date)) }));

        const merged = mergeClasses([...ownData, ...teacherMakeups], true);
        merged.sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
        setTeacherResults(merged);
      } else setTeacherResults([]);
    } catch { setTeacherResults([]); } finally { setTeacherLoading(false); }
  };

  const handleStudentSearch = async (e) => {
    e.preventDefault();
    if (!selectedYear) return;
    
    setStudentLoading(true); setStudentSearched(true);
    try {
      const params = new URLSearchParams({ group: selectedYear, academic_year: academicPeriod?.academic_year || '', semester: academicPeriod?.semester || '' });
      const res = await fetch(`${API}/student-classes?${params.toString()}`);
      const json = await res.json();
      
      if (json.success) {
        const getDayName = (d) => ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][d.getDay()];
        
        const groupMakeups = makeUpThisWeek
          .filter(m => {
            const cleanG = safeNormalize(m.student_group);
            const searchYear = safeNormalize(selectedYear);
            return cleanG.includes(searchYear);
          })
          .map(m => ({ ...m, isMakeup: true, day_of_week: getDayName(new Date(m.class_date)) }));

        const merged = mergeClasses([...json.data, ...groupMakeups], false);
        merged.sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
        setStudentResults(merged);
      } else setStudentResults([]);
    } catch { setStudentResults([]); } finally { setStudentLoading(false); }
  };

  const renderResults = (results, loading, searched) => {
    if (loading) return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
        <LoaderCircle size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} /> กำลังค้นหาข้อมูล...
      </div>
    );
    if (searched && results.length === 0) return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '12px', background: '#F8FAFC' }}>
        <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} /> ไม่พบตารางเรียน/ตารางสอนในช่วงการศึกษานี้
      </div>
    );
    if (!searched) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {DAYS_OF_WEEK.map((day) => {
          const classesOnDay = results.filter(r => r.day_of_week === day);
          return (
            <div key={day} style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', background: '#ffffff', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <div style={{
                width: '110px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                backgroundColor: classesOnDay.length > 0 ? '#1B5E20' : '#F1F5F9', color: classesOnDay.length > 0 ? '#ffffff' : '#94A3B8', borderRight: '1px solid #E2E8F0', padding: '16px 8px'
              }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{day}</span>
                {classesOnDay.length > 0 && <span style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>{currentWeekDates[day]}</span>}
              </div>
              <div style={{ flex: 1, padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: '#FFFFFF' }}>
                {classesOnDay.length === 0 ? (
                  <span style={{ color: '#94A3B8', fontSize: '14.5px', fontStyle: 'italic', display: 'flex', alignItems: 'center', height: '100%' }}>ไม่มีตารางในวันนี้</span>
                ) : (
                  classesOnDay.map((item, idx) => (
                    <div key={idx} style={{
                      width: '320px', backgroundColor: item.isMakeup ? '#FEFCE8' : '#F0FDF4', padding: '16px', borderRadius: '12px',
                      border: `1px solid ${item.isMakeup ? '#FEF08A' : '#BBF7D0'}`, borderLeft: item.isMakeup ? '5px solid #EAB308' : '5px solid #22C55E', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: item.isMakeup ? '1px dashed #FDE047' : '1px dashed #86EFAC', paddingBottom: '10px' }}>
                        <div>
                          <span style={{ color: item.isMakeup ? '#CA8A04' : '#166534', fontWeight: 'bold', fontSize: '12px', padding: '2px 8px', background: item.isMakeup ? '#FEF9C3' : '#DCFCE7', borderRadius: '4px' }}>
                            {item.isMakeup ? 'สอนชดเชย' : 'คาบปกติ'}
                          </span>
                          <div style={{ color: '#334155', fontWeight: 'bold', fontSize: '13.5px', marginTop: '6px' }}>
                            {item.isMakeup ? `วันที่ ${formatMakeupDate(item.class_date)}` : currentWeekDates[day]}
                          </div>
                        </div>
                        <div style={{ backgroundColor: item.isMakeup ? '#EAB308' : '#16A34A', color: 'white', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={14} /> {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px' }}>
                        <BookOpen size={16} color={item.isMakeup ? '#CA8A04' : '#15803D'} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ fontWeight: 'bold', fontSize: '14.5px', color: '#1E293B', lineHeight: '1.4' }}>
                          <span style={{ color: item.isMakeup ? '#B45309' : '#166534' }}>{item.subject_code}</span> {item.subject_name ? ` : ${item.subject_name}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: '#475569', marginTop: '4px' }}>
                        <MapPin size={15} color="#64748B" /> <b>ห้อง:</b> <span style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>{item.room_id || 'ไม่ระบุ'}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', paddingTop: '8px', borderTop: item.isMakeup ? '1px dashed #FDE047' : '1px dashed #86EFAC' }}>
                        <b style={{ display: 'block', marginBottom: '6px' }}>กลุ่มเรียน:</b>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {item.groups.length > 0 ? (
                            item.groups.map((g, i) => <div key={i} style={{ paddingLeft: '8px', borderLeft: item.isMakeup ? '2px solid #FDE047' : '2px solid #86EFAC', color: '#334155' }}>{g}</div>)
                          ) : (
                            <span style={{ color: '#94A3B8', fontStyle: 'italic', paddingLeft: '8px' }}>-</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', color: item.isMakeup ? '#B45309' : '#166534', marginTop: '4px', fontWeight: '500' }}>
                        <User size={15} /> {item.teacher_name}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isSearchAllowed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Card style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', width: '100%', border: '1px dashed #FCA5A5', background: '#FEF2F2' }}>
          <AlertCircle size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#B91C1C', margin: '0 0 12px 0' }}>ขณะนี้ระบบปิดให้บริการชั่วคราว</h2>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
        <button onClick={() => setActiveTab('teacher')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '10px 10px 0 0', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', backgroundColor: activeTab === 'teacher' ? '#1B5E20' : 'transparent', color: activeTab === 'teacher' ? 'white' : '#64748B' }}>
          <GraduationCap size={18} /> {isTeacher ? 'ตารางสอนของฉัน' : 'ค้นหาตารางสอน (อาจารย์)'}
        </button>
        <button onClick={() => setActiveTab('student')} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', borderRadius: '10px 10px 0 0', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', backgroundColor: activeTab === 'student' ? '#1B5E20' : 'transparent', color: activeTab === 'student' ? 'white' : '#64748B' }}>
          <BookOpen size={18} /> ค้นหาตารางเรียน (นักศึกษา)
        </button>
      </div>

      {activeTab === 'teacher' && !isTeacher && (
        <Card style={{ padding: '28px', borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleTeacherSearch} style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '15px', color: '#1E293B', marginBottom: '10px' }}>พิมพ์ชื่ออาจารย์ผู้สอน</label>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '0 12px', flex: 1, minWidth: '250px' }}>
                <Search size={18} color="#64748B" />
                <input type="text" value={teacherQuery} onChange={(e) => setTeacherQuery(e.target.value)} placeholder="เช่น สมชาย, สมศรี..." style={{ border: 'none', background: 'transparent', outline: 'none', padding: '12px', width: '100%', fontSize: '15px', color: '#1E293B' }} />
              </div>
              <button type="submit" disabled={!teacherQuery.trim()} style={{ padding: '0 32px', whiteSpace: 'nowrap', backgroundColor: teacherQuery.trim() ? '#1B5E20' : '#CBD5E1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: teacherQuery.trim() ? 'pointer' : 'not-allowed' }}>ค้นหาตาราง</button>
            </div>
          </form>
          {renderResults(teacherResults, teacherLoading, teacherSearched)}
        </Card>
      )}

      {isTeacher && activeTab === 'teacher' && (
        <>
          <Card style={{ padding: '24px', borderRadius: '16px', border: '1px solid #BBF7D0', background: '#F0FDF4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#DCFCE7', padding: '12px', borderRadius: '50%', color: '#166534' }}><User size={24} /></div>
              <div>
                <strong style={{ color: '#166534', fontSize: '16px', display: 'block', marginBottom: '4px' }}>ตารางสอนของฉัน</strong>
                <p style={{ color: '#15803D', margin: 0, fontSize: '14px' }}>ระบบจะแสดงเฉพาะตารางที่เป็นของ {user.name} ในช่วงเวลาที่เลือกด้านบนเท่านั้น</p>
              </div>
            </div>
            <button type="button" onClick={handleTeacherSearch} style={{ padding: '12px 24px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>เรียกดูตารางของฉัน</button>
          </Card>
          {renderResults(teacherResults, teacherLoading, teacherSearched)}
        </>
      )}

      {activeTab === 'student' && (
        <Card style={{ padding: '28px', borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleStudentSearch} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '15px', color: '#1E293B', marginBottom: '10px' }}>1. เลือกสาขาวิชา</label>
                <select value={selectedBranchId} onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedYear(''); }} style={{ ...selectStyle, background: '#ffffff', borderColor: '#CBD5E1' }}>
                  <option value="">-- กรุณาเลือกสาขาวิชา --</option>
                  {BRANCHES.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '15px', color: '#1E293B', marginBottom: '10px', opacity: selectedBranchId ? 1 : 0.5 }}>2. เลือกชั้นปี</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} disabled={!selectedBranchId} style={{ ...selectStyle, background: selectedBranchId ? '#ffffff' : '#F1F5F9', borderColor: '#CBD5E1', cursor: selectedBranchId ? 'pointer' : 'not-allowed' }}>
                  <option value="">-- กรุณาเลือกชั้นปี --</option>
                  {selectedBranchData?.years.map((year, i) => <option key={i} value={year}>{year}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <button type="submit" disabled={!selectedYear} style={{ padding: '14px 36px', backgroundColor: selectedYear ? '#1B5E20' : '#CBD5E1', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '15px', cursor: selectedYear ? 'pointer' : 'not-allowed' }}>ค้นหากลุ่มเรียน</button>
            </div>
          </form>
          {renderResults(studentResults, studentLoading, studentSearched)}
        </Card>
      )}
    </div>
  );
}