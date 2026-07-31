import React from 'react';
import { Btn } from './ui';
import {
  School,
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
  const navStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1B5E20',
    padding: '12px 24px',
    color: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '24px'
  };

  const menuContainerStyle = {
    display: 'flex',
    gap: '10px'
  };

  const NavButton = ({ tabId, label, Icon }) => {
    const isActive = activeTab === tabId;
    return (
      <button
        onClick={() => setActiveTab(tabId)}
        style={{
          backgroundColor: isActive ? '#43A047' : 'transparent',
          color: '#fff',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: isActive ? 600 : 400,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          transition: 'background-color 0.2s'
        }}
      >
        <Icon size={16} strokeWidth={2} />
        {label}
      </button>
    );
  };

  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <School size={20} strokeWidth={2} />
          ระบบสารสนเทศเพื่อการจัดการตารางสอนชดเชย
        </h2>

        {user.role === 'admin' && (
          <div style={menuContainerStyle}>
            <NavButton tabId="requests" label="จัดการคำขอ" Icon={ClipboardList} />
            <NavButton tabId="users" label="จัดการสมาชิก" Icon={Users} />
            <NavButton tabId="settings" label="ตั้งค่าระบบ" Icon={Settings} />
            <NavButton tabId="reports" label="รายงานสรุป" Icon={BarChart3} />
            <NavButton tabId="uploads" label="นำเข้าข้อมูล" Icon={FolderInput} />
          </div>
        )}

        {user.role === 'staff' && (
          <div style={menuContainerStyle}>
            <NavButton tabId="requests" label="คำขอของฉัน" Icon={ClipboardList} />
            <NavButton tabId="search" label="ค้นหาตารางว่าง" Icon={Search} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <span style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <UserCircle size={18} strokeWidth={2} />
          {user.name} ({user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.role})
        </span>
        <Btn small color="#E53935" onClick={onLogout}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LogOut size={14} strokeWidth={2} />
            ออกจากระบบ
          </span>
        </Btn>
      </div>
    </nav>
  );
}