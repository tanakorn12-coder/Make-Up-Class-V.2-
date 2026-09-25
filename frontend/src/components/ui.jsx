import React from 'react';
import { getStatus } from '../utils/constants';

export function StatusBadge({ status }) {
  const displayStatus = status || 'รออนุมัติ';
  const s = getStatus(displayStatus);
  
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 700,
      background: s.bg, color: s.text,
      boxShadow: `0 2px 8px ${s.bg}70`, // เพิ่มเงาเรืองแสงบางๆ ตามสีสถานะ
      border: `1px solid ${s.bg}`
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0, boxShadow: `0 0 4px ${s.dot}` }} />
      {displayStatus}
    </span>
  );
}

export function Btn({ children, onClick, color = '#16A34A', outline, small, disabled, style = {} }) {
  const base = {
    padding: small ? '6px 14px' : '10px 20px',
    fontSize: small ? 13 : 14.5, fontWeight: 600, borderRadius: 10,
    cursor: disabled ? 'not-allowed' : 'pointer', border: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
    opacity: disabled ? 0.6 : 1,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    fontFamily: 'inherit',
    ...style,
  };
  
  const themed = outline
    ? { background: 'transparent', border: `1.5px solid ${color}`, color: color }
    : { background: color, color: '#fff', boxShadow: `0 2px 10px ${color}40` };

  return (
    <button 
      onClick={disabled ? undefined : onClick} 
      style={{ ...base, ...themed }}
      onMouseOver={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = outline 
            ? `0 4px 12px ${color}20` 
            : `0 4px 15px ${color}60`;
          if (outline) {
            e.currentTarget.style.background = `${color}10`;
          }
        }
      }}
      onMouseOut={e => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = themed.boxShadow || 'none';
          if (outline) {
            e.currentTarget.style.background = 'transparent';
          }
        }
      }}
      onMouseDown={e => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(1px)';
      }}
      onMouseUp={e => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
    >
      {children}
    </button>
  );
}

export function Input({ label, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && (
        <label style={{ fontSize: 13.5, fontWeight: 700, color: '#1E293B' }}>
          {label}
        </label>
      )}
      <input
        {...props}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14.5,
          border: '1.5px solid #E2E8F0', outline: 'none',
          fontFamily: 'inherit', background: '#F8FAFC',
          color: '#0F172A', boxSizing: 'border-box', 
          transition: 'all 0.2s ease-in-out',
        }}
        onFocus={e => {
          e.target.style.borderColor = '#16A34A';
          e.target.style.background = '#ffffff';
          e.target.style.boxShadow = '0 0 0 4px rgba(22, 163, 74, 0.15)'; // วงแหวนสีเขียวตอนคลิกพิมพ์
        }}
        onBlur={e  => { 
          e.target.style.borderColor = '#E2E8F0'; 
          e.target.style.background = '#F8FAFC';
          e.target.style.boxShadow = 'none';
        }}
        onMouseOver={e => {
          if (document.activeElement !== e.target) e.target.style.borderColor = '#CBD5E1';
        }}
        onMouseOut={e => {
          if (document.activeElement !== e.target) e.target.style.borderColor = '#E2E8F0';
        }}
      />
    </div>
  );
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#ffffff', borderRadius: 16, border: '1px solid #E2E8F0',
      padding: '24px', boxShadow: '0 4px 24px rgba(0, 0, 0, 0.04)',
      transition: 'box-shadow 0.3s ease',
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
      <div style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 38, borderRadius: 10, background: '#DCFCE7', color: '#16A34A' 
      }}>
        <span style={{ fontSize: 20, display: 'flex' }}>{icon}</span>
      </div>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1E293B', letterSpacing: '-0.3px' }}>
        {title}
      </h3>
    </div>
  );
}