import { getStatus } from '../utils/constants'

export function StatusBadge({ status }) {
  // 🌟 เปลี่ยนคำเริ่มต้นให้ตรงกับในฐานข้อมูล
  const displayStatus = status || 'รออนุมัติ' 
  const s = getStatus(displayStatus)
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {displayStatus}
    </span>
  )
}

export function Btn({ children, onClick, color = '#2E7D32', outline, small, disabled, style = {} }) {
  const base = {
    padding: small ? '5px 12px' : '10px 20px',
    fontSize: small ? 12 : 14, fontWeight: 600, borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer', border: 'none',
    transition: 'all .15s', opacity: disabled ? .5 : 1,
    fontFamily: 'Sarabun, sans-serif',
    ...style,
  }
  const themed = outline
    ? { background: 'transparent', border: `1.5px solid ${color}`, color }
    : { background: color, color: '#fff' }
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...themed }}>
      {children}
    </button>
  )
}

export function Input({ label, ...props }) {
  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#2E7D32', marginBottom: 4 }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 14,
          border: '1.5px solid #C8E6C9', outline: 'none',
          fontFamily: 'Sarabun, sans-serif', background: '#FAFFFE',
          color: '#1B5E20', boxSizing: 'border-box', transition: 'border .15s',
        }}
        onFocus={e => (e.target.style.borderColor = '#43A047')}
        onBlur={e  => (e.target.style.borderColor = '#C8E6C9')}
      />
    </div>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #E8F5E9',
      padding: '22px 24px', boxShadow: '0 2px 12px rgba(46,125,50,.07)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1B5E20' }}>{title}</h3>
    </div>
  )
}