import React, { useState, useEffect, useRef } from 'react'
import { Card, SectionTitle, Btn } from './ui'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useReactToPrint } from 'react-to-print'

export default function SummaryReport() {
  const [stats, setStats] = useState({ total: 0, approved: 0, pending: 0 })
  const [chartData, setChartData] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // 1. สร้าง Ref ชี้ไปยังพื้นที่ที่ต้องการพิมพ์
  const reportRef = useRef(null)

  // 🌟 2. อัปเดตคำสั่งสำหรับ react-to-print เวอร์ชันใหม่ล่าสุด (ใช้ contentRef)
  const handlePrint = useReactToPrint({
    contentRef: reportRef, 
    documentTitle: 'รายงานสรุปตารางสอนชดเชย_RMUTL',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await fetch('http://localhost:3001/api/dashboard-stats')
        const statsData = await statsRes.json()
        if (statsData.success) setStats(statsData.data)

        const chartRes = await fetch('http://localhost:3001/api/chart-data')
        const chartJson = await chartRes.json()
        if (chartJson.success) setChartData(chartJson.data)

      } catch (error) {
        console.error('ไม่สามารถโหลดข้อมูลรายงานได้')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <Card style={{ marginBottom: '24px' }}>
      <SectionTitle icon="" title="รายงานสรุปและสถิติภาพรวม" />
      
      {/* แผงควบคุม (ส่วนนี้จะไม่แสดงใน PDF) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', background: '#F5F5F5', padding: '12px', borderRadius: '8px' }}>
        <select style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', outline: 'none' }}>
          <option>ข้อมูลทั้งหมดในระบบ</option>
        </select>
        <Btn color="#1976D2" small>ค้นหา</Btn>
        
        {/* ปุ่มสั่งพิมพ์ที่แก้ไขแล้ว */}
        <Btn onClick={() => handlePrint()} color="#558B2F" small style={{ marginLeft: 'auto' }}>
          📥 ส่งออกรายงาน (PDF)
        </Btn>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#757575' }}>กำลังโหลดข้อมูล...</div>
      ) : (
        // พื้นที่ที่จะถูกนำไปสร้าง PDF
        <div ref={reportRef} style={{ padding: '20px', background: '#fff', borderRadius: '8px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>รายงานสถิติการจัดการตารางสอนชดเชย</h2>
            <p style={{ margin: 0, color: '#666' }}>ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH')}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
            <div style={{ background: '#E3F2FD', padding: '20px', borderRadius: '12px', border: '1px solid #BBDEFB', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#1565C0' }}>📝 คำขอทั้งหมด</h4>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#0D47A1' }}>{stats.total}</div>
            </div>
            <div style={{ background: '#E8F5E9', padding: '20px', borderRadius: '12px', border: '1px solid #C8E6C9', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#2E7D32' }}>✅ อนุมัติแล้ว</h4>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#1B5E20' }}>{stats.approved}</div>
            </div>
            <div style={{ background: '#FFF3E0', padding: '20px', borderRadius: '12px', border: '1px solid #FFE0B2', textAlign: 'center' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#E65100' }}>⏳ รอตรวจสอบ</h4>
              <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#BF360C' }}>{stats.pending}</div>
            </div>
          </div>

          <div style={{ padding: '20px', border: '1px solid #E0E0E0', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 20px 0', color: '#424242' }}>สถิติจำนวนคำขอสอนชดเชยแยกตามวัน</h4>
            
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E0E0E0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#757575' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#757575' }} />
                    <Tooltip cursor={{ fill: '#F5F5F5' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="requests" name="จำนวนคำขอ" fill="#1976D2" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#9E9E9E', padding: '40px 0' }}>
                ยังไม่มีข้อมูลเพียงพอสำหรับสร้างกราฟ
              </div>
            )}
          </div>

        </div>
      )}
    </Card>
  )
}