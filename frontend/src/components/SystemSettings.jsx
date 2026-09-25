import React, { useState, useEffect } from 'react';
import { Card } from './ui';
import { API } from '../utils/constants';
import { 
  CalendarDays, Check, LoaderCircle, Settings2, 
  PlusCircle, Database, Power, AlertCircle 
} from 'lucide-react';

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    academic_year: '',
    semester: '',
    allow_booking: true,
    allow_search: true
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [periodMessage, setPeriodMessage] = useState({ type: '', text: '' });

  // 1. ดึงข้อมูลจากฐานข้อมูล และ Local Storage
  useEffect(() => {
    const loadAcademicSettings = async () => {
      try {
        const response = await fetch(`${API}/academic-settings`);
        const json = await response.json();
        if (json.success && json.data) {
          setPeriods(json.data.periods || []);
        }
      } catch (error) {
        console.error('ไม่สามารถโหลดการตั้งค่าภาคการศึกษาได้');
      }
      
      try {
        const savedSettings = localStorage.getItem('system_settings');
        if (savedSettings) {
          const parsedData = JSON.parse(savedSettings);
          setSettings(prev => ({
            ...prev,
            allow_booking: parsedData.allow_booking !== false,
            allow_search: parsedData.allow_search !== false
          }));
        }
      } catch (error) { 
        console.error('ไม่สามารถโหลดข้อมูลจาก Local Storage ได้');
      }
    };
    loadAcademicSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
    setPeriodMessage({ type: '', text: '' });
    setMessage('');
  };

  // 2. บันทึกข้อมูลตั้งค่าระบบ (เปิด-ปิดระบบ)
  const handleSaveSystemToggle = () => {
    setIsLoading(true);
    setMessage('กำลังบันทึกการตั้งค่า...');
    setMessageType('info');

    setTimeout(() => {
      try {
        // ดึงของเดิมมาก่อนเพื่อไม่ให้ปีการศึกษาที่เลือกอยู่หายไป
        const savedSettings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        const updatedSettings = {
          ...savedSettings,
          allow_booking: settings.allow_booking,
          allow_search: settings.allow_search
        };
        localStorage.setItem('system_settings', JSON.stringify(updatedSettings));
        setMessage('บันทึกการตั้งค่าระบบเรียบร้อยแล้ว');
        setMessageType('success');
      } catch (error) {
        setMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        setMessageType('error');
      } finally {
        setIsLoading(false);
      }
    }, 500);
  };

  // 3. สร้าง/เพิ่มปีการศึกษาใหม่เข้าสู่ระบบ
  const handleAddNewPeriod = async () => {
    if (!settings.academic_year || !settings.semester) {
      setPeriodMessage({ type: 'error', text: 'กรุณาระบุปีการศึกษาและภาคเรียนให้ครบถ้วน' });
      return;
    }
    
    // เช็คว่ามีปีและเทอมนี้ในระบบแล้วหรือยัง
    const isDuplicate = periods.some(p => p.academic_year === settings.academic_year && p.semester === settings.semester);
    if (isDuplicate) {
      setPeriodMessage({ type: 'error', text: `มีปีการศึกษา ${settings.academic_year} เทอม ${settings.semester} อยู่ในระบบแล้ว` });
      return;
    }

    setIsLoading(true);
    setPeriodMessage({ type: 'info', text: 'กำลังเพิ่มปีการศึกษาเข้าสู่ระบบ...' });
    
    const newPeriod = { academic_year: settings.academic_year, semester: settings.semester };
    
    // เอาค่าที่สร้างใหม่ไปเป็น Current ชั่วคราวเพื่อให้หลังบ้านบันทึก (ระบบหลังบ้านคุณรับค่าแบบนี้)
    const nextPeriods = [newPeriod, ...periods];

    try {
      const response = await fetch(`${API}/academic-settings`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current: newPeriod, periods: nextPeriods })
      });
      const json = await response.json();
      
      if (!json.success) throw new Error(json.message);
      
      setPeriods(nextPeriods);
      setSettings(prev => ({ ...prev, academic_year: '', semester: '' })); // ล้างฟอร์ม
      setPeriodMessage({ type: 'success', text: `เพิ่มปีการศึกษา ${newPeriod.academic_year} เทอม ${newPeriod.semester} เข้าสู่ระบบแล้ว คุณสามารถเลือกใช้งานได้ที่เมนูด้านบน` });
      
      // อัปเดตไปยังหน้าอื่นๆ ให้รู้ว่ามีตัวเลือกใหม่เพิ่มเข้ามา
      window.dispatchEvent(new CustomEvent('academic-period-changed', { detail: newPeriod }));
      
    } catch (error) {
      setPeriodMessage({ type: 'error', text: error.message || 'ไม่สามารถบันทึกปีการศึกษาได้' });
    } finally { 
      setIsLoading(false); 
    }
  };

  // Styles
  const inputStyle = {
    padding: '12px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', 
    outline: 'none', fontSize: '15px', backgroundColor: '#F8FAFC', 
    color: '#1E293B', width: '100%', boxSizing: 'border-box',
    transition: 'border-color 0.2s', fontFamily: 'inherit'
  };

  return (
    <Card style={{ padding: '28px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #E2E8F0', marginTop: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', borderBottom: '1px solid #F1F5F9', paddingBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ background: '#E8F5E9', padding: '14px', borderRadius: '12px', color: '#1B5E20' }}>
            <Settings2 size={32} />
          </div>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1B5E20', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
              <ShieldCheckIcon /> ADMIN CONTROL CENTER
            </span>
            <h2 style={{ margin: 0, color: '#0F172A', fontSize: '22px', fontWeight: 'bold' }}>ตั้งค่าระบบ</h2>
            <p style={{ margin: '6px 0 0 0', color: '#64748B', fontSize: '14.5px' }}>เพิ่มปีการศึกษาใหม่เข้าสู่ระบบ และควบคุมการเปิด-ปิดการเข้าถึงของใช้งาน</p>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* ส่วนที่ 1: เพิ่มปีการศึกษา */}
        <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.01)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <CalendarDays size={20} color="#16A34A" />
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#1E293B' }}>เพิ่มปีการศึกษาเข้าระบบ</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>เมื่อเพิ่มแล้ว จะไปปรากฏเป็นตัวเลือกที่แถบเมนูด้านบน</p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>ปีการศึกษา</label>
              <input type="text" name="academic_year" value={settings.academic_year} onChange={handleChange} placeholder="เช่น 2568" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>ภาคเรียนที่</label>
              <input type="text" name="semester" value={settings.semester} onChange={handleChange} placeholder="เช่น 1 หรือ 2" style={inputStyle} />
            </div>
          </div>

          <button onClick={handleAddNewPeriod} disabled={isLoading || !settings.academic_year || !settings.semester} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: (isLoading || !settings.academic_year || !settings.semester) ? '#CBD5E1' : '#1B5E20', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '14.5px', fontWeight: 'bold', cursor: (isLoading || !settings.academic_year || !settings.semester) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
            {isLoading ? <LoaderCircle size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <PlusCircle size={18} />}
            เพิ่มปีการศึกษาใหม่
          </button>
          
          {periodMessage.text && (
            <div style={{ marginTop: '16px', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '500', background: periodMessage.type === 'success' ? '#F0FDF4' : periodMessage.type === 'error' ? '#FEF2F2' : '#F0F9FF', color: periodMessage.type === 'success' ? '#166534' : periodMessage.type === 'error' ? '#991B1B' : '#0284C7', border: `1px solid ${periodMessage.type === 'success' ? '#BBF7D0' : periodMessage.type === 'error' ? '#FECACA' : '#BAE6FD'}` }}>
              {periodMessage.text}
            </div>
          )}

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px dashed #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
              <Database size={16} /> ปีการศึกษาที่มีอยู่ในระบบขณะนี้
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {periods.length === 0 ? (
                <span style={{ fontSize: '13.5px', color: '#94A3B8', fontStyle: 'italic' }}>ยังไม่มีข้อมูลในระบบ</span>
              ) : (
                periods.map((period, idx) => (
                  <span key={idx} style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: '50px', fontSize: '13px', fontWeight: '600' }}>
                    ปี {period.academic_year} / เทอม {period.semester}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ส่วนที่ 2: ตั้งค่าระบบทั่วไป */}
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Power size={20} color="#DC2626" />
            <div>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#991B1B' }}>การควบคุมระบบ (เปิด/ปิด)</h4>
              <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#B91C1C', opacity: 0.8 }}>ตั้งค่าการเข้าถึงระบบของฝั่งเจ้าหน้าที่และนักศึกษา</p>
            </div>
          </div>
          
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #FCA5A5', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #FEE2E2' }}>
              <div>
                <span style={{ fontWeight: 'bold', color: '#7F1D1D', display: 'block' }}>เปิดรับคำขอสอนชดเชยจากเจ้าหน้าที่</span>
                <span style={{ fontSize: '12px', color: '#991B1B', opacity: 0.8 }}>หากปิด เจ้าหน้าที่จะไม่สามารถส่งฟอร์มคำขอได้</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                <input type="checkbox" name="allow_booking" checked={settings.allow_booking} onChange={handleChange} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: settings.allow_booking ? '#22C55E' : '#CBD5E1', transition: '.4s', borderRadius: '34px' }}></span>
                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: settings.allow_booking ? '26px' : '4px', bottom: '3px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></span>
              </label>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
              <div>
                <span style={{ fontWeight: 'bold', color: '#7F1D1D', display: 'block' }}>เปิดระบบค้นหาตารางเรียนสำหรับนักศึกษาทั่วไป</span>
                <span style={{ fontSize: '12px', color: '#991B1B', opacity: 0.8 }}>หากปิด หน้าค้นหาตารางว่างจะถูกซ่อนไว้</span>
              </div>
              <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                <input type="checkbox" name="allow_search" checked={settings.allow_search} onChange={handleChange} style={{ opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: settings.allow_search ? '#22C55E' : '#CBD5E1', transition: '.4s', borderRadius: '34px' }}></span>
                <span style={{ position: 'absolute', content: '""', height: '20px', width: '20px', left: settings.allow_search ? '26px' : '4px', bottom: '3px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px', color: messageType === 'success' ? '#166534' : (messageType === 'error' ? '#991B1B' : '#0284C7') }}>
              {message}
            </div>
            
            <button onClick={handleSaveSystemToggle} disabled={isLoading} 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#DC2626', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14.5px', fontWeight: 'bold', cursor: isLoading ? 'wait' : 'pointer', transition: 'background 0.2s', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.2)' }}
              onMouseOver={e => e.currentTarget.style.background = '#B91C1C'}
              onMouseOut={e => e.currentTarget.style.background = '#DC2626'}
            >
              {isLoading ? 'กำลังบันทึก...' : 'บันทึกการเปิด-ปิดระบบ'}
            </button>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </Card>
  );
}

// 🌟 สร้าง Component สำหรับ Icon โล่ (ป้องกัน Error)
function ShieldCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  );
}