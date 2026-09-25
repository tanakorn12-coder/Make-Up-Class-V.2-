import React, { useState, useEffect, useMemo } from 'react';
import { Card } from './ui';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { BarChart3, CheckCircle2, Clock3, RefreshCw, TrendingUp, XCircle, FileText, CalendarDays, Filter } from 'lucide-react';

// 🌟 ฟังก์ชันดึงเฉพาะชื่อภาษาไทยจากชื่อวิชาเต็ม
const getThaiName = (fullName) => {
  if (!fullName) return '';
  const parts = fullName.split('-');
  const thaiPart = parts.find(p => /[ก-๙]/.test(p));
  return thaiPart ? thaiPart.trim() : parts[0].trim();
};

export default function SummaryReport({ schedules = [], academicPeriod }) {
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [recentFilterStatus, setRecentFilterStatus] = useState('pending');
  const [recentFilterBranch, setRecentFilterBranch] = useState('all');
  const [recentPage, setRecentPage] = useState(1);
  const recentPageSize = 7;

  // 🌟 ใช้ useMemo เพื่อคำนวณข้อมูลสถิติจาก schedules โดยตรง 
  // แก้ปัญหาสัดส่วนผิด, กราฟจำลอง, และดึงชื่อวิชามาโชว์ได้ครบ 100%
  const localData = useMemo(() => {
     const branchMap = new Map();
     let total = 0, approved = 0, pending = 0, rejected = 0;

     // 1. เตรียมข้อมูลกราฟ 7 วันล่าสุด
     const chartMap = {};
     for(let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        chartMap[dateStr] = { date: dateStr, ทั้งหมด: 0, รอตรวจสอบ: 0, อนุมัติแล้ว: 0 };
     }

     // 2. คำนวณข้อมูลทั้งหมด
     schedules.forEach(schedule => {
        total++;
        if (schedule.status === 'อนุมัติแล้ว') approved++;
        if (['รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา'].includes(schedule.status)) pending++;
        if (schedule.status === 'ไม่อนุมัติ') rejected++;

        // คำนวณสัดส่วนสาขา
        const branch = schedule.curriculum || schedule.branch || 'ไม่ระบุหลักสูตร';
        const current = branchMap.get(branch) || { branch, total: 0, approved: 0, pending: 0 };
        current.total += 1;
        if (schedule.status === 'อนุมัติแล้ว') current.approved += 1;
        if (['รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา'].includes(schedule.status)) current.pending += 1;
        branchMap.set(branch, current);

        // คำนวณกราฟ
        const dateVal = schedule.created_at ? new Date(schedule.created_at) : new Date(schedule.class_date);
        if (!isNaN(dateVal)) {
            const dateStr = `${dateVal.getDate().toString().padStart(2, '0')}/${(dateVal.getMonth() + 1).toString().padStart(2, '0')}/${dateVal.getFullYear()}`;
            if (chartMap[dateStr]) {
                chartMap[dateStr].ทั้งหมด += 1;
                if (schedule.status === 'อนุมัติแล้ว') chartMap[dateStr].อนุมัติแล้ว += 1;
                if (['รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา'].includes(schedule.status)) chartMap[dateStr].รอตรวจสอบ += 1;
            }
        }
     });

     return {
        stats: {
           total, approved, pending, rejected,
           approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
        },
        chartData: Object.values(chartMap),
        branchData: [...branchMap.values()].sort((a, b) => b.total - a.total).slice(0, 8),
        recentData: [...schedules].sort((a, b) => {
            const dA = new Date(a.created_at || a.class_date).getTime();
            const dB = new Date(b.created_at || b.class_date).getTime();
            return dB - dA; // เรียงจากใหม่ไปเก่า
        }).slice(0, 50).map(s => ({ ...s, branch: s.curriculum || s.branch || 'ไม่ระบุหลักสูตร' }))
     };
  }, [schedules, refreshKey]);

  const { stats, chartData, branchData, recentData } = localData;

  // รีเซ็ตหน้าเมื่อเปลี่ยน Filter
  useEffect(() => { setRecentPage(1); }, [recentFilterStatus, recentFilterBranch]);

  // ค้นหาสาขาที่มีอยู่ทั้งหมดในระบบ เพื่อสร้างปุ่ม Filter อัตโนมัติ
  const availableBranchesInRecent = [...new Set(recentData.map(item => item.branch))].filter(b => b && b !== 'ไม่ระบุหลักสูตร');

  const filteredRecent = recentData.filter(item => {
    // 1. กรองตามสถานะ
    let passStatus = true;
    if (recentFilterStatus === 'pending') passStatus = ['รอตรวจสอบ', 'รออนุมัติ', 'รอผู้บริหารพิจารณา'].includes(item.status);
    if (recentFilterStatus === 'approved') passStatus = item.status === 'อนุมัติแล้ว';
    if (recentFilterStatus === 'rejected') passStatus = item.status === 'ไม่อนุมัติ';

    // 2. กรองตามสาขา
    let passBranch = true;
    if (recentFilterBranch !== 'all') passBranch = item.branch === recentFilterBranch;

    return passStatus && passBranch;
  });
  
  const recentTotalPages = Math.max(1, Math.ceil(filteredRecent.length / recentPageSize));
  const pagedRecent = filteredRecent.slice((recentPage - 1) * recentPageSize, recentPage * recentPageSize);

  return (
    <Card style={{ marginBottom: '24px', padding: 0, overflow: 'hidden', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
      
      <div style={{ background: '#FFFFFF', padding: '24px 28px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ background: '#E8F5E9', padding: '12px', borderRadius: '12px', color: '#1B5E20' }}>
            <TrendingUp size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1B5E20', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>EXECUTIVE OVERVIEW</div>
            <h2 style={{ margin: 0, color: '#0F172A', fontSize: '20px', fontWeight: 'bold' }}>รายงานสรุปและสถิติภาพรวม</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '14px' }}>รายงานภาพรวมคำขอสอนชดเชยสำหรับแอดมินและการติดตามสถานะรายวัน</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setRefreshKey(key => key + 1)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            <RefreshCw size={16} /> อัปเดตข้อมูล
          </button>
        </div>
      </div>

      <div style={{ padding: '32px', background: '#fff', color: '#1E293B' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', borderBottom: '2px solid #F1F5F9', paddingBottom: '20px' }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '24px' }}>รายงานสถิติการจัดการตารางสอนชดเชย</h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CalendarDays size={16} /> ข้อมูลประมวลผล ณ ปีการศึกษา {academicPeriod?.academic_year || '-'} / เทอม {academicPeriod?.semester || '-'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#F0FDF4', color: '#166534', padding: '6px 12px', borderRadius: '50px', fontSize: '12px', border: '1px solid #BBF7D0', fontWeight: 'bold' }}>
            <span style={{ width: '8px', height: '8px', background: '#22C55E', borderRadius: '50%' }}></span> ข้อมูลล่าสุด (Real-time)
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
          {[
            { icon: <FileText size={20} color="#0284C7"/>, label: 'คำขอทั้งหมด', value: stats.total, sub: 'รายการในระบบ', bg: '#F0F9FF', border: '#BAE6FD' },
            { icon: <CheckCircle2 size={20} color="#16A34A"/>, label: 'อนุมัติแล้ว', value: stats.approved, sub: `${stats.total ? Math.round(stats.approved / stats.total * 100) : 0}% ของทั้งหมด`, bg: '#F0FDF4', border: '#BBF7D0' },
            { icon: <Clock3 size={20} color="#D97706"/>, label: 'รอตรวจสอบ', value: stats.pending, sub: 'รายการที่ต้องติดตาม', bg: '#FFFBEB', border: '#FDE68A' },
            { icon: <XCircle size={20} color="#DC2626"/>, label: 'ไม่อนุมัติ', value: stats.rejected, sub: 'รายการที่ถูกปฏิเสธ', bg: '#FEF2F2', border: '#FECACA' },
            { icon: <TrendingUp size={20} color="#7C3AED"/>, label: 'อัตราอนุมัติ', value: `${stats.approvalRate}%`, sub: 'สัดส่วนการอนุมัติ', bg: '#F5F3FF', border: '#DDD6FE' }
          ].map((kpi, idx) => (
            <div key={idx} style={{ background: kpi.bg, border: `1px solid ${kpi.border}`, padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '14px', fontWeight: '600' }}>
                {kpi.icon} {kpi.label}
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#0F172A', lineHeight: '1' }}>{kpi.value}</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          <div style={{ border: '1px solid #E2E8F0', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <BarChart3 size={20} color="#1B5E20" />
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#1E293B' }}>สถิติคำขอสอนชดเชยรายวัน</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>เปรียบเทียบปริมาณคำขอที่สร้างขึ้นในช่วง 7 วันที่ผ่านมา</p>
              </div>
            </div>
            
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', marginTop: '10px' }}/>
                    <Bar dataKey="รอตรวจสอบ" fill="#F59E0B" radius={[4, 4, 0, 0]} barSize={25} />
<Bar dataKey="อนุมัติแล้ว" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: '60px 0', border: '1px dashed #E2E8F0', borderRadius: '8px' }}>
                ยังไม่มีข้อมูลเพียงพอสำหรับสร้างกราฟในสัปดาห์นี้
              </div>
            )}
          </div>

          <div style={{ border: '1px solid #E2E8F0', padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <FileText size={20} color="#1B5E20" />
              <div>
                <h4 style={{ margin: 0, fontSize: '16px', color: '#1E293B' }}>สัดส่วนคำขอแยกตามสาขา</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>หลักสูตรที่มีการส่งคำขอมากที่สุดในระบบ</p>
              </div>
            </div>
            
            {branchData.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', padding: '40px 0' }}>ยังไม่มีข้อมูลสาขา</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {branchData.map((branch, index) => (
                  <div key={index}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '6px' }}>
                      <span style={{ color: '#334155', fontWeight: '500' }}>{branch.branch}</span>
                      <strong style={{ color: '#0F172A' }}>{branch.total}</strong>
                    </div>
                    <div style={{ width: '100%', background: '#F1F5F9', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      {/* อ้างอิงสัดส่วน % จาก total ของทุกสาขารวมกัน */}
                      <div style={{ width: `${stats.total ? Math.max(2, (branch.total / stats.total) * 100) : 0}%`, background: '#16A34A', height: '100%' }}></div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px', textAlign: 'right' }}>
                      อนุมัติ {branch.approved} / รอ {branch.pending}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '24px', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock3 size={20} color="#1B5E20" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#1E293B' }}>สถานะการดำเนินการล่าสุด</h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>ติดตามความคืบหน้าของคำขอที่เข้ามาระบบ</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px', background: '#F8FAFC', padding: '4px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                {[
                  { id: 'pending', label: 'รอตรวจสอบ' },
                  { id: 'approved', label: 'อนุมัติแล้ว' },
                  { id: 'rejected', label: 'ไม่อนุมัติ' },
                  { id: 'all', label: 'ทั้งหมด' }
                ].map(tab => (
                  <button key={tab.id} onClick={() => setRecentFilterStatus(tab.id)} style={{ padding: '6px 12px', border: 'none', background: recentFilterStatus === tab.id ? '#1B5E20' : 'transparent', color: recentFilterStatus === tab.id ? '#fff' : '#475569', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 🌟 ส่วนตัวกรองแยกตามสาขา (แสดงเฉพาะสาขาที่มีในรายการล่าสุด) */}
            {availableBranchesInRecent.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', fontWeight: 'bold', marginRight: '8px' }}>
                      <Filter size={14} /> กรองตามสาขา:
                  </div>
                  <button onClick={() => setRecentFilterBranch('all')} style={{ padding: '4px 10px', border: '1px solid #E2E8F0', background: recentFilterBranch === 'all' ? '#F0F9FF' : '#fff', color: recentFilterBranch === 'all' ? '#0284C7' : '#475569', borderRadius: '50px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                      แสดงทั้งหมด
                  </button>
                  {availableBranchesInRecent.map(branch => (
                      <button key={branch} onClick={() => setRecentFilterBranch(branch)} style={{ padding: '4px 10px', border: '1px solid #E2E8F0', background: recentFilterBranch === branch ? '#F0F9FF' : '#fff', color: recentFilterBranch === branch ? '#0284C7' : '#475569', borderRadius: '50px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                          {branch}
                      </button>
                  ))}
              </div>
            )}

          </div>

          {filteredRecent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>ไม่มีรายการในหมวดหมู่ที่เลือก</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#475569', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', width: '40%' }}>รหัสและชื่อวิชา</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', width: '25%' }}>หลักสูตร/สาขา</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', width: '20%' }}>อาจารย์ผู้สอน</th>
                  <th style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', textAlign: 'center', width: '15%' }}>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecent.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 'bold', color: '#1B5E20', marginBottom: '4px', fontSize: '13px' }}>{item.subject_code}</div>
                      {/* 🌟 ชื่อวิชาแสดงผลเต็มๆ ตรงนี้ */}
                      <div style={{ fontWeight: '600', color: '#1E293B' }}>{getThaiName(item.subject_name) || '(ไม่ระบุชื่อวิชา)'}</div>
                    </td>
                    <td style={{ padding: '16px', color: '#475569', fontSize: '13.5px' }}>{item.branch}</td>
                    <td style={{ padding: '16px', color: '#334155', fontWeight: '500' }}>{item.teacher_name || '-'}</td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '6px 12px', borderRadius: '50px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block',
                        background: (item.status === 'อนุมัติแล้ว' || item.status === 3) ? '#DCFCE7' : (item.status === 'ไม่อนุมัติ' || item.status === -1) ? '#FEE2E2' : '#FFFBEB',
                        color: (item.status === 'อนุมัติแล้ว' || item.status === 3) ? '#166534' : (item.status === 'ไม่อนุมัติ' || item.status === -1) ? '#991B1B' : '#B45309',
                        border: `1px solid ${(item.status === 'อนุมัติแล้ว' || item.status === 3) ? '#BBF7D0' : (item.status === 'ไม่อนุมัติ' || item.status === -1) ? '#FECACA' : '#FDE68A'}`
                      }}>
                        {item.status || 'รอตรวจสอบ'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 🌟 ระบบแบ่งหน้า (Pagination) ในรายการล่าสุด */}
          {filteredRecent.length > recentPageSize && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '500' }}>แสดงผล {recentPageSize} รายการต่อหน้า (หน้า {recentPage} จาก {recentTotalPages})</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => setRecentPage(prev => Math.max(prev - 1, 1))} disabled={recentPage === 1} style={{ padding: '6px 12px', border: '1px solid #E2E8F0', background: '#fff', borderRadius: '6px', cursor: recentPage === 1 ? 'not-allowed' : 'pointer', color: recentPage === 1 ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '13px' }}>ก่อนหน้า</button>
                {Array.from({ length: recentTotalPages }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setRecentPage(page)} style={{ width: '32px', height: '32px', border: 'none', background: recentPage === page ? '#1B5E20' : '#F1F5F9', color: recentPage === page ? '#fff' : '#475569', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {page}
                  </button>
                ))}
                <button onClick={() => setRecentPage(prev => Math.min(prev + 1, recentTotalPages))} disabled={recentPage === recentTotalPages} style={{ padding: '6px 12px', border: '1px solid #E2E8F0', background: '#fff', borderRadius: '6px', cursor: recentPage === recentTotalPages ? 'not-allowed' : 'pointer', color: recentPage === recentTotalPages ? '#94A3B8' : '#1E293B', fontWeight: 'bold', fontSize: '13px' }}>ถัดไป</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </Card>
  );
}