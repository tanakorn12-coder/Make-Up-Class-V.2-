import React from 'react';
import { Btn } from './ui';
import {
  ClipboardList,
  Users,
  Settings,
  BarChart3,
  FolderInput,
  Search,
  UserCircle,
  LogOut,
} from 'lucide-react';

export default function Navbar({ user, onLogout, activeTab, setActiveTab }) {
  
  // 🌟 ปุ่มเมนู (ดีไซน์แบบแคปซูล & Gradient)
  const NavButton = ({ tabId, label, Icon }) => {
    const isActive = activeTab === tabId;
    return (
      <button
        onClick={() => setActiveTab(tabId)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: isActive ? '#16A34A' : 'transparent',
          backgroundImage: isActive ? 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)' : 'none',
          color: isActive ? '#ffffff' : '#64748B',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '50px', // ทรงแคปซูล
          cursor: 'pointer',
          fontWeight: isActive ? 700 : 600,
          fontSize: '14px',
          boxShadow: isActive ? '0 4px 12px rgba(22, 163, 74, 0.3)' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isActive ? 'translateY(-1px)' : 'none'
        }}
        onMouseOver={e => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'rgba(241, 245, 249, 0.8)';
            e.currentTarget.style.color = '#0F172A';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }
        }}
        onMouseOut={e => {
          if (!isActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#64748B';
            e.currentTarget.style.transform = 'none';
          }
        }}
        onMouseDown={e => e.currentTarget.style.transform = 'translateY(1px)'}
        onMouseUp={e => e.currentTarget.style.transform = isActive ? 'translateY(-1px)' : 'none'}
      >
        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    // 🌟 Floating Glassmorphism Navbar (แถบเมนูลอยตัว)
    <nav style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      padding: '12px 24px',
      margin: '20px auto 32px auto', // ดันขอบให้ลอยจากด้านบน
      width: 'calc(100% - 48px)',
      maxWidth: '1440px',
      borderRadius: '24px', // ทำขอบให้มนโค้งแบบแอปฯ มือถือ
      border: '1px solid rgba(255, 255, 255, 0.5)',
      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)',
      backdropFilter: 'blur(24px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.5)', // สำหรับผู้ใช้ Apple
      position: 'sticky',
      top: '20px',
      zIndex: 100
    }}>
      
      {/* ─── โลโก้ และ เมนูด้านซ้าย ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        
        {/* ส่วนโลโก้ */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', paddingRight: '16px', borderRight: '1.5px solid #F1F5F9' }}
          onMouseOver={e => {
            e.currentTarget.querySelector('img').style.transform = 'scale(1.08) rotate(-5deg)';
            e.currentTarget.querySelector('.logo-title').style.letterSpacing = '0.5px';
          }}
          onMouseOut={e => {
            e.currentTarget.querySelector('img').style.transform = 'scale(1) rotate(0)';
            e.currentTarget.querySelector('.logo-title').style.letterSpacing = 'normal';
          }}
        >
          <div style={{
            background: '#ffffff', padding: '6px', borderRadius: '14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <img 
              src="/logosci.png" 
              alt="โลโก้คณะวิทยาศาสตร์" 
              style={{ width: '40px', height: '40px', objectFit: 'contain', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="logo-title" style={{ 
              margin: 0, fontSize: '15px', fontWeight: 900, 
              background: 'linear-gradient(90deg, #166534, #16A34A)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              transition: 'letter-spacing 0.3s ease'
            }}>
              ระบบจัดการตารางสอน
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748B', fontWeight: 600, letterSpacing: '0.2px' }}>
              คณะวิทยาศาสตร์และเทคโนโลยีฯ
            </p>
          </div>
        </div>

        {/* กล่องเมนู */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {user.role === 'admin' && (
            <>
              <NavButton tabId="requests" label="จัดการคำขอ" Icon={ClipboardList} />
              <NavButton tabId="users" label="จัดการสมาชิก" Icon={Users} />
              <NavButton tabId="settings" label="ตั้งค่าระบบ" Icon={Settings} />
              <NavButton tabId="reports" label="รายงานสรุป" Icon={BarChart3} />
              <NavButton tabId="uploads" label="นำเข้าข้อมูล" Icon={FolderInput} />
            </>
          )}

          {user.role === 'staff' && (
            <>
              <NavButton tabId="requests" label="คำขอของฉัน" Icon={ClipboardList} />
              <NavButton tabId="search" label="ค้นหาตารางว่าง" Icon={Search} />
            </>
          )}
        </div>
      </div>

      {/* ─── โปรไฟล์ และ ปุ่มออกระบบ ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '12px', 
          background: 'rgba(255, 255, 255, 0.6)', 
          padding: '6px 16px 6px 6px', 
          borderRadius: '50px', 
          border: '1px solid rgba(255,255,255,0.8)',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,1), 0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)', 
            padding: '6px', borderRadius: '50%', color: '#16A34A' 
          }}>
            <UserCircle size={22} strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#1E293B', lineHeight: 1.2 }}>{user.name}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#16A34A' }}>
              {user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.role}
            </span>
          </div>
        </div>
        
        {/* เส้นขีดคั่นกลางบางๆ */}
        <div style={{ width: '1.5px', height: '24px', background: '#E2E8F0', borderRadius: '10px' }}></div>

        {/* ปุ่ม Logout แบบมินิมอลวงกลม */}
        <button 
          onClick={onLogout}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '42px', height: '42px',
            backgroundColor: '#ffffff', color: '#EF4444', 
            border: '1px solid #FEE2E2',
            borderRadius: '50%', cursor: 'pointer', 
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
          }}
          title="ออกจากระบบ"
          onMouseOver={e => {
            e.currentTarget.style.backgroundColor = '#EF4444';
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.transform = 'scale(1.05) rotate(5deg)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.color = '#EF4444';
            e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.1)';
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
          onMouseUp={e => e.currentTarget.style.transform = 'scale(1.05)'}
        >
          <LogOut size={18} strokeWidth={2.5} style={{ transform: 'translateX(-1px)' }} />
        </button>
      </div>

    </nav>
  );
}