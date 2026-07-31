import { useState, useEffect, useCallback } from 'react'
import { API, ROLE_LABELS, getStatusCounts } from './utils/constants'
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
  School,
  ClipboardList,
  Users,
  Settings,
  BarChart3,
  FolderInput,
  FileEdit,
  Search,
  GraduationCap,
  LineChart,
} from 'lucide-react'

export default function App() {
  const [user, setUser]           = useState(null)
  const [schedules, setSchedules] = useState([])
  const [activeTab, setActiveTab] = useState('requests')

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch(`${API}/schedules`);
      const data = await res.json();
      setSchedules(Array.isArray(data) ? data : (data.data ?? []));
    } catch (err) { 
      console.error('โหลดข้อมูลล้มเหลว', err); 
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSchedules();
    }
  }, [user, fetchSchedules]);

  const handleLogin = (userData) => {
    setUser(userData)
    if (userData.role === 'admin') {
      setActiveTab('reports')
    } else if (userData.role === 'staff') {
      setActiveTab('booking')
    } else if (userData.role === 'teacher') {
      setActiveTab('teacher_dashboard')
    } else if (userData.role === 'executive') {
      setActiveTab('executive_dashboard')
    } else {
      setActiveTab('search')
    }
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
      if (d.success) fetchSchedules()
    } catch { alert('เกิดข้อผิดพลาด') }
  }

  const handleUpdateStatus = async (id, newStatus, remark = '') => {
    try {
      const res = await fetch(`${API}/schedules/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, remark: remark }) 
      });
      
      if (res.ok) {
        alert('อัปเดตสถานะสำเร็จ');
        fetchSchedules();
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (!user) return <LoginPage onLogin={handleLogin} />

  const counts = getStatusCounts(schedules)

  const adminTabs = [
    { id: 'requests', label: 'จัดการคำขอ', icon: ClipboardList },
    { id: 'users', label: 'จัดการสมาชิก', icon: Users },
    { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings },
    { id: 'reports', label: 'รายงานสรุป', icon: BarChart3 },
    { id: 'uploads', label: 'นำเข้า/เอกสาร', icon: FolderInput },
  ]
  const staffTabs = [
    { id: 'requests', label: 'คำขอการสอนชดเชย', icon: ClipboardList },
    { id: 'booking', label: 'ขอสอนชดเชย', icon: FileEdit },
    { id: 'search', label: 'ค้นหาตารางว่าง', icon: Search },
  ]
  const teacherTabs = [
    { id: 'teacher_dashboard', label: 'แดชบอร์ดของฉัน', icon: GraduationCap },
    { id: 'search', label: 'ค้นหาตารางว่าง', icon: Search },
  ]
  const executiveTabs = [
    { id: 'executive_dashboard', label: 'แดชบอร์ดผู้บริหาร', icon: LineChart },
    // { id: 'search', label: 'ค้นหาตารางว่าง', icon: Search },
  ]

  const currentTabs = user.role === 'admin' ? adminTabs 
                    : user.role === 'staff' ? staffTabs 
                    : user.role === 'teacher' ? teacherTabs 
                    : user.role === 'executive' ? executiveTabs
                    : []

  return (
    <div style={{ minHeight: '100vh', background: '#F9FBF9', fontFamily: '"Sarabun", "Noto Sans Thai", sans-serif' }}>

      {/* ── Navbar ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(27, 94, 32, 0.1)',
        boxShadow: '0 1px 12px rgba(0, 0, 0, 0.04)',
        padding: '0 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 60,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: '#1B5E20', letterSpacing: '-0.2px' }}>
            รระบบสารสนเทศเพื่อการจัดการตารางสอนชดเชย
          </span>
        </div>

        {currentTabs.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {currentTabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    background: activeTab === tab.id ? 'rgba(27, 94, 32, 0.08)' : 'transparent',
                    color: activeTab === tab.id ? '#1B5E20' : '#616161',
                    border: 'none', padding: '8px 16px', borderRadius: 8,
                    fontWeight: activeTab === tab.id ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 14
                  }}
                >
                  <Icon size={16} strokeWidth={2} /> {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1B5E20' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: '#81C784' }}>{ROLE_LABELS[user.role] || user.role}</div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', background: 'rgba(27, 94, 32, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#1B5E20', fontWeight: 700,
          }}>
            {user.name?.[0] || '?'}
          </div>
          <Btn small outline color="#E53935" onClick={handleLogout}>ออกจากระบบ</Btn>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '28px 24px', boxSizing: 'border-box' }}>

        {activeTab === 'requests' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              {[
                { label: 'คำขอทั้งหมด', value: counts.total,                    color: '#2E7D32', bg: '#E8F5E9' },
                { label: 'รออนุมัติ',   value: counts.pending + counts.waiting, color: '#1565C0', bg: '#E3F2FD' },
                { label: 'อนุมัติแล้ว', value: counts.approved,                 color: '#558B2F', bg: '#F1F8E9' },
              ].map((s, i) => (
                <div key={i} style={{
                  background: '#fff', borderRadius: 12,
                  border: `1.5px solid ${s.bg}`,
                  padding: '16px 20px', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 13, color: '#757575' }}>{s.label}</span>
                  <span style={{
                    fontSize: 26, fontWeight: 800, color: s.color,
                    background: s.bg, padding: '2px 12px', borderRadius: 8,
                  }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <ScheduleTable
                schedules={schedules}
                userRole={user.role}
                onDelete={handleDelete}
                onUpdateStatus={handleUpdateStatus}
                fetchSchedules={fetchSchedules}
              />
            </div>
          </>
        )}

        {user.role === 'staff' && activeTab === 'booking' && (
          <BookingForm 
            onSuccess={() => { 
              fetchSchedules()
              setActiveTab('requests')
            }} 
          />
        )}

        {(user.role === 'staff' || user.role === 'teacher' || user.role === 'executive') && activeTab === 'search' && (
          <ScheduleSearch />
        )}
        {user.role === 'admin' && activeTab === 'users' && (
          <UserManagement />
        )}
        {user.role === 'admin' && activeTab === 'settings' && (
          <SystemSettings />
        )}

        {user.role === 'admin' && activeTab === 'reports' && (
          <SummaryReport />
        )}

        {user.role === 'admin' && activeTab === 'uploads' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <UploadSection />
            <DocumentUpload schedules={schedules} onUploadSuccess={fetchSchedules} />
          </div>
        )}
        

        {user.role === 'teacher' && activeTab === 'teacher_dashboard' && (
          <TeacherDashboard user={user} schedules={schedules} />
        )}
        {user.role === 'executive' && activeTab === 'executive_dashboard' && (
          <ExecutiveDashboard schedules={schedules} fetchSchedules={fetchSchedules} />
        )}
      </div>
    </div>
  )
}