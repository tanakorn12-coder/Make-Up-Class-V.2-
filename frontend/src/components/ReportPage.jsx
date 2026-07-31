import React from 'react';
import { Card, SectionTitle } from './ui';

export default function ReportPage({ schedules }) {
  // 1. คำนวณสถิติจากข้อมูล schedules
  const total = schedules.length;
  const approved = schedules.filter(s => s.status === 'อนุมัติแล้ว').length;
  const rejected = schedules.filter(s => s.status === 'ไม่อนุมัติ').length;
  const pending = schedules.filter(s => 
    !s.status || s.status === 'รอตรวจสอบ' || s.status === 'รอผู้บริหารอนุมัติ'
  ).length;

  // 2. คำนวณเปอร์เซ็นต์สำหรับวาดแถบกราฟ (ป้องกันการหารด้วย 0)
  const getPercent = (count) => total === 0 ? 0 : Math.round((count / total) * 100);

  // 3. กรองเฉพาะรายการที่อนุมัติแล้ว 5 รายการล่าสุด
  const recentApproved = schedules
    .filter(s => s.status === 'อนุมัติแล้ว')
    .slice(-5)
    .reverse();

  // 4. Component ย่อยสำหรับสร้างแถบสรุปข้อมูล (Progress Bar)
  const StatBar = ({ label, count, color, bg }) => (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#424242' }}>
        <span>{label}</span>
        <span>{count} รายการ ({getPercent(count)}%)</span>
      </div>
      <div style={{ width: '100%', height: '12px', backgroundColor: '#EEEEEE', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ 
          width: `${getPercent(count)}%`, 
          height: '100%', 
          backgroundColor: color,
          transition: 'width 0.5s ease-in-out'
        }}></div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <Card>
        <SectionTitle icon="" title="ภาพรวมคำขอสอนชดเชยประจำภาคเรียน" />
        
        {total === 0 ? (
          <p style={{ textAlign: 'center', color: '#9E9E9E', padding: '20px' }}>ยังไม่มีข้อมูลในระบบ</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '20px' }}>
            
            {/* ฝั่งซ้าย: แสดงแถบกราฟสถิติ */}
            <div>
              <h3 style={{ fontSize: '16px', color: '#1B5E20', marginBottom: '20px' }}>สถิติสถานะคำขอ</h3>
              <StatBar label="อนุมัติแล้ว" count={approved} color="#43A047" />
              <StatBar label="รอการพิจารณา" count={pending} color="#1976D2" />
              <StatBar label="ไม่อนุมัติ" count={rejected} color="#E53935" />
            </div>

            {/* ฝั่งขวา: แสดงข้อมูลสรุปตัวเลข */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
               <div style={{ background: '#F1F8E9', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid #C8E6C9' }}>
                  <div style={{ fontSize: '14px', color: '#2E7D32', fontWeight: 'bold' }}>ยอดคำขอสอนชดเชยทั้งหมด</div>
                  <div style={{ fontSize: '48px', fontWeight: '900', color: '#1B5E20' }}>{total}</div>
                  <div style={{ fontSize: '14px', color: '#558B2F' }}>รายการ</div>
               </div>
            </div>
          </div>
        )}
      </Card>

      {/* ตารางแสดงรายการล่าสุดที่ได้รับการอนุมัติ */}
      <Card>
        <SectionTitle icon="" title="รายการที่ได้รับการอนุมัติล่าสุด" />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#F9FBF9', borderBottom: '2px solid #E8F5E9', textAlign: 'left', color: '#2E7D32' }}>
              <th style={{ padding: '12px' }}>วันที่สอนชดเชย</th>
              <th style={{ padding: '12px' }}>เวลา</th>
              <th style={{ padding: '12px' }}>ห้องเรียน</th>
              <th style={{ padding: '12px' }}>อาจารย์ผู้สอน</th>
            </tr>
          </thead>
          <tbody>
            {recentApproved.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#9E9E9E' }}>ไม่มีรายการล่าสุด</td>
              </tr>
            ) : (
              recentApproved.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F5F5F5' }}>
                  <td style={{ padding: '12px', fontWeight: '600', color: '#424242' }}>
                    {new Date(item.class_date).toLocaleDateString('th-TH')}
                  </td>
                  <td style={{ padding: '12px' }}>{item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: '#E8F5E9', color: '#2E7D32', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      {item.room_id}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>{item.teacher_name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}