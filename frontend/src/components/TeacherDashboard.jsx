import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';
import { 
  BookOpen, MapPin, Clock, Bell, FileText, 
  CalendarDays, CheckCircle2, XCircle, LoaderCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';

const DAY_ORDER = {
  'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4,
  'ศุกร์': 5, 'เสาร์': 6, 'อาทิตย์': 7
};
const WEEK_DAYS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

const getWeekDates = () => {
  const curr = new Date();
  const day = curr.getDay() === 0 ? 7 : curr.getDay(); 
  const first = curr.getDate() - day + 1; 
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(curr.getFullYear(), curr.getMonth(), first + i));
  }
  return days;
};

export default function TeacherDashboard({ user, schedules = [], academicPeriod }) {
  const [regularClasses, setRegularClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('classes');
  
  const [requestFilter, setRequestFilter] = useState('all');
  const [requestPage, setRequestPage] = useState(1);
  const itemsPerPage = 5;

  const weekDates = useMemo(() => getWeekDates(), []);

  const normalizeTeacherName = (value) => (value || '')
    .toString()
    .replace(/^(อาจารย์|ผศ\.|รศ\.|ศ\.|ดร\.)\s*/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  const filteredSchedules = useMemo(() => {
    if (!academicPeriod?.academic_year) return schedules;
    return schedules.filter(s => 
      String(s.academic_year) === String(academicPeriod.academic_year) && 
      String(s.semester) === String(academicPeriod.semester)
    );
  }, [schedules, academicPeriod]);

  const mySchedules = filteredSchedules
    .filter(s => normalizeTeacherName(s.teacher_name) === normalizeTeacherName(user?.name))
    .sort((a, b) => new Date(b.class_date) - new Date(a.class_date));

  useEffect(() => {
    const fetchRegularClasses = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const res = await fetch(`${API}/teacher-classes?teacherName=${encodeURIComponent(user.name)}&forBooking=true`);
        if (!res.ok) throw new Error('โหลดตารางสอนไม่สำเร็จ');
        const json = await res.json();
        
        if (json.success) {
          const safeNormalize = (str) => (str || '').toString().replace(/\s+/g, '').toLowerCase();

          const mergeClasses = (data) => {
            const mergedSessions = [];
            
            // 🌟 ยกเลิกการตัด ท/ป ทิ้ง และรวมกลุ่มเรียนอย่างฉลาด
            const deduplicateGroups = (groups) => {
                if (!groups || groups.length === 0) return [];
                const groupMap = {};
                groups.forEach(g => {
                    let cleanG = g.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); // ลบแค่ขยะที่มองไม่เห็น
                    let key = cleanG;
                    
                    if (/SEC/i.test(cleanG)) {
                        key = cleanG.split('-')[0].trim().toUpperCase();
                    }
                    
                    if (!groupMap[key] || cleanG.length > groupMap[key].length) {
                        groupMap[key] = cleanG;
                    }
                });
                return Object.values(groupMap).sort();
            };

            data.forEach(item => {
              const codeNorm = safeNormalize(item.subject_code);
              const dayNorm = safeNormalize(item.day_of_week);
              const roomNorm = safeNormalize(item.room_id);

              let cleanSubjectName = (item.subject_name || '').toString().trim();
              if (cleanSubjectName.includes(' - ')) {
                  cleanSubjectName = cleanSubjectName.split(' - ')[0].trim();
              }

              let rawGroups = [];
              if (item.groups && Array.isArray(item.groups)) {
                  rawGroups = item.groups;
              } else if (item.student_group) {
                  rawGroups = item.student_group.split(/[|,]/);
              }

              // 🌟 ไม่ตัด ท และ ป อีกต่อไป
              let cleanedRaw = rawGroups.map(g => g.trim().replace(/[\u200B-\u200D\uFEFF]/g, '').trim()).filter(Boolean);

              let formattedGroups = [];
              cleanedRaw.forEach(g => {
                  if (/SEC/i.test(g)) {
                      formattedGroups.push(g);
                  } else {
                      let tempG = g;
                      if (cleanSubjectName && tempG.includes(cleanSubjectName)) {
                          tempG = tempG.replace(cleanSubjectName, '').trim();
                          tempG = tempG.replace(/^[\s\-]+/, '');
                      }
                      if (tempG) {
                          formattedGroups.push(`${item.subject_code}_SEC_1 - ${tempG}`);
                      }
                  }
              });

              const existingSession = mergedSessions.find(session => {
                const isSameSubject = safeNormalize(session.subject_code) === codeNorm;
                const isSameDay = safeNormalize(session.day_of_week) === dayNorm;
                const isSameRoom = safeNormalize(session.room_id) === roomNorm;
                if (!isSameSubject || !isSameDay || !isSameRoom) return false;
                return (item.start_time <= session.end_time) && (item.end_time >= session.start_time);
              });

              if (existingSession) {
                if (item.start_time < existingSession.start_time) existingSession.start_time = item.start_time;
                if (item.end_time > existingSession.end_time) existingSession.end_time = item.end_time;
                
                existingSession.groups = deduplicateGroups([...existingSession.groups, ...formattedGroups]);
              } else {
                mergedSessions.push({ 
                    ...item, 
                    subject_name: cleanSubjectName, 
                    groups: deduplicateGroups(formattedGroups) 
                });
              }
            });

            return mergedSessions;
          };

          const ownData = json.data.filter(item => {
            const isMyClass = normalizeTeacherName(item.teacher_name) === normalizeTeacherName(user.name);
            const isMatchYear = !academicPeriod?.academic_year || (String(item.academic_year) === String(academicPeriod.academic_year) && String(item.semester) === String(academicPeriod.semester));
            return isMyClass && isMatchYear;
          });
          
          const mergedData = mergeClasses(ownData);
          const sortedData = mergedData.sort((a, b) => {
            const orderA = DAY_ORDER[a.day_of_week] || 99;
            const orderB = DAY_ORDER[b.day_of_week] || 99;
            if (orderA !== orderB) return orderA - orderB; 
            return (a.start_time || '23:59').localeCompare(b.start_time || '23:59');
          });
          
          setRegularClasses(sortedData);
        }
      } catch (error) {
        console.error("Error fetching regular classes", error);
        setLoadError('ไม่สามารถโหลดตารางสอนของคุณได้ กรุณาลองใหม่');
      } finally {
        setLoading(false);
      }
    };

    if (user && user.name) fetchRegularClasses();
  }, [user, academicPeriod]);

  const groupedClasses = useMemo(() => {
    return Object.values((regularClasses || []).reduce((acc, current) => {
      const groupString = current.groups ? current.groups.join(',') : '';
      const groupKey = `${current.subject_code}_${groupString}`;
      
      const newSession = {
        day: current.day_of_week || '-',
        time: `${current.start_time ? current.start_time.substring(0, 5) : '-'} - ${current.end_time ? current.end_time.substring(0, 5) : '-'}`,
        room: current.room_id || '-'
      };

      if (!acc[groupKey]) {
        acc[groupKey] = { ...current, sessions: [newSession] };
      } else {
        acc[groupKey].sessions.push(newSession);
      }
      return acc;
    }, {}));
  }, [regularClasses]);

  const notifications = useMemo(() => {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    return mySchedules.filter(item => {
      if (!['อนุมัติแล้ว', 'ไม่อนุมัติ'].includes(item.status)) return false;
      const updateTime = new Date(item.updated_at || item.created_at || new Date());
      return updateTime >= oneDayAgo;
    }).slice(0, 3);
  }, [mySchedules]);

  const makeUpThisWeek = useMemo(() => {
    const startWeek = new Date(weekDates[0]); startWeek.setHours(0,0,0,0);
    const endWeek = new Date(weekDates[6]); endWeek.setHours(23,59,59,999);

    return mySchedules.filter(item => {
      if (item.status !== 'อนุมัติแล้ว' && item.status !== 3) return false;
      const cDate = new Date(item.class_date);
      return cDate >= startWeek && cDate <= endWeek;
    });
  }, [mySchedules, weekDates]);

  const getDayName = (date) => ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][date.getDay()];
  
  const weeklyClasses = WEEK_DAYS.map((day, idx) => {
    const dateObj = weekDates[idx];
    const dateStr = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

    // 🌟 แก้ไขบัคตารางซ้ำ: แยกตารางปกติ และตารางชดเชยออกจากกันอย่างชัดเจน
    const normalClasses = regularClasses
        .filter(item => item.day_of_week === day)
        .map(item => ({ ...item, isMakeup: false })); // เพิ่ม flag ว่านี่คือตารางปกตินะ

    const makeupClasses = makeUpThisWeek
        .filter(item => getDayName(new Date(item.class_date)) === day)
        .map(item => {
            let sName = item.subject_name;
            if (!sName) {
                const found = regularClasses.find(rc => rc.subject_code === item.subject_code);
                if (found) sName = found.subject_name;
            }
            // จำลองโครงสร้างให้เหมือนตารางปกติ จะได้เรนเดอร์รวมกันได้แบบไม่พัง
            return { 
                ...item, 
                subject_name: sName, 
                isMakeup: true,
                start_time: item.start_time,
                end_time: item.end_time,
                room_id: item.room_id
            };
        });

    // นำทั้งตารางปกติและชดเชยมาเรียงต่อกันตามเวลาเริ่มสอน
    const combinedClasses = [...normalClasses, ...makeupClasses].sort((a, b) => 
      (a.start_time || '').localeCompare(b.start_time || '')
    );

    return { day, dateStr, classes: combinedClasses };
  });

  const getStatusBadge = (status) => {
    if (status === 'อนุมัติแล้ว' || status === 3) return { bg: '#E8F5E9', color: '#2E7D32', text: 'อนุมัติแล้ว', icon: <CheckCircle2 size={14}/> };
    if (status === 'ไม่อนุมัติ' || status === -1) return { bg: '#FFEBEE', color: '#C62828', text: 'ไม่อนุมัติ', icon: <XCircle size={14}/> };
    return { bg: '#E3F2FD', color: '#1565C0', text: 'กำลังรอตรวจสอบ', icon: <Clock size={14}/> }; 
  };

  const tabBtnStyle = (isActive) => ({
    padding: '12px 24px', background: isActive ? '#1B5E20' : '#FFFFFF',
    color: isActive ? '#FFFFFF' : '#64748B', fontWeight: 'bold',
    borderRadius: '10px 10px 0 0', cursor: 'pointer', fontSize: '15px',
    border: 'none', borderBottom: isActive ? '3px solid #14532D' : '3px solid transparent',
    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
  });

  const filteredRequests = mySchedules.filter(item => {
    if (requestFilter === 'approved') return item.status === 'อนุมัติแล้ว' || item.status === 3;
    if (requestFilter === 'rejected') return item.status === 'ไม่อนุมัติ' || item.status === -1;
    if (requestFilter === 'pending') return item.status !== 'อนุมัติแล้ว' && item.status !== 3 && item.status !== 'ไม่อนุมัติ' && item.status !== -1;
    return true;
  });
  
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = filteredRequests.slice((requestPage - 1) * itemsPerPage, requestPage * itemsPerPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#1B5E20', fontSize: '22px', fontWeight: 'bold' }}>สวัสดีครับ อาจารย์{user?.name}</h2>
        <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: '14.5px' }}>ยินดีต้อนรับสู่ระบบจัดการสอนชดเชย คุณสามารถตรวจสอบข้อมูลวิชาที่สอนและสถานะคำขอได้ด้านล่างนี้</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '6px 16px', borderRadius: '50px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>
          <CalendarDays size={14} color="#64748B" />
          ปีการศึกษา {academicPeriod?.academic_year || '-'} · ภาคเรียนที่ {academicPeriod?.semester || '-'}
        </div>
      </div>

      {/* 4 กล่องสรุปผล */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {[
          { label: 'รายวิชาที่รับผิดชอบ', value: groupedClasses.length },
          { label: 'กลุ่มเรียนทั้งหมด', value: new Set(regularClasses.flatMap(item => item.groups || [])).size },
          { label: 'สอนชดเชย (สัปดาห์นี้)', value: makeUpThisWeek.length },
          { label: 'รอผลดำเนินการ', value: mySchedules.filter(item => !['อนุมัติแล้ว', 'ไม่อนุมัติ'].includes(item.status)).length }
        ].map((stat, idx) => (
          <div key={idx} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#64748B', fontSize: '14px', marginBottom: '8px', fontWeight: '600' }}>{stat.label}</div>
            <div style={{ color: '#1B5E20', fontSize: '28px', fontWeight: 'bold' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* แจ้งเตือน */}
      {notifications.length > 0 && (
        <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F172A', fontWeight: 'bold', fontSize: '16px', marginBottom: '16px' }}>
            <Bell size={18} color="#0284C7" /> อัปเดตล่าสุด (ภายใน 24 ชม.)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {notifications.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9' }}>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#1E293B', fontSize: '14.5px' }}>{item.subject_code} <span style={{ fontWeight: 'normal', color: '#64748B' }}>{item.subject_name}</span></div>
                  <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>ชดเชยวันที่ {item.class_date ? new Date(item.class_date).toLocaleDateString('th-TH') : '-'} | ห้อง {item.room_id || '-'}</div>
                </div>
                <div style={{ background: item.status === 'อนุมัติแล้ว' ? '#DCFCE7' : '#FEE2E2', color: item.status === 'อนุมัติแล้ว' ? '#166534' : '#991B1B', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold' }}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #E2E8F0' }}>
        <button onClick={() => setActiveSubTab('classes')} style={tabBtnStyle(activeSubTab === 'classes')}>
          <BookOpen size={18} /> ตารางสอน (สัปดาห์นี้)
        </button>
        <button onClick={() => { setActiveSubTab('requests'); setRequestPage(1); }} style={tabBtnStyle(activeSubTab === 'requests')}>
          <FileText size={18} /> ประวัติสถานะคำขอ
        </button>
      </div>

      <div>
        {/* TAB 1: ตารางสอน และ รายละเอียดวิชา */}
        {activeSubTab === 'classes' && (
          <Card style={{ padding: '0', border: 'none', background: 'transparent', boxShadow: 'none' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#64748B', background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <LoaderCircle size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                กำลังโหลดตารางสอน...
              </div>
            ) : loadError ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#EF4444', background: '#FEF2F2', borderRadius: '16px', border: '1px dashed #FCA5A5' }}>{loadError}</div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', minWidth: '1000px' }}>
                    {weeklyClasses.map(column => (
                      <div key={column.day} style={{ flex: 1, minWidth: '140px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ background: column.classes.length > 0 ? '#1B5E20' : '#E2E8F0', color: column.classes.length > 0 ? '#fff' : '#64748B', padding: '12px', borderRadius: '12px 12px 0 0', textAlign: 'center' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{column.day}</div>
                          <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>{column.dateStr}</div>
                        </div>
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                          {column.classes.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', marginTop: '20px' }}>ว่าง</div>
                          ) : (
                            column.classes.map((item, idx) => (
                              <div key={idx} style={{ background: item.isMakeup ? '#FFF8E1' : '#F0FDF4', border: `1px solid ${item.isMakeup ? '#FFCC80' : '#BBF7D0'}`, borderLeft: `4px solid ${item.isMakeup ? '#F57C00' : '#22C55E'}`, borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {item.isMakeup && <span style={{ background: '#FFE0B2', color: '#E65100', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', alignSelf: 'flex-start', fontWeight: 'bold' }}>สอนชดเชย</span>}
                                
                                <strong style={{ color: '#1E293B', fontSize: '14px', lineHeight: '1.2' }}>{item.subject_code}</strong>
                                
                                <div style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700', lineHeight: '1.3', paddingBottom: '6px', borderBottom: '1px dashed #CBD5E1', marginTop: '2px', marginBottom: '4px' }}>
                                  {item.subject_name || 'ไม่มีชื่อวิชา'}
                                </div>

                                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12}/> {item.start_time?.slice(0, 5)} - {item.end_time?.slice(0, 5)}</div>
                                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12}/> {item.room_id || '-'}</div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* รายวิชาที่รับผิดชอบทั้งหมด */}
                {groupedClasses.length > 0 && (
                  <div style={{ marginTop: '32px' }}>
                    <h3 style={{ margin: '0 0 20px 0', color: '#1E293B', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '4px', height: '18px', background: '#1B5E20', borderRadius: '4px' }}></span>
                      รายวิชาที่รับผิดชอบในเทอมนี้ (ข้อมูลวิชาและกลุ่มเรียน)
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                      {groupedClasses.map((item, index) => (
                        <div key={index} style={{ 
                          background: '#FFFFFF', padding: '24px', borderRadius: '12px', 
                          border: '1px solid #E2E8F0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                        }}>
                          <h4 style={{ margin: '0 0 16px 0', color: '#1B5E20', fontSize: '16px', borderBottom: '2px solid #E8F5E9', paddingBottom: '12px' }}>
                            {item.subject_code} : {item.subject_name || 'ไม่มีข้อมูลชื่อวิชา'}
                          </h4>

                          <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {item.sessions.map((session, idx) => (
                              <div key={idx} style={{ 
                                padding: '12px', background: '#F8FAFC', borderRadius: '8px',
                                borderLeft: '4px solid #22C55E', fontSize: '14px', color: '#475569'
                              }}>
                                {item.sessions.length > 1 && (
                                  <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '8px', fontSize: '13px' }}>
                                    คาบสอนที่ {idx + 1}
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ color: '#64748B' }}>วันสอนปกติ:</span> 
                                  <span style={{ fontWeight: '600', color: '#1E293B' }}>วัน{session.day}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ color: '#64748B' }}>เวลาสอน:</span> 
                                  <span style={{ fontWeight: '600', color: '#1E293B' }}>{session.time} น.</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: '#64748B' }}>ห้องเรียน:</span> 
                                  <span style={{ fontWeight: '600', color: '#1B5E20' }}>{session.room}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div style={{ fontSize: '13.5px', color: '#475569', background: '#F1F5F9', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ color: '#1B5E20', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
                              กลุ่มเรียนที่สอนร่วมกัน:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {item.groups.length > 0 ? item.groups.map((g, i) => (
                                <div key={i} style={{ paddingLeft: '8px', borderLeft: '3px solid #86EFAC', lineHeight: '1.4' }}>
                                  {g}
                                </div>
                              )) : (
                                <div style={{ paddingLeft: '8px', color: '#94A3B8' }}>- ไม่ระบุกลุ่มเรียน -</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* TAB 2: ประวัติสถานะคำขอ */}
        {activeSubTab === 'requests' && (
          <Card style={{ padding: '28px', border: '1px solid #E2E8F0', borderRadius: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#1E293B', fontSize: '18px', fontWeight: 'bold' }}>ประวัติการส่งคำขอสอนชดเชย</h3>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { id: 'all', label: 'ทั้งหมด' },
                  { id: 'pending', label: 'กำลังรอตรวจสอบ' },
                  { id: 'approved', label: 'อนุมัติแล้ว' },
                  { id: 'rejected', label: 'ไม่อนุมัติ' }
                ].map(tab => (
                  <button key={tab.id} onClick={() => { setRequestFilter(tab.id); setRequestPage(1); }}
                    style={{
                      padding: '8px 16px', borderRadius: '50px', fontSize: '13px', cursor: 'pointer',
                      background: requestFilter === tab.id ? '#1B5E20' : '#F1F5F9',
                      color: requestFilter === tab.id ? '#FFFFFF' : '#475569',
                      border: 'none', fontWeight: 'bold', transition: 'all 0.2s'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            
            {paginatedRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', border: '1px dashed #CBD5E1', borderRadius: '12px' }}>ไม่พบประวัติสถานะคำขอในหมวดหมู่นี้</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {paginatedRequests.map((item, index) => {
                  const badge = getStatusBadge(item.status);
                  return (
                    <div key={index} style={{ 
                      padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', 
                      background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)', flexWrap: 'wrap', gap: '16px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '15.5px', fontWeight: 'bold', color: '#1E293B' }}>
                          <span style={{ color: '#1B5E20' }}>{item.subject_code}</span> : {item.subject_name || '-'}
                        </div>
                        <div style={{ fontSize: '14px', color: '#475569' }}>กลุ่มเรียน: {item.student_group || '-'}</div>
                        <div style={{ fontSize: '13.5px', color: '#64748B', display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CalendarDays size={14}/> วันที่ขอสอนชดเชย: {new Date(item.class_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14}/> เวลา: {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)} น.</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14}/> ห้อง: {item.room_id || '-'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <span style={{ 
                          padding: '8px 16px', borderRadius: '50px', fontSize: '13px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px',
                          backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`
                        }}>
                          {badge.icon} {badge.text}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94A3B8' }}>อัปเดตเมื่อ: {new Date(item.updated_at || item.created_at || new Date()).toLocaleDateString('th-TH')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
                <span style={{ fontSize: '14px', color: '#64748B' }}>หน้า {requestPage} จาก {totalPages}</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setRequestPage(p => Math.max(p - 1, 1))} disabled={requestPage === 1} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: requestPage === 1 ? 'not-allowed' : 'pointer', color: requestPage === 1 ? '#94A3B8' : '#1E293B', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}><ChevronLeft size={16} /> กลับ</button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button key={i + 1} onClick={() => setRequestPage(i + 1)} style={{ width: '36px', height: '36px', borderRadius: '8px', cursor: 'pointer', background: requestPage === i + 1 ? '#1B5E20' : '#F8FAFC', color: requestPage === i + 1 ? '#FFFFFF' : '#475569', border: '1px solid #E2E8F0', fontWeight: 'bold', transition: 'all 0.2s' }}>{i + 1}</button>
                  ))}
                  <button onClick={() => setRequestPage(p => Math.min(p + 1, totalPages))} disabled={requestPage === totalPages} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: requestPage === totalPages ? 'not-allowed' : 'pointer', color: requestPage === totalPages ? '#94A3B8' : '#1E293B', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>ถัดไป <ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </Card>
        )}

      </div>
    </div>
  );
}