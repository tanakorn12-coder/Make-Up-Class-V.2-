import { useState } from 'react'
import { API } from '../utils/constants'
import { Btn, Input, Card } from './ui'

export default function LoginPage({ onLogin }) {
  const [form, setForm]     = useState({ username: '', password: '' })
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    setLoading(true); setErr('')
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.success) onLogin(d.user)
      else setErr(d.message)
    } catch {
      setErr('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #E8F5E9 0%, #F1F8E9 55%, #DCEDC8 100%)',
      fontFamily: 'Sarabun, sans-serif',
    }}>
      <div style={{ width: 400 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60,
            borderRadius: 16,
            background: '#2E7D32',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <i
              className="ti ti-school"
              style={{ fontSize: 28, color: '#fff' }}
              aria-hidden="true"
            />
          </div>
          <h1 style={{ margin: 10, fontSize: 22, fontWeight: 700, color: '#1B5E20', letterSpacing: '-0.3px' }}>
            ระบบสารสนเทศเพื่อการจัดการตารางสอนชดเชย
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: '#558B2F' }}>
            เข้าสู่ระบบเพื่อดำเนินการ
          </p>
        </div>

        {/* Card */}
        <Card>
          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            <Input
              label="ชื่อผู้ใช้"
              type="text"
              placeholder="username"
              required
              onChange={e => setForm({ ...form, username: e.target.value })}
            />

            <Input
              label="รหัสผ่าน"
              type="password"
              placeholder="••••••••"
              required
              onChange={e => setForm({ ...form, password: e.target.value })}
            />

            {err && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 14px',
                background: '#FFEBEE',
                border: '0.5px solid #FFCDD2',
                borderRadius: 10,
              }}>
                <i
                  className="ti ti-alert-circle"
                  style={{ fontSize: 16, color: '#C62828', flexShrink: 0, marginTop: 1 }}
                  aria-hidden="true"
                />
                <span style={{ fontSize: 13, color: '#B71C1C', lineHeight: 1.5 }}>{err}</span>
              </div>
            )}

            <Btn
              color="#2E7D32"
              disabled={loading}
              style={{ width: '100%', marginTop: 4, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {loading ? (
                <>
                  <i className="ti ti-loader-2" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }} aria-hidden="true" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  <i className="ti ti-login" style={{ fontSize: 16 }} aria-hidden="true" />
                  เข้าสู่ระบบ
                </>
              )}
            </Btn>

          </form>
        </Card>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}