import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';

const DAYS_OF_WEEK = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

const BRANCHES = [
  {
    id: 'it',
    name: 'หลักสูตรเทคโนโลยีสารสนเทศ',
    years: [
      'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 1',
      'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 2',
      'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 3',
      'วท.บ.เทคโนโลยีสารสนเทศ (4 ปี) ปี 4',
      'วท.บ.เทคโนโลยีสารสนเทศ (เทียบโอน) ปี 1',
      'วท.บ.เทคโนโลยีสารสนเทศ (เทียบโอน) ปี 2',
    ],
  },
  {
    id: 'food',
    name: 'หลักสูตรธุรกิจอาหารและโภชนาการ',
    years: [
      'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 1',
      'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 2',
      'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 3',
      'วท.บ.ธุรกิจอาหารและโภชนาการ (4 ปี) ปี 4',
      'วท.บ.ธุรกิจอาหารและโภชนาการ (เทียบโอน) ปี 1',
      'วท.บ.ธุรกิจอาหารและโภชนาการ (เทียบโอน) ปี 2',
    ],
  },
];

const getDatesForCurrentWeek = () => {
  const today = new Date();
  const currentDay = today.getDay() || 7;
  const dates = {};
  DAYS_OF_WEEK.forEach((dayName, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - currentDay + (index + 1));
    dates[dayName] = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  });
  return dates;
};

const formatMakeupDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
};

const selectStyle = {
  padding: '12px 16px',
  borderRadius: '8px',
  border: '1px solid #ccc',
  fontSize: '16px',
  outline: 'none',
  cursor: 'pointer',
  backgroundColor: '#fff',
  color: '#333',
  width: '100%',
  boxSizing: 'border-box',
};

const inputStyle = {
  ...selectStyle,
  cursor: 'text',
};

