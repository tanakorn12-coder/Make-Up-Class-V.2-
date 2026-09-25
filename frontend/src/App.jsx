import { useState, useEffect, useCallback, useRef } from 'react'
import { API, ROLE_LABELS, getStatusCounts } from './utils/constants'
import DownloadSchedules from './components/DownloadSchedules';
import UserManagement from "./components/UserManagement";
import TeacherDashboard from './components/TeacherDashboard';
import ExecutiveDashboard from './components/ExecutiveDashboard'; 
import LoginPage      from './components/LoginPage'
import SettingsPage   from './components/SettingsPage'
import ReportPage     from './components/ReportPage';
import DocumentUpload from './components/DocumentUpload';
import SystemSettings from './components/SystemSettings';
import SummaryReport from './components/SummaryReport';
import ScheduleSearch from './components/ScheduleSearch';
import UploadSection  from './components/UploadSection'
import BookingForm    from './components/BookingForm'
import ScheduleTable  from './components/ScheduleTable'
import { Btn }        from './components/ui'
import {
  ClipboardList,
  Users,
  Settings,
  BarChart3,
  FolderInput,
  FileEdit,
  Search,
  GraduationCap,
  LineChart,
  Download,
  CalendarDays,
  ChevronDown,
  LogOut,
  Check
} from 'lucide-react'

