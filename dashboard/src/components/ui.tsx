import type { ReactNode } from 'react';
import { ArrowUpRight, CircleHelp, Radio } from 'lucide-react';

export function Badge({
  children,
  tone = '',
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`glass panel ${className}`}>{children}</section>;
}
export function SectionTitle({
  eyebrow,
  title,
  aside,
}: {
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {aside}
    </div>
  );
}
export function Unavailable({
  title = 'Chưa kết nối',
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <Radio size={25} strokeWidth={1.3} />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
export function Metric({
  name,
  unit,
  description,
  sample,
  mock,
  live = false,
}: {
  name: string;
  unit?: string;
  description: string;
  sample?: string;
  mock: boolean;
  live?: boolean;
}) {
  const hasValue = mock && sample !== undefined;
  return (
    <div className="metric">
      <div className="metric-name">
        {name}
        <CircleHelp size={13} aria-hidden="true" />
      </div>
      <div className="metric-value">
        {hasValue ? sample : '—'}
        <small>{hasValue ? unit : ''}</small>
      </div>
      <span className={hasValue ? 'metric-foot sample' : 'metric-foot'}>
        {hasValue ? (
          <>
            <ArrowUpRight size={13} />{' '}
            {live ? 'Quan sát trực tiếp' : 'Số liệu mẫu'}
          </>
        ) : (
          description
        )}
      </span>
    </div>
  );
}
