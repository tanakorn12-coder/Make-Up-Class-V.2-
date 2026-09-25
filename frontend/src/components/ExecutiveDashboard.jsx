import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Users, Clock, CalendarDays, Filter, FileText, CheckCircle2, ChevronLeft, ChevronRight, Search } from 'lucide-react';

// ─── Component: บัตรแสดงสถิติ (Stat Card) ───────────────────────────────────────
function StatCard({ label, value, color, icon: Icon, delta, deltaUp }) {
  return (
    <div style={{
      background: '#ffffff', borderRadius: '16px', padding: '24px',
      border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
      display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '15px', color: '#64748B', fontWeight: 600 }}>{label}</span>
        {Icon && <div style={{ background: `${color}15`, padding: '10px', borderRadius: '12px', color: color }}><Icon size={20} /></div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
        <span style={{ fontSize: '36px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</span>
      </div>
      {delta && (
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: deltaUp ? '#16A34A' : '#DC2626' }}>
          <span style={{ background: deltaUp ? '#DCFCE7' : '#FEE2E2', padding: '4px 10px', borderRadius: '20px' }}>
            {deltaUp ? '↗ ' : '↘ '} {delta}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Component: แถบสถานะ (Status Bar) ──────────────────────────────────────────
function StatusBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px dashed #F1F5F9' }}>
      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: '15px', color: '#334155', flex: 1, fontWeight: 600 }}>{label}</span>
      <div style={{ width: '140px', background: '#F1F5F9', borderRadius: '50px', height: '8px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '50px', transition: 'width 0.5s ease' }} />
      </div>
      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', minWidth: '40px', textAlign: 'right' }}>{count}</span>
    </div>
  );
}

// ─── Component: ส่วนแสดงผลกราฟ (Tooltip) ───────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', fontSize: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
      <p style={{ margin: '0 0 12px', fontWeight: 700, color: '#1E293B', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '32px', margin: '8px 0' }}>
          <span style={{ color: '#64748B', fontWeight: 600 }}>{p.name}</span>
          <span style={{ color: p.color, fontWeight: 800 }}>{p.value} รายการ</span>
        </div>
      ))}
    </div>
  );
};