// ==========================================
// 🌟 1. Custom Dropdown สำหรับเลือกปีการศึกษา 
// ==========================================
const PremiumPeriodSelector = ({ current, available, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayText = current?.academic_year 
    ? `ปี ${current.academic_year} / เทอม ${current.semester}` 
    : 'เลือกปีการศึกษา';

  return (
    <div ref={dropdownRef} className="premium-dropdown-container">
      <div 
        className={`period-widget ${isOpen ? 'active' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="period-icon">
          <CalendarDays size={18} strokeWidth={2.5} color="#059669" />
        </div>
        <div className="period-content">
          <span className="period-label">ปีการศึกษา / เทอม</span>
          <span className="period-value">{displayText}</span>
        </div>
        <ChevronDown size={14} color="#94A3B8" className={`period-arrow ${isOpen ? 'open' : ''}`} />
      </div>

      {isOpen && (
        <div className="premium-dropdown-menu">
          {available.length === 0 ? (
            <div className="dropdown-empty">ไม่มีข้อมูลปีการศึกษา</div>
          ) : (
            available.map((p, idx) => {
              const isSelected = current?.academic_year === p.academic_year && current?.semester === p.semester;
              return (
                <button
                  key={idx}
                  className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => { 
                    onChange(p); 
                    setIsOpen(false); 
                  }}
                >
                  <span style={{ fontSize: '14px' }}>ปี {p.academic_year} / เทอม {p.semester}</span>
                  {isSelected && <Check size={18} strokeWidth={3} color="#16A34A" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};


// ==========================================
// 🌟 2. Component หลัก App
// ==========================================
export default function App() {
  const [user, setUser]           = useState(null)
  const [schedules, setSchedules] = useState([])
  
  const [academicPeriod, setAcademicPeriod] = useState({ academic_year: '', semester: '' })
  const [availablePeriods, setAvailablePeriods] = useState([])
  
  const [activeTab, setActiveTab] = useState('requests')

  // 🌟 โหลดข้อมูลทั้งหมด (เพิ่มระบบป้องกัน Cache ให้ดึงข้อมูลใหม่แบบเรียลไทม์ 100%)
  const loadAllData = useCallback(async () => {
    try {
      const timestamp = new Date().getTime(); // ตัวหลอกเบราว์เซอร์ไม่ให้จำแคชเก่า

      const resSched = await fetch(`${API}/schedules?_t=${timestamp}`);
      const dataSched = await resSched.json();
      setSchedules(Array.isArray(dataSched) ? dataSched : (dataSched.data ?? []));

      const resPeriods = await fetch(`${API}/academic-settings?_t=${timestamp}`);
      const dataPeriods = await resPeriods.json();
      
      if (dataPeriods.success && dataPeriods.data) {
        let loadedPeriods = dataPeriods.data.periods || [];
        const currentDbPeriod = dataPeriods.data.current;

        setAcademicPeriod(prev => {
          if (!prev.academic_year && currentDbPeriod) return currentDbPeriod;
          return prev;
        });

        if (currentDbPeriod && !loadedPeriods.some(p => p.academic_year === currentDbPeriod.academic_year && p.semester === currentDbPeriod.semester)) {
          loadedPeriods = [currentDbPeriod, ...loadedPeriods];
        }
        
        setAvailablePeriods(loadedPeriods);
      }
    } catch (err) { 
      console.error('โหลดข้อมูลล้มเหลว', err); 
    }
  }, []);

  useEffect(() => {
    if (user) loadAllData();
  }, [user, loadAllData]);

  useEffect(() => {
    const handleAcademicPeriodChange = (event) => setAcademicPeriod(event.detail);
    const handleGlobalRefresh = () => loadAllData(); 
    
    window.addEventListener('academic-period-changed', handleAcademicPeriodChange);
    window.addEventListener('refresh-global-data', handleGlobalRefresh);
    
    return () => {
      window.removeEventListener('academic-period-changed', handleAcademicPeriodChange);
      window.removeEventListener('refresh-global-data', handleGlobalRefresh);
    }
  }, [loadAllData]);

  const handleLogin = (userData) => {
    setUser(userData)
    if (userData.role === 'admin' || userData.role === 'staff') setActiveTab('requests') 
    else if (userData.role === 'teacher') setActiveTab('teacher_dashboard')
    else if (userData.role === 'executive') setActiveTab('executive_dashboard')
    else setActiveTab('search')
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
    localStorage.removeItem('activeTab')
  }

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API}/schedules/${id}`, { method: 'DELETE' })
      const d   = await res.json()
      if (d.success) loadAllData()
    } catch { alert('เกิดข้อผิดพลาด') }
  }

  const handleUpdateStatus = async (id, newStatus, remark = '') => {
    try {
      const res = await fetch(`${API}/schedules/${id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, remark: remark }) 
      });
      if (res.ok) {
        alert('อัปเดตสถานะสำเร็จ');
        loadAllData();
      }
    } catch (error) { console.error(error); }
  };

  if (!user) return <LoginPage onLogin={handleLogin} />

  const visibleSchedules = schedules.filter(schedule => {
    if (!academicPeriod.academic_year || !academicPeriod.semester) return true
    if (!schedule.academic_year || !schedule.semester) return true
    return schedule.academic_year === academicPeriod.academic_year && schedule.semester === academicPeriod.semester
  })
  
  const counts = getStatusCounts(visibleSchedules)

  const adminTabs = [
    { id: 'requests', label: 'จัดการคำขอ', icon: ClipboardList },
    { id: 'users', label: 'จัดการสมาชิก', icon: Users },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings },
    { id: 'reports', label: 'รายงานสรุป', icon: BarChart3 },
    { id: 'uploads', label: 'นำเข้าข้อมูล', icon: FolderInput },
    { id: 'downloads', label: 'โหลดเอกสารตาราง', icon: Download },
  ]
  const staffTabs = [
    { id: 'requests', label: 'คำขอชดเชย', icon: ClipboardList },
    { id: 'booking', label: 'ใบแจ้งทำการสอนชดเชย', icon: FileEdit },
    { id: 'search', label: 'ค้นหาตาราง', icon: Search },
    { id: 'downloads', label: 'โหลดเอกสารตาราง', icon: Download },
  ]
  const teacherTabs = [
    { id: 'teacher_dashboard', label: 'แดชบอร์ด', icon: GraduationCap },
    { id: 'search', label: 'ค้นหาตาราง', icon: Search },
  ]
  const executiveTabs = [
    { id: 'executive_dashboard', label: 'แดชบอร์ด', icon: LineChart },
  ]

  const currentTabs = user.role === 'admin' ? adminTabs : user.role === 'staff' ? staffTabs : user.role === 'teacher' ? teacherTabs : user.role === 'executive' ? executiveTabs : []

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'inherit' }}>

      {/* ── Navbar ── */}
      <nav className="glass-navbar">
        
        {/* ส่วนซ้าย: โลโก้ */}
        <div className="nav-brand">
          <div className="logo-box">
            <img src="/logosci.png" alt="โลโก้" />
          </div>
          <div className="brand-text">
            <span className="brand-title">ระบบจัดการตารางสอนชดเชย</span>
            <span className="brand-subtitle">คณะวิทยาศาสตร์และเทคโนโลยีการเกษตร</span>
          </div>
        </div>

        {/* ส่วนกลาง: เมนูแท็บ */}
        {currentTabs.length > 0 && (
          <div className="nav-tabs">
            {currentTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} /> 
                  <span className="tab-label">{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ส่วนขวา: เลือกปีการศึกษา & โปรไฟล์ */}
        <div className="nav-actions">
          
          <PremiumPeriodSelector 
            current={academicPeriod}
            available={availablePeriods}
            onChange={(newPeriod) => {
              setAcademicPeriod(newPeriod);
              window.dispatchEvent(new CustomEvent('academic-period-changed', { detail: newPeriod }));
            }}
          />

          {/* โปรไฟล์และปุ่มออก */}
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{ROLE_LABELS[user.role] || user.role}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="ออกจากระบบ">
              <LogOut size={16} strokeWidth={2.5} style={{ transform: 'translateX(-1px)' }} />
            </button>
          </div>

        </div>
      </nav>

      {/* ── Content ── */}
      <main className="main-container">
        {activeTab === 'requests' && (
          <>
            <div className="stat-grid">
              {[
                { label: 'คำขอทั้งหมด', value: counts.total, color: '#166534', bg: '#DCFCE7', border: '#BBF7D0' },
                { label: 'รออนุมัติ', value: counts.pending + counts.waiting, color: '#1E3A8A', bg: '#DBEAFE', border: '#BFDBFE' },
                { label: 'อนุมัติแล้ว', value: counts.approved, color: '#14532D', bg: '#F0FDF4', border: '#BBF7D0' },
              ].map((s, i) => (
                <div key={i} className="stat-card" style={{ borderColor: s.border }}>
                  <span className="stat-label">{s.label}</span>
                  <span className="stat-value" style={{ color: s.color, backgroundColor: s.bg }}>{s.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ScheduleTable schedules={visibleSchedules} userRole={user.role} onDelete={handleDelete} onUpdateStatus={handleUpdateStatus} fetchSchedules={loadAllData} academicPeriod={academicPeriod} />
              {user.role === 'admin' && <DocumentUpload schedules={visibleSchedules} onUploadSuccess={() => { loadAllData(); window.dispatchEvent(new Event('refresh-global-data')); }} />}
            </div>
          </>
        )}

        {user.role === 'staff' && activeTab === 'booking' && <BookingForm onSuccess={() => { loadAllData(); setActiveTab('requests'); }} academicPeriod={academicPeriod} />}
        {(user.role === 'staff' || user.role === 'teacher' || user.role === 'executive') && activeTab === 'search' && <ScheduleSearch user={user} academicPeriod={academicPeriod} />}
        {user.role === 'admin' && activeTab === 'users' && <UserManagement />}
        {user.role === 'admin' && activeTab === 'settings' && <SystemSettings />}
        {user.role === 'admin' && activeTab === 'reports' && <SummaryReport schedules={visibleSchedules} academicPeriod={academicPeriod} />}
        
        {/* เมื่ออัปโหลดไฟล์ Excel เสร็จ สั่งโหลดข้อมูลปีใหม่ให้ทันที */}
        {user.role === 'admin' && activeTab === 'uploads' && (
          <UploadSection 
            academicPeriod={academicPeriod} 
            onUploadSuccess={() => window.dispatchEvent(new Event('refresh-global-data'))} 
          />
        )}
        
        {(user.role === 'admin' || user.role === 'staff') && activeTab === 'downloads' && <DownloadSchedules academicPeriod={academicPeriod} />}
        {user.role === 'teacher' && activeTab === 'teacher_dashboard' && <TeacherDashboard user={user} schedules={visibleSchedules} academicPeriod={academicPeriod} />}
        {user.role === 'executive' && activeTab === 'executive_dashboard' && <ExecutiveDashboard schedules={visibleSchedules} academicPeriod={academicPeriod} />}
      </main>

      {/* 🌟 CSS ชุดใหม่ 🌟 */}
      <style>{`
        /* ===============================
           1. NAVBAR (Single Row Desktop)
           =============================== */
        .glass-navbar {
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid #E2E8F0;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.02);
          padding: 0 28px; height: 78px;
          position: sticky; top: 0; z-index: 100; gap: 16px;
        }

        .nav-brand { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .logo-box { display: flex; align-items: center; justify-content: center; }
        .logo-box img { width: 44px; height: 44px; object-fit: contain; }
        .brand-text { display: flex; flex-direction: column; }
        .brand-title { font-weight: 800; font-size: 15px; color: #1B5E20; letter-spacing: -0.2px; }
        .brand-subtitle { font-size: 11px; color: #64748B; font-weight: 600; }

        .nav-tabs {
          display: flex; gap: 4px; background: #F1F5F9;
          padding: 6px; border-radius: 12px; flex-shrink: 1; overflow-x: auto;
        }
        .nav-tabs::-webkit-scrollbar { display: none; }
        .tab-btn {
          display: flex; align-items: center; gap: 6px;
          background: transparent; border: none; padding: 8px 14px;
          border-radius: 8px; color: #64748B; font-weight: 600;
          font-size: 13.5px; cursor: pointer; transition: 0.2s; white-space: nowrap;
        }
        .tab-btn:hover { background: #E2E8F0; color: #0F172A; }
        .tab-btn.active {
          background: #ffffff; color: #16A34A; font-weight: 700;
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }

        .nav-actions { display: flex; align-items: center; gap: 20px; flex-shrink: 0; }

        /* ===============================
           2. PREMIUM CUSTOM DROPDOWN (ดีไซน์ใหม่)
           =============================== */
        .premium-dropdown-container { position: relative; }
        
        .period-widget {
          display: flex; align-items: center;
          background: #ffffff; border: 1.5px solid #E2E8F0;
          padding: 6px 14px 6px 6px; border-radius: 12px;
          cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.02); min-width: 210px;
        }
        .period-widget:hover, .period-widget.active {
          border-color: #34D399; box-shadow: 0 4px 14px rgba(52, 211, 153, 0.15);
        }
        .period-widget.active { background: #F0FDF4; }

        .period-icon {
          background: #ECFDF5; padding: 8px;
          border-radius: 10px; display: flex; align-items: center;
          margin-right: 12px;
        }
        .period-content { display: flex; flex-direction: column; justify-content: center; flex: 1; }
        .period-label {
          font-size: 10px; color: #64748B; font-weight: 700;
          line-height: 1; margin-bottom: 3px; text-transform: uppercase;
        }
        .period-value { font-weight: 800; font-size: 14.5px; color: #0F172A; line-height: 1; }
        
        .period-arrow { transition: transform 0.3s ease; margin-left: 8px; }
        .period-arrow.open { transform: rotate(180deg); }

        /* เมนูเด้งลงมา */
        .premium-dropdown-menu {
          position: absolute; top: calc(100% + 10px); right: 0;
          background: #ffffff; border-radius: 14px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          border: 1px solid #E2E8F0; padding: 8px;
          min-width: 100%; z-index: 999;
          display: flex; flex-direction: column; gap: 4px;
          animation: slideDownFade 0.2s ease-out forwards;
        }

        .dropdown-option {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 12px 14px;
          background: transparent; border: none; border-radius: 10px;
          color: #475569; font-weight: 500; font-size: 14px;
          cursor: pointer; transition: all 0.15s; text-align: left;
        }
        .dropdown-option:hover { background: #F8FAFC; color: #0F172A; }
        .dropdown-option.selected {
          background: #ECFDF5; color: #166534; font-weight: 700;
        }

        .dropdown-empty { padding: 16px; text-align: center; color: #94A3B8; font-size: 13.5px; }

        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* โปรไฟล์ */
        .user-profile {
          display: flex; align-items: center; gap: 12px;
          border-left: 1.5px solid #E2E8F0; padding-left: 20px;
        }
        .user-info { display: flex; flex-direction: column; text-align: right; }
        .user-name { font-weight: 700; font-size: 13.5px; color: #1E293B; }
        .user-role { font-weight: 600; font-size: 11px; color: #16A34A; }
        .btn-logout {
          background: #FEF2F2; color: #EF4444; border: 1px solid #FEE2E2;
          width: 38px; height: 38px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: 0.2s;
        }
        .btn-logout:hover { background: #EF4444; color: #ffffff; transform: scale(1.05); }

        /* ===============================
           3. MAIN CONTENT
           =============================== */
        .main-container { width: 100%; max-width: 1440px; margin: 0 auto; padding: 28px; box-sizing: border-box; }
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: #ffffff; border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.02); border: 1px solid #E2E8F0; }
        .stat-label { font-size: 13.5px; font-weight: 600; color: #64748B; }
        .stat-value { font-size: 26px; font-weight: 800; padding: 4px 16px; border-radius: 10px; }

        /* ===============================
           4. RESPONSIVE
           =============================== */
        @media (max-width: 1150px) {
          .brand-subtitle { display: none; }
          .tab-label { display: none; }
          .glass-navbar { padding: 0 16px; gap: 12px; }
        }

        @media (max-width: 768px) {
          .glass-navbar { flex-direction: column; height: auto; padding: 16px; gap: 16px; align-items: stretch; }
          .nav-brand { justify-content: center; width: 100%; }
          .brand-subtitle { display: block; text-align: center; }
          .brand-text { align-items: center; }
          
          .nav-actions { width: 100%; justify-content: space-between; gap: 12px; }
          .premium-dropdown-container { flex: 1; }
          .period-widget { width: 100%; }
          .user-profile { border-left: none; padding-left: 0; }
          .user-info { display: none; }
          
          .nav-tabs { width: 100%; overflow-x: auto; justify-content: flex-start; padding: 8px; }
          .tab-label { display: block; }
          
          .stat-grid { grid-template-columns: 1fr; }
          .main-container { padding: 16px; }
        }
      `}</style>
    </div>
  )
}