export default function ScheduleSearch() {
  // ส่วนที่ 1: State สำหรับเช็คสถานะการเปิด/ปิดระบบค้นหา
  const [isSearchAllowed, setIsSearchAllowed] = useState(true);

  // ส่วนที่ 2: ดึงข้อมูลการตั้งค่าตอนโหลดหน้าเว็บ
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('system_settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setIsSearchAllowed(parsedSettings.allow_search !== false);
      }
    } catch (error) {
      console.error('ไม่สามารถโหลดข้อมูลการตั้งค่าได้');
    }
  }, []);

  const [activeTab, setActiveTab] = useState('teacher');

  // Teacher
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherResults, setTeacherResults] = useState([]);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [teacherSearched, setTeacherSearched] = useState(false);

  // Student
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentSearched, setStudentSearched] = useState(false);

  const currentWeekDates = getDatesForCurrentWeek();

  const selectedBranchData = BRANCHES.find(b => b.id === selectedBranchId);

  const safeNormalize = (str) => (str || '').toString().replace(/\s+/g, '').toLowerCase();

  const mergeClasses = (data) => {
    const mergedSessions = [];
    data.forEach(item => {
      const codeNorm = safeNormalize(item.subject_code);
      const dayNorm = safeNormalize(item.day_of_week);
      const roomNorm = safeNormalize(item.room_id);
      const teacherNorm = safeNormalize(item.teacher_name);

      let cleanSubjectName = (item.subject_name || '').toString().trim();
      if (cleanSubjectName.includes(' - ')) {
        cleanSubjectName = cleanSubjectName.split(' - ')[0].trim();
      }

      const existingSession = mergedSessions.find(session => {
        const isSameSubject = safeNormalize(session.subject_code) === codeNorm;
        const isSameDay = safeNormalize(session.day_of_week) === dayNorm;
        const isSameRoom = safeNormalize(session.room_id) === roomNorm;
        const isSameTeacher = safeNormalize(session.teacher_name) === teacherNorm;
        const isSameType = !!session.isMakeup === !!item.isMakeup;
        const isSameDate = !item.isMakeup || (session.class_date === item.class_date);
        if (!isSameSubject || !isSameDay || !isSameRoom || !isSameTeacher || !isSameType || !isSameDate) return false;
        return (item.start_time <= session.end_time) && (item.end_time >= session.start_time);
      });

      if (existingSession) {
        if (item.start_time < existingSession.start_time) existingSession.start_time = item.start_time;
        if (item.end_time > existingSession.end_time) existingSession.end_time = item.end_time;
        if (item.student_group && !existingSession.groups.includes(item.student_group)) {
          existingSession.groups.push(item.student_group);
        }
      } else {
        mergedSessions.push({
          ...item,
          subject_name: cleanSubjectName,
          groups: item.student_group ? [item.student_group] : []
        });
      }
    });

    mergedSessions.forEach(session => {
      const keepGroups = [];
      const uniqueGroups = [...new Set(session.groups.filter(Boolean))];
      const sortedGroups = uniqueGroups.sort((a, b) => b.length - a.length);
      sortedGroups.forEach(g => {
        const cleanG = g.replace(/\s+/g, '');
        const isCovered = keepGroups.some(kept => kept.replace(/\s+/g, '').includes(cleanG));
        if (!isCovered) keepGroups.push(g);
      });
      session.groups = keepGroups.sort();
    });

    return mergedSessions;
  };

  const handleTeacherSearch = async (e) => {
    e.preventDefault();
    if (!teacherQuery.trim()) return;
    setTeacherLoading(true);
    setTeacherSearched(true);
    try {
      const res = await fetch(`${API}/teacher-classes?teacherName=${encodeURIComponent(teacherQuery)}`);
      const json = await res.json();
      if (json.success) {
        const merged = mergeClasses(json.data);
        merged.sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
        setTeacherResults(merged);
      } else setTeacherResults([]);
    } catch {
      setTeacherResults([]);
    } finally {
      setTeacherLoading(false);
    }
  };

  const handleStudentSearch = async (e) => {
    e.preventDefault();
    if (!selectedYear) return;
    setStudentLoading(true);
    setStudentSearched(true);
    try {
      const res = await fetch(`${API}/student-classes?group=${encodeURIComponent(selectedYear)}`);
      const json = await res.json();
      if (json.success) {
        const merged = mergeClasses(json.data);
        merged.sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
        setStudentResults(merged);
      } else setStudentResults([]);
    } catch {
      setStudentResults([]);
    } finally {
      setStudentLoading(false);
    }
  };

  const renderResults = (results, loading, searched) => {
    if (loading) return <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>กำลังค้นหาข้อมูล...</p>;
    if (searched && results.length === 0) return <p style={{ textAlign: 'center', color: '#C62828', padding: '40px' }}>ไม่พบตารางในระบบ</p>;
    if (!searched) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {DAYS_OF_WEEK.map((day) => {
          const classesOnDay = results.filter(r => r.day_of_week === day);
          return (
            <div key={day} style={{ display: 'flex', border: '1px solid #E0E0E0', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{
                width: '100px', flexShrink: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                borderRight: '1px solid #E0E0E0',
                color: classesOnDay.length > 0 ? '#E65100' : '#BDBDBD'
              }}>
                <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{day}</span>
                <span style={{ fontSize: '11px', marginTop: '2px', opacity: 0.8 }}>{currentWeekDates[day]}</span>
              </div>
              <div style={{ flex: 1, padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', backgroundColor: '#FFFFFF' }}>
                {classesOnDay.length === 0 ? (
                  <span style={{ color: '#9E9E9E', fontSize: '14px' }}>ไม่มีตารางเรียน/สอน</span>
                ) : (
                  classesOnDay.map((item, idx) => (
                    <div key={idx} style={{
                      width: '320px',
                      backgroundColor: item.isMakeup ? '#FFF8E1' : '#F0F8FF',
                      padding: '16px', borderRadius: '8px',
                      borderLeft: item.isMakeup ? '4px solid #FF8F00' : '4px solid #1976D2',
                      display: 'flex', flexDirection: 'column', gap: '6px',
                      boxShadow: item.isMakeup ? '0 2px 8px rgba(255,143,0,0.15)' : 'none'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: item.isMakeup ? '1px solid #FFE082' : '1px solid #BBDEFB', paddingBottom: '6px' }}>
                        <div>
                          <span style={{ color: item.isMakeup ? '#E65100' : '#1565C0', fontWeight: 'bold', fontSize: '13px' }}>
                            {item.isMakeup ? 'สอนชดเชยวันที่ :' : 'วันสอนปกติ :'}
                          </span>
                          <div style={{ color: '#333', fontWeight: 'bold', fontSize: '14px', marginTop: '2px' }}>
                            {item.isMakeup ? formatMakeupDate(item.class_date) : currentWeekDates[day]}
                          </div>
                        </div>
                        <div style={{ backgroundColor: item.isMakeup ? '#FF8F00' : '#1976D2', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                          {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)} น.
                        </div>
                      </div>
                      <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#333', marginTop: '4px' }}>
                        {item.subject_code} {item.subject_name ? `: ${item.subject_name}` : ''}
                      </div>
                      <div style={{ fontSize: '13px', color: '#555' }}>
                        <b>ห้อง:</b> {item.room_id || '-'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#555', marginTop: '4px', paddingTop: '8px', borderTop: item.isMakeup ? '1px dashed #FFE082' : '1px dashed #BBDEFB' }}>
                        <b>กลุ่มเรียน:</b>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                          {item.groups.map((g, i) => (
                            <div key={i} style={{ paddingLeft: '6px', borderLeft: item.isMakeup ? '2px solid #FFCA28' : '2px solid #64B5F6' }}>{g}</div>
                          ))}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: item.isMakeup ? '#E65100' : '#1565C0', marginTop: '4px' }}>
                        <b>ผู้สอน:</b> {item.teacher_name}
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

  // ส่วนที่ 3: เงื่อนไข ถ้าแอดมินปิดระบบ ให้แสดงข้อความนี้และไม่แสดงฟอร์มค้นหา
  if (!isSearchAllowed) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Card style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
          <h2 style={{ color: '#C62828', marginBottom: '16px' }}>ขณะนี้ระบบปิดให้บริการชั่วคราว</h2>
          <p style={{ color: '#666', fontSize: '16px' }}>
            ระบบค้นหาตารางเรียนถูกปิดการใช้งานชั่วคราวโดยผู้ดูแลระบบ
            กรุณาติดต่อเจ้าหน้าที่หากมีข้อสงสัย
          </p>
        </Card>
      </div>
    );
  }

  // ถ้าระบบเปิดอยู่ จะคืนค่าหน้าจอค้นหาปกติตามโค้ดเดิมของคุณ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid #E8F5E9', paddingBottom: '16px' }}>
        <button onClick={() => setActiveTab('teacher')} style={{
          padding: '10px 24px', borderRadius: '8px 8px 0 0', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px',
          backgroundColor: activeTab === 'teacher' ? '#2E7D32' : '#F5F5F5',
          color: activeTab === 'teacher' ? 'white' : '#757575',
          borderBottom: activeTab === 'teacher' ? '4px solid #1B5E20' : '4px solid transparent'
        }}>
          ค้นหาตารางสอน (อาจารย์)
        </button>
        <button onClick={() => setActiveTab('student')} style={{
          padding: '10px 24px', borderRadius: '8px 8px 0 0', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px',
          backgroundColor: activeTab === 'student' ? '#1565C0' : '#F5F5F5',
          color: activeTab === 'student' ? 'white' : '#757575',
          borderBottom: activeTab === 'student' ? '4px solid #0D47A1' : '4px solid transparent'
        }}>
          ค้นหาตารางเรียน (นักศึกษา)
        </button>
      </div>

      {/* ===== TAB: อาจารย์ ===== */}
      {activeTab === 'teacher' && (
        <Card style={{ padding: '30px' }}>
          <form onSubmit={handleTeacherSearch} style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#333', marginBottom: '8px' }}>
              พิมพ์ชื่ออาจารย์
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={teacherQuery}
                onChange={(e) => setTeacherQuery(e.target.value)}
                placeholder="เช่น วชิระ, สมศรี..."
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={!teacherQuery.trim()}
                style={{
                  padding: '0 30px', whiteSpace: 'nowrap',
                  backgroundColor: teacherQuery.trim() ? '#2E7D32' : '#B0BEC5',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontWeight: 'bold', fontSize: '16px',
                  cursor: teacherQuery.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                ค้นหา
              </button>
            </div>
          </form>
          {renderResults(teacherResults, teacherLoading, teacherSearched)}
        </Card>
      )}

      {/* ===== TAB: นักศึกษา ===== */}
      {activeTab === 'student' && (
        <Card style={{ padding: '30px' }}>
          <form onSubmit={handleStudentSearch} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '30px' }}>

            {/* Step 1: เลือกสาขา */}
            <div>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                1. เลือกสาขาวิชา
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => { setSelectedBranchId(e.target.value); setSelectedYear(''); }}
                style={selectStyle}
              >
                <option value="">-- เลือกสาขาวิชา --</option>
                {BRANCHES.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {/* Step 2: เลือกชั้นปี (แสดงเมื่อเลือกสาขาแล้ว) */}
            {selectedBranchId && (
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#333', marginBottom: '8px' }}>
                  2. เลือกชั้นปี
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">-- เลือกชั้นปี --</option>
                  {selectedBranchData?.years.map((year, i) => (
                    <option key={i} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={!selectedYear}
                style={{
                  padding: '12px 32px',
                  backgroundColor: selectedYear ? '#1565C0' : '#B0BEC5',
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontWeight: 'bold', fontSize: '16px',
                  cursor: selectedYear ? 'pointer' : 'not-allowed'
                }}
              >
                ค้นหากลุ่มเรียน
              </button>
            </div>

          </form>
          {renderResults(studentResults, studentLoading, studentSearched)}
        </Card>
      )}

    </div>
  );
}