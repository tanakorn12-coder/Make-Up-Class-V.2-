import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './ui'; 
import { API } from '../utils/constants';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// ─── Component: บัตรแสดงสถิติ (Stat Card) ───────────────────────────────────────
function StatCard({ label, value, color, delta, deltaUp }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #ffffff 0%, #fcfcfc 100%)',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid rgba(0,0,0,0.04)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />
      <span style={{ fontSize: '15px', color: '#5C6BC0', fontWeight: 600 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
        <span style={{ fontSize: '36px', fontWeight: 700, color: '#1A237E', lineHeight: 1 }}>{value}</span>
        {delta && (
          <span style={{ 
            fontSize: '13px', 
            color: deltaUp ? '#2E7D32' : '#C62828', 
            fontWeight: 600,
            background: deltaUp ? '#E8F5E9' : '#FFEBEE',
            padding: '4px 10px',
            borderRadius: '20px'
          }}>
            {deltaUp ? 'เพิ่มขึ้น' : 'ลดลง'} {delta}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Component: แถบสถานะ (Status Bar) ──────────────────────────────────────────
function StatusBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 0', borderBottom: '1px dashed #E0E0E0' }}>
      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '15px', color: '#424242', flex: 1, fontWeight: 500 }}>{label}</span>
      <div style={{ width: '130px', background: '#F5F5F5', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '6px', transition: 'width 0.5s ease-in-out' }} />
      </div>
      <span style={{ fontSize: '15px', fontWeight: 700, color: '#212121', minWidth: '36px', textAlign: 'right' }}>{count}</span>
    </div>
  );
}

// ─── Component: ส่วนแสดงผลกราฟ (Tooltip) ───────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.98)', border: '1px solid #E8EAF6', borderRadius: '8px', padding: '16px', fontSize: '14px', boxShadow: '0 8px 24px rgba(26, 35, 126, 0.08)' }}>
      <p style={{ margin: '0 0 10px', fontWeight: 700, color: '#1A237E' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', margin: '6px 0' }}>
          <span style={{ color: '#5C6BC0', fontWeight: 500 }}>{p.name}</span>
          <span style={{ color: p.color, fontWeight: 700 }}>{p.value} รายการ</span>
        </div>
      ))}
    </div>
  );
};

