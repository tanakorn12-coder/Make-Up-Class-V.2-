import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';

// 🌟 ตัวช่วยเรียงลำดับวัน (จันทร์ -> อาทิตย์)
const DAY_ORDER = {
  'จันทร์': 1,
  'อังคาร': 2,
  'พุธ': 3,
  'พฤหัสบดี': 4,
  'ศุกร์': 5,
  'เสาร์': 6,
  'อาทิตย์': 7
};

export default function TeacherDashboard({ user, schedules = [] }) {
  const [regularClasses, setRegularClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('classes');

  // 🌟 แก้ไข: เปลี่ยนจาก make_up_date เป็น class_date ให้ตรงกับฐานข้อมูล
  const mySchedules = schedules
    .filter(s => s.teacher_name === user?.name)
    .sort((a, b) => new Date(b.class_date) - new Date(a.class_date));

  useEffect(() => {
    const fetchRegularClasses = async () => {
      try {
        const res = await fetch(`${API}/teacher-classes?teacherName=${encodeURIComponent(user.name)}`);
        const json = await res.json();
        
        if (json.success) {
          const safeNormalize = (str) => (str || '').toString().replace(/\s+/g, '').toLowerCase();

          const mergeClasses = (data) => {
            const mergedSessions = [];
            
            data.forEach(item => {
              const codeNorm = safeNormalize(item.subject_code);
              const dayNorm = safeNormalize(item.day_of_week);
              const roomNorm = safeNormalize(item.room_id);

              let cleanSubjectName = (item.subject_name || '').toString().trim();
              if (cleanSubjectName.includes(' - ')) {
                  cleanSubjectName = cleanSubjectName.split(' - ')[0].trim();
              }

              // 🌟 ดักจับข้อมูลกลุ่มเรียน ทั้งจาก API ใหม่ (item.groups) และ API เก่า/ชดเชย (item.student_group)
              const currentGroups = item.groups 
                ? (Array.isArray(item.groups) ? item.groups : [item.groups]) 
                : (item.student_group ? [item.student_group] : []);

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
                
                // นำกลุ่มเรียนใหม่ใส่เพิ่มเข้าไป
                currentGroups.forEach(g => {
                  if (g && !existingSession.groups.includes(g)) {
                    existingSession.groups.push(g);
                  }
                });
              } else {
                mergedSessions.push({
                  ...item,
                  subject_name: cleanSubjectName,
                  groups: [...currentGroups] // ใช้กลุ่มที่ดึงมาได้
                });
              }
            });

            // 🌟 คัดกรองและกำจัดกลุ่มซ้ำซ้อน
            mergedSessions.forEach(session => {
              const keepGroups = [];
              const uniqueGroups = [...new Set(session.groups.filter(Boolean))];
              const sortedGroups = uniqueGroups.sort((a, b) => b.length - a.length);

              sortedGroups.forEach(g => {
                const cleanG = g.replace(/\s+/g, '');
                const isCovered = keepGroups.some(kept => kept.replace(/\s+/g, '').includes(cleanG));
                if (!isCovered) {
                  keepGroups.push(g);
                }
              });
              
              session.groups = keepGroups.sort();
            });

            return mergedSessions;
          };

          const mergedData = mergeClasses(json.data);

          const sortedData = mergedData.sort((a, b) => {
            const orderA = DAY_ORDER[a.day_of_week] || 99;
            const orderB = DAY_ORDER[b.day_of_week] || 99;
            
            if (orderA !== orderB) {
              return orderA - orderB; 
            }
            
            const timeA = a.start_time || '23:59';
            const timeB = b.start_time || '23:59';
            return timeA.localeCompare(timeB);
          });
          
          setRegularClasses(sortedData);
        }
      } catch (error) {
        console.error("Error fetching regular classes", error);
      } finally {
        setLoading(false);
      }
    };

    if (user && user.name) {
      fetchRegularClasses();
    }
  }, [user]);

  // 🌟 จุดที่เพิ่มใหม่: จัดกลุ่มวิชาที่มีรหัสและกลุ่มเรียนเดียวกัน เพื่อรวมการ์ดที่มีหลายคาบ
  const groupedClasses = useMemo(() => {
    return Object.values((regularClasses || []).reduce((acc, current) => {
      const groupString = current.groups ? current.groups.join(',') : '';
      const groupKey = `${current.subject_code}_${groupString}`;

      if (!acc[groupKey]) {
        acc[groupKey] = {
          ...current,
          sessions: [{
            day: current.day_of_week || '-',
            time: `${current.start_time ? current.start_time.substring(0, 5) : '-'} - ${current.end_time ? current.end_time.substring(0, 5) : '-'}`,
            room: current.room_id || '-'
          }]
        };
      } else {
        acc[groupKey].sessions.push({
          day: current.day_of_week || '-',
          time: `${current.start_time ? current.start_time.substring(0, 5) : '-'} - ${current.end_time ? current.end_time.substring(0, 5) : '-'}`,
          room: current.room_id || '-'
        });
      }
      return acc;
    }, {}));
  }, [regularClasses]);

  const getStatusBadge = (status) => {
    if (status === 'อนุมัติแล้ว' || status === 3) return { bg: '#E8F5E9', color: '#2E7D32', text: 'อนุมัติแล้ว' };
    if (status === 'ไม่อนุมัติ' || status === -1) return { bg: '#FFEBEE', color: '#C62828', text: 'ไม่อนุมัติ' };
    return { bg: '#FFF3E0', color: '#E65100', text: 'กำลังดำเนินการ' };
  };

  const tabBtnStyle = (isActive) => ({
    padding: '10px 24px',
    background: isActive ? '#1B5E20' : '#FFFFFF',
    color: isActive ? '#FFFFFF' : '#555555',
    fontWeight: 'bold',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: isActive ? '0 4px 10px rgba(27,94,32,0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
    border: isActive ? '1px solid #1B5E20' : '1px solid #E0E0E0',
    transition: 'all 0.2s'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#1B5E20', fontSize: '22px' }}>สวัสดีครับ อาจารย์{user?.name}</h2>
        <p style={{ margin: 0, color: '#666666', fontSize: '14px' }}>ยินดีต้อนรับสู่ระบบจัดการสอนชดเชย คุณสามารถตรวจสอบข้อมูลวิชาที่สอนและสถานะคำขอได้ด้านล่างนี้</p>
      </div>

      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid #E5E7EB', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveSubTab('classes')} 
          style={tabBtnStyle(activeSubTab === 'classes')}
        >
          📅 รายวิชาที่รับผิดชอบ ({groupedClasses.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('requests')} 
          style={tabBtnStyle(activeSubTab === 'requests')}
        >
          📋 สถานะคำขอสอนชดเชย ({mySchedules.length})
        </button>
      </div>

      <div>
        {activeSubTab === 'classes' && (
          <Card style={{ padding: '24px', border: '1px solid #E5E7EB' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333333', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              รายวิชาที่รับผิดชอบในเทอมนี้ (เรียงตามวันและเวลาสอน)
            </h3>
            
            {loading ? (
              <p style={{ color: '#757575', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>กำลังโหลดข้อมูลตารางสอน...</p>
            ) : groupedClasses.length === 0 ? (
              <p style={{ color: '#757575', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>*ไม่พบข้อมูลรายวิชาในระบบ*</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {groupedClasses.map((item, index) => (
                  <div key={index} style={{ 
                    background: '#FFFFFF', padding: '24px', borderRadius: '12px', 
                    border: '1px solid #E0E0E0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}>
                    <h4 style={{ margin: '0 0 16px 0', color: '#1B5E20', fontSize: '16px', borderBottom: '2px solid #E8F5E9', paddingBottom: '12px' }}>
                      {item.subject_code} : {item.subject_name || 'ไม่มีข้อมูลชื่อวิชา'}
                    </h4>

                    {/* 📌 ส่วนแสดงคาบเรียน (ถ้ามีหลายคาบจะเรียงกัน) */}
                    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {item.sessions.map((session, idx) => (
                        <div key={idx} style={{ 
                          padding: '12px', background: '#F8F9FA', borderRadius: '8px',
                          borderLeft: '4px solid #4CAF50', fontSize: '14px', color: '#424242'
                        }}>
                          {item.sessions.length > 1 && (
                            <div style={{ fontWeight: 'bold', color: '#2E7D32', marginBottom: '8px', fontSize: '13px' }}>
                              คาบสอนที่ {idx + 1}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#757575' }}>วันสอนปกติ:</span> 
                            <span style={{ fontWeight: '500' }}>วัน{session.day}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ color: '#757575' }}>เวลาสอน:</span> 
                            <span style={{ fontWeight: '500' }}>{session.time} น.</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#757575' }}>ห้องเรียน:</span> 
                            <span style={{ fontWeight: '500', color: '#1B5E20' }}>{session.room}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 📌 ส่วนแสดงกลุ่มเรียน */}
                    <div style={{ fontSize: '14px', color: '#424242', background: '#F3F4F6', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ color: '#1B5E20', fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
                        กลุ่มเรียนที่สอนร่วมกัน:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {item.groups.length > 0 ? item.groups.map((g, i) => (
                          <div key={i} style={{ paddingLeft: '8px', borderLeft: '3px solid #A5D6A7', lineHeight: '1.4' }}>
                            {g}
                          </div>
                        )) : (
                          <div style={{ paddingLeft: '8px', color: '#999' }}>- ไม่ระบุกลุ่มเรียน -</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeSubTab === 'requests' && (
          <Card style={{ padding: '24px', border: '1px solid #E5E7EB' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#333333', fontSize: '18px' }}>
              ประวัติสถานะคำขอสอนชดเชย (เรียงจากล่าสุด)
            </h3>
            
            {mySchedules.length === 0 ? (
              <p style={{ color: '#757575', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>ไม่มีประวัติการส่งคำขอสอนชดเชยในระบบ</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {mySchedules.map((item, index) => {
                  const badge = getStatusBadge(item.status);
                  return (
                    <div key={index} style={{ 
                      padding: '16px 20px', borderRadius: '8px', border: '1px solid #EBF0EB', 
                      background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#1B5E20' }}>
                          {item.subject_code} (กลุ่มเรียน: {item.student_group || '-'})
                        </div>
                        <div style={{ fontSize: '13.5px', color: '#555555', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                          <span><b>วันที่ขอสอนชดเชย:</b> {new Date(item.class_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          <span><b>เวลา:</b> {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)} น.</span>
                          <span><b>ห้อง:</b> {item.room_id || '-'}</span>
                        </div>
                      </div>
                      
                      <div>
                        <span style={{ 
                          padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold',
                          backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.color}30`
                        }}>
                          {badge.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

      </div>
    </div>
  );
}