// ─── Component หลัก: แดชบอร์ดผู้บริหาร (Executive Dashboard) ───────────────────
export default function ExecutiveDashboard({ schedules = [], academicPeriod }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [insightPage, setInsightPage] = useState(1);
  const [insightQuery, setInsightQuery] = useState(''); // 🌟 ใช้สำหรับช่องค้นหาในตาราง
  const INSIGHT_PAGE_SIZE = 5;
  
  const [selectedBranch, setSelectedBranch] = useState('ทั้งหมด');
  const [selectedStatus, setSelectedStatus] = useState('ทั้งหมด');

  // รีเซ็ตหน้าและช่องค้นหาเมื่อเปลี่ยนแท็บ
  useEffect(() => {
    setInsightPage(1);
    setInsightQuery('');
  }, [activeTab]);

  const uniqueBranches = useMemo(() => {
    const branches = schedules.map(s => s.curriculum || s.branch).filter(Boolean);
    return ['ทั้งหมด', ...new Set(branches)].sort();
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (academicPeriod?.academic_year && academicPeriod?.semester) {
        if (String(s.academic_year) !== String(academicPeriod.academic_year) || String(s.semester) !== String(academicPeriod.semester)) {
          return false;
        }
      }
      if (selectedStatus !== 'ทั้งหมด' && s.status !== selectedStatus) return false;
      if (selectedBranch !== 'ทั้งหมด' && s.curriculum !== selectedBranch && s.branch !== selectedBranch) return false;

      return true;
    });
  }, [schedules, academicPeriod, selectedBranch, selectedStatus]);

  // ประมวลผลสถิติและรวมการกรองด้วยคำค้นหา (insightQuery)
  const { computedLeaderboard, computedSubjects, computedTeacherStats, computedDays, computedTrend } = useMemo(() => {
    const tStats = {};
    const subjStats = {};
    const dCounts = { 'อาทิตย์': 0, 'จันทร์': 0, 'อังคาร': 0, 'พุธ': 0, 'พฤหัสบดี': 0, 'ศุกร์': 0, 'เสาร์': 0 };
    const mStats = {}; 
    const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

    filteredSchedules.forEach(s => {
      const tName = s.teacher_name || 'ไม่ระบุ';
      const tTitle = s.title || 'อาจารย์';
      const fullName = tName === 'ไม่ระบุ' ? tName : `${tTitle} ${tName}`.trim();
      const branchName = s.curriculum || s.branch || 'ไม่ระบุสาขา';

      if (!tStats[fullName]) tStats[fullName] = { teacher_name: fullName, branch: branchName, total: 0, approved: 0 };
      tStats[fullName].total += 1;

      const scode = s.subject_code || 'ไม่ระบุรหัส';
      if (!subjStats[scode]) subjStats[scode] = { subject_code: scode, subject_name: s.subject_name || '', branch: branchName, count: 0, approved: 0 };
      subjStats[scode].count += 1;

      const isApproved = s.status === 'อนุมัติแล้ว' || s.status === 'อนุมัติ' || s.status === 3;

      if (isApproved) {
        tStats[fullName].approved += 1;
        subjStats[scode].approved += 1;
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
        if (isApproved) mStats[mKey].อนุมัติแล้ว += 1;
      }
    });

    const searchQuery = insightQuery.trim().toLowerCase();

    // 🌟 กรองข้อมูลตารางเมื่อพิมพ์ช่องค้นหา
    const cTeacherStats = Object.values(tStats)
      .filter(t => !searchQuery || t.teacher_name.toLowerCase().includes(searchQuery) || t.branch.toLowerCase().includes(searchQuery))
      .sort((a, b) => b.total - a.total);
    
    const cLeaderboard = [...Object.values(tStats)]
      .filter(t => t.approved > 0)
      .sort((a, b) => b.approved - a.approved);
      
    const cSubjects = Object.values(subjStats)
      .filter(s => !searchQuery || s.subject_code.toLowerCase().includes(searchQuery) || s.subject_name.toLowerCase().includes(searchQuery) || s.branch.toLowerCase().includes(searchQuery))
      .sort((a, b) => b.count - a.count);
      
    const cDays = Object.entries(dCounts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const cTrend = Object.values(mStats).sort((a, b) => a.rawDate - b.rawDate).slice(-6);

    return { computedLeaderboard: cLeaderboard, computedSubjects: cSubjects, computedTeacherStats: cTeacherStats, computedDays: cDays, computedTrend: cTrend };
  }, [filteredSchedules, insightQuery]);

  // คำนวณจำนวนหน้า (Pagination)
  let totalInsightPages = 1;
  if (activeTab === 'overview') {
    totalInsightPages = Math.ceil(Math.max(computedLeaderboard.length, computedDays.length) / INSIGHT_PAGE_SIZE);
  } else if (activeTab === 'subjects') {
    totalInsightPages = Math.ceil(computedSubjects.length / INSIGHT_PAGE_SIZE);
  } else if (activeTab === 'teachers') {
    totalInsightPages = Math.ceil(computedTeacherStats.length / INSIGHT_PAGE_SIZE);
  }

  // ดึงข้อมูลเฉพาะของหน้านั้นๆ มาแสดง
  const pagedLeaderboard = computedLeaderboard.slice((insightPage - 1) * INSIGHT_PAGE_SIZE, insightPage * INSIGHT_PAGE_SIZE);
  const pagedDays = computedDays.slice((insightPage - 1) * INSIGHT_PAGE_SIZE, insightPage * INSIGHT_PAGE_SIZE);
  const pagedSubjects = computedSubjects.slice((insightPage - 1) * INSIGHT_PAGE_SIZE, insightPage * INSIGHT_PAGE_SIZE);
  const pagedTeachers = computedTeacherStats.slice((insightPage - 1) * INSIGHT_PAGE_SIZE, insightPage * INSIGHT_PAGE_SIZE);

  // คำนวณสรุปผลกล่องตัวเลข
  const total = filteredSchedules.length;
  const approved = filteredSchedules.filter(s => s.status === 'อนุมัติ' || s.status === 'อนุมัติแล้ว' || s.status === 3).length;
  const pendingAdmin = filteredSchedules.filter(s => s.status === 'รอตรวจสอบ').length;
  const rejected = filteredSchedules.filter(s => s.status === 'ไม่อนุมัติ' || s.status === -1).length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  const donutData = [
    { name: 'อนุมัติแล้ว', value: Number(approved), color: '#16A34A' },
    { name: 'รอตรวจสอบ', value: Number(pendingAdmin), color: '#D97706' }, 
    { name: 'ไม่อนุมัติ', value: Number(rejected), color: '#DC2626' }
  ].filter(d => d.value > 0);

  // ─── สไตล์กลาง (Theme Styles) ────────────────────────────────────
  const S = {
    selectInput: { padding: '10px 16px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '14px', color: '#0F172A', cursor: 'pointer', minWidth: '180px', fontWeight: 600 },
    card: { background: '#ffffff', borderRadius: '16px', padding: '32px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' },
    cardTitle: { margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A', paddingBottom: '16px', marginBottom: '24px', borderBottom: '1px solid #F1F5F9' },
    tab: (active) => ({ 
      padding: '12px 24px', borderRadius: '8px', 
      border: '1px solid #1B5E20', background: active ? '#1B5E20' : '#FFFFFF', 
      color: active ? '#FFFFFF' : '#1B5E20', cursor: 'pointer', 
      fontSize: '15px', fontWeight: 700, transition: 'all 0.2s', outline: 'none',
      boxShadow: active ? '0 4px 12px rgba(27,94,32,0.2)' : 'none'
    }),
    pageBtn: (active) => ({
      width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #E2E8F0',
      background: active ? '#1B5E20' : '#ffffff', color: active ? '#ffffff' : '#475569',
      fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }),
    // สไตล์สำหรับกล่องค้นหา
    searchInput: { border: 'none', outline: 'none', background: 'transparent', padding: '10px 8px', width: '100%', fontSize: '14px', color: '#1E293B' },
    searchContainer: { display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0 12px', width: '320px', transition: 'border-color 0.2s' }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
      
      {/* ─── ส่วนหัวและตัวกรอง (Header & Filter) ─── */}
      <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', padding: '24px 32px' }}>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#1B5E20' }}>Executive Dashboard</h2>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={16} /> 
            ข้อมูลสรุปผลการดำเนินงาน ปีการศึกษา {academicPeriod?.academic_year || '-'} / เทอม {academicPeriod?.semester || '-'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="#64748B" />
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} style={S.selectInput}>
              {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={S.selectInput}>
              <option value="ทั้งหมด">ทุกสถานะ</option><option value="รอตรวจสอบ">รอตรวจสอบ</option><option value="อนุมัติแล้ว">อนุมัติแล้ว</option><option value="ไม่อนุมัติ">ไม่อนุมัติ</option>
            </select>
          </div>
          <button onClick={() => { setSelectedBranch('ทั้งหมด'); setSelectedStatus('ทั้งหมด'); setInsightPage(1); setInsightQuery(''); }} style={{ background: 'transparent', border: '1px solid #CBD5E1', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      {/* ─── ส่วนแสดงผลตัวเลขภาพรวม (Key Metrics) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <StatCard label="คำขอสอนชดเชยรวม" value={total} color="#1E293B" icon={FileText} delta="รายการทั้งหมดในระบบ" deltaUp />
        <StatCard label="รอการตรวจสอบ" value={pendingAdmin} color="#D97706" icon={Clock} />
        <StatCard label="อัตราการอนุมัติสำเร็จ" value={`${approvalRate}%`} color="#16A34A" icon={CheckCircle2} delta={`อนุมัติแล้ว ${approved} รายการ`} deltaUp />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.8fr) minmax(0,1.2fr)', gap: '24px' }}>
        {/* ─── กราฟแนวโน้ม (Trend Chart) ─── */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>แนวโน้มการจัดการคำขอ (รายเดือน)</h3>
          <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
            {[['#CBD5E1','ปริมาณคำขอรวม'],['#16A34A','อนุมัติแล้ว']].map(([c, l]) => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />{l}
              </span>
            ))}
          </div>
          
          {computedTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={computedTrend} barGap={4} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 600, fill: '#64748B' }} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{ fontSize: 12, fontWeight: 600, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="คำขอรวม" fill="#E2E8F0" radius={[4,4,0,0]} barSize={28} />
                <Bar dataKey="อนุมัติแล้ว" fill="#16A34A" radius={[4,4,0,0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontStyle: 'italic' }}>ยังไม่มีข้อมูลคำขอในระบบ</div>
          )}
        </div>

        {/* ─── สัดส่วนสถานะ (Status Breakdown) ─── */}
        <div style={S.card}>
          <h3 style={S.cardTitle}>สถานะคำขอปัจจุบัน</h3>
          <StatusBar label="อนุมัติแล้ว" count={approved} total={total} color="#16A34A" />
          <StatusBar label="รอตรวจสอบ" count={pendingAdmin} total={total} color="#D97706" />
          <StatusBar label="ไม่อนุมัติ" count={rejected} total={total} color="#DC2626" />

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, color: '#1E293B', marginBottom: '20px' }}>สัดส่วนความสำเร็จ (ร้อยละ)</p>
            
            {total > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
                <div style={{ position: 'relative', width: '140px', height: '140px', flexShrink: 0 }}>
                  <PieChart width={140} height={140}>
                    <Pie 
                      data={donutData} 
                      cx={70} 
                      cy={70} 
                      innerRadius={50} 
                      outerRadius={65} 
                      dataKey="value" 
                      stroke="none" 
                      paddingAngle={3}
                    >
                      {donutData.map((d, i) => <Cell key={`cell-${i}`} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A' }}>{approvalRate}%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
                  {donutData.map((d) => (
                    <span key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: d.color }} />
                      <span style={{ color: '#475569', fontWeight: 600 }}>{d.name}</span>
                      <strong style={{ color: '#0F172A', marginLeft: 'auto', fontSize: '16px' }}>{d.value}</strong>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
               <div style={{ textAlign: 'center', color: '#94A3B8', fontStyle: 'italic', padding: '20px 0' }}>ยังไม่มีข้อมูลคำขอในระบบ</div>
            )}
          </div>
        </div>
      </div>

      {/* ─── ส่วนแสดงผลข้อมูลเชิงลึก (Insights Section) ─── */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={22} color="#1B5E20" /> เจาะลึกมิติข้อมูลเชิงสถิติ 
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            {[['overview','มิติภาพรวม'],['subjects','มิติรายวิชา'],['teachers','มิติบุคลากร']].map(([key, label]) => (
              <button key={key} style={S.tab(activeTab === key)} onClick={() => setActiveTab(key)}>{label}</button>
            ))}
          </div>
        </div>

        <div>
          {/* แถบ 1: มิติภาพรวม */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', marginBottom: '20px', borderBottom: '2px solid #F1F5F9', paddingBottom: '12px' }}>ผู้สอนที่มีการขอชดเชยสำเร็จสูงสุด</p>
                {pagedLeaderboard.length === 0 ? <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center' }}>- ไม่มีข้อมูล -</p> : pagedLeaderboard.map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '12px', borderLeft: '4px solid #1B5E20', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ color: '#1E293B', fontWeight: 700, fontSize: '15px' }}>
                        <span style={{ color: '#94A3B8', marginRight: '12px' }}>#{(insightPage - 1) * INSIGHT_PAGE_SIZE + i + 1}</span>{t.teacher_name}
                      </span>
                    </div>
                    <span style={{ background: '#DCFCE7', color: '#166534', padding: '6px 16px', borderRadius: '50px', fontSize: '13px', fontWeight: 800 }}>{t.count} ครั้ง</span>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', marginBottom: '20px', borderBottom: '2px solid #F1F5F9', paddingBottom: '12px' }}>สถิติความถี่ตามวันทำการสอน (เฉพาะที่อนุมัติแล้ว)</p>
                {pagedDays.length === 0 ? <p style={{ fontSize: '14px', color: '#94A3B8', textAlign: 'center' }}>- ไม่มีข้อมูล -</p> : pagedDays.map(([day, count], i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#FFFBEB', borderRadius: '12px', borderLeft: '4px solid #D97706', marginBottom: '12px' }}>
                    <span style={{ fontSize: '15px', color: '#475569', fontWeight: 700 }}>วัน{day}</span>
                    <span style={{ background: '#FEF3C7', color: '#B45309', padding: '6px 16px', borderRadius: '50px', fontSize: '13px', fontWeight: 800 }}>{count} ครั้ง</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* แถบ 2: มิติรายวิชา (มีช่องค้นหา) */}
          {activeTab === 'subjects' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', margin: 0 }}>สถิติความถี่แยกตามรายวิชา</p>
                
                {/* 🌟 Filter ค้นหารายวิชา */}
                <div style={S.searchContainer}>
                  <Search size={16} color="#64748B" />
                  <input 
                    type="text" 
                    placeholder="ค้นหารหัส, ชื่อวิชา หรือสาขา..." 
                    value={insightQuery} 
                    onChange={e => { setInsightQuery(e.target.value); setInsightPage(1); }} 
                    style={S.searchInput} 
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      {['ลำดับ','รหัสวิชา','ชื่อวิชา','สาขาวิชา','คำขอรวม','อนุมัติแล้ว','ร้อยละ'].map((h, i) => (
                        <th key={i} style={{ padding: '16px', background: '#F8FAFC', color: '#475569', fontWeight: 800, fontSize: '14px', textAlign: i >= 4 ? 'center' : 'left', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSubjects.length === 0 ? (
                      <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>ไม่พบข้อมูลตามคำค้นหา</td></tr>
                    ) : pagedSubjects.map((s, i) => {
                      const sRate = s.count > 0 ? Math.round((s.approved / s.count) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '16px', color: '#94A3B8', fontWeight: 700 }}>{(insightPage - 1) * INSIGHT_PAGE_SIZE + i + 1}</td>
                          <td style={{ padding: '16px', fontWeight: 800, color: '#166534' }}>{s.subject_code}</td>
                          <td style={{ padding: '16px', fontWeight: 600, color: '#1E293B' }}>{s.subject_name || '-'}</td>
                          <td style={{ padding: '16px', color: '#64748B' }}>{s.branch}</td>
                          <td style={{ padding: '16px', textAlign: 'center', fontWeight: 800, color: '#475569' }}>{s.count}</td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <span style={{ background: '#DCFCE7', color: '#166534', padding: '4px 12px', borderRadius: '50px', fontSize: '13px', fontWeight: 800 }}>{s.approved}</span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <div style={{ width: '60px', background: '#F1F5F9', borderRadius: '50px', height: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${sRate}%`, height: '100%', background: sRate >= 80 ? '#16A34A' : sRate >= 50 ? '#D97706' : '#DC2626', borderRadius: '50px' }} />
                              </div>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: sRate >= 80 ? '#16A34A' : sRate >= 50 ? '#D97706' : '#DC2626', minWidth: '40px', textAlign: 'right' }}>{sRate}%</span>
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

          {/* แถบ 3: มิติบุคลากร (มีช่องค้นหา) */}
          {activeTab === 'teachers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#1E293B', margin: 0 }}>ดัชนีการดำเนินการรายบุคคล</p>
                
                {/* 🌟 Filter ค้นหาอาจารย์ */}
                <div style={S.searchContainer}>
                  <Search size={16} color="#64748B" />
                  <input 
                    type="text" 
                    placeholder="ค้นหาชื่ออาจารย์ หรือสาขา..." 
                    value={insightQuery} 
                    onChange={e => { setInsightQuery(e.target.value); setInsightPage(1); }} 
                    style={S.searchInput} 
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr>
                      {['ลำดับ','ชื่อ-นามสกุล บุคลากร','สาขาวิชา','จำนวนรายการยื่น','จำนวนที่อนุมัติ','ร้อยละความสำเร็จ'].map((h, i) => (
                        <th key={i} style={{ padding: '16px', background: '#F8FAFC', color: '#475569', fontWeight: 800, fontSize: '14px', textAlign: i >= 3 ? 'center' : 'left', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedTeachers.length === 0 ? (
                      <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>ไม่พบข้อมูลตามคำค้นหา</td></tr>
                    ) : pagedTeachers.map((t, i) => {
                      const tRate = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#F8FAFC'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '16px', color: '#94A3B8', fontWeight: 700 }}>{(insightPage - 1) * INSIGHT_PAGE_SIZE + i + 1}</td>
                          <td style={{ padding: '16px', fontWeight: 700, color: '#1E293B' }}>{t.teacher_name}</td>
                          <td style={{ padding: '16px', color: '#64748B' }}>{t.branch}</td>
                          <td style={{ padding: '16px', textAlign: 'center', fontWeight: 800, color: '#475569' }}>{t.total}</td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <span style={{ background: '#DCFCE7', color: '#166534', padding: '4px 12px', borderRadius: '50px', fontSize: '13px', fontWeight: 800 }}>{t.approved}</span>
                          </td>
                          <td style={{ padding: '16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <div style={{ width: '60px', background: '#F1F5F9', borderRadius: '50px', height: '6px', overflow: 'hidden' }}>
                                <div style={{ width: `${tRate}%`, height: '100%', background: tRate >= 80 ? '#16A34A' : tRate >= 50 ? '#D97706' : '#DC2626', borderRadius: '50px' }} />
                              </div>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: tRate >= 80 ? '#16A34A' : tRate >= 50 ? '#D97706' : '#DC2626', minWidth: '40px', textAlign: 'right' }}>{tRate}%</span>
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

          {/* 🌟 ส่วน Pagination สำหรับข้อมูลสถิติเชิงลึก */}
          {totalInsightPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
              <button 
                onClick={() => setInsightPage(p => Math.max(p - 1, 1))} 
                disabled={insightPage === 1} 
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: insightPage === 1 ? 'not-allowed' : 'pointer', color: insightPage === 1 ? '#94A3B8' : '#1E293B', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
              >
                <ChevronLeft size={16} /> กลับ
              </button>
              
              {Array.from({ length: totalInsightPages }, (_, i) => i + 1).map(p => (
                <button 
                  key={p} 
                  onClick={() => setInsightPage(p)} 
                  style={S.pageBtn(insightPage === p)}
                >
                  {p}
                </button>
              ))}
              
              <button 
                onClick={() => setInsightPage(p => Math.min(p + 1, totalInsightPages))} 
                disabled={insightPage === totalInsightPages} 
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#fff', cursor: insightPage === totalInsightPages ? 'not-allowed' : 'pointer', color: insightPage === totalInsightPages ? '#94A3B8' : '#1E293B', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}
              >
                ถัดไป <ChevronRight size={16} />
              </button>
            </div>
          )}

        </div>
      </div>
      
    </div>
  );
}