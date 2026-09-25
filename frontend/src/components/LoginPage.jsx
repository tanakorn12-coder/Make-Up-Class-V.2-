import { useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, LoaderCircle, UserRound } from 'lucide-react'
import { API } from '../utils/constants'

export default function LoginPage({ onLogin }) {
  const [form, setForm]     = useState({ username: '', password: '' })
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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
    <main className="login-page" style={{
      minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(420px, .95fr)',
      background: '#f4f8f5', fontFamily: 'inherit', color: '#173c2a',
    }}>
      <section className="login-brand" style={{
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: 'clamp(32px, 6vw, 88px)', backgroundColor: '#124d35',
        backgroundImage: 'radial-gradient(ellipse at 92% 8%, rgba(119, 214, 137, .16), transparent 32%), radial-gradient(ellipse at 0% 100%, rgba(9, 57, 40, .38), transparent 38%)',
        color: '#fff',
      }}>
        <div className="login-brand-content" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ maxWidth: 570, margin: '0 auto' }}>
            <div className="login-logo" style={{ width: 'clamp(140px, 16vw, 190px)', height: 'clamp(120px, 14vw, 165px)', display: 'grid', placeItems: 'center', margin: '0 auto 4px', filter: 'drop-shadow(0 20px 26px rgba(0, 0, 0, .22)) drop-shadow(0 0 22px rgba(180, 235, 185, .16))' }}>
              {logoFailed ? <CheckCircle2 size={82} color="#237a4b" strokeWidth={1.5} /> : <img src="/logosci.png" alt="โลโก้คณะวิทยาศาสตร์และเทคโนโลยีการเกษตร" onError={() => setLogoFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
            </div>
            <h1 style={{ margin: '0 auto 8px', maxWidth: 560, color: '#fff', fontSize: 'clamp(28px, 3.5vw, 48px)', lineHeight: 1.22, letterSpacing: '-.02em', fontWeight: 800 }}>
              ระบบสารสนเทศเพื่อการจัดการตารางสอนชดเชย
            </h1>
            <p style={{ maxWidth: 560, margin: 0, color: '#c6e4cc', fontSize: 16, lineHeight: 1.7 }}>
              Information System for Compensation Teaching Schedule Management
            </p>
            <p style={{ maxWidth: 560, margin: '9px 0 0', color: '#a7d8b2', fontSize: 15, lineHeight: 1.7, fontWeight: 650 }}>
              คณะวิทยาศาสตร์และเทคโนโลยีการเกษตร
            </p>
          </div>
        </div>
      </section>

      <section className="login-form-side" style={{ display: 'grid', placeItems: 'center', padding: '40px 28px' }}>
        <div className="login-form-content" style={{ width: 'min(100%, 420px)' }}>
          <div style={{ marginBottom: 34 }}>
            <p style={{ margin: '0 0 10px', color: '#237a4b', fontSize: 13, fontWeight: 800, letterSpacing: '.04em' }}>WELCOME</p>
            <h2 style={{ margin: 0, color: '#173c2a', fontSize: 32, lineHeight: 1.25, fontWeight: 800 }}>เข้าสู่ระบบ</h2>
            <p style={{ margin: '10px 0 0', color: '#718278', fontSize: 15 }}>กรอกข้อมูลของคุณเพื่อเริ่มใช้งานระบบ</p>
          </div>

          <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#315640', fontSize: 13, fontWeight: 750 }}>
              ชื่อผู้ใช้
              <span style={{ position: 'relative' }}>
                <UserRound size={18} color="#7b9884" style={{ position: 'absolute', left: 15, top: 14 }} aria-hidden="true" />
                <input value={form.username} type="text" placeholder="กรอกชื่อผู้ใช้" required onChange={e => setForm({ ...form, username: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 14px 13px 45px', borderRadius: 12, border: '1px solid #d5e4d9', background: '#fff', color: '#173c2a', font: 'inherit', fontSize: 15, outline: 'none' }} />
              </span>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#315640', fontSize: 13, fontWeight: 750 }}>
              รหัสผ่าน
              <span style={{ position: 'relative' }}>
                <LockKeyhole size={18} color="#7b9884" style={{ position: 'absolute', left: 15, top: 14 }} aria-hidden="true" />
                <input className="login-input" value={form.password} type={showPassword ? 'text' : 'password'} placeholder="กรอกรหัสผ่าน" required onChange={e => setForm({ ...form, password: e.target.value })} style={{ width: '100%', boxSizing: 'border-box', padding: '13px 46px 13px 45px', borderRadius: 12, border: '1px solid #d5e4d9', background: '#fff', color: '#173c2a', font: 'inherit', fontSize: 15, outline: 'none' }} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {err && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px', borderRadius: 11, background: '#fff1f0', border: '1px solid #ffd6d2', color: '#b42318', fontSize: 13, lineHeight: 1.5 }}><AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />{err}</div>}

            <button type="submit" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', marginTop: 4, padding: '14px 18px', border: 0, borderRadius: 12, background: loading ? '#8eb99c' : '#237a4b', color: '#fff', font: 'inherit', fontSize: 15, fontWeight: 750, cursor: loading ? 'wait' : 'pointer', boxShadow: '0 10px 20px rgba(35, 122, 75, .18)' }}>
              {loading ? <><LoaderCircle size={18} className="login-spin" /> กำลังเข้าสู่ระบบ...</> : <>เข้าสู่ระบบ <ArrowRight size={18} /></>}
            </button>
          </form>

          {/* <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 28, color: '#8a9b90', fontSize: 12 }}>
            <LockKeyhole size={14} /> การเข้าสู่ระบบได้รับการปกป้อง
          </div> */}
        </div>
      </section>

      <style>{`
        .login-page input:focus { border-color: #5ca878 !important; box-shadow: 0 0 0 4px rgba(92, 168, 120, .13); }
        .login-page input { transition: border-color .2s, box-shadow .2s, transform .2s; }
        .login-page input:focus { transform: translateY(-1px); }
        .password-toggle { position: absolute; right: 10px; top: 7px; width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 9px; background: transparent; color: #7b9884; cursor: pointer; padding: 0; }
        .password-toggle:hover { background: #edf6ef; color: #237a4b; }
        .login-page button:not(:disabled):hover { background: #1b633d !important; transform: translateY(-1px); }
        .login-page button { transition: background .2s, transform .2s, box-shadow .2s; }
        .login-spin { animation: login-spin 1s linear infinite; }
        .login-form-content { animation: login-form-in .8s cubic-bezier(.22, 1, .36, 1) both; }
        @keyframes login-spin { to { transform: rotate(360deg); } }
        @keyframes login-form-in { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { .login-form-content { animation: none; } }
        @media (max-width: 760px) {
          .login-page { display: block !important; }
          .login-brand { min-height: 330px; padding: 28px 24px 34px !important; }
          .login-brand-content { margin-top: 12px; }
          .login-brand h1 { font-size: 30px !important; margin-top: 10px !important; }
          .login-brand p { display: none; }
          .login-brand > div:last-child { display: none !important; }
          .login-form-side { padding: 42px 24px 50px !important; }
        }
      `}</style>
    </main>
  )
}