// ─── Component หลัก: แดชบอร์ดผู้บริหาร (Executive Dashboard) ───────────────────
export default function ExecutiveDashboard({ schedules, fetchSchedules }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // สถานะสำหรับตัวกรองข้อมูล
  const [selectedBranch, setSelectedBranch] = useState('ทั้งหมด');
  const [selectedMonth, setSelectedMonth] = useState('ทั้งหมด');
  const [selectedYear, setSelectedYear] = useState('ทั้งหมด');

  const fetchExecStats = async () => {
    try {
      const res = await fetch(`${API}/executive/stats`);
      const json = await res.json();
      if (json.success) setStats(json);
    } catch (err) {
      console.error('พบข้อผิดพลาดในการเรียกข้อมูลสถิติ', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExecStats(); }, [schedules]);

  // การสกัดข้อมูลสำหรับตัวเลือกในตัวกรอง (Dropdown Options)
  const uniqueBranches = useMemo(() => {
    const branches = (schedules || []).map(s => s.curriculum || s.branch).filter(Boolean);
    return ['ทั้งหมด', ...new Set(branches)].sort();
  }, [schedules]);

  const uniqueYears = useMemo(() => {
    const years = (schedules || []).map(s => {
      const dateStr = s.class_date || s.created_at;
      return dateStr ? new Date(dateStr).getFullYear() : null;
    }).filter(y => y !== null && !isNaN(y));
    return ['ทั้งหมด', ...new Set(years)].sort((a, b) => b - a);
  }, [schedules]);

  const monthOptions = [
    { value: 'ทั้งหมด', label: 'ทุกเดือน' },
    { value: '1', label: 'มกราคม' }, { value: '2', label: 'กุมภาพันธ์' }, { value: '3', label: 'มีนาคม' },
    { value: '4', label: 'เมษายน' }, { value: '5', label: 'พฤษภาคม' }, { value: '6', label: 'มิถุนายน' },
    { value: '7', label: 'กรกฎาคม' }, { value: '8', label: 'สิงหาคม' }, { value: '9', label: 'กันยายน' },
    { value: '10', label: 'ตุลาคม' }, { value: '11', label: 'พฤศจิกายน' }, { value: '12', label: 'ธันวาคม' }
  ];

  // ตรรกะการกรองข้อมูลหลัก (Data Filtering Logic)
  const filteredSchedules = useMemo(() => {
    return (schedules || []).filter(s => {
      // คัดกรองสถานะที่ไม่อนุมัติออก
      if (s.status === 'ไม่อนุมัติ') return false;

      // คัดกรองตามสาขาวิชา
      if (selectedBranch !== 'ทั้งหมด' && s.curriculum !== selectedBranch && s.branch !== selectedBranch) return false;

      // คัดกรองตามวันที่
      const dateStr = s.class_date || s.created_at;
      if (dateStr) {
        const d = new Date(dateStr);
        if (selectedYear !== 'ทั้งหมด' && d.getFullYear().toString() !== selectedYear.toString()) return false;
        if (selectedMonth !== 'ทั้งหมด' && (d.getMonth() + 1).toString() !== selectedMonth) return false;
      }

      return true;
    });
  }, [schedules, selectedBranch, selectedMonth, selectedYear]);

  // การประมวลผลข้อมูลเชิงสถิติจากข้อมูลที่ผ่านการกรองแล้ว
  const {
    computedLeaderboard,
    computedSubjects,
    computedTeacherStats,
    computedDays,
    computedTrend
  } = useMemo(() => {
    const tStats = {};
    const subjStats = {};
    const dCounts = { 'อาทิตย์': 0, 'จันทร์': 0, 'อังคาร': 0, 'พุธ': 0, 'พฤหัสบดี': 0, 'ศุกร์': 0, 'เสาร์': 0 };
    const mStats = {}; 
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

    filteredSchedules.forEach(s => {
      const tName = s.teacher_name || 'ไม่ระบุ';
      const tTitle = s.title || 'อาจารย์';
      const fullName = tName === 'ไม่ระบุ' ? tName : `${tTitle} ${tName}`.trim();

      if (!tStats[fullName]) tStats[fullName] = { teacher_name: fullName, total: 0, approved: 0 };
      tStats[fullName].total += 1;

      const scode = s.subject_code || 'ไม่ระบุรหัส';
      if (!subjStats[scode]) subjStats[scode] = { subject_code: scode, subject_name: s.subject_name || '', count: 0 };
      subjStats[scode].count += 1;

      if (s.status === 'อนุมัติแล้ว' || s.status === 'อนุมัติ') {
        tStats[fullName].approved += 1;
        if (s.class_date) {
          const d = new Date(s.class_date).getDay();
          const dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
          dCounts[dayNames[d]] += 1;
        }
      }

      const dStr = s.created_at || s.class_date;
      if (dStr) {
        const d = new Date(dStr);
        const mKey = `${monthNames[d.getMonth()]} ${d.getFullYear() + 543}`.substring(0, 10);
        if (!mStats[mKey]) mStats[mKey] = { month: mKey, rawDate: d.getTime(), คำขอรวม: 0, อนุมัติแล้ว: 0 };
        
        mStats[mKey].คำขอรวม += 1;
        if (s.status === 'อนุมัติแล้ว' || s.status === 'อนุมัติ') mStats[mKey].อนุมัติแล้ว += 1;
      }
    });

    const cTeacherStats = Object.values(tStats).sort((a, b) => b.total - a.total);
    const cLeaderboard = [...cTeacherStats].filter(t => t.approved > 0).sort((a, b) => b.approved - a.approved).slice(0, 5).map(t => ({ teacher_name: t.teacher_name, count: t.approved }));
    const cSubjects = Object.values(subjStats).sort((a, b) => b.count - a.count).slice(0, 10);
    const cDays = Object.entries(dCounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const cTrend = Object.values(mStats).sort((a, b) => a.rawDate - b.rawDate).slice(-6);

    return {
      computedLeaderboard: cLeaderboard,
      computedSubjects: cSubjects,
      computedTeacherStats: cTeacherStats,
      computedDays: cDays,
      computedTrend: cTrend
    };
  }, [filteredSchedules]);

  if (loading || !stats) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', fontFamily: 'Sarabun, sans-serif', color: '#5C6BC0' }}>
      กำลังประมวลผลข้อมูลทางสถิติ...
    </div>
  );

  const total = filteredSchedules.length;
  const approved = filteredSchedules.filter(s => s.status === 'อนุมัติ' || s.status === 'อนุมัติแล้ว').length;
  const pendingAdmin = filteredSchedules.filter(s => s.status === 'รอตรวจสอบ').length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  const donutData = [
    { name: 'ดำเนินการเสร็จสิ้น', value: Number(approved), color: '#2E7D32' },
    { name: 'อยู่ระหว่างดำเนินการ', value: Number(pendingAdmin), color: '#FBC02D' }, 
  ].filter(d => d.value > 0);

  // ─── กำหนดรูปแบบเอกสาร (Styling Variables) ────────────────────────────────────
  const S = {
    wrap: { display: 'flex', flexDirection: 'column', gap: '24px', fontFamily: 'Sarabun, sans-serif', background: '#F8F9FA', padding: '32px', borderRadius: '16px' },
    filterBar: { display: 'flex', flexWrap: 'wrap', gap: '16px', background: '#FFFFFF', padding: '16px 24px', borderRadius: '12px', border: '1px solid #E8EAF6', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' },
    selectGroup: { display: 'flex', alignItems: 'center', gap: '12px' },
    selectLabel: { fontSize: '14px', fontWeight: 600, color: '#5C6BC0' },
    selectInput: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #C5CAE9', outline: 'none', background: '#F8F9FA', fontSize: '14px', color: '#1A237E', cursor: 'pointer', minWidth: '160px' },
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' },
    grid2L: { display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1.2fr)', gap: '24px' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' },
    card: { background: '#ffffff', borderRadius: '12px', padding: '28px', border: '1px solid #E8EAF6', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' },
    cardTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#1A237E', paddingBottom: '20px', marginBottom: '20px', borderBottom: '1px solid #E8EAF6' },
    
    // รูปแบบปุ่มนำทาง (Pill Tabs) อ้างอิงจากภาพ
    tabGroup: { display: 'flex', gap: '12px', justifyContent: 'flex-end' },
    tab: (active) => ({
      padding: '8px 24px',
      borderRadius: '24px',
      border: active ? '1px solid #1A237E' : '1px solid #E0E0E0',
      background: active ? '#1A237E' : '#FFFFFF',
      color: active ? '#FFFFFF' : '#424242',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: 600,
      transition: 'all 0.2s ease-in-out',
      outline: 'none'
    }),
    
    // รูปแบบรายการข้อมูลอ้างอิงจากภาพ
    listItemLeaderboard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#F8F9FA', borderRadius: '8px', borderLeft: '4px solid #1A237E', marginBottom: '12px' },
    listItemDays: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#FFFDE7', borderRadius: '8px', borderLeft: '4px solid #FBC02D', marginBottom: '12px' }
  };

  return (
    <div style={S.wrap}>
      
      {/* ─── ส่วนตัวกรองข้อมูล (Filter Section) ─── */}
      <div style={S.filterBar}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1A237E' }}>ภาพรวมสถิติการจัดการเรียนการสอนชดเชย</h2>
        </div>
        <div style={S.selectGroup}>
          <span style={S.selectLabel}>สาขาวิชา:</span>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} style={S.selectInput}>
            {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={S.selectGroup}>
          <span style={S.selectLabel}>เดือน:</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} style={S.selectInput}>
            {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div style={S.selectGroup}>
          <span style={S.selectLabel}>ปี:</span>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} style={S.selectInput}>
            {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ─── ส่วนแสดงผลตัวเลขภาพรวม (Key Metrics) ─── */}
      <div style={S.grid3}>
        <StatCard label="ปริมาณคำขอรวม" value={total} color="#1A237E" delta="รายการที่เข้าสู่ระบบ" deltaUp />
        <StatCard label="อยู่ระหว่างการพิจารณา" value={pendingAdmin} color="#FBC02D" />
        <StatCard label="อัตราการดำเนินการสำเร็จ" value={`${approvalRate}%`} color="#2E7D32" delta={`${approved} จาก ${total} รายการ`} deltaUp />
      </div>

      <div style={S.grid2L}>
        {/* ─── ส่วนแสดงผลกราฟแนวโน้ม (Trend Chart) ─── */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>แนวโน้มการจัดการคำขอ (6 เดือนล่าสุด)</h3>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', paddingLeft: '10px' }}>
            {[['#1A237E','ปริมาณคำขอรวม'],['#2E7D32','ดำเนินการเสร็จสิ้น']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 500, color: '#424242' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: c, display: 'inline-block' }} />{l}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={computedTrend} barGap={8} barCategoryGap="25%" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8EAF6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 13, fontWeight: 500, fill: '#5C6BC0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 13, fontWeight: 500, fill: '#5C6BC0' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8F9FA' }} />
              <Bar dataKey="คำขอรวม" fill="#1A237E" radius={[6,6,0,0]} />
              <Bar dataKey="อนุมัติแล้ว" fill="#2E7D32" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ─── ส่วนแสดงสัดส่วนสถานะ (Status Breakdown) ─── */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>สถานะปัจจุบัน</h3>
          <StatusBar label="ดำเนินการเสร็จสิ้น" count={approved} total={total} color="#2E7D32" />
          <StatusBar label="อยู่ระหว่างการตรวจสอบ" count={pendingAdmin} total={total} color="#FBC02D" />

          <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #E8EAF6' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#1A237E', marginBottom: '16px' }}>สัดส่วนความสำเร็จ</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                <PieChart width={120} height={120}>
                  <Pie data={donutData} cx={60} cy={60} innerRadius={42} outerRadius={60} dataKey="value" strokeWidth={0}>
                    {donutData.map((d, i) => <Cell key={`cell-${i}`} fill={d.color} />)}
                  </Pie>
                </PieChart>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '20px', fontWeight: 700, color: '#1A237E' }}>{approvalRate}%</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', width: '100%' }}>
                {donutData.map((d) => (
                  <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                    <span style={{ color: '#5C6BC0', fontWeight: 500 }}>{d.name}</span>
                    <strong style={{ color: '#1A237E', marginLeft: 'auto', fontSize: '15px' }}>{d.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ส่วนแสดงผลข้อมูลเชิงลึก (Insights Section) ─── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#1A237E' }}>เจาะลึกมิติข้อมูล </h3>
          <div style={S.tabGroup}>
            {[['overview','มิติภาพรวม'],['subjects','มิติรายวิชา'],['teachers','มิติบุคลากร']].map(([key, label]) => (
              <button key={key} style={S.tab(activeTab === key)} onClick={() => setActiveTab(key)}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ paddingTop: '8px' }}>
          {/* แถบข้อมูล: มิติภาพรวม */}
          {activeTab === 'overview' && (
            <div style={S.grid2}>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#424242', marginBottom: '16px' }}>ผู้สอนที่ขอชดเชยสูงสุด (Top 5)</p>
                {computedLeaderboard.length === 0 ? (
                  <p style={{ fontSize: '14px', color: '#9E9E9E' }}>- ไม่มีข้อมูลในระบบ -</p>
                ) : computedLeaderboard.map((t, i) => (
                  <div key={i} style={S.listItemLeaderboard}>
                    <span style={{ color: '#424242', fontWeight: 600, fontSize: '15px' }}>
                      <span style={{ color: '#9FA8DA', marginRight: '12px' }}>#{i + 1}</span>{t.teacher_name}
                    </span>
                    <span style={{ background: '#E8EAF6', color: '#1A237E', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>
                      {t.count} ครั้ง
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#424242', marginBottom: '16px' }}>สถิติตามวัน</p>
                {computedDays.length === 0 ? (
                  <p style={{ fontSize: '14px', color: '#9E9E9E' }}>- ไม่มีข้อมูลในระบบ -</p>
                ) : computedDays.map(([day, count], i) => (
                  <div key={i} style={S.listItemDays}>
                    <span style={{ fontSize: '15px', color: '#424242', fontWeight: 600 }}>วัน{day}</span>
                    <span style={{ background: '#FFF9C4', color: '#F57F17', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>{count} ครั้ง</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* แถบข้อมูล: มิติรายวิชา */}
          {activeTab === 'subjects' && (
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#424242', marginBottom: '16px' }}>วิชาที่มีความถี่ชดเชยสูงสุด (Top 10)</p>
              {computedSubjects.length === 0 ? (
                <p style={{ fontSize: '14px', color: '#9E9E9E' }}>- ไม่มีข้อมูลในระบบ -</p>
              ) : computedSubjects.map((s, i) => {
                const maxCount = computedSubjects[0]?.count ?? 1;
                const pct = Math.round((s.count / maxCount) * 100);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '14px 0', borderBottom: '1px solid #F5F5F5' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1A237E', background: '#E8EAF6', padding: '6px 12px', borderRadius: '6px', minWidth: '90px', textAlign: 'center' }}>
                      {s.subject_code}
                    </span>
                    <span style={{ fontSize: '15px', color: s.subject_name ? '#424242' : '#9E9E9E', flex: 1, fontWeight: 500 }}>
                      {s.subject_name || '(ไม่ระบุชื่อวิชา)'}
                    </span>
                    <div style={{ width: '180px', background: '#F5F5F5', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: '#5C6BC0', borderRadius: '6px' }} />
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#1A237E', minWidth: '70px', textAlign: 'right' }}>{s.count} ครั้ง</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* แถบข้อมูล: มิติบุคลากร */}
          {activeTab === 'teachers' && (
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#424242', marginBottom: '16px' }}>ดัชนีการรายงานรายบุคคล</p>
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #E8EAF6' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      {['ลำดับ','ชื่อ-นามสกุล บุคลากร','จำนวนรายการยื่น','จำนวนที่อนุมัติ','ร้อยละความสำเร็จ'].map((h, i) => (
                        <th key={i} style={{
                          padding: '16px', background: '#F8F9FA', color: '#1A237E',
                          fontWeight: 700, fontSize: '14px', textAlign: i >= 2 ? 'center' : 'left',
                          borderBottom: '2px solid #E8EAF6', whiteSpace: 'nowrap'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {computedTeacherStats.map((t, i) => {
                      const tRate = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', color: '#9FA8DA', fontWeight: 600 }}>{i + 1}</td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', fontWeight: 500, color: '#424242' }}>{t.teacher_name}</td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', textAlign: 'center', fontWeight: 700, color: '#5C6BC0' }}>{t.total}</td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', textAlign: 'center' }}>
                            <span style={{ background: '#E8F5E9', color: '#2E7D32', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>{t.approved}</span>
                          </td>
                          <td style={{ padding: '14px 16px', borderBottom: '1px solid #F5F5F5', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                              <div style={{ width: '80px', background: '#F5F5F5', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${tRate}%`, height: '100%', background: tRate >= 80 ? '#2E7D32' : tRate >= 50 ? '#FBC02D' : '#C62828', borderRadius: '4px' }} />
                              </div>
                              <span style={{ fontSize: '14px', fontWeight: 700, color: tRate >= 80 ? '#2E7D32' : tRate >= 50 ? '#F57F17' : '#C62828', minWidth: '40px', textAlign: 'right' }}>{tRate}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}